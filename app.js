// 標準判定ロジック
// 出発地・目的地最寄りICの距離合計で方面を決定する。
const USE_DISTANCE_ONLY_IC_AREA = true;

// キーワード判定は補助扱い。距離だけ方式を優先するため標準では使わない。
const ENABLE_KEYWORD_AREA_HINT = false;

// 開発中のGoogle API使用量を抑えるための設定
const DEV_API_SAVING_MODE = true;

// Polyline解析とRoutesレスポンスの詳細ログを表示する。
const DEBUG_ROUTE_VERBOSE = false;

// 想定道路表示フィルタの判定内容を表示する。
const DEBUG_DISPLAY_ROAD_SEQUENCE = false;

// 開発中は候補IC数を少なめにする
const DEV_IC_CANDIDATE_COUNT = 3;

// 通常運用時の候補IC数
const PROD_IC_CANDIDATE_COUNT = 5;

// 入口比較でおすすめ対象にする最低短縮時間
const MIN_ENTRANCE_RECOMMEND_SAVED_MINUTES = 5;

// 出口比較でおすすめ対象にする最低節約効率（1分あたりの節約額）
const MIN_EXIT_RECOMMEND_YEN_PER_DELAY_MINUTE = 10;

// 出口比較の総合スコアで使う時間価値の換算レート（1分あたり円）。
// 仮置きの値。実車テストで違和感が出たら調整する。
const EXIT_TIME_VALUE_YEN_PER_MINUTE = 20;

// 実際に使用する候補IC数
let isRealDriveTestMode = false;

let apiUsageStats = {
    dateKey: "",
    monthKey: "",
    routeSearches: 0,
    proToday: 0,
    essToday: 0,
    proMonth: 0,
    essMonth: 0
};

const API_USAGE_STORAGE_KEY =
    "highwayCospaNaviApiUsageStats";

function getApiUsageDateInfo() {
    const now =
        new Date();

    const year =
        now.getFullYear();

    const month =
        String(now.getMonth() + 1).padStart(2, "0");

    const day =
        String(now.getDate()).padStart(2, "0");

    return {
        dateKey:
            year + "-" + month + "-" + day,
        monthKey:
            year + "-" + month,
        monthLabel:
            (now.getMonth() + 1) + "月累計"
    };
}

function saveApiUsageStats() {
    try {
        localStorage.setItem(
            API_USAGE_STORAGE_KEY,
            JSON.stringify(apiUsageStats)
        );
    } catch (error) {
        console.warn(
            "API使用量の保存に失敗しました",
            error
        );
    }
}

function resetApiUsageToday(dateKey) {
    apiUsageStats.dateKey =
        dateKey;

    apiUsageStats.routeSearches = 0;
    apiUsageStats.proToday = 0;
    apiUsageStats.essToday = 0;
}

function resetApiUsageMonth(monthKey) {
    apiUsageStats.monthKey =
        monthKey;

    apiUsageStats.proMonth = 0;
    apiUsageStats.essMonth = 0;
}

function normalizeApiUsageStats() {
    const dateInfo =
        getApiUsageDateInfo();

    let changed = false;

    if (apiUsageStats.monthKey !== dateInfo.monthKey) {
        resetApiUsageMonth(dateInfo.monthKey);

        changed = true;
    }

    if (apiUsageStats.dateKey !== dateInfo.dateKey) {
        resetApiUsageToday(dateInfo.dateKey);

        changed = true;
    }

    if (changed) {
        saveApiUsageStats();
    }
}

function loadApiUsageStats() {
    try {
        const rawStats =
            localStorage.getItem(API_USAGE_STORAGE_KEY);

        if (rawStats) {
            apiUsageStats = {
                ...apiUsageStats,
                ...JSON.parse(rawStats)
            };
        }
    } catch (error) {
        console.warn(
            "API使用量の読み込みに失敗しました",
            error
        );
    }

    normalizeApiUsageStats();
    saveApiUsageStats();
}

function updateApiUsagePanel() {
    normalizeApiUsageStats();

    const searchesElement =
        document.getElementById("apiUsageSearches");

    const routeRequestsElement =
        document.getElementById("apiUsageRouteRequests");

    const monthlyElement =
        document.getElementById("apiUsageMonthly");

    if (
        !searchesElement ||
        !routeRequestsElement ||
        !monthlyElement
    ) {
        return;
    }

    const dateInfo =
        getApiUsageDateInfo();

    const searchesLabelElement =
        searchesElement.parentElement?.firstChild;

    const routeRequestsLabelElement =
        routeRequestsElement.parentElement?.firstChild;

    const monthlyLabelElement =
        monthlyElement.parentElement?.firstChild;

    if (searchesLabelElement) {
        searchesLabelElement.textContent =
            "API目安";
    }

    if (routeRequestsLabelElement) {
        routeRequestsLabelElement.textContent =
            "推定Routes";
    }

    if (monthlyLabelElement) {
        monthlyLabelElement.textContent =
            dateInfo.monthLabel;
    }

    const proToday =
        Number(apiUsageStats.proToday) || 0;

    const essToday =
        Number(apiUsageStats.essToday) || 0;

    const proMonth =
        Number(apiUsageStats.proMonth) || 0;

    const essMonth =
        Number(apiUsageStats.essMonth) || 0;

    searchesElement.textContent =
        "今日 " + apiUsageStats.routeSearches + "回";

    routeRequestsElement.textContent =
        "Pro " + proToday +
        "\nEss " + essToday;

    monthlyElement.textContent =
        "Pro " + proMonth +
        "\nEss " + essMonth;
}

function isProbablyNoTollRouteByMetrics(
    highwayDurationMinutes,
    localDurationMinutes,
    highwayDistanceKm,
    localDistanceKm
) {

    const durationDiffMinutes =
        Math.abs(
            highwayDurationMinutes -
            localDurationMinutes
        );

    const distanceDiffKm =
        Math.abs(
            Number(highwayDistanceKm) -
            Number(localDistanceKm)
        );

    return (
        durationDiffMinutes <= 3 &&
        distanceDiffKm <= 2
    );
}

// 以下2つの閾値は理論的な初期提案値であり、実車確認での調整が前提。
// MATCH_DISTANCE_METERSは「同じ道」とみなす距離、MATCH_RATIO_THRESHOLDは
// 「ほぼ同一ルート」とみなす一致率の下限。
const POLYLINE_COMPARISON_MATCH_DISTANCE_METERS = 50;
const POLYLINE_COMPARISON_MATCH_RATIO_THRESHOLD = 0.9;

// isProbablyNoTollRouteByMetrics（所要時間・距離の差による間接判定）とは
// 別に、高速利用ルートと有料回避ルートの実際の経路形状（Polyline）を
// 直接比較し、ほぼ同一経路であれば「有料道路を実質使っていない」と
// 判定する。highway側はpolylineAnalysis.sampledPoints
// （analyzeHighwayRoutePolyline側で既にデコード・サンプリング済み、
// 500m間隔）をそのまま再利用し、local側のencodedPolylineのみ新たに
// デコード・サンプリングすることで、重複計算を避けている。
function isProbablyNoTollRouteByPolylineComparison(
    polylineAnalysis,
    localRoute
) {
    const sampledHighwayPoints =
        polylineAnalysis?.sampledPoints;

    const localEncodedPolyline =
        localRoute?.polyline?.encodedPolyline;

    if (
        !Array.isArray(sampledHighwayPoints) ||
        sampledHighwayPoints.length === 0 ||
        !localEncodedPolyline
    ) {
        return false;
    }

    const localPoints =
        decodeRoutesEncodedPolyline(localEncodedPolyline);

    if (localPoints.length === 0) {
        return false;
    }

    const sampledLocalPoints =
        sampleRoutePointsByDistance(localPoints, 500);

    if (sampledLocalPoints.length === 0) {
        return false;
    }

    const matchedCount =
        sampledHighwayPoints.filter(highwayPoint =>
            sampledLocalPoints.some(localPoint =>
                calculateDistance(
                    highwayPoint.lat,
                    highwayPoint.lng,
                    localPoint.lat,
                    localPoint.lng
                ) <= POLYLINE_COMPARISON_MATCH_DISTANCE_METERS
            )
        ).length;

    const matchRatio =
        matchedCount / sampledHighwayPoints.length;

    return (
        matchRatio >=
        POLYLINE_COMPARISON_MATCH_RATIO_THRESHOLD
    );
}

// isProbablyNoTollRouteByPolylineComparison（ルート形状の直接比較、既存の
// 表示判定）とは独立した、shutoSegments/nexcoEntranceIc/nexcoExitIcに基づく
// 参考判定。トップパネルへの「旧判定・新判定」併記表示専用の追加情報であり、
// 既存の判定ロジック・表示のON/OFF自体には使わない。
function isProbablyNoTollRouteByShutoSegments(polylineAnalysis) {
    if (!polylineAnalysis) {
        return false;
    }

    const hasShutoSegments =
        Array.isArray(polylineAnalysis.shutoSegments) &&
        polylineAnalysis.shutoSegments.length > 0;

    const hasNexcoIc =
        Boolean(polylineAnalysis.nexcoEntranceIc) ||
        Boolean(polylineAnalysis.nexcoExitIc);

    return !hasShutoSegments && !hasNexcoIc;
}

// Google Routes APIのlegs.steps.navigationInstruction.instructionsに含まれる
// 「有料区間」文言を使った高速利用区間検出。座標ベース方式（shutoSegments等）
// とは別系統で、料金計算（estimateMainHighwayToll等）から利用する他、
// 診断ログ（[TOLL TAG検証・一時的]）にも引き続き使用する。
// 座標ベース方式のコード自体は削除せず、stepsデータが取得できない
// 呼び出し元（V2比較候補選定等）向けのフォールバックとして残している。
const TOLL_SECTION_TAG_TEXT = "有料区間";
const TOLL_SECTION_IC_MATCH_THRESHOLD_METERS = 500;

// entranceIc/exitIcが両方ともIC不明（未登録・座標精度不足等）だった場合の、
// 首都高/NEXCO判定フォールバックに使う文言。
const TOLL_SECTION_SHUTO_INSTRUCTION_TEXT = "首都高";

// stepのstartLocation/endLocationは、他のRoutes APIのLocation型と同様に
// { latLng: { latitude, longitude } }という構造を想定しているが、実際の
// レスポンス構造は未確認のため、想定と異なる形（直接latitude/longitudeを
// 持つ等）にもフォールバックできるようにしている。
function extractLatLngFromRouteLocation(location) {
    if (!location) {
        return null;
    }

    const latLng = location.latLng || location;

    if (
        typeof latLng.latitude !== "number" ||
        typeof latLng.longitude !== "number"
    ) {
        return null;
    }

    return {
        lat: latLng.latitude,
        lng: latLng.longitude
    };
}

function detectTollSectionsFromSteps(highwayRoute) {
    const steps =
        (highwayRoute?.legs || []).flatMap(
            leg => leg.steps || []
        );

    const taggedSteps = steps.map(step => ({
        step,
        isTollStep:
            String(
                step.navigationInstruction?.instructions || ""
            ).includes(TOLL_SECTION_TAG_TEXT)
    }));

    const icDefinitions = getAllRouteAnalysisIcDefinitions();

    const findNearestIcLabel = location => {
        const latLng =
            extractLatLngFromRouteLocation(location);

        if (!latLng) {
            return {
                icName: "座標取得不可",
                distanceMeters: null,
                ic: null
            };
        }

        let nearestIc = null;
        let nearestDistanceMeters = Infinity;

        icDefinitions.forEach(ic => {
            // 座標が欠けている・数値でないICは候補から除外する
            // （calculateDistanceがNaNを返すと、NaN < Infinityが常に
            // falseになり、そのICが無言でスキップされ続けてしまうため、
            // ここで明示的に弾いておく）。
            if (
                typeof ic.lat !== "number" ||
                typeof ic.lng !== "number" ||
                Number.isNaN(ic.lat) ||
                Number.isNaN(ic.lng)
            ) {
                return;
            }

            // entranceLat/exitLatが離れているIC（NAVITIME等で方向別に
            // 実測した座標を持つIC、例：八潮南）向けに、入口側・出口側
            // それぞれの座標への距離を計算し、近い方をこのICとの距離
            // として採用する。entranceLat/exitLatを持たないIC（従来通り
            // トップレベルのlat/lngのみ）は、両方ともlat/lngにフォール
            // バックするため、入口側・出口側の距離は同じ値になり、挙動は
            // 変わらない。
            const entranceLat =
                typeof ic.entranceLat === "number"
                    ? ic.entranceLat
                    : ic.lat;
            const entranceLng =
                typeof ic.entranceLng === "number"
                    ? ic.entranceLng
                    : ic.lng;
            const exitLat =
                typeof ic.exitLat === "number"
                    ? ic.exitLat
                    : ic.lat;
            const exitLng =
                typeof ic.exitLng === "number"
                    ? ic.exitLng
                    : ic.lng;

            const distanceToEntrance =
                calculateDistance(
                    latLng.lat,
                    latLng.lng,
                    entranceLat,
                    entranceLng
                );

            const distanceToExit =
                calculateDistance(
                    latLng.lat,
                    latLng.lng,
                    exitLat,
                    exitLng
                );

            const distanceMeters =
                Math.min(distanceToEntrance, distanceToExit);

            if (distanceMeters < nearestDistanceMeters) {
                nearestDistanceMeters = distanceMeters;
                nearestIc = ic;
            }
        });

        if (
            !nearestIc ||
            nearestDistanceMeters >
                TOLL_SECTION_IC_MATCH_THRESHOLD_METERS
        ) {
            return {
                icName: "IC不明（未登録の可能性）",
                distanceMeters: nearestDistanceMeters,
                ic: null
            };
        }

        return {
            icName: nearestIc.displayName,
            distanceMeters: nearestDistanceMeters,
            ic: nearestIc
        };
    };

    const tollSectionRuns = [];
    let currentRun = null;

    taggedSteps.forEach(({ step, isTollStep }) => {
        if (isTollStep) {
            if (!currentRun) {
                currentRun = { steps: [] };
                tollSectionRuns.push(currentRun);
            }

            currentRun.steps.push(step);
        }
        else {
            currentRun = null;
        }
    });

    // 「有料区間」タグは、首都高→NEXCO（東名・新東名等）のように複数の
    // 道路種別をまたいでも途切れず連続することがある。そのため
    // tollSectionRun（タグの連続run）をそのまま1区間として扱うと、
    // 区間全体が入口側の道路種別だけで一括分類され、NEXCO側の距離比例
    // 課金が計上されなくなってしまう。ここでは各runを、道路種別
    // （首都高かどうか）の切り替わりでさらにサブ区間に分割する。
    // 「有料区間」タグ自体の連続性判定（tollSectionRunsの構築）は
    // 変更しない。
    //
    // 首都高の路線名（SHUTO_IC_MASTER.routeName）は「首都高速」接頭辞を
    // 除いた形（例：「湾岸線」「神奈川1号横羽線」）でGoogleのinstructions
    // に現れることがあるため、キーワード集として使う。
    const shutoRouteNameKeywords = [
        ...new Set(
            SHUTO_IC_MASTER
                .map(ic => ic.routeName)
                .filter(Boolean)
                .map(routeName =>
                    routeName.replace(/^首都高速/, "")
                )
        )
    ];

    // NEXCO（本アプリでは首都高以外の高速道路全般をまとめて扱う）側の
    // 路線名。IC_MASTER各エリアのlabel（例：「東名高速道路」「中央自動車道」）
    // をそのままキーワードとして使う。
    const nexcoRouteLabelKeywords = [
        ...new Set(
            Object.values(IC_MASTER)
                .map(area => area.label)
                .filter(Boolean)
        )
    ];

    const hasShutoKeyword = instructions =>
        instructions.includes(
            TOLL_SECTION_SHUTO_INSTRUCTION_TEXT
        ) ||
        shutoRouteNameKeywords.some(keyword =>
            instructions.includes(keyword)
        );

    const hasExplicitNexcoSignal = (instructions, maneuver) =>
        nexcoRouteLabelKeywords.some(keyword =>
            instructions.includes(keyword)
        ) ||
        maneuver === "NAME_CHANGE";

    // 各stepを"shuto"/"nexco"/null（曖昧、明確なシグナルが無い）に
    // 分類する。曖昧なstep（「〜方面に進む」等、既存路線の続きを示す
    // だけの案内）は、直前に確定したstepの分類をそのまま引き継ぐ
    // （sticky）。先頭側が曖昧な場合は、後から確定した最初の分類を
    // 遡って適用する。全stepが曖昧なまま確定しなかった場合のみ、
    // 「有料区間」内という前提でshutoを既定値にする。
    const classifyStepsByRoadType = stepsToClassify => {
        const rawCategories =
            stepsToClassify.map(step => {
                const instructions =
                    String(
                        step.navigationInstruction
                            ?.instructions || ""
                    );

                if (hasShutoKeyword(instructions)) {
                    return "shuto";
                }

                if (
                    hasExplicitNexcoSignal(
                        instructions,
                        step.navigationInstruction
                            ?.maneuver
                    )
                ) {
                    return "nexco";
                }

                return null;
            });

        const filledCategories = [...rawCategories];

        for (
            let index = 1;
            index < filledCategories.length;
            index++
        ) {
            if (filledCategories[index] === null) {
                filledCategories[index] =
                    filledCategories[index - 1];
            }
        }

        for (
            let index = filledCategories.length - 2;
            index >= 0;
            index--
        ) {
            if (filledCategories[index] === null) {
                filledCategories[index] =
                    filledCategories[index + 1];
            }
        }

        return filledCategories.map(
            category => category || "shuto"
        );
    };

    const splitRunByRoadType = run => {
        const categories =
            classifyStepsByRoadType(run.steps);

        const subRuns = [];
        let currentSubRun = null;
        let currentCategory = null;

        run.steps.forEach((step, index) => {
            const category = categories[index];

            if (
                !currentSubRun ||
                category !== currentCategory
            ) {
                currentSubRun = { steps: [] };
                subRuns.push(currentSubRun);
                currentCategory = category;
            }

            currentSubRun.steps.push(step);
        });

        return subRuns;
    };

    const tollSubRuns =
        tollSectionRuns.flatMap(splitRunByRoadType);

    const tollSections =
        tollSubRuns.map(run => {
            const firstStep = run.steps[0];
            const lastStep =
                run.steps[run.steps.length - 1];

            const entranceLabel =
                findNearestIcLabel(firstStep.startLocation);
            const exitLabel =
                findNearestIcLabel(lastStep.endLocation);

            // 区間内の実移動距離（steps.distanceMetersの合計）。
            // 追加のRoutes API呼び出し無しで、既に取得済みのレスポンス
            // から直接算出できる。
            const totalDistanceMeters =
                run.steps.reduce(
                    (sum, step) =>
                        sum + (Number(step.distanceMeters) || 0),
                    0
                );

            // 区間内の全stepsのinstructionsを連結したもの。entranceIc/
            // exitIcが両方ともIC不明の場合の、首都高/NEXCO判定フォール
            // バックに使う。
            const combinedInstructions =
                run.steps
                    .map(step =>
                        step.navigationInstruction
                            ?.instructions || ""
                    )
                    .join(" / ");

            // 区間の首都高/NEXCO判定。entranceIc/exitIcのいずれかが
            // 首都高であれば首都高区間とする。両方ともIC不明（未登録・
            // 座標精度不足等）でICから判定できない場合のみ、区間内steps.
            // navigationInstruction.instructionsに「首都高」という文言が
            // 含まれるかどうかにフォールバックする。
            const icBasedIsShuto =
                isShutoIcForRouteAnalysis(
                    entranceLabel.ic || {}
                ) ||
                isShutoIcForRouteAnalysis(
                    exitLabel.ic || {}
                );

            let isShutoSection = icBasedIsShuto;
            let shutoDeterminedBy = "ic";

            if (
                !icBasedIsShuto &&
                !entranceLabel.ic &&
                !exitLabel.ic
            ) {
                isShutoSection =
                    combinedInstructions.includes(
                        TOLL_SECTION_SHUTO_INSTRUCTION_TEXT
                    );
                shutoDeterminedBy = "instructionsFallback";
            }

            return {
                stepCount: run.steps.length,
                totalDistanceMeters,
                combinedInstructions,
                isShutoSection,
                shutoDeterminedBy,
                entranceLatLng:
                    extractLatLngFromRouteLocation(
                        firstStep.startLocation
                    ),
                exitLatLng:
                    extractLatLngFromRouteLocation(
                        lastStep.endLocation
                    ),
                entranceIc: entranceLabel.ic,
                entranceIcName: entranceLabel.icName,
                entranceDistanceMeters:
                    entranceLabel.distanceMeters,
                exitIc: exitLabel.ic,
                exitIcName: exitLabel.icName,
                exitDistanceMeters: exitLabel.distanceMeters,
                rawFirstStartLocation:
                    firstStep.startLocation,
                rawLastEndLocation: lastStep.endLocation
            };
        });

    return {
        // legs.steps自体が取得できているかどうか（trueなら、
        // tollEntryCount:0は「stepsを見た上で有料区間が無かった」という
        // 正当な結果。falseなら「stepsデータ自体が無く判定不能」という
        // 全く別の意味であり、呼び出し側はこれを区別してフォールバック
        // するかどうかを判断する）。
        hasStepsData: steps.length > 0,
        tollSections,
        tollEntryCount: tollSections.length
    };
}

// 【Step 1・新規追加のみ】tollSections（detectTollSectionsFromStepsの
// 区間情報、走行順）から、通過IC順序リストを組み立てる。区間境界で
// 前区間のexitIcと次区間のentranceIcが同一IC（buildIcDefinitionIdentity
// で識別）を指す場合は1件にまとめる。entranceIc/exitIcがnull（IC不明）の
// 区間は、実ICオブジェクトとは別の「未確定」エントリとしてそのまま残す
// （厳密な重複判定はせず、直前の未確定エントリと近距離の場合のみまとめる
// 簡易対応）。現時点では既存のどの関数からも呼び出していない。
function buildTollSectionBasedIcSequence(tollSections) {

    if (!Array.isArray(tollSections)) {
        return [];
    }

    const UNRESOLVED_MERGE_DISTANCE_METERS = 50;

    const sequence = [];

    const getLastEntry = () =>
        sequence[sequence.length - 1] || null;

    const isSameResolvedIcAsLast = identity => {
        const last = getLastEntry();

        return (
            Boolean(identity) &&
            Boolean(last) &&
            last.isUnresolved === false &&
            buildIcDefinitionIdentity(last.ic) === identity
        );
    };

    const isNearLastUnresolved = latLng => {
        const last = getLastEntry();

        if (
            !latLng ||
            !last ||
            last.isUnresolved !== true ||
            !last.latLng
        ) {
            return false;
        }

        return (
            calculateDistance(
                last.latLng.lat,
                last.latLng.lng,
                latLng.lat,
                latLng.lng
            ) <= UNRESOLVED_MERGE_DISTANCE_METERS
        );
    };

    const pushResolvedIc = ic => {
        const identity = buildIcDefinitionIdentity(ic);

        if (isSameResolvedIcAsLast(identity)) {
            return;
        }

        sequence.push({
            isUnresolved: false,
            ic
        });
    };

    const pushUnresolvedIc = (latLng, label) => {
        if (isNearLastUnresolved(latLng)) {
            return;
        }

        sequence.push({
            isUnresolved: true,
            latLng: latLng || null,
            label: label || "IC不明（未登録の可能性）"
        });
    };

    tollSections.forEach(section => {
        if (section.entranceIc) {
            pushResolvedIc(section.entranceIc);
        } else {
            pushUnresolvedIc(
                section.entranceLatLng,
                section.entranceIcName
            );
        }

        if (section.exitIc) {
            pushResolvedIc(section.exitIc);
        } else {
            pushUnresolvedIc(
                section.exitLatLng,
                section.exitIcName
            );
        }
    });

    return sequence;
}

// 【Step 2】buildTollSectionBasedIcSequenceの結果から、入口比較用の
// 候補IC配列を組み立てる。isUnresolved:true（IC不明区間）のエントリは
// ここでは除外する（Step 3で別途、表示専用の挟み込み行として扱う予定）。
// entranceSelectable:falseのICは、CLAUDE.mdのルール通り候補に含めない。
// 返り値はsearchEntranceIcComparisonV2がそのまま消費できる、
// {googleName, displayName, roadType, ...} を持つICオブジェクトの配列
// （既存のselectedExitsと同じ形）。
function selectEntranceCandidatesFromTollSectionSequence(
    tollSections,
    maxCount
) {

    if (!Array.isArray(tollSections) || maxCount <= 0) {
        return [];
    }

    const sequence =
        buildTollSectionBasedIcSequence(tollSections);

    const resolvedIcs =
        sequence
            .filter(entry => entry.isUnresolved === false)
            .map(entry => entry.ic)
            .filter(ic =>
                ic &&
                ic.entranceSelectable !== false
            );

    // entranceSelectable:falseの除外でunresolvedIcs間の間隔が詰まり、
    // 元は隣接していなかった同一ICが連続してしまう場合があるため、
    // 直前のエントリとのみ比較する（buildTollSectionBasedIcSequence側の
    // 重複除去と同じ「連続する同一ICのみ」という考え方に揃える）。
    const dedupedIcs = [];

    resolvedIcs.forEach(ic => {
        const previousIc =
            dedupedIcs[dedupedIcs.length - 1] || null;

        if (
            previousIc &&
            buildIcDefinitionIdentity(previousIc) ===
                buildIcDefinitionIdentity(ic)
        ) {
            return;
        }

        dedupedIcs.push(ic);
    });

    return dedupedIcs.slice(0, maxCount);
}

// tollSections（「有料区間」タグベース）を使った料金計算。
// 区間ごとの首都高/NEXCO判定（section.isShutoSection）はdetectToll
// SectionsFromSteps側で既に計算済みのため、ここではその値をそのまま
// 使う（検索条件パネル等、他の呼び出し元とも判定結果を共有するため）。
// いずれかの境界ICが首都高であれば区間全体を首都高（定額課金）として
// 扱う簡略化を採用している（首都高からNEXCOへ乗り継ぎなしで連続する
// 区間では、NEXCO側の距離比例分が計上されない制約が残るが、初期実装
// として許容する）。NEXCO区間は、区間内のsteps.distanceMetersの合計
// （実測、追加API呼び出し不要）に24円/km（既存の距離ベース概算と
// 同じ単価）を乗じて算出する。
function estimateMainHighwayTollFromTollSections(
    tollTagResult
) {
    let shutoToll = 0;
    let nexcoToll = 0;

    tollTagResult.tollSections.forEach(section => {
        const isShutoSection = section.isShutoSection;

        if (isShutoSection) {
            shutoToll += SHUTO_TOLL_ESTIMATE_YEN;
        }
        else {
            nexcoToll +=
                Math.round(
                    (section.totalDistanceMeters / 1000) * 24
                );
        }
    });

    const firstSection =
        tollTagResult.tollSections[0] || null;

    const lastSection =
        tollTagResult.tollSections[
            tollTagResult.tollSections.length - 1
        ] || null;

    return {
        amount: shutoToll + nexcoToll,
        highwayToll: nexcoToll,
        shutoToll,
        shutoEntryCount: tollTagResult.tollEntryCount,
        label:
            tollTagResult.tollEntryCount > 0
                ? "料金計算：TOLL TAGタグ（有料区間" +
                    tollTagResult.tollEntryCount + "件）"
                : "料金計算：TOLL TAGタグ（有料区間なし）",
        usedTollSections: true,
        usedPolylineAnalysis: false,
        usedNexcoPolylineIc: false,
        startIc: firstSection?.entranceIc || null,
        endIc: lastSection?.exitIc || null,
        tollSections: tollTagResult.tollSections,
        fallbackReason: null
    };
}

// 「※有料未使用かも」表示は、Polyline直接比較方式
// （isProbablyNoTollRouteByPolylineComparison、「参考：高速利用ルート」欄）
// に一本化したため無効化。関数自体はisProbablyNoTollRouteByMetricsとともに
// 削除せず残し、常に非表示相当（空文字）を返すようにしている。
function createProbablyNoTollRouteNoteHtml(
    isProbablyNoTollRoute
) {

    return "";
}

// 「※有料未使用かも」表示は、Polyline直接比較方式
// （isProbablyNoTollRouteByPolylineComparison、「参考：高速利用ルート」欄）
// に一本化したため無効化。関数自体は削除せず残し、常に非表示にする。
function updateProbablyNoTollRouteNote(
    isProbablyNoTollRoute
) {

    const note =
        document.getElementById("highwayNoTollNote");

    const spacer =
        document.getElementById("localNoTollSpacer");

    if (!note || !spacer) {
        return;
    }

    note.textContent = "";
    note.hidden = true;

    spacer.textContent = "";
    spacer.hidden = true;
}

function incrementRouteSearchUsage() {
    normalizeApiUsageStats();
    apiUsageStats.routeSearches++;
    saveApiUsageStats();
    updateApiUsagePanel();
}

function incrementRouteRequestUsage(routeTier = "pro") {
    normalizeApiUsageStats();

    if (routeTier === "ess") {
        apiUsageStats.essToday++;
        apiUsageStats.essMonth++;
    }
    else {
        apiUsageStats.proToday++;
        apiUsageStats.proMonth++;
    }

    saveApiUsageStats();
    updateApiUsagePanel();
}

loadApiUsageStats();

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        updateApiUsagePanel
    );
}
else {
    updateApiUsagePanel();
}

function getActiveIcCandidateCount() {
    return isRealDriveTestMode
        ? PROD_IC_CANDIDATE_COUNT
        : DEV_IC_CANDIDATE_COUNT;
}

function getAutoUpdateDistanceThreshold() {

    return isRealDriveTestMode
        ? 2000
        : 7000;
}

function getAutoUpdateTimeThreshold() {

    return isRealDriveTestMode
        ? 180
        : 300;
}

const AUTO_RESEARCH_FAILURE_COOLDOWN_SECONDS = 60;

const SHUTO_TOLL_ESTIMATE_YEN = 1000;

function isShutoIc(ic) {
    return Boolean(
        ic &&
        ic.roadType === "首都高"
    );
}

function formatIcDisplayName(ic) {
    if (!ic) {
        return "";
    }

    const displayName =
        (ic.displayName || "")
            .replace(/（首都高）$/, "");

    return isShutoIc(ic)
        ? "🛣 " + displayName
        : displayName;
}

function formatTollRouteLabel(startIc, endIc) {
    return (
        formatIcDisplayName(startIc) +
        " → " +
        formatIcDisplayName(endIc)
    );
}

// shutoEntryCountは、ルート中で首都高に乗った回数（polylineAnalysis.shutoEntryCount、
// analyzeHighwayRoutePolyline側のshutoSegments.lengthから算出）。呼び出し側で
// polylineAnalysisが無い場合は、isShutoIc(startIc)||isShutoIc(endIc)による
// 従来の二値判定（1回分）をフォールバックとして渡すこと。
function getShutoTollEstimateForIcPair(startIc, endIc, shutoEntryCount) {
    return shutoEntryCount * SHUTO_TOLL_ESTIMATE_YEN;
}

// 入口比較V2・出口比較V2で共通利用する候補料金概算。
// 首都高IC同士は固定料金のみとし、首都高⇔非首都高をまたぐ場合は、
// polylineAnalysisのnexcoEntranceIc/nexcoExitIcを使って首都高区間の
// 距離ベース概算の二重計上を避ける。取得できない場合は既存の
// startIc→endIc距離ベース計算にフォールバックする。
async function estimateComparisonCandidateToll({
    startIc,
    endIc,
    startGoogleName,
    endGoogleName,
    fallbackDistanceMeters,
    polylineAnalysis = null
}) {

    const shutoToll =
        getShutoTollEstimateForIcPair(
            startIc,
            endIc,
            (
                polylineAnalysis?.hasTollSectionStepsData
                    ? polylineAnalysis.tollEntryCount
                    : polylineAnalysis?.shutoEntryCount
            ) ??
                (
                    (isShutoIc(startIc) || isShutoIc(endIc))
                        ? 1
                        : 0
                )
        );

    const startIsShuto = isShutoIc(startIc);
    const endIsShuto = isShutoIc(endIc);

    // ルールA：首都高IC同士は距離ベース概算を重ねず、固定料金のみ。
    if (startIsShuto && endIsShuto) {
        return shutoToll;
    }

    let tollFromGoogleName = startGoogleName;
    let tollToGoogleName = endGoogleName;

    if (startIsShuto && !endIsShuto) {

        // ルールB：首都高入口の違いで料金が揺れないよう、
        // NEXCO側入口〜endIcの区間だけを距離ベース概算の対象にする。
        const nexcoEntranceGoogleName =
            polylineAnalysis?.nexcoEntranceIc?.googleName;

        if (nexcoEntranceGoogleName) {
            tollFromGoogleName = nexcoEntranceGoogleName;
        }
    }
    else if (!startIsShuto && endIsShuto) {

        // ルールC：首都高に入る直前のNEXCO側ICまでの区間だけを
        // 距離ベース概算の対象にする。
        const nexcoExitGoogleName =
            polylineAnalysis?.nexcoExitIc?.googleName;

        if (nexcoExitGoogleName) {
            tollToGoogleName = nexcoExitGoogleName;
        }
    }

    let tollDistanceMeters = fallbackDistanceMeters;

    if (
        tollFromGoogleName &&
        tollToGoogleName &&
        tollFromGoogleName === tollToGoogleName
    ) {

        // 起点と終点が同一ICの場合は、距離ベース加算を発生させない。
        tollDistanceMeters = 0;
    }
    else if (
        tollFromGoogleName &&
        tollToGoogleName
    ) {

        try {

            const tollRoute =
                await getHighwayRouteForTollEstimate(
                    tollFromGoogleName,
                    tollToGoogleName
                );

            tollDistanceMeters =
                tollRoute.distanceMeters;

        } catch (error) {

            // ルールD：距離取得に失敗した場合は、既存のfallback距離を使う。
            tollDistanceMeters = fallbackDistanceMeters;
        }
    }

    return (
        Math.round(
            (tollDistanceMeters / 1000) * 24
        ) +
        shutoToll
    );
}

function shortenHighwayRoadName(roadName) {
    const value = String(roadName || "").trim();

    const roadNameRules = [
        [/首都(?:高速|高)/, "首都高"],
        [/小田原厚木|小田厚/, "小田厚"],
        [/東関東/, "東関東道"],
        [/上信越/, "上信越道"],
        [/アクアライン/, "アクアライン"],
        [/常磐/, "常磐道"],
        [/東北/, "東北道"],
        [/関越/, "関越道"],
        [/圏央/, "圏央道"],
        [/中央/, "中央道"],
        [/東名/, "東名"],
        [/京葉/, "京葉道路"],
        [/館山/, "館山道"]
    ];

    const matchedRule =
        roadNameRules.find(([pattern]) => pattern.test(value));

    return matchedRule
        ? matchedRule[1]
        : value.replace(/方面$/, "");
}

function formatAssumedRouteIcName(ic) {
    return String(
        ic?.displayName ||
        ic?.googleName ||
        ic?.name ||
        ""
    )
        .replace(/（首都高）$/, "")
        .trim();
}

function createAssumedRouteRoadHtml(roadName) {
    return (
        "<span class=\"assumed-route-road\">" +
        escapeHtml(roadName) +
        "</span>"
    );
}

function createAssumedRouteIcPart(
    ic,
    role,
    roadPrefix = ""
) {
    if (
        !ic ||
        ic[role + "Selectable"] === false
    ) {
        return null;
    }

    const icName =
        formatAssumedRouteIcName(ic);

    if (!icName) {
        return null;
    }

    return {
        identity:
            "ic:" +
            (ic.googleName || ic.id || icName),
        html:
            (
                roadPrefix
                    ? createAssumedRouteRoadHtml(roadPrefix) +
                        " "
                    : ""
            ) +
            escapeHtml(icName)
    };
}

// buildAssumedRouteHtml用：ICオブジェクト（shutoEntranceIc等）が
// routeTrace（走行順のサンプル点列）上で最初に現れる位置
// （routeDistanceMeters）を探す。googleName優先、なければdisplayNameで照合。
function findAssumedRouteIcRouteDistanceMeters(routeTrace, ic) {
    if (!ic) {
        return null;
    }

    const match = routeTrace.find(item =>
        item.exit &&
        (
            ic.googleName
                ? item.exit.googleName === ic.googleName
                : item.exit.displayName === ic.displayName
        )
    );

    return match ? match.routeDistanceMeters : null;
}

// buildAssumedRouteHtml用：道路ラベル（shortenHighwayRoadName後の表示名）
// に対応する元ラベル群が、roadSwitches（走行順の道路切替地点）で
// 切り替わった位置を探す。切替地点自体はfrom/toの中間点のため、
// 切替直後のIC（afterExit）自身の位置と比較し、遅い方（Math.max）を
// 採用することで、entrance系ICとの同着（タイブレークで解決）を保証する。
// 該当する切替が見つからない場合（ルート先頭からその道路のケース）は、
// routeTrace内でそのラベルが最初に現れる位置にフォールバックする。
function findAssumedRouteRoadRouteDistanceMeters(
    routeTrace,
    roadSwitches,
    matchingRawLabels
) {
    const switchEntry =
        roadSwitches.find(item =>
            matchingRawLabels.includes(item.toRoad)
        );

    if (switchEntry) {
        const afterExitDistanceMeters =
            findAssumedRouteIcRouteDistanceMeters(
                routeTrace,
                switchEntry.afterExit
            );

        return afterExitDistanceMeters !== null
            ? Math.max(
                switchEntry.routeDistanceMeters,
                afterExitDistanceMeters
            )
            : switchEntry.routeDistanceMeters;
    }

    const firstOccurrence =
        routeTrace.find(item =>
            matchingRawLabels.includes(item.roadLabel)
        );

    return firstOccurrence
        ? firstOccurrence.routeDistanceMeters
        : Infinity;
}

// buildAssumedRouteHtml用：tollSectionのNEXCO側路線名を、entranceIc/
// exitIcのsourceAreaKey（IC_MASTER側のエリアキー）からIC_MASTER[key].label
// を引いて求める。ICが両方とも特定できない場合は、区間内instructions
// （combinedInstructions）にIC_MASTERのlabelがそのまま含まれていないか
// 探し、それも見つからなければ汎用的に「NEXCO」とする。
function resolveTollSectionNexcoRoadLabel(section) {
    const candidateIc =
        section.entranceIc || section.exitIc;

    const areaLabel =
        candidateIc?.sourceAreaKey &&
        IC_MASTER[candidateIc.sourceAreaKey]?.label;

    if (areaLabel) {
        return shortenHighwayRoadName(areaLabel);
    }

    const combinedInstructions =
        section.combinedInstructions || "";

    const matchedLabel =
        Object.values(IC_MASTER)
            .map(area => area.label)
            .filter(Boolean)
            .find(label =>
                combinedInstructions.includes(label)
            );

    return matchedLabel
        ? shortenHighwayRoadName(matchedLabel)
        : "NEXCO";
}

// buildAssumedRouteHtml用：TOLL TAG方式（tollSections）から表示HTMLを
// 組み立てる。tollSectionsは既にルート走行順（stepsの並び順）に
// 揃っているため、既存の座標ベース方式のようなrouteDistanceMetersに
// よる再ソートは不要。区間ごとに道路名pill（首都高／NEXCO側の実際の
// 道路名）を先頭に付け、複数区間ある場合は2件目以降の区間にも同様に
// pillを付けることで、区間の切り替わり・再入場が視覚的に分かるように
// している。
// tollSectionsが空配列の場合は空文字列を返す（呼び出し元の
// buildTollUsageSummaryHtmlが、旧判定・新判定の併記表示を含めて
// 一元的に処理するため、ここでは「有料道路なし」相当のメッセージは
// 持たない）。
function buildAssumedRouteHtmlFromTollSections(tollSections) {
    return (tollSections || [])
        .map(section => {
            const pillLabel =
                section.isShutoSection
                    ? "首都高"
                    : resolveTollSectionNexcoRoadLabel(
                        section
                    );

            const entranceText =
                section.entranceIc
                    ? formatAssumedRouteIcName(
                        section.entranceIc
                    )
                    : "IC不明";

            const exitText =
                section.exitIc
                    ? formatAssumedRouteIcName(
                        section.exitIc
                    )
                    : "IC不明";

            return (
                createAssumedRouteRoadHtml(pillLabel) +
                " " +
                escapeHtml(entranceText) +
                " → " +
                escapeHtml(exitText)
            );
        })
        .join(" → ");
}

function buildAssumedRouteHtml(polylineAnalysis) {
    if (!polylineAnalysis) {
        return "";
    }

    // TOLL TAG方式（tollSections）が利用できる場合はこちらを優先する。
    // hasTollSectionStepsDataがfalseの場合（getHighwayRouteForMultiExit
    // Comparison経由等、stepsを取得していない呼び出し元）は、既存の
    // 座標ベース方式（shutoEntranceIc/shutoExitIc/nexcoEntranceIc/
    // nexcoExitIc・routeRoads等）にフォールバックする。座標ベース方式の
    // コード自体は削除せず、以下にそのまま残している。
    if (polylineAnalysis.hasTollSectionStepsData === true) {
        return buildAssumedRouteHtmlFromTollSections(
            polylineAnalysis.tollSections
        );
    }

    // ノイズ補正済みのrouteTrace/roadSwitchesのみ使用する
    // （rawRouteTrace/rawRoadSwitchesは誤混入対策前のため使わない）。
    const routeTrace = polylineAnalysis.routeTrace || [];
    const roadSwitches = polylineAnalysis.roadSwitches || [];

    const rawRoadLabels =
        polylineAnalysis.displayRoadSequence ||
        polylineAnalysis.roadSequence ||
        [];

    const routeRoads = [
        ...new Set(
            rawRoadLabels
                .map(shortenHighwayRoadName)
                .filter(roadName =>
                    roadName && roadName !== "首都高"
                )
        )
    ];

    // tieRankは同一routeDistanceMetersでの並び順を決めるタイブレーク。
    // 「entrance系IC→道路名」「道路名→exit系IC」という自然な並びに
    // なるよう、entrance系を負、道路名を0、exit系を正にしている。
    const buildIcPart = (ic, role, roadPrefix, tieRank) => {
        const part = createAssumedRouteIcPart(ic, role, roadPrefix);

        if (!part) {
            return null;
        }

        const routeDistanceMeters =
            findAssumedRouteIcRouteDistanceMeters(routeTrace, ic);

        return {
            ...part,
            tieRank,
            routeDistanceMeters:
                routeDistanceMeters !== null
                    ? routeDistanceMeters
                    : (
                        role === "entrance"
                            ? -Infinity
                            : Infinity
                    )
        };
    };

    const routeParts = [
        buildIcPart(
            polylineAnalysis.shutoEntranceIc,
            "entrance",
            "首都高",
            -1
        ),
        buildIcPart(
            polylineAnalysis.shutoExitIc,
            "exit",
            "",
            1
        ),
        buildIcPart(
            polylineAnalysis.nexcoEntranceIc,
            "entrance",
            "",
            -1
        ),
        buildIcPart(
            polylineAnalysis.nexcoExitIc,
            "exit",
            "",
            1
        ),
        ...routeRoads.map(roadName => {
            const matchingRawLabels =
                rawRoadLabels.filter(rawLabel =>
                    shortenHighwayRoadName(rawLabel) === roadName
                );

            return {
                identity: "road:" + roadName,
                html: createAssumedRouteRoadHtml(roadName),
                tieRank: 0,
                routeDistanceMeters:
                    findAssumedRouteRoadRouteDistanceMeters(
                        routeTrace,
                        roadSwitches,
                        matchingRawLabels
                    )
            };
        })
    ]
        .filter(Boolean)
        .sort((a, b) =>
            (a.routeDistanceMeters - b.routeDistanceMeters) ||
            (a.tieRank - b.tieRank)
        );

    const displayedIdentities = new Set();

    return routeParts
        .filter(part => {
            if (displayedIdentities.has(part.identity)) {
                return false;
            }

            displayedIdentities.add(part.identity);
            return true;
        })
        .map(part => part.html)
        .join(" → ");
}

// 複数IC比較中も、通常検索で得た高速利用ルート概要をトップパネルに参考表示する。
// Routes APIは新たに呼ばず、既存のlastHighwayRoutePolylineAnalysisを流用する。
function updateDashboardAssumedRouteForComparisonMode() {

    const dashboardAssumedRouteValue =
        document.getElementById("dashboardAssumedRouteValue");

    if (!dashboardAssumedRouteValue) {
        return;
    }

    dashboardAssumedRouteValue.innerHTML =
        buildTollUsageSummaryHtml(
            lastHighwayRoutePolylineAnalysis,
            lastProbablyNoTollRouteByPolylineComparison
        );
}

// 「（有料道路を使用していません）」表示に、既存のPolyline直接比較判定
// （旧判定、この関数が呼ばれる時点で常に無料）と、shutoSegments/
// nexcoEntranceIc/nexcoExitIcに基づく参考判定（新判定）を併記する。
// より精度の高いTOLL TAG方式（buildTollUsageSummaryHtml）に表示は
// 一本化したため現時点では呼び出し元から未参照だが、関数自体は
// 削除せず残している。
function buildNoTollRouteNoteHtml(polylineAnalysis) {
    const isNoTollByShutoSegments =
        isProbablyNoTollRouteByShutoSegments(polylineAnalysis);

    const judgmentMismatch = !isNoTollByShutoSegments;

    return (
        "<span class=\"assumed-route-no-toll-note\">" +
            "（有料道路を使用していません）" +
            "<small class=\"assumed-route-no-toll-detail" +
                (
                    judgmentMismatch
                        ? " assumed-route-no-toll-mismatch"
                        : ""
                ) +
                "\">" +
                "旧判定：無料 / 新判定：" +
                (isNoTollByShutoSegments ? "無料" : "有料") +
                (
                    judgmentMismatch
                        ? "　⚠一致していません"
                        : ""
                ) +
            "</small>" +
        "</span>"
    );
}

// 「（有料道路を使用していません）」に関する表示を一本化する。
// 旧判定（isProbablyNoTollRouteByPolylineComparison、ルート形状比較）と
// 新判定（TOLL TAG方式、tollSectionsの有無）を、常に「形状判定：◯◯ /
// TOLLTAG：◯◯」という1行で併記する。
// 判定ロジック自体（isProbablyNoTollRouteByPolylineComparison・
// tollSectionsの算出方法）はここでは変更しない。
//
// 表示方針：
// - 両判定とも「未使用」の場合：この判定行だけを表示する
//   （実際に高速利用ルートが無いため、通常のルート表示は行わない）
// - どちらかが「使用」の場合：通常のルート表示（buildAssumedRouteHtml）
//   に加えて、この判定行を小さく併記する
// - 新旧の判定が食い違う場合は、既存の.assumed-route-no-toll-mismatch
//   （警告色）で強調する
//
// なお、旧「新判定」（shutoSegments/isProbablyNoTollRouteByShutoSegments）
// は、より精度の高いTOLL TAG方式（tollSections）に置き換えられたため、
// この表示では使用しない。関数自体は削除せず残している。
function buildTollUsageSummaryHtml(
    polylineAnalysis,
    isOldNoToll
) {
    const hasTollTagData =
        polylineAnalysis?.hasTollSectionStepsData === true;

    const isNewNoToll =
        hasTollTagData
            ? !(
                polylineAnalysis.tollSections &&
                polylineAnalysis.tollSections.length > 0
            )
            : null;

    const oldText =
        isOldNoToll ? "有料未使用" : "有料使用";

    const newText =
        isNewNoToll === null
            ? "不明"
            : (isNewNoToll ? "有料未使用" : "有料使用");

    const isMismatch =
        isNewNoToll !== null &&
        isOldNoToll !== isNewNoToll;

    const summaryText =
        "形状判定：" + oldText +
        " / TOLLTAG：" + newText +
        (
            isMismatch
                ? "　⚠一致していません"
                : ""
        );

    const bothNoToll =
        isOldNoToll && isNewNoToll === true;

    if (bothNoToll) {
        return (
            "<span class=\"assumed-route-toll-sections-empty\">" +
            escapeHtml(summaryText) +
            "</span>"
        );
    }

    const assumedRouteHtml =
        buildAssumedRouteHtml(polylineAnalysis);

    return (
        (assumedRouteHtml || "ルート情報なし") +
        "<small class=\"assumed-route-no-toll-detail" +
            (
                isMismatch
                    ? " assumed-route-no-toll-mismatch"
                    : ""
            ) +
            "\">" +
            escapeHtml(summaryText) +
        "</small>"
    );
}

function createMainTollEstimateHtml(tollEstimate) {
    const amount = Number(tollEstimate?.amount) || 0;
    const shutoToll = Number(tollEstimate?.shutoToll) || 0;
    const highwayToll =
        Number(tollEstimate?.highwayToll) || 0;

    let html =
        "約" + amount.toLocaleString() + "円";

    if (shutoToll > 0) {
        html +=
            "<small class=\"dashboard-toll-breakdown\">" +
            "首都高" + shutoToll.toLocaleString() +
            " + 高速" + highwayToll.toLocaleString() +
            "</small>";
    }

    return html;
}

function setDashboardNormalSearchMode(isActive) {
    const dashboardCard =
        document.querySelector(".dashboard-card");

    if (dashboardCard) {
        dashboardCard.classList.toggle(
            "normal-search-active",
            isActive
        );
    }
}

// 首都高出入口の一元管理用マスター。
// 現時点では既存ロジックから未参照。
// 今後、通常検索のPolyline解析や複数IC比較候補選定で利用する予定。
//
// orderフィールドについて：路線（routeName）内の並び順を表す1始まりの連番。
// 情報源：首都高速道路公式サイト(shutoko.jp)の路線別ページ(route-{code}/)に掲載された出入口の並び順をそのまま採用（環状線を含め、方向の統一は行っていない）。
// 湾岸市川（shuto-b-wangan-ichikawa）は公式ページ上での掲載位置が未確定のため、今回はorderを付与していない。
const SHUTO_IC_MASTER = [
    {
        id: "shuto-6-kiyosubashi",
        displayName: "清洲橋",
        googleName: "首都高速6号向島線 清洲橋出口",
        aliases: ["清洲橋", "清洲橋出口"],
        roadType: "首都高",
        routeCode: "6",
        routeName: "首都高速6号向島線",
        order: 3,
        lat: 35.683675,
        lng: 139.789954,
        entranceLat: 35.683675,
        entranceLng: 139.789954,
        exitLat: 35.683675,
        exitLng: 139.789954,
        entranceSelectable: false,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速6号向島線 清洲橋出口"],
        note: "公式上は出口専用。入口出口別フィルタ対応済みのため、出口候補として有効化。第1弾追加。Google表記と座標確認済み。"
    },
    {
        id: "shuto-6-tsutsumidori",
        displayName: "堤通",
        googleName: "首都高速6号向島線 堤通出入口",
        aliases: ["堤通", "堤通入口", "堤通出口"],
        roadType: "首都高",
        routeCode: "6",
        routeName: "首都高速6号向島線",
        order: 6,
        lat: 35.7357056,
        lng: 139.8150419,
        entranceLat: 35.7357056,
        entranceLng: 139.8150419,
        exitLat: 35.7357056,
        exitLng: 139.8150419,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["joban", "chuo", "tomei", "aqualine", "keiyo", "tokan"],
        sourceGoogleNames: ["首都高速6号向島線 堤通出入口"],
        note: "【2026-07-18調査・座標修正】従来は「既存IC_MASTERから正規化登録。現時点では未参照。」という暫定登録で、座標も(35.731,139.817)という未検証の丸め値だった。MapFan「堤通ランプ（６号向島線）【入口（下り）】」で実測座標(35.7357056,139.8150419)を確認し修正。従来座標からの誤差は約551m。参考情報として、NAVITIME等の別情報源では(35.739613,139.815804)という値も見られ、MapFan実測値とは約460mの差異がある（上り/下りいずれの代表点を採用しているかの違いによる可能性があり、断定はできない）。entranceSelectable/exitSelectableは変更なし（trueのまま）。"
    },
    {
        id: "shuto-6-hakozaki",
        displayName: "箱崎",
        googleName: "首都高速6号向島線 箱崎出入口",
        aliases: ["箱崎", "箱崎入口", "箱崎出口"],
        roadType: "首都高",
        routeCode: "6",
        routeName: "首都高速6号向島線",
        order: 1,
        lat: 35.680093,
        lng: 139.783044,
        entranceLat: 35.680108,
        entranceLng: 139.783033,
        exitLat: 35.680078,
        exitLng: 139.783056,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速6号向島線 箱崎出入口"],
        note: "上り・下りとも入口・出口。新規追加。首都高公式サイト(shutoko.jp route-6mu/hakozaki)で方向を確認。座標はMapFanの「箱崎ランプ（６号向島線）【入口】/【出口】」個別ページで確認、入口・出口とも1箇所に集約されたランプのため座標差はごく僅か。"
    },
    {
        id: "shuto-6-hamacho",
        displayName: "浜町",
        googleName: "首都高速6号向島線 浜町出入口",
        aliases: ["浜町", "浜町入口", "浜町出口"],
        roadType: "首都高",
        routeCode: "6",
        routeName: "首都高速6号向島線",
        order: 2,
        lat: 35.683955,
        lng: 139.788059,
        entranceLat: 35.682860,
        entranceLng: 139.789136,
        exitLat: 35.685050,
        exitLng: 139.786982,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速6号向島線 浜町出入口"],
        note: "上り・下りとも入口・出口。入口はETC専用。新規追加。首都高公式サイト(shutoko.jp route-6mu/hamacho)で方向を確認。座標はMapFanの「浜町ランプ（６号向島線）【入口】/【出口】」個別ページで確認、入口・出口座標間約0.31kmの中間点（入口ランプと出口ランプが離れた場所にあるため）。"
    },
    {
        id: "shuto-6-komagata",
        displayName: "駒形",
        googleName: "首都高速6号向島線 駒形出入口",
        aliases: ["駒形", "駒形入口", "駒形出口"],
        roadType: "首都高",
        routeCode: "6",
        routeName: "首都高速6号向島線",
        order: 4,
        lat: 35.707007,
        lng: 139.797853,
        entranceLat: 35.706463,
        entranceLng: 139.797632,
        exitLat: 35.707552,
        exitLng: 139.798075,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速6号向島線 駒形出入口"],
        note: "上り入口・下り出口。首都高公式サイト(shutoko.jp route-6mu/komagata)の出入口ページの表で「入口:上り／出口:下り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。入口はETC専用。新規追加。座標はMapFanの「駒形ランプ（６号向島線）【入口（上り）】/【出口（下り）】」個別ページでランプごとに確認、入口・出口座標間約0.13kmの中間点。"
    },
    {
        id: "shuto-6-mukoujima",
        displayName: "向島",
        googleName: "首都高速6号向島線 向島出入口",
        aliases: ["向島", "向島入口", "向島出口"],
        roadType: "首都高",
        routeCode: "6",
        routeName: "首都高速6号向島線",
        order: 5,
        lat: 35.722366,
        lng: 139.811988,
        entranceLat: 35.721307,
        entranceLng: 139.811367,
        exitLat: 35.723425,
        exitLng: 139.812610,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速6号向島線 向島出入口"],
        note: "上り・下りとも入口・出口（南北に入口・出口計4ランプが分散）。入口はETC専用。新規追加。首都高公式サイト(shutoko.jp route-6mu/mukoujima)で方向を確認。座標はMapFanの「向島ランプ（６号向島線）【入口（上り）】/【出口（上り）】」個別ページで上り側ランプを代表点として確認、入口・出口座標間約0.26kmの中間点。下り側ランプの座標は未採用。"
    },
    {
        id: "shuto-jct-horikiri",
        displayName: "堀切JCT",
        googleName: "首都高速 堀切ジャンクション",
        aliases: ["堀切JCT", "堀切ジャンクション"],
        roadType: "首都高",
        routeCode: "6",
        routeName: "首都高速6号向島線",
        lat: 35.744167,
        lng: 139.823611,
        entranceLat: 35.744167,
        entranceLng: 139.823611,
        exitLat: 35.744167,
        exitLng: 139.823611,
        isSelectable: false,
        entranceSelectable: false,
        exitSelectable: false,
        connection: true,
        connectedRoads: ["首都高速6号向島線", "首都高速中央環状線"],
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速 堀切ジャンクション"],
        note: "【2026-07-18新規追加】order連続性チェックのrouteIdentity統一化に伴い、首都高速6号向島線と中央環状線(C2)を接続するJCTとして新規登録。座標はWikipedia「堀切ジャンクション」記載の北緯35度44分39秒 東経139度49分25秒を10進法に変換（35.744167, 139.823611）。isSelectable/entranceSelectable/exitSelectableはfalse（IC_MASTER側の鶴ヶ島JCT等の既存JCT登録パターンを踏襲）。connectedRoadsはrouteCode（\"6\"は6号向島線・6号三郷線で共用のため識別に使えないことが前回調査で判明）ではなく、routeNameの値で指定。"
    },
    {
        id: "shuto-6-kahira",
        displayName: "加平",
        googleName: "首都高速中央環状線 加平出入口",
        aliases: ["加平", "加平入口", "加平出口"],
        roadType: "首都高",
        routeCode: "6",
        routeName: "首都高速6号三郷線",
        order: 1,
        lat: 35.7776257,
        lng: 139.8258096,
        entranceLat: 35.7776257,
        entranceLng: 139.8258096,
        exitLat: 35.7776257,
        exitLng: 139.8258096,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["joban"],
        sourceGoogleNames: ["首都高速中央環状線 加平出入口"],
        note: "公式路線区分に合わせて6号三郷線へ修正。googleNameは既存互換のため旧表記を暫定維持。【2026-07-18調査・座標修正】従来は(35.777,139.820)という未検証の丸め値だった。MapFan「加平ランプ（６号三郷線）【入口】」で実測座標(35.7776257,139.8258096)を確認し修正。従来座標からの誤差は約528m。entranceSelectable/exitSelectableは変更なし（trueのまま）。"
    },
    {
        id: "shuto-6-yashio-minami",
        displayName: "八潮南",
        googleName: "首都高速6号三郷線 八潮南出入口",
        aliases: ["八潮南", "八潮南入口", "八潮南出口"],
        roadType: "首都高",
        routeCode: "6",
        routeName: "首都高速6号三郷線",
        order: 2,
        lat: 35.805792,
        lng: 139.83513,
        entranceLat: 35.805792,
        entranceLng: 139.83513,
        exitLat: 35.799209,
        exitLng: 139.827506,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["joban"],
        sourceGoogleNames: ["首都高速6号三郷線 八潮南出入口"],
        note: "【2026-07-18調査・座標修正】従来は(35.805,139.842)という未検証の暫定座標で、TOLL TAG方式の最近傍検索（500mしきい値）で「IC不明」判定を招いていた。従来座標との誤差は約1.0km（入口・出口中間点基準）。NAVITIME「首都6号三郷線 八潮南出入口 上り/下り」の実測値を使用（上り入口:35.805792,139.83513／下り出口:35.799209,139.827506）。フルインターチェンジ（上下線とも入口・出口設置）であることをWikipedia「八潮南出入口」で確認済み。参考情報として、2026年5月5日より上下線とも入口料金所がETC専用になっている。entranceSelectable/exitSelectableは変更なし（trueのまま）。"
    },
    {
        id: "shuto-6-yashio",
        displayName: "八潮",
        googleName: "首都高速6号三郷線 八潮出入口",
        aliases: ["八潮", "八潮入口", "八潮出口"],
        roadType: "首都高",
        routeCode: "6",
        routeName: "首都高速6号三郷線",
        order: 3,
        lat: 35.813690,
        lng: 139.845540,
        entranceLat: 35.813690,
        entranceLng: 139.845540,
        exitLat: 35.813690,
        exitLng: 139.845540,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速6号三郷線 八潮出入口"],
        note: "上り入口・下り出口。第1弾追加。Google表記と座標確認済み。"
    },
    {
        id: "shuto-6-misato",
        displayName: "三郷",
        googleName: "首都高速6号三郷線 三郷出入口",
        aliases: ["三郷", "三郷入口", "三郷出口"],
        roadType: "首都高",
        routeCode: "6",
        routeName: "首都高速6号三郷線",
        order: 4,
        lat: 35.834508,
        lng: 139.857499,
        entranceLat: 35.833777,
        entranceLng: 139.857254,
        exitLat: 35.835239,
        exitLng: 139.857745,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速6号三郷線 三郷出入口"],
        note: "上り入口・下り出口。首都高公式サイト(shutoko.jp route-6mi/misato)の出入口ページの表で「入口:上り／出口:下り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。新規追加。座標はMapFanの「三郷ランプ（６号三郷線）【入口（上り）】/【出口（下り）】」個別ページでランプごとに確認、入口・出口座標間約0.17kmの中間点。"
    },
    {
        id: "shuto-jct-kosuge",
        displayName: "小菅JCT",
        googleName: "首都高速 小菅ジャンクション",
        aliases: ["小菅JCT", "小菅ジャンクション"],
        roadType: "首都高",
        routeCode: "C2",
        routeName: "首都高速中央環状線",
        lat: 35.754167,
        lng: 139.820833,
        entranceLat: 35.754167,
        entranceLng: 139.820833,
        exitLat: 35.754167,
        exitLng: 139.820833,
        isSelectable: false,
        entranceSelectable: false,
        exitSelectable: false,
        connection: true,
        connectedRoads: ["首都高速中央環状線", "首都高速6号三郷線"],
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速 小菅ジャンクション"],
        note: "【2026-07-18新規追加】order連続性チェックのrouteIdentity統一化に伴い、中央環状線(C2)と首都高速6号三郷線を接続するJCTとして新規登録。座標はWikipedia「小菅ジャンクション」記載の北緯35度45分15秒 東経139度49分15秒を10進法に変換（35.754167, 139.820833）。isSelectable/entranceSelectable/exitSelectableはfalse。小菅出入口（既存エントリ、id: shuto-c2-kosuge、出入口ランプ）とは別地点・別エントリ。"
    },
    {
        id: "shuto-7-kinshicho",
        displayName: "錦糸町",
        googleName: "首都高速7号小松川線 錦糸町出入口",
        aliases: ["錦糸町", "錦糸町入口", "錦糸町出口"],
        roadType: "首都高",
        routeCode: "7",
        routeName: "首都高速7号小松川線",
        order: 1,
        lat: 35.693165,
        lng: 139.815037,
        entranceLat: 35.693165,
        entranceLng: 139.815037,
        exitLat: 35.693165,
        exitLng: 139.815037,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速7号小松川線 錦糸町出入口"],
        note: "上下線とも入口・出口。第2弾追加。Google表記と座標確認済み。"
    },
    {
        id: "shuto-7-komatsugawa",
        displayName: "小松川",
        googleName: "首都高速7号小松川線 小松川出入口",
        aliases: ["小松川", "小松川入口", "小松川出口"],
        roadType: "首都高",
        routeCode: "7",
        routeName: "首都高速7号小松川線",
        order: 2,
        lat: 35.699240,
        lng: 139.865884,
        entranceLat: 35.699240,
        entranceLng: 139.865884,
        exitLat: 35.699240,
        exitLng: 139.865884,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速7号小松川線 小松川出入口"],
        note: "上り入口・下り出口。首都高公式サイト(shutoko.jp route-7/komatsugawa)の出入口ページの表で「入口:上り／出口:下り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。小松川JCTではなく出入口ランプ座標。第2弾追加。Google表記と座標確認済み。"
    },
    {
        id: "shuto-7-ichinoe",
        displayName: "一之江",
        googleName: "首都高速7号小松川線 一之江出入口",
        aliases: ["一之江", "一之江入口", "一之江出口"],
        roadType: "首都高",
        routeCode: "7",
        routeName: "首都高速7号小松川線",
        order: 3,
        lat: 35.697449,
        lng: 139.880863,
        entranceLat: 35.697449,
        entranceLng: 139.880863,
        exitLat: 35.697449,
        exitLng: 139.880863,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速7号小松川線 一之江出入口"],
        note: "上り入口・下り出口。首都高公式サイト(shutoko.jp route-7/ichinoe)の出入口ページの表で「入口:上り／出口:下り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。第2弾追加。Google表記と座標確認済み。"
    },
    {
        id: "shuto-9-fukuzumi",
        displayName: "福住",
        googleName: "首都高速9号深川線 福住出入口",
        aliases: ["福住", "福住入口", "福住出口"],
        roadType: "首都高",
        routeCode: "9",
        routeName: "首都高速9号深川線",
        order: 1,
        lat: 35.677151,
        lng: 139.793440,
        entranceLat: 35.677151,
        entranceLng: 139.793440,
        exitLat: 35.677151,
        exitLng: 139.793440,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速9号深川線 福住出入口"],
        note: "下り入口・上り出口。入口はETC専用。第3弾追加。公式の出入口方向とGoogle Map座標を照合済み。"
    },
    {
        id: "shuto-9-kiba",
        displayName: "木場",
        googleName: "首都高速9号深川線 木場出入口",
        aliases: ["木場", "木場入口", "木場出口"],
        roadType: "首都高",
        routeCode: "9",
        routeName: "首都高速9号深川線",
        order: 2,
        lat: 35.672048,
        lng: 139.806159,
        entranceLat: 35.672048,
        entranceLng: 139.806159,
        exitLat: 35.672048,
        exitLng: 139.806159,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速9号深川線 木場出入口"],
        note: "上り入口・下り出口。入口はETC専用。第3弾追加。公式の出入口方向とGoogle Map座標を照合済み。"
    },
    {
        id: "shuto-9-shiohama",
        displayName: "塩浜",
        googleName: "首都高速9号深川線 塩浜入口",
        aliases: ["塩浜", "塩浜入口"],
        roadType: "首都高",
        routeCode: "9",
        routeName: "首都高速9号深川線",
        order: 3,
        lat: 35.666984,
        lng: 139.805285,
        entranceLat: 35.666984,
        entranceLng: 139.805285,
        exitLat: 35.666984,
        exitLng: 139.805285,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速9号深川線 塩浜入口"],
        note: "下り入口専用。第3弾追加。公式の出入口方向とGoogle Map座標を照合済み。"
    },
    {
        id: "shuto-9-edagawa",
        displayName: "枝川",
        googleName: "首都高速9号深川線 枝川出口",
        aliases: ["枝川", "枝川出口"],
        roadType: "首都高",
        routeCode: "9",
        routeName: "首都高速9号深川線",
        order: 4,
        lat: 35.659309,
        lng: 139.804673,
        entranceLat: 35.659309,
        entranceLng: 139.804673,
        exitLat: 35.659309,
        exitLng: 139.804673,
        entranceSelectable: false,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速9号深川線 枝川出口"],
        note: "上り出口専用。第3弾追加。公式の出入口方向とGoogle Map座標を照合済み。"
    },
    {
        id: "shuto-1-ueno",
        displayName: "上野",
        googleName: "首都高速1号上野線 上野出入口",
        aliases: ["上野", "上野入口", "上野出口"],
        roadType: "首都高",
        routeCode: "1",
        routeName: "首都高速1号上野線",
        order: 2,
        lat: 35.712,
        lng: 139.779,
        entranceLat: 35.712,
        entranceLng: 139.779,
        exitLat: 35.712,
        exitLng: 139.779,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["chuo", "tomei", "aqualine", "keiyo", "tokan"],
        sourceGoogleNames: ["首都高速1号上野線 上野出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-1-honcho",
        displayName: "本町",
        googleName: "首都高速1号上野線 本町出入口",
        aliases: ["本町", "本町入口", "本町出口"],
        roadType: "首都高",
        routeCode: "1",
        routeName: "首都高速1号上野線",
        order: 1,
        lat: 35.690176,
        lng: 139.775450,
        entranceLat: 35.692125,
        entranceLng: 139.774696,
        exitLat: 35.688227,
        exitLng: 139.776203,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速1号上野線 本町出入口"],
        note: "上り・下りとも入口・出口。入口はETC専用。新規追加。首都高公式サイト(shutoko.jp route-1u/honcho)で方向を確認。座標はMapFanの「本町ランプ（１号上野線）【入口（下り）】/【出口（下り）】」個別ページで下り側ランプを代表点として確認、入口・出口座標間約0.45kmの中間点（既存データ中で最大の芝公園0.75kmの範囲内）。上り側ランプの座標は未採用。"
    },
    {
        id: "shuto-1-iriya",
        displayName: "入谷",
        googleName: "首都高速1号上野線 入谷出入口",
        aliases: ["入谷", "入谷入口", "入谷出口"],
        roadType: "首都高",
        routeCode: "1",
        routeName: "首都高速1号上野線",
        order: 3,
        lat: 35.719737,
        lng: 139.783764,
        entranceLat: 35.719711,
        entranceLng: 139.783839,
        exitLat: 35.719763,
        exitLng: 139.783689,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速1号上野線 入谷出入口"],
        note: "上り入口・下り出口。首都高公式サイト(shutoko.jp route-1u/iriya)の出入口ページの表で「入口:上り／出口:下り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。入口はETC専用。新規追加。座標はMapFanの「入谷ランプ（１号上野線）【入口（上り）】/【出口（下り）】」個別ページでランプごとに確認、入口・出口座標間約0.01kmの中間点。"
    },
    {
        id: "shuto-jct-edobashi",
        displayName: "江戸橋JCT",
        googleName: "首都高速 江戸橋ジャンクション",
        aliases: ["江戸橋JCT", "江戸橋ジャンクション"],
        roadType: "首都高",
        routeCode: "C1",
        routeName: "首都高速都心環状線",
        lat: 35.684167,
        lng: 139.778611,
        entranceLat: 35.684167,
        entranceLng: 139.778611,
        exitLat: 35.684167,
        exitLng: 139.778611,
        isSelectable: false,
        entranceSelectable: false,
        exitSelectable: false,
        connection: true,
        connectedRoads: ["首都高速都心環状線", "首都高速1号上野線", "首都高速6号向島線"],
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速 江戸橋ジャンクション"],
        note: "【2026-07-18新規追加】order連続性チェックのrouteIdentity統一化に伴い、都心環状線(C1)・首都高速1号上野線（起点）・首都高速6号向島線（起点）の3路線を接続するJCTとして新規登録（1963年供用開始、首都高初のJCT）。座標はWikipedia「江戸橋ジャンクション」記載の北緯35度41分03秒 東経139度46分43秒を10進法に変換（35.684167, 139.778611）。isSelectable/entranceSelectable/exitSelectableはfalse。"
    },
    {
        id: "shuto-4-takaido",
        displayName: "高井戸",
        googleName: "首都高速4号新宿線 高井戸出入口",
        aliases: ["高井戸", "高井戸入口", "高井戸出口"],
        roadType: "首都高",
        routeCode: "4",
        routeName: "首都高速4号新宿線",
        order: 7,
        lat: 35.684,
        lng: 139.615,
        entranceLat: 35.684,
        entranceLng: 139.615,
        exitLat: 35.684,
        exitLng: 139.615,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["chuo"],
        sourceGoogleNames: ["首都高速4号新宿線 高井戸出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-4-gaien",
        displayName: "外苑",
        googleName: "首都高速4号新宿線 外苑出入口",
        aliases: ["外苑", "外苑入口", "外苑出口"],
        roadType: "首都高",
        routeCode: "4",
        routeName: "首都高速4号新宿線",
        order: 1,
        lat: 35.677,
        lng: 139.718,
        entranceLat: 35.677,
        entranceLng: 139.718,
        exitLat: 35.677,
        exitLng: 139.718,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["chuo", "tomei"],
        sourceGoogleNames: ["首都高速4号新宿線 外苑出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-4-yoyogi",
        displayName: "代々木",
        googleName: "首都高速4号新宿線 代々木出入口",
        aliases: ["代々木", "代々木入口", "代々木出口"],
        roadType: "首都高",
        routeCode: "4",
        routeName: "首都高速4号新宿線",
        order: 2,
        lat: 35.676267,
        lng: 139.692899,
        entranceLat: 35.675688,
        entranceLng: 139.692421,
        exitLat: 35.676846,
        exitLng: 139.693339,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速4号新宿線 代々木出入口"],
        note: "上り入口・下り出口。入口はETC専用。新規追加。首都高公式サイト(shutoko.jp route-4/yoyogi)で方向を確認。座標はMapFanの「代々木ランプ（４号新宿線）【入口（上り）】/【出口（下り）】」個別ページでランプごとに確認、入口・出口座標間約0.16kmの中間点。"
    },
    {
        id: "shuto-4-shinjuku",
        displayName: "新宿",
        googleName: "首都高速4号新宿線 新宿出入口",
        aliases: ["新宿", "新宿入口", "新宿出口"],
        roadType: "首都高",
        routeCode: "4",
        routeName: "首都高速4号新宿線",
        order: 3,
        lat: 35.687433,
        lng: 139.691414,
        entranceLat: 35.687446,
        entranceLng: 139.691505,
        exitLat: 35.687420,
        exitLng: 139.691323,
        entranceSelectable: false,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速4号新宿線 新宿出入口"],
        note: "上りのみ入口・上り下りとも出口（入口は中央道方面へは行けない）。本アプリは候補選定時に走行方向（上り/下り）を区別する仕組みを持たないため、方向限定の入口は安全側でentranceSelectable:falseとした（誤って中央道方面希望のルートに本ICを入口候補として出さないため）。出口は方向を問わず利用可能なためexitSelectable:trueを維持。入口はETC専用。新規追加。首都高公式サイト(shutoko.jp route-4/shinjuku)で方向を確認。座標はMapFanの「新宿ランプ（４号新宿線）【入口（上り）】/【出口】」個別ページで確認（入口・出口とも1箇所に集約されたランプ）、座標差はごく僅か。"
    },
    {
        id: "shuto-4-hatsudai",
        displayName: "初台",
        googleName: "首都高速4号新宿線 初台出入口",
        aliases: ["初台", "初台入口", "初台出口"],
        roadType: "首都高",
        routeCode: "4",
        routeName: "首都高速4号新宿線",
        order: 4,
        lat: 35.680117,
        lng: 139.684505,
        entranceLat: 35.680033,
        entranceLng: 139.684582,
        exitLat: 35.680202,
        exitLng: 139.684429,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速4号新宿線 初台出入口"],
        note: "下り入口・上り出口。首都高公式サイト(shutoko.jp route-4/hatsudai)の出入口ページの表で「入口:下り／出口:上り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（下り）を代表方向として採用し、上り出口はexitSelectable:falseとした。入口はETC専用。新規追加。座標はMapFanの「初台ランプ（４号新宿線）【入口（下り）】/【出口（上り）】」個別ページでランプごとに確認、入口・出口座標間約0.02kmの中間点。"
    },
    {
        id: "shuto-4-hatagaya",
        displayName: "幡ヶ谷",
        googleName: "首都高速4号新宿線 幡ヶ谷出入口",
        aliases: ["幡ヶ谷", "幡ヶ谷入口", "幡ヶ谷出口"],
        roadType: "首都高",
        routeCode: "4",
        routeName: "首都高速4号新宿線",
        order: 5,
        lat: 35.676743,
        lng: 139.675173,
        entranceLat: 35.676823,
        entranceLng: 139.675072,
        exitLat: 35.676663,
        exitLng: 139.675273,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速4号新宿線 幡ヶ谷出入口"],
        note: "上り入口・下り出口。首都高公式サイト(shutoko.jp route-4/hatagaya)の出入口ページの表で「入口:上り／出口:下り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。入口はETC専用。新規追加。座標はMapFanの「幡ヶ谷ランプ（４号新宿線）【入口（上り）】/【出口（下り）】」個別ページでランプごとに確認、入口・出口座標間約0.02kmの中間点。"
    },
    {
        id: "shuto-4-eifuku",
        displayName: "永福",
        googleName: "首都高速4号新宿線 永福出入口",
        aliases: ["永福", "永福入口", "永福出口"],
        roadType: "首都高",
        routeCode: "4",
        routeName: "首都高速4号新宿線",
        order: 6,
        lat: 35.668813,
        lng: 139.647736,
        entranceLat: 35.669457,
        entranceLng: 139.649112,
        exitLat: 35.668169,
        exitLng: 139.646360,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速4号新宿線 永福出入口"],
        note: "上り・下りとも入口・出口（上りはETC専用）。新規追加。首都高公式サイト(shutoko.jp route-4/eifuku)で方向を確認。座標はMapFanの「永福ランプ（４号新宿線）【入口（下り）】/【出口（下り）】」個別ページで下り側ランプを代表点として確認、入口・出口座標間約0.29kmの中間点。上り側ランプの座標は未採用。"
    },
    {
        id: "shuto-jct-miyakezaka",
        displayName: "三宅坂JCT",
        googleName: "首都高速 三宅坂ジャンクション",
        aliases: ["三宅坂JCT", "三宅坂ジャンクション"],
        roadType: "首都高",
        routeCode: "C1",
        routeName: "首都高速都心環状線",
        lat: 35.680556,
        lng: 139.743333,
        entranceLat: 35.680556,
        entranceLng: 139.743333,
        exitLat: 35.680556,
        exitLng: 139.743333,
        isSelectable: false,
        entranceSelectable: false,
        exitSelectable: false,
        connection: true,
        connectedRoads: ["首都高速都心環状線", "首都高速4号新宿線"],
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速 三宅坂ジャンクション"],
        note: "【2026-07-18新規追加】order連続性チェックのrouteIdentity統一化に伴い、都心環状線(C1)と首都高速4号新宿線（起点）を接続するJCTとして新規登録。座標はWikipedia「三宅坂ジャンクション」記載の北緯35度40分50秒 東経139度44分36秒を10進法に変換（35.680556, 139.743333）。首都高速3号渋谷線は、法定路線名上は三宅坂JCTが起点とされるが、実運用上の呼称では谷町JCTが3号渋谷線の起点（三宅坂〜谷町間はC1として扱われる）であるため、本アプリのconnectedRoadsには3号渋谷線を含めていない（Wikipedia「首都高速3号渋谷線」で確認）。isSelectable/entranceSelectable/exitSelectableはfalse（IC_MASTER側の鶴ヶ島JCT等の既存JCT登録パターンを踏襲）。"
    },
    {
        id: "shuto-c1-daikancho",
        displayName: "代官町",
        googleName: "首都高速都心環状線 代官町出入口",
        aliases: ["代官町", "代官町入口", "代官町出口"],
        roadType: "首都高",
        routeCode: "C1",
        routeName: "首都高速都心環状線",
        order: 9,
        lat: 35.688,
        lng: 139.754,
        entranceLat: 35.688,
        entranceLng: 139.754,
        exitLat: 35.688,
        exitLng: 139.754,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["chuo", "tomei"],
        sourceGoogleNames: ["首都高速都心環状線 代官町出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-c1-kitanomaru",
        displayName: "北の丸",
        googleName: "首都高速都心環状線 北の丸出口",
        aliases: ["北の丸", "北の丸出口"],
        roadType: "首都高",
        routeCode: "C1",
        routeName: "首都高速都心環状線",
        order: 10,
        lat: 35.689714,
        lng: 139.753772,
        entranceLat: 35.689714,
        entranceLng: 139.753772,
        exitLat: 35.689714,
        exitLng: 139.753772,
        entranceSelectable: false,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速都心環状線 北の丸出口"],
        note: "公式上は出口専用（内回りのみ）、入口設定なし。新規追加。首都高公式サイト(shutoko.jp route-c1/kitanomaru)で確認。座標はMapFanの「北の丸ランプ（都心環状線）【出口（内回り）】」個別ページで確認。"
    },
    {
        id: "shuto-c1-kandabashi",
        displayName: "神田橋",
        googleName: "首都高速都心環状線 神田橋出入口",
        aliases: ["神田橋", "神田橋入口", "神田橋出口"],
        roadType: "首都高",
        routeCode: "C1",
        routeName: "首都高速都心環状線",
        order: 11,
        lat: 35.689718,
        lng: 139.763932,
        entranceLat: 35.689112,
        entranceLng: 139.764136,
        exitLat: 35.690323,
        exitLng: 139.763729,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速都心環状線 神田橋出入口"],
        note: "内回り・外回りとも入口・出口。入口はETC専用。新規追加。首都高公式サイト(shutoko.jp route-c1/kandabashi)で方向を確認。座標はMapFanの「神田橋ランプ（都心環状線）【入口（内回り）】/【出口（外回り）】」個別ページでランプごとに確認、入口・出口座標間約0.14kmの中間点。"
    },
    {
        id: "shuto-5-hitotsubashi",
        displayName: "一ツ橋",
        googleName: "首都高速都心環状線 一ツ橋出入口",
        aliases: ["一ツ橋", "一ツ橋入口", "一ツ橋出口"],
        roadType: "首都高",
        routeCode: "5",
        routeName: "首都高速5号池袋線",
        order: 1,
        lat: 35.692,
        lng: 139.758,
        entranceLat: 35.692,
        entranceLng: 139.758,
        exitLat: 35.692,
        exitLng: 139.758,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["chuo", "tomei"],
        sourceGoogleNames: ["首都高速都心環状線 一ツ橋出入口"],
        note: "公式路線区分に合わせて5号池袋線へ修正。googleNameは既存互換のため旧表記を暫定維持。"
    },
    {
        id: "shuto-5-nishikanda",
        displayName: "西神田",
        googleName: "首都高速5号池袋線 西神田出入口",
        aliases: ["西神田", "西神田入口", "西神田出口"],
        roadType: "首都高",
        routeCode: "5",
        routeName: "首都高速5号池袋線",
        order: 2,
        lat: 35.697900,
        lng: 139.752439,
        entranceLat: 35.697872,
        entranceLng: 139.752628,
        exitLat: 35.697927,
        exitLng: 139.752251,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速5号池袋線 西神田出入口"],
        note: "上り入口・下り出口。首都高公式サイト(shutoko.jp route-5/nishikanda)の出入口ページの表で「入口:上り／出口:下り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。入口はETC専用。新規追加。座標はMapFanの「西神田ランプ（５号池袋線）【入口（上り）】/【出口（下り）】」個別ページでランプごとに確認、入口・出口座標間約0.04kmの中間点。"
    },
    {
        id: "shuto-5-iidabashi",
        displayName: "飯田橋",
        googleName: "首都高速5号池袋線 飯田橋出入口",
        aliases: ["飯田橋", "飯田橋入口", "飯田橋出口"],
        roadType: "首都高",
        routeCode: "5",
        routeName: "首都高速5号池袋線",
        order: 3,
        lat: 35.703774,
        lng: 139.744831,
        entranceLat: 35.703774,
        entranceLng: 139.744831,
        exitLat: 35.703774,
        exitLng: 139.744831,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速5号池袋線 飯田橋出入口"],
        note: "下り入口・上り出口。首都高公式サイト(shutoko.jp route-5/iidabashi)の出入口ページの表で「入口:下り／出口:上り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（下り）を代表方向として採用し、上り出口はexitSelectable:falseとした。入口はETC専用。新規追加。座標は出口（上り）ランプのみMapFan個別ページ「飯田橋ランプ（５号池袋線）【出口（上り）】」で確認済み（千代田区・文京区のMapFan一覧を確認したが入口（下り）の個別ページは見つからず）。入口（下り）ランプ座標は未確認のため、lat/lngと同じ値を暫定使用。"
    },
    {
        id: "shuto-5-waseda",
        displayName: "早稲田",
        googleName: "首都高速5号池袋線 早稲田出口",
        aliases: ["早稲田", "早稲田出口"],
        roadType: "首都高",
        routeCode: "5",
        routeName: "首都高速5号池袋線",
        order: 4,
        lat: 35.709729,
        lng: 139.727095,
        entranceLat: 35.709729,
        entranceLng: 139.727095,
        exitLat: 35.709729,
        exitLng: 139.727095,
        entranceSelectable: false,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速5号池袋線 早稲田出口"],
        note: "公式上は出口専用（下りのみ）、入口設定なし。新規追加。首都高公式サイト(shutoko.jp route-5/waseda)で確認。座標はMapFanの「早稲田ランプ（５号池袋線）【出口（下り）】」個別ページで確認。"
    },
    {
        id: "shuto-5-gokokuji",
        displayName: "護国寺",
        googleName: "首都高速5号池袋線 護国寺出入口",
        aliases: ["護国寺", "護国寺入口", "護国寺出口"],
        roadType: "首都高",
        routeCode: "5",
        routeName: "首都高速5号池袋線",
        order: 5,
        lat: 35.719275,
        lng: 139.725789,
        entranceLat: 35.719381,
        entranceLng: 139.725858,
        exitLat: 35.719170,
        exitLng: 139.725720,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速5号池袋線 護国寺出入口"],
        note: "上り入口・下り出口。首都高公式サイト(shutoko.jp route-5/gokokuji)の出入口ページの表で「入口:上り／出口:下り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。入口はETC専用。新規追加。座標はMapFanの「護国寺ランプ（５号池袋線）【入口（上り）】/【出口（下り）】」個別ページでランプごとに確認、入口・出口座標間約0.02kmの中間点。"
    },
    {
        id: "shuto-5-higashiikebukuro",
        displayName: "東池袋",
        googleName: "首都高速5号池袋線 東池袋出入口",
        aliases: ["東池袋", "東池袋入口", "東池袋出口"],
        roadType: "首都高",
        routeCode: "5",
        routeName: "首都高速5号池袋線",
        order: 6,
        lat: 35.729223,
        lng: 139.720871,
        entranceLat: 35.729208,
        entranceLng: 139.720896,
        exitLat: 35.729237,
        exitLng: 139.720845,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速5号池袋線 東池袋出入口"],
        note: "上り・下りとも入口・出口。ETC専用。新規追加。首都高公式サイト(shutoko.jp route-5/higashiikebukuro)で方向を確認。座標はMapFanの「東池袋ランプ（５号池袋線）【入口】/【出口】」個別ページで確認（入口・出口とも1箇所に集約されたランプ）、座標差はごく僅か。"
    },
    {
        id: "shuto-5-kitaikebukuro",
        displayName: "北池袋",
        googleName: "首都高速5号池袋線 北池袋出入口",
        aliases: ["北池袋", "北池袋入口", "北池袋出口"],
        roadType: "首都高",
        routeCode: "5",
        routeName: "首都高速5号池袋線",
        order: 7,
        lat: 35.740681,
        lng: 139.707518,
        entranceLat: 35.740822,
        entranceLng: 139.707510,
        exitLat: 35.740540,
        exitLng: 139.707525,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速5号池袋線 北池袋出入口"],
        note: "上り入口・下り出口。首都高公式サイト(shutoko.jp route-5/kitaikebukuro)の出入口ページの表で「入口:上り／出口:下り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。入口はETC専用。新規追加。座標はMapFanの「北池袋ランプ（５号池袋線）【入口（上り）】/【出口（下り）】」個別ページでランプごとに確認、入口・出口座標間約0.03kmの中間点。"
    },
    {
        id: "shuto-5-itabashihoncho",
        displayName: "板橋本町",
        googleName: "首都高速5号池袋線 板橋本町出入口",
        aliases: ["板橋本町", "板橋本町入口", "板橋本町出口"],
        roadType: "首都高",
        routeCode: "5",
        routeName: "首都高速5号池袋線",
        order: 8,
        lat: 35.761198,
        lng: 139.705753,
        entranceLat: 35.759985,
        entranceLng: 139.706226,
        exitLat: 35.762410,
        exitLng: 139.705281,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速5号池袋線 板橋本町出入口"],
        note: "上り・下りとも入口・出口（上り・下りそれぞれに入口・出口計4ランプが存在）。ETC専用。新規追加。首都高公式サイト(shutoko.jp route-5/itabashihoncho)で方向を確認。座標はMapFanの「板橋本町ランプ（５号池袋線）【入口（上り）】/【出口（上り）】」個別ページで上り側ランプを代表点として確認、入口・出口座標間約0.29kmの中間点。下り側ランプの座標は未採用。"
    },
    {
        id: "shuto-5-nakadai",
        displayName: "中台",
        googleName: "首都高速5号池袋線 中台出入口",
        aliases: ["中台", "中台入口", "中台出口"],
        roadType: "首都高",
        routeCode: "5",
        routeName: "首都高速5号池袋線",
        order: 9,
        lat: 35.776011,
        lng: 139.679008,
        entranceLat: 35.776108,
        entranceLng: 139.679082,
        exitLat: 35.775913,
        exitLng: 139.678934,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速5号池袋線 中台出入口"],
        note: "上り入口・下り出口。首都高公式サイト(shutoko.jp route-5/nakadai)の出入口ページの表で「入口:上り／出口:下り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。新規追加。座標はMapFanの「中台ランプ（５号池袋線）【入口（上り）】/【出口（下り）】」個別ページでランプごとに確認、入口・出口座標間約0.02kmの中間点。"
    },
    {
        id: "shuto-5-takashimadaira",
        displayName: "高島平",
        googleName: "首都高速5号池袋線 高島平出入口",
        aliases: ["高島平", "高島平入口", "高島平出口"],
        roadType: "首都高",
        routeCode: "5",
        routeName: "首都高速5号池袋線",
        order: 10,
        lat: 35.785835,
        lng: 139.647252,
        entranceLat: 35.785851,
        entranceLng: 139.648146,
        exitLat: 35.785819,
        exitLng: 139.646359,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速5号池袋線 高島平出入口"],
        note: "上り入口・下り出口。首都高公式サイト(shutoko.jp route-5/takashimadaira)の出入口ページの表で「入口:上り／出口:下り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。新規追加。座標はMapFanの「高島平ランプ（５号池袋線）【入口（上り）】/【出口（下り）】」個別ページでランプごとに確認、入口・出口座標間約0.16kmの中間点。"
    },
    {
        id: "shuto-5-todaminami",
        displayName: "戸田南",
        googleName: "首都高速5号池袋線 戸田南出入口",
        aliases: ["戸田南", "戸田南入口", "戸田南出口"],
        roadType: "首都高",
        routeCode: "5",
        routeName: "首都高速5号池袋線",
        order: 11,
        lat: 35.805225,
        lng: 139.649103,
        entranceLat: 35.804674,
        entranceLng: 139.649087,
        exitLat: 35.805776,
        exitLng: 139.649120,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速5号池袋線 戸田南出入口"],
        note: "上り入口・下り出口。首都高公式サイト(shutoko.jp route-5/todaminami)の出入口ページの表で「入口:上り／出口:下り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。新規追加。座標はMapFanの「戸田南ランプ（５号池袋線）【入口（上り）】/【出口（下り）】」個別ページでランプごとに確認、入口・出口座標間約0.12kmの中間点。"
    },
    {
        id: "shuto-5-toda",
        displayName: "戸田",
        googleName: "首都高速5号池袋線 戸田出入口",
        aliases: ["戸田", "戸田入口", "戸田出口"],
        roadType: "首都高",
        routeCode: "5",
        routeName: "首都高速5号池袋線",
        order: 12,
        lat: 35.819236,
        lng: 139.644808,
        entranceLat: 35.818404,
        entranceLng: 139.645275,
        exitLat: 35.820069,
        exitLng: 139.644340,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速5号池袋線 戸田出入口"],
        note: "下り入口・上り出口。首都高公式サイト(shutoko.jp route-5/toda)の出入口ページの表で「入口:下り／出口:上り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（下り）を代表方向として採用し、上り出口はexitSelectable:falseとした。新規追加。座標はMapFanの「戸田ランプ（５号池袋線）【入口（下り）】/【出口（上り）】」個別ページでランプごとに確認、入口・出口座標間約0.20kmの中間点。"
    },
    {
        id: "shuto-3-yoga",
        displayName: "用賀",
        googleName: "首都高速3号渋谷線 用賀出入口",
        aliases: ["用賀", "用賀入口", "用賀出口"],
        roadType: "首都高",
        routeCode: "3",
        routeName: "首都高速3号渋谷線",
        order: 5,
        lat: 35.626,
        lng: 139.633,
        entranceLat: 35.626,
        entranceLng: 139.633,
        exitLat: 35.626,
        exitLng: 139.633,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["tomei"],
        sourceGoogleNames: ["首都高速3号渋谷線 用賀出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-3-takagicho",
        displayName: "高樹町",
        googleName: "首都高速3号渋谷線 高樹町出入口",
        aliases: ["高樹町", "高樹町入口", "高樹町出口"],
        roadType: "首都高",
        routeCode: "3",
        routeName: "首都高速3号渋谷線",
        order: 1,
        lat: 35.659417,
        lng: 139.719771,
        entranceLat: 35.659533,
        entranceLng: 139.719737,
        exitLat: 35.659301,
        exitLng: 139.719804,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: ["tomei"],
        sourceGoogleNames: ["首都高速3号渋谷線 高樹町出入口"],
        note: "上り入口・下り出口。首都高公式サイト(shutoko.jp route-3/takagicho)の出入口ページの表で「入口:上り／出口:下り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。入口はETC専用。新規追加。座標はMapFanの「高樹町ランプ（３号渋谷線）【入口（上り）】/【出口（下り）】」個別ページでランプごとに確認、入口・出口座標間約0.03kmの中間点。"
    },
    {
        id: "shuto-3-shibuya",
        displayName: "渋谷",
        googleName: "首都高速3号渋谷線 渋谷出入口",
        aliases: ["渋谷", "渋谷入口", "渋谷出口"],
        roadType: "首都高",
        routeCode: "3",
        routeName: "首都高速3号渋谷線",
        order: 2,
        lat: 35.654877,
        lng: 139.694333,
        entranceLat: 35.654090,
        entranceLng: 139.693210,
        exitLat: 35.655663,
        exitLng: 139.695455,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["tomei"],
        sourceGoogleNames: ["首都高速3号渋谷線 渋谷出入口"],
        note: "上り入口・下り出口（実際は上り入口/下り出口と上り出口/下り入口が渋谷駅を挟んで約900m離れた2箇所に分散）。新規追加。首都高公式サイト(shutoko.jp route-3/shibuya)で方向を確認。座標はMapFanの「渋谷ランプ（３号渋谷線）【入口（上り）】/【出口（下り）】」個別ページで、渋谷駅西側に近接する組み合わせを代表点として確認、入口・出口座標間約0.27kmの中間点。東側の出口（上り）・入口（下り）の座標は未採用。"
    },
    {
        id: "shuto-3-ikejiri",
        displayName: "池尻",
        googleName: "首都高速3号渋谷線 池尻出入口",
        aliases: ["池尻", "池尻入口", "池尻出口"],
        roadType: "首都高",
        routeCode: "3",
        routeName: "首都高速3号渋谷線",
        order: 3,
        lat: 35.650124,
        lng: 139.683680,
        entranceLat: 35.651204,
        entranceLng: 139.685866,
        exitLat: 35.649044,
        exitLng: 139.681494,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: ["tomei"],
        sourceGoogleNames: ["首都高速3号渋谷線 池尻出入口"],
        note: "下り入口・上り出口。首都高公式サイト(shutoko.jp route-3/ikejiri)の出入口ページの表で「下り:入口／上り:出口」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（下り）を代表方向として採用し、上り出口はexitSelectable:falseとした。入口はETC専用。新規追加。座標はMapFanの「池尻ランプ（３号渋谷線）【入口（下り）】/【出口（上り）】」個別ページでランプごとに確認、入口・出口座標間約0.46km（既存データ中の芝公園0.75kmの範囲内）。"
    },
    {
        id: "shuto-3-sangenjaya",
        displayName: "三軒茶屋",
        googleName: "首都高速3号渋谷線 三軒茶屋出入口",
        aliases: ["三軒茶屋", "三軒茶屋入口", "三軒茶屋出口"],
        roadType: "首都高",
        routeCode: "3",
        routeName: "首都高速3号渋谷線",
        order: 4,
        lat: 35.64477,
        lng: 139.673571,
        entranceLat: 35.645484,
        entranceLng: 139.674549,
        exitLat: 35.644056,
        exitLng: 139.672592,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: ["tomei"],
        sourceGoogleNames: ["首都高速3号渋谷線 三軒茶屋出入口"],
        note: "上り入口・下り出口。首都高公式サイト(shutoko.jp route-3/sangendyaya)の出入口ページの表で「入口:上り／出口:下り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。入口はETC専用。新規追加。座標はMapFanの「三軒茶屋ランプ（３号渋谷線）【入口（上り）】/【出口（下り）】」個別ページでランプごとに確認、入口・出口座標間約0.24kmの中間点。"
    },
    {
        id: "shuto-c1-kasumigaseki",
        displayName: "霞が関",
        googleName: "首都高速都心環状線 霞が関出入口",
        aliases: ["霞が関", "霞が関入口", "霞が関出口"],
        roadType: "首都高",
        routeCode: "C1",
        routeName: "首都高速都心環状線",
        order: 8,
        lat: 35.671,
        lng: 139.751,
        entranceLat: 35.671,
        entranceLng: 139.751,
        exitLat: 35.671,
        exitLng: 139.751,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["tomei"],
        sourceGoogleNames: ["首都高速都心環状線 霞が関出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-c1-takaracho",
        displayName: "宝町",
        googleName: "首都高速都心環状線 宝町出入口",
        aliases: ["宝町", "宝町入口", "宝町出口"],
        roadType: "首都高",
        routeCode: "C1",
        routeName: "首都高速都心環状線",
        order: 1,
        lat: 35.678902,
        lng: 139.775407,
        entranceLat: 35.678902,
        entranceLng: 139.775407,
        exitLat: 35.678902,
        exitLng: 139.775407,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速都心環状線 宝町出入口"],
        note: "内回り入口・外回り出口。首都高公式サイト(shutoko.jp route-c1/takaracho)の出入口ページの表で「入口:内回り／出口:外回り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（内回り）を代表方向として採用し、外回り出口はexitSelectable:falseとした。入口はETC専用。入口・出口座標間約0.08kmの中間点。第7弾追加。公式の出入口方向と地図上のランプ座標を照合済み。"
    },
    {
        id: "shuto-c1-kyobashi",
        displayName: "京橋",
        googleName: "首都高速都心環状線 京橋出入口",
        aliases: ["京橋", "京橋入口", "京橋出口"],
        roadType: "首都高",
        routeCode: "C1",
        routeName: "首都高速都心環状線",
        order: 2,
        lat: 35.673166,
        lng: 139.772414,
        entranceLat: 35.673166,
        entranceLng: 139.772414,
        exitLat: 35.673166,
        exitLng: 139.772414,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速都心環状線 京橋出入口"],
        note: "外回り入口・内回り出口。首都高公式サイト(shutoko.jp route-c1/kyoubashi)の出入口ページの表で「入口:外回り／出口:内回り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（外回り）を代表方向として採用し、内回り出口はexitSelectable:falseとした。入口・出口座標間約0.14kmの中間点。第7弾追加。公式の出入口方向と地図上のランプ座標を照合済み。"
    },
    {
        id: "shuto-c1-shintomicho",
        displayName: "新富町",
        googleName: "首都高速都心環状線 新富町出口",
        aliases: ["新富町", "新富町出口"],
        roadType: "首都高",
        routeCode: "C1",
        routeName: "首都高速都心環状線",
        order: 3,
        lat: 35.670954,
        lng: 139.771539,
        entranceLat: 35.670954,
        entranceLng: 139.771539,
        exitLat: 35.670954,
        exitLng: 139.771539,
        entranceSelectable: false,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速都心環状線 新富町出口"],
        note: "内回り・外回り出口専用。両出口座標間約0.15kmの中間点。第7弾追加。公式の出口方向と地図上のランプ座標を照合済み。"
    },
    {
        id: "shuto-c1-ginza",
        displayName: "銀座",
        googleName: "首都高速都心環状線 銀座出入口",
        aliases: ["銀座", "銀座入口", "銀座出口"],
        roadType: "首都高",
        routeCode: "C1",
        routeName: "首都高速都心環状線",
        order: 4,
        lat: 35.668493,
        lng: 139.769073,
        entranceLat: 35.668493,
        entranceLng: 139.769073,
        exitLat: 35.668493,
        exitLng: 139.769073,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速都心環状線 銀座出入口"],
        note: "内回り・外回りとも入口・出口。各ランプは約0.48km以内の中間点。第7弾追加。公式の出入口方向と地図上のランプ座標を照合済み。"
    },
    {
        id: "shuto-c1-shiodome",
        displayName: "汐留",
        googleName: "首都高速都心環状線 汐留出入口",
        aliases: ["汐留", "汐留入口", "汐留出口"],
        roadType: "首都高",
        routeCode: "C1",
        routeName: "首都高速都心環状線",
        order: 5,
        lat: 35.660376,
        lng: 139.760324,
        entranceLat: 35.660376,
        entranceLng: 139.760324,
        exitLat: 35.660376,
        exitLng: 139.760324,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速都心環状線 汐留出入口"],
        note: "外回り入口・内回り出口。首都高公式サイト(shutoko.jp route-c1/shiodome)の出入口ページの表で「入口:外回り／出口:内回り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（外回り）を代表方向として採用し、内回り出口はexitSelectable:falseとした。入口はETC専用。入口・出口座標間約0.02kmの中間点。第7弾追加。公式の出入口方向と地図上のランプ座標を照合済み。"
    },
    {
        id: "shuto-c1-shibakoen",
        displayName: "芝公園",
        googleName: "首都高速都心環状線 芝公園出入口",
        aliases: ["芝公園", "芝公園入口", "芝公園出口"],
        roadType: "首都高",
        routeCode: "C1",
        routeName: "首都高速都心環状線",
        order: 6,
        lat: 35.653925,
        lng: 139.746962,
        entranceLat: 35.653925,
        entranceLng: 139.746962,
        exitLat: 35.653925,
        exitLng: 139.746962,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速都心環状線 芝公園出入口"],
        note: "内回り・外回りとも入口・出口。入口はETC専用。各ランプは約0.75km以内の中間点。第7弾追加。公式の出入口方向と地図上のランプ座標を照合済み。"
    },
    {
        id: "shuto-c1-iikura",
        displayName: "飯倉",
        googleName: "首都高速都心環状線 飯倉出入口",
        aliases: ["飯倉", "飯倉入口", "飯倉出口"],
        roadType: "首都高",
        routeCode: "C1",
        routeName: "首都高速都心環状線",
        order: 7,
        lat: 35.660574,
        lng: 139.737371,
        entranceLat: 35.660574,
        entranceLng: 139.737371,
        exitLat: 35.660574,
        exitLng: 139.737371,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速都心環状線 飯倉出入口"],
        note: "内回り入口・外回り出口。首都高公式サイト(shutoko.jp route-c1/iikura)の出入口ページの表で「入口:内回り／出口:外回り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（内回り）を代表方向として採用し、外回り出口はexitSelectable:falseとした。入口はETC専用。入口・出口座標間約0.57kmの中間点。第7弾追加。公式の出入口方向と地図上のランプ座標を照合済み。"
    },
    {
        id: "shuto-2-togoshi",
        displayName: "戸越",
        googleName: "首都高速2号目黒線 戸越出入口",
        aliases: ["戸越", "戸越入口", "戸越出口"],
        roadType: "首都高",
        routeCode: "2",
        routeName: "首都高速2号目黒線",
        order: 3,
        lat: 35.615,
        lng: 139.716,
        entranceLat: 35.615,
        entranceLng: 139.716,
        exitLat: 35.615,
        exitLng: 139.716,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["tomei"],
        sourceGoogleNames: ["首都高速2号目黒線 戸越出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-2-tengenji",
        displayName: "天現寺",
        googleName: "首都高速2号目黒線 天現寺出入口",
        aliases: ["天現寺", "天現寺入口", "天現寺出口"],
        roadType: "首都高",
        routeCode: "2",
        routeName: "首都高速2号目黒線",
        order: 1,
        lat: 35.646695,
        lng: 139.725875,
        entranceLat: 35.646764,
        entranceLng: 139.725918,
        exitLat: 35.646625,
        exitLng: 139.725832,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: ["tomei"],
        sourceGoogleNames: ["首都高速2号目黒線 天現寺出入口"],
        note: "上り入口・下り出口。首都高公式サイト(shutoko.jp route-2/tengenji)の出入口ページの表で「入口:上り／出口:下り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。入口はETC専用。新規追加。座標はMapFanの「天現寺ランプ（２号目黒線）【入口（上り）】/【出口（下り）】」個別ページでランプごとに確認、入口・出口座標間約0.02kmの中間点。"
    },
    {
        id: "shuto-2-meguro",
        displayName: "目黒",
        googleName: "首都高速2号目黒線 目黒出入口",
        aliases: ["目黒", "目黒入口", "目黒出口"],
        roadType: "首都高",
        routeCode: "2",
        routeName: "首都高速2号目黒線",
        order: 2,
        lat: 35.636063,
        lng: 139.718403,
        entranceLat: 35.636063,
        entranceLng: 139.718403,
        exitLat: 35.636063,
        exitLng: 139.718403,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: ["tomei"],
        sourceGoogleNames: ["首都高速2号目黒線 目黒出入口"],
        note: "上り入口・下り出口。首都高公式サイト(shutoko.jp route-2/meguro)の出入口ページの表で「入口:上り／出口:下り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。新規追加。座標は出口（下り）ランプのみMapFan個別ページ「目黒ランプ（２号目黒線）【出口（下り）】」で確認済み。入口（上り）ランプ座標は個別ページを直接確認できず未確認のため、lat/lngと同じ値を暫定使用。"
    },
    {
        id: "shuto-2-ebara",
        displayName: "荏原",
        googleName: "首都高速2号目黒線 荏原出入口",
        aliases: ["荏原", "荏原入口", "荏原出口"],
        roadType: "首都高",
        routeCode: "2",
        routeName: "首都高速2号目黒線",
        order: 4,
        lat: 35.618761,
        lng: 139.715742,
        entranceLat: 35.618835,
        entranceLng: 139.715759,
        exitLat: 35.618687,
        exitLng: 139.715724,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: ["tomei"],
        sourceGoogleNames: ["首都高速2号目黒線 荏原出入口"],
        note: "上り入口・下り出口。首都高公式サイト(shutoko.jp route-2/ebara)の出入口ページの表で「入口:上り／出口:下り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。新規追加。座標はMapFanの「荏原ランプ（２号目黒線）【入口（上り）】/【出口（下り）】」個別ページでランプごとに確認、入口・出口座標間約0.02kmの中間点。"
    },
    {
        id: "shuto-c2-chukan-oi-minami",
        displayName: "中環大井南",
        googleName: "首都高速中央環状線 中環大井南出入口",
        aliases: ["中環大井南", "中環大井南入口", "中環大井南出口"],
        roadType: "首都高",
        routeCode: "C2",
        routeName: "首都高速中央環状線",
        order: 1,
        lat: 35.599007,
        lng: 139.754924,
        entranceLat: 35.599007,
        entranceLng: 139.754924,
        exitLat: 35.599007,
        exitLng: 139.754924,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速中央環状線 中環大井南出入口"],
        note: "外回り入口・内回り出口。首都高公式サイト(shutoko.jp route-c2/chukanooiminami)の出入口ページの表で「入口:外回り／出口:内回り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（外回り）を代表方向として採用し、内回り出口はexitSelectable:falseとした。入口はETC専用。湾岸線の大井南出入口・大井JCTではなくC2出入口ランプ座標。第6弾追加。公式の出入口方向とGoogle Map座標を照合済み。"
    },
    {
        id: "shuto-c2-gotanda",
        displayName: "五反田",
        googleName: "首都高速中央環状線 五反田出入口",
        aliases: ["五反田", "五反田入口", "五反田出口"],
        roadType: "首都高",
        routeCode: "C2",
        routeName: "首都高速中央環状線",
        order: 2,
        lat: 35.625619,
        lng: 139.717378,
        entranceLat: 35.625619,
        entranceLng: 139.717378,
        exitLat: 35.625619,
        exitLng: 139.717378,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速中央環状線 五反田出入口"],
        note: "外回り入口・内回り出口。首都高公式サイト(shutoko.jp route-c2/gotanda)の出入口ページの表で「入口:外回り／出口:内回り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（外回り）を代表方向として採用し、内回り出口はexitSelectable:falseとした。入口はETC専用。第6弾追加。公式の出入口方向とGoogle Map座標を照合済み。"
    },
    {
        id: "shuto-c2-tomigaya",
        displayName: "富ヶ谷",
        googleName: "首都高速中央環状線 富ヶ谷出入口",
        aliases: ["富ヶ谷", "富ヶ谷入口", "富ヶ谷出口"],
        roadType: "首都高",
        routeCode: "C2",
        routeName: "首都高速中央環状線",
        order: 3,
        lat: 35.662953,
        lng: 139.687707,
        entranceLat: 35.662953,
        entranceLng: 139.687707,
        exitLat: 35.662953,
        exitLng: 139.687707,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速中央環状線 富ヶ谷出入口"],
        note: "外回り入口・内回り出口。首都高公式サイト(shutoko.jp route-c2/tomigaya)の出入口ページの表で「入口:外回り／出口:内回り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（外回り）を代表方向として採用し、内回り出口はexitSelectable:falseとした。入口はETC専用。第6弾追加。公式の出入口方向とGoogle Map座標を照合済み。"
    },
    {
        id: "shuto-c2-hatsudai-minami",
        displayName: "初台南",
        googleName: "首都高速中央環状線 初台南出入口",
        aliases: ["初台南", "初台南入口", "初台南出口"],
        roadType: "首都高",
        routeCode: "C2",
        routeName: "首都高速中央環状線",
        order: 4,
        lat: 35.675152,
        lng: 139.687813,
        entranceLat: 35.675152,
        entranceLng: 139.687813,
        exitLat: 35.675152,
        exitLng: 139.687813,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速中央環状線 初台南出入口"],
        note: "内回り入口・外回り出口。首都高公式サイト(shutoko.jp route-c2/hatsudaiminami)の出入口ページの表で「入口:内回り／出口:外回り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（内回り）を代表方向として採用し、外回り出口はexitSelectable:falseとした。入口はETC専用。第6弾追加。公式の出入口方向とGoogle Map座標を照合済み。"
    },
    {
        id: "shuto-c2-nakano-chojabashi",
        displayName: "中野長者橋",
        googleName: "首都高速中央環状線 中野長者橋出入口",
        aliases: ["中野長者橋", "中野長者橋入口", "中野長者橋出口"],
        roadType: "首都高",
        routeCode: "C2",
        routeName: "首都高速中央環状線",
        order: 5,
        lat: 35.692264,
        lng: 139.681958,
        entranceLat: 35.692264,
        entranceLng: 139.681958,
        exitLat: 35.692264,
        exitLng: 139.681958,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速中央環状線 中野長者橋出入口"],
        note: "外回り入口・内回り出口。首都高公式サイト(shutoko.jp route-c2/nakanochoujabashi)の出入口ページの表で「入口:外回り／出口:内回り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（外回り）を代表方向として採用し、内回り出口はexitSelectable:falseとした。入口はETC専用。第6弾追加。公式の出入口方向とGoogle Map座標を照合済み。"
    },
    {
        id: "shuto-c2-nishi-ikebukuro",
        displayName: "西池袋",
        googleName: "首都高速中央環状線 西池袋出入口",
        aliases: ["西池袋", "西池袋入口", "西池袋出口"],
        roadType: "首都高",
        routeCode: "C2",
        routeName: "首都高速中央環状線",
        order: 6,
        lat: 35.725356,
        lng: 139.695041,
        entranceLat: 35.725356,
        entranceLng: 139.695041,
        exitLat: 35.725356,
        exitLng: 139.695041,
        entranceSelectable: false,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速中央環状線 西池袋出入口"],
        note: "内回り入口・内回りおよび外回り出口。本アプリは候補選定時に走行方向を区別できないため、方向限定の入口（内回りのみ）は安全側でentranceSelectable:falseとした（誤って外回り希望のルートに本ICを入口候補として出さないため）。出口は方向を問わず利用可能なためexitSelectable:trueを維持。入口はETC専用。各ランプは1km以内。第6弾追加。公式の出入口方向とGoogle Map座標を照合済み。"
    },
    {
        id: "shuto-c2-takamatsu",
        displayName: "高松",
        googleName: "首都高速中央環状線 高松入口",
        aliases: ["高松", "高松入口"],
        roadType: "首都高",
        routeCode: "C2",
        routeName: "首都高速中央環状線",
        order: 7,
        lat: 35.737154,
        lng: 139.702787,
        entranceLat: 35.737154,
        entranceLng: 139.702787,
        exitLat: 35.737154,
        exitLng: 139.702787,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速中央環状線 高松入口"],
        note: "外回り入口専用。ETC専用。第6弾追加。公式の出入口方向とGoogle Map座標を照合済み。"
    },
    {
        id: "shuto-c2-shin-itabashi",
        displayName: "新板橋",
        googleName: "首都高速中央環状線 新板橋出口",
        aliases: ["新板橋", "新板橋出口"],
        roadType: "首都高",
        routeCode: "C2",
        routeName: "首都高速中央環状線",
        order: 8,
        lat: 35.748819,
        lng: 139.720674,
        entranceLat: 35.748819,
        entranceLng: 139.720674,
        exitLat: 35.748819,
        exitLng: 139.720674,
        entranceSelectable: false,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速中央環状線 新板橋出口"],
        note: "外回り出口専用。板橋JCTではなく出口ランプ座標。第6弾追加。公式の出入口方向とGoogle Map座標を照合済み。"
    },
    {
        id: "shuto-c2-takinogawa",
        displayName: "滝野川",
        googleName: "首都高速中央環状線 滝野川入口",
        aliases: ["滝野川", "滝野川入口"],
        roadType: "首都高",
        routeCode: "C2",
        routeName: "首都高速中央環状線",
        order: 9,
        lat: 35.748819,
        lng: 139.720674,
        entranceLat: 35.748819,
        entranceLng: 139.720674,
        exitLat: 35.748819,
        exitLng: 139.720674,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速中央環状線 滝野川入口"],
        note: "内回り入口専用。ETC専用。新板橋出口と同一付近だが別役割として登録。第6弾追加。公式の出入口方向とGoogle Map座標を照合済み。"
    },
    {
        id: "shuto-c2-oji-minami",
        displayName: "王子南",
        googleName: "首都高速中央環状線 王子南出入口",
        aliases: ["王子南", "王子南入口", "王子南出口"],
        roadType: "首都高",
        routeCode: "C2",
        routeName: "首都高速中央環状線",
        order: 10,
        lat: 35.755105,
        lng: 139.742349,
        entranceLat: 35.755105,
        entranceLng: 139.742349,
        exitLat: 35.755105,
        exitLng: 139.742349,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速中央環状線 王子南出入口"],
        note: "内回り入口・外回り出口。首都高公式サイト(shutoko.jp route-c2/oujiminami)の出入口ページの表で「入口:内回り／出口:外回り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（内回り）を代表方向として採用し、外回り出口はexitSelectable:falseとした。入口はETC専用。第6弾追加。公式の出入口方向とGoogle Map座標を照合済み。"
    },
    {
        id: "shuto-c2-oji-kita",
        displayName: "王子北",
        googleName: "首都高速中央環状線 王子北出入口",
        aliases: ["王子北", "王子北入口", "王子北出口"],
        roadType: "首都高",
        routeCode: "C2",
        routeName: "首都高速中央環状線",
        order: 11,
        lat: 35.758570,
        lng: 139.738138,
        entranceLat: 35.758570,
        entranceLng: 139.738138,
        exitLat: 35.758570,
        exitLng: 139.738138,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速中央環状線 王子北出入口"],
        note: "外回り入口・内回り出口。入口はETC専用。第6弾追加。公式の出入口方向とGoogle Map座標を照合済み。"
    },
    {
        id: "shuto-c2-ogiohashi",
        displayName: "扇大橋",
        googleName: "首都高速中央環状線 扇大橋出入口",
        aliases: ["扇大橋", "扇大橋入口", "扇大橋出口"],
        roadType: "首都高",
        routeCode: "C2",
        routeName: "首都高速中央環状線",
        order: 12,
        lat: 35.760287,
        lng: 139.771056,
        entranceLat: 35.760287,
        entranceLng: 139.771056,
        exitLat: 35.760287,
        exitLng: 139.771056,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速中央環状線 扇大橋出入口"],
        note: "内回り・外回りとも入口・出口。入口はETC専用。入口・出口座標間約0.40kmの中間点。第5弾追加。公式の出入口方向とGoogle Map座標を照合済み。"
    },
    {
        id: "shuto-c2-senju-shinbashi",
        displayName: "千住新橋",
        googleName: "首都高速中央環状線 千住新橋出入口",
        aliases: ["千住新橋", "千住新橋入口", "千住新橋出口"],
        roadType: "首都高",
        routeCode: "C2",
        routeName: "首都高速中央環状線",
        order: 13,
        lat: 35.761558,
        lng: 139.803697,
        entranceLat: 35.761558,
        entranceLng: 139.803697,
        exitLat: 35.761558,
        exitLng: 139.803697,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速中央環状線 千住新橋出入口"],
        note: "内回り・外回りとも入口・出口。入口はETC専用。入口・出口座標間約0.43kmの中間点。第5弾追加。公式の出入口方向とGoogle Map座標を照合済み。"
    },
    {
        id: "shuto-c2-kosuge",
        displayName: "小菅",
        googleName: "首都高速中央環状線 小菅出入口",
        aliases: ["小菅", "小菅入口", "小菅出口"],
        roadType: "首都高",
        routeCode: "C2",
        routeName: "首都高速中央環状線",
        order: 14,
        lat: 35.750686,
        lng: 139.825256,
        entranceLat: 35.750686,
        entranceLng: 139.825256,
        exitLat: 35.750686,
        exitLng: 139.825256,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速中央環状線 小菅出入口"],
        note: "外回り入口・内回り出口。C2は環状路線のため、外環(gaikan)と同様に1レコードでは外回り・内回り両方向を正確に表現できない制約がある。noteが外回りを先に記載していること、および本アプリの外環(gaikan)エリアで外回りを代表方向として扱っている既存の割り切りと合わせ、外回りを代表値として採用し、内回り出口はexitSelectable:falseとした。入口（外回り）はETC専用。小菅JCTではなく出入口ランプ座標。第5弾追加。公式の出入口方向とGoogle Map座標を照合済み。"
    },
    {
        id: "shuto-c2-yotsugi",
        displayName: "四つ木",
        googleName: "首都高速中央環状線 四つ木出入口",
        aliases: ["四つ木", "四つ木入口", "四つ木出口"],
        roadType: "首都高",
        routeCode: "C2",
        routeName: "首都高速中央環状線",
        order: 15,
        lat: 35.733990,
        lng: 139.831708,
        entranceLat: 35.733990,
        entranceLng: 139.831708,
        exitLat: 35.733990,
        exitLng: 139.831708,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速中央環状線 四つ木出入口"],
        note: "内回り・外回りとも入口・出口。入口はETC専用。入口・出口座標間約0.28kmの中間点。第5弾追加。公式の出入口方向とGoogle Map座標を照合済み。"
    },
    {
        id: "shuto-c2-hirai-ohashi",
        displayName: "平井大橋",
        googleName: "首都高速中央環状線 平井大橋出入口",
        aliases: ["平井大橋", "平井大橋入口", "平井大橋出口"],
        roadType: "首都高",
        routeCode: "C2",
        routeName: "首都高速中央環状線",
        order: 16,
        lat: 35.714809,
        lng: 139.850480,
        entranceLat: 35.714809,
        entranceLng: 139.850480,
        exitLat: 35.714809,
        exitLng: 139.850480,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速中央環状線 平井大橋出入口"],
        note: "内回り入口・外回り出口。首都高公式サイト(shutoko.jp route-c2/hiraioohashi)の出入口ページの表で「入口:内回り／出口:外回り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（内回り）を代表方向として採用し、外回り出口はexitSelectable:falseとした。第5弾追加。公式の出入口方向とGoogle Map座標を照合済み。"
    },
    {
        id: "shuto-c2-chukan-komatsugawa",
        displayName: "中環小松川",
        googleName: "首都高速中央環状線 中環小松川入口",
        aliases: ["中環小松川", "中環小松川入口"],
        roadType: "首都高",
        routeCode: "C2",
        routeName: "首都高速中央環状線",
        order: 17,
        lat: 35.699083,
        lng: 139.865787,
        entranceLat: 35.699083,
        entranceLng: 139.865787,
        exitLat: 35.699083,
        exitLng: 139.865787,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速中央環状線 中環小松川入口"],
        note: "内回り入口専用。7号小松川線の小松川出入口・小松川JCTではなくC2入口ランプ座標。第5弾追加。公式の出入口方向とGoogle Map座標を照合済み。"
    },
    {
        id: "shuto-c2-funaboribashi",
        displayName: "船堀橋",
        googleName: "首都高速中央環状線 船堀橋出入口",
        aliases: ["船堀橋", "船堀橋入口", "船堀橋出口"],
        roadType: "首都高",
        routeCode: "C2",
        routeName: "首都高速中央環状線",
        order: 18,
        lat: 35.688332,
        lng: 139.857953,
        entranceLat: 35.688332,
        entranceLng: 139.857953,
        exitLat: 35.688332,
        exitLng: 139.857953,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速中央環状線 船堀橋出入口"],
        note: "外回り入口・内回り出口。首都高公式サイト(shutoko.jp route-c2/funaboribashi)の出入口ページの表で「入口:外回り／出口:内回り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（外回り）を代表方向として採用し、内回り出口はexitSelectable:falseとした。入口はETC専用。第5弾追加。公式の出入口方向とGoogle Map座標を照合済み。"
    },
    {
        id: "shuto-c2-seishincho",
        displayName: "清新町",
        googleName: "首都高速中央環状線 清新町出入口",
        aliases: ["清新町", "清新町入口", "清新町出口"],
        roadType: "首都高",
        routeCode: "C2",
        routeName: "首都高速中央環状線",
        order: 19,
        lat: 35.665223,
        lng: 139.853007,
        entranceLat: 35.665223,
        entranceLng: 139.853007,
        exitLat: 35.665223,
        exitLng: 139.853007,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速中央環状線 清新町出入口"],
        note: "内回り入口・外回り出口。首都高公式サイト(shutoko.jp route-c2/seishincho)の出入口ページの表で「入口:内回り／出口:外回り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（内回り）を代表方向として採用し、外回り出口はexitSelectable:falseとした。入口はETC専用。第5弾追加。公式の出入口方向とGoogle Map座標を照合済み。"
    },
    {
        id: "shuto-b-chidoricho",
        displayName: "千鳥町",
        googleName: "首都高速湾岸線 千鳥町出入口",
        aliases: ["千鳥町", "千鳥町入口", "千鳥町出口"],
        roadType: "首都高",
        routeCode: "B",
        routeName: "首都高速湾岸線",
        order: 1,
        lat: 35.673286,
        lng: 139.928790,
        entranceLat: 35.673286,
        entranceLng: 139.928790,
        exitLat: 35.673286,
        exitLng: 139.928790,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速湾岸線 千鳥町出入口"],
        note: "西行き入口・東行き出口。第4弾追加。公式の出入口方向とGoogle Map座標を照合済み。"
    },
    {
        id: "shuto-b-maihama",
        displayName: "舞浜",
        googleName: "首都高速湾岸線 舞浜入口",
        aliases: ["舞浜", "舞浜入口"],
        roadType: "首都高",
        routeCode: "B",
        routeName: "首都高速湾岸線",
        order: 3,
        lat: 35.635721,
        lng: 139.886245,
        entranceLat: 35.635721,
        entranceLng: 139.886245,
        exitLat: 35.635721,
        exitLng: 139.886245,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速湾岸線 舞浜入口"],
        note: "西行き入口専用。第4弾追加。公式の出入口方向とGoogle Map座標を照合済み。"
    },
    {
        id: "shuto-b-kasai",
        displayName: "葛西",
        googleName: "首都高速湾岸線 葛西出入口",
        aliases: ["葛西", "葛西IC", "葛西入口", "葛西出口"],
        roadType: "首都高",
        routeCode: "B",
        routeName: "首都高速湾岸線",
        order: 4,
        lat: 35.652,
        lng: 139.870,
        entranceLat: 35.652,
        entranceLng: 139.870,
        exitLat: 35.652,
        exitLng: 139.870,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["aqualine", "keiyo", "tokan"],
        sourceGoogleNames: ["首都高速湾岸線 葛西出入口"],
        note: "tokan内のexperimental登録とroadType未設定登録を1件に正規化。現時点では未参照。"
    },
    {
        id: "shuto-b-wangan-ichikawa",
        displayName: "湾岸市川",
        googleName: "首都高速湾岸線 湾岸市川出入口",
        aliases: ["湾岸市川", "湾岸市川IC", "湾岸市川入口", "湾岸市川出口"],
        roadType: "首都高",
        routeCode: "B",
        routeName: "首都高速湾岸線",
        lat: 35.672,
        lng: 139.938,
        entranceLat: 35.672,
        entranceLng: 139.938,
        exitLat: 35.672,
        exitLng: 139.938,
        entranceSelectable: false,
        exitSelectable: false,
        sourceAreaKeys: ["aqualine", "keiyo", "tokan"],
        sourceGoogleNames: ["首都高速湾岸線 湾岸市川出入口"],
        note: "首都高速湾岸線と東関東道の境界・接続判定用として暫定保持。首都高公式の湾岸線出入口一覧には掲載なし。通常の首都高入口・出口候補として使用するかは別フェーズで再確認。【2026-07-13追記】複数の道路マニアのブログ・地図サイトを確認した結果、「湾岸市川」という名称の単独出入口は実在しない可能性が高く、一部地図サービスの表記揺れ・誤りが混入したものとみられる。首都高湾岸線は実際には高谷JCTで東関東自動車道に接続しており、その手前に単独の「湾岸市川」出入口が存在するという情報源は確認できなかった。実在性が未確定のため、誤って候補選定・料金計算に使われることを避ける目的で、entranceSelectable/exitSelectableを暫定的にfalseに変更し候補から除外した（エントリ自体は削除せず保留。orderも引き続き未設定のまま）。実在確認が取れ次第、trueに戻すか再検討する。"
    },
    {
        id: "shuto-b-shinkiba",
        displayName: "新木場",
        googleName: "首都高速湾岸線 新木場出入口",
        aliases: ["新木場", "新木場入口", "新木場出口"],
        roadType: "首都高",
        routeCode: "B",
        routeName: "首都高速湾岸線",
        order: 5,
        lat: 35.645,
        lng: 139.827,
        entranceLat: 35.645,
        entranceLng: 139.827,
        exitLat: 35.645,
        exitLng: 139.827,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["aqualine", "keiyo", "tokan"],
        sourceGoogleNames: ["首都高速湾岸線 新木場出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-b-ariake",
        displayName: "有明",
        googleName: "首都高速湾岸線 有明出入口",
        aliases: ["有明", "有明入口", "有明出口"],
        roadType: "首都高",
        routeCode: "B",
        routeName: "首都高速湾岸線",
        order: 6,
        lat: 35.634,
        lng: 139.795,
        entranceLat: 35.634,
        entranceLng: 139.795,
        exitLat: 35.634,
        exitLng: 139.795,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["aqualine", "keiyo", "tokan"],
        sourceGoogleNames: ["首都高速湾岸線 有明出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-b-oi-minami",
        displayName: "大井南",
        googleName: "首都高速湾岸線 大井南出入口",
        aliases: ["大井南", "大井南入口", "大井南出口"],
        roadType: "首都高",
        routeCode: "B",
        routeName: "首都高速湾岸線",
        order: 9,
        lat: 35.589,
        lng: 139.756,
        entranceLat: 35.589,
        entranceLng: 139.756,
        exitLat: 35.589,
        exitLng: 139.756,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["aqualine", "keiyo", "tokan"],
        sourceGoogleNames: ["首都高速湾岸線 大井南出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-b-kuko-chuo",
        displayName: "空港中央",
        googleName: "首都高速湾岸線 空港中央出入口",
        aliases: ["空港中央", "空港中央入口", "空港中央出口"],
        roadType: "首都高",
        routeCode: "B",
        routeName: "首都高速湾岸線",
        order: 10,
        lat: 35.553,
        lng: 139.787,
        entranceLat: 35.553,
        entranceLng: 139.787,
        exitLat: 35.553,
        exitLng: 139.787,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["aqualine", "keiyo", "tokan"],
        sourceGoogleNames: ["首都高速湾岸線 空港中央出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-b-ukishima",
        displayName: "浮島IC",
        googleName: "首都高速湾岸線 浮島インターチェンジ",
        aliases: ["浮島", "浮島IC", "浮島インターチェンジ"],
        roadType: "首都高",
        routeCode: "B",
        routeName: "首都高速湾岸線",
        order: 12,
        lat: 35.521,
        lng: 139.788,
        entranceLat: 35.521,
        entranceLng: 139.788,
        exitLat: 35.521,
        exitLng: 139.788,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["aqualine", "tateyama"],
        sourceGoogleNames: ["首都高速湾岸線 浮島インターチェンジ"],
        note: "既存2登録ではroadType未設定。新マスター内だけ首都高として正規化。現時点では未参照。"
    },
    {
        id: "shuto-b-urayasu",
        displayName: "浦安",
        googleName: "首都高速湾岸線 浦安出入口",
        aliases: ["浦安", "浦安入口", "浦安出口"],
        roadType: "首都高",
        routeCode: "B",
        routeName: "首都高速湾岸線",
        order: 2,
        lat: 35.652353,
        lng: 139.905542,
        entranceLat: 35.652482,
        entranceLng: 139.905081,
        exitLat: 35.652224,
        exitLng: 139.906003,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速湾岸線 浦安出入口"],
        note: "東行き・西行きとも入口・出口。新規追加。首都高公式サイト(shutoko.jp route-b/urayasu)で方向を確認。座標はMapFanの「浦安ランプ（湾岸線）【入口（東行き）】/【出口（西行き）】」個別ページでランプごとに確認、入口・出口座標間約0.09kmの中間点。"
    },
    {
        id: "shuto-b-rinkai-fukutoshin",
        displayName: "臨海副都心",
        googleName: "首都高速湾岸線 臨海副都心出入口",
        aliases: ["臨海副都心", "臨海副都心入口", "臨海副都心出口"],
        roadType: "首都高",
        routeCode: "B",
        routeName: "首都高速湾岸線",
        order: 7,
        lat: 35.625536,
        lng: 139.773886,
        entranceLat: 35.625079,
        entranceLng: 139.773897,
        exitLat: 35.625993,
        exitLng: 139.773874,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速湾岸線 臨海副都心出入口"],
        note: "西行き入口・東行き出口。首都高公式サイト(shutoko.jp route-b/rinkaihukutoshin)の出入口ページの表で「入口:西行き／出口:東行き」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（西行き）を代表方向として採用し、東行き出口はexitSelectable:falseとした。入口はETC専用。新規追加。座標はMapFanの「臨海副都心ランプ（湾岸線）【入口（西行き）】/【出口（東行き）】」個別ページでランプごとに確認、入口・出口座標間約0.10kmの中間点。"
    },
    {
        id: "shuto-b-ooi",
        displayName: "大井",
        googleName: "首都高速湾岸線 大井出入口",
        aliases: ["大井", "大井入口", "大井出口"],
        roadType: "首都高",
        routeCode: "B",
        routeName: "首都高速湾岸線",
        order: 8,
        lat: 35.611127,
        lng: 139.755831,
        entranceLat: 35.609435,
        entranceLng: 139.755056,
        exitLat: 35.611819,
        exitLng: 139.756607,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速湾岸線 大井出入口"],
        note: "東行き入口・西行き出口。首都高公式サイト(shutoko.jp route-b/ooi)の出入口ページの表で「入口:東行き／出口:西行き」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（東行き）を代表方向として採用し、西行き出口はexitSelectable:falseとした。入口はETC専用。既存登録済みの「大井南」とは別出入口。新規追加。座標はMapFanの「大井ランプ（湾岸線）【入口（東行き）】/【出口（西行き）】」個別ページでランプごとに確認、入口・出口座標間約0.30kmの中間点。"
    },
    {
        id: "shuto-b-wangan-kanpachi",
        displayName: "湾岸環八",
        googleName: "首都高速湾岸線 湾岸環八出入口",
        aliases: ["湾岸環八", "湾岸環八入口", "湾岸環八出口"],
        roadType: "首都高",
        routeCode: "B",
        routeName: "首都高速湾岸線",
        order: 11,
        lat: 35.540258,
        lng: 139.793270,
        entranceLat: 35.540149,
        entranceLng: 139.793613,
        exitLat: 35.540368,
        exitLng: 139.792927,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速湾岸線 湾岸環八出入口"],
        note: "西行き入口・東行き出口。首都高公式サイト(shutoko.jp route-b/wangankanpachi)の出入口ページの表で「入口:西行き／出口:東行き」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（西行き）を代表方向として採用し、東行き出口はexitSelectable:falseとした。入口はETC専用。新規追加。座標はMapFanの「湾岸環八ランプ（湾岸線）【入口（西行き）】/【出口（東行き）】」個別ページでランプごとに確認、入口・出口座標間約0.07kmの中間点。"
    },
    {
        id: "shuto-b-higashiogishima",
        displayName: "東扇島",
        googleName: "首都高速湾岸線 東扇島出入口",
        aliases: ["東扇島", "東扇島入口", "東扇島出口"],
        roadType: "首都高",
        routeCode: "B",
        routeName: "首都高速湾岸線",
        order: 13,
        lat: 35.493192,
        lng: 139.747210,
        entranceLat: 35.493108,
        entranceLng: 139.747980,
        exitLat: 35.493276,
        exitLng: 139.746440,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速湾岸線 東扇島出入口"],
        note: "西行き・東行きとも入口・出口。新規追加。首都高公式サイト(shutoko.jp route-b/higashiogishima)で方向を確認。座標はMapFanの「東扇島ランプ（湾岸線）【入口（西行き）】/【出口（東行き）】」個別ページで確認、入口・出口座標間約0.14kmの中間点。東行き入口・西行き出口の座標は未採用。"
    },
    {
        id: "shuto-b-daikokufutou",
        displayName: "大黒ふ頭",
        googleName: "首都高速湾岸線 大黒ふ頭出入口",
        aliases: ["大黒ふ頭", "大黒ふ頭入口", "大黒ふ頭出口"],
        roadType: "首都高",
        routeCode: "B",
        routeName: "首都高速湾岸線",
        order: 14,
        lat: 35.461076,
        lng: 139.680659,
        entranceLat: 35.461161,
        entranceLng: 139.680651,
        exitLat: 35.460992,
        exitLng: 139.680667,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速湾岸線 大黒ふ頭出入口"],
        note: "西行き・東行きとも入口・出口（首都高速神奈川5号大黒線とも接続する共用出入口）。新規追加。首都高公式サイト(shutoko.jp route-b/daikokufutou)で方向を確認。座標はMapFan上「神奈川5号大黒線」名義で登録されたランプ個別ページ（入口・出口とも1箇所に近接）で確認、座標差はごく僅か。"
    },
    {
        id: "shuto-b-honmoku-futou",
        displayName: "本牧ふ頭",
        googleName: "首都高速湾岸線 本牧ふ頭出入口",
        aliases: ["本牧ふ頭", "本牧ふ頭入口", "本牧ふ頭出口"],
        roadType: "首都高",
        routeCode: "B",
        routeName: "首都高速湾岸線",
        order: 15,
        lat: 35.432625,
        lng: 139.670440,
        entranceLat: 35.432574,
        entranceLng: 139.670281,
        exitLat: 35.432676,
        exitLng: 139.670599,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速湾岸線 本牧ふ頭出入口"],
        note: "東行き入口・西行き出口。新規追加。首都高公式サイト(shutoko.jp route-b/honmakifutou)で方向を確認。座標はMapFanの「本牧ふ頭ランプ（湾岸線）【入口（東行き）】/【出口（西行き）】」個別ページでランプごとに確認、入口・出口座標間約0.03kmの中間点。神奈川3号狩場線への直通は不可。"
    },
    {
        id: "shuto-b-minami-honmoku-futou",
        displayName: "南本牧ふ頭",
        googleName: "首都高速湾岸線 南本牧ふ頭出入口",
        aliases: ["南本牧ふ頭", "南本牧ふ頭入口", "南本牧ふ頭出口"],
        roadType: "首都高",
        routeCode: "B",
        routeName: "首都高速湾岸線",
        order: 16,
        lat: 35.417826,
        lng: 139.670855,
        entranceLat: 35.416924,
        entranceLng: 139.670690,
        exitLat: 35.418727,
        exitLng: 139.671021,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速湾岸線 南本牧ふ頭出入口"],
        note: "東行き入口・西行き出口。新規追加。首都高公式サイト(shutoko.jp route-b/minamihonmokufutou)で方向を確認。座標はMapFanの「南本牧ふ頭ランプ（湾岸線）【入口（東行き）】/【出口（西行き）】」個別ページでランプごとに確認、入口・出口座標間約0.20kmの中間点。「南本牧はま道路」以外の一般道とは直接接続しない点に留意。"
    },
    {
        id: "shuto-b-sankeien",
        displayName: "三溪園",
        googleName: "首都高速湾岸線 三溪園出入口",
        aliases: ["三溪園", "三溪園入口", "三溪園出口"],
        roadType: "首都高",
        routeCode: "B",
        routeName: "首都高速湾岸線",
        order: 17,
        lat: 35.412974,
        lng: 139.663499,
        entranceLat: 35.413399,
        entranceLng: 139.665415,
        exitLat: 35.412549,
        exitLng: 139.661584,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速湾岸線 三溪園出入口"],
        note: "西行き入口・東行き出口。首都高公式サイト(shutoko.jp route-b/sankeien)の出入口ページの表で「入口:西行き／出口:東行き」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（西行き）を代表方向として採用し、東行き出口はexitSelectable:falseとした。入口はETC専用。新規追加。座標はMapFanの「三溪園ランプ（湾岸線）【入口（西行き）】/【出口（東行き）】」個別ページでランプごとに確認、入口・出口座標間約0.36km（既存データ中の芝公園0.75kmの範囲内）。"
    },
    {
        id: "shuto-b-isogo",
        displayName: "磯子",
        googleName: "首都高速湾岸線 磯子出入口",
        aliases: ["磯子", "磯子入口", "磯子出口"],
        roadType: "首都高",
        routeCode: "B",
        routeName: "首都高速湾岸線",
        order: 18,
        lat: 35.396935,
        lng: 139.617063,
        entranceLat: 35.396806,
        entranceLng: 139.616934,
        exitLat: 35.397064,
        exitLng: 139.617192,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速湾岸線 磯子出入口"],
        note: "東行き入口・西行き出口。首都高公式サイト(shutoko.jp route-b/isogo)の出入口ページの表で「入口:東行き／出口:西行き」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（東行き）を代表方向として採用し、西行き出口はexitSelectable:falseとした。入口はETC専用。新規追加。座標はMapFanの「磯子ランプ（湾岸線）【入口（東行き）】/【出口（西行き）】」個別ページでランプごとに確認、入口・出口座標間約0.04kmの中間点。"
    },
    {
        id: "shuto-b-sugita",
        displayName: "杉田",
        googleName: "首都高速湾岸線 杉田出入口",
        aliases: ["杉田", "杉田入口", "杉田出口"],
        roadType: "首都高",
        routeCode: "B",
        routeName: "首都高速湾岸線",
        order: 19,
        lat: 35.385006,
        lng: 139.622190,
        entranceLat: 35.384949,
        entranceLng: 139.621888,
        exitLat: 35.385062,
        exitLng: 139.622493,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速湾岸線 杉田出入口"],
        note: "東行き・西行きとも入口・出口（ETC専用）。新規追加。首都高公式サイト(shutoko.jp route-b/sugita)で方向を確認。座標はMapFanの「杉田ランプ（湾岸線）【入口（東行き）】/【出口（西行き）】」個別ページで確認、入口・出口座標間約0.06kmの中間点。西行き入口・東行き出口の座標は未採用。"
    },
    {
        id: "shuto-b-sachiura",
        displayName: "幸浦",
        googleName: "首都高速湾岸線 幸浦出入口",
        aliases: ["幸浦", "幸浦入口", "幸浦出口"],
        roadType: "首都高",
        routeCode: "B",
        routeName: "首都高速湾岸線",
        order: 20,
        lat: 35.358532,
        lng: 139.643735,
        entranceLat: 35.359164,
        entranceLng: 139.643490,
        exitLat: 35.357899,
        exitLng: 139.643980,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速湾岸線 幸浦出入口"],
        note: "東行き入口・西行き出口。新規追加。首都高公式サイト(shutoko.jp route-b/sachiura)で方向を確認。座標はMapFanの「幸浦ランプ（湾岸線）【入口（東行き）】/【出口（西行き）】」個別ページでランプごとに確認、入口・出口座標間約0.15kmの中間点。"
    },
    {
        id: "shuto-k1-daishi",
        displayName: "大師",
        googleName: "首都高速神奈川1号横羽線 大師出入口",
        aliases: ["大師", "大師入口", "大師出口"],
        roadType: "首都高",
        routeCode: "K1",
        routeName: "首都高速神奈川1号横羽線",
        order: 1,
        lat: 35.535,
        lng: 139.726,
        entranceLat: 35.535,
        entranceLng: 139.726,
        exitLat: 35.535,
        exitLng: 139.726,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["shutoKanagawaK1"],
        sourceGoogleNames: ["首都高速神奈川1号横羽線 大師出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-k1-asada",
        displayName: "浅田",
        googleName: "首都高速神奈川1号横羽線 浅田出入口",
        aliases: ["浅田", "浅田入口", "浅田出口"],
        roadType: "首都高",
        routeCode: "K1",
        routeName: "首都高速神奈川1号横羽線",
        order: 2,
        lat: 35.520,
        lng: 139.706,
        entranceLat: 35.520,
        entranceLng: 139.706,
        exitLat: 35.520,
        exitLng: 139.706,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["shutoKanagawaK1"],
        sourceGoogleNames: ["首都高速神奈川1号横羽線 浅田出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-k1-hama-kawasaki",
        displayName: "浜川崎",
        googleName: "首都高速神奈川1号横羽線 浜川崎出入口",
        aliases: ["浜川崎", "浜川崎入口", "浜川崎出口"],
        roadType: "首都高",
        routeCode: "K1",
        routeName: "首都高速神奈川1号横羽線",
        order: 3,
        lat: 35.522,
        lng: 139.718,
        entranceLat: 35.522,
        entranceLng: 139.718,
        exitLat: 35.522,
        exitLng: 139.718,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["shutoKanagawaK1"],
        sourceGoogleNames: ["首都高速神奈川1号横羽線 浜川崎出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-k1-namamugi",
        displayName: "生麦",
        googleName: "首都高速神奈川1号横羽線 生麦出入口",
        aliases: ["生麦", "生麦入口", "生麦出口"],
        roadType: "首都高",
        routeCode: "K1",
        routeName: "首都高速神奈川1号横羽線",
        order: 4,
        lat: 35.495,
        lng: 139.668,
        entranceLat: 35.495,
        entranceLng: 139.668,
        exitLat: 35.495,
        exitLng: 139.668,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["shutoKanagawaK1"],
        sourceGoogleNames: ["首都高速神奈川1号横羽線 生麦出入口"],
        note: "既存データではK1・K7接続地点。現時点では未参照。"
    },
    {
        id: "shuto-k1-shioiri",
        displayName: "汐入",
        googleName: "首都高速神奈川1号横羽線 汐入出入口",
        aliases: ["汐入", "汐入入口", "汐入出口"],
        roadType: "首都高",
        routeCode: "K1",
        routeName: "首都高速神奈川1号横羽線",
        order: 5,
        lat: 35.501,
        lng: 139.682,
        entranceLat: 35.501,
        entranceLng: 139.682,
        exitLat: 35.501,
        exitLng: 139.682,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["shutoKanagawaK1"],
        sourceGoogleNames: ["首都高速神奈川1号横羽線 汐入出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-k1-moriyacho",
        displayName: "守屋町",
        googleName: "首都高速神奈川1号横羽線 守屋町出口",
        aliases: ["守屋町", "守屋町出口"],
        roadType: "首都高",
        routeCode: "K1",
        routeName: "首都高速神奈川1号横羽線",
        order: 6,
        lat: 35.481,
        lng: 139.660,
        entranceLat: 35.481,
        entranceLng: 139.660,
        exitLat: 35.481,
        exitLng: 139.660,
        entranceSelectable: false,
        exitSelectable: true,
        sourceAreaKeys: ["shutoKanagawaK1"],
        sourceGoogleNames: ["首都高速神奈川1号横羽線 守屋町出口"],
        note: "公式上は出口専用。入口出口別フィルタ対応済みのため、出口候補として有効化。"
    },
    {
        id: "shuto-k1-koyasu",
        displayName: "子安",
        googleName: "首都高速神奈川1号横羽線 子安出入口",
        aliases: ["子安", "子安入口", "子安出口"],
        roadType: "首都高",
        routeCode: "K1",
        routeName: "首都高速神奈川1号横羽線",
        order: 7,
        lat: 35.483,
        lng: 139.646,
        entranceLat: 35.483,
        entranceLng: 139.646,
        exitLat: 35.483,
        exitLng: 139.646,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["shutoKanagawaK1"],
        sourceGoogleNames: ["首都高速神奈川1号横羽線 子安出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-k1-higashi-kanagawa",
        displayName: "東神奈川",
        googleName: "首都高速神奈川1号横羽線 東神奈川出入口",
        aliases: ["東神奈川", "東神奈川入口", "東神奈川出口"],
        roadType: "首都高",
        routeCode: "K1",
        routeName: "首都高速神奈川1号横羽線",
        order: 8,
        lat: 35.476,
        lng: 139.636,
        entranceLat: 35.476,
        entranceLng: 139.636,
        exitLat: 35.476,
        exitLng: 139.636,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["shutoKanagawaK1"],
        sourceGoogleNames: ["首都高速神奈川1号横羽線 東神奈川出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-k1-yokohama-eki-higashiguchi",
        displayName: "横浜駅東口",
        googleName: "首都高速神奈川1号横羽線 横浜駅東口出入口",
        aliases: ["横浜駅東口", "横浜駅東口入口", "横浜駅東口出口"],
        roadType: "首都高",
        routeCode: "K1",
        routeName: "首都高速神奈川1号横羽線",
        order: 9,
        lat: 35.466,
        lng: 139.626,
        entranceLat: 35.466,
        entranceLng: 139.626,
        exitLat: 35.466,
        exitLng: 139.626,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["shutoKanagawaK1"],
        sourceGoogleNames: ["首都高速神奈川1号横羽線 横浜駅東口出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-k1-minatomirai",
        displayName: "みなとみらい",
        googleName: "首都高速神奈川1号横羽線 みなとみらい出入口",
        aliases: ["みなとみらい", "みなとみらい入口", "みなとみらい出口"],
        roadType: "首都高",
        routeCode: "K1",
        routeName: "首都高速神奈川1号横羽線",
        order: 10,
        lat: 35.457,
        lng: 139.632,
        entranceLat: 35.457,
        entranceLng: 139.632,
        exitLat: 35.457,
        exitLng: 139.632,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["shutoKanagawaK1"],
        sourceGoogleNames: ["首都高速神奈川1号横羽線 みなとみらい出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-k1-yokohama-koen",
        displayName: "横浜公園",
        googleName: "首都高速神奈川1号横羽線 横浜公園出入口",
        aliases: ["横浜公園", "横浜公園入口", "横浜公園出口"],
        roadType: "首都高",
        routeCode: "K1",
        routeName: "首都高速神奈川1号横羽線",
        order: 11,
        lat: 35.444,
        lng: 139.642,
        entranceLat: 35.444,
        entranceLng: 139.642,
        exitLat: 35.444,
        exitLng: 139.642,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["shutoKanagawaK1"],
        sourceGoogleNames: ["首都高速神奈川1号横羽線 横浜公園出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-k7-kishiya-namamugi",
        displayName: "岸谷生麦",
        googleName: "首都高速神奈川7号横浜北線 岸谷生麦出入口",
        aliases: ["岸谷生麦", "岸谷生麦入口", "岸谷生麦出口"],
        roadType: "首都高",
        routeCode: "K7",
        routeName: "首都高速神奈川7号横浜北線",
        order: 1,
        lat: 35.495,
        lng: 139.667,
        entranceLat: 35.495,
        entranceLng: 139.667,
        exitLat: 35.495,
        exitLng: 139.667,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["shutoKanagawaK7"],
        sourceGoogleNames: ["首都高速神奈川7号横浜北線 岸谷生麦出入口"],
        note: "既存データではK7・K1接続地点。現時点では未参照。"
    },
    {
        id: "shuto-k7-baba",
        displayName: "馬場",
        googleName: "首都高速神奈川7号横浜北線 馬場出入口",
        aliases: ["馬場", "馬場入口", "馬場出口"],
        roadType: "首都高",
        routeCode: "K7",
        routeName: "首都高速神奈川7号横浜北線",
        order: 2,
        lat: 35.504,
        lng: 139.646,
        entranceLat: 35.504,
        entranceLng: 139.646,
        exitLat: 35.504,
        exitLng: 139.646,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["shutoKanagawaK7"],
        sourceGoogleNames: ["首都高速神奈川7号横浜北線 馬場出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-k7-shin-yokohama",
        displayName: "新横浜",
        googleName: "首都高速神奈川7号横浜北線 新横浜出入口",
        aliases: ["新横浜", "新横浜入口", "新横浜出口"],
        roadType: "首都高",
        routeCode: "K7",
        routeName: "首都高速神奈川7号横浜北線",
        order: 3,
        lat: 35.513,
        lng: 139.618,
        entranceLat: 35.513,
        entranceLng: 139.618,
        exitLat: 35.513,
        exitLng: 139.618,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["shutoKanagawaK7"],
        sourceGoogleNames: ["首都高速神奈川7号横浜北線 新横浜出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-k7-yokohama-kohoku",
        displayName: "横浜港北",
        googleName: "首都高速神奈川7号横浜北線 横浜港北出入口",
        aliases: ["横浜港北", "横浜港北入口", "横浜港北出口"],
        roadType: "首都高",
        routeCode: "K7",
        routeName: "首都高速神奈川7号横浜北線",
        order: 4,
        lat: 35.519,
        lng: 139.600,
        entranceLat: 35.519,
        entranceLng: 139.600,
        exitLat: 35.519,
        exitLng: 139.600,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["shutoKanagawaK7"],
        sourceGoogleNames: ["首都高速神奈川7号横浜北線 横浜港北出入口"],
        note: "首都高公式サイトで入口・出口とも上り下り利用可能を確認し、trueに修正。以前のisSelectable:false引き継ぎは誤りと判断。"
    },
    {
        id: "shuto-k7-hokusei-yokohama-kohoku",
        displayName: "横浜港北",
        googleName: "首都高速神奈川7号横浜北西線 横浜港北出入口",
        aliases: ["横浜港北", "横浜港北入口", "横浜港北出口"],
        roadType: "首都高",
        routeCode: "K7北西",
        routeName: "首都高速神奈川7号横浜北西線",
        order: 1,
        lat: 35.519,
        lng: 139.600,
        entranceLat: 35.519,
        entranceLng: 139.600,
        exitLat: 35.519,
        exitLng: 139.600,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["shutoKanagawaK7Hokusei"],
        sourceGoogleNames: ["首都高速神奈川7号横浜北西線 横浜港北出入口"],
        note: "首都高公式サイトで入口・出口とも上り下り利用可能を確認し、trueに修正。以前のisSelectable:false引き継ぎは誤りと判断。"
    },
    {
        id: "shuto-k7-hokusei-yokohama-aoba",
        displayName: "横浜青葉",
        googleName: "首都高速神奈川7号横浜北西線 横浜青葉出入口",
        aliases: ["横浜青葉", "横浜青葉入口", "横浜青葉出口"],
        roadType: "首都高",
        routeCode: "K7北西",
        routeName: "首都高速神奈川7号横浜北西線",
        order: 2,
        lat: 35.542,
        lng: 139.537,
        entranceLat: 35.542,
        entranceLng: 139.537,
        exitLat: 35.542,
        exitLng: 139.537,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["shutoKanagawaK7Hokusei"],
        sourceGoogleNames: ["首都高速神奈川7号横浜北西線 横浜青葉出入口"],
        note: "既存データでは北西線・東名接続地点。現時点では未参照。"
    },
    {
        id: "shuto-s1-shikahamabashi",
        displayName: "鹿浜橋",
        googleName: "首都高速川口線 鹿浜橋出入口",
        aliases: ["鹿浜橋", "鹿浜橋入口", "鹿浜橋出口"],
        roadType: "首都高",
        routeCode: "S1",
        routeName: "首都高速川口線",
        order: 1,
        lat: 35.776525,
        lng: 139.749301,
        entranceLat: 35.776874,
        entranceLng: 139.748913,
        exitLat: 35.776176,
        exitLng: 139.749689,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速川口線 鹿浜橋出入口"],
        note: "上り・下りとも入口、出口は下りのみ（江北JCT方面への出口は設置なし）。本アプリは候補選定時に走行方向を区別できないため、方向限定の出口（下りのみ、上り側は設置なしと明記）は安全側でexitSelectable:falseとした（誤って上り方向のルートに本ICを出口候補として出さないため）。入口は方向を問わず利用可能なためentranceSelectable:trueを維持。ETC専用。新規追加。首都高公式サイト(shutoko.jp route-s1/shikahamabashi)で方向を確認。座標はMapFanの「鹿浜橋ランプ（川口線）【入口（上り）】/【出口（下り）】」個別ページでランプごとに確認、入口・出口座標間約0.10kmの中間点。下り入口ランプの座標は未採用。"
    },
    {
        id: "shuto-s1-higashiryoke",
        displayName: "東領家",
        googleName: "首都高速川口線 東領家出口",
        aliases: ["東領家", "東領家出口"],
        roadType: "首都高",
        routeCode: "S1",
        routeName: "首都高速川口線",
        order: 2,
        lat: 35.787520,
        lng: 139.752960,
        entranceLat: 35.787520,
        entranceLng: 139.752960,
        exitLat: 35.787520,
        exitLng: 139.752960,
        entranceSelectable: false,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速川口線 東領家出口"],
        note: "公式上は出口専用（上りのみ）、入口設定なし。新規追加。首都高公式サイト(shutoko.jp route-s1/higashiryouke)で確認。座標はMapFanの「東領家ランプ（川口線）【出口（上り）】」個別ページで確認。"
    },
    {
        id: "shuto-s1-kaga",
        displayName: "加賀",
        googleName: "首都高速川口線 加賀出入口",
        aliases: ["加賀", "加賀入口", "加賀出口"],
        roadType: "首都高",
        routeCode: "S1",
        routeName: "首都高速川口線",
        order: 3,
        lat: 35.794869,
        lng: 139.760005,
        entranceLat: 35.794952,
        entranceLng: 139.760273,
        exitLat: 35.794786,
        exitLng: 139.759737,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速川口線 加賀出入口"],
        note: "上り入口・下り出口。首都高公式サイト(shutoko.jp route-s1/kaga)の出入口ページの表で「入口:上り／出口:下り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。入口はETC専用。新規追加。座標はMapFanの「加賀ランプ（川口線）【入口（上り）】/【出口（下り）】」個別ページでランプごとに確認、入口・出口座標間約0.05kmの中間点。"
    },
    {
        id: "shuto-s1-adachi-iriya",
        displayName: "足立入谷",
        googleName: "首都高速川口線 足立入谷出入口",
        aliases: ["足立入谷", "足立入谷入口", "足立入谷出口"],
        roadType: "首都高",
        routeCode: "S1",
        routeName: "首都高速川口線",
        order: 4,
        lat: 35.804804,
        lng: 139.759544,
        entranceLat: 35.804786,
        entranceLng: 139.759424,
        exitLat: 35.804822,
        exitLng: 139.759663,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速川口線 足立入谷出入口"],
        note: "下り入口・上り出口。首都高公式サイト(shutoko.jp route-s1/adachiiriya)の出入口ページの表で「入口:下り／出口:上り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（下り）を代表方向として採用し、上り出口はexitSelectable:falseとした。入口はETC専用。新規追加。座標はMapFanの「足立入谷ランプ（川口線）【入口（下り）】/【出口（上り）】」個別ページでランプごとに確認、入口・出口座標間約0.02kmの中間点。"
    },
    {
        id: "shuto-s1-shingou",
        displayName: "新郷",
        googleName: "首都高速川口線 新郷出入口",
        aliases: ["新郷", "新郷入口", "新郷出口"],
        roadType: "首都高",
        routeCode: "S1",
        routeName: "首都高速川口線",
        order: 5,
        lat: 35.818738,
        lng: 139.759969,
        entranceLat: 35.818743,
        entranceLng: 139.760119,
        exitLat: 35.818733,
        exitLng: 139.759820,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速川口線 新郷出入口"],
        note: "上り・下りとも入口・出口。新規追加。首都高公式サイト(shutoko.jp route-s1/shingou)で方向を確認。座標はMapFanの「新郷ランプ（川口線）【入口（上り）】/【出口（下り）】」個別ページで上り側の組み合わせを代表点として確認、入口・出口座標間約0.03kmの中間点。下り入口・上り出口の座標は未採用。"
    },
    {
        id: "shuto-s1-angyou",
        displayName: "安行",
        googleName: "首都高速川口線 安行出入口",
        aliases: ["安行", "安行入口", "安行出口"],
        roadType: "首都高",
        routeCode: "S1",
        routeName: "首都高速川口線",
        order: 6,
        lat: 35.835587,
        lng: 139.755731,
        entranceLat: 35.835615,
        entranceLng: 139.755846,
        exitLat: 35.835560,
        exitLng: 139.755615,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速川口線 安行出入口"],
        note: "上り入口・下り出口。首都高公式サイト(shutoko.jp route-s1/angyou)の出入口ページの表で「入口:上り／出口:下り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。入口はETC専用。新規追加。座標はMapFanの「安行ランプ（川口線）【入口（上り）】/【出口（下り）】」個別ページでランプごとに確認、入口・出口座標間約0.02kmの中間点。"
    },
    {
        id: "shuto-s1-araijuku",
        displayName: "新井宿",
        googleName: "首都高速川口線 新井宿出入口",
        aliases: ["新井宿", "新井宿入口", "新井宿出口"],
        roadType: "首都高",
        routeCode: "S1",
        routeName: "首都高速川口線",
        order: 7,
        lat: 35.847447,
        lng: 139.737804,
        entranceLat: 35.847628,
        entranceLng: 139.737750,
        exitLat: 35.847266,
        exitLng: 139.737857,
        entranceSelectable: true,
        exitSelectable: false,
        sourceAreaKeys: [],
        sourceGoogleNames: ["首都高速川口線 新井宿出入口"],
        note: "上り入口・下り出口。首都高公式サイト(shutoko.jp route-s1/araijuku)の出入口ページの表で「入口:上り／出口:下り」（片方向のみ）と再確認し、本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。新規追加。座標はMapFanの「新井宿ランプ（川口線）【入口（上り）】/【出口（下り）】」個別ページでランプごとに確認、入口・出口座標間約0.04kmの中間点。"
    }
];

const IC_MASTER = {
    // 接続道路のICは重複登録を許可する。
    // 例: 木更津金田ICをアクアライン・館山道双方へ保持する。
    joban: {
        label: "常磐道方面",
        exits: [

            {
                order: -3,
                displayName: "堤通（首都高）",
                googleName: "首都高速6号向島線 堤通出入口",
                lat: 35.7357056,
                lng: 139.8150419,
                experimental: true,
                roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.7357056, entranceLng: 139.8150419, exitLat: 35.7357056, exitLng: 139.8150419,
                note: "【2026-07-18同期修正】SHUTO_IC_MASTER本体側（shuto-6-tsutsumidori、MapFan検証済み）の座標に同期。旧座標との誤差約548m。dedupeIcDefinitionsByIdentityによりSHUTO_IC_MASTER側が優先されるため候補選定への実害はなかったが、データ整合性のため修正。"
            },
            {
                order: -2,
                displayName: "加平（首都高）",
                googleName: "首都高速中央環状線 加平出入口",
                lat: 35.7776257,
                lng: 139.8258096,
                experimental: true,
                roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.7776257, entranceLng: 139.8258096, exitLat: 35.7776257, exitLng: 139.8258096,
                note: "【2026-07-18同期修正】SHUTO_IC_MASTER本体側（shuto-6-kahira、MapFan検証済み「加平ランプ（６号三郷線）【入口】」）の座標に同期。旧座標との誤差約525m。dedupeIcDefinitionsByIdentityによりSHUTO_IC_MASTER側が優先されるため候補選定への実害はなかったが、データ整合性のため修正。"
            },
            {
                order: -1,
                displayName: "八潮南（首都高）",
                googleName: "首都高速6号三郷線 八潮南出入口",
                lat: 35.805792,
                lng: 139.83513,
                experimental: true,
                roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.805792, entranceLng: 139.83513, exitLat: 35.799209, exitLng: 139.827506,
                note: "【2026-07-18調査・座標修正】従来は(35.805,139.842)という未検証の暫定座標だった（SHUTO_IC_MASTER側の同一IC「八潮南」と同じ値。dedupeIcDefinitionsByIdentityではSHUTO_IC_MASTER側が優先されるため、本エントリ単独の修正だけでは候補選定に反映されない点に注意）。従来座標との誤差は約1.0km。NAVITIME「首都6号三郷線 八潮南出入口 上り/下り」の実測値を使用（上り入口:35.805792,139.83513／下り出口:35.799209,139.827506）。フルインターチェンジ（上下線とも入口・出口設置）であることをWikipedia「八潮南出入口」で確認済み。参考情報として、2026年5月5日より上下線とも入口料金所がETC専用になっている。"
            },

            {
                order: 1,
                displayName: "三郷IC",
                googleName: "常磐自動車道 三郷インターチェンジ",
                lat: 35.8389541,
                lng: 139.8627455,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.8389541, entranceLng: 139.8627455, exitLat: 35.8367537, exitLng: 139.8608378,
                note: "【2026-07-18調査・座標修正】MapFan「三郷ＩＣ（常磐自動車道）」入口（下り）・出口（上り）座標を採用。Wikipedia代表点（35.8361861,139.859389）・NAVITIME検索結果とも整合。フルIC、方向制限なし。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(35.842,139.872)から約900m修正。"
            },
            {
                order: 1.5,
                displayName: "三郷料金所SIC",
                googleName: "常磐自動車道 三郷料金所スマートインターチェンジ",
                lat: 35.865347,
                lng: 139.883112,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.865347, entranceLng: 139.883112, exitLat: 35.865347, exitLng: 139.883112,
                note: "【2026-07-14調査・座標のみ修正】開設当初は東京方面（上り線）出入口のないハーフSICだったが、NEXCO東日本・埼玉県道路公社プレスリリース、三郷市公式サイトで2025年3月22日15時に東京方面出入口が開通し現在はフルICであることを確認。entranceSelectable/exitSelectableは現状（フルIC）と一致しているため変更なし（trueのまま）。座標は、NAVITIMEで確認した上り出口(35.867528,139.8846)・下り出口(35.863166,139.881624)の中間点(35.865347,139.883112)を暫定使用（入口側の個別ランプ座標は確認できなかったため）。従来座標(35.865,139.883)から約40m修正。"
            },
            {
                order: 2,
                displayName: "流山IC",
                googleName: "常磐自動車道 流山インターチェンジ",
                lat: 35.880116,
                lng: 139.899009,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.880116, entranceLng: 139.899009, exitLat: 35.8800715, exitLng: 139.8988157,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「流山ＩＣ（常磐自動車道）【入口】」「【出口】」（方向表記なし、入口・出口ともほぼ同一地点）を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(35.880116,139.899009)、exitLat/Lngを出口(35.8800715,139.8988157)に設定。従来座標(35.889,139.911)から約1.5km修正。"
            },
            {
                order: 3,
                displayName: "柏IC",
                googleName: "常磐自動車道 柏インターチェンジ",
                lat: 35.9074632,
                lng: 139.9381266,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.9074632, entranceLng: 139.9381266, exitLat: 35.9076551, exitLng: 139.9381257,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「柏ＩＣ（常磐自動車道）【入口】」「【出口】」を確認し、NAVITIMEで上り入口・上り出口・下り入口・下り出口の4方向存在も確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(35.9074632,139.9381266)、exitLat/Lngを出口(35.9076551,139.9381257)に設定。従来座標(35.899,139.953)から約1.6km修正。"
            },
            {
                order: 4,
                displayName: "谷和原IC",
                googleName: "常磐自動車道 谷和原インターチェンジ",
                lat: 35.9726857,
                lng: 139.9816383,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.9726857, entranceLng: 139.9816383, exitLat: 35.9729157, exitLng: 139.981621,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「谷和原ＩＣ（常磐自動車道）【入口】」「【出口】」（方向表記なし）を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(35.9726857,139.9816383)、exitLat/Lngを出口(35.9729157,139.981621)に設定。従来座標(35.984,140.000)から約2.1km修正。"
            },
            {
                order: 5,
                displayName: "守谷SA",
                googleName: "常磐自動車道 守谷サービスエリア",
                lat: 35.941,
                lng: 139.993,
                isSelectable: false,
                entranceSelectable: false, exitSelectable: false, entranceLat: 35.941, entranceLng: 139.993, exitLat: 35.941, exitLng: 139.993,
                note: "【2026-07-15調査・isSelectable:falseに変更】（仮称）守谷SAスマートICは2024年9月6日付でNEXCO東日本・国土交通省により新規事業化されたが、2025年度から着工し2030年度開通を目指す段階（守谷市公式サイト・日本工業経済新聞）であり、2026年7月現在は未開通。国交省の新規事業採択時評価資料では完成予定年月日を令和16年3月（2034年3月）とする記載もあり、開通時期には情報源間で幅があるが、いずれにせよ現時点で守谷SAから本線への出入りは一切できない。そのためentranceSelectable/exitSelectable/isSelectableをすべてfalseに変更。座標は変更なし。開通後に改めてMapFan等で座標確認のうえ有効化すること。"
            },
            {
                order: 6,
                displayName: "谷田部IC",
                googleName: "常磐自動車道 谷田部インターチェンジ",
                lat: 36.0223131,
                lng: 140.0838017,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.0223131, entranceLng: 140.0838017, exitLat: 36.0214309, exitLng: 140.08531,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「谷田部ＩＣ（常磐自動車道）【入口】」「【出口】」（方向表記なし、1981年開通）を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(36.0223131,140.0838017)、exitLat/Lngを出口(36.0214309,140.08531)に設定。従来座標(36.003,140.076)から約2.2km修正。"
            },
            {
                order: 7,
                displayName: "桜土浦IC",
                googleName: "常磐自動車道 桜土浦インターチェンジ",
                lat: 36.05839935,
                lng: 140.15770271,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.05839935, entranceLng: 140.15770271, exitLat: 36.0585571, exitLng: 140.1579634,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「桜土浦ＩＣ（常磐自動車道）【入口】」「【出口】」（方向表記なし）を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(36.05839935,140.15770271)、exitLat/Lngを出口(36.0585571,140.1579634)に設定。従来座標(36.047,140.141)から約2.0km修正。"
            },
            {
                order: 8,
                displayName: "土浦北IC",
                googleName: "常磐自動車道 土浦北インターチェンジ",
                lat: 36.1185855,
                lng: 140.1874296,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.1185855, entranceLng: 140.1874296, exitLat: 36.1186855, exitLng: 140.1875489,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「土浦北ＩＣ（常磐自動車道）【入口】」「【出口】」を確認し、NAVITIMEで上り・下りそれぞれの入口・出口の存在も確認したためフルICと判断（1982年開通）。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(36.1185855,140.1874296)、exitLat/Lngを出口(36.1186855,140.1875489)に設定。従来座標(36.107,140.197)から約1.55km修正。"
            },
            {
                order: 9,
                displayName: "千代田石岡IC",
                googleName: "常磐自動車道 千代田石岡インターチェンジ",
                lat: 36.1714792,
                lng: 140.2486563,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.1714792, entranceLng: 140.2486563, exitLat: 36.1714958, exitLng: 140.2488688,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「千代田石岡ＩＣ（常磐自動車道）【入口】」「【出口】」を確認し、NAVITIMEで上り・下りの入口・出口の存在も確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(36.1714792,140.2486563)、exitLat/Lngを出口(36.1714958,140.2488688)に設定。従来座標(36.171,140.259)から約0.9km修正。"
            },
            {
                order: 9.5,
                displayName: "石岡小美玉SIC",
                googleName: "常磐自動車道 石岡小美玉スマートインターチェンジ",
                lat: 36.220098676433,
                lng: 140.28267299652,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.220098676433, entranceLng: 140.28267299652, exitLat: 36.2201567, exitLng: 140.282711,
                note: "【2026-07-14調査・座標のみ修正】MapFanで「石岡小美玉スマートＩＣ（常磐自動車道）【入口】」「【出口】」の2ページ（方向表記なし、実質同一地点）を確認し、NAVITIMEでも上り出口・上り入口・下り出口・下り入口の4接続点の存在を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(36.220098676433,140.28267299652)、exitLat/Lngを出口(36.2201567,140.282711)に設定。従来座標(36.221,140.281)から約180m修正。"
            },
            {
                order: 10,
                displayName: "岩間IC",
                googleName: "常磐自動車道 岩間インターチェンジ",
                lat: 36.2788329,
                lng: 140.3215571,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.2788329, entranceLng: 140.3215571, exitLat: 36.2787815, exitLng: 140.3216226,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「岩間ＩＣ（常磐自動車道）【入口】」「【出口】」を確認し、NAVITIMEで上り入口・下り入口・下り出口の個別ページも確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(36.2788329,140.3215571)、exitLat/Lngを出口(36.2787815,140.3216226)に設定。従来座標(36.300,140.306)から約2.9km修正。"
            },

            {
                order: 10.5,
                displayName: "友部SA SIC",
                googleName: "常磐自動車道 友部SAスマートインターチェンジ",
                lat: 36.3090533,
                lng: 140.3430539,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.3090533, entranceLng: 140.3430539, exitLat: 36.3108753, exitLng: 140.3395277,
                note: "【2026-07-14調査・座標のみ修正】MapFanで「友部ＳＡスマートＩＣ（常磐自動車道）」の入口（上り・下り）・出口（上り・下り）の4個別ページ全てを確認し、上下線とも入口・出口が利用可能なフルICと判断（2005年7月1日供用開始、24時間利用可）。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(上り)(36.3090533,140.3430539)、exitLat/Lngを出口(下り)(36.3108753,140.3395277)に設定。従来座標(36.309,140.341)から約184m修正。"
            },

            {
                order: 12,
                displayName: "水戸IC",
                googleName: "常磐自動車道 水戸インターチェンジ",
                lat: 36.3857038,
                lng: 140.3809513,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.3857038, entranceLng: 140.3809513, exitLat: 36.3856437, exitLng: 140.3808258,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「水戸ＩＣ（常磐自動車道）【入口】」「【出口】」を確認し、上り・下りの入口・出口の存在も確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(36.3857038,140.3809513)、exitLat/Lngを出口(36.3856437,140.3808258)に設定。従来座標(36.381,140.366)から約1.44km修正。"
            },
            {
                order: 12.5,
                displayName: "水戸北SIC",
                googleName: "常磐自動車道 水戸北スマートインターチェンジ",
                lat: 36.4159698,
                lng: 140.4272421,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.4159698, entranceLng: 140.4272421, exitLat: 36.4186953, exitLng: 140.4244002,
                note: "【2026-07-14調査・座標のみ修正】MapFanで「水戸北スマートＩＣ（常磐自動車道）」の入口（上り・下り）・出口（上り・下り）の4個別ページ全てを確認し、上下線とも入口・出口が利用可能なフルICと判断（本線直結型、日本初の本線直結型スマートIC、2006年9月試行運用開始、2009年4月本格運用開始）。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(上り)(36.4159698,140.4272421)、exitLat/Lngを出口(下り)(36.4186953,140.4244002)に設定。従来座標(36.417,140.425)から約231m修正。"
            },
            {
                order: 13,
                displayName: "那珂IC",
                googleName: "常磐自動車道 那珂インターチェンジ",
                lat: 36.4527573,
                lng: 140.4721514,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.4527573, entranceLng: 140.4721514, exitLat: 36.4520801, exitLng: 140.4717993,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「那珂ＩＣ（常磐自動車道）【入口】」「【出口】」を確認し、NAVITIMEで上り入口・上り出口・下り入口・下り出口の4方向存在も確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(36.486,140.472)は隣接する水戸北SIC(36.416)・東海SIC(36.4836)との並び順（南から北）と矛盾しており、実態より約3.8km北にずれていたと考えられる。新座標(36.452)は水戸北SICと東海SICの間に収まり、道路の並び順と整合する。座標はentranceLat/Lngを入口(36.4527573,140.4721514)、exitLat/Lngを出口(36.4520801,140.4717993)に設定。"
            },
            {
                order: 13.5,
                displayName: "東海SIC",
                googleName: "常磐自動車道 東海スマートインターチェンジ",
                lat: 36.4835923,
                lng: 140.5503132,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.4835923, entranceLng: 140.5503132, exitLat: 36.4856089, exitLng: 140.5531738,
                note: "【2026-07-14調査・座標のみ修正】MapFanで「東海ＰＡスマートＩＣ（常磐自動車道）」の入口（上り・下り）・出口（上り・下り）の4個別ページ全てを確認し、上下線とも入口・出口が利用可能なフルICと判断（東海PAに接続、24時間利用可、ETC専用）。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(上り)(36.4835923,140.5503132)、exitLat/Lngを出口(下り)(36.4856089,140.5531738)に設定。従来座標(36.485,140.551)から約169m修正。"
            },
            {
                order: 14,
                displayName: "日立南太田IC",
                googleName: "常磐自動車道 日立南太田インターチェンジ",
                lat: 36.505991,
                lng: 140.576371,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.505991, entranceLng: 140.576371, exitLat: 36.5060019, exitLng: 140.5764634,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「日立南太田ＩＣ（常磐自動車道）【入口】」「【出口】」を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(36.565,140.543)との差が約7.2kmとかなり大きいが、MapFanと住所ベースのMapion（茨城県日立市大和田町、日立市と常陸太田市の境界付近、東海村方面への最寄りIC）の2つの独立した情報源で座標が一致しており、確認値の信頼性は高い。座標はentranceLat/Lngを入口(36.505991,140.576371)、exitLat/Lngを出口(36.5060019,140.5764634)に設定。"
            },
            {
                order: 15,
                displayName: "日立中央IC",
                googleName: "常磐自動車道 日立中央インターチェンジ",
                lat: 36.602194,
                lng: 140.636308,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.602194, entranceLng: 140.636308, exitLat: 36.602194, exitLng: 140.636308,
                note: "【2026-07-18調査・座標修正（暫定）】Wikipedia代表点を採用（旧座標との誤差約420m）。常磐道本線ではなく日立有料道路経由でのみ流出入する特殊構造のIC。MapFan上「東京方面」「日立市街方面」表記が上り/下りのentrance/exitのどちらに対応するか特定できなかったため、方向別座標は精密化せず代表点を暫定的にentrance/exit両方に使用。entranceSelectable/exitSelectableは変更なし（trueのまま）。方向別の精密化は保留（要追加調査）。"
            },
            {
                order: 16,
                displayName: "高萩IC",
                googleName: "常磐自動車道 高萩インターチェンジ",
                lat: 36.7420698,
                lng: 140.6887361,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.7420698, entranceLng: 140.6887361, exitLat: 36.7420698, exitLng: 140.6887361,
                note: "【2026-07-18調査・座標修正】MapFan「高萩ＩＣ（常磐自動車道）」入口座標を採用（旧座標との誤差約3.7km）。Wikipedia代表点・NAVITIMEとおおむね整合。フルIC、方向制限なし。entranceSelectable/exitSelectableは変更なし（trueのまま）。出口（上り出口・下り入口・下り出口）の個別座標は未取得のため、入口座標をフォールバック使用。次回追加確認が望ましい。"
            },
            {
                order: 17,
                displayName: "北茨城IC",
                googleName: "常磐自動車道 北茨城インターチェンジ",
                lat: 36.7954348,
                lng: 140.7282678,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.7954348, entranceLng: 140.7282678, exitLat: 36.7954996, exitLng: 140.7282704,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「北茨城ＩＣ（常磐自動車道）【入口】」「【出口】」を確認し、NAVITIMEで上り・下りとも入口・出口の存在も確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(36.7954348,140.7282678)、exitLat/Lngを出口(36.7954996,140.7282704)に設定。従来座標(36.819,140.744)から約4.4km修正。"
            },
            {
                order: 18,
                displayName: "いわき勿来IC",
                googleName: "常磐自動車道 いわき勿来インターチェンジ",
                lat: 36.9046227,
                lng: 140.7533887,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.9046227, entranceLng: 140.7533887, exitLat: 36.9047092, exitLng: 140.7533341,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「いわき勿来ＩＣ（常磐自動車道）【入口】」「【出口】」を確認し、上り・下りとも入口・出口の存在も確認したためフルICと判断（1988年開通）。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(36.9046227,140.7533887)、exitLat/Lngを出口(36.9047092,140.7533341)に設定。従来座標(36.906,140.786)から約2.9km修正。"
            },
            {
                order: 19,
                displayName: "いわき湯本IC",
                googleName: "常磐自動車道 いわき湯本インターチェンジ",
                lat: 37.000805,
                lng: 140.8155608,
                entranceSelectable: true, exitSelectable: true, entranceLat: 37.000805, entranceLng: 140.8155608, exitLat: 37.0008083, exitLng: 140.8156662,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「いわき湯本ＩＣ（常磐自動車道）【入口】」「【出口】」を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(37.000805,140.8155608)、exitLat/Lngを出口(37.0008083,140.8156662)に設定。従来座標(37.008,140.828)から約1.9km修正。"
            },
            {
                order: 20,
                displayName: "いわき中央IC",
                googleName: "常磐自動車道 いわき中央インターチェンジ",
                lat: 37.0705934,
                lng: 140.8398687,
                entranceSelectable: true, exitSelectable: true, entranceLat: 37.0705934, entranceLng: 140.8398687, exitLat: 37.0706541, exitLng: 140.8397592,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「いわき中央ＩＣ（常磐自動車道）【入口】」「【出口】」を確認したためフルICと判断（1988年開通、いわき駅・市街地最寄り）。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(37.0705934,140.8398687)、exitLat/Lngを出口(37.0706541,140.8397592)に設定。従来座標(37.067,140.849)から約0.9km修正。"
            }



        ]
    },
    tohoku: {
        label: "東北道方面",
        exits: [
            { order: 1, displayName: "浦和IC", googleName: "東北自動車道 浦和インターチェンジ", lat: 35.882906, lng: 139.7271844,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.882906, entranceLng: 139.7271844, exitLat: 35.8811945, exitLng: 139.7282741,
                note: "【2026-07-17調査・座標新規追加】従来lat/lng等の座標フィールドが一切未設定だったため新規確定。MapFan「浦和ＩＣ【入口（上り）】」(35.882906,139.7271844)「【出口（下り）】」(35.8811945,139.7282741)を確認。Wikipedia「浦和インターチェンジ」によると、1980年3月26日の開通当初は宇都宮方面のみのハーフICだったが、2002年3月17日に東京方面出入口が新設されフルIC化。現在はフルIC。entranceSelectable/exitSelectableは変更なし（trueのまま）。"
            },
            { order: 2, displayName: "岩槻IC", googleName: "東北自動車道 岩槻インターチェンジ", lat: 35.9385148, lng: 139.6868336,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.9385148, entranceLng: 139.6868336, exitLat: 35.938452, exitLng: 139.6867595,
                note: "【2026-07-17調査・座標新規追加】従来lat/lng等の座標フィールドが一切未設定だったため新規確定。MapFan「岩槻ＩＣ【入口】」(35.9385148,139.6868336)「【出口】」(35.938452,139.6867595)を確認。入口・出口の個別ページが存在することからフルICと推定（NEXCO公式・Wikipediaに明記なし）。entranceSelectable/exitSelectableは変更なし（trueのまま）。"
            },
            { order: 3, displayName: "蓮田SIC", googleName: "東北自動車道 蓮田スマートインターチェンジ", lat: 35.976823, lng: 139.666489,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.976823, entranceLng: 139.666489, exitLat: 35.9991262, exitLng: 139.6661119,
                note: "【2026-07-17調査・座標新規追加】従来lat/lng等の座標フィールドが一切未設定だったため新規確定。MapFan「蓮田スマートＩＣ【入口（上り）】」(35.976823,139.666489)「【出口（下り）】」(35.9991262,139.6661119)を確認。Wikipedia・NEXCO東日本プレスリリース・蓮田市公式サイトにより、東京方面への入口（上り）・東京方面からの出口（下り）・宇都宮方面からの出口（上り）は供用済みだが、宇都宮方面（下り）への入口は事業中・未開通であることを確認。入口という機能自体は存在するため、entranceSelectable/exitSelectableは変更なし（trueのまま）。"
            },
            { order: 4, displayName: "久喜IC", googleName: "東北自動車道 久喜インターチェンジ", lat: 36.0612399, lng: 139.6567983,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.0612399, entranceLng: 139.6567983, exitLat: 36.0613326, exitLng: 139.6567954,
                note: "【2026-07-17調査・座標新規追加】従来lat/lng等の座標フィールドが一切未設定だったため新規確定。MapFan「久喜ＩＣ【入口】」(36.0612399,139.6567983)「【出口】」(36.0613326,139.6567954)を確認。入口・出口の個別ページが存在することからフルICと推定（NEXCO公式・Wikipediaに明記なし）。keno側の久喜白岡JCT（座標36.049,139.658、約1.3km離れた別施設）とは混同ではないことを確認済み。entranceSelectable/exitSelectableは変更なし（trueのまま）。"
            },
            { order: 5, displayName: "加須IC", googleName: "東北自動車道 加須インターチェンジ", lat: 36.1271446, lng: 139.6318021,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.1271446, entranceLng: 139.6318021, exitLat: 36.1272656, exitLng: 139.6315307,
                note: "【2026-07-17調査・座標新規追加】従来lat/lng等の座標フィールドが一切未設定だったため新規確定。MapFan「加須ＩＣ【入口】」(36.1271446,139.6318021)「【出口】」(36.1272656,139.6315307)を確認。入口・出口の個別ページが存在することからフルICと推定（NEXCO公式・Wikipediaに明記なし）。entranceSelectable/exitSelectableは変更なし（trueのまま）。"
            },
            { order: 6, displayName: "羽生IC", googleName: "東北自動車道 羽生インターチェンジ", lat: 36.1668255, lng: 139.5840919,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.1668255, entranceLng: 139.5840919, exitLat: 36.1667772, exitLng: 139.5841774,
                note: "【2026-07-17調査・座標新規追加】従来lat/lng等の座標フィールドが一切未設定だったため新規確定。MapFan「羽生ＩＣ【入口】」(36.1668255,139.5840919)「【出口】」(36.1667772,139.5841774)を確認。入口・出口の個別ページが存在することからフルICと推定（NEXCO公式・Wikipediaに明記なし）。entranceSelectable/exitSelectableは変更なし（trueのまま）。"
            },
            { order: 7, displayName: "館林IC", googleName: "東北自動車道 館林インターチェンジ", lat: 36.2273545, lng: 139.5741615,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.2273545, entranceLng: 139.5741615, exitLat: 36.227488299431, exitLng: 139.57386181402,
                note: "【2026-07-17調査・座標新規追加】従来lat/lng等の座標フィールドが一切未設定だったため新規確定。MapFan「館林ＩＣ【入口】」(36.2273545,139.5741615)「【出口】」(36.227488299431,139.57386181402)を確認。入口・出口の個別ページが存在することからフルICと推定（NEXCO公式・Wikipediaに明記なし）。entranceSelectable/exitSelectableは変更なし（trueのまま）。"
            },
            { order: 8, displayName: "佐野藤岡IC", googleName: "東北自動車道 佐野藤岡インターチェンジ", lat: 36.2941087, lng: 139.6158843,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.2941087, entranceLng: 139.6158843, exitLat: 36.2941087, exitLng: 139.6158843,
                note: "【2026-07-17調査・座標新規追加】従来lat/lng等の座標フィールドが一切未設定だったため新規確定。MapFan「佐野藤岡ＩＣ【出口】」(36.2941087,139.6158843)を確認。入口側の個別ページは検索で特定できなかったため、entranceLat/Lng・exitLat/Lngとも出口座標を暫定使用した。入口・出口いずれかの個別ページが存在することからフルICと推定（NEXCO公式・Wikipediaに明記なし）。entranceSelectable/exitSelectableは変更なし（trueのまま）。次回、入口の個別座標が確認できた場合は再検証が必要。"
            },
            { order: 9, displayName: "栃木IC", googleName: "東北自動車道 栃木インターチェンジ", lat: 36.4027283, lng: 139.7120006,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.4027283, entranceLng: 139.7120006, exitLat: 36.4028591, exitLng: 139.7116076,
                note: "【2026-07-17調査・座標新規追加】従来lat/lng等の座標フィールドが一切未設定だったため新規確定。MapFan「栃木ＩＣ【入口】」(36.4027283,139.7120006)「【出口】」(36.4028591,139.7116076)を確認。入口・出口の個別ページが存在することからフルICと推定（NEXCO公式・Wikipediaに明記なし）。entranceSelectable/exitSelectableは変更なし（trueのまま）。"
            },
            { order: 10, displayName: "鹿沼IC", googleName: "東北自動車道 鹿沼インターチェンジ", lat: 36.5354901, lng: 139.8023191,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.5354901, entranceLng: 139.8023191, exitLat: 36.5355532, exitLng: 139.8024622,
                note: "【2026-07-17調査・座標新規追加】従来lat/lng等の座標フィールドが一切未設定だったため新規確定。MapFan「鹿沼ＩＣ【入口】」(36.5354901,139.8023191)「【出口】」(36.5355532,139.8024622)を確認。入口・出口の個別ページが存在することからフルICと推定（NEXCO公式・Wikipediaに明記なし）。entranceSelectable/exitSelectableは変更なし（trueのまま）。"
            },
            { order: 11, displayName: "宇都宮IC", googleName: "東北自動車道 宇都宮インターチェンジ", lat: 36.6344803, lng: 139.8451272,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.6344803, entranceLng: 139.8451272, exitLat: 36.6344704, exitLng: 139.844862,
                note: "【2026-07-17調査・座標新規追加】従来lat/lng等の座標フィールドが一切未設定だったため新規確定。MapFan「宇都宮ＩＣ【入口】」(36.6344803,139.8451272)「【出口】」(36.6344704,139.844862)を確認。入口・出口の個別ページが存在することからフルICと推定（NEXCO公式・Wikipediaに明記なし）。日光宇都宮道路との接続点でもある複合IC構造だが、今回は東北自動車道側の座標追加のみで複合IC化は対象外。entranceSelectable/exitSelectableは変更なし（trueのまま）。"
            },
            { order: 11.5, displayName: "上河内SIC", googleName: "東北自動車道 上河内スマートインターチェンジ", lat: 36.6917388, lng: 139.8929558,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.6917388, entranceLng: 139.8929558, exitLat: 36.6917908, exitLng: 139.8929707,
                note: "【2026-07-17調査・座標新規追加】前回の矢板IC〜郡山JCT追加時に対象漏れがあったため追加。宇都宮IC(103.0km)と矢板IC(120.2km)の間、起点から約110.9kmに位置。MapFan「上河内スマートＩＣ【入口（上り）】」(36.6917388,139.8929558)「【出口（上り）】」(36.6917908,139.8929707)を確認。Wikipediaによると2007年4月1日にハーフIC本格運用開始、2010年12月18日に福島方面が新設されフルIC化。entranceSelectable/exitSelectableはtrueとした。"
            },
            { order: 12, displayName: "矢板IC", googleName: "東北自動車道 矢板インターチェンジ", lat: 36.7622164, lng: 139.9374504,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.7622164, entranceLng: 139.9374504, exitLat: 36.7622977, exitLng: 139.9374867,
                note: "【2026-07-17調査・座標新規追加】新規区間（宇都宮IC以降〜郡山）のため新規追加。MapFan「矢板ＩＣ【入口】」(36.7622164,139.9374504)「【出口】」(36.7622977,139.9374867)を確認。Wikipedia「矢板インターチェンジ」に上下線双方向の記載あり、方向制限の明記なし。フルICと推定。1973年8月9日開通。entranceSelectable/exitSelectableはtrueとした。"
            },
            { order: 13, displayName: "矢板北SIC", googleName: "東北自動車道 矢板北スマートインターチェンジ", lat: 36.8229749, lng: 139.9104147,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.8229749, entranceLng: 139.9104147, exitLat: 36.8229749, exitLng: 139.9104147,
                note: "【2026-07-17調査・座標新規追加】新規区間のため新規追加。MapFan「矢板北スマートＩＣ【入口（上り）】」(36.8229749,139.9104147)を確認。下り側の個別座標は検索で特定できなかったため、entranceLat/Lng・exitLat/Lngとも入口(上り)座標を暫定使用した。Wikipediaに「上下線ともに出入可」と明記されておりフルIC。2021年3月28日開通。entranceSelectable/exitSelectableはtrueとした。次回、下り側の個別座標が確認できた場合は再検証が必要。"
            },
            { order: 14, displayName: "西那須野塩原IC", googleName: "東北自動車道 西那須野塩原インターチェンジ", lat: 36.9161066, lng: 139.9406269,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.9161066, entranceLng: 139.9406269, exitLat: 36.9161066, exitLng: 139.9406269,
                note: "【2026-07-17調査・座標新規追加】新規区間のため新規追加。MapFan「西那須野塩原ＩＣ【入口】」(36.9161066,139.9406269)を確認。出口の個別ページは検索で特定できなかったため、entranceLat/Lng・exitLat/Lngとも入口座標を暫定使用した。フルICと推定（NEXCO公式・Wikipediaに明記なし）。1974年12月20日開通。entranceSelectable/exitSelectableはtrueとした。次回、出口の個別座標が確認できた場合は再検証が必要。"
            },
            { order: 15, displayName: "黒磯板室IC", googleName: "東北自動車道 黒磯板室インターチェンジ", lat: 36.962049, lng: 139.9854459,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.962049, entranceLng: 139.9854459, exitLat: 36.962071, exitLng: 139.985313,
                note: "【2026-07-17調査・座標新規追加】新規区間のため新規追加。MapFan「黒磯板室ＩＣ【入口】」(36.962049,139.9854459)「【出口】」(36.962071,139.985313)を確認。フルICと推定（NEXCO公式・Wikipediaに明記なし）。2009年3月29日開通、信号機付き平面交差構造。Wikipediaによると2025年4月26日にY字交差点での進路誤認による逆走多重事故（死亡3人・重傷2人・軽傷8人、計13人死傷）が発生し、2025年6月に矢印信号機・指定方向外通行禁止標識の大型化等の安全対策が実施された。entranceSelectable/exitSelectableは変更せずtrueとした。"
            },
            { order: 16, displayName: "那須IC", googleName: "東北自動車道 那須インターチェンジ", lat: 37.0024635, lng: 140.0382438,
                entranceSelectable: true, exitSelectable: true, entranceLat: 37.0024635, entranceLng: 140.0382438, exitLat: 37.0024199, exitLng: 140.0383253,
                note: "【2026-07-17調査・座標新規追加】新規区間のため新規追加。MapFan「那須ＩＣ【入口】」(37.0024635,140.0382438)「【出口】」(37.0024199,140.0383253)を確認。フルICと推定（NEXCO公式・Wikipediaに明記なし）。1974年12月20日開通。entranceSelectable/exitSelectableはtrueとした。"
            },
            { order: 17, displayName: "那須高原SIC", googleName: "東北自動車道 那須高原スマートインターチェンジ", lat: 37.0547427, lng: 140.1004103,
                entranceSelectable: true, exitSelectable: true, entranceLat: 37.0547427, entranceLng: 140.1004103, exitLat: 37.0567907, exitLng: 140.0983925,
                note: "【2026-07-17調査・座標新規追加】新規区間のため新規追加。MapFan「那須高原スマートＩＣ【入口（上り）】」(37.0547427,140.1004103)「【出口（下り）】」(37.0567907,140.0983925)を確認。Wikipediaによると2006年にハーフIC運用開始、2010年12月18日に福島方面が新設されフルIC化。entranceSelectable/exitSelectableはtrueとした。"
            },
            { order: 18, displayName: "白河IC", googleName: "東北自動車道 白河インターチェンジ", lat: 37.121053, lng: 140.163775,
                entranceSelectable: true, exitSelectable: true, entranceLat: 37.121053, entranceLng: 140.163775, exitLat: 37.121053, exitLng: 140.163775,
                note: "【2026-07-17調査・座標新規追加】新規区間のため新規追加。MapFan「白河ＩＣ【入口】」(37.121053,140.163775)を確認。出口の個別ページは検索で特定できなかったため、entranceLat/Lng・exitLat/Lngとも入口座標を暫定使用した。フルICと推定（NEXCO公式・Wikipediaに明記なし）。1973年11月26日開通。entranceSelectable/exitSelectableはtrueとした。次回、出口の個別座標が確認できた場合は再検証が必要。"
            },
            { order: 19, displayName: "白河中央SIC", googleName: "東北自動車道 白河中央スマートインターチェンジ", lat: 37.1457539, lng: 140.2184747,
                entranceSelectable: true, exitSelectable: true, entranceLat: 37.1457539, entranceLng: 140.2184747, exitLat: 37.1456825, exitLng: 140.2184647,
                note: "【2026-07-17調査・座標新規追加】新規区間のため新規追加。MapFan「白河中央スマートＩＣ【入口（上り）】」(37.1457539,140.2184747)「【出口（上り）】」(37.1456825,140.2184647)を確認。Wikipediaにより「全国初」の両方向流入流出型本線直結スマートICと明記されておりフルIC。2009年8月8日開通。entranceSelectable/exitSelectableはtrueとした。"
            },
            { order: 20, displayName: "矢吹IC", googleName: "東北自動車道 矢吹インターチェンジ", lat: 37.193502, lng: 140.29893850953,
                entranceSelectable: true, exitSelectable: true, entranceLat: 37.193502, entranceLng: 140.29893850953, exitLat: 37.193502, exitLng: 140.29893850953,
                note: "【2026-07-17調査・座標新規追加】新規区間のため新規追加。MapFan「矢吹ＩＣ【出口】」(37.193502,140.29893850953)を確認。入口の個別ページは検索で存在を確認したがアクセス時に404となり座標を取得できなかったため、entranceLat/Lng・exitLat/Lngとも出口座標を暫定使用した。フルICと推定（NEXCO公式・Wikipediaに明記なし）。1973年11月26日開通、あぶくま高原道路と接続。entranceSelectable/exitSelectableはtrueとした。次回、入口の個別座標が確認できた場合は再検証が必要。"
            },
            { order: 21, displayName: "鏡石SIC", googleName: "東北自動車道 鏡石スマートインターチェンジ", lat: 37.2550158, lng: 140.3358209,
                entranceSelectable: true, exitSelectable: true, entranceLat: 37.2550158, entranceLng: 140.3358209, exitLat: 37.2550158, exitLng: 140.3358209,
                note: "【2026-07-17調査・座標新規追加】新規区間のため新規追加。MapFan「鏡石スマートＩＣ【入口（上り）】」(37.2550158,140.3358209)を確認。出口の個別ページは検索で特定できなかったため、entranceLat/Lng・exitLat/Lngとも入口座標を暫定使用した。各種情報源で「利用可能方向：全方向」と明記されておりフルIC。2009年4月1日開通。entranceSelectable/exitSelectableはtrueとした。次回、出口の個別座標が確認できた場合は再検証が必要。"
            },
            { order: 22, displayName: "須賀川IC", googleName: "東北自動車道 須賀川インターチェンジ", lat: 37.2918561, lng: 140.3550815,
                entranceSelectable: true, exitSelectable: true, entranceLat: 37.2918561, entranceLng: 140.3550815, exitLat: 37.2919156, exitLng: 140.3551178,
                note: "【2026-07-17調査・座標新規追加】新規区間のため新規追加。MapFan「須賀川ＩＣ【入口】」(37.2918561,140.3550815)「【出口】」(37.2919156,140.3551178)を確認。フルICと推定（NEXCO公式・Wikipediaに明記なし）。entranceSelectable/exitSelectableはtrueとした。"
            },
            { order: 23, displayName: "郡山南IC", googleName: "東北自動車道 郡山南インターチェンジ", lat: 37.3623208, lng: 140.3140083,
                entranceSelectable: true, exitSelectable: true, entranceLat: 37.3623208, entranceLng: 140.3140083, exitLat: 37.3623508, exitLng: 140.3141053,
                note: "【2026-07-17調査・座標新規追加】新規区間のため新規追加。MapFan「郡山南ＩＣ【入口】」(37.3623208,140.3140083)「【出口】」(37.3623508,140.3141053)を確認。フルICと推定（NEXCO公式・Wikipediaに明記なし）。entranceSelectable/exitSelectableはtrueとした。"
            },
            { order: 24, displayName: "郡山中央SIC", googleName: "東北自動車道 郡山中央スマートインターチェンジ", lat: 37.4021063, lng: 140.3137506,
                entranceSelectable: true, exitSelectable: true, entranceLat: 37.4021063, entranceLng: 140.3137506, exitLat: 37.4021063, exitLng: 140.3137506,
                note: "【2026-07-17調査・座標新規追加】新規区間のため新規追加。MapFan「郡山中央スマートＩＣ【入口（上り）】」(37.4021063,140.3137506)を確認。出口の個別ページは検索で特定できなかったため、entranceLat/Lng・exitLat/Lngとも入口座標を暫定使用した。各種情報源で「上下線ともに出入可」と明記されておりフルIC。2019年1月13日開通。entranceSelectable/exitSelectableはtrueとした。次回、出口の個別座標が確認できた場合は再検証が必要。"
            },
            { order: 25, displayName: "郡山IC", googleName: "東北自動車道 郡山インターチェンジ", lat: 37.4325478, lng: 140.3442763,
                entranceSelectable: true, exitSelectable: true, entranceLat: 37.4325478, entranceLng: 140.3442763, exitLat: 37.4320455, exitLng: 140.3448456,
                note: "【2026-07-17調査・座標新規追加】新規区間のため新規追加。MapFan「郡山ＩＣ【入口】」(37.4325478,140.3442763)「【出口】」(37.4320455,140.3448456)を確認。フルICと推定（NEXCO公式・Wikipediaに明記なし）。1973年11月26日開通、郡山JCTの3.8km手前に位置。entranceSelectable/exitSelectableはtrueとした。"
            },
            { order: 26, displayName: "郡山JCT", googleName: "東北自動車道 郡山ジャンクション", lat: 37.4685207, lng: 140.3612396,
                isSelectable: false,
                connectedRoads: ["tohoku"],
                entranceSelectable: false, exitSelectable: false, entranceLat: 37.4685207, entranceLng: 140.3612396, exitLat: 37.4685207, exitLng: 140.3612396,
                note: "【2026-07-17調査・新規追加】東北自動車道(E4)と磐越自動車道(E49)を接続するダブルトランペット型JCT（1990年10月31日会津若松・新潟方面、1995年8月いわき方面の2段階開通、Wikipedia確認）。座標はMapFan「郡山JCT【仙台方面】」(37.4685207,140.3612396)を採用したが、他情報源では中心点として37.46604912,140.35740976や37.462735,140.360137という値もあり、情報源間で最大約700m程度のばらつきがある。ダブルトランペット型のため代表点の取り方は要再検討。磐越自動車道はIC_MASTERに未登録のため、connectedRoadsは現状tohokuのみとし、磐越道エリア新設時に追記する。isSelectable/entranceSelectable/exitSelectableはfalseで登録（八王子JCT・鶴ヶ島JCT・久喜白岡JCTと同じパターン）。"
            }
        ]
    },
    kanetsu: {
        label: "関越道方面",
        exits: [
            { order: 1, displayName: "練馬IC", googleName: "関越自動車道 練馬インターチェンジ", lat: 35.754366, lng: 139.607664,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.754366, entranceLng: 139.607664, exitLat: 35.754593, exitLng: 139.607672,
                note: "【2026-07-17調査・座標のみ修正】MapFan「練馬ＩＣ【入口】」(35.754366,139.607664)「【出口】」(35.754593,139.607672)を確認。関越自動車道起点特有の構造で、外環道・首都高への直結はなくフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(35.753,139.605)から約284m修正。"
            },
            { order: 2, displayName: "大泉IC", googleName: "関越自動車道 大泉インターチェンジ", lat: 35.757305, lng: 139.598116,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.757305, entranceLng: 139.598116, exitLat: 35.757305, exitLng: 139.598116,
                note: "【2026-07-17調査・構造修正】Wikipedia「大泉インターチェンジ」「関越自動車道」「練馬インターチェンジ」の複数記事で、関越道側は新潟方面への下り入口のみで出口は実在せず、練馬方面への出場は練馬ICを利用する構造（クォーターIC）であることを確認。exitSelectableをtrueからfalseに変更。座標はMapFan「大泉ＩＣ（関越自動車道）【入口（下り）】」(35.757305,139.598116)の実測値に統一。従来座標(35.771,139.587)から約1.8km修正。"
            },
            { order: 3, displayName: "所沢IC", googleName: "関越自動車道 所沢インターチェンジ", lat: 35.809309, lng: 139.532881,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.809309, entranceLng: 139.532881, exitLat: 35.809564, exitLng: 139.532658,
                note: "【2026-07-17調査・座標のみ修正】MapFan「所沢ＩＣ【入口】」(35.809309,139.532881)「【出口】」(35.809564,139.532658)を確認。フルIC（推定）。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(35.801,139.498)から約3.3km修正。"
            },
            { order: 4, displayName: "三芳SIC", googleName: "関越自動車道 三芳スマートインターチェンジ", lat: 35.843881, lng: 139.505918,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.843881, entranceLng: 139.505918, exitLat: 35.8398432, exitLng: 139.5020565,
                note: "【2026-07-15調査・座標のみ修正】関越自動車道で最も東京寄りのスマートIC。NEXCO東日本プレスリリースで、過去約9年間は新潟方面（下り）のみのハーフICだったが、2024年3月10日15時に東京方面（上り入口・下り出口）が開通し現在はフルICであることを確認。entranceSelectable/exitSelectableは現状（フルIC）と一致しているため変更なし（trueのまま）。座標はentranceLat/Lngを入口(上り)(35.843881,139.505918)、exitLat/Lngを出口(下り)(35.8398432,139.5020565)に設定。従来座標(35.843,139.518)から約1,094m修正。"
            },
            { order: 5, displayName: "川越IC", googleName: "関越自動車道 川越インターチェンジ", lat: 35.895486, lng: 139.461244,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.895486, entranceLng: 139.461244, exitLat: 35.895627, exitLng: 139.461080,
                note: "【2026-07-17調査・座標のみ修正】MapFan「川越ＩＣ【入口】」(35.895486,139.461244)「【出口】」(35.895627,139.461080)を確認。1975年フルIC化が明記されているフルIC。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(35.907,139.483)から約2.3km修正。"
            },
            { order: 6, displayName: "鶴ヶ島IC", googleName: "関越自動車道 鶴ヶ島インターチェンジ", lat: 35.948679, lng: 139.397728,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.948679, entranceLng: 139.397728, exitLat: 35.948535, exitLng: 139.397649,
                note: "【2026-07-17調査・座標のみ修正】MapFan「鶴ヶ島ＩＣ【入口】」(35.948679,139.397728)「【出口】」(35.948535,139.397649)を確認。フルIC（推定）。kenoエリアの圏央鶴ヶ島IC・鶴ヶ島JCTとは別施設（Wikipedia確認済み、混同ではない）。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(35.944,139.394)から約617m修正。"
            },
            { order: 7, displayName: "坂戸西SIC", googleName: "関越自動車道 坂戸西スマートインターチェンジ", lat: 35.9662598, lng: 139.3780673,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.9662598, entranceLng: 139.3780673, exitLat: 35.9662598, exitLng: 139.3780673,
                note: "【2026-07-15調査・座標のみ修正】2013年8月25日開通。WebSearchで「上下線ともに全方向対応、上り・下りで別々の入口・出口を持つフルインター」と確認（坂戸市公式サイトも確認）。entranceSelectable/exitSelectableは変更なし（trueのまま）。MapFanで【出口（下り）】(35.9662598,139.3780673)は座標を確認できたが、【入口（上り）】は個別ページが404エラーとなり座標を確認できなかったため、entranceLat/Lng・exitLat/Lngとも出口(下り)の座標を暫定使用した。従来座標(35.971,139.356)から約2,059m修正。次回、入口(上り)の個別座標が確認できた場合は再検証が必要。"
            },
            { order: 8, displayName: "東松山IC", googleName: "関越自動車道 東松山インターチェンジ", lat: 36.027854, lng: 139.384124,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.027854, entranceLng: 139.384124, exitLat: 36.028097, exitLng: 139.384236,
                note: "【2026-07-17調査・座標のみ修正】MapFan「東松山ＩＣ【入口】」(36.027854,139.384124)「【出口】」(36.028097,139.384236)を確認。1980年フルIC化が明記されているフルIC。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(36.036,139.377)から約1.1km修正。"
            },
            { order: 9, displayName: "嵐山小川IC", googleName: "関越自動車道 嵐山小川インターチェンジ", lat: 36.067373, lng: 139.308421,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.067373, entranceLng: 139.308421, exitLat: 36.067297, exitLng: 139.308352,
                note: "【2026-07-17調査・座標のみ修正】MapFan「嵐山小川ＩＣ【入口】」(36.067373,139.308421)「【出口】」(36.067297,139.308352)を確認。フルIC（推定）。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(36.060,139.300)から約1.1km修正。"
            },
            { order: 10, displayName: "花園IC", googleName: "関越自動車道 花園インターチェンジ", lat: 36.122711, lng: 139.246134,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.122711, entranceLng: 139.246134, exitLat: 36.122596, exitLng: 139.246210,
                note: "【2026-07-17調査・座標のみ修正】MapFan「花園ＩＣ【入口】」(36.122711,139.246134)「【出口】」(36.122596,139.246210)を確認。フルIC（推定）。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(36.115,139.214)から約3.0km修正。"
            },
            { order: 10.5, displayName: "寄居SIC", googleName: "関越自動車道 寄居スマートインターチェンジ", lat: 36.172622, lng: 139.196341,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.172622, entranceLng: 139.196341, exitLat: 36.17379647716, exitLng: 139.1913859715,
                note: "【2026-07-15調査・座標のみ修正】下り線が2019年3月28日、上り線が2021年3月28日と段階的に開通し、現在は上下線とも出入口を持つ全方向スマートICであることをNEXCO東日本プレスリリース等で確認。entranceSelectable/exitSelectableは変更なし（trueのまま）。MapFanで入口（上り・下り）・出口（上り・下り）の4個別ページ全ての存在を確認。座標はentranceLat/Lngを入口(上り)(36.172622,139.196341)、exitLat/Lngを出口(下り)(36.17379647716,139.1913859715)に設定。従来座標(36.173,139.194)から約214m修正。"
            },
            { order: 11, displayName: "本庄児玉IC", googleName: "関越自動車道 本庄児玉インターチェンジ", lat: 36.221953, lng: 139.165558,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.221953, entranceLng: 139.165558, exitLat: 36.221952, exitLng: 139.165363,
                note: "【2026-07-17調査・座標のみ修正】MapFan「本庄児玉ＩＣ【入口】」(36.221953,139.165558)「【出口】」(36.221952,139.165363)を確認。フルIC（推定）。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(36.223,139.152)から約1.2km修正。"
            },
            { order: 11.5, displayName: "上里SIC", googleName: "関越自動車道 上里スマートインターチェンジ", lat: 36.2566705, lng: 139.1171445,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.2566705, entranceLng: 139.1171445, exitLat: 36.255604, exitLng: 139.116856,
                note: "【2026-07-15調査・座標のみ修正】上里SA併設。MapFanで入口（上り・下り）・出口（下り）のページの存在を確認し、フルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(上り)(36.2566705,139.1171445)、exitLat/Lngを出口(下り)(36.255604,139.116856)に設定。従来座標(36.256,139.119)から約183m修正。"
            },
            { order: 12, displayName: "高崎玉村SIC", googleName: "関越自動車道 高崎玉村スマートインターチェンジ", lat: 36.3087809, lng: 139.0938883,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.3087809, entranceLng: 139.0938883, exitLat: 36.3086123, exitLng: 139.0871443,
                note: "【2026-07-15調査・座標のみ修正】群馬県内スマートICで初の本線直結型。WebSearchで「上り線と下り線に入口・出口がそれぞれある、全方向対応」と確認（高崎市公式サイトの設置位置図も確認）。entranceSelectable/exitSelectableは変更なし（trueのまま）。MapFanで入口（上り・下り）・出口（上り・下り）の4個別ページ全ての存在を確認。座標はentranceLat/Lngを入口(上り)(36.3087809,139.0938883)、exitLat/Lngを出口(下り)(36.3086123,139.0871443)に設定。従来座標(36.284,139.101)は実測値から約2.83km離れていたため、大幅な修正となった。"
            },
            { order: 13, displayName: "高崎IC", googleName: "関越自動車道 高崎インターチェンジ", lat: 36.3401779, lng: 139.0594012,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.3401779, entranceLng: 139.0594012, exitLat: 36.3402546, exitLng: 139.0590909,
                note: "【2026-07-17調査・構造修正】関越道と上信越道の実際の接続点は藤岡JCT（現状IC_MASTER未登録）であり、当ICは藤岡JCTから約2.4km離れた単独路線のICであるため、connection/connectedRoadsを削除した。藤岡JCTの新規登録は別途座標調査のうえ検討する。なお、座標もMapFan実測値（entrance 36.3401779,139.0594012／exit 36.3402546,139.0590909）に修正した。従来座標(36.308,139.063)から約3.6km修正。"
            },
            { order: 14, displayName: "前橋IC", googleName: "関越自動車道 前橋インターチェンジ", lat: 36.3759397, lng: 139.0303,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.3759397, entranceLng: 139.0303, exitLat: 36.3760967, exitLng: 139.0302083,
                note: "【2026-07-17調査・座標のみ修正】MapFan「前橋ＩＣ【入口】」(36.3759397,139.0303)「【出口】」(36.3760967,139.0302083)を確認。フルIC（明記あり）。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(36.384,139.055)から約2.4km修正。"
            },
            { order: 15, displayName: "駒寄SIC", googleName: "関越自動車道 駒寄スマートインターチェンジ", lat: 36.4307719, lng: 139.0161246,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.4307719, entranceLng: 139.0161246, exitLat: 36.4307719, exitLng: 139.0161246,
                note: "【2026-07-15調査・座標のみ修正】駒寄PA併設。WebSearchで「上下線ともに全方向対応、24時間利用可能」と確認。「上り線の駒寄PAを利用した後は駒寄スマートIC出口は利用できない。下り線の駒寄スマートIC入口から駒寄PAの利用はできない」という運用上の注意点はあるが、entranceSelectable/exitSelectable判定には影響しない。entranceSelectable/exitSelectableは変更なし（trueのまま）。MapFanで【入口（上り）】(36.4307719,139.0161246)は座標を確認できたが、【出口（下り）】は座標を確認できなかったため、entranceLat/Lng・exitLat/Lngとも入口(上り)の座標を暫定使用した。従来座標(36.441,139.010)から約1,263m修正。次回、出口(下り)の個別座標が確認できた場合は再検証が必要。"
            },
            { order: 16, displayName: "渋川伊香保IC", googleName: "関越自動車道 渋川伊香保インターチェンジ", lat: 36.4774907, lng: 139.0159981,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.4774907, entranceLng: 139.0159981, exitLat: 36.4776356, exitLng: 139.0159232,
                note: "【2026-07-17調査・座標のみ修正】MapFan「渋川伊香保ＩＣ【入口】」(36.4774907,139.0159981)「【出口】」(36.4776356,139.0159232)を確認。フルIC（明記あり）。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(36.493,139.007)から約1.9km修正。"
            },
            { order: 17, displayName: "赤城IC", googleName: "関越自動車道 赤城インターチェンジ", lat: 36.5385722, lng: 139.0492941,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.5385722, entranceLng: 139.0492941, exitLat: 36.5385722, exitLng: 139.0492941,
                note: "【2026-07-17調査・座標のみ修正】MapFan「赤城ＩＣ【入口】」(36.5385722,139.0492941)を確認。未確認（推定フル）。出口側の個別ページは未特定のため、entranceLat/Lng・exitLat/Lngとも入口側の座標を暫定使用した。従来座標(36.558,139.069)から約2.8km修正。次回、出口側の個別座標が確認できた場合は再検証が必要。"
            },
            { order: 18, displayName: "昭和IC", googleName: "関越自動車道 昭和インターチェンジ", lat: 36.6127896, lng: 139.0665319,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.6127896, entranceLng: 139.0665319, exitLat: 36.6127728, exitLng: 139.0666025,
                note: "【2026-07-17調査・座標のみ修正】MapFan「昭和ＩＣ【入口】」(36.6127896,139.0665319)「【出口】」(36.6127728,139.0666025)を確認。「開発IC」区分のみでフルIC/ハーフICの明記なし（未確認）。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(36.634,139.101)から約3.9km修正。"
            },
            { order: 19, displayName: "沼田IC", googleName: "関越自動車道 沼田インターチェンジ", lat: 36.6542705, lng: 139.0707428,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.6542705, entranceLng: 139.0707428, exitLat: 36.654136, exitLng: 139.0710797,
                note: "【2026-07-17調査・座標のみ修正】MapFan「沼田ＩＣ【入口】」(36.6542705,139.0707428)「【出口】」(36.654136,139.0710797)を確認。4方向ランプありのフルIC。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(36.663,139.036)から約3.3km修正。"
            },
            { order: 20, displayName: "月夜野IC", googleName: "関越自動車道 月夜野インターチェンジ", lat: 36.6723943, lng: 139.0067096,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.6723943, entranceLng: 139.0067096, exitLat: 36.6723614, exitLng: 139.0067789,
                note: "【2026-07-17調査・座標のみ修正】MapFan「月夜野ＩＣ【入口】」(36.6723943,139.0067096)「【出口】」(36.6723614,139.0067789)を確認。4方向ランプありのフルIC。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(36.748,138.988)から約8.5km修正（今回調査全体で最大、複数情報源一致）。"
            },
            { order: 21, displayName: "水上IC", googleName: "関越自動車道 水上インターチェンジ", lat: 36.7489782, lng: 138.9743213,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.7489782, entranceLng: 138.9743213, exitLat: 36.748893, exitLng: 138.974176,
                note: "【2026-07-17調査・座標のみ修正】MapFan「水上ＩＣ【出口】」(36.748893,138.974176)を確認。4方向ランプありのフルIC（T型信号交差点は構造上の特徴で方向制限ではない）。上り側の個別座標は未確認のため、entranceLat/Lngは出口側に近い座標を暫定使用した。従来座標(36.801,138.964)から約5.8km修正。次回、上り側の個別座標が確認できた場合は再検証が必要。"
            },
            { order: 22, displayName: "藤岡IC", googleName: "上信越自動車道 藤岡インターチェンジ", lat: 36.2710485, lng: 139.0729449,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.2710485, entranceLng: 139.0729449, exitLat: 36.2709647, exitLng: 139.0731461,
                note: "【2026-07-17調査・構造修正】関越道と上信越道の実際の接続点は藤岡JCT（現状IC_MASTER未登録）であり、当ICは藤岡JCTから約1.7km離れた単独路線のICであるため、connection/connectedRoadsを削除した。藤岡JCTの新規登録は別途座標調査のうえ検討する。なお、座標もMapFan実測値（entrance 36.2710485,139.0729449／exit 36.2709647,139.0731461）に修正した。従来座標(36.269,139.074)から約246m修正。"
            }
        ]
    },

    joshinetsu: {
        label: "上信越道方面",
        exits: [
            { order: 0, displayName: "高崎IC", googleName: "関越自動車道 高崎インターチェンジ", lat: 36.3401779, lng: 139.0594012,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.3401779, entranceLng: 139.0594012, exitLat: 36.3402546, exitLng: 139.0590909,
                note: "【2026-07-17調査・構造修正】関越道と上信越道の実際の接続点は藤岡JCT（現状IC_MASTER未登録）であり、当ICは藤岡JCTから約2.4km離れた単独路線のICであるため、connection/connectedRoadsを削除した。藤岡JCTの新規登録は別途座標調査のうえ検討する。なお、座標もMapFan実測値（entrance 36.3401779,139.0594012／exit 36.3402546,139.0590909）に修正した。従来座標(36.308,139.063)から約3.6km修正。"
            },
            { order: 1, displayName: "藤岡IC", googleName: "上信越自動車道 藤岡インターチェンジ", lat: 36.2710485, lng: 139.0729449,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.2710485, entranceLng: 139.0729449, exitLat: 36.2709647, exitLng: 139.0731461,
                note: "【2026-07-17調査・構造修正】関越道と上信越道の実際の接続点は藤岡JCT（現状IC_MASTER未登録）であり、当ICは藤岡JCTから約1.7km離れた単独路線のICであるため、connection/connectedRoadsを削除した。藤岡JCTの新規登録は別途座標調査のうえ検討する。なお、座標もMapFan実測値（entrance 36.2710485,139.0729449／exit 36.2709647,139.0731461）に修正した。従来座標(36.269,139.074)から約246m修正。"
            },
            { order: 2, displayName: "吉井IC", googleName: "上信越自動車道 吉井インターチェンジ", lat: 36.2459409, lng: 138.9933904,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.2459409, entranceLng: 138.9933904, exitLat: 36.2459423, exitLng: 138.9933199,
                note: "【2026-07-17調査・座標のみ修正】MapFan「吉井ＩＣ【入口】」(36.2459409,138.9933904)「【出口】」(36.2459423,138.9933199)を確認。フルIC（明記あり）。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(36.250,138.986)から約0.8km修正。"
            },
            { order: 2.5, displayName: "甘楽SIC", googleName: "上信越自動車道 甘楽スマートインターチェンジ", lat: 36.2431847, lng: 138.9458636,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.2431847, entranceLng: 138.9458636, exitLat: 36.2431847, exitLng: 138.9458636,
                note: "【2026-07-15調査・座標のみ修正】2023年3月25日開通。「環道型退出路」という新しい退出路設計を採用。WebSearchで「上下線ともに24時間利用可能」と確認。「下り線（上越方面）はPA利用後にSIC流出可能だがSIC流入時はPA利用不可、上り線（藤岡方面）は逆」という運用上の注意点はあるが、entranceSelectable/exitSelectable判定には影響しない。entranceSelectable/exitSelectableは変更なし（trueのまま）。MapFanで【入口（上り）】(36.2431847,138.9458636)は座標を確認できたが、【出口（下り）】は座標を確認できなかったため、entranceLat/Lng・exitLat/Lngとも入口(上り)の座標を暫定使用した。従来座標(36.242,138.946)から約133m修正。次回、出口(下り)の個別座標が確認できた場合は再検証が必要。"
            },
            { order: 3, displayName: "富岡IC", googleName: "上信越自動車道 富岡インターチェンジ", lat: 36.2452702, lng: 138.8940736,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.2452702, entranceLng: 138.8940736, exitLat: 36.2453034, exitLng: 138.8939873,
                note: "【2026-07-17調査・座標のみ修正】MapFan「富岡ＩＣ【入口】」(36.2452702,138.8940736)「【出口】」(36.2453034,138.8939873)を確認。フルIC（明記あり）。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(36.250,138.891)から約0.6km修正。"
            },
            { order: 4, displayName: "下仁田IC", googleName: "上信越自動車道 下仁田インターチェンジ", lat: 36.2324897, lng: 138.8212371,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.2324897, entranceLng: 138.8212371, exitLat: 36.2324335, exitLng: 138.821199,
                note: "【2026-07-17調査・座標のみ修正】MapFan「下仁田ＩＣ【入口】」(36.2324897,138.8212371)「【出口】」(36.2324335,138.821199)を確認。フルIC（明記あり）。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(36.210,138.774)から約4.9km修正。"
            },
            { order: 5, displayName: "松井田妙義IC", googleName: "上信越自動車道 松井田妙義インターチェンジ", lat: 36.3146133, lng: 138.7722971,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.3146133, entranceLng: 138.7722971, exitLat: 36.3145362, exitLng: 138.7723227,
                note: "【2026-07-17調査・座標のみ修正】MapFan「松井田妙義ＩＣ【入口】」(36.3146133,138.7722971)「【出口】」(36.3145362,138.7723227)を確認。未確認（推定フル）。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(36.309,138.733)から約3.6km修正。"
            },
            { order: 6, displayName: "碓氷軽井沢IC", googleName: "上信越自動車道 碓氷軽井沢インターチェンジ", lat: 36.2989419, lng: 138.6703012,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.2989419, entranceLng: 138.6703012, exitLat: 36.2989419, exitLng: 138.670181,
                note: "【2026-07-17調査・座標のみ修正】MapFan「碓氷軽井沢ＩＣ【入口】」(36.2989419,138.6703012)「【出口】」(36.2989419,138.670181)を確認。未確認（推定フル）。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(36.338,138.640)から約5.1km修正。"
            },
            { order: 7, displayName: "佐久IC", googleName: "上信越自動車道 佐久インターチェンジ", lat: 36.2851623, lng: 138.4804773,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.2851623, entranceLng: 138.4804773, exitLat: 36.2849406, exitLng: 138.4808629,
                note: "【2026-07-17調査・座標のみ修正】MapFan「佐久ＩＣ【入口】」(36.2851623,138.4804773)「【出口】」(36.2849406,138.4808629)を確認。フルIC（明記あり）。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(36.269,138.476)から約1.8km修正。"
            }
        ]
    },

    keno: {
        label: "圏央道方面",
        exits: [
            {
                order: 1,
                displayName: "海老名JCT",
                googleName: "首都圏中央連絡自動車道 海老名ジャンクション",
                lat: 35.422,
                lng: 139.375,
                isSelectable: false,
                connection: true,
                connectedRoads: ["keno", "tomei"],
                routeBranch: "west",
                branchOrder: 1,
                entranceSelectable: false, exitSelectable: false, entranceLat: 35.422, entranceLng: 139.375, exitLat: 35.422, exitLng: 139.375
            },
            {
                order: 2,
                displayName: "圏央厚木IC",
                googleName: "首都圏中央連絡自動車道 圏央厚木インターチェンジ",
                lat: 35.4760372,
                lng: 139.3669842,
                routeBranch: "west",
                branchOrder: 2,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.4760372, entranceLng: 139.3669842, exitLat: 35.4759495, exitLng: 139.3670142,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「圏央厚木ＩＣ（圏央道）【入口】」「【出口】」（方向表記なし、2013年3月30日開通）を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(35.4760372,139.3669842)、exitLat/Lngを出口(35.4759495,139.3670142)に設定。従来座標(35.480,139.372)から約450m修正。"
            },
            {
                order: 3,
                displayName: "厚木PA SIC",
                googleName: "首都圏中央連絡自動車道 厚木PAスマートインターチェンジ",
                lat: 35.4884095,
                lng: 139.3683913,
                routeBranch: "west",
                branchOrder: 3,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.4884095, entranceLng: 139.3683913, exitLat: 35.4884162, exitLng: 139.3684817,
                note: "【2026-07-14調査・座標のみ修正】WebSearchで「出入口方向は全方向で利用可能で、圏央道の内回り・外回りともに出入りが可能。方向制限がなくハーフICではなくフルインターチェンジ」と確認（2020年9月26日供用開始）。MapFanで入口・出口×内回り・外回りの4個別ページ全てを確認。entranceSelectable/exitSelectableは変更なし（trueのまま）。外回り・内回りそれぞれのペア（入口・出口）は約10m以内で同一地点にまとまっているが、外回りクラスターと内回りクラスターは互いに約700m離れている（本線→PA→本線がUターンに近いランプを形成する構造のため）。いずれの方向でも入口・出口とも利用可能なため機能上の差はないが、代表座標として外回り側を採用した。座標はentranceLat/Lngを入口(外回り)(35.4884095,139.3683913)、exitLat/Lngを出口(外回り)(35.4884162,139.3684817)に設定。従来座標(35.490,139.369)から約184m修正。"
            },
            {
                order: 4,
                displayName: "相模原愛川IC",
                googleName: "首都圏中央連絡自動車道 相模原愛川インターチェンジ",
                lat: 35.5269767,
                lng: 139.3601754,
                routeBranch: "west",
                branchOrder: 4,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.5269767, entranceLng: 139.3601754, exitLat: 35.52717, exitLng: 139.3597919,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「相模原愛川ＩＣ（圏央道）【入口】」「【出口】」（方向表記なし）を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(35.5269767,139.3601754)、exitLat/Lngを出口(35.52717,139.3597919)に設定。従来座標(35.527,139.359)から約40m修正。"
            },
            {
                order: 5,
                displayName: "相模原IC",
                googleName: "首都圏中央連絡自動車道 相模原インターチェンジ",
                lat: 35.5799227,
                lng: 139.2912452,
                routeBranch: "west",
                branchOrder: 5,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.5799227, entranceLng: 139.2912452, exitLat: 35.5797893, exitLng: 139.2913229,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「相模原ＩＣ（圏央道）【入口】」「【出口】」（方向表記なし。2022年6月30日よりETC専用化）を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(35.5799227,139.2912452)、exitLat/Lngを出口(35.5797893,139.2913229)に設定。従来座標(35.582,139.293)から約250m修正。"
            },
            {
                order: 6,
                displayName: "高尾山IC",
                googleName: "首都圏中央連絡自動車道 高尾山インターチェンジ",
                lat: 35.6230676,
                lng: 139.2632221,
                routeBranch: "west",
                branchOrder: 6,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.6230676, entranceLng: 139.2632221, exitLat: 35.6232828, exitLng: 139.2629606,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「高尾山ＩＣ（圏央道）【入口】」「【出口】」（方向表記なし、2012年3月25日開通）を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(35.6230676,139.2632221)、exitLat/Lngを出口(35.6232828,139.2629606)に設定。従来座標(35.623,139.263)から約50m修正。"
            },
            {
                order: 6.5,
                displayName: "八王子西IC",
                googleName: "首都圏中央連絡自動車道 八王子西インターチェンジ",
                lat: 35.6820928,
                lng: 139.2541464,
                routeBranch: "west",
                branchOrder: 6.5,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.6820928, entranceLng: 139.2541464, exitLat: 35.6804436, exitLng: 139.2553875,
                note: "【2026-07-15新規追加】これまでIC_MASTER.kenoに未登録だったIC。高尾山ICと八王子JCTの間、東京都八王子市に位置し、中央道八王子ICの西方にある。2007年6月23日に中央道方向のみのハーフICとして開通し、2016年12月24日15時に関越道方向の出入口も開通して現在はフルIC（Wikipedia「八王子西インターチェンジ」、NEXCO中日本プレスリリースで確認）。entranceSelectable/exitSelectableはtrue/true。座標はMapFanで確認した入口(外回り)(35.6820928,139.2541464)、出口(35.6804436,139.2553875)を使用。"
            },
            {
                order: 7,
                displayName: "八王子JCT",
                googleName: "首都圏中央連絡自動車道 八王子ジャンクション",
                lat: 35.640,
                lng: 139.254,
                isSelectable: false,
                connection: true,
                connectedRoads: ["keno", "chuo"],
                routeBranch: "west",
                branchOrder: 7,
                entranceSelectable: false, exitSelectable: false, entranceLat: 35.640, entranceLng: 139.254, exitLat: 35.640, exitLng: 139.254
            },
            {
                order: 8,
                displayName: "あきる野IC",
                googleName: "首都圏中央連絡自動車道 あきる野インターチェンジ",
                lat: 35.718217505915,
                lng: 139.28533770591,
                routeBranch: "northwest",
                branchOrder: 8,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.718217505915, entranceLng: 139.28533770591, exitLat: 35.7181315, exitLng: 139.2852863,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「あきる野ＩＣ（圏央道）【入口】」「【出口】」（方向表記なし）を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(35.718217505915,139.28533770591)、exitLat/Lngを出口(35.7181315,139.2852863)に設定。従来座標(35.718,139.284)から約100m修正。"
            },
            {
                order: 9,
                displayName: "日の出IC",
                googleName: "首都圏中央連絡自動車道 日の出インターチェンジ",
                lat: 35.7393065,
                lng: 139.2840487,
                routeBranch: "northwest",
                branchOrder: 9,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.7393065, entranceLng: 139.2840487, exitLat: 35.7393083, exitLng: 139.2839726,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「日の出ＩＣ（圏央道）【入口】」「【出口】」（方向表記なし、2002年3月29日開通）を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(35.7393065,139.2840487)、exitLat/Lngを出口(35.7393083,139.2839726)に設定。従来座標(35.736,139.282)から約370m修正。"
            },
            {
                order: 10,
                displayName: "青梅IC",
                googleName: "首都圏中央連絡自動車道 青梅インターチェンジ",
                lat: 35.7962251,
                lng: 139.3183337,
                routeBranch: "northwest",
                branchOrder: 10,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.7962251, entranceLng: 139.3183337, exitLat: 35.7961642, exitLng: 139.3183489,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「青梅ＩＣ（圏央道）【入口】」「【出口】」（方向表記なし）を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(35.7962251,139.3183337)、exitLat/Lngを出口(35.7961642,139.3183489)に設定。従来座標(35.797,139.323)から約90m修正。"
            },
            {
                order: 11,
                displayName: "入間IC",
                googleName: "首都圏中央連絡自動車道 入間インターチェンジ",
                lat: 35.8131411,
                lng: 139.3749811,
                routeBranch: "northwest",
                branchOrder: 11,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.8131411, entranceLng: 139.3749811, exitLat: 35.8132276, exitLng: 139.3749299,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「入間ＩＣ（圏央道）【入口】」「【出口】」（方向表記なし）を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(35.8131411,139.3749811)、exitLat/Lngを出口(35.8132276,139.3749299)に設定。従来座標(35.818,139.369)から約620m修正。"
            },
            {
                order: 12,
                displayName: "狭山日高IC",
                googleName: "首都圏中央連絡自動車道 狭山日高インターチェンジ",
                lat: 35.8672405,
                lng: 139.3791636,
                routeBranch: "northwest",
                branchOrder: 12,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.8672405, entranceLng: 139.3791636, exitLat: 35.8671986, exitLng: 139.379077,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「狭山日高ＩＣ（圏央道）【入口】」「【出口】」（方向表記なし、1996年3月26日開通）を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(35.8672405,139.3791636)、exitLat/Lngを出口(35.8671986,139.379077)に設定。従来座標(35.865,139.378)から約250m修正。"
            },
            {
                order: 13,
                displayName: "圏央鶴ヶ島IC",
                googleName: "首都圏中央連絡自動車道 圏央鶴ヶ島インターチェンジ",
                lat: 35.9213126,
                lng: 139.3912509,
                routeBranch: "northwest",
                branchOrder: 13,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.9213126, entranceLng: 139.3912509, exitLat: 35.9213126, exitLng: 139.3912509,
                note: "【2026-07-18調査・座標修正】MapFan「圏央鶴ヶ島ＩＣ（圏央道）【入口】」座標を採用（旧座標との誤差約150m）。Wikipedia代表点とおおむね整合。フルIC/ハーフIC判定は情報源からは確認できず不明。出口個別座標は未取得のため入口座標をフォールバック使用。entranceSelectable/exitSelectableは変更なし（trueのまま）。"
            },
            {
                order: 13.5,
                displayName: "鶴ヶ島JCT",
                googleName: "首都圏中央連絡自動車道 鶴ヶ島ジャンクション",
                lat: 35.934053,
                lng: 139.406431,
                isSelectable: false,
                connection: true,
                connectedRoads: ["keno", "kanetsu"],
                routeBranch: "northwest",
                branchOrder: 13.5,
                entranceSelectable: false, exitSelectable: false, entranceLat: 35.934053, entranceLng: 139.406431, exitLat: 35.934053, exitLng: 139.406431,
                note: "【2026-07-15新規追加】これまでIC_MASTER.kenoに未登録だったJCT。圏央道と関越自動車道を接続し、1996年3月26日供用開始（Wikipedia「鶴ヶ島ジャンクション」で確認）。圏央鶴ヶ島ICと坂戸ICの間、埼玉県鶴ヶ島市藤金に位置する。座標は北緯35度56分2.59秒 東経139度24分23.15秒を10進法に変換。isSelectable/entranceSelectable/exitSelectableはfalseで登録。"
            },
            {
                order: 14,
                displayName: "坂戸IC",
                googleName: "首都圏中央連絡自動車道 坂戸インターチェンジ",
                lat: 35.9711092,
                lng: 139.4496371,
                routeBranch: "northwest",
                branchOrder: 14,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.9711092, entranceLng: 139.4496371, exitLat: 35.971127, exitLng: 139.449679,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「坂戸ＩＣ（圏央道）【入口】」「【出口】」（方向表記なし）を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(35.9711092,139.4496371)、exitLat/Lngを出口(35.971127,139.449679)に設定。従来座標(35.967,139.444)から約620m修正。"
            },
            {
                order: 15,
                displayName: "川島IC",
                googleName: "首都圏中央連絡自動車道 川島インターチェンジ",
                lat: 35.9844674946,
                lng: 139.46448996185,
                routeBranch: "northwest",
                branchOrder: 15,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.9844674946, entranceLng: 139.46448996185, exitLat: 35.984357, exitLng: 139.4643404,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「川島ＩＣ（圏央道）【入口】」「【出口】」（方向表記なし、2008年3月29日開通）を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(35.9844674946,139.46448996185)、exitLat/Lngを出口(35.984357,139.4643404)に設定。従来座標(35.981,139.466)から約370m修正。"
            },
            {
                order: 16,
                displayName: "桶川北本IC",
                googleName: "首都圏中央連絡自動車道 桶川北本インターチェンジ",
                lat: 35.996876800829,
                lng: 139.52221227224,
                routeBranch: "northwest",
                branchOrder: 16,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.996876800829, entranceLng: 139.52221227224, exitLat: 35.9972056, exitLng: 139.5222498,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「桶川北本ＩＣ（圏央道）【入口】」「【出口】」（方向表記なし）を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(35.996876800829,139.52221227224)、exitLat/Lngを出口(35.9972056,139.5222498)に設定。従来座標(36.002,139.520)から約570m修正。"
            },
            {
                order: 17,
                displayName: "桶川加納IC",
                googleName: "首都圏中央連絡自動車道 桶川加納インターチェンジ",
                lat: 36.0191258,
                lng: 139.5643721,
                routeBranch: "northwest",
                branchOrder: 17,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.0191258, entranceLng: 139.5643721, exitLat: 36.0191258, exitLng: 139.5643721,
                note: "【2026-07-18調査・座標修正】MapFan「桶川加納ＩＣ（圏央道）【入口】」座標を採用（旧座標との誤差約320m）。Wikipedia代表点とほぼ一致。NAVITIMEで内回り入口の存在は確認できたが、フルIC/ハーフIC判定は断定できず不明。出口個別座標は未取得のため入口座標をフォールバック使用。entranceSelectable/exitSelectableは変更なし（trueのまま）。"
            },
            {
                order: 18,
                displayName: "白岡菖蒲IC",
                googleName: "首都圏中央連絡自動車道 白岡菖蒲インターチェンジ",
                lat: 36.044179147597,
                lng: 139.62599272778,
                routeBranch: "northwest",
                branchOrder: 18,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.044179147597, entranceLng: 139.62599272778, exitLat: 36.0442661, exitLng: 139.6259802,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「白岡菖蒲ＩＣ（圏央道）【入口】」「【出口】」（方向表記なし、2011年5月29日開通）を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(36.044179147597,139.62599272778)、exitLat/Lngを出口(36.0442661,139.6259802)に設定。従来座標(36.047,139.623)から約320m修正。"
            },
            {
                order: 19,
                displayName: "久喜白岡JCT",
                googleName: "首都圏中央連絡自動車道 久喜白岡ジャンクション",
                lat: 36.049,
                lng: 139.658,
                isSelectable: false,
                connection: true,
                connectedRoads: ["keno", "tohoku"],
                routeBranch: "northwest",
                branchOrder: 19,
                entranceSelectable: false, exitSelectable: false, entranceLat: 36.049, entranceLng: 139.658, exitLat: 36.049, exitLng: 139.658
            },
            {
                order: 20,
                displayName: "幸手IC",
                googleName: "首都圏中央連絡自動車道 幸手インターチェンジ",
                lat: 36.0642814,
                lng: 139.7382357,
                routeBranch: "northeast",
                branchOrder: 20,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.0642814, entranceLng: 139.7382357, exitLat: 36.0646596, exitLng: 139.7379266,
                note: "【2026-07-18調査・座標修正】MapFan「幸手ＩＣ（圏央道）」入口（内回り）・出口（外回り）座標を採用（旧座標との誤差約1.3km）。MapFanに入口（内回り）・出口（外回り）・入口（外回り）・出口（内回り）の4方向すべての個別ページが存在することを確認、フルIC・方向制限なしと判定。既知の保留事項「幸手IC外回り側の確認」はこれにより解消。entranceSelectable/exitSelectableは変更なし（trueのまま）。"
            },
            {
                order: 21,
                displayName: "五霞IC",
                googleName: "首都圏中央連絡自動車道 五霞インターチェンジ",
                lat: 36.0910491,
                lng: 139.7640806,
                routeBranch: "northeast",
                branchOrder: 21,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.0910491, entranceLng: 139.7640806, exitLat: 36.0907128, exitLng: 139.7645541,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「五霞ＩＣ（圏央道）【入口】」「【出口】」（方向表記なし、2015年3月29日開通）を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(36.0910491,139.7640806)、exitLat/Lngを出口(36.0907128,139.7645541)に設定。従来座標(36.101,139.774)から約1.1km修正。"
            },
            {
                order: 22,
                displayName: "境古河IC",
                googleName: "首都圏中央連絡自動車道 境古河インターチェンジ",
                lat: 36.1285735,
                lng: 139.8099014,
                routeBranch: "northeast",
                branchOrder: 22,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.1285735, entranceLng: 139.8099014, exitLat: 36.1284207, exitLng: 139.8096572,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「境古河ＩＣ（圏央道）【入口】」「【出口】」（方向表記なし）を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(36.1285735,139.8099014)、exitLat/Lngを出口(36.1284207,139.8096572)に設定。従来座標(36.113,139.833)から約2.1km修正。"
            },
            {
                order: 23,
                displayName: "坂東IC",
                googleName: "首都圏中央連絡自動車道 坂東インターチェンジ",
                lat: 36.0856318,
                lng: 139.8935551,
                routeBranch: "northeast",
                branchOrder: 23,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.0856318, entranceLng: 139.8935551, exitLat: 36.0856718, exitLng: 139.8936193,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「坂東ＩＣ（圏央道）【入口】」「【出口】」（方向表記なし）を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(36.0856318,139.8935551)、exitLat/Lngを出口(36.0856718,139.8936193)に設定。従来座標(36.063,139.914)から約2.9km修正。"
            },
            {
                order: 24,
                displayName: "常総IC",
                googleName: "首都圏中央連絡自動車道 常総インターチェンジ",
                lat: 36.0794866,
                lng: 139.9842857,
                routeBranch: "northeast",
                branchOrder: 24,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.0794866, entranceLng: 139.9842857, exitLat: 36.0796008, exitLng: 139.9842933,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「常総ＩＣ（圏央道）【入口】」「【出口】」（方向表記なし）を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(36.0794866,139.9842857)、exitLat/Lngを出口(36.0796008,139.9842933)に設定。従来座標(36.044,140.012)から約4.4km修正（境古河IC・つくば中央ICとの並び順と矛盾しないことを確認済み）。"
            },
            {
                order: 25,
                displayName: "つくば中央IC",
                googleName: "首都圏中央連絡自動車道 つくば中央インターチェンジ",
                lat: 36.0567693,
                lng: 140.0843141,
                routeBranch: "northeast",
                branchOrder: 25,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.0567693, entranceLng: 140.0843141, exitLat: 36.056668133888, exitLng: 140.08432427344,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「つくば中央ＩＣ（圏央道）【入口】」「【出口】」（方向表記なし）を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(36.0567693,140.0843141)、exitLat/Lngを出口(36.056668133888,140.08432427344)に設定。従来座標(36.079,140.073)から約2.7km修正。"
            },
            {
                order: 26,
                displayName: "つくばJCT",
                googleName: "首都圏中央連絡自動車道 つくばジャンクション",
                lat: 36.091,
                lng: 140.111,
                isSelectable: false,
                connection: true,
                connectedRoads: ["keno", "joban"],
                routeBranch: "northeast",
                branchOrder: 26,
                entranceSelectable: false, exitSelectable: false, entranceLat: 36.091, entranceLng: 140.111, exitLat: 36.091, exitLng: 140.111
            },
            {
                order: 27,
                displayName: "つくば牛久IC",
                googleName: "首都圏中央連絡自動車道 つくば牛久インターチェンジ",
                lat: 36.0267196,
                lng: 140.1344449,
                routeBranch: "northeast",
                branchOrder: 27,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.0267196, entranceLng: 140.1344449, exitLat: 36.026524483553, exitLng: 140.13440963653,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「つくば牛久ＩＣ（圏央道）【入口】」「【出口】」（方向表記なし）を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(36.0267196,140.1344449)、exitLat/Lngを出口(36.026524483553,140.13440963653)に設定。従来座標(36.037,140.119)から約1.7km修正。"
            },
            {
                order: 28,
                displayName: "牛久阿見IC",
                googleName: "首都圏中央連絡自動車道 牛久阿見インターチェンジ",
                lat: 35.9909205,
                lng: 140.1848524,
                routeBranch: "northeast",
                branchOrder: 28,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.9909205, entranceLng: 140.1848524, exitLat: 35.9909205, exitLng: 140.1848524,
                note: "【2026-07-18調査・座標修正】MapFan「牛久阿見ＩＣ（圏央道）【出口】」座標を採用（旧座標との誤差約1.6km）。Wikipedia代表点とほぼ一致。フルIC/ハーフIC判定は断定できず不明。入口個別座標は未取得のため出口座標をフォールバック使用。entranceSelectable/exitSelectableは変更なし（trueのまま）。"
            },
            {
                order: 29,
                displayName: "阿見東IC",
                googleName: "首都圏中央連絡自動車道 阿見東インターチェンジ",
                lat: 35.9820751,
                lng: 140.2369995,
                routeBranch: "northeast",
                branchOrder: 29,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.9820751, entranceLng: 140.2369995, exitLat: 35.9820751, exitLng: 140.2369995,
                note: "【2026-07-18調査・座標修正】MapFan「阿見東ＩＣ（圏央道）【入口】」座標を採用（旧座標との誤差約1.6km）。Wikipedia代表点とほぼ完全一致。フルIC/ハーフIC判定は断定できず不明（あみプレミアム・アウトレット直結の出口専用ランプが別途存在する可能性あり、要留意）。出口個別座標は未取得のため入口座標をフォールバック使用。entranceSelectable/exitSelectableは変更なし（trueのまま）。"
            },
            {
                order: 30,
                displayName: "稲敷IC",
                googleName: "首都圏中央連絡自動車道 稲敷インターチェンジ",
                lat: 35.9551214,
                lng: 140.3010546,
                routeBranch: "northeast",
                branchOrder: 30,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.9551214, entranceLng: 140.3010546, exitLat: 35.9551214, exitLng: 140.3010546,
                note: "【2026-07-18調査・座標修正】MapFan「稲敷ＩＣ（圏央道）【入口】」座標を採用（旧座標との誤差約2.3km、今回検証10件中最大）。Wikipedia代表点座標は未記載のためMapFan単独の値。フルIC/ハーフIC判定は断定できず不明。出口個別座標は未取得のため入口座標をフォールバック使用。entranceSelectable/exitSelectableは変更なし（trueのまま）。"
            },
            {
                order: 31,
                displayName: "稲敷東IC",
                googleName: "首都圏中央連絡自動車道 稲敷東インターチェンジ",
                lat: 35.9236686,
                lng: 140.3443843,
                routeBranch: "northeast",
                branchOrder: 31,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.9236686, entranceLng: 140.3443843, exitLat: 35.9236086, exitLng: 140.3444001,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「稲敷東ＩＣ（圏央道）【入口】」「【出口】」（方向表記なし）を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(35.9236686,140.3443843)、exitLat/Lngを出口(35.9236086,140.3444001)に設定。従来座標(35.919,140.383)から約3.4km修正。"
            },
            {
                order: 32,
                displayName: "神崎IC",
                googleName: "首都圏中央連絡自動車道 神崎インターチェンジ",
                lat: 35.899985599283,
                lng: 140.37666045394,
                routeBranch: "northeast",
                branchOrder: 32,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.899985599283, entranceLng: 140.37666045394, exitLat: 35.8999464, exitLng: 140.3765605,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「神崎ＩＣ（圏央道）【入口】」「【出口】」（方向表記なし）を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(35.899985599283,140.37666045394)、exitLat/Lngを出口(35.8999464,140.3765605)に設定。従来座標(35.894,140.408)から約2.6km修正。"
            },
            {
                order: 33,
                displayName: "下総IC",
                googleName: "首都圏中央連絡自動車道 下総インターチェンジ",
                lat: 35.862493,
                lng: 140.3888525,
                routeBranch: "northeast",
                branchOrder: 33,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.862493, entranceLng: 140.3888525, exitLat: 35.8624417, exitLng: 140.3888327,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「下総ＩＣ（圏央道）【入口】」「【出口】」（方向表記なし）を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(35.862493,140.3888525)、exitLat/Lngを出口(35.8624417,140.3888327)に設定。従来座標(35.873,140.432)から約3.0km修正。"
            },
            {
                order: 34,
                displayName: "大栄JCT",
                googleName: "首都圏中央連絡自動車道 大栄ジャンクション",
                lat: 35.851,
                lng: 140.468,
                isSelectable: false,
                connection: true,
                connectedRoads: ["keno", "tokan"],
                routeBranch: "northeast",
                branchOrder: 34,
                entranceSelectable: false, exitSelectable: false, entranceLat: 35.851, entranceLng: 140.468, exitLat: 35.851, exitLng: 140.468
            },
            {
                order: 35,
                displayName: "松尾横芝IC",
                googleName: "首都圏中央連絡自動車道 松尾横芝インターチェンジ",
                lat: 35.6630016,
                lng: 140.4391423,
                routeBranch: "southeast",
                branchOrder: 35,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.6630016, entranceLng: 140.4391423, exitLat: 35.6633273, exitLng: 140.4390699,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「松尾横芝ＩＣ（圏央道（千葉区間））【入口（外回り）】」「【出口（内回り）】」を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(外回り)(35.6630016,140.4391423)、exitLat/Lngを出口(内回り)(35.6633273,140.4390699)に設定。従来座標(35.663,140.438)から約40m修正。なお、大栄JCT～松尾横芝IC間（約18.5km）は2026年7月現在未開通であり、大栄JCT方面からは直接到達できない点に注意（詳細は別途調査メモ参照）。"
            },
            {
                order: 36,
                displayName: "山武成東IC",
                googleName: "首都圏中央連絡自動車道 山武成東インターチェンジ",
                lat: 35.6156791,
                lng: 140.3775018,
                routeBranch: "southeast",
                branchOrder: 36,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.6156791, entranceLng: 140.3775018, exitLat: 35.6156791, exitLng: 140.3775018,
                note: "【2026-07-18調査・座標修正】MapFan「山武成東ＩＣ（圏央道（千葉区間））【入口】」座標を採用（旧座標との誤差約620m）。MapFan単独の値で、他情報源との交差検証は未了。フルIC/ハーフIC判定は断定できず不明。出口個別座標は未取得のため入口座標をフォールバック使用。entranceSelectable/exitSelectableは変更なし（trueのまま）。次回、複数情報源での追加確認が望ましい。"
            },
            {
                order: 37,
                displayName: "東金JCT",
                googleName: "首都圏中央連絡自動車道 東金ジャンクション",
                lat: 35.574,
                lng: 140.316,
                isSelectable: false,
                connection: true,
                connectedRoads: ["keno"],
                routeBranch: "southeast",
                branchOrder: 37,
                entranceSelectable: false, exitSelectable: false, entranceLat: 35.574, entranceLng: 140.316, exitLat: 35.574, exitLng: 140.316
            },
            {
                order: 38,
                displayName: "東金IC",
                googleName: "首都圏中央連絡自動車道 東金インターチェンジ",
                lat: 35.5714996,
                lng: 140.320354,
                routeBranch: "southeast",
                branchOrder: 38,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.5714996, entranceLng: 140.320354, exitLat: 35.5714996, exitLng: 140.320354,
                note: "【2026-07-18調査・座標修正】MapFan「東金ＩＣ（圏央道（千葉区間））【入口】」座標を採用（旧座標との誤差約320m）。フルIC/ハーフIC判定は断定できず不明。出口個別座標は未取得のため入口座標をフォールバック使用。【重要】千葉東金道路にも同名の「東金IC」（第一・第二料金所、IC番号6/101）が別施設として存在し、圏央道側とは約600m離れている（MapFan「東金ＩＣ（千葉東金道路）【入口（上り）】」35.574106,140.3130212）。本エントリは圏央道側を指す。将来的な参照・追加登録時は、道路名を明記し混同しないよう注意。entranceSelectable/exitSelectableは変更なし（trueのまま）。"
            },
            {
                order: 39,
                displayName: "大網白里SIC",
                googleName: "首都圏中央連絡自動車道 大網白里スマートインターチェンジ",
                lat: 35.5140514,
                lng: 140.2945796,
                routeBranch: "southeast",
                branchOrder: 39,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.5140514, entranceLng: 140.2945796, exitLat: 35.5140638, exitLng: 140.2945378,
                note: "【2026-07-14調査・座標のみ修正】Wikipedia「大網白里スマートインターチェンジ」記事で「本線直結型（トランペット型）で構成され、ETC搭載の全車種が24時間利用可能、両方向とも出入り可能」と確認（2019年3月24日開通）。トランペット型構造のため方向別のランプ分離はなく、ハーフICではない。MapFanで入口・出口の2個別ページ（方向表記なし、実質同一地点、約4m差）を確認。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(35.5140514,140.2945796)、exitLat/Lngを出口(35.5140638,140.2945378)に設定。従来座標(35.514,140.295)から約40m修正。"
            },
            {
                order: 40,
                displayName: "茂原北IC",
                googleName: "首都圏中央連絡自動車道 茂原北インターチェンジ",
                lat: 35.489089,
                lng: 140.271026,
                routeBranch: "southeast",
                branchOrder: 40,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.489089, entranceLng: 140.271026, exitLat: 35.489089, exitLng: 140.271026,
                note: "【2026-07-18調査・座標修正】NAVITIME検索結果集約値を採用（旧座標との誤差約230m）。MapFan個別ページ（入口・出口）には未到達で、単一情報源のみによる暫定値。フルIC/ハーフIC判定は断定できず不明。entranceSelectable/exitSelectableは変更なし（trueのまま）。次回、MapFan個別ページでの追加確認・複数情報源での交差検証が望ましい。"
            },
            {
                order: 41,
                displayName: "茂原長柄SIC",
                googleName: "首都圏中央連絡自動車道 茂原長柄スマートインターチェンジ",
                lat: 35.4504808,
                lng: 140.25106,
                routeBranch: "southeast",
                branchOrder: 41,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.4504808, entranceLng: 140.25106, exitLat: 35.450495794474, exitLng: 140.2510016242,
                note: "【2026-07-14調査・座標のみ修正】WebSearchで「本線直結型、ETC搭載の全車種が24時間利用可能、上下線とも出入可。一旦停止型のフルIC形式（全方向利用可能）であり、ハーフICではなくフルIC形式として設計されている」と確認（2020年2月16日開通）。MapFanで入口・出口の2個別ページ（方向表記なし、実質同一地点、約2m差）を確認。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(35.4504808,140.25106)、exitLat/Lngを出口(35.450495794474,140.2510016242)に設定。従来座標(35.448,140.248)から約390m修正。"
            },
            {
                order: 42,
                displayName: "茂原長南IC",
                googleName: "首都圏中央連絡自動車道 茂原長南インターチェンジ",
                lat: 35.4016576,
                lng: 140.2444509,
                routeBranch: "southeast",
                branchOrder: 42,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.4016576, entranceLng: 140.2444509, exitLat: 35.4016381, exitLng: 140.2445353,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「茂原長南ＩＣ（圏央道（千葉区間））【入口】」「【出口】」（方向表記なし）を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(35.4016576,140.2444509)、exitLat/Lngを出口(35.4016381,140.2445353)に設定。従来座標(35.402,140.245)から約60m修正。"
            },
            {
                order: 43,
                displayName: "市原鶴舞IC",
                googleName: "首都圏中央連絡自動車道 市原鶴舞インターチェンジ",
                lat: 35.3624953,
                lng: 140.1856249,
                routeBranch: "southeast",
                branchOrder: 43,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.3624953, entranceLng: 140.1856249, exitLat: 35.3625526, exitLng: 140.1855522,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「市原鶴舞ＩＣ（圏央道（千葉区間））【入口】」「【出口】」（方向表記なし、2013年4月27日開通）を確認したためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(35.3624953,140.1856249)、exitLat/Lngを出口(35.3625526,140.1855522)に設定。従来座標(35.363,140.185)から約80m修正。"
            },
            {
                order: 44,
                displayName: "木更津東IC",
                googleName: "首都圏中央連絡自動車道 木更津東インターチェンジ",
                lat: 35.3611168,
                lng: 140.0525383,
                routeBranch: "southeast",
                branchOrder: 44,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.3611168, entranceLng: 140.0525383, exitLat: 35.3611168, exitLng: 140.0525383,
                note: "【2026-07-18調査・座標修正】MapFan「木更津東ＩＣ（圏央道（千葉区間））【入口】」座標を採用（旧座標との誤差約60m、今回検証10件中最小）。フルIC/ハーフIC判定は断定できず不明。出口個別座標は未取得のため入口座標をフォールバック使用。entranceSelectable/exitSelectableは変更なし（trueのまま）。"
            },
            {
                order: 45,
                displayName: "木更津JCT",
                googleName: "首都圏中央連絡自動車道 木更津ジャンクション",
                lat: 35.372,
                lng: 139.974,
                isSelectable: false,
                connection: true,
                connectedRoads: ["keno", "tateyama", "aqualine"],
                routeBranch: "southeast",
                branchOrder: 45,
                entranceSelectable: false, exitSelectable: false, entranceLat: 35.372, entranceLng: 139.974, exitLat: 35.372, exitLng: 139.974
            }
        ]
    },


    chuo: {
        label: "中央道方面",
        exits: [
            { order: -6, displayName: "堤通（首都高）", googleName: "首都高速6号向島線 堤通出入口", lat: 35.7357056, lng: 139.8150419, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.7357056, entranceLng: 139.8150419, exitLat: 35.7357056, exitLng: 139.8150419,
                note: "【2026-07-19同期修正】SHUTO_IC_MASTER本体側（shuto-6-tsutsumidori、MapFan検証済み）の座標に同期。旧座標との誤差約548m。dedupeIcDefinitionsByIdentityによりSHUTO_IC_MASTER側が優先されるため候補選定への実害はなかったが、データ整合性のため修正。"
            },
            { order: -5, displayName: "上野（首都高）", googleName: "首都高速1号上野線 上野出入口", lat: 35.712, lng: 139.779, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.712, entranceLng: 139.779, exitLat: 35.712, exitLng: 139.779
            },
            { order: -4, displayName: "高井戸（首都高）", googleName: "首都高速4号新宿線 高井戸出入口", lat: 35.684, lng: 139.615, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.684, entranceLng: 139.615, exitLat: 35.684, exitLng: 139.615
            },
            { order: -3, displayName: "外苑（首都高）", googleName: "首都高速4号新宿線 外苑出入口", lat: 35.677, lng: 139.718, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.677, entranceLng: 139.718, exitLat: 35.677, exitLng: 139.718
            },
            { order: -2, displayName: "代官町（首都高）", googleName: "首都高速都心環状線 代官町出入口", lat: 35.688, lng: 139.754, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.688, entranceLng: 139.754, exitLat: 35.688, exitLng: 139.754
            },
            { order: -1, displayName: "一ツ橋（首都高）", googleName: "首都高速都心環状線 一ツ橋出入口", lat: 35.692, lng: 139.758, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.692, entranceLng: 139.758, exitLat: 35.692, exitLng: 139.758
            },
            { order: 1, displayName: "高井戸IC", googleName: "中央自動車道 高井戸インターチェンジ", lat: 35.6794482, lng: 139.6090794,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.6794482, entranceLng: 139.6090794, exitLat: 35.6794482, exitLng: 139.6090794,
                note: "【2026-07-16調査・構造修正】Wikipedia「高井戸インターチェンジ」、乗りものニュース(trafficnews.jp/post/119263)、Merkmal(merkmal-biz.jp/post/57540)の複数情報源で、下り線入口は開通以来一度も建設されていない（住民反対のため半世紀近く未着工）クオーターICであることを確認。上り線（都心方面）への出口のみが存在するため、entranceSelectable:falseに修正（従来はtrueだったが誤り）。2022年6月に杉並区が下り入口建設支援の方針を表明しているが、2026年7月現在も着工・開通の一次情報はなく、将来開通の可能性がある（開通ニュースが出た時点で再確認要）。座標はMapFan「高井戸ＩＣ（中央自動車道）【出口（上り）】」(35.6794482,139.6090794)で確認。従来座標(35.684,139.611)から約536m南西へ修正。"
            },
            { order: 2, displayName: "調布IC", googleName: "中央自動車道 調布インターチェンジ", lat: 35.659387, lng: 139.535350,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.659387, entranceLng: 139.535350, exitLat: 35.659264, exitLng: 139.535433,
                note: "【2026-07-16調査・座標のみ修正】MapFan「調布ＩＣ（中央自動車道）【入口】」(35.659387,139.535350)「【出口】」(35.659264,139.535433)を確認（方向表記なし＝上下線とも利用可能）。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(35.650,139.536)から約1.04km北へ修正。"
            },
            { order: 3, displayName: "稲城IC", googleName: "中央自動車道 稲城インターチェンジ", lat: 35.6533559, lng: 139.511935,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.6533559, entranceLng: 139.511935, exitLat: 35.6533559, exitLng: 139.511935,
                note: "【2026-07-16調査・構造修正】Wikipedia「稲城インターチェンジ」でハーフICと確認。高井戸方面（都心方面）への入口と高井戸方面からの出口のみで、八王子方面への出入口はなし。MapFan「稲城ＩＣ（中央自動車道）【入口（上り）】」(35.6533559,139.511935)「【出口（下り）】」(35.6555611,139.5156709)のみ存在し、上り出口・下り入口のページは見つからず。本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、exitSelectable:falseに修正（従来はtrueだったが誤り）。2015年開通の府中SIC（下り入口＋上り出口）と方向的に補完し合う構造（稲城ICとちょうど逆パターン）。座標は入口(上り)(35.6533559,139.511935)を採用。従来座標(35.638,139.510)から約1.72km北東へ修正。"
            },
            { order: 3.5, displayName: "府中SIC", googleName: "中央自動車道 府中スマートインターチェンジ", lat: 35.6597187, lng: 139.4993254,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.6597187, entranceLng: 139.4993254, exitLat: 35.66022529455, exitLng: 139.49907940595,
                note: "【2026-07-14調査・座標＋exitSelectable修正】東京都府中市公式サイト・Car Watch記事で「府中スマートインターチェンジは中央道の府中バス停を利用して設置され、下り線に八王子方面への入口、上り線に八王子方面からの出口のみが存在し、新宿・高井戸方面への接続はないハーフIC」と確認。MapFanでも【出口（上り）】【入口（下り）】の2ページのみ確認でき、【入口（上り）】【出口（下り）】は複数回の検索でも発見できなかった。本アプリは走行方向を区別できないため、入口方向（下り）を代表方向として採用し、上り出口の存在に関わらず下り方向にはない出口はexitSelectable:falseとした。座標はentranceLat/Lngを入口(下り)(35.6597187,139.4993254)、exitLat/Lngを出口(上り)(35.66022529455,139.49907940595)に設定。従来座標(35.660,139.496)から約302m修正。"
            },
            { order: 4, displayName: "国立府中IC", googleName: "中央自動車道 国立府中インターチェンジ", lat: 35.6745031, lng: 139.4429727,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.6745031, entranceLng: 139.4429727, exitLat: 35.6742594, exitLng: 139.4423788,
                note: "【2026-07-16調査・座標のみ修正】MapFan「国立府中ＩＣ【入口】」(35.6745031,139.4429727)「【出口】」(35.6742594,139.4423788)を確認（方向表記なし）。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(35.668,139.457)から約1.48km北西へ修正。"
            },
            { order: 5, displayName: "八王子IC", googleName: "中央自動車道 八王子インターチェンジ", lat: 35.6786623, lng: 139.3453319,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.6786623, entranceLng: 139.3453319, exitLat: 35.6784097, exitLng: 139.3441239,
                note: "【2026-07-16調査・座標のみ修正】Wikipedia「八王子インターチェンジ」で上下線とも入口あり、上り線出口＋下り線に第1出口（16号バイパス方面）・第2出口（16号本線方面）の計2出口を確認。MapFanで「【入口（上り）】」(35.6786623,139.3453319)「【入口（下り）】」(35.6785033,139.3447615)「【出口】」(35.6784097,139.3441239)「【出口（下り）】」(35.6737057,139.3537599＝約900m離れた別ランプ)を確認。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標は主要クラスタを採用し、下り専用の遠い方の出口は代表点に含めていない。従来座標(35.657,139.335)から約2.57km北東へ修正。"
            },
            { order: 6, displayName: "相模湖IC", googleName: "中央自動車道 相模湖インターチェンジ", lat: 35.6154847, lng: 139.1700081,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.6154847, entranceLng: 139.1700081, exitLat: 35.6154942, exitLng: 139.1699444,
                note: "【2026-07-16調査・座標のみ修正】MapFan「相模湖ＩＣ【入口】」(35.6154847,139.1700081)「【出口】」(35.6154942,139.1699444)を確認（方向表記なし）。近隣の「相模湖東IC」はクオーターIC(下り出口のみ)だが本ICとは別施設のため無関係。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(35.616,139.190)から約1.81km西へ修正。"
            },
            { order: 7, displayName: "上野原IC", googleName: "中央自動車道 上野原インターチェンジ", lat: 35.6187917, lng: 139.1138878,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.6187917, entranceLng: 139.1138878, exitLat: 35.6187775, exitLng: 139.1139427,
                note: "【2026-07-16調査・座標のみ修正】MapFan「上野原ＩＣ【入口】」(35.6187917,139.1138878)「【出口】」(35.6187775,139.1139427)を確認（方向表記なし）。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(35.631,139.109)から約1.43km南東へ修正。"
            },
            { order: 7.5, displayName: "談合坂SIC", googleName: "中央自動車道 談合坂スマートインターチェンジ", lat: 35.6237903, lng: 139.0428968,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.6237903, entranceLng: 139.0428968, exitLat: 35.6238141, exitLng: 139.0434099,
                note: "【2026-07-14調査・座標のみ修正】WebSearchで「上り線（東京方面）はSA・PA接続型で談合坂SA（上り）を経由し、下り線（名古屋・長野方面）は本線直結型」という複雑な運用ルール（SA自体を利用できるか否かの違い）を確認したが、これは入口・出口の可否そのものには影響せず、全方向で利用可能なフルICであることを確認。MapFanでも方向表記のない【入口】【出口】の2ページ（実質同一地点、約46m差）を確認。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(35.6237903,139.0428968)、exitLat/Lngを出口(35.6238141,139.0434099)に設定。従来座標(35.629,139.045)から約610m修正。"
            },
            { order: 8, displayName: "大月IC", googleName: "中央自動車道 大月インターチェンジ", lat: 35.6038574, lng: 138.924613,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.6038574, entranceLng: 138.924613, exitLat: 35.603883, exitLng: 138.924718,
                note: "【2026-07-16調査・座標のみ修正】MapFan「大月ＩＣ【入口】」(35.6038574,138.924613、方向表記なし)「【出口（上り）】」(35.603883,138.924718)を確認。NAVITIME検索で「中央自動車道 大月IC 下り 出口」ページの存在も確認したが、正確な個別座標は未取得（要再確認）。2003年の大月JCT改築で大月ICと一体化した構造。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(35.616,138.949)から約2.58km南西へ修正。【2026-07-19追加調査】下り出口座標としてNAVITIME経由で35.607253,138.929851という参考値を得たが、WebFetchが403で直接ページ確認できず信頼度は中程度。上り出口（35.603883,138.924718）から北東へ約595mで、大月JCTと一体化した構造上不自然ではないが確定情報ではない。採用は見送り、座標は変更せず。人間による実際のブラウザでの再確認を推奨。"
            },
            { order: 8.6, displayName: "大月JCT", googleName: "中央自動車道 大月ジャンクション", lat: 35.602342, lng: 138.916861,
                isSelectable: false, connection: true, connectedRoads: ["chuo", "fujiyoshida"],
                entranceSelectable: false, exitSelectable: false, entranceLat: 35.602342, entranceLng: 138.916861, exitLat: 35.602342, exitLng: 138.916861,
                note: "【2026-07-16調査・新規追加】中央自動車道本線と中央道富士吉田線の分岐点。Wikipedia「大月ジャンクション」座標(北緯35度36分8.43秒 東経138度55分0.7秒)を10進変換。大月ICと構造上一体化しているが、既存のJCT登録パターン（八王子JCT・鶴ヶ島JCT・久喜白岡JCT等、いずれも接続する2エリアのうちorder列上に物理的に存在する側にのみ1件登録）に倣い、fujiyoshida側には重複登録せずchuo側にのみ登録。座標は既存chuoの大月IC(35.6038574,138.924613)から約1.5km。"
            },
            { order: 9, displayName: "勝沼IC", googleName: "中央自動車道 勝沼インターチェンジ", lat: 35.6522691, lng: 138.734407,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.6522691, entranceLng: 138.734407, exitLat: 35.652144, exitLng: 138.734480,
                note: "【2026-07-16調査・座標のみ修正】MapFan「勝沼ＩＣ【入口】」(35.6522691,138.734407)「【出口】」(35.652144,138.734480)を確認（方向表記なし）。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(35.686,138.739)から約3.79km南へ修正。"
            },
            { order: 10, displayName: "一宮御坂IC", googleName: "中央自動車道 一宮御坂インターチェンジ", lat: 35.6363294, lng: 138.6747078,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.6363294, entranceLng: 138.6747078, exitLat: 35.633734, exitLng: 138.679111,
                note: "【2026-07-16調査・座標のみ修正】MapFan「一宮御坂ＩＣ【入口】」(35.6363294,138.6747078、方向表記なし)を確認。【出口】個別ページはMapFanで特定できなかったため、NAVITIME「中央自動車道 一宮御坂IC 下り 出口」(35.633734,138.679111)で代替確認（要再確認）。Wikipediaにハーフ等の記載はなく、入口・出口とも料金ブース3基（ETC専用2・一般1）で対称的構成。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(35.657,138.688)から約2.64km南西へ修正。【2026-07-19追加調査】出口座標について、MapFan個別ページは今回も発見できず、goo地図は2023年9月にサービス終了済み、Yahoo!マップは施設全体座標のみで方向別情報なし。新情報は得られず、既存のNAVITIME代替値（35.633734,138.679111）を暫定使用継続。"
            },
            { order: 10.5, displayName: "笛吹八代SIC", googleName: "中央自動車道 笛吹八代スマートインターチェンジ", lat: 35.622877, lng: 138.634789,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.622877, entranceLng: 138.634789, exitLat: 35.622877, exitLng: 138.634789,
                note: "【2026-07-14調査・座標のみ修正】NAVITIMEで上り出口・上り入口・下り出口・下り入口の4方向の存在を確認し、フルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。MapFanでは【出口（上り）】(35.623745,138.6335718)・【入口（下り）】(35.6220085,138.6360058)の2点のみ確認でき、代表座標方式（入口(上り)・出口(下り)）に必要な個別ランプ座標は確認できなかったため、確認できた2点の中間点(35.622877,138.634789)を暫定使用した。従来座標(35.623,138.636)から約235m修正。次回、入口(上り)・出口(下り)の個別座標が確認できた場合は再検証が必要。【2026-07-19追加調査】入口(上り)・出口(下り)の個別座標は今回も確認できず。MapFanには出口(上り)・入口(下り)の2ページしか存在しない可能性が高い（2回の検索で同じ結果）。中間点暫定値の継続がおそらく現実的な落とし所だが確定はできず。"
            },
            { order: 11, displayName: "甲府昭和IC", googleName: "中央自動車道 甲府昭和インターチェンジ", lat: 35.6443223, lng: 138.54056,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.6443223, entranceLng: 138.54056, exitLat: 35.6443808, exitLng: 138.5405097,
                note: "【2026-07-16調査・座標のみ修正】MapFan「甲府昭和ＩＣ【入口】」(35.6443223,138.54056)「【出口】」(35.6443808,138.5405097)を確認（方向表記なし）。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(35.627,138.553)から約2.24km北東へ修正。"
            },
            { order: 12, displayName: "双葉SIC", googleName: "中央自動車道 双葉スマートインターチェンジ", lat: 35.6802812, lng: 138.5126466,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.6802812, entranceLng: 138.5126466, exitLat: 35.6813188, exitLng: 138.5106729,
                note: "【2026-07-14調査・座標のみ修正】開設当初（2005年4月供用開始）は東京方面（上り）のみのハーフICだったが、2009年11月21日に名古屋・長野方面（下り）が開通しフルICとなったことを確認。東京方面（上り線）入口と名古屋・長野方面（下り線）入口は別々の場所にある。entranceSelectable/exitSelectableは現状（フルIC）と一致しているため変更なし（trueのまま）。MapFanで入口(上り)・入口(下り)・出口(下り)の3個別ランプページを確認。座標はentranceLat/Lngを入口(上り)(35.6802812,138.5126466)、exitLat/Lngを出口(下り)(35.6813188,138.5106729)に設定。従来座標(35.705,138.503)は実測値から約2.9km離れていたため、大幅な修正となった。"
            },
            { order: 13, displayName: "韮崎IC", googleName: "中央自動車道 韮崎インターチェンジ", lat: 35.720358, lng: 138.465114,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.720358, entranceLng: 138.465114, exitLat: 35.722803, exitLng: 138.465125,
                note: "【2026-07-16調査・座標のみ修正】MapFan「韮崎ＩＣ【出口】」(35.722803,138.465125)を確認。【入口】個別ページはMapFanで404となり直接確認不可のため、Wikipedia所在地座標(35.7203583,138.4651139)を暫定使用（要再確認）。入口2/出口3ブースで方向限定表記なし、フルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。【2026-07-19追加調査】入口座標について2つの矛盾する候補が判明。候補A：NAVITIME「上り入口」35.719729,138.465625（Wikipedia暫定値から約84m、参考値・WebFetch未確認）。候補B：韮崎ICタクシー料金ページURLパラメータのデコード値「下り入口」35.722955,138.465123（MapFan確認済み出口35.722803,138.465125からわずか約17m、ほぼ同一地点）。出口と候補Bが近接する一方、候補Aは離れた別地点であり、どちらが実態を反映しているか現時点では判断できない。座標は変更せず、既存のWikipedia暫定値を維持。現地写真・NEXCO資料等での追加裏付けが望ましい。要ユーザー判断。"
            },
            { order: 14, displayName: "須玉IC", googleName: "中央自動車道 須玉インターチェンジ", lat: 35.773514, lng: 138.420569,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.773514, entranceLng: 138.420569, exitLat: 35.773448, exitLng: 138.420475,
                note: "【2026-07-16調査・座標のみ修正】MapFan「須玉ＩＣ【入口】」(35.773514,138.420569)「【出口】」(35.773448,138.420475)を確認（方向表記なし）。Wikipedia座標(35.7727972,138.4238944)とも近似一致。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(35.795,138.406)から約2.6km修正。"
            },
            { order: 15, displayName: "長坂IC", googleName: "中央自動車道 長坂インターチェンジ", lat: 35.833392, lng: 138.389958,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.833392, entranceLng: 138.389958, exitLat: 35.833411, exitLng: 138.390026,
                note: "【2026-07-16調査・座標のみ修正】MapFan「長坂ＩＣ【入口】」(35.833392,138.389958)「【出口】」(35.833411,138.390026)を確認（方向表記なし、フルICとWikipediaに明記）。Wikipedia座標(35.8363250,138.3885111)も近傍。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(35.841,138.366)から約2.3km修正。"
            },
            { order: 16, displayName: "小淵沢IC", googleName: "中央自動車道 小淵沢インターチェンジ", lat: 35.870211, lng: 138.309598,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.870211, entranceLng: 138.309598, exitLat: 35.870178, exitLng: 138.309540,
                note: "【2026-07-16調査・座標のみ修正】MapFan「小淵沢ＩＣ【入口】」(35.870211,138.309598)「【出口】」(35.870178,138.309540)を確認（方向表記なし）。Wikipedia座標(35.8707611,138.3114778)とも整合。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(35.888,138.316)から約2.1km修正。"
            },
            { order: 17, displayName: "諏訪南IC", googleName: "中央自動車道 諏訪南インターチェンジ", lat: 35.936407, lng: 138.213577,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.936407, entranceLng: 138.213577, exitLat: 35.936450, exitLng: 138.213655,
                note: "【2026-07-16調査・座標のみ修正】MapFan「諏訪南ＩＣ【入口】」(35.936407,138.213577)「【出口】」(35.936450,138.213655)を確認（方向表記なし）。Wikipedia座標(35.9374500,138.2107111)とも近い。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(35.973,138.232)から約4.4km修正（今回調査した通常IC21件中、乖離が最大）。"
            },
            { order: 18, displayName: "諏訪IC", googleName: "中央自動車道 諏訪インターチェンジ", lat: 36.007708, lng: 138.130064,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.007708, entranceLng: 138.130064, exitLat: 36.007786, exitLng: 138.130017,
                note: "【2026-07-16調査・座標のみ修正】MapFan「諏訪ＩＣ【入口】」(36.007708,138.130064)「【出口】」(36.007786,138.130017)を確認（入口3/出口6ブース、方向限定表記なし）。Wikipedia座標(36.003139,138.128028、所在地住所ベースでやや南寄り)、NAVITIME経由の36.003558,138.125587も参考値として近似。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(36.031,138.114)から約2.9km修正。"
            },
            { order: 18.5, displayName: "諏訪湖SIC", googleName: "中央自動車道 諏訪湖スマートインターチェンジ", lat: 36.026, lng: 138.079,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.026, entranceLng: 138.079, exitLat: 36.026, exitLng: 138.079,
                note: "【2026-07-14調査】2025年7月27日15時開通の新しいSICで、中央自動車道 諏訪湖サービスエリアに直結、上下線とも全方向・24時間利用可能なフルICであることをNEXCO中日本プレスリリース等で確認。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標は開通から日が浅くMapFan個別ランプページ等で確認できなかったため、既存値を維持（精度未確認、要再確認）。【2026-07-19追加調査】座標は今回も確認できず。MapFanに個別ページなし、NAVITIMEはページ存在を確認できたがWebFetch403で座標未取得。フルIC（一旦停止型、上下線とも全方向・24時間利用可能）であることはNEXCO中日本プレスリリース等で確認済み。諏訪ICから北へ約6.0km、岡谷ICから南へ約7.8km、諏訪湖SA（上下線）に直結。2025年7月27日開通と日が浅く、地図サービス側の座標データ整備が追いついていない可能性が高い。数ヶ月後に再調査を推奨。"
            },
            { order: 19, displayName: "岡谷IC", googleName: "長野自動車道 岡谷インターチェンジ", lat: 36.086041, lng: 138.039685,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.086041, entranceLng: 138.039685, exitLat: 36.085700, exitLng: 138.039597,
                note: "【2026-07-16調査・座標のみ修正】MapFan「岡谷ＩＣ【入口】」(36.086041,138.039685)「【出口】」(36.085700,138.039597)を確認（入口3/出口5ブース、方向限定表記なし）。Wikipedia座標(36.082775,138.038075、岡谷JCTから3.7km地点と明記＝岡谷JCTとは別施設と確認済み)。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(36.056,138.050)から約3.4km修正。"
            },
            { order: 20, displayName: "塩尻IC", googleName: "長野自動車道 塩尻インターチェンジ", lat: 36.117071, lng: 137.979454,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.117071, entranceLng: 137.979454, exitLat: 36.117014, exitLng: 137.979508,
                note: "【2026-07-16調査・座標のみ修正】MapFan「塩尻ＩＣ【入口】」(36.117071,137.979454)「【出口】」(36.117014,137.979508)を確認（入口2/出口3ブース、方向限定表記なし。塩尻北ICとは別施設と確認済み）。Wikipedia座標(36.1182722,137.9816500)とも近似。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(36.093,137.963)から約3.0km修正。"
            },
            { order: 21, displayName: "松本IC", googleName: "長野自動車道 松本インターチェンジ", lat: 36.232035, lng: 137.940170,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.232035, entranceLng: 137.940170, exitLat: 36.231188, exitLng: 137.940274,
                note: "【2026-07-16調査・座標のみ修正】MapFan「松本ＩＣ【入口】」(36.232035,137.940170)「【出口】」(36.231188,137.940274)を確認（入口3/出口6ブース、方向限定表記なし）。Wikipedia座標(36.2334556,137.9385111)とも近似。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(36.219,137.940)から約1.4km修正（今回調査した通常IC21件中、乖離が最小）。"
            },
            { order: 21.5, displayName: "梓川SIC", googleName: "長野自動車道 梓川スマートインターチェンジ", lat: 36.2689233, lng: 137.931837,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.2689233, entranceLng: 137.931837, exitLat: 36.261153, exitLng: 137.933979,
                note: "【2026-07-14調査・座標のみ修正】WebSearchで「上下線ともに全方向対応（2010年11月27日供用開始、梓川SAに併設）」と確認。MapFanで入口（上り・下り）・出口（上り・下り）の4個別ページの存在を確認し、フルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(上り)(36.2689233,137.931837)、exitLat/Lngを出口(下り)(36.261153,137.933979)に設定。従来座標(36.266,137.933)から約342m修正。"
            },
            { order: 22, displayName: "安曇野IC", googleName: "長野自動車道 安曇野インターチェンジ", lat: 36.300446, lng: 137.924027,
                entranceSelectable: true, exitSelectable: true, entranceLat: 36.300446, entranceLng: 137.924027, exitLat: 36.300450, exitLng: 137.923889,
                note: "【2026-07-16調査・座標のみ修正】MapFan「安曇野ＩＣ【入口】」(36.300446,137.924027)「【出口】」(36.300450,137.923889)を確認（入口3/出口5ブース、方向限定表記なし。WikipediaにフルICと明記）。Wikipedia座標(36.2985861,137.9253556)も整合。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(36.300,137.898)から約2.3km修正。"
            }
        ]
    },


    fujiyoshida: {
        label: "中央道 富士吉田線方面",
        exits: [
            { order: 1, displayName: "都留IC", googleName: "中央自動車道富士吉田線 都留インターチェンジ", lat: 35.5614664, lng: 138.907034,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.5614664, entranceLng: 138.907034, exitLat: 35.5614144, exitLng: 138.9070686,
                note: "【2026-07-16調査・新規追加】1971年3月29日開設（当初クオーターIC）、1984年ハーフIC化を経て2011年8月10日フルIC化（河口湖方向の入口・出口が追加）。大月JCT方向・河口湖方向とも入口・出口利用可（フルIC）。座標はMapFan「都留ＩＣ（中央自動車道（河口湖線））【入口】」(35.5614664,138.907034)「【出口】」(35.5614144,138.9070686)で確認（方向表記なし）。出典：https://ja.wikipedia.org/wiki/都留インターチェンジ"
            },
            { order: 2, displayName: "富士吉田西桂SIC", googleName: "中央自動車道富士吉田線 富士吉田西桂スマートインターチェンジ", lat: 35.5077553, lng: 138.8300251,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.5077553, entranceLng: 138.8300251, exitLat: 35.5077353, exitLng: 138.8299946,
                note: "【2026-07-16調査・新規追加】段階開通（2018年4月15日：大月JCT方面供用、同年8月6日：河口湖IC方面供用）を経て現在フルIC。ETC搭載全車種24時間、上下線とも出入可。座標はMapFan「富士吉田西桂スマートＩＣ（中央自動車道（河口湖線））【入口】」(35.5077553,138.8300251)「【出口】」(35.5077353,138.8299946)で確認（方向表記なし。方向別個別ランプページは見つからず、実際に方向別の物理的なランプ分岐があるかは未確認）。出典：https://ja.wikipedia.org/wiki/富士吉田西桂スマートインターチェンジ"
            },
            { order: 3, displayName: "河口湖IC", googleName: "中央自動車道富士吉田線 河口湖インターチェンジ", lat: 35.4859964, lng: 138.7750739,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.4859964, entranceLng: 138.7750739, exitLat: 35.4859964, exitLng: 138.7750739,
                note: "【2026-07-16調査・新規追加】1969年3月17日開通のハーフIC。大月JCT方面のみの出入口で、富士吉田/東富士五湖道路方面の出入口はなし（隣接する富士吉田IC(1.0km先、東富士五湖道路)とセットで実質フルICを構成するが、本アプリの範囲＝中央道富士吉田線には含めていない）。本アプリの並び順（大月JCT→河口湖方向）では「下り出口」のみが該当方向のため、exitSelectable:trueとしexit座標はMapFan「河口湖ＩＣ【出口（下り）】」(35.4859964,138.7750739)を採用。「上り入口」（河口湖から大月方面へ向かう入口、MapFan【入口（上り）】35.485998,138.7749156で確認）は本アプリの並び順では使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。出典：https://ja.wikipedia.org/wiki/河口湖インターチェンジ"
            }
        ]
    },


    tomei: {
        label: "東名道方面",
        exits: [
            { order: -8, displayName: "堤通（首都高）", googleName: "首都高速6号向島線 堤通出入口", lat: 35.7357056, lng: 139.8150419, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.7357056, entranceLng: 139.8150419, exitLat: 35.7357056, exitLng: 139.8150419,
                note: "【2026-07-19同期修正】SHUTO_IC_MASTER本体側（shuto-6-tsutsumidori、MapFan検証済み）の座標に同期。旧座標との誤差約548m。dedupeIcDefinitionsByIdentityによりSHUTO_IC_MASTER側が優先されるため候補選定への実害はなかったが、データ整合性のため修正。"
            },
            { order: -7, displayName: "上野（首都高）", googleName: "首都高速1号上野線 上野出入口", lat: 35.712, lng: 139.779, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.712, entranceLng: 139.779, exitLat: 35.712, exitLng: 139.779
            },
            { order: -6, displayName: "用賀（首都高）", googleName: "首都高速3号渋谷線 用賀出入口", lat: 35.626, lng: 139.633, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.626, entranceLng: 139.633, exitLat: 35.626, exitLng: 139.633
            },
            { order: -5, displayName: "霞が関（首都高）", googleName: "首都高速都心環状線 霞が関出入口", lat: 35.671, lng: 139.751, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.671, entranceLng: 139.751, exitLat: 35.671, exitLng: 139.751
            },
            { order: -4, displayName: "外苑（首都高）", googleName: "首都高速4号新宿線 外苑出入口", lat: 35.677, lng: 139.718, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.677, entranceLng: 139.718, exitLat: 35.677, exitLng: 139.718
            },
            { order: -3, displayName: "代官町（首都高）", googleName: "首都高速都心環状線 代官町出入口", lat: 35.688, lng: 139.754, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.688, entranceLng: 139.754, exitLat: 35.688, exitLng: 139.754
            },
            { order: -2, displayName: "一ツ橋（首都高）", googleName: "首都高速都心環状線 一ツ橋出入口", lat: 35.692, lng: 139.758, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.692, entranceLng: 139.758, exitLat: 35.692, exitLng: 139.758
            },
            { order: -1, displayName: "戸越（首都高）", googleName: "首都高速2号目黒線 戸越出入口", lat: 35.615, lng: 139.716, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.615, entranceLng: 139.716, exitLat: 35.615, exitLng: 139.716
            },
            { order: 1, displayName: "東京IC", googleName: "東名高速道路 東京インターチェンジ", lat: 35.6273557, lng: 139.6248741,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.6273557, entranceLng: 139.6248741, exitLat: 35.6276422, exitLng: 139.6246973,
                note: "【2026-07-16調査・座標のみ修正】Wikipedia「東京インターチェンジ」でハーフダイヤモンド型の構造であることを確認したが、これは物理的なランプ形状の分類であり、稲城IC・府中SIC等のような「特定方向に入口/出口が存在しない」制約とは異なる。都心方面のアクセスを分担する首都高速3号渋谷線「用賀出入口」は別施設・別インターチェンジであり、東京IC自体には入口・出口の機能がどちらも存在するため、entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はMapFan「東京ＩＣ（東名高速道路）【入口（下り）】」(35.6273557,139.6248741)・【出口（上り）】(35.6276422,139.6246973)で確認。従来座標(35.625,139.632)から約700m修正。"
            },
            { order: 2, displayName: "東名川崎IC", googleName: "東名高速道路 東名川崎インターチェンジ", lat: 35.5876733, lng: 139.57041,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.5876733, entranceLng: 139.57041, exitLat: 35.5876255, exitLng: 139.5701459,
                note: "【2026-07-16調査・座標のみ修正】NEXCO中日本公式・WikipediaにフルIC/ハーフICの明示的な記載は見つからなかったが、NAVITIMEで「上り出口」「下り入口」の個別ページの存在を確認し、フルICと推定（断定はできず、状況証拠による判断）。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はMapFan「東名川崎ＩＣ（東名高速道路）【入口】」(35.5876733,139.57041)「【出口】」(35.5876255,139.5701459)で確認（方向表記なし）。従来座標(35.589,139.587)から約1.5km修正。"
            },
            { order: 3, displayName: "横浜青葉IC", googleName: "東名高速道路 横浜青葉インターチェンジ", lat: 35.5468902, lng: 139.5373508, connection: true, connectedRoads: ["tomei", "shutoKanagawaK7Hokusei"],
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.5468902, entranceLng: 139.5373508, exitLat: 35.5467682, exitLng: 139.5371382,
                note: "【2026-07-16調査・座標のみ修正】Wikipedia「横浜青葉インターチェンジ」で、東名高速道路と首都高速神奈川7号横浜北西線が全方向で接続するフルICであることを確認（料金所15ブース、東名入口3・東名出口6等）。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はMapFan「横浜青葉ＩＣ（東名高速道路）【入口】」(35.5468902,139.5373508)「【出口】」(35.5467682,139.5371382)で確認（方向表記なし）。従来座標(35.542,139.537)から約530m修正。"
            },
            { order: 4, displayName: "横浜町田IC", googleName: "東名高速道路 横浜町田インターチェンジ", lat: 35.507576, lng: 139.481609, connection: true, connectedRoads: ["tomei", "hodogayaBypass"],
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.507576, entranceLng: 139.481609, exitLat: 35.5075599, exitLng: 139.4819814,
                note: "【2026-07-16調査・座標のみ修正】Wikipedia「横浜町田インターチェンジ」で、上下線とも入出口完備のフルICであることを確認（東名4番と保土ヶ谷バイパスの共用施設、料金所番号01-104・01-144で統一管理）。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はMapFan「横浜町田ＩＣ（東名高速道路）【入口】」(35.507576,139.481609)「【出口】」(35.5075599,139.4819814)で確認（方向表記なし）。従来座標(35.513,139.474)から約920m修正。hodogayaBypass側の横浜町田ICと同一施設のため、同一座標に統一した。"
            },
            { order: 5, displayName: "綾瀬SIC", googleName: "東名高速道路 綾瀬スマートインターチェンジ", lat: 35.4487631, lng: 139.4196304,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.4487631, entranceLng: 139.4196304, exitLat: 35.4464764, exitLng: 139.421388,
                note: "【2026-07-14調査・座標のみ修正】2021年3月31日開通。WebSearchで「上り（東京方面）と下り（名古屋方面）双方の本線へ直結するフルインター」と確認。MapFanで入口（上り・下り）・出口（上り・下り）の4個別ページ全ての存在を確認。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(上り)(35.4487631,139.4196304)、exitLat/Lngを出口(下り)(35.4464764,139.421388)に設定。従来座標(35.436,139.429)から約1,655m修正。"
            },
            { order: 6, displayName: "厚木IC", googleName: "東名高速道路 厚木インターチェンジ", lat: 35.4205747, lng: 139.3621027, connection: true, connectedRoads: ["tomei", "odawaraAtsugi"],
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.4205747, entranceLng: 139.3621027, exitLat: 35.4205472, exitLng: 139.3622253,
                note: "【2026-07-16調査・座標のみ修正】Wikipedia「厚木インターチェンジ」で、東名高速道路と小田原厚木道路のJCTを兼ねるフルICであることを確認（ただし小田原厚木道路と一般道路間の直接通行は不可、隣接の厚木西ICを利用する構造）。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はMapFan「厚木ＩＣ（東名高速道路）【入口】」(35.4205747,139.3621027)「【出口】」(35.4205472,139.3622253)で確認（方向表記なし）。従来座標(35.417,139.364)から約430m修正。odawaraAtsugi側の厚木ICと同一施設のため、同一座標に統一した。"
            },
            { order: 7, displayName: "秦野中井IC", googleName: "東名高速道路 秦野中井インターチェンジ", lat: 35.3537794, lng: 139.2357643,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.3537794, entranceLng: 139.2357643, exitLat: 35.3538401, exitLng: 139.2357799,
                note: "【2026-07-16調査・座標のみ修正】NEXCO中日本公式・WikipediaにフルIC/ハーフICの明示的な記載は見つからなかったが、接続道路が神奈川県道71号秦野二宮線のみで、MapFanにも方向表記のない入口・出口ページのみ存在することから、フルICと推定（断定はできず、状況証拠による判断）。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はMapFan「秦野中井ＩＣ（東名高速道路）【入口】」(35.3537794,139.2357643)「【出口】」(35.3538401,139.2357799)で確認。従来座標(35.374,139.214)から約3.0kmという、他の東名IC（後述）と比べても大きな修正。"
            },
            { order: 8, displayName: "大井松田IC", googleName: "東名高速道路 大井松田インターチェンジ", lat: 35.3411737, lng: 139.1515873,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.3411737, entranceLng: 139.1515873, exitLat: 35.3411461, exitLng: 139.1516771,
                note: "【2026-07-16調査・座標のみ修正】Wikipedia「大井松田インターチェンジ」で1969年5月26日にフルIC化したことを確認。下り線は「強制的に左ルート走行」となる特殊構造（右ルートは左ルート閉鎖時のみ使用）だが、これはランプ形状上の制約であり、entranceSelectable/exitSelectable判定には影響しない。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はMapFan「大井松田ＩＣ（東名高速道路）【入口】」(35.3411737,139.1515873)「【出口】」(35.3411461,139.1516771)で確認（方向表記なし）。従来座標(35.344,139.152)から約310m修正。"
            },
            { order: 8.5, displayName: "足柄SIC", googleName: "東名高速道路 足柄スマートインターチェンジ", lat: 35.3164564, lng: 138.9671662,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.3164564, entranceLng: 138.9671662, exitLat: 35.3157162, exitLng: 138.9683378,
                note: "【2026-07-14調査・座標のみ修正】2019年3月9日開通、足柄SA併設。WebSearchで「両方向（東京方面・名古屋方面）で24時間利用可能」と確認。MapFanで入口（上り・下り）・出口（上り・下り）の4個別ページ全ての存在を確認。上り線出口はSA構内経由でSA立ち寄り可能、下り線出口はSA立ち寄り不可という運用上の違いはあるが、entranceSelectable/exitSelectable判定には影響しない。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(上り)(35.3164564,138.9671662)、exitLat/Lngを出口(下り)(35.3157162,138.9683378)に設定。従来座標(35.314,138.966)から約293m修正。"
            },
            { order: 9, displayName: "御殿場IC", googleName: "東名高速道路 御殿場インターチェンジ", lat: 35.296, lng: 138.949,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.296, entranceLng: 138.949, exitLat: 35.296, exitLng: 138.949,
                note: "【2026-07-16調査・座標のみ修正】Wikipedia「御殿場インターチェンジ」で、御殿場料金所（第一、上下線とも利用可）と御殿場東料金所（第二、東京方面専用）の2料金所からなる複合構造のフルICであることを確認。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はMapFanで確認した入口(本線)(35.29515,138.9450343)・入口(上り)(35.2979761,138.9514864)・出口(下り)(35.2954153,138.9510274)・出口(上り)(35.2944951,138.9455824)の4地点（経度約700m・緯度約400mの範囲に分散）の代表点として(35.296,138.949)を暫定採用。従来座標(35.300,138.934)から約1.1〜1.6km修正。2料金所構造を厳密に反映するには、将来的に料金所単位でのレコード分離が必要な可能性があるが、今回は単純な代表点統一のみとした。"
            },
            { order: 9.5, displayName: "駒門SIC", googleName: "東名高速道路 駒門スマートインターチェンジ", lat: 35.253972, lng: 138.9076832,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.253972, entranceLng: 138.9076832, exitLat: 35.2383306, exitLng: 138.909969,
                note: "【2026-07-14調査・座標のみ修正】2020年3月28日開通。MapFanで入口（上り・下り）・出口（上り・下り）の4個別ページ全ての存在を確認し、NAVITIME・Yahoo!地図の独立クロスチェックでも座標を確認済み。Wikipedia「駒門パーキングエリア」記事で、駒門PA下り線側が新東名延伸工事に伴い2017年4月20日に約1.7km裾野IC方向へ移設されたことを確認しており、これが入口(上り)と出口(下り)の座標が約1.7km離れている理由である（物理的な移設が原因であり、座標誤りではない）。入口(上り)・出口(下り)の役割自体は単純で機能上の曖昧さはないため、entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(上り)(35.253972,138.9076832)、exitLat/Lngを出口(下り)(35.2383306,138.909969)に設定。従来座標(35.239,138.908)から約1,667m修正。"
            },
            { order: 10, displayName: "裾野IC", googleName: "東名高速道路 裾野インターチェンジ", lat: 35.2200013, lng: 138.9071753,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.2200013, entranceLng: 138.9071753, exitLat: 35.2198936, exitLng: 138.9072106,
                note: "【2026-07-16調査・座標のみ修正】Wikipedia「裾野インターチェンジ」でダイヤモンド型、上下線とも入出口ありのフルICであることを確認。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はMapFan入口(上り)「裾野ＩＣ（東名高速道路）【入口（上り）】」(35.2200013,138.9071753)・出口(下り)「【出口（下り）】」(35.2198936,138.9072106)で確認。従来座標(35.190,138.909)から約3.3kmという、今回調査中最大級の修正。"
            },
            { order: 11, displayName: "沼津IC", googleName: "東名高速道路 沼津インターチェンジ", lat: 35.1445525, lng: 138.8649064,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.1445525, entranceLng: 138.8649064, exitLat: 35.1454901, exitLng: 138.86547,
                note: "【2026-07-16調査・座標のみ修正】NEXCO中日本公式・WikipediaにフルIC/ハーフICの明示的な記載は見つからなかったが、伊豆縦貫自動車道とのJCT機能を兼ね、県道83号・405号に接続する構造から、フルICと推定（断定はできず、状況証拠による判断）。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はMapFan「沼津ＩＣ（東名高速道路）【入口】」(35.1445525,138.8649064)「【出口】」(35.1454901,138.86547)で確認（方向表記なし）。従来座標(35.156,138.860)から約1.3km修正。"
            },
            { order: 11.5, displayName: "愛鷹SIC", googleName: "東名高速道路 愛鷹スマートインターチェンジ", lat: 35.143973061378, lng: 138.83606316867,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.143973061378, entranceLng: 138.83606316867, exitLat: 35.1417214, exitLng: 138.837579,
                note: "【2026-07-14調査・座標のみ修正】静岡県初のスマートIC。WebSearchで「上下双方向で24時間利用可能」と確認。MapFanで入口（上り・下り）・出口（上り・下り）の4個別ページ全ての存在を確認。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(上り)(35.143973061378,138.83606316867)、exitLat/Lngを出口(下り)(35.1417214,138.837579)に設定。従来座標(35.143,138.837)から約138m修正。"
            },
            { order: 12, displayName: "富士IC", googleName: "東名高速道路 富士インターチェンジ", lat: 35.1771031, lng: 138.6758772,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.1771031, entranceLng: 138.6758772, exitLat: 35.1770776, exitLng: 138.676335,
                note: "【2026-07-16調査・座標のみ修正】Wikipedia「富士インターチェンジ」で、西富士道路とのJCT機能を兼ねるフルICであることを確認。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はMapFan「富士ＩＣ（東名高速道路）【入口】」(35.1771031,138.6758772)「【出口】」(35.1770776,138.676335)で確認（方向表記なし）。従来座標(35.180,138.671)から約560m修正。"
            },
            { order: 12.5, displayName: "富士川SIC", googleName: "東名高速道路 富士川スマートインターチェンジ", lat: 35.1617098, lng: 138.6193492,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.1617098, entranceLng: 138.6193492, exitLat: 35.1562755, exitLng: 138.6179363,
                note: "【2026-07-14調査・座標のみ修正】NEXCO中日本プレスリリース「3月18日 東名高速道路 富士川スマートＩＣが全方向でご利用が可能になります -名古屋方面(下り線)入口が開通します-」で、過去は下り線入口がないハーフICだったが現在は全方向利用可能なフルICであることを確認。entranceSelectable/exitSelectableは現状（フルIC）と一致しているため変更なし（trueのまま）。MapFanで方向表記のない【入口】ページと【出口（上り）】【出口（下り）】ページを確認。座標はentranceLat/Lngを入口(35.1617098,138.6193492)、exitLat/Lngを出口(下り)(35.1562755,138.6179363)に設定。従来座標(35.159,138.619)から約303m修正。"
            },
            { order: 13, displayName: "清水IC", googleName: "東名高速道路 清水インターチェンジ", lat: 35.038622, lng: 138.476897,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.038622, entranceLng: 138.476897, exitLat: 35.039272, exitLng: 138.477464,
                note: "【2026-07-16調査・座標のみ修正】Wikipedia「清水インターチェンジ（静岡県）」で旧シングルトランペット型からダブルトランペット型への改築により双方向出入り可能なフルICであることを確認。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はMapFan「清水ＩＣ（東名高速道路）【入口】」(35.038622,138.476897)「【出口】」(35.039272,138.477464)で確認（方向表記なし）。従来座標(35.037,138.477)から約210m修正。"
            },
            { order: 13.5, displayName: "日本平久能山SIC", googleName: "東名高速道路 日本平久能山スマートインターチェンジ", lat: 34.9591911, lng: 138.4245705,
                entranceSelectable: true, exitSelectable: true, entranceLat: 34.9591911, entranceLng: 138.4245705, exitLat: 34.9597322, exitLng: 138.4244571,
                note: "【2026-07-14調査・座標のみ修正】2019年9月14日開通。WebSearchで「本線へ直接接続するETC専用IC、上り・下りとも入口・出口があり、バスや大型トラックも利用可能なフルインター形式」と確認（静岡市公式サイトも確認）。MapFanでは方向表記のない【入口】【出口】の2ページ（約60m差、実質同一地点）を確認。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(34.9591911,138.4245705)、exitLat/Lngを出口(34.9597322,138.4244571)に設定。従来座標(34.962,138.422)から約391m修正。"
            },
            { order: 14, displayName: "静岡IC", googleName: "東名高速道路 静岡インターチェンジ", lat: 34.948088, lng: 138.390443,
                entranceSelectable: true, exitSelectable: true, entranceLat: 34.948088, entranceLng: 138.390443, exitLat: 34.947308, exitLng: 138.391065,
                note: "【2026-07-16調査・座標のみ修正】NEXCO中日本公式・WikipediaにフルIC/ハーフICの明示的な記載は見つからなかったが、MapFanの入口・出口とも方向表記がなく、料金所は双方向対応構成であることから、フルICと推定（断定はできず、状況証拠による判断）。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はMapFan「静岡ＩＣ（東名高速道路）【入口】」(34.948088,138.390443)「【出口】」(34.947308,138.391065)で確認。従来座標(34.944,138.395)から約550m修正。"
            },
            { order: 15, displayName: "焼津IC", googleName: "東名高速道路 焼津インターチェンジ", lat: 34.881388, lng: 138.301920,
                entranceSelectable: true, exitSelectable: true, entranceLat: 34.881388, entranceLng: 138.301920, exitLat: 34.881533, exitLng: 138.301740,
                note: "【2026-07-16調査・座標のみ修正】Wikipedia「焼津インターチェンジ」に「シングルトランペット型」との記載はあるがフルIC/ハーフICの明記はなし。MapFan入口・出口とも方向表記がないことから、フルICと推定（断定はできず、状況証拠による判断）。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はMapFan「焼津ＩＣ（東名高速道路）【入口】」(34.881388,138.301920)「【出口】」(34.881533,138.301740)で確認。従来座標(34.861,138.302)から約2.3kmという大きな修正。"
            },
            { order: 15.5, displayName: "大井川焼津藤枝SIC", googleName: "東名高速道路 大井川焼津藤枝スマートインターチェンジ", lat: 34.8191127, lng: 138.2623882,
                entranceSelectable: true, exitSelectable: true, entranceLat: 34.8191127, entranceLng: 138.2623882, exitLat: 34.8159419, exitLng: 138.2668815,
                note: "【2026-07-14調査・座標のみ修正】2016年3月12日開通、東名高速道路で最初の本線直結型スマートIC。WebSearchで「両方向で24時間利用可能」と確認。MapFanで入口（上り・下り）・出口（上り・下り）の4個別ページの存在を確認したが、出口(下り)の座標は複数回の検索でも取得できなかったため、exitLat/Lngは入口(下り)(34.8159419,138.2668815)の座標を暫定使用した。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(上り)(34.8191127,138.2623882)に設定。従来座標(34.821,138.269)から約640m修正。次回、出口(下り)の個別座標が確認できた場合は再検証が必要。"
            },
            { order: 16, displayName: "吉田IC", googleName: "東名高速道路 吉田インターチェンジ", lat: 34.791556, lng: 138.238301,
                entranceSelectable: true, exitSelectable: true, entranceLat: 34.791556, entranceLng: 138.238301, exitLat: 34.791556, exitLng: 138.238301,
                note: "【2026-07-16調査・座標のみ修正】Wikipedia「吉田インターチェンジ」で入口3・出口4ブースを備えるフルICであることを確認。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はMapFan「吉田ＩＣ（東名高速道路）【入口】」(34.791556,138.238301)で確認したが、出口側のMapFan個別ページは検索で特定できなかったため、entranceLat/Lngと同一値をexitLat/Lngにも暫定使用した（新保土ヶ谷IC等と同じフォールバック方式）。従来座標(34.781,138.252)から約1.7km修正。次回、出口側の個別座標が確認できた場合は再検証が必要。"
            },
            { order: 17, displayName: "相良牧之原IC", googleName: "東名高速道路 相良牧之原インターチェンジ", lat: 34.759116, lng: 138.141403,
                entranceSelectable: true, exitSelectable: true, entranceLat: 34.759116, entranceLng: 138.141403, exitLat: 34.759116, exitLng: 138.141403,
                note: "【2026-07-16調査・座標のみ修正】NEXCO中日本公式・WikipediaにフルIC/ハーフICの明示的な記載は見つからなかったが、NAVITIMEで上り入口・下り入口とも存在を確認し、MapFanも方向表記がないことから、フルICと推定（断定はできず、状況証拠による判断）。座標はMapFan「相良牧之原ＩＣ（東名高速道路）【出口】」(34.759116,138.141403)で確認したが、入口側のMapFan個別ページは検索で特定できなかったため、exitLat/Lngと同一値をentranceLat/Lngにも暫定使用した（新保土ヶ谷IC等と同じフォールバック方式）。entranceSelectable/exitSelectableは変更なし（trueのまま）。従来座標(34.735,138.179)から約4.3kmという、今回調査中で最大級の修正。次回、入口側の個別座標が確認できた場合は再検証が必要。"
            },
            { order: 18, displayName: "菊川IC", googleName: "東名高速道路 菊川インターチェンジ", lat: 34.746543, lng: 138.088569,
                entranceSelectable: true, exitSelectable: true, entranceLat: 34.746543, entranceLng: 138.088569, exitLat: 34.746879, exitLng: 138.088003,
                note: "【2026-07-16調査・座標のみ修正】NEXCO中日本公式・WikipediaにフルIC/ハーフICの明示的な記載は見つからなかったが、NAVITIMEで上り出口・下り出口・下り入口の存在を確認し、MapFanも方向表記がないことから、フルICと推定（断定はできず、状況証拠による判断。なお2025年1月に下り線出口の夜間閉鎖工事の実施を確認したが恒常的な構造制限ではない）。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はMapFan「菊川ＩＣ（東名高速道路）【入口】」(34.746543,138.088569)「【出口】」(34.746879,138.088003)で確認。従来座標(34.748,138.086)から約250m修正。"
            },
            { order: 19, displayName: "掛川IC", googleName: "東名高速道路 掛川インターチェンジ", lat: 34.761578, lng: 138.024610,
                entranceSelectable: true, exitSelectable: true, entranceLat: 34.761578, entranceLng: 138.024610, exitLat: 34.761231, exitLng: 138.024617,
                note: "【2026-07-16調査・座標のみ修正】Wikipedia「掛川インターチェンジ」で「開発インターチェンジ」（入口2・出口4ブース）のフルICであることを確認。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はMapFan「掛川ＩＣ（東名高速道路）【入口】」(34.761578,138.024610)「【出口】」(34.761231,138.024617)で確認。従来座標(34.754,137.999)から約2.5kmという大きな修正。"
            },
            { order: 20, displayName: "袋井IC", googleName: "東名高速道路 袋井インターチェンジ", lat: 34.758980, lng: 137.904915,
                entranceSelectable: true, exitSelectable: true, entranceLat: 34.758980, entranceLng: 137.904915, exitLat: 34.759658, exitLng: 137.904507,
                note: "【2026-07-16調査・座標のみ修正】Wikipedia「袋井インターチェンジ」で出入口両方装備（入口3・出口5ブース）のフルICであることを確認。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はMapFan「袋井ＩＣ（東名高速道路）【入口】」(34.758980,137.904915)「【出口】」(34.759658,137.904507)で確認。従来座標(34.749,137.908)から約1.2km修正。"
            },
            { order: 21, displayName: "磐田IC", googleName: "東名高速道路 磐田インターチェンジ", lat: 34.746718, lng: 137.857452,
                entranceSelectable: true, exitSelectable: true, entranceLat: 34.746718, entranceLng: 137.857452, exitLat: 34.746658, exitLng: 137.857488,
                note: "【2026-07-16調査・座標のみ修正】Wikipedia「磐田インターチェンジ」で「開発インターチェンジ」（磐田原PA跡地に建設）のフルICであることを確認。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はWikipedia本体座標・MapFan入口・MapFan出口の3つの独立情報源が34.746〜34.750, 137.857〜137.860の範囲で一致しており信頼度が高い。MapFan「磐田ＩＣ（東名高速道路）【入口】」(34.746718,137.857452)「【出口】」(34.746658,137.857488)で確認。従来座標(34.783,137.823)から約5.1kmという、今回調査全体で最大の修正（最優先で修正）。"
            },
            { order: 21.5, displayName: "遠州豊田SIC", googleName: "東名高速道路 遠州豊田スマートインターチェンジ", lat: 34.749788, lng: 137.8412663,
                entranceSelectable: true, exitSelectable: true, entranceLat: 34.749788, entranceLng: 137.8412663, exitLat: 34.7465646, exitLng: 137.8394543,
                note: "【2026-07-14調査・座標のみ修正】遠州豊田PA併設。WebSearchで「上り出口・上り入口・下り出口・下り入口の4方向」の存在を確認（「上下線ともに遠州豊田スマートIC入口から遠州豊田PAの利用はできません」という運用上の注意点はあるが、entranceSelectable/exitSelectable判定には影響しない）。MapFanで4個別ページ全ての存在を確認。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(上り)(34.749788,137.8412663)、exitLat/Lngを出口(下り)(34.7465646,137.8394543)に設定。従来座標(34.748,137.840)から約230m修正。"
            },
            { order: 22, displayName: "浜松IC", googleName: "東名高速道路 浜松インターチェンジ", lat: 34.744809, lng: 137.788785,
                entranceSelectable: true, exitSelectable: true, entranceLat: 34.744809, entranceLng: 137.788785, exitLat: 34.744935, exitLng: 137.788960,
                note: "【2026-07-16調査・座標のみ修正】Wikipedia「浜松インターチェンジ」にフルIC/ハーフICの明示的な記載はないが、「かつて信号交差点だったが平成にランプウェイ化」との記述、およびMapFan入口・出口とも方向表記がないことから、フルICと推定（断定はできず、状況証拠による判断）。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はMapFan「浜松ＩＣ（東名高速道路）【入口】」(34.744809,137.788785)「【出口】」(34.744935,137.788960)で確認。従来座標(34.758,137.773)から約2.0km修正。"
            }
        ]
    },


    daisanKeihin: {
        label: "第三京浜方面",
        exits: [
            { order: 1, displayName: "玉川IC", googleName: "第三京浜道路 玉川インターチェンジ", lat: 35.6050817, lng: 139.6387438, roadType: "第三京浜", routeBranch: "daisanKeihin", branchOrder: 1,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.6050817, entranceLng: 139.6387438, exitLat: 35.6050817, exitLng: 139.6387438,
                note: "第三京浜道路の起点（東京都世田谷区、下り線起点・上り線終点）。MapFanで「玉川ＩＣ（第三京浜道路）【入口（下り）】」「【出口（上り）】」の個別ページを確認したが、「【入口（上り）】」「【出口（下り）】」に相当するページは見つからず、下り線入口・上り線出口のみと判断。本アプリは走行方向を区別できないため、入口方向（下り）を代表方向として採用し、上り出口はexitSelectable:falseとした。座標はMapFan「玉川ＩＣ（第三京浜道路）【入口（下り）】」個別ページで確認(35.6050817,139.6387438)。従来座標(35.604,139.645)から約580m修正。"
            },
            { order: 2, displayName: "京浜川崎IC", googleName: "第三京浜道路 京浜川崎インターチェンジ", lat: 35.5922815, lng: 139.6251989, roadType: "第三京浜", routeBranch: "daisanKeihin", branchOrder: 2,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.5922160, entranceLng: 139.6251414, exitLat: 35.5923469, exitLng: 139.6252564,
                note: "MapFanで「京浜川崎ＩＣ（第三京浜道路）」の【入口（上り）】【入口（下り）】【出口（上り）】【出口（下り）】4件全ての個別ページを確認し、上下線とも入口・出口が利用可能なフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標は入口2点（上り35.5925245,139.6251661／下り35.5919075,139.6251167）の中間点をentranceLat/Lngに、出口2点（下り35.5924073,139.625556／上り35.5922865,139.6249568）の中間点をexitLat/Lngに設定。従来座標(35.578,139.627)から約1.6km修正。"
            },
            { order: 3, displayName: "都筑IC", googleName: "第三京浜道路 都筑インターチェンジ", lat: 35.5439460, lng: 139.6038134, roadType: "第三京浜", routeBranch: "daisanKeihin", branchOrder: 3,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.5439689, entranceLng: 139.6037393, exitLat: 35.543923, exitLng: 139.6038874,
                note: "MapFanで「都筑ＩＣ（第三京浜道路）【入口】」「【出口】」を確認（上り/下りの区別なく1箇所に集約されたランプ）。NEXCO東日本のプレスリリース「第三京浜道路 上下線 都筑IC 入口ランプ 一部夜間閉鎖」(e-nexco.co.jp/en/pressroom/kanto/2023/0130/00012233.html)でも上下線とも利用可能である旨を確認。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はMapFanの入口・出口個別ページで確認しentranceLat/Lng・exitLat/Lngを更新。従来座標(35.544,139.592)から約950m修正。"
            },
            { order: 4, displayName: "港北IC", googleName: "第三京浜道路 港北インターチェンジ", lat: 35.5167255, lng: 139.5900747, roadType: "第三京浜", routeBranch: "daisanKeihin", branchOrder: 4, connection: true, connectedRoads: ["daisanKeihin", "shutoKanagawaK7", "shutoKanagawaK7Hokusei"],
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.5168611, entranceLng: 139.5903193, exitLat: 35.5165898, exitLng: 139.58983,
                note: "MapFanで「港北ＩＣ（第三京浜道路）【入口】」「【出口】」を確認（上り/下りの区別なく1箇所に集約されたランプ）。NEXCO東日本のプレスリリース「港北IC出口位置変更のお知らせ」「上り線 港北IC 入口ランプ 夜間閉鎖」等でも入口・出口双方の存在を確認済み。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はMapFanの入口・出口個別ページで確認しentranceLat/Lng・exitLat/Lngを更新。従来座標(35.519,139.600)から約900m修正。connectedRoadsのshutoKanagawaK7/shutoKanagawaK7Hokuseiは今回変更していない（別タスク扱い）。"
            },
            { order: 5, displayName: "羽沢IC", googleName: "第三京浜道路 羽沢インターチェンジ", lat: 35.4852055, lng: 139.5898595, roadType: "第三京浜", routeBranch: "daisanKeihin", branchOrder: 5,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.4852055, entranceLng: 139.5898595, exitLat: 35.4852055, exitLng: 139.5898595,
                note: "上り線入口（1988年供用開始）・下り線出口（2011年供用開始）で方向別に段階供用されたハーフIC（Wikipedia「第三京浜道路」記事に記載。MapFanでも「【入口（上り）】」「【出口（下り）】」の個別ページのみ確認でき「【入口（下り）】」「【出口（上り）】」は見つからない）。本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。座標はMapFan「羽沢ＩＣ（第三京浜道路）【入口（上り）】」個別ページで確認(35.4852055,139.5898595)。従来座標(35.492,139.592)から約780m修正。"
            },
            { order: 6, displayName: "保土ヶ谷IC", googleName: "第三京浜道路 保土ヶ谷インターチェンジ", lat: 35.4739368, lng: 139.5992145, roadType: "第三京浜", routeBranch: "daisanKeihin", branchOrder: 6, connection: true, connectedRoads: ["daisanKeihin", "yokohamaShindo"],
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.4739368, entranceLng: 139.5992145, exitLat: 35.4739368, exitLng: 139.5992145,
                note: "第三京浜道路の終点（横浜市保土ケ谷区、横浜新道・保土ヶ谷JCTと隣接する複合IC）。MapFanで「保土ヶ谷ＩＣ（第三京浜道路）【入口（上り）】」「【出口（下り）】」の個別ページを確認したが、「【入口（下り）】」「【出口（上り）】」に相当するページは見つからず、上り線入口・下り線出口のみと判断（起点の玉川ICと対称の構造）。本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。座標はMapFan「保土ヶ谷ＩＣ（第三京浜道路）【入口（上り）】」個別ページで確認(35.4739368,139.5992145)。従来座標(35.474,139.586)から約1.2km修正。connectedRoadsは今回変更していない。"
            }
        ]
    },


    yokohamaShindo: {
        label: "横浜新道方面",
        exits: [
            { order: 1, displayName: "保土ヶ谷IC", googleName: "横浜新道 保土ヶ谷インターチェンジ", lat: 35.47087, lng: 139.5945796, roadType: "横浜新道", routeBranch: "yokohamaShindo", branchOrder: 1, connection: true, connectedRoads: ["yokohamaShindo", "daisanKeihin"],
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.47087, entranceLng: 139.5945796, exitLat: 35.47087, exitLng: 139.5945796,
                note: "daisanKeihin側の保土ヶ谷ICとは別名称の施設（第三京浜道路 保土ヶ谷ICとは逆方向）。MapFanで「保土ヶ谷ＩＣ（横浜新道）【入口（下り）】」「【出口（上り）】」の個別ページを確認したが、「【入口（上り）】」「【出口（下り）】」に相当するページは見つからず、下り線入口・上り線出口のみと判断。本アプリは走行方向を区別できないため、入口方向（下り）を代表方向として採用し、上り出口はexitSelectable:falseとした。座標はMapFan「保土ヶ谷ＩＣ（横浜新道）【入口（下り）】」個別ページで確認(35.47087,139.5945796)。従来座標(35.474,139.586)から約850m修正。"
            },
            { order: 2, displayName: "常盤台出口", googleName: "横浜新道 常盤台出口", lat: 35.470693, lng: 139.594187, roadType: "横浜新道", routeBranch: "yokohamaShindo", branchOrder: 2,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.470693, entranceLng: 139.594187, exitLat: 35.4701192, exitLng: 139.5932507,
                note: "MapFanで「常盤台ＩＣ（横浜新道）【出口（上り）】」の個別ページを確認(35.4701192,139.5932507)。下り線入口はMapFanの個別ページが見つからず、NAVITIMEのPOI「横浜新道 常盤台 下り 入口」（座標35.470693,139.594187、上り出口から約95m）で存在を確認。入口（下り）・出口（上り）の存在は確認できたが「【入口（上り）】」「【出口（下り）】」は見つからず、方向限定と判断。本アプリは走行方向を区別できないため、入口方向（下り）を代表方向として採用し、上り出口はexitSelectable:falseとした。entranceLat/Lngの座標源はMapFanではなくNAVITIME（精度はMapFan個別ページより劣る可能性あり）。従来座標(35.473,139.590)から約270m修正。"
            },
            { order: 3, displayName: "峰岡出口", googleName: "横浜新道 峰岡出口", lat: 35.4654828, lng: 139.5917984, roadType: "横浜新道", routeBranch: "yokohamaShindo", branchOrder: 3,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.4654828, entranceLng: 139.5917984, exitLat: 35.4654828, exitLng: 139.5917984,
                note: "Wikipedia「峰岡インターチェンジ」記事で、開通当初は下り線に入口・出口とも存在したが、合流の危険性から1996年の横浜新道改良時に入口を廃止し、以後は下り線出口のみのクォーターICになったことを確認。MapFanでも「【出口（下り）】」の個別ページのみ存在し「【入口】」に相当するページは無し。よってentranceSelectable:falseとした（方向限定ではなく入口自体が現存しない）。座標はMapFan「峰岡ＩＣ（横浜新道）【出口（下り）】」個別ページで確認(35.4654828,139.5917984)。従来座標(35.463,139.590)から約320m修正。"
            },
            { order: 4, displayName: "星川入口", googleName: "横浜新道 星川入口", lat: 35.4602758, lng: 139.5882476, roadType: "横浜新道", routeBranch: "yokohamaShindo", branchOrder: 4,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.4602758, entranceLng: 139.5882476, exitLat: 35.4602758, exitLng: 139.5882476,
                note: "Wikipedia「星川インターチェンジ」記事で、下り線入口のみのクォーターICであり出口は存在しないことを確認。MapFanでも「【入口（下り）】」の個別ページのみ存在し「【出口】」に相当するページは無し。よってexitSelectable:falseとした（方向限定ではなく出口自体が現存しない）。座標はMapFan「星川ＩＣ（横浜新道）【入口（下り）】」個別ページで確認(35.4602758,139.5882476)。従来座標(35.459,139.588)から約130m修正。"
            },
            { order: 5, displayName: "藤塚IC", googleName: "横浜新道 藤塚インターチェンジ", lat: 35.4520219, lng: 139.5735383, roadType: "横浜新道", routeBranch: "yokohamaShindo", branchOrder: 5,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.4520219, entranceLng: 139.5735383, exitLat: 35.4520219, exitLng: 139.5735383,
                note: "Wikipedia「横浜新道」記事の一覧表で「新保土ヶ谷ICのランプと接続（横浜新道本線とは接続していない）下り線は出口のみ」と記載されていることを確認。MapFanでも「【入口（上り）】」「【出口】」の個別ページのみ確認でき「【入口（下り）】」に相当するページは無し。本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。座標はMapFan「藤塚ＩＣ（横浜新道）【入口（上り）】」個別ページで確認(35.4520219,139.5735383)。従来座標(35.458,139.567)から約850m修正。"
            },
            { order: 6, displayName: "新保土ヶ谷IC", googleName: "横浜新道 新保土ヶ谷インターチェンジ", lat: 35.451481755027, lng: 139.56704453685, roadType: "横浜新道", routeBranch: "yokohamaShindo", branchOrder: 6, connection: true, connectedRoads: ["yokohamaShindo", "hodogayaBypass"],
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.451481755027, entranceLng: 139.56704453685, exitLat: 35.451481755027, exitLng: 139.56704453685,
                note: "MapFanで「新保土ヶ谷ＩＣ（横浜新道）【入口】」「【出口】」を確認（上り/下りの区別なし＝両方向利用可能）。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標は【入口】ページのルート検索結果に埋め込まれた座標(35.451481755027,139.56704453685)を使用（【出口】個別ページはアクセス時に404となり直接確認できなかったため、entranceLat/Lngと同一値をexitLat/Lngにも使用。至近距離の同一JCTのため実用上の誤差は小さいと判断）。従来座標(35.455,139.557)から約950m修正。"
            },
            { order: 7, displayName: "今井IC", googleName: "横浜新道 今井インターチェンジ", lat: 35.4429, lng: 139.5605, roadType: "横浜新道", routeBranch: "yokohamaShindo", branchOrder: 7,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.4437025, entranceLng: 139.5603989, exitLat: 35.4420949, exitLng: 139.5605898,
                note: "MapFanで「今井ＩＣ（横浜新道）【入口（上り）】」「【入口（下り）】」「【出口（下り）】」の3個別ページを確認。「【出口（上り）】」のMapFan個別ページは検索で見つからなかったが、NAVITIMEに「今井IC 上り 出口」のPOIが別途存在することを確認し、上下線とも入口・出口が利用可能なフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(上り)(35.4437025,139.5603989)、exitLat/Lngを出口(下り)(35.4420949,139.5605898)に設定。従来座標(35.441,139.551)から約850m修正。"
            },
            { order: 8, displayName: "川上IC", googleName: "横浜新道 川上インターチェンジ", lat: 35.43047, lng: 139.55101, roadType: "横浜新道", routeBranch: "yokohamaShindo", branchOrder: 8,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.4311727, entranceLng: 139.5512192, exitLat: 35.4297672, exitLng: 139.5508059,
                note: "MapFanで「川上ＩＣ（横浜新道）【入口（上り）】」「【出口（上り）】」「【出口（下り）】」の3個別ページを確認。「【入口（下り）】」のMapFan個別ページは検索で見つからなかったが、NAVITIMEに「川上IC 下り 入口」のPOIが別途存在することを確認し、上下線とも入口・出口が利用可能なフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(上り)(35.4311727,139.5512192)、exitLat/Lngを出口(下り)(35.4297672,139.5508059)に設定。従来座標(35.429,139.542)から約650m修正。"
            },
            { order: 9, displayName: "上矢部IC", googleName: "横浜新道 上矢部インターチェンジ", lat: 35.4186287, lng: 139.5372975, roadType: "横浜新道", routeBranch: "yokohamaShindo", branchOrder: 9,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.4186287, entranceLng: 139.5372975, exitLat: 35.4186287, exitLng: 139.5372975,
                note: "Wikipedia「横浜新道」記事の一覧表で「下り線は入口のみ」と記載されていることを確認。MapFan・NAVITIMEでも「上り入口」「上り出口」「下り入口」の3種が確認でき、「下り出口」に相当するページは見つからなかった。すなわち入口は上下線とも利用可能（universal）だが、出口は上り線のみで下り線に出口が無い（方向限定）。本アプリは走行方向を区別できないため、上下線とも利用可能な入口をentranceSelectable:trueとし、方向限定のある出口をexitSelectable:falseとした（従来の代表方向＝入口を優先する方針と整合）。座標はMapFan「上矢部ＩＣ（横浜新道）【入口（上り）】」個別ページで確認(35.4186287,139.5372975)。従来座標(35.409,139.529)から約1.3km修正。"
            },
            { order: 10, displayName: "戸塚終点", googleName: "横浜新道 戸塚終点", lat: 35.4121206, lng: 139.5321646, roadType: "横浜新道", routeBranch: "yokohamaShindo", branchOrder: 10,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.4121206, entranceLng: 139.5321646, exitLat: 35.4121206, exitLng: 139.5321646,
                note: "横浜新道の終点（横浜市戸塚区、国道1号戸塚道路に接続）。MapFanでは本施設が「戸塚ＩＣ（横浜新道）」の名称で登録されており、「【入口（上り）】」「【出口（下り）】」の個別ページを確認したが、「【入口（下り）】」「【出口（上り）】」に相当するページは見つからず、上り線入口・下り線出口のみと判断（起点側の玉川IC・保土ヶ谷ICと同様の終点特有の構造）。本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。displayNameは既存の「戸塚終点」を維持（MapFan上の表記は「戸塚IC」）。座標はMapFan「戸塚ＩＣ（横浜新道）【入口（上り）】」個別ページで確認(35.4121206,139.5321646)。従来座標(35.397,139.530)から約1.7km修正。"
            }
        ]
    },


    hodogayaBypass: {
        label: "保土ヶ谷バイパス方面",
        exits: [
            { order: 1, displayName: "新保土ヶ谷IC", googleName: "保土ヶ谷バイパス 新保土ヶ谷インターチェンジ", lat: 35.451481755027, lng: 139.56704453685, roadType: "保土ヶ谷バイパス", routeBranch: "hodogayaBypass", branchOrder: 1, connection: true, connectedRoads: ["hodogayaBypass", "yokohamaShindo"],
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.451481755027, entranceLng: 139.56704453685, exitLat: 35.451481755027, exitLng: 139.56704453685,
                note: "yokohamaShindo側の新保土ヶ谷IC（同一JCT）と同じ座標・方向判定を採用。NAVITIMEに「保土ヶ谷バイパス 新保土ヶ谷IC 上り 出口」等のPOIがあり、保土ヶ谷バイパス側でも入口・出口とも存在することを確認したが、保土ヶ谷バイパス（国道16号バイパス）はNEXCO管轄外の国交省管理道路のためMapFanの個別ランプページが少なく、hodogayaBypass専用の座標は確認できなかった。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はyokohamaShindo側で確認済みの新保土ヶ谷IC【入口】座標を流用。従来座標(35.455,139.557)から約950m修正。"
            },
            { order: 2, displayName: "新桜ヶ丘IC", googleName: "保土ヶ谷バイパス 新桜ヶ丘インターチェンジ", lat: 35.45349, lng: 139.559043, roadType: "保土ヶ谷バイパス", routeBranch: "hodogayaBypass", branchOrder: 2,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.45349, entranceLng: 139.559043, exitLat: 35.45349, exitLng: 139.559043,
                note: "NAVITIMEのPOIで「保土ヶ谷バイパス 新桜ヶ丘IC 上り 入口」「下り 出口」の存在を確認したが、「上り出口」「下り入口」に相当するPOIは見つからず、方向限定と判断。本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。保土ヶ谷バイパスはMapFanの個別ランプページが乏しく、座標はNAVITIME掲載の一般座標(35.45349,139.559043)を使用（ランプ単位の精度ではない可能性あり）。従来座標(35.451,139.542)から約1.5km修正。"
            },
            { order: 3, displayName: "南本宿IC", googleName: "保土ヶ谷バイパス 南本宿インターチェンジ", lat: 35.457, lng: 139.526, roadType: "保土ヶ谷バイパス", routeBranch: "hodogayaBypass", branchOrder: 3,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.457, entranceLng: 139.526, exitLat: 35.457, exitLng: 139.526,
                note: "NAVITIMEのPOIで「保土ヶ谷バイパス 南本宿IC 上り 入口」「上り 出口」「下り 出口」の3種の存在を確認したが、「下り 入口」に相当するPOIは見つからなかった。すなわち出口は上下線とも利用可能（universal）だが、入口は上り線のみで下り線に入口が無い（方向限定）。本アプリは走行方向を区別できないため、上下線とも利用可能な出口をexitSelectable:trueとし、方向限定のある入口をentranceSelectable:falseとした。座標はMapFan・NAVITIMEともランプ単位の緯度経度が確認できなかったため、既存座標(35.457,139.526)を維持（精度未確認、要再確認）。"
            },
            { order: 4, displayName: "本村IC", googleName: "保土ヶ谷バイパス 本村インターチェンジ", lat: 35.4667, lng: 139.535783, roadType: "保土ヶ谷バイパス", routeBranch: "hodogayaBypass", branchOrder: 4,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.466905, entranceLng: 139.535771, exitLat: 35.466461, exitLng: 139.535794,
                note: "NAVITIMEのPOIで「保土ヶ谷バイパス 本村IC 上り 入口」「下り 出口」「下り 入口」に加え、上り出口の存在も別ソース（SpotsNinja）で確認でき、上下線とも入口・出口が利用可能なフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。保土ヶ谷バイパスはMapFanの個別ランプページが乏しく、座標はNAVITIME掲載の座標（entranceLat/Lngは上り入口35.466905,139.535771、exitLat/Lngは下り出口35.466461,139.535794）を使用。従来座標(35.466,139.514)から約1.9km修正。"
            },
            { order: 5, displayName: "下川井IC", googleName: "保土ヶ谷バイパス 下川井インターチェンジ", lat: 35.481422, lng: 139.51546, roadType: "保土ヶ谷バイパス", routeBranch: "hodogayaBypass", branchOrder: 5,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.482348, entranceLng: 139.514068, exitLat: 35.480496, exitLng: 139.516852,
                note: "NAVITIMEのPOIで「保土ヶ谷バイパス 下川井IC」の上り入口・上り出口・下り入口・下り出口の4種全ての存在を確認し、上下線とも入口・出口が利用可能なフルICと判断（1974年、狩場IC～上川井IC区間開通時から供用）。entranceSelectable/exitSelectableは変更なし（trueのまま）。保土ヶ谷バイパスはMapFanの個別ランプページが乏しく、座標はNAVITIME掲載の座標（entranceLat/Lngは上り入口35.482348,139.514068、exitLat/Lngは下り出口35.480496,139.516852）を使用。従来座標(35.486,139.506)から約900m修正。"
            },
            { order: 6, displayName: "上川井IC", googleName: "保土ヶ谷バイパス 上川井インターチェンジ", lat: 35.494309, lng: 139.499432, roadType: "保土ヶ谷バイパス", routeBranch: "hodogayaBypass", branchOrder: 6,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.494309, entranceLng: 139.499432, exitLat: 35.494309, exitLng: 139.499432,
                note: "NAVITIMEのPOIで「保土ヶ谷バイパス 上川井IC」は上り入口・下り出口の存在のみ確認でき、上り出口・下り入口に相当するPOIは見つからず、方向限定と判断。本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。保土ヶ谷バイパスはMapFanの個別ランプページが乏しく、座標はNAVITIME掲載の一般座標(35.494309,139.499432)を使用（ランプ単位の精度ではない可能性あり）。従来座標(35.497,139.494)から約540m修正。"
            },
            { order: 7, displayName: "横浜町田IC", googleName: "保土ヶ谷バイパス 横浜町田インターチェンジ", lat: 35.507576, lng: 139.481609, roadType: "保土ヶ谷バイパス", routeBranch: "hodogayaBypass", branchOrder: 7, connection: true, connectedRoads: ["hodogayaBypass", "tomei"],
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.507576, entranceLng: 139.481609, exitLat: 35.5075599, exitLng: 139.4819814,
                note: "【2026-07-16調査・座標のみ修正】tomei側の横浜町田IC（東名高速道路 横浜町田インターチェンジ）と同一施設・同一検証結果（フルIC、MapFan確認）。座標をtomei側で確認済みの値(35.507576,139.481609／35.5075599,139.4819814)に統一した。従来座標(35.513,139.474)から約920m修正。なお、以前の調査で「横浜町田IC～上川井IC相互間の出入は不可」という趣旨の情報（保土ヶ谷バイパス「町田立体」区間の段階開通に起因）が見つかっており、これは単純な上り/下り・入口/出口の方向限定ではなく隣接IC間の特定区間での通行制限とみられ、本アプリのentranceSelectable/exitSelectableモデルでは正確に表現できない可能性が高い。この点は未解決のため、entranceSelectable/exitSelectable自体は今回も変更していない（trueのまま）。次回、町田立体の開通区間・通行可否をより詳しく確認したうえで再検証が必要。"
            }
        ]
    },


    odawaraAtsugi: {
        label: "小田原厚木道路方面",
        exits: [
            {
                order: 1,
                displayName: "厚木IC",
                googleName: "小田原厚木道路 厚木インターチェンジ",
                lat: 35.4205747,
                lng: 139.3621027,
                roadType: "小田原厚木道路",
                routeBranch: "odawaraAtsugi",
                branchOrder: 1,
                connection: true,
                connectedRoads: ["tomei", "odawaraAtsugi"],
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.4205747, entranceLng: 139.3621027, exitLat: 35.4205472, exitLng: 139.3622253,
                note: "【2026-07-16調査・座標のみ修正】tomei側の厚木IC（東名高速道路 厚木インターチェンジ）と同一施設・同一検証結果（フルIC、東名高速道路と小田原厚木道路のJCTを兼ねる。小田原厚木道路と一般道路間の直接通行は不可、隣接の厚木西ICを利用する構造。MapFan確認）。座標をtomei側で確認済みの値(35.4205747,139.3621027／35.4205472,139.3622253)に統一した。従来座標(35.417,139.364)から約430m修正。"
            },
            {
                order: 2,
                displayName: "厚木西IC",
                googleName: "小田原厚木道路 厚木西インターチェンジ",
                lat: 35.41657,
                lng: 139.3509,
                roadType: "小田原厚木道路",
                routeBranch: "odawaraAtsugi",
                branchOrder: 2,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.41657, entranceLng: 139.3509, exitLat: 35.41657, exitLng: 139.3509
            },
            {
                order: 3,
                displayName: "伊勢原IC",
                googleName: "小田原厚木道路 伊勢原インターチェンジ",
                lat: 35.38629,
                lng: 139.3314,
                roadType: "小田原厚木道路",
                routeBranch: "odawaraAtsugi",
                branchOrder: 3,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.38629, entranceLng: 139.3314, exitLat: 35.38629, exitLng: 139.3314
            },
            {
                order: 4,
                displayName: "平塚IC",
                googleName: "小田原厚木道路 平塚インターチェンジ",
                lat: 35.35883,
                lng: 139.3028,
                roadType: "小田原厚木道路",
                routeBranch: "odawaraAtsugi",
                branchOrder: 4,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.35883, entranceLng: 139.3028, exitLat: 35.35883, exitLng: 139.3028
            },
            {
                order: 5,
                displayName: "大磯IC",
                googleName: "小田原厚木道路 大磯インターチェンジ",
                lat: 35.31957,
                lng: 139.2719,
                roadType: "小田原厚木道路",
                routeBranch: "odawaraAtsugi",
                branchOrder: 5,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.31957, entranceLng: 139.2719, exitLat: 35.31957, exitLng: 139.2719
            },
            {
                order: 6,
                displayName: "二宮IC",
                googleName: "小田原厚木道路 二宮インターチェンジ",
                lat: 35.30803,
                lng: 139.2378,
                roadType: "小田原厚木道路",
                routeBranch: "odawaraAtsugi",
                branchOrder: 6,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.30803, entranceLng: 139.2378, exitLat: 35.30803, exitLng: 139.2378
            },
            {
                order: 7,
                displayName: "小田原東IC",
                googleName: "小田原厚木道路 小田原東インターチェンジ",
                lat: 35.28621,
                lng: 139.1697,
                roadType: "小田原厚木道路",
                routeBranch: "odawaraAtsugi",
                branchOrder: 7,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.28621, entranceLng: 139.1697, exitLat: 35.28621, exitLng: 139.1697
            },
            {
                order: 8,
                displayName: "荻窪IC",
                googleName: "小田原厚木道路 荻窪インターチェンジ",
                lat: 35.25742,
                lng: 139.13601,
                roadType: "小田原厚木道路",
                routeBranch: "odawaraAtsugi",
                branchOrder: 8,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.25742, entranceLng: 139.13601, exitLat: 35.25742, exitLng: 139.13601
            },
            {
                order: 9,
                displayName: "小田原西IC",
                googleName: "小田原厚木道路 小田原西インターチェンジ",
                lat: 35.2446,
                lng: 139.1352,
                roadType: "小田原厚木道路",
                routeBranch: "odawaraAtsugi",
                branchOrder: 9,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.2446, entranceLng: 139.1352, exitLat: 35.2446, exitLng: 139.1352
            }
        ]
    },



    aqualine: {
        label: "アクアライン方面",
        exits: [
            { order: -8, displayName: "堤通（首都高）", googleName: "首都高速6号向島線 堤通出入口", lat: 35.7357056, lng: 139.8150419, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.7357056, entranceLng: 139.8150419, exitLat: 35.7357056, exitLng: 139.8150419,
                note: "【2026-07-19同期修正】SHUTO_IC_MASTER本体側（shuto-6-tsutsumidori、MapFan検証済み）の座標に同期。旧座標との誤差約548m。dedupeIcDefinitionsByIdentityによりSHUTO_IC_MASTER側が優先されるため候補選定への実害はなかったが、データ整合性のため修正。"
            },
            { order: -7, displayName: "上野（首都高）", googleName: "首都高速1号上野線 上野出入口", lat: 35.712, lng: 139.779, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.712, entranceLng: 139.779, exitLat: 35.712, exitLng: 139.779
            },
            { order: -6, displayName: "葛西（首都高）", googleName: "首都高速湾岸線 葛西出入口", lat: 35.652, lng: 139.870, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.652, entranceLng: 139.870, exitLat: 35.652, exitLng: 139.870
            },
            { order: -5, displayName: "湾岸市川（首都高）", googleName: "首都高速湾岸線 湾岸市川出入口", lat: 35.672, lng: 139.938, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.672, entranceLng: 139.938, exitLat: 35.672, exitLng: 139.938
            },
            { order: -4, displayName: "新木場（首都高）", googleName: "首都高速湾岸線 新木場出入口", lat: 35.645, lng: 139.827, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.645, entranceLng: 139.827, exitLat: 35.645, exitLng: 139.827
            },
            { order: -3, displayName: "有明（首都高）", googleName: "首都高速湾岸線 有明出入口", lat: 35.634, lng: 139.795, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.634, entranceLng: 139.795, exitLat: 35.634, exitLng: 139.795
            },
            { order: -2, displayName: "大井南（首都高）", googleName: "首都高速湾岸線 大井南出入口", lat: 35.589, lng: 139.756, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.589, entranceLng: 139.756, exitLat: 35.589, exitLng: 139.756
            },
            { order: -1, displayName: "空港中央（首都高）", googleName: "首都高速湾岸線 空港中央出入口", lat: 35.553, lng: 139.787, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.553, entranceLng: 139.787, exitLat: 35.553, exitLng: 139.787
            },
            {
                order: 1,
                displayName: "浮島IC",
                googleName: "首都高速湾岸線 浮島インターチェンジ",
                lat: 35.520593,
                lng: 139.787833,
                routeBranch: "aqualine",
                branchOrder: 1,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.520593, entranceLng: 139.787833, exitLat: 35.520593, exitLng: 139.787833,
                note: "MapFanで「浮島ＩＣ（東京湾アクアライン）【入口（下り）】」「【出口（上り）】」の個別ページを確認したが、「【入口（上り）】」「【出口（下り）】」に相当するページは見つからず、下り線入口・上り線出口のみと判断（川崎側の起点特有の構造）。本アプリは走行方向を区別できないため、入口方向（下り）を代表方向として採用し、上り出口はexitSelectable:falseとした。座標はMapFan「浮島ＩＣ（東京湾アクアライン）【入口（下り）】」個別ページで確認(35.520593,139.787833)。従来座標(35.521,139.788)からごくわずかな修正。なお既存googleNameは「首都高速湾岸線 浮島インターチェンジ」だが、MapFan上の施設名は「東京湾アクアライン」表記であり、既存googleNameは変更していない（要再確認）。"
            },
            {
                order: 2,
                displayName: "海ほたるPA",
                googleName: "東京湾アクアライン 海ほたるパーキングエリア",
                lat: 35.463,
                lng: 139.875,
                isSelectable: false,
                routeBranch: "aqualine",
                branchOrder: 1.5,
                entranceSelectable: false, exitSelectable: false, entranceLat: 35.463, entranceLng: 139.875, exitLat: 35.463, exitLng: 139.875,
                note: "海ほたるPAは東京湾アクアライン海上区間のパーキングエリアで、地上部との出入口を持たない（本線上のPAのみ）。isSelectable:false/entranceSelectable:false/exitSelectable:falseは妥当であり、変更していない。座標の個別確認は今回省略（PAのため候補選定への影響なし）。"
            },
            {
                order: 3,
                displayName: "木更津金田IC",
                googleName: "東京湾アクアライン 木更津金田インターチェンジ",
                lat: 35.4335959,
                lng: 139.9216386,
                connection: true,
                connectedRoads: ["aqualine", "tateyama"],
                routeBranch: "aqualine",
                branchOrder: 2,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.4335959, entranceLng: 139.9216386, exitLat: 35.4335959, exitLng: 139.9216386,
                note: "【確認不可・複雑につき変更保留】MapFan調査で、木更津金田ICには「木更津金田ＩＣ（東京湾アクアライン）」（入口(上り)+出口(下り)）と「木更津金田ＩＣ（東京湾アクアライン連絡道）」（出口(上り)+入口(下り)）という2つの別名称の施設が存在し、合わせると上下線とも入口・出口が利用可能であることを確認した。ただし本アプリのgoogleNameは「東京湾アクアライン 木更津金田インターチェンジ」（連絡道を含まない）であり、Google Routes APIが実際にどちらの施設・方向で経路を解決するか確認できなかったため、entranceSelectable/exitSelectableは変更せず現状維持（true/true）とした。座標はMapFan「木更津金田ＩＣ（東京湾アクアライン）【入口（上り）】」個別ページで確認(35.4335959,139.9216386)。従来座標(35.435,139.921)から約200m修正。次回、Google Maps上での実際の経路解決結果を確認したうえで再検証が必要。"
            },
            {
                order: 4,
                displayName: "袖ケ浦IC",
                googleName: "東京湾アクアライン連絡道 袖ケ浦インターチェンジ",
                lat: 35.413996,
                lng: 139.953819,
                connection: true,
                connectedRoads: ["aqualine", "tateyama"],
                routeBranch: "aqualine",
                branchOrder: 3,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.4139093, entranceLng: 139.9538054, exitLat: 35.4140821, exitLng: 139.9538333,
                note: "MapFanで「袖ヶ浦ＩＣ（東京湾アクアライン連絡道）」の入口（上り・下り）・出口（上り・下り）の4個別ページ全てを確認し、上下線とも入口・出口が利用可能なフルICと判断（NEXCO東日本プレスリリース「上り線 出口ランプ夜間閉鎖」でも運用実態を確認）。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(上り)(35.4139093,139.9538054)、exitLat/Lngを出口(下り)(35.4140821,139.9538333)に設定。従来座標(35.418,139.980)から約2.4km修正。"
            }
        ]
    },




    tateyama: {
        label: "館山道方面",
        exits: [
            {
                order: -3,
                displayName: "浮島IC",
                googleName: "首都高速湾岸線 浮島インターチェンジ",
                lat: 35.520593,
                lng: 139.787833,
                routeBranch: "aqualine",
                branchOrder: 1,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.520593, entranceLng: 139.787833, exitLat: 35.520593, exitLng: 139.787833,
                note: "aqualine側の浮島ICと同一施設・同一検証結果（下り入口・上り出口のみ、MapFan確認）。詳細はaqualine側のnote参照。従来座標(35.521,139.788)からごくわずかな修正。"
            },
            {
                order: -2,
                displayName: "木更津金田IC",
                googleName: "東京湾アクアライン 木更津金田インターチェンジ",
                lat: 35.4335959,
                lng: 139.9216386,
                connection: true,
                connectedRoads: ["aqualine", "tateyama"],
                routeBranch: "aqualine",
                branchOrder: 2,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.4335959, entranceLng: 139.9216386, exitLat: 35.4335959, exitLng: 139.9216386,
                note: "aqualine側の木更津金田ICと同一施設。【確認不可・複雑につき変更保留】2つの別名称施設（アクアライン本体／連絡道）が存在するため、entranceSelectable/exitSelectableは変更していない。詳細はaqualine側のnote参照。従来座標(35.435,139.921)から約200m修正。"
            },
            {
                order: -1,
                displayName: "袖ケ浦IC",
                googleName: "東京湾アクアライン連絡道 袖ケ浦インターチェンジ",
                lat: 35.413996,
                lng: 139.953819,
                connection: true,
                connectedRoads: ["aqualine", "tateyama"],
                routeBranch: "aqualine",
                branchOrder: 3,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.4139093, entranceLng: 139.9538054, exitLat: 35.4140821, exitLng: 139.9538333,
                note: "aqualine側の袖ケ浦ICと同一施設・同一検証結果（フルIC、MapFan4個別ページ確認）。詳細はaqualine側のnote参照。従来座標(35.418,139.980)から約2.4km修正。"
            },
            {
                order: 0,
                displayName: "蘇我IC",
                googleName: "京葉道路 蘇我インターチェンジ",
                lat: 35.568778,
                lng: 140.137740,
                connection: true,
                connectedRoads: ["keiyo", "tateyama", "tokan"],
                routeBranch: "keiyo",
                branchOrder: 10,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.568778, entranceLng: 140.137740, exitLat: 35.5686381, exitLng: 140.1382367,
                note: "MapFanで「蘇我ＩＣ（京葉道路）【入口（上り）】」「【出口（下り）】」の個別ページを確認したが、「【入口（下り）】」「【出口（上り）】」に相当するページは無く、上り線入口・下り線出口のみと判断。なお別途「蘇我ＩＣ（館山自動車道）」という異なる道路名の施設（出口(上り)+入口(下り)）も存在するが、本アプリのgoogleNameは「京葉道路 蘇我インターチェンジ」（keiyo側と同一）のため、京葉道路側の検証結果を採用した。本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。座標はentranceLat/Lngを入口(上り)(35.568778,140.13774)、exitLat/Lngを出口(下り)(35.5686381,140.1382367)に設定。従来座標(35.568,140.158)から約1.8km修正。keiyo側の蘇我ICと同一検証結果。【2026-07-14訂正】Wikipedia「蘇我インターチェンジ」記事で「かつては上り方面への出入口のみであったが、2007年5月30日に下り方面出入口が供用開始され、フルインターチェンジとなった」ことを確認。NAVITIMEでも京葉道路側（上り入口・下り出口）・館山自動車道側（下り入口・上り出口）の双方のランプが存在することを確認しており、2007年の下り出口供用開始によりexitSelectable:falseは誤りと判断し、falseからtrueに訂正した。entranceSelectable/座標は変更していない。"
            },
            {
                order: 1,
                displayName: "市原IC",
                googleName: "館山自動車道 市原インターチェンジ",
                lat: 35.498328,
                lng: 140.091534,
                connection: true,
                connectedRoads: ["keiyo", "tateyama"],
                routeBranch: "keiyo",
                branchOrder: 11,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.498328, entranceLng: 140.091534, exitLat: 35.498328, exitLng: 140.091534,
                note: "NAVITIME・MapFanで「市原ＩＣ（館山自動車道）」の上り入口・上り出口・下り入口・下り出口の4種全ての存在を確認し、上下線とも入口・出口が利用可能なフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はMapFan「市原ＩＣ（館山自動車道）【入口】」個別ページで確認(35.498328,140.091534)。従来座標(35.498,140.104)から約1.1km修正。keiyo側の市原ICと同一検証結果。"
            },
            {
                order: 2,
                displayName: "姉崎袖ケ浦IC",
                googleName: "館山自動車道 姉崎袖ケ浦インターチェンジ",
                lat: 35.431120,
                lng: 140.043380,
                routeBranch: "keiyo",
                branchOrder: 12,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.431120, entranceLng: 140.043380, exitLat: 35.431120, exitLng: 140.043380,
                note: "MapFanで「姉崎袖ヶ谷ＩＣ（館山自動車道）【出口】」（上り/下りの区別なし）の個別ページを確認し、フルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。2025年3月25日にETC専用料金所化（袖ケ浦市公式情報）。座標はMapFan個別ページで確認(35.431120,140.043380)。従来座標(35.432,140.043)からごくわずかな修正。keiyo側の姉崎袖ケ浦ICと同一検証結果。"
            },
            {
                order: 3,
                displayName: "木更津北IC",
                googleName: "館山自動車道 木更津北インターチェンジ",
                lat: 35.385951,
                lng: 140.001856,
                routeBranch: "aqualine",
                branchOrder: 4,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.385951, entranceLng: 140.001856, exitLat: 35.385951, exitLng: 140.001856,
                note: "NAVITIMEで「木更津北IC」の上り入口・上り出口・下り入口・下り出口の4種全ての存在を確認し、MapFanでも上り/下りの区別のない【入口】【出口】ページを確認、フルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はMapFan「木更津北ＩＣ（館山自動車道）【入口】」個別ページで確認(35.385951,140.001856)。従来座標(35.394,139.967)から約3.2km修正。keiyo側の木更津北ICと同一検証結果。なおrouteBranchが\"aqualine\"のままだが、本ICは館山自動車道上に位置し実際のアクアライン上のICではない（アクアライン系トップパネル表示順の調査結果として別途報告）。"
            },
            {
                order: 4,
                displayName: "木更津南IC",
                googleName: "館山自動車道 木更津南インターチェンジ",
                lat: 35.350226,
                lng: 139.924807,
                routeBranch: "aqualine",
                branchOrder: 5,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.350226, entranceLng: 139.924807, exitLat: 35.350226, exitLng: 139.924807,
                note: "MapFanで「木更津南ＩＣ（館山自動車道（木更津南線））【入口（上り）】」「【出口（下り）】」の個別ページを確認したが、逆方向の個別ページは見つからず、上り線入口・下り線出口のみと判断。Wikipedia「木更津南インターチェンジ」記事によれば、国道127号側・国道16号側の2つの出入口が約2km離れて存在し構造がやや複雑である旨の記載があるが、方向限定自体はMapFanで確認済み。本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。座標はMapFan「木更津南ＩＣ（館山自動車道（木更津南線））【入口（上り）】」個別ページで確認(35.350226,139.924807)。従来座標(35.365,139.935)から約1.9km修正。keiyo側の木更津南ICと同一検証結果。routeBranchが\"aqualine\"のままである点は木更津北IC同様。"
            },
            {
                order: 4,
                displayName: "木更津南IC",
                googleName: "館山自動車道 木更津南インターチェンジ",
                lat: 35.350226,
                lng: 139.924807,
                isMirror: true,
                mirrorOf: 5,
                routeBranch: "aqualine",
                branchOrder: 5.5,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.350226, entranceLng: 139.924807, exitLat: 35.350226, exitLng: 139.924807,
                note: "【Phase 2・方向判定ミラー】本体（上り方向・入口専用）に対する下り方向のミラーレコード。MapFan「【出口（下り）】」ページの確認結果（本体note参照）に基づき、下り方向では出口のみが利用可能なため追加。方向別の正確な座標は未確認のため、本体座標を暫定使用。resolveEffectiveNexcoExitにより、走行方向判定（inferTravelDirectionForIcArea）が下り方向と判定した場合にのみ、候補選定時にこのレコードへ差し替えられる。符号判定は実車確認前提の暫定値のため、実車確認で逆と分かった場合はNEXCO_MIRROR_SWAP_DIRECTION_BY_GOOGLE_NAMEの符号のみを反転すればよい。keiyo側にも同一施設の重複登録があり、そちらにも同様のミラーレコードを追加している。"
            },
            {
                order: 5,
                displayName: "君津IC",
                googleName: "館山自動車道 君津インターチェンジ",
                lat: 35.318046,
                lng: 139.941582,
                routeBranch: "aqualine",
                branchOrder: 6,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.318046, entranceLng: 139.941582, exitLat: 35.3179543, exitLng: 139.9416659,
                note: "MapFanで「君津ＩＣ（館山自動車道）【入口】」「【出口】」（上り/下りの区別なし）の個別ページを確認し、フルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(35.318046,139.941582)、exitLat/Lngを出口(35.3179543,139.9416659)に設定。従来座標(35.333,139.902)から約4km修正（誤差が特に大きかった）。keiyo側の君津ICと同一検証結果。routeBranchが\"aqualine\"のままである点は木更津北IC同様。"
            },
            {
                order: 5.5,
                displayName: "君津PA SIC",
                googleName: "館山自動車道 君津PAスマートインターチェンジ",
                lat: 35.283047,
                lng: 139.92587,
                routeBranch: "aqualine",
                branchOrder: 6.5,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.283047, entranceLng: 139.92587, exitLat: 35.283047, exitLng: 139.92587,
                note: "君津市公式サイト・go-etc.jp等で、君津PAスマートICは上り線（東京・千葉方面）が入口専用、下り線（館山方面）が出口専用のハーフSICであることを確認（利用時間6～22時、ETC専用）。本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。座標については、MapFanの個別ランプページを検索したが直接確認できるページが見つからなかったため、既存座標(35.283,139.927)を維持（精度未確認、要再確認）。【2026-07-14再調査・座標のみ修正】MapFan個別ランプページは今回も発見できなかったが、NAVITIME「館山自動車道 君津PAスマートIC 上り 入口」のランプ単位座標(35.283047,139.92587)を確認し、Yahoo!地図・Mapionの2情報源とも約100m以内で一致することを確認した。既存の暫定値との差は約62mと小さかったが、「精度未確認」の状態を解消するため座標を更新した。"
            },
            {
                order: 5.5,
                displayName: "君津PA SIC",
                googleName: "館山自動車道 君津PAスマートインターチェンジ",
                lat: 35.283047,
                lng: 139.92587,
                isMirror: true,
                mirrorOf: 6.5,
                routeBranch: "aqualine",
                branchOrder: 6.75,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.283047, entranceLng: 139.92587, exitLat: 35.283047, exitLng: 139.92587,
                note: "【Phase 2・方向判定ミラー】本体（上り方向・入口専用）に対する下り方向のミラーレコード。君津市公式サイト・go-etc.jp等の確認結果（本体note参照）に基づき、下り方向では出口のみが利用可能なため追加。branchOrderは通常の「本体+0.5」ではなく6.75とした（本体6.5に+0.5すると7.0となり、直後の富津中央ICのbranchOrder:7と衝突するため）。座標は本体同様、精度未確認のまま暫定使用（本体note参照、要再確認）。resolveEffectiveNexcoExitにより、走行方向判定（inferTravelDirectionForIcArea）が下り方向と判定した場合にのみ、候補選定時にこのレコードへ差し替えられる。符号判定は実車確認前提の暫定値のため、実車確認で逆と分かった場合はNEXCO_MIRROR_SWAP_DIRECTION_BY_GOOGLE_NAMEの符号のみを反転すればよい。【2026-07-14再調査・座標のみ修正】本体側の再調査でNAVITIME「上り入口」のランプ単位座標(35.283047,139.92587)をYahoo!地図・Mapionとのクロスチェックで確認できたため、本体と同じ座標に更新した（詳細は本体note参照）。"
            },
            {
                order: 6,
                displayName: "富津中央IC",
                googleName: "館山自動車道 富津中央インターチェンジ",
                lat: 35.250847,
                lng: 139.886036,
                routeBranch: "aqualine",
                branchOrder: 7,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.250847, entranceLng: 139.886036, exitLat: 35.250764, exitLng: 139.886091,
                note: "MapFan・NAVITIMEで「富津中央ＩＣ（館山自動車道）」の上り入口・上り出口・下り入口・下り出口の4種全ての存在を確認し、フルICと判断。2023年12月7日にETC専用料金所化。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(35.250847,139.886036)、exitLat/Lngを出口(35.250764,139.886091)に設定。従来座標(35.273,139.855)から約4km修正（誤差が特に大きかった）。routeBranchが\"aqualine\"のままである点は木更津北IC同様。"
            },
            {
                order: 7,
                displayName: "富津竹岡IC",
                googleName: "富津館山道路 富津竹岡インターチェンジ",
                lat: 35.198177,
                lng: 139.859819,
                routeBranch: "aqualine",
                branchOrder: 8,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.198177, entranceLng: 139.859819, exitLat: 35.198177, exitLng: 139.859819,
                note: "【確認不可・複雑につき変更保留】MapFan調査で、富津竹岡ICには「富津竹岡ＩＣ（富津館山道路）」（入口(下り)+出口(上り)）と「富津竹岡ＩＣ（館山自動車道）」（入口(上り)+出口(下り)）という2つの別名称の施設が存在し、合わせると上下線とも入口・出口が利用可能であることを確認した。本アプリのgoogleNameは「富津館山道路 富津竹岡インターチェンジ」だが、木更津金田ICと同様の複雑さがあるため、entranceSelectable/exitSelectableは変更せず現状維持（true/true）とした。座標はMapFan「富津竹岡ＩＣ（富津館山道路）【入口（下り）】」個別ページで確認(35.198177,139.859819)。従来座標(35.204,139.825)から約3.2km修正。次回、Google Maps上での実際の経路解決結果を確認したうえで再検証が必要。routeBranchが\"aqualine\"のままである点は木更津北IC同様。"
            },
            {
                order: 8,
                displayName: "鋸南保田IC",
                googleName: "富津館山道路 鋸南保田インターチェンジ",
                lat: 35.142949,
                lng: 139.845656,
                routeBranch: "aqualine",
                branchOrder: 9,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.142949, entranceLng: 139.845656, exitLat: 35.142949, exitLng: 139.845656,
                note: "MapFanで「鋸南保田ＩＣ（富津館山道路）【入口】」「【出口】」（上り/下りの区別なし）の個別ページを確認し、フルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はMapFan「鋸南保田ＩＣ（富津館山道路）【入口】」個別ページで確認(35.142949,139.845656)。従来座標(35.140,139.827)から約1.7km修正。routeBranchが\"aqualine\"のままである点は木更津北IC同様。"
            },
            {
                order: 9,
                displayName: "富浦IC",
                googleName: "富津館山道路 富浦インターチェンジ",
                lat: 35.038399,
                lng: 139.850475,
                routeBranch: "aqualine",
                branchOrder: 10,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.038399, entranceLng: 139.850475, exitLat: 35.038399, exitLng: 139.850475,
                note: "富津館山道路（現在の館山自動車道系統）の終点（南房総市）。MapFanで「富浦ＩＣ（富津館山道路）【入口（上り）】」「【出口（下り）】」の個別ページを確認したが、逆方向の個別ページは見つからず、上り線入口・下り線出口のみと判断（終点特有の構造。玉川IC・保土ヶ谷IC・戸塚終点と同様のパターン）。本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。座標はMapFan「富浦ＩＣ（富津館山道路）【入口（上り）】」個別ページで確認(35.038399,139.850475)。従来座標(35.034,139.832)から約1.8km修正。routeBranchが\"aqualine\"のままである点は木更津北IC同様。"
            },
            {
                order: 9,
                displayName: "富浦IC",
                googleName: "富津館山道路 富浦インターチェンジ",
                lat: 35.038399,
                lng: 139.850475,
                isMirror: true,
                mirrorOf: 10,
                routeBranch: "aqualine",
                branchOrder: 10.5,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.038399, entranceLng: 139.850475, exitLat: 35.038399, exitLng: 139.850475,
                note: "【Phase 2・方向判定ミラー】本体（上り方向・入口専用）に対する下り方向のミラーレコード。MapFan「【出口（下り）】」ページの確認結果（本体note参照）に基づき、下り方向では出口のみが利用可能なため追加。方向別の正確な座標は未確認のため、本体座標を暫定使用。resolveEffectiveNexcoExitにより、走行方向判定（inferTravelDirectionForIcArea）が下り方向と判定した場合にのみ、候補選定時にこのレコードへ差し替えられる。符号判定は実車確認前提の暫定値のため、実車確認で逆と分かった場合はNEXCO_MIRROR_SWAP_DIRECTION_BY_GOOGLE_NAMEの符号のみを反転すればよい。"
            }
        ]
    },





    keiyo: {
        label: "京葉道路方面",
        exits: [
            { order: -8, displayName: "堤通（首都高）", googleName: "首都高速6号向島線 堤通出入口", lat: 35.7357056, lng: 139.8150419, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.7357056, entranceLng: 139.8150419, exitLat: 35.7357056, exitLng: 139.8150419,
                note: "SHUTO_IC_MASTER側の堤通（id: shuto-6-tsutsumidori、MapFanで検証済み、entranceLat/Lng=exitLat/Lng=35.7357056,139.8150419）と座標が不一致だったため、本スタブの座標をSHUTO_IC_MASTER側の検証済み値に同期した。dedupeIcDefinitionsByIdentityによりSHUTO_IC_MASTER側が優先されるため候補選定への実質的な影響はないが、データ不整合を解消するために修正。従来座標(35.731,139.817)から約660m修正。"
            },
            { order: -7, displayName: "上野（首都高）", googleName: "首都高速1号上野線 上野出入口", lat: 35.708561, lng: 139.776389, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.708561, entranceLng: 139.776389, exitLat: 35.708561, exitLng: 139.776389,
                note: "首都高ドライバーズサイト（shutoko.jp）の「上野」ページで入口・出口の両方が存在すること、上り方向料金所がETC専用（現金車利用不可）であることを確認したが、これは支払い方法の制約であり通行可否（entranceSelectable/exitSelectable）には影響しないためtrue/trueを維持。座標は二次情報源（検索エンジン経由の集約値）でのみ35.708561,139.776389を確認でき、MapFan・NAVITIME等の一次情報の個別ページには今回到達できなかったため確信度は中程度。従来座標(35.712,139.779)から約440m修正。次回、MapFan等一次情報での再確認が望ましい。"
            },
            { order: -6, displayName: "葛西（首都高）", googleName: "首都高速湾岸線 葛西出入口", lat: 35.652, lng: 139.870, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.652, entranceLng: 139.870, exitLat: 35.652, exitLng: 139.870,
                note: "首都高ドライバーズサイト（shutoko.jp）の「葛西」ページおよびWikipedia「葛西出入口」記事で、西行き・東行きとも入口・出口が存在するフルインターチェンジであることを確認した。entranceSelectable/exitSelectableは現状のtrue/trueのまま変更なし。座標はMapFan等一次情報の個別ページに今回到達できず未確認のため、既存値(35.652,139.870)を変更していない。"
            },
            { order: -5, displayName: "湾岸市川（首都高）", googleName: "首都高速湾岸線 湾岸市川出入口", lat: 35.672, lng: 139.938, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.672, entranceLng: 139.938, exitLat: 35.672, exitLng: 139.938,
                note: "【留保・要確認】Wikipedia「湾岸市川インターチェンジ」記事で「この『湾岸市川IC』と首都高速湾岸線の出入口は異なる別の施設であり、混同されやすい」と明記されているのを発見した。本エントリのgoogleName「首都高速湾岸線 湾岸市川出入口」が指す施設が実在するのか、東関東自動車道側の湾岸市川IC（下り方面のみのハーフIC、Mapion調べで座標35.69133945,139.95422609、本エントリの座標から約2.4km離れている）と誤って同一視されたものかは、今回の調査だけでは断定できなかった。施設の同定に関わる問題のため、座標・entranceSelectable/exitSelectableとも変更せず現状維持とし、次回は東関道側との関係を含めた再確認が必要。"
            },
            { order: -4, displayName: "新木場（首都高）", googleName: "首都高速湾岸線 新木場出入口", lat: 35.645, lng: 139.827, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.645, entranceLng: 139.827, exitLat: 35.645, exitLng: 139.827,
                note: "Wikipedia「新木場出入口」記事および首都高ドライバーズサイトで、西行き・東行きとも入口・出口が存在するフルインターチェンジであること（2022年4月から両方向とも入口ETC専用）を確認した。entranceSelectable/exitSelectableは現状のtrue/trueのまま変更なし。座標はMapFan等一次情報の個別ページに今回到達できず未確認のため、既存値(35.645,139.827)を変更していない。"
            },
            { order: -3, displayName: "有明（首都高）", googleName: "首都高速湾岸線 有明出入口", lat: 35.634, lng: 139.795, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.634, entranceLng: 139.795, exitLat: 35.634, exitLng: 139.795,
                note: "【方向制限確認・selectableは変更保留】Wikipedia「有明出入口」記事で「西行き出口・東行き入口のみ設置されているハーフインターチェンジ」（東京都江東区有明二丁目、1981年5月19日供用開始）と高確信度で確認した。西行き入口・東行き出口は存在しない。ただし、entranceSelectable/exitSelectableの変更（貝塚IC・篠崎IC等で採用しているmirrorレコード方式の要否を含む）は今回の実装指示の対象外のため、true/trueのまま変更していない。座標はMapFan等一次情報に今回到達できず未確認のため、既存値(35.634,139.795)も変更していない。次回、entranceSelectable/exitSelectableの扱いをユーザー確認のうえで再検討する必要がある。"
            },
            { order: -2, displayName: "大井南（首都高）", googleName: "首都高速湾岸線 大井南出入口", lat: 35.589, lng: 139.756, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.589, entranceLng: 139.756, exitLat: 35.589, exitLng: 139.756,
                note: "【構造変更確認・selectableは変更保留】首都高速道路株式会社プレスリリース（2018年）およびWikipedia「大井南出入口」記事で、2018年4月15日の湾岸線本線料金所（東行き）撤去に伴い、東行きの「大井南入口」は「中央環状線大井南入口」に名称変更され、湾岸線への流入はできなくなり中央環状線・羽田線専用になったことを確認した（湾岸線東行きを使う場合は約1.3km先の「大井入口」を利用）。西行きの出口・入口は存続。この構造変更が現在のgoogleName「首都高速湾岸線 大井南出入口」の登録内容と整合しているか要再確認だが、entranceSelectable/exitSelectableの変更は今回の実装指示の対象外のためtrue/trueのまま変更していない。座標はMapFan等一次情報に今回到達できず未確認のため、既存値(35.589,139.756)も変更していない。"
            },
            { order: -1, displayName: "空港中央（首都高）", googleName: "首都高速湾岸線 空港中央出入口", lat: 35.553, lng: 139.787, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.553, entranceLng: 139.787, exitLat: 35.553, exitLng: 139.787,
                note: "首都高ドライバーズサイト（shutoko.jp）の「空港中央」ページおよびWikipedia「空港中央出入口」記事で、東行き・西行きとも入口・出口が存在するフルインターチェンジ（1993年9月開通、羽田空港最寄り）であることを確認した。entranceSelectable/exitSelectableは現状のtrue/trueのまま変更なし。座標はMapFan等一次情報の個別ページに今回到達できず未確認のため、既存値(35.553,139.787)を変更していない。"
            },
            {
                order: 1,
                displayName: "篠崎IC",
                googleName: "京葉道路 篠崎インターチェンジ",
                lat: 35.705171,
                lng: 139.908254,
                routeBranch: "keiyo",
                branchOrder: 1,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.705171, entranceLng: 139.908254, exitLat: 35.705171, exitLng: 139.908254,
                note: "Wikipedia「篠崎インターチェンジ」記事で「千葉方面の出入口のみ設置されているハーフインターチェンジ」（下り線＝一般道路→有料道路の入口のみ、上り線＝有料道路→一般道路の出口のみ）と確認。MapFanでも「篠崎出入口（京葉道路）【入口（下り）】」の個別ページを確認。本アプリは走行方向を区別できないため、入口方向（下り）を代表方向として採用し、上り出口はexitSelectable:falseとした。座標はMapFan「篠崎出入口（京葉道路）【入口（下り）】」個別ページで確認(35.705171,139.908254)。従来座標(35.707,139.898)から約930m修正。PROJECT_HANDOFF.md記載の「荒川区役所→幕張メッセ」例でNEXCO入口として使われているのは下り方向のためentranceSelectable:trueの範囲内。"
            },
            {
                order: 1,
                displayName: "篠崎IC",
                googleName: "京葉道路 篠崎インターチェンジ",
                lat: 35.705171,
                lng: 139.908254,
                isMirror: true,
                mirrorOf: 1,
                routeBranch: "keiyo",
                branchOrder: 1.5,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.705171, entranceLng: 139.908254, exitLat: 35.705171, exitLng: 139.908254,
                note: "【Phase 1・方向判定ミラー】本体（下り方向・入口専用）に対する上り方向のミラーレコード。Wikipedia「篠崎インターチェンジ」記事の「上り線＝有料道路→一般道路の出口のみ」に基づき、上り方向では出口のみが利用可能なため追加。方向別の正確な座標は未確認のため、本体座標を暫定使用（本体のnote参照）。resolveEffectiveNexcoExitにより、走行方向判定（inferTravelDirectionForIcArea）が上り方向と判定した場合にのみ、候補選定時にこのレコードへ差し替えられる。symbol判定は実車確認前提の暫定値のため、実車確認で逆と分かった場合はNEXCO_MIRROR_SWAP_DIRECTION_BY_GOOGLE_NAMEの符号のみを反転すればよい。"
            },
            {
                order: 2,
                displayName: "京葉市川IC",
                googleName: "京葉道路 京葉市川インターチェンジ",
                lat: 35.7095,
                lng: 139.9260,
                routeBranch: "keiyo",
                branchOrder: 2,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.7095, entranceLng: 139.9260, exitLat: 35.7095, exitLng: 139.9260,
                note: "【確認不可・複雑につき変更保留】Wikipedia「京葉市川インターチェンジ」記事で「原木方面出口と篠崎方面入口」「篠崎方面出口（側道方面）と原木方面入口」という、2箇所に分散した構造が記載されており、組み合わせると上下線とも入口・出口が利用可能と考えられるが、個別ランプ座標・正確な位置関係をMapFanで確認しきれなかった。entranceSelectable/exitSelectableは変更せず現状維持（true/true）とし、座標も既存値を維持（精度未確認、要再確認）。【2026-07-14再調査・座標のみ修正】再調査でMapFan個別ランプ4件「出口（上り）」(35.7085369,139.9266556)・「入口（上り）」(35.7086469,139.9258594)・「入口（下り）」(35.7103786,139.9269518)・「出口（下り）」(35.7102639,139.924385)を新たに発見。旧座標(35.715,139.931)がこの4点の中心から約760m離れていたため、4点の中心付近(35.7095,139.9260)に修正した（Google Places実データ(35.7094155,139.9266051)ともほぼ一致）。Wikipediaによれば実際には田尻・鬼高・稲荷木×2の4住所、最大6ランプに及ぶ構造であり、1点での代表には限界がある。entranceSelectable/exitSelectableの構造的な正確性（方向別の分割等）は今回は変更しておらず、将来の別課題（複数地点IC設計）として持ち越す。"
            },
            {
                order: 3,
                displayName: "原木IC",
                googleName: "京葉道路 原木インターチェンジ",
                lat: 35.7038372,
                lng: 139.9502179,
                routeBranch: "keiyo",
                branchOrder: 3,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.7038372, entranceLng: 139.9502179, exitLat: 35.7041526, exitLng: 139.950391,
                note: "【未検証】今回、公式サイト・MapFanでの個別確認を実施できなかった。方向限定を示す情報は検索範囲内では見つからなかったが、確認不足のため座標・entranceSelectable/exitSelectableとも変更していない。次回要検証。【2026-07-14再調査・座標のみ修正】MapFanで4個別ランプページ（入口上り・入口下り・出口上り・出口下り）全てを確認し、フルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(上り)(35.7038372,139.9502179)、exitLat/Lngを出口(下り)(35.7041526,139.950391)に設定。従来座標(35.704,139.959)から約787m修正。"
            },
            {
                order: 4,
                displayName: "船橋IC",
                googleName: "京葉道路 船橋インターチェンジ",
                lat: 35.6996362,
                lng: 139.9708625,
                routeBranch: "keiyo",
                branchOrder: 4,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.6996362, entranceLng: 139.9708625, exitLat: 35.6996411, exitLng: 139.9690933,
                note: "【未検証】今回、公式サイト・MapFanでの個別確認を実施できなかった。方向限定を示す情報は検索範囲内では見つからなかったが、確認不足のため座標・entranceSelectable/exitSelectableとも変更していない。次回要検証。【2026-07-14再調査・修正】Wikipedia「船橋インターチェンジ」記事で「下り（千葉方面）の出入口と上り（東京方面）入口が設置されているスリークォーターインターチェンジ。上り（東京方面）出口は設置されていない」と確認。別の独立した情報源（f-keiba.com、花輪IC関連記事内の言及「船橋ICの出口が下り線側にしかないハーフICのため」）でも同じ事実を確認し、MapFanでも【出口（上り）】の個別ページは発見できなかった。上り・下りとも入口は存在するためentranceSelectable:trueは維持し、下り方向でのみ出口が存在するためexitSelectableをfalseに修正した。座標はentranceLat/Lngを入口(35.6996362,139.9708625)、exitLat/Lngを出口(下り)(35.6996411,139.9690933)に設定。従来座標(35.693,139.990)から約1,956m修正。【2026-07-18外部再照合】Wikipedia「船橋インターチェンジ」記事（https://ja.wikipedia.org/wiki/船橋インターチェンジ）で改めて独立に確認し、「下り（千葉方面）の出入口と上り（東京方面）入口を持つが、上り（東京方面）出口は設置されていない」という上記判断と完全に一致することを確認した。座標・entranceSelectable/exitSelectableとも変更なし。"
            },
            {
                order: 5,
                displayName: "花輪IC",
                googleName: "京葉道路 花輪インターチェンジ",
                lat: 35.685038678062,
                lng: 140.0013387493,
                routeBranch: "keiyo",
                branchOrder: 5,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.685038678062, entranceLng: 140.0013387493, exitLat: 35.6868734, exitLng: 139.9999833,
                note: "【未検証】今回、公式サイト・MapFanでの個別確認を実施できなかった。方向限定を示す情報は検索範囲内では見つからなかったが、確認不足のため座標・entranceSelectable/exitSelectableとも変更していない。次回要検証。【2026-07-14再調査・座標のみ修正】MapFanで4個別ランプページ（入口上り・入口下り・出口上り・出口下り）全てを確認し、フルICと判断（もともと下り線入口がないハーフICだったが1993年10月に下り入口が開通し現在はフルIC）。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(上り)(35.685038678062,140.0013387493)、exitLat/Lngを出口(下り)(35.6868734,139.9999833)に設定。従来座標(35.689,140.015)から約1,340m修正。【2026-07-18外部再照合】Wikipedia「花輪インターチェンジ」記事（https://ja.wikipedia.org/wiki/花輪インターチェンジ）で改めて独立に確認し、「元・矢那IC、下り入口なしの一方通行だったが1993年10月5日に有料下り入口が供用開始されフルICとなった」という上記判断と完全に一致することを確認した。座標・entranceSelectable/exitSelectableとも変更なし。"
            },
            {
                order: 6,
                displayName: "武石IC",
                googleName: "京葉道路 武石インターチェンジ",
                lat: 35.6696655,
                lng: 140.0636598,
                routeBranch: "keiyo",
                branchOrder: 6,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.6696655, entranceLng: 140.0636598, exitLat: 35.6700694, exitLng: 140.0638652,
                note: "【未検証】今回、公式サイト・MapFanでの個別確認を実施できなかった。方向限定を示す情報は検索範囲内では見つからなかったが、確認不足のため座標・entranceSelectable/exitSelectableとも変更していない。次回要検証。【2026-07-14再調査・座標のみ修正】MapFanで入口(上り)・入口(下り)・出口(下り)の3個別ランプページを確認。出口(上り)のMapFan個別ページは発見できなかったが、NAVITIME個別スポット（上り出口からのルート案内ページ）で実在を確認できたためフルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(上り)(35.6696655,140.0636598)、exitLat/Lngを出口(下り)(35.6700694,140.0638652)に設定。従来座標(35.675,140.061)から約623m修正。"
            },
            {
                order: 7,
                displayName: "穴川IC",
                googleName: "京葉道路 穴川インターチェンジ",
                lat: 35.6424556,
                lng: 140.1128819,
                routeBranch: "keiyo",
                branchOrder: 7,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.6424556, entranceLng: 140.1128819, exitLat: 35.6431326, exitLng: 140.1128611,
                note: "【確認不可・複雑につき変更保留】検索の結果、穴川ICは「穴川西IC」「穴川中IC」「穴川東IC」という3つの別々のランプの集合体であり、それぞれ入口・出口の方向が異なる可能性があることが分かった（例：西=上り入口、中=下り入口、東=上り出口）。単一のdisplayName「穴川IC」ではこの3分割構造を正確に表現できないため、entranceSelectable/exitSelectableは変更せず現状維持（true/true）とした。座標のみ一般的な位置情報で更新(35.643392,140.111988、従来からの修正量は小さい)。次回、3ランプそれぞれの方向を個別に確認したうえで再検証が必要。【2026-07-18外部照合・座標のみ修正】Wikipedia・MapFan・NAVITIMEで3ランプそれぞれの個別座標を確認：穴川西＝入口(上り)(35.6424556,140.1128819)・出口(下り)(35.6431326,140.1128611)、穴川中＝入口(下り)(35.635745,140.121738)、穴川東＝出口(上り)(35.629184351449,140.13055220093)。3ランプを合算すると上り入口・上り出口・下り入口・下り出口の4方向すべてが揃っており、entranceSelectable/exitSelectableが現状のtrue/trueであることは妥当と判断（変更なし）。ただし本アプリのデータ構造は1IC=1地点が前提のため、御殿場IC等の複数ランプ構造ICと同様に代表点方式を採用し、entranceLat/Lngを穴川西の入口(上り)、exitLat/Lngを穴川西の出口(下り)に設定した（lat/lngはentranceLat/Lngと同値）。従来座標(35.643392,140.111988)から約130m（entrance）／約85m（exit）修正。穴川中（下り入口、西から約900m）・穴川東（上り出口、西から約1.5km）は今回のレコードには反映されておらず、3ランプの個別分離（mirrorレコード化）は行っていない。将来的に方向別の精度を上げたい場合は、篠崎IC・貝塚ICで採用されているisMirror/mirrorOfパターンを応用した3地点構造への再設計を別途検討する必要がある。"
            },
            {
                order: 8,
                displayName: "貝塚IC",
                googleName: "京葉道路 貝塚インターチェンジ",
                lat: 35.624121,
                lng: 140.142331,
                routeBranch: "keiyo",
                branchOrder: 8,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.624121, entranceLng: 140.142331, exitLat: 35.624121, exitLng: 140.142331,
                note: "ブログ等の調査記事で「貝塚ICはハーフICであり、下り（市原・木更津方面）は流出、上り（幕張・船橋方面）は流入のみ」と確認。MapFanでも「貝塚ＩＣ（京葉道路）【入口（上り）】」の個別ページを確認。本アプリは走行方向を区別できないため、入口方向（上り）を代表方向として採用し、下り出口はexitSelectable:falseとした。座標はMapFan「貝塚ＩＣ（京葉道路）【入口（上り）】」個別ページで確認(35.624121,140.142331)。従来座標(35.625,140.150)から約700m修正。"
            },
            {
                order: 8,
                displayName: "貝塚IC",
                googleName: "京葉道路 貝塚インターチェンジ",
                lat: 35.624121,
                lng: 140.142331,
                isMirror: true,
                mirrorOf: 8,
                routeBranch: "keiyo",
                branchOrder: 8.5,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.624121, entranceLng: 140.142331, exitLat: 35.624121, exitLng: 140.142331,
                note: "【Phase 1・方向判定ミラー】本体（上り方向・入口専用）に対する下り方向のミラーレコード。ブログ等の調査記事の「下り（市原・木更津方面）は流出」に基づき、下り方向では出口のみが利用可能なため追加。方向別の正確な座標は未確認のため、本体座標を暫定使用（本体のnote参照）。resolveEffectiveNexcoExitにより、走行方向判定（inferTravelDirectionForIcArea）が下り方向と判定した場合にのみ、候補選定時にこのレコードへ差し替えられる。符号判定は実車確認前提の暫定値のため、実車確認で逆と分かった場合はNEXCO_MIRROR_SWAP_DIRECTION_BY_GOOGLE_NAMEの符号のみを反転すればよい。"
            },
            {
                order: 9,
                displayName: "松ヶ丘IC",
                googleName: "京葉道路 松ヶ丘インターチェンジ",
                lat: 35.595749987548,
                lng: 140.14786921486,
                routeBranch: "keiyo",
                branchOrder: 9,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.595749987548, entranceLng: 140.14786921486, exitLat: 35.594497, exitLng: 140.147964,
                note: "【未検証】今回、公式サイト・MapFanでの個別確認を実施できなかった。方向限定を示す情報は検索範囲内では見つからなかったが、確認不足のため座標・entranceSelectable/exitSelectableとも変更していない。次回要検証。【2026-07-14再調査・座標のみ修正】MapFanで4個別ランプページ（入口上り・入口下り・出口上り・出口下り）全てを確認し、フルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(上り)(35.595749987548,140.14786921486)、exitLat/Lngを出口(下り)(35.594497,140.147964)に設定。従来座標(35.583,140.158)から約1,628m修正。"
            },
            {
                order: 10,
                displayName: "蘇我IC",
                googleName: "京葉道路 蘇我インターチェンジ",
                lat: 35.568778,
                lng: 140.137740,
                connection: true,
                connectedRoads: ["keiyo", "tateyama", "tokan"],
                routeBranch: "keiyo",
                branchOrder: 10,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.568778, entranceLng: 140.137740, exitLat: 35.5686381, exitLng: 140.1382367,
                note: "tateyama側の蘇我ICと同一施設・同一検証結果（上り入口・下り出口のみ、MapFan確認）。詳細はtateyama側のnote参照。従来座標(35.568,140.158)から約1.8km修正。【2026-07-14訂正】Wikipedia「蘇我インターチェンジ」記事で「かつては上り方面への出入口のみであったが、2007年5月30日に下り方面出入口が供用開始され、フルインターチェンジとなった」ことを確認。NAVITIMEでも京葉道路側（上り入口・下り出口）・館山自動車道側（下り入口・上り出口）の双方のランプが存在することを確認しており、2007年の下り出口供用開始によりexitSelectable:falseは誤りと判断し、falseからtrueに訂正した。entranceSelectable/座標は変更していない。tateyama側の蘇我ICと同一訂正内容。"
            },
            {
                order: 11,
                displayName: "市原IC",
                googleName: "館山自動車道 市原インターチェンジ",
                lat: 35.498328,
                lng: 140.091534,
                connection: true,
                connectedRoads: ["keiyo", "tateyama"],
                routeBranch: "keiyo",
                branchOrder: 11,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.498328, entranceLng: 140.091534, exitLat: 35.498328, exitLng: 140.091534,
                note: "tateyama側の市原ICと同一施設・同一検証結果（フルIC）。詳細はtateyama側のnote参照。従来座標(35.498,140.104)から約1.1km修正。"
            },
            {
                order: 12,
                displayName: "姉崎袖ケ浦IC",
                googleName: "館山自動車道 姉崎袖ケ浦インターチェンジ",
                lat: 35.431120,
                lng: 140.043380,
                routeBranch: "keiyo",
                branchOrder: 12,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.431120, entranceLng: 140.043380, exitLat: 35.431120, exitLng: 140.043380,
                note: "tateyama側の姉崎袖ケ浦ICと同一施設・同一検証結果（フルIC、2025年3月ETC専用化）。詳細はtateyama側のnote参照。従来座標(35.432,140.043)からごくわずかな修正。"
            },
            {
                order: 13,
                displayName: "木更津北IC",
                googleName: "館山自動車道 木更津北インターチェンジ",
                lat: 35.385951,
                lng: 140.001856,
                routeBranch: "keiyo",
                branchOrder: 13,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.385951, entranceLng: 140.001856, exitLat: 35.385951, exitLng: 140.001856,
                note: "tateyama側の木更津北ICと同一施設・同一検証結果（フルIC）。詳細はtateyama側のnote参照。従来座標(35.394,139.967)から約3.2km修正。"
            },
            {
                order: 14,
                displayName: "木更津南IC",
                googleName: "館山自動車道 木更津南インターチェンジ",
                lat: 35.350226,
                lng: 139.924807,
                routeBranch: "keiyo",
                branchOrder: 14,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.350226, entranceLng: 139.924807, exitLat: 35.350226, exitLng: 139.924807,
                note: "tateyama側の木更津南ICと同一施設・同一検証結果（上り入口・下り出口のみ、MapFan確認）。詳細はtateyama側のnote参照。従来座標(35.365,139.935)から約1.9km修正。"
            },
            {
                order: 14,
                displayName: "木更津南IC",
                googleName: "館山自動車道 木更津南インターチェンジ",
                lat: 35.350226,
                lng: 139.924807,
                isMirror: true,
                mirrorOf: 14,
                routeBranch: "keiyo",
                branchOrder: 14.5,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.350226, entranceLng: 139.924807, exitLat: 35.350226, exitLng: 139.924807,
                note: "【Phase 2・方向判定ミラー】tateyama側の木更津南IC（branchOrder:5.5）ミラーレコードと同一施設・同一検証結果。詳細はtateyama側のミラーレコードのnote参照。"
            },
            {
                order: 15,
                displayName: "君津IC",
                googleName: "館山自動車道 君津インターチェンジ",
                lat: 35.318046,
                lng: 139.941582,
                routeBranch: "keiyo",
                branchOrder: 15,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.318046, entranceLng: 139.941582, exitLat: 35.3179543, exitLng: 139.9416659,
                note: "tateyama側の君津ICと同一施設・同一検証結果（フルIC）。詳細はtateyama側のnote参照。従来座標(35.333,139.902)から約4km修正（誤差が特に大きかった）。"
            }
        ]
    },



    tokan: {
        label: "東関東道方面",
        exits: [
            { order: -8, displayName: "堤通（首都高）", googleName: "首都高速6号向島線 堤通出入口", lat: 35.7357056, lng: 139.8150419, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.7357056, entranceLng: 139.8150419, exitLat: 35.7357056, exitLng: 139.8150419,
                note: "【2026-07-19同期修正】SHUTO_IC_MASTER本体側（shuto-6-tsutsumidori、MapFan検証済み）の座標に同期。旧座標との誤差約548m。dedupeIcDefinitionsByIdentityによりSHUTO_IC_MASTER側が優先されるため候補選定への実害はなかったが、データ整合性のため修正。"
            },
            { order: -7, displayName: "上野（首都高）", googleName: "首都高速1号上野線 上野出入口", lat: 35.712, lng: 139.779, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.712, entranceLng: 139.779, exitLat: 35.712, exitLng: 139.779
            },
            { order: -6, displayName: "葛西（首都高）", googleName: "首都高速湾岸線 葛西出入口", lat: 35.652, lng: 139.870, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.652, entranceLng: 139.870, exitLat: 35.652, exitLng: 139.870
            },
            { order: -5, displayName: "湾岸市川（首都高）", googleName: "首都高速湾岸線 湾岸市川出入口", lat: 35.672, lng: 139.938, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.672, entranceLng: 139.938, exitLat: 35.672, exitLng: 139.938
            },
            { order: -4, displayName: "新木場（首都高）", googleName: "首都高速湾岸線 新木場出入口", lat: 35.645, lng: 139.827, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.645, entranceLng: 139.827, exitLat: 35.645, exitLng: 139.827
            },
            { order: -3, displayName: "有明（首都高）", googleName: "首都高速湾岸線 有明出入口", lat: 35.634, lng: 139.795, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.634, entranceLng: 139.795, exitLat: 35.634, exitLng: 139.795
            },
            { order: -2, displayName: "大井南（首都高）", googleName: "首都高速湾岸線 大井南出入口", lat: 35.589, lng: 139.756, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.589, entranceLng: 139.756, exitLat: 35.589, exitLng: 139.756
            },
            { order: -1, displayName: "空港中央（首都高）", googleName: "首都高速湾岸線 空港中央出入口", lat: 35.553, lng: 139.787, experimental: true, roadType: "首都高",
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.553, entranceLng: 139.787, exitLat: 35.553, exitLng: 139.787
            },
            {
                order: 0.1,
                displayName: "葛西IC",
                googleName: "首都高速湾岸線 葛西出入口",
                lat: 35.652,
                lng: 139.870,
                routeBranch: "tokan",
                branchOrder: 1,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.652, entranceLng: 139.870, exitLat: 35.652, exitLng: 139.870
            },
            {
                order: 0.2,
                displayName: "湾岸市川IC",
                googleName: "首都高速湾岸線 湾岸市川出入口",
                lat: 35.672,
                lng: 139.938,
                routeBranch: "tokan",
                branchOrder: 2,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.672, entranceLng: 139.938, exitLat: 35.672, exitLng: 139.938
            },
            {
                order: 0,
                displayName: "蘇我IC",
                googleName: "京葉道路 蘇我インターチェンジ",
                lat: 35.568778,
                lng: 140.137740,
                connection: true,
                connectedRoads: ["keiyo", "tokan", "tateyama"],
                routeBranch: "keiyo",
                branchOrder: 10,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.568778, entranceLng: 140.137740, exitLat: 35.5686381, exitLng: 140.1382367,
                note: "【2026-07-15調査・keiyo/tateyama側と統一】tokan側の3件目の重複登録であり、keiyo/tateyama側の蘇我ICと同一施設・同一検証結果（上り入口・下り出口のみ、MapFan確認）。詳細はkeiyo側のnote参照。従来座標(35.568,140.158)から約1.8km修正。Wikipedia「蘇我インターチェンジ」記事で2007年5月30日にフルインターチェンジ化したことを確認済みのため、entranceSelectable/exitSelectableはtrue/trueで変更なし。keiyo/tateyama側と同一の座標・値に統一した。"
            },
            {
                order: 1,
                displayName: "湾岸習志野IC",
                googleName: "東関東自動車道 湾岸習志野インターチェンジ",
                lat: 35.6624612,
                lng: 140.0241855,
                routeBranch: "tokan",
                branchOrder: 3,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.6624612, entranceLng: 140.0241855, exitLat: 35.6624612, exitLng: 140.0241855,
                note: "【2026-07-15調査】ハーフIC。上り線（市川・東京方面）は入口のみ、下り線（成田・潮来方面）は出口のみ。湾岸千葉ICとセットで1つのフルICとして機能する。MapFanで「湾岸習志野ＩＣ（東関東自動車道）【入口（上り）】」「【出口（下り）】」の個別ページを確認したが、【入口（下り）】【出口（上り）】に相当するページは見つからず、構造と整合。本アプリの主な利用方向（下り方向）で実際に使える役割を優先する方針に基づき、下り方向で使える出口をexitSelectable:trueとし、上り方向のみの入口はentranceSelectable:falseとした（入口方向を代表とするPhase 1・貝塚IC/篠崎ICとは異なる基準）。座標はexitLat/Lngを出口(下り)(35.6624612,140.0241855)に設定。従来座標(35.665,140.016)から約793m修正。"
            },
            {
                order: 2,
                displayName: "湾岸千葉IC",
                googleName: "東関東自動車道 湾岸千葉インターチェンジ",
                lat: 35.6507885,
                lng: 140.0524224,
                routeBranch: "tokan",
                branchOrder: 4,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.6507885, entranceLng: 140.0524224, exitLat: 35.6507885, exitLng: 140.0524224,
                note: "【2026-07-15調査】ハーフIC。上り線（東京方面）は出口のみ、下り線（成田・潮来方面）は入口のみ。湾岸習志野ICとセットで1つのフルICとして機能する。MapFanで「湾岸千葉ＩＣ（東関東自動車道）【入口（下り）】」「【出口（上り）】」の個別ページを確認したが、【入口（上り）】【出口（下り）】に相当するページは見つからず、構造と整合。本アプリの主な利用方向（下り方向）で実際に使える役割を優先する方針に基づき、下り方向で使える入口をentranceSelectable:trueとし、上り方向のみの出口はexitSelectable:falseとした。座標はentranceLat/Lngを入口(下り)(35.6507885,140.0524224)に設定。従来座標(35.638,140.060)から約1.58km修正。"
            },
            {
                order: 3,
                displayName: "千葉北IC",
                googleName: "東関東自動車道 千葉北インターチェンジ",
                lat: 35.6722126,
                lng: 140.1205806,
                routeBranch: "tokan",
                branchOrder: 5,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.6722126, entranceLng: 140.1205806, exitLat: 35.672391812865, exitLng: 140.12055367128,
                note: "【2026-07-15調査・座標のみ修正】MapFanで「千葉北ＩＣ（東関東自動車道）【入口】」「【出口】」（方向表記なし）を確認し、NAVITIMEでも上り入口・上り出口・下り出口・下り入口の4方向存在の言及を確認したため、フルICと判断。entranceSelectable/exitSelectableは変更なし（trueのまま）。座標はentranceLat/Lngを入口(35.6722126,140.1205806)、exitLat/Lngを出口(35.672391812865,140.12055367128)に設定。従来座標(35.676,140.131)から修正。"
            },
            {
                order: 4,
                displayName: "四街道IC",
                googleName: "東関東自動車道 四街道インターチェンジ",
                lat: 35.664,
                lng: 140.187,
                routeBranch: "tokan",
                branchOrder: 6,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.664, entranceLng: 140.187, exitLat: 35.664, exitLng: 140.187
            },
            {
                order: 5,
                displayName: "佐倉IC",
                googleName: "東関東自動車道 佐倉インターチェンジ",
                lat: 35.694,
                lng: 140.248,
                routeBranch: "tokan",
                branchOrder: 7,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.694, entranceLng: 140.248, exitLat: 35.694, exitLng: 140.248
            },
            {
                order: 6,
                displayName: "酒々井IC",
                googleName: "東関東自動車道 酒々井インターチェンジ",
                lat: 35.718,
                lng: 140.300,
                routeBranch: "tokan",
                branchOrder: 8,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.718, entranceLng: 140.300, exitLat: 35.718, exitLng: 140.300
            },
            {
                order: 7,
                displayName: "富里IC",
                googleName: "東関東自動車道 富里インターチェンジ",
                lat: 35.729,
                lng: 140.343,
                routeBranch: "tokan",
                branchOrder: 9,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.729, entranceLng: 140.343, exitLat: 35.729, exitLng: 140.343
            },
            {
                order: 8,
                displayName: "成田IC",
                googleName: "東関東自動車道 成田インターチェンジ",
                lat: 35.779,
                lng: 140.365,
                routeBranch: "tokan",
                branchOrder: 10,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.779, entranceLng: 140.365, exitLat: 35.779, exitLng: 140.365
            },
            {
                order: 9,
                displayName: "大栄IC",
                googleName: "東関東自動車道 大栄インターチェンジ",
                lat: 35.842,
                lng: 140.470,
                routeBranch: "tokan",
                branchOrder: 11,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.842, entranceLng: 140.470, exitLat: 35.842, exitLng: 140.470
            },
            {
                order: 10,
                displayName: "佐原香取IC",
                googleName: "東関東自動車道 佐原香取インターチェンジ",
                lat: 35.884,
                lng: 140.548,
                routeBranch: "tokan",
                branchOrder: 12,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.884, entranceLng: 140.548, exitLat: 35.884, exitLng: 140.548
            },
            {
                order: 11,
                displayName: "潮来IC",
                googleName: "東関東自動車道 潮来インターチェンジ",
                lat: 35.9370535,
                lng: 140.58743,
                routeBranch: "tokan",
                branchOrder: 13,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.9370535, entranceLng: 140.58743, exitLat: 35.9370535, exitLng: 140.58743,
                note: "【2026-07-15調査】ハーフIC。上り入口・下り出口のみ（東関東自動車道のこのアプリ登録範囲の終点）。MapFanで「潮来ＩＣ（東関東自動車道）【入口（上り）】」「【出口（下り）】」の個別ページを確認。本アプリの主な利用方向（下り方向）で実際に使える役割を優先する方針に基づき、下り方向で使える出口をexitSelectable:trueとし、上り方向のみの入口はentranceSelectable:falseとした（入口方向を代表とするPhase 1・貝塚IC/篠崎ICとは異なる基準）。座標はexitLat/Lngを出口(下り)(35.9370535,140.58743)に設定。従来座標(35.952,140.574)から約2.06km修正。"
            }
        ]
    },

    // gaikan: 東京外環自動車道。ハーフIC区間が多いため、order順（大泉JCT→高谷JCT方向／外回り）を基準に入口・出口を登録。
    // 内回り方向専用の座標は本アプリでは未登録（該当ロールがselectable:falseのため未使用）。
    gaikan: {
        label: "外環方面",
        exits: [
            {
                order: 51,
                displayName: "和光IC",
                googleName: "東京外環自動車道 和光インターチェンジ",
                lat: 35.7847447,
                lng: 139.6125082,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.7874079, entranceLng: 139.6148932, exitLat: 35.7820814, exitLng: 139.6101231,
                note: "フルIC。入口(外回り)はMapFan「和光IC(東京外環自動車道)【入口(外回り)】」で確認(35.7874079,139.6148932)。出口(外回り)の個別ランプ座標はMapFan上で特定できず未確認のため入口側座標にフォールバック。出口側座標は要再確認。【2026-07-15再調査・座標のみ修正】出口(外回り)の座標が今回MapFan「和光IC(東京外環自動車道)【出口(外回り)】」(https://mapfan.com/spots/S3Y,J,VBT)で新たに確認でき(35.7820814,139.6101231)、既存の暫定値（入口座標へのフォールバック）との差は約733mだった。他のフルIC（和光北IC・草加IC等）と同じ「入口・出口の中間点」方式に統一し、lat/lngを(35.7847447,139.6125082)に更新した。entranceSelectable/exitSelectableは変更なし（trueのまま）。"
            },
            {
                order: 52,
                displayName: "和光北IC",
                googleName: "東京外環自動車道 和光北インターチェンジ",
                lat: 35.8021211,
                lng: 139.6200185,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.8029247, entranceLng: 139.6206695, exitLat: 35.8013174, exitLng: 139.6193674,
                note: "フルIC。MapFan「和光北IC(東京外環自動車道)【入口(外回り)】」(35.8029247,139.6206695)・【出口(外回り)】(35.8013174,139.6193674)で確認。lat/lngは入口・出口の中間点。"
            },
            {
                order: 53,
                displayName: "戸田西IC",
                googleName: "東京外環自動車道 戸田西インターチェンジ",
                lat: 35.8189925,
                lng: 139.6362429,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.8189925, entranceLng: 139.6362429, exitLat: 35.8189925, exitLng: 139.6362429,
                note: "ハーフIC。外回り方向は出口のみ（大泉方面からの出口）。座標はMapFan「戸田西IC(東京外環自動車道)【出口(外回り)】」で確認(35.8189925,139.6362429)。内回り方向(入口)は本アプリの並び順では使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: 61,
                displayName: "戸田東IC",
                googleName: "東京外環自動車道 戸田東インターチェンジ",
                lat: 35.8271149,
                lng: 139.6504679,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.8271149, entranceLng: 139.6504679, exitLat: 35.8271149, exitLng: 139.6504679,
                note: "ハーフIC。外回り方向は入口のみ（川口・三郷方面への入口）。座標はMapFan「戸田東IC(東京外環自動車道)【入口(外回り)】」で確認(35.8271149,139.6504679)。内回り方向(出口)は本アプリの並び順では使用しないためexitSelectable:falseとし、exitLat/Lngは入口座標にフォールバック。"
            },
            {
                order: 62,
                displayName: "外環浦和IC",
                googleName: "東京外環自動車道 外環浦和インターチェンジ",
                lat: 35.837237,
                lng: 139.6750412,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.837237, entranceLng: 139.6750412, exitLat: 35.837237, exitLng: 139.6750412,
                note: "ハーフIC。外回り方向は入口のみ（川口・三郷方面への入口）。座標はMapFan「外環浦和IC(東京外環自動車道)【入口(外回り)】」で確認(35.837237,139.6750412)。内回り方向(出口)はexitSelectable:falseとし、exitLat/Lngは入口座標にフォールバック。"
            },
            {
                order: 63,
                displayName: "川口西IC",
                googleName: "東京外環自動車道 川口西インターチェンジ",
                lat: 35.8465417,
                lng: 139.6992686,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.8465417, entranceLng: 139.6992686, exitLat: 35.8465417, exitLng: 139.6992686,
                note: "ハーフIC。外回り方向は出口のみ。NEXCO公式プレスリリース（内回り側入口ランプ夜間閉鎖のお知らせ）のタイトルからも入口が内回り側であることを確認。座標はMapFan「川口西IC(東京外環自動車道)【出口(外回り)】」で確認(35.8465417,139.6992686)。内回り方向(入口)はentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: 64,
                displayName: "川口中央IC",
                googleName: "東京外環自動車道 川口中央インターチェンジ",
                lat: 35.8505962,
                lng: 139.7201406,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.8505962, entranceLng: 139.7201406, exitLat: 35.8505962, exitLng: 139.7201406,
                note: "ハーフIC。外回り方向は入口のみ（川口・三郷方面への入口）。座標はMapFan「川口中央IC(東京外環自動車道)【入口(外回り)】」で確認(35.8505962,139.7201406)。内回り方向(出口)はexitSelectable:falseとし、exitLat/Lngは入口座標にフォールバック。"
            },
            {
                order: 71,
                displayName: "川口東IC",
                googleName: "東京外環自動車道 川口東インターチェンジ",
                lat: 35.853075,
                lng: 139.7437836,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.853075, entranceLng: 139.7437836, exitLat: 35.853075, exitLng: 139.7437836,
                note: "ハーフIC。外回り方向は入口のみ。NEXCO公式プレスリリース（2024/8/9、川口東IC外回り入口がETC専用化）で確認。座標はMapFan「川口東IC(東京外環自動車道)【入口(外回り)】」で確認(35.853075,139.7437836)。内回り方向(出口)はexitSelectable:falseとし、exitLat/Lngは入口座標にフォールバック。"
            },
            {
                order: 72,
                displayName: "草加IC",
                googleName: "東京外環自動車道 草加インターチェンジ",
                lat: 35.8483414,
                lng: 139.7858792,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.8485305, entranceLng: 139.7892699, exitLat: 35.8481523, exitLng: 139.7824884,
                note: "フルIC。MapFan「草加IC(東京外環自動車道)【入口(外回り)】」(35.8485305,139.7892699)・【出口(外回り)】(35.8481523,139.7824884)で確認。lat/lngは入口・出口の中間点。"
            },
            {
                order: 74,
                displayName: "外環三郷西IC",
                googleName: "東京外環自動車道 外環三郷西インターチェンジ",
                lat: 35.8439126,
                lng: 139.8503453,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.8439126, entranceLng: 139.8503453, exitLat: 35.8439126, exitLng: 139.8503453,
                note: "ハーフIC。外回り方向は出口のみ。NEXCO公式プレスリリース（外環三郷西IC(外)出口閉鎖の迂回路の案内）で外回り側が出口であることを確認。座標はMapFan「外環三郷西IC(東京外環自動車道)【出口(外回り)】」で確認(35.8439126,139.8503453)。内回り方向(入口)はentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: 81,
                displayName: "三郷中央IC",
                googleName: "東京外環自動車道 三郷中央インターチェンジ",
                lat: 35.835817,
                lng: 139.860268,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.835817, entranceLng: 139.860268, exitLat: 35.835817, exitLng: 139.860268,
                note: "ハーフIC。外回り方向は入口のみ（京葉・高谷方面への入口）。座標はMapFan「三郷中央IC(東京外環自動車道)【入口(外回り)】」で確認(35.835817,139.860268)。内回り方向(出口)はexitSelectable:falseとし、exitLat/Lngは入口座標にフォールバック。"
            },
            {
                order: 82,
                displayName: "三郷南IC",
                googleName: "東京外環自動車道 三郷南インターチェンジ",
                lat: 35.8005559,
                lng: 139.8782246,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.8005559, entranceLng: 139.8782246, exitLat: 35.8005559, exitLng: 139.8782246,
                note: "ハーフIC。外回り方向は出口のみ、内回り方向は入口のみ。トラベルWatch記事およびNEXCO公式プレスリリース（2024/8/9、三郷南IC内回り入口がETC専用化）で確認。座標はMapFan「三郷南IC(東京外環自動車道)【出口(外回り)】」で確認(35.8005559,139.8782246)。内回り方向(入口)はentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: 83,
                displayName: "松戸IC",
                googleName: "東京外環自動車道 松戸インターチェンジ",
                lat: 35.7631697,
                lng: 139.8999212,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.7631697, entranceLng: 139.8999212, exitLat: 35.7631697, exitLng: 139.8999212,
                note: "ハーフIC。外回り方向は入口のみ、内回り方向は出口のみ。トラベルWatch記事で確認。座標はMapFan「松戸IC(東京外環自動車道)【入口(外回り)】」で確認(35.7631697,139.8999212)。内回り方向(出口)はexitSelectable:falseとし、exitLat/Lngは入口座標にフォールバック。"
            },
            {
                order: 85,
                displayName: "市川北IC",
                googleName: "東京外環自動車道 市川北インターチェンジ",
                lat: 35.7460009,
                lng: 139.9196188,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.7460009, entranceLng: 139.9196188, exitLat: 35.7460009, exitLng: 139.9196188,
                note: "ハーフIC。外回り方向は出口のみ、内回り方向は入口のみ。トラベルWatch記事で確認。座標はMapFan「市川北IC(東京外環自動車道)【出口(外回り)】」で確認(35.7460009,139.9196188)。内回り方向(入口)はentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: 86,
                displayName: "市川中央IC",
                googleName: "東京外環自動車道 市川中央インターチェンジ",
                lat: 35.7233703,
                lng: 139.916418,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.7233703, entranceLng: 139.916418, exitLat: 35.7233703, exitLng: 139.916418,
                note: "ハーフIC。外回り方向は入口のみ、内回り方向は出口のみ。トラベルWatch記事で確認。座標はMapFan「市川中央IC(東京外環自動車道)【入口(外回り)】」で確認(35.7233703,139.916418)。内回り方向(出口)はexitSelectable:falseとし、exitLat/Lngは入口座標にフォールバック。"
            },
            {
                order: 91,
                displayName: "市川南IC",
                googleName: "東京外環自動車道 市川南インターチェンジ",
                lat: 35.695239,
                lng: 139.9391511,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.695239, entranceLng: 139.9391511, exitLat: 35.695239, exitLng: 139.9391511,
                note: "ハーフIC。外回り方向は出口のみ、内回り方向は入口のみ。トラベルWatch記事で確認。座標はMapFan「市川南IC(東京外環自動車道)【出口(外回り)】」で確認(35.695239,139.9391511)。内回り方向(入口)はentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            }
        ]
    },

    // gaikanUchimawari: 東京外環自動車道の内回り方向（高谷JCT→大泉JCT方向）。
    // gaikan（外回り）と同一の物理IC群を、内回り側のランプ座標・入口出口可否で鏡合わせ登録。
    // orderはgaikan側の公式IC番号を負数化した値（高谷側ほど絶対値が大きい）。
    gaikanUchimawari: {
        label: "外環方面（内回り）",
        exits: [
            {
                order: -91,
                displayName: "市川南IC",
                googleName: "東京外環自動車道 市川南インターチェンジ",
                lat: 35.6944644,
                lng: 139.9393046,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.6944644, entranceLng: 139.9393046, exitLat: 35.6944644, exitLng: 139.9393046,
                note: "ハーフIC。内回り方向は入口のみ（gaikan側の外回り出口と対の方向）。トラベルWatch記事で方向を確認。座標はMapFan「市川南IC(東京外環自動車道)【入口(内回り)】」で確認(35.6944644,139.9393046)。外回り方向(出口)はexitSelectable:falseとし、exitLat/Lngは入口座標にフォールバック。"
            },
            {
                order: -86,
                displayName: "市川中央IC",
                googleName: "東京外環自動車道 市川中央インターチェンジ",
                lat: 35.7227736,
                lng: 139.9160115,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.7227736, entranceLng: 139.9160115, exitLat: 35.7227736, exitLng: 139.9160115,
                note: "ハーフIC。内回り方向は出口のみ。トラベルWatch記事で方向を確認。座標はMapFan「市川中央IC(東京外環自動車道)【出口(内回り)】」で確認(35.7227736,139.9160115)。外回り方向(入口)はentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -85,
                displayName: "市川北IC",
                googleName: "東京外環自動車道 市川北インターチェンジ",
                lat: 35.7447738,
                lng: 139.9195973,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.7447738, entranceLng: 139.9195973, exitLat: 35.7447738, exitLng: 139.9195973,
                note: "ハーフIC。内回り方向は入口のみ。トラベルWatch記事で方向を確認。座標はMapFan「市川北IC(東京外環自動車道)【入口(内回り)】」で確認(35.7447738,139.9195973)。外回り方向(出口)はexitSelectable:falseとし、exitLat/Lngは入口座標にフォールバック。"
            },
            {
                order: -83,
                displayName: "松戸IC",
                googleName: "東京外環自動車道 松戸インターチェンジ",
                lat: 35.76278,
                lng: 139.9001168,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.76278, entranceLng: 139.9001168, exitLat: 35.76278, exitLng: 139.9001168,
                note: "ハーフIC。内回り方向は出口のみ。トラベルWatch記事で方向を確認。座標はMapFan「松戸IC(東京外環自動車道)【出口(内回り)】」で確認(35.76278,139.9001168)。外回り方向(入口)はentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -82,
                displayName: "三郷南IC",
                googleName: "東京外環自動車道 三郷南インターチェンジ",
                lat: 35.8004852,
                lng: 139.8778389,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.8004852, entranceLng: 139.8778389, exitLat: 35.8004852, exitLng: 139.8778389,
                note: "ハーフIC。内回り方向は入口のみ。トラベルWatch記事およびNEXCO公式プレスリリース（2024/8/9、三郷南IC内回り入口がETC専用化）で確認。座標はMapFan「三郷南IC(東京外環自動車道)【入口(内回り)】」で確認(35.8004852,139.8778389)。外回り方向(出口)はexitSelectable:falseとし、exitLat/Lngは入口座標にフォールバック。"
            },
            {
                order: -81,
                displayName: "三郷中央IC",
                googleName: "東京外環自動車道 三郷中央インターチェンジ",
                lat: 35.827177,
                lng: 139.8692322,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.827177, entranceLng: 139.8692322, exitLat: 35.827177, exitLng: 139.8692322,
                note: "ハーフIC。内回り方向は出口のみ。座標はMapFan「三郷中央IC(東京外環自動車道)【出口(内回り)】」で確認(35.827177,139.8692322)。外回り方向(入口)はentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -74,
                displayName: "外環三郷西IC",
                googleName: "東京外環自動車道 外環三郷西インターチェンジ",
                lat: 35.836572,
                lng: 139.8583611,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.836572, entranceLng: 139.8583611, exitLat: 35.836572, exitLng: 139.8583611,
                note: "ハーフIC。内回り方向は入口のみ。NEXCO公式プレスリリース（外環三郷西IC(外)出口閉鎖の迂回路案内、外回り側が出口である旨）と整合する形で内回り側を入口と確認。座標はMapFan「外環三郷西IC(東京外環自動車道)【入口(内回り)】」で確認(35.836572,139.8583611)。外回り方向(出口)はexitSelectable:falseとし、exitLat/Lngは入口座標にフォールバック。"
            },
            {
                order: -72,
                displayName: "草加IC",
                googleName: "東京外環自動車道 草加インターチェンジ",
                lat: 35.8481156,
                lng: 139.78598605,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.847932, entranceLng: 139.7827628, exitLat: 35.8482992, exitLng: 139.7892093,
                note: "フルIC。MapFan「草加IC(東京外環自動車道)【入口(内回り)】」(35.847932,139.7827628)・【出口(内回り)】(35.8482992,139.7892093)で確認。lat/lngは入口・出口の中間点。"
            },
            {
                order: -71,
                displayName: "川口東IC",
                googleName: "東京外環自動車道 川口東インターチェンジ",
                lat: 35.8528871,
                lng: 139.7437258,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.8528871, entranceLng: 139.7437258, exitLat: 35.8528871, exitLng: 139.7437258,
                note: "ハーフIC。内回り方向は出口のみ。座標はMapFan「川口東IC(東京外環自動車道)【出口(内回り)】」で確認(35.8528871,139.7437258)。外回り方向(入口)はentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -64,
                displayName: "川口中央IC",
                googleName: "東京外環自動車道 川口中央インターチェンジ",
                lat: 35.8504997,
                lng: 139.7204253,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.8504997, entranceLng: 139.7204253, exitLat: 35.8504997, exitLng: 139.7204253,
                note: "ハーフIC。内回り方向は出口のみ。座標はMapFan「川口中央IC(東京外環自動車道)【出口(内回り)】」で確認(35.8504997,139.7204253)。外回り方向(入口)はentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -63,
                displayName: "川口西IC",
                googleName: "東京外環自動車道 川口西インターチェンジ",
                lat: 35.8464306,
                lng: 139.6996475,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.8464306, entranceLng: 139.6996475, exitLat: 35.8464306, exitLng: 139.6996475,
                note: "ハーフIC。内回り方向は入口のみ。NEXCO公式プレスリリース（2021年、内回り側入口ランプ夜間閉鎖のお知らせ）で確認済み。座標はMapFan「川口西IC(東京外環自動車道)【入口(内回り)】」で確認(35.8464306,139.6996475)。外回り方向(出口)はexitSelectable:falseとし、exitLat/Lngは入口座標にフォールバック。"
            },
            {
                order: -62,
                displayName: "外環浦和IC",
                googleName: "東京外環自動車道 外環浦和インターチェンジ",
                lat: 35.836972,
                lng: 139.6754025,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.836972, entranceLng: 139.6754025, exitLat: 35.836972, exitLng: 139.6754025,
                note: "ハーフIC。内回り方向は出口のみ。座標はMapFan「外環浦和IC(東京外環自動車道)【出口(内回り)】」で確認(35.836972,139.6754025)。外回り方向(入口)はentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -61,
                displayName: "戸田東IC",
                googleName: "東京外環自動車道 戸田東インターチェンジ",
                lat: 35.8271131,
                lng: 139.6508347,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.8271131, entranceLng: 139.6508347, exitLat: 35.8271131, exitLng: 139.6508347,
                note: "ハーフIC。内回り方向は出口のみ。座標はMapFan「戸田東IC(東京外環自動車道)【出口(内回り)】」で確認(35.8271131,139.6508347)。外回り方向(入口)はentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -53,
                displayName: "戸田西IC",
                googleName: "東京外環自動車道 戸田西インターチェンジ",
                lat: 35.8184564,
                lng: 139.6363316,
                entranceSelectable: true, exitSelectable: false, entranceLat: 35.8184564, entranceLng: 139.6363316, exitLat: 35.8184564, exitLng: 139.6363316,
                note: "ハーフIC。内回り方向は入口のみ。座標はMapFan「戸田西IC(東京外環自動車道)【入口(内回り)】」で確認(35.8184564,139.6363316)。外回り方向(出口)はexitSelectable:falseとし、exitLat/Lngは入口座標にフォールバック。"
            },
            {
                order: -52,
                displayName: "和光北IC",
                googleName: "東京外環自動車道 和光北インターチェンジ",
                lat: 35.80285705,
                lng: 139.6213011,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.8018947, entranceLng: 139.620561, exitLat: 35.8038194, exitLng: 139.6220412,
                note: "フルIC。MapFan「和光北IC(東京外環自動車道)【入口(内回り)】」(35.8018947,139.620561)・【出口(内回り)】(35.8038194,139.6220412)で確認。lat/lngは入口・出口の中間点。"
            },
            {
                order: -51,
                displayName: "和光IC",
                googleName: "東京外環自動車道 和光インターチェンジ",
                lat: 35.78469445,
                lng: 139.6130821,
                entranceSelectable: true, exitSelectable: true, entranceLat: 35.7821421, entranceLng: 139.6108254, exitLat: 35.7872468, exitLng: 139.6153388,
                note: "フルIC。MapFan「和光IC(東京外環自動車道)【入口(内回り)】」(35.7821421,139.6108254)・【出口(内回り)】(35.7872468,139.6153388)で確認。lat/lngは入口・出口の中間点。"
            }
        ]
    },

    // shutoC1Uchimawari: SHUTO_IC_MASTER内の首都高速都心環状線(C1)のうち、
    // 方向によって入口・出口の役割が入れ替わる4件（宝町・京橋・汐留・飯倉）について、
    // SHUTO_IC_MASTER本体側（代表方向）とは逆方向の役割をミラー登録したもの。
    // orderはSHUTO_IC_MASTER側の同ICのorder値を負数化（gaikan/gaikanUchimawariと同じ規則）。
    // googleNameはSHUTO_IC_MASTER側の対応ICと同一にし、identity一致による方向判定を可能にする。
    shutoC1Uchimawari: {
        label: "都心環状線方面（逆方向）",
        exits: [
            {
                order: -1,
                displayName: "宝町",
                googleName: "首都高速都心環状線 宝町出入口",
                roadType: "首都高",
                lat: 35.67788556,
                lng: 139.77513532,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.67788556, entranceLng: 139.77513532, exitLat: 35.67788556, exitLng: 139.77513532,
                note: "SHUTO_IC_MASTERの「宝町」（内回り入口を代表方向として採用）に対する外回り方向のミラーレコード。首都高公式サイト(shutoko.jp route-c1/takaracho)で外回り出口の存在を確認済み。座標はMapFan個別ページ(S3Y,J,NU4)が404で確認できなかったため、マピオン電話帳「宝町ランプ出口」で確認(35.67788556,139.77513532)。内回り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -2,
                displayName: "京橋",
                googleName: "首都高速都心環状線 京橋出入口",
                roadType: "首都高",
                lat: 35.6750043,
                lng: 139.7726618,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.6750043, entranceLng: 139.7726618, exitLat: 35.6750043, exitLng: 139.7726618,
                note: "SHUTO_IC_MASTERの「京橋」（外回り入口を代表方向として採用）に対する内回り方向のミラーレコード。首都高公式サイト(shutoko.jp route-c1/kyoubashi)で内回り出口の存在を確認済み。座標はMapFan「京橋ランプ（都心環状線）【出口（内回り）】」で確認(35.6750043,139.7726618)。外回り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -5,
                displayName: "汐留",
                googleName: "首都高速都心環状線 汐留出入口",
                roadType: "首都高",
                lat: 35.6633142,
                lng: 139.7625511,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.6633142, entranceLng: 139.7625511, exitLat: 35.6633142, exitLng: 139.7625511,
                note: "SHUTO_IC_MASTERの「汐留」（外回り入口を代表方向として採用）に対する内回り方向のミラーレコード。首都高公式サイト(shutoko.jp route-c1/shiodome)で内回り出口の存在を確認済み。座標はMapFan「汐留ランプ（都心環状線）【出口（内回り）】」で確認(35.6633142,139.7625511)。外回り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -7,
                displayName: "飯倉",
                googleName: "首都高速都心環状線 飯倉出入口",
                roadType: "首都高",
                lat: 35.6600066,
                lng: 139.7368456,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.6600066, entranceLng: 139.7368456, exitLat: 35.6600066, exitLng: 139.7368456,
                note: "SHUTO_IC_MASTERの「飯倉」（内回り入口を代表方向として採用）に対する外回り方向のミラーレコード。首都高公式サイト(shutoko.jp route-c1/iikura)で外回り出口の存在を確認済み。座標はMapFan「飯倉ランプ（都心環状線）【出口（外回り）】」で確認(35.6600066,139.7368456)。内回り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            }
        ]
    },

    // shutoC2Uchimawari: SHUTO_IC_MASTER内の首都高速中央環状線(C2)のうち、
    // 方向によって入口・出口の役割が入れ替わる10件について、
    // SHUTO_IC_MASTER本体側（代表方向）とは逆方向の役割をミラー登録したもの。
    // orderはSHUTO_IC_MASTER側の同ICのorder値を負数化（gaikan/gaikanUchimawariと同じ規則）。
    shutoC2Uchimawari: {
        label: "中央環状線方面（逆方向）",
        exits: [
            {
                order: -1,
                displayName: "中環大井南",
                googleName: "首都高速中央環状線 中環大井南出入口",
                roadType: "首都高",
                lat: 35.6013968,
                lng: 139.7557747,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.6013968, entranceLng: 139.7557747, exitLat: 35.6013968, exitLng: 139.7557747,
                note: "SHUTO_IC_MASTERの「中環大井南」（外回り入口を代表方向として採用）に対する内回り方向のミラーレコード。首都高公式サイト(shutoko.jp route-c2/chukanooiminami)で内回り出口の存在を確認済み。座標はMapFan「中環大井南ランプ（中央環状線（山手トンネル））【出口（内回り）】」で確認(35.6013968,139.7557747)。外回り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -2,
                displayName: "五反田",
                googleName: "首都高速中央環状線 五反田出入口",
                roadType: "首都高",
                lat: 35.6279557,
                lng: 139.7131047,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.6279557, entranceLng: 139.7131047, exitLat: 35.6279557, exitLng: 139.7131047,
                note: "SHUTO_IC_MASTERの「五反田」（外回り入口を代表方向として採用）に対する内回り方向のミラーレコード。首都高公式サイト(shutoko.jp route-c2/gotanda)で内回り出口の存在を確認済み。座標はMapFan「五反田ランプ（中央環状線（山手トンネル））【出口（内回り）】」で確認(35.6279557,139.7131047)。外回り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -3,
                displayName: "富ヶ谷",
                googleName: "首都高速中央環状線 富ヶ谷出入口",
                roadType: "首都高",
                lat: 35.6639768,
                lng: 139.6878959,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.6639768, entranceLng: 139.6878959, exitLat: 35.6639768, exitLng: 139.6878959,
                note: "SHUTO_IC_MASTERの「富ヶ谷」（外回り入口を代表方向として採用）に対する内回り方向のミラーレコード。首都高公式サイト(shutoko.jp route-c2/tomigaya)で内回り出口の存在を確認済み。座標はMapFan「富ヶ谷ランプ（中央環状線（山手トンネル））【出口（内回り）】」で確認(35.6639768,139.6878959)。外回り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -4,
                displayName: "初台南",
                googleName: "首都高速中央環状線 初台南出入口",
                roadType: "首都高",
                lat: 35.6755305,
                lng: 139.6877129,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.6755305, entranceLng: 139.6877129, exitLat: 35.6755305, exitLng: 139.6877129,
                note: "SHUTO_IC_MASTERの「初台南」（内回り入口を代表方向として採用）に対する外回り方向のミラーレコード。首都高公式サイト(shutoko.jp route-c2/hatsudaiminami)で外回り出口の存在を確認済み。座標はMapFan「初台南ランプ（中央環状線（山手トンネル））【出口（外回り）】」で確認(35.6755305,139.6877129)。内回り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -5,
                displayName: "中野長者橋",
                googleName: "首都高速中央環状線 中野長者橋出入口",
                roadType: "首都高",
                lat: 35.6936813,
                lng: 139.682356,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.6936813, entranceLng: 139.682356, exitLat: 35.6936813, exitLng: 139.682356,
                note: "SHUTO_IC_MASTERの「中野長者橋」（外回り入口を代表方向として採用）に対する内回り方向のミラーレコード。首都高公式サイト(shutoko.jp route-c2/nakanochoujabashi)で内回り出口の存在を確認済み。座標はMapFan「中野長者橋ランプ（中央環状線（山手トンネル））【出口（内回り）】」で確認(35.6936813,139.682356)。外回り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -10,
                displayName: "王子南",
                googleName: "首都高速中央環状線 王子南出入口",
                roadType: "首都高",
                lat: 35.7552346,
                lng: 139.7423909,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.7552346, entranceLng: 139.7423909, exitLat: 35.7552346, exitLng: 139.7423909,
                note: "SHUTO_IC_MASTERの「王子南」（内回り入口を代表方向として採用）に対する外回り方向のミラーレコード。首都高公式サイト(shutoko.jp route-c2/oujiminami)で外回り出口の存在を確認済み。座標はMapFan「王子南ランプ（中央環状線）【出口（外回り）】」で確認(35.7552346,139.7423909)。内回り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -14,
                displayName: "小菅",
                googleName: "首都高速中央環状線 小菅出入口",
                roadType: "首都高",
                lat: 35.7511342,
                lng: 139.8210043,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.7511342, entranceLng: 139.8210043, exitLat: 35.7511342, exitLng: 139.8210043,
                note: "SHUTO_IC_MASTERの「小菅」（外回り入口を代表方向として採用）に対する内回り方向のミラーレコード。SHUTO_IC_MASTER側noteで内回り出口の存在を確認済み（個別のshutoko.jp出入口ページURLは未特定）。座標はMapFan「小菅ランプ（中央環状線）【出口（内回り）】」で確認(35.7511342,139.8210043)。外回り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -16,
                displayName: "平井大橋",
                googleName: "首都高速中央環状線 平井大橋出入口",
                roadType: "首都高",
                lat: 35.7147245,
                lng: 139.8505446,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.7147245, entranceLng: 139.8505446, exitLat: 35.7147245, exitLng: 139.8505446,
                note: "SHUTO_IC_MASTERの「平井大橋」（内回り入口を代表方向として採用）に対する外回り方向のミラーレコード。首都高公式サイト(shutoko.jp route-c2/hiraioohashi)で外回り出口の存在を確認済み。座標はMapFan「平井大橋ランプ（中央環状線）【出口（外回り）】」で確認(35.7147245,139.8505446)。内回り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -18,
                displayName: "船堀橋",
                googleName: "首都高速中央環状線 船堀橋出入口",
                roadType: "首都高",
                lat: 35.688526,
                lng: 139.8577375,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.688526, entranceLng: 139.8577375, exitLat: 35.688526, exitLng: 139.8577375,
                note: "SHUTO_IC_MASTERの「船堀橋」（外回り入口を代表方向として採用）に対する内回り方向のミラーレコード。首都高公式サイト(shutoko.jp route-c2/funaboribashi)で内回り出口の存在を確認済み。座標はMapFan「船堀橋ランプ（中央環状線）【出口（内回り）】」で確認(35.688526,139.8577375)。外回り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -19,
                displayName: "清新町",
                googleName: "首都高速中央環状線 清新町出入口",
                roadType: "首都高",
                lat: 35.6651955,
                lng: 139.8530795,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.6651955, entranceLng: 139.8530795, exitLat: 35.6651955, exitLng: 139.8530795,
                note: "SHUTO_IC_MASTERの「清新町」（内回り入口を代表方向として採用）に対する外回り方向のミラーレコード。首都高公式サイト(shutoko.jp route-c2/seishincho)で外回り出口の存在を確認済み。座標はMapFan「清新町ランプ（中央環状線）【出口（外回り）】」で確認(35.6651955,139.8530795)。内回り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            }
        ]
    },

    // 以下、線形路線（上り/下り）30件向けのミラーエリア群。
    // gaikan/gaikanUchimawari・shutoC1Uchimawari/shutoC2Uchimawariと同じ設計方針。
    // SHUTO_IC_MASTER本体側（代表方向、entranceSelectable:true/exitSelectable:false）に対し、
    // 逆方向（現在exitSelectable:falseで抑制している側）をミラーレコードとして登録する。
    // orderは本体側の同ICのorder値を負数化。googleNameは本体側と同一にし、identity一致を可能にする。
    // 座標は、本体側で既にentranceLat/exitLatが別々に確認済みのIC（26件）はexitLat/exitLngをそのまま転用し、
    // 単一の共有座標のみだった4件（目黒・飯田橋・小松川・一之江）は今回新たにMapFanで逆方向ランプ座標を確認した。

    shuto6MukoUchimawari: {
        label: "首都高速6号向島線方面（逆方向）",
        exits: [
            {
                order: -4,
                displayName: "駒形",
                googleName: "首都高速6号向島線 駒形出入口",
                roadType: "首都高",
                lat: 35.707552,
                lng: 139.798075,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.707552, entranceLng: 139.798075, exitLat: 35.707552, exitLng: 139.798075,
                note: "SHUTO_IC_MASTERの「駒形」（上り入口を代表方向として採用）に対する下り方向のミラーレコード。座標は本体側で既に確認済みのexitLat/Lngをそのまま転用(35.707552,139.798075)。上り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            }
        ]
    },

    shuto6MisatoUchimawari: {
        label: "首都高速6号三郷線方面（逆方向）",
        exits: [
            {
                order: -4,
                displayName: "三郷",
                googleName: "首都高速6号三郷線 三郷出入口",
                roadType: "首都高",
                lat: 35.835239,
                lng: 139.857745,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.835239, entranceLng: 139.857745, exitLat: 35.835239, exitLng: 139.857745,
                note: "SHUTO_IC_MASTERの「三郷」（上り入口を代表方向として採用）に対する下り方向のミラーレコード。座標は本体側で既に確認済みのexitLat/Lngをそのまま転用(35.835239,139.857745)。上り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            }
        ]
    },

    shuto7KomatsugawaUchimawari: {
        label: "首都高速7号小松川線方面（逆方向）",
        exits: [
            {
                order: -2,
                displayName: "小松川",
                googleName: "首都高速7号小松川線 小松川出入口",
                roadType: "首都高",
                lat: 35.69924,
                lng: 139.8662864,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.69924, entranceLng: 139.8662864, exitLat: 35.69924, exitLng: 139.8662864,
                note: "SHUTO_IC_MASTERの「小松川」（上り入口を代表方向として採用）に対する下り方向のミラーレコード。首都高公式サイト(shutoko.jp route-7/komatsugawa)で下り出口の存在を確認済み。座標はMapFan「小松川ランプ（７号小松川線）【出口（下り）】」で新規確認(35.69924,139.8662864)。上り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -3,
                displayName: "一之江",
                googleName: "首都高速7号小松川線 一之江出入口",
                roadType: "首都高",
                lat: 35.6975345,
                lng: 139.8815616,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.6975345, entranceLng: 139.8815616, exitLat: 35.6975345, exitLng: 139.8815616,
                note: "SHUTO_IC_MASTERの「一之江」（上り入口を代表方向として採用）に対する下り方向のミラーレコード。首都高公式サイト(shutoko.jp route-7/ichinoe)で下り出口の存在を確認済み。座標はMapFan「一之江ランプ（７号小松川線）【出口（下り）】」で新規確認(35.6975345,139.8815616)。上り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            }
        ]
    },

    shuto1UenoUchimawari: {
        label: "首都高速1号上野線方面（逆方向）",
        exits: [
            {
                order: -3,
                displayName: "入谷",
                googleName: "首都高速1号上野線 入谷出入口",
                roadType: "首都高",
                lat: 35.719763,
                lng: 139.783689,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.719763, entranceLng: 139.783689, exitLat: 35.719763, exitLng: 139.783689,
                note: "SHUTO_IC_MASTERの「入谷」（上り入口を代表方向として採用）に対する下り方向のミラーレコード。座標は本体側で既に確認済みのexitLat/Lngをそのまま転用(35.719763,139.783689)。上り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            }
        ]
    },

    shuto4ShinjukuUchimawari: {
        label: "首都高速4号新宿線方面（逆方向）",
        exits: [
            {
                order: -4,
                displayName: "初台",
                googleName: "首都高速4号新宿線 初台出入口",
                roadType: "首都高",
                lat: 35.680202,
                lng: 139.684429,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.680202, entranceLng: 139.684429, exitLat: 35.680202, exitLng: 139.684429,
                note: "SHUTO_IC_MASTERの「初台」（下り入口を代表方向として採用）に対する上り方向のミラーレコード。座標は本体側で既に確認済みのexitLat/Lngをそのまま転用(35.680202,139.684429)。下り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -5,
                displayName: "幡ヶ谷",
                googleName: "首都高速4号新宿線 幡ヶ谷出入口",
                roadType: "首都高",
                lat: 35.676663,
                lng: 139.675273,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.676663, entranceLng: 139.675273, exitLat: 35.676663, exitLng: 139.675273,
                note: "SHUTO_IC_MASTERの「幡ヶ谷」（上り入口を代表方向として採用）に対する下り方向のミラーレコード。座標は本体側で既に確認済みのexitLat/Lngをそのまま転用(35.676663,139.675273)。上り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            }
        ]
    },

    shuto5IkebukuroUchimawari: {
        label: "首都高速5号池袋線方面（逆方向）",
        exits: [
            {
                order: -2,
                displayName: "西神田",
                googleName: "首都高速5号池袋線 西神田出入口",
                roadType: "首都高",
                lat: 35.697927,
                lng: 139.752251,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.697927, entranceLng: 139.752251, exitLat: 35.697927, exitLng: 139.752251,
                note: "SHUTO_IC_MASTERの「西神田」（上り入口を代表方向として採用）に対する下り方向のミラーレコード。座標は本体側で既に確認済みのexitLat/Lngをそのまま転用(35.697927,139.752251)。上り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -3,
                displayName: "飯田橋",
                googleName: "首都高速5号池袋線 飯田橋出入口",
                roadType: "首都高",
                lat: 35.7037737,
                lng: 139.7448305,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.7037737, entranceLng: 139.7448305, exitLat: 35.7037737, exitLng: 139.7448305,
                note: "SHUTO_IC_MASTERの「飯田橋」（下り入口を代表方向として採用）に対する上り方向のミラーレコード。首都高公式サイト(shutoko.jp route-5/iidabashi)で上り出口の存在を確認済み。座標はMapFan「飯田橋ランプ（５号池袋線）【出口（上り）】」で新規確認(35.7037737,139.7448305)。下り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -5,
                displayName: "護国寺",
                googleName: "首都高速5号池袋線 護国寺出入口",
                roadType: "首都高",
                lat: 35.719170,
                lng: 139.725720,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.719170, entranceLng: 139.725720, exitLat: 35.719170, exitLng: 139.725720,
                note: "SHUTO_IC_MASTERの「護国寺」（上り入口を代表方向として採用）に対する下り方向のミラーレコード。座標は本体側で既に確認済みのexitLat/Lngをそのまま転用(35.719170,139.725720)。上り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -7,
                displayName: "北池袋",
                googleName: "首都高速5号池袋線 北池袋出入口",
                roadType: "首都高",
                lat: 35.740540,
                lng: 139.707525,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.740540, entranceLng: 139.707525, exitLat: 35.740540, exitLng: 139.707525,
                note: "SHUTO_IC_MASTERの「北池袋」（上り入口を代表方向として採用）に対する下り方向のミラーレコード。座標は本体側で既に確認済みのexitLat/Lngをそのまま転用(35.740540,139.707525)。上り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -9,
                displayName: "中台",
                googleName: "首都高速5号池袋線 中台出入口",
                roadType: "首都高",
                lat: 35.775913,
                lng: 139.678934,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.775913, entranceLng: 139.678934, exitLat: 35.775913, exitLng: 139.678934,
                note: "SHUTO_IC_MASTERの「中台」（上り入口を代表方向として採用）に対する下り方向のミラーレコード。座標は本体側で既に確認済みのexitLat/Lngをそのまま転用(35.775913,139.678934)。上り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -10,
                displayName: "高島平",
                googleName: "首都高速5号池袋線 高島平出入口",
                roadType: "首都高",
                lat: 35.785819,
                lng: 139.646359,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.785819, entranceLng: 139.646359, exitLat: 35.785819, exitLng: 139.646359,
                note: "SHUTO_IC_MASTERの「高島平」（上り入口を代表方向として採用）に対する下り方向のミラーレコード。座標は本体側で既に確認済みのexitLat/Lngをそのまま転用(35.785819,139.646359)。上り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -11,
                displayName: "戸田南",
                googleName: "首都高速5号池袋線 戸田南出入口",
                roadType: "首都高",
                lat: 35.805776,
                lng: 139.649120,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.805776, entranceLng: 139.649120, exitLat: 35.805776, exitLng: 139.649120,
                note: "SHUTO_IC_MASTERの「戸田南」（上り入口を代表方向として採用）に対する下り方向のミラーレコード。座標は本体側で既に確認済みのexitLat/Lngをそのまま転用(35.805776,139.649120)。上り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -12,
                displayName: "戸田",
                googleName: "首都高速5号池袋線 戸田出入口",
                roadType: "首都高",
                lat: 35.820069,
                lng: 139.644340,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.820069, entranceLng: 139.644340, exitLat: 35.820069, exitLng: 139.644340,
                note: "SHUTO_IC_MASTERの「戸田」（下り入口を代表方向として採用）に対する上り方向のミラーレコード。座標は本体側で既に確認済みのexitLat/Lngをそのまま転用(35.820069,139.644340)。下り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            }
        ]
    },

    shuto3ShibuyaUchimawari: {
        label: "首都高速3号渋谷線方面（逆方向）",
        exits: [
            {
                order: -1,
                displayName: "高樹町",
                googleName: "首都高速3号渋谷線 高樹町出入口",
                roadType: "首都高",
                lat: 35.659301,
                lng: 139.719804,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.659301, entranceLng: 139.719804, exitLat: 35.659301, exitLng: 139.719804,
                note: "SHUTO_IC_MASTERの「高樹町」（上り入口を代表方向として採用）に対する下り方向のミラーレコード。座標は本体側で既に確認済みのexitLat/Lngをそのまま転用(35.659301,139.719804)。上り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -3,
                displayName: "池尻",
                googleName: "首都高速3号渋谷線 池尻出入口",
                roadType: "首都高",
                lat: 35.649044,
                lng: 139.681494,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.649044, entranceLng: 139.681494, exitLat: 35.649044, exitLng: 139.681494,
                note: "SHUTO_IC_MASTERの「池尻」（下り入口を代表方向として採用）に対する上り方向のミラーレコード。座標は本体側で既に確認済みのexitLat/Lngをそのまま転用(35.649044,139.681494)。下り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -4,
                displayName: "三軒茶屋",
                googleName: "首都高速3号渋谷線 三軒茶屋出入口",
                roadType: "首都高",
                lat: 35.644056,
                lng: 139.672592,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.644056, entranceLng: 139.672592, exitLat: 35.644056, exitLng: 139.672592,
                note: "SHUTO_IC_MASTERの「三軒茶屋」（上り入口を代表方向として採用）に対する下り方向のミラーレコード。座標は本体側で既に確認済みのexitLat/Lngをそのまま転用(35.644056,139.672592)。上り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            }
        ]
    },

    shuto2MeguroUchimawari: {
        label: "首都高速2号目黒線方面（逆方向）",
        exits: [
            {
                order: -1,
                displayName: "天現寺",
                googleName: "首都高速2号目黒線 天現寺出入口",
                roadType: "首都高",
                lat: 35.646625,
                lng: 139.725832,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.646625, entranceLng: 139.725832, exitLat: 35.646625, exitLng: 139.725832,
                note: "SHUTO_IC_MASTERの「天現寺」（上り入口を代表方向として採用）に対する下り方向のミラーレコード。座標は本体側で既に確認済みのexitLat/Lngをそのまま転用(35.646625,139.725832)。上り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -2,
                displayName: "目黒",
                googleName: "首都高速2号目黒線 目黒出入口",
                roadType: "首都高",
                lat: 35.6360629,
                lng: 139.7184032,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.6360629, entranceLng: 139.7184032, exitLat: 35.6360629, exitLng: 139.7184032,
                note: "SHUTO_IC_MASTERの「目黒」（上り入口を代表方向として採用）に対する下り方向のミラーレコード。首都高公式サイト(shutoko.jp route-2/meguro)で下り出口の存在を確認済み。座標はMapFan「目黒ランプ（２号目黒線）【出口（下り）】」で新規確認(35.6360629,139.7184032)。上り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -4,
                displayName: "荏原",
                googleName: "首都高速2号目黒線 荏原出入口",
                roadType: "首都高",
                lat: 35.618687,
                lng: 139.715724,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.618687, entranceLng: 139.715724, exitLat: 35.618687, exitLng: 139.715724,
                note: "SHUTO_IC_MASTERの「荏原」（上り入口を代表方向として採用）に対する下り方向のミラーレコード。座標は本体側で既に確認済みのexitLat/Lngをそのまま転用(35.618687,139.715724)。上り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            }
        ]
    },

    shutoBWanganUchimawari: {
        label: "首都高速湾岸線方面（逆方向）",
        exits: [
            {
                order: -7,
                displayName: "臨海副都心",
                googleName: "首都高速湾岸線 臨海副都心出入口",
                roadType: "首都高",
                lat: 35.625993,
                lng: 139.773874,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.625993, entranceLng: 139.773874, exitLat: 35.625993, exitLng: 139.773874,
                note: "SHUTO_IC_MASTERの「臨海副都心」（西行き入口を代表方向として採用）に対する東行き方向のミラーレコード。座標は本体側で既に確認済みのexitLat/Lngをそのまま転用(35.625993,139.773874)。西行き方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -8,
                displayName: "大井",
                googleName: "首都高速湾岸線 大井出入口",
                roadType: "首都高",
                lat: 35.611819,
                lng: 139.756607,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.611819, entranceLng: 139.756607, exitLat: 35.611819, exitLng: 139.756607,
                note: "SHUTO_IC_MASTERの「大井」（東行き入口を代表方向として採用）に対する西行き方向のミラーレコード。座標は本体側で既に確認済みのexitLat/Lngをそのまま転用(35.611819,139.756607)。東行き方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -11,
                displayName: "湾岸環八",
                googleName: "首都高速湾岸線 湾岸環八出入口",
                roadType: "首都高",
                lat: 35.540368,
                lng: 139.792927,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.540368, entranceLng: 139.792927, exitLat: 35.540368, exitLng: 139.792927,
                note: "SHUTO_IC_MASTERの「湾岸環八」（西行き入口を代表方向として採用）に対する東行き方向のミラーレコード。座標は本体側で既に確認済みのexitLat/Lngをそのまま転用(35.540368,139.792927)。西行き方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -17,
                displayName: "三溪園",
                googleName: "首都高速湾岸線 三溪園出入口",
                roadType: "首都高",
                lat: 35.412549,
                lng: 139.661584,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.412549, entranceLng: 139.661584, exitLat: 35.412549, exitLng: 139.661584,
                note: "SHUTO_IC_MASTERの「三溪園」（西行き入口を代表方向として採用）に対する東行き方向のミラーレコード。座標は本体側で既に確認済みのexitLat/Lngをそのまま転用(35.412549,139.661584)。西行き方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -18,
                displayName: "磯子",
                googleName: "首都高速湾岸線 磯子出入口",
                roadType: "首都高",
                lat: 35.397064,
                lng: 139.617192,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.397064, entranceLng: 139.617192, exitLat: 35.397064, exitLng: 139.617192,
                note: "SHUTO_IC_MASTERの「磯子」（東行き入口を代表方向として採用）に対する西行き方向のミラーレコード。座標は本体側で既に確認済みのexitLat/Lngをそのまま転用(35.397064,139.617192)。東行き方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            }
        ]
    },

    shutoS1KawaguchiUchimawari: {
        label: "首都高速川口線方面（逆方向）",
        exits: [
            {
                order: -3,
                displayName: "加賀",
                googleName: "首都高速川口線 加賀出入口",
                roadType: "首都高",
                lat: 35.794786,
                lng: 139.759737,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.794786, entranceLng: 139.759737, exitLat: 35.794786, exitLng: 139.759737,
                note: "SHUTO_IC_MASTERの「加賀」（上り入口を代表方向として採用）に対する下り方向のミラーレコード。座標は本体側で既に確認済みのexitLat/Lngをそのまま転用(35.794786,139.759737)。上り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -4,
                displayName: "足立入谷",
                googleName: "首都高速川口線 足立入谷出入口",
                roadType: "首都高",
                lat: 35.804822,
                lng: 139.759663,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.804822, entranceLng: 139.759663, exitLat: 35.804822, exitLng: 139.759663,
                note: "SHUTO_IC_MASTERの「足立入谷」（下り入口を代表方向として採用）に対する上り方向のミラーレコード。座標は本体側で既に確認済みのexitLat/Lngをそのまま転用(35.804822,139.759663)。下り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -6,
                displayName: "安行",
                googleName: "首都高速川口線 安行出入口",
                roadType: "首都高",
                lat: 35.835560,
                lng: 139.755615,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.835560, entranceLng: 139.755615, exitLat: 35.835560, exitLng: 139.755615,
                note: "SHUTO_IC_MASTERの「安行」（上り入口を代表方向として採用）に対する下り方向のミラーレコード。座標は本体側で既に確認済みのexitLat/Lngをそのまま転用(35.835560,139.755615)。上り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            },
            {
                order: -7,
                displayName: "新井宿",
                googleName: "首都高速川口線 新井宿出入口",
                roadType: "首都高",
                lat: 35.847266,
                lng: 139.737857,
                entranceSelectable: false, exitSelectable: true, entranceLat: 35.847266, entranceLng: 139.737857, exitLat: 35.847266, exitLng: 139.737857,
                note: "SHUTO_IC_MASTERの「新井宿」（上り入口を代表方向として採用）に対する下り方向のミラーレコード。座標は本体側で既に確認済みのexitLat/Lngをそのまま転用(35.847266,139.737857)。上り方向(入口)は本ミラーでは使用しないためentranceSelectable:falseとし、entranceLat/Lngは出口座標にフォールバック。"
            }
        ]
    }

};

function buildIcDefinitionIdentity(ic) {

    const googleName = String(ic?.googleName || "").trim();

    if (googleName) {
        return "googleName:" + googleName;
    }

    const displayName = String(ic?.displayName || "").trim();

    if (!displayName) {
        return "";
    }

    return (
        "location:" +
        displayName + "|" +
        String(ic?.lat ?? "") + "|" +
        String(ic?.lng ?? "")
    );
}

// IC_MASTER冒頭のコメント（「接続道路のICは重複登録を許可する。例:
// 木更津金田ICをアクアライン・館山道双方へ保持する。」）の通り、接続道路の
// ICはIC_MASTER内で意図的に複数エリアに重複登録されている。
// dedupeIcDefinitionsByIdentityは、この重複の中から候補選定・道路ラベル判定用の
// 代表1件を選ぶ役割を持つが、従来は「Object.entries(IC_MASTER)の記述順で
// 先に処理された方」という、記述順という偶然に依存した優先順位だった
// （蘇我IC・藤岡IC等で、googleNameの道路名と実際に優先されるエリアが
// 一致しない誤りが実車確認で見つかった）。
// ここでは、googleNameに含まれる道路名パターンから「本来所属すべきエリア」を
// 判定し、記述順より優先する。パターンに一致しないgoogleName（この5道路に
// 該当しないIC、SHUTO_IC_MASTER側等）には一切影響しない。
const NEXCO_AREA_KEY_BY_ROAD_NAME_PATTERN = [
    [/京葉/, "keiyo"],
    [/館山/, "tateyama"],
    [/関越/, "kanetsu"],
    [/上信越/, "joshinetsu"],
    [/東京湾アクアライン/, "aqualine"]
];

function getExpectedNexcoAreaKeyForGoogleName(googleName) {

    const value = String(googleName || "");

    const matchedRule =
        NEXCO_AREA_KEY_BY_ROAD_NAME_PATTERN.find(([pattern]) =>
            pattern.test(value)
        );

    return matchedRule ? matchedRule[1] : null;
}

function dedupeIcDefinitionsByIdentity(icList) {

    const definitionsByIdentity = new Map();
    const definitionsWithoutIdentity = [];

    (icList || []).forEach(ic => {
        if (!ic) {
            return;
        }

        const identity = buildIcDefinitionIdentity(ic);

        if (!identity) {
            definitionsWithoutIdentity.push(ic);
            return;
        }

        const existing = definitionsByIdentity.get(identity);

        // NEXCO方向判定ミラー（isMirror:true）は、候補選定の入口
        // （resolveEffectiveNexcoExit等）でのみ明示的に参照される想定の
        // 内部データであり、この一般的な重複排除では本体（非ミラー）を
        // 優先する。本体が未登録の場合のみミラーが暫定的に採用されるが、
        // 通常は同一identityの本体が必ず存在するため実質的に発生しない。
        if (
            ic.isMirror === true &&
            existing &&
            existing.isMirror !== true
        ) {
            return;
        }

        const expectedAreaKey =
            getExpectedNexcoAreaKeyForGoogleName(ic.googleName);

        const icMatchesExpectedArea =
            expectedAreaKey !== null &&
            ic.sourceAreaKey === expectedAreaKey;

        const existingMatchesExpectedArea =
            expectedAreaKey !== null &&
            Boolean(existing) &&
            existing.sourceAreaKey === expectedAreaKey;

        if (
            !existing ||
            (
                ic.source === "SHUTO_IC_MASTER" &&
                existing.source !== "SHUTO_IC_MASTER"
            ) ||
            (
                existing.isMirror === true &&
                ic.isMirror !== true
            ) ||
            (
                icMatchesExpectedArea &&
                !existingMatchesExpectedArea
            )
        ) {
            definitionsByIdentity.set(identity, ic);
        }
    });

    return [
        ...definitionsByIdentity.values(),
        ...definitionsWithoutIdentity
    ];
}

function normalizeShutoIcForRouteAnalysis(shutoIc) {

    if (!shutoIc) {
        return null;
    }

    const entranceSelectable =
        shutoIc.entranceSelectable !== false;

    const exitSelectable =
        shutoIc.exitSelectable !== false;

    const isSelectable =
        shutoIc.isSelectable === false
            ? false
            : Boolean(
                entranceSelectable ||
                exitSelectable
            );

    return {
        ...shutoIc,
        entranceSelectable,
        exitSelectable,
        isSelectable,
        source: "SHUTO_IC_MASTER"
    };
}

function getAllShutoIcDefinitions() {

    return SHUTO_IC_MASTER
        .map(normalizeShutoIcForRouteAnalysis)
        .filter(Boolean);
}

function getAllNexcoIcDefinitions() {

    const definitions = [];
    const listTypes = ["entrances", "exits"];

    Object.entries(IC_MASTER).forEach(
        ([areaKey, areaDefinition]) => {
            listTypes.forEach(listType => {
                const icList = areaDefinition?.[listType];

                if (!Array.isArray(icList)) {
                    return;
                }

                icList.forEach(ic => {
                    definitions.push({
                        ...ic,
                        source: "IC_MASTER",
                        sourceAreaKey: areaKey,
                        sourceListType: listType
                    });
                });
            });
        }
    );

    return definitions;
}

function getAllRouteAnalysisIcDefinitions() {

    return dedupeIcDefinitionsByIdentity([
        ...getAllNexcoIcDefinitions(),
        ...getAllShutoIcDefinitions()
    ]);
}

console.log(
    "常磐道IC数",
    IC_MASTER.joban.exits.length
);

console.log(
    "常磐道lat/lng未設定",
    IC_MASTER.joban.exits
        .filter(exit =>
            exit.lat === undefined ||
            exit.lng === undefined
        )
        .map(exit => exit.displayName)
);



let currentLatitude = null;
let currentLongitude = null;

const geocodeLatLngCache = new Map();

const ROUTES_CACHE_TTL_MS = 120 * 1000;
const ROUTES_CACHE_LOCATION_RADIUS_METERS = 100;
const routesResponseCache = new Map();

function createRoutesCacheEndpointKey(
    value,
    isCurrentLocation = false
) {
    if (isCurrentLocation) {
        return {
            currentLocation: true
        };
    }

    return value;
}

function isCurrentLocationRouteOrigin(value) {
    return Boolean(
        value &&
        typeof value === "object" &&
        value.lat !== undefined &&
        value.lng !== undefined
    );
}

function createRoutesCacheKey(
    origin,
    destination,
    routeOptions,
    role
) {
    return JSON.stringify({
        origin: origin,
        destination: destination,
        routeOptions: routeOptions,
        role: role
    });
}

function createRoutesCacheRequest(
    functionName,
    origin,
    destination,
    routeOptions,
    role
) {
    return {
        key: createRoutesCacheKey(
            origin,
            destination,
            routeOptions,
            role
        ),
        functionName: functionName,
        origin: origin,
        destination: destination,
        routeOptionsKey: JSON.stringify(routeOptions)
    };
}

function formatRoutesCacheLogValue(value) {
    if (
        value &&
        typeof value === "object" &&
        value.currentLocation
    ) {
        return (
            "current-location(" +
            currentLatitude +
            "," +
            currentLongitude +
            ")"
        );
    }

    if (typeof value === "object") {
        return JSON.stringify(value);
    }

    return String(value ?? "");
}

function logRoutesCacheResult(
    result,
    request,
    reason = ""
) {
    let message =
        "[Routes Cache " + result + "] " +
        request.functionName +
        " origin=" +
        formatRoutesCacheLogValue(request.origin) +
        " destination=" +
        formatRoutesCacheLogValue(request.destination);

    if (reason) {
        message += " reason=" + reason;
    }

    console.log(message);
}

function getCachedRoutesResponse(request) {
    const cached =
        routesResponseCache.get(request.key);

    if (isAutoReSearchRunning) {
        logRoutesCacheResult(
            "MISS",
            request,
            "auto-update"
        );
        return undefined;
    }

    if (!cached) {
        const hasSameRouteOptions =
            Array.from(routesResponseCache.values())
                .some(entry =>
                    entry.routeOptionsKey ===
                    request.routeOptionsKey
                );

        logRoutesCacheResult(
            "MISS",
            request,
            hasSameRouteOptions
                ? "different-key"
                : "no-cache"
        );
        return undefined;
    }

    if (
        currentLatitude === null ||
        currentLongitude === null
    ) {
        logRoutesCacheResult(
            "MISS",
            request,
            "location-unavailable"
        );
        return undefined;
    }

    const age =
        Date.now() - cached.createdAt;

    const distance =
        calculateDistance(
            cached.latitude,
            cached.longitude,
            currentLatitude,
            currentLongitude
        );

    if (age > ROUTES_CACHE_TTL_MS) {
        routesResponseCache.delete(request.key);
        logRoutesCacheResult(
            "MISS",
            request,
            "expired"
        );
        return undefined;
    }

    if (distance > ROUTES_CACHE_LOCATION_RADIUS_METERS) {
        routesResponseCache.delete(request.key);
        logRoutesCacheResult(
            "MISS",
            request,
            "location-too-far"
        );
        return undefined;
    }

    logRoutesCacheResult("HIT", request);
    return cached.response;
}

function cacheRoutesResponse(request, response) {
    if (
        currentLatitude === null ||
        currentLongitude === null
    ) {
        return;
    }

    routesResponseCache.set(request.key, {
        key: request.key,
        response: response,
        createdAt: Date.now(),
        latitude: currentLatitude,
        longitude: currentLongitude,
        routeOptionsKey: request.routeOptionsKey
    });
}

let lastSearchLatitude = null;
let lastSearchLongitude = null;

let lastSearchTime = null;

let lastAutoReSearchFailureTime = 0;

let lastSearchLocationName = "";

let lastNearestIcName = "";
let lastNearestIcDistanceKm = null;

let lastTollStartIcName = "";
let lastTollStartIcGoogleName = "";
let lastTollStartIcOrder = null;
let lastTollStartIc = null;
let lastTollEndIcName = "";
let lastTollEndIcGoogleName = "";
let lastTollEndIcOrder = null;
let lastTollEndIc = null;


let lastGpsReceivedTime = null;

let gpsErrorBlinkShown = false;

let lastRecommendationText = "";
let lastIcAreaDecisionType = "";
let lastResolvedIcArea = null;

let lastSearchMode = "";
let lastLocalRouteMinutes = null;
let lastProbablyNoTollRoute = false;
let lastProbablyNoTollRouteByPolylineComparison = false;

let invalidIcResults = [];

let selectedOriginAddress = "";
let selectedDestinationAddress = "";
let selectedDestinationDisplayName = "";
let lastDestinationTypedValue = "";
let selectedOriginPlaceId = "";
let selectedDestinationPlaceId = "";
let selectedOriginLatLng = null;
let selectedDestinationLatLng = null;

let wakeLock = null;
let isWakeLockEnabled = false;

let isAutoUpdateEnabled = false;
let isAutoReSearchRunning = false;
let currentMultiIcMode = "entrance";
let lastMultiIcV2Results = [];
let lastExitIcV2Results = [];
let lastHighwayRoutePolylineAnalysis = null;
let lastHighwayRoutePolylineAnalysisKey = "";
let lastDestinationTestSummary =
    createEmptyDestinationTestSummary();

const V2_DIAGNOSTIC_DESTINATIONS = [
    "筑波山",
    "スパリゾートハワイアンズ",
    "マザー牧場"
];

const TEST_ORIGIN = "荒川区役所";

function buildRouteAnalysisKey(origin, destination) {
    return (
        String(origin || "").trim() +
        " -> " +
        String(destination || "").trim()
    );
}

function createEmptyDestinationTestSummary() {
    return {
        basic: null,
        route: null,
        entrance: null,
        exit: null
    };
}

function clearDestinationTestSummary(reason) {
    const hadSummary = Boolean(
        lastDestinationTestSummary.basic ||
        lastDestinationTestSummary.route ||
        lastDestinationTestSummary.entrance ||
        lastDestinationTestSummary.exit
    );

    lastDestinationTestSummary =
        createEmptyDestinationTestSummary();

    if (DEBUG_ROUTE_VERBOSE && hadSummary) {
        console.log(
            "[DESTINATION TEST SUMMARY CLEARED]",
            reason
        );
    }
}

function formatDestinationTestIcCandidates(candidates) {
    if (!Array.isArray(candidates)) {
        return [];
    }

    return candidates
        .map(candidate => {
            const exit = candidate?.exit || candidate;

            if (!exit) {
                return "";
            }

            const isShuto =
                candidate?.isShuto === true ||
                isShutoIcForRouteAnalysis(exit);

            return (
                exit.displayName +
                (isShuto ? " [首都高]" : "")
            );
        })
        .filter(Boolean);
}

function saveDestinationTestRouteSummary({
    origin,
    destination,
    analysis,
    comparisonCandidatePreview,
    entranceApiCandidateIcs,
    exitApiCandidateIcs,
    apiCandidateLimit,
    resetComparisonResults
}) {
    const routeAnalysisKey =
        buildRouteAnalysisKey(origin, destination);

    const canPreserveComparisonResults =
        !resetComparisonResults &&
        lastDestinationTestSummary.basic
            ?.routeAnalysisKey === routeAnalysisKey;

    const previousEntrance =
        canPreserveComparisonResults
            ? lastDestinationTestSummary.entrance
            : null;

    const previousExit =
        canPreserveComparisonResults
            ? lastDestinationTestSummary.exit
            : null;

    lastDestinationTestSummary = {
        basic: {
            origin,
            destination,
            currentMultiIcMode,
            isRealDriveTestMode,
            apiCandidateLimit,
            routeAnalysisKey,
            savedRouteAnalysisKey:
                lastHighwayRoutePolylineAnalysisKey,
            analysisKeyMatches:
                Boolean(analysis) &&
                lastHighwayRoutePolylineAnalysisKey ===
                    routeAnalysisKey
        },
        route: {
            roadSequence: [...(analysis.roadSequence || [])],
            roadDistances:
                (analysis.roadDistances || []).map(item => ({
                    road: item.road,
                    approximateDistanceKm:
                        item.approximateDistanceKm
                })),
            nexcoEntranceIc:
                analysis.nexcoEntranceIc?.displayName || "なし",
            nexcoExitIc:
                analysis.nexcoExitIc?.displayName || "なし",
            shutoEntranceIc:
                analysis.shutoEntranceIc?.displayName || "なし",
            shutoExitIc:
                analysis.shutoExitIc?.displayName || "なし",
            candidateAreas: [
                ...(comparisonCandidatePreview
                    ?.candidateAreas || [])
            ],
            entranceCandidateIcs:
                formatDestinationTestIcCandidates(
                    comparisonCandidatePreview
                        ?.entranceCandidateIcs || []
                ),
            entranceApiCandidateIcs:
                formatDestinationTestIcCandidates(
                    entranceApiCandidateIcs
                ),
            exitCandidateIcs:
                formatDestinationTestIcCandidates(
                    comparisonCandidatePreview
                        ?.exitCandidateIcs || []
                ),
            exitApiCandidateIcs:
                formatDestinationTestIcCandidates(
                    exitApiCandidateIcs
                )
        },
        entrance: previousEntrance,
        exit: previousExit
    };
}

function saveDestinationTestCandidateSelection(mode, selection) {
    if (!lastDestinationTestSummary.basic) {
        return;
    }

    Object.assign(
        lastDestinationTestSummary.basic,
        {
            currentMultiIcMode: mode,
            isRealDriveTestMode,
            apiCandidateLimit:
                selection.apiCandidateLimit,
            analysisKeyMatches:
                selection.analysisKeyMatches
        }
    );

    lastDestinationTestSummary[mode] = {
        status: "候補選定済み",
        candidateSelectionLogic:
            selection.candidateSelectionLogic,
        analysisKeyMatches:
            selection.analysisKeyMatches,
        apiCandidateLimit:
            selection.apiCandidateLimit,
        isRealDriveTestMode,
        candidateNames:
            selection.candidateNames || "なし",
        apiCallCount: selection.apiCallCount,
        fallbackReason:
            selection.fallbackReason || "なし",
        results: [],
        recommendedIc: "なし",
        eligibleCount: 0,
        weakCount: 0,
        weakCandidates: []
    };
}

function saveDestinationTestComparisonResults(mode, results) {
    if (!lastDestinationTestSummary.basic) {
        return;
    }

    const current =
        lastDestinationTestSummary[mode] || {};

    const bestResult =
        mode === "entrance"
            ? getBestEntranceIcV2(results)
            : getBestExitIcV2(results);

    const eligibleResults =
        results.filter(result =>
            result.recommendationEligibility === "eligible"
        );

    const weakResults =
        results.filter(result =>
            result.recommendationEligibility === "weak"
        );

    lastDestinationTestSummary[mode] = {
        ...current,
        status: "実行済み",
        candidateNames:
            current.candidateNames ||
            results
                .map(result => result.candidateIcName)
                .join(" → ") ||
            "なし",
        apiCallCount:
            current.apiCallCount ?? results.length,
        results: results.map(result => ({
            candidateIcName: result.candidateIcName,
            recommendationEligibility:
                result.recommendationEligibility,
            weakReason: result.weakReason || ""
        })),
        recommendedIc:
            bestResult?.candidateIcName || "なし",
        eligibleCount: eligibleResults.length,
        weakCount: weakResults.length,
        weakCandidates: weakResults.map(result => ({
            candidateIcName: result.candidateIcName,
            reason: result.weakReason || "理由不明"
        }))
    };
}

function logDestinationTestSummary() {
    const { basic, route, entrance, exit } =
        lastDestinationTestSummary;

    if (!basic || !route) {
        return;
    }

    const formatCandidateNames = candidates =>
        candidates?.length > 0
            ? candidates.join(" → ")
            : "なし";

    const formatWeakCandidates = comparison =>
        comparison?.weakCandidates?.length > 0
            ? comparison.weakCandidates
                .map(candidate =>
                    candidate.candidateIcName +
                    ": " +
                    candidate.reason
                )
                .join(" / ")
            : "なし";

    const roadDistanceText =
        route.roadDistances.length > 0
            ? route.roadDistances
                .map(item =>
                    item.road +
                    " 約" +
                    item.approximateDistanceKm +
                    "km"
                )
                .join(" / ")
            : "なし";

    const logComparison = (label, comparison) => {
        console.log(label + ":");

        if (!comparison || comparison.status !== "実行済み") {
            console.log("状態: 未実行");
            return;
        }

        console.log("状態: 実行済み");
        console.log(
            "候補選定ロジック:",
            comparison.candidateSelectionLogic || "不明"
        );
        console.log(
            "API実行候補:",
            comparison.candidateNames || "なし"
        );
        console.log(
            "API呼び出し予定件数:",
            comparison.apiCallCount
        );
        console.log(
            label === "入口比較"
                ? "おすすめ入口:"
                : "おすすめ出口:",
            comparison.recommendedIc
        );
        console.log(
            "eligible候補数:",
            comparison.eligibleCount
        );
        console.log(
            "weak候補数:",
            comparison.weakCount
        );
        console.log(
            "weak候補:",
            formatWeakCandidates(comparison)
        );
        console.log(
            "フォールバック理由:",
            comparison.fallbackReason || "なし"
        );
    };

    console.group("[DESTINATION TEST SUMMARY]");
    console.log("===== テスト結果コピー開始 =====");

    console.log("基本情報:");
    console.log("出発地:", basic.origin || "現在地");
    console.log("目的地:", basic.destination || "なし");
    console.log(
        "実車テストモード:",
        basic.isRealDriveTestMode ? "ON" : "OFF"
    );
    console.log("API候補上限:", basic.apiCandidateLimit);
    console.log("解析キー一致:", basic.analysisKeyMatches);

    console.log("通常検索:");
    console.log(
        "想定道路順:",
        route.roadSequence.join(" → ") || "なし"
    );
    console.log("道路別距離:", roadDistanceText);
    console.log("NEXCO入口:", route.nexcoEntranceIc);
    console.log("NEXCO出口:", route.nexcoExitIc);
    console.log("首都高入口:", route.shutoEntranceIc);
    console.log("首都高出口:", route.shutoExitIc);
    console.log(
        "候補エリア:",
        route.candidateAreas.join(" → ") || "なし"
    );
    console.log(
        "入口API候補プレビュー:",
        formatCandidateNames(route.entranceApiCandidateIcs)
    );
    console.log(
        "出口API候補プレビュー:",
        formatCandidateNames(route.exitApiCandidateIcs)
    );

    logComparison("入口比較", entrance);
    logComparison("出口比較", exit);

    console.log("判定メモ用:");
    console.log("結果: 未記入");
    console.log("違和感: 未記入");
    console.log("次回確認: 未記入");
    console.log("===== テスト結果コピー終了 =====");

    console.groupEnd();
}

function clearLastHighwayRoutePolylineAnalysis(reason) {
    clearDestinationTestSummary(reason);

    const hadAnalysis = Boolean(
        lastHighwayRoutePolylineAnalysis ||
        lastHighwayRoutePolylineAnalysisKey
    );

    lastHighwayRoutePolylineAnalysis = null;
    lastHighwayRoutePolylineAnalysisKey = "";

    updateSearchConditionPolylineAnalysis();

    if (!hadAnalysis) {
        return;
    }

    console.log(
        "[ROUTE POLYLINE ANALYSIS CLEARED]",
        reason
    );
}

const TEST_DESTINATIONS = [
    { area: "joban", name: "筑波山" },
    { area: "joban", name: "スパリゾートハワイアンズ" },
    { area: "chuo", name: "津久井湖" },
    { area: "chuo", name: "松本城" },
    { area: "kanetsu", name: "長瀞オートキャンプ場" },
    { area: "kanetsu", name: "吹割の滝" },
    { area: "tomei", name: "熱海城" },
    { area: "tomei", name: "タミヤサーキット" },
    { area: "keiyo", name: "東京ディズニーランド" },
    { area: "keiyo", name: "幕張メッセ" },
    { area: "tokan", name: "成田空港" },
    { area: "tokan", name: "香取神宮" },
    { area: "joshinetsu", name: "峠の釜めし本舗おぎのや資料館" },
    { area: "joshinetsu", name: "鬼押出し園" },
    { area: "joshinetsu", name: "軽井沢駅" },
    { area: "tateyama", name: "マザー牧場" },
    { area: "tateyama", name: "道の駅保田小学校" },
    { area: "tateyama", name: "鴨川シーワールド" },
    { area: "aqualine", name: "三井アウトレットパーク木更津" },
    { area: "aqualine", name: "木更津アウトレット" },
    { area: "aqualine", name: "養老渓谷" }
];




console.log("高速・下道コスパナビ起動");

window.addEventListener("load", () => {

    updateApiUsagePanel();

    loadGoogleMaps();

    getCurrentLocation(true);

    startGpsUpdate();

    document
        .getElementById("searchButton")
        .addEventListener("click", searchRoute);

    initializeAutoUpdateToggle();
    initializeRealDriveTestToggle();
    initializeWakeLockToggle();
    initializeMultiIcModeSwitch();

    document
        .getElementById("gpsSearchButton")
        .addEventListener(
            "click",
            () => {

                updateSearchMode("gpsSearchButton");

                resetMultiExitIcResult();

                searchFromCurrentLocation();
            }
        );


    const destinationInput =
        document.getElementById("destination");

    const clearDestinationButton =
        document.getElementById("clearDestination");

    const originInput =
        document.getElementById("origin");

    const clearOriginButton =
        document.getElementById("clearOrigin");

    destinationInput.addEventListener(
        "input",
        function () {

            clearLastHighwayRoutePolylineAnalysis(
                "目的地入力変更"
            );

            selectedDestinationAddress = "";
            selectedDestinationDisplayName = "";
            selectedDestinationPlaceId = "";
            selectedDestinationLatLng = null;
            lastDestinationTypedValue = this.value;

            clearDestinationButton.style.display =
                this.value.trim()
                    ? "block"
                    : "none";
        }
    );

    originInput.addEventListener(
        "input",
        function () {

            clearLastHighwayRoutePolylineAnalysis(
                "出発地入力変更"
            );

            selectedOriginAddress = "";
            selectedOriginPlaceId = "";
            selectedOriginLatLng = null;

            clearOriginButton.style.display =
                this.value.trim()
                    ? "block"
                    : "none";
        }
    );

    clearDestinationButton.addEventListener(
        "click",
        function () {

            clearLastHighwayRoutePolylineAnalysis(
                "目的地クリア"
            );

            destinationInput.value = "";
            selectedDestinationAddress = "";
            selectedDestinationDisplayName = "";
            lastDestinationTypedValue = "";
            selectedDestinationPlaceId = "";
            selectedDestinationLatLng = null;

            this.style.display = "none";

            resetAutoUpdateState();

            const autoCompareCheckbox =
                document.getElementById("autoCompareEnabled");

            if (autoCompareCheckbox) {
                autoCompareCheckbox.checked = false;
            }

            destinationInput.focus();
        }
    );

    clearOriginButton.addEventListener(
        "click",
        function () {

            clearLastHighwayRoutePolylineAnalysis(
                "出発地クリア"
            );

            originInput.value = "";
            selectedOriginAddress = "";
            selectedOriginPlaceId = "";
            selectedOriginLatLng = null;

            this.style.display = "none";

            resetAutoUpdateState();

            originInput.focus();

            updateAutoCompareToggleState();
        }
    );


    document
        .getElementById("autoExitIcCompareButton")
        .addEventListener(
            "click",
            () => searchAutoExitIcComparison(true)
        );

    document
        .getElementById("candidateIcTestButton")
        ?.addEventListener(
            "click",
            runCandidateIcTest
        );

    document
        .getElementById("v2TestSummaryButton")
        ?.addEventListener(
            "click",
            dumpV2TestSummary
        );

    document
        .getElementById("v2DiagnosticButton")
        ?.addEventListener(
            "click",
            runV2SimpleDiagnostic
        );


    document
        .getElementById("origin")
        .addEventListener(
            "input",
            updateAutoCompareToggleState
        );

    updateAutoCompareToggleState();


    document
        .getElementById(
            "nextUpdateInfo"
        ).textContent =
        getAutoUpdateCountdownText(
            getAutoUpdateDistanceThreshold(),
            getAutoUpdateTimeThreshold()
        );




    /*
    
            const findNearbyIcButton =
            document.getElementById("findNearbyIcButton");
    
        if (findNearbyIcButton) {
            findNearbyIcButton.addEventListener(
                "click",
                findNearbyInterchanges
            );
    
            console.log("周辺ICボタン登録OK");
        }
        else {
            console.warn("周辺ICボタンが見つかりません");
        }
    */

});

function loadGoogleMaps() {

    const script =
        document.createElement("script");

    script.src =
        "https://maps.googleapis.com/maps/api/js?key=" +
        CONFIG.GOOGLE_MAPS_API_KEY +
        "&libraries=places";

    script.async = true;
    script.defer = true;

    script.onload = () => {

        console.log(
            "Google Maps 読み込み完了"
        );

        initializeAutocomplete();
    };

    document.head.appendChild(script);
}


function initializeAutocomplete() {

    const originInput =
        document.getElementById("origin");

    const destinationInput =
        document.getElementById("destination");

    const originAutocomplete =
        new google.maps.places.Autocomplete(
            originInput,
            {
                componentRestrictions: { country: "jp" },
                fields: [
                    "formatted_address",
                    "name",
                    "place_id",
                    "geometry"
                ]
            }
        );

    const destinationAutocomplete =
        new google.maps.places.Autocomplete(
            destinationInput,
            {
                componentRestrictions: { country: "jp" },
                fields: [
                    "formatted_address",
                    "name",
                    "place_id",
                    "geometry"
                ]
            }
        );

    originAutocomplete.addListener("place_changed", () => {

        clearLastHighwayRoutePolylineAnalysis(
            "出発地Autocomplete選択"
        );

        const place =
            originAutocomplete.getPlace();

        selectedOriginAddress =
            place.formatted_address ||
            place.name ||
            originInput.value;

        selectedOriginPlaceId =
            place.place_id || "";

        selectedOriginLatLng =
            place.geometry && place.geometry.location
                ? {
                    lat: place.geometry.location.lat(),
                    lng: place.geometry.location.lng()
                }
                : null;

        console.log(
            "出発地Autocomplete選択",
            selectedOriginAddress,
            selectedOriginPlaceId,
            selectedOriginLatLng
        );

    });

    destinationAutocomplete.addListener("place_changed", () => {

        clearLastHighwayRoutePolylineAnalysis(
            "目的地Autocomplete選択"
        );

        const place =
            destinationAutocomplete.getPlace();

        selectedDestinationAddress =
            place.formatted_address ||
            place.name ||
            destinationInput.value;

        selectedDestinationDisplayName =
            normalizeDestinationDisplayName(
                place,
                lastDestinationTypedValue ||
                destinationInput.value
            );

        selectedDestinationPlaceId =
            place.place_id || "";

        selectedDestinationLatLng =
            place.geometry && place.geometry.location
                ? {
                    lat: place.geometry.location.lat(),
                    lng: place.geometry.location.lng()
                }
                : null;

        console.log(
            "目的地Autocomplete選択",
            selectedDestinationAddress,
            selectedDestinationDisplayName,
            selectedDestinationPlaceId,
            selectedDestinationLatLng
        );

    });

    console.log("Autocomplete 初期化完了");
}

async function searchRoute() {

    const originInputValue =
        document.getElementById("origin").value;

    const destinationInputValue =
        document.getElementById("destination").value;

    const origin =
        selectedOriginAddress ||
        originInputValue;

    const destination =
        selectedDestinationAddress ||
        destinationInputValue;

    document
        .getElementById("dashboardDestination")
        .textContent =
        getDestinationDisplayName(destination);

    if (!origin || !destination) {

        alert("出発地と目的地を入力してください");
        return;
    }

    updateSearchMode("searchButton");

    resetMultiExitIcResult();

    incrementRouteSearchUsage();


    console.log("検索開始");
    console.log("出発地:", origin);
    console.log("目的地:", destination);

    try {

        lastProbablyNoTollRoute = false;
        updateProbablyNoTollRouteNote(false);

        document.getElementById("highwayTime").textContent =
            "検索中...";

        document.getElementById("localTime").textContent =
            "検索中...";

        await getRoutes(
            origin,
            destination,
            false,
            selectedOriginPlaceId,
            selectedDestinationPlaceId,
            selectedOriginLatLng,
            selectedDestinationLatLng
        );

        document
            .getElementById("lastRouteSearchTime")
            .textContent =
            new Date().toLocaleTimeString("ja-JP");

        closeSearchPanel();

        scrollToDashboardCard();


    } catch (error) {

        console.error(error);

        alert(
            "ルート取得エラー\n\n" +
            error.message
        );
    }
}

function createRouteWaypoint(
    address,
    placeId = "",
    latLng = null
) {
    if (placeId) {
        return {
            placeId: placeId
        };
    }

    if (latLng) {
        return {
            location: {
                latLng: {
                    latitude: latLng.lat,
                    longitude: latLng.lng
                }
            }
        };
    }

    return {
        address: address
    };
}

async function getRoutes(
    origin,
    destination,
    suppressDashboardSummary = false,
    originPlaceId = "",
    destinationPlaceId = "",
    originLatLng = null,
    destinationLatLng = null
) {

    const [highwayRoute, localRoute] =
        await Promise.all([
            getHighwayRoute(
                origin,
                destination,
                originPlaceId,
                destinationPlaceId,
                originLatLng,
                destinationLatLng
            ),
            getLocalRoute(
                origin,
                destination,
                originPlaceId,
                destinationPlaceId,
                originLatLng,
                destinationLatLng
            )
        ]);

    await displayRouteComparison(
        highwayRoute,
        localRoute,
        suppressDashboardSummary,
        origin,
        destination,
        originLatLng,
        destinationLatLng
    );

    lastSearchLatitude =
        currentLatitude;

    lastSearchLongitude =
        currentLongitude;

    lastSearchLocationName =
        document
            .getElementById(
                "currentLocation"
            )
            .textContent;

    document
        .getElementById("lastSearchLocation")
        .textContent =
        lastSearchLocationName;

    lastSearchTime =
        Date.now();

    console.log(
        "検索地点保存"
    );
}

async function getHighwayRoute(
    origin,
    destination,
    originPlaceId = "",
    destinationPlaceId = "",
    originLatLng = null,
    destinationLatLng = null
) {

    const cacheRequest = createRoutesCacheRequest(
        "getHighwayRoute",
        createRoutesCacheEndpointKey(origin),
        createRoutesCacheEndpointKey(destination),
        {
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_AWARE",
            avoidTolls: false
        }
    );

    const cachedResponse = getCachedRoutesResponse(cacheRequest);

    if (cachedResponse !== undefined) {
        return cachedResponse;
    }

    incrementRouteRequestUsage("pro");

    const response = await fetch(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key":
                    CONFIG.GOOGLE_MAPS_API_KEY,

                // 【検証用・一時的】routes.legs.steps関連フィールドは、
                // 「有料区間」タグによる判定方式の実用性を確認するためだけに
                // 追加している。判定ロジックには未使用。有効と判断されなければ
                // 元に戻す。
                "X-Goog-FieldMask":
                    "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline," +
                    "routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters," +
                    "routes.legs.steps.startLocation,routes.legs.steps.endLocation"
            },

            body: JSON.stringify({

                origin: createRouteWaypoint(
                    origin,
                    originPlaceId,
                    originLatLng
                ),

                destination: createRouteWaypoint(
                    destination,
                    destinationPlaceId,
                    destinationLatLng
                ),

                travelMode: "DRIVE",

                routingPreference:
                    "TRAFFIC_AWARE"
            })
        }
    );

    const data =
        await response.json();

    if (DEBUG_ROUTE_VERBOSE) {
        console.log(
            "高速ルート詳細",
            JSON.stringify(data, null, 2)
        );
    }

    if (
        !data.routes ||
        data.routes.length === 0
    ) {
        console.error(
            "高速ルート取得失敗レスポンス",
            data
        );

        throw new Error(
            "高速ルートが見つかりません：" +
            origin +
            " → " +
            destination
        );
    }


    const route = data.routes[0];

    cacheRoutesResponse(cacheRequest, route);

    return route;
}

async function getHighwayRouteForTollEstimate(
    origin,
    destination
) {

    // ETC概算用。TRAFFIC_AWAREなしのためEssentials相当を想定。
    incrementRouteRequestUsage("ess");

    const response = await fetch(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key":
                    CONFIG.GOOGLE_MAPS_API_KEY,

                "X-Goog-FieldMask":
                    "routes.distanceMeters"
            },

            body: JSON.stringify({

                origin:
                    buildRoutesLocationForIcOrAddress(origin),

                destination:
                    buildRoutesLocationForIcOrAddress(destination),

                travelMode: "DRIVE",

                routeModifiers: {
                    avoidTolls: false
                }
            })
        }
    );

    const data =
        await response.json();

    if (
        !data.routes ||
        data.routes.length === 0
    ) {
        console.error(
            "ETC概算用ルート取得失敗レスポンス",
            data
        );

        throw new Error(
            "ETC概算用ルート取得に失敗しました: " +
            origin +
            " -> " +
            destination
        );
    }

    return data.routes[0];
}

async function getLocalRoute(
    origin,
    destination,
    originPlaceId = "",
    destinationPlaceId = "",
    originLatLng = null,
    destinationLatLng = null
) {

    const cacheRequest = createRoutesCacheRequest(
        "getLocalRoute",
        createRoutesCacheEndpointKey(origin),
        createRoutesCacheEndpointKey(destination),
        {
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_AWARE",
            avoidTolls: true
        }
    );

    const cachedResponse = getCachedRoutesResponse(cacheRequest);

    if (cachedResponse !== undefined) {
        return cachedResponse;
    }

    incrementRouteRequestUsage("pro");

    const response = await fetch(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",

                "X-Goog-Api-Key":
                    CONFIG.GOOGLE_MAPS_API_KEY,

                "X-Goog-FieldMask":
                    "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline"
            },

            body: JSON.stringify({

                origin: createRouteWaypoint(
                    origin,
                    originPlaceId,
                    originLatLng
                ),

                destination: createRouteWaypoint(
                    destination,
                    destinationPlaceId,
                    destinationLatLng
                ),

                travelMode: "DRIVE",

                routingPreference:
                    "TRAFFIC_AWARE",

                routeModifiers: {
                    avoidTolls: true
                }
            })
        }
    );

    const data =
        await response.json();

    if (
        !data.routes ||
        data.routes.length === 0
    ) {
        console.error(
            "下道ルート取得失敗レスポンス",
            data
        );

        throw new Error(
            "下道ルートが見つかりません：" +
            origin +
            " → " +
            destination
        );
    }

    const route = data.routes[0];

    cacheRoutesResponse(cacheRequest, route);

    return route;
}

async function displayRouteComparison(
    highway,
    local,
    suppressDashboardSummary = false,
    origin = "",
    destination = "",
    originLatLng = null,
    destinationLatLng = null
) {

    setDashboardNormalSearchMode(
        !suppressDashboardSummary
    );

    setDashboardInfoLabels(
        "効率率",
        "ETC概算"
    );
    setDashboardV2EntranceMode(false);
    setDashboardV2ExitMode(false);
    setDashboardRouteDimmed(false, false);

    const highwayMinutes =
        Math.round(
            parseInt(
                highway.duration.replace("s", "")
            ) / 60
        );

    const localMinutes =
        Math.round(
            parseInt(
                local.duration.replace("s", "")
            ) / 60
        );

    lastLocalRouteMinutes = localMinutes;

    const highwayKm =
        (
            highway.distanceMeters / 1000
        ).toFixed(1);

    const localKm =
        (
            local.distanceMeters / 1000
        ).toFixed(1);

    const isProbablyNoTollRoute =
        isProbablyNoTollRouteByMetrics(
            highwayMinutes,
            localMinutes,
            highwayKm,
            localKm
        );

    lastProbablyNoTollRoute = isProbablyNoTollRoute;

    updateProbablyNoTollRouteNote(
        isProbablyNoTollRoute
    );

    const resolvedIcArea =
        await resolveIcAreaForRoute(
            origin,
            destination,
            originLatLng,
            destinationLatLng
        );

    const polylineAnalysis =
        analyzeHighwayRoutePolyline(highway);

    lastHighwayRoutePolylineAnalysis =
        polylineAnalysis;

    // 高速利用ルート・有料回避ルートの実際の経路形状（Polyline）を直接
    // 比較し、ほぼ同一経路なら「有料道路を実質使っていない」とみなす。
    // 「参考：高速利用ルート」欄への表示にのみ使う（トップパネルの
    // isProbablyNoTollRoute／updateProbablyNoTollRouteNoteとは別系統）。
    lastProbablyNoTollRouteByPolylineComparison =
        isProbablyNoTollRouteByPolylineComparison(
            polylineAnalysis,
            local
        );

    lastHighwayRoutePolylineAnalysisKey =
        polylineAnalysis
            ? buildRouteAnalysisKey(origin, destination)
            : "";

    updateSearchConditionPolylineAnalysis(
        origin,
        destination
    );

    const tollEstimate =
        await estimateMainHighwayToll(
            highway,
            origin,
            destination,
            resolvedIcArea,
            polylineAnalysis
        );

    logMainHighwayTollCalculation(tollEstimate);

    logHighwayRoutePolylineAnalysis(
        highway,
        origin,
        destination,
        polylineAnalysis,
        tollEstimate,
        !suppressDashboardSummary
    );

    const estimatedToll =
        tollEstimate.amount;

    const highwayArrivalTime =
        formatArrivalTime(
            highwayMinutes
        );

    const localArrivalTime =
        formatArrivalTime(
            localMinutes
        );

    document
        .getElementById("highwayTime")
        .textContent =
        formatMinutes(
            highwayMinutes
        );

    document
        .getElementById("localTime")
        .textContent =
        formatMinutes(
            localMinutes
        );

    const highwayCard =
        document.querySelector(
            ".highway-card"
        );

    const localCard =
        document.querySelector(
            ".local-card"
        );

    highwayCard
        .querySelectorAll(".sub")[0]
        .textContent =
        "距離：" +
        highwayKm +
        " km";

    localCard
        .querySelectorAll(".sub")[0]
        .textContent =
        "距離：" +
        localKm +
        " km";

    const efficiencyRate =
        (
            localMinutes /
            highwayMinutes
        ).toFixed(2);

    let stars = "★☆☆☆☆";

    if (efficiencyRate >= 3.0) {
        stars = "★★★★★";
    }
    else if (efficiencyRate >= 2.5) {
        stars = "★★★★☆";
    }
    else if (efficiencyRate >= 2.0) {
        stars = "★★★☆☆";
    }
    else if (efficiencyRate >= 1.5) {
        stars = "★★☆☆☆";
    }

    document
        .getElementById("efficiencyRate")
        .textContent =
        efficiencyRate;

    document
        .getElementById("starRating")
        .textContent =
        stars;

    const savedMinutes =
        localMinutes - highwayMinutes;

    let costPerMinute = 0;

    if (savedMinutes > 0) {
        costPerMinute =
            Math.round(
                estimatedToll /
                savedMinutes
            );
    }

    let reasonText = "";

    if (savedMinutes > 0) {

        reasonText =
            "<div class='main-compare-label'>🚙 高速利用</div>" +
            "<div class='main-compare-value reason-green'>" +
            formatMinutes(savedMinutes) +
            "早い" +
            "</div>" +
            "<div class='main-compare-cost'>" +
            costPerMinute +
            "円/分" +
            "</div>";

    }
    else if (savedMinutes < 0) {

        reasonText =
            "<div class='main-compare-label'>🚗 有料回避</div>" +
            "<div class='main-compare-value reason-green'>" +
            formatMinutes(Math.abs(savedMinutes)) +
            "早い" +
            "</div>" +
            "<div class='main-compare-cost'>" +
            "高速利用より遅くなりません" +
            "</div>";

    }
    else {

        reasonText =
            "<div class='main-compare-label'>🚙🚗 ほぼ同等</div>" +
            "<div class='main-compare-value reason-neutral'>" +
            "同じくらい" +
            "</div>" +
            "<div class='main-compare-cost'>" +
            costPerMinute +
            "円/分" +
            "</div>";
    }

    highwayCard
        .querySelectorAll(".sub")[1]
        .textContent =
        "";

    document
        .getElementById("costPerMinute")
        .textContent =
        costPerMinute +
        " 円/分";

    let valueJudge = "";

    if (estimatedToll === 0) {
        valueJudge =
            savedMinutes >= 3
                ? "料金判断：無料で時間短縮"
                : "料金判断：料金差なし";
    }
    else if (costPerMinute <= 20) {
        valueJudge =
            "料金を払う価値：非常に高い";
    }
    else if (costPerMinute <= 40) {
        valueJudge =
            "料金を払う価値：高い";
    }
    else if (costPerMinute <= 60) {
        valueJudge =
            "料金を払う価値：普通";
    }
    else if (costPerMinute <= 100) {
        valueJudge =
            "料金を払う価値：やや低い";
    }
    else {
        valueJudge =
            "料金を払う価値：低い";
    }

    document
        .getElementById("valueJudge")
        .textContent =
        valueJudge;

    document
        .getElementById("dashboardHighway")
        .innerHTML =
        "<div class=\"arrival-label\">到着時刻</div>" +
        "<div class=\"arrival-time\">" +
        highwayArrivalTime +
        "</div>" +
        "<div class=\"main-route-time\">" +
        formatMinutesHtml(
            highwayMinutes
        ) +
        "</div>";

    document
        .getElementById("dashboardLocal")
        .innerHTML =
        "<div class=\"arrival-label\">到着時刻</div>" +
        "<div class=\"arrival-time\">" +
        localArrivalTime +
        "</div>" +
        "<div class=\"main-route-time\">" +
        formatMinutesHtml(
            localMinutes
        ) +
        "</div>";

    updateDashboardTimeColors(
        highwayMinutes,
        localMinutes
    );

    updateDashboardEfficiencyRate(
        highwayMinutes,
        localMinutes
    );

    if (!suppressDashboardSummary) {
        document
            .getElementById("dashboardCost")
            .innerHTML =
            createMainTollEstimateHtml(tollEstimate);

        document
            .getElementById("dashboardAssumedRouteValue")
            .innerHTML =
            buildTollUsageSummaryHtml(
                lastHighwayRoutePolylineAnalysis,
                lastProbablyNoTollRouteByPolylineComparison
            );
    }

    document
        .getElementById("dashboardHighwayDetail")
        .textContent =
        "距離：" +
        highwayKm +
        "km";

    document
        .getElementById("dashboardLocalDetail")
        .textContent =
        "距離：" +
        localKm +
        "km";

    if (!suppressDashboardSummary) {

        const dashboardValueJudge =
            document.getElementById(
                "dashboardValueJudge"
            );

        dashboardValueJudge.textContent =
            valueJudge;

        dashboardValueJudge.className = "";

        if (estimatedToll === 0) {
            dashboardValueJudge.classList.add(
                "value-super"
            );
        }
        else if (
            valueJudge ===
            "料金を払う価値：非常に高い"
        ) {
            dashboardValueJudge.classList.add(
                "value-super"
            );
        }
        else if (
            valueJudge ===
            "料金を払う価値：高い"
        ) {
            dashboardValueJudge.classList.add(
                "value-good"
            );
        }
        else if (
            valueJudge ===
            "料金を払う価値：普通"
        ) {
            dashboardValueJudge.classList.add(
                "value-normal"
            );
        }
        else if (
            valueJudge ===
            "料金を払う価値：やや低い"
        ) {
            dashboardValueJudge.classList.add(
                "value-expensive"
            );
        }
        else {
            dashboardValueJudge.classList.add(
                "value-high"
            );
        }

        document
            .getElementById("dashboardStars")
            .textContent =
            stars;

        let recommendation =
            "どちらでも可";

        if (efficiencyRate >= 2.5) {
            recommendation =
                "高速がお得";
        }
        else if (efficiencyRate < 1.5) {
            recommendation =
                "下道がお得";
        }

        const dashboardRecommendationElement =
            document.getElementById(
                "dashboardRecommendation"
            );

        if (
            lastRecommendationText &&
            lastRecommendationText !== recommendation
        ) {
            blinkElementById(
                "dashboardRecommendation",
                "recommendation-blink"
            );
        }

        dashboardRecommendationElement.textContent =
            recommendation;

        lastRecommendationText =
            recommendation;

        const dashboardCard =
            document.querySelector(
                ".dashboard-card"
            );

        dashboardCard.classList.remove(
            "recommend-highway",
            "recommend-neutral",
            "recommend-local"
        );

        if (
            recommendation ===
            "高速がお得"
        ) {
            dashboardCard.classList.add(
                "recommend-highway"
            );
        }
        else if (
            recommendation ===
            "下道がお得"
        ) {
            dashboardCard.classList.add(
                "recommend-local"
            );
        }
        else {
            dashboardCard.classList.add(
                "recommend-neutral"
            );
        }

        document
            .getElementById("dashboardReason")
            .innerHTML =
            reasonText;
    }
}


function updateIcAreaSelect(icArea) {

    const icAreaSelect =
        document.getElementById("icArea");

    if (!icAreaSelect || !icArea) {
        return;
    }

    // <select id="icArea">には"gaikan"等、HTML側に<option>が
    // 存在しない値のoptionがある。存在しない値を.valueに代入すると、
    // ブラウザの仕様でselectedIndexが-1になり.valueが空文字列に
    // リセットされてしまう（以降このselectを読むすべての処理に
    // 空文字列が伝播し、思わぬ場所でエラーの原因になる）。
    // 該当する<option>がある場合のみ書き換える。
    const hasMatchingOption =
        Array.from(icAreaSelect.options).some(option =>
            option.value === icArea
        );

    if (!hasMatchingOption) {
        return;
    }

    icAreaSelect.value = icArea;
}

function setResolvedIcArea(icArea) {

    if (!icArea) {
        return;
    }

    lastResolvedIcArea = icArea;
    updateIcAreaSelect(icArea);
}

async function resolveIcAreaForRoute(
    origin,
    destination,
    originLatLng = null,
    destinationLatLng = null
) {

    if (!destination) {
        return null;
    }

    const autoIcAreaEnabled =
        document.getElementById(
            "autoIcAreaEnabled"
        )?.checked;

    let icArea =
        document.getElementById("icArea")?.value;

    if (autoIcAreaEnabled) {

        let distanceOnlyIcAreaInfo = null;

        if (USE_DISTANCE_ONLY_IC_AREA) {

            const resolvedOriginLatLng =
                originLatLng ||
                await getAutoExitComparisonOriginLatLng(origin);

            const resolvedDestinationLatLng =
                destinationLatLng ||
                await getLatLngFromAddress(destination);

            if (
                resolvedOriginLatLng &&
                resolvedDestinationLatLng
            ) {
                distanceOnlyIcAreaInfo =
                    suggestIcAreaByDistanceOnlyForTest(
                        resolvedOriginLatLng,
                        resolvedDestinationLatLng
                    );
            }
        }

        if (
            distanceOnlyIcAreaInfo &&
            IC_MASTER[distanceOnlyIcAreaInfo.icArea]
        ) {
            icArea = distanceOnlyIcAreaInfo.icArea;
            lastIcAreaDecisionType = "distance-only";
        }
        else if (ENABLE_KEYWORD_AREA_HINT) {

            const suggestedIcArea =
                await suggestIcArea(
                    origin,
                    destination
                );

            if (suggestedIcArea) {
                icArea = suggestedIcArea;
            }
        }
    }

    if (
        icArea &&
        IC_MASTER[icArea]
    ) {
        setResolvedIcArea(icArea);
        return icArea;
    }

    return null;
}


async function estimateMainHighwayToll(
    highwayRoute,
    origin,
    destination,
    preferredIcArea = null,
    polylineAnalysis = null
) {

    // 「有料区間」タグベース（tollSections/tollEntryCount）を優先する。
    // polylineAnalysisに既に計算済みの結果があれば再利用し（analysis
    // Highway RoutePolyline側で一度算出済みのため、二重計算を避ける）、
    // 無ければhighwayRouteから直接算出する。
    // highwayRouteに実際にlegs.stepsが含まれている場合のみ有効
    // （getHighwayRoute/getHighwayRouteFromGpsは取得済み。
    // getHighwayRouteForMultiExitComparison等、steps未取得の呼び出し
    // 元から渡された場合はhasStepsData:falseとなり、以下に残っている
    // 既存の座標ベース方式にフォールバックする）。
    const tollTagResult =
        polylineAnalysis?.hasTollSectionStepsData !== undefined
            ? {
                hasStepsData:
                    polylineAnalysis.hasTollSectionStepsData,
                tollSections:
                    polylineAnalysis.tollSections || [],
                tollEntryCount:
                    polylineAnalysis.tollEntryCount || 0
            }
            : detectTollSectionsFromSteps(highwayRoute);

    if (tollTagResult.hasStepsData) {
        return estimateMainHighwayTollFromTollSections(
            tollTagResult
        );
    }

    const fallbackKm =
        highwayRoute.distanceMeters / 1000;

    const fallbackAmount =
        Math.round(
            fallbackKm * 24
        );

    const shutoTollEstimate =
        (
            polylineAnalysis?.shutoEntryCount ??
            (polylineAnalysis?.shutoEntranceIc ? 1 : 0)
        ) * SHUTO_TOLL_ESTIMATE_YEN;

    let legacyStartIc = null;
    let legacyEndIc = null;

    const createFallbackResult = fallbackReason => ({
        amount: fallbackAmount + shutoTollEstimate,
        highwayToll: fallbackAmount,
        shutoToll: shutoTollEstimate,
        label: "料金計算：ルート総距離ベース",
        usedPolylineAnalysis: false,
        usedNexcoPolylineIc: false,
        startIc: null,
        endIc: null,
        polylineStartIc:
            polylineAnalysis?.entranceIc || null,
        polylineEndIc:
            polylineAnalysis?.exitIc || null,
        nexcoStartIc:
            polylineAnalysis?.nexcoEntranceIc || null,
        nexcoEndIc:
            polylineAnalysis?.nexcoExitIc || null,
        legacyStartIc,
        legacyEndIc,
        fallbackReason
    });

    try {

        if (!destination) {
            return createFallbackResult("目的地未指定");
        }

        const autoIcAreaEnabled =
            document.getElementById(
                "autoIcAreaEnabled"
            )?.checked;

        const selectedIcArea =
            document.getElementById("icArea")?.value;

        let icArea =
            autoIcAreaEnabled
                ? preferredIcArea || lastResolvedIcArea
                : selectedIcArea;

        if (
            autoIcAreaEnabled &&
            !icArea
        ) {

            const suggestedIcArea =
                await suggestIcArea(
                    origin,
                    destination
                );

            if (suggestedIcArea) {
                icArea = suggestedIcArea;
            }
        }

        if (
            icArea &&
            IC_MASTER[icArea]
        ) {
            setResolvedIcArea(icArea);

            if (origin) {
                legacyStartIc =
                    await findNearestIcInfoByAddress(
                        origin,
                        icArea
                    );
            }
            else if (
                currentLatitude !== null &&
                currentLongitude !== null
            ) {
                legacyStartIc =
                    await findNearestIcInfoByPoint(
                        icArea,
                        currentLatitude,
                        currentLongitude
                    );
            }

            legacyEndIc =
                await findNearestIcInfoByAddress(
                    destination,
                    icArea
                );
        }

        const polylineStartIc =
            polylineAnalysis?.entranceIc;

        const polylineEndIc =
            polylineAnalysis?.exitIc;

        const nexcoStartIc =
            polylineAnalysis?.nexcoEntranceIc;

        const nexcoEndIc =
            polylineAnalysis?.nexcoExitIc;

        const canUseNexcoPolylineIcs =
            Boolean(
                nexcoStartIc?.googleName &&
                nexcoEndIc?.googleName
            );

        const canUseDefaultPolylineIcs =
            Boolean(
                polylineStartIc?.googleName &&
                polylineEndIc?.googleName
            );

        const canUsePolylineAnalysis =
            canUseNexcoPolylineIcs ||
            canUseDefaultPolylineIcs;

        // 首都高経由ルートは、ルート途中のNEXCO入口（nexcoEntranceIc）ではなく
        // 実際の走行開始地点（首都高含む）を基準ICにする。
        const shouldPreferDefaultPolylineIcs =
            Boolean(polylineAnalysis?.shutoEntranceIc);

        // entranceIcはshutoExitSwitch補正により、首都高を抜けた直後の
        // NEXCO入口（例：篠崎IC）に上書きされることがあるため、
        // 首都高経由時は実際の首都高入口（例：堤通）が入るshutoEntranceIcを優先する。
        const shutoStartIc =
            polylineAnalysis?.shutoEntranceIc;

        const canUseShutoStartIc =
            Boolean(shutoStartIc?.googleName);

        const startIc =
            shouldPreferDefaultPolylineIcs &&
                canUseShutoStartIc
                ? shutoStartIc
                : shouldPreferDefaultPolylineIcs &&
                    canUseDefaultPolylineIcs
                    ? polylineStartIc
                    : canUseNexcoPolylineIcs
                        ? nexcoStartIc
                        : canUseDefaultPolylineIcs
                            ? polylineStartIc
                            : legacyStartIc;

        const endIc =
            shouldPreferDefaultPolylineIcs &&
                canUseDefaultPolylineIcs
                ? polylineEndIc
                : canUseNexcoPolylineIcs
                    ? nexcoEndIc
                    : canUseDefaultPolylineIcs
                        ? polylineEndIc
                        : legacyEndIc;

        if (
            !startIc ||
            !endIc ||
            !startIc.googleName ||
            !endIc.googleName
        ) {
            let fallbackReason = "IC未取得";

            if (
                !icArea ||
                !IC_MASTER[icArea]
            ) {
                fallbackReason = "IC_MASTER未一致";
            }
            else if (!polylineAnalysis) {
                fallbackReason =
                    "Polyline解析失敗 / IC未取得";
            }

            return createFallbackResult(fallbackReason);
        }

        if (
            startIc.googleName &&
            endIc.googleName
        ) {
            lastTollStartIcName =
                startIc.displayName;
            lastTollStartIc =
                startIc;

            lastTollStartIcGoogleName =
                startIc.googleName;

            lastTollStartIcOrder =
                startIc.order ?? null;

            lastTollEndIcName =
                endIc.displayName;
            lastTollEndIc =
                endIc;

            lastTollEndIcGoogleName =
                endIc.googleName;

            lastTollEndIcOrder =
                endIc.order ?? null;
        }

        const shutoToll = shutoTollEstimate;

        if (
            startIc.googleName === endIc.googleName
        ) {
            return {
                amount: shutoToll,
                highwayToll: 0,
                shutoToll,
                label:
                    "料金計算：" +
                    formatTollRouteLabel(
                        startIc,
                        endIc
                    ),
                legacyStartIc,
                legacyEndIc,
                usedPolylineAnalysis:
                    canUsePolylineAnalysis,
                usedNexcoPolylineIc:
                    canUseNexcoPolylineIcs,
                polylineStartIc,
                polylineEndIc,
                nexcoStartIc,
                nexcoEndIc,
                startIc,
                endIc,
                fallbackReason: null
            };
        }

        const amount =
            await estimateComparisonCandidateToll({
                startIc,
                endIc,
                startGoogleName: startIc.googleName,
                endGoogleName: endIc.googleName,
                fallbackDistanceMeters:
                    highwayRoute.distanceMeters,
                polylineAnalysis
            });

        const baseToll =
            Math.max(
                0,
                amount - shutoToll
            );

        return {
            amount,
            highwayToll: baseToll,
            shutoToll,
            label:
                "料金計算：" +
                formatTollRouteLabel(
                    startIc,
                    endIc
                ),
            legacyStartIc,
            legacyEndIc,
            usedPolylineAnalysis:
                canUsePolylineAnalysis,
            usedNexcoPolylineIc:
                canUseNexcoPolylineIcs,
            polylineStartIc,
            polylineEndIc,
            nexcoStartIc,
            nexcoEndIc,
            startIc,
            endIc,
            fallbackReason: null
        };

    } catch (error) {

        console.warn(
            "IC間料金計算に失敗。従来計算に戻します。",
            error
        );

        return createFallbackResult("料金計算失敗");
    }
}

function logMainHighwayTollCalculation(tollEstimate) {

    const usedTollSections =
        tollEstimate?.usedTollSections === true;

    const usedNexcoPolylineIc =
        tollEstimate?.usedNexcoPolylineIc === true;

    const usedPolylineAnalysis =
        tollEstimate?.usedPolylineAnalysis === true;

    const usedIcCalculation =
        Boolean(
            tollEstimate?.startIc &&
            tollEstimate?.endIc
        );

    // usedTollSections（TOLL TAG方式、有料区間タグベース）を、既存の
    // 座標ベース方式の判定より優先して表示する。
    const calculationLogic =
        usedTollSections
            ? "TOLL TAGタグ"
            : usedNexcoPolylineIc
                ? "Polyline解析NEXCO IC"
                : usedPolylineAnalysis
                    ? "Polyline解析IC"
                    : usedIcCalculation
                        ? "旧ロジックIC"
                        : "距離ベース";

    console.group("[ETC概算 料金計算]");
    console.log("料金計算ロジック：", calculationLogic);

    console.log(
        "合計：約" +
        Number(tollEstimate?.amount || 0).toLocaleString() +
        "円" +
        "（首都高：約" +
        Number(tollEstimate?.shutoToll || 0).toLocaleString() +
        "円 / 他道路：約" +
        Number(tollEstimate?.highwayToll || 0).toLocaleString() +
        "円）"
    );

    console.log(
        "首都高利用回数（shutoEntryCount）：",
        tollEstimate?.shutoEntryCount ?? "不明"
    );

    if (usedIcCalculation) {
        console.log(
            "入口IC：",
            tollEstimate.startIc.displayName
        );
        console.log(
            "出口IC：",
            tollEstimate.endIc.displayName
        );
    }
    else {
        console.log(
            "理由：",
            tollEstimate?.fallbackReason ||
                tollEstimate?.label ||
                "不明"
        );
    }

    console.groupEnd();
}







async function getCurrentLocation(
    updateAddress = true
) {

    if (!navigator.geolocation) {

        console.log(
            "GPS未対応"
        );

        return;
    }

    navigator.geolocation.getCurrentPosition(

        async (position) => {

            const lat =
                position.coords.latitude;

            const lng =
                position.coords.longitude;

            currentLatitude = lat;
            currentLongitude = lng;

            lastGpsReceivedTime = Date.now();
            updateGpsStatus();

            checkAutoReSearch();

            console.log(
                currentLatitude,
                currentLongitude
            );

            if (updateAddress) {

                const locationName =
                    await reverseGeocode(
                        lat,
                        lng
                    );

                setCurrentLocationText(
                    shortenLocationName(locationName)
                );
            }

            const now =
                new Date();

            document
                .getElementById(
                    "gpsTime"
                )
                .textContent =
                now.toLocaleTimeString(
                    "ja-JP"
                );

        },

        (error) => {

            console.error(error);

            setCurrentLocationText("取得失敗");

        }

    );
}

async function reverseGeocode(
    lat,
    lng
) {
    return new Promise((resolve) => {

        const geocoder =
            new google.maps.Geocoder();

        geocoder.geocode(
            {
                location: {
                    lat: lat,
                    lng: lng
                }
            },
            (results, status) => {

                console.log(
                    "Geocoder結果",
                    status,
                    results
                );

                if (
                    status === "OK" &&
                    results &&
                    results.length > 0
                ) {
                    resolve(
                        results[0].formatted_address
                    );
                    return;
                }

                resolve("位置不明");
            }
        );
    });
}


function startGpsUpdate() {

    // GPSだけ更新（30秒ごと）
    setInterval(() => {

        console.log(
            "GPS自動更新"
        );

        getCurrentLocation(false);

        updateGpsStatus();

    }, 30000);


    // 住所更新（3分ごと）
    setInterval(() => {

        console.log(
            "住所更新"
        );

        if (!isAutoUpdateEnabled) {
            renderAutoUpdateStatus();
            return;
        }

        getCurrentLocation(true);

    }, 180000);


    setInterval(() => {

        updateGpsStatus();

        if (!isAutoUpdateEnabled) {
            renderAutoUpdateStatus();
            return;
        }

        if (
            currentLatitude !== null &&
            currentLongitude !== null
        ) {
            checkAutoReSearch();
        }

    }, 5000);

}


async function searchFromCurrentLocation(
    shouldClosePanel = true,
    suppressDashboardSummary = false
) {

    if (
        currentLatitude === null ||
        currentLongitude === null
    ) {

        alert(
            "現在地取得待ちです"
        );

        return;
    }


    const destination =
        selectedDestinationAddress ||
        document
            .getElementById(
                "destination"
            )
            .value;

    document
        .getElementById("dashboardDestination")
        .textContent =
        getDestinationDisplayName(destination);

    if (!destination) {

        alert(
            "目的地を入力してください"
        );

        return;
    }

    const autoCompareCheckbox =
        document.getElementById("autoCompareEnabled");

    if (autoCompareCheckbox && shouldClosePanel) {
        autoCompareCheckbox.checked = false;
    }

    incrementRouteSearchUsage();


    try {

        lastProbablyNoTollRoute = false;
        updateProbablyNoTollRouteNote(false);

        document
            .getElementById(
                "highwayTime"
            )
            .textContent =
            "検索中...";

        document
            .getElementById(
                "localTime"
            )
            .textContent =
            "検索中...";

        const [highwayRoute, localRoute] =
            await Promise.all([

                getHighwayRouteFromGps(
                    destination,
                    selectedDestinationPlaceId,
                    selectedDestinationLatLng
                ),

                getLocalRouteFromGps(
                    destination,
                    selectedDestinationPlaceId,
                    selectedDestinationLatLng
                )

            ]);

        await displayRouteComparison(
            highwayRoute,
            localRoute,
            suppressDashboardSummary,
            "",
            destination,
            {
                lat: currentLatitude,
                lng: currentLongitude
            },
            selectedDestinationLatLng
        );

        lastSearchLatitude =
            currentLatitude;

        lastSearchLongitude =
            currentLongitude;

        lastSearchTime =
            Date.now();

        lastSearchLocationName =
            document
                .getElementById("currentLocation")
                .textContent;

        document
            .getElementById("lastSearchLocation")
            .textContent =
            lastSearchLocationName;


        console.log(
            "GPS検索地点保存"
        );

        document
            .getElementById("autoSearchTime")
            .textContent =
            new Date().toLocaleTimeString("ja-JP");

        document
            .getElementById("lastRouteSearchTime")
            .textContent =
            new Date().toLocaleTimeString("ja-JP");

        if (shouldClosePanel) {
            closeSearchPanel();
        }

        if (shouldClosePanel) {
            scrollToDashboardCard();
        }


    } catch (error) {

        lastAutoReSearchFailureTime =
            Date.now();

        console.error(error);

        setDataUpdateStatus(
            "更新失敗",
            "data-update-error"
        );



    }

}

async function getHighwayRouteFromGps(
    destination,
    destinationPlaceId = "",
    destinationLatLng = null
) {

    const cacheRequest = createRoutesCacheRequest(
        "getHighwayRouteFromGps",
        createRoutesCacheEndpointKey(null, true),
        createRoutesCacheEndpointKey(destination),
        {
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_AWARE",
            avoidTolls: false
        }
    );

    const cachedResponse = getCachedRoutesResponse(cacheRequest);

    if (cachedResponse !== undefined) {
        return cachedResponse;
    }

    incrementRouteRequestUsage("pro");

    const response =
        await fetch(
            "https://routes.googleapis.com/directions/v2:computeRoutes",
            {
                method: "POST",

                headers: {

                    "Content-Type":
                        "application/json",

                    "X-Goog-Api-Key":
                        CONFIG.GOOGLE_MAPS_API_KEY,

                    // 【検証用・一時的】routes.legs.steps関連フィールドは、
                    // 「有料区間」タグによる判定方式をGPS自動更新時にも
                    // 検証するためだけに追加している。判定ロジックには
                    // 未使用。有効と判断されなければ元に戻す。
                    "X-Goog-FieldMask":
                        "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline," +
                        "routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters," +
                        "routes.legs.steps.startLocation,routes.legs.steps.endLocation"

                },

                body: JSON.stringify({

                    origin: {
                        location: {
                            latLng: {
                                latitude:
                                    currentLatitude,
                                longitude:
                                    currentLongitude
                            }
                        }
                    },

                    destination: createRouteWaypoint(
                        destination,
                        destinationPlaceId,
                        destinationLatLng
                    ),

                    travelMode:
                        "DRIVE",

                    routingPreference:
                        "TRAFFIC_AWARE"

                })

            }
        );

    const data =
        await response.json();

    if (DEBUG_ROUTE_VERBOSE) {
        console.log(
            "GPS高速ルート",
            JSON.stringify(data, null, 2)
        );
    }

    if (
        !data.routes ||
        data.routes.length === 0
    ) {
        throw new Error(
            "高速ルートが見つかりません：" +
            destination
        );
    }

    const route = data.routes[0];

    cacheRoutesResponse(cacheRequest, route);

    return route;
}

async function getLocalRouteFromGps(
    destination,
    destinationPlaceId = "",
    destinationLatLng = null
) {

    const cacheRequest = createRoutesCacheRequest(
        "getLocalRouteFromGps",
        createRoutesCacheEndpointKey(null, true),
        createRoutesCacheEndpointKey(destination),
        {
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_AWARE",
            avoidTolls: true
        }
    );

    const cachedResponse = getCachedRoutesResponse(cacheRequest);

    if (cachedResponse !== undefined) {
        return cachedResponse;
    }

    incrementRouteRequestUsage("pro");

    const response =
        await fetch(
            "https://routes.googleapis.com/directions/v2:computeRoutes",
            {
                method: "POST",

                headers: {

                    "Content-Type":
                        "application/json",

                    "X-Goog-Api-Key":
                        CONFIG.GOOGLE_MAPS_API_KEY,

                    "X-Goog-FieldMask":
                        "routes.duration,routes.distanceMeters"

                },

                body: JSON.stringify({

                    origin: {
                        location: {
                            latLng: {
                                latitude:
                                    currentLatitude,
                                longitude:
                                    currentLongitude
                            }
                        }
                    },

                    destination: createRouteWaypoint(
                        destination,
                        destinationPlaceId,
                        destinationLatLng
                    ),

                    travelMode:
                        "DRIVE",

                    routingPreference:
                        "TRAFFIC_AWARE",

                    routeModifiers: {
                        avoidTolls: true
                    }

                })

            }
        );

    const data =
        await response.json();

    if (DEBUG_ROUTE_VERBOSE) {
        console.log(
            "GPS下道ルート",
            JSON.stringify(data, null, 2)
        );
    }

    if (
        !data.routes ||
        data.routes.length === 0
    ) {
        throw new Error(
            "GPS下道ルートが見つかりません：" +
            destination
        );
    }

    const route = data.routes[0];

    cacheRoutesResponse(cacheRequest, route);

    return route;

}

function calculateDistance(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const R = 6371000;

    const dLat =
        (lat2 - lat1)
        * Math.PI / 180;

    const dLon =
        (lon2 - lon1)
        * Math.PI / 180;

    const a =

        Math.sin(dLat / 2)
        * Math.sin(dLat / 2)

        +

        Math.cos(lat1 * Math.PI / 180)

        *

        Math.cos(lat2 * Math.PI / 180)

        *

        Math.sin(dLon / 2)

        *

        Math.sin(dLon / 2);

    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return R * c;
}

function decodeRoutesEncodedPolyline(encodedPolyline) {

    if (!encodedPolyline) {
        return [];
    }

    const points = [];
    let index = 0;
    let latitude = 0;
    let longitude = 0;

    const decodeValue = () => {
        let result = 0;
        let shift = 0;
        let byte = 0;

        do {
            if (index >= encodedPolyline.length) {
                throw new Error("encodedPolylineの末尾が不正です");
            }

            byte =
                encodedPolyline.charCodeAt(index++) - 63;

            result |=
                (byte & 0x1f) << shift;

            shift += 5;
        }
        while (byte >= 0x20);

        return (result & 1)
            ? ~(result >> 1)
            : result >> 1;
    };

    while (index < encodedPolyline.length) {
        latitude += decodeValue();
        longitude += decodeValue();

        points.push({
            lat: latitude / 1e5,
            lng: longitude / 1e5
        });
    }

    return points;
}

function sampleRoutePointsByDistance(
    routePoints,
    intervalMeters = 2000
) {

    if (!routePoints.length) {
        return [];
    }

    const sampledPoints = [{
        ...routePoints[0],
        routeDistanceMeters: 0
    }];

    let totalDistanceMeters = 0;
    let nextSampleDistanceMeters = intervalMeters;

    for (let index = 1; index < routePoints.length; index++) {
        const previousPoint = routePoints[index - 1];
        const currentPoint = routePoints[index];

        const segmentDistanceMeters =
            calculateDistance(
                previousPoint.lat,
                previousPoint.lng,
                currentPoint.lat,
                currentPoint.lng
            );

        const segmentStartDistanceMeters =
            totalDistanceMeters;

        totalDistanceMeters += segmentDistanceMeters;

        while (
            segmentDistanceMeters > 0 &&
            nextSampleDistanceMeters <= totalDistanceMeters
        ) {
            const ratio =
                (
                    nextSampleDistanceMeters -
                    segmentStartDistanceMeters
                ) /
                segmentDistanceMeters;

            sampledPoints.push({
                lat:
                    previousPoint.lat +
                    (currentPoint.lat - previousPoint.lat) * ratio,
                lng:
                    previousPoint.lng +
                    (currentPoint.lng - previousPoint.lng) * ratio,
                routeDistanceMeters: nextSampleDistanceMeters
            });

            nextSampleDistanceMeters += intervalMeters;
        }
    }

    const lastPoint = routePoints[routePoints.length - 1];
    const lastSample = sampledPoints[sampledPoints.length - 1];

    const distanceToLastPointMeters =
        calculateDistance(
            lastSample.lat,
            lastSample.lng,
            lastPoint.lat,
            lastPoint.lng
        );

    if (distanceToLastPointMeters > 1) {
        sampledPoints.push({
            ...lastPoint,
            routeDistanceMeters: totalDistanceMeters
        });
    }

    return sampledPoints;
}

function sampleRoutePointsByDistanceRange(
    routePoints,
    startDistanceMeters,
    endDistanceMeters,
    intervalMeters = 500
) {

    if (
        routePoints.length < 2 ||
        endDistanceMeters <= startDistanceMeters
    ) {
        return [];
    }

    const sampledPoints = [];
    let totalDistanceMeters = 0;
    let nextSampleDistanceMeters =
        startDistanceMeters + intervalMeters;

    for (let index = 1; index < routePoints.length; index++) {
        const previousPoint = routePoints[index - 1];
        const currentPoint = routePoints[index];

        const segmentDistanceMeters =
            calculateDistance(
                previousPoint.lat,
                previousPoint.lng,
                currentPoint.lat,
                currentPoint.lng
            );

        const segmentStartDistanceMeters =
            totalDistanceMeters;

        totalDistanceMeters += segmentDistanceMeters;

        while (
            segmentDistanceMeters > 0 &&
            nextSampleDistanceMeters <= totalDistanceMeters &&
            nextSampleDistanceMeters <= endDistanceMeters
        ) {
            const ratio =
                (
                    nextSampleDistanceMeters -
                    segmentStartDistanceMeters
                ) /
                segmentDistanceMeters;

            sampledPoints.push({
                lat:
                    previousPoint.lat +
                    (currentPoint.lat - previousPoint.lat) * ratio,
                lng:
                    previousPoint.lng +
                    (currentPoint.lng - previousPoint.lng) * ratio,
                routeDistanceMeters:
                    nextSampleDistanceMeters
            });

            nextSampleDistanceMeters += intervalMeters;
        }

        if (
            totalDistanceMeters >= endDistanceMeters ||
            nextSampleDistanceMeters > endDistanceMeters
        ) {
            break;
        }
    }

    return sampledPoints;
}

function getRouteAnalysisIcAreaKey(exit) {

    if (exit?.source === "SHUTO_IC_MASTER") {
        return "shuto";
    }

    return (
        exit?.sourceAreaKey ||
        exit?.sourceAreaKeys?.[0] ||
        ""
    );
}

// 診断用しきい値（段階1）。実際にどれだけの点がこの距離を超えて
// 「最も近いだけの遠いIC」を拾っているかを可視化するためのもので、
// 現時点ではこの値を使ったフィルタ・除外は一切行っていない
// （isWithinThresholdフラグを付与し、ログ表示にのみ使う）。
// 初期値であり、実データでの調整が前提。
const IC_MASTER_NEAREST_THRESHOLD_METERS = 2000;

function findNearestIcMasterEntryForRoutePoint(
    routePoint,
    icDefinitions,
    role
) {

    let nearest = null;
    let nearestDistanceMeters = Infinity;

    for (const exit of icDefinitions) {

        const roleLat =
            role === "entrance"
                ? exit.entranceLat ?? exit.lat
                : role === "exit"
                    ? exit.exitLat ?? exit.lat
                    : exit.lat;

        const roleLng =
            role === "entrance"
                ? exit.entranceLng ?? exit.lng
                : role === "exit"
                    ? exit.exitLng ?? exit.lng
                    : exit.lng;

        if (
            roleLat === undefined ||
            roleLng === undefined
        ) {
            continue;
        }

        if (
            role === "entrance" &&
            (
                typeof exit.entranceSelectable === "boolean"
                    ? !exit.entranceSelectable
                    : exit.isSelectable === false
            )
        ) {
            continue;
        }

        if (
            role === "exit" &&
            (
                typeof exit.exitSelectable === "boolean"
                    ? !exit.exitSelectable
                    : exit.isSelectable === false
            )
        ) {
            continue;
        }

        const distanceMeters =
            calculateDistance(
                routePoint.lat,
                routePoint.lng,
                roleLat,
                roleLng
            );

        if (distanceMeters < nearestDistanceMeters) {
            nearest = {
                icArea: getRouteAnalysisIcAreaKey(exit),
                exit
            };
            nearestDistanceMeters = distanceMeters;
        }
    }

    if (!nearest) {
        return null;
    }

    return {
        ...nearest,
        distanceMeters: nearestDistanceMeters,
        isWithinThreshold:
            nearestDistanceMeters <=
            IC_MASTER_NEAREST_THRESHOLD_METERS
    };
}

function isShutoIcForRouteAnalysis(exit) {

    return (
        exit.roadType === "首都高" ||
        String(exit.displayName || "")
            .includes("（首都高）")
    );
}

function isShutoIcSelectableForRole(exit, role) {

    if (!isShutoIcForRouteAnalysis(exit)) {
        return exit.isSelectable !== false;
    }

    if (role === "entrance") {
        return typeof exit.entranceSelectable === "boolean"
            ? exit.entranceSelectable
            : exit.isSelectable !== false;
    }

    if (role === "exit") {
        return typeof exit.exitSelectable === "boolean"
            ? exit.exitSelectable
            : exit.isSelectable !== false;
    }

    return exit.isSelectable !== false;
}

function findNearestShutoIcForRoutePoint(
    routePoint,
    icDefinitions,
    selectableRole = null
) {

    let nearest = null;
    let nearestDistanceMeters = Infinity;

    for (const exit of icDefinitions) {
        if (
            !isShutoIcForRouteAnalysis(exit) ||
            !isShutoIcSelectableForRole(
                exit,
                selectableRole
            )
        ) {
            continue;
        }

        const roleLat =
            selectableRole === "entrance"
                ? exit.entranceLat ?? exit.lat
                : selectableRole === "exit"
                    ? exit.exitLat ?? exit.lat
                    : exit.lat;

        const roleLng =
            selectableRole === "entrance"
                ? exit.entranceLng ?? exit.lng
                : selectableRole === "exit"
                    ? exit.exitLng ?? exit.lng
                    : exit.lng;

        if (
            roleLat === undefined ||
            roleLng === undefined
        ) {
            continue;
        }

        const distanceMeters =
            calculateDistance(
                routePoint.lat,
                routePoint.lng,
                roleLat,
                roleLng
            );

        if (distanceMeters < nearestDistanceMeters) {
            nearest = exit;
            nearestDistanceMeters = distanceMeters;
        }
    }

    if (!nearest) {
        return null;
    }

    return {
        exit: nearest,
        distanceMeters: nearestDistanceMeters
    };
}

function analyzeShutoIcCandidates(
    sampledPoints,
    preferLaterOccurrence = false,
    maxDistanceMeters = 5000,
    icDefinitions,
    selectableRole = null
) {

    const candidatesByIdentity = new Map();

    const sampleStartDistanceMeters =
        sampledPoints[0]?.routeDistanceMeters || 0;

    const sampleEndDistanceMeters =
        sampledPoints[sampledPoints.length - 1]
            ?.routeDistanceMeters ||
        sampleStartDistanceMeters;

    const sampleDistanceSpanMeters =
        Math.max(
            1,
            sampleEndDistanceMeters -
            sampleStartDistanceMeters
        );

    sampledPoints.forEach(routePoint => {
        const nearest =
            findNearestShutoIcForRoutePoint(
                routePoint,
                icDefinitions,
                selectableRole
            );

        if (
            !nearest ||
            nearest.distanceMeters > maxDistanceMeters
        ) {
            return;
        }

        const identity =
            nearest.exit.googleName ||
            nearest.exit.displayName;

        let candidate =
            candidatesByIdentity.get(identity);

        if (!candidate) {
            candidate = {
                exit: nearest.exit,
                count: 0,
                minDistanceMeters: Infinity,
                totalDistanceMeters: 0,
                proximityScore: 0,
                lastRouteDistanceMeters: 0
            };
            candidatesByIdentity.set(identity, candidate);
        }

        candidate.count++;
        candidate.minDistanceMeters =
            Math.min(
                candidate.minDistanceMeters,
                nearest.distanceMeters
            );
        candidate.totalDistanceMeters +=
            nearest.distanceMeters;
        candidate.proximityScore +=
            Math.max(
                0,
                5 - nearest.distanceMeters / 1000
            );
        candidate.lastRouteDistanceMeters =
            routePoint.routeDistanceMeters;
    });

    const candidates =
        [...candidatesByIdentity.values()]
            .map(candidate => ({
                ...candidate,
                averageDistanceMeters:
                    candidate.totalDistanceMeters /
                    candidate.count,
                score:
                    candidate.count * 10 +
                    candidate.proximityScore +
                    (
                        preferLaterOccurrence
                            ? (
                                candidate.lastRouteDistanceMeters -
                                sampleStartDistanceMeters
                            ) /
                                sampleDistanceSpanMeters * 5
                            : 0
                    )
            }))
            .sort((a, b) => {
                if (b.score !== a.score) {
                    return b.score - a.score;
                }

                if (
                    preferLaterOccurrence &&
                    b.lastRouteDistanceMeters !==
                        a.lastRouteDistanceMeters
                ) {
                    return (
                        b.lastRouteDistanceMeters -
                        a.lastRouteDistanceMeters
                    );
                }

                return (
                    a.minDistanceMeters -
                    b.minDistanceMeters
                );
            });

    return {
        candidates,
        selectedIc: candidates[0]?.exit || null
    };
}

function selectShutoIcCandidateWindow(
    sampledPoints,
    fromEnd = false,
    maxDistanceMeters = 3000,
    windowDistanceMeters = 5000,
    icDefinitions,
    selectableRole = null
) {

    const orderedSamples = fromEnd
        ? sampledPoints.slice().reverse()
        : sampledPoints;

    const anchorSample =
        orderedSamples.find(routePoint => {
            const nearest =
                findNearestShutoIcForRoutePoint(
                    routePoint,
                    icDefinitions,
                    selectableRole
                );

            return (
                nearest &&
                nearest.distanceMeters <= maxDistanceMeters
            );
        });

    if (!anchorSample) {
        return {
            samples: [],
            startDistanceMeters: null,
            endDistanceMeters: null
        };
    }

    const anchorDistanceMeters =
        anchorSample.routeDistanceMeters;

    const startDistanceMeters = fromEnd
        ? Math.max(
            sampledPoints[0]?.routeDistanceMeters || 0,
            anchorDistanceMeters - windowDistanceMeters
        )
        : anchorDistanceMeters;

    const endDistanceMeters = fromEnd
        ? anchorDistanceMeters
        : Math.min(
            sampledPoints[sampledPoints.length - 1]
                ?.routeDistanceMeters ||
                anchorDistanceMeters,
            anchorDistanceMeters + windowDistanceMeters
        );

    return {
        samples:
            sampledPoints.filter(routePoint =>
                routePoint.routeDistanceMeters >=
                    startDistanceMeters &&
                routePoint.routeDistanceMeters <=
                    endDistanceMeters
            ),
        startDistanceMeters,
        endDistanceMeters
    };
}

function findNearbyIcMasterEntriesForRoutePoint(
    routePoint,
    maxDistanceMeters = 5000,
    limit = 5,
    icDefinitions
) {

    const nearbyByIdentity = new Map();

    for (const exit of icDefinitions) {
        if (
            exit.lat === undefined ||
            exit.lng === undefined
        ) {
            continue;
        }

        const distanceMeters =
            calculateDistance(
                routePoint.lat,
                routePoint.lng,
                exit.lat,
                exit.lng
            );

        if (distanceMeters > maxDistanceMeters) {
            continue;
        }

        const identity =
            exit.googleName ||
            exit.displayName + "|" + exit.lat + "|" + exit.lng;

        const registered =
            nearbyByIdentity.get(identity);

        if (
            !registered ||
            distanceMeters < registered.distanceMeters
        ) {
            nearbyByIdentity.set(identity, {
                icArea: getRouteAnalysisIcAreaKey(exit),
                exit,
                distanceMeters
            });
        }
    }

    return [...nearbyByIdentity.values()]
        .sort((a, b) =>
            a.distanceMeters - b.distanceMeters
        )
        .slice(0, limit);
}

function correctShortRoadSegments(
    roadSegments,
    thresholdMeters = 5000
) {

    const protectedRoadLabels = new Set(
        [
            "アクアライン方面",
            IC_MASTER.aqualine?.label
        ].filter(Boolean)
    );

    const correctedSegments =
        roadSegments.map(segment => ({ ...segment }));

    let corrected = true;

    while (corrected) {
        corrected = false;

        for (
            let index = 1;
            index < correctedSegments.length - 1;
            index++
        ) {
            const previous = correctedSegments[index - 1];
            const current = correctedSegments[index];
            const next = correctedSegments[index + 1];

            if (
                current.distanceMeters >= thresholdMeters ||
                previous.roadLabel !== next.roadLabel ||
                protectedRoadLabels.has(current.roadLabel)
            ) {
                continue;
            }

            correctedSegments.splice(
                index - 1,
                3,
                {
                    roadLabel: previous.roadLabel,
                    distanceMeters:
                        previous.distanceMeters +
                        current.distanceMeters +
                        next.distanceMeters,
                    sampleCount:
                        (previous.sampleCount || 0) +
                        (current.sampleCount || 0) +
                        (next.sampleCount || 0),
                    startTraceIndex:
                        previous.startTraceIndex,
                    endTraceIndex:
                        next.endTraceIndex
                }
            );

            corrected = true;
            break;
        }
    }

    return correctedSegments;
}

// correctShortRoadSegments（roadSegments単位のノイズ補正）と同じ
// しきい値・サンドイッチ判定を、routeTrace（サンプル点単位）に直接適用し、
// 孤立した別路線ICの混入（例：外環走行中の首都高「新井宿」）を検出する。
// 現時点では検出のみで、routeTrace自体の書き換えや候補選定への接続は行わない。
// correctShortRoadSegmentsと異なり反復マージは行わない単純パス版のため、
// 連続する複数の孤立区間までは検出できない場合がある。
function detectIsolatedRoadTraceNoise(
    routeTrace,
    thresholdMeters = 5000
) {

    const protectedRoadLabels = new Set(
        [
            "アクアライン方面",
            IC_MASTER.aqualine?.label
        ].filter(Boolean)
    );

    const segments = [];

    routeTrace.forEach((item, index) => {

        const previousDistanceMeters =
            index > 0
                ? item.routeDistanceMeters -
                    routeTrace[index - 1].routeDistanceMeters
                : 0;

        const nextDistanceMeters =
            index < routeTrace.length - 1
                ? routeTrace[index + 1].routeDistanceMeters -
                    item.routeDistanceMeters
                : 0;

        const estimatedDistanceMeters =
            (
                previousDistanceMeters +
                nextDistanceMeters
            ) / 2;

        const currentSegment =
            segments[segments.length - 1];

        if (currentSegment?.roadLabel === item.roadLabel) {
            currentSegment.distanceMeters +=
                estimatedDistanceMeters;
            currentSegment.endTraceIndex = index;
        }
        else {
            segments.push({
                roadLabel: item.roadLabel,
                distanceMeters: estimatedDistanceMeters,
                startTraceIndex: index,
                endTraceIndex: index
            });
        }
    });

    const isolatedSegments = [];

    for (
        let index = 1;
        index < segments.length - 1;
        index++
    ) {
        const previous = segments[index - 1];
        const current = segments[index];
        const next = segments[index + 1];

        if (
            current.distanceMeters >= thresholdMeters ||
            previous.roadLabel !== next.roadLabel ||
            protectedRoadLabels.has(current.roadLabel)
        ) {
            continue;
        }

        const icNames = [
            ...new Set(
                routeTrace
                    .slice(
                        current.startTraceIndex,
                        current.endTraceIndex + 1
                    )
                    .map(item => item.exit?.displayName)
                    .filter(Boolean)
            )
        ];

        isolatedSegments.push({
            roadLabel: current.roadLabel,
            surroundingRoadLabel: previous.roadLabel,
            startTraceIndex: current.startTraceIndex,
            endTraceIndex: current.endTraceIndex,
            distanceMeters: current.distanceMeters,
            icNames
        });
    }

    return isolatedSegments;
}

function summarizeRoadSegments(roadSegments) {

    const roadSequence =
        roadSegments.map(segment => segment.roadLabel);

    const roadDistanceMeters = {};

    roadSegments.forEach(segment => {
        roadDistanceMeters[segment.roadLabel] =
            (roadDistanceMeters[segment.roadLabel] || 0) +
            segment.distanceMeters;
    });

    const roadDistances =
        [...new Set(roadSequence)].map(roadLabel => ({
            road: roadLabel,
            approximateDistanceKm:
                Math.round(
                    (roadDistanceMeters[roadLabel] || 0) /
                    1000
                )
        }));

    return {
        roadSequence,
        roadDistances
    };
}

function buildDisplayRoadSequenceFromSegments(roadSegments) {

    const minimumStableDistanceMeters = 5000;
    const maximumShortSegmentSampleCount = 2;
    const maximumSandwichedSegmentDistanceMeters = 8000;

    const segments = (roadSegments || [])
        .filter(segment => segment?.roadLabel);

    if (segments.length === 0) {
        return [];
    }

    const isShortMixedSegment = segment =>
        segment.roadLabel !== "首都高" &&
        Number.isFinite(segment.distanceMeters) &&
        segment.distanceMeters < minimumStableDistanceMeters &&
        Number.isFinite(segment.sampleCount) &&
        segment.sampleCount <= maximumShortSegmentSampleCount;

    const hasStableNonShutoSegment =
        segments.some(segment =>
            segment.roadLabel !== "首都高" &&
            !isShortMixedSegment(segment)
        );

    const removalReasons = new Map();

    segments.forEach((segment, index) => {
        const previous = segments[index - 1];
        const next = segments[index + 1];

        const isSandwichedRoadSegment =
            previous &&
            next &&
            previous.roadLabel === next.roadLabel &&
            segment.roadLabel !== previous.roadLabel &&
            segment.roadLabel !== "首都高" &&
            Number.isFinite(segment.distanceMeters) &&
            segment.distanceMeters <=
                maximumSandwichedSegmentDistanceMeters &&
            Number.isFinite(previous.distanceMeters) &&
            Number.isFinite(next.distanceMeters) &&
            previous.distanceMeters + next.distanceMeters >=
                segment.distanceMeters * 3;

        if (isSandwichedRoadSegment) {
            removalReasons.set(
                segment,
                "sandwiched-road-segment"
            );
            return;
        }

        if (
            hasStableNonShutoSegment &&
            isShortMixedSegment(segment)
        ) {
            removalReasons.set(
                segment,
                "short-mixed-segment"
            );
        }
    });

    const displaySegments = segments
        .filter(segment => !removalReasons.has(segment));

    const displayRoadSequence = displaySegments
        .map(segment => segment.roadLabel)
        .filter((roadLabel, index, roadLabels) =>
            roadLabel !== roadLabels[index - 1]
        );

    if (DEBUG_DISPLAY_ROAD_SEQUENCE) {
        const formatSegment = segment => ({
            roadLabel: segment.roadLabel,
            distanceKm:
                Math.round(
                    (segment.distanceMeters || 0) / 100
                ) / 10,
            sampleCount: segment.sampleCount || 0,
            startTraceIndex: segment.startTraceIndex,
            endTraceIndex: segment.endTraceIndex
        });

        const removedSegments = segments
            .filter(segment =>
                !displaySegments.includes(segment)
            )
            .map(segment => ({
                ...formatSegment(segment),
                reason: removalReasons.get(segment)
            }));

        console.log(
            "[DISPLAY ROAD SEQUENCE FILTER]",
            {
                segments: segments.map(formatSegment),
                displayRoadSequence,
                removedSegments
            }
        );
    }

    return displayRoadSequence;
}

function createRoadSwitchesFromSegments(
    roadSegments,
    routeTrace,
    icDefinitions
) {

    const roadSwitches = [];

    for (let index = 1; index < roadSegments.length; index++) {
        const previousSegment = roadSegments[index - 1];
        const currentSegment = roadSegments[index];
        const previous =
            routeTrace[previousSegment.endTraceIndex];
        const current =
            routeTrace[currentSegment.startTraceIndex];

        if (!previous || !current) {
            continue;
        }

        const switchPoint = {
            lat: (previous.lat + current.lat) / 2,
            lng: (previous.lng + current.lng) / 2
        };

        const routeDistanceMeters =
            (
                previous.routeDistanceMeters +
                current.routeDistanceMeters
            ) / 2;

        roadSwitches.push({
            fromRoad: previousSegment.roadLabel,
            toRoad: currentSegment.roadLabel,
            traceIndex: currentSegment.startTraceIndex,
            routeDistanceMeters,
            beforeExit: previous.exit,
            afterExit: current.exit,
            nearbyIcs:
                findNearbyIcMasterEntriesForRoutePoint(
                    switchPoint,
                    5000,
                    5,
                    icDefinitions
                )
        });
    }

    return roadSwitches;
}

function analyzeHighwayRoutePolyline(highwayRoute) {

    const encodedPolyline =
        highwayRoute?.polyline?.encodedPolyline;

    if (!encodedPolyline) {
        console.warn(
            "[ROUTE POLYLINE調査] encodedPolylineなし"
        );
        return null;
    }

    try {
        const routePoints =
            decodeRoutesEncodedPolyline(encodedPolyline);

        const sampledPoints =
            sampleRoutePointsByDistance(routePoints, 500);

        const icDefinitions =
            getAllRouteAnalysisIcDefinitions();

        const areaCounts =
            Object.fromEntries(
                [...Object.keys(IC_MASTER), "shuto"].map(icArea =>
                    [icArea, 0]
                )
            );

        const routePointLogs = [];
        const rawRouteTrace = [];

        sampledPoints.forEach((routePoint, index) => {
            const nearest =
                findNearestIcMasterEntryForRoutePoint(
                    routePoint,
                    icDefinitions
                );

            if (!nearest) {
                return;
            }

            areaCounts[nearest.icArea] =
                (areaCounts[nearest.icArea] || 0) + 1;

            const displayName =
                nearest.exit.displayName;

            const roadLabel =
                isShutoIcForRouteAnalysis(nearest.exit)
                    ? "首都高"
                    : IC_MASTER[nearest.icArea]?.label ||
                        nearest.icArea;

            const distanceKm =
                Math.round(nearest.distanceMeters / 100) / 10;

            const routeDistanceKm =
                Math.round(routePoint.routeDistanceMeters / 100) / 10;

            routePointLogs.push({
                routePoint: index + 1,
                routeDistanceKm,
                lat: routePoint.lat,
                lng: routePoint.lng,
                icArea: nearest.icArea,
                roadLabel,
                nearestIc: displayName,
                distanceKm,
                isWithinThreshold: nearest.isWithinThreshold
            });

            rawRouteTrace.push({
                routeDistanceMeters:
                    routePoint.routeDistanceMeters,
                lat: routePoint.lat,
                lng: routePoint.lng,
                roadLabel,
                icArea: nearest.icArea,
                exit: nearest.exit,
                // 診断用（段階1）。フィルタ・除外には未使用。
                distanceMeters: nearest.distanceMeters,
                isWithinThreshold: nearest.isWithinThreshold
            });
        });

        // 座標最近傍探索のみでは、地理的に近いだけの別路線ICが
        // 孤立点として紛れ込むことがあるため（例：外環走行中の首都高
        // 「新井宿」）、correctShortRoadSegmentsと同じ考え方で
        // routeTrace自体から孤立ノイズを除外してから、以降の
        // usesShuto判定・NEXCO入口出口・出口比較候補等に使う。
        const isolatedRoadTraceNoise =
            detectIsolatedRoadTraceNoise(rawRouteTrace);

        const isolatedRoadTraceIndexSet = new Set();

        isolatedRoadTraceNoise.forEach(segment => {
            for (
                let index = segment.startTraceIndex;
                index <= segment.endTraceIndex;
                index++
            ) {
                isolatedRoadTraceIndexSet.add(index);
            }
        });

        const routeTrace =
            rawRouteTrace.filter((item, index) =>
                !isolatedRoadTraceIndexSet.has(index)
            );

        // passedIcEntries（重複除去した通過IC列）は、routeTrace補正後の
        // 並びから作り直す。補正前のrouteTraceループ内で作っていたものを
        // ここに移動しただけで、重複除去のロジック自体は変えていない。
        const passedIcEntries = [];

        routeTrace.forEach(item => {
            const icIdentity =
                item.exit.googleName ||
                item.icArea + "|" + item.exit.displayName;

            if (
                passedIcEntries[passedIcEntries.length - 1]
                    ?.identity !== icIdentity
            ) {
                passedIcEntries.push({
                    identity: icIdentity,
                    icArea: item.icArea,
                    exit: item.exit,
                    distanceMeters: item.distanceMeters,
                    isWithinThreshold: item.isWithinThreshold
                });
            }
        });

        const roadSwitches = [];

        for (let index = 1; index < routeTrace.length; index++) {
            const previous = routeTrace[index - 1];
            const current = routeTrace[index];

            if (previous.roadLabel === current.roadLabel) {
                continue;
            }

            const switchPoint = {
                lat: (previous.lat + current.lat) / 2,
                lng: (previous.lng + current.lng) / 2
            };

            const routeDistanceMeters =
                (
                    previous.routeDistanceMeters +
                    current.routeDistanceMeters
                ) / 2;

            const nearbyIcs =
                findNearbyIcMasterEntriesForRoutePoint(
                    switchPoint,
                    5000,
                    5,
                    icDefinitions
                );

            roadSwitches.push({
                fromRoad: previous.roadLabel,
                toRoad: current.roadLabel,
                traceIndex: index,
                routeDistanceMeters,
                beforeExit: previous.exit,
                afterExit: current.exit,
                nearbyIcs
            });
        }

        const roadSequence = [];
        const roadDistanceMeters = {};
        const roadSegments = [];

        routeTrace.forEach((item, index) => {
            if (
                roadSequence[roadSequence.length - 1] !==
                item.roadLabel
            ) {
                roadSequence.push(item.roadLabel);
            }

            const previousDistanceMeters =
                index > 0
                    ? item.routeDistanceMeters -
                        routeTrace[index - 1].routeDistanceMeters
                    : 0;

            const nextDistanceMeters =
                index < routeTrace.length - 1
                    ? routeTrace[index + 1].routeDistanceMeters -
                        item.routeDistanceMeters
                    : 0;

            const estimatedDistanceMeters =
                (
                    previousDistanceMeters +
                    nextDistanceMeters
                ) / 2;

            roadDistanceMeters[item.roadLabel] =
                (roadDistanceMeters[item.roadLabel] || 0) +
                estimatedDistanceMeters;

            const currentRoadSegment =
                roadSegments[roadSegments.length - 1];

            if (
                currentRoadSegment?.roadLabel ===
                item.roadLabel
            ) {
                currentRoadSegment.distanceMeters +=
                    estimatedDistanceMeters;
                currentRoadSegment.sampleCount++;
                currentRoadSegment.endTraceIndex = index;
            }
            else {
                roadSegments.push({
                    roadLabel: item.roadLabel,
                    distanceMeters: estimatedDistanceMeters,
                    sampleCount: 1,
                    startTraceIndex: index,
                    endTraceIndex: index
                });
            }
        });

        const uniqueRoadLabels =
            [...new Set(roadSequence)];

        const roadDistanceLogs =
            uniqueRoadLabels.map(roadLabel => ({
                road: roadLabel,
                approximateDistanceKm:
                    Math.round(
                        (roadDistanceMeters[roadLabel] || 0) /
                        1000
                    )
            }));

        const correctedRoadSegments =
            correctShortRoadSegments(roadSegments, 5000);

        const correctedRoadSummary =
            summarizeRoadSegments(correctedRoadSegments);

        const displayRoadSequence =
            buildDisplayRoadSequenceFromSegments(
                correctedRoadSegments
            );

        const correctedRoadSwitches =
            createRoadSwitchesFromSegments(
                correctedRoadSegments,
                routeTrace,
                icDefinitions
            );

        const selectablePassedIcs =
            passedIcEntries.filter(item =>
                item.exit.isSelectable !== false
            );

        const selectablePassedNexcoIcs =
            selectablePassedIcs.filter(item =>
                !isShutoIcForRouteAnalysis(item.exit)
            );

        const isEntranceRoleSelectable = exit =>
            typeof exit.entranceSelectable === "boolean"
                ? exit.entranceSelectable
                : exit.isSelectable !== false;

        const isExitRoleSelectable = exit =>
            typeof exit.exitSelectable === "boolean"
                ? exit.exitSelectable
                : exit.isSelectable !== false;

        const nexcoEntranceCandidate =
            selectablePassedNexcoIcs.find(item =>
                isEntranceRoleSelectable(item.exit)
            )?.exit || null;

        let nexcoExitCandidate = null;

        for (
            let index = selectablePassedNexcoIcs.length - 1;
            index >= 0;
            index--
        ) {
            if (
                isExitRoleSelectable(
                    selectablePassedNexcoIcs[index].exit
                )
            ) {
                nexcoExitCandidate =
                    selectablePassedNexcoIcs[index].exit;
                break;
            }
        }

        const shutoExitSwitch =
            roadSwitches.find(roadSwitch =>
                roadSwitch.fromRoad === "首都高" &&
                roadSwitch.toRoad !== "首都高"
            );

        let entranceCandidate =
            selectablePassedIcs[0]?.exit || null;

        if (shutoExitSwitch) {
            entranceCandidate =
                routeTrace
                    .slice(shutoExitSwitch.traceIndex)
                    .find(item =>
                        item.roadLabel !== "首都高" &&
                        item.exit.isSelectable !== false
                    )
                    ?.exit ||
                entranceCandidate;
        }

        const exitCandidate =
            selectablePassedIcs[
                selectablePassedIcs.length - 1
            ]?.exit || null;

        const totalRouteDistanceMeters =
            sampledPoints[sampledPoints.length - 1]
                ?.routeDistanceMeters || 0;

        const shutoDetailStartSamples =
            sampleRoutePointsByDistanceRange(
                routePoints,
                0,
                Math.min(20000, totalRouteDistanceMeters),
                500
            );

        const shutoDetailEndSamples =
            sampleRoutePointsByDistanceRange(
                routePoints,
                Math.max(
                    0,
                    totalRouteDistanceMeters - 20000
                ),
                totalRouteDistanceMeters,
                500
            );

        const usesShuto =
            routeTrace.some(item =>
                isShutoIcForRouteAnalysis(item.exit)
            );

        const emptyShutoWindow = {
            samples: [],
            startDistanceMeters: null,
            endDistanceMeters: null
        };

        const shutoEntranceWindow =
            usesShuto
                ? selectShutoIcCandidateWindow(
                    shutoDetailStartSamples,
                    false,
                    3000,
                    5000,
                    icDefinitions,
                    "entrance"
                )
                : emptyShutoWindow;

        const shutoExitWindow =
            usesShuto
                ? selectShutoIcCandidateWindow(
                    shutoDetailEndSamples,
                    true,
                    3000,
                    5000,
                    icDefinitions,
                    "exit"
                )
                : emptyShutoWindow;

        const shutoEntranceAnalysis =
            usesShuto
                ? analyzeShutoIcCandidates(
                    shutoEntranceWindow.samples,
                    false,
                    3000,
                    icDefinitions,
                    "entrance"
                )
                : { candidates: [], selectedIc: null };

        const shutoExitAnalysis =
            usesShuto
                ? analyzeShutoIcCandidates(
                    shutoExitWindow.samples,
                    true,
                    3000,
                    icDefinitions,
                    "exit"
                )
                : { candidates: [], selectedIc: null };

        // shutoSegments：ルート中の首都高連続区間（correctedRoadSegments上で
        // roadLabel==="首都高"の各区間）を、区間ごとの入口/出口IC付きで抽出する。
        // shutoEntranceIc/shutoExitIc（ウィンドウ+スコアリング方式の単一値、
        // 既存の意味のまま）とは別に、複数回の首都高利用を表現するための
        // 追加フィールド。既存フィールドの計算・意味は変更していない。
        //
        // roadLabel自体はfindNearestIcMasterEntryForRoutePoint（距離上限なし）
        // による判定のため、実際には一般道しか通っていない区間でも、近くに
        // 首都高ICがあるだけで「首都高」と誤判定されることがある
        // （例：荒川区役所〜足立区役所間の「小菅」「四つ木」誤検出）。
        // 以前はアンカー1点判定（3000m以内に1点でもあればOK）で対応していたが、
        // 「一瞬近くをかすめただけ」と「実際に区間を通して走行した」を
        // 区別できないという限界があったため、以下の判定方式に全面置き換えた。
        // フォールバックは持たない。
        //
        // 判定方式（設計セッションで合意した内容。閾値は初期値であり、
        // 実データでの調整が前提）：
        // 1. routeTrace（既存、総当たり再計算なし）を最近傍IC identityで
        //    連続run化し、run中心を「極小値候補点」とする
        // 2. 中心の前後2点・計5点（端では3〜4点）のウィンドウを切り出し、
        //    ウィンドウ内で1位になったIC全てを候補化する
        // 3. 候補ごとにウィンドウ5点への距離を計算し直し、山型
        //    （前半広義単調減少・後半広義単調増加、許容誤差50m）になって
        //    いるかを確認する。ウィンドウが片側しか確保できない場合は
        //    確保できた側だけで単調な傾向を確認し、confidenceLevel:"edge"
        //    として候補を採用する（判定不能による無条件棄却はしない）。
        //    ウィンドウ内に複数IDが混在する場合はconfidenceLevel:"partial"
        //    に格下げする
        // 4. 山型が確認できた最初/最後の候補点の間で、order（路線内の並び順）
        //    が単調に並んでいるかを確認する。routeCodeが変わる地点
        //    （首都高の路線間乗り継ぎ、例：C2⇔K1）は区間全体が
        //    roadLabel==="首都高"である限り無条件に許容する。roadLabel自体が
        //    変わる地点（首都高⇔NEXCO間、今回のshutoSegments抽出範囲では
        //    実際には発生しないが、将来の再利用に備えて用意）は、その地点の
        //    ICがconnection===trueかつconnectedRoadsに前後両エリアを含む
        //    場合のみ乗り継ぎとして許容する
        // 5. 4を満たした区間のみ、正式なshutoSegmentsエントリとして確定する
        const SHUTO_SEGMENT_WINDOW_RADIUS = 2;
        const SHUTO_SEGMENT_DISTANCE_TOLERANCE_METERS = 50;
        const SHUTO_SEGMENT_ORDER_TOLERANCE_VIOLATIONS = 1;

        const CONFIDENCE_RANK = { full: 2, edge: 1, partial: 0 };

        const getExitIdentity = exit =>
            exit
                ? (exit.googleName || exit.displayName || null)
                : null;

        const groupTraceItemsIntoRuns = items => {
            const runs = [];

            items.forEach((item, index) => {
                const identity = getExitIdentity(item.exit);
                const currentRun = runs[runs.length - 1];

                if (
                    currentRun &&
                    currentRun.identity === identity
                ) {
                    currentRun.endIndex = index;
                }
                else {
                    runs.push({
                        identity,
                        startIndex: index,
                        endIndex: index
                    });
                }
            });

            return runs;
        };

        const extractWindowIndices = (
            length,
            centerIndex,
            radius
        ) => {
            const startIndex = Math.max(0, centerIndex - radius);
            const endIndex =
                Math.min(length - 1, centerIndex + radius);

            const indices = [];

            for (
                let index = startIndex;
                index <= endIndex;
                index++
            ) {
                indices.push(index);
            }

            return indices;
        };

        const evaluateMountainShape = distances => {
            if (distances.length < 2) {
                return { hasPeak: false };
            }

            const minValue = Math.min(...distances);
            const minIndex = distances.indexOf(minValue);

            const isNonIncreasing = arr =>
                arr.every((value, index) =>
                    index === 0 ||
                    value <=
                        arr[index - 1] +
                        SHUTO_SEGMENT_DISTANCE_TOLERANCE_METERS
                );

            const isNonDecreasing = arr =>
                arr.every((value, index) =>
                    index === 0 ||
                    value >=
                        arr[index - 1] -
                        SHUTO_SEGMENT_DISTANCE_TOLERANCE_METERS
                );

            const leftPart = distances.slice(0, minIndex + 1);
            const rightPart = distances.slice(minIndex);

            const leftOk =
                leftPart.length < 2 || isNonIncreasing(leftPart);

            const rightOk =
                rightPart.length < 2 || isNonDecreasing(rightPart);

            if (!leftOk || !rightOk) {
                return { hasPeak: false };
            }

            const hasLeftContext = minIndex > 0;
            const hasRightContext =
                minIndex < distances.length - 1;

            if (hasLeftContext && hasRightContext) {
                return { hasPeak: true, confidenceLevel: "full" };
            }

            if (hasLeftContext || hasRightContext) {
                return { hasPeak: true, confidenceLevel: "edge" };
            }

            return { hasPeak: false };
        };

        const evaluateCandidateWindow = (windowItems, candidateExit) => {
            const distances =
                windowItems.map(item =>
                    calculateDistance(
                        item.lat,
                        item.lng,
                        candidateExit.lat,
                        candidateExit.lng
                    )
                );

            const mountainResult = evaluateMountainShape(distances);

            if (!mountainResult.hasPeak) {
                return null;
            }

            const distinctIdentitiesInWindow =
                new Set(
                    windowItems.map(item =>
                        getExitIdentity(item.exit)
                    )
                );

            const hasReversal =
                distinctIdentitiesInWindow.size > 1;

            const confidenceLevel =
                hasReversal && mountainResult.confidenceLevel === "full"
                    ? "partial"
                    : mountainResult.confidenceLevel;

            return { confidenceLevel };
        };

        const findValidatedWaypoints = (
            segmentTraceItems,
            segmentStartTraceIndex
        ) => {
            const runs = groupTraceItemsIntoRuns(segmentTraceItems);
            const waypointsByIdentity = new Map();

            runs.forEach(run => {
                if (!run.identity) {
                    return;
                }

                const relativeCenterIndex =
                    Math.floor(
                        (run.startIndex + run.endIndex) / 2
                    );

                // ウィンドウは区間内だけでなく、ルート全体（routeTrace）から
                // 取得する。区間外（区間の直前・直後）の点も含めることで、
                // 「区間境界を挟んで本当に近づいて→離れていったか」を
                // 判定できるようにする（区間内だけに限定すると、短い誤検出
                // 区間ではウィンドウ自体が区間内で完結してしまい、山型の
                // 判定材料が不足する）。
                const absoluteCenterIndex =
                    segmentStartTraceIndex + relativeCenterIndex;

                const windowIndices =
                    extractWindowIndices(
                        routeTrace.length,
                        absoluteCenterIndex,
                        SHUTO_SEGMENT_WINDOW_RADIUS
                    );

                const windowItems =
                    windowIndices.map(index => routeTrace[index]);

                const candidateExitsByIdentity = new Map();

                windowItems.forEach(item => {
                    const identity = getExitIdentity(item.exit);

                    if (
                        identity &&
                        !candidateExitsByIdentity.has(identity)
                    ) {
                        candidateExitsByIdentity.set(
                            identity,
                            item.exit
                        );
                    }
                });

                candidateExitsByIdentity.forEach(
                    (candidateExit, identity) => {
                        const evaluation =
                            evaluateCandidateWindow(
                                windowItems,
                                candidateExit
                            );

                        if (!evaluation) {
                            return;
                        }

                        const existing =
                            waypointsByIdentity.get(identity);

                        if (
                            !existing ||
                            CONFIDENCE_RANK[evaluation.confidenceLevel] >
                                CONFIDENCE_RANK[existing.confidenceLevel]
                        ) {
                            waypointsByIdentity.set(identity, {
                                exit: candidateExit,
                                // segmentTraceItems（区間ローカル）基準の
                                // インデックス。order連続性チェック
                                // （区間内のスライス）で使うため、絶対位置
                                // ではなく区間内の相対位置で保持する。
                                traceIndex: relativeCenterIndex,
                                confidenceLevel:
                                    evaluation.confidenceLevel
                            });
                        }
                    }
                );
            });

            return [...waypointsByIdentity.values()]
                .sort((a, b) => a.traceIndex - b.traceIndex);
        };

        // 路線移動の正当性チェックで使う識別キー。roadLabel（首都高／NEXCOの
        // 大分類）だけでは、首都高内部の路線間移動（routeCodeが変わってもroadLabelは
        // 常に"首都高"のまま）を検出できないため、首都高はrouteName、NEXCOは
        // sourceAreaKeyという、より細かい路線単位の識別キーを使う。
        const getRouteIdentity = exit => {
            if (!exit) {
                return null;
            }

            return isShutoIcForRouteAnalysis(exit)
                ? (exit.routeName || null)
                : (exit.sourceAreaKey || exit.sourceAreaKeys?.[0] || null);
        };

        // 路線（routeIdentity）が変わる地点では、首都高内部の乗り継ぎか
        // 首都高⇔NEXCO間の乗り継ぎかを区別せず、必ずconnection===trueかつ
        // connectedRoadsに前後両方のidentityを含むJCTエントリによる
        // 裏付けを要求する（同一路線内であれば裏付け不要）。
        const isRouteTransitionValidated = (previousItem, currentItem) => {
            if (!previousItem || !currentItem) {
                return true;
            }

            const previousIdentity = getRouteIdentity(previousItem.exit);
            const currentIdentity = getRouteIdentity(currentItem.exit);

            if (previousIdentity === currentIdentity) {
                return true;
            }

            const boundaryExit =
                previousItem.exit?.connection === true
                    ? previousItem.exit
                    : currentItem.exit?.connection === true
                        ? currentItem.exit
                        : null;

            if (
                !boundaryExit ||
                !Array.isArray(boundaryExit.connectedRoads)
            ) {
                return false;
            }

            return (
                boundaryExit.connectedRoads.includes(
                    previousIdentity
                ) &&
                boundaryExit.connectedRoads.includes(
                    currentIdentity
                )
            );
        };

        // 診断用（ログ出力のみに使用）。isRouteTransitionValidatedが
        // falseを返した理由（boundaryExitが見つからなかったのか、
        // 見つかったがconnectedRoadsに前後どちらかのidentityが
        // 含まれていなかったのか）を、判定結果を変えずに調べ直すだけの
        // 関数。isRouteTransitionValidated自体の判定ロジックには影響しない。
        const getRouteTransitionFailureDetail = (
            previousItem,
            currentItem
        ) => {
            const previousIdentity =
                getRouteIdentity(previousItem.exit);
            const currentIdentity =
                getRouteIdentity(currentItem.exit);

            const boundaryExit =
                previousItem.exit?.connection === true
                    ? previousItem.exit
                    : currentItem.exit?.connection === true
                        ? currentItem.exit
                        : null;

            let reason;

            if (!boundaryExit) {
                reason =
                    "connection:trueのJCTエントリが" +
                    "前後どちらにも見つからない";
            }
            else if (!Array.isArray(boundaryExit.connectedRoads)) {
                reason =
                    "JCTエントリ（" +
                    (boundaryExit.displayName || "不明") +
                    "）にconnectedRoadsが無い";
            }
            else {
                const missingSides = [];

                if (
                    !boundaryExit.connectedRoads.includes(
                        previousIdentity
                    )
                ) {
                    missingSides.push(
                        "前(" + previousIdentity + ")"
                    );
                }

                if (
                    !boundaryExit.connectedRoads.includes(
                        currentIdentity
                    )
                ) {
                    missingSides.push(
                        "後(" + currentIdentity + ")"
                    );
                }

                reason =
                    missingSides.length > 0
                        ? "JCTエントリ（" +
                            (boundaryExit.displayName || "不明") +
                            "）のconnectedRoadsに" +
                            missingSides.join("・") +
                            "が含まれない"
                        : "不明";
            }

            return {
                previousIcName:
                    previousItem.exit?.displayName || "なし",
                currentIcName:
                    currentItem.exit?.displayName || "なし",
                previousIdentity,
                currentIdentity,
                boundaryExitName:
                    boundaryExit?.displayName || "なし",
                reason
            };
        };

        const checkOrderContinuity = traceItems => {
            let direction = 0;
            let violations = 0;

            // 診断用（ログ出力のみに使用）。isContinuousの判定条件
            // （violations <= SHUTO_SEGMENT_ORDER_TOLERANCE_VIOLATIONS）
            // 自体には一切影響しない、棄却理由の内訳集計。
            let routeTransitionViolationCount = 0;
            let orderDirectionViolationCount = 0;
            const violationDetails = [];

            let previousItem = null;

            traceItems.forEach((item, index) => {
                if (
                    previousItem &&
                    !isRouteTransitionValidated(previousItem, item)
                ) {
                    violations +=
                        SHUTO_SEGMENT_ORDER_TOLERANCE_VIOLATIONS + 1;
                    routeTransitionViolationCount++;

                    const failureDetail =
                        getRouteTransitionFailureDetail(
                            previousItem,
                            item
                        );

                    violationDetails.push({
                        type: "route-transition",
                        traceIndex: index,
                        previousIcName:
                            failureDetail.previousIcName,
                        currentIcName:
                            failureDetail.currentIcName,
                        previousIdentity:
                            failureDetail.previousIdentity,
                        currentIdentity:
                            failureDetail.currentIdentity,
                        boundaryExitName:
                            failureDetail.boundaryExitName,
                        reason: failureDetail.reason
                    });
                }

                const exit = item.exit;
                const previousExit = previousItem?.exit;

                const sameRouteIdentity =
                    Boolean(previousExit) &&
                    Boolean(exit) &&
                    getRouteIdentity(previousExit) !== null &&
                    getRouteIdentity(exit) !== null &&
                    getRouteIdentity(previousExit) === getRouteIdentity(exit);

                if (
                    sameRouteIdentity &&
                    Number.isFinite(previousExit.order) &&
                    Number.isFinite(exit.order)
                ) {
                    const diff = exit.order - previousExit.order;

                    if (diff !== 0) {
                        if (direction === 0) {
                            direction = Math.sign(diff);
                        }
                        else if (Math.sign(diff) !== direction) {
                            violations++;
                            orderDirectionViolationCount++;

                            violationDetails.push({
                                type: "order-direction",
                                traceIndex: index,
                                previousIcName:
                                    previousExit.displayName ||
                                    "なし",
                                currentIcName:
                                    exit.displayName || "なし",
                                previousIdentity:
                                    getRouteIdentity(previousExit),
                                currentIdentity:
                                    getRouteIdentity(exit),
                                previousOrder: previousExit.order,
                                currentOrder: exit.order,
                                reason:
                                    "それまでの進行方向(" +
                                    direction +
                                    ")に対してorderが逆行" +
                                    "（差分" + diff + "）"
                            });
                        }
                    }
                }
                else if (!sameRouteIdentity) {
                    // 路線（routeIdentity）が変わったタイミングでdirectionを
                    // リセットする。リセットしないと、手前の路線（例：
                    // 1号上野線やC1）で確定した進行方向が、路線が変わった後の
                    // 新しい路線（例：4号新宿線）にそのまま引き継がれ、新しい
                    // 路線内で自然に単調増加/減少しているorderが「それまでの
                    // 方向と逆」と誤判定されてしまう。
                    direction = 0;
                }

                previousItem = item;
            });

            return {
                isContinuous:
                    violations <=
                    SHUTO_SEGMENT_ORDER_TOLERANCE_VIOLATIONS,
                routeTransitionViolationCount,
                orderDirectionViolationCount,
                violationDetails
            };
        };

        // 診断用（ログ出力のみに使用）。shutoSegments/shutoEntryCountの
        // 算出には一切使わない、棄却された区間の理由一覧。
        const shutoSegmentDiagnostics = [];

        const shutoSegments =
            correctedRoadSegments
                .filter(segment => segment.roadLabel === "首都高")
                .map(segment => {
                    const segmentTraceItems =
                        routeTrace.slice(
                            segment.startTraceIndex,
                            segment.endTraceIndex + 1
                        );

                    const waypoints =
                        findValidatedWaypoints(
                            segmentTraceItems,
                            segment.startTraceIndex
                        );

                    if (waypoints.length === 0) {
                        shutoSegmentDiagnostics.push({
                            startTraceIndex:
                                segment.startTraceIndex,
                            endTraceIndex:
                                segment.endTraceIndex,
                            accepted: false,
                            rejectionReason:
                                "山型判定・候補ウィンドウで" +
                                "有効なwaypointsが0件"
                        });

                        return null;
                    }

                    const firstWaypoint = waypoints[0];

                    const lastWaypoint =
                        waypoints[waypoints.length - 1];

                    const continuityCheck =
                        checkOrderContinuity(
                            segmentTraceItems.slice(
                                firstWaypoint.traceIndex,
                                lastWaypoint.traceIndex + 1
                            )
                        );

                    if (!continuityCheck.isContinuous) {
                        const reasonParts = [];

                        if (
                            continuityCheck
                                .routeTransitionViolationCount > 0
                        ) {
                            reasonParts.push(
                                "JCT裏付けなしの路線移動" +
                                continuityCheck
                                    .routeTransitionViolationCount +
                                "件"
                            );
                        }

                        if (
                            continuityCheck
                                .orderDirectionViolationCount > 0
                        ) {
                            reasonParts.push(
                                "order逆行" +
                                continuityCheck
                                    .orderDirectionViolationCount +
                                "件"
                            );
                        }

                        shutoSegmentDiagnostics.push({
                            startTraceIndex:
                                segment.startTraceIndex,
                            endTraceIndex:
                                segment.endTraceIndex,
                            accepted: false,
                            rejectionReason:
                                "order連続性チェック失敗（" +
                                (
                                    reasonParts.join("、") ||
                                    "詳細不明"
                                ) +
                                "）",
                            // 診断用（ログ出力のみ）。逆行・裏付けなしが
                            // 発生した各箇所の詳細（IC名・identity・
                            // order値・boundaryExit等）。
                            violationDetails:
                                continuityCheck.violationDetails
                        });

                        return null;
                    }

                    const entranceIc =
                        isEntranceRoleSelectable(firstWaypoint.exit)
                            ? firstWaypoint.exit
                            : segmentTraceItems.find(item =>
                                isEntranceRoleSelectable(item.exit)
                            )?.exit || null;

                    const findFallbackExitIc = () => {
                        for (
                            let index = segmentTraceItems.length - 1;
                            index >= 0;
                            index--
                        ) {
                            if (
                                isExitRoleSelectable(
                                    segmentTraceItems[index].exit
                                )
                            ) {
                                return segmentTraceItems[index].exit;
                            }
                        }

                        return null;
                    };

                    const exitIc =
                        isExitRoleSelectable(lastWaypoint.exit)
                            ? lastWaypoint.exit
                            : findFallbackExitIc();

                    const confidenceLevels =
                        waypoints.map(
                            waypoint => waypoint.confidenceLevel
                        );

                    const confidenceLevel =
                        confidenceLevels.includes("partial")
                            ? "partial"
                            : confidenceLevels.includes("edge")
                                ? "edge"
                                : "full";

                    shutoSegmentDiagnostics.push({
                        startTraceIndex:
                            segment.startTraceIndex,
                        endTraceIndex:
                            segment.endTraceIndex,
                        accepted: true,
                        rejectionReason: null
                    });

                    return {
                        entranceIc,
                        exitIc,
                        startTraceIndex:
                            segment.startTraceIndex,
                        endTraceIndex:
                            segment.endTraceIndex,
                        confidenceLevel
                    };
                })
                .filter(Boolean);

        const shutoEntryCount = shutoSegments.length;

        const tollTagResult =
            detectTollSectionsFromSteps(highwayRoute);

        return {
            roadSequence:
                correctedRoadSummary.roadSequence,
            displayRoadSequence,
            roadDistances:
                correctedRoadSummary.roadDistances,
            entranceIc: entranceCandidate,
            exitIc: exitCandidate,
            nexcoEntranceIc: nexcoEntranceCandidate,
            nexcoExitIc: nexcoExitCandidate,
            shutoEntranceIc:
                shutoEntranceAnalysis.selectedIc,
            shutoExitIc:
                shutoExitAnalysis.selectedIc,
            shutoSegments,
            shutoEntryCount,
            // 診断用（ログ出力のみ）。棄却された区間とその理由の一覧。
            // shutoSegments/shutoEntryCountの算出には影響しない。
            shutoSegmentDiagnostics,
            // 「有料区間」タグベースの区間検出結果。estimateMainHighwayToll
            // 等の料金計算で、hasTollSectionStepsDataがtrueの場合に
            // 優先的に使われる（highwayRouteに実際にlegs.stepsが含まれて
            // いる場合のみtrue。V2比較候補選定等、steps未取得の呼び出し
            // 元ではfalseのままとなり、既存の座標ベース方式にフォール
            // バックする）。
            tollSections: tollTagResult.tollSections,
            tollEntryCount: tollTagResult.tollEntryCount,
            hasTollSectionStepsData:
                tollTagResult.hasStepsData,
            shutoDetail: {
                startSampleCount:
                    shutoDetailStartSamples.length,
                endSampleCount:
                    shutoDetailEndSamples.length,
                entranceSampleCount:
                    shutoEntranceWindow.samples.length,
                entranceWindowStartDistanceMeters:
                    shutoEntranceWindow.startDistanceMeters,
                entranceWindowEndDistanceMeters:
                    shutoEntranceWindow.endDistanceMeters,
                exitSampleCount:
                    shutoExitWindow.samples.length,
                exitWindowStartDistanceMeters:
                    shutoExitWindow.startDistanceMeters,
                exitWindowEndDistanceMeters:
                    shutoExitWindow.endDistanceMeters,
                entranceCandidates:
                    shutoEntranceAnalysis.candidates,
                exitCandidates:
                    shutoExitAnalysis.candidates
            },
            rawRoadSequence: roadSequence,
            rawRoadDistances: roadDistanceLogs,
            rawRoadSwitches: roadSwitches,
            routePoints,
            sampledPoints,
            areaCounts,
            routePointLogs,
            rawRouteTrace,
            routeTrace,
            isolatedRoadTraceNoise,
            passedIcEntries,
            roadSwitches: correctedRoadSwitches
        };
    }
    catch (error) {
        console.warn(
            "[ROUTE POLYLINE調査] 解析失敗",
            error
        );
        return null;
    }
}

const entranceSectionFilterLoggedAnalyses = new WeakSet();

function inferTravelDirectionForIcArea(
    icArea,
    referenceIc,
    passedIcEntries,
    getIcIdentity
) {

    const findExitInArea = targetIc => {
        const targetIdentity = getIcIdentity(targetIc);

        if (!targetIdentity) {
            return null;
        }

        if (IC_MASTER[icArea]) {
            return IC_MASTER[icArea].exits.find(exit =>
                getIcIdentity(exit) === targetIdentity &&
                exit.isMirror !== true
            ) || null;
        }

        // gaikan等のIC_MASTERエリアではなく、SHUTO_IC_MASTER側routeCode
        // （"C1"/"C2"等）またはrouteName（例："首都高速6号向島線"）で
        // 管理されている路線向けのフォールバック。
        // routeNameでの一致も許容するのは、routeCode:"6"が
        // 6号向島線・6号三郷線の2路線で重複しているため、
        // routeCodeだけでは路線を一意に指定できないケースがあるため。
        // IC_MASTER[icArea]が存在しない場合のみ参照するため、
        // 既存のgaikan/gaikanUchimawari等の挙動には影響しない。
        return SHUTO_IC_MASTER.find(ic =>
            (
                ic.routeCode === icArea ||
                ic.routeName === icArea
            ) &&
            getIcIdentity(ic) === targetIdentity
        ) || null;
    };

    const getComparablePosition = (exit, reference) => {
        if (!exit || !reference) {
            return null;
        }

        if (
            exit.routeBranch &&
            reference.routeBranch &&
            exit.routeBranch !== reference.routeBranch
        ) {
            return null;
        }

        if (
            Number.isFinite(exit.branchOrder) &&
            Number.isFinite(reference.branchOrder)
        ) {
            return exit.branchOrder;
        }

        return Number.isFinite(exit.order)
            ? exit.order
            : null;
    };

    const referenceInArea =
        findExitInArea(referenceIc);

    const referencePosition =
        getComparablePosition(
            referenceInArea,
            referenceInArea
        );

    if (referencePosition === null) {
        return null;
    }

    const passedIcs = passedIcEntries || [];

    const referencePassedIndex =
        passedIcs.findIndex(item =>
            getIcIdentity(item.exit) ===
                getIcIdentity(referenceIc)
        );

    if (referencePassedIndex < 0) {
        return null;
    }

    for (
        let index = referencePassedIndex + 1;
        index < passedIcs.length;
        index++
    ) {
        const nextExit =
            findExitInArea(passedIcs[index].exit);

        const nextPosition =
            getComparablePosition(
                nextExit,
                referenceInArea
            );

        if (
            nextPosition !== null &&
            nextPosition !== referencePosition
        ) {
            return Math.sign(
                nextPosition - referencePosition
            );
        }
    }

    for (
        let index = referencePassedIndex - 1;
        index >= 0;
        index--
    ) {
        const previousExit =
            findExitInArea(passedIcs[index].exit);

        const previousPosition =
            getComparablePosition(
                previousExit,
                referenceInArea
            );

        if (
            previousPosition !== null &&
            previousPosition !== referencePosition
        ) {
            return Math.sign(
                referencePosition - previousPosition
            );
        }
    }

    return null;
}

let shutoMirrorGoogleNameSetCache = null;

// gaikanUchimawari・shutoC1Uchimawari/shutoC2Uchimawari・線形10路線分の
// ミラーエリア（計13エリア）に登録されている全ICのgoogleNameを
// 1つのSetにまとめる。初回呼び出し時にのみ構築し、以降は使い回す。
// このSetの有無そのものが「方向依存ICかどうか」の判定材料になるため、
// 方向依存でないIC（ミラーが存在しない大多数の候補）には影響しない。
function getShutoMirrorGoogleNameSet() {

    if (shutoMirrorGoogleNameSetCache) {
        return shutoMirrorGoogleNameSetCache;
    }

    const mirrorAreaKeys = [
        "gaikanUchimawari",
        "shutoC1Uchimawari",
        "shutoC2Uchimawari",
        "shuto6MukoUchimawari",
        "shuto6MisatoUchimawari",
        "shuto7KomatsugawaUchimawari",
        "shuto1UenoUchimawari",
        "shuto4ShinjukuUchimawari",
        "shuto5IkebukuroUchimawari",
        "shuto3ShibuyaUchimawari",
        "shuto2MeguroUchimawari",
        "shutoBWanganUchimawari",
        "shutoS1KawaguchiUchimawari"
    ];

    const googleNames = new Set();

    mirrorAreaKeys.forEach(areaKey => {
        (IC_MASTER[areaKey]?.exits || []).forEach(mirrorExit => {
            if (mirrorExit.googleName) {
                googleNames.add(mirrorExit.googleName);
            }
        });
    });

    shutoMirrorGoogleNameSetCache = googleNames;

    return shutoMirrorGoogleNameSetCache;
}

// SHUTO_IC_MASTER側routeName → 対応するミラーエリアのキー。
// gaikan（東京外環自動車道）はSHUTO_IC_MASTER側のICではなく
// routeNameフィールド自体を持たないため、このマップには含まれない
// （resolveGaikanDirectionalIcArea側で別途・既存の仕組みにより処理される）。
const SHUTO_MIRROR_AREA_KEY_BY_ROUTE_NAME = {
    "首都高速都心環状線": "shutoC1Uchimawari",
    "首都高速中央環状線": "shutoC2Uchimawari",
    "首都高速6号向島線": "shuto6MukoUchimawari",
    "首都高速6号三郷線": "shuto6MisatoUchimawari",
    "首都高速7号小松川線": "shuto7KomatsugawaUchimawari",
    "首都高速1号上野線": "shuto1UenoUchimawari",
    "首都高速4号新宿線": "shuto4ShinjukuUchimawari",
    "首都高速5号池袋線": "shuto5IkebukuroUchimawari",
    "首都高速3号渋谷線": "shuto3ShibuyaUchimawari",
    "首都高速2号目黒線": "shuto2MeguroUchimawari",
    "首都高速湾岸線": "shutoBWanganUchimawari",
    "首都高速川口線": "shutoS1KawaguchiUchimawari"
};

// buildForwardExitComparisonIcCandidates側はroute経路の全サンプル点
// (500m間隔)を走査するため、同一ICに複数のサンプル点が対応し、
// resolveEffectiveShutoExit自体は毎回（正しく）呼ばれる。
// 差し替え結果には影響を与えず、コンソールログのみをpolylineAnalysisごと・
// 同一IC＋同一ミラー先ごとに1回に間引くための補助。
// polylineAnalysisをキーにしたWeakMapのため、新しいルート解析が
// 行われれば自然に別スコープになる。
const shutoMirrorSubstitutionLoggedKeysByAnalysis = new WeakMap();

function hasLoggedShutoMirrorSubstitution(polylineAnalysis, key) {

    if (!polylineAnalysis) {
        return false;
    }

    let loggedKeys =
        shutoMirrorSubstitutionLoggedKeysByAnalysis.get(polylineAnalysis);

    if (!loggedKeys) {
        loggedKeys = new Set();
        shutoMirrorSubstitutionLoggedKeysByAnalysis.set(
            polylineAnalysis,
            loggedKeys
        );
    }

    if (loggedKeys.has(key)) {
        return true;
    }

    loggedKeys.add(key);

    return false;
}

// 方向判定の結果に応じて、候補ICをSHUTO_IC_MASTER本体側のオブジェクトのまま
// 使うか、ミラーエリア側のオブジェクトに差し替えるかを決定する。
// 差し替えは候補収集の入口で行うため、entranceSelectable/exitSelectableを
// 直接参照している既存の判定箇所（isShutoIcSelectableForRole等）は
// 一切変更せずに、正しい値を読むようになる。
//
// SHUTO_MIRROR_AREA_KEY_BY_ROUTE_NAMEに対応エリアが無い路線
// （方向依存ミラーを持たない大多数のIC、およびgaikan＝routeName自体を
// 持たないため必然的に対象外になる）は、この関数の冒頭で早期returnし、
// 無変更のexitをそのまま返す。5号池袋線での実車確認（順方向・逆方向とも）
// 済みのロジックを、全路線に対して同一のまま適用する。
function resolveEffectiveShutoExit(
    exit,
    polylineAnalysis,
    getIcIdentity
) {

    const mirrorAreaKey =
        exit
            ? SHUTO_MIRROR_AREA_KEY_BY_ROUTE_NAME[exit.routeName]
            : null;

    if (!exit || !mirrorAreaKey || !IC_MASTER[mirrorAreaKey]) {
        return exit;
    }

    const identity = getIcIdentity(exit);

    if (!identity || !getShutoMirrorGoogleNameSet().has(identity)) {
        return exit;
    }

    const mirrorExit =
        IC_MASTER[mirrorAreaKey].exits.find(candidate =>
            getIcIdentity(candidate) === identity
        );

    if (!mirrorExit) {
        return exit;
    }

    const travelDirection =
        inferTravelDirectionForIcArea(
            exit.routeName,
            exit,
            polylineAnalysis?.passedIcEntries,
            getIcIdentity
        );

    // 判定不能（null）の場合は安全側として本体のexitをそのまま使う。
    // travelDirection === -1（並び順の逆＝ミラー側）の場合のみ差し替える。
    // この±1とミラー側採用の対応は実車確認前提の暫定判断のため、
    // 実車確認で逆と分かった場合はこの符号判定のみを反転すればよい。
    if (travelDirection === -1) {
        // buildForwardExitComparisonIcCandidates側は500m間隔の
        // routeTrace全件（同一ICに複数サンプル点が対応し得る）に対して
        // 差し替え判定自体は毎回行うが、ログはpolylineAnalysisごとに
        // 同一IC・同一ミラー先につき1回だけ出す（差し替え結果自体は
        // 従来どおり毎回returnするため、候補選定の挙動は変わらない）。
        if (
            !hasLoggedShutoMirrorSubstitution(
                polylineAnalysis,
                identity + "|" + mirrorAreaKey
            )
        ) {
            console.log(
                "[方向判定→候補差し替え] " +
                exit.displayName +
                "（" + exit.routeName + "）は" +
                "方向判定によりミラー側（" + mirrorAreaKey + "）に差し替えました。"
            );
        }

        return mirrorExit;
    }

    return exit;
}

// 【Phase 1／Phase 2】NEXCO系（IC_MASTER）ICのうち、方向によって入口/出口の
// 可否が異なるICについて、resolveEffectiveShutoExitと同じ考え方（走行方向判定→
// 候補差し替え）を最小限適用する、首都高側とは完全に独立した新規関数。
// 首都高側のresolveEffectiveShutoExit・SHUTO_MIRROR_AREA_KEY_BY_ROUTE_NAME・
// getShutoMirrorGoogleNameSetは一切変更していない。
//
// Phase 1では貝塚IC・篠崎IC（ともにkeiyoエリア）の2件、Phase 2では
// 木更津南IC（tateyama・keiyoの重複登録の両方）・富浦IC・君津PA SIC
// （いずれもtateyamaエリア）の3件を追加し、計5件をgoogleName直指定で
// 対応する。全路線対応の汎用マップはまだ作らない（現時点のスコープ）。
//
// NEXCO_MIRROR_SWAP_DIRECTION_BY_GOOGLE_NAMEの値は「この符号のtravelDirectionの
// ときミラー側に差し替える」という意味。本体側が担う方向（貝塚IC＝上り入口、
// 篠崎IC＝下り入口）が互いに逆であるため、Phase 1の2件の符号は異なる
// （+1/-1）。Phase 2で追加した3件はいずれも「上り入口を代表方向とするIC」
// という構造上の共通点から、貝塚ICと同じ符号（+1）を暫定設定している。
// SHUTO側と同様、実車確認前提の暫定値のため、実車確認で逆と分かった場合は
// ICごとにこの符号のみを反転すればよい。
const NEXCO_MIRROR_SWAP_DIRECTION_BY_GOOGLE_NAME = {
    "京葉道路 貝塚インターチェンジ": 1,
    "京葉道路 篠崎インターチェンジ": -1,
    "館山自動車道 木更津南インターチェンジ": 1,
    "富津館山道路 富浦インターチェンジ": 1,
    "館山自動車道 君津PAスマートインターチェンジ": 1
};

const nexcoMirrorSubstitutionLoggedKeysByAnalysis = new WeakMap();

function hasLoggedNexcoMirrorSubstitution(polylineAnalysis, key) {

    if (!polylineAnalysis) {
        return false;
    }

    let loggedKeys =
        nexcoMirrorSubstitutionLoggedKeysByAnalysis.get(polylineAnalysis);

    if (!loggedKeys) {
        loggedKeys = new Set();
        nexcoMirrorSubstitutionLoggedKeysByAnalysis.set(
            polylineAnalysis,
            loggedKeys
        );
    }

    if (loggedKeys.has(key)) {
        return true;
    }

    loggedKeys.add(key);

    return false;
}

function resolveEffectiveNexcoExit(
    exit,
    polylineAnalysis,
    getIcIdentity
) {

    const swapDirection =
        exit
            ? NEXCO_MIRROR_SWAP_DIRECTION_BY_GOOGLE_NAME[exit.googleName]
            : undefined;

    // 木更津南IC・富浦IC・君津PA SICはIC_MASTER上のrouteBranchが
    // "aqualine"のままだが、実際の格納先エリアはtateyama/keiyoである
    // （既知のデータ不整合。routeBranch自体は修正せず、ここでは
    // エリア検索専用にsourceAreaKeyを優先して使う）。
    // mirrorExit検索内のcandidate.routeBranch === exit.routeBranchは
    // 本体とミラーが同じrouteBranch値を持つ前提のままでよいため変更しない。
    const containingAreaKey =
        exit?.sourceAreaKey || exit?.routeBranch;

    if (
        !exit ||
        swapDirection === undefined ||
        !containingAreaKey ||
        !IC_MASTER[containingAreaKey]
    ) {
        return exit;
    }

    const mirrorExit =
        IC_MASTER[containingAreaKey].exits.find(candidate =>
            candidate.isMirror === true &&
            candidate.mirrorOf === exit.branchOrder &&
            candidate.routeBranch === exit.routeBranch
        );

    if (!mirrorExit) {
        return exit;
    }

    const travelDirection =
        inferTravelDirectionForIcArea(
            containingAreaKey,
            exit,
            polylineAnalysis?.passedIcEntries,
            getIcIdentity
        );

    // 判定不能（null）の場合は安全側として本体のexitをそのまま使う。
    if (travelDirection === swapDirection) {
        const identity = getIcIdentity(exit);

        if (
            identity &&
            !hasLoggedNexcoMirrorSubstitution(
                polylineAnalysis,
                identity + "|" + exit.routeBranch
            )
        ) {
            console.log(
                "[NEXCO方向判定→候補差し替え] " +
                exit.displayName +
                "（" + exit.routeBranch + "）は" +
                "方向判定によりミラー側に差し替えました。"
            );
        }

        return mirrorExit;
    }

    return exit;
}

function filterEntranceCandidatesByRouteSection({
    polylineAnalysis,
    candidates,
    candidateAreas,
    getIcIdentity
}) {
    const referenceIc =
        polylineAnalysis.nexcoEntranceIc;

    const shutoEntranceIc =
        polylineAnalysis.shutoEntranceIc;

    const workingCandidates = [...candidates];
    const excludedCandidates = [];

    const findExitInArea = (icArea, targetIc) => {
        const targetIdentity = getIcIdentity(targetIc);

        if (!targetIdentity || !IC_MASTER[icArea]) {
            return null;
        }

        return IC_MASTER[icArea].exits.find(exit =>
            getIcIdentity(exit) === targetIdentity &&
            exit.isMirror !== true
        ) || null;
    };

    const referenceAreaIndex =
        candidateAreas.findIndex(icArea =>
            Boolean(findExitInArea(icArea, referenceIc))
        );

    const referenceArea =
        referenceAreaIndex >= 0
            ? candidateAreas[referenceAreaIndex]
            : null;

    const getComparablePosition = (exit, reference) => {
        if (!exit || !reference) {
            return null;
        }

        if (
            exit.routeBranch &&
            reference.routeBranch &&
            exit.routeBranch !== reference.routeBranch
        ) {
            return null;
        }

        if (
            Number.isFinite(exit.branchOrder) &&
            Number.isFinite(reference.branchOrder)
        ) {
            return exit.branchOrder;
        }

        return Number.isFinite(exit.order)
            ? exit.order
            : null;
    };

    const inferTravelDirection = icArea =>
        inferTravelDirectionForIcArea(
            icArea,
            referenceIc,
            polylineAnalysis.passedIcEntries,
            getIcIdentity
        );

    const getForwardStepCount = (
        icArea,
        candidateExit,
        travelDirection
    ) => {
        if (!travelDirection) {
            return null;
        }

        const referenceInArea =
            findExitInArea(icArea, referenceIc);

        const exitsInTravelOrder =
            IC_MASTER[icArea].exits
                .filter(exit =>
                    exit.isSelectable !== false &&
                    exit.isMirror !== true &&
                    !isShutoIcForRouteAnalysis(exit) &&
                    getComparablePosition(
                        exit,
                        referenceInArea
                    ) !== null
                )
                .slice()
                .sort((a, b) =>
                    (
                        getComparablePosition(
                            a,
                            referenceInArea
                        ) -
                        getComparablePosition(
                            b,
                            referenceInArea
                        )
                    ) * travelDirection
                );

        const referenceIndex =
            exitsInTravelOrder.findIndex(exit =>
                getIcIdentity(exit) ===
                    getIcIdentity(referenceIc)
            );

        const candidateIndex =
            exitsInTravelOrder.findIndex(exit =>
                getIcIdentity(exit) ===
                    getIcIdentity(candidateExit)
            );

        if (referenceIndex < 0 || candidateIndex < 0) {
            return null;
        }

        return candidateIndex - referenceIndex;
    };

    const connectsToLaterRoadSection = exit => {
        if (
            referenceAreaIndex < 0 ||
            !exit?.connection ||
            !Array.isArray(exit.connectedRoads)
        ) {
            return false;
        }

        const laterAreas =
            candidateAreas.slice(referenceAreaIndex + 1);

        return exit.connectedRoads.some(connectedRoad =>
            laterAreas.includes(connectedRoad)
        );
    };

    const routeBaseDistanceMeters =
        polylineAnalysis.sampledPoints?.[0]
            ?.routeDistanceMeters ?? 0;

    const shutoEntranceCandidates =
        (polylineAnalysis.shutoDetail
            ?.entranceCandidates || [])
            .map(candidate => ({
                ...candidate,
                exit:
                    resolveEffectiveShutoExit(
                        candidate?.exit,
                        polylineAnalysis,
                        getIcIdentity
                    )
            }))
            .filter(candidate => {
                const exit = candidate?.exit;

                return (
                    exit &&
                    isShutoIcForRouteAnalysis(exit) &&
                    isShutoIcSelectableForRole(
                        exit,
                        "entrance"
                    ) &&
                    exit.isSelectable !== false &&
                    !(
                        exit.connection === true &&
                        /JCT|ジャンクション/i.test(
                            exit.displayName ||
                            exit.googleName ||
                            ""
                        )
                    ) &&
                    (
                        !Number.isFinite(
                            candidate.lastRouteDistanceMeters
                        ) ||
                        candidate.lastRouteDistanceMeters >=
                            routeBaseDistanceMeters
                    )
                );
            })
            .slice()
            .sort((a, b) =>
                (
                    a.lastRouteDistanceMeters ?? Infinity
                ) -
                (
                    b.lastRouteDistanceMeters ?? Infinity
                )
            );

    const shutoCandidateByIdentity = new Map(
        shutoEntranceCandidates.map(candidate => [
            getIcIdentity(candidate.exit),
            candidate
        ])
    );

    const orderedShutoEntrances = [
        ...(shutoEntranceIc
            ? [{
                exit:
                    resolveEffectiveShutoExit(
                        shutoEntranceIc,
                        polylineAnalysis,
                        getIcIdentity
                    ),
                isPrimary: true
            }]
            : []),
        ...shutoEntranceCandidates.map(candidate => ({
            exit: candidate.exit,
            isPrimary: false
        }))
    ];

    orderedShutoEntrances.forEach(item => {
        const exit = item.exit;
        const identity = getIcIdentity(exit);

        if (
            !identity ||
            !isShutoIcSelectableForRole(exit, "entrance") ||
            exit.isSelectable === false ||
            (
                exit.connection === true &&
                /JCT|ジャンクション/i.test(
                    exit.displayName ||
                    exit.googleName ||
                    ""
                )
            )
        ) {
            return;
        }

        const routeCandidate =
            shutoCandidateByIdentity.get(identity);

        const alreadyIncluded =
            workingCandidates.find(candidate =>
                getIcIdentity(candidate.exit) === identity
            );

        if (alreadyIncluded) {
            alreadyIncluded.isPrimaryShutoEntrance =
                alreadyIncluded.isPrimaryShutoEntrance ||
                item.isPrimary;
            alreadyIncluded.routeDistanceMeters =
                alreadyIncluded.routeDistanceMeters ??
                routeCandidate?.lastRouteDistanceMeters;
            return;
        }

        const shutoArea =
            candidateAreas.find(icArea =>
                Boolean(findExitInArea(icArea, exit))
            ) || referenceArea;

        workingCandidates.push({
            icArea: shutoArea,
            exit,
            isShuto: true,
            isPrimaryShutoEntrance: item.isPrimary,
            routeDistanceMeters:
                routeCandidate?.lastRouteDistanceMeters
        });
    });

    const beforeCandidates = [...workingCandidates];

    const filteredCandidates =
        workingCandidates.filter(candidate => {
            const exit = candidate.exit;

            if (exit?.entranceSelectable === false) {
                excludedCandidates.push({
                    candidate,
                    reason: "入口として選択不可"
                });
                return false;
            }

            if (
                isShutoIcForRouteAnalysis(exit) &&
                !isShutoIcSelectableForRole(
                    exit,
                    "entrance"
                )
            ) {
                excludedCandidates.push({
                    candidate,
                    reason: "入口として選択不可"
                });
                return false;
            }

            if (
                isShutoIcForRouteAnalysis(exit) ||
                getIcIdentity(exit) ===
                    getIcIdentity(referenceIc)
            ) {
                return true;
            }

            const candidateAreaIndex =
                candidateAreas.indexOf(candidate.icArea);

            if (
                referenceAreaIndex >= 0 &&
                candidateAreaIndex > referenceAreaIndex
            ) {
                excludedCandidates.push({
                    candidate,
                    reason:
                        "基準入口より後方の道路セクション"
                });
                return false;
            }

            if (
                referenceArea &&
                candidate.icArea === referenceArea
            ) {
                const referenceInArea =
                    findExitInArea(referenceArea, referenceIc);

                const candidateInArea =
                    findExitInArea(referenceArea, exit);

                const referencePosition =
                    getComparablePosition(
                        referenceInArea,
                        referenceInArea
                    );

                const candidatePosition =
                    getComparablePosition(
                        candidateInArea,
                        referenceInArea
                    );

                const travelDirection =
                    inferTravelDirection(referenceArea);

                const forwardStepCount =
                    getForwardStepCount(
                        referenceArea,
                        candidateInArea,
                        travelDirection
                    );

                if (
                    referencePosition !== null &&
                    candidatePosition !== null &&
                    travelDirection !== null &&
                    (
                        candidatePosition -
                        referencePosition
                    ) * travelDirection > 0 &&
                    (
                        forwardStepCount > 1 ||
                        connectsToLaterRoadSection(
                            candidateInArea
                        )
                    )
                ) {
                    excludedCandidates.push({
                        candidate,
                        reason:
                            connectsToLaterRoadSection(
                                candidateInArea
                            )
                                ? "次の道路セクションへの接続IC"
                                : "基準入口の直後1件より後方のIC"
                    });
                    return false;
                }
            }

            return true;
        });

    if (shutoEntranceIc) {
        const shutoIdentity =
            getIcIdentity(shutoEntranceIc);

        const shutoIndex =
            filteredCandidates.findIndex(candidate =>
                getIcIdentity(candidate.exit) === shutoIdentity
            );

        const referenceIndex =
            filteredCandidates.findIndex(candidate =>
                getIcIdentity(candidate.exit) ===
                    getIcIdentity(referenceIc)
            );

        if (
            shutoIndex >= 0 &&
            referenceIndex >= 0 &&
            shutoIndex !== referenceIndex - 1
        ) {
            const [shutoCandidate] =
                filteredCandidates.splice(shutoIndex, 1);

            const updatedReferenceIndex =
                filteredCandidates.findIndex(candidate =>
                    getIcIdentity(candidate.exit) ===
                        getIcIdentity(referenceIc)
                );

            filteredCandidates.splice(
                Math.max(0, updatedReferenceIndex),
                0,
                shutoCandidate
            );
        }
    }

    if (
        !entranceSectionFilterLoggedAnalyses.has(
            polylineAnalysis
        )
    ) {
        entranceSectionFilterLoggedAnalyses.add(
            polylineAnalysis
        );

        const formatNames = items =>
            items
                .map(item =>
                    item.exit.displayName +
                    (
                        isShutoIcForRouteAnalysis(item.exit)
                            ? " [首都高]"
                            : ""
                    )
                )
                .join(" → ") || "なし";

        console.group(
            "[ENTRANCE CANDIDATE SECTION FILTER]"
        );
        console.log(
            "基準入口IC:",
            referenceIc?.displayName || "なし"
        );
        console.log(
            "基準道路:",
            referenceArea
                ? IC_MASTER[referenceArea]?.label ||
                    referenceArea
                : "なし"
        );
        console.log(
            "Polyline首都高入口:",
            shutoEntranceIc?.displayName || "なし"
        );
        console.log(
            "除外前候補:",
            formatNames(beforeCandidates)
        );
        console.log(
            "除外後候補:",
            formatNames(filteredCandidates)
        );
        console.log(
            "除外候補:",
            excludedCandidates.length > 0
                ? excludedCandidates
                    .map(item =>
                        item.candidate.exit.displayName
                    )
                    .join(" → ")
                : "なし"
        );
        console.log(
            "除外理由:",
            excludedCandidates.length > 0
                ? excludedCandidates
                    .map(item =>
                        item.candidate.exit.displayName +
                        ": " + item.reason
                    )
                    .join(" / ")
                : "なし"
        );
        console.groupEnd();
    }

    return filteredCandidates;
}

// passedIcEntriesの元になるsampledPointsは出発地からの一般道区間も
// 含めてルート全体をカバーしており、findNearestIcMasterEntryForRoutePoint
// に距離上限が無いため、まだ高速に乗っていない地点でも機械的に最寄りIC
// （例：「入谷」等、実際には使っていないIC）を拾ってしまう（実車確認で
// 判明）。tollSections[0].entranceIc（TOLL TAG方式で確実に検出された、
// 実際の入口IC）がpassedIcEntries内で最初に現れる位置を特定し、
// それ以降のみを候補化の対象にするための起点特定関数。
// 特定できない場合（tollSectionsが使えない、該当ICがpassedIcEntries内に
// 見つからない等）は-1を返す。
function findEntranceStartIndexInPassedIcEntries(
    polylineAnalysis
) {

    const tollSections = polylineAnalysis?.tollSections;
    const passedIcEntries = polylineAnalysis?.passedIcEntries;

    if (
        !Array.isArray(tollSections) ||
        tollSections.length === 0 ||
        !tollSections[0]?.entranceIc ||
        !Array.isArray(passedIcEntries)
    ) {
        return -1;
    }

    const targetIdentity =
        buildIcDefinitionIdentity(
            tollSections[0].entranceIc
        );

    if (!targetIdentity) {
        return -1;
    }

    return passedIcEntries.findIndex(entry =>
        buildIcDefinitionIdentity(entry.exit) ===
            targetIdentity
    );
}

// findEntranceStartIndexInPassedIcEntriesで特定した「実際の入口IC以降」の
// passedIcEntriesを走査し、実ICエントリと「未確定インターチェンジ」
// マーカーが混在した完全なシーケンスを組み立てる。isWithinThreshold:false
// （最寄りICとの距離がIC_MASTER_NEAREST_THRESHOLD_METERSを超える、実際には
// 未確定の可能性が高い地点）は{isUnresolved:true, label, distanceMeters}の
// マーカーとして扱い、連続するマーカーは1件にまとめる。それ以外
// （isWithinThresholdがtrueまたは未定義）はentranceSelectable:falseの
// ものを除いて{isUnresolved:false, ic}として追加し、直前と同一IC
// （buildIcDefinitionIdentityで識別）であれば重複除去する。
// getOrBuildEntranceCandidateIcsFromPassedEntries（実際の候補選定用、
// マーカーを含まないICのみの配列）は、この関数の結果からisUnresolved:false
// のみを抽出して導出する（二重計算を避けるための共通の基礎データ）。
// 同一polylineAnalysisに対して複数回呼んでも再計算しないよう、結果を
// polylineAnalysis自身（_entranceIcSequenceWithUnresolvedMarkers）に
// キャッシュする。
function getOrBuildEntranceIcSequenceWithUnresolvedMarkers(
    polylineAnalysis
) {

    if (!polylineAnalysis) {
        return [];
    }

    if (
        Array.isArray(
            polylineAnalysis
                ._entranceIcSequenceWithUnresolvedMarkers
        )
    ) {
        return polylineAnalysis
            ._entranceIcSequenceWithUnresolvedMarkers;
    }

    const entranceStartIndex =
        findEntranceStartIndexInPassedIcEntries(
            polylineAnalysis
        );

    const passedIcEntries =
        polylineAnalysis.passedIcEntries;

    const sequence = [];

    if (
        entranceStartIndex >= 0 &&
        Array.isArray(passedIcEntries)
    ) {
        passedIcEntries
            .slice(entranceStartIndex)
            .forEach(entry => {

                const previous =
                    sequence[sequence.length - 1] || null;

                if (entry.isWithinThreshold === false) {
                    if (previous?.isUnresolved === true) {
                        return;
                    }

                    sequence.push({
                        isUnresolved: true,
                        label: "未確定インターチェンジあり",
                        distanceMeters: entry.distanceMeters
                    });

                    return;
                }

                const ic = entry.exit;

                if (!ic || ic.entranceSelectable === false) {
                    return;
                }

                if (
                    previous?.isUnresolved === false &&
                    buildIcDefinitionIdentity(previous.ic) ===
                        buildIcDefinitionIdentity(ic)
                ) {
                    return;
                }

                sequence.push({
                    isUnresolved: false,
                    ic
                });
            });
    }

    polylineAnalysis._entranceIcSequenceWithUnresolvedMarkers =
        sequence;

    return sequence;
}

// 【方針変更】tollSectionsは有料区間の境界（入口・出口）しか拾えず、
// 沿線上の中間IC（例：堤通〜三郷中央間の加平・八潮南）を候補にできないと
// 実車確認で判明したため、passedIcEntries（analyzeHighwayRoutePolyline
// が算出、Polyline全体を500m間隔でサンプリングし各点の最寄りICを求めた、
// 連続重複除去済みの通過IC列）ベースの候補リストに置き換える。
// ただし、passedIcEntriesの先頭側には出発地からの一般道走行中のノイズが
// 含まれるため、findEntranceStartIndexInPassedIcEntriesで特定した
// 「実際の入口IC以降」の部分配列のみを候補化する（開始位置が特定できない
// 場合は空配列を返し、呼び出し元のフォールバックに委ねる）。
// 最寄りICとの距離がIC_MASTER_NEAREST_THRESHOLD_METERSを超える
// （＝isWithinThreshold:false、実際には未確定の可能性が高い）地点は、
// getOrBuildEntranceIcSequenceWithUnresolvedMarkers側で「未確定
// インターチェンジ」マーカーとして扱われ、実ICとしては候補化されない。
// 同一polylineAnalysisに対して複数回呼んでも再計算しないよう、結果を
// polylineAnalysis自身（_entranceCandidateIcsFromPassedEntries）に
// キャッシュする。これにより、実際の候補選定（selectPolylineBased
// MultiIcCandidates）と検索条件パネルの「入口比較候補」表示
// （buildPolylineComparisonSummaryHtml）が、常に同じ計算結果を参照する。
// 件数制限（maxCount）はここでは行わない。呼び出し側でslice(0, maxCount)
// すること（表示側は件数制限なしでそのまま使う）。
function getOrBuildEntranceCandidateIcsFromPassedEntries(
    polylineAnalysis
) {

    if (!polylineAnalysis) {
        return [];
    }

    if (
        Array.isArray(
            polylineAnalysis
                ._entranceCandidateIcsFromPassedEntries
        )
    ) {
        return polylineAnalysis
            ._entranceCandidateIcsFromPassedEntries;
    }

    const dedupedIcs =
        getOrBuildEntranceIcSequenceWithUnresolvedMarkers(
            polylineAnalysis
        )
            .filter(entry => entry.isUnresolved === false)
            .map(entry => entry.ic);

    polylineAnalysis._entranceCandidateIcsFromPassedEntries =
        dedupedIcs;

    return dedupedIcs;
}

function buildPolylineBasedComparisonIcCandidates(
    polylineAnalysis
) {

    if (!polylineAnalysis) {
        return null;
    }

    const candidateAreas = [];

    (polylineAnalysis.roadSequence || []).forEach(roadLabel => {
        if (roadLabel === "首都高") {
            return;
        }

        const matchedArea =
            Object.keys(IC_MASTER).find(icArea =>
                icArea === roadLabel ||
                IC_MASTER[icArea]?.label === roadLabel
            );

        if (
            matchedArea &&
            !candidateAreas.includes(matchedArea)
        ) {
            candidateAreas.push(matchedArea);
        }
    });

    const getIcIdentity = exit =>
        exit?.googleName ||
        (
            exit
                ? exit.displayName + "|" + exit.lat + "|" + exit.lng
                : ""
        );

    const appendAreasContainingIc = referenceIc => {
        const referenceIdentity = getIcIdentity(referenceIc);

        if (!referenceIdentity) {
            return;
        }

        Object.keys(IC_MASTER).forEach(icArea => {
            const containsReference =
                IC_MASTER[icArea].exits.some(exit =>
                    getIcIdentity(exit) === referenceIdentity
                );

            if (
                containsReference &&
                !candidateAreas.includes(icArea)
            ) {
                candidateAreas.push(icArea);
            }
        });
    };

    if (candidateAreas.length === 0) {
        appendAreasContainingIc(
            polylineAnalysis.nexcoEntranceIc
        );
        appendAreasContainingIc(
            polylineAnalysis.nexcoExitIc
        );
    }

    const buildSurroundingCandidates = (
        referenceIc,
        surroundingCount
    ) => {
        const referenceIdentity = getIcIdentity(referenceIc);

        if (!referenceIdentity) {
            return [];
        }

        const candidates = [];
        const registeredIdentities = new Set();

        candidateAreas.forEach(icArea => {
            const exits =
                IC_MASTER[icArea].exits
                    .slice()
                    .sort((a, b) =>
                        (a.order ?? 999) - (b.order ?? 999)
                    )
                    .filter(exit =>
                        exit.isSelectable !== false &&
                        exit.isMirror !== true
                    );

            const referenceIndex =
                exits.findIndex(exit =>
                    getIcIdentity(exit) === referenceIdentity
                );

            if (referenceIndex < 0) {
                return;
            }

            exits
                .slice(
                    Math.max(
                        0,
                        referenceIndex - surroundingCount
                    ),
                    referenceIndex + surroundingCount + 1
                )
                .forEach(exit => {
                    const identity = getIcIdentity(exit);

                    if (registeredIdentities.has(identity)) {
                        return;
                    }

                    registeredIdentities.add(identity);
                    candidates.push({
                        icArea,
                        exit,
                        isShuto:
                            isShutoIcForRouteAnalysis(exit)
                    });
                });
        });

        return candidates;
    };

    const unfilteredEntranceCandidateIcs =
        buildSurroundingCandidates(
            polylineAnalysis.nexcoEntranceIc,
            2
        );

    const entranceCandidateIcs =
        filterEntranceCandidatesByRouteSection({
            polylineAnalysis,
            candidates: unfilteredEntranceCandidateIcs,
            candidateAreas,
            getIcIdentity
        });

    const forwardExitSelection =
        buildForwardExitComparisonIcCandidates(
            polylineAnalysis,
            getIcIdentity,
            candidateAreas
        );

    const exitCandidateIcs =
        forwardExitSelection.candidates;

    let reason =
        "入口はPolyline解析NEXCO入口周辺、" +
        "出口は現在地基準より先のPolyline通過順で抽出";

    if (candidateAreas.length > 1) {
        reason =
            "複数道路のため暫定候補：" + reason;
    }
    else if (candidateAreas.length === 0) {
        reason =
            entranceCandidateIcs.length > 0
                ? "NEXCO道路エリアなし（首都高候補のみで抽出）"
                : "Polyline道路エリアを特定できないため候補なし";
    }
    else if (entranceCandidateIcs.length === 0) {
        reason =
            "NEXCO入口基準ICがIC_MASTER内で" +
            "見つからないため入口候補なし";
    }
    else if (exitCandidateIcs.length === 0) {
        reason =
            "現在地基準より先に選択可能な" +
            "Polyline出口候補なし";
    }

    return {
        candidateAreas,
        entranceCandidateIcs,
        exitCandidateIcs,
        exitCandidateBaseDistanceMeters:
            forwardExitSelection.baseDistanceMeters,
        excludedExitCandidateIcs:
            forwardExitSelection.excludedCandidates,
        reason
    };
}

function buildForwardExitComparisonIcCandidates(
    polylineAnalysis,
    getIcIdentity,
    candidateAreas
) {

    const routeTrace =
        polylineAnalysis?.routeTrace || [];

    // Routes API のPolylineはorigin（現在地/出発地）から始まり、
    // sampledPoints[0]はその先頭をrouteDistanceMeters: 0で保持する。
    // IC検出結果であるrouteTraceではなく、このoriginサンプルを
    // 出口比較の現在地基準として使う。
    const baseDistanceMeters =
        polylineAnalysis?.sampledPoints?.[0]
            ?.routeDistanceMeters ??
        routeTrace[0]?.routeDistanceMeters ??
        0;

    const maxPolylineDistanceMeters = 5000;
    const candidatesByIdentity = new Map();

    const normalExitIdentities = new Set(
        [
            polylineAnalysis?.nexcoExitIc,
            polylineAnalysis?.exitIc
        ]
            .map(exit => getIcIdentity(exit))
            .filter(Boolean)
    );

    const entranceExclusionReasons = new Map();

    const registerEntranceExclusion = (
        exit,
        reason
    ) => {
        const identity = getIcIdentity(exit);

        if (
            !identity ||
            normalExitIdentities.has(identity) ||
            entranceExclusionReasons.has(identity)
        ) {
            return;
        }

        entranceExclusionReasons.set(identity, reason);
    };

    registerEntranceExclusion(
        polylineAnalysis?.shutoEntranceIc,
        "首都高入口ICのため出口比較から除外"
    );
    registerEntranceExclusion(
        polylineAnalysis?.nexcoEntranceIc,
        "NEXCO入口ICのため出口比較から除外"
    );
    registerEntranceExclusion(
        polylineAnalysis?.entranceIc,
        "入口側ICのため出口比較から除外"
    );

    routeTrace.forEach(routePoint => {
        const exit =
            resolveEffectiveNexcoExit(
                resolveEffectiveShutoExit(
                    routePoint.exit,
                    polylineAnalysis,
                    getIcIdentity
                ),
                polylineAnalysis,
                getIcIdentity
            );
        const identity = getIcIdentity(exit);

        const exitLat = exit?.exitLat ?? exit?.lat;
        const exitLng = exit?.exitLng ?? exit?.lng;

        if (
            !identity ||
            exitLat === undefined ||
            exitLng === undefined ||
            !Number.isFinite(routePoint.routeDistanceMeters)
        ) {
            return;
        }

        const polylineDistanceMeters =
            calculateDistance(
                routePoint.lat,
                routePoint.lng,
                exitLat,
                exitLng
            );

        const existing =
            candidatesByIdentity.get(identity);

        if (
            existing &&
            existing.polylineDistanceMeters <=
                polylineDistanceMeters
        ) {
            return;
        }

        candidatesByIdentity.set(identity, {
            icArea: routePoint.icArea,
            exit,
            isShuto:
                isShutoIcForRouteAnalysis(exit),
            routeDistanceMeters:
                routePoint.routeDistanceMeters,
            distanceFromBaseMeters:
                routePoint.routeDistanceMeters -
                baseDistanceMeters,
            polylineDistanceMeters
        });
    });

    const candidates = [];
    const excludedCandidates = [];

    [...candidatesByIdentity.values()]
        .sort((a, b) =>
            a.routeDistanceMeters - b.routeDistanceMeters
        )
        .forEach(candidate => {
            const exit = candidate.exit;
            const identity = getIcIdentity(exit);
            let exclusionReason = "";

            const isConnectionJunction =
                exit.connection === true &&
                /JCT|ジャンクション/i.test(
                    exit.displayName || exit.googleName || ""
                );

            if (exit.isSelectable === false) {
                exclusionReason =
                    "isSelectable:false（選択不可IC/JCT）";
            }
            else if (exit.exitSelectable === false) {
                exclusionReason =
                    "exitSelectable:false（出口不可）";
            }
            else if (isConnectionJunction) {
                exclusionReason = "接続用JCT";
            }
            else if (
                Array.isArray(candidateAreas) &&
                candidateAreas.length > 0 &&
                !candidate.isShuto &&
                !candidateAreas.includes(candidate.icArea)
            ) {
                // 複合JCT付近（例：三郷JCT＝外環×常磐道、市川南IC等）で、
                // 実際には走行していない別道路のICが最近傍として誤って
                // routeTraceに混入するケースへの対策。candidateAreasは
                // 実際に走行した道路から構築されているため、そこに含まれない
                // エリアのIC（首都高を除く）は出口比較候補から除外する。
                // candidateAreasが空（NEXCO道路エリアを特定できないルート）
                // の場合は、安全側としてこの条件を発動させない。
                exclusionReason =
                    "candidateAreas外のエリアのため除外" +
                    "（複合JCT付近での誤最近傍IC対策）";
            }
            else if (entranceExclusionReasons.has(identity)) {
                exclusionReason =
                    entranceExclusionReasons.get(identity);
            }
            else if (candidate.distanceFromBaseMeters <= 0) {
                exclusionReason = "現在地基準地点以前";
            }
            else if (
                candidate.polylineDistanceMeters >
                    maxPolylineDistanceMeters
            ) {
                exclusionReason =
                    "高速ルートPolylineから5km超";
            }

            if (exclusionReason) {
                excludedCandidates.push({
                    ...candidate,
                    reason: exclusionReason
                });
                return;
            }

            candidates.push(candidate);
        });

    return {
        baseDistanceMeters,
        candidates,
        excludedCandidates
    };
}

function selectForwardComparisonIcCandidates(
    candidates,
    maxCount
) {

    if (!Array.isArray(candidates) || maxCount <= 0) {
        return [];
    }

    return candidates
        .filter(candidate =>
            candidate?.exit &&
            candidate.exit.isSelectable !== false
        )
        .slice()
        .sort((a, b) =>
            a.routeDistanceMeters - b.routeDistanceMeters
        )
        .slice(0, maxCount);
}

function selectLimitedComparisonIcCandidates(
    candidates,
    referenceIc,
    maxCount
) {

    if (!Array.isArray(candidates) || maxCount <= 0) {
        return [];
    }

    // NEXCO側の基準IC（referenceIc）が無いルート（首都高のみで完結する
    // ルート等）でも、首都高候補が1件でもあればそれだけで処理を続行する。
    const hasShutoCandidateWithoutReference =
        !referenceIc &&
        candidates.some(candidate =>
            candidate?.exit &&
            isShutoIcForRouteAnalysis(candidate.exit)
        );

    if (!referenceIc && !hasShutoCandidateWithoutReference) {
        return [];
    }

    if (
        referenceIc &&
        (
            referenceIc.isSelectable === false ||
            referenceIc.entranceSelectable === false
        )
    ) {
        return [];
    }

    const getIcIdentity = exit =>
        exit?.googleName ||
        (
            exit
                ? exit.displayName + "|" + exit.lat + "|" + exit.lng
                : ""
        );

    const uniqueCandidates = [];
    const registeredIdentities = new Set();

    candidates.forEach(candidate => {
        if (
            !candidate?.exit ||
            candidate.exit.isSelectable === false ||
            candidate.exit.entranceSelectable === false
        ) {
            return;
        }

        const identity = getIcIdentity(candidate.exit);

        if (
            !identity ||
            registeredIdentities.has(identity)
        ) {
            return;
        }

        registeredIdentities.add(identity);
        uniqueCandidates.push(candidate);
    });

    const shutoCandidates =
        uniqueCandidates
            .filter(candidate =>
                isShutoIcForRouteAnalysis(candidate.exit)
            )
            .slice()
            .sort((a, b) => {
                if (
                    Boolean(a.isPrimaryShutoEntrance) !==
                    Boolean(b.isPrimaryShutoEntrance)
                ) {
                    return a.isPrimaryShutoEntrance ? -1 : 1;
                }

                return (
                    a.routeDistanceMeters ?? Infinity
                ) -
                (
                    b.routeDistanceMeters ?? Infinity
                );
            });

    const nonShutoCandidates =
        uniqueCandidates.filter(candidate =>
            !isShutoIcForRouteAnalysis(candidate.exit)
        );

    const selectAroundReference = count => {
        if (count <= 0 || !referenceIc) {
            return [];
        }

        const candidatesAroundReference =
            nonShutoCandidates.slice();

        const referenceIdentity =
            getIcIdentity(referenceIc);

        let referenceIndex =
            candidatesAroundReference.findIndex(candidate =>
                getIcIdentity(candidate.exit) ===
                    referenceIdentity
            );

        if (referenceIndex < 0) {
            candidatesAroundReference.unshift({
                icArea: null,
                exit: referenceIc,
                isShuto: false
            });
            referenceIndex = 0;
        }

        const limitedCount =
            Math.min(count, candidatesAroundReference.length);

        let startIndex =
            referenceIndex - Math.floor(limitedCount / 2);

        startIndex = Math.max(0, startIndex);

        if (
            startIndex + limitedCount >
            candidatesAroundReference.length
        ) {
            startIndex = Math.max(
                0,
                candidatesAroundReference.length - limitedCount
            );
        }

        return candidatesAroundReference.slice(
            startIndex,
            startIndex + limitedCount
        );
    };

    // referenceIc（NEXCO側の基準IC）が無い場合は非首都高候補を
    // 探しようがないため、首都高候補だけでmaxCountまで埋める。
    const reservedNonShutoCount =
        !referenceIc
            ? 0
            : maxCount >= 5 ? 2 : 1;

    const shutoLimit = Math.max(
        0,
        maxCount - reservedNonShutoCount
    );

    const selectedShutoCandidates =
        shutoCandidates.slice(0, shutoLimit);

    const selectedNonShutoCandidates =
        selectAroundReference(
            maxCount - selectedShutoCandidates.length
        );

    const selectedCandidates = [
        ...selectedShutoCandidates,
        ...selectedNonShutoCandidates
    ];

    if (selectedCandidates.length < maxCount) {
        const selectedIdentities = new Set(
            selectedCandidates.map(candidate =>
                getIcIdentity(candidate.exit)
            )
        );

        uniqueCandidates.forEach(candidate => {
            const identity = getIcIdentity(candidate.exit);

            if (
                selectedCandidates.length >= maxCount ||
                selectedIdentities.has(identity)
            ) {
                return;
            }

            selectedIdentities.add(identity);
            selectedCandidates.push(candidate);
        });
    }

    return selectedCandidates;
}

function selectPolylineBasedMultiIcCandidates({
    mode,
    legacySelectedExits,
    origin,
    destination
}) {

    const apiCandidateLimit =
        getActiveIcCandidateCount();

    const currentRouteAnalysisKey =
        buildRouteAnalysisKey(origin, destination);

    const hasPolylineAnalysis =
        Boolean(lastHighwayRoutePolylineAnalysis);

    const analysisKeyMatches =
        hasPolylineAnalysis &&
        lastHighwayRoutePolylineAnalysisKey ===
            currentRouteAnalysisKey;

    const candidateProperty =
        mode === "entrance"
            ? "entranceCandidateIcs"
            : "exitCandidateIcs";

    const referenceProperty =
        mode === "entrance"
            ? "nexcoEntranceIc"
            : "nexcoExitIc";

    const nexcoMissingReason =
        mode === "entrance"
            ? "NEXCO入口ICなし"
            : "NEXCO出口ICなし";

    // 【Step 2・無効化】tollSectionsは有料区間の入口・出口の境界しか
    // 拾えず、沿線上の中間IC（例：堤通〜三郷中央間の加平・八潮南）を
    // 候補にできないと実車確認で判明したため、末尾の`&& false`で
    // 無効化した（常にfalseになりこの分岐は使われない）。
    // selectEntranceCandidatesFromTollSectionSequence・
    // buildTollSectionBasedIcSequenceの関数定義自体は、将来の基準IC
    // 特定等での再利用に備えて削除せず残している。
    // 実際の候補選定は、以降のpassedIcEntriesベースの新方式に置き換えた。
    const hasTollSectionSequenceData =
        mode === "entrance" &&
        analysisKeyMatches &&
        lastHighwayRoutePolylineAnalysis
            ?.hasTollSectionStepsData === true &&
        Array.isArray(
            lastHighwayRoutePolylineAnalysis?.tollSections
        ) &&
        false;

    const tollSectionEntranceCandidates =
        hasTollSectionSequenceData
            ? selectEntranceCandidatesFromTollSectionSequence(
                lastHighwayRoutePolylineAnalysis.tollSections,
                apiCandidateLimit
            )
            : [];

    // passedIcEntriesベースの入口比較候補（沿線中間ICを含む）。
    // getOrBuildEntranceCandidateIcsFromPassedEntriesはpolylineAnalysis
    // 自身に結果をキャッシュするため、検索条件パネルの表示
    // （buildPolylineComparisonSummaryHtml）が同じpolylineAnalysisに対して
    // 呼んでも再計算されず、候補選定・表示の内容は常に一致する。
    const hasPassedEntriesSequenceData =
        mode === "entrance" &&
        analysisKeyMatches &&
        Array.isArray(
            lastHighwayRoutePolylineAnalysis?.passedIcEntries
        ) &&
        lastHighwayRoutePolylineAnalysis.passedIcEntries.length > 0;

    const passedEntriesEntranceCandidates =
        hasPassedEntriesSequenceData
            ? getOrBuildEntranceCandidateIcsFromPassedEntries(
                lastHighwayRoutePolylineAnalysis
            ).slice(0, apiCandidateLimit)
            : [];

    let polylineApiCandidates = [];
    let polylineCandidatePreview = null;

    if (analysisKeyMatches) {
        polylineCandidatePreview =
            buildPolylineBasedComparisonIcCandidates(
                lastHighwayRoutePolylineAnalysis
            );

        polylineApiCandidates =
            mode === "entrance"
                ? selectLimitedComparisonIcCandidates(
                    polylineCandidatePreview
                        ?.[candidateProperty] || [],
                    lastHighwayRoutePolylineAnalysis
                        [referenceProperty],
                    apiCandidateLimit
                )
                : selectForwardComparisonIcCandidates(
                    polylineCandidatePreview
                        ?.exitCandidateIcs || [],
                    apiCandidateLimit
                );
    }

    let selectedExits = [];
    let candidateSelectionLogic = "候補なし";
    let fallbackReason = "なし";

    if (
        hasPassedEntriesSequenceData &&
        passedEntriesEntranceCandidates.length > 0
    ) {
        selectedExits = passedEntriesEntranceCandidates;
        candidateSelectionLogic = "Polyline通過IC列（passedIcEntries）候補";
    }
    else if (
        hasTollSectionSequenceData &&
        tollSectionEntranceCandidates.length > 0
    ) {
        selectedExits = tollSectionEntranceCandidates;
        candidateSelectionLogic = "TOLL TAG通過ICシーケンス候補";
    }
    else if (polylineApiCandidates.length > 0) {
        selectedExits =
            polylineApiCandidates.map(candidate =>
                candidate.exit
            );
        candidateSelectionLogic =
            mode === "entrance"
                ? "Polyline解析候補"
                : "Polyline現在地以降・進行方向順候補";
    }
    else {
        if (!hasPolylineAnalysis) {
            fallbackReason = "Polyline解析結果なし";
        }
        else if (!analysisKeyMatches) {
            fallbackReason =
                "Polyline解析結果が現在の出発地・目的地と不一致";
        }
        else if (
            mode === "entrance" &&
            !lastHighwayRoutePolylineAnalysis[referenceProperty]
        ) {
            fallbackReason = nexcoMissingReason;
        }
        else {
            fallbackReason = "Polyline解析候補なし";
        }

        if (legacySelectedExits.length > 0) {
            selectedExits = legacySelectedExits;
            candidateSelectionLogic = "既存ロジック候補";
        }
    }

    const candidateNames =
        selectedExits
            .map(exit =>
                exit.displayName +
                (
                    isShutoIcForRouteAnalysis(exit)
                        ? " [首都高]"
                        : ""
                )
            )
            .join(" → ");

    return {
        selectedExits,
        candidateSelectionLogic,
        fallbackReason,
        apiCandidateLimit,
        candidateNames,
        apiCallCount: selectedExits.length,
        analysisKeyMatches,
        savedRouteAnalysisKey:
            lastHighwayRoutePolylineAnalysisKey,
        currentRouteAnalysisKey,
        exitCandidateBaseDistanceMeters:
            polylineCandidatePreview
                ?.exitCandidateBaseDistanceMeters ?? null,
        excludedExitCandidateIcs:
            polylineCandidatePreview
                ?.excludedExitCandidateIcs || []
    };
}

function logMultiIcCandidateSelection(mode, selection) {

    const isEntrance = mode === "entrance";

    console.group(
        isEntrance
            ? "[ENTRANCE COMPARISON CANDIDATES]"
            : "[EXIT CANDIDATE SELECTION]"
    );
    if (!isEntrance) {
        console.log("出口比較モード: この先IC比較");
        console.log(
            "現在地基準距離:",
            selection.exitCandidateBaseDistanceMeters === null
                ? "なし"
                : Math.round(
                    selection.exitCandidateBaseDistanceMeters /
                    100
                ) / 10 + "km"
        );
        console.log(
            "候補IC:",
            selection.candidateNames || "なし"
        );
        console.log(
            "除外IC:",
            selection.excludedExitCandidateIcs.length > 0
                ? selection.excludedExitCandidateIcs
                    .map(candidate =>
                        candidate.exit.displayName
                    )
                    .join(" → ")
                : "なし"
        );
        console.log(
            "理由:",
            selection.excludedExitCandidateIcs.length > 0
                ? selection.excludedExitCandidateIcs
                    .map(candidate =>
                        candidate.exit.displayName +
                        ": " + candidate.reason
                    )
                    .join(" / ")
                : "除外なし"
        );
    }
    console.log(
        "候補選定ロジック:",
        selection.candidateSelectionLogic
    );
    console.log(
        "解析キー一致:",
        selection.analysisKeyMatches
    );

    if (
        DEBUG_ROUTE_VERBOSE &&
        !selection.analysisKeyMatches
    ) {
        console.log(
            "保存済み解析キー:",
            selection.savedRouteAnalysisKey || "なし"
        );
        console.log(
            "現在の検索キー:",
            selection.currentRouteAnalysisKey
        );
    }

    console.log(
        "API候補上限:",
        selection.apiCandidateLimit
    );
    console.log(
        "実車テストモード:",
        isRealDriveTestMode ? "ON" : "OFF"
    );
    console.log(
        isEntrance
            ? "API実行入口候補IC:"
            : "API実行出口候補IC:",
        selection.candidateNames || "なし"
    );
    console.log(
        "API呼び出し予定件数:",
        selection.apiCallCount
    );
    console.log(
        "フォールバック理由:",
        selection.fallbackReason
    );
    console.groupEnd();
}

function logHighwayRoutePolylineAnalysis(
    highwayRoute,
    origin,
    destination,
    analysis = null,
    tollEstimate = null,
    resetComparisonResults = true
) {

    const result =
        analysis ||
        analyzeHighwayRoutePolyline(highwayRoute);

    if (!result) {
        if (resetComparisonResults) {
            clearDestinationTestSummary(
                "Polyline解析結果なし"
            );
        }
        return;
    }

    const {
        roadSequence,
        roadDistances: roadDistanceLogs,
        entranceIc: entranceCandidate,
        exitIc: exitCandidate,
        nexcoEntranceIc = null,
        nexcoExitIc = null,
        shutoEntranceIc = null,
        shutoExitIc = null,
        shutoSegments = [],
        shutoEntryCount = 0,
        shutoSegmentDiagnostics = [],
        shutoDetail = {
            startSampleCount: 0,
            endSampleCount: 0,
            entranceSampleCount: 0,
            entranceWindowStartDistanceMeters: null,
            entranceWindowEndDistanceMeters: null,
            exitSampleCount: 0,
            exitWindowStartDistanceMeters: null,
            exitWindowEndDistanceMeters: null,
            entranceCandidates: [],
            exitCandidates: []
        },
        roadSwitches,
        rawRoadSequence = roadSequence,
        rawRoadDistances = roadDistanceLogs,
        rawRoadSwitches = roadSwitches,
        routePoints,
        sampledPoints,
        areaCounts,
        routePointLogs,
        routeTrace,
        isolatedRoadTraceNoise = [],
        passedIcEntries
    } = result;

    const comparisonCandidatePreview =
        buildPolylineBasedComparisonIcCandidates(result);

    const comparisonApiCandidateLimit =
        getActiveIcCandidateCount();

    const entranceApiCandidateIcs =
        selectLimitedComparisonIcCandidates(
            comparisonCandidatePreview
                ?.entranceCandidateIcs || [],
            nexcoEntranceIc,
            comparisonApiCandidateLimit
        );

    const exitApiCandidateIcs =
        selectForwardComparisonIcCandidates(
            comparisonCandidatePreview
                ?.exitCandidateIcs || [],
            comparisonApiCandidateLimit
        );

    saveDestinationTestRouteSummary({
        origin,
        destination,
        analysis: result,
        comparisonCandidatePreview,
        entranceApiCandidateIcs,
        exitApiCandidateIcs,
        apiCandidateLimit:
            comparisonApiCandidateLimit,
        resetComparisonResults
    });

    try {

        // 【検証用・一時的】Google Routes APIのlegs.steps.navigationInstruction
        // （maneuver/instructions）とdistanceMetersが、実用に耐えるデータか
        // どうかを目視確認するためだけのログ。shutoSegments・料金計算・
        // 表示等の判定ロジックには一切使用していない。有効と判断されなければ
        // 元に戻す。
        console.group("[STEPS検証・一時的]");

        const highwaySteps =
            (highwayRoute?.legs || []).flatMap(
                (leg, legIndex) =>
                    (leg.steps || []).map(
                        (step, stepIndex) => ({
                            legIndex,
                            stepIndex,
                            maneuver:
                                step.navigationInstruction
                                    ?.maneuver || "なし",
                            instructions:
                                step.navigationInstruction
                                    ?.instructions || "なし",
                            distanceMeters:
                                step.distanceMeters ?? "-"
                        })
                    )
            );

        console.log("steps件数:", highwaySteps.length);
        console.table(highwaySteps);

        console.groupEnd();

        // 【検証用・一時的】「有料区間」タグベースの区間検出（座標ベース
        // 方式とは独立）。判定ロジックには一切使用していない。有効と
        // 判断されなければ元に戻す。
        console.group("[TOLL TAG検証・一時的]");

        const tollTagResult =
            detectTollSectionsFromSteps(highwayRoute);

        console.log(
            "新方式（TOLL TAG）区間数（tollEntryCount）:",
            tollTagResult.tollEntryCount
        );

        console.log("新方式 検出区間一覧:");
        console.table(
            tollTagResult.tollSections.map(section => ({
                entranceIc: section.entranceIcName,
                entranceDistanceM:
                    section.entranceDistanceMeters === null
                        ? "-"
                        : Math.round(
                            section.entranceDistanceMeters
                        ),
                exitIc: section.exitIcName,
                exitDistanceM:
                    section.exitDistanceMeters === null
                        ? "-"
                        : Math.round(
                            section.exitDistanceMeters
                        ),
                stepCount: section.stepCount
            }))
        );

        if (tollTagResult.tollSections.length > 0) {
            console.log(
                "先頭区間のstartLocation生データ（レスポンス構造確認用）:",
                tollTagResult.tollSections[0]
                    .rawFirstStartLocation
            );
            console.log(
                "先頭区間のendLocation生データ（レスポンス構造確認用）:",
                tollTagResult.tollSections[0]
                    .rawLastEndLocation
            );
        }

        console.log(
            "--- 座標ベース方式（既存）との比較 ---"
        );
        console.log(
            "旧方式 shutoEntryCount:",
            shutoEntryCount,
            " / shutoEntranceIc:",
            shutoEntranceIc?.displayName || "なし",
            " / shutoExitIc:",
            shutoExitIc?.displayName || "なし"
        );
        console.log(
            "旧方式 nexcoEntranceIc:",
            nexcoEntranceIc?.displayName || "なし",
            " / nexcoExitIc:",
            nexcoExitIc?.displayName || "なし"
        );
        console.log(
            "新方式 tollEntryCount:",
            tollTagResult.tollEntryCount
        );

        if (
            tollTagResult.tollEntryCount !== shutoEntryCount
        ) {
            console.warn(
                "新旧方式で区間数が一致していません" +
                "（旧shutoEntryCount=" + shutoEntryCount +
                " / 新tollEntryCount=" +
                tollTagResult.tollEntryCount + "）。"
            );
        }

        console.groupEnd();

        console.group(
            "[ROUTE POLYLINE調査] " +
            origin + " → " + destination
        );

        if (DEBUG_ROUTE_VERBOSE) {
            console.log(
                "デコード点数:",
                routePoints.length,
                "サンプル点数:",
                sampledPoints.length
            );

            routePointLogs.forEach(item => {
                console.log(
                    "RoutePoint " + item.routePoint +
                    "\n→ " + item.nearestIc +
                    "\n距離 " + item.distanceKm + "km"
                );
            });

            console.table(routePointLogs);

            console.table(
                Object.entries(areaCounts).map(
                    ([icArea, pointCount]) => ({
                        icArea,
                        pointCount
                    })
                )
            );

            console.log(
                "通過IC順:",
                passedIcEntries
                    .map(item => item.exit.displayName)
                    .join(" → ")
            );
        }

        const formatShutoCandidatesForLog = candidates =>
            candidates.map(candidate => ({
                ic: candidate.exit.displayName,
                score:
                    Math.round(candidate.score * 10) / 10,
                count: candidate.count,
                minDistanceKm:
                    Math.round(
                        candidate.minDistanceMeters / 100
                    ) / 10,
                averageDistanceKm:
                    Math.round(
                        candidate.averageDistanceMeters / 100
                    ) / 10,
                lastRouteDistanceKm:
                    Math.round(
                        candidate.lastRouteDistanceMeters / 100
                    ) / 10
            }));

        const formatRouteDistanceKm = distanceMeters =>
            (
                distanceMeters === null ||
                distanceMeters === undefined
            )
                ? "なし"
                : Math.round(distanceMeters / 100) / 10;

        console.group("[ROUTE SHUTO DETAIL]");

        console.log(
            "先頭詳細サンプル数:",
            shutoDetail.startSampleCount
        );
        console.log(
            "末尾詳細サンプル数:",
            shutoDetail.endSampleCount
        );

        console.log(
            "入口判定サンプル数:",
            shutoDetail.entranceSampleCount
        );
        console.log(
            "入口判定ウィンドウ開始距離km:",
            formatRouteDistanceKm(
                shutoDetail
                    .entranceWindowStartDistanceMeters
            )
        );
        console.log(
            "入口判定ウィンドウ終了距離km:",
            formatRouteDistanceKm(
                shutoDetail
                    .entranceWindowEndDistanceMeters
            )
        );

        console.log("首都高入口候補:");
        console.table(
            formatShutoCandidatesForLog(
                shutoDetail.entranceCandidates
            )
        );

        console.log(
            "選定首都高入口:",
            shutoEntranceIc?.displayName || "なし"
        );

        console.log(
            "出口判定サンプル数:",
            shutoDetail.exitSampleCount
        );
        console.log(
            "出口判定ウィンドウ開始距離km:",
            formatRouteDistanceKm(
                shutoDetail.exitWindowStartDistanceMeters
            )
        );
        console.log(
            "出口判定ウィンドウ終了距離km:",
            formatRouteDistanceKm(
                shutoDetail.exitWindowEndDistanceMeters
            )
        );

        console.log("首都高出口候補:");
        console.table(
            formatShutoCandidatesForLog(
                shutoDetail.exitCandidates
            )
        );

        console.log(
            "選定首都高出口:",
            shutoExitIc?.displayName || "なし"
        );

        console.groupEnd();

        console.group("[ROUTE SHUTO SEGMENTS]");

        console.log(
            "旧方式（shutoEntranceIc/shutoExitIc）:",
            "入口=" +
                (shutoEntranceIc?.displayName || "なし") +
                " / 出口=" +
                (shutoExitIc?.displayName || "なし")
        );

        console.log(
            "新方式（shutoSegments）区間数（shutoEntryCount）:",
            shutoEntryCount
        );

        if (
            shutoEntryCount === 0 &&
            (shutoEntranceIc || shutoExitIc)
        ) {
            console.warn(
                "旧方式は首都高利用を検出していますが、" +
                "新方式（shutoSegments）は0件です" +
                "（新方式による棄却＝偽陰性の可能性）。"
            );
        }

        console.log("新方式 採用区間（shutoSegments）:");
        console.table(
            shutoSegments.map(segment => ({
                entranceIc:
                    segment.entranceIc?.displayName || "なし",
                exitIc:
                    segment.exitIc?.displayName || "なし",
                confidenceLevel: segment.confidenceLevel,
                startTraceIndex: segment.startTraceIndex,
                endTraceIndex: segment.endTraceIndex
            }))
        );

        const rejectedShutoSegments =
            shutoSegmentDiagnostics.filter(
                diagnostic => !diagnostic.accepted
            );

        console.log(
            "新方式 棄却区間数:",
            rejectedShutoSegments.length
        );
        console.table(
            rejectedShutoSegments.map(diagnostic => ({
                startTraceIndex: diagnostic.startTraceIndex,
                endTraceIndex: diagnostic.endTraceIndex,
                rejectionReason: diagnostic.rejectionReason
            }))
        );

        // 棄却区間ごとの、逆行・裏付けなしが発生した各箇所の詳細
        // （区間をまたいで一覧化するため、どの区間のものかが分かるよう
        // segmentStartTraceIndex/segmentEndTraceIndexを併記する）。
        const shutoSegmentViolationDetails =
            rejectedShutoSegments.flatMap(diagnostic =>
                (diagnostic.violationDetails || []).map(
                    detail => ({
                        segmentStartTraceIndex:
                            diagnostic.startTraceIndex,
                        segmentEndTraceIndex:
                            diagnostic.endTraceIndex,
                        type: detail.type,
                        traceIndex: detail.traceIndex,
                        previousIcName: detail.previousIcName,
                        currentIcName: detail.currentIcName,
                        previousIdentity: detail.previousIdentity,
                        currentIdentity: detail.currentIdentity,
                        previousOrder:
                            detail.previousOrder ?? "-",
                        currentOrder:
                            detail.currentOrder ?? "-",
                        boundaryExitName:
                            detail.boundaryExitName ?? "-",
                        reason: detail.reason
                    })
                )
            );

        console.log(
            "棄却区間の逆行・裏付けなし箇所の詳細:"
        );
        console.table(shutoSegmentViolationDetails);

        console.groupEnd();

        console.group("[ROUTE TOLL IC DETAIL]");

        console.log(
            "通過IC順:",
            passedIcEntries
                .map(item => item.exit.displayName)
                .join(" → ")
        );
        console.log(
            "料金計算用NEXCO入口:",
            nexcoEntranceIc?.displayName || "なし"
        );
        console.log(
            "料金計算用NEXCO出口:",
            nexcoExitIc?.displayName || "なし"
        );
        console.log(
            "首都高入口:",
            shutoEntranceIc?.displayName || "なし"
        );
        console.log(
            "首都高出口:",
            shutoExitIc?.displayName || "なし"
        );
        console.log(
            "現在のentranceIc:",
            entranceCandidate?.displayName || "なし"
        );
        console.log(
            "現在のexitIc:",
            exitCandidate?.displayName || "なし"
        );

        const gaikanPassedIcEntry =
            passedIcEntries.find(item =>
                item.icArea === "gaikan"
            );

        if (gaikanPassedIcEntry) {
            const gaikanTravelDirection =
                inferTravelDirectionForIcArea(
                    "gaikan",
                    gaikanPassedIcEntry.exit,
                    passedIcEntries,
                    buildIcDefinitionIdentity
                );

            console.log(
                "外環方向判定：",
                gaikanTravelDirection === 1
                    ? "外回り"
                    : gaikanTravelDirection === -1
                        ? "内回り"
                        : "判定不能"
            );
        }

        // gaikanと同様の試験ログをC1/C2にも追加。
        // shutoC1Uchimawari/shutoC2Uchimawariのorderが
        // SHUTO_IC_MASTER本体側orderの負数であるため、
        // 「並び順どおり」＝SHUTO_IC_MASTER側order昇順方向、
        // 「並び順の逆」＝ミラー（shutoC1Uchimawari/shutoC2Uchimawari）側を意味する。
        // 実際の内回り/外回りとの対応は路線ごとに未確認のため、ここでは断定しない。
        ["C1", "C2"].forEach(routeCode => {
            const shutoLoopPassedIcEntry =
                passedIcEntries.find(item =>
                    item.icArea === "shuto" &&
                    item.exit?.routeCode === routeCode
                );

            if (!shutoLoopPassedIcEntry) {
                return;
            }

            const shutoLoopTravelDirection =
                inferTravelDirectionForIcArea(
                    routeCode,
                    shutoLoopPassedIcEntry.exit,
                    passedIcEntries,
                    buildIcDefinitionIdentity
                );

            console.log(
                routeCode + "方向判定：",
                shutoLoopTravelDirection === 1
                    ? "並び順どおり"
                    : shutoLoopTravelDirection === -1
                        ? "並び順の逆（ミラー側）"
                        : "判定不能"
            );
        });

        // 線形路線（上り/下り）10路線向けの試験ログ。
        // routeCode:"6"が6号向島線・6号三郷線の2路線で重複しているため、
        // ここではrouteCodeではなくrouteNameで該当passedIcEntryを探す
        // （inferTravelDirectionForIcAreaのSHUTO_IC_MASTERフォールバックは
        // routeCode/routeNameのいずれの一致でも動作するよう対応済み）。
        // 実際の上り/下りとの対応は路線ごとに未確認のため、ここでは断定しない。
        [
            "首都高速6号向島線",
            "首都高速6号三郷線",
            "首都高速7号小松川線",
            "首都高速1号上野線",
            "首都高速4号新宿線",
            "首都高速5号池袋線",
            "首都高速3号渋谷線",
            "首都高速2号目黒線",
            "首都高速湾岸線",
            "首都高速川口線"
        ].forEach(routeName => {
            const shutoLinearPassedIcEntry =
                passedIcEntries.find(item =>
                    item.icArea === "shuto" &&
                    item.exit?.routeName === routeName
                );

            if (!shutoLinearPassedIcEntry) {
                return;
            }

            const shutoLinearTravelDirection =
                inferTravelDirectionForIcArea(
                    routeName,
                    shutoLinearPassedIcEntry.exit,
                    passedIcEntries,
                    buildIcDefinitionIdentity
                );

            console.log(
                routeName + "方向判定：",
                shutoLinearTravelDirection === 1
                    ? "並び順どおり"
                    : shutoLinearTravelDirection === -1
                        ? "並び順の逆（ミラー側）"
                        : "判定不能"
            );
        });

        if (isolatedRoadTraceNoise.length > 0) {
            console.log(
                "道路連続性ノイズ検出・除外：" +
                isolatedRoadTraceNoise.length +
                "件（" +
                isolatedRoadTraceNoise
                    .map(segment =>
                        segment.icNames.join("/") ||
                        segment.roadLabel
                    )
                    .join("、") +
                "）"
            );
        }

        console.groupEnd();

        console.group(
            "[ROUTE COMPARISON CANDIDATE PREVIEW]"
        );

        const formatComparisonCandidateNames = candidates =>
            candidates
                .map(candidate =>
                    candidate.exit.displayName +
                    (candidate.isShuto ? " [首都高]" : "")
                )
                .join(" → ");

        console.log(
            "candidateAreas:",
            comparisonCandidatePreview?.candidateAreas
                .join(" → ") || "なし"
        );
        console.log(
            "入口比較基準IC:",
            nexcoEntranceIc?.displayName || "なし"
        );
        console.log(
            "入口比較候補IC:",
            formatComparisonCandidateNames(
                comparisonCandidatePreview
                    ?.entranceCandidateIcs || []
            ) || "なし"
        );
        console.log(
            "入口比較API候補IC:",
            formatComparisonCandidateNames(
                entranceApiCandidateIcs
            ) || "なし"
        );
        console.log(
            "出口比較モード:",
            "この先IC比較"
        );
        console.log(
            "出口比較現在地基準距離:",
            comparisonCandidatePreview
                ?.exitCandidateBaseDistanceMeters === null ||
            comparisonCandidatePreview
                ?.exitCandidateBaseDistanceMeters === undefined
                ? "なし"
                : Math.round(
                    comparisonCandidatePreview
                        .exitCandidateBaseDistanceMeters /
                    100
                ) / 10 + "km"
        );
        console.log(
            "出口比較候補IC:",
            formatComparisonCandidateNames(
                comparisonCandidatePreview
                    ?.exitCandidateIcs || []
            ) || "なし"
        );
        console.log(
            "出口比較API候補IC:",
            formatComparisonCandidateNames(
                exitApiCandidateIcs
            ) || "なし"
        );
        console.log(
            "出口比較除外IC:",
            comparisonCandidatePreview
                ?.excludedExitCandidateIcs?.length > 0
                ? comparisonCandidatePreview
                    .excludedExitCandidateIcs
                    .map(candidate =>
                        candidate.exit.displayName +
                        ": " + candidate.reason
                    )
                    .join(" / ")
                : "なし"
        );
        console.log(
            "reason:",
            comparisonCandidatePreview?.reason ||
                "Polyline解析結果なし"
        );
        console.log(
            "API実行候補上限:",
            comparisonApiCandidateLimit
        );
        console.log(
            "実車テストモード:",
            isRealDriveTestMode ? "ON" : "OFF"
        );
        console.log("API追加呼び出し: なし");

        console.groupEnd();

        if (DEBUG_ROUTE_VERBOSE) {
            roadSwitches.forEach((roadSwitch, index) => {
                const routeDistanceKm =
                    Math.round(
                        roadSwitch.routeDistanceMeters / 1000
                    );

                const nearbyIcLogs =
                    roadSwitch.nearbyIcs.map(item => ({
                        ic: item.exit.displayName,
                        icArea: item.icArea,
                        distanceKm:
                            Math.round(
                                item.distanceMeters / 100
                            ) / 10,
                        isSelectable:
                            item.exit.isSelectable !== false
                    }));

                console.group(
                    "[ROUTE ROAD SWITCH] " + (index + 1)
                );

                console.log(
                    roadSwitch.fromRoad +
                    " → " +
                    roadSwitch.toRoad
                );

                console.log(
                    "距離地点: 約" + routeDistanceKm + "km"
                );

                console.log(
                    "直前IC:",
                    roadSwitch.beforeExit.displayName
                );

                console.log(
                    "直後IC:",
                    roadSwitch.afterExit.displayName
                );

                console.log("近傍IC候補:");
                console.table(nearbyIcLogs);

                console.groupEnd();
            });
        }

        console.group("[ROUTE ROAD CORRECTION]");

        console.log(
            "補正前道路順:",
            rawRoadSequence.join(" → ")
        );
        console.table(rawRoadDistances);

        console.log("補正前道路切替点:");
        console.table(
            rawRoadSwitches.map((roadSwitch, index) => ({
                number: index + 1,
                roadSwitch:
                    roadSwitch.fromRoad +
                    " → " +
                    roadSwitch.toRoad,
                routeDistanceKm:
                    Math.round(
                        roadSwitch.routeDistanceMeters / 1000
                    )
            }))
        );

        console.log(
            "補正後道路順:",
            roadSequence.join(" → ")
        );
        console.table(roadDistanceLogs);

        console.log("補正後道路切替点:");
        console.table(
            roadSwitches.map((roadSwitch, index) => ({
                number: index + 1,
                roadSwitch:
                    roadSwitch.fromRoad +
                    " → " +
                    roadSwitch.toRoad,
                routeDistanceKm:
                    Math.round(
                        roadSwitch.routeDistanceMeters / 1000
                    )
            }))
        );

        console.groupEnd();

        console.group("[ROUTE TRACE SUMMARY]");

        console.log(
            "想定道路順:",
            roadSequence.join(" → ")
        );

        console.log("道路別距離:");

        roadDistanceLogs.forEach(item => {
            console.log(
                item.road +
                " 約" +
                item.approximateDistanceKm +
                "km"
            );
        });

        console.table(roadDistanceLogs);

        console.log("道路切替点:");

        console.table(
            roadSwitches.map((roadSwitch, index) => ({
                number: index + 1,
                roadSwitch:
                    roadSwitch.fromRoad +
                    " → " +
                    roadSwitch.toRoad,
                routeDistanceKm:
                    Math.round(
                        roadSwitch.routeDistanceMeters / 1000
                    ),
                nearbyIc:
                    roadSwitch.nearbyIcs[0]
                        ?.exit.displayName ||
                    roadSwitch.beforeExit.displayName
            }))
        );

        // 診断用（段階1）。findNearestIcMasterEntryForRoutePointに
        // 距離上限が無いため、実際にはかなり離れたICを「最も近い」として
        // 拾ってしまっている点がどれだけあるかを可視化する。
        // isWithinThresholdはログ表示にのみ使い、候補選定・料金計算等の
        // 実際のフィルタ条件としては一切使用していない。
        const thresholdExceededTraceItems =
            (routeTrace || []).filter(item =>
                item.isWithinThreshold === false
            );

        console.log(
            "最近傍ICしきい値(" +
                IC_MASTER_NEAREST_THRESHOLD_METERS +
                "m)超え件数:",
            thresholdExceededTraceItems.length +
                " / " +
                (routeTrace || []).length +
                "点"
        );

        if (thresholdExceededTraceItems.length > 0) {
            console.log("しきい値超えの内訳:");
            console.table(
                thresholdExceededTraceItems.map(item => ({
                    routeDistanceKm:
                        Math.round(
                            item.routeDistanceMeters / 100
                        ) / 10,
                    nearestIc:
                        item.exit?.displayName || "不明",
                    distanceKm:
                        Math.round(
                            (item.distanceMeters ?? 0) / 100
                        ) / 10,
                    roadLabel: item.roadLabel
                }))
            );
        }

        console.log(
            "入口候補:",
            entranceCandidate?.displayName || "なし"
        );

        console.log(
            "出口候補:",
            exitCandidate?.displayName || "なし"
        );

        console.groupEnd();

        console.group("[ROUTE IC COMPARE]");

        console.table([
            {
                logic: "旧ロジック",
                entranceIc:
                    tollEstimate?.legacyStartIc
                        ?.displayName || "なし",
                exitIc:
                    tollEstimate?.legacyEndIc
                        ?.displayName || "なし"
            },
            {
                logic: "新ロジック",
                entranceIc:
                    entranceCandidate?.displayName || "なし",
                exitIc:
                    exitCandidate?.displayName || "なし"
            }
        ]);

        console.log(
            "想定道路順:",
            roadSequence.join(" → ")
        );

        console.log("道路別距離:");
        console.table(roadDistanceLogs);

        console.log("道路切替点:");
        console.table(
            roadSwitches.map((roadSwitch, index) => ({
                number: index + 1,
                roadSwitch:
                    roadSwitch.fromRoad +
                    " → " +
                    roadSwitch.toRoad,
                routeDistanceKm:
                    Math.round(
                        roadSwitch.routeDistanceMeters / 1000
                    ),
                beforeIc:
                    roadSwitch.beforeExit.displayName,
                afterIc:
                    roadSwitch.afterExit.displayName
            }))
        );

        console.groupEnd();

        console.groupEnd();
    }
    catch (error) {
        console.warn(
            "[ROUTE POLYLINE調査] ログ出力失敗",
            error
        );
    }
}


function findNearestIcIndex(icArea) {

    if (
        currentLatitude === null ||
        currentLongitude === null
    ) {
        return 0;
    }

    const exits =
        IC_MASTER[icArea].exits
            .slice()
            .sort((a, b) =>
                (a.order ?? 999) - (b.order ?? 999)
            )
            .filter(exit =>
                exit.lat !== undefined &&
                exit.lng !== undefined &&
                exit.isSelectable !== false
            );

    if (exits.length === 0) {
        return 0;
    }

    let nearestIndex = 0;
    let nearestDistance = Infinity;

    exits.forEach((exit, index) => {

        const distance =
            calculateDistance(
                currentLatitude,
                currentLongitude,
                exit.lat,
                exit.lng
            );

        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
        }
    });

    lastNearestIcName =
        exits[nearestIndex].displayName;

    lastNearestIcDistanceKm =
        Math.round(nearestDistance / 1000);

    console.log(
        "最寄りIC",
        lastNearestIcName,
        lastNearestIcDistanceKm + "km"
    );

    return Math.max(0, nearestIndex - 2);
}


async function checkAutoReSearch() {

    if (!isAutoUpdateEnabled) {
        renderAutoUpdateStatus();
        return;
    }

    if (isAutoReSearchRunning) {
        console.log(
            "自動再検索スキップ：前回処理中"
        );
        return;
    }

    const elapsedAfterFailure =
        (
            Date.now()
            -
            lastAutoReSearchFailureTime
        ) / 1000;

    if (
        elapsedAfterFailure <
        AUTO_RESEARCH_FAILURE_COOLDOWN_SECONDS
    ) {

        return;
    }

    if (
        lastSearchLatitude === null ||
        lastSearchLongitude === null
    ) {

        document
            .getElementById("nextUpdateInfo")
            .textContent =
            "比較後に表示";

        return;
    }

    const distance =
        calculateDistance(
            lastSearchLatitude,
            lastSearchLongitude,
            currentLatitude,
            currentLongitude
        );

    const elapsedSeconds =
        (
            Date.now()
            -
            lastSearchTime
        ) / 1000;

    const distanceThreshold =
        getAutoUpdateDistanceThreshold();

    const timeThreshold =
        getAutoUpdateTimeThreshold();

    const remainingDistance =
        Math.max(
            0,
            distanceThreshold - Math.round(distance)
        );

    const remainingSeconds =
        Math.max(
            0,
            timeThreshold - Math.round(elapsedSeconds)
        );

    let displaySeconds = remainingSeconds;

    if (remainingSeconds > 60) {
        displaySeconds =
            Math.ceil(remainingSeconds / 30) * 30;
    }
    else if (remainingSeconds > 10) {
        displaySeconds =
            Math.ceil(remainingSeconds / 10) * 10;
    }

    const displayTimeText =
        formatAutoUpdateTimeText(displaySeconds);

    const displayDistanceText =
        formatAutoUpdateDistanceText(remainingDistance);

    setDataUpdateStatus(
        "\u3042\u3068 " +
        displayDistanceText +
        " / " +
        displayTimeText,
        "data-update-normal"
    );

    document
        .getElementById("autoSearchCondition")
        .textContent =
        "あと " +
        remainingDistance +
        "m / あと " +
        remainingSeconds +
        "秒";

    console.log(
        "移動距離",
        Math.round(distance),
        "m"
    );

    console.log(
        "経過時間",
        Math.round(elapsedSeconds),
        "秒"
    );

    if (
        distance >= getAutoUpdateDistanceThreshold() ||
        elapsedSeconds >= getAutoUpdateTimeThreshold()
    ) {

        console.log(
            "自動再検索実行"
        );

        console.log(
            "[AUTO DEBUG]",
            "lastSearchMode=",
            lastSearchMode,
            "autoCompare=",
            document.getElementById("autoCompareEnabled")?.checked,
            "origin=",
            document.getElementById("origin")?.value,
            "destination=",
            document.getElementById("destination")?.value
        );


        setDataUpdateStatus(
            "更新中...",
            "data-update-working"
        );

        isAutoReSearchRunning = true;

        try {

        if (
            lastSearchMode === "autoExitIcCompareButton" ||
            document.getElementById("autoCompareEnabled")?.checked
        ) {

            console.log(
                "[AUTO DEBUG]",
                "候補IC自動比較ルートへ"
            );

            await searchAutoExitIcComparison(false);
        }
        else {

            console.log(
                "[AUTO DEBUG]",
                "現在地から再検索ルートへ"
            );

            await searchFromCurrentLocation(false);
        }

        } finally {
            isAutoReSearchRunning = false;
        }

    }
}


function shortenLocationName(address) {

    if (!address) {
        return "位置不明";
    }

    let text = address
        .replace("日本、", "")
        .replace(/〒\d{3}-\d{4}\s*/, "");

    const wardMatch =
        text.match(/東京都(.+?区)/);

    if (wardMatch) {
        return wardMatch[1] + "付近";
    }

    const cityMatch =
        text.match(/(.+?[市町村])/);

    if (cityMatch) {
        return cityMatch[1] + "付近";
    }

    return text;
}

function shortenDestinationName(text) {

    if (!text) {
        return "未設定";
    }

    let name =
        String(text)
            .trim()
            .replace(/^日本、?/, "")
            .replace(/〒\d{3}-\d{4}\s*/, "");

    name =
        name.trim();

    if (name.length > 18) {
        return name.slice(0, 18) + "…";
    }

    return name;
}

function getDestinationDisplayName(destination) {

    if (
        selectedDestinationDisplayName &&
        selectedDestinationAddress === destination
    ) {
        return selectedDestinationDisplayName;
    }

    return (
        shortenDestinationName(destination)
    );
}

function normalizeDestinationDisplayName(place, inputValue) {

    const name =
        String(place?.name || "").trim();

    const formattedAddress =
        String(place?.formatted_address || "").trim();

    const typedValue =
        String(inputValue || "").trim();

    if (isUsefulPlaceName(name)) {
        return shortenDestinationName(name);
    }

    if (isUsefulPlaceName(typedValue)) {
        return shortenDestinationName(typedValue);
    }

    if (formattedAddress) {
        return shortenDestinationName(formattedAddress);
    }

    return shortenDestinationName(typedValue);
}

function isUsefulPlaceName(name) {

    const trimmedName =
        String(name || "").trim();

    if (!trimmedName) {
        return false;
    }

    if (
        /^(B?\d+[FＦ]|地下\d+階|\d+階|フロア)$/i.test(
            trimmedName
        )
    ) {
        return false;
    }

    if (/^[A-Za-z0-9]{1,2}$/.test(trimmedName)) {
        return false;
    }

    return true;
}

function formatMinutes(minutes) {

    const hours =
        Math.floor(minutes / 60);

    const mins =
        minutes % 60;

    if (hours === 0) {

        return mins + "分";

    }

    return (
        hours +
        "時間" +
        mins +
        "分"
    );
}

function formatMinutesHtml(minutes) {

    const hours =
        Math.floor(minutes / 60);

    const mins =
        minutes % 60;

    if (hours === 0) {

        return (
            mins +
            "<span class=\"route-time-unit\">分</span>"
        );

    }

    return (
        hours +
        "<span class=\"route-time-unit\">時間</span>" +
        mins +
        "<span class=\"route-time-unit\">分</span>"
    );
}

function formatArrivalTime(minutesFromNow) {

    const arrival =
        new Date(
            Date.now() +
            minutesFromNow * 60 * 1000
        );

    return (
        String(arrival.getHours()).padStart(2, "0") +
        ":" +
        String(arrival.getMinutes()).padStart(2, "0")
    );
}

function createRouteTimeHtml(
    minutes,
    isProbablyNoTollRoute = false
) {

    if (
        minutes === null ||
        minutes === undefined ||
        Number.isNaN(minutes)
    ) {
        return "--";
    }

    return (
        createProbablyNoTollRouteNoteHtml(
            isProbablyNoTollRoute
        ) +
        "<div class=\"arrival-label\">到着時刻</div>" +
        "<div class=\"arrival-time\">" +
        formatArrivalTime(minutes) +
        "</div>" +
        "<div class=\"main-route-time\">" +
        formatMinutesHtml(minutes) +
        "</div>"
    );
}

function createRouteDistanceText(distanceKm) {

    if (
        distanceKm === null ||
        distanceKm === undefined ||
        Number.isNaN(distanceKm)
    ) {
        return "距離：--";
    }

    return "距離：" + Number(distanceKm).toFixed(1) + "km";
}

function createArrivalPredictionCardHtml(
    subLabel,
    minutes,
    distanceKm,
    isProbablyNoTollRoute = false
) {

    return (
        "<div class=\"v2-arrival-prediction-card\">" +
        "<div class=\"v2-arrival-prediction-title\">" +
        "到着予測" +
        "</div>" +
        "<div class=\"v2-arrival-prediction-sub\">" +
        escapeHtml(subLabel) +
        "</div>" +
        "<div class=\"v2-arrival-prediction-time\">" +
        createRouteTimeHtml(
            minutes,
            isProbablyNoTollRoute
        ) +
        "</div>" +
        "<div class=\"v2-arrival-prediction-distance\">" +
        escapeHtml(createRouteDistanceText(distanceKm)) +
        "</div>" +
        "</div>"
    );
}

function createEtcEstimateHtml(amount, label = "") {

    const tollAmount =
        Number(amount || 0);

    const tollLabel =
        String(label || "")
            .replace(/^料金計算：/, "")
            .trim();

    return (
        "約" +
        tollAmount.toLocaleString() +
        "円" +
        (
            tollLabel
                ? "<small class=\"dashboard-toll-breakdown\">" +
                    escapeHtml(tollLabel) +
                    "</small>"
                : ""
        )
    );
}

async function searchExitIcComparison() {

    if (
        currentLatitude === null ||
        currentLongitude === null
    ) {
        alert("現在地取得待ちです");
        return;
    }

    const destination =
        document
            .getElementById("destination")
            .value;

    const exitIc =
        document
            .getElementById("exitIc")
            .value;

    if (!destination) {
        alert("目的地を入力してください");
        return;
    }

    if (!exitIc) {
        alert("降りるICを入力してください");
        return;
    }

    try {

        document
            .getElementById("exitIcJudge")
            .textContent =
            "計算中...";

        const keepHighwayRoute =
            await getHighwayRouteFromGps(
                destination
            );

        const highwayToIcRoute =
            await getHighwayRouteFromGps(
                exitIc
            );

        const localFromIcRoute =
            await getLocalRoute(
                exitIc,
                destination
            );

        displayExitIcComparison(
            keepHighwayRoute,
            highwayToIcRoute,
            localFromIcRoute,
            exitIc
        );

    } catch (error) {

        console.error(error);

        alert(
            "指定IC比較に失敗しました\n\n" +
            error.message
        );
    }
}

function displayExitIcComparison(
    keepHighwayRoute,
    highwayToIcRoute,
    localFromIcRoute,
    exitIc
) {

    const keepHighwayMinutes =
        Math.round(
            parseInt(
                keepHighwayRoute.duration.replace("s", "")
            ) / 60
        );

    const highwayToIcMinutes =
        Math.round(
            parseInt(
                highwayToIcRoute.duration.replace("s", "")
            ) / 60
        );

    const localFromIcMinutes =
        Math.round(
            parseInt(
                localFromIcRoute.duration.replace("s", "")
            ) / 60
        );

    const exitIcTotalMinutes =
        highwayToIcMinutes + localFromIcMinutes;

    const difference =
        exitIcTotalMinutes - keepHighwayMinutes;

    document
        .getElementById("exitIcName")
        .textContent =
        exitIc;

    document
        .getElementById("keepHighwayTime")
        .textContent =
        formatMinutes(keepHighwayMinutes);

    document
        .getElementById("exitIcTime")
        .textContent =
        formatMinutes(exitIcTotalMinutes);

    let differenceText = "";

    if (difference > 0) {
        differenceText =
            "IC降りは " +
            formatMinutes(difference) +
            " 遅い";
    }
    else if (difference < 0) {
        differenceText =
            "IC降りは " +
            formatMinutes(Math.abs(difference)) +
            " 早い";
    }
    else {
        differenceText =
            "ほぼ同じ";
    }

    document
        .getElementById("exitIcDifference")
        .textContent =
        differenceText;

    let judge = "高速継続";

    if (difference <= 5) {
        judge =
            "指定ICで降りても良さそう";
    }

    if (difference <= 0) {
        judge =
            "指定ICで降りるのがおすすめ";
    }

    document
        .getElementById("exitIcJudge")
        .textContent =
        judge;
}

function findIcDefinitionForMultiExitComparison(googleName) {

    for (const areaKey in IC_MASTER) {

        const found =
            IC_MASTER[areaKey].exits.find(exit =>
                exit.googleName === googleName &&
                exit.isMirror !== true
            );

        if (found) {
            return found;
        }
    }

    const foundShutoIc =
        getAllShutoIcDefinitions().find(shutoIc =>
            shutoIc.googleName === googleName
        );

    return foundShutoIc || null;
}

function buildRoutesLocationForIcOrAddress(value, role) {

    if (
        value &&
        typeof value === "object" &&
        value.lat !== undefined &&
        value.lng !== undefined
    ) {
        return {
            location: {
                latLng: {
                    latitude: value.lat,
                    longitude: value.lng
                }
            }
        };
    }

    const ic =
        findIcDefinitionForMultiExitComparison(value);

    const icLat =
        role === "entrance"
            ? ic?.entranceLat ?? ic?.lat
            : role === "exit"
                ? ic?.exitLat ?? ic?.lat
                : ic?.lat;

    const icLng =
        role === "entrance"
            ? ic?.entranceLng ?? ic?.lng
            : role === "exit"
                ? ic?.exitLng ?? ic?.lng
                : ic?.lng;

    if (
        ic &&
        icLat !== undefined &&
        icLng !== undefined
    ) {
        return {
            location: {
                latLng: {
                    latitude: icLat,
                    longitude: icLng
                }
            }
        };
    }

    return {
        address: value
    };
}

function getRouteOriginForMultiExitComparison(origin) {

    if (origin) {
        return origin;
    }

    return {
        lat: currentLatitude,
        lng: currentLongitude
    };
}

async function getAutoExitComparisonOriginLatLng(origin) {

    if (origin) {
        return await getLatLngFromAddress(origin);
    }

    if (
        currentLatitude === null ||
        currentLongitude === null
    ) {
        return null;
    }

    return {
        lat: currentLatitude,
        lng: currentLongitude
    };
}

async function findNearestHighwayStartForAutoExitComparison(
    origin,
    icArea
) {

    let baseLat = currentLatitude;
    let baseLng = currentLongitude;

    if (origin) {

        const originLatLng =
            await getLatLngFromAddress(origin);

        if (originLatLng) {
            baseLat = originLatLng.lat;
            baseLng = originLatLng.lng;
        }
    }

    return findNearestIcByMasterCoordinatesForAutoExitComparison(
        icArea,
        baseLat,
        baseLng,
        "entrance"
    );
}

async function findDestinationNearestIcForAutoExitComparison(
    destination,
    icArea
) {

    const destinationLatLng =
        await getLatLngFromAddress(destination);

    if (!destinationLatLng) {
        return null;
    }

    const nearestInfo =
        findNearestIcByMasterCoordinatesForAutoExitComparison(
            icArea,
            destinationLatLng.lat,
            destinationLatLng.lng,
            "exit"
        );

    if (!nearestInfo) {
        return null;
    }

    return {
        displayName: nearestInfo.exit.displayName,
        googleName: nearestInfo.exit.googleName,
        order: nearestInfo.exit.order ?? null,
        roadType: nearestInfo.exit.roadType,
        distanceKm: nearestInfo.distanceKm
    };
}

function resolveGaikanDirectionalIcArea(
    icArea,
    origin,
    destination
) {

    if (icArea !== "gaikan") {
        return icArea;
    }

    const routeAnalysisKey =
        buildRouteAnalysisKey(origin, destination);

    const passedIcEntries =
        lastHighwayRoutePolylineAnalysisKey === routeAnalysisKey
            ? lastHighwayRoutePolylineAnalysis?.passedIcEntries
            : null;

    const gaikanPassedIcEntry =
        (passedIcEntries || []).find(item =>
            item.icArea === "gaikan"
        );

    if (!gaikanPassedIcEntry) {
        return null;
    }

    const travelDirection =
        inferTravelDirectionForIcArea(
            "gaikan",
            gaikanPassedIcEntry.exit,
            passedIcEntries,
            buildIcDefinitionIdentity
        );

    if (travelDirection === 1) {
        return "gaikan";
    }

    if (travelDirection === -1) {
        return "gaikanUchimawari";
    }

    return null;
}

// resolveGaikanDirectionalIcArea（gaikan専用・上記関数）とは別関数として追加。
// C1/C2はSHUTO_IC_MASTER側でicArea:"shuto"固定のため、
// gaikan側のitem.icArea一致方式ではなくroute Codeで該当passedIcEntryを探す点のみ異なる。
// resolveGaikanDirectionalIcArea自体は未変更のため、gaikan/gaikanUchimawariの挙動に影響しない。
function resolveShutoRouteDirectionalIcArea(
    routeCode,
    origin,
    destination
) {

    const routeAnalysisKey =
        buildRouteAnalysisKey(origin, destination);

    const passedIcEntries =
        lastHighwayRoutePolylineAnalysisKey === routeAnalysisKey
            ? lastHighwayRoutePolylineAnalysis?.passedIcEntries
            : null;

    const routePassedIcEntry =
        (passedIcEntries || []).find(item =>
            item.icArea === "shuto" &&
            item.exit?.routeCode === routeCode
        );

    if (!routePassedIcEntry) {
        return null;
    }

    const travelDirection =
        inferTravelDirectionForIcArea(
            routeCode,
            routePassedIcEntry.exit,
            passedIcEntries,
            buildIcDefinitionIdentity
        );

    if (travelDirection === 1) {
        return routeCode;
    }

    if (travelDirection === -1) {
        return "shuto" + routeCode + "Uchimawari";
    }

    return null;
}

function findNearestIcByMasterCoordinatesForAutoExitComparison(
    icArea,
    baseLat,
    baseLng,
    role
) {

    if (!IC_MASTER[icArea]) {
        return null;
    }

    const getRoleLat = exit =>
        role === "entrance"
            ? exit.entranceLat ?? exit.lat
            : role === "exit"
                ? exit.exitLat ?? exit.lat
                : exit.lat;

    const getRoleLng = exit =>
        role === "entrance"
            ? exit.entranceLng ?? exit.lng
            : role === "exit"
                ? exit.exitLng ?? exit.lng
                : exit.lng;

    const isRoleSelectable = exit => {
        if (role === "entrance") {
            return typeof exit.entranceSelectable === "boolean"
                ? exit.entranceSelectable
                : exit.isSelectable !== false;
        }
        if (role === "exit") {
            return typeof exit.exitSelectable === "boolean"
                ? exit.exitSelectable
                : exit.isSelectable !== false;
        }
        return exit.isSelectable !== false;
    };

    const exits =
        IC_MASTER[icArea].exits
            .filter(exit =>
                getRoleLat(exit) !== undefined &&
                getRoleLng(exit) !== undefined &&
                isRoleSelectable(exit)
            )
            .slice()
            .sort((a, b) =>
                (a.order ?? 999) - (b.order ?? 999)
            );

    let nearest = null;
    let nearestDistance = Infinity;

    for (const exit of exits) {

        const distance =
            calculateDistance(
                baseLat,
                baseLng,
                getRoleLat(exit),
                getRoleLng(exit)
            );

        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = exit;
        }
    }

    if (!nearest) {
        return null;
    }

    return {
        exit: nearest,
        distanceKm: Math.round(nearestDistance / 1000),
        baseLat: baseLat,
        baseLng: baseLng
    };
}

function resolveRouteBranchForIcArea(icArea) {
    if (icArea === "aqualine") {
        return "aqualine";
    }

    if (icArea === "keiyo") {
        return "keiyo";
    }

    if (icArea === "tokan") {
        return "tokan";
    }

    if (icArea === "tateyama") {
        return "aqualine";
    }

    return null;
}

function selectExitCandidatesForAutoExitComparison(
    icArea,
    highwayStart,
    destinationNearestIc,
    maxCount = getActiveIcCandidateCount(),
    baseLatLng = null
) {

    if (
        !IC_MASTER[icArea] ||
        !highwayStart ||
        !baseLatLng ||
        baseLatLng.lat === undefined ||
        baseLatLng.lng === undefined
    ) {
        return [];
    }

    const getExitRoleLat = exit => exit.exitLat ?? exit.lat;
    const getExitRoleLng = exit => exit.exitLng ?? exit.lng;

    const isExitRoleSelectable = exit =>
        typeof exit.exitSelectable === "boolean"
            ? exit.exitSelectable
            : exit.isSelectable !== false;

    const selectableExits =
        IC_MASTER[icArea].exits
            .filter(exit =>
                isExitRoleSelectable(exit) &&
                getExitRoleLat(exit) !== undefined &&
                getExitRoleLng(exit) !== undefined
            );

    const sortByDistanceFromBase = (a, b) =>
        calculateDistance(
            baseLatLng.lat,
            baseLatLng.lng,
            getExitRoleLat(a),
            getExitRoleLng(a)
        ) -
        calculateDistance(
            baseLatLng.lat,
            baseLatLng.lng,
            getExitRoleLat(b),
            getExitRoleLng(b)
        );

    const shutoCandidate =
        selectableExits
            .filter(exit =>
                isShutoIc(exit)
            )
            .slice()
            .sort(sortByDistanceFromBase)[0] ||
        null;

    const mainlineCount =
        shutoCandidate
            ? Math.max(0, maxCount - 1)
            : maxCount;

    const startOrder =
        highwayStart.order ?? null;

    const destinationOrder =
        destinationNearestIc?.order ?? null;

    const isForwardDirection =
        destinationOrder === null ||
        destinationOrder > startOrder;

    const orderMainlineCandidates =
        selectableExits
            .filter(exit =>
                !isShutoIc(exit) &&
                startOrder !== null &&
                exit.order !== undefined &&
                (
                    isForwardDirection
                        ? exit.order > startOrder
                        : exit.order < startOrder
                )
            )
            .slice()
            .sort((a, b) =>
                isForwardDirection
                    ? (a.order ?? 999) - (b.order ?? 999)
                    : (b.order ?? -999) - (a.order ?? -999)
            )
            .slice(0, mainlineCount);

    const routeBranch =
        resolveRouteBranchForIcArea(icArea);

    const useBranchOrder =
        routeBranch &&
        selectableExits.some(exit =>
            exit.routeBranch === routeBranch &&
            exit.branchOrder !== undefined
        );

    let mainlineCandidates =
        orderMainlineCandidates;

    if (useBranchOrder) {
        const branchCandidates =
            selectableExits
                .filter(exit =>
                    !isShutoIc(exit) &&
                    exit.routeBranch === routeBranch &&
                    exit.branchOrder !== undefined
                )
                .slice()
                .sort((a, b) =>
                    a.branchOrder - b.branchOrder
                )
                .slice(0, mainlineCount);

        if (branchCandidates.length >= mainlineCount) {
            mainlineCandidates = branchCandidates;
        }
    }

    return [
        shutoCandidate,
        ...mainlineCandidates
    ]
        .filter(Boolean)
        .slice()
        .slice(0, maxCount);
}

async function getHighwayRouteForMultiExitComparison(
    origin,
    destination,
    role
) {

    const cacheRequest = createRoutesCacheRequest(
        "getHighwayRouteForMultiExitComparison",
        createRoutesCacheEndpointKey(
            origin,
            isCurrentLocationRouteOrigin(origin)
        ),
        createRoutesCacheEndpointKey(destination),
        {
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_AWARE",
            avoidTolls: false
        },
        role
    );

    const cachedResponse = getCachedRoutesResponse(cacheRequest);

    if (cachedResponse !== undefined) {
        return cachedResponse;
    }

    incrementRouteRequestUsage("pro");

    const response = await fetch(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key":
                    CONFIG.GOOGLE_MAPS_API_KEY,

                "X-Goog-FieldMask":
                    "routes.duration,routes.distanceMeters"
            },

            body: JSON.stringify({

                origin:
                    buildRoutesLocationForIcOrAddress(
                        origin,
                        role
                    ),

                destination:
                    buildRoutesLocationForIcOrAddress(
                        destination,
                        role
                    ),

                travelMode: "DRIVE",

                routingPreference:
                    "TRAFFIC_AWARE"
            })
        }
    );

    const data =
        await response.json();

    if (DEBUG_ROUTE_VERBOSE) {
        console.log(
            "multi exit highway route detail",
            JSON.stringify(data, null, 2)
        );
    }

    if (
        !data.routes ||
        data.routes.length === 0
    ) {
        throw new Error(
            "Highway route was not found: " +
            origin +
            " -> " +
            destination
        );
    }

    const route = data.routes[0];

    cacheRoutesResponse(cacheRequest, route);

    return route;
}

async function getLocalRouteForMultiExitComparison(
    origin,
    destination,
    role
) {

    const cacheRequest = createRoutesCacheRequest(
        "getLocalRouteForMultiExitComparison",
        createRoutesCacheEndpointKey(
            origin,
            isCurrentLocationRouteOrigin(origin)
        ),
        createRoutesCacheEndpointKey(destination),
        {
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_AWARE",
            avoidTolls: true
        },
        role
    );

    const cachedResponse = getCachedRoutesResponse(cacheRequest);

    if (cachedResponse !== undefined) {
        return cachedResponse;
    }

    incrementRouteRequestUsage("pro");

    const response = await fetch(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",

                "X-Goog-Api-Key":
                    CONFIG.GOOGLE_MAPS_API_KEY,

                "X-Goog-FieldMask":
                    "routes.duration,routes.distanceMeters"
            },

            body: JSON.stringify({

                origin:
                    buildRoutesLocationForIcOrAddress(
                        origin,
                        role
                    ),

                destination:
                    buildRoutesLocationForIcOrAddress(
                        destination,
                        role
                    ),

                travelMode: "DRIVE",

                routingPreference:
                    "TRAFFIC_AWARE",

                routeModifiers: {
                    avoidTolls: true
                }
            })
        }
    );

    const data =
        await response.json();

    if (
        !data.routes ||
        data.routes.length === 0
    ) {
        throw new Error(
            "Local route was not found: " +
            origin +
            " -> " +
            destination
        );
    }

    const route = data.routes[0];

    cacheRoutesResponse(cacheRequest, route);

    return route;
}

async function searchMultiExitIcComparison() {

    if (
        currentLatitude === null ||
        currentLongitude === null
    ) {
        alert("現在地取得待ちです");
        return;
    }

    const destination =
        document
            .getElementById("destination")
            .value;

    const origin =
        document
            .getElementById("origin")
            .value;

    const exitIcListText =
        document
            .getElementById("exitIcList")
            .value;

    const acceptableDelay =
        Number(
            document
                .getElementById("acceptableDelay")
                .value
        );

    if (!destination) {
        alert("目的地を入力してください");
        return;
    }

    if (!exitIcListText) {
        alert("降りるIC候補を入力してください");
        return;
    }

    const exitIcList =
        exitIcListText
            .split(",")
            .map(text => text.trim())
            .filter(text => text !== "");

    if (exitIcList.length === 0) {
        alert("降りるIC候補を入力してください");
        return;
    }

    try {

        invalidIcResults = [];

        document
            .getElementById("multiExitIcResult")
            .textContent =
            "計算中...";

        const keepHighwayRoute =
            await getHighwayRouteFromOrigin(
                origin,
                destination
            );

        const keepHighwayMinutes =
            Math.round(
                parseInt(
                    keepHighwayRoute.duration.replace("s", "")
                ) / 60
            );

        const routeOrigin =
            getRouteOriginForMultiExitComparison(origin);

        const highwayStartIc =
            findIcDefinitionForMultiExitComparison(
                lastTollStartIcGoogleName
            );

        const highwayEndIc =
            findIcDefinitionForMultiExitComparison(
                lastTollEndIcGoogleName
            );

        const isForwardDirection =
            !highwayStartIc ||
            lastTollEndIcOrder === null ||
            highwayStartIc.order === undefined ||
            lastTollEndIcOrder > highwayStartIc.order;

        let localToHighwayStartMinutes = 0;

        if (lastTollStartIcGoogleName) {

            const localToHighwayStartRoute =
                await getLocalRouteForMultiExitComparison(
                    routeOrigin,
                    lastTollStartIcGoogleName
                );

            localToHighwayStartMinutes =
                Math.round(
                    parseInt(
                        localToHighwayStartRoute.duration.replace("s", "")
                    ) / 60
                );
        }

        let keepHighwayToll = 0;

        if (
            lastTollStartIcGoogleName &&
            lastTollEndIcGoogleName &&
            lastTollStartIcGoogleName !== lastTollEndIcGoogleName
        ) {

            const keepHighwayTollRoute =
                await getHighwayRouteForTollEstimate(
                    lastTollStartIcGoogleName,
                    lastTollEndIcGoogleName
                );

            keepHighwayToll =
                Math.round(
                    (keepHighwayTollRoute.distanceMeters / 1000) * 24
                ) +
                getShutoTollEstimateForIcPair(
                    highwayStartIc,
                    highwayEndIc,
                    (
                        lastHighwayRoutePolylineAnalysis
                            ?.hasTollSectionStepsData
                            ? lastHighwayRoutePolylineAnalysis
                                .tollEntryCount
                            : lastHighwayRoutePolylineAnalysis
                                ?.shutoEntryCount
                    ) ??
                        (
                            (
                                isShutoIc(highwayStartIc) ||
                                isShutoIc(highwayEndIc)
                            )
                                ? 1
                                : 0
                        )
                );
        }

        const results = [];

        for (const exitIc of exitIcList) {

            try {

                const exitIcDefinition =
                    findIcDefinitionForMultiExitComparison(exitIc);

                if (
                    lastTollStartIcGoogleName &&
                    exitIc === lastTollStartIcGoogleName
                ) {

                    invalidIcResults.push({
                        exitIc: exitIc,
                        totalMinutes: null,
                        reason: "入口ICと同じため除外"
                    });

                    continue;
                }

                if (
                    highwayStartIc &&
                    exitIcDefinition &&
                    highwayStartIc.order !== undefined &&
                    exitIcDefinition.order !== undefined &&
                    (
                        isForwardDirection
                            ? exitIcDefinition.order <= highwayStartIc.order
                            : exitIcDefinition.order >= highwayStartIc.order
                    )
                ) {

                    invalidIcResults.push({
                        exitIc: exitIc,
                        totalMinutes: null,
                        reason: "\u9ad8\u901f\u8d77\u70b9\u4ee5\u524d\u306e\u305f\u3081\u9664\u5916"
                    });

                    continue;
                }

                const highwayToIcRoute =
                    await getHighwayRouteForMultiExitComparison(
                        lastTollStartIcGoogleName || routeOrigin,
                        exitIc
                    );

                const localFromIcRoute =
                    await getLocalRouteForMultiExitComparison(
                        exitIc,
                        destination
                    );

                const highwayToIcMinutes =
                    Math.round(
                        parseInt(
                            highwayToIcRoute.duration.replace("s", "")
                        ) / 60
                    );

                const localFromIcMinutes =
                    Math.round(
                        parseInt(
                            localFromIcRoute.duration.replace("s", "")
                        ) / 60
                    );

                const totalMinutes =
                    localToHighwayStartMinutes +
                    highwayToIcMinutes +
                    localFromIcMinutes;

                const difference =
                    totalMinutes -
                    keepHighwayMinutes;

                if (totalMinutes > keepHighwayMinutes + 180) {

                    invalidIcResults.push({
                        exitIc: exitIc,
                        totalMinutes: totalMinutes,
                        reason: "ルート取得異常"
                    });

                    continue;
                }


                let estimatedToll = 0;
                let estimatedTollKm = 0;

                if (
                    lastTollStartIcGoogleName &&
                    exitIc !== lastTollStartIcGoogleName
                ) {

                    const exitIcTollRoute =
                        await getHighwayRouteForTollEstimate(
                            lastTollStartIcGoogleName,
                            exitIc
                        );

                    estimatedTollKm =
                        exitIcTollRoute.distanceMeters / 1000;

                    estimatedToll =
                        Math.round(
                            estimatedTollKm * 24
                        ) +
                        getShutoTollEstimateForIcPair(
                            highwayStartIc,
                            exitIcDefinition,
                            (
                                lastHighwayRoutePolylineAnalysis
                                    ?.hasTollSectionStepsData
                                    ? lastHighwayRoutePolylineAnalysis
                                        .tollEntryCount
                                    : lastHighwayRoutePolylineAnalysis
                                        ?.shutoEntryCount
                            ) ??
                                (
                                    (
                                        isShutoIc(highwayStartIc) ||
                                        isShutoIc(exitIcDefinition)
                                    )
                                        ? 1
                                        : 0
                                )
                        );
                }

                const savedToll =
                    Math.max(
                        0,
                        keepHighwayToll - estimatedToll
                    );


                let yenPerExtraMinute = 0;

                if (difference > 0) {
                    yenPerExtraMinute =
                        Math.round(savedToll / difference);
                }

                results.push({
                    exitIc: exitIc,
                    totalMinutes: totalMinutes,
                    difference: difference,
                    estimatedTollKm: estimatedTollKm,
                    estimatedToll: estimatedToll,
                    savedToll: savedToll,
                    roadName:
                        getIcAreaLabelByExitIc(exitIc),
                    yenPerExtraMinute: yenPerExtraMinute

                });

            } catch (error) {

                console.warn(
                    "IC比較失敗:",
                    exitIc,
                    error.message
                );
            }
        }


        if (results.length === 0) {
            throw new Error(
                "比較できるIC候補がありませんでした"
            );
        }

        displayMultiExitIcComparison(
            keepHighwayMinutes,
            results,
            acceptableDelay,
            lastTollStartIcName
        );

        document
            .getElementById("autoSearchTime")
            .textContent =
            new Date().toLocaleTimeString("ja-JP");

    } catch (error) {

        console.error(error);

        setDataUpdateStatus(
            "更新失敗",
            "data-update-error"
        );

        alert(
            "複数IC比較に失敗しました\n\n" +
            error.message
        );
    }
}

function evaluateEntranceCandidateEligibility(result) {

    if (result.error) {
        return {
            recommendationEligibility: "error",
            weakReason: "計算エラー"
        };
    }

    if (
        result.differenceFromAllLocal === null ||
        result.differenceFromAllLocal === undefined
    ) {
        return {
            recommendationEligibility: "weak",
            weakReason: "下道との差分不明"
        };
    }

    if (result.differenceFromAllLocal <= 0) {
        return {
            recommendationEligibility: "weak",
            weakReason: "下道より遅い、または同等"
        };
    }

    if (
        result.differenceFromAllLocal <
        MIN_ENTRANCE_RECOMMEND_SAVED_MINUTES
    ) {
        return {
            recommendationEligibility: "weak",
            weakReason:
                "短縮時間が" +
                result.differenceFromAllLocal +
                "分と短い（" +
                MIN_ENTRANCE_RECOMMEND_SAVED_MINUTES +
                "分未満）"
        };
    }

    if (
        result.yenPerSavedMinute !== null &&
        result.yenPerSavedMinute !== undefined &&
        result.yenPerSavedMinute > 100
    ) {
        return {
            recommendationEligibility: "weak",
            weakReason:
                "1分短縮あたり料金が高い（100円/分超）"
        };
    }

    return {
        recommendationEligibility: "eligible",
        weakReason: ""
    };
}

function buildExitCandidateValueNote(
    result,
    recommendationEligibility
) {
    if (
        !result ||
        result.savedToll === null ||
        result.savedToll === undefined ||
        result.differenceFromAllHighway === null ||
        result.differenceFromAllHighway === undefined
    ) {
        return "";
    }

    if (result.differenceFromAllHighway <= 0) {
        return result.savedToll > 0 ? "遅れなしで節約あり" : "";
    }

    const normalExitIcName =
        getNormalHighwayExitIcName();

    const normalExitRecommendation =
        normalExitIcName
            ? "通常出口（" + normalExitIcName + "）がおすすめ"
            : "通常出口がおすすめ";

    if (result.savedToll < 0) {
        return (
            result.differenceFromAllHighway +
            "分の遅れで" +
            Math.abs(result.savedToll).toLocaleString() +
            "円高い" +
            "。時間優先なら" +
            normalExitRecommendation
        );
    }

    if (result.savedToll === 0) {
        return (
            result.differenceFromAllHighway +
            "分の遅れで0円節約" +
            "。時間優先なら" +
            normalExitRecommendation
        );
    }

    const efficiencyText =
        result.yenPerDelayedMinute === null ||
        result.yenPerDelayedMinute === undefined
            ? ""
            : "（1分あたり" +
                result.yenPerDelayedMinute +
                "円）";

    const lowEfficiencyNote =
        recommendationEligibility === "reference"
            ? "。おすすめ条件の" +
                MIN_EXIT_RECOMMEND_YEN_PER_DELAY_MINUTE +
                "円/分未満のため、参考出口として表示しています"
            : "";

    return (
        result.differenceFromAllHighway +
        "分の遅れで" +
        result.savedToll +
        "円節約" +
        efficiencyText +
        lowEfficiencyNote +
        "。時間優先なら" +
        normalExitRecommendation
    );
}

function getNormalHighwayExitIcName() {

    return lastHighwayRoutePolylineAnalysis
        ?.nexcoExitIc?.displayName || "";
}

function evaluateExitCandidateEligibility(result) {

    let recommendationEligibility;
    let weakReason;

    if (result.error) {
        recommendationEligibility = "error";
        weakReason = "計算エラー";
    }
    else if (
        result.savedToll === null ||
        result.savedToll === undefined ||
        result.differenceFromAllHighway === null ||
        result.differenceFromAllHighway === undefined
    ) {
        recommendationEligibility = "weak";
        weakReason = "全高速との差分または節約額不明";
    }
    else if (
        result.savedToll < 0 &&
        result.differenceFromAllHighway > 0
    ) {
        recommendationEligibility = "weak";
        weakReason = "逆に高く、時間も遅い";
    }
    else if (result.savedToll < 0) {
        recommendationEligibility = "weak";
        weakReason = "逆に高い";
    }
    else if (result.savedToll === 0) {
        recommendationEligibility = "weak";
        weakReason = "節約なし";
    }
    else if (
        result.differenceFromAllHighway >
        getAcceptableDelayMinutes()
    ) {
        recommendationEligibility = "weak";
        weakReason = "許容遅れ超過";
    }
    else if (
        result.differenceFromAllHighway > 0 &&
        result.yenPerDelayedMinute !== null &&
        result.yenPerDelayedMinute <
            MIN_EXIT_RECOMMEND_YEN_PER_DELAY_MINUTE
    ) {
        recommendationEligibility = "reference";
        weakReason =
            "節約効果が小さい（" +
            result.yenPerDelayedMinute +
            "円/分）";
    }
    else {
        recommendationEligibility = "eligible";
        weakReason = "";
    }

    return {
        recommendationEligibility,
        weakReason,
        valueNote: buildExitCandidateValueNote(
            result,
            recommendationEligibility
        )
    };
}

function logEntranceComparisonResultSummary(results) {

    const summaryRows = results.map(result => {
        const evaluation =
            evaluateEntranceCandidateEligibility(result);

        const timeComparison =
            result.differenceFromAllLocal === null ||
            result.differenceFromAllLocal === undefined
                ? "不明"
                : result.differenceFromAllLocal > 0
                    ? result.differenceFromAllLocal + "分短縮"
                    : result.differenceFromAllLocal < 0
                        ? Math.abs(
                            result.differenceFromAllLocal
                        ) + "分遅い"
                        : "同等";

        return {
            candidateIc: result.candidateIcName,
            totalMinutes: result.totalMinutes,
            differenceFromAllLocal:
                result.differenceFromAllLocal,
            timeComparison,
            estimatedToll: result.estimatedToll,
            yenPerSavedMinute:
                result.yenPerSavedMinute,
            recommendationEligibility:
                evaluation.recommendationEligibility,
            isWeakCandidate:
                evaluation.recommendationEligibility !==
                "eligible",
            reason: evaluation.weakReason || "下道より短縮"
        };
    });

    console.group(
        "[ENTRANCE COMPARISON RESULT SUMMARY]"
    );
    console.table(summaryRows);
    console.groupEnd();
}

function logExitComparisonResultSummary(results) {

    const summaryRows = results.map(result => {
        const evaluation =
            evaluateExitCandidateEligibility(result);

        const timeComparison =
            result.differenceFromAllHighway === null ||
            result.differenceFromAllHighway === undefined
                ? "不明"
                : result.differenceFromAllHighway > 0
                    ? result.differenceFromAllHighway + "分遅い"
                    : result.differenceFromAllHighway < 0
                        ? Math.abs(
                            result.differenceFromAllHighway
                        ) + "分早い"
                        : "同等";

        const tollComparison =
            result.savedToll === null ||
            result.savedToll === undefined
                ? "不明"
                : result.savedToll > 0
                    ? result.savedToll + "円節約"
                    : result.savedToll < 0
                        ? Math.abs(result.savedToll) +
                            "円逆に高い"
                        : "節約なし";

        return {
            candidateIc: result.candidateIcName,
            totalMinutes: result.totalMinutes,
            differenceFromAllHighway:
                result.differenceFromAllHighway,
            timeComparison,
            savedToll: result.savedToll,
            tollComparison,
            yenPerDelayedMinute:
                result.yenPerDelayedMinute,
            recommendationEligibility:
                evaluation.recommendationEligibility,
            isWeakCandidate:
                evaluation.recommendationEligibility !==
                "eligible",
            reason:
                evaluation.weakReason ||
                (
                    result.differenceFromAllHighway <= 0
                        ? "節約あり、全高速より速いまたは同等"
                        : "許容遅れ内で節約あり"
                ),
            valueNote: evaluation.valueNote
        };
    });

    console.group(
        "[EXIT COMPARISON RESULT SUMMARY]"
    );
    console.table(summaryRows);
    console.groupEnd();
}

function logComparisonRecommendationFilter(
    mode,
    results,
    bestResult
) {

    const eligibleResults =
        results.filter(result =>
            result.recommendationEligibility === "eligible"
        );

    const weakResults =
        results.filter(result =>
            result.recommendationEligibility === "weak"
        );

    const nonEligibleResults =
        results.filter(result =>
            result.recommendationEligibility !== "eligible"
        );

    const groupName =
        mode === "entrance"
            ? "[ENTRANCE RECOMMENDATION FILTER]"
            : "[EXIT RECOMMENDATION FILTER]";

    console.group(groupName);
    console.log("全候補数:", results.length);
    console.log("eligible候補数:", eligibleResults.length);
    console.log("weak候補数:", weakResults.length);
    console.log(
        "おすすめ選定対象:",
        eligibleResults.length > 0
            ? "eligible候補のみ"
            : "eligibleなしのため全候補"
    );

    if (eligibleResults.length === 0) {
        console.log(
            "eligible候補なしのため弱い候補から選定"
        );
    }

    console.log(
        "最終おすすめIC:",
        bestResult?.candidateIcName || "なし"
    );
    console.log(
        "弱扱い候補:",
        nonEligibleResults.length > 0
            ? nonEligibleResults
                .map(result =>
                    result.candidateIcName +
                    ": " +
                    (result.weakReason || "理由不明")
                )
                .join(" / ")
            : "なし"
    );
    console.groupEnd();
}

async function searchEntranceIcComparisonV2(options = {}) {

    const origin =
        options.origin ??
        document.getElementById("origin")?.value ??
        "";

    const destination =
        options.destination ??
        document.getElementById("destination")?.value ??
        "";

    const selectedExits =
        options.selectedExits ?? [];

    const routeOrigin =
        getRouteOriginForMultiExitComparison(origin);

    lastMultiIcV2Results = [];

    let allLocalMinutes = null;
    let allLocalDistanceKm = null;
    let allLocalError = null;

    try {

        const allLocalRoute =
            await getLocalRouteForMultiExitComparison(
                routeOrigin,
                destination
            );

        allLocalMinutes =
            getRouteDurationMinutes(allLocalRoute);

        allLocalDistanceKm =
            allLocalRoute.distanceMeters / 1000;

    } catch (error) {

        allLocalError =
            error.message || String(error);

        console.warn(
            "V2 all local route failed",
            allLocalError
        );
    }

    for (const exit of selectedExits) {

        try {

            const localToCandidateRoute =
                await getLocalRouteForMultiExitComparison(
                    routeOrigin,
                    exit.googleName,
                    "entrance"
                );

            const highwayFromCandidateRoute =
                await getHighwayRouteForMultiExitComparison(
                    exit.googleName,
                    destination,
                    "entrance"
                );

            const localToCandidateMinutes =
                getRouteDurationMinutes(
                    localToCandidateRoute
                );

            const highwayFromCandidateMinutes =
                getRouteDurationMinutes(
                    highwayFromCandidateRoute
                );

            const totalMinutes =
                localToCandidateMinutes +
                highwayFromCandidateMinutes;

            const totalDistanceKm =
                (
                    localToCandidateRoute.distanceMeters +
                    highwayFromCandidateRoute.distanceMeters
                ) / 1000;

            const endIc =
                findIcDefinitionForMultiExitComparison(
                    lastTollEndIcGoogleName
                );

            const estimatedToll =
                await estimateComparisonCandidateToll({
                    startIc: exit,
                    endIc: endIc,
                    startGoogleName: exit.googleName,
                    endGoogleName: lastTollEndIcGoogleName,
                    fallbackDistanceMeters:
                        highwayFromCandidateRoute.distanceMeters,
                    polylineAnalysis:
                        lastHighwayRoutePolylineAnalysis
                });

            // 料金目安の内訳表示用。距離計算をやり直さず、
            // 既知のestimatedToll/shutoTollから他道路分を逆算する。
            const shutoToll =
                getShutoTollEstimateForIcPair(
                    exit,
                    endIc,
                    (
                        lastHighwayRoutePolylineAnalysis
                            ?.hasTollSectionStepsData
                            ? lastHighwayRoutePolylineAnalysis
                                .tollEntryCount
                            : lastHighwayRoutePolylineAnalysis
                                ?.shutoEntryCount
                    ) ??
                        (
                            (
                                isShutoIc(exit) ||
                                isShutoIc(endIc)
                            )
                                ? 1
                                : 0
                        )
                );

            const nonShutoToll =
                Math.max(
                    0,
                    estimatedToll - shutoToll
                );

            const differenceFromAllLocal =
                allLocalMinutes === null
                    ? null
                    : allLocalMinutes - totalMinutes;

            const yenPerSavedMinute =
                differenceFromAllLocal > 0
                    ? Math.round(
                        estimatedToll /
                        differenceFromAllLocal
                    )
                    : null;

            const result = {
                candidateIcName: exit.displayName,
                candidateIcGoogleName: exit.googleName,
                localToCandidateMinutes:
                    localToCandidateMinutes,
                highwayFromCandidateMinutes:
                    highwayFromCandidateMinutes,
                totalMinutes: totalMinutes,
                totalDistanceKm: totalDistanceKm,
                estimatedToll: estimatedToll,
                shutoToll: shutoToll,
                nonShutoToll: nonShutoToll,
                tollLabel:
                    exit &&
                    lastTollEndIc
                        ? formatTollRouteLabel(
                            exit,
                            lastTollEndIc
                        )
                        : "",
                allLocalMinutes: allLocalMinutes,
                allLocalDistanceKm: allLocalDistanceKm,
                differenceFromAllLocal:
                    differenceFromAllLocal,
                yenPerSavedMinute: yenPerSavedMinute,
                minutesToCandidate:
                    localToCandidateMinutes,
                baselineError: allLocalError,
                error: null
            };

            result.recommendScoreDetail =
                calculateEntranceRecommendScoreDetailV2(result);

            result.recommendScore =
                calculateEntranceRecommendScoreV2(result);

            lastMultiIcV2Results.push(result);

        } catch (error) {

            lastMultiIcV2Results.push({
                candidateIcName: exit.displayName,
                candidateIcGoogleName: exit.googleName,
                localToCandidateMinutes: null,
                highwayFromCandidateMinutes: null,
                totalMinutes: null,
                totalDistanceKm: null,
                estimatedToll: null,
                shutoToll: null,
                nonShutoToll: null,
                tollLabel:
                    exit &&
                    lastTollEndIc
                        ? formatTollRouteLabel(
                            exit,
                            lastTollEndIc
                        )
                        : "",
                allLocalMinutes: allLocalMinutes,
                allLocalDistanceKm: allLocalDistanceKm,
                differenceFromAllLocal: null,
                yenPerSavedMinute: null,
                minutesToCandidate: null,
                baselineError: allLocalError,
                error: error.message || String(error),
                recommendScore: null,
                recommendScoreDetail: null
            });
        }
    }

    lastMultiIcV2Results.forEach(result => {
        Object.assign(
            result,
            evaluateEntranceCandidateEligibility(result)
        );
    });

    logEntranceComparisonResultSummary(
        lastMultiIcV2Results
    );

    logComparisonRecommendationFilter(
        "entrance",
        lastMultiIcV2Results,
        getBestEntranceIcV2(lastMultiIcV2Results)
    );

    if (DEBUG_ROUTE_VERBOSE) {
        console.log(
            "複数IC比較V2 entrance results",
            lastMultiIcV2Results
        );

        console.table(lastMultiIcV2Results);
    }

    displayEntranceIcComparisonV2Results(
        lastMultiIcV2Results
    );

    updateDashboardWithBestEntranceIcV2();

    saveDestinationTestComparisonResults(
        "entrance",
        lastMultiIcV2Results
    );
    logDestinationTestSummary();
}

async function searchExitIcComparisonV2(options = {}) {

    const origin =
        options.origin ??
        document.getElementById("origin")?.value ??
        "";

    const destination =
        options.destination ??
        document.getElementById("destination")?.value ??
        "";

    const selectedExits =
        options.selectedExits ?? [];

    const routeOrigin =
        getRouteOriginForMultiExitComparison(origin);

    lastExitIcV2Results = [];

    let allHighwayMinutes = null;
    let allHighwayDistanceKm = null;
    let allHighwayToll = null;
    let baselineError = null;

    try {

        const allHighwayRoute =
            await getHighwayRouteForMultiExitComparison(
                routeOrigin,
                destination
            );

        allHighwayMinutes =
            getRouteDurationMinutes(allHighwayRoute);

        allHighwayDistanceKm =
            allHighwayRoute.distanceMeters / 1000;

        const tollEstimate =
            await estimateMainHighwayToll(
                allHighwayRoute,
                origin,
                destination,
                null,
                lastHighwayRoutePolylineAnalysis
            );

        allHighwayToll =
            tollEstimate.amount;

    } catch (error) {

        baselineError =
            error.message || String(error);

        console.warn(
            "V2 all highway route failed",
            baselineError
        );
    }

    for (const exit of selectedExits) {

        try {

            const highwayToCandidateRoute =
                await getHighwayRouteForMultiExitComparison(
                    routeOrigin,
                    exit.googleName,
                    "exit"
                );

            const localFromCandidateRoute =
                await getLocalRouteForMultiExitComparison(
                    exit.googleName,
                    destination,
                    "exit"
                );

            const highwayToCandidateMinutes =
                getRouteDurationMinutes(
                    highwayToCandidateRoute
                );

            const localFromCandidateMinutes =
                getRouteDurationMinutes(
                    localFromCandidateRoute
                );

            const totalMinutes =
                highwayToCandidateMinutes +
                localFromCandidateMinutes;

            const totalDistanceKm =
                (
                    highwayToCandidateRoute.distanceMeters +
                    localFromCandidateRoute.distanceMeters
                ) / 1000;

            const startIc =
                findIcDefinitionForMultiExitComparison(
                    lastTollStartIcGoogleName
                );

            const exitTollEstimate =
                await estimateComparisonCandidateToll({
                    startIc: startIc,
                    endIc: exit,
                    startGoogleName: lastTollStartIcGoogleName,
                    endGoogleName: exit.googleName,
                    fallbackDistanceMeters:
                        highwayToCandidateRoute.distanceMeters,
                    polylineAnalysis:
                        lastHighwayRoutePolylineAnalysis
                });

            const savedToll =
                allHighwayToll === null
                    ? null
                    : allHighwayToll - exitTollEstimate;

            const differenceFromAllHighway =
                allHighwayMinutes === null
                    ? null
                    : totalMinutes - allHighwayMinutes;

            const yenPerDelayedMinute =
                savedToll !== null &&
                    differenceFromAllHighway > 0
                    ? Math.round(
                        savedToll /
                        differenceFromAllHighway
                    )
                    : null;

            const result = {
                candidateIcName: exit.displayName,
                candidateIcGoogleName: exit.googleName,
                highwayToCandidateMinutes:
                    highwayToCandidateMinutes,
                localFromCandidateMinutes:
                    localFromCandidateMinutes,
                totalMinutes: totalMinutes,
                totalDistanceKm: totalDistanceKm,
                minutesToCandidate:
                    highwayToCandidateMinutes,
                allHighwayMinutes: allHighwayMinutes,
                allHighwayDistanceKm: allHighwayDistanceKm,
                allHighwayToll: allHighwayToll,
                exitTollEstimate: exitTollEstimate,
                tollLabel:
                    startIc &&
                    exit
                        ? formatTollRouteLabel(
                            startIc,
                            exit
                        )
                        : "",
                savedToll: savedToll,
                differenceFromAllHighway:
                    differenceFromAllHighway,
                yenPerDelayedMinute:
                    yenPerDelayedMinute,
                baselineError: baselineError,
                error: null
            };

            result.recommendScoreDetail =
                calculateExitRecommendScoreDetailV2(result);

            result.recommendScore =
                calculateExitRecommendScoreV2(result);

            result.totalValueScore =
                calculateExitTotalValueScoreV2(result);

            lastExitIcV2Results.push(result);

        } catch (error) {

            lastExitIcV2Results.push({
                candidateIcName: exit.displayName,
                candidateIcGoogleName: exit.googleName,
                highwayToCandidateMinutes: null,
                localFromCandidateMinutes: null,
                totalMinutes: null,
                totalDistanceKm: null,
                minutesToCandidate: null,
                allHighwayMinutes: allHighwayMinutes,
                allHighwayDistanceKm: allHighwayDistanceKm,
                allHighwayToll: allHighwayToll,
                exitTollEstimate: null,
                savedToll: null,
                differenceFromAllHighway: null,
                yenPerDelayedMinute: null,
                baselineError: baselineError,
                error: error.message || String(error),
                recommendScore: null,
                recommendScoreDetail: null,
                totalValueScore: null
            });
        }
    }

    lastExitIcV2Results.forEach(result => {
        Object.assign(
            result,
            evaluateExitCandidateEligibility(result)
        );
    });

    logExitComparisonResultSummary(
        lastExitIcV2Results
    );

    logComparisonRecommendationFilter(
        "exit",
        lastExitIcV2Results,
        getBestExitIcV2(lastExitIcV2Results)
    );

    if (DEBUG_ROUTE_VERBOSE) {
        console.log(
            "複数IC比較V2 exit results",
            lastExitIcV2Results
        );

        console.table(lastExitIcV2Results);
    }

    displayExitIcComparisonV2Results(
        lastExitIcV2Results
    );

    updateDashboardWithBestExitIcV2();

    saveDestinationTestComparisonResults(
        "exit",
        lastExitIcV2Results
    );
    logDestinationTestSummary();
}

function getRouteDurationMinutes(route) {

    return Math.round(
        parseInt(
            route.duration.replace("s", "")
        ) / 60
    );
}

function calculateEntranceRecommendScoreV2(result) {

    const detail =
        calculateEntranceRecommendScoreDetailV2(result);

    if (!detail) {
        return null;
    }

    return (
        detail.savedTimeScore +
        detail.nearScore +
        detail.costScore
    );
}

function calculateEntranceRecommendScoreDetailV2(result) {

    if (
        !result ||
        result.error ||
        result.differenceFromAllLocal <= 0 ||
        result.yenPerSavedMinute === null ||
        result.minutesToCandidate === null
    ) {
        return null;
    }

    return {
        savedTimeScore:
            Math.min(result.differenceFromAllLocal, 60),
        nearScore:
            Math.max(0, 40 - result.minutesToCandidate),
        costScore:
            Math.max(0, 60 - result.yenPerSavedMinute)
    };
}

function calculateExitRecommendScoreV2(result) {

    const detail =
        calculateExitRecommendScoreDetailV2(result);

    if (!detail) {
        return null;
    }

    return (
        detail.savingScore +
        detail.delayScore +
        detail.nearScore +
        detail.efficiencyScore
    );
}

function calculateExitRecommendScoreDetailV2(result) {

    if (
        !result ||
        result.error ||
        result.savedToll <= 0 ||
        result.differenceFromAllHighway <= 0 ||
        result.yenPerDelayedMinute === null ||
        result.minutesToCandidate === null
    ) {
        return null;
    }

    return {
        savingScore:
            Math.min(result.savedToll / 20, 60),
        delayScore:
            Math.max(0, 50 - result.differenceFromAllHighway),
        nearScore:
            Math.max(0, 40 - result.minutesToCandidate),
        efficiencyScore:
            Math.min(result.yenPerDelayedMinute, 60)
    };
}

// 「遅いけど安い」候補と「速くて安い」候補を同じ基準で比較するための総合スコア。
// differenceFromAllHighwayは遅れならプラス、速くなるならマイナス。
function calculateExitTotalValueScoreV2(result) {

    if (
        !result ||
        result.error ||
        result.savedToll === null ||
        result.savedToll === undefined ||
        result.differenceFromAllHighway === null ||
        result.differenceFromAllHighway === undefined
    ) {
        return null;
    }

    return (
        result.savedToll -
        (
            result.differenceFromAllHighway *
            EXIT_TIME_VALUE_YEN_PER_MINUTE
        )
    );
}

function dumpV2TestSummary() {

    const acceptableDelayMinutes =
        getAcceptableDelayMinutes();

    const bestEntrance =
        getBestEntranceIcV2(lastMultiIcV2Results);

    const bestExit =
        getBestExitIcV2(lastExitIcV2Results);

    const lines = [
        "=== V2 TEST SUMMARY ===",
        "現在モード: " + currentMultiIcMode,
        "出発地入力: " + getElementTextOrValue("origin"),
        "目的地入力: " + getElementTextOrValue("destination"),
        "目的地: " + getElementTextOrValue("destination"),
        "許容時間: " + acceptableDelayMinutes + "分",
        "入口おすすめ条件: " +
            acceptableDelayMinutes +
            "分以上短縮",
        "出口おすすめ条件: " +
            acceptableDelayMinutes +
            "分以内の遅れ",
        "判定方式: " + getIcAreaDecisionMethodForLog(),
        "IC候補エリア: " + getElementTextOrValue("icArea"),
        "候補選定理由: " + getElementTextOrValue("candidateReason"),
        "現在地: " + getElementTextOrValue("currentLocation"),
        "最新検索地点: " + getElementTextOrValue("lastSearchLocation"),
        "",
        "--- ENTRANCE MODE ---",
        "おすすめ入口: " +
            (bestEntrance?.candidateIcName || "なし"),
        "おすすめスコア: " +
            (
                bestEntrance?.recommendScore !== undefined &&
                bestEntrance?.recommendScore !== null
                    ? Math.round(bestEntrance.recommendScore)
                    : "--"
            ),
        "候補数: " + lastMultiIcV2Results.length,
        "",
        "--- EXIT MODE ---",
        "おすすめ出口: " +
            (bestExit?.candidateIcName || "なし"),
        "おすすめスコア: " +
            (
                bestExit?.recommendScore !== undefined &&
                bestExit?.recommendScore !== null
                    ? Math.round(bestExit.recommendScore)
                    : "--"
            ),
        "候補数: " + lastExitIcV2Results.length,
        "",
        "--- DASHBOARD ---",
        "dashboardRecommendation: " +
            getElementTextOrValue("dashboardRecommendation"),
        "dashboardReason:\n" +
            getDashboardReasonLogText(),
        "dashboardValueJudge: " +
            getElementTextOrValue("dashboardValueJudge"),
        "dashboardHighway: " +
            getElementTextOrValue("dashboardHighway"),
        "dashboardHighwayDetail: " +
            getElementTextOrValue("dashboardHighwayDetail"),
        "dashboardLocal: " +
            getElementTextOrValue("dashboardLocal"),
        "dashboardLocalDetail: " +
            getElementTextOrValue("dashboardLocalDetail"),
        "dashboardDestination: " +
            getElementTextOrValue("dashboardDestination"),
        "dashboardEfficiency: " +
            getElementTextOrValue("dashboardEfficiency"),
        "dashboardCost: " +
            getElementTextOrValue("dashboardCost")
    ];

    console.log(lines.join("\n"));

    if (lastMultiIcV2Results.length > 0) {
        console.log("--- ENTRANCE MODE TABLE ---");
        console.table(
            lastMultiIcV2Results.map(result => ({
                ic: result.candidateIcName,
                minutesToCandidate:
                    result.minutesToCandidate,
                savedMinutes:
                    result.differenceFromAllLocal,
                toll: result.estimatedToll,
                yenPerSavedMinute:
                    result.yenPerSavedMinute,
                score: result.recommendScore,
                error: result.error
            }))
        );
    }

    if (lastExitIcV2Results.length > 0) {
        console.log("--- EXIT MODE TABLE ---");
        console.table(
            lastExitIcV2Results.map(result => ({
                ic: result.candidateIcName,
                minutesToCandidate:
                    result.minutesToCandidate,
                savedToll: result.savedToll,
                delayMinutes:
                    result.differenceFromAllHighway,
                yenPerDelayedMinute:
                    result.yenPerDelayedMinute,
                score: result.recommendScore,
                error: result.error
            }))
        );
    }
}

async function runV2SimpleDiagnostic() {

    const originInput =
        document.getElementById("origin");

    const destinationInput =
        document.getElementById("destination");

    const diagnosticButton =
        document.getElementById("v2DiagnosticButton");

    const originalOrigin =
        originInput?.value ?? "";

    const originalDestination =
        destinationInput?.value ?? "";

    const originalMode =
        currentMultiIcMode;

    const diagnosticOrigin =
        originalOrigin.trim() || TEST_ORIGIN;

    const acceptableDelayMinutes =
        getAcceptableDelayMinutes();

    if (diagnosticButton) {
        diagnosticButton.disabled = true;
        diagnosticButton.textContent = "V2簡易診断中...";
    }

    console.log(
        [
            "=== V2 SIMPLE DIAGNOSTIC ===",
            "出発地: " + diagnosticOrigin,
            "許容時間: " +
                acceptableDelayMinutes +
                "分",
            "判定方式: " +
                getIcAreaDecisionMethodForLog(),
            "テスト件数: " +
                V2_DIAGNOSTIC_DESTINATIONS.length
        ].join("\n")
    );

    const summaries = [];

    try {

        for (
            let index = 0;
            index < V2_DIAGNOSTIC_DESTINATIONS.length;
            index++
        ) {

            const destination =
                V2_DIAGNOSTIC_DESTINATIONS[index];

            const summary =
                await runV2SimpleDiagnosticForDestination(
                    index + 1,
                    diagnosticOrigin,
                    destination
                );

            summaries.push(summary);

            console.log(
                formatV2SimpleDiagnosticSummary(summary)
            );
        }

        console.log("=== V2 SIMPLE DIAGNOSTIC TABLE ===");
        console.table(
            summaries.map(summary => ({
                destination: summary.destination,
                decisionMethod: summary.decisionMethod,
                icArea: summary.icArea,
                bestEntrance: summary.bestEntranceName,
                entranceScore: summary.entranceScore,
                entranceJudge: summary.entranceJudge,
                bestExit: summary.bestExitName,
                exitScore: summary.exitScore,
                exitJudge: summary.exitJudge
            }))
        );

    } finally {

        if (originInput) {
            originInput.value = originalOrigin;
        }

        if (destinationInput) {
            destinationInput.value = originalDestination;
        }

        setMultiIcModeForDiagnostic(originalMode);

        if (diagnosticButton) {
            diagnosticButton.disabled = false;
            diagnosticButton.textContent = "V2簡易診断";
        }

        console.log(
            "V2簡易診断完了。入力欄とモードは診断前の状態に戻しました。上部パネルは最後の診断結果のままです。"
        );
    }
}

async function runV2SimpleDiagnosticForDestination(
    index,
    origin,
    destination
) {

    const originInput =
        document.getElementById("origin");

    const destinationInput =
        document.getElementById("destination");

    if (originInput) {
        originInput.value = origin;
    }

    if (destinationInput) {
        destinationInput.value = destination;
    }

    const dashboardDestination =
        document.getElementById("dashboardDestination");

    if (dashboardDestination) {
        dashboardDestination.textContent =
            getDestinationDisplayName(destination);
    }

    const summary = {
        index: index,
        origin: origin,
        destination: destination,
        decisionMethod: getIcAreaDecisionMethodForLog(),
        icArea: "--",
        candidateReason: "--",
        bestEntranceName: "なし",
        entranceScore: "--",
        entranceSavedMinutes: "--",
        entranceToll: "--",
        entranceJudge: "未実行",
        bestExitName: "なし",
        exitScore: "--",
        exitSavedToll: "--",
        exitDelayMinutes: "--",
        exitJudge: "未実行",
        entranceDashboard: "",
        exitDashboard: "",
        error: null
    };

    try {

        await getRoutes(origin, destination, true);

        const candidateInfo =
            await prepareV2SimpleDiagnosticCandidates(
                origin,
                destination
            );

        summary.icArea = candidateInfo.icArea;
        summary.decisionMethod =
            candidateInfo.decisionMethod;
        summary.candidateReason =
            candidateInfo.reasonText;

        setMultiIcModeForDiagnostic("entrance");

        await searchEntranceIcComparisonV2({
            origin: origin,
            destination: destination,
            selectedExits: candidateInfo.selectedExits
        });

        const bestEntrance =
            getBestEntranceIcV2(lastMultiIcV2Results);

        const hasEntranceError =
            lastMultiIcV2Results.some(result =>
                Boolean(result.error || result.baselineError)
            );

        summary.bestEntranceName =
            bestEntrance?.candidateIcName || "なし";
        summary.entranceScore =
            formatDiagnosticScore(bestEntrance);
        summary.entranceSavedMinutes =
            bestEntrance
                ? bestEntrance.differenceFromAllLocal + "分"
                : "--";
        summary.entranceToll =
            bestEntrance
                ? bestEntrance.estimatedToll.toLocaleString() +
                "円"
                : "--";
        summary.entranceJudge =
            getV2DiagnosticJudge(
                bestEntrance,
                hasEntranceError,
                "おすすめ入口なし"
            );
        summary.entranceDashboard =
            getV2DiagnosticDashboardText();

        setMultiIcModeForDiagnostic("exit");

        await searchExitIcComparisonV2({
            origin: origin,
            destination: destination,
            selectedExits: candidateInfo.selectedExits
        });

        const bestExit =
            getBestExitIcV2(lastExitIcV2Results);

        const hasExitError =
            lastExitIcV2Results.some(result =>
                Boolean(result.error || result.baselineError)
            );

        summary.bestExitName =
            bestExit?.candidateIcName || "なし";
        summary.exitScore =
            formatDiagnosticScore(bestExit);
        summary.exitSavedToll =
            bestExit
                ? bestExit.savedToll.toLocaleString() + "円"
                : "--";
        summary.exitDelayMinutes =
            bestExit
                ? bestExit.differenceFromAllHighway + "分"
                : "--";
        summary.exitJudge =
            getV2DiagnosticJudge(
                bestExit,
                hasExitError,
                "おすすめ出口なし"
            );
        summary.exitDashboard =
            getV2DiagnosticDashboardText();

    } catch (error) {

        summary.error =
            error.message || String(error);

        summary.entranceJudge = "NG：エラーあり";
        summary.exitJudge = "NG：エラーあり";
    }

    return summary;
}

async function prepareV2SimpleDiagnosticCandidates(
    origin,
    destination
) {

    const icAreaSelect =
        document.getElementById("icArea");

    let icArea =
        icAreaSelect?.value || "joban";

    let distanceOnlyIcAreaInfo = null;
    let destinationLatLng = null;

    const autoIcAreaEnabled =
        document.getElementById("autoIcAreaEnabled")
            ?.checked;

    const originLatLng =
        await getAutoExitComparisonOriginLatLng(origin);

    if (!originLatLng) {
        throw new Error(
            "診断用の出発地座標を取得できませんでした"
        );
    }

    if (autoIcAreaEnabled) {

        if (USE_DISTANCE_ONLY_IC_AREA) {

            destinationLatLng =
                await getLatLngFromAddress(destination);

            if (originLatLng && destinationLatLng) {
                distanceOnlyIcAreaInfo =
                    suggestIcAreaByDistanceOnlyForTest(
                        originLatLng,
                        destinationLatLng
                    );
            }
        }

        if (
            distanceOnlyIcAreaInfo &&
            IC_MASTER[distanceOnlyIcAreaInfo.icArea]
        ) {
            icArea = distanceOnlyIcAreaInfo.icArea;
            lastIcAreaDecisionType = "distance-only";
        }
        else {

            if (ENABLE_KEYWORD_AREA_HINT) {

                const suggestedIcArea =
                    await suggestIcArea(origin, destination);

                if (suggestedIcArea) {
                    icArea = suggestedIcArea;
                }
            }
        }
    }

    setResolvedIcArea(icArea);

    icArea =
        resolveGaikanDirectionalIcArea(
            icArea,
            origin,
            destination
        );

    if (!icArea) {
        throw new Error(
            "外環の走行方向を判定できなかったため、候補ICを算出できませんでした"
        );
    }

    const highwayStartInfo =
        findNearestIcByMasterCoordinatesForAutoExitComparison(
            icArea,
            originLatLng.lat,
            originLatLng.lng,
            "entrance"
        );

    /*
     * 診断中は出発地入力を前提にしているため、取得済み座標を使って
     * 追加のジオコードを避ける。
     */
    if (!highwayStartInfo) {
        throw new Error(
            "高速起点にできるIC/出入口が見つかりませんでした"
        );
    }

    const highwayStart =
        highwayStartInfo.exit;

    lastNearestIcName =
        highwayStart.displayName;
    lastNearestIcDistanceKm =
        highwayStartInfo.distanceKm;
    lastTollStartIcName =
        highwayStart.displayName;
    lastTollStartIc =
        highwayStart;
    lastTollStartIcGoogleName =
        highwayStart.googleName;
    lastTollStartIcOrder =
        highwayStart.order ?? null;

    if (!destinationLatLng) {
        destinationLatLng =
            await getLatLngFromAddress(destination);
    }

    const destinationNearestInfo =
        destinationLatLng
            ? findNearestIcByMasterCoordinatesForAutoExitComparison(
                icArea,
                destinationLatLng.lat,
                destinationLatLng.lng,
                "exit"
            )
            : null;

    const destinationNearestIc =
        destinationNearestInfo
            ? {
                displayName:
                    destinationNearestInfo.exit.displayName,
                googleName:
                    destinationNearestInfo.exit.googleName,
                order:
                    destinationNearestInfo.exit.order ?? null,
                roadType:
                    destinationNearestInfo.exit.roadType,
                distanceKm:
                    destinationNearestInfo.distanceKm
            }
            : null;

    if (destinationNearestIc) {
        lastTollEndIcName =
            destinationNearestIc.displayName;
        lastTollEndIc =
            destinationNearestIc;
        lastTollEndIcGoogleName =
            destinationNearestIc.googleName;
        lastTollEndIcOrder =
            destinationNearestIc.order;
    } else {
        lastTollEndIc =
            null;
    }

    const selectedExits =
        selectExitCandidatesForAutoExitComparison(
            icArea,
            highwayStart,
            destinationNearestIc,
            getActiveIcCandidateCount(),
            originLatLng
        );

    const endIcName =
        selectedExits[selectedExits.length - 1]
            ? selectedExits[selectedExits.length - 1]
                .displayName
            : "なし";

    let reasonText =
        "高速起点：" +
        highwayStart.displayName +
        " / 比較対象：" +
        (
            selectedExits[0]
                ? selectedExits[0].displayName
                : "なし"
        ) +
        "〜" +
        endIcName +
        " / 最寄り：" +
        lastNearestIcName +
        "（約" +
        lastNearestIcDistanceKm +
        "km）";

    if (distanceOnlyIcAreaInfo) {
        reasonText +=
            " / 方面判定：距離だけ方式" +
            " / 距離合計：約" +
            distanceOnlyIcAreaInfo.score +
            "km";
    }

    if (destinationNearestIc) {
        reasonText +=
            " / 目的地側IC：" +
            destinationNearestIc.displayName;
    }

    const savingModeLabel =
        DEV_API_SAVING_MODE
            ? "（API節約モード）"
            : "";

    reasonText +=
        " / 候補選定：" +
        highwayStart.displayName +
        "から" +
        selectedExits.length +
        "件比較" +
        savingModeLabel;

    if (selectedExits.length === 0) {
        reasonText =
            "比較対象ICが見つかりません。IC候補エリアを手動で変更してください";
    }

    updateSearchConditionPolylineAnalysis(
        origin,
        destination
    );

    const candidateReason =
        document.getElementById("candidateReason");

    if (candidateReason) {
        candidateReason.textContent = reasonText;
    }

    const candidateReasonDebug =
        document.getElementById("candidateReasonDebug");

    if (candidateReasonDebug) {
        candidateReasonDebug.textContent = reasonText;
    }

    const exitIcList =
        document.getElementById("exitIcList");

    if (exitIcList) {
        exitIcList.value =
            selectedExits
                .map(exit => exit.googleName)
                .join(", ");
    }

    return {
        icArea: icArea,
        decisionMethod: getIcAreaDecisionMethodForLog(),
        reasonText: reasonText,
        selectedExits: selectedExits
    };
}

function formatV2SimpleDiagnosticSummary(summary) {

    const lines = [
        "--- " +
            summary.index +
            ". " +
            summary.destination +
            " ---",
        "判定方式: " + summary.decisionMethod,
        "IC候補エリア: " + summary.icArea,
        "候補選定理由: " + summary.candidateReason,
        "おすすめ入口: " + summary.bestEntranceName,
        "入口スコア: " + summary.entranceScore,
        "入口短縮: " + summary.entranceSavedMinutes,
        "入口ETC: " + summary.entranceToll,
        "入口判定: " + summary.entranceJudge,
        "",
        "おすすめ出口: " + summary.bestExitName,
        "出口スコア: " + summary.exitScore,
        "出口節約: " + summary.exitSavedToll,
        "出口遅れ: " + summary.exitDelayMinutes,
        "出口判定: " + summary.exitJudge,
        "",
        "入口上部パネル:",
        summary.entranceDashboard || "--",
        "",
        "出口上部パネル:",
        summary.exitDashboard || "--"
    ];

    if (summary.error) {
        lines.push("", "エラー: " + summary.error);
    }

    return lines.join("\n");
}

function formatDiagnosticScore(result) {

    if (
        !result ||
        result.recommendScore === null ||
        result.recommendScore === undefined
    ) {
        return "--";
    }

    return Math.round(result.recommendScore);
}

function getV2DiagnosticJudge(
    best,
    hasError,
    emptyMessage
) {

    if (hasError) {
        return "NG：エラーあり";
    }

    if (best) {
        return "OK";
    }

    return "注意：" + emptyMessage;
}

function getV2DiagnosticDashboardText() {

    return [
        "recommendation=" +
            getElementTextOrValue("dashboardRecommendation"),
        "reason=" +
            getDashboardReasonLogText()
                .replace(/\n/g, " / "),
        "value=" +
            getElementTextOrValue("dashboardValueJudge"),
        "highway=" +
            getElementTextOrValue("dashboardHighway"),
        "local=" +
            getElementTextOrValue("dashboardLocal")
    ].join("\n");
}

function setMultiIcModeForDiagnostic(mode) {

    currentMultiIcMode = mode;

    const input =
        document.querySelector(
            "input[name='multiIcMode'][value='" +
            mode +
            "']"
        );

    if (input) {
        input.checked = true;
    }

    const description =
        document.getElementById("multiIcModeDescription");

    if (description) {
        description.textContent =
            mode === "entrance"
                ? "おすすめ入口を探す準備中"
                : "おすすめ出口を探す準備中";
    }
}

function getDashboardReasonLogText() {

    const element =
        document.getElementById("dashboardReason");

    if (!element) {
        return "";
    }

    const lines = [];

    collectTextLinesFromNode(element, lines);

    return lines
        .map(text => text.trim())
        .filter(text => text.length > 0)
        .join("\n");
}

function collectTextLinesFromNode(node, lines) {

    if (node.nodeType === Node.TEXT_NODE) {
        const text =
            node.textContent.trim();

        if (text) {
            lines.push(text);
        }

        return;
    }

    if (node.nodeName === "BR") {
        return;
    }

    if (
        node.nodeType === Node.ELEMENT_NODE &&
        node.classList?.contains("v2-best-time-badge")
    ) {
        const text =
            node.textContent
                .replace(/\s+/g, " ")
                .replace("◷", "◷ ")
                .trim();

        if (text) {
            lines.push(text);
        }

        return;
    }

    if (!node.childNodes || node.childNodes.length === 0) {
        const text =
            node.textContent?.trim();

        if (text) {
            lines.push(text);
        }

        return;
    }

    node.childNodes.forEach(child =>
        collectTextLinesFromNode(child, lines)
    );
}

function getElementTextOrValue(id) {

    const element =
        document.getElementById(id);

    if (!element) {
        return "";
    }

    if (
        "value" in element &&
        element.value !== undefined &&
        element.value !== ""
    ) {
        return element.value;
    }

    return element.textContent.trim();
}

function getAcceptableDelayMinutes() {

    const input =
        document.getElementById("acceptableDelay");

    const value =
        parseInt(input?.value, 10);

    if (Number.isNaN(value)) {
        return 30;
    }

    return Math.max(0, value);
}

function displayExitIcComparisonV2Results(results) {

    const resultArea =
        document.getElementById("multiExitIcResult");

    if (!resultArea) {
        return;
    }

    if (
        !Array.isArray(results) ||
        results.length === 0
    ) {
        resultArea.textContent =
            "V2出口比較結果がありません";
        return;
    }

    // 候補選定時のPolyline進行方向順を、そのままカード表示に使う。
    // おすすめ判定は別処理のため、この表示順では並べ替えない。
    const roadOrderResults =
        results.slice();

    const normalExitIcName =
        getNormalHighwayExitIcName();

    const normalExitHtml =
        normalExitIcName
            ? "<div class=\"v2-normal-exit\">" +
                "通常出口：<strong>" +
                escapeHtml(normalExitIcName) +
                "</strong></div>"
            : "";

    resultArea.innerHTML =
        normalExitHtml +
        buildBestExitIcV2Html(results) +
        "<div class=\"v2-exit-result-list\">" +
        roadOrderResults
            .map(result =>
                buildExitIcComparisonV2CardHtml(result)
            )
            .join("") +
        "</div>";
}

const bestIcV2DebugLoggedResults = {
    entrance: new WeakSet(),
    exit: new WeakSet()
};

function summarizeRecommendScoreDetail(detail) {
    if (!detail) {
        return "";
    }

    const summary =
        typeof detail === "string"
            ? detail
            : Object.entries(detail)
                .map(([key, value]) =>
                    key + ":" + String(value)
                )
                .join(" / ");

    return summary.length > 100
        ? summary.slice(0, 100) + "..."
        : summary;
}

function getBestIcV2ExclusionReason(
    mode,
    result,
    inRecommendationPool,
    acceptableDelayMinutes
) {
    if (!inRecommendationPool) {
        return "eligible候補を優先したためpool外";
    }

    if (result.error) {
        return "計算エラー";
    }

    if (mode === "entrance") {
        if (!(result.differenceFromAllLocal > 0)) {
            return "differenceFromAllLocalが0以下";
        }
        if (
            !(
                result.differenceFromAllLocal >=
                MIN_ENTRANCE_RECOMMEND_SAVED_MINUTES
            )
        ) {
            return "短縮時間が入口おすすめ最低短縮分未満";
        }
        if (result.yenPerSavedMinute === null) {
            return "yenPerSavedMinuteがnull";
        }
    }
    else {
        if (result.recommendationEligibility !== "eligible") {
            return (
                "recommendationEligibilityがeligibleでない（" +
                (result.weakReason || "理由不明") +
                "）"
            );
        }
        if (result.totalValueScore === null) {
            return "totalValueScoreがnull";
        }

        return "なし";
    }

    if (result.recommendScore === null) {
        return "recommendScoreがnull";
    }

    return "なし";
}

function logBestIcV2Debug({
    mode,
    results,
    eligibleResults,
    recommendationPool,
    candidates,
    bestResult,
    acceptableDelayMinutes
}) {
    if (bestIcV2DebugLoggedResults[mode].has(results)) {
        return;
    }

    bestIcV2DebugLoggedResults[mode].add(results);

    const recommendationPoolSet =
        new Set(recommendationPool);

    const finalCandidateSet = new Set(candidates);

    const candidateRows = results.map(result => {
        const inRecommendationPool =
            recommendationPoolSet.has(result);

        const comparisonValues =
            mode === "entrance"
                ? {
                    differenceFromAllLocal:
                        result.differenceFromAllLocal,
                    yenPerSavedMinute:
                        result.yenPerSavedMinute,
                    estimatedToll:
                        result.estimatedToll
                }
                : {
                    savedToll: result.savedToll,
                    differenceFromAllHighway:
                        result.differenceFromAllHighway,
                    yenPerDelayedMinute:
                        result.yenPerDelayedMinute
                };

        return {
            candidateIcName: result.candidateIcName,
            eligibility:
                result.recommendationEligibility,
            weakReason: result.weakReason || "",
            ...comparisonValues,
            recommendScore: result.recommendScore,
            scoreDetailSummary:
                summarizeRecommendScoreDetail(
                    result.recommendScoreDetail
                ),
            inRecommendationPool,
            inFinalCandidates:
                finalCandidateSet.has(result),
            exclusionReason:
                getBestIcV2ExclusionReason(
                    mode,
                    result,
                    inRecommendationPool,
                    acceptableDelayMinutes
                )
        };
    });

    const poolExclusionReasons = [
        ...new Set(
            candidateRows
                .filter(row =>
                    row.inRecommendationPool &&
                    !row.inFinalCandidates
                )
                .map(row => row.exclusionReason)
        )
    ];

    let noBestReason = "なし";

    if (!bestResult) {
        if (results.length === 0) {
            noBestReason = "results自体が空";
        }
        else if (recommendationPool.length === 0) {
            noBestReason =
                "bestResult計算前に候補が0件";
        }
        else if (candidates.length === 0) {
            noBestReason =
                (
                    eligibleResults.length > 0
                        ? "eligible候補はあるが、"
                        : "recommendationPoolはあるが、"
                ) +
                "getBest内の絞り込み後 candidates が空" +
                (
                    poolExclusionReasons.length > 0
                        ? "（" +
                            poolExclusionReasons.join(" / ") +
                            "）"
                        : ""
                );
        }
    }

    console.group(
        mode === "entrance"
            ? "[ENTRANCE BEST DEBUG]"
            : "[EXIT BEST DEBUG]"
    );
    console.log("全results件数:", results.length);
    console.log(
        "eligibleResults件数:",
        eligibleResults.length
    );
    console.log(
        "recommendationPool件数:",
        recommendationPool.length
    );
    console.log("candidates件数:", candidates.length);
    console.log(
        "最終bestResult:",
        bestResult?.candidateIcName || "なし"
    );
    console.log(
        "bestResultなし推定理由:",
        noBestReason
    );
    console.table(candidateRows);
    console.groupEnd();
}

function getBestExitIcV2(results) {

    if (!Array.isArray(results)) {
        return null;
    }

    const acceptableDelayMinutes =
        getAcceptableDelayMinutes();

    const eligibleResults =
        results.filter(result =>
            result.recommendationEligibility === "eligible"
        );

    const recommendationPool =
        eligibleResults.length > 0
            ? eligibleResults
            : results;

    const candidates =
        recommendationPool
            .filter(result =>
                result.recommendationEligibility ===
                    "eligible" &&
                result.totalValueScore !== null
            )
            .sort((a, b) => {

                if (
                    a.totalValueScore !==
                    b.totalValueScore
                ) {
                    return (
                        b.totalValueScore -
                        a.totalValueScore
                    );
                }

                if (
                    a.differenceFromAllHighway !==
                    b.differenceFromAllHighway
                ) {
                    return (
                        a.differenceFromAllHighway -
                        b.differenceFromAllHighway
                    );
                }

                return (
                    a.minutesToCandidate -
                    b.minutesToCandidate
                );
            });

    const bestResult = candidates[0] || null;

    logBestIcV2Debug({
        mode: "exit",
        results,
        eligibleResults,
        recommendationPool,
        candidates,
        bestResult,
        acceptableDelayMinutes
    });

    return bestResult;
}

function getReferenceExitIcV2(results) {

    if (!Array.isArray(results)) {
        return null;
    }

    const lowEfficiencyCandidates =
        results
            .filter(result =>
                result.recommendationEligibility === "reference"
            )
            .sort((a, b) => {

                const scoreA = a.recommendScore ?? -Infinity;
                const scoreB = b.recommendScore ?? -Infinity;

                if (scoreA !== scoreB) {
                    return scoreB - scoreA;
                }

                return (
                    a.differenceFromAllHighway -
                    b.differenceFromAllHighway
                );
            });

    if (lowEfficiencyCandidates.length > 0) {
        return lowEfficiencyCandidates[0];
    }

    const candidates =
        results
            .filter(result =>
                !result.error &&
                result.totalMinutes !== null &&
                result.totalMinutes !== undefined &&
                result.allHighwayMinutes !== null &&
                result.allHighwayMinutes !== undefined
            )
            .sort((a, b) => {

                if (
                    a.differenceFromAllHighway !==
                    b.differenceFromAllHighway
                ) {
                    return (
                        a.differenceFromAllHighway -
                        b.differenceFromAllHighway
                    );
                }

                return a.totalMinutes - b.totalMinutes;
            });

    return candidates[0] || null;
}

function buildBestExitIcV2Html(results) {

    const best =
        getBestExitIcV2(results);

    if (!best) {
        return (
            "<div class=\"v2-best-exit-card v2-best-exit-empty\">" +
            "<div class=\"v2-best-exit-label\">おすすめ出口なし</div>" +
            "<div class=\"v2-best-exit-detail\">" +
            "この条件では高速継続がよさそうです" +
            "</div>" +
            "</div>"
        );
    }

    const icName =
        escapeHtml(best.candidateIcName || "--");

    return (
        "<div class=\"v2-best-exit-card\">" +
        "<div class=\"v2-best-exit-label\">おすすめ出口</div>" +
        "<div class=\"v2-best-exit-name\">" +
        icName +
        "</div>" +
        "<div class=\"v2-best-exit-detail\">" +
        best.savedToll.toLocaleString() +
        "円節約" +
        " / " +
        best.differenceFromAllHighway +
        "分遅い" +
        "<div class=\"v2-best-unit\">" +
        best.yenPerDelayedMinute.toLocaleString() +
        "円/分" +
        "</div>" +
        "</div>" +
        "</div>"
    );
}

function buildExitIcComparisonV2CardHtml(result) {

    const hasError = Boolean(result.error);

    const isWeakCandidate =
        result.recommendationEligibility === "weak";

    const isReferenceCandidate =
        result.recommendationEligibility === "reference";

    const hasNoSaving =
        !hasError &&
        result.savedToll !== null &&
        result.savedToll <= 0;

    const acceptableDelayMinutes =
        getAcceptableDelayMinutes();

    const isExitOverThreshold =
        !hasError &&
        result.savedToll > 0 &&
        result.differenceFromAllHighway >
            acceptableDelayMinutes;

    const classNames = [
        "v2-exit-result-card",
        hasNoSaving ? "v2-exit-no-saving" : "",
        isExitOverThreshold ? "v2-exit-excluded" : "",
        isWeakCandidate ? "weak-comparison-candidate" : "",
        isReferenceCandidate ? "v2-exit-reference-candidate" : "",
        hasError ? "v2-exit-error" : ""
    ]
        .filter(Boolean)
        .join(" ");

    const icName =
        escapeHtml(result.candidateIcName || "--");

    if (hasError) {
        return (
            "<div class=\"" + classNames + "\">" +
            "<div class=\"v2-exit-name\">" +
            icName +
            "</div>" +
            "<div class=\"v2-exit-main v2-exit-main-error\">取得失敗</div>" +
            "<div class=\"v2-exit-detail\">" +
            escapeHtml(result.error) +
            "</div>" +
            "</div>"
        );
    }

    const delayText =
        formatExitV2DelayText(
            result.differenceFromAllHighway
        );

    const savingText =
        formatExitV2SavingText(result.savedToll);

    const tollBreakdownText =
        formatExitV2TollBreakdownText(
            result.allHighwayToll,
            result.exitTollEstimate
        );

    const yenPerDelayedMinuteText =
        result.yenPerDelayedMinute === null ||
            result.savedToll <= 0
            ? ""
            : "<br>" +
            result.yenPerDelayedMinute.toLocaleString() +
            "円/分";

    const excludedNote =
        isExitOverThreshold
            ? "<div class=\"v2-exit-excluded-note\">" +
            "遅れ超過：許容" +
            acceptableDelayMinutes +
            "分に対して" +
            result.differenceFromAllHighway +
            "分遅い" +
            "</div>"
            : "";

    const weakCandidateNote =
        isWeakCandidate
            ? "<div class=\"weak-comparison-note\">" +
                "※おすすめ対象外: " +
                escapeHtml(result.weakReason || "理由不明") +
                "</div>"
            : "";

    const valueNote =
        result.valueNote
            ? "<div class=\"v2-exit-value-note\">" +
                escapeHtml(result.valueNote) +
                "</div>"
            : "";

    return (
        "<div class=\"" + classNames + "\">" +
        "<div class=\"v2-exit-name\">" +
        icName +
        "</div>" +
        "<div class=\"v2-exit-main\">" +
        "出口まで" +
        result.minutesToCandidate +
        "分" +
        "</div>" +
        "<div class=\"v2-exit-detail\">" +
        delayText +
        "<br>" +
        savingText +
        tollBreakdownText +
        yenPerDelayedMinuteText +
        "<br>合計" +
        formatV2Duration(result.totalMinutes) +
        excludedNote +
        valueNote +
        weakCandidateNote +
        "</div>" +
        "</div>"
    );
}

function formatExitV2DelayText(differenceFromAllHighway) {

    if (differenceFromAllHighway === null) {
        return "全高速との差分不明";
    }

    if (differenceFromAllHighway > 0) {
        return differenceFromAllHighway + "分遅い";
    }

    if (differenceFromAllHighway < 0) {
        return (
            "遅くならない<br>" +
            Math.abs(differenceFromAllHighway) +
            "分早い"
        );
    }

    return "遅くならない<br>全高速と同等";
}

function formatExitV2SavingText(savedToll) {

    if (savedToll === null) {
        return "節約額不明";
    }

    if (savedToll > 0) {
        return savedToll.toLocaleString() + "円節約";
    }

    if (savedToll < 0) {
        return Math.abs(savedToll).toLocaleString() + "円高い";
    }

    return "0円節約";
}

function formatExitV2TollBreakdownText(allHighwayToll, exitTollEstimate) {

    if (
        allHighwayToll === null ||
        allHighwayToll === undefined ||
        exitTollEstimate === null ||
        exitTollEstimate === undefined
    ) {
        return "";
    }

    return (
        "<br>料金目安：通常 約" +
        allHighwayToll.toLocaleString() +
        "円 / この出口 約" +
        exitTollEstimate.toLocaleString() +
        "円"
    );
}

// getOrBuildEntranceIcSequenceWithUnresolvedMarkersが返す完全なシーケンス
// （実ICと未確定インターチェンジマーカーが混在）を、実際にAPI呼び出しした
// results（selectedExitsの走行順そのまま）と位置合わせし、候補カードの間に
// 未確定マーカーを挟み込むための表示アイテム列を組み立てる。
// resultsは、シーケンス先頭側の実ICエントリと順序・内容が一致する前提
// （同じキャッシュ済みデータ・同じ順序から導出されているため）。前提が
// 崩れている場合（件数不一致・シーケンス取得不可等）は安全側に倒し、
// マーカーなしでresultsをそのままカード化したリストを返す
// （フォールバック、従来通りの表示）。
function buildEntranceCandidateDisplayItems(
    results,
    polylineAnalysis
) {

    const fallbackItems =
        results.map(result => ({
            type: "card",
            result
        }));

    const sequence =
        polylineAnalysis
            ? getOrBuildEntranceIcSequenceWithUnresolvedMarkers(
                polylineAnalysis
            )
            : [];

    if (!Array.isArray(sequence) || sequence.length === 0) {
        return fallbackItems;
    }

    const items = [];
    let resultIndex = 0;

    for (const entry of sequence) {

        if (resultIndex >= results.length) {
            break;
        }

        if (entry.isUnresolved === true) {
            if (resultIndex > 0) {
                items.push({
                    type: "marker",
                    label: entry.label
                });
            }

            continue;
        }

        items.push({
            type: "card",
            result: results[resultIndex]
        });

        resultIndex++;
    }

    if (resultIndex !== results.length) {
        return fallbackItems;
    }

    return items;
}

function displayEntranceIcComparisonV2Results(results) {

    const resultArea =
        document.getElementById("multiExitIcResult");

    if (!resultArea) {
        return;
    }

    if (
        !Array.isArray(results) ||
        results.length === 0
    ) {
        resultArea.textContent =
            "V2比較結果がありません";
        return;
    }

    // 候補選定時の走行順（passedIcEntriesベース）を、そのままカード表示に使う。
    // おすすめ判定は別処理のため、この表示順では並べ替えない。
    const roadOrderResults = results.slice();

    const displayItems =
        buildEntranceCandidateDisplayItems(
            roadOrderResults,
            lastHighwayRoutePolylineAnalysis
        );

    resultArea.innerHTML =
        buildBestEntranceIcV2Html(results) +
        "<div class=\"v2-ic-result-list\">" +
        displayItems
            .map(item =>
                item.type === "marker"
                    ? "<div class=\"v2-ic-unresolved-marker\">" +
                        escapeHtml(item.label) +
                        "</div>"
                    : buildEntranceIcComparisonV2CardHtml(
                        item.result
                    )
            )
            .join("") +
        "</div>";
}

function getBestEntranceIcV2(results) {

    if (!Array.isArray(results)) {
        return null;
    }

    const eligibleResults =
        results.filter(result =>
            result.recommendationEligibility === "eligible"
        );

    const recommendationPool =
        eligibleResults.length > 0
            ? eligibleResults
            : results;

    const candidates =
        recommendationPool
            .filter(result =>
                !result.error &&
                result.recommendationEligibility ===
                    "eligible" &&
                result.differenceFromAllLocal > 0 &&
                result.differenceFromAllLocal >=
                    MIN_ENTRANCE_RECOMMEND_SAVED_MINUTES &&
                result.yenPerSavedMinute !== null &&
                result.recommendScore !== null
            )
            .sort((a, b) => {

                if (
                    a.recommendScore !==
                    b.recommendScore
                ) {
                    return (
                        b.recommendScore -
                        a.recommendScore
                    );
                }

                if (
                    a.minutesToCandidate !==
                    b.minutesToCandidate
                ) {
                    return (
                        a.minutesToCandidate -
                        b.minutesToCandidate
                    );
                }

                if (
                    a.differenceFromAllLocal !==
                    b.differenceFromAllLocal
                ) {
                    return (
                        b.differenceFromAllLocal -
                        a.differenceFromAllLocal
                    );
                }

                return (
                    a.yenPerSavedMinute -
                    b.yenPerSavedMinute
                );
            });

    const bestResult = candidates[0] || null;

    logBestIcV2Debug({
        mode: "entrance",
        results,
        eligibleResults,
        recommendationPool,
        candidates,
        bestResult,
        acceptableDelayMinutes: null
    });

    return bestResult;
}

function getReferenceEntranceIcV2(results) {

    if (!Array.isArray(results)) {
        return null;
    }

    const candidates =
        results
            .filter(result =>
                !result.error &&
                result.totalMinutes !== null &&
                result.totalMinutes !== undefined &&
                result.allLocalMinutes !== null &&
                result.allLocalMinutes !== undefined
            )
            .sort((a, b) => {

                if (a.totalMinutes !== b.totalMinutes) {
                    return a.totalMinutes - b.totalMinutes;
                }

                return (
                    (b.differenceFromAllLocal ?? -Infinity) -
                    (a.differenceFromAllLocal ?? -Infinity)
                );
            });

    return candidates[0] || null;
}

function buildBestEntranceIcV2Html(results) {

    const best =
        getBestEntranceIcV2(results);

    if (!best) {
        return (
            "<div class=\"v2-best-entrance-card v2-best-empty\">" +
            "<div class=\"v2-best-label\">おすすめ入口なし</div>" +
            "<div class=\"v2-best-detail\">" +
            "この条件では全下道の方がよさそうです" +
            "</div>" +
            "</div>"
        );
    }

    const icName =
        escapeHtml(best.candidateIcName || "--");

    return (
        "<div class=\"v2-best-entrance-card\">" +
        "<div class=\"v2-best-label\">おすすめ入口</div>" +
        "<div class=\"v2-best-name\">" +
        icName +
        "</div>" +
        "<div class=\"v2-best-detail\">" +
        best.differenceFromAllLocal +
        "分短縮" +
        " / ETC料金 約" +
        best.estimatedToll.toLocaleString() +
        "円" +
        "<div class=\"v2-best-unit\">" +
        best.yenPerSavedMinute.toLocaleString() +
        "円/分" +
        "</div>" +
        "</div>" +
        "</div>"
    );
}

function updateDashboardWithBestEntranceIcV2() {

    const best =
        getBestEntranceIcV2(lastMultiIcV2Results);

    setDashboardInfoLabels(
        "時間短縮",
        "ETC料金"
    );
    setDashboardV2EntranceMode(true);
    setDashboardV2ExitMode(false);
    updateDashboardAssumedRouteForComparisonMode();

    const dashboardCard =
        document.querySelector(".dashboard-card");

    if (dashboardCard) {
        dashboardCard.classList.remove(
            "recommend-highway",
            "recommend-neutral",
            "recommend-local"
        );

        dashboardCard.classList.add(
            best ? "recommend-highway" : "recommend-local"
        );

        dashboardCard.classList.remove(
            "v2-dashboard-recommendation-good",
            "v2-dashboard-recommendation-none"
        );

        dashboardCard.classList.add(
            best
                ? "v2-dashboard-recommendation-good"
                : "v2-dashboard-recommendation-none"
        );
    }

    const dashboardStars =
        document.getElementById("dashboardStars");

    const dashboardRecommendation =
        document.getElementById("dashboardRecommendation");

    const dashboardReason =
        document.getElementById("dashboardReason");

    const dashboardValueJudge =
        document.getElementById("dashboardValueJudge");

    const dashboardHighway =
        document.getElementById("dashboardHighway");

    const dashboardHighwayDetail =
        document.getElementById("dashboardHighwayDetail");

    const dashboardLocal =
        document.getElementById("dashboardLocal");

    const dashboardLocalDetail =
        document.getElementById("dashboardLocalDetail");

    const dashboardEfficiency =
        document.getElementById("dashboardEfficiency");

    const dashboardCost =
        document.getElementById("dashboardCost");

    if (!best) {

        const allLocalMinutes =
            getAllLocalMinutesFromV2Results();

        const reference =
            getReferenceEntranceIcV2(
                lastMultiIcV2Results
            );

        setDashboardRouteDimmed(
            Boolean(reference),
            false
        );

        if (dashboardStars) {
            dashboardStars.textContent = "";
        }

        if (dashboardRecommendation) {
            dashboardRecommendation.textContent =
                "おすすめ入口なし";
        }

        lastRecommendationText =
            "おすすめ入口なし";

        if (dashboardReason) {
            dashboardReason.innerHTML =
                reference
                    ? "<div class=\"v2-best-entrance-card reference-candidate\">" +
                    "<div class=\"v2-best-label v2-reference-label\">参考入口</div>" +
                    "<div class=\"v2-best-name v2-reference-name\">" +
                    escapeHtml(
                        (reference.candidateIcName || "--") +
                        "（条件外）"
                    ) +
                    "</div>" +
                    "<div class=\"v2-best-detail\">" +
                    formatV2SavingText(
                        reference.differenceFromAllLocal
                    ) +
                    " / " +
                    escapeHtml(
                        reference.yenPerSavedMinute !== null
                            ? reference.yenPerSavedMinute.toLocaleString() +
                            "円/分"
                            : "円/分なし"
                    ) +
                    "<div class=\"v2-reference-note\">" +
                    "※おすすめ対象外: " +
                    escapeHtml(reference.weakReason || "条件外") +
                    "</div>" +
                    "</div>" +
                    "</div>"
                    : "この条件では全下道の方がよさそうです";
        }

        if (dashboardValueJudge) {
            dashboardValueJudge.className = "";
            dashboardValueJudge.classList.add("value-good");
            dashboardValueJudge.classList.add(
                "v2-dashboard-value-info"
            );
            dashboardValueJudge.textContent =
                "🚗 有料回避推奨";
        }

        if (dashboardHighway) {
            dashboardHighway.innerHTML =
                createRouteTimeHtml(
                    reference
                        ? reference.totalMinutes
                        : null
                );
        }

        if (dashboardHighwayDetail) {
            dashboardHighwayDetail.textContent =
                createRouteDistanceText(
                    reference
                        ? reference.totalDistanceKm
                        : null
                );
        }

        if (dashboardLocal) {
            dashboardLocal.innerHTML =
                createRouteTimeHtml(
                    reference
                        ? reference.allLocalMinutes
                        : allLocalMinutes
                );
        }

        if (dashboardLocalDetail) {
            dashboardLocalDetail.textContent =
                createRouteDistanceText(
                    reference
                        ? reference.allLocalDistanceKm
                        : getAllLocalDistanceKmFromV2Results()
                );
        }

        if (dashboardEfficiency) {
            dashboardEfficiency.textContent =
                reference
                    ? formatV2SavingText(
                        reference.differenceFromAllLocal
                    ).replace(/<br>/g, " ")
                    : "--";
        }

        if (dashboardCost) {
            dashboardCost.innerHTML =
                reference
                    ? createEtcEstimateHtml(
                        reference.estimatedToll,
                        reference.tollLabel
                    )
                    : "--";
        }

        updateDashboardTimeColors(
            reference
                ? reference.totalMinutes
                : null,
            reference
                ? reference.allLocalMinutes
                : allLocalMinutes
        );

        updateDashboardEfficiencyRate(
            reference
                ? reference.totalMinutes
                : null,
            reference
                ? reference.allLocalMinutes
                : allLocalMinutes
        );

        return;
    }

    if (dashboardStars) {
        dashboardStars.textContent = "";
    }

    setDashboardRouteDimmed(false, false);

    if (dashboardRecommendation) {
        dashboardRecommendation.textContent =
            "おすすめ入口";
    }

    lastRecommendationText =
        "おすすめ入口";

    if (dashboardReason) {
        dashboardReason.innerHTML =
            "<div class=\"v2-best-entrance-card\">" +
            "<div class=\"v2-best-name\">" +
            escapeHtml(best.candidateIcName) +
            "</div>" +
            "<div class=\"v2-best-detail\">" +
            escapeHtml(
                best.differenceFromAllLocal +
                "分短縮"
            ) +
            " / " +
            escapeHtml(
                "ETC料金 約" +
                best.estimatedToll.toLocaleString() +
                "円"
            ) +
            "<div class=\"v2-best-unit\">" +
            escapeHtml(
                best.yenPerSavedMinute.toLocaleString() +
                "円/分"
            ) +
            "</div>" +
            "</div>" +
            "</div>" +
            createArrivalPredictionCardHtml(
                "おすすめ入口から高速利用時",
                best.totalMinutes,
                best.totalDistanceKm,
                lastProbablyNoTollRoute
            );
    }

    if (dashboardValueJudge) {
        dashboardValueJudge.className = "";
        dashboardValueJudge.textContent = "";
    }

    if (dashboardHighway) {
        dashboardHighway.innerHTML =
            createRouteTimeHtml(best.totalMinutes);
    }

    if (dashboardHighwayDetail) {
        dashboardHighwayDetail.textContent =
            createRouteDistanceText(best.totalDistanceKm);
    }

    if (dashboardLocal) {
        dashboardLocal.innerHTML =
            createRouteTimeHtml(best.allLocalMinutes);
    }

    if (dashboardLocalDetail) {
        dashboardLocalDetail.textContent =
            createRouteDistanceText(best.allLocalDistanceKm);
    }

    if (dashboardEfficiency) {
        dashboardEfficiency.textContent =
            best.differenceFromAllLocal + "分短縮";
    }

    if (dashboardCost) {
        dashboardCost.innerHTML =
            createEtcEstimateHtml(
                best.estimatedToll,
                best.tollLabel
            );
    }

    updateDashboardTimeColors(
        best.totalMinutes,
        best.allLocalMinutes
    );

    updateDashboardEfficiencyRate(
        best.totalMinutes,
        best.allLocalMinutes
    );
}

function updateDashboardWithBestExitIcV2() {

    const best =
        getBestExitIcV2(lastExitIcV2Results);

    setDashboardInfoLabels(
        "到着差",
        "節約額"
    );
    setDashboardV2EntranceMode(false);
    setDashboardV2ExitMode(true);
    updateDashboardAssumedRouteForComparisonMode();

    const dashboardCard =
        document.querySelector(".dashboard-card");

    if (dashboardCard) {
        dashboardCard.classList.remove(
            "recommend-highway",
            "recommend-neutral",
            "recommend-local"
        );

        dashboardCard.classList.add(
            best ? "recommend-neutral" : "recommend-highway"
        );

        dashboardCard.classList.remove(
            "v2-dashboard-recommendation-good",
            "v2-dashboard-recommendation-none"
        );

        dashboardCard.classList.add(
            best
                ? "v2-dashboard-recommendation-good"
                : "v2-dashboard-recommendation-none"
        );
    }

    const dashboardStars =
        document.getElementById("dashboardStars");

    const dashboardRecommendation =
        document.getElementById("dashboardRecommendation");

    const dashboardReason =
        document.getElementById("dashboardReason");

    const dashboardValueJudge =
        document.getElementById("dashboardValueJudge");

    const dashboardHighway =
        document.getElementById("dashboardHighway");

    const dashboardHighwayDetail =
        document.getElementById("dashboardHighwayDetail");

    const dashboardLocal =
        document.getElementById("dashboardLocal");

    const dashboardLocalDetail =
        document.getElementById("dashboardLocalDetail");

    const dashboardEfficiency =
        document.getElementById("dashboardEfficiency");

    const dashboardCost =
        document.getElementById("dashboardCost");

    if (!best) {

        const reference =
            getReferenceExitIcV2(
                lastExitIcV2Results
            );

        setDashboardRouteDimmed(
            false,
            Boolean(reference)
        );

        if (dashboardStars) {
            dashboardStars.textContent = "";
        }

        if (dashboardRecommendation) {
            dashboardRecommendation.textContent =
                "おすすめ出口なし";
        }

        lastRecommendationText =
            "おすすめ出口なし";

        const isLowEfficiencyReference =
            reference?.recommendationEligibility ===
            "reference";

        const referenceName =
            isLowEfficiencyReference
                ? (reference.candidateIcName || "--")
                : (reference?.candidateIcName || "--") +
                    "（条件外）";

        const referenceNoteHtml =
            isLowEfficiencyReference
                ? reference.yenPerDelayedMinute +
                    "円/分のため参考扱い<br>おすすめ条件：" +
                    MIN_EXIT_RECOMMEND_YEN_PER_DELAY_MINUTE +
                    "円/分以上"
                : "※おすすめ対象外: " +
                    escapeHtml(
                        reference?.weakReason || "条件外"
                    );

        const referenceNoteClassName =
            isLowEfficiencyReference
                ? "v2-reference-note v2-reference-note-lowefficiency"
                : "v2-reference-note";

        if (dashboardReason) {
            dashboardReason.innerHTML =
                reference
                    ? "<div class=\"v2-best-exit-card reference-candidate\">" +
                    "<div class=\"v2-best-exit-label\">参考出口</div>" +
                    "<div class=\"v2-best-exit-name\">" +
                    escapeHtml(referenceName) +
                    "</div>" +
                    "<div class=\"v2-best-exit-detail\">" +
                    escapeHtml(
                        formatExitV2SavingText(
                            reference.savedToll
                        )
                    ) +
                    " / " +
                    escapeHtml(
                        formatExitV2DelayText(
                            reference.differenceFromAllHighway
                        ).replace(/<br>/g, " ")
                    ) +
                    "<div class=\"" + referenceNoteClassName + "\">" +
                    referenceNoteHtml +
                    "</div>" +
                    "</div>" +
                    "</div>"
                    : "この条件では高速継続がよさそうです";
        }

        if (dashboardValueJudge) {
            dashboardValueJudge.className = "";
            dashboardValueJudge.classList.add("value-good");
            dashboardValueJudge.classList.add(
                "v2-dashboard-value-info"
            );
            dashboardValueJudge.textContent =
                "🚙 高速継続推奨";
        }

        if (dashboardHighway) {
            dashboardHighway.innerHTML =
                createRouteTimeHtml(
                    reference
                        ? reference.allHighwayMinutes
                        : getAllHighwayMinutesFromExitV2Results()
                );
        }

        if (dashboardHighwayDetail) {
            dashboardHighwayDetail.textContent =
                createRouteDistanceText(
                    reference
                        ? reference.allHighwayDistanceKm
                        : getAllHighwayDistanceKmFromExitV2Results()
                );
        }

        if (dashboardLocal) {
            dashboardLocal.innerHTML =
                createRouteTimeHtml(
                    reference
                        ? reference.totalMinutes
                        : null
                );
        }

        if (dashboardLocalDetail) {
            dashboardLocalDetail.textContent =
                createRouteDistanceText(
                    reference
                        ? reference.totalDistanceKm
                        : null
                );
        }

        if (dashboardEfficiency) {
            dashboardEfficiency.textContent =
                reference
                    ? formatExitV2DelayText(
                        reference.differenceFromAllHighway
                    ).replace(/<br>/g, " ")
                    : "--";
        }

        if (dashboardCost) {
            dashboardCost.textContent =
                reference
                    ? formatExitV2SavingText(
                        reference.savedToll
                    ).replace(/<br>/g, " ")
                    : "--";
        }

        updateDashboardTimeColors(
            reference
                ? reference.allHighwayMinutes
                : getAllHighwayMinutesFromExitV2Results(),
            reference
                ? reference.totalMinutes
                : null
        );

        updateDashboardEfficiencyRate(
            reference
                ? reference.allHighwayMinutes
                : getAllHighwayMinutesFromExitV2Results(),
            reference
                ? reference.totalMinutes
                : null
        );

        return;
    }

    if (dashboardStars) {
        dashboardStars.textContent = "";
    }

    setDashboardRouteDimmed(false, false);

    if (dashboardRecommendation) {
        dashboardRecommendation.textContent =
            "おすすめ出口";
    }

    lastRecommendationText =
        "おすすめ出口";

    if (dashboardReason) {
        dashboardReason.innerHTML =
            "<div class=\"v2-best-exit-card\">" +
            "<div class=\"v2-best-exit-name v2-best-exit-name-confirmed\">" +
            escapeHtml(best.candidateIcName) +
            "</div>" +
            "<div class=\"v2-best-exit-detail\">" +
            escapeHtml(
                best.savedToll.toLocaleString() +
                "円節約"
            ) +
            " / " +
            escapeHtml(
                best.differenceFromAllHighway +
                "分遅い"
            ) +
            "<div class=\"v2-best-unit\">" +
            escapeHtml(
                best.yenPerDelayedMinute.toLocaleString() +
                "円/分"
            ) +
            "</div>" +
            "</div>" +
            "</div>" +
            createArrivalPredictionCardHtml(
                "おすすめ出口を利用した場合",
                best.totalMinutes,
                best.totalDistanceKm,
                lastProbablyNoTollRoute
            );
    }

    if (dashboardValueJudge) {
        dashboardValueJudge.className = "";
        dashboardValueJudge.textContent = "";
    }

    if (dashboardHighway) {
        dashboardHighway.innerHTML =
            createRouteTimeHtml(best.allHighwayMinutes);
    }

    if (dashboardHighwayDetail) {
        dashboardHighwayDetail.textContent =
            createRouteDistanceText(best.allHighwayDistanceKm);
    }

    if (dashboardLocal) {
        dashboardLocal.innerHTML =
            createRouteTimeHtml(best.totalMinutes);
    }

    if (dashboardLocalDetail) {
        dashboardLocalDetail.textContent =
            createRouteDistanceText(best.totalDistanceKm);
    }

    if (dashboardEfficiency) {
        dashboardEfficiency.textContent =
            best.differenceFromAllHighway +
            "分遅い";
    }

    if (dashboardCost) {
        dashboardCost.textContent =
            best.savedToll.toLocaleString() +
            "円節約";
    }

    updateDashboardTimeColors(
        best.allHighwayMinutes,
        best.totalMinutes
    );

    updateDashboardEfficiencyRate(
        best.allHighwayMinutes,
        best.totalMinutes
    );
}

function setDashboardInfoLabels(
    efficiencyLabelText,
    costLabelText
) {

    const efficiencyLabel =
        document.getElementById(
            "dashboardEfficiencyLabel"
        );

    const costLabel =
        document.getElementById(
            "dashboardCostLabel"
        );

    if (efficiencyLabel) {
        efficiencyLabel.textContent =
            efficiencyLabelText;
    }

    if (costLabel) {
        costLabel.textContent =
            costLabelText;
    }
}

function updateDashboardEfficiencyRate(
    highwayMinutes,
    localMinutes
) {

    const row =
        document.getElementById(
            "dashboardEfficiencyRateRow"
        );

    const value =
        document.getElementById(
            "dashboardEfficiencyRateValue"
        );

    if (!row || !value) {
        return;
    }

    const highwayValue =
        Number(highwayMinutes);

    const localValue =
        Number(localMinutes);

    value.classList.remove(
        "efficiency-low",
        "efficiency-equal",
        "efficiency-high"
    );

    if (
        !Number.isFinite(highwayValue) ||
        !Number.isFinite(localValue) ||
        highwayValue <= 0 ||
        localValue <= 0
    ) {
        value.textContent = "--";
        row.hidden = false;
        return;
    }

    const efficiencyRate =
        localValue / highwayValue;

    value.textContent =
        efficiencyRate.toFixed(1) +
        "倍";

    if (efficiencyRate < 1.8) {
        value.classList.add("efficiency-low");
    }
    else if (efficiencyRate <= 2.2) {
        value.classList.add("efficiency-equal");
    }
    else {
        value.classList.add("efficiency-high");
    }

    row.hidden = false;
}

function setDashboardV2EntranceMode(isActive) {

    const dashboardCard =
        document.querySelector(".dashboard-card");

    if (!dashboardCard) {
        return;
    }

    dashboardCard.classList.toggle(
        "v2-dashboard-entrance-active",
        isActive
    );

    if (isActive) {
        setDashboardNormalSearchMode(false);
    }
}

function setDashboardV2ExitMode(isActive) {

    const dashboardCard =
        document.querySelector(".dashboard-card");

    if (!dashboardCard) {
        return;
    }

    dashboardCard.classList.toggle(
        "v2-dashboard-exit-active",
        isActive
    );

    if (isActive) {
        setDashboardNormalSearchMode(false);
    }
}

function getAllLocalMinutesFromV2Results() {

    const result =
        lastMultiIcV2Results.find(item =>
            item.allLocalMinutes !== null &&
            item.allLocalMinutes !== undefined
        );

    return result ? result.allLocalMinutes : null;
}

function getAllLocalDistanceKmFromV2Results() {

    const result =
        lastMultiIcV2Results.find(item =>
            item.allLocalDistanceKm !== null &&
            item.allLocalDistanceKm !== undefined
        );

    return result ? result.allLocalDistanceKm : null;
}

function getAllHighwayMinutesFromExitV2Results() {

    const result =
        lastExitIcV2Results.find(item =>
            item.allHighwayMinutes !== null &&
            item.allHighwayMinutes !== undefined
        );

    return result ? result.allHighwayMinutes : null;
}

function getAllHighwayDistanceKmFromExitV2Results() {

    const result =
        lastExitIcV2Results.find(item =>
            item.allHighwayDistanceKm !== null &&
            item.allHighwayDistanceKm !== undefined
        );

    return result ? result.allHighwayDistanceKm : null;
}

function getAllHighwayMinutesTextFromExitV2Results() {

    const result =
        lastExitIcV2Results.find(item =>
            item.allHighwayMinutes !== null &&
            item.allHighwayMinutes !== undefined
        );

    return result
        ? formatV2Duration(result.allHighwayMinutes)
        : "--";
}

function buildEntranceIcComparisonV2CardHtml(result) {

    const hasError = Boolean(result.error);

    const isWeakCandidate =
        result.recommendationEligibility === "weak";

    const hasNoSaving =
        !hasError &&
        result.differenceFromAllLocal !== null &&
        result.differenceFromAllLocal <= 0;

    const classNames = [
        "v2-ic-result-card",
        hasNoSaving ? "v2-ic-no-saving" : "",
        isWeakCandidate ? "weak-comparison-candidate" : "",
        hasError ? "v2-ic-error" : ""
    ]
        .filter(Boolean)
        .join(" ");

    const icName =
        escapeHtml(result.candidateIcName || "--");

    if (hasError) {
        return (
            "<div class=\"" + classNames + "\">" +
            "<div class=\"v2-ic-name\">" +
            icName +
            "</div>" +
            "<div class=\"v2-ic-main v2-ic-main-error\">取得失敗</div>" +
            "<div class=\"v2-ic-detail\">" +
            escapeHtml(result.error) +
            "</div>" +
            "</div>"
        );
    }

    const savingText =
        formatV2SavingText(
            result.differenceFromAllLocal
        );

    const yenPerMinuteText =
        result.yenPerSavedMinute === null
            ? "--"
            : result.yenPerSavedMinute.toLocaleString() +
            "円/分";

    const tollBreakdownText =
        formatEntranceV2TollBreakdownText(
            result.shutoToll,
            result.nonShutoToll
        );

    const weakCandidateNote =
        isWeakCandidate
            ? "<div class=\"weak-comparison-note\">" +
                "※おすすめ対象外: " +
                escapeHtml(result.weakReason || "理由不明") +
                "</div>"
            : "";

    return (
        "<div class=\"" + classNames + "\">" +
        "<div class=\"v2-ic-name\">" +
        icName +
        "</div>" +
        "<div class=\"v2-ic-main\">" +
        "あと" +
        result.minutesToCandidate +
        "分" +
        "</div>" +
        "<div class=\"v2-ic-detail\">" +
        savingText +
        "<br>ETC 約" +
        result.estimatedToll.toLocaleString() +
        "円" +
        tollBreakdownText +
        "<br>" +
        yenPerMinuteText +
        "<br>合計" +
        formatV2Duration(result.totalMinutes) +
        weakCandidateNote +
        "</div>" +
        "</div>"
    );
}

function formatV2Duration(minutes) {

    if (
        minutes === null ||
        minutes === undefined ||
        Number.isNaN(minutes)
    ) {
        return "--";
    }

    if (minutes < 60) {
        return minutes + "分";
    }

    const hours =
        Math.floor(minutes / 60);

    const mins =
        minutes % 60;

    return (
        hours +
        "時間" +
        String(mins).padStart(2, "0") +
        "分"
    );
}

function formatV2SavingText(differenceFromAllLocal) {

    if (differenceFromAllLocal === null) {
        return "短縮時間不明";
    }

    if (differenceFromAllLocal > 0) {
        return differenceFromAllLocal + "分短縮";
    }

    if (differenceFromAllLocal < 0) {
        return (
            "短縮なし<br>" +
            Math.abs(differenceFromAllLocal) +
            "分遅い"
        );
    }

    return "短縮なし<br>全下道と同じ";
}

function formatEntranceV2TollBreakdownText(shutoToll, nonShutoToll) {

    if (
        shutoToll === null ||
        shutoToll === undefined ||
        nonShutoToll === null ||
        nonShutoToll === undefined
    ) {
        return "";
    }

    if (shutoToll > 0 && nonShutoToll > 0) {
        return (
            "<br>料金目安：首都高 約" +
            shutoToll.toLocaleString() +
            "円 + 他道路 約" +
            nonShutoToll.toLocaleString() +
            "円"
        );
    }

    if (shutoToll > 0) {
        return (
            "<br>料金目安：首都高 約" +
            shutoToll.toLocaleString() +
            "円"
        );
    }

    if (nonShutoToll > 0) {
        return (
            "<br>料金目安：他道路 約" +
            nonShutoToll.toLocaleString() +
            "円"
        );
    }

    return "";
}

function escapeHtml(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function displayMultiExitIcComparison(
    keepHighwayMinutes,
    results,
    acceptableDelay,
    tollStartIcName
) {

    setDashboardNormalSearchMode(false);

    setDashboardInfoLabels(
        "効率率",
        "単価"
    );
    setDashboardV2EntranceMode(false);
    setDashboardV2ExitMode(false);

    const sortedResults =
        [...results].sort(
            (a, b) =>
                b.yenPerExtraMinute -
                a.yenPerExtraMinute
        );

    sortedResults.forEach((result, index) => {
        let score = 0;

        if (result.difference <= 0) {
            score = 999999;
        }
        else if (result.savedToll > 0) {
            score =
                Math.round(
                    result.savedToll / result.difference
                );
        }

        result.score = score;
    });

    const acceptableResults =
        results.filter(result =>
            result.difference <= acceptableDelay
        );


    const roadOrderResults =
        results.slice();

    if (acceptableResults.length > 0) {

        acceptableResults.sort(
            (a, b) =>
                b.score - a.score
        );

        results.sort(
            (a, b) =>
                b.score - a.score
        );
    }
    else {

        results.sort(
            (a, b) =>
                a.difference - b.difference
        );
    }

    const best =
        acceptableResults.length > 0
            ? acceptableResults[0]
            : results[0];


    let html = "";

    let bestDifferenceText = "";

    let bestShortDifferenceText = "";


    if (best.difference > 0) {
        bestDifferenceText =
            formatMinutes(best.difference) +
            "遅くなるが";

        bestShortDifferenceText =
            "+" +
            formatMinutes(best.difference);
    }
    else if (best.difference < 0) {
        bestDifferenceText =
            formatMinutes(Math.abs(best.difference)) +
            "早くなり";

        bestShortDifferenceText =
            "-" +
            formatMinutes(Math.abs(best.difference));
    }
    else {
        bestDifferenceText =
            "所要時間はほぼ同じで";

        bestShortDifferenceText =
            "±0分";
    }

    const bestTotalTimeText =
        formatMinutes(best.totalMinutes);


    const localComparisonMinutes =
        lastLocalRouteMinutes !== null
            ? lastLocalRouteMinutes - best.totalMinutes
            : null;

    let localComparisonValue = "";

    if (localComparisonMinutes > 0) {

        localComparisonValue =
            "<span class='reason-green'>" +
            formatMinutes(localComparisonMinutes) +
            "早い" +
            "</span>";

    }
    else if (localComparisonMinutes < 0) {

        localComparisonValue =
            "<span class='reason-red'>" +
            formatMinutes(
                Math.abs(localComparisonMinutes)
            ) +
            "遅い" +
            "</span>";

    }
    else if (localComparisonMinutes === 0) {

        localComparisonValue =
            "<span class='reason-neutral'>同着</span>";

    }



    document
        .getElementById("dashboardRecommendation")
        .textContent =
        (
            acceptableResults.length > 0
                ? "おすすめ："
                : "条件外の最良候補："
        ) +
        (tollStartIcName || "起点IC") +
        "→" +
        getIcDisplayName(best.exitIc);

    let arrivalClass = "arrival-normal";

    if (best.difference <= 0) {
        arrivalClass = "arrival-good";
    }
    else if (best.difference > acceptableDelay) {
        arrivalClass = "arrival-bad";
    }

    let dashboardReasonText =

        "<div class='dashboard-route-info'>" +
        best.roadName +
        " 約" +
        best.estimatedTollKm.toFixed(1) +
        "km" +
        "</div>" +

        "<div class='" +
        arrivalClass +
        "'>" +
        "⏱ 到着 " +
        bestTotalTimeText +
        "</div>" +

        "<div id='dashboardMovedJudge' class='multi-best-reason value-high'>" +
        getExitIcJudge(best.score) +
        "</div>" +

        "<div class='multi-best-reason'>" +
        "💴 ETC概算 " +
        best.estimatedToll.toLocaleString() +
        "円" +
        "（節約 " +
        best.savedToll.toLocaleString() +
        "円）" +
        "</div>";


    let highwayComparisonValue = "";

    if (best.difference > 0) {

        highwayComparisonValue =
            "<span class='reason-red'>" +
            formatMinutes(best.difference) +
            "遅い" +
            "</span>";

    }
    else if (best.difference < 0) {

        highwayComparisonValue =
            "<span class='reason-green'>" +
            formatMinutes(
                Math.abs(best.difference)
            ) +
            "早い" +
            "</span>";

    }
    else {

        highwayComparisonValue =
            "<span class='reason-neutral'>同着</span>";

    }

    dashboardReasonText +=
        "<div class='dashboard-compare-row'>" +

        "<div class='dashboard-compare-item'>" +
        "<div class='compare-label'>🚙 高速利用より</div>" +
        "<div class='compare-value'>" +
        highwayComparisonValue +
        "</div>" +
        "</div>" +

        "<div class='dashboard-compare-item'>" +
        "<div class='compare-label'>🚗 有料回避より</div>" +
        "<div class='compare-value'>" +
        localComparisonValue +
        "</div>" +
        "</div>" +

        "</div>";



    document
        .getElementById("dashboardReason")
        .innerHTML =
        dashboardReasonText;

    document
        .getElementById("dashboardStars")
        .textContent =
        getExitIcStars(best.score);

    document
        .getElementById("dashboardValueJudge")
        .textContent =
        "";


    const dashboardValueJudge =
        document.getElementById("dashboardValueJudge");

    dashboardValueJudge.className = "";

    if (best.score >= 300) {
        dashboardValueJudge.classList.add("value-super");
    }
    else if (best.score >= 200) {
        dashboardValueJudge.classList.add("value-good");
    }
    else if (best.score >= 100) {
        dashboardValueJudge.classList.add("value-normal");
    }
    else if (best.score >= 50) {
        dashboardValueJudge.classList.add("value-expensive");
    }
    else {
        dashboardValueJudge.classList.add("value-high");
    }


    const dashboardCard =
        document.querySelector(".dashboard-card");

    dashboardCard.classList.remove(
        "recommend-highway",
        "recommend-neutral",
        "recommend-local"
    );

    if (acceptableResults.length > 0) {
        dashboardCard.classList.add("recommend-highway");
    }
    else {
        dashboardCard.classList.add("recommend-neutral");
    }


    document
        .getElementById("dashboardCost")
        .textContent =
        best.yenPerExtraMinute + "円/分";

    html +=
        "<div class='multi-best'>" +
        "<div class='multi-best-label'>おすすめルート</div>" +
        "<div class='multi-best-ic'>" +
        (tollStartIcName || "起点IC") +
        " → " +
        getIcDisplayName(best.exitIc) +
        "</div>" +
        "<div class='multi-best-reason'>" +
        "（" +
        getIcAreaLabelByExitIc(best.exitIc) +
        " 約" +
        best.estimatedTollKm.toFixed(1) +
        "km）" +
        "</div>" +

        "<div class='multi-best-stars'>" +
        getExitIcStars(best.score) +
        "</div>" +
        "<div class='multi-best-main-reason'>" +
        "⏱ 到着 " +
        bestTotalTimeText +
        "</div>" +
        "<div class='multi-best-main-reason'>" +
        "💰 約" +
        best.savedToll.toLocaleString() +
        "円節約" +
        "</div>" +
        "<div class='multi-best-main-reason'>" +
        "差 " +
        bestShortDifferenceText +
        "</div>" +

        "<div class='multi-best-main-reason'>" +
        "📈 " +
        best.yenPerExtraMinute +
        "円/分" +
        "</div>" +

        "<div class='multi-best-reason'>" +
        (
            acceptableResults.length > 0
                ? "許容遅れ" +
                acceptableDelay +
                "分以内の候補から選定"
                : "※許容遅れ" +
                acceptableDelay +
                "分以内の候補が無いため、最良候補を表示中"
        ) +
        "</div>" +
        "</div>";

    html +=
        "<div class='multi-best-reason'>" +
        "料金計算起点：" +
        (tollStartIcName || "不明") +
        "<br>" +
        "※節約額は「" +
        (tollStartIcName || "起点IC") +
        "→各候補IC」の概算料金で計算" +
        "</div>";

    html +=
        "<div class='multi-best-reason'>" +
        "順位は節約効率（円/分）で算出" +
        "<br>" +
        "※到着差は「🚗 有料回避」との到着時間差" +
        "</div>";


    html +=
        "<div class='multi-row multi-header'>" +
        "<span>候補IC</span>" +
        "<span>到着差</span>" +
        "<span>ETC概算</span>" +
        "<span>評価(円/分)</span>" +
        "</div>";


    const rankMap = new Map();

    sortedResults.forEach((result, index) => {
        rankMap.set(result.exitIc, index + 1);
    });

    const displayResults =
        roadOrderResults;


    for (const result of displayResults) {

        const rank =
            rankMap.get(result.exitIc);

        let differenceText = "";

        const localDifference =
            lastLocalRouteMinutes -
            result.totalMinutes;

        console.log(
            "DEBUG",
            result.exitIc,
            result.totalMinutes,
            lastLocalRouteMinutes
        );

        let differenceClass = "arrival-diff-same";

        if (localDifference > 0) {

            differenceText =
                formatMinutes(localDifference) +
                "早い";

            differenceClass =
                "arrival-diff-good";

        }
        else if (localDifference < 0) {

            differenceText =
                formatMinutes(
                    Math.abs(localDifference)
                ) +
                "遅い";

            differenceClass =
                "arrival-diff-bad";

        }
        else {

            differenceText =
                "同着";

            differenceClass =
                "arrival-diff-same";

        }

        let yenPerMinuteText = "--";

        if (result.difference > 0) {
            yenPerMinuteText =
                result.yenPerExtraMinute + "円/分";
        }
        else if (result.difference <= 0) {
            yenPerMinuteText =
                "早くて安い";
        }

        const stars =
            getExitIcStars(result.score);

        const judge =
            getExitIcJudge(result.score);

        let rowClass = "multi-row";

        if (result.exitIc === best.exitIc) {
            rowClass =
                "multi-row multi-recommended-row";
        }
        else if (result.difference > acceptableDelay) {
            rowClass =
                "multi-row multi-over-delay-row";
        }

        html +=
            "<div class='" + rowClass + "'>" +
            "<span>" +
            getRankLabel(rank - 1) +
            " " +
            getIcDisplayName(result.exitIc) +
            "</span>" +
            "<span class='" +
            differenceClass +
            "'>" +
            differenceText +
            "</span>" +
            "<span>" +
            result.estimatedToll.toLocaleString() +
            "円<br><small>節約 " +
            result.savedToll.toLocaleString() +
            "円</small></span>" +
            "<span>" +
            stars +
            "<br>" +
            judge +
            "<br>" +
            yenPerMinuteText +
            "</span>" +
            "</div>";
    }

    if (invalidIcResults.length > 0) {

        html +=
            "<div class='multi-best-reason' style='margin-top:12px; color:#999'>" +
            "⚠ 比較対象外<br>";

        invalidIcResults.forEach(item => {

            html +=
                getIcDisplayName(item.exitIc) +
                "　" +
                item.reason;

            if (item.totalMinutes !== null) {
                html +=
                    "（" +
                    item.totalMinutes +
                    "分）";
            }

            html += "<br>";
        });

        html +=
            "</div>";
    }


    document
        .getElementById("multiExitIcResult")
        .innerHTML =
        html;

    function getExitIcStars(score) {

        if (score >= 999999) {
            return "★★★★★";
        }
        else if (score >= 300) {
            return "★★★★☆";
        }
        else if (score >= 200) {
            return "★★★☆☆";
        }
        else if (score >= 100) {
            return "★★☆☆☆";
        }
        else if (score >= 50) {
            return "★☆☆☆☆";
        }

        return "☆☆☆☆☆";
    }

    function getExitIcJudge(score) {

        if (score >= 300) {
            return "節約効果が非常に大きい";
        }
        else if (score >= 200) {
            return "節約重視ならおすすめ";
        }
        else if (score >= 100) {
            return "時間と料金のバランス型";
        }
        else if (score >= 50) {
            return "節約効果は小さめ";
        }

        return "下道のみも検討";
    }


    function getRankLabel(index) {

        if (index === 0) {
            return "🥇";
        }

        if (index === 1) {
            return "🥈";
        }

        if (index === 2) {
            return "🥉";
        }

        return (index + 1) + "位";
    }

}

function shortenIcName(name) {

    if (!name) {
        return "--";
    }

    return name
        .replace("中央自動車道 ", "")
        .replace("常磐自動車道 ", "")
        .replace("東北自動車道 ", "")
        .replace("関越自動車道 ", "")
        .replace("インターチェンジ", "IC")
        .replace("スマートIC", "SIC")
        .replace("スマートインターチェンジ", "SIC");
}

function buildPolylineComparisonSummaryHtml(
    polylineAnalysis
) {

    if (!polylineAnalysis) {
        return "Polyline解析結果：未取得";
    }

    const lines = [
        "Polyline解析結果：取得済み"
    ];

    const roadNames = [
        ...new Set(
            (
                polylineAnalysis.displayRoadSequence ||
                polylineAnalysis.roadSequence ||
                []
            )
                .map(shortenHighwayRoadName)
                .filter(Boolean)
        )
    ];

    lines.push(
        "想定道路：" +
        (roadNames.join(" → ") || "なし")
    );

    // TOLL TAG方式（tollSections）が利用できる場合はこちらを優先する。
    // hasTollSectionStepsDataがfalseの場合（getHighwayRouteForMultiExit
    // Comparison経由等、stepsを取得していない呼び出し元）は、既存の
    // 座標ベース方式（shutoEntranceIc/shutoExitIc/nexcoEntranceIc/
    // nexcoExitIc）にフォールバックする。座標ベース方式のコード自体は
    // 削除せず残している。
    if (polylineAnalysis.hasTollSectionStepsData === true) {

        const tollSections =
            polylineAnalysis.tollSections || [];

        const shutoSections =
            tollSections.filter(
                section => section.isShutoSection
            );

        const nexcoSections =
            tollSections.filter(
                section => !section.isShutoSection
            );

        const formatSectionIcText = (section, role) => {
            if (!section) {
                return "なし";
            }

            const ic =
                role === "entrance"
                    ? section.entranceIc
                    : section.exitIc;

            const icNameFallback =
                role === "entrance"
                    ? section.entranceIcName
                    : section.exitIcName;

            return (
                formatAssumedRouteIcName(ic) ||
                icNameFallback ||
                "なし"
            );
        };

        const formatMultiSectionSuffix = sections =>
            sections.length > 1
                ? " ほか計" + sections.length + "区間"
                : "";

        lines.push(
            "首都高入口：" +
            formatSectionIcText(
                shutoSections[0],
                "entrance"
            ) +
            formatMultiSectionSuffix(shutoSections)
        );

        lines.push(
            "首都高出口：" +
            formatSectionIcText(
                shutoSections[shutoSections.length - 1],
                "exit"
            ) +
            formatMultiSectionSuffix(shutoSections)
        );

        lines.push(
            "NEXCO入口：" +
            formatSectionIcText(
                nexcoSections[0],
                "entrance"
            ) +
            formatMultiSectionSuffix(nexcoSections)
        );

        lines.push(
            "NEXCO出口：" +
            formatSectionIcText(
                nexcoSections[nexcoSections.length - 1],
                "exit"
            ) +
            formatMultiSectionSuffix(nexcoSections)
        );
    }
    else {

        lines.push(
            "首都高入口：" +
            (
                formatAssumedRouteIcName(
                    polylineAnalysis.shutoEntranceIc
                ) || "なし"
            )
        );

        lines.push(
            "首都高出口：" +
            (
                formatAssumedRouteIcName(
                    polylineAnalysis.shutoExitIc
                ) || "なし"
            )
        );

        const nexcoEntrance =
            polylineAnalysis.nexcoEntranceIc;

        lines.push(
            "NEXCO入口：" +
            (formatAssumedRouteIcName(nexcoEntrance) || "なし")
        );

        const nexcoExit =
            polylineAnalysis.nexcoExitIc;

        lines.push(
            "NEXCO出口：" +
            (formatAssumedRouteIcName(nexcoExit) || "なし")
        );
    }

    // 入口比較候補は、getOrBuildEntranceIcSequenceWithUnresolvedMarkersの
    // 結果（polylineAnalysis自身にキャッシュ済み）をそのまま参照する。
    // selectPolylineBasedMultiIcCandidates側と同じ計算結果を使うため、
    // 表示と実際の候補選定は常に一致する。件数制限はかけず全件表示する。
    // 未確定マーカーは黄色のインラインspanとして生HTMLのまま挿入する必要が
    // あり、他の行のようにlinesへpushして末尾で一括escapeHtmlする対象には
    // できない（一括escapeHtmlするとspanタグ自体がエスケープされてしまう）。
    // そのため、この行だけIC名等の動的な値のみを個別にescapeHtmlした上で、
    // linesの前半（ここまでの行）と後半（出口比較候補等）の間に、
    // 生HTMLのまま差し込む。
    const linesBeforeEntranceCandidatesCount = lines.length;

    const seenEntranceCandidateNames = new Set();

    const entranceComparisonCandidateParts =
        getOrBuildEntranceIcSequenceWithUnresolvedMarkers(
            polylineAnalysis
        )
            .map(entry => {
                if (entry.isUnresolved === true) {
                    return (
                        "<span style=\"color: var(--color-warning);\">" +
                        escapeHtml(entry.label) +
                        "</span>"
                    );
                }

                const name =
                    formatAssumedRouteIcName(entry.ic);

                if (
                    !name ||
                    seenEntranceCandidateNames.has(name)
                ) {
                    return "";
                }

                seenEntranceCandidateNames.add(name);

                return escapeHtml(name);
            })
            .filter(Boolean);

    const entranceComparisonCandidateHtml =
        "<div>入口比較候補：" +
        (
            entranceComparisonCandidateParts.join(" → ") ||
            "なし"
        ) +
        "</div>";

    // 出口比較候補は、比較候補選定ロジック自体（旧shutoEntranceIc/
    // nexcoEntranceIc等を参照する設計のまま）が今回のスコープ外のため、
    // 表示とロジックの整合性を保つべく変更しない。
    const comparisonCandidatePreview =
        buildPolylineBasedComparisonIcCandidates(
            polylineAnalysis
        );

    const exitComparisonCandidateNames = [
        ...new Set(
            (
                comparisonCandidatePreview
                    ?.exitCandidateIcs || []
            )
                .filter(candidate =>
                    candidate?.exit?.exitSelectable !== false
                )
                .map(candidate =>
                    formatAssumedRouteIcName(
                        candidate?.exit
                    )
                )
                .filter(Boolean)
        )
    ];

    lines.push(
        "出口比較候補：" +
        (
            exitComparisonCandidateNames.join(" → ") ||
            "なし"
        )
    );

    return [
        ...lines
            .slice(0, linesBeforeEntranceCandidatesCount)
            .map(line =>
                "<div>" + escapeHtml(line) + "</div>"
            ),
        entranceComparisonCandidateHtml,
        ...lines
            .slice(linesBeforeEntranceCandidatesCount)
            .map(line =>
                "<div>" + escapeHtml(line) + "</div>"
            )
    ].join("");
}

function updateSearchConditionPolylineAnalysis(
    fallbackOrigin,
    fallbackDestination
) {

    const icAreaReason =
        document.getElementById("icAreaReason");

    if (!icAreaReason) {
        return;
    }

    const hasGpsOriginFallback =
        fallbackOrigin !== undefined &&
        String(fallbackOrigin).trim() === "";

    const currentOrigin =
        hasGpsOriginFallback
            ? ""
            : selectedOriginAddress ||
                document.getElementById("origin")?.value ||
                fallbackOrigin ||
                "";

    const currentDestination =
        selectedDestinationAddress ||
        document.getElementById("destination")?.value ||
        fallbackDestination ||
        "";

    const currentRouteAnalysisKey =
        buildRouteAnalysisKey(
            currentOrigin,
            currentDestination
        );

    const matchingAnalysis =
        lastHighwayRoutePolylineAnalysis &&
        lastHighwayRoutePolylineAnalysisKey ===
            currentRouteAnalysisKey
            ? lastHighwayRoutePolylineAnalysis
            : null;

    icAreaReason.innerHTML =
        buildPolylineComparisonSummaryHtml(
            matchingAnalysis
        );
}


async function searchAutoExitIcComparison(
    shouldClosePanel = true
) {


    console.log(
        "[IC DEBUG]",
        "searchAutoExitIcComparison開始",
        "shouldClosePanel=",
        shouldClosePanel,
        "lastSearchMode=",
        lastSearchMode
    );

    updateSearchMode("autoExitIcCompareButton");

    if (
        currentLatitude === null ||
        currentLongitude === null
    ) {
        alert("現在地取得待ちです");
        return;
    }

    const destination =
        selectedDestinationAddress ||
        document
            .getElementById("destination")
            .value;

    const acceptableDelay =
        Number(
            document
                .getElementById("acceptableDelay")
                .value
        );

    if (!destination) {
        alert("目的地を入力してください");
        return;
    }

    try {

    const multiExitIcResult =
        document.getElementById("multiExitIcResult");

    if (multiExitIcResult) {
        multiExitIcResult.textContent =
            "候補IC比較中...";
    }

    document
        .getElementById("dashboardDestination")
        .textContent =
        getDestinationDisplayName(destination);


    const origin =
        selectedOriginAddress ||
        document
            .getElementById("origin")
            .value;

    if (origin) {
        await getRoutes(
            origin,
            destination,
            true,
            selectedOriginPlaceId,
            selectedDestinationPlaceId,
            selectedOriginLatLng,
            selectedDestinationLatLng
        );
    }
    else {
        await searchFromCurrentLocation(false, true);
    }

    let icArea =
        document
            .getElementById("icArea")
            .value;

    // resolveGaikanDirectionalIcAreaが判定不能(null)を返した場合の
    // フォールバック用に、自動推定で上書きされる前の値を保持しておく。
    const manualIcArea = icArea;

    const autoIcAreaEnabled =
        document.getElementById("autoIcAreaEnabled")?.checked;

    const icAreaReason =
        document.getElementById("icAreaReason");

    if (icAreaReason) {
        icAreaReason.textContent =
            "Polyline解析結果を確認中...";
    }

    let distanceOnlyIcAreaInfo = null;

    if (autoIcAreaEnabled) {

        if (USE_DISTANCE_ONLY_IC_AREA) {

            const originLatLngForIcArea =
                await getAutoExitComparisonOriginLatLng(origin);

            const destinationLatLngForIcArea =
                await getLatLngFromAddress(destination);

            if (
                originLatLngForIcArea &&
                destinationLatLngForIcArea
            ) {
                distanceOnlyIcAreaInfo =
                    suggestIcAreaByDistanceOnlyForTest(
                        originLatLngForIcArea,
                        destinationLatLngForIcArea
                    );
            }
        }

        if (
            distanceOnlyIcAreaInfo &&
            IC_MASTER[distanceOnlyIcAreaInfo.icArea]
        ) {

            icArea =
                distanceOnlyIcAreaInfo.icArea;

            lastIcAreaDecisionType =
                "distance-only";

            setResolvedIcArea(icArea);

        }
        else {

            if (ENABLE_KEYWORD_AREA_HINT) {

                const suggestedIcArea =
                    await suggestIcArea(origin, destination);

                if (suggestedIcArea) {

                    icArea = suggestedIcArea;

                    setResolvedIcArea(suggestedIcArea);

                }

            }
        }

    }

    const gaikanResolvedIcArea =
        resolveGaikanDirectionalIcArea(
            icArea,
            origin,
            destination
        );

    if (gaikanResolvedIcArea) {
        icArea = gaikanResolvedIcArea;
    }
    else {
        // \u8ddd\u96e2\u306e\u307f\u306b\u3088\u308b\u30a8\u30ea\u30a2\u63a8\u5b9a(suggestIcAreaByDistanceOnlyForTest)\u304c
        // "gaikan"\u3092\u63d0\u6848\u3057\u3066\u3082\u3001\u5b9f\u969b\u306e\u30dd\u30ea\u30e9\u30a4\u30f3\u89e3\u6790\u3067\u5916\u74b0\u3092\u901a\u904e\u3057\u305f
        // \u3053\u3068\u304c\u78ba\u8a8d\u3067\u304d\u306a\u3044\u5834\u5408\u306fresolveGaikanDirectionalIcArea\u304c
        // null\u3092\u8fd4\u3059\uff08\u4f8b\uff1a5\u53f7\u6c60\u888b\u7dda\u306e\u307f\u3067\u5b8c\u7d50\u3059\u308b\u30eb\u30fc\u30c8\uff09\u3002
        // \u3053\u306e\u5834\u5408\u306f\u63a8\u5b9a\u81ea\u4f53\u3092\u7834\u68c4\u3057\u3001\u81ea\u52d5\u63a8\u5b9a\u524d\u306e\u624b\u52d5\u9078\u629eicArea\u306b
        // \u623b\u3057\u3066\u7d9a\u884c\u3059\u308b\u3002\u3053\u3053\u3067\u306eicArea\u306f\u4ee5\u964d\u306e\u51e1\u4f8b(legacySelectedExits)
        // \u751f\u6210\u306b\u306e\u307f\u4f7f\u308f\u308c\u3001\u5b9f\u969b\u306e\u5019\u88dc\u306fPolyline\u30d9\u30fc\u30b9\u306e\u89e3\u6790\u7d50\u679c\u304c
        // \u512a\u5148\u3055\u308c\u308b\u305f\u3081\u3001\u591a\u5c11\u4e0d\u6b63\u78ba\u3067\u3082\u5b9f\u5bb3\u306f\u306a\u3044\u3002
        icArea = manualIcArea;
    }

    if (!icArea || !IC_MASTER[icArea]) {
        alert("\u5916\u74b0\u306e\u8d70\u884c\u65b9\u5411\u3092\u5224\u5b9a\u3067\u304d\u306a\u304b\u3063\u305f\u305f\u3081\u3001\u5019\u88dcIC\u3092\u8868\u793a\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f");
        return;
    }

    const highwayStartInfo =
        await findNearestHighwayStartForAutoExitComparison(
            origin,
            icArea
        );

    if (!highwayStartInfo) {
        alert("\u9ad8\u901f\u8d77\u70b9\u306b\u3067\u304d\u308bIC/\u51fa\u5165\u53e3\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3067\u3057\u305f");
        return;
    }

    const highwayStart =
        highwayStartInfo.exit;

    lastNearestIcName =
        highwayStart.displayName;

    lastNearestIcDistanceKm =
        highwayStartInfo.distanceKm;

    lastTollStartIcName =
        highwayStart.displayName;

    lastTollStartIc =
        highwayStart;

    lastTollStartIcGoogleName =
        highwayStart.googleName;

    lastTollStartIcOrder =
        highwayStart.order ?? null;

    const destinationNearestIc =
        await findDestinationNearestIcForAutoExitComparison(
            destination,
            icArea
        );

    const legacySelectedExits =
        selectExitCandidatesForAutoExitComparison(
            icArea,
            highwayStart,
            destinationNearestIc,
            getActiveIcCandidateCount(),
            {
                lat: highwayStartInfo.baseLat,
                lng: highwayStartInfo.baseLng
            }
        );

    const multiIcCandidateSelection =
        selectPolylineBasedMultiIcCandidates({
            mode: currentMultiIcMode,
            legacySelectedExits,
            origin,
            destination
        });

    const selectedExits =
        multiIcCandidateSelection.selectedExits;

    logMultiIcCandidateSelection(
        currentMultiIcMode,
        multiIcCandidateSelection
    );

    saveDestinationTestCandidateSelection(
        currentMultiIcMode,
        multiIcCandidateSelection
    );

    console.log(
        "[IC DEBUG] auto exit candidates",
        {
            icArea,
            highwayStart,
            destinationNearestIc,
            selectedExits
        }
    );

    const noExitCandidatesMessage =
        "\u6bd4\u8f03\u5bfe\u8c61IC\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3002IC\u5019\u88dc\u30a8\u30ea\u30a2\u3092\u624b\u52d5\u3067\u5909\u66f4\u3057\u3066\u304f\u3060\u3055\u3044";


    const startIcName =
        selectedExits[0]
            ? selectedExits[0].displayName
            : "不明";

    const endIcName =
        selectedExits[selectedExits.length - 1]
            ? selectedExits[selectedExits.length - 1].displayName
            : "不明";

    const experimentalShutoCount =
        selectedExits.filter(exit =>
            exit.experimental === true &&
            exit.roadType === "首都高"
        ).length;

    let reasonText =
        "候補選定：" +
        (origin ? "出発地入力を使用" : "GPS現在地を使用") +
        " / 比較対象：" +
        startIcName +
        "〜" +
        endIcName;

    if (experimentalShutoCount > 0) {
        reasonText +=
            " / 首都高入口テスト中：" +
            experimentalShutoCount +
            "件含む";
    }

    if (lastNearestIcName) {
        reasonText +=
            " / 最寄りIC：" +
            lastNearestIcName +
            "（約" +
            lastNearestIcDistanceKm +
            "km）";
    }


    if (destinationNearestIc) {

        lastTollEndIcName =
            destinationNearestIc.displayName;

        lastTollEndIc =
            destinationNearestIc;

        lastTollEndIcGoogleName =
            destinationNearestIc.googleName;

        lastTollEndIcOrder =
            destinationNearestIc.order;

        reasonText +=
            " / 目的地側IC：" +
            lastTollEndIcName;
    } else {
        lastTollEndIc =
            null;
    }

    reasonText =
        "\u9ad8\u901f\u8d77\u70b9\uff1a" +
        highwayStart.displayName +
        " / \u6bd4\u8f03\u5bfe\u8c61\uff1a" +
        (
            selectedExits[0]
                ? selectedExits[0].displayName
                : "\u306a\u3057"
        ) +
        "\u301c" +
        endIcName;

    if (lastNearestIcName) {
        reasonText +=
            " / \u6700\u5bc4\u308a\uff1a" +
            lastNearestIcName +
            "\uff08\u7d04" +
            lastNearestIcDistanceKm +
            "km\uff09";
    }

    if (distanceOnlyIcAreaInfo) {
        reasonText +=
            " / 方面判定：距離だけ方式" +
            " / 出発地最寄りIC：" +
            distanceOnlyIcAreaInfo.originIc.displayName +
            "（約" +
            distanceOnlyIcAreaInfo.originDistanceKm +
            "km）" +
            " / 目的地最寄りIC：" +
            distanceOnlyIcAreaInfo.destinationIc.displayName +
            "（約" +
            distanceOnlyIcAreaInfo.destinationDistanceKm +
            "km）" +
            " / 距離合計：約" +
            distanceOnlyIcAreaInfo.score +
            "km";
    }

    if (destinationNearestIc) {
        reasonText +=
            " / 目的地側IC：" +
            destinationNearestIc.displayName;
    }

    const savingModeLabel =
        DEV_API_SAVING_MODE
            ? "（API節約モード）"
            : "";

    reasonText +=
        " / 候補選定：" +
        highwayStart.displayName +
        "から" +
        selectedExits.length +
        "件比較" +
        savingModeLabel;

    if (selectedExits.length === 0) {
        reasonText =
            noExitCandidatesMessage;
    }

    updateSearchConditionPolylineAnalysis(
        origin,
        destination
    );

    document
        .getElementById("candidateReason")
        .textContent =
        reasonText;

    const candidateReasonDebug =
        document.getElementById("candidateReasonDebug");

    if (candidateReasonDebug) {
        candidateReasonDebug.textContent =
            reasonText;
    }

    const autoExitIcList =
        selectedExits
            .map(exit => exit.googleName);

    console.log(
        "比較対象IC",
        selectedExits.map(exit => exit.displayName)
    );


    document
        .getElementById("exitIcList")
        .value =
        autoExitIcList.join(", ");

    if (selectedExits.length === 0) {
        document
            .getElementById("multiExitIcResult")
            .textContent =
            noExitCandidatesMessage;
    }
    else if (currentMultiIcMode === "entrance") {
        await searchEntranceIcComparisonV2({
            origin: origin,
            destination: destination,
            selectedExits: selectedExits
        });
    }
    else {
        await searchExitIcComparisonV2({
            origin: origin,
            destination: destination,
            selectedExits: selectedExits
        });
    }

    const autoCompareCheckbox =
        document.getElementById("autoCompareEnabled");


    lastSearchLatitude =
        currentLatitude;

    lastSearchLongitude =
        currentLongitude;

    lastSearchTime =
        Date.now();

    lastSearchLocationName =
        document
            .getElementById("currentLocation")
            .textContent;

    document
        .getElementById("lastSearchLocation")
        .textContent =
        lastSearchLocationName;

    document
        .getElementById("lastRouteSearchTime")
        .textContent =
        new Date().toLocaleTimeString("ja-JP");

    document
        .getElementById("nextUpdateInfo")
        .textContent =
        getAutoUpdateCountdownText(
            getAutoUpdateDistanceThreshold(),
            getAutoUpdateTimeThreshold()
        );

    blinkElementById(
        "nextUpdateInfo",
        "update-blink"
    );



    if (
        autoCompareCheckbox &&
        !autoCompareCheckbox.disabled
    ) {
        autoCompareCheckbox.checked = true;
    }

    if (shouldClosePanel) {
        closeSearchPanel();
    }

    if (shouldClosePanel) {
        scrollToDashboardCard();
    }

    } catch (error) {

        lastAutoReSearchFailureTime =
            Date.now();

        console.error(error);

        const multiExitIcResult =
            document.getElementById("multiExitIcResult");

        if (multiExitIcResult) {
            multiExitIcResult.textContent =
                "候補IC比較でエラーが発生しました。\n\n" +
                (error.message || String(error)) +
                "\n\n時間を置いて再実行してください。";
        }

    } finally {
        // 処理中表示は成功時の結果表示またはcatchのエラー表示で上書きされる。
    }

}


async function runCandidateIcTest() {

    const button =
        document.getElementById("candidateIcTestButton");

    const resultArea =
        document.getElementById("candidateIcTestResult");

    if (!resultArea) {
        return;
    }

    if (
        !window.google ||
        !window.google.maps ||
        !window.google.maps.Geocoder
    ) {
        resultArea.textContent =
            "NG\nエラー内容: Google Maps 読み込み前です";
        return;
    }

    if (button) {
        button.disabled = true;
    }

    resultArea.textContent =
        "候補ICテスト実行中...";

    const savedLatitude = currentLatitude;
    const savedLongitude = currentLongitude;
    const savedDecisionType = lastIcAreaDecisionType;

    const results = [];

    try {

        for (const destination of TEST_DESTINATIONS) {

            const routes = [
                {
                    expectedArea: destination.area,
                    origin: TEST_ORIGIN,
                    destination: destination.name
                },
                {
                    expectedArea: destination.area,
                    origin: destination.name,
                    destination: TEST_ORIGIN
                }
            ];

            for (const route of routes) {
                results.push(
                    await runCandidateIcTestCase(route)
                );
            }
        }

        resultArea.textContent =
            formatCandidateIcTestResults(results);

    } finally {

        currentLatitude = savedLatitude;
        currentLongitude = savedLongitude;
        lastIcAreaDecisionType = savedDecisionType;

        if (button) {
            button.disabled = false;
        }
    }
}

async function runCandidateIcTestCase(route) {

    const result = {
        ok: false,
        expectedArea: route.expectedArea,
        actualArea: "",
        geometryArea: "",
        geometryOk: false,
        geometrySummary: "",
        geometryTopResults: [],
        nearestIcArea: "",
        nearestIcOk: false,
        nearestIcName: "",
        nearestIcDistanceKm: null,
        distanceOnlyArea: "",
        distanceOnlyOk: false,
        distanceOnlySummary: "",
        distanceOnlyTopResults: [],
        origin: route.origin,
        destination: route.destination,
        direction: "",
        highwayStart: "",
        candidateCount: 0,
        candidates: [],
        error: ""
    };

    try {

        const originLatLng =
            await getLatLngFromAddress(route.origin);

        if (!originLatLng) {
            throw new Error(
                "起点を座標化できません: " + route.origin
            );
        }

        currentLatitude = originLatLng.lat;
        currentLongitude = originLatLng.lng;

        const nearestIcSuggestion =
            await suggestIcAreaByNearestIc(
                route.origin,
                originLatLng
            );

        result.nearestIcArea =
            nearestIcSuggestion?.icArea || "";

        result.nearestIcOk =
            result.nearestIcArea === route.expectedArea;

        result.nearestIcName =
            nearestIcSuggestion?.exit?.displayName || "";

        result.nearestIcDistanceKm =
            nearestIcSuggestion?.distanceKm ?? null;

        const destinationLatLng =
            await getLatLngFromAddress(route.destination);

        if (!destinationLatLng) {
            throw new Error(
                "目的地を座標化できません: " +
                route.destination
            );
        }

        const distanceOnlySuggestion =
            suggestIcAreaByDistanceOnlyForTest(
                originLatLng,
                destinationLatLng
            );

        result.distanceOnlyArea =
            distanceOnlySuggestion?.icArea || "";

        result.distanceOnlyOk =
            result.distanceOnlyArea === route.expectedArea;

        result.distanceOnlySummary =
            formatDistanceOnlySuggestionSummaryForTest(
                distanceOnlySuggestion
            );

        result.distanceOnlyTopResults =
            distanceOnlySuggestion?.scores?.slice(0, 3) || [];

        const geometrySuggestion =
            await getIcAreaGeometrySuggestionForTest(
                route.origin,
                route.destination,
                originLatLng
            );

        result.geometryArea =
            geometrySuggestion?.icArea || "";

        result.geometryOk =
            result.geometryArea === route.expectedArea;

        result.geometrySummary =
            formatGeometrySuggestionSummaryForTest(
                geometrySuggestion
            );

        result.geometryTopResults =
            geometrySuggestion?.scores?.slice(0, 3) || [];

        const icArea =
            await suggestIcArea(
                route.origin,
                route.destination
            );

        if (!icArea || !IC_MASTER[icArea]) {
            throw new Error(
                "方面判定ができません: " + route.destination
            );
        }

        result.actualArea = icArea;
        result.direction =
            IC_MASTER[icArea].label +
            " / " +
            getIcAreaDecisionLabel();

        const highwayStartInfo =
            await findNearestHighwayStartByPointForCandidateIcTest(
                icArea,
                originLatLng.lat,
                originLatLng.lng
            );

        if (!highwayStartInfo) {
            throw new Error(
                "高速起点にできるIC/出入口が見つかりません"
            );
        }

        result.highwayStart =
            highwayStartInfo.exit.displayName +
            "（約" +
            highwayStartInfo.distanceKm +
            "km）";

        const destinationNearestIc =
            await findNearestIcInfoByPoint(
                icArea,
                destinationLatLng.lat,
                destinationLatLng.lng
            );

        const selectedExits =
            selectExitCandidatesForAutoExitComparison(
                icArea,
                highwayStartInfo.exit,
                destinationNearestIc,
                getActiveIcCandidateCount(),
                originLatLng
            );

        result.candidates =
            selectedExits.map(exit => exit.displayName);

        result.candidateCount =
            selectedExits.length;

        result.ok =
            selectedExits.length > 0 &&
            route.expectedArea === icArea;

        if (route.expectedArea !== icArea) {
            result.error =
                "期待方面と実際方面が違います";
        }
        else if (!result.ok) {
            result.error =
                "候補IC数が0件です";
        }

    } catch (error) {

        result.error =
            error.message || String(error);
    }

    return result;
}

async function suggestIcAreaByGeometryForTest(
    origin,
    destination
) {

    const suggestion =
        await getIcAreaGeometrySuggestionForTest(
            origin,
            destination
        );

    return suggestion?.icArea || null;
}

async function suggestIcAreaByNearestIc(
    origin,
    originLatLng = null
) {

    const resolvedOriginLatLng =
        originLatLng ||
        await getLatLngFromAddress(origin);

    if (!resolvedOriginLatLng) {
        return null;
    }

    let nearest = null;
    let nearestDistance = Infinity;
    let nearestIcArea = "";

    for (const icArea in IC_MASTER) {

        for (const exit of IC_MASTER[icArea].exits) {

            if (
                exit.experimental === true ||
                exit.isSelectable === false ||
                exit.lat === undefined ||
                exit.lng === undefined
            ) {
                continue;
            }

            const distance =
                calculateDistance(
                    resolvedOriginLatLng.lat,
                    resolvedOriginLatLng.lng,
                    exit.lat,
                    exit.lng
                );

            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearest = exit;
                nearestIcArea = icArea;
            }
        }
    }

    if (!nearest) {
        return null;
    }

    return {
        icArea: nearestIcArea,
        exit: nearest,
        distanceKm: Math.round(nearestDistance / 1000)
    };
}

// 標準判定ロジック
// 目的地最寄りICの距離を優先し、同距離なら出発地との距離合計で選ぶ。
function suggestIcAreaByDistanceOnlyForTest(
    originLatLng,
    destinationLatLng
) {

    if (
        !originLatLng ||
        !destinationLatLng
    ) {
        return null;
    }

    const scores = [];

    for (const icArea in IC_MASTER) {

        // gaikanUchimawari・shutoC1Uchimawari/shutoC2Uchimawari・線形10路線分の
        // ミラーエリア（"Uchimawari"で終わるキー）は、方向判定
        // （inferTravelDirectionForIcArea等）から明示的なキー指定でのみ
        // 参照される想定の内部データであり、この関数のような
        // 「距離が最も近いエリアを探す」用途の候補には含めない。
        // 含めてしまうと、entranceSelectable/exitSelectableが
        // 片方向のみtrueのミラーICが最近傍として選ばれ、
        // 後続の役割別（入口/出口）検索が0件になる場合がある。
        if (icArea.endsWith("Uchimawari")) {
            continue;
        }

        const originNearest =
            findNearestRegisteredIcForDistanceOnlyTest(
                icArea,
                originLatLng.lat,
                originLatLng.lng
            );

        const destinationNearest =
            findNearestRegisteredIcForDistanceOnlyTest(
                icArea,
                destinationLatLng.lat,
                destinationLatLng.lng
            );

        if (
            !originNearest ||
            !destinationNearest
        ) {
            continue;
        }

        const orderDiff =
            Math.abs(
                (destinationNearest.exit.order ?? 0) -
                (originNearest.exit.order ?? 0)
            );

        const score =
            originNearest.distanceKm +
            destinationNearest.distanceKm;

        scores.push({
            icArea,
            score,
            originIc: originNearest.exit,
            destinationIc: destinationNearest.exit,
            originDistanceKm: originNearest.distanceKm,
            destinationDistanceKm: destinationNearest.distanceKm,
            orderDiff
        });
    }

    scores.sort((a, b) =>
        a.destinationDistanceKm - b.destinationDistanceKm ||
        a.score - b.score
    );

    if (!scores[0]) {
        return null;
    }

    return {
        ...scores[0],
        scores
    };
}

function findNearestRegisteredIcForDistanceOnlyTest(
    icArea,
    baseLat,
    baseLng
) {

    let nearest = null;
    let nearestDistance = Infinity;

    for (const exit of IC_MASTER[icArea].exits) {

        if (
            exit.experimental === true ||
            exit.isSelectable === false ||
            exit.lat === undefined ||
            exit.lng === undefined
        ) {
            continue;
        }

        const distance =
            calculateDistance(
                baseLat,
                baseLng,
                exit.lat,
                exit.lng
            );

        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = exit;
        }
    }

    if (!nearest) {
        return null;
    }

    return {
        exit: nearest,
        distanceKm: Math.round(nearestDistance / 1000)
    };
}

async function getIcAreaGeometrySuggestionForTest(
    origin,
    destination,
    originLatLng = null
) {

    const resolvedOriginLatLng =
        originLatLng ||
        await getLatLngFromAddress(origin);

    const destinationLatLng =
        await getLatLngFromAddress(destination);

    if (
        !resolvedOriginLatLng ||
        !destinationLatLng
    ) {
        return null;
    }

    const scores = [];

    for (const icArea in IC_MASTER) {

        const originNearest =
            await findNearestIcForGeometryTest(
                icArea,
                resolvedOriginLatLng.lat,
                resolvedOriginLatLng.lng
            );

        const destinationNearest =
            await findNearestIcForGeometryTest(
                icArea,
                destinationLatLng.lat,
                destinationLatLng.lng
            );

        if (
            !originNearest ||
            !destinationNearest
        ) {
            continue;
        }

        const orderDiff =
            Math.abs(
                (destinationNearest.exit.order ?? 0) -
                (originNearest.exit.order ?? 0)
            );

        const score =
            calculateIcAreaGeometryScoreForTest(
                originNearest.distanceKm,
                destinationNearest.distanceKm
            );

        scores.push({
            icArea,
            score,
            originIc: originNearest.exit,
            destinationIc: destinationNearest.exit,
            originDistanceKm: originNearest.distanceKm,
            destinationDistanceKm: destinationNearest.distanceKm,
            orderDiff
        });
    }

    scores.sort((a, b) => a.score - b.score);

    console.log(
        "[IC GEOMETRY TEST]",
        origin,
        "→",
        destination
    );

    console.table(
        scores.map(item => ({
            icArea: item.icArea,
            score: item.score,
            originIc: item.originIc.displayName,
            originDistanceKm: item.originDistanceKm,
            destinationIc: item.destinationIc.displayName,
            destinationDistanceKm: item.destinationDistanceKm,
            orderDiff: item.orderDiff
        }))
    );

    if (!scores[0]) {
        return null;
    }

    return {
        ...scores[0],
        scores
    };
}

function calculateIcAreaGeometryScoreForTest(
    originDistanceKm,
    destinationDistanceKm
) {

    let score =
        destinationDistanceKm * 2 +
        originDistanceKm * 0.5;

    return Math.round(score * 10) / 10;
}

async function findNearestIcForGeometryTest(
    icArea,
    baseLat,
    baseLng
) {

    const exits =
        IC_MASTER[icArea].exits
            .slice()
            .sort((a, b) =>
                (a.order ?? 999) - (b.order ?? 999)
            );

    let nearest = null;
    let nearestDistance = Infinity;

    for (const exit of exits) {

        if (
            exit.experimental === true ||
            exit.isSelectable === false
        ) {
            continue;
        }

        let exitLat = exit.lat;
        let exitLng = exit.lng;

        if (
            exitLat === undefined ||
            exitLng === undefined
        ) {

            const exitLatLng =
                await getLatLngFromAddress(exit.googleName);

            if (!exitLatLng) {
                continue;
            }

            exit.lat = exitLatLng.lat;
            exit.lng = exitLatLng.lng;

            exitLat = exit.lat;
            exitLng = exit.lng;
        }

        const distance =
            calculateDistance(
                baseLat,
                baseLng,
                exitLat,
                exitLng
            );

        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = exit;
        }
    }

    if (!nearest) {
        return null;
    }

    return {
        exit: nearest,
        distanceKm: Math.round(nearestDistance / 1000)
    };
}

async function findNearestHighwayStartByPointForCandidateIcTest(
    icArea,
    baseLat,
    baseLng
) {

    const exits =
        IC_MASTER[icArea].exits
            .slice()
            .sort((a, b) =>
                (a.order ?? 999) - (b.order ?? 999)
            );

    let nearest = null;
    let nearestDistance = Infinity;

    for (const exit of exits) {

        if (exit.isSelectable === false) {
            continue;
        }

        let exitLat = exit.lat;
        let exitLng = exit.lng;

        if (
            exitLat === undefined ||
            exitLng === undefined
        ) {

            const exitLatLng =
                await getLatLngFromAddress(exit.googleName);

            if (!exitLatLng) {
                continue;
            }

            exit.lat = exitLatLng.lat;
            exit.lng = exitLatLng.lng;

            exitLat = exit.lat;
            exitLng = exit.lng;
        }

        const distance =
            calculateDistance(
                baseLat,
                baseLng,
                exitLat,
                exitLng
            );

        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = exit;
        }
    }

    if (!nearest) {
        return null;
    }

    return {
        exit: nearest,
        distanceKm: Math.round(nearestDistance / 1000)
    };
}

function formatCandidateIcTestResults(results) {

    const okCount =
        results.filter(result => result.ok).length;

    const geometryOkCount =
        results.filter(result => result.geometryOk).length;

    const distanceOnlyOkCount =
        results.filter(result => result.distanceOnlyOk).length;

    const nearestIcOkCount =
        results.filter(result => result.nearestIcOk).length;

    const lines = [
        "候補ICテスト結果",
        "座標/距離/最寄IC方式：首都高experimental除外あり",
        "現行OK: " + okCount + " / " + results.length,
        "座標ベースOK: " + geometryOkCount + " / " + results.length,
        "距離だけOK: " + distanceOnlyOkCount + " / " + results.length,
        "最寄IC方式OK: " + nearestIcOkCount + " / " + results.length,
        ""
    ];

    results.forEach((result, index) => {

        lines.push(
            "[" +
            (index + 1) +
            "] " +
            (result.ok ? "OK" : "NG") +
            " " +
            result.expectedArea +
            " / " +
            result.origin +
            " → " +
            result.destination
        );

        lines.push(
            "期待方面: " +
            formatCandidateIcAreaForTest(
                result.expectedArea
            )
        );

        lines.push(
            "現行判定: " +
            formatCandidateIcAreaForTest(
                result.actualArea
            )
        );

        lines.push(
            "座標ベース判定: " +
            formatCandidateIcAreaForTest(
                result.geometryArea
            )
        );

        lines.push(
            "座標ベース一致: " +
            (result.geometryOk ? "OK" : "NG")
        );

        lines.push(
            "座標ベース詳細: " +
            (result.geometrySummary || "--")
        );

        lines.push("座標ベース上位3方面:");

        lines.push(
            formatGeometryTopResultsForTest(
                result.geometryTopResults
            )
        );

        lines.push(
            "距離だけ判定: " +
            formatCandidateIcAreaForTest(
                result.distanceOnlyArea
            )
        );

        lines.push(
            "距離だけ一致: " +
            (result.distanceOnlyOk ? "OK" : "NG")
        );

        lines.push(
            "距離だけ詳細: " +
            (result.distanceOnlySummary || "--")
        );

        lines.push("距離だけ上位3方面:");

        lines.push(
            formatDistanceOnlyTopResultsForTest(
                result.distanceOnlyTopResults
            )
        );

        lines.push(
            "最寄IC方式判定: " +
            formatCandidateIcAreaForTest(
                result.nearestIcArea
            )
        );

        lines.push(
            "最寄IC: " +
            (result.nearestIcName || "--")
        );

        lines.push(
            "距離: " +
            (
                result.nearestIcDistanceKm === null
                    ? "--"
                    : result.nearestIcDistanceKm + "km"
            )
        );

        lines.push(
            "一致: " +
            (result.nearestIcOk ? "OK" : "NG")
        );

        lines.push(
            "方面判定: " +
            (result.direction || "--")
        );

        lines.push(
            "高速起点: " +
            (result.highwayStart || "--")
        );

        lines.push(
            "候補IC数: " +
            result.candidateCount
        );

        lines.push(
            "候補IC一覧: " +
            (
                result.candidates.length > 0
                    ? result.candidates.join(", ")
                    : "--"
            )
        );

        lines.push(
            "エラー内容: " +
            (result.error || "--")
        );

        lines.push("");
    });

    return lines.join("\n");
}

function formatCandidateIcAreaForTest(icArea) {

    if (!icArea) {
        return "--";
    }

    if (!IC_MASTER[icArea]) {
        return icArea;
    }

    return icArea + "（" + IC_MASTER[icArea].label + "）";
}

function formatGeometrySuggestionSummaryForTest(suggestion) {

    if (!suggestion) {
        return "--";
    }

    return (
        "score=" +
        suggestion.score +
        " / 出発地最寄り=" +
        suggestion.originIc.displayName +
        "（約" +
        suggestion.originDistanceKm +
        "km）" +
        " / 目的地最寄り=" +
        suggestion.destinationIc.displayName +
        "（約" +
        suggestion.destinationDistanceKm +
        "km）" +
        " / order差=" +
        suggestion.orderDiff
    );
}

function formatDistanceOnlySuggestionSummaryForTest(suggestion) {

    if (!suggestion) {
        return "--";
    }

    return (
        "score=" +
        suggestion.score +
        " / 出発地最寄り=" +
        suggestion.originIc.displayName +
        "（約" +
        suggestion.originDistanceKm +
        "km）" +
        " / 目的地最寄り=" +
        suggestion.destinationIc.displayName +
        "（約" +
        suggestion.destinationDistanceKm +
        "km）" +
        " / order差=" +
        suggestion.orderDiff
    );
}

function formatGeometryTopResultsForTest(results) {

    if (
        !results ||
        results.length === 0
    ) {
        return "--";
    }

    return results
        .map((item, index) =>
            "  " +
            (index + 1) +
            ". icArea=" +
            item.icArea +
            " / score=" +
            item.score +
            " / 出発地最寄りIC=" +
            item.originIc.displayName +
            " / 出発地距離=" +
            item.originDistanceKm +
            "km" +
            " / 目的地最寄りIC=" +
            item.destinationIc.displayName +
            " / 目的地距離=" +
            item.destinationDistanceKm +
            "km" +
            " / order差=" +
            item.orderDiff
        )
        .join("\n");
}

function formatDistanceOnlyTopResultsForTest(results) {

    if (
        !results ||
        results.length === 0
    ) {
        return "--";
    }

    return results
        .map((item, index) =>
            "  " +
            (index + 1) +
            ". icArea=" +
            item.icArea +
            " / score=" +
            item.score +
            " / 出発地最寄りIC=" +
            item.originIc.displayName +
            " / 出発地距離=" +
            item.originDistanceKm +
            "km" +
            " / 目的地最寄りIC=" +
            item.destinationIc.displayName +
            " / 目的地距離=" +
            item.destinationDistanceKm +
            "km" +
            " / order差=" +
            item.orderDiff
        )
        .join("\n");
}


function findNearbyInterchanges() {

    alert("周辺IC検索を開始します");


    if (
        currentLatitude === null ||
        currentLongitude === null
    ) {
        alert("現在地取得待ちです");
        return;
    }

    document
        .getElementById("nearbyIcResult")
        .textContent =
        "検索中...";

    const currentLocation =
        new google.maps.LatLng(
            currentLatitude,
            currentLongitude
        );

    const service =
        new google.maps.places.PlacesService(
            document.createElement("div")
        );

    const request = {
        location: currentLocation,
        radius: 50000,
        query: "高速道路 インターチェンジ IC"
    };

    service.textSearch(
        request,
        (results, status) => {


            if (
                status !==
                google.maps.places.PlacesServiceStatus.OK
            ) {
                document
                    .getElementById("nearbyIcResult")
                    .textContent =
                    "IC候補が見つかりませんでした";
                return;
            }


            console.log(
                "Places検索結果:",
                results.map(place => place.name)
            );

            document
                .getElementById("nearbyIcResult")
                .innerHTML =
                results
                    .map(place => "<div>" + place.name + "</div>")
                    .join("");

            return;

            const icNames =
                results
                    .map(place => place.name)
                    .filter(name =>
                        name.includes("インターチェンジ") ||
                        name.endsWith("IC") ||
                        name.endsWith("スマートIC")
                    )
                    .filter(name =>
                        !name.includes("BOOKSTORE") &&
                        !name.includes("TSUTAYA") &&
                        !name.includes("ENEOS") &&
                        !name.includes("ガソリンスタンド") &&
                        !name.includes("コンビニ")
                    );

            if (icNames.length === 0) {
                document
                    .getElementById("nearbyIcResult")
                    .textContent =
                    "ICらしい候補が見つかりませんでした";
                return;
            }

            document
                .getElementById("nearbyIcResult")
                .innerHTML =
                icNames
                    .map(name => "<div>" + name + "</div>")
                    .join("");
        }
    );
}


function getIcAreaByKeyword(text) {

    const areaKeywords = {
        keiyo: [
            "\u6771\u4eac\u30c7\u30a3\u30ba\u30cb\u30fc\u30e9\u30f3\u30c9",
            "\u30c7\u30a3\u30ba\u30cb\u30fc\u30e9\u30f3\u30c9",
            "\u6771\u4eac\u30c7\u30a3\u30ba\u30cb\u30fc\u30b7\u30fc",
            "\u30c7\u30a3\u30ba\u30cb\u30fc\u30b7\u30fc",
            "\u6771\u4eac\u30c7\u30a3\u30ba\u30cb\u30fc\u30ea\u30be\u30fc\u30c8",
            "\u30c7\u30a3\u30ba\u30cb\u30fc\u30ea\u30be\u30fc\u30c8",
            "\u821e\u6d5c",
            "\u6d66\u5b89",
            "\u6e7e\u5cb8",
            "\u4eac\u8449",
            "船橋", "幕張", "幕張メッセ", "稲毛", "千葉市",
            "蘇我", "市川", "原木", "習志野", "津田沼",
            "船橋市", "市川市", "浦安", "舞浜", "ディズニー"
        ],

        tokan: [
            "成田", "成田空港", "佐倉", "酒々井", "富里",
            "八街", "香取", "佐原", "潮来", "鹿嶋", "鹿島",
            "銚子", "旭", "匝瑳", "東金", "九十九里"
        ],

        tateyama: [
            "館山", "南房総", "富浦", "鋸南", "保田",
            "富津", "君津", "木更津", "鴨川", "勝浦",
            "御宿", "大多喜", "いすみ", "養老渓谷",
            "マザー牧場", "東京ドイツ村", "鴨川シーワールド"
        ],

        aqualine: [
            "アクアライン", "海ほたる", "木更津金田",
            "三井アウトレットパーク木更津", "アウトレット木更津",
            "袖ケ浦", "袖ヶ浦"
        ],

        joban: [
            "ハワイアンズ", "いわき", "水戸", "日立",
            "三郷", "流山", "柏", "守谷", "谷和原",
            "谷田部", "つくば", "筑波", "筑波山",
            "土浦", "石岡", "千代田石岡", "笠間", "岩間"
        ],

        tohoku: [
            "日光", "宇都宮", "那須", "福島", "郡山",
            "白河", "佐野", "栃木"
        ],

        kanetsu: [
            "軽井沢", "高崎", "前橋", "草津", "川越",
            "所沢", "秩父", "長瀞", "水上", "沼田"
        ],

        chuo: [
            "河口湖", "山梨", "甲府", "八王子", "相模湖",
            "相模原", "プレジャーフォレスト", "大月",
            "富士急", "富士山", "清里", "高尾"
        ],

        tomei: [
            "御殿場", "箱根", "沼津", "静岡", "厚木",
            "海老名", "小田原", "熱海", "伊豆"
        ]
    };

    for (const areaKey in areaKeywords) {

        if (
            areaKeywords[areaKey].some(keyword =>
                text.includes(keyword)
            )
        ) {
            return areaKey;
        }
    }

    return null;
}


function getIcAreaDecisionLabel() {

    if (lastIcAreaDecisionType === "distance-only") {
        return "距離だけ方式";
    }

    if (lastIcAreaDecisionType === "origin-keyword") {
        return "出発地キーワード判定";
    }

    if (lastIcAreaDecisionType === "current-location") {
        return "現在地から判定";
    }

    if (lastIcAreaDecisionType === "destination-keyword") {
        return "目的地キーワード判定";
    }

    if (lastIcAreaDecisionType === "direction") {
        return "方角推定・首都圏向け";
    }

    return "自動判定";
}

function getIcAreaDecisionMethodForLog() {

    if (USE_DISTANCE_ONLY_IC_AREA) {
        return ENABLE_KEYWORD_AREA_HINT
            ? "distance-only + keyword"
            : "distance-only";
    }

    return ENABLE_KEYWORD_AREA_HINT
        ? "keyword"
        : "manual";
}

async function suggestIcArea(origin, destination) {

    if (!destination) {
        return null;
    }

    if (!ENABLE_KEYWORD_AREA_HINT) {
        return await suggestIcAreaByDirection(destination);
    }

    const originText =
        (origin || "").trim();

    const destinationText =
        (destination || "").trim();

    if (originText) {

        const originArea =
            getIcAreaByKeyword(originText);

        if (originArea) {

            lastIcAreaDecisionType =
                "origin-keyword";

            return originArea;
        }
    }

    if (!originText) {

        const currentLocationText =
            document
                .getElementById("currentLocation")
                ?.textContent || "";

        const currentArea =
            getIcAreaByKeyword(currentLocationText);

        if (currentArea) {

            lastIcAreaDecisionType =
                "current-location";

            return currentArea;
        }
    }

    const destinationArea =
        getIcAreaByKeyword(destinationText);

    if (destinationArea) {

        lastIcAreaDecisionType =
            "destination-keyword";

        return destinationArea;
    }

    return await suggestIcAreaByDirection(destination);
}


function getIcDisplayName(googleName) {

    for (const areaKey in IC_MASTER) {

        const exits =
            IC_MASTER[areaKey].exits;

        const found =
            exits.find(exit =>
                exit.googleName === googleName
            );

        if (found) {
            return found.displayName;
        }
    }

    return shortenIcName(googleName);
}

function getCandidateStartIndex(origin, icArea) {

    if (origin) {

        if (icArea === "joban") {

            if (
                origin.includes("石岡") ||
                origin.includes("土浦")
            ) {
                return 7;
            }

            if (
                origin.includes("つくば") ||
                origin.includes("牛久")
            ) {
                return 5;
            }

            if (
                origin.includes("守谷") ||
                origin.includes("取手") ||
                origin.includes("柏") ||
                origin.includes("流山")
            ) {
                return 1;
            }

            return 0;
        }

        return 0;
    }

    const currentLocationText =
        document
            .getElementById("currentLocation")
            .textContent;

    if (icArea === "joban") {

        if (
            currentLocationText.includes("石岡") ||
            currentLocationText.includes("土浦")
        ) {
            return 7;
        }

        if (
            currentLocationText.includes("つくば") ||
            currentLocationText.includes("牛久")
        ) {
            return 5;
        }

        if (
            currentLocationText.includes("守谷") ||
            currentLocationText.includes("取手") ||
            currentLocationText.includes("柏") ||
            currentLocationText.includes("流山")
        ) {
            return 1;
        }

        return findNearestIcIndex(icArea);
    }


    if (
        lastSearchLatitude === null ||
        currentLatitude === null
    ) {
        return 0;
    }

    const distanceKm =
        calculateDistance(
            lastSearchLatitude,
            lastSearchLongitude,
            currentLatitude,
            currentLongitude
        ) / 1000;

    if (distanceKm >= 40) {
        return 2;
    }

    if (distanceKm >= 20) {
        return 1;
    }

    return 0;
}

async function getHighwayRouteFromOrigin(
    origin,
    destination
) {

    if (origin) {
        return await getHighwayRoute(
            origin,
            destination
        );
    }

    return await getHighwayRouteFromGps(
        destination
    );
}

function checkIcMasterHealth() {

    console.table(
        Object.entries(IC_MASTER).map(
            ([key, value]) => ({
                area: key,
                label: value.label,
                icCount: value.exits.length,
                firstIc: value.exits[0]?.displayName,
                lastIc:
                    value.exits[
                        value.exits.length - 1
                    ]?.displayName,
                firstOrder: value.exits[0]?.order,
                lastOrder:
                    value.exits[
                        value.exits.length - 1
                    ]?.order,
                missingLatLng:
                    value.exits.filter(
                        exit =>
                            exit.lat === undefined ||
                            exit.lng === undefined
                    ).length
            })
        )
    );
}

async function checkSuggestIcArea() {

    const testCases = [
        ["東京都荒川区", "スパリゾートハワイアンズ"],
        ["スパリゾートハワイアンズ", "東京都荒川区"],

        ["東京都荒川区", "幕張メッセ"],
        ["幕張メッセ", "東京都荒川区"],

        ["東京都荒川区", "成田空港"],
        ["成田空港", "東京都荒川区"],

        ["東京都荒川区", "海ほたる"],
        ["海ほたる", "東京都荒川区"],

        ["東京都荒川区", "館山"],
        ["館山", "東京都荒川区"],

        ["東京都荒川区", "マザー牧場"],
        ["マザー牧場", "東京都荒川区"]
    ];

    const results = [];

    for (const [origin, destination] of testCases) {
        results.push({
            origin,
            destination,
            area: await suggestIcArea(
                origin,
                destination
            )
        });
    }

    console.table(results);
}



function updateAutoCompareToggleState() {

    const originInput =
        document.getElementById("origin");

    const autoCompareCheckbox =
        document.getElementById("autoCompareEnabled");

    if (!originInput || !autoCompareCheckbox) {
        return;
    }

    if (originInput.value.trim() !== "") {

        autoCompareCheckbox.checked = false;
        autoCompareCheckbox.disabled = true;

    }
    else {

        autoCompareCheckbox.disabled = false;

    }
}

function closeSearchPanel() {
    const searchPanel =
        document.getElementById("searchPanel");

    if (searchPanel) {
        searchPanel.open = false;
    }
}

function updateGpsStatus() {

    const gpsStatus =
        document.getElementById("gpsStatus");

    if (!gpsStatus) {
        return;
    }

    if (!lastGpsReceivedTime) {
        gpsStatus.textContent = "未受信";
        gpsStatus.className = "gps-status-warning";
        return;
    }

    const elapsedSeconds =
        Math.round(
            (Date.now() - lastGpsReceivedTime) / 1000
        );

    if (elapsedSeconds >= 60) {

        gpsStatus.textContent =
            "異常（" + elapsedSeconds + "秒受信なし）";

        if (!gpsErrorBlinkShown) {

            gpsStatus.className =
                "gps-status-error gps-status-blink";

            gpsErrorBlinkShown = true;

            setTimeout(() => {
                gpsStatus.classList.remove("gps-status-blink");
            }, 3000);

        }
        else {
            gpsStatus.className =
                "gps-status-error";
        }

        return;
    }

    gpsStatus.textContent = "正常";
    gpsStatus.className = "gps-status-normal";

    gpsErrorBlinkShown = false;
}



function blinkElementById(id, className) {

    const element =
        document.getElementById(id);

    if (!element) {
        return;
    }

    element.classList.remove(className);

    void element.offsetWidth;

    element.classList.add(className);
}

function updateDashboardTimeColors(
    highwayMinutes,
    localMinutes
) {
    const classes =
        getTimeComparisonColorClasses(
            highwayMinutes,
            localMinutes
        );

    setDashboardRouteTimeClasses(
        classes.highwayClass,
        classes.localClass
    );
}

function getTimeComparisonColorClasses(
    highwayMinutes,
    localMinutes
) {

    if (
        !Number.isFinite(Number(highwayMinutes)) ||
        !Number.isFinite(Number(localMinutes))
    ) {
        return {
            highwayClass: "time-neutral",
            localClass: "time-neutral"
        };
    }

    const diff =
        Math.abs(
            Number(highwayMinutes) -
            Number(localMinutes)
        );

    if (diff <= 2) {
        return {
            highwayClass: "time-neutral",
            localClass: "time-neutral"
        };
    }

    if (Number(highwayMinutes) < Number(localMinutes)) {
        return {
            highwayClass: "time-good",
            localClass: "time-bad"
        };
    }

    return {
        highwayClass: "time-bad",
        localClass: "time-good"
    };
}

function setDashboardRouteTimeClasses(
    highwayClassName,
    localClassName
) {

    const highwayElement =
        document.getElementById("dashboardHighway");

    const localElement =
        document.getElementById("dashboardLocal");

    if (!highwayElement || !localElement) {
        return;
    }

    highwayElement.classList.remove(
        "time-good",
        "time-bad",
        "time-neutral"
    );

    localElement.classList.remove(
        "time-good",
        "time-bad",
        "time-neutral"
    );

    if (highwayClassName) {
        highwayElement.classList.add(highwayClassName);
    }

    if (localClassName) {
        localElement.classList.add(localClassName);
    }
}

function setDashboardRouteDimmed(
    highwayDimmed,
    localDimmed
) {

    const highwayCard =
        document
            .getElementById("dashboardHighway")
            ?.closest(".time-box");

    const localCard =
        document
            .getElementById("dashboardLocal")
            ?.closest(".time-box");

    if (highwayCard) {
        highwayCard.classList.toggle(
            "dashboard-route-dimmed",
            highwayDimmed
        );
    }

    if (localCard) {
        localCard.classList.toggle(
            "dashboard-route-dimmed",
            localDimmed
        );
    }
}

function setCurrentLocationText(text) {

    const currentLocation =
        document.getElementById("currentLocation");

    if (!currentLocation) {
        return;
    }

    currentLocation.textContent = text;

    currentLocation.classList.remove(
        "location-normal",
        "location-warning",
        "location-error"
    );

    if (
        text === "位置不明" ||
        text === "取得失敗"
    ) {
        currentLocation.classList.add("location-error");
    }
    else if (
        text === "取得中..." ||
        text === "GPS待機中"
    ) {
        currentLocation.classList.add("location-warning");
    }
    else {
        currentLocation.classList.add("location-normal");
    }
}

function initializeAutoUpdateToggle() {

    const toggleButton =
        document.getElementById("autoUpdateToggle");

    if (!toggleButton) {
        return;
    }

    toggleButton.addEventListener("click", () => {
        isAutoUpdateEnabled = !isAutoUpdateEnabled;
        renderAutoUpdateStatus();

        if (
            isAutoUpdateEnabled &&
            currentLatitude !== null &&
            currentLongitude !== null
        ) {
            checkAutoReSearch();
        }
    });

    const nextUpdateInfo =
        document.getElementById("nextUpdateInfo");

    if (nextUpdateInfo) {
        new MutationObserver(() => {
            if (
                !isAutoUpdateEnabled &&
                nextUpdateInfo.textContent !== "更新停止中"
            ) {
                renderAutoUpdateStatus();
            }
        }).observe(
            nextUpdateInfo,
            {
                childList: true,
                characterData: true,
                subtree: true
            }
        );
    }

    renderAutoUpdateStatus();
}

function initializeRealDriveTestToggle() {

    const button =
        document.getElementById("realDriveTestToggle");

    const state =
        document.getElementById("realDriveTestToggleState");

    if (!button || !state) {
        return;
    }

    isRealDriveTestMode = false;
    renderRealDriveTestStatus();

    button.addEventListener("click", () => {
        isRealDriveTestMode = !isRealDriveTestMode;
        renderRealDriveTestStatus();

        console.log(
            "高データ更新",
            isRealDriveTestMode ? "ON" : "OFF",
            "候補IC数",
            getActiveIcCandidateCount()
        );
    });
}

function renderRealDriveTestStatus() {

    const toggleButton =
        document.getElementById("realDriveTestToggle");

    const toggleState =
        document.getElementById("realDriveTestToggleState");

    if (toggleState) {
        toggleState.textContent =
            isRealDriveTestMode ? "ON" : "OFF";
    }

    if (toggleButton) {
        toggleButton.setAttribute(
            "aria-pressed",
            String(isRealDriveTestMode)
        );

        toggleButton.classList.toggle(
            "is-paused",
            !isRealDriveTestMode
        );
    }

    updateAutoUpdateCountdownDisplay();
}

async function requestWakeLock() {

    const unsupportedMessage =
        "この環境では画面ON維持に対応していません";

    if (!navigator.wakeLock) {

        console.warn(unsupportedMessage);

        const multiExitIcResult =
            document.getElementById("multiExitIcResult");

        if (multiExitIcResult) {
            multiExitIcResult.textContent =
                unsupportedMessage;
        }

        return false;
    }

    try {

        wakeLock =
            await navigator.wakeLock.request("screen");

        wakeLock.addEventListener("release", () => {
            wakeLock = null;
            renderWakeLockStatus();
        });

        renderWakeLockStatus();

        return true;

    } catch (error) {

        console.warn(
            "画面ON維持の取得に失敗しました",
            error
        );

        const multiExitIcResult =
            document.getElementById("multiExitIcResult");

        if (multiExitIcResult) {
            multiExitIcResult.textContent =
                "画面ON維持の取得に失敗しました";
        }

        return false;
    }
}

async function releaseWakeLock() {

    if (!wakeLock) {
        renderWakeLockStatus();
        return;
    }

    try {
        await wakeLock.release();
    } catch (error) {
        console.warn(
            "画面ON維持の解除に失敗しました",
            error
        );
    } finally {
        wakeLock = null;
        renderWakeLockStatus();
    }
}

function initializeWakeLockToggle() {

    const toggleButton =
        document.getElementById("wakeLockToggle");

    if (!toggleButton) {
        return;
    }

    toggleButton.addEventListener("click", async () => {

        isWakeLockEnabled =
            !isWakeLockEnabled;

        renderWakeLockStatus();

        if (isWakeLockEnabled) {

            const requested =
                await requestWakeLock();

            if (!requested) {
                isWakeLockEnabled = false;
                renderWakeLockStatus();
            }

            return;
        }

        await releaseWakeLock();
    });

    document.addEventListener("visibilitychange", async () => {

        if (
            document.visibilityState === "visible" &&
            isWakeLockEnabled &&
            !wakeLock
        ) {
            await requestWakeLock();
        }
    });

    renderWakeLockStatus();
}

function renderWakeLockStatus() {

    const toggleButton =
        document.getElementById("wakeLockToggle");

    const toggleState =
        document.getElementById("wakeLockToggleState");

    if (toggleState) {
        toggleState.textContent =
            isWakeLockEnabled && wakeLock ? "ON" : "OFF";
    }

    if (toggleButton) {
        toggleButton.setAttribute(
            "aria-pressed",
            String(isWakeLockEnabled && wakeLock)
        );

        toggleButton.classList.toggle(
            "is-paused",
            !(isWakeLockEnabled && wakeLock)
        );
    }
}

function initializeMultiIcModeSwitch() {

    const modeInputs =
        document.querySelectorAll(
            "input[name='multiIcMode']"
        );

    const description =
        document.getElementById(
            "multiIcModeDescription"
        );

    modeInputs.forEach(input => {

        input.addEventListener(
            "change",
            () => {

                if (!input.checked) {
                    return;
                }

                currentMultiIcMode =
                    input.value;

                if (!description) {
                    return;
                }

                description.textContent =
                    currentMultiIcMode === "entrance"
                        ? "おすすめ入口を探す準備中"
                        : "おすすめ出口を探す準備中";

                console.log(
                    "複数IC比較モード",
                    currentMultiIcMode
                );

                refreshAutoExitIcComparisonAfterModeChange();
            }
        );
    });
}

function hasAutoExitIcComparisonResults() {

    return (
        lastMultiIcV2Results.length > 0 ||
        lastExitIcV2Results.length > 0
    );
}

async function refreshAutoExitIcComparisonAfterModeChange() {

    if (!hasAutoExitIcComparisonResults()) {
        console.log(
            "候補IC自動比較は未実行のため、モード切替時の再比較をスキップ"
        );
        return;
    }

    await searchAutoExitIcComparison(false);
}

function renderAutoUpdateStatus() {

    const toggleButton =
        document.getElementById("autoUpdateToggle");

    const toggleState =
        document.getElementById("autoUpdateToggleState");

    if (toggleState) {
        toggleState.textContent =
            isAutoUpdateEnabled ? "ON" : "OFF";
    }

    if (toggleButton) {
        toggleButton.setAttribute(
            "aria-pressed",
            String(isAutoUpdateEnabled)
        );

        toggleButton.classList.toggle(
            "is-paused",
            !isAutoUpdateEnabled
        );
    }

    if (!isAutoUpdateEnabled) {
        setDataUpdateStatus(
            "更新停止中",
            "data-update-paused"
        );
    }
}

function setDataUpdateStatus(text, statusClass) {

    const nextUpdateInfo =
        document.getElementById("nextUpdateInfo");

    if (!nextUpdateInfo) {
        return;
    }

    if (
        !isAutoUpdateEnabled &&
        text !== "更新停止中"
    ) {
        text = "更新停止中";
        statusClass = "data-update-paused";
    }

    nextUpdateInfo.textContent = text;

    nextUpdateInfo.classList.remove(
        "data-update-normal",
        "data-update-working",
        "data-update-error",
        "data-update-paused"
    );

    nextUpdateInfo.classList.add(statusClass);
}


function updateRouteModeJudge(
    highwayMinutes,
    localMinutes
) {
    const routeModeJudge =
        document.getElementById("routeModeJudge");

    if (!routeModeJudge) {
        return;
    }

    routeModeJudge.classList.remove(
        "route-mode-highway",
        "route-mode-local",
        "route-mode-neutral",
        "route-mode-unknown"
    );

    const acceptableDelay =
        Number(
            document.getElementById("acceptableDelay")?.value
        ) || 30;

    const difference =
        localMinutes - highwayMinutes;

    if (difference >= acceptableDelay * 2) {
        routeModeJudge.textContent = "高速前提";
        routeModeJudge.classList.add("route-mode-highway");
    }
    else if (difference < acceptableDelay) {
        routeModeJudge.textContent = "下道前提";
        routeModeJudge.classList.add("route-mode-local");
    }
    else {
        routeModeJudge.textContent = "中立";
        routeModeJudge.classList.add("route-mode-neutral");
    }
}

function getLatLngFromAddress(address) {

    const cacheKey =
        String(address || "").trim();

    if (geocodeLatLngCache.has(cacheKey)) {
        console.log(
            "Geocoding cache hit",
            cacheKey
        );

        return geocodeLatLngCache.get(cacheKey);
    }

    return new Promise((resolve) => {

        const geocoder =
            new google.maps.Geocoder();

        geocoder.geocode(
            { address: address },
            (results, status) => {

                if (
                    status === "OK" &&
                    results &&
                    results.length > 0
                ) {
                    const location =
                        results[0].geometry.location;

                    const result = {
                        lat: location.lat(),
                        lng: location.lng()
                    };

                    geocodeLatLngCache.set(
                        cacheKey,
                        result
                    );

                    resolve(result);

                    return;
                }

                resolve(null);
            }
        );
    });
}

function calculateBearing(lat1, lng1, lat2, lng2) {

    const toRad = deg => deg * Math.PI / 180;
    const toDeg = rad => rad * 180 / Math.PI;

    const y =
        Math.sin(toRad(lng2 - lng1)) *
        Math.cos(toRad(lat2));

    const x =
        Math.cos(toRad(lat1)) *
        Math.sin(toRad(lat2)) -
        Math.sin(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.cos(toRad(lng2 - lng1));

    return (
        toDeg(Math.atan2(y, x)) +
        360
    ) % 360;
}

async function suggestIcAreaByDirection(destination) {

    if (
        currentLatitude === null ||
        currentLongitude === null
    ) {
        return null;
    }

    const destinationLatLng =
        await getLatLngFromAddress(destination);

    if (!destinationLatLng) {
        return null;
    }

    const bearing =
        calculateBearing(
            currentLatitude,
            currentLongitude,
            destinationLatLng.lat,
            destinationLatLng.lng
        );

    console.log(
        "目的地方角",
        Math.round(bearing),
        "度"
    );




    if (bearing >= 20 && bearing < 70) {

        lastIcAreaDecisionType =
            "direction";

        return "joban";
    }

    if (bearing >= 70 && bearing < 120) {

        lastIcAreaDecisionType =
            "direction";

        return "tokan";
    }

    if (bearing >= 120 && bearing < 180) {

        lastIcAreaDecisionType =
            "direction";

        return "tateyama";
    }

    if (bearing >= 180 && bearing < 235) {

        lastIcAreaDecisionType =
            "direction";

        return "tomei";
    }

    if (bearing >= 235 && bearing < 285) {

        lastIcAreaDecisionType =
            "direction";

        return "chuo";
    }

    if (bearing >= 285 && bearing < 335) {

        lastIcAreaDecisionType =
            "direction";

        return "kanetsu";
    }

    return "tohoku";
}

function resetAutoUpdateState() {

    lastSearchLatitude = null;
    lastSearchLongitude = null;
    lastSearchTime = null;
    lastSearchLocationName = "";

    document
        .getElementById("nextUpdateInfo")
        .textContent =
        "比較後に表示";

    document
        .getElementById("autoSearchCondition")
        .textContent =
        "未判定";
}


function updateSearchMode(mode) {

    document
        .getElementById("searchButton")
        ?.classList.remove("active-search");

    document
        .getElementById("gpsSearchButton")
        ?.classList.remove("active-search");

    document
        .getElementById("autoExitIcCompareButton")
        ?.classList.remove("active-search");

    document
        .getElementById(mode)
        ?.classList.add("active-search");

    lastSearchMode = mode;
}


async function getCandidateStartIndexByLocation(origin, icArea) {

    let baseLat = currentLatitude;
    let baseLng = currentLongitude;

    if (origin) {

        const originLatLng =
            await getLatLngFromAddress(origin);

        if (originLatLng) {
            baseLat = originLatLng.lat;
            baseLng = originLatLng.lng;
        }
    }

    return await findNearestIcIndexByPoint(
        icArea,
        baseLat,
        baseLng
    );
}

async function findNearestIcIndexByPoint(
    icArea,
    baseLat,
    baseLng
) {

    const exits =
        IC_MASTER[icArea].exits
            .slice()
            .sort((a, b) =>
                (a.order ?? 999) - (b.order ?? 999)
            );

    let nearestIndex = 0;
    let nearestDistance = Infinity;

    for (let index = 0; index < exits.length; index++) {

        const exit = exits[index];

        if (exit.isSelectable === false) {
            continue;
        }

        let exitLat = exit.lat;
        let exitLng = exit.lng;

        if (
            exitLat === undefined ||
            exitLng === undefined
        ) {

            const exitLatLng =
                await getLatLngFromAddress(exit.googleName);

            if (!exitLatLng) {
                continue;
            }

            exit.lat = exitLatLng.lat;
            exit.lng = exitLatLng.lng;

            exitLat = exit.lat;
            exitLng = exit.lng;
        }

        const distance =
            calculateDistance(
                baseLat,
                baseLng,
                exitLat,
                exitLng
            );

        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
        }
    }

    lastNearestIcName =
        exits[nearestIndex].displayName;

    lastNearestIcDistanceKm =
        Math.round(nearestDistance / 1000);

    lastTollStartIcName =
        exits[nearestIndex].displayName;

    lastTollStartIc =
        exits[nearestIndex];

    lastTollStartIcGoogleName =
        exits[nearestIndex].googleName;

    lastTollStartIcOrder =
        exits[nearestIndex].order;


    return Math.max(0, nearestIndex - 2);
}

function resetMultiExitIcResult() {

    document
        .getElementById("multiExitIcResult")
        .textContent =
        "候補IC自動比較は未実行です";
}

function scrollToDashboardCard() {

    const dashboard =
        document.querySelector(
            ".dashboard-card"
        );

    if (!dashboard) {
        return;
    }

    const top =
        dashboard.getBoundingClientRect().top +
        window.scrollY -
        8;

    window.scrollTo({
        top: Math.max(0, top),
        behavior: "smooth"
    });
}

function formatCountdownSeconds(seconds) {

    const minutes =
        Math.floor(seconds / 60);

    const secs =
        seconds % 60;

    return (
        minutes +
        ":" +
        String(secs).padStart(2, "0")
    );
}

function formatAutoUpdateDistanceText(meters) {

    if (meters <= 0) {
        return "0km";
    }

    const kilometers =
        Math.ceil(meters / 100) / 10;

    if (Number.isInteger(kilometers)) {
        return kilometers + "km";
    }

    return kilometers.toFixed(1) + "km";
}

function formatAutoUpdateTimeText(seconds) {

    const safeSeconds =
        Math.max(
            0,
            Math.round(seconds)
        );

    const safeMinutes =
        Math.floor(safeSeconds / 60);

    const safeRemain =
        safeSeconds % 60;

    return (
        safeMinutes +
        ":" +
        String(safeRemain).padStart(2, "0")
    );
}

function getAutoUpdateCountdownText(
    distanceMeters,
    seconds
) {

    return (
        "\u3042\u3068 " +
        formatAutoUpdateDistanceText(distanceMeters) +
        " / " +
        formatAutoUpdateTimeText(seconds)
    );
}

function updateAutoUpdateCountdownDisplay() {

    if (!isAutoUpdateEnabled) {
        renderAutoUpdateStatus();
        return;
    }

    const distanceThreshold =
        getAutoUpdateDistanceThreshold();

    const timeThreshold =
        getAutoUpdateTimeThreshold();

    if (
        lastSearchLatitude === null ||
        lastSearchLongitude === null ||
        lastSearchTime === null ||
        currentLatitude === null ||
        currentLongitude === null
    ) {
        setDataUpdateStatus(
            getAutoUpdateCountdownText(
                distanceThreshold,
                timeThreshold
            ),
            "data-update-normal"
        );
        return;
    }

    const distance =
        calculateDistance(
            lastSearchLatitude,
            lastSearchLongitude,
            currentLatitude,
            currentLongitude
        );

    const elapsedSeconds =
        (
            Date.now()
            -
            lastSearchTime
        ) / 1000;

    const remainingDistance =
        Math.max(
            0,
            distanceThreshold - Math.round(distance)
        );

    const remainingSeconds =
        Math.max(
            0,
            timeThreshold - Math.round(elapsedSeconds)
        );

    setDataUpdateStatus(
        getAutoUpdateCountdownText(
            remainingDistance,
            remainingSeconds
        ),
        "data-update-normal"
    );
}

function getIcOrderByGoogleName(googleName) {

    for (const areaKey in IC_MASTER) {

        const found =
            IC_MASTER[areaKey].exits.find(exit =>
                exit.googleName === googleName
            );

        if (found) {
            return found.order ?? null;
        }
    }

    return null;
}

async function findNearestIcInfoByAddress(address, icArea) {

    const latLng =
        await getLatLngFromAddress(address);

    if (!latLng) {
        return null;
    }

    return await findNearestIcInfoByPoint(
        icArea,
        latLng.lat,
        latLng.lng
    );
}

async function findNearestIcInfoByPoint(
    icArea,
    baseLat,
    baseLng
) {

    const exits =
        IC_MASTER[icArea].exits
            .slice()
            .sort((a, b) =>
                (a.order ?? 999) - (b.order ?? 999)
            );

    let nearest = null;
    let nearestDistance = Infinity;

    for (const exit of exits) {

        if (exit.isSelectable === false) {
            continue;
        }

        // 方向判定ミラー（isMirror:true）は本体とほぼ同一座標のため
        // 最近傍判定が不安定になる。この関数は役割別（entrance/exit）の
        // 判定を行わない汎用検索のため、ミラーは除外し常に本体を対象とする。
        if (exit.isMirror === true) {
            continue;
        }

        let exitLat = exit.lat;
        let exitLng = exit.lng;

        if (
            exitLat === undefined ||
            exitLng === undefined
        ) {

            const exitLatLng =
                await getLatLngFromAddress(exit.googleName);

            if (!exitLatLng) {
                continue;
            }

            exit.lat = exitLatLng.lat;
            exit.lng = exitLatLng.lng;

            exitLat = exit.lat;
            exitLng = exit.lng;
        }

        const distance =
            calculateDistance(
                baseLat,
                baseLng,
                exitLat,
                exitLng
            );

        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = exit;
        }
    }

    if (!nearest) {
        return null;
    }

    return {
        displayName: nearest.displayName,
        googleName: nearest.googleName,
        order: nearest.order ?? null,
        roadType: nearest.roadType,
        distanceKm: Math.round(nearestDistance / 1000)
    };
}

function getIcAreaLabelByExitIc(exitIcGoogleName) {

    for (const areaKey in IC_MASTER) {

        const area = IC_MASTER[areaKey];

        const found =
            area.exits.find(exit =>
                exit.googleName === exitIcGoogleName
            );

        if (found) {
            return area.label.replace("方面", "");
        }
    }

    return "有料道路";
}

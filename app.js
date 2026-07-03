// 標準判定ロジック
// 出発地・目的地最寄りICの距離合計で方面を決定する。
const USE_DISTANCE_ONLY_IC_AREA = true;

// キーワード判定は補助扱い。距離だけ方式を優先するため標準では使わない。
const ENABLE_KEYWORD_AREA_HINT = false;

// 開発中のGoogle API使用量を抑えるための設定
const DEV_API_SAVING_MODE = true;

// Polyline解析とRoutesレスポンスの詳細ログを表示する。
const DEBUG_ROUTE_VERBOSE = false;

// 開発中は候補IC数を少なめにする
const DEV_IC_CANDIDATE_COUNT = 3;

// 通常運用時の候補IC数
const PROD_IC_CANDIDATE_COUNT = 5;

// 入口比較でおすすめ対象にする最低短縮時間
const MIN_ENTRANCE_RECOMMEND_SAVED_MINUTES = 5;

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

function createProbablyNoTollRouteNoteHtml(
    isProbablyNoTollRoute
) {

    return isProbablyNoTollRoute
        ? "<div class=\"probably-no-toll-note\">※有料未使用かも</div>"
        : "";
}

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

    note.textContent =
        isProbablyNoTollRoute
            ? "※有料未使用かも"
            : "";

    note.hidden = !isProbablyNoTollRoute;

    spacer.textContent =
        isProbablyNoTollRoute
            ? "※有料未使用かも"
            : "";

    spacer.hidden = !isProbablyNoTollRoute;
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

function getShutoTollEstimateForIcPair(startIc, endIc) {
    if (
        isShutoIc(startIc) ||
        isShutoIc(endIc)
    ) {
        return SHUTO_TOLL_ESTIMATE_YEN;
    }

    return 0;
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
    return String(ic?.displayName || "")
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

function buildAssumedRouteHtml(polylineAnalysis) {
    if (!polylineAnalysis) {
        return "";
    }

    const shutoEntranceIc =
        polylineAnalysis.shutoEntranceIc;

    const entranceIc =
        polylineAnalysis.nexcoEntranceIc ||
        polylineAnalysis.entranceIc;

    const exitIc =
        polylineAnalysis.nexcoExitIc ||
        polylineAnalysis.exitIc;

    const routeRoads = [
        ...new Set(
            (polylineAnalysis.roadSequence || [])
                .map(shortenHighwayRoadName)
                .filter(roadName =>
                    roadName && roadName !== "首都高"
                )
        )
    ];

    const routeParts = [];

    if (shutoEntranceIc) {
        const shutoEntranceIcName =
            formatAssumedRouteIcName(shutoEntranceIc);

        routeParts.push(
            {
                value: "首都高 " + shutoEntranceIcName,
                html:
                    createAssumedRouteRoadHtml("首都高") +
                    " " +
                    escapeHtml(shutoEntranceIcName)
            }
        );
    }

    routeParts.push({
        value: formatAssumedRouteIcName(entranceIc),
        html: escapeHtml(formatAssumedRouteIcName(entranceIc))
    });

    routeParts.push(
        ...routeRoads.map(roadName => ({
            value: roadName,
            html: createAssumedRouteRoadHtml(roadName)
        }))
    );

    routeParts.push({
        value: formatAssumedRouteIcName(exitIc),
        html: escapeHtml(formatAssumedRouteIcName(exitIc))
    });

    return routeParts
        .filter((part, index, parts) =>
            part.value &&
            part.value !== parts[index - 1]?.value
        )
        .map(part => part.html)
        .join(" → ");
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
const SHUTO_IC_MASTER = [
    {
        id: "shuto-6-tsutsumidori",
        displayName: "堤通",
        googleName: "首都高速6号向島線 堤通出入口",
        aliases: ["堤通", "堤通入口", "堤通出口"],
        roadType: "首都高",
        routeCode: "6",
        routeName: "首都高速6号向島線",
        lat: 35.731,
        lng: 139.817,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["joban", "chuo", "tomei", "aqualine", "keiyo", "tokan"],
        sourceGoogleNames: ["首都高速6号向島線 堤通出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-c2-kahira",
        displayName: "加平",
        googleName: "首都高速中央環状線 加平出入口",
        aliases: ["加平", "加平入口", "加平出口"],
        roadType: "首都高",
        routeCode: "C2",
        routeName: "首都高速中央環状線",
        lat: 35.777,
        lng: 139.820,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["joban"],
        sourceGoogleNames: ["首都高速中央環状線 加平出入口"],
        note: "routeNameとrouteCodeは既存googleNameから正規化。現時点では未参照。"
    },
    {
        id: "shuto-6-yashio-minami",
        displayName: "八潮南",
        googleName: "首都高速6号三郷線 八潮南出入口",
        aliases: ["八潮南", "八潮南入口", "八潮南出口"],
        roadType: "首都高",
        routeCode: "6",
        routeName: "首都高速6号三郷線",
        lat: 35.805,
        lng: 139.842,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["joban"],
        sourceGoogleNames: ["首都高速6号三郷線 八潮南出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-1-ueno",
        displayName: "上野",
        googleName: "首都高速1号上野線 上野出入口",
        aliases: ["上野", "上野入口", "上野出口"],
        roadType: "首都高",
        routeCode: "1",
        routeName: "首都高速1号上野線",
        lat: 35.712,
        lng: 139.779,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["chuo", "tomei", "aqualine", "keiyo", "tokan"],
        sourceGoogleNames: ["首都高速1号上野線 上野出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-4-takaido",
        displayName: "高井戸",
        googleName: "首都高速4号新宿線 高井戸出入口",
        aliases: ["高井戸", "高井戸入口", "高井戸出口"],
        roadType: "首都高",
        routeCode: "4",
        routeName: "首都高速4号新宿線",
        lat: 35.684,
        lng: 139.615,
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
        lat: 35.677,
        lng: 139.718,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["chuo", "tomei"],
        sourceGoogleNames: ["首都高速4号新宿線 外苑出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-c1-daikancho",
        displayName: "代官町",
        googleName: "首都高速都心環状線 代官町出入口",
        aliases: ["代官町", "代官町入口", "代官町出口"],
        roadType: "首都高",
        routeCode: "C1",
        routeName: "首都高速都心環状線",
        lat: 35.688,
        lng: 139.754,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["chuo", "tomei"],
        sourceGoogleNames: ["首都高速都心環状線 代官町出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-c1-hitotsubashi",
        displayName: "一ツ橋",
        googleName: "首都高速都心環状線 一ツ橋出入口",
        aliases: ["一ツ橋", "一ツ橋入口", "一ツ橋出口"],
        roadType: "首都高",
        routeCode: "C1",
        routeName: "首都高速都心環状線",
        lat: 35.692,
        lng: 139.758,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["chuo", "tomei"],
        sourceGoogleNames: ["首都高速都心環状線 一ツ橋出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-3-yoga",
        displayName: "用賀",
        googleName: "首都高速3号渋谷線 用賀出入口",
        aliases: ["用賀", "用賀入口", "用賀出口"],
        roadType: "首都高",
        routeCode: "3",
        routeName: "首都高速3号渋谷線",
        lat: 35.626,
        lng: 139.633,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["tomei"],
        sourceGoogleNames: ["首都高速3号渋谷線 用賀出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-c1-kasumigaseki",
        displayName: "霞が関",
        googleName: "首都高速都心環状線 霞が関出入口",
        aliases: ["霞が関", "霞が関入口", "霞が関出口"],
        roadType: "首都高",
        routeCode: "C1",
        routeName: "首都高速都心環状線",
        lat: 35.671,
        lng: 139.751,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["tomei"],
        sourceGoogleNames: ["首都高速都心環状線 霞が関出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-2-togoshi",
        displayName: "戸越",
        googleName: "首都高速2号目黒線 戸越出入口",
        aliases: ["戸越", "戸越入口", "戸越出口"],
        roadType: "首都高",
        routeCode: "2",
        routeName: "首都高速2号目黒線",
        lat: 35.615,
        lng: 139.716,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["tomei"],
        sourceGoogleNames: ["首都高速2号目黒線 戸越出入口"],
        note: "既存IC_MASTERから正規化登録。現時点では未参照。"
    },
    {
        id: "shuto-b-kasai",
        displayName: "葛西",
        googleName: "首都高速湾岸線 葛西出入口",
        aliases: ["葛西", "葛西IC", "葛西入口", "葛西出口"],
        roadType: "首都高",
        routeCode: "B",
        routeName: "首都高速湾岸線",
        lat: 35.652,
        lng: 139.870,
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
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["aqualine", "keiyo", "tokan"],
        sourceGoogleNames: ["首都高速湾岸線 湾岸市川出入口"],
        note: "tokan内のexperimental登録とroadType未設定登録を1件に正規化。現時点では未参照。"
    },
    {
        id: "shuto-b-shinkiba",
        displayName: "新木場",
        googleName: "首都高速湾岸線 新木場出入口",
        aliases: ["新木場", "新木場入口", "新木場出口"],
        roadType: "首都高",
        routeCode: "B",
        routeName: "首都高速湾岸線",
        lat: 35.645,
        lng: 139.827,
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
        lat: 35.634,
        lng: 139.795,
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
        lat: 35.589,
        lng: 139.756,
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
        lat: 35.553,
        lng: 139.787,
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
        lat: 35.521,
        lng: 139.788,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["aqualine", "tateyama"],
        sourceGoogleNames: ["首都高速湾岸線 浮島インターチェンジ"],
        note: "既存2登録ではroadType未設定。新マスター内だけ首都高として正規化。現時点では未参照。"
    },
    {
        id: "shuto-k1-daishi",
        displayName: "大師",
        googleName: "首都高速神奈川1号横羽線 大師出入口",
        aliases: ["大師", "大師入口", "大師出口"],
        roadType: "首都高",
        routeCode: "K1",
        routeName: "首都高速神奈川1号横羽線",
        lat: 35.535,
        lng: 139.726,
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
        lat: 35.520,
        lng: 139.706,
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
        lat: 35.522,
        lng: 139.718,
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
        lat: 35.495,
        lng: 139.668,
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
        lat: 35.501,
        lng: 139.682,
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
        lat: 35.481,
        lng: 139.660,
        entranceSelectable: false,
        exitSelectable: false,
        sourceAreaKeys: ["shutoKanagawaK1"],
        sourceGoogleNames: ["首都高速神奈川1号横羽線 守屋町出口"],
        note: "既存isSelectable:falseを引き継ぎ、入口・出口候補とも選択不可。現時点では未参照。"
    },
    {
        id: "shuto-k1-koyasu",
        displayName: "子安",
        googleName: "首都高速神奈川1号横羽線 子安出入口",
        aliases: ["子安", "子安入口", "子安出口"],
        roadType: "首都高",
        routeCode: "K1",
        routeName: "首都高速神奈川1号横羽線",
        lat: 35.483,
        lng: 139.646,
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
        lat: 35.476,
        lng: 139.636,
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
        lat: 35.466,
        lng: 139.626,
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
        lat: 35.457,
        lng: 139.632,
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
        lat: 35.444,
        lng: 139.642,
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
        lat: 35.495,
        lng: 139.667,
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
        lat: 35.504,
        lng: 139.646,
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
        lat: 35.513,
        lng: 139.618,
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
        lat: 35.519,
        lng: 139.600,
        entranceSelectable: false,
        exitSelectable: false,
        sourceAreaKeys: ["shutoKanagawaK7"],
        sourceGoogleNames: ["首都高速神奈川7号横浜北線 横浜港北出入口"],
        note: "北西線側とは路線別に分離。既存isSelectable:falseを引き継ぎ選択不可。現時点では未参照。"
    },
    {
        id: "shuto-k7-hokusei-yokohama-kohoku",
        displayName: "横浜港北",
        googleName: "首都高速神奈川7号横浜北西線 横浜港北出入口",
        aliases: ["横浜港北", "横浜港北入口", "横浜港北出口"],
        roadType: "首都高",
        routeCode: "K7北西",
        routeName: "首都高速神奈川7号横浜北西線",
        lat: 35.519,
        lng: 139.600,
        entranceSelectable: false,
        exitSelectable: false,
        sourceAreaKeys: ["shutoKanagawaK7Hokusei"],
        sourceGoogleNames: ["首都高速神奈川7号横浜北西線 横浜港北出入口"],
        note: "横浜北線側とは路線別に分離。既存isSelectable:falseを引き継ぎ選択不可。現時点では未参照。"
    },
    {
        id: "shuto-k7-hokusei-yokohama-aoba",
        displayName: "横浜青葉",
        googleName: "首都高速神奈川7号横浜北西線 横浜青葉出入口",
        aliases: ["横浜青葉", "横浜青葉入口", "横浜青葉出口"],
        roadType: "首都高",
        routeCode: "K7北西",
        routeName: "首都高速神奈川7号横浜北西線",
        lat: 35.542,
        lng: 139.537,
        entranceSelectable: true,
        exitSelectable: true,
        sourceAreaKeys: ["shutoKanagawaK7Hokusei"],
        sourceGoogleNames: ["首都高速神奈川7号横浜北西線 横浜青葉出入口"],
        note: "既存データでは北西線・東名接続地点。現時点では未参照。"
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
                lat: 35.731,
                lng: 139.817,
                experimental: true,
                roadType: "首都高"
            },
            {
                order: -2,
                displayName: "加平（首都高）",
                googleName: "首都高速中央環状線 加平出入口",
                lat: 35.777,
                lng: 139.820,
                experimental: true,
                roadType: "首都高"
            },
            {
                order: -1,
                displayName: "八潮南（首都高）",
                googleName: "首都高速6号三郷線 八潮南出入口",
                lat: 35.805,
                lng: 139.842,
                experimental: true,
                roadType: "首都高"
            },

            {
                order: 1,
                displayName: "三郷IC",
                googleName: "常磐自動車道 三郷インターチェンジ",
                lat: 35.842,
                lng: 139.872
            },
            {
                order: 1.5,
                displayName: "三郷料金所SIC",
                googleName: "常磐自動車道 三郷料金所スマートインターチェンジ",
                lat: 35.865,
                lng: 139.883
            },
            {
                order: 2,
                displayName: "流山IC",
                googleName: "常磐自動車道 流山インターチェンジ",
                lat: 35.889,
                lng: 139.911
            },
            {
                order: 3,
                displayName: "柏IC",
                googleName: "常磐自動車道 柏インターチェンジ",
                lat: 35.899,
                lng: 139.953
            },
            {
                order: 4,
                displayName: "谷和原IC",
                googleName: "常磐自動車道 谷和原インターチェンジ",
                lat: 35.984,
                lng: 140.000
            },
            {
                order: 5,
                displayName: "守谷SA",
                googleName: "常磐自動車道 守谷サービスエリア",
                lat: 35.941,
                lng: 139.993
            },
            {
                order: 6,
                displayName: "谷田部IC",
                googleName: "常磐自動車道 谷田部インターチェンジ",
                lat: 36.003,
                lng: 140.076
            },
            {
                order: 7,
                displayName: "桜土浦IC",
                googleName: "常磐自動車道 桜土浦インターチェンジ",
                lat: 36.047,
                lng: 140.141
            },
            {
                order: 8,
                displayName: "土浦北IC",
                googleName: "常磐自動車道 土浦北インターチェンジ",
                lat: 36.107,
                lng: 140.197
            },
            {
                order: 9,
                displayName: "千代田石岡IC",
                googleName: "常磐自動車道 千代田石岡インターチェンジ",
                lat: 36.171,
                lng: 140.259
            },
            {
                order: 9.5,
                displayName: "石岡小美玉SIC",
                googleName: "常磐自動車道 石岡小美玉スマートインターチェンジ",
                lat: 36.221,
                lng: 140.281
            },
            {
                order: 10,
                displayName: "岩間IC",
                googleName: "常磐自動車道 岩間インターチェンジ",
                lat: 36.300,
                lng: 140.306
            },

            {
                order: 10.5,
                displayName: "友部SA SIC",
                googleName: "常磐自動車道 友部SAスマートインターチェンジ",
                lat: 36.309,
                lng: 140.341
            },

            {
                order: 11,
                displayName: "友部SA",
                googleName: "常磐自動車道 友部サービスエリア",
                lat: 36.317,
                lng: 140.346
            },

            {
                order: 12,
                displayName: "水戸IC",
                googleName: "常磐自動車道 水戸インターチェンジ",
                lat: 36.381,
                lng: 140.366
            },
            {
                order: 12.5,
                displayName: "水戸北SIC",
                googleName: "常磐自動車道 水戸北スマートインターチェンジ",
                lat: 36.417,
                lng: 140.425
            },
            {
                order: 13,
                displayName: "那珂IC",
                googleName: "常磐自動車道 那珂インターチェンジ",
                lat: 36.486,
                lng: 140.472
            },
            {
                order: 13.5,
                displayName: "東海SIC",
                googleName: "常磐自動車道 東海スマートインターチェンジ",
                lat: 36.485,
                lng: 140.551
            },
            {
                order: 14,
                displayName: "日立南太田IC",
                googleName: "常磐自動車道 日立南太田インターチェンジ",
                lat: 36.565,
                lng: 140.543
            },
            {
                order: 15,
                displayName: "日立中央IC",
                googleName: "常磐自動車道 日立中央インターチェンジ",
                lat: 36.607,
                lng: 140.640
            },
            {
                order: 16,
                displayName: "高萩IC",
                googleName: "常磐自動車道 高萩インターチェンジ",
                lat: 36.713,
                lng: 140.709
            },
            {
                order: 17,
                displayName: "北茨城IC",
                googleName: "常磐自動車道 北茨城インターチェンジ",
                lat: 36.819,
                lng: 140.744
            },
            {
                order: 18,
                displayName: "いわき勿来IC",
                googleName: "常磐自動車道 いわき勿来インターチェンジ",
                lat: 36.906,
                lng: 140.786
            },
            {
                order: 19,
                displayName: "いわき湯本IC",
                googleName: "常磐自動車道 いわき湯本インターチェンジ",
                lat: 37.008,
                lng: 140.828
            },
            {
                order: 20,
                displayName: "いわき中央IC",
                googleName: "常磐自動車道 いわき中央インターチェンジ",
                lat: 37.067,
                lng: 140.849
            }



        ]
    },
    tohoku: {
        label: "東北道方面",
        exits: [
            { order: 1, displayName: "浦和IC", googleName: "東北自動車道 浦和インターチェンジ" },
            { order: 2, displayName: "岩槻IC", googleName: "東北自動車道 岩槻インターチェンジ" },
            { order: 3, displayName: "蓮田SIC", googleName: "東北自動車道 蓮田スマートインターチェンジ" },
            { order: 4, displayName: "久喜IC", googleName: "東北自動車道 久喜インターチェンジ" },
            { order: 5, displayName: "加須IC", googleName: "東北自動車道 加須インターチェンジ" },
            { order: 6, displayName: "羽生IC", googleName: "東北自動車道 羽生インターチェンジ" },
            { order: 7, displayName: "館林IC", googleName: "東北自動車道 館林インターチェンジ" },
            { order: 8, displayName: "佐野藤岡IC", googleName: "東北自動車道 佐野藤岡インターチェンジ" },
            { order: 9, displayName: "栃木IC", googleName: "東北自動車道 栃木インターチェンジ" },
            { order: 10, displayName: "鹿沼IC", googleName: "東北自動車道 鹿沼インターチェンジ" },
            { order: 11, displayName: "宇都宮IC", googleName: "東北自動車道 宇都宮インターチェンジ" }
        ]
    },
    kanetsu: {
        label: "関越道方面",
        exits: [
            { order: 1, displayName: "練馬IC", googleName: "関越自動車道 練馬インターチェンジ", lat: 35.753, lng: 139.605 },
            { order: 2, displayName: "大泉IC", googleName: "関越自動車道 大泉インターチェンジ", lat: 35.771, lng: 139.587 },
            { order: 3, displayName: "所沢IC", googleName: "関越自動車道 所沢インターチェンジ", lat: 35.801, lng: 139.498 },
            { order: 4, displayName: "三芳SIC", googleName: "関越自動車道 三芳スマートインターチェンジ", lat: 35.843, lng: 139.518 },
            { order: 5, displayName: "川越IC", googleName: "関越自動車道 川越インターチェンジ", lat: 35.907, lng: 139.483 },
            { order: 6, displayName: "鶴ヶ島IC", googleName: "関越自動車道 鶴ヶ島インターチェンジ", lat: 35.944, lng: 139.394 },
            { order: 7, displayName: "坂戸西SIC", googleName: "関越自動車道 坂戸西スマートインターチェンジ", lat: 35.971, lng: 139.356 },
            { order: 8, displayName: "東松山IC", googleName: "関越自動車道 東松山インターチェンジ", lat: 36.036, lng: 139.377 },
            { order: 9, displayName: "嵐山小川IC", googleName: "関越自動車道 嵐山小川インターチェンジ", lat: 36.060, lng: 139.300 },
            { order: 10, displayName: "花園IC", googleName: "関越自動車道 花園インターチェンジ", lat: 36.115, lng: 139.214 },
            { order: 10.5, displayName: "寄居SIC", googleName: "関越自動車道 寄居スマートインターチェンジ", lat: 36.173, lng: 139.194 },
            { order: 11, displayName: "本庄児玉IC", googleName: "関越自動車道 本庄児玉インターチェンジ", lat: 36.223, lng: 139.152 },
            { order: 11.5, displayName: "上里SIC", googleName: "関越自動車道 上里スマートインターチェンジ", lat: 36.256, lng: 139.119 },
            { order: 12, displayName: "高崎玉村SIC", googleName: "関越自動車道 高崎玉村スマートインターチェンジ", lat: 36.284, lng: 139.101 },
            { order: 13, displayName: "高崎IC", googleName: "関越自動車道 高崎インターチェンジ", lat: 36.308, lng: 139.063, connection: true, connectedRoads: ["kanetsu", "joshinetsu"] },
            { order: 14, displayName: "前橋IC", googleName: "関越自動車道 前橋インターチェンジ", lat: 36.384, lng: 139.055 },
            { order: 15, displayName: "駒寄SIC", googleName: "関越自動車道 駒寄スマートインターチェンジ", lat: 36.441, lng: 139.010 },
            { order: 16, displayName: "渋川伊香保IC", googleName: "関越自動車道 渋川伊香保インターチェンジ", lat: 36.493, lng: 139.007 },
            { order: 17, displayName: "赤城IC", googleName: "関越自動車道 赤城インターチェンジ", lat: 36.558, lng: 139.069 },
            { order: 18, displayName: "昭和IC", googleName: "関越自動車道 昭和インターチェンジ", lat: 36.634, lng: 139.101 },
            { order: 19, displayName: "沼田IC", googleName: "関越自動車道 沼田インターチェンジ", lat: 36.663, lng: 139.036 },
            { order: 20, displayName: "月夜野IC", googleName: "関越自動車道 月夜野インターチェンジ", lat: 36.748, lng: 138.988 },
            { order: 21, displayName: "水上IC", googleName: "関越自動車道 水上インターチェンジ", lat: 36.801, lng: 138.964 },
            { order: 22, displayName: "藤岡IC", googleName: "上信越自動車道 藤岡インターチェンジ", lat: 36.269, lng: 139.074, connection: true, connectedRoads: ["kanetsu", "joshinetsu"] }
        ]
    },

    joshinetsu: {
        label: "上信越道方面",
        exits: [
            { order: 0, displayName: "高崎IC", googleName: "関越自動車道 高崎インターチェンジ", lat: 36.308, lng: 139.063, connection: true, connectedRoads: ["kanetsu", "joshinetsu"] },
            { order: 1, displayName: "藤岡IC", googleName: "上信越自動車道 藤岡インターチェンジ", lat: 36.269, lng: 139.074, connection: true, connectedRoads: ["kanetsu", "joshinetsu"] },
            { order: 2, displayName: "吉井IC", googleName: "上信越自動車道 吉井インターチェンジ", lat: 36.250, lng: 138.986 },
            { order: 2.5, displayName: "甘楽SIC", googleName: "上信越自動車道 甘楽スマートインターチェンジ", lat: 36.242, lng: 138.946 },
            { order: 3, displayName: "富岡IC", googleName: "上信越自動車道 富岡インターチェンジ", lat: 36.250, lng: 138.891 },
            { order: 4, displayName: "下仁田IC", googleName: "上信越自動車道 下仁田インターチェンジ", lat: 36.210, lng: 138.774 },
            { order: 5, displayName: "松井田妙義IC", googleName: "上信越自動車道 松井田妙義インターチェンジ", lat: 36.309, lng: 138.733 },
            { order: 6, displayName: "碓氷軽井沢IC", googleName: "上信越自動車道 碓氷軽井沢インターチェンジ", lat: 36.338, lng: 138.640 },
            { order: 7, displayName: "佐久IC", googleName: "上信越自動車道 佐久インターチェンジ", lat: 36.269, lng: 138.476 }
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
                branchOrder: 1
            },
            {
                order: 2,
                displayName: "圏央厚木IC",
                googleName: "首都圏中央連絡自動車道 圏央厚木インターチェンジ",
                lat: 35.480,
                lng: 139.372,
                routeBranch: "west",
                branchOrder: 2
            },
            {
                order: 3,
                displayName: "厚木PA SIC",
                googleName: "首都圏中央連絡自動車道 厚木PAスマートインターチェンジ",
                lat: 35.490,
                lng: 139.369,
                routeBranch: "west",
                branchOrder: 3
            },
            {
                order: 4,
                displayName: "相模原愛川IC",
                googleName: "首都圏中央連絡自動車道 相模原愛川インターチェンジ",
                lat: 35.527,
                lng: 139.359,
                routeBranch: "west",
                branchOrder: 4
            },
            {
                order: 5,
                displayName: "相模原IC",
                googleName: "首都圏中央連絡自動車道 相模原インターチェンジ",
                lat: 35.582,
                lng: 139.293,
                routeBranch: "west",
                branchOrder: 5
            },
            {
                order: 6,
                displayName: "高尾山IC",
                googleName: "首都圏中央連絡自動車道 高尾山インターチェンジ",
                lat: 35.623,
                lng: 139.263,
                routeBranch: "west",
                branchOrder: 6
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
                branchOrder: 7
            },
            {
                order: 8,
                displayName: "あきる野IC",
                googleName: "首都圏中央連絡自動車道 あきる野インターチェンジ",
                lat: 35.718,
                lng: 139.284,
                routeBranch: "northwest",
                branchOrder: 8
            },
            {
                order: 9,
                displayName: "日の出IC",
                googleName: "首都圏中央連絡自動車道 日の出インターチェンジ",
                lat: 35.736,
                lng: 139.282,
                routeBranch: "northwest",
                branchOrder: 9
            },
            {
                order: 10,
                displayName: "青梅IC",
                googleName: "首都圏中央連絡自動車道 青梅インターチェンジ",
                lat: 35.797,
                lng: 139.323,
                routeBranch: "northwest",
                branchOrder: 10
            },
            {
                order: 11,
                displayName: "入間IC",
                googleName: "首都圏中央連絡自動車道 入間インターチェンジ",
                lat: 35.818,
                lng: 139.369,
                routeBranch: "northwest",
                branchOrder: 11
            },
            {
                order: 12,
                displayName: "狭山日高IC",
                googleName: "首都圏中央連絡自動車道 狭山日高インターチェンジ",
                lat: 35.865,
                lng: 139.378,
                routeBranch: "northwest",
                branchOrder: 12
            },
            {
                order: 13,
                displayName: "圏央鶴ヶ島IC",
                googleName: "首都圏中央連絡自動車道 圏央鶴ヶ島インターチェンジ",
                lat: 35.920,
                lng: 139.389,
                routeBranch: "northwest",
                branchOrder: 13
            },
            {
                order: 14,
                displayName: "坂戸IC",
                googleName: "首都圏中央連絡自動車道 坂戸インターチェンジ",
                lat: 35.967,
                lng: 139.444,
                routeBranch: "northwest",
                branchOrder: 14
            },
            {
                order: 15,
                displayName: "川島IC",
                googleName: "首都圏中央連絡自動車道 川島インターチェンジ",
                lat: 35.981,
                lng: 139.466,
                routeBranch: "northwest",
                branchOrder: 15
            },
            {
                order: 16,
                displayName: "桶川北本IC",
                googleName: "首都圏中央連絡自動車道 桶川北本インターチェンジ",
                lat: 36.002,
                lng: 139.520,
                routeBranch: "northwest",
                branchOrder: 16
            },
            {
                order: 17,
                displayName: "桶川加納IC",
                googleName: "首都圏中央連絡自動車道 桶川加納インターチェンジ",
                lat: 36.022,
                lng: 139.565,
                routeBranch: "northwest",
                branchOrder: 17
            },
            {
                order: 18,
                displayName: "白岡菖蒲IC",
                googleName: "首都圏中央連絡自動車道 白岡菖蒲インターチェンジ",
                lat: 36.047,
                lng: 139.623,
                routeBranch: "northwest",
                branchOrder: 18
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
                branchOrder: 19
            },
            {
                order: 20,
                displayName: "幸手IC",
                googleName: "首都圏中央連絡自動車道 幸手インターチェンジ",
                lat: 36.075,
                lng: 139.753,
                routeBranch: "northeast",
                branchOrder: 20
            },
            {
                order: 21,
                displayName: "五霞IC",
                googleName: "首都圏中央連絡自動車道 五霞インターチェンジ",
                lat: 36.101,
                lng: 139.774,
                routeBranch: "northeast",
                branchOrder: 21
            },
            {
                order: 22,
                displayName: "境古河IC",
                googleName: "首都圏中央連絡自動車道 境古河インターチェンジ",
                lat: 36.113,
                lng: 139.833,
                routeBranch: "northeast",
                branchOrder: 22
            },
            {
                order: 23,
                displayName: "坂東IC",
                googleName: "首都圏中央連絡自動車道 坂東インターチェンジ",
                lat: 36.063,
                lng: 139.914,
                routeBranch: "northeast",
                branchOrder: 23
            },
            {
                order: 24,
                displayName: "常総IC",
                googleName: "首都圏中央連絡自動車道 常総インターチェンジ",
                lat: 36.044,
                lng: 140.012,
                routeBranch: "northeast",
                branchOrder: 24
            },
            {
                order: 25,
                displayName: "つくば中央IC",
                googleName: "首都圏中央連絡自動車道 つくば中央インターチェンジ",
                lat: 36.079,
                lng: 140.073,
                routeBranch: "northeast",
                branchOrder: 25
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
                branchOrder: 26
            },
            {
                order: 27,
                displayName: "つくば牛久IC",
                googleName: "首都圏中央連絡自動車道 つくば牛久インターチェンジ",
                lat: 36.037,
                lng: 140.119,
                routeBranch: "northeast",
                branchOrder: 27
            },
            {
                order: 28,
                displayName: "牛久阿見IC",
                googleName: "首都圏中央連絡自動車道 牛久阿見インターチェンジ",
                lat: 35.982,
                lng: 140.170,
                routeBranch: "northeast",
                branchOrder: 28
            },
            {
                order: 29,
                displayName: "阿見東IC",
                googleName: "首都圏中央連絡自動車道 阿見東インターチェンジ",
                lat: 35.969,
                lng: 140.234,
                routeBranch: "northeast",
                branchOrder: 29
            },
            {
                order: 30,
                displayName: "稲敷IC",
                googleName: "首都圏中央連絡自動車道 稲敷インターチェンジ",
                lat: 35.947,
                lng: 140.323,
                routeBranch: "northeast",
                branchOrder: 30
            },
            {
                order: 31,
                displayName: "稲敷東IC",
                googleName: "首都圏中央連絡自動車道 稲敷東インターチェンジ",
                lat: 35.919,
                lng: 140.383,
                routeBranch: "northeast",
                branchOrder: 31
            },
            {
                order: 32,
                displayName: "神崎IC",
                googleName: "首都圏中央連絡自動車道 神崎インターチェンジ",
                lat: 35.894,
                lng: 140.408,
                routeBranch: "northeast",
                branchOrder: 32
            },
            {
                order: 33,
                displayName: "下総IC",
                googleName: "首都圏中央連絡自動車道 下総インターチェンジ",
                lat: 35.873,
                lng: 140.432,
                routeBranch: "northeast",
                branchOrder: 33
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
                branchOrder: 34
            },
            {
                order: 35,
                displayName: "松尾横芝IC",
                googleName: "首都圏中央連絡自動車道 松尾横芝インターチェンジ",
                lat: 35.663,
                lng: 140.438,
                routeBranch: "southeast",
                branchOrder: 35
            },
            {
                order: 36,
                displayName: "山武成東IC",
                googleName: "首都圏中央連絡自動車道 山武成東インターチェンジ",
                lat: 35.618,
                lng: 140.383,
                routeBranch: "southeast",
                branchOrder: 36
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
                branchOrder: 37
            },
            {
                order: 38,
                displayName: "東金IC",
                googleName: "首都圏中央連絡自動車道 東金インターチェンジ",
                lat: 35.571,
                lng: 140.316,
                routeBranch: "southeast",
                branchOrder: 38
            },
            {
                order: 39,
                displayName: "大網白里SIC",
                googleName: "首都圏中央連絡自動車道 大網白里スマートインターチェンジ",
                lat: 35.514,
                lng: 140.295,
                routeBranch: "southeast",
                branchOrder: 39
            },
            {
                order: 40,
                displayName: "茂原北IC",
                googleName: "首都圏中央連絡自動車道 茂原北インターチェンジ",
                lat: 35.487,
                lng: 140.271,
                routeBranch: "southeast",
                branchOrder: 40
            },
            {
                order: 41,
                displayName: "茂原長柄SIC",
                googleName: "首都圏中央連絡自動車道 茂原長柄スマートインターチェンジ",
                lat: 35.448,
                lng: 140.248,
                routeBranch: "southeast",
                branchOrder: 41
            },
            {
                order: 42,
                displayName: "茂原長南IC",
                googleName: "首都圏中央連絡自動車道 茂原長南インターチェンジ",
                lat: 35.402,
                lng: 140.245,
                routeBranch: "southeast",
                branchOrder: 42
            },
            {
                order: 43,
                displayName: "市原鶴舞IC",
                googleName: "首都圏中央連絡自動車道 市原鶴舞インターチェンジ",
                lat: 35.363,
                lng: 140.185,
                routeBranch: "southeast",
                branchOrder: 43
            },
            {
                order: 44,
                displayName: "木更津東IC",
                googleName: "首都圏中央連絡自動車道 木更津東インターチェンジ",
                lat: 35.361,
                lng: 140.052,
                routeBranch: "southeast",
                branchOrder: 44
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
                branchOrder: 45
            }
        ]
    },


    chuo: {
        label: "中央道方面",
        exits: [
            { order: -6, displayName: "堤通（首都高）", googleName: "首都高速6号向島線 堤通出入口", lat: 35.731, lng: 139.817, experimental: true, roadType: "首都高" },
            { order: -5, displayName: "上野（首都高）", googleName: "首都高速1号上野線 上野出入口", lat: 35.712, lng: 139.779, experimental: true, roadType: "首都高" },
            { order: -4, displayName: "高井戸（首都高）", googleName: "首都高速4号新宿線 高井戸出入口", lat: 35.684, lng: 139.615, experimental: true, roadType: "首都高" },
            { order: -3, displayName: "外苑（首都高）", googleName: "首都高速4号新宿線 外苑出入口", lat: 35.677, lng: 139.718, experimental: true, roadType: "首都高" },
            { order: -2, displayName: "代官町（首都高）", googleName: "首都高速都心環状線 代官町出入口", lat: 35.688, lng: 139.754, experimental: true, roadType: "首都高" },
            { order: -1, displayName: "一ツ橋（首都高）", googleName: "首都高速都心環状線 一ツ橋出入口", lat: 35.692, lng: 139.758, experimental: true, roadType: "首都高" },
            { order: 1, displayName: "高井戸IC", googleName: "中央自動車道 高井戸インターチェンジ", lat: 35.684, lng: 139.611 },
            { order: 2, displayName: "調布IC", googleName: "中央自動車道 調布インターチェンジ", lat: 35.650, lng: 139.536 },
            { order: 3, displayName: "稲城IC", googleName: "中央自動車道 稲城インターチェンジ", lat: 35.638, lng: 139.510 },
            { order: 3.5, displayName: "府中SIC", googleName: "中央自動車道 府中スマートインターチェンジ", lat: 35.660, lng: 139.496 },
            { order: 4, displayName: "国立府中IC", googleName: "中央自動車道 国立府中インターチェンジ", lat: 35.668, lng: 139.457 },
            { order: 5, displayName: "八王子IC", googleName: "中央自動車道 八王子インターチェンジ", lat: 35.657, lng: 139.335 },
            { order: 6, displayName: "相模湖IC", googleName: "中央自動車道 相模湖インターチェンジ", lat: 35.616, lng: 139.190 },
            { order: 7, displayName: "上野原IC", googleName: "中央自動車道 上野原インターチェンジ", lat: 35.631, lng: 139.109 },
            { order: 7.5, displayName: "談合坂SIC", googleName: "中央自動車道 談合坂スマートインターチェンジ", lat: 35.629, lng: 139.045 },
            { order: 8, displayName: "大月IC", googleName: "中央自動車道 大月インターチェンジ", lat: 35.616, lng: 138.949 },
            { order: 9, displayName: "勝沼IC", googleName: "中央自動車道 勝沼インターチェンジ", lat: 35.686, lng: 138.739 },
            { order: 10, displayName: "一宮御坂IC", googleName: "中央自動車道 一宮御坂インターチェンジ", lat: 35.657, lng: 138.688 },
            { order: 10.5, displayName: "笛吹八代SIC", googleName: "中央自動車道 笛吹八代スマートインターチェンジ", lat: 35.623, lng: 138.636 },
            { order: 11, displayName: "甲府昭和IC", googleName: "中央自動車道 甲府昭和インターチェンジ", lat: 35.627, lng: 138.553 },
            { order: 12, displayName: "双葉SIC", googleName: "中央自動車道 双葉スマートインターチェンジ", lat: 35.705, lng: 138.503 },
            { order: 13, displayName: "韮崎IC", googleName: "中央自動車道 韮崎インターチェンジ", lat: 35.718, lng: 138.445 },
            { order: 14, displayName: "須玉IC", googleName: "中央自動車道 須玉インターチェンジ", lat: 35.795, lng: 138.406 },
            { order: 15, displayName: "長坂IC", googleName: "中央自動車道 長坂インターチェンジ", lat: 35.841, lng: 138.366 },
            { order: 16, displayName: "小淵沢IC", googleName: "中央自動車道 小淵沢インターチェンジ", lat: 35.888, lng: 138.316 },
            { order: 17, displayName: "諏訪南IC", googleName: "中央自動車道 諏訪南インターチェンジ", lat: 35.973, lng: 138.232 },
            { order: 18, displayName: "諏訪IC", googleName: "中央自動車道 諏訪インターチェンジ", lat: 36.031, lng: 138.114 },
            { order: 18.5, displayName: "諏訪湖SIC", googleName: "中央自動車道 諏訪湖スマートインターチェンジ", lat: 36.026, lng: 138.079 },
            { order: 19, displayName: "岡谷IC", googleName: "長野自動車道 岡谷インターチェンジ", lat: 36.056, lng: 138.050 },
            { order: 20, displayName: "塩尻IC", googleName: "長野自動車道 塩尻インターチェンジ", lat: 36.093, lng: 137.963 },
            { order: 21, displayName: "松本IC", googleName: "長野自動車道 松本インターチェンジ", lat: 36.219, lng: 137.940 },
            { order: 21.5, displayName: "梓川SIC", googleName: "長野自動車道 梓川スマートインターチェンジ", lat: 36.266, lng: 137.933 },
            { order: 22, displayName: "安曇野IC", googleName: "長野自動車道 安曇野インターチェンジ", lat: 36.300, lng: 137.898 }
        ]
    },


    tomei: {
        label: "東名道方面",
        exits: [
            { order: -8, displayName: "堤通（首都高）", googleName: "首都高速6号向島線 堤通出入口", lat: 35.731, lng: 139.817, experimental: true, roadType: "首都高" },
            { order: -7, displayName: "上野（首都高）", googleName: "首都高速1号上野線 上野出入口", lat: 35.712, lng: 139.779, experimental: true, roadType: "首都高" },
            { order: -6, displayName: "用賀（首都高）", googleName: "首都高速3号渋谷線 用賀出入口", lat: 35.626, lng: 139.633, experimental: true, roadType: "首都高" },
            { order: -5, displayName: "霞が関（首都高）", googleName: "首都高速都心環状線 霞が関出入口", lat: 35.671, lng: 139.751, experimental: true, roadType: "首都高" },
            { order: -4, displayName: "外苑（首都高）", googleName: "首都高速4号新宿線 外苑出入口", lat: 35.677, lng: 139.718, experimental: true, roadType: "首都高" },
            { order: -3, displayName: "代官町（首都高）", googleName: "首都高速都心環状線 代官町出入口", lat: 35.688, lng: 139.754, experimental: true, roadType: "首都高" },
            { order: -2, displayName: "一ツ橋（首都高）", googleName: "首都高速都心環状線 一ツ橋出入口", lat: 35.692, lng: 139.758, experimental: true, roadType: "首都高" },
            { order: -1, displayName: "戸越（首都高）", googleName: "首都高速2号目黒線 戸越出入口", lat: 35.615, lng: 139.716, experimental: true, roadType: "首都高" },
            { order: 1, displayName: "東京IC", googleName: "東名高速道路 東京インターチェンジ", lat: 35.625, lng: 139.632 },
            { order: 2, displayName: "東名川崎IC", googleName: "東名高速道路 東名川崎インターチェンジ", lat: 35.589, lng: 139.587 },
            { order: 3, displayName: "横浜青葉IC", googleName: "東名高速道路 横浜青葉インターチェンジ", lat: 35.542, lng: 139.537, connection: true, connectedRoads: ["tomei", "shutoKanagawaK7Hokusei"] },
            { order: 4, displayName: "横浜町田IC", googleName: "東名高速道路 横浜町田インターチェンジ", lat: 35.513, lng: 139.474, connection: true, connectedRoads: ["tomei", "hodogayaBypass"] },
            { order: 5, displayName: "綾瀬SIC", googleName: "東名高速道路 綾瀬スマートインターチェンジ", lat: 35.436, lng: 139.429 },
            { order: 6, displayName: "厚木IC", googleName: "東名高速道路 厚木インターチェンジ", lat: 35.417, lng: 139.364, connection: true, connectedRoads: ["tomei", "odawaraAtsugi"] },
            { order: 7, displayName: "秦野中井IC", googleName: "東名高速道路 秦野中井インターチェンジ", lat: 35.374, lng: 139.214 },
            { order: 8, displayName: "大井松田IC", googleName: "東名高速道路 大井松田インターチェンジ", lat: 35.344, lng: 139.152 },
            { order: 8.5, displayName: "足柄SIC", googleName: "東名高速道路 足柄スマートインターチェンジ", lat: 35.314, lng: 138.966 },
            { order: 9, displayName: "御殿場IC", googleName: "東名高速道路 御殿場インターチェンジ", lat: 35.300, lng: 138.934 },
            { order: 9.5, displayName: "駒門SIC", googleName: "東名高速道路 駒門スマートインターチェンジ", lat: 35.239, lng: 138.908 },
            { order: 10, displayName: "裾野IC", googleName: "東名高速道路 裾野インターチェンジ", lat: 35.190, lng: 138.909 },
            { order: 11, displayName: "沼津IC", googleName: "東名高速道路 沼津インターチェンジ", lat: 35.156, lng: 138.860 },
            { order: 11.5, displayName: "愛鷹SIC", googleName: "東名高速道路 愛鷹スマートインターチェンジ", lat: 35.143, lng: 138.837 },
            { order: 12, displayName: "富士IC", googleName: "東名高速道路 富士インターチェンジ", lat: 35.180, lng: 138.671 },
            { order: 12.5, displayName: "富士川SIC", googleName: "東名高速道路 富士川スマートインターチェンジ", lat: 35.159, lng: 138.619 },
            { order: 13, displayName: "清水IC", googleName: "東名高速道路 清水インターチェンジ", lat: 35.037, lng: 138.477 },
            { order: 13.5, displayName: "日本平久能山SIC", googleName: "東名高速道路 日本平久能山スマートインターチェンジ", lat: 34.962, lng: 138.422 },
            { order: 14, displayName: "静岡IC", googleName: "東名高速道路 静岡インターチェンジ", lat: 34.944, lng: 138.395 },
            { order: 15, displayName: "焼津IC", googleName: "東名高速道路 焼津インターチェンジ", lat: 34.861, lng: 138.302 },
            { order: 15.5, displayName: "大井川焼津藤枝SIC", googleName: "東名高速道路 大井川焼津藤枝スマートインターチェンジ", lat: 34.821, lng: 138.269 },
            { order: 16, displayName: "吉田IC", googleName: "東名高速道路 吉田インターチェンジ", lat: 34.781, lng: 138.252 },
            { order: 17, displayName: "相良牧之原IC", googleName: "東名高速道路 相良牧之原インターチェンジ", lat: 34.735, lng: 138.179 },
            { order: 18, displayName: "菊川IC", googleName: "東名高速道路 菊川インターチェンジ", lat: 34.748, lng: 138.086 },
            { order: 19, displayName: "掛川IC", googleName: "東名高速道路 掛川インターチェンジ", lat: 34.754, lng: 137.999 },
            { order: 20, displayName: "袋井IC", googleName: "東名高速道路 袋井インターチェンジ", lat: 34.749, lng: 137.908 },
            { order: 21, displayName: "磐田IC", googleName: "東名高速道路 磐田インターチェンジ", lat: 34.783, lng: 137.823 },
            { order: 21.5, displayName: "遠州豊田SIC", googleName: "東名高速道路 遠州豊田スマートインターチェンジ", lat: 34.748, lng: 137.840 },
            { order: 22, displayName: "浜松IC", googleName: "東名高速道路 浜松インターチェンジ", lat: 34.758, lng: 137.773 }
        ]
    },


    daisanKeihin: {
        label: "第三京浜方面",
        exits: [
            { order: 1, displayName: "玉川IC", googleName: "第三京浜道路 玉川インターチェンジ", lat: 35.604, lng: 139.645, roadType: "第三京浜", routeBranch: "daisanKeihin", branchOrder: 1 },
            { order: 2, displayName: "京浜川崎IC", googleName: "第三京浜道路 京浜川崎インターチェンジ", lat: 35.578, lng: 139.627, roadType: "第三京浜", routeBranch: "daisanKeihin", branchOrder: 2 },
            { order: 3, displayName: "都筑IC", googleName: "第三京浜道路 都筑インターチェンジ", lat: 35.544, lng: 139.592, roadType: "第三京浜", routeBranch: "daisanKeihin", branchOrder: 3 },
            { order: 4, displayName: "港北IC", googleName: "第三京浜道路 港北インターチェンジ", lat: 35.519, lng: 139.600, roadType: "第三京浜", routeBranch: "daisanKeihin", branchOrder: 4, connection: true, connectedRoads: ["daisanKeihin", "shutoKanagawaK7", "shutoKanagawaK7Hokusei"] },
            { order: 5, displayName: "羽沢IC", googleName: "第三京浜道路 羽沢インターチェンジ", lat: 35.492, lng: 139.592, roadType: "第三京浜", routeBranch: "daisanKeihin", branchOrder: 5 },
            { order: 6, displayName: "保土ヶ谷IC", googleName: "第三京浜道路 保土ヶ谷インターチェンジ", lat: 35.474, lng: 139.586, roadType: "第三京浜", routeBranch: "daisanKeihin", branchOrder: 6, connection: true, connectedRoads: ["daisanKeihin", "yokohamaShindo"] }
        ]
    },


    yokohamaShindo: {
        label: "横浜新道方面",
        exits: [
            { order: 1, displayName: "保土ヶ谷IC", googleName: "横浜新道 保土ヶ谷インターチェンジ", lat: 35.474, lng: 139.586, roadType: "横浜新道", routeBranch: "yokohamaShindo", branchOrder: 1, connection: true, connectedRoads: ["yokohamaShindo", "daisanKeihin"] },
            { order: 2, displayName: "常盤台出口", googleName: "横浜新道 常盤台出口", lat: 35.473, lng: 139.590, roadType: "横浜新道", routeBranch: "yokohamaShindo", branchOrder: 2 },
            { order: 3, displayName: "峰岡出口", googleName: "横浜新道 峰岡出口", lat: 35.463, lng: 139.590, roadType: "横浜新道", routeBranch: "yokohamaShindo", branchOrder: 3 },
            { order: 4, displayName: "星川入口", googleName: "横浜新道 星川入口", lat: 35.459, lng: 139.588, roadType: "横浜新道", routeBranch: "yokohamaShindo", branchOrder: 4 },
            { order: 5, displayName: "藤塚IC", googleName: "横浜新道 藤塚インターチェンジ", lat: 35.458, lng: 139.567, roadType: "横浜新道", routeBranch: "yokohamaShindo", branchOrder: 5 },
            { order: 6, displayName: "新保土ヶ谷IC", googleName: "横浜新道 新保土ヶ谷インターチェンジ", lat: 35.455, lng: 139.557, roadType: "横浜新道", routeBranch: "yokohamaShindo", branchOrder: 6, connection: true, connectedRoads: ["yokohamaShindo", "hodogayaBypass"] },
            { order: 7, displayName: "今井IC", googleName: "横浜新道 今井インターチェンジ", lat: 35.441, lng: 139.551, roadType: "横浜新道", routeBranch: "yokohamaShindo", branchOrder: 7 },
            { order: 8, displayName: "川上IC", googleName: "横浜新道 川上インターチェンジ", lat: 35.429, lng: 139.542, roadType: "横浜新道", routeBranch: "yokohamaShindo", branchOrder: 8 },
            { order: 9, displayName: "上矢部IC", googleName: "横浜新道 上矢部インターチェンジ", lat: 35.409, lng: 139.529, roadType: "横浜新道", routeBranch: "yokohamaShindo", branchOrder: 9 },
            { order: 10, displayName: "戸塚終点", googleName: "横浜新道 戸塚終点", lat: 35.397, lng: 139.530, roadType: "横浜新道", routeBranch: "yokohamaShindo", branchOrder: 10 }
        ]
    },


    hodogayaBypass: {
        label: "保土ヶ谷バイパス方面",
        exits: [
            { order: 1, displayName: "新保土ヶ谷IC", googleName: "保土ヶ谷バイパス 新保土ヶ谷インターチェンジ", lat: 35.455, lng: 139.557, roadType: "保土ヶ谷バイパス", routeBranch: "hodogayaBypass", branchOrder: 1, connection: true, connectedRoads: ["hodogayaBypass", "yokohamaShindo"] },
            { order: 2, displayName: "新桜ヶ丘IC", googleName: "保土ヶ谷バイパス 新桜ヶ丘インターチェンジ", lat: 35.451, lng: 139.542, roadType: "保土ヶ谷バイパス", routeBranch: "hodogayaBypass", branchOrder: 2 },
            { order: 3, displayName: "南本宿IC", googleName: "保土ヶ谷バイパス 南本宿インターチェンジ", lat: 35.457, lng: 139.526, roadType: "保土ヶ谷バイパス", routeBranch: "hodogayaBypass", branchOrder: 3 },
            { order: 4, displayName: "本村IC", googleName: "保土ヶ谷バイパス 本村インターチェンジ", lat: 35.466, lng: 139.514, roadType: "保土ヶ谷バイパス", routeBranch: "hodogayaBypass", branchOrder: 4 },
            { order: 5, displayName: "下川井IC", googleName: "保土ヶ谷バイパス 下川井インターチェンジ", lat: 35.486, lng: 139.506, roadType: "保土ヶ谷バイパス", routeBranch: "hodogayaBypass", branchOrder: 5 },
            { order: 6, displayName: "上川井IC", googleName: "保土ヶ谷バイパス 上川井インターチェンジ", lat: 35.497, lng: 139.494, roadType: "保土ヶ谷バイパス", routeBranch: "hodogayaBypass", branchOrder: 6 },
            { order: 7, displayName: "横浜町田IC", googleName: "保土ヶ谷バイパス 横浜町田インターチェンジ", lat: 35.513, lng: 139.474, roadType: "保土ヶ谷バイパス", routeBranch: "hodogayaBypass", branchOrder: 7, connection: true, connectedRoads: ["hodogayaBypass", "tomei"] }
        ]
    },


    shutoKanagawaK1: {
        label: "首都高神奈川横羽線方面",
        exits: [
            { order: 1, displayName: "大師", googleName: "首都高速神奈川1号横羽線 大師出入口", lat: 35.535, lng: 139.726, roadType: "首都高", routeBranch: "shutoKanagawaK1", branchOrder: 1 },
            { order: 2, displayName: "浅田", googleName: "首都高速神奈川1号横羽線 浅田出入口", lat: 35.520, lng: 139.706, roadType: "首都高", routeBranch: "shutoKanagawaK1", branchOrder: 2 },
            { order: 3, displayName: "浜川崎", googleName: "首都高速神奈川1号横羽線 浜川崎出入口", lat: 35.522, lng: 139.718, roadType: "首都高", routeBranch: "shutoKanagawaK1", branchOrder: 3 },
            { order: 4, displayName: "生麦", googleName: "首都高速神奈川1号横羽線 生麦出入口", lat: 35.495, lng: 139.668, roadType: "首都高", routeBranch: "shutoKanagawaK1", branchOrder: 4, connection: true, connectedRoads: ["shutoKanagawaK1", "shutoKanagawaK7"] },
            { order: 5, displayName: "汐入", googleName: "首都高速神奈川1号横羽線 汐入出入口", lat: 35.501, lng: 139.682, roadType: "首都高", routeBranch: "shutoKanagawaK1", branchOrder: 5 },
            { order: 6, displayName: "守屋町", googleName: "首都高速神奈川1号横羽線 守屋町出口", lat: 35.481, lng: 139.660, roadType: "首都高", routeBranch: "shutoKanagawaK1", branchOrder: 6, isSelectable: false },
            { order: 7, displayName: "子安", googleName: "首都高速神奈川1号横羽線 子安出入口", lat: 35.483, lng: 139.646, roadType: "首都高", routeBranch: "shutoKanagawaK1", branchOrder: 7 },
            { order: 8, displayName: "東神奈川", googleName: "首都高速神奈川1号横羽線 東神奈川出入口", lat: 35.476, lng: 139.636, roadType: "首都高", routeBranch: "shutoKanagawaK1", branchOrder: 8 },
            { order: 9, displayName: "横浜駅東口", googleName: "首都高速神奈川1号横羽線 横浜駅東口出入口", lat: 35.466, lng: 139.626, roadType: "首都高", routeBranch: "shutoKanagawaK1", branchOrder: 9 },
            { order: 10, displayName: "みなとみらい", googleName: "首都高速神奈川1号横羽線 みなとみらい出入口", lat: 35.457, lng: 139.632, roadType: "首都高", routeBranch: "shutoKanagawaK1", branchOrder: 10 },
            { order: 11, displayName: "横浜公園", googleName: "首都高速神奈川1号横羽線 横浜公園出入口", lat: 35.444, lng: 139.642, roadType: "首都高", routeBranch: "shutoKanagawaK1", branchOrder: 11 }
        ]
    },


    shutoKanagawaK7: {
        label: "首都高横浜北線方面",
        exits: [
            { order: 1, displayName: "岸谷生麦", googleName: "首都高速神奈川7号横浜北線 岸谷生麦出入口", lat: 35.495, lng: 139.667, roadType: "首都高", routeBranch: "shutoKanagawaK7", branchOrder: 1, connection: true, connectedRoads: ["shutoKanagawaK7", "shutoKanagawaK1"] },
            { order: 2, displayName: "馬場", googleName: "首都高速神奈川7号横浜北線 馬場出入口", lat: 35.504, lng: 139.646, roadType: "首都高", routeBranch: "shutoKanagawaK7", branchOrder: 2 },
            { order: 3, displayName: "新横浜", googleName: "首都高速神奈川7号横浜北線 新横浜出入口", lat: 35.513, lng: 139.618, roadType: "首都高", routeBranch: "shutoKanagawaK7", branchOrder: 3 },
            { order: 4, displayName: "横浜港北", googleName: "首都高速神奈川7号横浜北線 横浜港北出入口", lat: 35.519, lng: 139.600, roadType: "首都高", routeBranch: "shutoKanagawaK7", branchOrder: 4, isSelectable: false, connection: true, connectedRoads: ["shutoKanagawaK7", "shutoKanagawaK7Hokusei", "daisanKeihin"] }
        ]
    },


    shutoKanagawaK7Hokusei: {
        label: "首都高横浜北西線方面",
        exits: [
            { order: 1, displayName: "横浜港北", googleName: "首都高速神奈川7号横浜北西線 横浜港北出入口", lat: 35.519, lng: 139.600, roadType: "首都高", routeBranch: "shutoKanagawaK7Hokusei", branchOrder: 1, isSelectable: false, connection: true, connectedRoads: ["shutoKanagawaK7Hokusei", "shutoKanagawaK7", "daisanKeihin"] },
            { order: 2, displayName: "横浜青葉", googleName: "首都高速神奈川7号横浜北西線 横浜青葉出入口", lat: 35.542, lng: 139.537, roadType: "首都高", routeBranch: "shutoKanagawaK7Hokusei", branchOrder: 2, connection: true, connectedRoads: ["shutoKanagawaK7Hokusei", "tomei"] }
        ]
    },


    odawaraAtsugi: {
        label: "小田原厚木道路方面",
        exits: [
            {
                order: 1,
                displayName: "厚木IC",
                googleName: "小田原厚木道路 厚木インターチェンジ",
                lat: 35.417,
                lng: 139.364,
                roadType: "小田原厚木道路",
                routeBranch: "odawaraAtsugi",
                branchOrder: 1,
                connection: true,
                connectedRoads: ["tomei", "odawaraAtsugi"]
            },
            {
                order: 2,
                displayName: "厚木西IC",
                googleName: "小田原厚木道路 厚木西インターチェンジ",
                lat: 35.41657,
                lng: 139.3509,
                roadType: "小田原厚木道路",
                routeBranch: "odawaraAtsugi",
                branchOrder: 2
            },
            {
                order: 3,
                displayName: "伊勢原IC",
                googleName: "小田原厚木道路 伊勢原インターチェンジ",
                lat: 35.38629,
                lng: 139.3314,
                roadType: "小田原厚木道路",
                routeBranch: "odawaraAtsugi",
                branchOrder: 3
            },
            {
                order: 4,
                displayName: "平塚IC",
                googleName: "小田原厚木道路 平塚インターチェンジ",
                lat: 35.35883,
                lng: 139.3028,
                roadType: "小田原厚木道路",
                routeBranch: "odawaraAtsugi",
                branchOrder: 4
            },
            {
                order: 5,
                displayName: "大磯IC",
                googleName: "小田原厚木道路 大磯インターチェンジ",
                lat: 35.31957,
                lng: 139.2719,
                roadType: "小田原厚木道路",
                routeBranch: "odawaraAtsugi",
                branchOrder: 5
            },
            {
                order: 6,
                displayName: "二宮IC",
                googleName: "小田原厚木道路 二宮インターチェンジ",
                lat: 35.30803,
                lng: 139.2378,
                roadType: "小田原厚木道路",
                routeBranch: "odawaraAtsugi",
                branchOrder: 6
            },
            {
                order: 7,
                displayName: "小田原東IC",
                googleName: "小田原厚木道路 小田原東インターチェンジ",
                lat: 35.28621,
                lng: 139.1697,
                roadType: "小田原厚木道路",
                routeBranch: "odawaraAtsugi",
                branchOrder: 7
            },
            {
                order: 8,
                displayName: "荻窪IC",
                googleName: "小田原厚木道路 荻窪インターチェンジ",
                lat: 35.25742,
                lng: 139.13601,
                roadType: "小田原厚木道路",
                routeBranch: "odawaraAtsugi",
                branchOrder: 8
            },
            {
                order: 9,
                displayName: "小田原西IC",
                googleName: "小田原厚木道路 小田原西インターチェンジ",
                lat: 35.2446,
                lng: 139.1352,
                roadType: "小田原厚木道路",
                routeBranch: "odawaraAtsugi",
                branchOrder: 9
            }
        ]
    },



    aqualine: {
        label: "アクアライン方面",
        exits: [
            { order: -8, displayName: "堤通（首都高）", googleName: "首都高速6号向島線 堤通出入口", lat: 35.731, lng: 139.817, experimental: true, roadType: "首都高" },
            { order: -7, displayName: "上野（首都高）", googleName: "首都高速1号上野線 上野出入口", lat: 35.712, lng: 139.779, experimental: true, roadType: "首都高" },
            { order: -6, displayName: "葛西（首都高）", googleName: "首都高速湾岸線 葛西出入口", lat: 35.652, lng: 139.870, experimental: true, roadType: "首都高" },
            { order: -5, displayName: "湾岸市川（首都高）", googleName: "首都高速湾岸線 湾岸市川出入口", lat: 35.672, lng: 139.938, experimental: true, roadType: "首都高" },
            { order: -4, displayName: "新木場（首都高）", googleName: "首都高速湾岸線 新木場出入口", lat: 35.645, lng: 139.827, experimental: true, roadType: "首都高" },
            { order: -3, displayName: "有明（首都高）", googleName: "首都高速湾岸線 有明出入口", lat: 35.634, lng: 139.795, experimental: true, roadType: "首都高" },
            { order: -2, displayName: "大井南（首都高）", googleName: "首都高速湾岸線 大井南出入口", lat: 35.589, lng: 139.756, experimental: true, roadType: "首都高" },
            { order: -1, displayName: "空港中央（首都高）", googleName: "首都高速湾岸線 空港中央出入口", lat: 35.553, lng: 139.787, experimental: true, roadType: "首都高" },
            {
                order: 1,
                displayName: "浮島IC",
                googleName: "首都高速湾岸線 浮島インターチェンジ",
                lat: 35.521,
                lng: 139.788,
                routeBranch: "aqualine",
                branchOrder: 1
            },
            {
                order: 2,
                displayName: "海ほたるPA",
                googleName: "東京湾アクアライン 海ほたるパーキングエリア",
                lat: 35.463,
                lng: 139.875,
                isSelectable: false,
                routeBranch: "aqualine",
                branchOrder: 1.5
            },
            {
                order: 3,
                displayName: "木更津金田IC",
                googleName: "東京湾アクアライン 木更津金田インターチェンジ",
                lat: 35.435,
                lng: 139.921,
                connection: true,
                connectedRoads: ["aqualine", "tateyama"],
                routeBranch: "aqualine",
                branchOrder: 2
            },
            {
                order: 4,
                displayName: "袖ケ浦IC",
                googleName: "東京湾アクアライン連絡道 袖ケ浦インターチェンジ",
                lat: 35.418,
                lng: 139.980,
                connection: true,
                connectedRoads: ["aqualine", "tateyama"],
                routeBranch: "aqualine",
                branchOrder: 3
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
                lat: 35.521,
                lng: 139.788,
                routeBranch: "aqualine",
                branchOrder: 1
            },
            {
                order: -2,
                displayName: "木更津金田IC",
                googleName: "東京湾アクアライン 木更津金田インターチェンジ",
                lat: 35.435,
                lng: 139.921,
                connection: true,
                connectedRoads: ["aqualine", "tateyama"],
                routeBranch: "aqualine",
                branchOrder: 2
            },
            {
                order: -1,
                displayName: "袖ケ浦IC",
                googleName: "東京湾アクアライン連絡道 袖ケ浦インターチェンジ",
                lat: 35.418,
                lng: 139.980,
                connection: true,
                connectedRoads: ["aqualine", "tateyama"],
                routeBranch: "aqualine",
                branchOrder: 3
            },
            {
                order: 0,
                displayName: "蘇我IC",
                googleName: "京葉道路 蘇我インターチェンジ",
                lat: 35.568,
                lng: 140.158,
                connection: true,
                connectedRoads: ["keiyo", "tateyama", "tokan"],
                routeBranch: "keiyo",
                branchOrder: 10
            },
            {
                order: 1,
                displayName: "市原IC",
                googleName: "館山自動車道 市原インターチェンジ",
                lat: 35.498,
                lng: 140.104,
                connection: true,
                connectedRoads: ["keiyo", "tateyama"],
                routeBranch: "keiyo",
                branchOrder: 11
            },
            {
                order: 2,
                displayName: "姉崎袖ケ浦IC",
                googleName: "館山自動車道 姉崎袖ケ浦インターチェンジ",
                lat: 35.432,
                lng: 140.043,
                routeBranch: "keiyo",
                branchOrder: 12
            },
            {
                order: 3,
                displayName: "木更津北IC",
                googleName: "館山自動車道 木更津北インターチェンジ",
                lat: 35.394,
                lng: 139.967,
                routeBranch: "aqualine",
                branchOrder: 4
            },
            {
                order: 4,
                displayName: "木更津南IC",
                googleName: "館山自動車道 木更津南インターチェンジ",
                lat: 35.365,
                lng: 139.935,
                routeBranch: "aqualine",
                branchOrder: 5
            },
            {
                order: 5,
                displayName: "君津IC",
                googleName: "館山自動車道 君津インターチェンジ",
                lat: 35.333,
                lng: 139.902,
                routeBranch: "aqualine",
                branchOrder: 6
            },
            {
                order: 5.5,
                displayName: "君津PA SIC",
                googleName: "館山自動車道 君津PAスマートインターチェンジ",
                lat: 35.283,
                lng: 139.927,
                routeBranch: "aqualine",
                branchOrder: 6.5
            },
            {
                order: 6,
                displayName: "富津中央IC",
                googleName: "館山自動車道 富津中央インターチェンジ",
                lat: 35.273,
                lng: 139.855,
                routeBranch: "aqualine",
                branchOrder: 7
            },
            {
                order: 7,
                displayName: "富津竹岡IC",
                googleName: "富津館山道路 富津竹岡インターチェンジ",
                lat: 35.204,
                lng: 139.825,
                routeBranch: "aqualine",
                branchOrder: 8
            },
            {
                order: 8,
                displayName: "鋸南保田IC",
                googleName: "富津館山道路 鋸南保田インターチェンジ",
                lat: 35.140,
                lng: 139.827,
                routeBranch: "aqualine",
                branchOrder: 9
            },
            {
                order: 9,
                displayName: "富浦IC",
                googleName: "富津館山道路 富浦インターチェンジ",
                lat: 35.034,
                lng: 139.832,
                routeBranch: "aqualine",
                branchOrder: 10
            }
        ]
    },





    keiyo: {
        label: "京葉道路方面",
        exits: [
            { order: -8, displayName: "堤通（首都高）", googleName: "首都高速6号向島線 堤通出入口", lat: 35.731, lng: 139.817, experimental: true, roadType: "首都高" },
            { order: -7, displayName: "上野（首都高）", googleName: "首都高速1号上野線 上野出入口", lat: 35.712, lng: 139.779, experimental: true, roadType: "首都高" },
            { order: -6, displayName: "葛西（首都高）", googleName: "首都高速湾岸線 葛西出入口", lat: 35.652, lng: 139.870, experimental: true, roadType: "首都高" },
            { order: -5, displayName: "湾岸市川（首都高）", googleName: "首都高速湾岸線 湾岸市川出入口", lat: 35.672, lng: 139.938, experimental: true, roadType: "首都高" },
            { order: -4, displayName: "新木場（首都高）", googleName: "首都高速湾岸線 新木場出入口", lat: 35.645, lng: 139.827, experimental: true, roadType: "首都高" },
            { order: -3, displayName: "有明（首都高）", googleName: "首都高速湾岸線 有明出入口", lat: 35.634, lng: 139.795, experimental: true, roadType: "首都高" },
            { order: -2, displayName: "大井南（首都高）", googleName: "首都高速湾岸線 大井南出入口", lat: 35.589, lng: 139.756, experimental: true, roadType: "首都高" },
            { order: -1, displayName: "空港中央（首都高）", googleName: "首都高速湾岸線 空港中央出入口", lat: 35.553, lng: 139.787, experimental: true, roadType: "首都高" },
            {
                order: 1,
                displayName: "篠崎IC",
                googleName: "京葉道路 篠崎インターチェンジ",
                lat: 35.707,
                lng: 139.898,
                routeBranch: "keiyo",
                branchOrder: 1
            },
            {
                order: 2,
                displayName: "京葉市川IC",
                googleName: "京葉道路 京葉市川インターチェンジ",
                lat: 35.715,
                lng: 139.931,
                routeBranch: "keiyo",
                branchOrder: 2
            },
            {
                order: 3,
                displayName: "原木IC",
                googleName: "京葉道路 原木インターチェンジ",
                lat: 35.704,
                lng: 139.959,
                routeBranch: "keiyo",
                branchOrder: 3
            },
            {
                order: 4,
                displayName: "船橋IC",
                googleName: "京葉道路 船橋インターチェンジ",
                lat: 35.693,
                lng: 139.990,
                routeBranch: "keiyo",
                branchOrder: 4
            },
            {
                order: 5,
                displayName: "花輪IC",
                googleName: "京葉道路 花輪インターチェンジ",
                lat: 35.689,
                lng: 140.015,
                routeBranch: "keiyo",
                branchOrder: 5
            },
            {
                order: 6,
                displayName: "武石IC",
                googleName: "京葉道路 武石インターチェンジ",
                lat: 35.675,
                lng: 140.061,
                routeBranch: "keiyo",
                branchOrder: 6
            },
            {
                order: 7,
                displayName: "穴川IC",
                googleName: "京葉道路 穴川インターチェンジ",
                lat: 35.644,
                lng: 140.119,
                routeBranch: "keiyo",
                branchOrder: 7
            },
            {
                order: 8,
                displayName: "貝塚IC",
                googleName: "京葉道路 貝塚インターチェンジ",
                lat: 35.625,
                lng: 140.150,
                routeBranch: "keiyo",
                branchOrder: 8
            },
            {
                order: 9,
                displayName: "松ヶ丘IC",
                googleName: "京葉道路 松ヶ丘インターチェンジ",
                lat: 35.583,
                lng: 140.158,
                routeBranch: "keiyo",
                branchOrder: 9
            },
            {
                order: 10,
                displayName: "蘇我IC",
                googleName: "京葉道路 蘇我インターチェンジ",
                lat: 35.568,
                lng: 140.158,
                connection: true,
                connectedRoads: ["keiyo", "tateyama", "tokan"],
                routeBranch: "keiyo",
                branchOrder: 10
            },
            {
                order: 11,
                displayName: "市原IC",
                googleName: "館山自動車道 市原インターチェンジ",
                lat: 35.498,
                lng: 140.104,
                connection: true,
                connectedRoads: ["keiyo", "tateyama"],
                routeBranch: "keiyo",
                branchOrder: 11
            },
            {
                order: 12,
                displayName: "姉崎袖ケ浦IC",
                googleName: "館山自動車道 姉崎袖ケ浦インターチェンジ",
                lat: 35.432,
                lng: 140.043,
                routeBranch: "keiyo",
                branchOrder: 12
            },
            {
                order: 13,
                displayName: "木更津北IC",
                googleName: "館山自動車道 木更津北インターチェンジ",
                lat: 35.394,
                lng: 139.967,
                routeBranch: "keiyo",
                branchOrder: 13
            },
            {
                order: 14,
                displayName: "木更津南IC",
                googleName: "館山自動車道 木更津南インターチェンジ",
                lat: 35.365,
                lng: 139.935,
                routeBranch: "keiyo",
                branchOrder: 14
            },
            {
                order: 15,
                displayName: "君津IC",
                googleName: "館山自動車道 君津インターチェンジ",
                lat: 35.333,
                lng: 139.902,
                routeBranch: "keiyo",
                branchOrder: 15
            }
        ]
    },



    tokan: {
        label: "東関東道方面",
        exits: [
            { order: -8, displayName: "堤通（首都高）", googleName: "首都高速6号向島線 堤通出入口", lat: 35.731, lng: 139.817, experimental: true, roadType: "首都高" },
            { order: -7, displayName: "上野（首都高）", googleName: "首都高速1号上野線 上野出入口", lat: 35.712, lng: 139.779, experimental: true, roadType: "首都高" },
            { order: -6, displayName: "葛西（首都高）", googleName: "首都高速湾岸線 葛西出入口", lat: 35.652, lng: 139.870, experimental: true, roadType: "首都高" },
            { order: -5, displayName: "湾岸市川（首都高）", googleName: "首都高速湾岸線 湾岸市川出入口", lat: 35.672, lng: 139.938, experimental: true, roadType: "首都高" },
            { order: -4, displayName: "新木場（首都高）", googleName: "首都高速湾岸線 新木場出入口", lat: 35.645, lng: 139.827, experimental: true, roadType: "首都高" },
            { order: -3, displayName: "有明（首都高）", googleName: "首都高速湾岸線 有明出入口", lat: 35.634, lng: 139.795, experimental: true, roadType: "首都高" },
            { order: -2, displayName: "大井南（首都高）", googleName: "首都高速湾岸線 大井南出入口", lat: 35.589, lng: 139.756, experimental: true, roadType: "首都高" },
            { order: -1, displayName: "空港中央（首都高）", googleName: "首都高速湾岸線 空港中央出入口", lat: 35.553, lng: 139.787, experimental: true, roadType: "首都高" },
            {
                order: 0.1,
                displayName: "葛西IC",
                googleName: "首都高速湾岸線 葛西出入口",
                lat: 35.652,
                lng: 139.870,
                routeBranch: "tokan",
                branchOrder: 1
            },
            {
                order: 0.2,
                displayName: "湾岸市川IC",
                googleName: "首都高速湾岸線 湾岸市川出入口",
                lat: 35.672,
                lng: 139.938,
                routeBranch: "tokan",
                branchOrder: 2
            },
            {
                order: 0,
                displayName: "蘇我IC",
                googleName: "京葉道路 蘇我インターチェンジ",
                lat: 35.568,
                lng: 140.158,
                connection: true,
                connectedRoads: ["keiyo", "tokan", "tateyama"],
                routeBranch: "keiyo",
                branchOrder: 10
            },
            {
                order: 1,
                displayName: "湾岸習志野IC",
                googleName: "東関東自動車道 湾岸習志野インターチェンジ",
                lat: 35.665,
                lng: 140.016,
                routeBranch: "tokan",
                branchOrder: 3
            },
            {
                order: 2,
                displayName: "湾岸千葉IC",
                googleName: "東関東自動車道 湾岸千葉インターチェンジ",
                lat: 35.638,
                lng: 140.060,
                routeBranch: "tokan",
                branchOrder: 4
            },
            {
                order: 3,
                displayName: "千葉北IC",
                googleName: "東関東自動車道 千葉北インターチェンジ",
                lat: 35.676,
                lng: 140.131,
                routeBranch: "tokan",
                branchOrder: 5
            },
            {
                order: 4,
                displayName: "四街道IC",
                googleName: "東関東自動車道 四街道インターチェンジ",
                lat: 35.664,
                lng: 140.187,
                routeBranch: "tokan",
                branchOrder: 6
            },
            {
                order: 5,
                displayName: "佐倉IC",
                googleName: "東関東自動車道 佐倉インターチェンジ",
                lat: 35.694,
                lng: 140.248,
                routeBranch: "tokan",
                branchOrder: 7
            },
            {
                order: 6,
                displayName: "酒々井IC",
                googleName: "東関東自動車道 酒々井インターチェンジ",
                lat: 35.718,
                lng: 140.300,
                routeBranch: "tokan",
                branchOrder: 8
            },
            {
                order: 7,
                displayName: "富里IC",
                googleName: "東関東自動車道 富里インターチェンジ",
                lat: 35.729,
                lng: 140.343,
                routeBranch: "tokan",
                branchOrder: 9
            },
            {
                order: 8,
                displayName: "成田IC",
                googleName: "東関東自動車道 成田インターチェンジ",
                lat: 35.779,
                lng: 140.365,
                routeBranch: "tokan",
                branchOrder: 10
            },
            {
                order: 9,
                displayName: "大栄IC",
                googleName: "東関東自動車道 大栄インターチェンジ",
                lat: 35.842,
                lng: 140.470,
                routeBranch: "tokan",
                branchOrder: 11
            },
            {
                order: 10,
                displayName: "佐原香取IC",
                googleName: "東関東自動車道 佐原香取インターチェンジ",
                lat: 35.884,
                lng: 140.548,
                routeBranch: "tokan",
                branchOrder: 12
            },
            {
                order: 11,
                displayName: "潮来IC",
                googleName: "東関東自動車道 潮来インターチェンジ",
                lat: 35.952,
                lng: 140.574,
                routeBranch: "tokan",
                branchOrder: 13
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

        if (
            !existing ||
            (
                ic.source === "SHUTO_IC_MASTER" &&
                existing.source !== "SHUTO_IC_MASTER"
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

    const isSelectable =
        shutoIc.isSelectable === false
            ? false
            : Boolean(
                shutoIc.entranceSelectable ||
                shutoIc.exitSelectable
            );

    return {
        ...shutoIc,
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
    routeOptions
) {
    return JSON.stringify({
        origin: origin,
        destination: destination,
        routeOptions: routeOptions
    });
}

function createRoutesCacheRequest(
    functionName,
    origin,
    destination,
    routeOptions
) {
    return {
        key: createRoutesCacheKey(
            origin,
            destination,
            routeOptions
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

    if (
        !lastHighwayRoutePolylineAnalysis &&
        !lastHighwayRoutePolylineAnalysisKey
    ) {
        return;
    }

    lastHighwayRoutePolylineAnalysis = null;
    lastHighwayRoutePolylineAnalysisKey = "";

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
                    "routes.duration,routes.distanceMeters"
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

    lastHighwayRoutePolylineAnalysisKey =
        polylineAnalysis
            ? buildRouteAnalysisKey(origin, destination)
            : "";

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
        formatMinutes(
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
        formatMinutes(
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
        const assumedRouteHtml =
            buildAssumedRouteHtml(
                lastHighwayRoutePolylineAnalysis
            );

        document
            .getElementById("dashboardCost")
            .innerHTML =
            createMainTollEstimateHtml(tollEstimate);

        document
            .getElementById("dashboardAssumedRouteValue")
            .innerHTML =
            assumedRouteHtml || "ルート情報なし";
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

    const fallbackKm =
        highwayRoute.distanceMeters / 1000;

    const fallbackAmount =
        Math.round(
            fallbackKm * 24
        );

    const shutoTollEstimate =
        polylineAnalysis?.shutoEntranceIc
            ? SHUTO_TOLL_ESTIMATE_YEN
            : 0;

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

        const startIc =
            canUseNexcoPolylineIcs
                ? nexcoStartIc
                : canUseDefaultPolylineIcs
                    ? polylineStartIc
                    : legacyStartIc;

        const endIc =
            canUseNexcoPolylineIcs
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
            legacyStartIc?.googleName &&
            legacyEndIc?.googleName
        ) {
            lastTollStartIcName =
                legacyStartIc.displayName;
            lastTollStartIc =
                legacyStartIc;

            lastTollStartIcGoogleName =
                legacyStartIc.googleName;

            lastTollStartIcOrder =
                legacyStartIc.order;

            lastTollEndIcName =
                legacyEndIc.displayName;
            lastTollEndIc =
                legacyEndIc;

            lastTollEndIcGoogleName =
                legacyEndIc.googleName;

            lastTollEndIcOrder =
                legacyEndIc.order;
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

        const tollRoute =
            await getHighwayRouteForTollEstimate(
                startIc.googleName,
                endIc.googleName
            );

        const tollKm =
            tollRoute.distanceMeters / 1000;

        const baseToll =
            Math.round(
                tollKm * 24
            );

        return {
            amount:
                baseToll + shutoToll,
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

    const usedNexcoPolylineIc =
        tollEstimate?.usedNexcoPolylineIc === true;

    const usedPolylineAnalysis =
        tollEstimate?.usedPolylineAnalysis === true;

    const usedIcCalculation =
        Boolean(
            tollEstimate?.startIc &&
            tollEstimate?.endIc
        );

    const calculationLogic =
        usedNexcoPolylineIc
            ? "Polyline解析NEXCO IC"
            : usedPolylineAnalysis
                ? "Polyline解析IC"
                : usedIcCalculation
                    ? "旧ロジックIC"
                    : "距離ベース";

    console.group("[ETC概算 料金計算]");
    console.log("料金計算ロジック：", calculationLogic);

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
            tollEstimate?.fallbackReason || "不明"
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

                    "X-Goog-FieldMask":
                        "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline"

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

function findNearestIcMasterEntryForRoutePoint(
    routePoint,
    icDefinitions
) {

    let nearest = null;
    let nearestDistanceMeters = Infinity;

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
        distanceMeters: nearestDistanceMeters
    };
}

function isShutoIcForRouteAnalysis(exit) {

    return (
        exit.roadType === "首都高" ||
        String(exit.displayName || "")
            .includes("（首都高）")
    );
}

function findNearestShutoIcForRoutePoint(
    routePoint,
    icDefinitions
) {

    let nearest = null;
    let nearestDistanceMeters = Infinity;

    for (const exit of icDefinitions) {
        if (
            !isShutoIcForRouteAnalysis(exit) ||
            exit.isSelectable === false ||
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
    icDefinitions
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
                icDefinitions
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
    icDefinitions
) {

    const orderedSamples = fromEnd
        ? sampledPoints.slice().reverse()
        : sampledPoints;

    const anchorSample =
        orderedSamples.find(routePoint => {
            const nearest =
                findNearestShutoIcForRoutePoint(
                    routePoint,
                    icDefinitions
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
            sampleRoutePointsByDistance(routePoints, 2000);

        const icDefinitions =
            getAllRouteAnalysisIcDefinitions();

        const areaCounts =
            Object.fromEntries(
                [...Object.keys(IC_MASTER), "shuto"].map(icArea =>
                    [icArea, 0]
                )
            );

        const routePointLogs = [];
        const routeTrace = [];
        const passedIcEntries = [];

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

            const icIdentity =
                nearest.exit.googleName ||
                nearest.icArea + "|" + displayName;

            if (
                passedIcEntries[passedIcEntries.length - 1]
                    ?.identity !== icIdentity
            ) {
                passedIcEntries.push({
                    identity: icIdentity,
                    icArea: nearest.icArea,
                    exit: nearest.exit
                });
            }

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
                distanceKm
            });

            routeTrace.push({
                routeDistanceMeters:
                    routePoint.routeDistanceMeters,
                lat: routePoint.lat,
                lng: routePoint.lng,
                roadLabel,
                icArea: nearest.icArea,
                exit: nearest.exit
            });
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
                currentRoadSegment.endTraceIndex = index;
            }
            else {
                roadSegments.push({
                    roadLabel: item.roadLabel,
                    distanceMeters: estimatedDistanceMeters,
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

        const nexcoEntranceCandidate =
            selectablePassedNexcoIcs[0]?.exit || null;

        const nexcoExitCandidate =
            selectablePassedNexcoIcs[
                selectablePassedNexcoIcs.length - 1
            ]?.exit || null;

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
                    icDefinitions
                )
                : emptyShutoWindow;

        const shutoExitWindow =
            usesShuto
                ? selectShutoIcCandidateWindow(
                    shutoDetailEndSamples,
                    true,
                    3000,
                    5000,
                    icDefinitions
                )
                : emptyShutoWindow;

        const shutoEntranceAnalysis =
            usesShuto
                ? analyzeShutoIcCandidates(
                    shutoEntranceWindow.samples,
                    false,
                    3000,
                    icDefinitions
                )
                : { candidates: [], selectedIc: null };

        const shutoExitAnalysis =
            usesShuto
                ? analyzeShutoIcCandidates(
                    shutoExitWindow.samples,
                    true,
                    3000,
                    icDefinitions
                )
                : { candidates: [], selectedIc: null };

        return {
            roadSequence:
                correctedRoadSummary.roadSequence,
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
            routeTrace,
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
            getIcIdentity(exit) === targetIdentity
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

    const inferTravelDirection = icArea => {
        const referenceInArea =
            findExitInArea(icArea, referenceIc);

        const referencePosition =
            getComparablePosition(
                referenceInArea,
                referenceInArea
            );

        if (referencePosition === null) {
            return null;
        }

        const passedIcs =
            polylineAnalysis.passedIcEntries || [];

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
                findExitInArea(
                    icArea,
                    passedIcs[index].exit
                );

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
                findExitInArea(
                    icArea,
                    passedIcs[index].exit
                );

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
    };

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

    if (shutoEntranceIc) {
        const shutoIdentity =
            getIcIdentity(shutoEntranceIc);

        const alreadyIncluded =
            workingCandidates.some(candidate =>
                getIcIdentity(candidate.exit) === shutoIdentity
            );

        if (!alreadyIncluded) {
            const shutoArea =
                candidateAreas.find(icArea =>
                    Boolean(
                        findExitInArea(
                            icArea,
                            shutoEntranceIc
                        )
                    )
                ) || referenceArea;

            workingCandidates.push({
                icArea: shutoArea,
                exit: shutoEntranceIc,
                isShuto: true
            });
        }
    }

    const beforeCandidates = [...workingCandidates];

    const filteredCandidates =
        workingCandidates.filter(candidate => {
            const exit = candidate.exit;

            if (
                shutoEntranceIc &&
                isShutoIcForRouteAnalysis(exit) &&
                getIcIdentity(exit) !==
                    getIcIdentity(shutoEntranceIc)
            ) {
                excludedCandidates.push({
                    candidate,
                    reason:
                        "Polyline解析の首都高入口を優先"
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
                        exit.isSelectable !== false
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
            getIcIdentity
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
            "Polyline道路エリアを特定できないため候補なし";
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
    getIcIdentity
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
        const exit = routePoint.exit;
        const identity = getIcIdentity(exit);

        if (
            !identity ||
            exit?.lat === undefined ||
            exit?.lng === undefined ||
            !Number.isFinite(routePoint.routeDistanceMeters)
        ) {
            return;
        }

        const polylineDistanceMeters =
            calculateDistance(
                routePoint.lat,
                routePoint.lng,
                exit.lat,
                exit.lng
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
            else if (isConnectionJunction) {
                exclusionReason = "接続用JCT";
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

    if (
        !Array.isArray(candidates) ||
        !referenceIc ||
        referenceIc.isSelectable === false ||
        maxCount <= 0
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
            candidate.exit.isSelectable === false
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

    const referenceIdentity = getIcIdentity(referenceIc);

    let referenceIndex =
        uniqueCandidates.findIndex(candidate =>
            getIcIdentity(candidate.exit) === referenceIdentity
        );

    if (referenceIndex < 0) {
        uniqueCandidates.unshift({
            icArea: null,
            exit: referenceIc,
            isShuto:
                isShutoIcForRouteAnalysis(referenceIc)
        });
        referenceIndex = 0;
    }

    const limitedCount =
        Math.min(maxCount, uniqueCandidates.length);

    const candidatesBeforeReference =
        Math.floor(limitedCount / 2);

    let startIndex =
        referenceIndex - candidatesBeforeReference;

    startIndex = Math.max(0, startIndex);

    if (
        startIndex + limitedCount >
        uniqueCandidates.length
    ) {
        startIndex = Math.max(
            0,
            uniqueCandidates.length - limitedCount
        );
    }

    return uniqueCandidates.slice(
        startIndex,
        startIndex + limitedCount
    );
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

    if (polylineApiCandidates.length > 0) {
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
        formatMinutes(minutes) +
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
                ? "<br>" + escapeHtml(tollLabel)
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
                exit.googleName === googleName
            );

        if (found) {
            return found;
        }
    }

    return null;
}

function buildRoutesLocationForIcOrAddress(value) {

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

    if (
        ic &&
        ic.lat !== undefined &&
        ic.lng !== undefined
    ) {
        return {
            location: {
                latLng: {
                    latitude: ic.lat,
                    longitude: ic.lng
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
        baseLng
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
            destinationLatLng.lng
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

function findNearestIcByMasterCoordinatesForAutoExitComparison(
    icArea,
    baseLat,
    baseLng
) {

    const exits =
        IC_MASTER[icArea].exits
            .filter(exit =>
                exit.lat !== undefined &&
                exit.lng !== undefined &&
                exit.isSelectable !== false
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
        !highwayStart ||
        !baseLatLng ||
        baseLatLng.lat === undefined ||
        baseLatLng.lng === undefined
    ) {
        return [];
    }

    const selectableExits =
        IC_MASTER[icArea].exits
            .filter(exit =>
                exit.isSelectable !== false &&
                exit.lat !== undefined &&
                exit.lng !== undefined
            );

    const sortByDistanceFromBase = (a, b) =>
        calculateDistance(
            baseLatLng.lat,
            baseLatLng.lng,
            a.lat,
            a.lng
        ) -
        calculateDistance(
            baseLatLng.lat,
            baseLatLng.lng,
            b.lat,
            b.lng
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
    destination
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
                    "routes.duration,routes.distanceMeters"
            },

            body: JSON.stringify({

                origin:
                    buildRoutesLocationForIcOrAddress(origin),

                destination:
                    buildRoutesLocationForIcOrAddress(destination),

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
    destination
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
                    "routes.duration,routes.distanceMeters"
            },

            body: JSON.stringify({

                origin:
                    buildRoutesLocationForIcOrAddress(origin),

                destination:
                    buildRoutesLocationForIcOrAddress(destination),

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
                    highwayEndIc
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
                            exitIcDefinition
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

function buildExitCandidateValueNote(result) {
    if (
        !result ||
        result.savedToll === null ||
        result.savedToll === undefined ||
        result.savedToll <= 0 ||
        result.differenceFromAllHighway === null ||
        result.differenceFromAllHighway === undefined
    ) {
        return "";
    }

    if (result.differenceFromAllHighway <= 0) {
        return "遅れなしで節約あり";
    }

    const efficiencyText =
        result.yenPerDelayedMinute === null ||
        result.yenPerDelayedMinute === undefined
            ? ""
            : "（1分あたり" +
                result.yenPerDelayedMinute +
                "円）";

    const normalExitIcName =
        getNormalHighwayExitIcName();

    const normalExitRecommendation =
        normalExitIcName
            ? "通常出口（" + normalExitIcName + "）がおすすめ"
            : "通常出口がおすすめ";

    return (
        result.differenceFromAllHighway +
        "分の遅れで" +
        result.savedToll +
        "円節約" +
        efficiencyText +
        "。時間優先なら" +
        normalExitRecommendation
    );
}

function getNormalHighwayExitIcName() {

    return lastHighwayRoutePolylineAnalysis
        ?.nexcoExitIc?.displayName || "";
}

function evaluateExitCandidateEligibility(result) {

    const valueNote =
        buildExitCandidateValueNote(result);

    if (result.error) {
        return {
            recommendationEligibility: "error",
            weakReason: "計算エラー",
            valueNote
        };
    }

    if (
        result.savedToll === null ||
        result.savedToll === undefined ||
        result.differenceFromAllHighway === null ||
        result.differenceFromAllHighway === undefined
    ) {
        return {
            recommendationEligibility: "weak",
            weakReason: "全高速との差分または節約額不明",
            valueNote
        };
    }

    if (
        result.savedToll < 0 &&
        result.differenceFromAllHighway > 0
    ) {
        return {
            recommendationEligibility: "weak",
            weakReason: "逆に高く、時間も遅い",
            valueNote
        };
    }

    if (result.savedToll < 0) {
        return {
            recommendationEligibility: "weak",
            weakReason: "逆に高い",
            valueNote
        };
    }

    if (result.savedToll === 0) {
        return {
            recommendationEligibility: "weak",
            weakReason: "節約なし",
            valueNote
        };
    }

    const acceptableDelayMinutes =
        getAcceptableDelayMinutes();

    if (
        result.differenceFromAllHighway >
        acceptableDelayMinutes
    ) {
        return {
            recommendationEligibility: "weak",
            weakReason: "許容遅れ超過",
            valueNote
        };
    }

    return {
        recommendationEligibility: "eligible",
        weakReason: "",
        valueNote
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
                    exit.googleName
                );

            const highwayFromCandidateRoute =
                await getHighwayRouteForMultiExitComparison(
                    exit.googleName,
                    destination
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

            const shutoToll =
                getShutoTollEstimateForIcPair(
                    exit,
                    endIc
                );

            let tollDistanceMeters =
                highwayFromCandidateRoute.distanceMeters;

            if (
                lastTollEndIcGoogleName &&
                exit.googleName !== lastTollEndIcGoogleName
            ) {

                const tollRoute =
                    await getHighwayRouteForTollEstimate(
                        exit.googleName,
                        lastTollEndIcGoogleName
                    );

                tollDistanceMeters =
                    tollRoute.distanceMeters;
            }

            const estimatedToll =
                Math.round(
                    (tollDistanceMeters / 1000) * 24
                ) +
                shutoToll;

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
                destination
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
                    exit.googleName
                );

            const localFromCandidateRoute =
                await getLocalRouteForMultiExitComparison(
                    exit.googleName,
                    destination
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

            const shutoToll =
                getShutoTollEstimateForIcPair(
                    startIc,
                    exit
                );

            let tollDistanceMeters =
                highwayToCandidateRoute.distanceMeters;

            if (
                lastTollStartIcGoogleName &&
                exit.googleName !== lastTollStartIcGoogleName
            ) {

                const tollRoute =
                    await getHighwayRouteForTollEstimate(
                        lastTollStartIcGoogleName,
                        exit.googleName
                    );

                tollDistanceMeters =
                    tollRoute.distanceMeters;
            }

            const exitTollEstimate =
                Math.round(
                    (tollDistanceMeters / 1000) * 24
                ) +
                shutoToll;

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
                recommendScoreDetail: null
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

    const icAreaReason =
        document.getElementById("icAreaReason");

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

    const highwayStartInfo =
        findNearestIcByMasterCoordinatesForAutoExitComparison(
            icArea,
            originLatLng.lat,
            originLatLng.lng
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
                destinationLatLng.lng
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

    if (icAreaReason) {
        icAreaReason.innerHTML =
            buildPolylineComparisonSummaryHtml(
                lastHighwayRoutePolylineAnalysis
            );
    }

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

    const sortedResults =
        [...results].sort((a, b) =>
            (
                a.minutesToCandidate === null ||
                a.minutesToCandidate === undefined
                    ? Infinity
                    : a.minutesToCandidate
            ) -
            (
                b.minutesToCandidate === null ||
                b.minutesToCandidate === undefined
                    ? Infinity
                    : b.minutesToCandidate
            )
        );

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
        sortedResults
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
        if (!(result.savedToll > 0)) {
            return "savedTollが0以下";
        }
        if (!(result.differenceFromAllHighway > 0)) {
            return "differenceFromAllHighwayが0以下";
        }
        if (
            !(
                result.differenceFromAllHighway <=
                acceptableDelayMinutes
            )
        ) {
            return "遅延時間が許容時間条件超過";
        }
        if (result.yenPerDelayedMinute === null) {
            return "yenPerDelayedMinuteがnull";
        }
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
                !result.error &&
                result.savedToll > 0 &&
                result.differenceFromAllHighway > 0 &&
                result.differenceFromAllHighway <=
                    acceptableDelayMinutes &&
                result.yenPerDelayedMinute !== null &&
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
            "<div class=\"v2-exit-main\">取得失敗</div>" +
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
        return "節約なし";
    }

    return "節約なし";
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

    const sortedResults =
        [...results].sort((a, b) =>
            (
                a.minutesToCandidate === null ||
                a.minutesToCandidate === undefined
                    ? Infinity
                    : a.minutesToCandidate
            ) -
            (
                b.minutesToCandidate === null ||
                b.minutesToCandidate === undefined
                    ? Infinity
                    : b.minutesToCandidate
            )
        );

    resultArea.innerHTML =
        buildBestEntranceIcV2Html(results) +
        "<div class=\"v2-ic-result-list\">" +
        sortedResults
            .map(result =>
                buildEntranceIcComparisonV2CardHtml(result)
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
            dashboardStars.textContent = "🚗";
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
                    "<div class=\"v2-best-label\">おすすめ入口なし</div>" +
                    "<div class=\"v2-best-name\">" +
                    escapeHtml(
                        "参考入口 " +
                        (reference.candidateIcName || "--") +
                        "（条件外）"
                    ) +
                    "</div>" +
                    "<div class=\"v2-best-detail\">" +
                    escapeHtml(
                        formatV2SavingText(
                            reference.differenceFromAllLocal
                        )
                    ) +
                    " / " +
                    escapeHtml(
                        reference.yenPerSavedMinute !== null
                            ? reference.yenPerSavedMinute.toLocaleString() +
                            "円/分"
                            : "円/分なし"
                    ) +
                    "<div class=\"v2-reference-note\">" +
                    "※許容条件外" +
                    "</div>" +
                    "</div>" +
                    "</div>"
                    : "この条件では全下道の方がよさそうです";
        }

        if (dashboardValueJudge) {
            dashboardValueJudge.className = "";
            dashboardValueJudge.classList.add("value-good");
            dashboardValueJudge.textContent =
                "有料回避推奨";
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
        dashboardStars.textContent = "🚙";
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
            dashboardStars.textContent = "🚙";
        }

        if (dashboardRecommendation) {
            dashboardRecommendation.textContent =
                "おすすめ出口なし";
        }

        lastRecommendationText =
            "おすすめ出口なし";

        if (dashboardReason) {
            dashboardReason.innerHTML =
                reference
                    ? "<div class=\"v2-best-exit-card reference-candidate\">" +
                    "<div class=\"v2-best-exit-label\">おすすめ出口なし</div>" +
                    "<div class=\"v2-best-exit-name\">" +
                    escapeHtml(
                        "参考出口 " +
                        (reference.candidateIcName || "--") +
                        "（条件外）"
                    ) +
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
                    "<div class=\"v2-reference-note\">" +
                    "※許容遅れ超過" +
                    "</div>" +
                    "</div>" +
                    "</div>"
                    : "この条件では高速継続がよさそうです";
        }

        if (dashboardValueJudge) {
            dashboardValueJudge.className = "";
            dashboardValueJudge.classList.add("value-good");
            dashboardValueJudge.textContent =
                "高速継続推奨";
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
        dashboardStars.textContent = "🚗";
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
            "<div class=\"v2-best-exit-name\">" +
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

    const acceptableDelayMinutes =
        getAcceptableDelayMinutes();

    const isEntranceBelowThreshold =
        !hasError &&
        result.differenceFromAllLocal > 0 &&
        result.differenceFromAllLocal <
            acceptableDelayMinutes;

    const classNames = [
        "v2-ic-result-card",
        hasNoSaving ? "v2-ic-no-saving" : "",
        isEntranceBelowThreshold ? "v2-ic-excluded" : "",
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
            "<div class=\"v2-ic-main\">取得失敗</div>" +
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

    const excludedNote =
        isEntranceBelowThreshold
            ? "<div class=\"v2-ic-excluded-note\">" +
            "短縮不足：許容" +
            acceptableDelayMinutes +
            "分に対して" +
            result.differenceFromAllLocal +
            "分短縮" +
            "</div>"
            : "";

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
        "<br>" +
        yenPerMinuteText +
        "<br>合計" +
        formatV2Duration(result.totalMinutes) +
        excludedNote +
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
        return "解析方式：Polyline解析（解析結果なし）";
    }

    const lines = [];

    const roadNames = [
        ...new Set(
            (polylineAnalysis.roadSequence || [])
                .filter(Boolean)
        )
    ];

    if (roadNames.length > 0) {
        lines.push(
            "想定道路：" + roadNames.join(" → ")
        );
    }

    const entranceNames = [];
    const entranceIdentities = new Set();

    [
        polylineAnalysis.shutoEntranceIc,
        polylineAnalysis.nexcoEntranceIc
    ].forEach(exit => {
        const identity =
            exit?.googleName ||
            (
                exit
                    ? exit.displayName + "|" +
                        exit.lat + "|" + exit.lng
                    : ""
            );

        if (
            !identity ||
            entranceIdentities.has(identity)
        ) {
            return;
        }

        entranceIdentities.add(identity);
        entranceNames.push(exit.displayName);
    });

    if (entranceNames.length > 0) {
        lines.push(
            "通常入口：" + entranceNames.join(" → ")
        );
    }

    const normalExit =
        polylineAnalysis.nexcoExitIc ||
        polylineAnalysis.exitIc;

    if (normalExit?.displayName) {
        lines.push(
            "通常出口：" + normalExit.displayName
        );
    }

    if (lines.length === 0) {
        lines.push("解析方式：Polyline解析");
    }

    return lines
        .map(line =>
            "<div>" + escapeHtml(line) + "</div>"
        )
        .join("");
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

    if (icAreaReason) {
        icAreaReason.innerHTML =
            buildPolylineComparisonSummaryHtml(
                lastHighwayRoutePolylineAnalysis
            );
    }

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

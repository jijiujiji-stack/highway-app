const USE_DISTANCE_ONLY_IC_AREA = true;

const IC_MASTER = {
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
                order: 10,
                displayName: "岩間IC",
                googleName: "常磐自動車道 岩間インターチェンジ",
                lat: 36.300,
                lng: 140.306
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
                order: 13,
                displayName: "那珂IC",
                googleName: "常磐自動車道 那珂インターチェンジ",
                lat: 36.486,
                lng: 140.472
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
            { order: 11, displayName: "本庄児玉IC", googleName: "関越自動車道 本庄児玉インターチェンジ", lat: 36.223, lng: 139.152 },
            { order: 12, displayName: "高崎玉村SIC", googleName: "関越自動車道 高崎玉村スマートインターチェンジ", lat: 36.284, lng: 139.101 },
            { order: 13, displayName: "高崎IC", googleName: "関越自動車道 高崎インターチェンジ", lat: 36.308, lng: 139.063 },
            { order: 14, displayName: "前橋IC", googleName: "関越自動車道 前橋インターチェンジ", lat: 36.384, lng: 139.055 },
            { order: 15, displayName: "駒寄SIC", googleName: "関越自動車道 駒寄スマートインターチェンジ", lat: 36.441, lng: 139.010 },
            { order: 16, displayName: "渋川伊香保IC", googleName: "関越自動車道 渋川伊香保インターチェンジ", lat: 36.493, lng: 139.007 },
            { order: 17, displayName: "赤城IC", googleName: "関越自動車道 赤城インターチェンジ", lat: 36.558, lng: 139.069 },
            { order: 18, displayName: "昭和IC", googleName: "関越自動車道 昭和インターチェンジ", lat: 36.634, lng: 139.101 },
            { order: 19, displayName: "沼田IC", googleName: "関越自動車道 沼田インターチェンジ", lat: 36.663, lng: 139.036 },
            { order: 20, displayName: "月夜野IC", googleName: "関越自動車道 月夜野インターチェンジ", lat: 36.748, lng: 138.988 },
            { order: 21, displayName: "水上IC", googleName: "関越自動車道 水上インターチェンジ", lat: 36.801, lng: 138.964 }
        ]
    },

    joshinetsu: {
        label: "上信越道方面",
        exits: [
            { order: 1, displayName: "藤岡IC", googleName: "上信越自動車道 藤岡インターチェンジ", lat: 36.269, lng: 139.074 },
            { order: 2, displayName: "吉井IC", googleName: "上信越自動車道 吉井インターチェンジ", lat: 36.250, lng: 138.986 },
            { order: 3, displayName: "富岡IC", googleName: "上信越自動車道 富岡インターチェンジ", lat: 36.250, lng: 138.891 },
            { order: 4, displayName: "下仁田IC", googleName: "上信越自動車道 下仁田インターチェンジ", lat: 36.210, lng: 138.774 },
            { order: 5, displayName: "松井田妙義IC", googleName: "上信越自動車道 松井田妙義インターチェンジ", lat: 36.309, lng: 138.733 },
            { order: 6, displayName: "碓氷軽井沢IC", googleName: "上信越自動車道 碓氷軽井沢インターチェンジ", lat: 36.338, lng: 138.640 },
            { order: 7, displayName: "佐久IC", googleName: "上信越自動車道 佐久インターチェンジ", lat: 36.269, lng: 138.476 }
        ]
    },


    chuo: {
        label: "中央道方面",
        exits: [
            { order: 1, displayName: "高井戸IC", googleName: "中央自動車道 高井戸インターチェンジ", lat: 35.684, lng: 139.611 },
            { order: 2, displayName: "調布IC", googleName: "中央自動車道 調布インターチェンジ", lat: 35.650, lng: 139.536 },
            { order: 3, displayName: "稲城IC", googleName: "中央自動車道 稲城インターチェンジ", lat: 35.638, lng: 139.510 },
            { order: 4, displayName: "国立府中IC", googleName: "中央自動車道 国立府中インターチェンジ", lat: 35.668, lng: 139.457 },
            { order: 5, displayName: "八王子IC", googleName: "中央自動車道 八王子インターチェンジ", lat: 35.657, lng: 139.335 },
            { order: 6, displayName: "相模湖IC", googleName: "中央自動車道 相模湖インターチェンジ", lat: 35.616, lng: 139.190 },
            { order: 7, displayName: "上野原IC", googleName: "中央自動車道 上野原インターチェンジ", lat: 35.631, lng: 139.109 },
            { order: 8, displayName: "大月IC", googleName: "中央自動車道 大月インターチェンジ", lat: 35.616, lng: 138.949 },
            { order: 9, displayName: "勝沼IC", googleName: "中央自動車道 勝沼インターチェンジ", lat: 35.686, lng: 138.739 },
            { order: 10, displayName: "一宮御坂IC", googleName: "中央自動車道 一宮御坂インターチェンジ", lat: 35.657, lng: 138.688 },
            { order: 11, displayName: "甲府昭和IC", googleName: "中央自動車道 甲府昭和インターチェンジ", lat: 35.627, lng: 138.553 },
            { order: 12, displayName: "双葉SIC", googleName: "中央自動車道 双葉スマートインターチェンジ", lat: 35.705, lng: 138.503 },
            { order: 13, displayName: "韮崎IC", googleName: "中央自動車道 韮崎インターチェンジ", lat: 35.718, lng: 138.445 },
            { order: 14, displayName: "須玉IC", googleName: "中央自動車道 須玉インターチェンジ", lat: 35.795, lng: 138.406 },
            { order: 15, displayName: "長坂IC", googleName: "中央自動車道 長坂インターチェンジ", lat: 35.841, lng: 138.366 },
            { order: 16, displayName: "小淵沢IC", googleName: "中央自動車道 小淵沢インターチェンジ", lat: 35.888, lng: 138.316 },
            { order: 17, displayName: "諏訪南IC", googleName: "中央自動車道 諏訪南インターチェンジ", lat: 35.973, lng: 138.232 },
            { order: 18, displayName: "諏訪IC", googleName: "中央自動車道 諏訪インターチェンジ", lat: 36.031, lng: 138.114 },
            { order: 19, displayName: "岡谷IC", googleName: "長野自動車道 岡谷インターチェンジ", lat: 36.056, lng: 138.050 },
            { order: 20, displayName: "塩尻IC", googleName: "長野自動車道 塩尻インターチェンジ", lat: 36.093, lng: 137.963 },
            { order: 21, displayName: "松本IC", googleName: "長野自動車道 松本インターチェンジ", lat: 36.219, lng: 137.940 },
            { order: 22, displayName: "安曇野IC", googleName: "長野自動車道 安曇野インターチェンジ", lat: 36.300, lng: 137.898 }
        ]
    },


    tomei: {
        label: "東名道方面",
        exits: [
            { order: 1, displayName: "東京IC", googleName: "東名高速道路 東京インターチェンジ", lat: 35.625, lng: 139.632 },
            { order: 2, displayName: "東名川崎IC", googleName: "東名高速道路 東名川崎インターチェンジ", lat: 35.589, lng: 139.587 },
            { order: 3, displayName: "横浜青葉IC", googleName: "東名高速道路 横浜青葉インターチェンジ", lat: 35.542, lng: 139.537 },
            { order: 4, displayName: "横浜町田IC", googleName: "東名高速道路 横浜町田インターチェンジ", lat: 35.513, lng: 139.474 },
            { order: 5, displayName: "綾瀬SIC", googleName: "東名高速道路 綾瀬スマートインターチェンジ", lat: 35.436, lng: 139.429 },
            { order: 6, displayName: "厚木IC", googleName: "東名高速道路 厚木インターチェンジ", lat: 35.417, lng: 139.364 },
            { order: 7, displayName: "秦野中井IC", googleName: "東名高速道路 秦野中井インターチェンジ", lat: 35.374, lng: 139.214 },
            { order: 8, displayName: "大井松田IC", googleName: "東名高速道路 大井松田インターチェンジ", lat: 35.344, lng: 139.152 },
            { order: 9, displayName: "御殿場IC", googleName: "東名高速道路 御殿場インターチェンジ", lat: 35.300, lng: 138.934 },
            { order: 10, displayName: "裾野IC", googleName: "東名高速道路 裾野インターチェンジ", lat: 35.190, lng: 138.909 },
            { order: 11, displayName: "沼津IC", googleName: "東名高速道路 沼津インターチェンジ", lat: 35.156, lng: 138.860 },
            { order: 12, displayName: "富士IC", googleName: "東名高速道路 富士インターチェンジ", lat: 35.180, lng: 138.671 },
            { order: 13, displayName: "清水IC", googleName: "東名高速道路 清水インターチェンジ", lat: 35.037, lng: 138.477 },
            { order: 14, displayName: "静岡IC", googleName: "東名高速道路 静岡インターチェンジ", lat: 34.944, lng: 138.395 },
            { order: 15, displayName: "焼津IC", googleName: "東名高速道路 焼津インターチェンジ", lat: 34.861, lng: 138.302 },
            { order: 16, displayName: "吉田IC", googleName: "東名高速道路 吉田インターチェンジ", lat: 34.781, lng: 138.252 },
            { order: 17, displayName: "相良牧之原IC", googleName: "東名高速道路 相良牧之原インターチェンジ", lat: 34.735, lng: 138.179 },
            { order: 18, displayName: "菊川IC", googleName: "東名高速道路 菊川インターチェンジ", lat: 34.748, lng: 138.086 },
            { order: 19, displayName: "掛川IC", googleName: "東名高速道路 掛川インターチェンジ", lat: 34.754, lng: 137.999 },
            { order: 20, displayName: "袋井IC", googleName: "東名高速道路 袋井インターチェンジ", lat: 34.749, lng: 137.908 },
            { order: 21, displayName: "磐田IC", googleName: "東名高速道路 磐田インターチェンジ", lat: 34.783, lng: 137.823 },
            { order: 22, displayName: "浜松IC", googleName: "東名高速道路 浜松インターチェンジ", lat: 34.758, lng: 137.773 }
        ]
    },



    aqualine: {
        label: "アクアライン方面",
        exits: [
            {
                order: 1,
                displayName: "浮島IC",
                googleName: "首都高速湾岸線 浮島インターチェンジ",
                lat: 35.521,
                lng: 139.788
            },
            {
                order: 2,
                displayName: "海ほたるPA",
                googleName: "東京湾アクアライン 海ほたるパーキングエリア",
                lat: 35.463,
                lng: 139.875
            },
            {
                order: 3,
                displayName: "木更津金田IC",
                googleName: "東京湾アクアライン 木更津金田インターチェンジ",
                lat: 35.435,
                lng: 139.921
            },
            {
                order: 4,
                displayName: "袖ケ浦IC",
                googleName: "東京湾アクアライン連絡道 袖ケ浦インターチェンジ",
                lat: 35.418,
                lng: 139.980
            }
        ]
    },




    tateyama: {
        label: "館山道方面",
        exits: [
            {
                order: 1,
                displayName: "市原IC",
                googleName: "館山自動車道 市原インターチェンジ",
                lat: 35.498,
                lng: 140.104
            },
            {
                order: 2,
                displayName: "姉崎袖ケ浦IC",
                googleName: "館山自動車道 姉崎袖ケ浦インターチェンジ",
                lat: 35.432,
                lng: 140.043
            },
            {
                order: 3,
                displayName: "木更津北IC",
                googleName: "館山自動車道 木更津北インターチェンジ",
                lat: 35.394,
                lng: 139.967
            },
            {
                order: 4,
                displayName: "木更津南IC",
                googleName: "館山自動車道 木更津南インターチェンジ",
                lat: 35.365,
                lng: 139.935
            },
            {
                order: 5,
                displayName: "君津IC",
                googleName: "館山自動車道 君津インターチェンジ",
                lat: 35.333,
                lng: 139.902
            },
            {
                order: 6,
                displayName: "富津中央IC",
                googleName: "館山自動車道 富津中央インターチェンジ",
                lat: 35.273,
                lng: 139.855
            },
            {
                order: 7,
                displayName: "富津竹岡IC",
                googleName: "富津館山道路 富津竹岡インターチェンジ",
                lat: 35.204,
                lng: 139.825
            },
            {
                order: 8,
                displayName: "鋸南保田IC",
                googleName: "富津館山道路 鋸南保田インターチェンジ",
                lat: 35.140,
                lng: 139.827
            },
            {
                order: 9,
                displayName: "富浦IC",
                googleName: "富津館山道路 富浦インターチェンジ",
                lat: 35.034,
                lng: 139.832
            }
        ]
    },





    keiyo: {
        label: "京葉道路方面",
        exits: [
            {
                order: 1,
                displayName: "篠崎IC",
                googleName: "京葉道路 篠崎インターチェンジ",
                lat: 35.707,
                lng: 139.898
            },
            {
                order: 2,
                displayName: "京葉市川IC",
                googleName: "京葉道路 京葉市川インターチェンジ",
                lat: 35.715,
                lng: 139.931
            },
            {
                order: 3,
                displayName: "原木IC",
                googleName: "京葉道路 原木インターチェンジ",
                lat: 35.704,
                lng: 139.959
            },
            {
                order: 4,
                displayName: "船橋IC",
                googleName: "京葉道路 船橋インターチェンジ",
                lat: 35.693,
                lng: 139.990
            },
            {
                order: 5,
                displayName: "花輪IC",
                googleName: "京葉道路 花輪インターチェンジ",
                lat: 35.689,
                lng: 140.015
            },
            {
                order: 6,
                displayName: "武石IC",
                googleName: "京葉道路 武石インターチェンジ",
                lat: 35.675,
                lng: 140.061
            },
            {
                order: 7,
                displayName: "穴川IC",
                googleName: "京葉道路 穴川インターチェンジ",
                lat: 35.644,
                lng: 140.119
            },
            {
                order: 8,
                displayName: "貝塚IC",
                googleName: "京葉道路 貝塚インターチェンジ",
                lat: 35.625,
                lng: 140.150
            },
            {
                order: 9,
                displayName: "松ヶ丘IC",
                googleName: "京葉道路 松ヶ丘インターチェンジ",
                lat: 35.583,
                lng: 140.158
            },
            {
                order: 10,
                displayName: "蘇我IC",
                googleName: "京葉道路 蘇我インターチェンジ",
                lat: 35.568,
                lng: 140.158
            }
        ]
    },



    tokan: {
        label: "東関東道方面",
        exits: [
            {
                order: 1,
                displayName: "湾岸習志野IC",
                googleName: "東関東自動車道 湾岸習志野インターチェンジ",
                lat: 35.665,
                lng: 140.016
            },
            {
                order: 2,
                displayName: "湾岸千葉IC",
                googleName: "東関東自動車道 湾岸千葉インターチェンジ",
                lat: 35.638,
                lng: 140.060
            },
            {
                order: 3,
                displayName: "千葉北IC",
                googleName: "東関東自動車道 千葉北インターチェンジ",
                lat: 35.676,
                lng: 140.131
            },
            {
                order: 4,
                displayName: "四街道IC",
                googleName: "東関東自動車道 四街道インターチェンジ",
                lat: 35.664,
                lng: 140.187
            },
            {
                order: 5,
                displayName: "佐倉IC",
                googleName: "東関東自動車道 佐倉インターチェンジ",
                lat: 35.694,
                lng: 140.248
            },
            {
                order: 6,
                displayName: "酒々井IC",
                googleName: "東関東自動車道 酒々井インターチェンジ",
                lat: 35.718,
                lng: 140.300
            },
            {
                order: 7,
                displayName: "富里IC",
                googleName: "東関東自動車道 富里インターチェンジ",
                lat: 35.729,
                lng: 140.343
            },
            {
                order: 8,
                displayName: "成田IC",
                googleName: "東関東自動車道 成田インターチェンジ",
                lat: 35.779,
                lng: 140.365
            },
            {
                order: 9,
                displayName: "大栄IC",
                googleName: "東関東自動車道 大栄インターチェンジ",
                lat: 35.842,
                lng: 140.470
            },
            {
                order: 10,
                displayName: "佐原香取IC",
                googleName: "東関東自動車道 佐原香取インターチェンジ",
                lat: 35.884,
                lng: 140.548
            },
            {
                order: 11,
                displayName: "潮来IC",
                googleName: "東関東自動車道 潮来インターチェンジ",
                lat: 35.952,
                lng: 140.574
            }
        ]
    }



};

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

let lastSearchLatitude = null;
let lastSearchLongitude = null;

let lastSearchTime = null;

let lastSearchLocationName = "";

let lastNearestIcName = "";
let lastNearestIcDistanceKm = null;

let lastTollStartIcName = "";
let lastTollStartIcGoogleName = "";
let lastTollStartIcOrder = null;
let lastTollEndIcName = "";
let lastTollEndIcGoogleName = "";
let lastTollEndIcOrder = null;


let lastGpsReceivedTime = null;

let gpsErrorBlinkShown = false;

let lastRecommendationText = "";
let lastIcAreaDecisionType = "";

let lastSearchMode = "";
let lastLocalRouteMinutes = null;

let invalidIcResults = [];

let isAutoUpdateEnabled = true;
let currentMultiIcMode = "entrance";
let lastMultiIcV2Results = [];
let lastExitIcV2Results = [];

const TEST_ORIGIN = "荒川区役所";

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
    { area: "tateyama", name: "道の駅保田小学校" },
    { area: "tateyama", name: "鴨川シーワールド" },
    { area: "aqualine", name: "木更津アウトレット" },
    { area: "aqualine", name: "養老渓谷" }
];




console.log("高速・下道コスパナビ起動");

window.addEventListener("load", () => {

    loadGoogleMaps();

    getCurrentLocation(true);

    startGpsUpdate();

    document
        .getElementById("searchButton")
        .addEventListener("click", searchRoute);

    initializeAutoUpdateToggle();
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

            clearDestinationButton.style.display =
                this.value.trim()
                    ? "block"
                    : "none";
        }
    );

    originInput.addEventListener(
        "input",
        function () {

            clearOriginButton.style.display =
                this.value.trim()
                    ? "block"
                    : "none";
        }
    );

    clearDestinationButton.addEventListener(
        "click",
        function () {

            destinationInput.value = "";

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

            originInput.value = "";

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
            searchAutoExitIcComparison
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
        "2km移動 または 3分経過";




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

    new google.maps.places.Autocomplete(
        originInput,
        {
            componentRestrictions: { country: "jp" }
        }
    );

    new google.maps.places.Autocomplete(
        destinationInput,
        {
            componentRestrictions: { country: "jp" }
        }
    );

    console.log("Autocomplete 初期化完了");
}

async function searchRoute() {

    const origin =
        document.getElementById("origin").value;

    const destination =
        document.getElementById("destination").value;

    document
        .getElementById("dashboardDestination")
        .textContent =
        shortenDestinationName(destination);

    if (!origin || !destination) {

        alert("出発地と目的地を入力してください");
        return;
    }

    updateSearchMode("searchButton");

    resetMultiExitIcResult();


    console.log("検索開始");
    console.log("出発地:", origin);
    console.log("目的地:", destination);

    try {

        document.getElementById("highwayTime").textContent =
            "検索中...";

        document.getElementById("localTime").textContent =
            "検索中...";

        await getRoutes(origin, destination);

        document
            .getElementById("lastRouteSearchTime")
            .textContent =
            new Date().toLocaleTimeString("ja-JP");

        closeSearchPanel();

        scrollToTopPanel();


    } catch (error) {

        console.error(error);

        alert(
            "ルート取得エラー\n\n" +
            error.message
        );
    }
}

async function getRoutes(
    origin,
    destination,
    suppressDashboardSummary = false
) {

    const [highwayRoute, localRoute] =
        await Promise.all([
            getHighwayRoute(origin, destination),
            getLocalRoute(origin, destination)
        ]);

    await displayRouteComparison(
        highwayRoute,
        localRoute,
        suppressDashboardSummary,
        origin,
        destination
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
    destination
) {

    const response = await fetch(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key":
                    CONFIG.GOOGLE_MAPS_API_KEY,

                "X-Goog-FieldMask":
                    "routes.duration,routes.distanceMeters,routes.travelAdvisory.tollInfo"
            },

            body: JSON.stringify({

                origin: {
                    address: origin
                },

                destination: {
                    address: destination
                },

                travelMode: "DRIVE",

                routingPreference:
                    "TRAFFIC_AWARE",

                extraComputations: [
                    "TOLLS"]
            })
        }
    );

    const data =
        await response.json();

    console.log(
        "高速ルート詳細",
        JSON.stringify(data, null, 2)
    );

    if (
        !data.routes ||
        data.routes.length === 0
    ) {
        throw new Error(
            "高速ルートが見つかりません：" +
            origin +
            " → " +
            destination
        );
    }


    return data.routes[0];
}

async function getLocalRoute(
    origin,
    destination
) {

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

                origin: {
                    address: origin
                },

                destination: {
                    address: destination
                },

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
            "下道ルートが見つかりません：" +
            origin +
            " → " +
            destination
        );
    }

    return data.routes[0];
}

async function displayRouteComparison(
    highway,
    local,
    suppressDashboardSummary = false,
    origin = "",
    destination = ""
) {

    setDashboardInfoLabels(
        "効率率",
        "単価"
    );
    setDashboardV2EntranceMode(false);
    setDashboardV2ExitMode(false);

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

    const tollEstimate =
        await estimateMainHighwayToll(
            highway,
            origin,
            destination
        );

    const estimatedToll =
        tollEstimate.amount;

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
        "概算ETC料金：" +
        estimatedToll.toLocaleString() +
        " 円（参考値）";

    document
        .getElementById("costPerMinute")
        .textContent =
        costPerMinute +
        " 円/分";

    let valueJudge =
        "料金を払う価値：低い";

    if (costPerMinute <= 20) {
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

    document
        .getElementById("valueJudge")
        .textContent =
        valueJudge;

    document
        .getElementById("dashboardHighway")
        .textContent =
        formatMinutes(
            highwayMinutes
        );

    document
        .getElementById("dashboardLocal")
        .textContent =
        formatMinutes(
            localMinutes
        );

    updateDashboardTimeColors(
        highwayMinutes,
        localMinutes
    );

    document
        .getElementById("dashboardEfficiency")
        .textContent =
        efficiencyRate;

    if (!suppressDashboardSummary) {
        document
            .getElementById("dashboardCost")
            .textContent =
            costPerMinute + "円/分";
    }

    document
        .getElementById("dashboardHighwayDetail")
        .innerHTML =
        "距離：" +
        highwayKm +
        "km / ETC概算：約" +
        estimatedToll.toLocaleString() +
        "円<br>" +
        tollEstimate.label;

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

        if (
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


async function estimateMainHighwayToll(
    highwayRoute,
    origin,
    destination
) {

    const fallbackKm =
        highwayRoute.distanceMeters / 1000;

    const fallbackAmount =
        Math.round(
            fallbackKm * 24
        );

    const fallbackResult = {
        amount: fallbackAmount,
        label: "料金計算：ルート総距離ベース"
    };

    try {

        if (!destination) {
            return fallbackResult;
        }

        const autoIcAreaEnabled =
            document.getElementById(
                "autoIcAreaEnabled"
            )?.checked;

        let icArea =
            document.getElementById("icArea")?.value;

        if (autoIcAreaEnabled) {

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
            !icArea ||
            !IC_MASTER[icArea]
        ) {
            return fallbackResult;
        }

        let startIc = null;

        if (origin) {

            startIc =
                await findNearestIcInfoByAddress(
                    origin,
                    icArea
                );

        }
        else if (
            currentLatitude !== null &&
            currentLongitude !== null
        ) {

            startIc =
                await findNearestIcInfoByPoint(
                    icArea,
                    currentLatitude,
                    currentLongitude
                );
        }

        const endIc =
            await findNearestIcInfoByAddress(
                destination,
                icArea
            );

        if (
            !startIc ||
            !endIc ||
            !startIc.googleName ||
            !endIc.googleName
        ) {
            return fallbackResult;
        }

        lastTollStartIcName =
            startIc.displayName;

        lastTollStartIcGoogleName =
            startIc.googleName;

        lastTollStartIcOrder =
            startIc.order;

        lastTollEndIcName =
            endIc.displayName;

        lastTollEndIcGoogleName =
            endIc.googleName;

        lastTollEndIcOrder =
            endIc.order;

        if (
            startIc.googleName === endIc.googleName
        ) {
            return {
                amount: 0,
                label:
                    "料金計算：" +
                    startIc.displayName +
                    "→" +
                    endIc.displayName
            };
        }

        const tollRoute =
            await getHighwayRoute(
                startIc.googleName,
                endIc.googleName
            );

        const tollKm =
            tollRoute.distanceMeters / 1000;

        return {
            amount:
                Math.round(
                    tollKm * 24
                ),
            label:
                "料金計算：" +
                startIc.displayName +
                "→" +
                endIc.displayName
        };

    } catch (error) {

        console.warn(
            "IC間料金計算に失敗。従来計算に戻します。",
            error
        );

        return fallbackResult;
    }
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
        document
            .getElementById(
                "destination"
            )
            .value;

    document
        .getElementById("dashboardDestination")
        .textContent =
        shortenDestinationName(destination);

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


    try {

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
                    destination
                ),

                getLocalRouteFromGps(
                    destination
                )

            ]);

        await displayRouteComparison(
            highwayRoute,
            localRoute,
            suppressDashboardSummary,
            "",
            destination
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
            scrollToTopPanel();
        }


    } catch (error) {

        console.error(error);

        setDataUpdateStatus(
            "更新失敗",
            "data-update-error"
        );



    }

}

async function getHighwayRouteFromGps(
    destination
) {

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
                        "routes.duration,routes.distanceMeters,routes.travelAdvisory.tollInfo"

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

                    destination: {
                        address:
                            destination
                    },

                    travelMode:
                        "DRIVE",

                    routingPreference:
                        "TRAFFIC_AWARE",

                    extraComputations: [
                        "TOLLS"
                    ]

                })

            }
        );

    const data =
        await response.json();

    console.log(
        "GPS高速ルート",
        JSON.stringify(data, null, 2)
    );

    if (
        !data.routes ||
        data.routes.length === 0
    ) {
        throw new Error(
            "高速ルートが見つかりません：" +
            destination
        );
    }

    return data.routes[0];
}

async function getLocalRouteFromGps(
    destination
) {

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

                    destination: {
                        address:
                            destination
                    },

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

    console.log(
        "GPS下道ルート",
        JSON.stringify(data, null, 2)
    );

    if (
        !data.routes ||
        data.routes.length === 0
    ) {
        throw new Error(
            "GPS下道ルートが見つかりません：" +
            destination
        );
    }

    return data.routes[0];

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
                exit.lng !== undefined
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


function checkAutoReSearch() {

    if (!isAutoUpdateEnabled) {
        renderAutoUpdateStatus();
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

    const remainingDistance =
        Math.max(
            0,
            2000 - Math.round(distance)
        );

    const remainingSeconds =
        Math.max(
            0,
            180 - Math.round(elapsedSeconds)
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
        formatCountdownSeconds(displaySeconds);

    const displayDistanceText =
        (remainingDistance / 1000).toFixed(1) + "km";

    setDataUpdateStatus(
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
        distance >= 2000 ||
        elapsedSeconds >= 180
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

        if (
            lastSearchMode === "autoExitIcCompareButton" ||
            document.getElementById("autoCompareEnabled")?.checked
        ) {

            console.log(
                "[AUTO DEBUG]",
                "候補IC自動比較ルートへ"
            );

            searchAutoExitIcComparison(false);
        }
        else {

            console.log(
                "[AUTO DEBUG]",
                "現在地から再検索ルートへ"
            );

            searchFromCurrentLocation(false);
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

    let name = text
        .replace("日本、", "")
        .replace(/〒\d{3}-\d{4}\s*/, "");

    const parts =
        name.split(" ");

    return parts[parts.length - 1];
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
                exit.lng !== undefined
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
        distanceKm: Math.round(nearestDistance / 1000)
    };
}

function selectExitCandidatesForAutoExitComparison(
    icArea,
    highwayStart,
    destinationNearestIc,
    maxCount = 7
) {

    if (!highwayStart) {
        return [];
    }

    const startOrder =
        highwayStart.order ?? null;

    const destinationOrder =
        destinationNearestIc?.order ?? null;

    const isForwardDirection =
        destinationOrder === null ||
        destinationOrder > startOrder;

    return IC_MASTER[icArea].exits
        .slice()
        .sort((a, b) =>
            isForwardDirection
                ? (a.order ?? 999) - (b.order ?? 999)
                : (b.order ?? -999) - (a.order ?? -999)
        )
        .filter(exit =>
            exit.googleName !== highwayStart.googleName &&
            startOrder !== null &&
            exit.order !== undefined &&
            (
                isForwardDirection
                    ? exit.order > startOrder
                    : exit.order < startOrder
            )
        )
        .slice(0, maxCount);
}

async function getHighwayRouteForMultiExitComparison(
    origin,
    destination
) {

    const response = await fetch(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key":
                    CONFIG.GOOGLE_MAPS_API_KEY,

                "X-Goog-FieldMask":
                    "routes.duration,routes.distanceMeters,routes.travelAdvisory.tollInfo"
            },

            body: JSON.stringify({

                origin:
                    buildRoutesLocationForIcOrAddress(origin),

                destination:
                    buildRoutesLocationForIcOrAddress(destination),

                travelMode: "DRIVE",

                routingPreference:
                    "TRAFFIC_AWARE",

                extraComputations: [
                    "TOLLS"]
            })
        }
    );

    const data =
        await response.json();

    console.log(
        "multi exit highway route detail",
        JSON.stringify(data, null, 2)
    );

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

    return data.routes[0];
}

async function getLocalRouteForMultiExitComparison(
    origin,
    destination
) {

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

    return data.routes[0];
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
                await getHighwayRouteForMultiExitComparison(
                    lastTollStartIcGoogleName,
                    lastTollEndIcGoogleName
                );

            keepHighwayToll =
                Math.round(
                    (keepHighwayTollRoute.distanceMeters / 1000) * 24
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
                        await getHighwayRouteForMultiExitComparison(
                            lastTollStartIcGoogleName,
                            exitIc
                        );

                    estimatedTollKm =
                        exitIcTollRoute.distanceMeters / 1000;

                    estimatedToll =
                        Math.round(
                            estimatedTollKm * 24
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
    let allLocalError = null;

    try {

        const allLocalRoute =
            await getLocalRouteForMultiExitComparison(
                routeOrigin,
                destination
            );

        allLocalMinutes =
            getRouteDurationMinutes(allLocalRoute);

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

            const estimatedToll =
                Math.round(
                    (
                        highwayFromCandidateRoute.distanceMeters /
                        1000
                    ) * 24
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
                estimatedToll: estimatedToll,
                allLocalMinutes: allLocalMinutes,
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
                estimatedToll: null,
                allLocalMinutes: allLocalMinutes,
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

    console.log(
        "複数IC比較V2 entrance results",
        lastMultiIcV2Results
    );

    console.table(lastMultiIcV2Results);

    displayEntranceIcComparisonV2Results(
        lastMultiIcV2Results
    );

    updateDashboardWithBestEntranceIcV2();
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

            const exitTollEstimate =
                Math.round(
                    (
                        highwayToCandidateRoute.distanceMeters /
                        1000
                    ) * 24
                );

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
                minutesToCandidate:
                    highwayToCandidateMinutes,
                allHighwayMinutes: allHighwayMinutes,
                allHighwayToll: allHighwayToll,
                exitTollEstimate: exitTollEstimate,
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
                minutesToCandidate: null,
                allHighwayMinutes: allHighwayMinutes,
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

    console.log(
        "複数IC比較V2 exit results",
        lastExitIcV2Results
    );

    console.table(lastExitIcV2Results);

    displayExitIcComparisonV2Results(
        lastExitIcV2Results
    );

    updateDashboardWithBestExitIcV2();
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

    resultArea.innerHTML =
        buildBestExitIcV2Html(results) +
        "<div class=\"v2-exit-result-list\">" +
        sortedResults
            .map(result =>
                buildExitIcComparisonV2CardHtml(result)
            )
            .join("") +
        "</div>";
}

function getBestExitIcV2(results) {

    if (!Array.isArray(results)) {
        return null;
    }

    const acceptableDelayMinutes =
        getAcceptableDelayMinutes();

    const candidates =
        results
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
        "<div class=\"v2-best-exit-main\">" +
        "あと" +
        best.minutesToCandidate +
        "分" +
        "</div>" +
        "<div class=\"v2-best-exit-detail\">" +
        best.savedToll.toLocaleString() +
        "円節約" +
        "<br>" +
        best.differenceFromAllHighway +
        "分遅い" +
        "<br>" +
        best.yenPerDelayedMinute.toLocaleString() +
        "円/分" +
        "<br>合計" +
        formatV2Duration(best.totalMinutes) +
        "<br>おすすめ度 " +
        Math.round(best.recommendScore) +
        "点" +
        "</div>" +
        "</div>"
    );
}

function buildExitIcComparisonV2CardHtml(result) {

    const hasError = Boolean(result.error);

    const hasNoSaving =
        !hasError &&
        result.savedToll !== null &&
        result.savedToll <= 0;

    const classNames = [
        "v2-exit-result-card",
        hasNoSaving ? "v2-exit-no-saving" : "",
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

    return (
        "<div class=\"" + classNames + "\">" +
        "<div class=\"v2-exit-name\">" +
        icName +
        "</div>" +
        "<div class=\"v2-exit-main\">" +
        "あと" +
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

    const acceptableDelayMinutes =
        getAcceptableDelayMinutes();

    const candidates =
        results
            .filter(result =>
                !result.error &&
                result.differenceFromAllLocal > 0 &&
                result.differenceFromAllLocal >=
                    acceptableDelayMinutes &&
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
        "<div class=\"v2-best-main\">" +
        "あと" +
        best.minutesToCandidate +
        "分" +
        "</div>" +
        "<div class=\"v2-best-detail\">" +
        best.differenceFromAllLocal +
        "分短縮" +
        "<br>ETC 約" +
        best.estimatedToll.toLocaleString() +
        "円" +
        "<br>" +
        best.yenPerSavedMinute.toLocaleString() +
        "円/分" +
        "<br>合計" +
        formatV2Duration(best.totalMinutes) +
        "<br>おすすめ度 " +
        Math.round(best.recommendScore) +
        "点" +
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
    setDashboardV2EntranceMode(Boolean(best));
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
            dashboardReason.textContent =
                "この条件では全下道の方がよさそうです";
        }

        if (dashboardValueJudge) {
            dashboardValueJudge.className = "";
            dashboardValueJudge.classList.add("value-good");
            dashboardValueJudge.textContent =
                "有料回避推奨";
        }

        if (dashboardHighway) {
            dashboardHighway.textContent = "--";
        }

        if (dashboardHighwayDetail) {
            dashboardHighwayDetail.textContent =
                "おすすめ入口なし";
        }

        if (dashboardLocal) {
            dashboardLocal.textContent =
                allLocalMinutes === null
                    ? "全下道--"
                    : formatV2Duration(allLocalMinutes);
        }

        if (dashboardLocalDetail) {
            dashboardLocalDetail.textContent =
                "比較基準";
        }

        if (dashboardEfficiency) {
            dashboardEfficiency.textContent = "--";
        }

        if (dashboardCost) {
            dashboardCost.textContent = "有料回避";
        }

        return;
    }

    if (dashboardStars) {
        dashboardStars.textContent = "🚙";
    }

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
            "<div class=\"v2-best-time-badge\">" +
            "<span class=\"v2-best-time-icon\">◷</span>" +
            "<span class=\"v2-best-time-text\">あと" +
            best.minutesToCandidate +
            "分</span>" +
            "</div>" +
            "<div class=\"v2-best-detail\">" +
            escapeHtml(
                best.differenceFromAllLocal +
                "分短縮"
            ) +
            "<br>" +
            escapeHtml(
                "ETC 約" +
                best.estimatedToll.toLocaleString() +
                "円"
            ) +
            "</div>" +
            "</div>";
    }

    if (dashboardValueJudge) {
        dashboardValueJudge.className = "";
        dashboardValueJudge.classList.add(
            "v2-best-yenpm-badge"
        );
        dashboardValueJudge.textContent =
            best.yenPerSavedMinute.toLocaleString() +
            "円/分";
    }

    if (dashboardHighway) {
        dashboardHighway.textContent =
            formatV2Duration(best.totalMinutes);
    }

    if (dashboardHighwayDetail) {
        dashboardHighwayDetail.textContent =
            "候補ICから高速利用";
    }

    if (dashboardLocal) {
        dashboardLocal.textContent =
            best.allLocalMinutes === null
                ? "全下道--"
                : formatV2Duration(best.allLocalMinutes);
    }

    if (dashboardLocalDetail) {
        dashboardLocalDetail.textContent =
            "比較基準";
    }

    if (dashboardEfficiency) {
        dashboardEfficiency.textContent =
            best.differenceFromAllLocal + "分短縮";
    }

    if (dashboardCost) {
        dashboardCost.textContent =
            best.estimatedToll.toLocaleString() + "円";
    }
}

function updateDashboardWithBestExitIcV2() {

    const best =
        getBestExitIcV2(lastExitIcV2Results);

    setDashboardInfoLabels(
        "節約額",
        "到着差"
    );
    setDashboardV2EntranceMode(false);
    setDashboardV2ExitMode(Boolean(best));

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
            dashboardReason.textContent =
                "この条件では高速継続がよさそうです";
        }

        if (dashboardValueJudge) {
            dashboardValueJudge.className = "";
            dashboardValueJudge.classList.add("value-good");
            dashboardValueJudge.textContent =
                "高速継続推奨";
        }

        if (dashboardHighway) {
            dashboardHighway.textContent =
                "全高速 " +
                getAllHighwayMinutesTextFromExitV2Results();
        }

        if (dashboardHighwayDetail) {
            dashboardHighwayDetail.textContent =
                "比較基準";
        }

        if (dashboardLocal) {
            dashboardLocal.textContent = "--";
        }

        if (dashboardLocalDetail) {
            dashboardLocalDetail.textContent =
                "おすすめ出口なし";
        }

        if (dashboardEfficiency) {
            dashboardEfficiency.textContent = "--";
        }

        if (dashboardCost) {
            dashboardCost.textContent = "--";
        }

        return;
    }

    if (dashboardStars) {
        dashboardStars.textContent = "🚗";
    }

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
            "<div class=\"v2-best-time-badge\">" +
            "<span class=\"v2-best-time-icon\">◷</span>" +
            "<span class=\"v2-best-time-text\">あと" +
            best.minutesToCandidate +
            "分</span>" +
            "</div>" +
            "<div class=\"v2-best-exit-detail\">" +
            escapeHtml(
                best.savedToll.toLocaleString() +
                "円節約"
            ) +
            "<br>" +
            escapeHtml(
                best.differenceFromAllHighway +
                "分遅い"
            ) +
            "</div>" +
            "</div>";
    }

    if (dashboardValueJudge) {
        dashboardValueJudge.className = "";
        dashboardValueJudge.classList.add(
            "v2-best-exit-yenpm-badge"
        );
        dashboardValueJudge.textContent =
            best.yenPerDelayedMinute.toLocaleString() +
            "円/分";
    }

    if (dashboardHighway) {
        dashboardHighway.textContent =
            best.allHighwayMinutes === null
                ? "全高速 --"
                : "全高速 " +
                formatV2Duration(best.allHighwayMinutes);
    }

    if (dashboardHighwayDetail) {
        dashboardHighwayDetail.textContent =
            "高速継続";
    }

    if (dashboardLocal) {
        dashboardLocal.textContent =
            "出口利用 " +
            formatV2Duration(best.totalMinutes);
    }

    if (dashboardLocalDetail) {
        dashboardLocalDetail.textContent =
            best.differenceFromAllHighway +
            "分遅い / " +
            best.savedToll.toLocaleString() +
            "円節約";
    }

    if (dashboardEfficiency) {
        dashboardEfficiency.textContent =
            best.savedToll.toLocaleString() +
            "円節約";
    }

    if (dashboardCost) {
        dashboardCost.textContent =
            best.differenceFromAllHighway +
            "分遅い";
    }
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
}

function getAllLocalMinutesFromV2Results() {

    const result =
        lastMultiIcV2Results.find(item =>
            item.allLocalMinutes !== null &&
            item.allLocalMinutes !== undefined
        );

    return result ? result.allLocalMinutes : null;
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

    const hasNoSaving =
        !hasError &&
        result.differenceFromAllLocal !== null &&
        result.differenceFromAllLocal <= 0;

    const classNames = [
        "v2-ic-result-card",
        hasNoSaving ? "v2-ic-no-saving" : "",
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

    document
        .getElementById("dashboardDestination")
        .textContent =
        shortenDestinationName(destination);


    const origin =
        document
            .getElementById("origin")
            .value;

    if (origin) {
        await getRoutes(origin, destination, true);
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

            document
                .getElementById("icArea")
                .value =
                icArea;

            icAreaReason.innerHTML =
                "<span style='color:#4CAF50'>" +
                "方面判定：距離だけ方式（" +
                IC_MASTER[icArea].label +
                "） / 出発地最寄りIC：" +
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
                "km" +
                "</span>";

        }
        else {

            const suggestedIcArea =
                await suggestIcArea(origin, destination);

            if (suggestedIcArea) {

                icArea = suggestedIcArea;

                document
                    .getElementById("icArea")
                    .value =
                    suggestedIcArea;

                icAreaReason.innerHTML =
                    "<span style='color:#4CAF50'>" +
                    "方面判定：" +
                    IC_MASTER[suggestedIcArea].label +
                    "（" +
                    getIcAreaDecisionLabel() +
                    "）" +
                    "</span>";

            }
            else {
                icAreaReason.textContent =
                    "方面判定：未判定";
            }
        }

    }
    else {

        icAreaReason.innerHTML =
            "<span style='color:#f1c40f'>" +
            "方面判定：手動選択を使用（" +
            IC_MASTER[icArea].label +
            "）" +
            "</span>";
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

    lastTollStartIcGoogleName =
        highwayStart.googleName;

    lastTollStartIcOrder =
        highwayStart.order ?? null;

    const destinationNearestIc =
        await findDestinationNearestIcForAutoExitComparison(
            destination,
            icArea
        );

    const selectedExits =
        selectExitCandidatesForAutoExitComparison(
            icArea,
            highwayStart,
            destinationNearestIc,
            7
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

        lastTollEndIcGoogleName =
            destinationNearestIc.googleName;

        lastTollEndIcOrder =
            destinationNearestIc.order;

        reasonText +=
            " / 目的地側IC：" +
            lastTollEndIcName;
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

    if (selectedExits.length === 0) {
        reasonText =
            noExitCandidatesMessage;
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
        "2.0km / 3:00";

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
        scrollToTopPanel();
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
                7
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

    scores.sort((a, b) => a.score - b.score);

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

        if (exit.experimental === true) {
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

async function suggestIcArea(origin, destination) {

    if (!destination) {
        return null;
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

function checkSuggestIcArea() {

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

    console.table(
        testCases.map(
            ([origin, destination]) => ({
                origin,
                destination,
                area: suggestIcArea(
                    origin,
                    destination
                )
            })
        )
    );
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
    const highwayElement =
        document.getElementById("dashboardHighway");

    const localElement =
        document.getElementById("dashboardLocal");

    if (!highwayElement || !localElement) {
        return;
    }

    const acceptableDelay =
        Number(
            document.getElementById("acceptableDelay")?.value
        ) || 30;

    const timeDifference =
        localMinutes - highwayMinutes;

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

    if (timeDifference < acceptableDelay) {
        highwayElement.classList.add("time-bad");
        localElement.classList.add("time-good");
    }
    else if (timeDifference >= acceptableDelay * 2) {
        highwayElement.classList.add("time-good");
        localElement.classList.add("time-bad");
    }
    else {
        highwayElement.classList.add("time-neutral");
        localElement.classList.add("time-neutral");
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
            }
        );
    });
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
            String(!isAutoUpdateEnabled)
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

                    resolve({
                        lat: location.lat(),
                        lng: location.lng()
                    });

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

function scrollToTopPanel() {

    window.scrollTo({
        top: 0,
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

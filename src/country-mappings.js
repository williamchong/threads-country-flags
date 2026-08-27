/**
 * Country name → ISO 3166-1 alpha-2 code lookup table.
 * Loaded before content.js in the ISOLATED world (see manifest.json), so
 * COUNTRY_MAPPINGS is a shared global there. Keys must be lowercase,
 * trimmed, single-spaced — the form produced by normalizeCountryName().
 */

/**
 * Multilingual country name to ISO 3166-1 alpha-2 code mappings
 * Supports English, Chinese (Simplified & Traditional), and common variations
 */

// Comprehensive country name mappings
const COUNTRY_MAPPINGS = {
  // United States
  'united states': 'US',
  'usa': 'US',
  'america': 'US',
  'united states of america': 'US',
  '美国': 'US',
  '美國': 'US',

  // United Kingdom
  'united kingdom': 'GB',
  'uk': 'GB',
  'great britain': 'GB',
  'britain': 'GB',
  'england': 'GB',
  '英国': 'GB',
  '英國': 'GB',

  // China
  'china': 'CN',
  'people\'s republic of china': 'CN',
  'prc': 'CN',
  '中国': 'CN',
  '中國': 'CN',

  // Hong Kong
  'hong kong': 'HK',
  'hongkong': 'HK',
  'hk': 'HK',
  '香港': 'HK',

  // Taiwan
  'taiwan': 'TW',
  'republic of china': 'TW',
  'chinese taipei': 'TW',
  '台湾': 'TW',
  '台灣': 'TW',

  // Japan
  'japan': 'JP',
  '日本': 'JP',

  // South Korea
  'south korea': 'KR',
  'korea': 'KR',
  'republic of korea': 'KR',
  '韩国': 'KR',
  '韓國': 'KR',
  '南韩': 'KR',
  '南韓': 'KR',

  // Canada
  'canada': 'CA',
  '加拿大': 'CA',

  // Australia
  'australia': 'AU',
  '澳大利亚': 'AU',
  '澳大利亞': 'AU',
  '澳洲': 'AU',

  // Germany
  'germany': 'DE',
  'deutschland': 'DE',
  '德国': 'DE',
  '德國': 'DE',

  // France
  'france': 'FR',
  '法国': 'FR',
  '法國': 'FR',

  // Italy
  'italy': 'IT',
  'italia': 'IT',
  '意大利': 'IT',

  // Spain
  'spain': 'ES',
  'españa': 'ES',
  '西班牙': 'ES',

  // Brazil
  'brazil': 'BR',
  'brasil': 'BR',
  '巴西': 'BR',

  // Mexico
  'mexico': 'MX',
  'méxico': 'MX',
  '墨西哥': 'MX',

  // India
  'india': 'IN',
  '印度': 'IN',

  // Singapore
  'singapore': 'SG',
  '新加坡': 'SG',

  // Malaysia
  'malaysia': 'MY',
  '马来西亚': 'MY',
  '馬來西亞': 'MY',

  // Thailand
  'thailand': 'TH',
  '泰国': 'TH',
  '泰國': 'TH',

  // Vietnam
  'vietnam': 'VN',
  'viet nam': 'VN',
  '越南': 'VN',

  // Indonesia
  'indonesia': 'ID',
  '印度尼西亚': 'ID',
  '印度尼西亞': 'ID',
  '印尼': 'ID',

  // Philippines
  'philippines': 'PH',
  '菲律宾': 'PH',
  '菲律賓': 'PH',

  // Russia
  'russia': 'RU',
  'russian federation': 'RU',
  '俄罗斯': 'RU',
  '俄羅斯': 'RU',

  // Netherlands
  'netherlands': 'NL',
  'holland': 'NL',
  '荷兰': 'NL',
  '荷蘭': 'NL',

  // Switzerland
  'switzerland': 'CH',
  '瑞士': 'CH',

  // Sweden
  'sweden': 'SE',
  '瑞典': 'SE',

  // Norway
  'norway': 'NO',
  '挪威': 'NO',

  // Denmark
  'denmark': 'DK',
  '丹麦': 'DK',
  '丹麥': 'DK',

  // Poland
  'poland': 'PL',
  'polska': 'PL',
  '波兰': 'PL',
  '波蘭': 'PL',

  // Austria
  'austria': 'AT',
  'österreich': 'AT',
  '奥地利': 'AT',
  '奧地利': 'AT',

  // Belgium
  'belgium': 'BE',
  'belgië': 'BE',
  'belgique': 'BE',
  '比利时': 'BE',
  '比利時': 'BE',

  // Portugal
  'portugal': 'PT',
  '葡萄牙': 'PT',

  // Greece
  'greece': 'GR',
  '希腊': 'GR',
  '希臘': 'GR',

  // Turkey
  'turkey': 'TR',
  'türkiye': 'TR',
  '土耳其': 'TR',

  // Israel
  'israel': 'IL',
  '以色列': 'IL',

  // Egypt
  'egypt': 'EG',
  '埃及': 'EG',

  // South Africa
  'south africa': 'ZA',
  '南非': 'ZA',

  // New Zealand
  'new zealand': 'NZ',
  '新西兰': 'NZ',
  '新西蘭': 'NZ',

  // Argentina
  'argentina': 'AR',
  '阿根廷': 'AR',

  // Chile
  'chile': 'CL',
  '智利': 'CL',

  // Colombia
  'colombia': 'CO',
  '哥伦比亚': 'CO',
  '哥倫比亞': 'CO',

  // Ireland
  'ireland': 'IE',
  '爱尔兰': 'IE',
  '愛爾蘭': 'IE',

  // Finland
  'finland': 'FI',
  '芬兰': 'FI',
  '芬蘭': 'FI',

  // Czech Republic
  'czech republic': 'CZ',
  'czechia': 'CZ',
  '捷克': 'CZ',

  // Macau
  'macau': 'MO',
  'macao': 'MO',
  '澳门': 'MO',
  '澳門': 'MO',

  // United Arab Emirates
  'united arab emirates': 'AE',
  'uae': 'AE',
  'emirates': 'AE',
  '阿联酋': 'AE',
  '阿聯酋': 'AE',

  // Saudi Arabia
  'saudi arabia': 'SA',
  'ksa': 'SA',
  '沙特阿拉伯': 'SA',
  '沙烏地阿拉伯': 'SA',

  // Qatar
  'qatar': 'QA',
  '卡塔尔': 'QA',
  '卡達': 'QA',

  // Kuwait
  'kuwait': 'KW',
  '科威特': 'KW',

  // Bahrain
  'bahrain': 'BH',
  '巴林': 'BH',

  // Oman
  'oman': 'OM',
  '阿曼': 'OM',

  // Jordan
  'jordan': 'JO',
  '约旦': 'JO',
  '約旦': 'JO',

  // Lebanon
  'lebanon': 'LB',
  '黎巴嫩': 'LB',

  // Iraq
  'iraq': 'IQ',
  '伊拉克': 'IQ',

  // Iran
  'iran': 'IR',
  '伊朗': 'IR',

  // Syria
  'syria': 'SY',
  '叙利亚': 'SY',
  '敘利亞': 'SY',

  // Yemen
  'yemen': 'YE',
  '也门': 'YE',
  '也門': 'YE',

  // Palestine
  'palestine': 'PS',
  '巴勒斯坦': 'PS',

  // Pakistan
  'pakistan': 'PK',
  '巴基斯坦': 'PK',

  // Bangladesh
  'bangladesh': 'BD',
  '孟加拉国': 'BD',
  '孟加拉國': 'BD',

  // Sri Lanka
  'sri lanka': 'LK',
  '斯里兰卡': 'LK',
  '斯里蘭卡': 'LK',

  // Nepal
  'nepal': 'NP',
  '尼泊尔': 'NP',
  '尼泊爾': 'NP',

  // Maldives
  'maldives': 'MV',
  '马尔代夫': 'MV',
  '馬爾地夫': 'MV',

  // Myanmar
  'myanmar': 'MM',
  'burma': 'MM',
  '缅甸': 'MM',
  '緬甸': 'MM',

  // Cambodia
  'cambodia': 'KH',
  '柬埔寨': 'KH',

  // Laos
  'laos': 'LA',
  'lao pdr': 'LA',
  '老挝': 'LA',
  '寮國': 'LA',

  // Brunei
  'brunei': 'BN',
  '文莱': 'BN',
  '汶萊': 'BN',

  // Mongolia
  'mongolia': 'MN',
  '蒙古': 'MN',

  // Nigeria
  'nigeria': 'NG',
  '尼日利亚': 'NG',
  '奈及利亞': 'NG',

  // Kenya
  'kenya': 'KE',
  '肯尼亚': 'KE',
  '肯亞': 'KE',

  // Ghana
  'ghana': 'GH',
  '加纳': 'GH',
  '迦納': 'GH',

  // Ethiopia
  'ethiopia': 'ET',
  '埃塞俄比亚': 'ET',
  '衣索比亞': 'ET',

  // Tanzania
  'tanzania': 'TZ',
  '坦桑尼亚': 'TZ',
  '坦尚尼亞': 'TZ',

  // Uganda
  'uganda': 'UG',
  '乌干达': 'UG',
  '烏干達': 'UG',

  // Morocco
  'morocco': 'MA',
  '摩洛哥': 'MA',

  // Algeria
  'algeria': 'DZ',
  '阿尔及利亚': 'DZ',
  '阿爾及利亞': 'DZ',

  // Tunisia
  'tunisia': 'TN',
  '突尼斯': 'TN',
  '突尼西亞': 'TN',

  // Libya
  'libya': 'LY',
  '利比亚': 'LY',
  '利比亞': 'LY',

  // Sudan
  'sudan': 'SD',
  '苏丹': 'SD',
  '蘇丹': 'SD',

  // Cameroon
  'cameroon': 'CM',
  '喀麦隆': 'CM',
  '喀麥隆': 'CM',

  // Senegal
  'senegal': 'SN',
  '塞内加尔': 'SN',
  '塞內加爾': 'SN',

  // Ivory Coast
  'ivory coast': 'CI',
  'cote d\'ivoire': 'CI',
  'côte d\'ivoire': 'CI',
  '科特迪瓦': 'CI',

  // Angola
  'angola': 'AO',
  '安哥拉': 'AO',

  // Mozambique
  'mozambique': 'MZ',
  '莫桑比克': 'MZ',
  '莫三比克': 'MZ',

  // Zimbabwe
  'zimbabwe': 'ZW',
  '津巴布韦': 'ZW',
  '辛巴威': 'ZW',

  // Rwanda
  'rwanda': 'RW',
  '卢旺达': 'RW',
  '盧安達': 'RW',

  // Ukraine
  'ukraine': 'UA',
  '乌克兰': 'UA',
  '烏克蘭': 'UA',

  // Romania
  'romania': 'RO',
  '罗马尼亚': 'RO',
  '羅馬尼亞': 'RO',

  // Hungary
  'hungary': 'HU',
  'magyarország': 'HU',
  '匈牙利': 'HU',

  // Bulgaria
  'bulgaria': 'BG',
  '保加利亚': 'BG',
  '保加利亞': 'BG',

  // Serbia
  'serbia': 'RS',
  '塞尔维亚': 'RS',
  '塞爾維亞': 'RS',

  // Croatia
  'croatia': 'HR',
  'hrvatska': 'HR',
  '克罗地亚': 'HR',
  '克羅埃西亞': 'HR',

  // Slovakia
  'slovakia': 'SK',
  'slovensko': 'SK',
  '斯洛伐克': 'SK',

  // Slovenia
  'slovenia': 'SI',
  'slovenija': 'SI',
  '斯洛文尼亚': 'SI',
  '斯洛維尼亞': 'SI',

  // Lithuania
  'lithuania': 'LT',
  'lietuva': 'LT',
  '立陶宛': 'LT',

  // Latvia
  'latvia': 'LV',
  'latvija': 'LV',
  '拉脱维亚': 'LV',
  '拉脫維亞': 'LV',

  // Estonia
  'estonia': 'EE',
  'eesti': 'EE',
  '爱沙尼亚': 'EE',
  '愛沙尼亞': 'EE',

  // Belarus
  'belarus': 'BY',
  '白俄罗斯': 'BY',
  '白俄羅斯': 'BY',

  // Moldova
  'moldova': 'MD',
  '摩尔多瓦': 'MD',
  '摩爾多瓦': 'MD',

  // North Macedonia
  'north macedonia': 'MK',
  'macedonia': 'MK',
  '北马其顿': 'MK',
  '北馬其頓': 'MK',

  // Bosnia and Herzegovina
  'bosnia and herzegovina': 'BA',
  'bosnia': 'BA',
  '波斯尼亚和黑塞哥维那': 'BA',
  '波士尼亞與赫塞哥維納': 'BA',

  // Albania
  'albania': 'AL',
  'shqipëri': 'AL',
  '阿尔巴尼亚': 'AL',
  '阿爾巴尼亞': 'AL',

  // Montenegro
  'montenegro': 'ME',
  '黑山': 'ME',

  // Kosovo
  'kosovo': 'XK',
  '科索沃': 'XK',

  // Cyprus
  'cyprus': 'CY',
  'kypros': 'CY',
  '塞浦路斯': 'CY',

  // Kazakhstan
  'kazakhstan': 'KZ',
  '哈萨克斯坦': 'KZ',
  '哈薩克': 'KZ',

  // Uzbekistan
  'uzbekistan': 'UZ',
  '乌兹别克斯坦': 'UZ',
  '烏茲別克': 'UZ',

  // Azerbaijan
  'azerbaijan': 'AZ',
  '阿塞拜疆': 'AZ',
  '亞塞拜然': 'AZ',

  // Georgia
  'georgia': 'GE',
  '格鲁吉亚': 'GE',
  '格魯吉亞': 'GE',

  // Armenia
  'armenia': 'AM',
  '亚美尼亚': 'AM',
  '亞美尼亞': 'AM',

  // Turkmenistan
  'turkmenistan': 'TM',
  '土库曼斯坦': 'TM',
  '土庫曼': 'TM',

  // Tajikistan
  'tajikistan': 'TJ',
  '塔吉克斯坦': 'TJ',

  // Kyrgyzstan
  'kyrgyzstan': 'KG',
  '吉尔吉斯斯坦': 'KG',
  '吉爾吉斯': 'KG',

  // Peru
  'peru': 'PE',
  'perú': 'PE',
  '秘鲁': 'PE',
  '秘魯': 'PE',

  // Venezuela
  'venezuela': 'VE',
  '委内瑞拉': 'VE',
  '委內瑞拉': 'VE',

  // Ecuador
  'ecuador': 'EC',
  '厄瓜多尔': 'EC',
  '厄瓜多': 'EC',

  // Bolivia
  'bolivia': 'BO',
  '玻利维亚': 'BO',
  '玻利維亞': 'BO',

  // Paraguay
  'paraguay': 'PY',
  '巴拉圭': 'PY',

  // Uruguay
  'uruguay': 'UY',
  '乌拉圭': 'UY',
  '烏拉圭': 'UY',

  // Guatemala
  'guatemala': 'GT',
  '危地马拉': 'GT',
  '瓜地馬拉': 'GT',

  // Honduras
  'honduras': 'HN',
  '洪都拉斯': 'HN',
  '宏都拉斯': 'HN',

  // El Salvador
  'el salvador': 'SV',
  '萨尔瓦多': 'SV',
  '薩爾瓦多': 'SV',

  // Nicaragua
  'nicaragua': 'NI',
  '尼加拉瓜': 'NI',

  // Costa Rica
  'costa rica': 'CR',
  '哥斯达黎加': 'CR',
  '哥斯大黎加': 'CR',

  // Panama
  'panama': 'PA',
  'panamá': 'PA',
  '巴拿马': 'PA',
  '巴拿馬': 'PA',

  // Cuba
  'cuba': 'CU',
  '古巴': 'CU',

  // Dominican Republic
  'dominican republic': 'DO',
  '多米尼加共和国': 'DO',
  '多明尼加共和國': 'DO',

  // Jamaica
  'jamaica': 'JM',
  '牙买加': 'JM',
  '牙買加': 'JM',

  // Haiti
  'haiti': 'HT',
  '海地': 'HT',

  // Trinidad and Tobago
  'trinidad and tobago': 'TT',
  'trinidad': 'TT',
  '特立尼达和多巴哥': 'TT',

  // Luxembourg
  'luxembourg': 'LU',
  '卢森堡': 'LU',
  '盧森堡': 'LU',

  // Iceland
  'iceland': 'IS',
  '冰岛': 'IS',
  '冰島': 'IS',

  // Malta
  'malta': 'MT',
  '马耳他': 'MT',
  '馬爾他': 'MT',

  // Liechtenstein
  'liechtenstein': 'LI',
  '列支敦士登': 'LI',

  // Monaco
  'monaco': 'MC',
  '摩纳哥': 'MC',
  '摩納哥': 'MC',

  // Andorra
  'andorra': 'AD',
  '安道尔': 'AD',
  '安道爾': 'AD',

  // San Marino
  'san marino': 'SM',
  '圣马力诺': 'SM',
  '聖馬利諾': 'SM',

  // North Korea
  'north korea': 'KP',
  'dprk': 'KP',
  '朝鲜': 'KP',
  '朝鮮': 'KP',
};

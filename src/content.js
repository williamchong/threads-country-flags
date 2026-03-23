/**
 * Content script for Threads Country Flags extension
 * Injects country flags next to usernames on Threads.com
 *
 * Strategy: Intercept GraphQL responses to build username→userID mapping
 */

// ===== Configuration Constants =====
const MAX_USERNAME_CACHE_SIZE = 1000; // Maximum usernames to cache
const MAX_COUNTRY_CACHE_SIZE = 500;   // Maximum countries to cache in memory
const NO_COUNTRY_TTL_MS = 24 * 60 * 60 * 1000; // 1 day TTL for "no country" cache entries

/**
 * LRU (Least Recently Used) Cache implementation
 * Automatically evicts least recently used items when size limit is reached
 */
class LRUCache {
  /**
   * @param {number} maxSize - Maximum number of items to store
   */
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  /**
   * Get value from cache
   * @param {string} key
   * @returns {*} Value or undefined
   */
  get(key) {
    if (!this.cache.has(key)) {
      return undefined;
    }

    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  /**
   * Set value in cache
   * @param {string} key
   * @param {*} value
   */
  set(key, value) {
    // Remove if exists (to re-add at end)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Add to end (most recently used)
    this.cache.set(key, value);

    // Evict oldest if over size limit
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  /**
   * Check if key exists in cache
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Delete key from cache
   * @param {string} key
   * @returns {boolean} True if key existed
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Get current cache size
   * @returns {number}
   */
  get size() {
    return this.cache.size;
  }

  /**
   * Clear all items from cache
   */
  clear() {
    this.cache.clear();
  }
}

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

/**
 * Convert ISO 3166-1 alpha-2 code to flag emoji
 * @param {string} countryCode - Two-letter country code (e.g., 'US', 'CN')
 * @returns {string} Flag emoji
 */
function countryCodeToFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) {
    return '';
  }

  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));

  return String.fromCodePoint(...codePoints);
}

function normalizeCountryName(name) {
  if (!name) return '';
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Get country code from country name (supports multiple languages)
 * @param {string} countryName - Country name in any supported language
 * @returns {string|null} ISO 3166-1 alpha-2 code or null if not found
 */
function getCountryCode(countryName) {
  const normalized = normalizeCountryName(countryName);
  return COUNTRY_MAPPINGS[normalized] || null;
}

// Special marker for hidden country (returned by API when user explicitly hides location)
const COUNTRY_HIDDEN_MARKER = '__COUNTRY_HIDDEN__';
const PIRATE_FLAG = '🏴‍☠️';

/**
 * Convert country name to flag emoji
 * @param {string} countryName - Country name in any supported language
 * @returns {string} Flag emoji or empty string if not found
 */
function countryNameToFlag(countryName) {
  // Handle hidden country marker
  if (countryName === COUNTRY_HIDDEN_MARKER) {
    return PIRATE_FLAG;
  }
  const code = getCountryCode(countryName);
  return code ? countryCodeToFlag(code) : '';
}

// Track username to user ID mapping (built from GraphQL responses)
// Using LRU cache to prevent unbounded memory growth
const usernameToIdMap = new LRUCache(MAX_USERNAME_CACHE_SIZE);

// Track user ID to country mapping (memory: {countryName, joinDate (ms timestamp), isNewUser})
// Using LRU cache to prevent unbounded memory growth
const countryCache = new LRUCache(MAX_COUNTRY_CACHE_SIZE);

// Storage key prefix for persistent cache
const STORAGE_PREFIX = 'country_';

// Store session parameters for API requests
let sessionParams = null;

// Track pending country requests by request ID
const pendingCountryRequests = new Map();
// Track pending country requests by user ID to prevent duplicates
const userCountryPromises = new Map();
let countryRequestId = 0;

// Track pending timers for intersection observer
const pendingViewTimers = new WeakMap();

// Track which links are currently being observed
const observedLinks = new WeakSet();

/**
 * Format join date timestamp for display
 * @param {number} joinDateMs - Timestamp in milliseconds
 * @returns {string} Formatted date string (e.g., "February 2024")
 */
function formatJoinDate(joinDateMs) {
  if (!joinDateMs || typeof joinDateMs !== 'number') return '';

  try {
    return new Date(joinDateMs).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    });
  } catch {
    return '';
  }
}

/**
 * Check if a join date indicates a new user (joined within last 60 days)
 * @param {number} joinDateMs - Timestamp in milliseconds
 * @returns {boolean} True if user joined within last 60 days
 */
function isNewUser(joinDateMs) {
  if (!joinDateMs || typeof joinDateMs !== 'number') return false;

  try {
    const joinDate = new Date(joinDateMs);
    const now = new Date();

    // Check if within last 60 days (roughly 2 months)
    const daysDiff = (now - joinDate) / (1000 * 60 * 60 * 24);
    return daysDiff >= 0 && daysDiff <= 60;
  } catch (error) {
    console.error('[Threads Country Flags] Error checking new user:', error);
    return false;
  }
}

/**
 * Listen for bulk-route-definitions data for username → user_id mapping
 */
window.addEventListener('threadsBulkRouteData', (event) => {
  extractUserDataFromBulkRoute(event.detail);
});

/**
 * Listen for session parameters from interceptor
 */
window.addEventListener('threadsSessionParams', (event) => {
  sessionParams = event.detail;
});

/**
 * Listen for country responses from injected API
 */
window.addEventListener('threadsCountryResponse', (event) => {
  const { countryName, joinDate, requestId } = event.detail;

  // Resolve pending promise with full user info
  const resolve = pendingCountryRequests.get(requestId);
  if (resolve) {
    pendingCountryRequests.delete(requestId);
    resolve({ countryName, joinDate });
  }
});

/**
 * Extract user data from bulk-route-definitions request/response
 * @param {Object} data - Object with requestBody and response
 */
function extractUserDataFromBulkRoute(data) {
  try {
    const { requestBody, response } = data;

    // Parse request body to extract usernames from route_urls parameters
    // Example: route_urls[0]=%2F%40lhokvremedia → /@lhokvremedia
    const params = new URLSearchParams(requestBody);
    const routeUrls = [];

    for (const [key, value] of params.entries()) {
      if (key.startsWith('route_urls[')) {
        routeUrls.push(decodeURIComponent(value));
      }
    }

    const payload = response?.payload?.payloads || {};

    // Match each route URL with its response data
    for (const routeUrl of routeUrls) {
      // Extract username from route URL (e.g., /@username or /@username/post/...)
      const usernameMatch = routeUrl.match(/^\/@([a-zA-Z0-9_.]+)/);
      if (!usernameMatch) continue;

      const username = usernameMatch[1];

      // Find corresponding response data
      // Response keys might be URL-encoded or Unicode-escaped
      const routeData = payload[routeUrl] ||
        payload[encodeURI(routeUrl)] ||
        payload[routeUrl.replace(/@/g, '\\u0040')];

      if (!routeData) continue;

      // Extract user_id from response
      const userId = routeData?.result?.exports?.rootView?.props?.user_id;

      if (userId) {
        usernameToIdMap.set(username, userId);
      }
    }

    // Note: No need to manually trigger reprocessing - intersection observer handles it
  } catch (error) {
    console.error('[Threads Country Flags] ❌ Error extracting bulk-route data:', error);
  }
}

/**
 * Extract username from profile link
 * @param {HTMLElement} element - Link element
 * @returns {string|null} Username without @ prefix, or null
 */
function extractUsernameFromLink(element) {
  const href = element.getAttribute('href');
  if (!href) return null;

  // Match pattern: /@username or https://www.threads.com/@username
  const match = href.match(/\/@([a-zA-Z0-9_.]+)/);
  return match ? match[1] : null;
}

/**
 * Get country from persistent storage
 * @param {string} userId
 * @returns {Promise<Object|null>} Object with {countryName, joinDate (ms), isNewUser} (isNewUser calculated)
 */
async function getCountryFromStorage(userId) {
  try {
    const key = STORAGE_PREFIX + userId;
    const result = await chrome.storage.local.get(key);
    const stored = result[key];

    // Handle legacy string format (old cache)
    if (typeof stored === 'string') {
      return { countryName: stored, joinDate: null, isNewUser: false };
    }

    if (stored) {
      // Expire "no country" entries after TTL
      if (!stored.countryName && stored.cachedAt) {
        const age = Date.now() - stored.cachedAt;
        if (age > NO_COUNTRY_TTL_MS) {
          await chrome.storage.local.remove(key);
          return null;
        }
      }

      // Dynamically calculate isNewUser when loading from storage
      return {
        ...stored,
        isNewUser: isNewUser(stored.joinDate)
      };
    }

    return null;
  } catch (error) {
    console.error('[Threads Country Flags] Error reading from storage:', error);
    return null;
  }
}

/**
 * Save country to persistent storage
 * @param {string} userId
 * @param {Object} userInfo - Object with {countryName, joinDate (ms)} (isNewUser not saved)
 */
async function saveCountryToStorage(userId, userInfo) {
  try {
    const key = STORAGE_PREFIX + userId;
    const dataToSave = {
      countryName: userInfo.countryName,
      joinDate: userInfo.joinDate,
      ...(!userInfo.countryName ? { cachedAt: Date.now() } : {})
    };
    await chrome.storage.local.set({ [key]: dataToSave });
  } catch (error) {
    console.error('[Threads Country Flags] Error saving to storage:', error);
  }
}

/**
 * Find profile link elements on the page
 * These are <a> tags with href to /@username
 * @returns {HTMLElement[]} Array of profile link elements
 */
function findProfileLinks() {
  // Find all links that point to user profiles
  const links = document.querySelectorAll('a[href*="/@"][role="link"]');
  const profileLinks = [];

  for (const link of links) {
    const href = link.getAttribute('href');
    // Match Threads profile pattern
    if (href && /\/@[a-zA-Z0-9_.]+$/.test(href)) {
      profileLinks.push(link);
    }
  }

  return profileLinks;
}

/**
 * Find the best place to insert the flag
 * Looks for the username text span within the link
 * @param {HTMLElement} linkElement
 * @returns {HTMLElement|null}
 */
function findInsertionPoint(linkElement) {
  // Look for span with dir="auto" which often contains the display name
  const spans = linkElement.querySelectorAll('span[dir="auto"]');

  // The first span with text content is usually the username/display name
  for (const span of spans) {
    const text = span.textContent.trim();
    if (text && text.length > 0 && text.length < 100) {
      // Check if there's a nested span inside this span
      const nestedSpan = span.querySelector('span');
      if (nestedSpan) {
        return nestedSpan;
      }
      // Return the span itself, not its parent, to insert inline
      return span;
    }
  }

  // Fallback: just use the link element itself
  return linkElement;
}

/**
 * Check if a link should be skipped because it only contains an image
 * @param {HTMLElement} linkElement - Profile link element
 * @returns {boolean} True if should skip
 */
function shouldSkipImageLink(linkElement) {
  const hasImage = linkElement.querySelector('img, svg');
  if (!hasImage) return false; // No image, don't skip

  // Check if there are any text-containing spans or divs with actual visible text
  const textElements = Array.from(linkElement.querySelectorAll('span, div')).filter(el => {
    // Get text content excluding SVG content
    let textContent = el.textContent || '';

    // Remove text from any SVG elements inside
    const svgs = el.querySelectorAll('svg');
    for (const svg of svgs) {
      textContent = textContent.replace(svg.textContent || '', '');
    }

    // Check if there's meaningful text left
    return textContent.trim().length > 0;
  });

  // Skip only if there are no text elements (image-only link)
  return textElements.length === 0;
}

/**
 * Add country flag next to username
 * @param {HTMLElement} linkElement - Profile link element
 * @param {string} username - Username (without @)
 */
async function addCountryFlag(linkElement, username) {
  // Check if flag already exists (skip if already successfully added)
  if (linkElement.querySelector('.threads-country-flag')) {
    return;
  }

  // Skip if link contains only an image/svg (profile picture) or inside h1
  if (shouldSkipImageLink(linkElement) || linkElement.closest('h1')) {
    return;
  }

  // Get user ID from our mapping
  const userId = usernameToIdMap.get(username);

  if (!userId) {
    // We don't have the user ID yet - it will be added when GraphQL data arrives
    return;
  }

  // Check memory cache first
  let userInfo = countryCache.get(userId);

  // If not in memory, check persistent storage
  if (!userInfo) {
    userInfo = await getCountryFromStorage(userId);
    if (userInfo) {
      countryCache.set(userId, userInfo);
    }
  }

  if (!userInfo) {
    // Check if there's already a pending request for this user
    if (!userCountryPromises.has(userId)) {
      // Create new request
      const countryPromise = (async () => {
        try {
          // Create a promise that will be resolved when we get the response
          const requestIdForThis = ++countryRequestId;
          const responsePromise = new Promise((resolve) => {
            pendingCountryRequests.set(requestIdForThis, resolve);
          });

          // Send request to injected API
          window.dispatchEvent(new CustomEvent('threadsRequestCountry', {
            detail: {
              userId: userId,
              sessionParams: sessionParams,
              requestId: requestIdForThis
            }
          }));

          // Wait for response (with timeout)
          const apiResponse = await Promise.race([
            responsePromise,
            new Promise(resolve => setTimeout(() => resolve(null), 10000)) // 10s timeout
          ]);

          // Clean up pending request entry regardless of which promise won
          pendingCountryRequests.delete(requestIdForThis);

          // Build user info object
          const countryName = apiResponse?.countryName ?? '';
          const joinDate = apiResponse?.joinDate ?? null;

          const info = {
            countryName,
            joinDate,
            isNewUser: isNewUser(joinDate)
          };

          countryCache.set(userId, info);

          // Save to persistent storage (including "no country" to avoid repeated API calls)
          await saveCountryToStorage(userId, info);

          return info;
        } catch (error) {
          console.error('[Threads Country Flags] ❌ Error fetching country:', error);
          return { countryName: '', joinDate: null, isNewUser: false };
        } finally {
          // Remove from pending map
          userCountryPromises.delete(userId);
        }
      })();

      // Store the promise
      userCountryPromises.set(userId, countryPromise);
    }

    // Wait for the promise to resolve
    try {
      userInfo = await userCountryPromises.get(userId);
    } catch (error) {
      console.error('[Threads Country Flags] ❌ Error waiting for country:', error);
      return;
    }
  }

  // If no country data AND not a new user, skip
  if (!userInfo || (!userInfo.countryName && !userInfo.isNewUser)) {
    return;
  }

  // Check both conditions before doing any DOM operations
  const alreadyProcessed = linkElement.getAttribute('data-threads-flag-processed') === 'true';
  const flagExists = linkElement.querySelector('.threads-country-flag');

  if (alreadyProcessed || flagExists) {
    if (flagExists && !alreadyProcessed) {
      // Mark as processed if flag exists but wasn't marked
      linkElement.setAttribute('data-threads-flag-processed', 'true');
    }
    return;
  }

  // Find where to insert the flag
  const insertionPoint = findInsertionPoint(linkElement);
  if (!insertionPoint) {
    linkElement.setAttribute('data-threads-flag-processed', 'true');
    return;
  }

  // Convert country name to flag emoji for display
  const flagEmoji = userInfo.countryName ? countryNameToFlag(userInfo.countryName) : '';
  const isHidden = userInfo.countryName === COUNTRY_HIDDEN_MARKER;

  // Build display flag (empty string if no country)
  let displayFlag = '';
  if (flagEmoji) {
    displayFlag = flagEmoji;
  } else if (userInfo.countryName && !isHidden) {
    displayFlag = `{${userInfo.countryName}}`;
  }

  // Add new user badge if applicable (from memory cache)
  const newUserBadge = userInfo.isNewUser ? '🔰' : '';
  const formattedDate = userInfo.joinDate ? formatJoinDate(userInfo.joinDate) : '';

  // Build tooltip text
  let titleText = '';
  if (isHidden) {
    titleText = 'Country hidden';
  } else if (userInfo.countryName) {
    titleText = userInfo.countryName;
  }
  if (userInfo.isNewUser && formattedDate) {
    titleText = titleText ? `${titleText} (New user: ${formattedDate})` : `New user: ${formattedDate}`;
  }

  // Build display text (flag + badge with proper spacing)
  const displayParts = [displayFlag, newUserBadge].filter(Boolean);
  const displayText = displayParts.length > 0 ? ` ${displayParts.join(' ')}` : '';

  // Skip if nothing to display
  if (!displayText) {
    linkElement.setAttribute('data-threads-flag-processed', 'true');
    return;
  }

  // Create flag element
  const flagSpan = document.createElement('span');
  flagSpan.className = 'threads-country-flag';
  flagSpan.textContent = displayText;
  flagSpan.title = titleText;
  flagSpan.style.cssText = 'white-space: nowrap; display: inline; margin-left: 4px;';

  // Insert flag right after the display name text (inside the span)
  insertionPoint.appendChild(flagSpan);

  // Mark as processed after successfully adding the flag
  linkElement.setAttribute('data-threads-flag-processed', 'true');
}



/**
 * Handle intersection events (elements entering/leaving viewport)
 * @param {IntersectionObserverEntry[]} entries
 */
function handleIntersection(entries) {
  for (const entry of entries) {
    const linkElement = entry.target;

    if (entry.isIntersecting) {
      // Element entered viewport - start timer
      const username = extractUsernameFromLink(linkElement);
      if (!username) continue;

      // Set timer to process after 1 second
      const timer = setTimeout(() => {
        addCountryFlag(linkElement, username);
        pendingViewTimers.delete(linkElement);
      }, 1000);

      pendingViewTimers.set(linkElement, timer);
    } else {
      // Element left viewport - cancel timer
      const timer = pendingViewTimers.get(linkElement);
      if (timer) {
        clearTimeout(timer);
        pendingViewTimers.delete(linkElement);
      }
    }
  }
}

/**
 * Set up intersection observer for new profile links
 * @param {IntersectionObserver} observer
 */
function observeNewLinks(observer) {
  const profileLinks = findProfileLinks();

  for (const link of profileLinks) {
    // Only observe links we haven't observed yet
    if (!observedLinks.has(link)) {
      observer.observe(link);
      observedLinks.add(link);
    }
  }
}

/**
 * Check if an element is a profile link matching our criteria
 * @param {HTMLElement} element
 * @returns {boolean}
 */
function isProfileLink(element) {
  if (element.tagName !== 'A') return false;
  if (element.getAttribute('role') !== 'link') return false;
  const href = element.getAttribute('href');
  return href && /\/@[a-zA-Z0-9_.]+$/.test(href);
}

/**
 * Observe profile links found within a DOM node
 * @param {HTMLElement} root - Root element to search within
 * @param {IntersectionObserver} observer
 */
function observeLinksInNode(root, observer) {
  // Check if the node itself is a profile link
  if (isProfileLink(root)) {
    if (!observedLinks.has(root)) {
      observer.observe(root);
      observedLinks.add(root);
    }
  }

  // Search within the node for profile links
  if (root.querySelectorAll) {
    const links = root.querySelectorAll('a[href*="/@"][role="link"]');
    for (const link of links) {
      if (!observedLinks.has(link) && isProfileLink(link)) {
        observer.observe(link);
        observedLinks.add(link);
      }
    }
  }
}

/**
 * Handle mutations (new content added to page)
 * Only searches within added nodes instead of re-querying the entire DOM
 * @param {MutationRecord[]} mutations
 * @param {IntersectionObserver} observer
 */
function handleMutations(mutations, observer) {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        observeLinksInNode(node, observer);
      }
    }
  }
}

/**
 * Initialize the extension
 */
function init() {
  // Set up intersection observer to track elements in viewport
  const intersectionObserver = new IntersectionObserver(handleIntersection, {
    root: null, // viewport
    rootMargin: '50px', // Start observing slightly before element enters viewport
    threshold: 0.1 // Trigger when 10% of element is visible
  });

  // Observe initial profile links after GraphQL data arrives
  setTimeout(() => {
    observeNewLinks(intersectionObserver);
  }, 2000);

  // Set up mutation observer for dynamic content (just to find new links to observe)
  // Debounce via requestAnimationFrame to batch rapid DOM changes
  let pendingMutations = [];
  let mutationRafId = null;

  const mutationObserver = new MutationObserver((mutations) => {
    pendingMutations.push(...mutations);
    if (!mutationRafId) {
      mutationRafId = requestAnimationFrame(() => {
        handleMutations(pendingMutations, intersectionObserver);
        pendingMutations = [];
        mutationRafId = null;
      });
    }
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

}

// Wait for page to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

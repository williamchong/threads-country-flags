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

/**
 * Normalize country name to lowercase and remove extra whitespace
 * @param {string} name - Country name
 * @returns {string} Normalized country name
 */
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

/**
 * Convert country name to flag emoji
 * @param {string} countryName - Country name in any supported language
 * @returns {string} Flag emoji or empty string if not found
 */
function countryNameToFlag(countryName) {
  const code = getCountryCode(countryName);
  return code ? countryCodeToFlag(code) : '';
}

/**
 * Get country display (flag + name or just name if no flag found)
 * @param {string} countryName - Country name
 * @returns {string} Flag emoji + country name, or just country name
 */
function getCountryDisplay(countryName) {
  if (!countryName) return '';

  const flag = countryNameToFlag(countryName);

  // If we have a flag, return just the flag
  // If no flag found, return the plain text country name
  return flag || countryName;
}

// Make functions available globally for content script
if (typeof window !== 'undefined') {
  window.getCountryDisplay = getCountryDisplay;
  window.getCountryCode = getCountryCode;
  window.countryNameToFlag = countryNameToFlag;
}

// Also export for modules (background.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getCountryDisplay, getCountryCode, countryNameToFlag };
}

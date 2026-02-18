/**
 * Content script for Threads Country Flags extension
 * Injects country flags next to usernames on Threads.com
 *
 * Strategy: Intercept GraphQL responses to build username→userID mapping
 */

// ===== Configuration Constants =====
const MAX_USERNAME_CACHE_SIZE = 1000; // Maximum usernames to cache
const MAX_COUNTRY_CACHE_SIZE = 500;   // Maximum countries to cache in memory

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
  } catch (error) {
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
  const { userId, countryName, joinDate, requestId } = event.detail;

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

    let usersFound = 0;
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
        usersFound++;
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
    // Only save countryName and joinDate to persistent storage
    const dataToSave = {
      countryName: userInfo.countryName,
      joinDate: userInfo.joinDate
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

          // Build user info object
          const countryName = apiResponse?.countryName ?? '';
          const joinDate = apiResponse?.joinDate ?? null;

          const info = {
            countryName,
            joinDate,
            isNewUser: isNewUser(joinDate)
          };

          countryCache.set(userId, info);

          // Save to persistent storage if valid (not empty, not 'unknown', not error)
          if (countryName && countryName.toLowerCase() !== 'unknown') {
            await saveCountryToStorage(userId, info);
          }

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
 * Handle mutations (new content added to page) - lighter version
 * Just sets up observers for new links
 * @param {MutationRecord[]} mutations
 * @param {IntersectionObserver} observer
 */
function handleMutations(mutations, observer) {
  // Check if any new profile links were added
  let hasNewLinks = false;

  for (const mutation of mutations) {
    if (mutation.addedNodes.length > 0) {
      hasNewLinks = true;
      break;
    }
  }

  if (hasNewLinks) {
    observeNewLinks(observer);
  }
}

/**
 * Initialize the extension
 */
function init() {
  console.log('[Threads Country Flags] Content script initialized (ISOLATED world)');
  console.log('[Threads Country Flags] Listening for GraphQL data from interceptor (MAIN world)');

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
  const mutationObserver = new MutationObserver((mutations) => {
    handleMutations(mutations, intersectionObserver);
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

  console.log('[Threads Country Flags] ✅ Intersection observer initialized');
}

// Wait for page to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

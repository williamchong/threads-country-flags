/**
 * Content script for Threads Country Flags extension
 * Injects country flags next to usernames on Threads.com
 *
 * Strategy: Intercept GraphQL responses to build username→userID mapping
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
 * Get country display (just return the country name)
 * @param {string} countryName - Country name
 * @returns {string} Country name
 */
function getCountryDisplay(countryName) {
  return countryName || '';
}

/**
 * Get country flag emoji from country name
 */
function getCountryFlag(countryName) {
  return getCountryDisplay(countryName);
}

// Track username to user ID mapping (built from GraphQL responses)
const usernameToIdMap = new Map();

// Track user ID to country mapping
const countryCache = new Map();

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
 * Listen for bulk-route-definitions data for username → user_id mapping
 */
window.addEventListener('threadsBulkRouteData', (event) => {
  console.log('[Threads Country Flags] 📥 Received bulk-route-definitions data');
  extractUserDataFromBulkRoute(event.detail);
});

/**
 * Listen for session parameters from interceptor
 */
window.addEventListener('threadsSessionParams', (event) => {
  sessionParams = event.detail;
  console.log('[Threads Country Flags] 📥 Received session parameters');
  console.log('[Threads Country Flags] Session params:', sessionParams);
});

/**
 * Listen for country responses from injected API
 */
window.addEventListener('threadsCountryResponse', (event) => {
  const { userId, countryName, requestId } = event.detail;
  console.log(`[Threads Country Flags] 📬 Country response for ${userId}: ${countryName || 'none'} (request #${requestId})`);

  // Resolve pending promise
  const resolve = pendingCountryRequests.get(requestId);
  if (resolve) {
    pendingCountryRequests.delete(requestId);
    resolve(countryName);
  }
});

/**
 * Extract user data from bulk-route-definitions request/response
 * @param {Object} data - Object with requestBody and response
 */
function extractUserDataFromBulkRoute(data) {
  console.log('[Threads Country Flags] 🔍 Extracting user data from bulk-route-definitions...');

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

    console.log(`[Threads Country Flags] Found ${routeUrls.length} route URLs in request`);

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
        console.log(`[Threads Country Flags] ✅ Mapped: @${username} → ${userId}`);
      }
    }

    console.log(`[Threads Country Flags] 📊 Total users mapped: ${usersFound}, Total in map: ${usernameToIdMap.size}`);

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
 * @returns {Promise<string|null>}
 */
async function getCountryFromStorage(userId) {
  try {
    const key = STORAGE_PREFIX + userId;
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
  } catch (error) {
    console.error('[Threads Country Flags] Error reading from storage:', error);
    return null;
  }
}

/**
 * Save country to persistent storage
 * @param {string} userId
 * @param {string} country
 */
async function saveCountryToStorage(userId, country) {
  try {
    const key = STORAGE_PREFIX + userId;
    await chrome.storage.local.set({ [key]: country });
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
 * Add country flag next to username
 * @param {HTMLElement} linkElement - Profile link element
 * @param {string} username - Username (without @)
 */
async function addCountryFlag(linkElement, username) {
  // Check if flag already exists (skip if already successfully added)
  if (linkElement.querySelector('.threads-country-flag')) {
    return;
  }

  // Get user ID from our mapping
  const userId = usernameToIdMap.get(username);

  if (!userId) {
    console.log(`[Threads Country Flags] ⏸️ No user ID for @${username} yet`);
    // We don't have the user ID yet - it will be added when GraphQL data arrives
    return;
  }

  console.log(`[Threads Country Flags] 🔍 Processing @${username} (${userId})`);

  // Check memory cache first
  let country = countryCache.get(userId);

  // If not in memory, check persistent storage
  if (!country) {
    country = await getCountryFromStorage(userId);
    if (country) {
      console.log(`[Threads Country Flags] 💾 Loaded from storage for ${userId}: ${country}`);
      countryCache.set(userId, country);
    }
  }

  if (!country) {
    // Check if there's already a pending request for this user
    if (!userCountryPromises.has(userId)) {
      // Create new request
      const countryPromise = (async () => {
        try {
          console.log(`[Threads Country Flags] 📡 Requesting country for ${userId}...`);

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
          const countryNameRaw = await Promise.race([
            responsePromise,
            new Promise(resolve => setTimeout(() => resolve(null), 10000)) // 10s timeout
          ]);

          // Store country name as-is
          const countryName = countryNameRaw ? getCountryDisplay(countryNameRaw) : '';
          countryCache.set(userId, countryName);

          // Save to persistent storage if valid (not empty, not 'unknown', not error)
          if (countryName && countryName.toLowerCase() !== 'unknown') {
            await saveCountryToStorage(userId, countryName);
            console.log(`[Threads Country Flags] 💾 Saved to storage: ${userId} -> ${countryName}`);
          }

          console.log(`[Threads Country Flags] 📬 Received country: "${countryName}" for ${userId}`);
          return countryName;
        } catch (error) {
          console.error('[Threads Country Flags] ❌ Error fetching country:', error);
          return '';
        } finally {
          // Remove from pending map
          userCountryPromises.delete(userId);
        }
      })();

      // Store the promise
      userCountryPromises.set(userId, countryPromise);
    } else {
      console.log(`[Threads Country Flags] ⏳ Waiting for existing request for ${userId}`);
    }

    // Wait for the promise to resolve
    try {
      country = await userCountryPromises.get(userId);
    } catch (error) {
      console.error('[Threads Country Flags] ❌ Error waiting for country:', error);
      return;
    }
  }

  // If no country data, skip
  if (!country) {
    console.log(`[Threads Country Flags] ⚠️ No country data for @${username} (${userId})`);
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
    console.log(`[Threads Country Flags] ⏭️ Already processed @${username}, skipping`);
    return;
  }

  // Find where to insert the flag
  const insertionPoint = findInsertionPoint(linkElement);
  if (!insertionPoint) {
    console.log(`[Threads Country Flags] ⚠️ No insertion point found for @${username}`);
    linkElement.setAttribute('data-threads-flag-processed', 'true');
    return;
  }

  // Convert country name to flag emoji for display
  const flagEmoji = countryNameToFlag(country);
  const displayFlag = flagEmoji || `{${country}}`;

  // Create flag element
  const flagSpan = document.createElement('span');
  flagSpan.className = 'threads-country-flag';
  flagSpan.textContent = ` ${displayFlag}`;
  flagSpan.title = country;
  flagSpan.style.cssText = 'white-space: nowrap; display: inline; margin-left: 4px;';

  // Insert flag right after the display name text (inside the span)
  insertionPoint.appendChild(flagSpan);

  // Mark as processed after successfully adding the flag
  linkElement.setAttribute('data-threads-flag-processed', 'true');

  console.log(`[Threads Country Flags] ✅ Added flag for @${username} (${userId}): ${displayFlag}`);
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

      console.log(`[Threads Country Flags] 👁️ @${username} entered view`);

      // Set timer to process after 1 second
      const timer = setTimeout(() => {
        console.log(`[Threads Country Flags] ⏰ @${username} in view for 1s, processing...`);
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
        const username = extractUsernameFromLink(linkElement);
        if (username) {
          console.log(`[Threads Country Flags] 👋 @${username} left view, timer cancelled`);
        }
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

  console.log(`[Threads Country Flags] 👀 Observing ${profileLinks.length} profile links`);
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

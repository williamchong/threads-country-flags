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
const NEW_USER_DAYS = 60;             // Users who joined within this many days get the 🔰 badge
const VIEW_DWELL_MS = 1000;           // Link must stay in viewport this long before we fetch
const API_TIMEOUT_MS = 10000;         // Give up waiting for the injected API after this
const INITIAL_SCAN_DELAY_MS = 2000;   // Wait for initial route data before scanning links
const PROFILE_LINK_SELECTOR = 'a[href*="/@"][role="link"]';
const PROFILE_HREF_RE = /\/@([a-zA-Z0-9_.]+)$/; // Profile links only (no /post/... suffix)
const PROCESSED_ATTR = 'data-threads-flag-processed';
const UI_LANGUAGE = chrome.i18n.getUILanguage();

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

// Links whose lookup was skipped because session params weren't captured yet
const linksAwaitingSession = new Set();

/**
 * Format join date timestamp for display
 * @param {number} joinDateMs - Timestamp in milliseconds
 * @returns {string} Formatted date string (e.g., "February 2024")
 */
function formatJoinDate(joinDateMs) {
  if (!joinDateMs || typeof joinDateMs !== 'number') return '';

  try {
    return new Date(joinDateMs).toLocaleDateString(UI_LANGUAGE, {
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

    const daysDiff = (now - joinDate) / (1000 * 60 * 60 * 24);
    return daysDiff >= 0 && daysDiff <= NEW_USER_DAYS;
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

  // Links that were viewed before session params arrived never get another
  // intersection event while they stay in view, so retry them now
  for (const link of linksAwaitingSession) {
    const username = extractUsernameFromLink(link);
    if (username) addCountryFlag(link, username);
  }
  linksAwaitingSession.clear();
});

/**
 * Listen for country responses from injected API
 */
window.addEventListener('threadsCountryResponse', (event) => {
  const { ok, countryName, joinDate, requestId } = event.detail;

  // Resolve pending promise with full user info
  const resolve = pendingCountryRequests.get(requestId);
  if (resolve) {
    pendingCountryRequests.delete(requestId);
    resolve({ ok, countryName, joinDate });
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
  const match = href.match(PROFILE_HREF_RE);
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
 * Look up user info from memory, storage, or the API (in that order)
 * @param {string} userId
 * @returns {Promise<Object|null>} {countryName, joinDate, isNewUser}, or null if
 *   the lookup could not be attempted (no session params) or failed
 */
async function resolveUserInfo(userId) {
  let userInfo = countryCache.get(userId);
  if (userInfo) return userInfo;

  userInfo = await getCountryFromStorage(userId);
  if (userInfo) {
    countryCache.set(userId, userInfo);
    return userInfo;
  }

  // Without session params the API call cannot succeed
  if (!sessionParams) return null;

  // Deduplicate concurrent requests for the same user
  if (!userCountryPromises.has(userId)) {
    userCountryPromises.set(userId, fetchUserInfoFromApi(userId).finally(() => {
      userCountryPromises.delete(userId);
    }));
  }

  try {
    return await userCountryPromises.get(userId);
  } catch (error) {
    console.error('[Threads Country Flags] ❌ Error waiting for country:', error);
    return null;
  }
}

/**
 * Fetch user info via the injected MAIN-world API and cache the result
 * @param {string} userId
 * @returns {Promise<Object>} {countryName, joinDate, isNewUser}
 */
async function fetchUserInfoFromApi(userId) {
  const requestId = ++countryRequestId;
  const responsePromise = new Promise((resolve) => {
    pendingCountryRequests.set(requestId, resolve);
  });

  window.dispatchEvent(new CustomEvent('threadsRequestCountry', {
    detail: { userId, sessionParams, requestId }
  }));

  const apiResponse = await Promise.race([
    responsePromise,
    new Promise(resolve => setTimeout(() => resolve(null), API_TIMEOUT_MS))
  ]);

  // Clean up pending request entry regardless of which promise won
  pendingCountryRequests.delete(requestId);

  const joinDate = apiResponse?.joinDate ?? null;
  const info = {
    countryName: apiResponse?.countryName ?? '',
    joinDate,
    isNewUser: isNewUser(joinDate)
  };

  countryCache.set(userId, info);

  // Persist only genuine API answers (including "no country", to avoid
  // repeated API calls). Failures/timeouts stay in memory only so the
  // next session retries instead of being cached for NO_COUNTRY_TTL_MS.
  if (apiResponse?.ok) {
    await saveCountryToStorage(userId, info);
  }

  return info;
}

/**
 * Add country flag next to username
 * @param {HTMLElement} linkElement - Profile link element
 * @param {string} username - Username (without @)
 */
async function addCountryFlag(linkElement, username) {
  // Skip if already handled (or in flight)
  if (linkElement.hasAttribute(PROCESSED_ATTR)) {
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

  // Mark in-flight before the first await so a re-entrant call can't double-insert
  linkElement.setAttribute(PROCESSED_ATTR, 'pending');

  const userInfo = await resolveUserInfo(userId);
  if (!userInfo) {
    // Lookup couldn't run yet (no session params, or error) - allow a retry
    linkElement.removeAttribute(PROCESSED_ATTR);
    if (!sessionParams) linksAwaitingSession.add(linkElement);
    return;
  }

  linkElement.setAttribute(PROCESSED_ATTR, 'true');

  // If no country data AND not a new user, skip
  if (!userInfo.countryName && !userInfo.isNewUser) {
    return;
  }

  // Find where to insert the flag
  const insertionPoint = findInsertionPoint(linkElement);

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
    titleText = chrome.i18n.getMessage('tooltipCountryHidden');
  } else if (userInfo.countryName) {
    titleText = userInfo.countryName;
  }
  if (userInfo.isNewUser && formattedDate) {
    const newUserLabel = chrome.i18n.getMessage('tooltipNewUser', [formattedDate]);
    titleText = titleText ? `${titleText} (${newUserLabel})` : newUserLabel;
  }

  // Build display text (flag + badge with proper spacing)
  const displayParts = [displayFlag, newUserBadge].filter(Boolean);
  const displayText = displayParts.length > 0 ? ` ${displayParts.join(' ')}` : '';

  // Skip if nothing to display
  if (!displayText) {
    return;
  }

  // Create flag element
  const flagSpan = document.createElement('span');
  flagSpan.className = 'threads-country-flag';
  flagSpan.textContent = displayText;
  flagSpan.title = titleText;

  // Insert flag right after the display name text (inside the span)
  insertionPoint.appendChild(flagSpan);
}



/**
 * Handle intersection events (elements entering/leaving viewport)
 * @param {IntersectionObserverEntry[]} entries
 */
function handleIntersection(entries) {
  for (const entry of entries) {
    const linkElement = entry.target;

    if (entry.isIntersecting) {
      // Fully handled links never need another lookup
      if (linkElement.getAttribute(PROCESSED_ATTR) === 'true') continue;

      const username = extractUsernameFromLink(linkElement);
      if (!username) continue;

      // Process only once the link has stayed in view for VIEW_DWELL_MS
      const timer = setTimeout(() => {
        addCountryFlag(linkElement, username);
        pendingViewTimers.delete(linkElement);
      }, VIEW_DWELL_MS);

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
 * Check if an element is a profile link matching our criteria
 * @param {HTMLElement} element
 * @returns {boolean}
 */
function isProfileLink(element) {
  if (element.tagName !== 'A') return false;
  if (element.getAttribute('role') !== 'link') return false;
  const href = element.getAttribute('href');
  return !!href && PROFILE_HREF_RE.test(href);
}

/**
 * Start observing a profile link if it isn't already observed
 * @param {HTMLElement} link
 * @param {IntersectionObserver} observer
 */
function observeLink(link, observer) {
  if (!observedLinks.has(link)) {
    observer.observe(link);
    observedLinks.add(link);
  }
}

/**
 * Observe profile links found within a DOM node
 * @param {HTMLElement} root - Root element to search within
 * @param {IntersectionObserver} observer
 */
function observeLinksInNode(root, observer) {
  // Check if the node itself is a profile link
  if (isProfileLink(root)) {
    observeLink(root, observer);
  }

  // Search within the node for profile links
  if (root.querySelectorAll) {
    for (const link of root.querySelectorAll(PROFILE_LINK_SELECTOR)) {
      if (isProfileLink(link)) {
        observeLink(link, observer);
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
    observeLinksInNode(document.body, intersectionObserver);
  }, INITIAL_SCAN_DELAY_MS);

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

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
const VIEW_RETRY_MS = 2000;           // Gap between retries of a lookup that couldn't run yet
const MAX_VIEW_RETRIES = 3;           // Retries after the initial dwell attempt
const API_TIMEOUT_MS = 10000;         // Give up waiting for the injected API after this
const INITIAL_SCAN_DELAY_MS = 2000;   // Wait for initial route data before scanning links
const RATE_LIMIT_BASE_MS = 30 * 1000;     // Backoff after a 429, doubled per episode
const RATE_LIMIT_MAX_MS = 5 * 60 * 1000;  // Backoff ceiling; also clamps Retry-After
const AUTH_COOLDOWN_MS = 15 * 1000;       // 401: wait out session token rotation
const SERVER_COOLDOWN_MS = 5 * 1000;      // 5xx / no response: collapse the burst
const PROFILE_LINK_SELECTOR = 'a[href*="/@"][role="link"]';
const PROFILE_HREF_RE = /\/@([a-zA-Z0-9_.]+)$/; // Profile links only (no /post/... suffix)
const PROCESSED_ATTR = 'data-threads-flag-processed';
const HTTP_UNAUTHORIZED = 401;       // Session token rejected
const HTTP_TOO_MANY_REQUESTS = 429;  // Rate limited
const HTTP_NO_RESPONSE = 0;          // api-injected.js could not reach the server
const PROCESSED_PENDING = 'pending'; // Lookup in flight; outcome not yet known
const PROCESSED_DONE = 'true';       // Terminal, whether or not a flag was inserted
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

// Generic colour-emoji stack, used only by the probes below to pin them to
// whichever colour emoji font this system has. The badge itself inherits
// threads.com's own font-family; this list is not what it resolves to.
const EMOJI_FONT_STACK = '"Twemoji Mozilla","Apple Color Emoji","Segoe UI Emoji",' +
  '"Segoe UI Symbol","Noto Color Emoji","EmojiOne Color","Android Emoji",sans-serif';

// Flags whose vendor coverage is patchy even where flags generally work. XK
// (Kosovo) is user-assigned rather than ISO 3166-1, so it is not guaranteed to
// be present - Apple ships it, others may not. Probed at init rather than
// assumed, so a working native glyph is never overridden.
const PATCHY_FLAG_CODES = ['XK'];

// Both filled in by init(): either no flag renders natively, or only the
// individual PATCHY_FLAG_CODES this browser happens to lack.
let allFlagsNeedBundledFont = false;
const unsupportedFlagCodes = new Set();

let emojiProbeCtx = null;

/**
 * Shared 1x1 canvas used to ask the renderer what it actually drew.
 * @returns {CanvasRenderingContext2D|null} Probe context, or null if unavailable
 */
function getEmojiProbeContext() {
  if (!emojiProbeCtx) {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    emojiProbeCtx = canvas.getContext('2d', { willReadFrequently: true });
    if (emojiProbeCtx) {
      emojiProbeCtx.textBaseline = 'top';
      emojiProbeCtx.font = `100px ${EMOJI_FONT_STACK}`;
      // Squash the whole 100px glyph down into the single pixel we sample, so
      // the reading averages the glyph rather than one arbitrary corner
      emojiProbeCtx.scale(0.01, 0.01);
    }
  }
  return emojiProbeCtx;
}

/**
 * Does this text render as a colour glyph?
 *
 * A colour font ignores fillStyle, so drawing the same text in white and in
 * black yields identical pixels. Monochrome text - such as the two boxed
 * letters Windows produces for a flag - is painted in the fill colour and so
 * differs between the two passes.
 *
 * Adapted from country-flag-emoji-polyfill (MIT, (c) 2022 TalkJS).
 *
 * @param {string} text - Text to probe
 * @returns {boolean} True if drawn as a colour glyph
 */
function isColorGlyph(text) {
  const ctx = getEmojiProbeContext();
  if (!ctx) return true;

  try {
    const render = (color) => {
      ctx.clearRect(0, 0, 100, 100);
      ctx.fillStyle = color;
      ctx.fillText(text, 0, 0);
      return ctx.getImageData(0, 0, 1, 1).data.join(',');
    };
    const onWhite = render('#fff');
    const onBlack = render('#000');
    return onWhite === onBlack && !onBlack.startsWith('0,0,0,');
  } catch {
    // Canvas readback blocked (fingerprinting protection) - leave rendering alone
    return true;
  }
}

/**
 * Detect whether this browser renders regional indicator pairs as flag emoji.
 *
 * Chrome on Windows does not: Segoe UI Emoji carries no regional indicator
 * ligatures, so the pair falls back to two boxed letters. Asking the renderer
 * beats sniffing the platform - it stays correct on Windows machines that have
 * a flag font installed, and switches itself off if Segoe ever gains the glyphs.
 *
 * @returns {boolean} True if flag emoji already render natively
 */
function supportsFlagEmoji() {
  // Only trust a negative flag result if colour emoji work here at all
  return !isColorGlyph('\u{1F60A}') || isColorGlyph(countryCodeToFlag('CH'));
}

/**
 * Does this browser need the bundled font to draw this flag?
 * @param {string} countryCode - ISO 3166-1 alpha-2 code
 * @returns {boolean} True if the native glyph is missing
 */
function needsBundledFont(countryCode) {
  return allFlagsNeedBundledFont || unsupportedFlagCodes.has(countryCode);
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

// Lookup gate. A failure the server asked us to wait out closes it, and
// resolveUserInfo() turns lookups away without dispatching until it reopens. Gated
// links keep their observation, so a later scroll retries them for free - the gate
// needs no timer of its own.
let lookupGateUntil = 0;
let rateLimitEpisodes = 0;

// Retry chains for links currently dwelling in the viewport, keyed by link.
// A pending timer's closure is what retains the link, not this map; the chain
// is dropped when the link leaves the viewport, which is also how the observer
// reports a detach.
const pendingViewChains = new WeakMap();

// Links that have ever been observed. Never pruned, so a link unobserved at a
// terminal state is not picked up again by a later scan.
const observedLinks = new WeakSet();

// Assigned in init()
let intersectionObserver = null;

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
});

/**
 * Listen for country responses from injected API
 */
window.addEventListener('threadsCountryResponse', (event) => {
  const { ok, status, retryAfterMs, countryName, joinDate, requestId } = event.detail;

  // Resolve pending promise with full user info
  const resolve = pendingCountryRequests.get(requestId);
  if (resolve) {
    pendingCountryRequests.delete(requestId);
    resolve({ ok, status, retryAfterMs, countryName, joinDate });
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
 * Close the lookup gate for a failure that waiting can actually fix. A timeout self
 * throttles at API_TIMEOUT_MS and an unusable payload is one user's problem, so
 * neither gates; nothing here is cached, so the retry chain still owns recovery.
 * @param {Object|null} apiResponse - Response detail, or null if the request timed out
 */
function noteLookupFailure(apiResponse) {
  const now = Date.now();
  const status = apiResponse?.status;
  let cooldownMs = 0;

  if (status === HTTP_TOO_MANY_REQUESTS) {
    // Count episodes, not responses. A viewport dispatches one request per user, so a
    // single rate-limited round answers ~20 times over; incrementing per response would
    // reach the ceiling on the first round and the ramp would never happen.
    if (now >= lookupGateUntil) {
      // A gate that cooled off long ago was a separate incident, not an escalation
      if (now - lookupGateUntil > RATE_LIMIT_MAX_MS) rateLimitEpisodes = 0;
      rateLimitEpisodes++;
    }
    // Honour Retry-After only when it asks for a real wait: a 0 would otherwise read as
    // "present" and leave a 429 ungated entirely. Clamp it as well as our own backoff,
    // so an absurd value cannot freeze lookups for the life of the page.
    const headerMs = apiResponse.retryAfterMs;
    const backoffMs = headerMs > 0 ? headerMs : RATE_LIMIT_BASE_MS * 2 ** (rateLimitEpisodes - 1);
    cooldownMs = Math.min(backoffMs, RATE_LIMIT_MAX_MS);
  } else if (status === HTTP_UNAUTHORIZED) {
    // Stale session token. interceptor.js overwrites sessionParams on every intercepted
    // XHR, so waiting is enough - there is nothing to clear, and clearing it would
    // strand every link if no further request ever carried a token.
    cooldownMs = AUTH_COOLDOWN_MS;
  } else if (status === HTTP_NO_RESPONSE || status >= 500) {
    // These answer fast, so without a gate the chain's four attempts per link times a
    // viewport of links turns a brief outage into a request storm
    cooldownMs = SERVER_COOLDOWN_MS;
  }

  if (cooldownMs === 0) return;

  lookupGateUntil = Math.max(lookupGateUntil, now + cooldownMs);
  console.warn(`[Threads Country Flags] ⚠️ Lookups paused for ${Math.round(cooldownMs / 1000)}s after HTTP ${status}`);
}

/**
 * Look up user info from memory, storage, or the API (in that order)
 * @param {string} userId
 * @returns {Promise<Object|null>} {countryName, joinDate, isNewUser}, or null if
 *   the lookup could not be attempted (no session params, or backing off after a
 *   failure) or failed
 */
async function resolveUserInfo(userId) {
  let userInfo = countryCache.get(userId);
  if (userInfo) return userInfo;

  userInfo = await getCountryFromStorage(userId);
  if (userInfo) {
    countryCache.set(userId, userInfo);
    return userInfo;
  }

  // Backing off after a failure worth waiting out: turn the lookup away without
  // dispatching. The caller leaves the link observed, so a later scroll retries it for
  // free. Cached answers are served above, so the gate only suppresses new requests.
  if (Date.now() < lookupGateUntil) return null;

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
 * @returns {Promise<Object|null>} {countryName, joinDate, isNewUser}, or null if the
 *   lookup failed and should be retried
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

  // Cache nothing on failure. A cached failure is indistinguishable from a genuine
  // "no country" answer, so it would mark the link terminal and unobserve it - one
  // 429 would blank that user for the life of the page. Returning null instead
  // leaves the link eligible for the viewport retry chain. Genuine answers are
  // persisted whether or not they carry a country, so they are not re-fetched.
  if (!apiResponse?.ok) {
    noteLookupFailure(apiResponse);
    return null;
  }

  const joinDate = apiResponse.joinDate ?? null;
  const info = {
    countryName: apiResponse.countryName ?? '',
    joinDate,
    isNewUser: isNewUser(joinDate)
  };

  countryCache.set(userId, info);
  await saveCountryToStorage(userId, info);

  return info;
}

/**
 * Add country flag next to username
 * @param {HTMLElement} linkElement - Profile link element
 * @param {string} username - Username (without @)
 * @returns {Promise<boolean>} True once the link has reached a state no further
 *   attempt can improve; false while a retry could still succeed
 */
async function addCountryFlag(linkElement, username) {
  // A lookup in flight is not terminal - its owner may still fail and clear the
  // attribute, and a chain that has been cancelled cannot report that back here
  const state = linkElement.getAttribute(PROCESSED_ATTR);
  if (state === PROCESSED_DONE) return true;
  if (state === PROCESSED_PENDING) return false;

  // Page headers never carry a flag, and no re-render changes that
  if (linkElement.closest('h1')) {
    intersectionObserver?.unobserve(linkElement);
    return true;
  }

  // Get user ID from our mapping
  const userId = usernameToIdMap.get(username);

  if (!userId) {
    // The ID arrives with a later /bulk-route-definitions response, so retry
    return false;
  }

  // Image-only links (profile pictures) stay observed: the test is content
  // based, so a link whose display name hasn't rendered yet must stay eligible.
  // Ordered after the user ID lookup, which is free and rejects the same links
  // during the window the retries are there to wait out
  if (shouldSkipImageLink(linkElement)) {
    return false;
  }

  // Mark in-flight before the first await so a re-entrant call can't double-insert
  linkElement.setAttribute(PROCESSED_ATTR, PROCESSED_PENDING);

  const userInfo = await resolveUserInfo(userId);
  if (!userInfo) {
    // Lookup couldn't run yet (no session params, or error) - allow a retry
    linkElement.removeAttribute(PROCESSED_ATTR);
    return false;
  }

  linkElement.setAttribute(PROCESSED_ATTR, PROCESSED_DONE);

  // Release the observation: a resolved link never needs another lookup, and
  // the observer would otherwise retain every link the feed has ever shown
  intersectionObserver?.unobserve(linkElement);

  // If no country data AND not a new user, skip
  if (!userInfo.countryName && !userInfo.isNewUser) {
    return true;
  }

  // Find where to insert the flag
  const insertionPoint = findInsertionPoint(linkElement);

  // Convert country name to flag emoji for display
  const isHidden = userInfo.countryName === COUNTRY_HIDDEN_MARKER;
  const countryCode = isHidden ? null : getCountryCode(userInfo.countryName || '');
  const flagEmoji = isHidden ? PIRATE_FLAG : countryCodeToFlag(countryCode || '');

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

  // Skip if nothing to display
  if (!displayFlag && !newUserBadge) {
    return true;
  }

  // Create flag element
  const flagSpan = document.createElement('span');
  flagSpan.className = 'threads-country-flag';
  flagSpan.title = titleText;

  if (countryCode && needsBundledFont(countryCode)) {
    // Wrap the flag so the bundled font applies to the glyph alone - the 🔰
    // badge and the {Country Name} fallback must keep the page's own font
    const glyphSpan = document.createElement('span');
    glyphSpan.className = 'threads-country-flag-glyph';
    glyphSpan.textContent = displayFlag;
    flagSpan.append(' ', glyphSpan);
    if (newUserBadge) {
      flagSpan.append(` ${newUserBadge}`);
    }
  } else {
    flagSpan.textContent = ` ${[displayFlag, newUserBadge].filter(Boolean).join(' ')}`;
  }

  // Insert flag right after the display name text (inside the span)
  insertionPoint.appendChild(flagSpan);
  return true;
}



/**
 * Attempt a lookup once the link has dwelled in view, retrying while the data
 * it needs (user ID, session params, a rendered display name) is still missing.
 *
 * IntersectionObserver only reports threshold crossings, so a link that is
 * already in view when its data arrives gets no second callback of its own.
 *
 * Identity is compared on the chain object rather than the timer id, which
 * browsers may reuse once a timer has fired.
 * @param {HTMLElement} linkElement - Profile link element
 * @param {string} username - Username (without @)
 */
function startViewAttempts(linkElement, username) {
  if (pendingViewChains.has(linkElement)) return;

  const chain = { timer: null };
  pendingViewChains.set(linkElement, chain);

  const run = (attempt) => {
    chain.timer = setTimeout(async () => {
      // A throw must not strand the chain in pendingViewChains: the entry is
      // what blocks a new one, so the link would never be attempted again.
      // chrome.i18n throws on every visible link at once after an extension
      // reload, which is exactly when that would bite
      let done = true;
      try {
        done = await addCountryFlag(linkElement, username);
      } catch (error) {
        console.error('[Threads Country Flags] Error adding flag:', error);
        // Leave no link stranded mid-lookup, but do not spend the remaining
        // retries on a call that will almost certainly throw again
        linkElement.removeAttribute(PROCESSED_ATTR);
      }

      // Cancelled by the leaving branch, or superseded by a newer chain, while
      // the lookup was in flight
      if (pendingViewChains.get(linkElement) !== chain) return;

      // The shortest gate outlasts the whole retry window, so further attempts would
      // only re-pay the storage read and the image-link scan to be turned away again
      if (done || attempt >= MAX_VIEW_RETRIES || Date.now() < lookupGateUntil) {
        pendingViewChains.delete(linkElement);
        return;
      }

      run(attempt + 1);
    }, attempt === 0 ? VIEW_DWELL_MS : VIEW_RETRY_MS);
  };

  run(0);
}

/**
 * Cancel a link's retry chain, if it has one
 * @param {HTMLElement} linkElement - Profile link element
 */
function cancelViewAttempts(linkElement) {
  clearTimeout(pendingViewChains.get(linkElement)?.timer);
  pendingViewChains.delete(linkElement);
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
      if (linkElement.getAttribute(PROCESSED_ATTR) === PROCESSED_DONE) continue;

      const username = extractUsernameFromLink(linkElement);
      if (!username) continue;

      startViewAttempts(linkElement, username);
    } else {
      cancelViewAttempts(linkElement);

      // A detach is reported as a viewport leave. Releasing the observation here
      // bounds the retention 458f1ef fixed: a lookup that never reaches a terminal
      // state keeps its observation, and a failed lookup is now such a state, so a
      // detached feed subtree would otherwise be pinned for the life of the page.
      // Dropping it from observedLinks lets a re-attached link be observed again.
      if (!linkElement.isConnected) {
        intersectionObserver.unobserve(linkElement);
        observedLinks.delete(linkElement);
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
 */
function observeLink(link) {
  if (!observedLinks.has(link)) {
    intersectionObserver.observe(link);
    observedLinks.add(link);
  }
}

/**
 * Observe profile links found within a DOM node
 * @param {HTMLElement} root - Root element to search within
 */
function observeLinksInNode(root) {
  // Check if the node itself is a profile link
  if (isProfileLink(root)) {
    observeLink(root);
  }

  // Search within the node for profile links
  if (root.querySelectorAll) {
    for (const link of root.querySelectorAll(PROFILE_LINK_SELECTOR)) {
      if (isProfileLink(link)) {
        observeLink(link);
      }
    }
  }
}

/**
 * Handle mutations (new content added to page)
 * Only searches within added nodes instead of re-querying the entire DOM
 * @param {MutationRecord[]} mutations
 */
function handleMutations(mutations) {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        observeLinksInNode(node);
      }
    }
  }
}

/**
 * Initialize the extension
 */
function init() {
  // Chrome on Windows cannot render flag emoji; use the bundled flag font only
  // where the browser actually needs it, so native emoji win elsewhere.
  if (supportsFlagEmoji()) {
    // Flags work in general, but a few have patchy vendor coverage
    for (const code of PATCHY_FLAG_CODES) {
      if (!isColorGlyph(countryCodeToFlag(code))) {
        unsupportedFlagCodes.add(code);
      }
    }
  } else {
    allFlagsNeedBundledFont = true;
  }

  // Set up intersection observer to track elements in viewport
  intersectionObserver = new IntersectionObserver(handleIntersection, {
    root: null, // viewport
    rootMargin: '50px', // Start observing slightly before element enters viewport
    threshold: 0.1 // Trigger when 10% of element is visible
  });

  // Observe initial profile links after GraphQL data arrives
  setTimeout(() => {
    observeLinksInNode(document.body);
  }, INITIAL_SCAN_DELAY_MS);

  // Set up mutation observer for dynamic content (just to find new links to observe)
  // Debounce via requestAnimationFrame to batch rapid DOM changes
  let pendingMutations = [];
  let mutationRafId = null;

  const mutationObserver = new MutationObserver((mutations) => {
    pendingMutations.push(...mutations);
    if (!mutationRafId) {
      mutationRafId = requestAnimationFrame(() => {
        handleMutations(pendingMutations);
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

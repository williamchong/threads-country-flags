/**
 * Content script for Threads Country Flags extension
 * Injects country flags next to usernames on Threads.com
 *
 * Strategy: Intercept GraphQL responses to build username→userID mapping
 */

/**
 * Get country flag emoji from country name
 * This function will be available from countries.js loaded before this script
 */
function getCountryFlag(countryName) {
  // getCountryDisplay is defined in countries.js
  return getCountryDisplay(countryName);
}

// Track username to user ID mapping (built from GraphQL responses)
const usernameToIdMap = new Map();

// Track user ID to country mapping
const countryCache = new Map();

// Store session parameters for API requests
let sessionParams = null;

// Track pending country requests by request ID
const pendingCountryRequests = new Map();
// Track pending country requests by user ID to prevent duplicates
const userCountryPromises = new Map();
let countryRequestId = 0;

// Debounce timer for mutation observer
let mutationDebounceTimer = null;

/**
 * Listen for GraphQL data from the interceptor script (runs in MAIN world)
 * The interceptor.js file runs in the main page context and sends us data via CustomEvent
 */
window.addEventListener('threadsGraphQLData', (event) => {
  console.log('[Threads Country Flags] 📥 Received GraphQL data event in content script');
  console.log('[Threads Country Flags] Event detail:', event.detail ? 'Present' : 'Missing');
  extractUserDataFromGraphQL(event.detail);
});

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

    // Trigger page reprocessing to add flags to newly mapped users
    processPage();
  } catch (error) {
    console.error('[Threads Country Flags] ❌ Error extracting bulk-route data:', error);
  }
}

/**
 * Extract user data from GraphQL response and build username→userID mapping
 * @param {Object} data - GraphQL response data
 */
function extractUserDataFromGraphQL(data) {
  console.log('[Threads Country Flags] 🔍 Extracting user data from GraphQL...');

  try {
    // Navigate through the feed data structure
    const edges = data?.data?.feedData?.edges || [];
    console.log(`[Threads Country Flags] Found ${edges.length} edges in feedData`);

    let usersFound = 0;

    for (const edge of edges) {
      const threadItems = edge?.text_post_app_thread?.thread_items || [];

      for (const item of threadItems) {
        const user = item?.post?.user;

        if (user && user.username && (user.pk || user.id)) {
          const userId = user.pk || user.id;
          const username = user.username;

          // Build the mapping
          usernameToIdMap.set(username, userId);
          usersFound++;

          console.log(`[Threads Country Flags] ✅ Mapped: @${username} → ${userId}`);
        }
      }
    }

    console.log(`[Threads Country Flags] 📊 Total users mapped: ${usersFound}, Total in map: ${usernameToIdMap.size}`);
  } catch (error) {
    console.error('[Threads Country Flags] ❌ Error extracting user data:', error);
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

  // Check if we already have the country in cache
  let country = countryCache.get(userId);

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
          const countryName = await Promise.race([
            responsePromise,
            new Promise(resolve => setTimeout(() => resolve(null), 10000)) // 10s timeout
          ]);

          // Convert country name to flag emoji
          const countryDisplay = countryName ? getCountryFlag(countryName) : '';
          countryCache.set(userId, countryDisplay);
          console.log(`[Threads Country Flags] 📬 Received country: "${countryDisplay}" for ${userId}`);
          return countryDisplay;
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

  // Create flag element
  const flagSpan = document.createElement('span');
  flagSpan.className = 'threads-country-flag';
  flagSpan.textContent = ` ${country}`;
  flagSpan.title = `Country: ${country}`;
  flagSpan.style.cssText = 'white-space: nowrap; display: inline; margin-left: 4px;';

  // Insert flag right after the display name text (inside the span)
  insertionPoint.appendChild(flagSpan);

  // Mark as processed after successfully adding the flag
  linkElement.setAttribute('data-threads-flag-processed', 'true');

  console.log(`[Threads Country Flags] ✅ Added flag for @${username} (${userId}): ${country}`);
}

/**
 * Process all profile links on the page
 */
function processPage() {
  const profileLinks = findProfileLinks();

  if (profileLinks.length > 0) {
    console.log(`[Threads Country Flags] Found ${profileLinks.length} profile links, ${usernameToIdMap.size} usernames mapped`);
  }

  for (const linkElement of profileLinks) {
    // Extract username from link
    const username = extractUsernameFromLink(linkElement);
    if (!username) {
      continue;
    }

    // Add flag (function internally checks if already processed before DOM operations)
    addCountryFlag(linkElement, username);
  }
}

/**
 * Handle mutations (new content added to page)
 * @param {MutationRecord[]} mutations
 */
function handleMutations(mutations) {
  // Debounce to avoid excessive processing
  clearTimeout(mutationDebounceTimer);
  mutationDebounceTimer = setTimeout(() => {
    processPage();
  }, 500);
}

/**
 * Initialize the extension
 */
function init() {
  console.log('[Threads Country Flags] Content script initialized (ISOLATED world)');
  console.log('[Threads Country Flags] Listening for GraphQL data from interceptor (MAIN world)');

  // Process initial page content
  setTimeout(() => {
    processPage();
  }, 2000); // Wait for GraphQL data to arrive

  // Set up mutation observer for dynamic content
  const observer = new MutationObserver(handleMutations);

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // // Re-process page periodically as fallback
  // setInterval(() => {
  //   processPage();
  // }, 5000);
}

// Wait for page to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

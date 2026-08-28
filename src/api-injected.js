/**
 * API functions that run in MAIN world (page context)
 * This allows us to make requests with the page's cookies and avoid CORS
 */

(function () {
  const API_ENDPOINT = 'https://www.threads.com/async/wbloks/fetch/';
  const APP_ID = 'com.bloks.www.text_post_app.about_this_profile_async_action';

  /**
   * Parse Threads API response by removing CSRF protection prefix
   * @param {string} responseText - Raw API response text
   * @returns {Object} Parsed JSON object
   */
  function parseThreadsResponse(responseText) {
    const jsonText = responseText.replace(/^for\s*\(\s*;\s*;\s*\)\s*;/, '');
    return JSON.parse(jsonText);
  }

  /**
   * Extract country and join date from API response
   * @param {Object} response - Parsed API response
   * @returns {{countryName: string|null, joinDate: number|null}|null} User info, or
   *   null on error or when the payload carries no usable data
   */
  function extractCountryFromResponse(response) {
    try {
      const data = response?.payload?.layout?.bloks_payload?.data;
      if (!Array.isArray(data)) {
        return null;
      }

      const countryData = data.find(
        item => item?.data?.key === 'THREADS_ABOUT_THIS_PROFILE:about_this_profile_country'
      );

      const visibilityData = data.find(
        item => item?.data?.key === 'THREADS_ABOUT_THIS_PROFILE:about_this_profile_country_visibility'
      );

      let countryName = null;
      const visibility = visibilityData?.data?.initial;

      if (visibility === false) {
        // User explicitly hid their country - use special marker
        countryName = '__COUNTRY_HIDDEN__';
      } else if (visibility && countryData?.data?.initial) {
        // Country is visible
        countryName = countryData.data.initial;
      }

      // Extract join date by looking for text matching pattern: 20xx year + separator + stats
      const joinDate = extractJoinDate(response);

      // Neither a country, nor an explicit "hidden", nor a join date: nothing worth
      // caching, and what a challenge/logged-out payload looks like. Report it as a
      // failure so it is never persisted for NO_COUNTRY_TTL_MS.
      if (visibilityData === undefined && joinDate === null) {
        return null;
      }

      return {
        countryName,
        joinDate
      };
    } catch (error) {
      console.error('[Threads Country Flags] Error extracting country:', error);
      return null;
    }
  }

  /**
   * Recursively walk an object and return the first "text" string matching a predicate.
   * Stops walking as soon as a match is found.
   * @param {*} obj - Object to walk
   * @param {function(string): boolean} predicate - Test function for text values
   * @returns {string|null} First matching text value, or null
   */
  function findFirstMatchingText(obj, predicate) {
    if (obj == null || typeof obj !== 'object') return null;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        const result = findFirstMatchingText(item, predicate);
        if (result !== null) return result;
      }
    } else {
      for (const key of Object.keys(obj)) {
        if (key === 'text' && typeof obj[key] === 'string') {
          if (predicate(obj[key])) return obj[key];
        } else {
          const result = findFirstMatchingText(obj[key], predicate);
          if (result !== null) return result;
        }
      }
    }
    return null;
  }

  /**
   * Extract join date timestamp from API response
   * NOTE: Returns timestamp for first day of the month (day precision not available)
   * @param {Object} response - Parsed API response
   * @returns {number|null} Unix timestamp in milliseconds, or null if not found or parsing failed
   */
  function extractJoinDate(response) {
    try {
      const datePattern = /\b20\d{2}\b/;
      const separatorPattern = /[·•]/;

      // Walk the response and stop at the first text matching the date pattern
      const dateText = findFirstMatchingText(response, value =>
        datePattern.test(value) && separatorPattern.test(value)
      );
      if (!dateText) return null;

      // Parse year and month from text
      const yearMatch = dateText.match(/20(\d{2})/);
      if (!yearMatch) return null;

      const year = parseInt('20' + yearMatch[1], 10);

      // Try to parse month - check English month names FIRST to avoid false positives
      let month = null;

      // First: Try English month names (handles "December 2025", "Dec 2025", etc.)
      const monthNames = {
        'january': 1, 'jan': 1,
        'february': 2, 'feb': 2,
        'march': 3, 'mar': 3,
        'april': 4, 'apr': 4,
        'may': 5,
        'june': 6, 'jun': 6,
        'july': 7, 'jul': 7,
        'august': 8, 'aug': 8,
        'september': 9, 'sep': 9, 'sept': 9,
        'october': 10, 'oct': 10,
        'november': 11, 'nov': 11,
        'december': 12, 'dec': 12
      };

      const lowerText = dateText.toLowerCase();
      for (const [name, num] of Object.entries(monthNames)) {
        if (lowerText.includes(name)) {
          month = num;
          break;
        }
      }

      // Second: If no English month found, extract numeric month by digit count
      // Strategy: Find 1-2 digit numbers that aren't part of the 4-digit year
      if (!month) {
        // Extract date portion (before separator to avoid matching stats like "100M+")
        const datePortion = dateText.split(/[·•]/)[0];

        // Find all 1-2 digit numbers NOT part of 4-digit sequences
        // Use negative lookbehind/lookahead to exclude digits that are part of longer numbers
        const monthCandidates = datePortion.match(/(?<!\d)\d{1,2}(?!\d)/g);

        if (monthCandidates) {
          // Find first number that's a valid month (1-12)
          for (const candidate of monthCandidates) {
            const num = parseInt(candidate, 10);
            if (num >= 1 && num <= 12) {
              month = num;
              break;
            }
          }
        }
      }

      if (!month || month < 1 || month > 12) {
        // Return null if month cannot be reliably parsed (may be unsupported locale)
        return null;
      }

      // Create date object (first day of the month) and return timestamp
      const date = new Date(year, month - 1, 1);
      return date.getTime();

    } catch (error) {
      console.error('[Threads Country Flags] Error extracting join date:', error);
      return null;
    }
  }

  /**
   * Parse a Retry-After header into milliseconds
   * Accepts both the delta-seconds and HTTP-date forms. The endpoint is same-origin
   * with the content script's match pattern, so the header needs no CORS exposure.
   * @param {string|null} value - Raw header value
   * @returns {number|null} Delay in milliseconds, or null if absent or unparseable
   */
  function parseRetryAfter(value) {
    if (!value) return null;

    const seconds = Number(value);
    if (Number.isFinite(seconds)) {
      return Math.max(0, seconds * 1000);
    }

    const date = Date.parse(value);
    if (!Number.isNaN(date)) {
      return Math.max(0, date - Date.now());
    }

    return null;
  }

  /**
   * Fetch user country and join date from Threads API
   *
   * Always resolves to a discriminated result. This file reports what happened;
   * content.js decides whether and when to retry, so no backoff policy lives here.
   * @param {string} userId - Numeric user ID
   * @param {Object} sessionParams - Session parameters captured from page
   * @returns {Promise<{ok: true, countryName: string|null, joinDate: number|null}
   *   |{ok: false, status: number|null, retryAfterMs?: number|null}>} Lookup result
   */
  async function fetchUserCountry(userId, sessionParams) {
    // Don't attempt API call if sessionParams is not set
    if (!sessionParams) {
      console.warn('[Threads Country Flags] ⚠️ sessionParams not available, skipping API call');
      return { ok: false, status: null };
    }

    try {
      const url = new URL(API_ENDPOINT);
      url.searchParams.append('appid', APP_ID);
      url.searchParams.append('type', 'app');

      // Add __bkv (versioningID) to URL if available
      if (sessionParams.__bkv) {
        url.searchParams.append('__bkv', sessionParams.__bkv);
      }

      // Replay the captured session params as form fields, except __bkv
      // (already sent as a URL param)
      const formData = new URLSearchParams();
      for (const [key, value] of Object.entries(sessionParams)) {
        if (key !== '__bkv' && value) formData.append(key, value);
      }
      formData.set('__req', Math.random().toString(16).substring(2, 4));

      // Add the params object with target_user_id
      const params = {
        atpTriggerSessionID: crypto.randomUUID(),
        referer_type: 'TextPostAppProfileOverflow',
        target_user_id: userId
      };
      formData.append('params', JSON.stringify(params));

      // Make the request (in page context, so no CORS issues)
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'Accept': '*/*',
        },
        body: formData.toString(),
        credentials: 'include'
      });

      if (!response.ok) {
        console.error(`[Threads Country Flags] ❌ API request failed: ${response.status}`);
        return {
          ok: false,
          status: response.status,
          retryAfterMs: parseRetryAfter(response.headers.get('Retry-After'))
        };
      }

      const responseText = await response.text();
      const data = parseThreadsResponse(responseText);
      const result = extractCountryFromResponse(data);

      // A 200 carrying no usable profile data is not an answer worth caching
      if (!result) {
        return { ok: false, status: response.status };
      }

      return { ok: true, countryName: result.countryName, joinDate: result.joinDate };

    } catch (error) {
      // `response` is scoped to the try, so a post-response parse throw is reported
      // as a network failure. content.js only branches on 429/401, so this is inert.
      console.error('[Threads Country Flags] ❌ Error fetching country:', error);
      return { ok: false, status: 0 };
    }
  }

  // Listen for country fetch requests from content script
  window.addEventListener('threadsRequestCountry', async (event) => {
    const { userId, sessionParams, requestId } = event.detail;

    const result = await fetchUserCountry(userId, sessionParams);

    // Send response back to content script.
    // `ok` distinguishes "API answered, no country" from "request failed" so the
    // content script only persists genuine answers; `status` lets it tell a rate
    // limit apart from a stale token, a timeout or a transient server error.
    window.dispatchEvent(new CustomEvent('threadsCountryResponse', {
      detail: {
        userId,
        ok: result.ok,
        status: result.status ?? null,
        retryAfterMs: result.retryAfterMs ?? null,
        countryName: result.countryName || null,
        joinDate: result.joinDate ?? null,
        requestId
      }
    }));
  });
})();

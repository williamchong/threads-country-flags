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
   * @returns {{countryName: string|null, joinDate: number|null}|null} User info or null on error
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
   * Extract join date timestamp from API response
   * NOTE: Returns timestamp for first day of the month (day precision not available)
   * @param {Object} response - Parsed API response
   * @returns {number|null} Unix timestamp in milliseconds, or null if not found or parsing failed
   */
  function extractJoinDate(response) {
    try {
      // Convert response to JSON string and search for date pattern
      // This is much simpler than recursive object traversal
      const responseStr = JSON.stringify(response);

      // Pattern: "text":"<date with year 20XX and separator · or •>"
      // Matches: "December 2025 · 100M+", "2025年12月 · 1 億+", "July 2023 · #14,233,984"
      // Use lookahead/lookbehind to extract just the text value
      const textPattern = /"text":"([^"]*\b20\d{2}\b[^"]*?[·•][^"]*)"/;
      const match = responseStr.match(textPattern);

      const dateText = match ? match[1] : null;
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
   * Fetch user country and join date from Threads API
   * @param {string} userId - Numeric user ID
   * @param {Object} sessionParams - Session parameters captured from page
   * @returns {Promise<{countryName: string|null, joinDate: number|null}|null>} User info or null on error
   */
  async function fetchUserCountry(userId, sessionParams) {
    // Don't attempt API call if sessionParams is not set
    if (!sessionParams) {
      console.warn('[Threads Country Flags] ⚠️ sessionParams not available, skipping API call');
      return null;
    }

    try {
      const url = new URL(API_ENDPOINT);
      url.searchParams.append('appid', APP_ID);
      url.searchParams.append('type', 'app');

      // Add __bkv (versioningID) to URL if available
      if (sessionParams.__bkv) {
        url.searchParams.append('__bkv', sessionParams.__bkv);
      }

      const formData = new URLSearchParams();

      if (sessionParams.fb_dtsg) formData.append('fb_dtsg', sessionParams.fb_dtsg);
      if (sessionParams.jazoest) formData.append('jazoest', sessionParams.jazoest);
      if (sessionParams.lsd) formData.append('lsd', sessionParams.lsd);
      formData.append('__user', sessionParams.__user || '0');
      formData.append('__a', sessionParams.__a || '1');
      formData.append('__req', Math.random().toString(16).substring(2, 4));
      if (sessionParams.__hs) formData.append('__hs', sessionParams.__hs);
      if (sessionParams.dpr) formData.append('dpr', sessionParams.dpr);
      if (sessionParams.__ccg) formData.append('__ccg', sessionParams.__ccg);
      if (sessionParams.__rev) formData.append('__rev', sessionParams.__rev);
      if (sessionParams.__s) formData.append('__s', sessionParams.__s);
      if (sessionParams.__hsi) formData.append('__hsi', sessionParams.__hsi);
      if (sessionParams.__dyn) formData.append('__dyn', sessionParams.__dyn);
      if (sessionParams.__csr) formData.append('__csr', sessionParams.__csr);
      if (sessionParams.__hsdp) formData.append('__hsdp', sessionParams.__hsdp);
      if (sessionParams.__hblp) formData.append('__hblp', sessionParams.__hblp);
      if (sessionParams.__sjsp) formData.append('__sjsp', sessionParams.__sjsp);
      if (sessionParams.__comet_req) formData.append('__comet_req', sessionParams.__comet_req);
      if (sessionParams.__spin_r) formData.append('__spin_r', sessionParams.__spin_r);
      if (sessionParams.__spin_b) formData.append('__spin_b', sessionParams.__spin_b);
      if (sessionParams.__spin_t) formData.append('__spin_t', sessionParams.__spin_t);
      if (sessionParams.__jssesw) formData.append('__jssesw', sessionParams.__jssesw);
      formData.append('__crn', sessionParams.__crn || 'comet.threads.BarcelonaProfileThreadsColumnRoute');
      formData.append('__d', sessionParams.__d || 'www');

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
        return null;
      }

      const responseText = await response.text();
      const data = parseThreadsResponse(responseText);
      const result = extractCountryFromResponse(data);

      return result;

    } catch (error) {
      console.error('[Threads Country Flags] ❌ Error fetching country:', error);
      return null;
    }
  }

  // Listen for country fetch requests from content script
  window.addEventListener('threadsRequestCountry', async (event) => {
    const { userId, sessionParams, requestId } = event.detail;

    const userInfo = await fetchUserCountry(userId, sessionParams);

    // Send response back to content script
    window.dispatchEvent(new CustomEvent('threadsCountryResponse', {
      detail: {
        userId,
        countryName: userInfo?.countryName || null,
        joinDate: userInfo?.joinDate ?? null,
        requestId
      }
    }));
  });
})();

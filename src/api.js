/**
 * Threads API client for fetching user profile data
 */

const API_ENDPOINT = 'https://www.threads.com/async/wbloks/fetch/';
const APP_ID = 'com.bloks.www.text_post_app.about_this_profile_async_action';

/**
 * Parse Threads API response (strips "for (;;);" prefix and parses JSON)
 * @param {string} responseText - Raw response text
 * @returns {Object} Parsed JSON response
 */
function parseThreadsResponse(responseText) {
  // Strip the "for (;;);" prefix
  const jsonText = responseText.replace(/^for\s*\(\s*;\s*;\s*\)\s*;/, '');
  return JSON.parse(jsonText);
}

/**
 * Extract country from API response
 * @param {Object} response - Parsed API response
 * @returns {string|null} Country name or null if not found/not shared
 */
function extractCountryFromResponse(response) {
  try {
    const data = response?.payload?.layout?.bloks_payload?.data;
    if (!Array.isArray(data)) {
      return null;
    }

    // Find the country data
    const countryData = data.find(
      item => item?.data?.key === 'THREADS_ABOUT_THIS_PROFILE:about_this_profile_country'
    );

    // Find the visibility flag
    const visibilityData = data.find(
      item => item?.data?.key === 'THREADS_ABOUT_THIS_PROFILE:about_this_profile_country_visibility'
    );

    // Only return country if it's visible and exists
    if (visibilityData?.data?.initial && countryData?.data?.initial) {
      return countryData.data.initial;
    }

    return null;
  } catch (error) {
    console.error('Error extracting country from response:', error);
    return null;
  }
}

/**
 * Fetch user country from Threads API
 * @param {string} userId - Threads user ID
 * @param {Object} sessionParams - Session parameters from actual Threads requests
 * @returns {Promise<string|null>} Country name or null
 */
export async function fetchUserCountry(userId, sessionParams = null) {
  try {
    // Build the request URL
    const url = new URL(API_ENDPOINT);
    url.searchParams.append('appid', APP_ID);
    url.searchParams.append('type', 'app');

    // Add __bkv (versioningID) to URL if available
    if (sessionParams && sessionParams.__bkv) {
      url.searchParams.append('__bkv', sessionParams.__bkv);
      console.log('[API] Using versioningID as __bkv:', sessionParams.__bkv.substring(0, 16) + '...');
    }

    // Build form data with session parameters
    const formData = new URLSearchParams();

    // Use session parameters if available, otherwise use defaults
    if (sessionParams) {
      if (sessionParams.fb_dtsg) formData.append('fb_dtsg', sessionParams.fb_dtsg);
      if (sessionParams.jazoest) formData.append('jazoest', sessionParams.jazoest);
      if (sessionParams.lsd) formData.append('lsd', sessionParams.lsd);
      formData.append('__user', sessionParams.__user || '0');
      formData.append('__a', sessionParams.__a || '1');
      formData.append('__req', sessionParams.__req || 'ce');
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
      if (sessionParams.__comet_req) formData.append('__comet_req', sessionParams.__comet_req);
      if (sessionParams.__spin_r) formData.append('__spin_r', sessionParams.__spin_r);
      if (sessionParams.__spin_b) formData.append('__spin_b', sessionParams.__spin_b);
      if (sessionParams.__spin_t) formData.append('__spin_t', sessionParams.__spin_t);
      if (sessionParams.__jssesw) formData.append('__jssesw', sessionParams.__jssesw);
      formData.append('__crn', 'comet.threads.BarcelonaProfileThreadsColumnRoute');
      formData.append('__d', sessionParams.__d || 'www');
      console.log('[API] Using captured session parameters');
    } else {
      formData.append('__user', '0');
      formData.append('__a', '1');
      formData.append('__req', 'ce');
      formData.append('__d', 'www');
      console.log('[API] Warning: No session parameters available, using defaults');
    }

    // Add the params object with target_user_id
    const params = {
      atpTriggerSessionID: crypto.randomUUID(),
      referer_type: 'TextPostAppProfileOverflow',
      target_user_id: userId
    };
    formData.append('params', JSON.stringify(params));

    // Make the request
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Accept': '*/*',
        'Origin': 'https://www.threads.com',
        'Referer': 'https://www.threads.com/',
      },
      body: formData.toString(),
      credentials: 'include' // Include cookies for authentication
    });

    if (!response.ok) {
      console.error(`API request failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const responseText = await response.text();
    const data = parseThreadsResponse(responseText);
    return extractCountryFromResponse(data);

  } catch (error) {
    console.error('Error fetching user country:', error);
    return null;
  }
}

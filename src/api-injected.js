/**
 * API functions that run in MAIN world (page context)
 * This allows us to make requests with the page's cookies and avoid CORS
 */

(function () {
  const API_ENDPOINT = 'https://www.threads.com/async/wbloks/fetch/';
  const APP_ID = 'com.bloks.www.text_post_app.about_this_profile_async_action';

  function parseThreadsResponse(responseText) {
    const jsonText = responseText.replace(/^for\s*\(\s*;\s*;\s*\)\s*;/, '');
    return JSON.parse(jsonText);
  }

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

      if (visibilityData?.data?.initial && countryData?.data?.initial) {
        return countryData.data.initial;
      }

      return null;
    } catch (error) {
      console.error('[Threads Country Flags] Error extracting country:', error);
      return null;
    }
  }

  async function fetchUserCountry(userId, sessionParams) {
    try {
      const url = new URL(API_ENDPOINT);
      url.searchParams.append('appid', APP_ID);
      url.searchParams.append('type', 'app');

      // Add __bkv (versioningID) to URL if available
      if (sessionParams && sessionParams.__bkv) {
        url.searchParams.append('__bkv', sessionParams.__bkv);
      }

      const formData = new URLSearchParams();

      if (sessionParams) {
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
      } else {
        formData.append('__user', '0');
        formData.append('__a', '1');
        formData.append('__req', Math.random().toString(16).substring(2, 4));
        formData.append('__crn', 'comet.threads.BarcelonaProfileThreadsColumnRoute');
        formData.append('__d', 'www');
      }

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
      const country = extractCountryFromResponse(data);

      return country;

    } catch (error) {
      console.error('[Threads Country Flags] ❌ Error fetching country:', error);
      return null;
    }
  }

  // Listen for country fetch requests from content script
  window.addEventListener('threadsRequestCountry', async (event) => {
    const { userId, sessionParams, requestId } = event.detail;

    const countryName = await fetchUserCountry(userId, sessionParams);

    // Send response back to content script
    window.dispatchEvent(new CustomEvent('threadsCountryResponse', {
      detail: {
        userId,
        countryName,
        requestId
      }
    }));
  });
})();

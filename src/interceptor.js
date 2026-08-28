/**
 * Fetch and XMLHttpRequest interceptor that runs in MAIN world (page context)
 * This can intercept the page's fetch/XHR calls and extract GraphQL data
 */

(function () {
  // Session parameters forwarded verbatim from the page's own requests.
  // api-injected.js replays whatever keys it receives, so this is the single
  // place that decides which parameters are captured.
  const SESSION_PARAM_KEYS = [
    'jazoest', 'lsd', '__user', '__a', '__hs', 'dpr', '__ccg', '__rev',
    '__s', '__hsi', '__dyn', '__csr', '__hsdp', '__hblp', '__sjsp', '__comet_req',
    '__spin_r', '__spin_b', '__spin_t', '__jssesw', '__crn', '__d'
  ];
  const SESSION_PARAM_DEFAULTS = {
    __user: '0',
    __a: '1',
    __d: 'www',
    __crn: 'comet.threads.BarcelonaProfileThreadsColumnRoute'
  };

  // Rescans allowed after the document has loaded before we accept the ID isn't coming
  const MAX_VERSIONING_ID_MISSES = 3;

  let cachedVersioningID = null;
  let versioningIDMisses = 0;

  /**
   * Extract versioningID from page scripts.
   * The ID is in the initial HTML, so a miss before load proves nothing. __bkv is
   * optional at the call site, so a wrong latch degrades every later request silently -
   * hence a miss budget rather than latching on the first post-load miss.
   * @returns {string|null} versioningID value
   */
  function extractVersioningID() {
    if (cachedVersioningID || versioningIDMisses >= MAX_VERSIONING_ID_MISSES) {
      return cachedVersioningID;
    }

    try {
      // Search in all script tags for WebBloksVersioningID
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent;
        if (content && content.includes('WebBloksVersioningID')) {
          // Match pattern: ["WebBloksVersioningID",[],{"versioningID":"..."}
          const match = content.match(/"versioningID":"([a-f0-9]+)"/);
          if (match) {
            cachedVersioningID = match[1];
            return cachedVersioningID;
          }
        }
      }

      if (document.readyState === 'complete') versioningIDMisses++;
      return null;
    } catch (error) {
      console.error('[Threads Country Flags] Error extracting versioningID:', error);
      return null;
    }
  }

  /**
   * Extract session parameters from request body
   * @param {string} body - Request body
   * @returns {Object} Session parameters
   */
  function extractSessionParams(body) {
    try {
      const params = new URLSearchParams(body);

      const sessionParams = {
        fb_dtsg: params.get('fb_dtsg') || params.get('fb_dtsg_ag') || '',
        __bkv: extractVersioningID() || '' // versioningID, sent as a URL param
      };
      for (const key of SESSION_PARAM_KEYS) {
        sessionParams[key] = params.get(key) || SESSION_PARAM_DEFAULTS[key] || '';
      }

      return sessionParams;
    } catch (error) {
      console.error('[Threads Country Flags] Error extracting session params:', error);
      return null;
    }
  }

  // ===== XMLHttpRequest Interceptor =====
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._url = url;
    this._method = method;
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    const url = this._url;

    // Intercept /bulk-route-definitions for username → user_id mapping
    if (typeof url === 'string' && url.includes('/bulk-route-definitions')) {
      const requestBody = args[0];

      if (requestBody) {
        const sessionParams = extractSessionParams(requestBody);
        if (sessionParams && sessionParams.fb_dtsg) {
          window.dispatchEvent(new CustomEvent('threadsSessionParams', {
            detail: sessionParams
          }));
        }
      }

      // Use addEventListener (additive) instead of replacing onreadystatechange
      // so the page's own handler is never dropped, even if set after send()
      this.addEventListener('readystatechange', function () {
        if (this.readyState === 4 && this.status === 200) {
          try {
            // Remove "for (;;);" prefix if exists (Facebook's CSRF protection)
            let responseText = this.responseText;
            if (responseText.startsWith('for (;;);')) {
              responseText = responseText.substring(9);
            }

            const response = JSON.parse(responseText);

            // Send combined request + response to content script
            window.dispatchEvent(new CustomEvent('threadsBulkRouteData', {
              detail: {
                requestBody: requestBody,
                response: response
              }
            }));
          } catch {
            // Silently ignore parse errors for non-JSON responses
          }
        }
      });
    }

    return originalSend.apply(this, args);
  };

})();

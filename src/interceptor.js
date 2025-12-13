/**
 * Fetch and XMLHttpRequest interceptor that runs in MAIN world (page context)
 * This can intercept the page's fetch/XHR calls and extract GraphQL data
 */

(function () {
  console.log('[Threads Country Flags] Interceptor script starting...');
  let sessionParamsCaptured = false;

  /**
   * Extract versioningID from page scripts
   * @returns {string|null} versioningID value
   */
  function extractVersioningID() {
    try {
      // Search in all script tags for WebBloksVersioningID
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent;
        if (content && content.includes('WebBloksVersioningID')) {
          // Match pattern: ["WebBloksVersioningID",[],{"versioningID":"..."}
          const match = content.match(/"versioningID":"([a-f0-9]+)"/);
          if (match) {
            return match[1];
          }
        }
      }
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

      // Extract versioningID from page if not already extracted
      const versioningID = extractVersioningID();

      return {
        fb_dtsg: params.get('fb_dtsg') || params.get('fb_dtsg_ag') || '',
        jazoest: params.get('jazoest') || '',
        lsd: params.get('lsd') || '',
        __user: params.get('__user') || '0',
        __a: params.get('__a') || '1',
        __req: params.get('__req') || '',
        __hs: params.get('__hs') || '',
        dpr: params.get('dpr') || '',
        __ccg: params.get('__ccg') || '',
        __rev: params.get('__rev') || '',
        __s: params.get('__s') || '',
        __hsi: params.get('__hsi') || '',
        __dyn: params.get('__dyn') || '',
        __csr: params.get('__csr') || '',
        __hsdp: params.get('__hsdp') || '',
        __hblp: params.get('__hblp') || '',
        __sjsp: params.get('__sjsp') || '',
        __comet_req: params.get('__comet_req') || '',
        __spin_r: params.get('__spin_r') || '',
        __spin_b: params.get('__spin_b') || '',
        __spin_t: params.get('__spin_t') || '',
        __jssesw: params.get('__jssesw') || '',
        __crn: params.get('__crn') || '',
        __d: params.get('__d') || 'www',
        __bkv: versioningID || '' // Add versioningID as __bkv
      };
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
      console.log(`[Threads Country Flags] 🎯 bulk-route-definitions request detected!`);

      // Capture request body to extract usernames from route_urls
      const requestBody = args[0];

      // Capture session parameters if not already captured
      if (!sessionParamsCaptured && requestBody) {
        const sessionParams = extractSessionParams(requestBody);
        if (sessionParams && sessionParams.fb_dtsg) {
          window.dispatchEvent(new CustomEvent('threadsSessionParams', {
            detail: sessionParams
          }));
          sessionParamsCaptured = true;
          console.log('[Threads Country Flags] 📋 Session parameters captured and sent (XHR)');
        }
      }

      const originalOnReadyStateChange = this.onreadystatechange;

      this.onreadystatechange = function () {
        if (this.readyState === 4 && this.status === 200) {
          try {
            // Remove "for (;;);" prefix if exists (Facebook's CSRF protection)
            let responseText = this.responseText;
            if (responseText.startsWith('for (;;);')) {
              responseText = responseText.substring(9);
              console.log('[Threads Country Flags] Removed "for (;;);" prefix');
            }

            const response = JSON.parse(responseText);
            console.log('[Threads Country Flags] ✅ bulk-route-definitions response parsed');

            // Send combined request + response to content script
            window.dispatchEvent(new CustomEvent('threadsBulkRouteData', {
              detail: {
                requestBody: requestBody,
                response: response
              }
            }));
            console.log('[Threads Country Flags] 📤 bulk-route-definitions data sent to content script');
          } catch (error) {
            console.error('[Threads Country Flags] ❌ Error parsing bulk-route-definitions:', error);
          }
        }

        if (originalOnReadyStateChange) {
          return originalOnReadyStateChange.apply(this, arguments);
        }
      };
    }

    return originalSend.apply(this, args);
  };

  console.log('[Threads Country Flags] ✅ XMLHttpRequest interceptor installed');
  console.log('[Threads Country Flags] 🚀 All interceptors ready in MAIN world');
})();

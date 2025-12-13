/**
 * Background service worker for Threads Country Flags extension
 * Handles API calls, caching, and message passing
 */

/**
 * Clear all caches
 */
async function clearAllCaches() {
  try {
    await chrome.storage.local.clear();
  } catch (error) {
    console.error('Error clearing storage:', error);
  }
}

// Message handler for content script requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CLEAR_CACHE') {
    clearAllCaches().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'GET_STATS') {
    sendResponse(getCacheStats());
    return false;
  }
});

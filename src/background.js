/**
 * Background service worker for Threads Country Flags extension
 * Handles API calls, caching, and message passing
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
});

/**
 * Background service worker for Threads Country Flags extension
 * Handles API calls, caching, and message passing
 */

const STORAGE_PREFIX = 'country_';

async function clearAllCaches() {
  try {
    const allItems = await chrome.storage.local.get(null);
    const countryKeys = Object.keys(allItems).filter(key => key.startsWith(STORAGE_PREFIX));
    await chrome.storage.local.remove(countryKeys);
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

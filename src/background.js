/**
 * Background service worker for Threads Country Flags extension
 * Handles API calls, caching, and message passing
 */

import { LRUCache } from './cache.js';
import { fetchUserCountry } from './api.js';

// In-memory LRU cache for fast access
const memoryCache = new LRUCache(500);

// Track ongoing requests to prevent duplicates
const pendingRequests = new Map();

// Storage keys
const STORAGE_PREFIX = 'country_';

/**
 * Get country from storage (chrome.storage.local)
 * @param {string} userId
 * @returns {Promise<string|null>}
 */
async function getFromStorage(userId) {
  try {
    const key = STORAGE_PREFIX + userId;
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
  } catch (error) {
    console.error('Error reading from storage:', error);
    return null;
  }
}

/**
 * Save country to storage (chrome.storage.local)
 * @param {string} userId
 * @param {string} country
 */
async function saveToStorage(userId, country) {
  try {
    const key = STORAGE_PREFIX + userId;
    await chrome.storage.local.set({ [key]: country });
  } catch (error) {
    console.error('Error saving to storage:', error);
  }
}

/**
 * Get user country with two-tier caching
 * @param {string} userId - Threads user ID
 * @param {Object} sessionParams - Session parameters for API request
 * @returns {Promise<string|null>} Country display (flag or plain text)
 */
async function getUserCountry(userId, sessionParams = null) {
  // Check memory cache first (fastest)
  const cachedCountry = memoryCache.get(userId);
  if (cachedCountry !== null) {
    console.log(`[Cache Hit - Memory] User ${userId}: ${cachedCountry}`);
    return cachedCountry;
  }

  // Check if there's already a pending request for this user
  if (pendingRequests.has(userId)) {
    console.log(`[Dedup] Waiting for existing request for user ${userId}`);
    return pendingRequests.get(userId);
  }

  // Create new request
  const requestPromise = (async () => {
    try {
      // Check storage cache (second tier)
      const storedCountry = await getFromStorage(userId);
      if (storedCountry !== null) {
        console.log(`[Cache Hit - Storage] User ${userId}: ${storedCountry}`);
        // Update memory cache
        memoryCache.set(userId, storedCountry);
        return storedCountry;
      }

      // Cache miss - fetch from API
      console.log(`[API Fetch] Fetching country for user ${userId}`);
      const countryName = await fetchUserCountry(userId, sessionParams);

      if (countryName) {
        // Save raw country data to both caches
        memoryCache.set(userId, countryName);
        await saveToStorage(userId, countryName);

        console.log(`[API Success] User ${userId}: ${countryName}`);
        return countryName;
      } else {
        // No country data available - cache the negative result
        const noData = '';
        memoryCache.set(userId, noData);
        await saveToStorage(userId, noData);

        console.log(`[API Success] User ${userId}: No country data`);
        return noData;
      }
    } catch (error) {
      console.error(`[API Error] User ${userId}:`, error);
      return null;
    } finally {
      // Remove from pending requests
      pendingRequests.delete(userId);
    }
  })();

  // Store pending request
  pendingRequests.set(userId, requestPromise);

  return requestPromise;
}

/**
 * Clear all caches
 */
async function clearAllCaches() {
  memoryCache.clear();
  try {
    await chrome.storage.local.clear();
    console.log('[Cache] All caches cleared');
  } catch (error) {
    console.error('Error clearing storage:', error);
  }
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  return {
    memorySize: memoryCache.size(),
    pendingRequests: pendingRequests.size
  };
}

// Message handler for content script requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_COUNTRY') {
    const { userId, sessionParams } = message;
    getUserCountry(userId, sessionParams).then(country => {
      sendResponse({ country });
    });
    return true; // Keep message channel open for async response
  }

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

console.log('[Background] Threads Country Flags extension loaded');

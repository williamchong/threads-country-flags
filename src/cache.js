/**
 * LRU (Least Recently Used) Cache implementation
 * Provides O(1) get and set operations
 */
export class LRUCache {
  constructor(maxSize = 500) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  /**
   * Get value from cache
   * @param {string} key
   * @returns {any|null} Value if found, null otherwise
   */
  get(key) {
    if (!this.cache.has(key)) {
      return null;
    }

    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  /**
   * Set value in cache
   * @param {string} key
   * @param {any} value
   */
  set(key, value) {
    // Delete if exists (to reinsert at end)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Add to end
    this.cache.set(key, value);

    // Evict oldest if over max size
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  /**
   * Check if key exists in cache
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Clear all entries
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get current cache size
   * @returns {number}
   */
  size() {
    return this.cache.size;
  }
}

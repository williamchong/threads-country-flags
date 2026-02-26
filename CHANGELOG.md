# Changelog

## v1.0.3 (2026-02-26)

**Bug Fixes:**
- Fixed memory leak where `pendingCountryRequests` retained resolver callbacks indefinitely when the 10s API timeout fired before a response arrived
- Fixed session parameters becoming stale after token rotation — removed the one-time capture flag so `fb_dtsg` and friends are refreshed on every intercepted request
- Replaced blocking `alert()` on cache clear failure with an inline error message, consistent with the success message pattern

**Improvements:**
- Expanded country mappings from ~50 to ~150 countries, adding full coverage for Middle East, Africa, Eastern Europe, Central Asia, Latin America, and small European states — each with English, native name, and Chinese (Simplified + Traditional) variants
- Fixed popup storage bytes stat to measure only country cache entries, consistent with the cached countries count shown alongside it

**Cleanup:**
- Removed dead `'unknown'` guard in cache-save logic (API never returns that string)
- Removed unreachable `visibilitychange` listener in popup (popups don't persist in background)
- Removed redundant `web_accessible_resources` entry for CSS (already injected via `content_scripts`)
- Removed redundant `isProfileLink()` check inside `observeLinksInNode` (selector already enforces the same conditions)

## v1.0.2 (2026-02-19)

**Bug Fixes:**
- Fixed nullish coalescing (`||` → `??`) for `joinDate` and `countryName` to correctly handle falsy-but-valid values

**Performance:**
- Scoped MutationObserver to only search within newly added DOM nodes instead of re-querying the entire DOM
- Added `requestAnimationFrame` debouncing to batch rapid DOM mutations
- Cache "no country" API results with 1-day TTL to avoid repeated API calls for users without public country data

## v1.0.1 (2026-01-22)

**New Features:**
- **Pirate Flag for Hidden Country**: Shows 🏴‍☠️ when users explicitly hide their country location (tooltip: "Country hidden")
- **New User Badge Without Country**: Now displays 🔰 badge even when country info is unavailable, as long as join date indicates a new user

**Changes:**
- `api-injected.js`: Added detection for `visibility === false` to return `__COUNTRY_HIDDEN__` marker
- `content.js`: Added `COUNTRY_HIDDEN_MARKER` and `PIRATE_FLAG` constants
- `content.js`: Updated `countryNameToFlag()` to return pirate flag for hidden countries
- `content.js`: Refactored display logic to show new user badge independently of country info

## v1.0.0 (2025-12-29)

**Initial Release**
- Two-world architecture (MAIN + ISOLATED)
- Country flag display with multilingual support (50+ countries)
- LRU caching and persistent storage
- Intersection Observer for performance optimization
- New user badge (🔰) for accounts joined within 60 days
- Popup UI with statistics and cache management

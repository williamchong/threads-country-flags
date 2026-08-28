# Changelog

## v1.1.3 (2026-08-28)

**Bug Fixes:**
- Flags now render on Windows. Chrome on Windows falls back to Segoe UI Emoji, which ships no regional-indicator ligatures, so every flag appeared as two boxed letters ("US" instead of 🇺🇸). The extension now bundles a flag-only Twemoji colour font and applies it when a runtime canvas probe finds the browser cannot draw flags natively; platforms with working flag emoji are left untouched.
- Flags no longer go missing on links that were already on screen when their user ID arrived. `IntersectionObserver` reports only threshold crossings, so such a link never received a second callback; the viewport dwell timer now re-arms and retries, covering a late user ID, late session parameters, and a display name that has not rendered yet.
- Transient API failures (timeouts, HTTP errors, missing session tokens, unusable payloads) are no longer cached anywhere. Previously they could mark a link terminal and suppress its flag until reload; the link now stays eligible for retry.
- A profile response carrying neither country field is now treated as a missing profile rather than as "no country", so a partial or malformed payload is not stored as a definitive answer.
- A signed-out tab no longer hammers the API. threads.com answers a signed-out request with HTTP 200 and its HTML login page, which fails to parse but reads as a success; that case is now detected and throttled instead of retried on every scroll pass.
- Profiles that can never be read — deleted accounts, and responses carrying no profile at all — are now recorded as a definitive "no country" answer for 24 hours instead of being retried indefinitely. Each one was previously re-requested four times per viewport dwell and again on every scroll pass, for as long as the tab stayed open.
- Rate-limit backoff now always starts at its full 30s. A 429 answering a request that was already in flight when an authentication or server cooldown took effect could start the ramp at 15s instead.

**Improvements:**
- Added request throttling after failed lookups. Rate limits (429) back off exponentially from 30s to 5min and honour `Retry-After`; authentication failures wait 15s; server errors and network failures wait 5s. Cached flags keep rendering throughout — only new lookups are suppressed.
- `IntersectionObserver` observations are released once a link reaches a state no further attempt can improve, and links detached from the page are released as well, bounding retention during a sustained outage.
- Removed `linksAwaitingSession`, now covered by the viewport retry chain.
- The `versioningID` lookup now retries a few times after page load before giving up, rather than dropping the `__bkv` request parameter for the rest of the page's life on a single miss.
- Optimized the Chrome Web Store listing for search in English and Traditional Chinese. The extension name and summary shown in the store and browser toolbar are now longer and more descriptive, and the stated country coverage is corrected to 138.

## v1.1.2 (2026-08-28)

**Bug Fixes:**
- Failed country lookups (timeouts, HTTP errors, missing session tokens) are no longer written to persistent storage as "no country", which previously hid flags for up to 24 hours after a transient error

**Improvements:**
- Removed the background service worker — the popup now clears the cache directly via `chrome.storage`
- Moved the multilingual country lookup table into `src/country-mappings.js`, halving `content.js`
- Single `isProfileLink()` predicate for both initial scan and mutation-added links (removed duplicate `findProfileLinks()`)
- Session parameters are captured from one key list in `interceptor.js` and replayed generically by `api-injected.js`
- `versioningID` lookup no longer rescans page scripts on every request when the ID is absent
- Hoisted timing/threshold magic numbers into named constants
- ESLint `no-unused-vars` promoted to error
- Flag styling now comes solely from `styles.css` (inline-block, fade-in); removed the conflicting inline style

## v1.1.1 (2026-04-08)

**New Features:**
- Added privacy policy page (`PRIVACY.md`) and linked it from the popup footer alongside GitHub and Support links

**Improvements:**
- Fixed XHR interception to use `addEventListener` instead of replacing `onreadystatechange`, preventing dropped handlers when Threads sets them after `send()`
- Completed i18n coverage: tooltip strings ("Country hidden", "New user") now use `chrome.i18n.getMessage()` with translations for both English and Traditional Chinese
- Date formatting now respects the browser's UI language instead of hardcoding `en-US`
- Optimized API response parsing with early-exit recursive walk, reducing main-thread work per country lookup
- Removed redundant "location" wording from English short description
- Cleaned up console output by removing debug logging from production code

## v1.1.0 (2026-03-03)

**New Features:**
- Added internationalization (i18n) support using Chrome's `chrome.i18n` API — extension name, description, and popup UI are now fully localized
- Added Traditional Chinese (`zh_TW`) locale
- Optimized Chrome Web Store description for better discoverability

**Improvements:**
- Popup sets `<html lang>` dynamically from user's browser language for accessibility
- English fallback text in popup HTML prevents empty flash before JS loads
- Consolidated button reset logic using `finally` block

## v1.0.4 (2026-02-28)

**Bug Fixes:**
- Fixed duplicate flags appearing in posts — `observeLinksInNode` was observing post/timestamp links (`/@user/post/ID`) in addition to profile links, causing up to 3 flags per post instead of 1

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

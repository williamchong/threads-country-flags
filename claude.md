# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Chrome extension (Manifest V3) that displays country flags next to usernames on Threads.com. No build step, no dependencies — vanilla JS loaded directly by Chrome.

**Version**: 1.1.1

## Development

No bundler or build process. To test changes, load the extension in Chrome via `chrome://extensions` → "Load unpacked" → select this repo's root directory. Reload the extension after code changes.

```bash
npm run lint       # Run ESLint on src/
npm run lint:fix   # Auto-fix fixable lint issues
npm run package    # Create threads-country-flags.zip for Chrome Web Store
```

## Architecture

### Two-World Design

The extension runs scripts in two Chrome extension "worlds" that communicate via `CustomEvent` dispatches on `window`:

- **MAIN world** (`src/interceptor.js`, `src/api-injected.js`): Runs in the page's JS context. Required because Threads doesn't expose user IDs in the DOM, and the country API needs the page's session cookies.
- **ISOLATED world** (`src/content.js`): Safe DOM manipulation. Observes profile links, manages caching, injects flag elements.

### Data Flow

```
interceptor.js (MAIN) → intercepts XHR to /bulk-route-definitions
  → extracts username→userID mappings + session params (fb_dtsg, lsd, jazoest)
  → dispatches threadsBulkRouteData / threadsSessionParams events

content.js (ISOLATED) → IntersectionObserver detects visible profile links
  → waits 1s in viewport → checks LRU cache → checks chrome.storage.local
  → if miss: dispatches threadsRequestCountry event

api-injected.js (MAIN) → calls Threads "About This Profile" API with session cookies
  → strips for(;;); CSRF prefix, parses JSON
  → extracts country name + join date + visibility
  → dispatches threadsCountryResponse event

content.js (ISOLATED) → receives country data → converts to flag emoji → injects into DOM
```

### Profile Link Filtering

Only links matching `a[href*="/@"][role="link"]` where href **ends** with `/@username` (no `/post/...` suffix) are processed. This is enforced by `isProfileLink()` — both `findProfileLinks()` and `observeLinksInNode()` must use this check to prevent flags on timestamp/post-content links.

Additional filters: `shouldSkipImageLink()` skips image-only links (profile pictures), `closest('h1')` skips page headers.

### Caching

- **In-memory**: LRU caches with size limits (`MAX_USERNAME_CACHE_SIZE=1000`, `MAX_COUNTRY_CACHE_SIZE=500`)
- **Persistent**: `chrome.storage.local` with `country_` prefix. Stores `{countryName, joinDate, cachedAt}`
- **No-country TTL**: "No country" results cached with `cachedAt` timestamp, expire after 1 day (`NO_COUNTRY_TTL_MS`) to allow retries
- **Country data**: Never expires (rarely changes)

### Country Resolution

API responses are locale-sensitive (e.g., "香港", "Hong Kong", "Estados Unidos"). `COUNTRY_MAPPINGS` in content.js maps ~150 countries in multiple languages to ISO 3166-1 alpha-2 codes, then converts to Unicode flag emojis via regional indicator symbols (char code + 127397).

Special cases:
- Hidden country (user opted out): returns `__COUNTRY_HIDDEN__` → displays 🏴‍☠️
- New user (joined within 60 days): displays 🔰 badge (shown even without country data)
- Unknown country name: displays `{Country Name}` as fallback

### Request Deduplication

`userCountryPromises` Map ensures only one API call per user ID. Concurrent callers await the same promise. `pendingCountryRequests` Map tracks request ID → resolve callback for event-based response routing.

### API Details

**Endpoint**: `https://www.threads.com/async/wbloks/fetch/?appid=com.bloks.www.text_post_app.about_this_profile_async_action`

**Response keys in `payload.layout.bloks_payload.data[]`**:
- `THREADS_ABOUT_THIS_PROFILE:about_this_profile_country` — country name
- `THREADS_ABOUT_THIS_PROFILE:about_this_profile_country_visibility` — whether country is public
- `THREADS_ABOUT_THIS_PROFILE:about_this_profile_date_joined` — join date string

Session parameters (`fb_dtsg`, `lsd`, `jazoest`, `__bkv`) are refreshed on every intercepted XHR request to handle token rotation.

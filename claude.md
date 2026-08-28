# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Chrome extension (Manifest V3) that displays country flags next to usernames on Threads.com. No build step, no dependencies — vanilla JS loaded directly by Chrome.

**Version**: 1.1.2

## Development

No bundler. Chrome loads `src/` directly; the only generated file is
`src/flag-font.css` (see [Flag Glyph Rendering](#flag-glyph-rendering)), which is
committed, so a checkout needs no build step. To test changes, load the extension
in Chrome via `chrome://extensions` → "Load unpacked" → select this repo's root
directory. Reload the extension after code changes.

```bash
npm run lint             # Run ESLint on src/
npm run lint:fix         # Auto-fix fixable lint issues
npm run package          # Create threads-country-flags.zip for Chrome Web Store
npm run build:flag-font  # Regenerate src/flag-font.css (only when the font changes)
```

## Architecture

### Two-World Design

The extension runs scripts in two Chrome extension "worlds" that communicate via `CustomEvent` dispatches on `window`:

- **MAIN world** (`src/interceptor.js`, `src/api-injected.js`): Runs in the page's JS context. Required because Threads doesn't expose user IDs in the DOM, and the country API needs the page's session cookies.
- **ISOLATED world** (`src/country-mappings.js`, `src/content.js`): Safe DOM manipulation. Observes profile links, manages caching, injects flag elements. `country-mappings.js` is loaded first and exposes `COUNTRY_MAPPINGS` as a shared global.

### Data Flow

```
interceptor.js (MAIN) → intercepts XHR to /bulk-route-definitions
  → extracts username→userID mappings + session params (fb_dtsg, lsd, jazoest)
  → dispatches threadsBulkRouteData / threadsSessionParams events

content.js (ISOLATED) → IntersectionObserver detects visible profile links
  → waits 1s in viewport → checks LRU cache → checks chrome.storage.local
  → if miss: dispatches threadsRequestCountry event
  → if the data isn't there yet: retries while the link stays in view

api-injected.js (MAIN) → calls Threads "About This Profile" API with session cookies
  → strips for(;;); CSRF prefix, parses JSON
  → extracts country name + join date + visibility
  → dispatches threadsCountryResponse event

content.js (ISOLATED) → receives country data → converts to flag emoji → injects into DOM
```

### Profile Link Filtering

Only links matching `a[href*="/@"][role="link"]` where href **ends** with `/@username` (no `/post/...` suffix) are processed. This is enforced by `isProfileLink()` (using `PROFILE_HREF_RE`), the single predicate used by `observeLinksInNode()` for both the initial scan and mutation-added nodes, to prevent flags on timestamp/post-content links.

Additional filters: `shouldSkipImageLink()` skips image-only links (profile pictures), `closest('h1')` skips page headers.

### Caching

- **In-memory**: LRU caches with size limits (`MAX_USERNAME_CACHE_SIZE=1000`, `MAX_COUNTRY_CACHE_SIZE=500`)
- **Persistent**: `chrome.storage.local` with `country_` prefix. Stores `{countryName, joinDate, cachedAt}`
- **No-country TTL**: "No country" results cached with `cachedAt` timestamp, expire after 1 day (`NO_COUNTRY_TTL_MS`) to allow retries
- **Failures are not persisted**: the API response carries `ok`; timeouts, HTTP errors and missing session params are kept in the in-memory cache only (so a page reload retries) and never written to `chrome.storage.local`
- **Country data**: Never expires (rarely changes)

### Viewport Retries

IntersectionObserver only reports threshold crossings, so a link already in view
when its user ID arrives gets no further callback of its own. `startViewAttempts()`
therefore re-arms the dwell timer instead of giving up after one attempt:
`addCountryFlag()` returns whether the link reached a state no further attempt can
improve, and the chain retries up to `MAX_VIEW_RETRIES` times, `VIEW_RETRY_MS`
apart, covering a late user ID, late session params, and a display name that
hasn't rendered yet.

Chains are keyed by link in the `pendingViewChains` WeakMap, so a detached link
stays collectable and the observer's "left viewport" branch cancels the chain.

### Country Resolution

API responses are locale-sensitive (e.g., "香港", "Hong Kong", "Estados Unidos"). `COUNTRY_MAPPINGS` in `src/country-mappings.js` maps ~150 countries in multiple languages to ISO 3166-1 alpha-2 codes, then converts to Unicode flag emojis via regional indicator symbols (char code + 127397).

Special cases:
- Hidden country (user opted out): returns `__COUNTRY_HIDDEN__` → displays 🏴‍☠️
- New user (joined within 60 days): displays 🔰 badge (shown even without country data)
- Unknown country name: displays `{Country Name}` as fallback

### Flag Glyph Rendering

Chrome on Windows resolves emoji to Segoe UI Emoji, which carries no
regional-indicator ligatures, so `🇺🇸` renders as two boxed letters. The extension
bundles **Twemoji Country Flags**, a flag-only COLR font, in `src/flag-font.css`.

- The font is **inlined as a base64 `data:` URI**, not loaded via
  `chrome.runtime.getURL()`. threads.com sends `font-src data: static.cdninstagram.com`,
  which does not cover `chrome-extension://`, but does allow `data:`. This also
  avoids needing `web_accessible_resources`. Regenerate with `npm run build:flag-font`.
- `unicode-range` is limited to `U+1F1E6-1F1FF`. The upstream polyfill also claims
  `U+1F3F4` for subdivision flags; this font has no pirate ZWJ sequence, so
  claiming it would split 🏴‍☠️ into a black flag plus a skull across two fonts.
- Applied by **runtime detection, not platform sniffing**. `isColorGlyph()` in
  `content.js` draws text to a 1×1 canvas in white and again in black: a colour
  font ignores `fillStyle` so the two passes match, while monochrome letter boxes
  differ. `init()` records the result; `needsBundledFont()` reads it per flag.
- The `.threads-country-flag-glyph` wrapper is created **only when the bundled
  font is actually needed**. It scopes the font to the glyph, leaving 🔰, 🏴‍☠️ and
  the `{Country Name}` fallback on the page's font; everywhere else the badge
  stays the original single text node.
- `PATCHY_FLAG_CODES` (currently `XK`) is probed individually, because Kosovo is
  user-assigned rather than ISO 3166-1 and vendor coverage varies — Apple ships a
  glyph, so it must not be overridden blindly.

### Request Deduplication

`userCountryPromises` Map ensures only one API call per user ID. Concurrent callers await the same promise. `pendingCountryRequests` Map tracks request ID → resolve callback for event-based response routing.

### API Details

**Endpoint**: `https://www.threads.com/async/wbloks/fetch/?appid=com.bloks.www.text_post_app.about_this_profile_async_action`

**Response keys in `payload.layout.bloks_payload.data[]`**:
- `THREADS_ABOUT_THIS_PROFILE:about_this_profile_country` — country name
- `THREADS_ABOUT_THIS_PROFILE:about_this_profile_country_visibility` — whether country is public
- Join date: not read from a keyed entry. `extractJoinDate()` walks the payload for the first `text` value containing a `20xx` year and a `·`/`•` separator (e.g. "December 2025 · 12 posts") and parses month/year from it

Session parameters (`fb_dtsg`, `lsd`, `jazoest`, `__bkv`) are refreshed on every intercepted XHR request to handle token rotation.

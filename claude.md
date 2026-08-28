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
- **Failures are never cached**: the API response carries `ok`; timeouts, HTTP errors, missing session params and unusable payloads go to neither the LRU nor `chrome.storage.local`. `fetchUserInfoFromApi()` returns `null`, so the link stays eligible for the viewport retry chain instead of being marked terminal
- **Country data**: Never expires (rarely changes)

### Rate Limiting

A failure carries `reason` (`no-session`, `http`, `unparseable`, `no-profile`,
`network`) alongside `status` (the HTTP status of the response that arrived, or `null`).
The status alone is not enough: **threads.com answers a signed-out request with HTTP 200
and its HTML login page**, so `JSON.parse` throws on a response that looks like a success.
`noteLookupFailure()` closes a module-level gate that `resolveUserInfo()` checks before
dispatching:

- **429** — exponential backoff from `RATE_LIMIT_BASE_MS` (30s), doubling per *episode*
  and capped at `RATE_LIMIT_MAX_MS` (5min). Episodes, not responses: a viewport dispatches
  one request per user, so a single rate-limited round answers ~20 times over, and
  counting per response would hit the ceiling on the first round and skip the ramp
  entirely. An episode is a 429 arriving while the gate is open; one that arrives more
  than `RATE_LIMIT_MAX_MS` after the last gate expired starts the count over. A
  `Retry-After` header wins when it asks for a real wait — a `0` would otherwise read as
  "present" and leave the 429 ungated — and is clamped to the same ceiling, so an absurd
  value cannot freeze lookups for the life of the page. The endpoint is same-origin with
  the content script's match pattern, so the header needs no CORS exposure.
- **401, and `unparseable`** — `AUTH_COOLDOWN_MS` (15s). Same class of problem: either
  the token is stale or we are signed out entirely. `unparseable` is the steady state for
  a logged-out tab, not a rare corruption, so every link on the page reaches it — it must
  be gated or the retries never stop. Nothing is cleared: `interceptor.js` overwrites
  `sessionParams` on every intercepted XHR, and clearing it would strand every link if no
  later request carried a token.
- **5xx and `network`** — `SERVER_COOLDOWN_MS` (5s). These answer fast, so ungated they
  would turn a brief outage into a request storm: four chain attempts per link times a
  viewport of links, repeated on every scroll pass.
- **Timeouts and `no-profile`** set no gate. A timeout self-throttles at
  `API_TIMEOUT_MS`, and a missing profile is one user's problem, not the server's.

Cached answers still render while the gate is closed; only new requests are suppressed.
Each gate close logs a warning, so "flags stopped appearing" is diagnosable.

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

A lookup turned away by the lookup gate is not a terminal state, so the link keeps its
observation, and the chain stops rather than spending retries it cannot win — even the
shortest gate outlasts the whole ~7s retry window. Recovery is free: the next scroll
produces a leave/enter pair and a fresh chain. That is why the gate needs no timer of its
own and no resume jitter — resumption is staggered by the user's scrolling rather than
synchronised on a single expiry.

Because a failed lookup is non-terminal, its link stays observed, and under a sustained
outage those accumulate. The "left viewport" branch therefore releases any link that is
no longer `isConnected` — a detach is reported as a viewport leave — which bounds the
retention 458f1ef fixed without costing a still-attached link its recovery.

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

A 200 whose payload carries neither of the two country keys is reported as `no-profile`
rather than as "no country" — a profile response always carries at least one of them
whatever their values. The test deliberately ignores the join date: `extractJoinDate()`
only parses some locales, so keying on it would reject every profile in the others (a
Spanish "diciembre de 2025 · 12 publicaciones" yields no join date at all).

A signed-out request does not reach that test: threads.com returns 200 with its HTML
login page, `parseThreadsResponse()` throws, and the result is `unparseable`.

Session parameters (`fb_dtsg`, `lsd`, `jazoest`, `__bkv`) are refreshed on every intercepted XHR request to handle token rotation.

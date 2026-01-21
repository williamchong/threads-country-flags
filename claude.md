# Chrome Extension: Threads Country Flags

## Overview
A Chrome extension that displays country flags next to usernames on Threads.com by leveraging the existing Threads API to fetch user profile data.

## Current Implementation Status
**Status**: ✅ FULLY IMPLEMENTED AND WORKING

**Version**: 1.0.1

## Architecture

### Core Components

1. **manifest.json** - Chrome extension configuration (MV3)
   - Manifest V3 for Chrome
   - Two-world architecture (MAIN + ISOLATED)
   - Permissions: storage, host permissions for threads.com
   - Content scripts running in both MAIN and ISOLATED worlds
   - Background service worker for cache management

2. **Interceptor Script** (src/interceptor.js) - MAIN World
   - Runs in page context (MAIN world) to bypass extension isolation
   - Intercepts XMLHttpRequest calls to `/bulk-route-definitions`
   - Extracts username→userID mappings from Threads' internal API responses
   - Captures session parameters (fb_dtsg, lsd, jazoest, etc.) for authenticated API calls
   - Communicates with ISOLATED world via custom events

3. **API Injected Script** (src/api-injected.js) - MAIN World
   - Runs in page context to make API calls with page's cookies
   - Fetches country data from Threads "About This Profile" API
   - Bypasses CORS restrictions by running in same context as Threads.com
   - Parses API responses and extracts country information
   - Respects user privacy settings (only shows if country is public)

4. **Content Script** (src/content.js) - ISOLATED World
   - Runs in isolated context for safe DOM manipulation
   - Contains multilingual country name mappings (50+ countries)
   - Uses Intersection Observer to track visible profile links
   - Only fetches data for links in viewport >1 second (performance optimization)
   - Injects flag emojis with country name tooltips
   - Handles dynamic content with MutationObserver
   - Implements request deduplication to prevent duplicate API calls
   - Manages persistent caching via chrome.storage.local

5. **Background Service Worker** (src/background.js)
   - Lightweight worker for handling extension messages
   - Provides cache clearing functionality
   - Minimal role due to MAIN world architecture

6. **Popup UI** (src/popup.html, src/popup.js)
   - Displays statistics: cached countries count, storage used
   - Provides "Clear Cache" button
   - Updates stats dynamically when popup is opened

## API Integration

### Username → UserID Mapping
The extension intercepts `/bulk-route-definitions` XHR requests which contain mappings like:
- Request: `route_urls[0]=%2F%40username` → `/@username`
- Response: `{ "/@username": { "result": { "exports": { "rootView": { "props": { "user_id": "12345" } } } } } }`

This allows the extension to map `@username` → `user_id` without DOM scraping.

### Country Data API
Uses the endpoint: `https://www.threads.com/async/wbloks/fetch/?appid=com.bloks.www.text_post_app.about_this_profile_async_action`

**Request parameters:**
- `target_user_id`: The numeric user ID
- `fb_dtsg`, `lsd`, `jazoest`, etc.: Session parameters extracted from intercepted requests
- `__bkv`: WebBloksVersioningID extracted from page scripts

**Response format:**
- Starts with `for (;;);` prefix (CSRF protection)
- JSON structure: `{ "payload": { "layout": { "bloks_payload": { "data": [...] } } } }`
- Country key: `THREADS_ABOUT_THIS_PROFILE:about_this_profile_country`
- Visibility key: `THREADS_ABOUT_THIS_PROFILE:about_this_profile_country_visibility`
- Country value can be in various languages (e.g., "香港" for Hong Kong, "United States", etc.)

## Implementation Details

### Key Implementation Decisions

**1. Two-World Architecture**
- Initially attempted to extract user IDs from DOM, but Threads doesn't expose them in HTML attributes
- Solution: Run scripts in MAIN world to intercept XHR and access page cookies
- Benefits: Bypass CORS, access session cookies, intercept GraphQL responses
- Trade-off: More complex communication via custom events

**2. Username → UserID Mapping**
- Problem: Need numeric user IDs to call API, but only have usernames in profile links
- Solution: Intercept `/bulk-route-definitions` requests which map routes to user data
- This endpoint is called automatically by Threads when loading feeds
- Eliminates need for DOM scraping or additional API calls

**3. Performance Optimizations**
- **Intersection Observer**: Only fetch data for links visible in viewport
- **1-second delay**: Prevents fetching for links user scrolls past quickly
- **Request deduplication**: Prevents duplicate API calls for same user
- **Persistent caching**: Saves API calls across browser sessions
- **Smart filtering**: Skips profile pictures (img/svg elements) and headers (h1)

**4. Country Mapping Strategy**
- Store country names as-is (multilingual support)
- Map to ISO 3166-1 alpha-2 codes for emoji conversion
- Use Unicode regional indicator symbols for flag emojis
- Fallback to `{Country Name}` if code not found
- Show country name on hover for clarity

**5. Caching Strategy**
- In-memory Map for session storage (username→userID, userID→country)
- chrome.storage.local for persistent country cache (prefix: `country_`)
- No LRU eviction (browser handles storage limits)
- Cache never expires (country data rarely changes)

## Technical Details

### Communication Flow

```
MAIN World (interceptor.js)
  ↓ Intercepts XHR /bulk-route-definitions
  ↓ Extracts username→userID mappings
  ↓ Captures session parameters
  ↓ Dispatches custom events
  ↓
ISOLATED World (content.js)
  ↓ Receives custom events
  ↓ Observes DOM for profile links
  ↓ Checks if link in viewport >1s
  ↓ Dispatches country request
  ↓
MAIN World (api-injected.js)
  ↓ Makes API call with session params
  ↓ Parses response
  ↓ Dispatches country response
  ↓
ISOLATED World (content.js)
  ↓ Receives country data
  ↓ Converts to flag emoji
  ↓ Injects into DOM
```

### API Response Parsing
**Response format:**
```javascript
for (;;);{
  "__ar": 1,
  "payload": {
    "layout": {
      "bloks_payload": {
        "data": [
          {
            "data": {
              "key": "THREADS_ABOUT_THIS_PROFILE:about_this_profile_country",
              "initial": "Hong Kong"  // or "香港"
            }
          }
        ]
      }
    }
  }
}
```

**Parsing steps:**
1. Strip `for (;;);` prefix using regex
2. JSON.parse the remaining string
3. Navigate to `payload.layout.bloks_payload.data` array
4. Find object where `data.key === "THREADS_ABOUT_THIS_PROFILE:about_this_profile_country"`
5. Check visibility flag (`about_this_profile_country_visibility`)
6. Extract `data.initial` for country value

### Country Name Normalization (Locale-Aware)
- API responses are locale-sensitive based on user's Threads language settings
- Examples: "香港" (Chinese), "Hong Kong" (English), "Estados Unidos" (Spanish)
- Built comprehensive mappings for 50+ countries in multiple languages:
  - Chinese (Simplified & Traditional)
  - English (including common variations)
  - Spanish, French, German, Portuguese, Italian
  - Native names (e.g., "Deutschland", "España", "Polska")
- Normalize to lowercase and trim whitespace before lookup
- Map all variants to ISO 3166-1 alpha-2 codes
- Convert codes to Unicode flag emojis using regional indicator symbols
  - Formula: char code + 127397 (e.g., 'U' → 🇺, 'S' → 🇸, combined → 🇺🇸)
- Fallback: Display `{Country Name}` if country code not found

### Display Strategy
- Target all profile links: `a[href*="/@"][role="link"]`
- Find insertion point: First `span[dir="auto"]` containing username text
- Insert inline after username text (not as sibling to avoid layout issues)
- Skip links containing/near images (profile pictures)
- Skip links inside h1 elements (page headers)
- Add tooltip with full country name using `title` attribute
- Mark processed links to avoid re-processing

## Files Implemented

### Core Extension Files
- ✅ `/manifest.json` - Chrome MV3 manifest with two-world architecture
- ✅ `/src/interceptor.js` - XHR interceptor (MAIN world)
- ✅ `/src/api-injected.js` - API client (MAIN world)
- ✅ `/src/content.js` - Content script with country mappings (ISOLATED world)
- ✅ `/src/background.js` - Service worker for cache management
- ✅ `/src/popup.html` - Extension popup UI
- ✅ `/src/popup.js` - Popup logic for stats and cache clearing
- ✅ `/src/styles.css` - Custom styles for flags
- ✅ `/icons/icon16.png` - 16x16 icon
- ✅ `/icons/icon48.png` - 48x48 icon
- ✅ `/icons/icon128.png` - 128x128 icon
- ✅ `/README.md` - User documentation
- ✅ `/CLAUDE.md` - Architecture and implementation documentation
- ✅ `/INSTALL.md` - Installation instructions
- ✅ `/DEVELOPMENT.md` - Development notes

## Current Features (Implemented)

1. ✅ **Automatic Flag Display**: Shows country flags next to usernames on Threads.com
2. ✅ **Multilingual Support**: Recognizes 50+ countries in multiple languages
3. ✅ **Smart Performance**: Only fetches data for visible links (Intersection Observer)
4. ✅ **Lazy Loading**: 1-second viewport delay prevents unnecessary API calls
5. ✅ **Request Deduplication**: Prevents duplicate API calls for same user
6. ✅ **Persistent Caching**: Stores country data across browser sessions
7. ✅ **Tooltip on Hover**: Shows full country name when hovering over flag
8. ✅ **Popup UI**: View statistics and clear cache
9. ✅ **Smart Filtering**: Skips profile pictures and headers
10. ✅ **Privacy Respecting**: Only shows flags if user made country public

## Known Limitations

1. **Requires Login**: Extension needs you to be logged in to Threads to access the API
2. **Initial Load Delay**: Username→userID mappings populate as you scroll (via bulk-route-definitions)
3. **Chrome Only**: Currently only supports Chrome (MV3), Firefox/Safari support planned
4. **Language-Dependent**: Country names depend on user's Threads language setting
5. **No Offline Mode**: Requires active internet connection for API calls

## Future Enhancements (Not Yet Implemented)

- Multi-browser support (Firefox, Safari)
- Settings page for customization options
- Flag position customization
- Custom flag styles/sizes
- Export/import cache
- Analytics and performance metrics
- Support for more country name variants
- Automatic cache refresh after X days

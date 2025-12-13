# Threads Country Flags

A Chrome extension that displays country flags next to usernames on Threads.com by leveraging the official Threads API.

## Features

- **Automatic Country Detection**: Fetches country information from user profiles via the Threads API
- **Multilingual Support**: Recognizes country names in multiple languages (English, Chinese, Spanish, etc.)
- **Smart Caching**: Two-tier caching system (in-memory LRU + persistent storage) for optimal performance
- **Flag Display**: Shows country flags as emoji or plain text if the country cannot be mapped
- **Low Impact**: Request deduplication and caching minimize API calls and performance impact
- **Privacy Focused**: Only uses data already available in public Threads profiles

## Installation

### From Source (Development)

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/threads-country-flag.git
   cd threads-country-flag
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" (toggle in the top-right corner)

4. Click "Load unpacked" and select the `threads-country-flag` directory

5. The extension should now be installed and active!

## Usage

1. Navigate to [Threads.com](https://www.threads.com/)
2. Make sure you're logged in (the extension needs your session to access the API)
3. Country flags will automatically appear next to usernames in:
   - Feed posts
   - User profiles
   - Comments and replies

### Troubleshooting

If flags are not appearing:

1. Open Chrome DevTools (F12) and check the Console tab for messages starting with `[Threads Country Flags]`
2. The extension logs will show:
   - How many profile links it found
   - Whether it could extract user IDs
   - API call results

**Finding User IDs**: The extension needs numeric user IDs to call the Threads API. If user IDs aren't being detected:

1. Run the debug helper in the console:
   ```javascript
   // Copy and paste the contents of debug-helper.js into the console
   ```
2. This will analyze the DOM and show you where user IDs might be stored
3. Update `src/content.js` in the `extractUserIdFromDOM()` function to extract IDs from the correct attributes

## How It Works

### Architecture

The extension uses an intelligent approach to map usernames to user IDs:

**1. GraphQL Interception**
- The content script intercepts GraphQL responses from Threads' feed API
- It extracts username→userID mappings from the feed data
- Example: `@chatoranekogen` → `63128092830`

**2. Flag Injection**
- When profile links are detected in the DOM, the extension:
  - Extracts the username from the link (e.g., `/@username`)
  - Looks up the user ID from the intercepted GraphQL data
  - Fetches the country from the Threads API using the user ID
  - Displays the country flag next to the username

**Components:**
- **Content Script** (`src/content.js`): Intercepts GraphQL, builds username→ID mapping, injects flags
- **Background Service Worker** (`src/background.js`): Handles API requests and manages caching
- **API Client** (`src/api.js`): Communicates with the Threads API to fetch user country data
- **LRU Cache** (`src/cache.js`): In-memory cache for fast lookups
- **Country Mapper** (`src/countries.js`): Maps country names (in various languages) to flag emojis

### Caching Strategy

The extension uses a two-tier caching system:

1. **In-Memory LRU Cache**: Stores up to 500 recent user countries for instant access
2. **Persistent Storage**: Uses `chrome.storage.local` to persist data across sessions

This approach minimizes API calls while ensuring up-to-date information.

### API Integration

The extension uses the Threads "About This Profile" API endpoint:
```
https://www.threads.com/async/wbloks/fetch/?appid=com.bloks.www.text_post_app.about_this_profile_async_action
```

It extracts country information from the response and respects user privacy settings (only shows flags if the user has made their country public).

## Development

### Project Structure

```
threads-country-flag/
├── manifest.json           # Chrome extension manifest
├── src/
│   ├── content.js         # Content script (DOM injection)
│   ├── background.js      # Service worker (API & caching)
│   ├── api.js             # Threads API client
│   ├── cache.js           # LRU cache implementation
│   ├── countries.js       # Country name mappings
│   ├── popup.html         # Extension popup UI
│   ├── popup.js           # Popup logic
│   └── styles.css         # Custom styles
├── icons/
│   ├── icon.svg           # Source SVG icon
│   ├── icon16.png         # 16x16 icon
│   ├── icon48.png         # 48x48 icon
│   └── icon128.png        # 128x128 icon
└── README.md
```

### Building

No build step is required. The extension uses vanilla JavaScript with ES modules.

### Regenerating Icons

If you need to regenerate the PNG icons from the SVG source:

```bash
cd icons
magick icon.svg -resize 16x16 icon16.png
magick icon.svg -resize 48x48 icon48.png
magick icon.svg -resize 128x128 icon128.png
```

Or open `icons/generate-icons.html` in a browser and download the icons.

### Adding Country Mappings

To add support for more country names or languages, edit `src/countries.js` and add entries to the `COUNTRY_MAPPINGS` object:

```javascript
const COUNTRY_MAPPINGS = {
  // ...existing mappings
  'deutschland': 'DE',  // Add new mapping
  '德国': 'DE',         // Chinese for Germany
};
```

## Future Enhancements

- Firefox and Safari support (multi-browser manifests)
- User-configurable flag display options
- Settings to enable/disable on specific sections
- Support for custom flag designs
- Performance analytics

## Privacy

This extension:
- Only accesses data already publicly visible on Threads.com
- Does not collect or transmit any user data
- Uses your existing Threads session for API authentication
- Stores country data locally for caching purposes only

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License - see LICENSE file for details

## Disclaimer

This is an unofficial extension and is not affiliated with, endorsed by, or sponsored by Meta Platforms, Inc. or Threads.

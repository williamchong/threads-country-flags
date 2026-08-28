/**
 * Regenerates src/flag-font.css from vendor/TwemojiCountryFlags.woff2.
 *
 * The font is inlined as a base64 data: URI because threads.com sends
 * `font-src data: static.cdninstagram.com` — a chrome-extension:// font URL is
 * not covered by that policy, but data: is explicitly allowed.
 *
 * Run: npm run build:flag-font
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const woff2 = readFileSync(join(root, 'vendor', 'TwemojiCountryFlags.woff2'));

const css = `/**
 * Twemoji Country Flags — flag-only colour font.
 *
 * GENERATED FILE. Do not edit by hand; run \`npm run build:flag-font\`.
 * Source: vendor/TwemojiCountryFlags.woff2 (${woff2.length} bytes)
 *
 * Font (c) 2022 TalkJS, MIT licensed:
 *   https://github.com/talkjs/country-flag-emoji-polyfill
 * Flag artwork from Twemoji (c) Twitter, Inc and other contributors, used under
 * CC-BY 4.0: https://github.com/twitter/twemoji
 *   https://creativecommons.org/licenses/by/4.0/
 *
 * Windows ships Segoe UI Emoji, which has no regional-indicator ligatures, so
 * Chrome renders flag emoji as two boxed letters ("US"). This font supplies the
 * missing glyphs. content.js applies it only where a runtime probe finds the
 * browser cannot draw flags natively — see .threads-country-flag-glyph.
 *
 * unicode-range is deliberately limited to the regional indicators. The upstream
 * polyfill also claims U+1F3F4 (waving black flag) for subdivision flags, but
 * this font has no pirate ZWJ sequence, so claiming U+1F3F4 would split our
 * pirate flag into a black flag plus a skull from two different fonts.
 *
 * font-display is block rather than swap: a data: URI has no network wait, and
 * block avoids briefly painting the boxed letters this font exists to replace.
 */
@font-face {
  font-family: 'Twemoji Country Flags';
  unicode-range: U+1F1E6-1F1FF;
  font-display: block;
  src: url('data:font/woff2;base64,${woff2.toString('base64')}') format('woff2');
}
`;

writeFileSync(join(root, 'src', 'flag-font.css'), css);
console.log(`Wrote src/flag-font.css (${css.length} bytes)`);

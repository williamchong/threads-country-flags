# Chrome Web Store Listing Content

Ready-to-paste copy for the CWS developer dashboard, optimized for store search
(English + 繁體中文).

## Where each field actually lives

| Store field | Limit | Source |
| --- | --- | --- |
| Title | 75 chars | `manifest.json` → `__MSG_extName__` → `_locales/*/messages.json` |
| Summary (the line under the title) | 132 chars | `manifest.json` → `__MSG_extDescription__` → `_locales/*/messages.json` |
| Description (the long one) | 16,000 chars | Store listing tab in the dashboard, **entered per language** |

Title and Summary are **not editable in the dashboard** — they come from the
packaged locale files, so changing them requires a version bump and a new
upload. Only the long Description below is pasted into the dashboard.

---

## Title + Summary (already applied to `_locales/`)

### English (`_locales/en`)

```
Threads Country Flags – Show User Country & Region
```
```
Adds a country flag next to every Threads username, so you can see where the accounts in your feed, replies and search are from.
```
50/75 and 128/132 characters.

### 繁體中文 (`_locales/zh_TW`)

```
Threads 國旗顯示器 – 顯示脆友的國家地區
```
```
在 Threads（脆）每個用戶名旁顯示國旗，一眼看出動態、留言與搜尋結果中的帳號來自哪裡，涵蓋 138 個國家與地區。
```
25/75 and 60/132 characters.

---

## English — Description

```
Threads Country Flags shows a country flag next to every username on Threads.com — in your feed, in replies, in search results and on profile pages — so you can tell at a glance where an account is posting from.

No sign-up, no configuration, no options to tune. Install it, open Threads, and the flags are simply there.

━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT YOU GET
━━━━━━━━━━━━━━━━━━━━━━━━━━

🏁 Flags for 138 countries and territories
Flags appear inline next to usernames throughout Threads. Hover over any flag to read the full country name.

🌐 Correct flags in any interface language
Threads reports a profile's country in whatever language you browse in — "Japan", "日本", "Japón". A built-in multilingual lookup table recognises all 138 across English, Traditional Chinese, Simplified Chinese, Spanish, French, German and native spellings, so you get the right flag either way.

🏴‍☠️ Pirate flag for hidden countries
Some people turn country display off in their privacy settings. Those accounts show 🏴‍☠️ rather than nothing at all, so "hidden by the user" is never confused with "hasn't loaded yet".

🔰 New account badge
Accounts created within the last 60 days are marked with 🔰 — helpful context when a brand-new account turns up in a busy reply thread.

⚡ Built to stay out of your way
Countries are looked up only for profile links that actually stay on your screen, results are cached locally and reused across sessions, and duplicate lookups collapse into a single request. Scrolling stays smooth.

🖥️ Real flags on Windows, too
Chrome on Windows ships no flag glyphs, so 🇺🇸 normally renders as two boxed letters. This extension bundles a flag-only colour font and applies it only when it detects that your system actually needs it.

📊 Cache controls in one click
The toolbar popup shows how many countries are cached and how much storage they take, with a one-click Clear Cache button.

━━━━━━━━━━━━━━━━━━━━━━━━━━
PRIVACY
━━━━━━━━━━━━━━━━━━━━━━━━━━

• Reads only the public "About This Profile" details that Threads already shows you when you open a profile.
• Sends nothing anywhere. No analytics, no tracking, no external server, no account.
• Everything cached stays in your own browser and can be wiped at any time from the popup.
• Runs on threads.com only. It cannot see any other site you visit.
• Fully open source — read every line at github.com/williamchong/threads-country-flags

━━━━━━━━━━━━━━━━━━━━━━━━━━
GOOD TO KNOW
━━━━━━━━━━━━━━━━━━━━━━━━━━

• You need to be signed in to Threads.com for flags to appear.
• Flags come from what each person has chosen to share on their own profile. Anyone who hides their country stays hidden.
• Works in Chrome and other Chromium browsers — Edge, Brave, Arc, Opera.
• Not affiliated with, endorsed by, or connected to Meta, Instagram or Threads.

Found a bug, or a country mapped to the wrong flag? Open an issue on GitHub and it usually gets fixed quickly.
```

---

## 繁體中文 — 詳細說明

```
Threads 國旗顯示器會自動在 Threads（脆）上的每個用戶名旁邊加上該帳號的國旗 — 動態消息、留言串、搜尋結果、個人檔案通通適用，一眼就看得出對方是從哪裡發文的。

不用註冊、不用設定、沒有一堆選項要調。裝好之後打開脆，國旗就直接出現了。

━━━━━━━━━━━━━━━━━━━━━━━━━━
功能特色
━━━━━━━━━━━━━━━━━━━━━━━━━━

🏁 涵蓋 138 個國家與地區的國旗
國旗直接顯示在用戶名旁邊，滑鼠移上去還能看到完整的國家名稱。

🌐 任何介面語言都能對到正確國旗
Threads 回傳的國家名稱會跟著你的介面語言變（「日本」「Japan」「Japón」）。內建的多語言對照表涵蓋全部 138 個國家與地區的繁體中文、簡體中文、英文、西班牙文、法文、德文與當地語言寫法，不論你用哪種語言瀏覽都能對到正確的那面國旗。

🏴‍☠️ 隱藏國家顯示海盜旗
有些用戶在隱私設定裡關掉了國家顯示，這類帳號會顯示 🏴‍☠️ 而不是留白，讓你分得出是「對方選擇隱藏」還是「還沒載入完」。

🔰 新帳號徽章
建立未滿 60 天的帳號會標上 🔰 — 當留言區突然冒出一個全新帳號時，這個資訊特別有參考價值。

⚡ 效能優先，不卡頁面
只有真正停留在你畫面上的個人檔案連結才會去查詢，查過的結果會存在本機並跨工作階段重複使用，重複的查詢也會自動合併成一次請求。滑動起來一樣順。

🖥️ Windows 也能顯示真正的國旗
Windows 版 Chrome 沒有內建國旗字型，🇺🇸 通常會變成兩個方框字母。本擴充功能內建了國旗專用彩色字型，而且只在偵測到你的系統真的需要時才會套用。

📊 一鍵管理快取
點開工具列圖示就能看到已快取的國家數量與佔用的儲存空間，也可以一鍵全部清除。

━━━━━━━━━━━━━━━━━━━━━━━━━━
隱私
━━━━━━━━━━━━━━━━━━━━━━━━━━

• 只讀取 Threads 本來就會顯示給你看的公開「關於此個人檔案」資訊。
• 不會把任何資料傳送到外部。沒有分析追蹤、沒有自架伺服器、不需要註冊任何帳號。
• 所有快取都只存在你自己的瀏覽器裡，隨時可以從彈出視窗清除。
• 只在 threads.com 上運作，無法存取你造訪的其他網站。
• 完全開源，每一行程式碼都可以自行檢視：github.com/williamchong/threads-country-flags

━━━━━━━━━━━━━━━━━━━━━━━━━━
使用前須知
━━━━━━━━━━━━━━━━━━━━━━━━━━

• 需要先登入 Threads.com，國旗才會出現。
• 國旗來自每位用戶自己選擇公開的資料；選擇隱藏國家的用戶依然維持隱藏。
• 支援 Chrome 以及其他 Chromium 瀏覽器（Edge、Brave、Arc、Opera）。
• 本擴充功能非 Meta、Instagram 或 Threads 官方產品，與其並無隸屬關係。

發現錯誤，或某個國家對應到錯的國旗？歡迎到 GitHub 開 issue 回報，通常很快就會修好。
```

---

## Keyword rationale

Terms deliberately worked into the indexed fields (title, summary, first
paragraph), each because people actually search it:

**English** — `Threads`, `country flag`, `username`, `country`, `region`,
`location`, `feed`, `replies`, `search results`, `profile`.

**繁體中文** — `Threads`, `脆`, `脆友`, `國旗`, `國家`, `地區`, `顯示`,
`用戶名`, `留言`. `脆` and `脆友` are the near-universal Taiwanese/HK nicknames
for Threads and its users; Taiwan is the extension's largest natural market, and
without these two terms the listing is invisible to anyone searching in the
vocabulary they actually use.

Not used: repeated keyword runs, competitor names, or an unrelated keyword block
at the end of the description — all of which risk a Keyword Spam rejection under
the Chrome Web Store listing requirements.

---

## CWS Dashboard Checklist

### Privacy Practices Tab
- **Single purpose**: Display country flags next to Threads usernames
- **Data usage**: Does not collect user data
- **Remote code**: No remote code execution
- **Privacy policy URL**: `https://github.com/williamchong/threads-country-flags/blob/main/PRIVACY.md`

### URLs
- **Homepage**: `https://github.com/williamchong/threads-country-flags`
- **Support**: `https://github.com/williamchong/threads-country-flags/issues`

### Category
- Social & Communication

### Graphic assets
- Marquee 1400×560 — `assets/marquee-1400x560.png`
- Promo tile 440×280 — `assets/promo-tile-440x280.png`

### Screenshots (1280×800px) — to capture manually
Order matters: the first screenshot is the one shown in search results.
1. Feed view with several flags visible, annotated with a short callout
2. Close-up of a post showing a flag plus the tooltip with the full country name
3. Special badges: 🏴‍☠️ hidden country + 🔰 new account, both labeled
4. Extension popup showing cache statistics
5. (Optional) Before/after comparison

Add a localized set of screenshots for 繁體中文 with the callout text in Chinese
— the dashboard accepts screenshots per language, and captioned screenshots in
the reader's own language convert noticeably better than English ones.

# Privacy Policy — Threads Country Flags

**Last updated:** 2026-03-23

## Overview

Threads Country Flags is a browser extension that displays country flag emojis next to usernames on Threads.com. This policy explains what data the extension accesses, how it is used, and how it is stored.

## Data Access

The extension accesses the following data **only on threads.com**:

- **Public profile data**: Country and join date from Threads' "About This Profile" feature, which is publicly visible on each user's profile.
- **Session tokens**: Temporary authentication tokens (e.g., `fb_dtsg`) from your active Threads session, used solely to authenticate API requests on your behalf. These tokens are held in memory only and are never stored or transmitted elsewhere.
- **Username-to-user-ID mappings**: Extracted from Threads' own network requests to look up profile data.

## Data Storage

- Country data is cached **locally in your browser** using `chrome.storage.local` to avoid redundant API calls.
- No data is stored on any external server.
- You can clear all cached data at any time via the extension popup.

## Data Collection & Transmission

- **No personal data is collected.**
- **No data is transmitted** to any server other than threads.com itself (to fetch public profile information).
- **No analytics, telemetry, or tracking** of any kind is included.
- **No third-party services** are used.

## Permissions

| Permission | Purpose |
|---|---|
| `storage` | Cache country data locally to improve performance |
| `host_permissions: threads.com` | Access Threads pages to display flags and fetch public profile data |

## Third-Party Disclosure

This extension does not sell, transfer, or share any user data with third parties for any purpose.

## Changes to This Policy

Any changes to this privacy policy will be reflected in this document with an updated date. Significant changes will be noted in the extension's changelog.

## Contact

For questions about this privacy policy, please open an issue at:
https://github.com/williamchong/threads-country-flags/issues

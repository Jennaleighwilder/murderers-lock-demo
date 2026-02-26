# 🚀 Extension Launch Checklist

## ⚡ TONIGHT (2 hours) — Fastest Path

### 1. Icons (5 min)
- [ ] Go to https://svgtopng.com/ (or cloudconvert.com, convertio.co)
- [ ] Upload `extension/icons/icon-16.svg` → Download as **icon16.png**
- [ ] Upload `extension/icons/icon-48.svg` → Download as **icon48.png**
- [ ] Upload `extension/icons/icon-128.svg` → Download as **icon128.png**
- [ ] Move all 3 PNGs into `extension/` folder (same level as manifest.json)

### 2. Screenshots (30 min)
- [ ] Open extension popup → Screenshot
- [ ] Open web app vault screen → Screenshot
- [ ] Visit a login page with Fill button visible → Screenshot
- [ ] Save as `screenshot1.png`, `screenshot2.png`, `screenshot3.png` (1280×800 or 640×400)

### 3. Privacy Policy (15 min)
- [ ] Copy content from `store/privacy-policy.md`
- [ ] Publish at your domain (e.g. murdererslock.com/privacy) or GitHub Pages
- [ ] Note the URL for store submission

### 4. Submit to Firefox (30 min)
- [ ] Create ZIP from project root:
  ```bash
  cd extension
  zip -r ../murderers-lock-firefox.zip . -x "*.DS_Store" -x "*.md" -x "store/*"
  ```
- [ ] Go to [addons.mozilla.org/developers](https://addons.mozilla.org/developers/)
- [ ] Submit new add-on → Upload ZIP
- [ ] Fill listing (use `store/firefox-listing.md`)
- [ ] Add screenshots
- [ ] Add privacy policy URL
- [ ] Submit for review

### 5. Announce (10 min)
- [ ] Tweet: "Just launched The Murderer's Lock browser extension — auto-fill from your quantum-resistant vault. @firefox"
- [ ] Post in relevant communities

---

## 📅 THIS WEEKEND — Complete Launch

### Chrome Web Store
- [ ] Pay $5 developer registration
- [ ] Create ZIP (exclude Firefox-specific manifest fields if needed)
- [ ] Submit at [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)
- [ ] Use `store/chrome-listing.md` for listing copy

### Landing Page
- [ ] Add extension section to main site
- [ ] Download buttons for Chrome + Firefox
- [ ] Link to privacy policy & terms

---

## 📋 Store Requirements

| Item | Chrome | Firefox |
|------|--------|---------|
| Icons | 16, 48, 128 px | 16, 48, 128 px |
| Screenshots | 1–5 (1280×800 or 640×400) | 1–5 |
| Privacy policy | Required | Required |
| Description | 132 chars max (short) | No strict limit |
| Cost | $5 one-time | Free |

---

## ✅ Pre-Launch Verification

- [ ] Extension loads in Chrome (Load unpacked)
- [ ] Extension loads in Firefox (Load Temporary Add-on)
- [ ] Fill button appears on login pages after vault unlock
- [ ] App URL configurable in popup
- [ ] No console errors in popup or content script

# Run Extension Test — Step by Step

The app is running on **http://localhost:3000** (port 3000 in use). Follow these steps:

---

## Step 1: Load the Extension (Chrome)

1. Open Chrome
2. Go to **chrome://extensions**
3. Turn on **Developer mode** (top-right toggle)
4. Click **Load unpacked**
5. Navigate to and select:
   ```
   /Users/jenniferwest/Downloads/files (93)/murderers-lock-demo/extension
   ```
6. The extension should appear in your toolbar

---

## Step 2: Configure App URL

1. Click the **Murderer's Lock** extension icon in the toolbar
2. Click **⚙ Settings**
3. Set **App URL** to: `http://localhost:3000`
4. Click **Save**

---

## Step 3: Open App & Unlock Vault

1. Click **Open Vault** in the popup (or go to http://localhost:3000/dashboard.html)
2. If you have a vault: click it, enter password `quantum33` (demo), unlock
3. If no vault: create one first from the dashboard

---

## Step 4: Verify Sync

1. Click the extension icon again
2. You should see: **✓ Vault synced**
3. Entry count: **N passwords ready to fill**

---

## Step 5: Test Fill

1. Go to any login page (e.g. https://example.com — it has a fake form)
2. Or use: https://accounts.google.com (you'll see the Fill button)
3. A **🔐 Fill** button should appear next to the password field
4. Click it to fill (if you have a matching entry)

---

## Troubleshooting

- **"Vault locked"** → Open the app, unlock your vault, then click the extension again
- **No Fill button** → Refresh the page after unlocking
- **Wrong App URL** → Settings → set `http://localhost:3000` for local dev

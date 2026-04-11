# Gut Tracker — Deploy Guide

## What this is
A Progressive Web App (PWA) — you deploy it once to a free URL, then open it on your phone and hit "Add to Home Screen." It behaves exactly like a native app: its own icon, fullscreen, no browser bar. All data stays on your device.

---

## Deploy to Vercel (free, ~3 minutes)

### Option A: Drag & Drop (no account needed initially)
1. Go to **vercel.com** and sign up (free, use your email or GitHub)
2. Click **"Add New Project"**
3. Click **"Import Git Repository"** — OR scroll down to find **"Deploy from CLI"**
4. Alternatively: go to **vercel.com/new** and look for the "Upload" option

### Option B: Via Command Line (easiest if you have Node.js)
```bash
npm install -g vercel
cd gut-tracker
npm run build
vercel --prod
```
Follow the prompts — it'll give you a live URL like `gut-tracker-abc.vercel.app`.

### Option C: Netlify Drag & Drop (truly zero setup)
1. Go to **netlify.com** and sign up
2. Click **"Add new site"** → **"Deploy manually"**
3. Drag the **`dist/`** folder from inside `gut-tracker/` onto the Netlify upload area
4. Done — you get an instant URL

---

## Install on your phone

**iPhone (Safari):**
1. Open the URL in Safari
2. Tap the share button (box with upward arrow)
3. Scroll down → "Add to Home Screen"
4. Tap Add

**Android (Chrome):**
1. Open the URL in Chrome
2. Tap the three-dot menu (⋮)
3. Tap "Add to Home screen" or "Install app"

---

## Enable notifications
After installing, open the app → Settings tab → tap "Enable Notifications." This allows the 7am, 9am, 1pm, 5pm, and 9pm reminders to fire.

**Note:** Background notifications work best on Android Chrome. On iPhone, you need iOS 16.4+ and the app must be installed to Home Screen first.

---

## Weekly analysis with Claude
1. Open the app → Report tab
2. Tap "Copy full report for Claude"
3. Open a new Cowork session and paste it
4. Claude will analyze your patterns and suggest what to cut first

---

## Local development (optional)
```bash
npm install
npm run dev
# Opens at http://localhost:5173
```

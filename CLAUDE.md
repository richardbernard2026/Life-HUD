# Life HUD — Claude Code Project Context

## App Name
Life HUD

## Platform
Meta Ray-Ban Display Web App

## Display
- 600×600px fixed viewport, overflow hidden, no scrolling
- Additive waveguide display: black pixels are fully transparent
- All backgrounds must be #0a0a0a or #000000
- Text minimum 16px; primary content 20–24px
- High-contrast colors only: cyan (#00d4ff), white (#ffffff), bright accents
- No SVG icons — PNG or Unicode only

## Input (glasses app — index.html only)
- Zero mouse, touch, or physical keyboard input
- ArrowLeft / ArrowRight — cycle between tabs (modules)
- ArrowUp / ArrowDown — move between focusable items within a tab
- Enter — select / activate focused element
- All interactive elements must have class="focusable"
- All focusable elements must have min-height: 88px
- Focus state: border-color #00d4ff + box-shadow glow

## Three Modules (tabs)
1. **Compass + Waypoints** (js/compass.js)
   - Live heading from DeviceOrientationEvent (e.alpha)
   - Visual compass rose + degrees + cardinal direction
   - Drop Pin saves GPS coords + heading to localStorage
   - Saved waypoints show distance + direction arrow
   - Permission requested via user gesture only

2. **Golden Hour + Weather** (js/weather.js)
   - GPS → Open-Meteo API (no key required)
   - Cache in localStorage, expire after 10 minutes (600000ms)
   - Solar position calculated via pure math (solar declination formula)
   - Displays: temp, wind, UV index, golden hour countdown, sunset time
   - geolocation timeout: 15000ms, always include error callback

3. **People Cards** (js/people.js)
   - Reads lifehud_contacts from localStorage
   - ArrowLeft/ArrowRight flips between contact cards
   - Each card: photo (base64), name, birthday, notes
   - Enter toggles expanded view

## APIs
- Open-Meteo: https://api.open-meteo.com/v1/forecast (no API key required)
- navigator.geolocation
- DeviceOrientationEvent (wrap requestPermission in typeof check)
- DeviceMotionEvent

## Storage
- Budget: 5MB localStorage
- All keys prefixed: lifehud_
- Keys: lifehud_contacts, lifehud_waypoints, lifehud_weather_cache, lifehud_prefs
- Storage helpers in js/storage.js

## Companion Page
- companion.html — open on phone browser to manage contacts
- companion/companion.js — add/edit/delete contacts
- Normal touch/click/keyboard interactions (not glasses-constrained)
- Photo rule: ALWAYS resize to max 200×200px via canvas before storing as base64

## File Structure
```
/
├── index.html              # Glasses app (600×600)
├── companion.html          # Phone contact manager
├── manifest.webmanifest
├── vercel.json
├── .gitignore
├── icons/icon-96.png
├── css/app.css
├── js/
│   ├── app.js              # Tab switching + focus management
│   ├── compass.js
│   ├── weather.js
│   ├── people.js
│   └── storage.js
└── companion/
    └── companion.js
```

## Deployment
- Vercel static site, no build step
- index.html → root URL (glasses app)
- companion.html → /companion (phone URL)

## Official Docs
https://wearables.developer.meta.com/docs/develop/webapps/build/

<div align="center">

<img src="https://media.tenor.com/X1LBZQ9DRhYAAAAC/self-destruct-mission-impossible.gif" width="480" alt="This message will self destruct" />

# 👁️ Life HUD

### *Your briefing. Your day. On your face.*

[![Meta Ray-Ban](https://img.shields.io/badge/Meta%20Ray--Ban-Smart%20Glasses-0082FB?style=for-the-badge&logo=meta&logoColor=white)](https://www.ray-ban.com/usa/ray-ban-meta-smart-glasses)
[![Companion App](https://img.shields.io/badge/Companion%20Setup-▶%20Configure-6C63FF?style=for-the-badge)](https://life-hud-one.vercel.app/companion)
[![Live Display](https://img.shields.io/badge/View%20Live%20Display-◉%20Open-00C896?style=for-the-badge)](https://github.com/richardbernard2026/Life-HUD)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

</div>

---

## 🕶️ What Is This?

**Life HUD** is a real-time heads-up display for the **Meta Ray-Ban smart glasses** — built for the moments between missions.

Your morning briefing. Your golden hour alert. Your saved places and the people in them. All rendered clean and minimal, right in your eye line. No phone. No unlocking. No context switching.

> *"Good morning. Here's what you need to know."*

This isn't a notification center. It's not a widget. It's a field-ready situational awareness display — designed for how you actually move through your day.

---

## 📡 Live Display & Companion App

| Link | Purpose |
|---|---|
| 🖥️ **[→ Open Life HUD Display](https://github.com/richardbernard2026/Life-HUD)** | The HUD itself — load on your Ray-Bans |
| 📲 **[→ Companion Setup](https://life-hud-one.vercel.app/companion)** | Upload contacts & configure your display from any device |

The **Companion App** runs separately on your phone or desktop. Use it to upload your contacts and drop pins — then everything syncs to the HUD display on your glasses.

---

## 🎛️ What It Shows

| Panel | What You See |
|---|---|
| 🕐 **Time & Date** | Clean, always-on clock with full date |
| 🌤️ **Weather** | Current conditions for your location |
| 🌅 **Golden Hour & Sunset** | Exact times for golden hour start, peak, and sunset — updated daily for your coordinates |
| 🗺️ **Live Map** | GPS map showing your current position with all your saved pins |
| 📍 **Custom Pins** | Drop pins on the map for saved places — coffee spots, meetup points, favourite locations |
| 👥 **Contacts on Map** | Upload contacts via the Companion App and see them placed on the map |

---

## 📲 Companion App

The **[Companion App](https://life-hud-one.vercel.app/companion)** is a separate setup tool that lets you personalize your Life HUD without touching code.

**What you can do:**
- Upload your contacts — they'll appear as pins on the HUD map
- Assign saved places with custom labels
- Configure your home location for accurate golden hour timing
- Preview the HUD layout before loading it on your glasses

Open it on any device, configure once, and your glasses stay up to date.

---

## 🌅 Golden Hour — Why It's Here

Golden hour isn't just for photographers. It's the best light of the day — for a walk, a drive, a run, a moment. Life HUD calculates the exact golden hour window and sunset time for your GPS coordinates, updated every day.

No app to open. No searching. Just a quiet readout in the corner of your vision that says: *now's the time.*

---

## 🥽 Built For Meta Ray-Ban

The **Meta Ray-Ban smart glasses** stream content to your eye line in real time. Life HUD is designed specifically for that form factor:

- **Information density tuned for AR** — enough to be useful, never cluttered
- **High-contrast layout** — legible in daylight, comfortable indoors
- **No interaction required during use** — set it up on Companion, then just wear your glasses
- **GPS-aware** — all location features respond to where you actually are

---

## 🚀 Getting Started

```bash
# Clone the repo
git clone https://github.com/richardbernard2026/Life-HUD.git
cd Life-HUD

# Install dependencies
npm install

# Start the HUD display
npm run dev
```

Then:
1. Open the **[Companion App](https://life-hud-one.vercel.app/companion)** on your phone or laptop
2. Upload your contacts and drop any pins you want on the map
3. Load the HUD display URL on your Meta Ray-Bans via the Meta View app
4. Walk out the door

---

## 🔧 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5 / CSS3 / JavaScript |
| Companion App | Vercel (hosted) |
| Geolocation | Browser Geolocation API |
| Mapping | GPS + custom pin renderer |
| Solar Calculations | Sunrise/sunset & golden hour algorithms |
| Deployment | Vercel / GitHub Pages ready |

---

## 🗺️ Roadmap

- [x] Time & date display
- [x] Live weather
- [x] Golden hour & sunset timing
- [x] GPS map with custom pins
- [x] Contact upload via Companion App
- [ ] Pin categories (people, places, favourites)
- [ ] Offline mode — cached data when GPS unavailable
- [ ] Weather alerts overlay
- [ ] Calendar / next event display
- [ ] Dark / ambient light auto-switching

---

## 🤝 Contributing

Pull requests are welcome. If you have ideas for new panels, location features, or better ways to surface information without cluttering the Ray-Ban display, open an issue or fork it.

---

## 📄 License

MIT © [Richard Bernard](https://github.com/richardbernard2026)

---

<div align="center">

**Built for people who want their day visible — without looking at their phone.**

*Your mission, should you choose to accept it: put your phone away.*

</div>

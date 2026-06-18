// compass.js — Tab 1: Compass + Waypoints (Phase 2)
// Compass card design: rotating dial keeps N aligned to absolute North.
// needle-wrap rotates at rotate(-heading deg).
// Cardinal labels live INSIDE the rotating wrap so they stay direction-accurate.
// Nav target: Enter on a waypoint row selects it; big arrow banner appears at top.

const Compass = (() => {
  const MAX_PINS = 20;
  const ARROW_DIRS = ['↑','↗','→','↘','↓','↙','←','↖'];

  let heading     = 0;          // current device heading 0-360
  let gpsLat      = null;
  let gpsLon      = null;
  let watchId     = null;
  let orientationActive = false;
  let isAbsolute  = true;       // false when only magnetic north available
  let activeWpId  = null;       // waypoint id currently set as nav target
  let lastAlpha   = null;       // for 0.5° throttle
  let els         = {};

  // ── Cardinal ───────────────────────────────────────────────
  const CARDINALS = [
    'N','NNE','NE','ENE',
    'E','ESE','SE','SSE',
    'S','SSW','SW','WSW',
    'W','WNW','NW','NNW','N',
  ];

  function degToCardinal(deg) {
    const d = ((deg % 360) + 360) % 360;
    return CARDINALS[Math.round(d / 22.5)];
  }

  // ── Distance / Bearing math ────────────────────────────────

  // Haversine → metres
  function haversine(lat1, lon1, lat2, lon2) {
    const R  = 6371000;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a  = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Absolute bearing (degrees) from current pos to target
  function absoluteBearing(lat1, lon1, lat2, lon2) {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const y  = Math.sin(Δλ) * Math.cos(φ2);
    const x  = Math.cos(φ1)*Math.sin(φ2) - Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ);
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
  }

  // Convert absolute bearing → relative directional arrow (relative to heading)
  function bearingToArrow(absBearing) {
    const rel = ((absBearing - heading) + 360) % 360;
    return ARROW_DIRS[Math.round(rel / 45) % 8];
  }

  // US units: feet under 1000 ft, miles above
  function formatDist(meters) {
    const ft = meters * 3.28084;
    if (ft < 1000) return `${Math.round(ft)} ft`;
    return `${(ft / 5280).toFixed(1)} mi`;
  }

  // ── Orientation event ──────────────────────────────────────
  function handleOrientation(e) {
    if (e.alpha === null) return;

    heading    = e.alpha;
    isAbsolute = (e.absolute === true);

    // Throttle DOM updates to 0.5° change
    if (lastAlpha !== null && Math.abs(heading - lastAlpha) < 0.5) return;
    lastAlpha = heading;

    updateHeadingDisplay();
    updateNavBanner();
    refreshWaypointArrows();   // lightweight: only touch arrows, not full rebuild

    // Share heading with weather module
    if (window.App) window.App.setHeading(heading);
  }

  // ── Heading display ────────────────────────────────────────
  function updateHeadingDisplay() {
    const deg = Math.round(((heading % 360) + 360) % 360);
    els.degrees.textContent  = `${deg}°`;
    els.cardinal.textContent = degToCardinal(deg);

    // Rotate the compass card (needle-wrap) so N stays aligned to absolute North.
    // dial at rotate(-heading): when heading=90 (East), N label goes to LEFT = correct.
    els.needleWrap.style.transform = `rotate(${-heading}deg)`;

    // Accuracy badge — amber warning when only magnetic (not true) north
    if (isAbsolute) {
      els.accuracyBadge.classList.add('hidden');
    } else {
      els.accuracyBadge.classList.remove('hidden');
    }

    // Status dot
    const dot = document.getElementById('status-dot-compass');
    if (dot) dot.classList.add('on');
  }

  // ── Nav banner ─────────────────────────────────────────────
  function updateNavBanner() {
    if (!activeWpId || gpsLat === null) return;
    const waypoints = LifeStorage.getWaypoints();
    const wp = waypoints.find(w => w.id === activeWpId);
    if (!wp) { clearNavTarget(); return; }

    const dist  = haversine(gpsLat, gpsLon, wp.lat, wp.lon);
    const bear  = absoluteBearing(gpsLat, gpsLon, wp.lat, wp.lon);
    const arrow = bearingToArrow(bear);

    els.navBannerArrow.textContent = arrow;
    els.navBannerName.textContent  = wp.name;
    els.navBannerDist.textContent  = formatDist(dist);
  }

  function setNavTarget(id) {
    if (activeWpId === id) {
      // Toggle off — pressing Enter again on the same waypoint
      clearNavTarget();
      return;
    }
    activeWpId = id;
    els.navBanner.classList.remove('hidden');
    updateNavBanner();
    renderWaypoints();  // rebuild to show NAV highlight
  }

  function clearNavTarget() {
    activeWpId = null;
    els.navBanner.classList.add('hidden');
    renderWaypoints();
  }

  // ── GPS ────────────────────────────────────────────────────
  function startGPS() {
    if (!navigator.geolocation) return;
    watchId = navigator.geolocation.watchPosition(
      pos => {
        gpsLat = pos.coords.latitude;
        gpsLon = pos.coords.longitude;
        refreshWaypointArrows();
        updateNavBanner();
        const dot = document.getElementById('status-dot-gps');
        if (dot) dot.classList.add('on');
        // Let weather module know we have a fix
        if (window.Weather && window.Weather.onGPSFix) {
          window.Weather.onGPSFix(gpsLat, gpsLon);
        }
        // Update GPS marker on map
        if (window.LifeMap && window.LifeMap.updateGPS) {
          window.LifeMap.updateGPS(gpsLat, gpsLon);
        }
      },
      err => {
        const dot = document.getElementById('status-dot-gps');
        if (dot) dot.classList.remove('on');
        console.warn('Compass GPS error:', err.code);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }

  // ── Drop pin ────────────────────────────────────────────────
  function dropPin() {
    const waypoints = LifeStorage.getWaypoints();

    if (waypoints.length >= MAX_PINS) {
      flashDropPin('Max 20 pins reached', false);
      return;
    }
    if (gpsLat === null) {
      flashDropPin('No GPS fix yet', false);
      return;
    }

    const pin = {
      id:        Date.now(),
      name:      `Pin ${waypoints.length + 1}`,
      lat:       gpsLat,
      lon:       gpsLon,
      heading:   Math.round(((heading % 360) + 360) % 360),
      timestamp: Date.now(),
    };
    waypoints.push(pin);
    LifeStorage.saveWaypoints(waypoints);
    flashDropPin('Pin Dropped!', true);
  }

  function flashDropPin(msg, success) {
    const textEl = els.dropPinBtn.querySelector('.btn-text');
    if (!textEl) return;
    const orig = 'Drop Pin Here';
    textEl.textContent = msg;
    textEl.style.color = success ? 'var(--green)' : 'var(--warn)';
    setTimeout(() => {
      textEl.textContent = orig;
      textEl.style.color = '';
      renderWaypoints();
      if (typeof window.lifeHUDMapRefresh === 'function') window.lifeHUDMapRefresh();
    }, 1500);
  }

  // ── Waypoint rendering ──────────────────────────────────────
  function renderWaypoints() {
    const waypoints = LifeStorage.getWaypoints();
    els.waypointsList.innerHTML = '';

    if (waypoints.length === 0) {
      const msg = document.createElement('div');
      msg.id = 'no-waypoints';
      msg.textContent = orientationActive
        ? 'Focus "Drop Pin" and press Enter to save a waypoint.'
        : 'Enable compass to begin.';
      els.waypointsList.appendChild(msg);
      if (window.App) window.App.refreshFocusables();
      return;
    }

    waypoints.forEach((wp) => {
      const item = document.createElement('div');
      const isTarget = (wp.id === activeWpId);
      item.className = 'waypoint-item focusable' + (isTarget ? ' nav-target' : '');
      item.dataset.wpId = String(wp.id);

      let distText  = '—';
      let arrowText = '–';
      if (gpsLat !== null) {
        const dist = haversine(gpsLat, gpsLon, wp.lat, wp.lon);
        const bear = absoluteBearing(gpsLat, gpsLon, wp.lat, wp.lon);
        distText  = formatDist(dist);
        arrowText = bearingToArrow(bear);
      }

      const timeStr = new Date(wp.timestamp).toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit',
      });

      item.innerHTML =
        `<div class="wp-left">` +
          `<div class="waypoint-name">${wp.name}` +
            (isTarget ? `<span class="nav-badge">NAV</span>` : '') +
          `</div>` +
          `<div class="waypoint-info">${timeStr} &bull; ${wp.heading}&#xb0;</div>` +
        `</div>` +
        `<div class="wp-right">` +
          `<span class="waypoint-arrow">${arrowText}</span>` +
          `<span class="waypoint-dist">${distText}</span>` +
        `</div>`;

      els.waypointsList.appendChild(item);
    });

    if (window.App) window.App.refreshFocusables();
  }

  // Lightweight: only update the arrow and distance text of existing rows
  // Called on every heading change to avoid rebuilding the full DOM
  function refreshWaypointArrows() {
    const waypoints = LifeStorage.getWaypoints();
    const items = els.waypointsList.querySelectorAll('.waypoint-item');
    items.forEach((item) => {
      const id = Number(item.dataset.wpId);
      const wp = waypoints.find(w => w.id === id);
      if (!wp) return;
      const arrowEl = item.querySelector('.waypoint-arrow');
      const distEl  = item.querySelector('.waypoint-dist');
      if (!arrowEl || !distEl) return;
      if (gpsLat !== null) {
        const dist = haversine(gpsLat, gpsLon, wp.lat, wp.lon);
        const bear = absoluteBearing(gpsLat, gpsLon, wp.lat, wp.lon);
        arrowEl.textContent = bearingToArrow(bear);
        distEl.textContent  = formatDist(dist);
      }
    });
  }

  // ── Permission flow ────────────────────────────────────────
  async function requestOrientationPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      let result;
      try {
        result = await DeviceOrientationEvent.requestPermission();
      } catch {
        showPermissionError('Permission request failed.');
        return;
      }
      if (result !== 'granted') {
        showPermissionError('Denied. Enable in Settings › Privacy › Motion & Fitness.');
        return;
      }
    }
    startOrientation();
  }

  function showPermissionError(msg) {
    els.enableBtn.innerHTML =
      `<div style="font-size:22px;color:var(--danger)">&#9888;</div>` +
      `<div style="font-size:16px;color:var(--danger);margin-top:6px;text-align:center">${msg}</div>`;
  }

  function startOrientation() {
    window.addEventListener('deviceorientation', handleOrientation, true);
    orientationActive = true;
    els.enableBtn.classList.add('hidden');
    els.headingBlock.classList.remove('hidden');
    els.roseContainer.classList.remove('hidden');
    els.dropPinBtn.classList.remove('hidden');
    startGPS();
    renderWaypoints();
  }

  // ── Compass card ticks ──────────────────────────────────────
  // Injected into needle-wrap before the needle & label elements
  function buildRoseTicks() {
    const firstChild = els.needleWrap.firstChild;
    for (let i = 71; i >= 0; i--) {
      const deg  = i * 5;
      const tick = document.createElement('div');
      let cls = 'compass-tick';
      if (deg % 90 === 0) cls += ' cardinal';
      if (deg === 0)      cls += ' north';
      tick.className = cls;
      tick.style.transform = `rotate(${deg}deg)`;
      els.needleWrap.insertBefore(tick, firstChild);
    }
  }

  // ── Activate (called by app.js on Enter) ─────────────────────
  function activate(el) {
    if (el.id === 'enable-compass-btn') {
      requestOrientationPermission();
    } else if (el.id === 'drop-pin-btn') {
      dropPin();
    } else if (el.dataset.wpId) {
      setNavTarget(Number(el.dataset.wpId));
    }
  }

  // ── Init / Destroy ─────────────────────────────────────────
  function init() {
    els = {
      enableBtn:      document.getElementById('enable-compass-btn'),
      headingBlock:   document.getElementById('compass-heading-block'),
      roseContainer:  document.getElementById('compass-rose-container'),
      needleWrap:     document.getElementById('compass-needle-wrap'),
      degrees:        document.getElementById('compass-degrees'),
      cardinal:       document.getElementById('compass-cardinal'),
      accuracyBadge:  document.getElementById('compass-accuracy-badge'),
      dropPinBtn:     document.getElementById('drop-pin-btn'),
      waypointsList:  document.getElementById('waypoints-list'),
      navBanner:      document.getElementById('compass-nav-banner'),
      navBannerArrow: document.getElementById('nav-banner-arrow'),
      navBannerName:  document.getElementById('nav-banner-name'),
      navBannerDist:  document.getElementById('nav-banner-dist'),
    };

    // GPS hasn't been acquired yet — start dot as off
    const gpsDot = document.getElementById('status-dot-gps');
    if (gpsDot) gpsDot.classList.remove('on');

    buildRoseTicks();
    renderWaypoints();
  }

  function destroy() {
    window.removeEventListener('deviceorientation', handleOrientation, true);
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    orientationActive = false;
  }

  return { init, activate, destroy };
})();

window.Compass = Compass;

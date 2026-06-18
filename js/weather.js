// weather.js — Tab 2: Golden Hour + Weather (Phase 2 full implementation)
// Auto-triggers on tab focus via MutationObserver (no button required).
// GPS → Open-Meteo fetch → solar math → relative wind → pulsing golden/blue hour.

const Weather = (() => {
  const CACHE_TTL = 600000;   // 10 min
  const TICK_MS   = 30000;    // 30 s interval for countdown + cache-age update

  let lat            = null;
  let lon            = null;
  let weatherData    = null;
  let cacheTimestamp = null;
  let countdownTimer = null;
  let tabObserver    = null;
  let isVisible      = false;
  let els            = {};

  // ── Solar math (spec's exact algorithm) ─────────────────────
  function dayOfYear(date) {
    const jan1 = new Date(date.getFullYear(), 0, 0);
    return Math.floor((date - jan1) / 86400000);
  }

  function solarTimes(latitude, longitude, date) {
    const D2R = Math.PI / 180;
    const D   = dayOfYear(date);

    // Solar declination per spec: 23.45 * sin(360/365 * (D - 81) * PI/180)
    const dec = 23.45 * Math.sin(D2R * (360 / 365) * (D - 81));

    // Hour angle at sunrise/sunset per spec: acos(-tan(lat) * tan(dec))
    const cosHA = -Math.tan(latitude * D2R) * Math.tan(dec * D2R);
    if (Math.abs(cosHA) > 1) return null;  // polar day or polar night

    const HA = Math.acos(cosHA) / D2R;    // degrees

    // Solar noon UTC per spec: 12 - (longitude/15)
    const solarNoonUTC = 12 - longitude / 15;

    return {
      solarNoonUTC,
      sunriseUTC: solarNoonUTC - HA / 15,
      sunsetUTC:  solarNoonUTC + HA / 15,
    };
  }

  // Convert UTC decimal hours to a local Date object
  function utcHToDate(utcH, baseDate) {
    const d = baseDate ? new Date(baseDate) : new Date();
    d.setUTCHours(0, 0, 0, 0);
    return new Date(d.getTime() + utcH * 3600000);
  }

  function fmtTime12(date) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  // Countdown string — "2h 14m", "34m", shows nothing if ms <= 0
  function fmtCountdown(ms) {
    if (ms <= 0) return '';
    const totalMin = Math.floor(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  // ── Solar state machine ──────────────────────────────────────
  // Returns { icon, text, countdown, pulseClass, textColor }
  function solarState(solar) {
    if (!solar) return { icon: '🌡', text: 'No solar data', countdown: '', pulseClass: '', textColor: '' };

    const now            = Date.now();
    const today          = new Date();
    const sunriseMs      = utcHToDate(solar.sunriseUTC, today).getTime();
    const sunsetMs       = utcHToDate(solar.sunsetUTC, today).getTime();
    const goldenDawnMs   = sunriseMs - 60 * 60000;  // 60 min before sunrise
    const goldenStartMs  = sunsetMs  - 60 * 60000;  // 60 min before sunset
    const blueEndMs      = sunsetMs  + 30 * 60000;  // 30 min after sunset

    if (now < goldenDawnMs) {
      return {
        icon:      '🌙',
        text:      'Sunrise in ' + fmtCountdown(sunriseMs - now),
        countdown: '',
        pulseClass: '',
        textColor:  '',
      };
    }
    if (now < sunriseMs) {
      return {
        icon:      '🌅',
        text:      'GOLDEN DAWN',
        countdown: fmtCountdown(sunriseMs - now) + ' until sunrise',
        pulseClass: 'solar-pulse-amber',
        textColor:  'var(--warn)',
      };
    }
    if (now < goldenStartMs) {
      return {
        icon:      '☀',
        text:      'Sunset in ' + fmtCountdown(sunsetMs - now),
        countdown: 'Golden Hour in ' + fmtCountdown(goldenStartMs - now),
        pulseClass: '',
        textColor:  '',
      };
    }
    if (now < sunsetMs) {
      return {
        icon:      '🌅',
        text:      'GOLDEN HOUR NOW',
        countdown: fmtCountdown(sunsetMs - now) + ' remaining',
        pulseClass: 'solar-pulse-amber',
        textColor:  'var(--warn)',
      };
    }
    if (now < blueEndMs) {
      return {
        icon:      '🌆',
        text:      'BLUE HOUR',
        countdown: fmtCountdown(blueEndMs - now) + ' remaining',
        pulseClass: 'solar-pulse-blue',
        textColor:  '#4488ff',
      };
    }

    // After blue hour — compute tomorrow's sunrise
    const tomorrowSunrise = new Date(today);
    tomorrowSunrise.setDate(tomorrowSunrise.getDate() + 1);
    const nextSolar = solarTimes(lat, lon, tomorrowSunrise);
    const nextRise  = nextSolar ? utcHToDate(nextSolar.sunriseUTC, tomorrowSunrise).getTime() : sunriseMs + 86400000;

    return {
      icon:      '🌙',
      text:      'Next sunrise in ' + fmtCountdown(nextRise - now),
      countdown: '',
      pulseClass: '',
      textColor:  '',
    };
  }

  // ── Unit conversions ─────────────────────────────────────────
  function cToF(c)       { return Math.round(c * 9 / 5 + 32); }
  function kmhToMph(k)   { return Math.round(k * 0.621371); }

  function degToCardinal(deg) {
    const dirs = ['N','NE','E','SE','S','SW','W','NW'];
    return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
  }

  // ── Relative wind (8-way per spec) ───────────────────────────
  function relativeWindLabel(windDeg) {
    const heading = window.App && typeof window.App.getHeading === 'function'
      ? window.App.getHeading()
      : undefined;
    if (heading === undefined) return null;

    const rel = ((windDeg - heading) + 360) % 360;
    if (rel <= 22)  return '⬆ HEAD WIND';
    if (rel <= 67)  return '↗ RIGHT-FRONT';
    if (rel <= 112) return '→ FROM RIGHT';
    if (rel <= 157) return '↘ RIGHT-REAR';
    if (rel <= 202) return '⬇ TAIL WIND';
    if (rel <= 247) return '↙ LEFT-REAR';
    if (rel <= 292) return '← FROM LEFT';
    if (rel <= 337) return '↖ LEFT-FRONT';
    return '⬆ HEAD WIND';
  }

  // ── UV ───────────────────────────────────────────────────────
  function uvLabel(uv) {
    if (uv === null || uv === undefined) return '—';
    const n = Number(uv);
    if (n <= 2)  return 'Low';
    if (n <= 5)  return 'Moderate';
    if (n <= 7)  return 'High';
    if (n <= 10) return 'Very High';
    return 'Extreme';
  }

  function uvColorClass(uv) {
    const n = Number(uv);
    if (n <= 2)  return 'good';
    if (n <= 5)  return 'accent';
    return 'warn';
  }

  // ── WMO weathercode → emoji + label ─────────────────────────
  function codeToWeather(code) {
    if (code === 0)                              return { icon: '☀',  label: 'Clear' };
    if ([1,2,3].includes(code))                 return { icon: '⛅', label: 'Partly Cloudy' };
    if ([45,48].includes(code))                 return { icon: '🌫', label: 'Foggy' };
    if ([51,53,55,61,63,65].includes(code))     return { icon: '🌧', label: 'Rain' };
    if ([71,73,75,77].includes(code))           return { icon: '🌨', label: 'Snow' };
    if ([80,81,82].includes(code))              return { icon: '🌦', label: 'Showers' };
    if ([95,96,99].includes(code))              return { icon: '⛈', label: 'Storms' };
    return { icon: '🌡', label: 'Unknown' };
  }

  // ── Cache age string ─────────────────────────────────────────
  function cacheAgeStr() {
    if (!cacheTimestamp) return '';
    const ms  = Date.now() - cacheTimestamp;
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `Updated ${sec}s ago`;
    return `Updated ${Math.floor(sec / 60)}m ago`;
  }

  // ── DOM state helpers ────────────────────────────────────────
  function showLoading(msg) {
    els.loading.classList.remove('hidden');
    els.loadingText.textContent = msg;
    els.error.classList.add('hidden');
    els.weatherContent.classList.add('hidden');
  }

  function showError(msg) {
    els.loading.classList.add('hidden');
    els.error.textContent = msg;
    els.error.classList.remove('hidden');
    els.weatherContent.classList.add('hidden');
  }

  function showWeatherContent() {
    els.loading.classList.add('hidden');
    els.error.classList.add('hidden');
    els.weatherContent.classList.remove('hidden');
    if (window.App) window.App.refreshFocusables();
  }

  // ── Render all weather data ──────────────────────────────────
  function renderWeather() {
    if (!weatherData) return;

    const cw  = weatherData.current_weather;
    const now = new Date();

    // ── Temperature + condition ──
    const tempF = cToF(cw.temperature);
    const cond  = codeToWeather(cw.weathercode);
    els.tempValue.textContent   = `${tempF}°F`;
    els.weatherCond.textContent = `${cond.icon} ${cond.label}`;

    // ── Wind ──
    const windMph  = kmhToMph(cw.windspeed);
    const windCard = degToCardinal(cw.winddirection);
    const relWind  = relativeWindLabel(cw.winddirection);
    els.windSpeed.textContent  = `${windMph} mph`;
    els.windDirAbs.textContent = windCard;
    if (relWind) {
      els.windDirRel.textContent = relWind;
      els.windDirRel.classList.remove('hidden');
    } else {
      els.windDirRel.classList.add('hidden');
    }

    // ── UV index (current hour from hourly array) ──
    const currentHour = now.getHours();
    const uvRaw = weatherData.hourly?.uv_index?.[currentHour] ?? null;
    const uvNum = (uvRaw !== null && uvRaw !== undefined) ? Number(uvRaw).toFixed(1) : '—';
    els.uvValue.textContent   = uvNum;
    els.uvLabelEl.textContent = uvLabel(uvRaw);
    if (uvRaw !== null) {
      els.uvValue.className = 'cell-value-med ' + uvColorClass(uvRaw);
    }

    // ── Sunrise / Sunset from API daily data ──
    if (weatherData.daily?.sunrise?.[0]) {
      els.sunriseDisplay.textContent = '🌅 ' + fmtTime12(new Date(weatherData.daily.sunrise[0]));
    }
    if (weatherData.daily?.sunset?.[0]) {
      els.sunsetDisplay.textContent = '🌇 ' + fmtTime12(new Date(weatherData.daily.sunset[0]));
    }

    // ── Solar state (pure math) ──
    if (lat !== null) {
      const solar = solarTimes(lat, lon, now);
      const state = solarState(solar);

      els.solarIcon.textContent     = state.icon;
      els.solarText.textContent     = state.text;
      els.solarCountdown.textContent = state.countdown;
      els.solarText.style.color     = state.textColor || '';

      // Pulsing animation class on the solar block
      els.solarBlock.classList.remove('solar-pulse-amber', 'solar-pulse-blue');
      if (state.pulseClass) els.solarBlock.classList.add(state.pulseClass);

      // Solar noon
      if (solar) {
        els.solarNoonDisplay.textContent = '☀ Solar noon ' + fmtTime12(utcHToDate(solar.solarNoonUTC, now));
      }
    }

    // ── Footer ──
    els.weatherUpdated.textContent  = cacheAgeStr();
    if (lat !== null) {
      els.weatherLocation.textContent = `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
    }
  }

  // ── Open-Meteo fetch ─────────────────────────────────────────
  async function doFetch() {
    showLoading('⛅ Fetching weather…');

    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current_weather=true` +
      `&hourly=uv_index,weathercode` +
      `&daily=sunrise,sunset` +
      `&timezone=auto` +
      `&forecast_days=1`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      weatherData    = json;
      cacheTimestamp = Date.now();

      // Save to cache (full object with timestamp)
      LifeStorage.setData(LifeStorage.KEYS.WEATHER_CACHE, {
        timestamp: cacheTimestamp,
        data:      json,
        lat,
        lon,
      });

      showWeatherContent();
      renderWeather();
    } catch (err) {
      console.warn('Open-Meteo fetch failed:', err);
      // Fall back to stale cache
      const stale = LifeStorage.getData(LifeStorage.KEYS.WEATHER_CACHE);
      if (stale?.data) {
        weatherData    = stale.data;
        cacheTimestamp = stale.timestamp;
        if (!lat && stale.lat) { lat = stale.lat; lon = stale.lon; }
        showWeatherContent();
        renderWeather();
        els.weatherUpdated.textContent = '⚠ Stale — ' + cacheAgeStr();
      } else {
        showError('⚠ Weather unavailable');
      }
    }
  }

  // ── GPS request ──────────────────────────────────────────────
  function requestGPS() {
    if (!navigator.geolocation) {
      showError('📍 Location not supported on this device');
      return;
    }
    showLoading('📡 Getting location…');

    navigator.geolocation.getCurrentPosition(
      pos => {
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
        // Persist for next session
        LifeStorage.setPref('lastLat', lat);
        LifeStorage.setPref('lastLon', lon);
        doFetch();
      },
      err => {
        if (err.code === 1) {
          showError('📍 Location permission denied');
        } else {
          showError('📍 Location unavailable — check phone GPS');
        }
        // Show stale cache if available
        const stale = LifeStorage.getData(LifeStorage.KEYS.WEATHER_CACHE);
        if (stale?.data) {
          weatherData    = stale.data;
          cacheTimestamp = stale.timestamp;
          if (!lat && stale.lat) { lat = stale.lat; lon = stale.lon; }
          showWeatherContent();
          renderWeather();
          els.weatherUpdated.textContent = '⚠ No GPS — cached data';
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }

  // ── Main load decision ───────────────────────────────────────
  function maybeLoadWeather() {
    // Try to restore persisted lat/lon if not yet set
    if (lat === null) {
      const pLat = LifeStorage.getPref('lastLat');
      const pLon = LifeStorage.getPref('lastLon');
      if (pLat && pLon) { lat = pLat; lon = pLon; }
    }

    // Check cache freshness
    const cached = LifeStorage.getData(LifeStorage.KEYS.WEATHER_CACHE);
    if (cached?.data && (Date.now() - cached.timestamp) < CACHE_TTL) {
      weatherData    = cached.data;
      cacheTimestamp = cached.timestamp;
      if (!lat && cached.lat) { lat = cached.lat; lon = cached.lon; }
      showWeatherContent();
      renderWeather();

      // Silently try GPS to refresh solar math if lat still missing
      if (lat === null && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => { lat = pos.coords.latitude; lon = pos.coords.longitude; renderWeather(); },
          () => { /* ignore — we have cached data, solar math just won't show */ },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
        );
      }
      return;
    }

    // Cache miss or stale — need fresh GPS + fetch
    if (lat !== null) {
      // Already have coordinates (e.g. from compass GPS) — skip GPS step
      doFetch();
    } else {
      requestGPS();
    }
  }

  // ── 30s tick ─────────────────────────────────────────────────
  function tick() {
    if (!isVisible || !weatherData) return;
    renderWeather();
  }

  // ── Tab lifecycle (MutationObserver) ─────────────────────────
  function onTabFocus() {
    isVisible = true;
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(tick, TICK_MS);
    maybeLoadWeather();
  }

  function onTabBlur() {
    isVisible = false;
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
  }

  // ── GPS from compass.js (secondary source) ───────────────────
  function onGPSFix(latitude, longitude) {
    lat = latitude;
    lon = longitude;
    LifeStorage.setPref('lastLat', lat);
    LifeStorage.setPref('lastLon', lon);
    if (isVisible && weatherData) renderWeather();
    if (isVisible && !weatherData) maybeLoadWeather();
  }

  // ── Refresh (Enter on solar block) ───────────────────────────
  function doRefresh() {
    LifeStorage.deleteData(LifeStorage.KEYS.WEATHER_CACHE);
    weatherData    = null;
    cacheTimestamp = null;
    maybeLoadWeather();
  }

  // ── Activate (called by app.js on Enter) ─────────────────────
  function activate(el) {
    if (el.id === 'weather-solar-block') doRefresh();
    // Weather cells: Enter = no-op (read-only display)
  }

  // ── Init ─────────────────────────────────────────────────────
  function init() {
    els = {
      loading:          document.getElementById('weather-loading'),
      loadingText:      document.getElementById('weather-loading-text'),
      error:            document.getElementById('weather-error'),
      weatherContent:   document.getElementById('weather-content'),
      solarBlock:       document.getElementById('weather-solar-block'),
      solarIcon:        document.getElementById('solar-icon'),
      solarText:        document.getElementById('solar-status-text'),
      solarCountdown:   document.getElementById('solar-countdown'),
      tempValue:        document.getElementById('temp-value'),
      weatherCond:      document.getElementById('weather-condition'),
      windSpeed:        document.getElementById('wind-speed'),
      windDirAbs:       document.getElementById('wind-dir-abs'),
      windDirRel:       document.getElementById('wind-dir-rel'),
      uvValue:          document.getElementById('uv-value'),
      uvLabelEl:        document.getElementById('uv-label'),
      sunriseDisplay:   document.getElementById('sunrise-display'),
      sunsetDisplay:    document.getElementById('sunset-display'),
      weatherUpdated:   document.getElementById('weather-updated'),
      solarNoonDisplay: document.getElementById('solar-noon-display'),
      weatherLocation:  document.getElementById('weather-location'),
    };

    // Observe weather panel for active class toggle (tab lifecycle)
    const panel = document.getElementById('weather-panel');
    tabObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === 'class') {
          panel.classList.contains('active') ? onTabFocus() : onTabBlur();
        }
      }
    });
    tabObserver.observe(panel, { attributes: true });
  }

  function destroy() {
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    if (tabObserver)    { tabObserver.disconnect(); tabObserver = null; }
  }

  return { init, activate, destroy, onGPSFix };
})();

window.Weather = Weather;

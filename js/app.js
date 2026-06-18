// app.js — Life HUD app shell
// Tab switching: ArrowLeft/Right between 4 tabs
// Within-tab focus: ArrowUp/Down between .focusable elements
// Enter: activates currently focused element
// No mouse, touch, or keyboard input — arrows + Enter only

const App = (() => {
  const TABS = ['compass', 'weather', 'people', 'map'];
  const MODULES = { compass: window.Compass, weather: window.Weather, people: window.People, map: window.LifeMap };

  let currentTab = 0;      // 0=Compass, 1=Weather, 2=People
  let focusables = [];     // current tab's focusable elements
  let focusIndex = 0;      // which focusable is active
  let compassHeading = 0;  // shared heading value for weather module

  // ── Tab Switching ───────────────────────────────────────────
  function switchTab(index) {
    const panels = document.querySelectorAll('.tab-panel');
    const tabEls = document.querySelectorAll('.tab');

    panels[currentTab].classList.remove('active');
    tabEls[currentTab].classList.remove('active');

    currentTab = ((index % TABS.length) + TABS.length) % TABS.length;

    panels[currentTab].classList.add('active');
    tabEls[currentTab].classList.add('active');

    focusIndex = 0;
    refreshFocusables();
    applyFocus();

    if (TABS[currentTab] === 'map') {
      LifeMap.init();
      setTimeout(() => LifeMap.invalidateSize(), 100);
    }
  }

  // ── Focus Management ────────────────────────────────────────
  function refreshFocusables() {
    const panel = document.querySelectorAll('.tab-panel')[currentTab];
    focusables = Array.from(panel.querySelectorAll('.focusable'));
    // Clamp focusIndex after DOM rebuild
    if (focusIndex >= focusables.length) focusIndex = Math.max(0, focusables.length - 1);
    applyFocus();
  }

  function applyFocus() {
    focusables.forEach((el, i) => {
      el.classList.toggle('focused', i === focusIndex);
    });
    // Scroll focused element into view (for waypoint lists and other clipped containers)
    const focused = focusables[focusIndex];
    if (focused) focused.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function moveFocus(delta) {
    if (focusables.length === 0) return;
    focusIndex = (focusIndex + delta + focusables.length) % focusables.length;
    applyFocus();
  }

  // ── Enter / Activate ────────────────────────────────────────
  function activateFocused() {
    const el = focusables[focusIndex];
    if (!el) return;
    const tab = TABS[currentTab];
    const mod = MODULES[tab];
    if (mod && mod.activate) mod.activate(el);

    // People card horizontal navigation is handled via tab-level left/right,
    // but the card itself needs Enter for expand/collapse
  }

  // ── Keyboard Handler ────────────────────────────────────────
  function onKey(e) {
    // Prevent default browser scroll / focus behaviour
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter'].includes(e.key)) {
      e.preventDefault();
    }

    switch (e.key) {
      case 'ArrowLeft':
        if (currentTab === TABS.indexOf('people')) {
          if (!People.onLeft()) switchTab(currentTab - 1);
          return;
        }
        switchTab(currentTab - 1);
        break;

      case 'ArrowRight':
        if (currentTab === TABS.indexOf('people')) {
          if (!People.onRight()) switchTab(currentTab + 1);
          return;
        }
        switchTab(currentTab + 1);
        break;

      case 'ArrowUp':
        if (currentTab === TABS.indexOf('map')) { LifeMap.zoomIn(); return; }
        moveFocus(-1);
        break;

      case 'ArrowDown':
        if (currentTab === TABS.indexOf('map')) { LifeMap.zoomOut(); return; }
        moveFocus(1);
        break;

      case 'Enter':
        if (currentTab === TABS.indexOf('map')) { LifeMap.centerOnGPS(); return; }
        activateFocused();
        break;
    }
  }

  // ── Status Bar ──────────────────────────────────────────────
  function updateClock() {
    const el = document.getElementById('status-time');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // ── Shared heading (set by Compass, read by Weather) ────────
  function setHeading(deg) { compassHeading = deg; }
  function getHeading()    { return compassHeading; }

  // ── Boot ────────────────────────────────────────────────────
  function init() {
    // Init modules (LifeMap is lazy-inited on first tab visit)
    Compass.init();
    Weather.init();
    People.init();

    // Start on compass tab
    switchTab(0);

    // Keyboard
    window.addEventListener('keydown', onKey);

    // Clock
    updateClock();
    setInterval(updateClock, 10000);
  }

  document.addEventListener('DOMContentLoaded', init);

  return { switchTab, refreshFocusables, setHeading, getHeading };
})();

window.App = App;

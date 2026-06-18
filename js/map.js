// map.js — Tab 4: Waypoint Map
// Lazy Leaflet init (first tab visit only), CartoDB Dark Matter tiles.
// GPS marker: green dot. Waypoint markers: cyan dot + name label.
// ArrowUp/Down: zoom. Enter: center on GPS position.
// Refreshes waypoint markers via window.lifeHUDMapRefresh (called by compass.js).

const LifeMap = (() => {
  let map         = null;
  let gpsMarker   = null;
  let wpMarkers   = [];
  let initialized = false;

  function init() {
    if (initialized) return;
    initialized = true;

    map = L.map('waypoint-map', {
      center: [37.7749, -122.4194],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    refreshMarkers();
  }

  // ── Marker refresh — called by compass.js after pin drop ──────
  function refreshMarkers() {
    if (!map) return;
    wpMarkers.forEach(m => map.removeLayer(m));
    wpMarkers = [];

    const waypoints = LifeStorage.getWaypoints();
    waypoints.forEach(wp => {
      const icon = L.divIcon({
        className: 'waypoint-marker',
        html: `<div class="wp-dot"></div><div class="wp-label">${wp.name}</div>`,
        iconSize: [80, 30],
        iconAnchor: [40, 7],
      });
      const m = L.marker([wp.lat, wp.lon], { icon }).addTo(map);
      wpMarkers.push(m);
    });
  }

  // ── GPS position (called by compass.js on each GPS fix) ───────
  function updateGPS(lat, lon) {
    if (!map) return;
    if (gpsMarker) {
      gpsMarker.setLatLng([lat, lon]);
    } else {
      const icon = L.divIcon({
        className: 'gps-marker',
        html: '<div class="gps-dot"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      gpsMarker = L.marker([lat, lon], { icon }).addTo(map);
      map.setView([lat, lon], map.getZoom());
    }
  }

  function centerOnGPS() {
    if (!map || !gpsMarker) return;
    map.setView(gpsMarker.getLatLng(), map.getZoom());
  }

  function zoomIn()  { if (map) map.zoomIn(); }
  function zoomOut() { if (map) map.zoomOut(); }

  // Called by app.js after tab panel becomes visible so Leaflet recalculates size
  function invalidateSize() {
    if (map) map.invalidateSize();
  }

  return { init, refreshMarkers, updateGPS, centerOnGPS, zoomIn, zoomOut, invalidateSize };
})();

window.LifeMap = LifeMap;
// Hook for compass.js to refresh markers after a pin drop
window.lifeHUDMapRefresh = function () { LifeMap.refreshMarkers(); };

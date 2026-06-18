// storage.js — localStorage helpers, all keys prefixed lifehud_
// Budget: 5MB total. Keys: lifehud_contacts, lifehud_waypoints,
//         lifehud_weather_cache, lifehud_prefs

const KEYS = {
  CONTACTS: 'lifehud_contacts',
  WAYPOINTS: 'lifehud_waypoints',
  WEATHER_CACHE: 'lifehud_weather_cache',
  PREFS: 'lifehud_prefs',
};

const WEATHER_TTL = 600000; // 10 minutes in ms

function getData(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn('lifehud storage write failed:', e);
    return false;
  }
}

function deleteData(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function clearAll() {
  Object.values(KEYS).forEach(deleteData);
}

// Weather cache with TTL
function getWeatherCache() {
  const cached = getData(KEYS.WEATHER_CACHE);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > WEATHER_TTL) {
    deleteData(KEYS.WEATHER_CACHE);
    return null;
  }
  return cached.data;
}

function setWeatherCache(data) {
  setData(KEYS.WEATHER_CACHE, { timestamp: Date.now(), data });
}

// Contacts helpers
function getContacts() {
  return getData(KEYS.CONTACTS) || [];
}

function saveContacts(contacts) {
  return setData(KEYS.CONTACTS, contacts);
}

// Waypoints helpers
function getWaypoints() {
  return getData(KEYS.WAYPOINTS) || [];
}

function saveWaypoints(waypoints) {
  return setData(KEYS.WAYPOINTS, waypoints);
}

// Prefs helpers
function getPref(k, fallback = null) {
  const prefs = getData(KEYS.PREFS) || {};
  return k in prefs ? prefs[k] : fallback;
}

function setPref(k, v) {
  const prefs = getData(KEYS.PREFS) || {};
  prefs[k] = v;
  setData(KEYS.PREFS, prefs);
}

// ── Dev audit (console only) — window.lifeHUDStorageAudit() ──
window.lifeHUDStorageAudit = function () {
  try {
    let lifehudBytes = 0;
    let totalBytes   = 0;
    console.group('Life HUD Storage Audit');
    Object.entries(KEYS).forEach(([name, key]) => {
      const val = localStorage.getItem(key) || '';
      const kb  = (val.length / 1024).toFixed(2);
      lifehudBytes += val.length;
      console.log(`  ${key}: ${kb} KB`);
    });
    for (let i = 0; i < localStorage.length; i++) {
      totalBytes += (localStorage.getItem(localStorage.key(i)) || '').length;
    }
    const usedKb      = (lifehudBytes / 1024).toFixed(2);
    const totalKb     = (totalBytes   / 1024).toFixed(2);
    const remainingKb = (5120 - lifehudBytes / 1024).toFixed(2);
    console.log(`Life HUD total: ${usedKb} KB`);
    console.log(`All localStorage: ${totalKb} KB / 5120 KB`);
    console.log(`Remaining budget: ${remainingKb} KB`);
    const contacts = getData(KEYS.CONTACTS) || [];
    console.log(`Contacts: ${contacts.length}`);
    const withPhoto = contacts.filter(c => c.photo);
    if (withPhoto.length) {
      const avgKb = (withPhoto.reduce((s, c) => s + c.photo.length, 0) / withPhoto.length / 1024).toFixed(2);
      console.log(`Avg photo: ${avgKb} KB (${withPhoto.length} of ${contacts.length} have photos)`);
    }
    console.groupEnd();
  } catch (e) {
    console.error('Storage audit failed:', e);
  }
};

// ── Remote contact sync via /api/contacts (Vercel Blob) ──────
async function getRemoteContacts() {
  try {
    const r = await fetch('/api/contacts');
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function setRemoteContacts(contacts) {
  try {
    await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contacts),
    });
  } catch {
    // silent — localStorage remains source of truth on error
  }
}

window.LifeStorage = {
  KEYS,
  WEATHER_TTL,
  getData,
  setData,
  deleteData,
  clearAll,
  getWeatherCache,
  setWeatherCache,
  getContacts,
  saveContacts,
  getWaypoints,
  saveWaypoints,
  getPref,
  setPref,
  getRemoteContacts,
  setRemoteContacts,
};

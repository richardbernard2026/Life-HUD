// people.js — Tab 3: People Cards
// ArrowLeft/Right: navigate cards (wrap-around), handled by app.js → onLeft/onRight
// Enter: toggle expanded / collapsed view
// ArrowUp/Down (expanded): scroll notes content
// Tab lifecycle: MutationObserver on #people-panel — re-reads contacts on focus

const People = (() => {
  let contacts    = [];
  let currentIndex = 0;
  let isExpanded  = false;
  let prevCount   = -1;     // detect count change between visits
  let isVisible   = false;
  let tabObserver = null;
  let els         = {};

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // ── Birthday helpers ────────────────────────────────────────
  function daysUntilBirthday(str) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bday  = new Date(str + 'T00:00:00');
    const target = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
    if (target < today) target.setFullYear(today.getFullYear() + 1);
    return Math.ceil((target - today) / 86400000);
  }

  function birthdayInfo(str) {
    if (!str) return null;
    const days  = daysUntilBirthday(str);
    const bday  = new Date(str + 'T00:00:00');
    const label = `${MONTHS[bday.getMonth()]} ${bday.getDate()}`;

    if (days === 0)       return { text: '🎂 TODAY!',              color: '#ffaa00', pulse: true };
    if (days <= 7)        return { text: `🎂 in ${days} days`,     color: '#ffaa00', pulse: false };
    if (days <= 30)       return { text: `🎂 in ${days} days`,     color: '#00d4ff', pulse: false };
    return                       { text: `🎂 ${label}  · in ${days} days`, color: '#ffffff', pulse: false };
  }

  // ── Slide animation ─────────────────────────────────────────
  function slideCard(dir) {
    const cls = dir === 'right' ? 'slide-from-right' : 'slide-from-left';
    els.card.classList.remove('slide-from-right', 'slide-from-left');
    void els.card.offsetWidth;  // force reflow to restart animation
    els.card.classList.add(cls);
  }

  // ── Render ──────────────────────────────────────────────────
  function render() {
    if (contacts.length === 0) {
      els.noContacts.classList.remove('hidden');
      els.layout.classList.add('hidden');
      if (window.App) window.App.refreshFocusables();
      return;
    }

    els.noContacts.classList.add('hidden');
    els.layout.classList.remove('hidden');

    const c = contacts[currentIndex];

    // Counter
    els.counter.textContent = `${currentIndex + 1} / ${contacts.length}`;

    // Photo
    els.photo.innerHTML = '';
    els.photo.classList.toggle('has-photo', !!c.photo);
    if (c.photo) {
      const img = document.createElement('img');
      img.src = c.photo;
      img.alt = c.name;
      els.photo.appendChild(img);
    } else {
      els.photo.textContent = '?';
    }

    // Name
    els.name.textContent = c.name || 'Unknown';

    // Birthday
    if (c.birthday) {
      const bd = birthdayInfo(c.birthday);
      els.birthday.textContent = bd.text;
      els.birthday.style.color = bd.color;
      els.birthday.classList.toggle('birthday-pulse', bd.pulse);
      els.birthday.classList.remove('hidden');
    } else {
      els.birthday.classList.add('hidden');
    }

    // Phone
    if (c.phone) {
      els.phone.textContent = c.phone;
      els.phone.classList.remove('hidden');
    } else {
      els.phone.classList.add('hidden');
    }

    // Notes (collapsed preview)
    if (c.notes) {
      const preview = c.notes.length > 80 ? c.notes.slice(0, 80) + '…' : c.notes;
      els.notesPreview.textContent = preview;
      els.notesPreview.classList.remove('hidden');
    } else {
      els.notesPreview.classList.add('hidden');
    }

    // Full notes content (always updated, visibility managed by expand/collapse)
    els.notesFull.textContent = c.notes || '';

    // Ensure collapsed state on render
    els.divider.classList.add('hidden');
    els.notesFull.classList.add('hidden');
    isExpanded = false;

    updateHint();
    if (window.App) window.App.refreshFocusables();
  }

  // ── Expand / Collapse ────────────────────────────────────────
  function expand() {
    isExpanded = true;
    els.notesPreview.classList.add('hidden');
    els.divider.classList.remove('hidden');
    els.notesFull.classList.remove('hidden');
    els.notesFull.scrollTop = 0;
    updateHint();
  }

  function collapse() {
    isExpanded = false;
    const c = contacts[currentIndex];
    if (c && c.notes) els.notesPreview.classList.remove('hidden');
    els.divider.classList.add('hidden');
    els.notesFull.classList.add('hidden');
    els.notesFull.scrollTop = 0;
    updateHint();
  }

  function updateHint() {
    els.hint.textContent = isExpanded
      ? '↑ ↓ scroll  ↵ collapse'
      : '← → navigate  ↵ expand';
  }

  // ── Tab lifecycle ────────────────────────────────────────────
  async function onTabFocus() {
    isVisible = true;
    // Show local data immediately (instant)
    const local = LifeStorage.getContacts();
    const sameCount = local.length === prevCount;
    contacts  = local;
    prevCount = contacts.length;
    if (!sameCount) currentIndex = 0;
    if (isExpanded) collapse();
    render();

    // Sync from blob in background; update if data changed
    const remote = await LifeStorage.getRemoteContacts();
    if (remote && Array.isArray(remote) && isVisible) {
      const changed = JSON.stringify(remote) !== JSON.stringify(contacts);
      if (changed) {
        LifeStorage.saveContacts(remote);
        const sameCount2 = remote.length === prevCount;
        contacts  = remote;
        prevCount = contacts.length;
        if (!sameCount2) currentIndex = 0;
        render();
      }
    }
  }

  function onTabBlur() {
    isVisible = false;
    if (isExpanded) collapse();
  }

  // ── Navigation ───────────────────────────────────────────────
  // Returns true if card navigated, false if at boundary (app.js switches tabs on false)
  function onLeft() {
    if (contacts.length === 0 || currentIndex <= 0) return false;
    if (isExpanded) collapse();
    currentIndex -= 1;
    render();
    slideCard('left');
    return true;
  }

  function onRight() {
    if (contacts.length === 0 || currentIndex >= contacts.length - 1) return false;
    if (isExpanded) collapse();
    currentIndex += 1;
    render();
    slideCard('right');
    return true;
  }

  // ── Enter ────────────────────────────────────────────────────
  function activate(el) {
    if (el.id !== 'contact-card') return;
    if (contacts.length === 0) return;
    isExpanded ? collapse() : expand();
  }

  // ── ArrowUp/Down scrolls notes when expanded ─────────────────
  function onKey(e) {
    if (!isVisible || !isExpanded) return;
    if (e.key === 'ArrowUp')   els.notesFull.scrollTop -= 40;
    if (e.key === 'ArrowDown') els.notesFull.scrollTop += 40;
  }

  // ── Init ─────────────────────────────────────────────────────
  function init() {
    els = {
      noContacts:   document.getElementById('no-contacts'),
      layout:       document.getElementById('people-layout'),
      header:       document.getElementById('people-header'),
      counter:      document.getElementById('people-counter'),
      card:         document.getElementById('contact-card'),
      photo:        document.getElementById('contact-photo'),
      name:         document.getElementById('contact-name'),
      birthday:     document.getElementById('contact-birthday'),
      phone:        document.getElementById('contact-phone'),
      notesPreview: document.getElementById('contact-notes-preview'),
      divider:      document.getElementById('contact-divider'),
      notesFull:    document.getElementById('contact-notes-full'),
      hint:         document.getElementById('people-hint'),
    };

    // Watch for tab focus/blur via class change on the panel
    const panel = document.getElementById('people-panel');
    tabObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === 'class') {
          panel.classList.contains('active') ? onTabFocus() : onTabBlur();
        }
      }
    });
    tabObserver.observe(panel, { attributes: true });

    // Scroll listener for expanded notes
    window.addEventListener('keydown', onKey);

    // Initial state (people tab is not active at boot — compass is)
    contacts  = LifeStorage.getContacts();
    prevCount = contacts.length;
    render();
  }

  return { init, activate, onLeft, onRight };
})();

window.People = People;

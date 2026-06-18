// companion.js — Life HUD Companion Page
// Add / Edit / Delete contacts in lifehud_contacts localStorage key.
// Photo: canvas-resize to max 200×200, JPEG quality 0.82.

(function () {
  'use strict';

  const STORAGE_KEY = 'lifehud_contacts';
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // ── Storage ─────────────────────────────────────────────────
  function getContacts() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function saveContacts(contacts) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
      return true;
    } catch {
      showToast('Storage full — remove photos to free space');
      return false;
    }
  }

  // ── Photo resize ─────────────────────────────────────────────
  // Always resize to max 200×200 at JPEG quality 0.82
  function resizePhoto(file) {
    return new Promise((resolve, reject) => {
      const MAX = 200;
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            const ratio = Math.min(MAX / width, MAX / height);
            width  = Math.round(width  * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width  = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          const b64 = canvas.toDataURL('image/jpeg', 0.82);
          // Estimate compressed byte size from base64 payload length
          const payload = b64.split(',')[1] || '';
          const compressedBytes = Math.round(payload.length * 0.75);
          resolve({ b64, originalBytes: file.size, compressedBytes });
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function fmtBytes(bytes) {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return Math.round(bytes / 1024) + ' KB';
  }

  // ── Remote sync ──────────────────────────────────────────────
  // Fire-and-forget: localStorage is always written first, blob is best-effort
  async function syncRemote(contacts) {
    try {
      await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contacts),
      });
    } catch { /* silent — localStorage is primary */ }
  }

  // ── Toast ────────────────────────────────────────────────────
  let toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById('toast');
    clearTimeout(toastTimer);
    el.textContent = msg;
    el.classList.remove('hidden', 'toast-fade');
    toastTimer = setTimeout(() => {
      el.classList.add('toast-fade');
      setTimeout(() => el.classList.add('hidden'), 400);
    }, 2500);
  }

  // ── HTML escaping ─────────────────────────────────────────────
  function esc(str) {
    return String(str)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  // ── State ─────────────────────────────────────────────────────
  let editingId       = null;   // null = add mode; string/number = edit mode
  let pendingPhotoB64 = null;   // null = no new photo selected this session

  // ── DOM refs ──────────────────────────────────────────────────
  const form          = document.getElementById('contact-form');
  const nameInput     = document.getElementById('inp-name');
  const birthdayInput = document.getElementById('inp-birthday');
  const phoneInput    = document.getElementById('inp-phone');
  const notesInput    = document.getElementById('inp-notes');
  const photoInput    = document.getElementById('inp-photo');
  const photoCircle   = document.getElementById('photo-preview-circle');
  const photoSizeInfo = document.getElementById('photo-size-info');
  const saveBtn       = document.getElementById('btn-save');
  const cancelBtn     = document.getElementById('btn-cancel');
  const formTitle     = document.getElementById('form-title');
  const nameError     = document.getElementById('name-error');
  const contactList   = document.getElementById('contact-list');
  const exportBtn     = document.getElementById('btn-export');
  const importInput   = document.getElementById('inp-import');
  const importPreview = document.getElementById('import-preview');
  const importPreviewText = document.getElementById('import-preview-text');
  const importError   = document.getElementById('import-error');
  const replaceAllBtn = document.getElementById('btn-replace-all');
  const importCancelBtn = document.getElementById('btn-import-cancel');
  const storageInfo   = document.getElementById('storage-info');

  // ── Photo preview helpers ────────────────────────────────────
  function setPhotoPreview(b64) {
    if (b64) {
      photoCircle.style.backgroundImage = `url(${b64})`;
      photoCircle.textContent = '';
      photoCircle.classList.add('has-photo');
    } else {
      photoCircle.style.backgroundImage = '';
      photoCircle.textContent = '?';
      photoCircle.classList.remove('has-photo');
    }
  }

  // ── Photo input ──────────────────────────────────────────────
  photoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const result = await resizePhoto(file);
      pendingPhotoB64 = result.b64;
      setPhotoPreview(result.b64);
      photoSizeInfo.textContent =
        `Original: ${fmtBytes(result.originalBytes)} → Compressed: ${fmtBytes(result.compressedBytes)}`;
    } catch {
      showToast('Could not read image file');
      pendingPhotoB64 = null;
    }
  });

  // ── Form submit ──────────────────────────────────────────────
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      nameError.classList.remove('hidden');
      nameInput.focus();
      return;
    }
    nameError.classList.add('hidden');

    const contacts = getContacts();
    let toastMsg;

    if (editingId !== null) {
      const idx = contacts.findIndex(c => c.id === editingId);
      if (idx !== -1) {
        contacts[idx] = {
          ...contacts[idx],
          name,
          birthday: birthdayInput.value,
          phone:    phoneInput.value.trim(),
          notes:    notesInput.value.trim(),
          // Only update photo if a new one was selected
          photo:    pendingPhotoB64 !== null ? pendingPhotoB64 : contacts[idx].photo,
        };
      }
      toastMsg = 'Contact updated ✓';
    } else {
      contacts.push({
        id:       Date.now().toString(),
        name,
        birthday: birthdayInput.value,
        phone:    phoneInput.value.trim(),
        notes:    notesInput.value.trim(),
        photo:    pendingPhotoB64 || '',
      });
      toastMsg = 'Contact saved ✓';
    }

    if (saveContacts(contacts)) {
      syncRemote(contacts);
      resetForm();
      renderList();
      updateHeaderCount();
      updateExportBtn();
      showToast(toastMsg);
      document.getElementById('contact-list').scrollIntoView({ behavior: 'smooth' });
    }
  });

  // ── Cancel ───────────────────────────────────────────────────
  cancelBtn.addEventListener('click', resetForm);

  function resetForm() {
    editingId       = null;
    pendingPhotoB64 = null;
    form.reset();
    setPhotoPreview(null);
    photoSizeInfo.textContent = '';
    nameError.classList.add('hidden');
    formTitle.textContent   = 'Add Contact';
    saveBtn.textContent     = 'Add Contact';
    cancelBtn.classList.add('hidden');
  }

  // ── Render contact list ──────────────────────────────────────
  function renderList() {
    const contacts = getContacts();
    contactList.innerHTML = '';

    if (contacts.length === 0) {
      const msg = document.createElement('p');
      msg.id = 'no-contacts-msg';
      msg.textContent = 'No contacts yet. Add your first one above.';
      contactList.appendChild(msg);
      return;
    }

    contacts.forEach(c => {
      const card = document.createElement('div');
      card.className = 'contact-card';

      // Thumb: background-image for photo, initial letter for none
      const thumbStyle = c.photo
        ? `background-image:url("${esc(c.photo)}")` : '';
      const thumbLetter = c.photo ? '' : esc((c.name || '?')[0].toUpperCase());

      // Birthday preview: "🎂 May 21"
      let bdayHtml = '';
      if (c.birthday) {
        try {
          const d = new Date(c.birthday + 'T00:00:00');
          bdayHtml = `<span class="contact-bday">🎂 ${MONTHS[d.getMonth()]} ${d.getDate()}</span>`;
        } catch { /* ignore bad dates */ }
      }

      card.innerHTML = `
        <div class="contact-row">
          <div class="contact-thumb" style="${thumbStyle}">${thumbLetter}</div>
          <div class="contact-info">
            <div class="contact-name">${esc(c.name)}</div>
            ${bdayHtml}
          </div>
          <div class="contact-btns">
            <button class="btn-icon btn-edit" title="Edit" aria-label="Edit ${esc(c.name)}">✏</button>
            <button class="btn-icon btn-delete" title="Delete" aria-label="Delete ${esc(c.name)}">🗑</button>
          </div>
        </div>
        <div class="delete-confirm hidden">
          <span>Delete ${esc(c.name)}?</span>
          <button class="btn-confirm-yes">YES</button>
          <button class="btn-confirm-no">NO</button>
        </div>
      `;

      card.querySelector('.btn-edit').addEventListener('click', () => startEdit(c.id));

      card.querySelector('.btn-delete').addEventListener('click', () => {
        card.querySelector('.delete-confirm').classList.toggle('hidden');
      });

      card.querySelector('.btn-confirm-yes').addEventListener('click', () => {
        deleteContact(c.id, card);
      });

      card.querySelector('.btn-confirm-no').addEventListener('click', () => {
        card.querySelector('.delete-confirm').classList.add('hidden');
      });

      contactList.appendChild(card);
    });
  }

  // ── Edit ─────────────────────────────────────────────────────
  function startEdit(id) {
    const contacts = getContacts();
    const c = contacts.find(x => x.id === id);
    if (!c) return;

    editingId           = id;
    pendingPhotoB64     = null;   // don't override photo unless new one selected
    nameInput.value     = c.name     || '';
    birthdayInput.value = c.birthday || '';
    phoneInput.value    = c.phone    || '';
    notesInput.value    = c.notes    || '';
    photoSizeInfo.textContent = '';
    nameError.classList.add('hidden');

    setPhotoPreview(c.photo || null);

    formTitle.textContent = 'Edit Contact';
    saveBtn.textContent   = 'Update Contact';
    cancelBtn.classList.remove('hidden');

    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => nameInput.focus(), 300);
  }

  // ── Delete with fade-out ─────────────────────────────────────
  function deleteContact(id, cardEl) {
    cardEl.style.opacity = '0';
    setTimeout(() => {
      let contacts = getContacts();
      contacts = contacts.filter(c => c.id !== id);
      saveContacts(contacts);
      syncRemote(contacts);
      renderList();
      updateHeaderCount();
      updateExportBtn();
      showToast('Contact deleted');
    }, 250);
  }

  // ── Export ───────────────────────────────────────────────────
  function updateExportBtn() {
    const n = getContacts().length;
    exportBtn.textContent = `Export JSON (${n} contact${n !== 1 ? 's' : ''})`;
  }

  exportBtn.addEventListener('click', () => {
    const contacts = getContacts();
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(contacts, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `lifehud-contacts-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // ── Import ───────────────────────────────────────────────────
  importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    importError.classList.add('hidden');
    importPreview.classList.add('hidden');

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!Array.isArray(parsed) || !parsed.every(x => x && typeof x.name === 'string')) {
          throw new Error('Invalid format');
        }
        // Show preview
        importPreviewText.textContent =
          `Found ${parsed.length} contact${parsed.length !== 1 ? 's' : ''} — import will REPLACE your current list. Confirm?`;
        importPreview.classList.remove('hidden');

        replaceAllBtn.onclick = () => {
          saveContacts(parsed);
          syncRemote(parsed);
          renderList();
          updateHeaderCount();
          updateExportBtn();
          importPreview.classList.add('hidden');
          importInput.value = '';
          showToast(`${parsed.length} contacts imported ✓`);
        };

        importCancelBtn.onclick = () => {
          importPreview.classList.add('hidden');
          importInput.value = '';
        };

      } catch {
        importError.textContent = 'Invalid file — expected Life HUD contacts JSON';
        importError.classList.remove('hidden');
      }
    };
    reader.readAsText(file);
  });

  // ── Collapsible IO section ────────────────────────────────────
  const ioHeader = document.getElementById('io-header');
  const ioBody   = document.getElementById('io-body');
  const ioChevron = document.getElementById('io-chevron');

  ioHeader.addEventListener('click', () => {
    const open = !ioBody.classList.contains('hidden');
    ioBody.classList.toggle('hidden', open);
    ioHeader.classList.toggle('open', !open);
    ioChevron.textContent = open ? '▼' : '▲';
    if (!open) updateStorageInfo();
  });

  // ── Header count + storage info ──────────────────────────────
  function updateHeaderCount() {
    const n = getContacts().length;
    document.getElementById('contact-count-pill').textContent =
      `${n} contact${n !== 1 ? 's' : ''}`;
  }

  function updateStorageInfo() {
    try {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        total += (localStorage.getItem(localStorage.key(i)) || '').length;
      }
      const kb  = (total / 1024).toFixed(1);
      const pct = ((total / (5 * 1024 * 1024)) * 100).toFixed(1);
      storageInfo.textContent = `Storage: ${kb} KB / 5120 KB (${pct}%)`;
    } catch {
      storageInfo.textContent = 'Storage info unavailable';
    }
  }

  // ── Init ─────────────────────────────────────────────────────
  resetForm();
  renderList();
  updateHeaderCount();
  updateExportBtn();
})();

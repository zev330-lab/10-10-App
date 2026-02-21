/* 10:10 Journal — v4.0.0 — Complete Rebuild */
(function () {
  'use strict';
  const VERSION = 'v4.0.0';
  const STORE_CFG = 'tenTen_config';
  const STORE_ENTRIES = 'tenTen_entries';

  /* ── Utilities ────────────────────────────────── */
  const $ = (s, p) => (p || document).querySelector(s);
  const $$ = (s, p) => [...(p || document).querySelectorAll(s)];
  const el = (tag, attrs = {}, children = []) => {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'className') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
      else e.setAttribute(k, v);
    });
    children.forEach(c => {
      if (typeof c === 'string') e.appendChild(document.createTextNode(c));
      else if (c) e.appendChild(c);
    });
    return e;
  };

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function friendlyDate(iso) {
    const d = new Date(iso + 'T12:00:00');
    const opts = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    return d.toLocaleDateString('en-US', opts);
  }

  function shortDate(iso) {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  /* ── Data Layer ───────────────────────────────── */
  function getConfig() {
    try { return JSON.parse(localStorage.getItem(STORE_CFG)) || null; } catch { return null; }
  }
  function saveConfig(cfg) { localStorage.setItem(STORE_CFG, JSON.stringify(cfg)); }
  function getEntries() {
    try { return JSON.parse(localStorage.getItem(STORE_ENTRIES)) || []; } catch { return []; }
  }
  function saveEntries(arr) { localStorage.setItem(STORE_ENTRIES, JSON.stringify(arr)); }

  function getStreak() {
    const entries = getEntries().sort((a, b) => b.date.localeCompare(a.date));
    if (!entries.length) return 0;
    let streak = 0;
    let check = new Date();
    // If today has no entry yet, start checking from yesterday
    const todayEntry = entries.find(e => e.date === todayISO());
    if (!todayEntry) check.setDate(check.getDate() - 1);
    for (let i = 0; i < 400; i++) {
      const iso = `${check.getFullYear()}-${String(check.getMonth() + 1).padStart(2, '0')}-${String(check.getDate()).padStart(2, '0')}`;
      if (entries.find(e => e.date === iso)) {
        streak++;
        check.setDate(check.getDate() - 1);
      } else break;
    }
    // Add today if it exists
    if (todayEntry && streak === 0) streak = 1;
    return streak;
  }

  /* ── Toast ────────────────────────────────────── */
  let toastEl;
  function toast(msg) {
    if (!toastEl) {
      toastEl = el('div', { className: 'toast' });
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2500);
  }

  /* ── Navigation ───────────────────────────────── */
  const main = $('#main');
  const navBtns = $$('.nav-btn');
  let currentPage = 'entry';

  function navigate(page) {
    currentPage = page;
    navBtns.forEach(b => b.classList.toggle('active', b.dataset.page === page));
    main.innerHTML = '';
    main.style.animation = 'none';
    void main.offsetHeight;
    main.style.animation = 'fadeUp 0.4s ease-out';
    switch (page) {
      case 'entry': renderEntry(); break;
      case 'history': renderHistory(); break;
      case 'setup': renderSetup(); break;
    }
    updateStreak();
  }

  navBtns.forEach(b => b.addEventListener('click', () => navigate(b.dataset.page)));

  function updateStreak() {
    const s = getStreak();
    const disp = $('#streak-display');
    if (disp) disp.textContent = s > 0 ? `🔥 ${s} day streak` : '';
  }

  /* ── Entry Page ───────────────────────────────── */
  function renderEntry() {
    const cfg = getConfig();
    if (!cfg) {
      main.innerHTML = '';
      main.appendChild(el('div', { className: 'empty-state' }, [
        el('div', { className: 'empty-icon', text: '◎' }),
        el('p', { text: 'Set up your journal to get started.' }),
        el('button', { className: 'btn btn-primary', text: 'Go to Setup', style: 'margin-top:1rem;max-width:200px;margin-left:auto;margin-right:auto;', onClick: () => navigate('setup') })
      ]));
      return;
    }

    const today = todayISO();
    const entries = getEntries();
    const existing = entries.find(e => e.date === today);
    const streak = getStreak();

    // Streak banner
    if (streak > 0 || existing) {
      const banner = el('div', { className: 'streak-banner' }, [
        el('div', { className: 'streak-num', text: String(existing ? Math.max(streak, 1) : streak) }),
        el('div', { className: 'streak-text', html: `<strong>${existing ? 'Entry recorded today' : 'Day streak'}</strong>${existing ? 'Tap Save to update' : 'Keep the momentum going'}` })
      ]);
      main.appendChild(banner);
    }

    // Date title
    main.appendChild(el('h2', { className: 'page-title', text: friendlyDate(today) }));
    main.appendChild(el('p', { className: 'page-subtitle', text: existing ? 'Edit today\'s entry' : 'Begin your daily practice' }));

    const form = el('form', { id: 'entry-form' });

    // Gratitudes card
    const gCard = el('div', { className: 'card' });
    gCard.appendChild(el('div', { className: 'card-label', html: '🙏 Gratitudes <span class="count" id="g-count">0/10</span>' }));
    for (let i = 0; i < 10; i++) {
      const val = existing?.gratitudes?.[i] || '';
      const row = el('div', { className: 'input-row', style: `animation-delay:${i * 30}ms` });
      row.classList.add('stagger-in');
      row.appendChild(el('span', { className: 'input-num', text: `${i + 1}.` }));
      const inp = el('input', {
        className: `input-field gratitude-input${val ? ' filled' : ''}`,
        type: 'text',
        placeholder: `I'm grateful for...`,
        value: val,
        'data-idx': String(i)
      });
      inp.addEventListener('input', () => {
        inp.classList.toggle('filled', inp.value.trim().length > 0);
        updateCounts();
      });
      row.appendChild(inp);
      gCard.appendChild(row);
    }
    form.appendChild(gCard);

    // Intentions card
    const iCard = el('div', { className: 'card' });
    iCard.appendChild(el('div', { className: 'card-label', html: '🎯 Intentions <span class="count" id="i-count">0/10</span>' }));
    for (let i = 0; i < 10; i++) {
      const val = existing?.intentions?.[i] || '';
      const row = el('div', { className: 'input-row', style: `animation-delay:${(i + 10) * 30}ms` });
      row.classList.add('stagger-in');
      row.appendChild(el('span', { className: 'input-num', text: `${i + 1}.` }));
      const inp = el('input', {
        className: `input-field intention-input${val ? ' filled' : ''}`,
        type: 'text',
        placeholder: `I intend to...`,
        value: val,
        'data-idx': String(i)
      });
      inp.addEventListener('input', () => {
        inp.classList.toggle('filled', inp.value.trim().length > 0);
        updateCounts();
      });
      row.appendChild(inp);
      iCard.appendChild(row);
    }
    form.appendChild(iCard);

    // Reflections card
    const rCard = el('div', { className: 'card' });
    rCard.appendChild(el('div', { className: 'card-label', text: '💭 Reflections' }));

    const r1Label = el('p', { text: 'Visualize life without these blessings — feel the contrast.', style: 'font-size:0.8rem;color:var(--text-muted);margin-bottom:0.5rem;font-style:italic;' });
    const r1 = el('textarea', {
      className: 'input-field',
      id: 'reflection1',
      placeholder: 'What would life look like without these gifts?',
      rows: '3'
    });
    r1.value = existing?.reflection1 || '';

    const r2Label = el('p', { text: 'Step into your intentions as if they are already real.', style: 'font-size:0.8rem;color:var(--text-muted);margin:0.75rem 0 0.5rem;font-style:italic;' });
    const r2 = el('textarea', {
      className: 'input-field',
      id: 'reflection2',
      placeholder: 'How does it feel when these intentions are fulfilled?',
      rows: '3'
    });
    r2.value = existing?.reflection2 || '';

    const nLabel = el('p', { text: 'Closing thoughts', style: 'font-size:0.8rem;color:var(--text-muted);margin:0.75rem 0 0.5rem;font-weight:600;' });
    const notes = el('textarea', {
      className: 'input-field',
      id: 'closing-notes',
      placeholder: 'Any final reflections or notes...',
      rows: '2'
    });
    notes.value = existing?.notes || '';

    rCard.append(r1Label, r1, r2Label, r2, nLabel, notes);
    form.appendChild(rCard);

    // Submit
    const saveBtn = el('button', { className: 'btn btn-primary', type: 'submit', text: existing ? '✓ Update Entry' : '✦ Save Entry' });
    form.appendChild(saveBtn);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const gratitudes = $$('.gratitude-input', form).map(i => i.value.trim()).filter(Boolean);
      const intentions = $$('.intention-input', form).map(i => i.value.trim()).filter(Boolean);

      if (gratitudes.length === 0 && intentions.length === 0) {
        toast('Please add at least one gratitude or intention');
        return;
      }

      const entry = {
        date: today,
        gratitudes,
        intentions,
        reflection1: r1.value.trim(),
        reflection2: r2.value.trim(),
        notes: notes.value.trim(),
        timestamp: new Date().toISOString()
      };

      const all = getEntries();
      const idx = all.findIndex(e => e.date === today);
      if (idx >= 0) all[idx] = entry;
      else all.push(entry);
      saveEntries(all);

      toast(existing ? 'Entry updated ✓' : 'Entry saved ✦');
      setTimeout(() => navigate('entry'), 300);
    });

    main.appendChild(form);
    updateCounts();
  }

  function updateCounts() {
    const gCount = $$('.gratitude-input').filter(i => i.value.trim()).length;
    const iCount = $$('.intention-input').filter(i => i.value.trim()).length;
    const gc = $('#g-count');
    const ic = $('#i-count');
    if (gc) gc.textContent = `${gCount}/10`;
    if (ic) ic.textContent = `${iCount}/10`;
  }

  /* ── History Page ─────────────────────────────── */
  function renderHistory() {
    main.appendChild(el('h2', { className: 'page-title', text: 'Journal History' }));

    const entries = getEntries().sort((a, b) => b.date.localeCompare(a.date));
    if (!entries.length) {
      main.appendChild(el('div', { className: 'empty-state' }, [
        el('div', { className: 'empty-icon', text: '◷' }),
        el('p', { text: 'No entries yet. Start your practice today.' })
      ]));
      return;
    }

    main.appendChild(el('p', { className: 'page-subtitle', text: `${entries.length} entries recorded` }));

    entries.forEach((entry, idx) => {
      const item = el('div', { className: 'history-entry stagger-in', style: `animation-delay:${idx * 50}ms` });

      const gLen = entry.gratitudes?.length || 0;
      const iLen = entry.intentions?.length || 0;

      const header = el('div', { className: 'history-header' });
      header.appendChild(el('span', { className: 'history-date', text: shortDate(entry.date) }));
      const meta = el('div', { className: 'history-meta' });
      meta.appendChild(el('span', { text: `${gLen} gratitudes` }));
      meta.appendChild(el('span', { text: `${iLen} intentions` }));
      if (gLen >= 10 && iLen >= 10) {
        meta.appendChild(el('span', { className: 'history-badge', text: 'Complete' }));
      }
      header.appendChild(meta);

      const detail = el('div', { className: 'history-detail' });

      if (entry.gratitudes?.length) {
        detail.appendChild(el('h4', { text: 'Gratitudes' }));
        const ol = el('ol');
        entry.gratitudes.forEach(g => ol.appendChild(el('li', { text: g })));
        detail.appendChild(ol);
      }
      if (entry.intentions?.length) {
        detail.appendChild(el('h4', { text: 'Intentions' }));
        const ol = el('ol');
        entry.intentions.forEach(i => ol.appendChild(el('li', { text: i })));
        detail.appendChild(ol);
      }
      if (entry.reflection1) {
        detail.appendChild(el('h4', { text: 'Gratitude Reflection' }));
        detail.appendChild(el('div', { className: 'reflection-text', text: entry.reflection1 }));
      }
      if (entry.reflection2) {
        detail.appendChild(el('h4', { text: 'Intention Reflection' }));
        detail.appendChild(el('div', { className: 'reflection-text', text: entry.reflection2 }));
      }
      if (entry.notes) {
        detail.appendChild(el('h4', { text: 'Closing Notes' }));
        detail.appendChild(el('div', { className: 'reflection-text', text: entry.notes }));
      }

      header.addEventListener('click', () => detail.classList.toggle('open'));

      item.append(header, detail);
      main.appendChild(item);
    });

    // Export button
    const exportBtn = el('button', { className: 'btn btn-ghost', text: '↓ Export CSV', style: 'margin-top:1rem;' });
    exportBtn.addEventListener('click', () => exportCSV(entries));
    main.appendChild(exportBtn);
  }

  function exportCSV(entries) {
    let csv = 'Date,Gratitudes,Intentions,Reflection1,Reflection2,ClosingNotes\n';
    entries.forEach(e => {
      const g = (e.gratitudes || []).join(' | ');
      const i = (e.intentions || []).join(' | ');
      const r1 = (e.reflection1 || '').replace(/\n/g, ' ');
      const r2 = (e.reflection2 || '').replace(/\n/g, ' ');
      const n = (e.notes || '').replace(/\n/g, ' ');
      csv += `${e.date},"${g}","${i}","${r1}","${r2}","${n}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = el('a', { href: URL.createObjectURL(blob), download: 'ten-ten-journal.csv' });
    a.click();
    URL.revokeObjectURL(a.href);
    toast('CSV downloaded');
  }

  /* ── Setup Page ───────────────────────────────── */
  function renderSetup() {
    const cfg = getConfig() || {};
    main.appendChild(el('h2', { className: 'page-title', text: 'Setup' }));
    main.appendChild(el('p', { className: 'page-subtitle', text: 'Configure your journal practice' }));

    const card = el('div', { className: 'card' });
    const form = el('form', { className: 'setup-form' });

    // Start date
    const g1 = el('div', { className: 'form-group' });
    g1.appendChild(el('label', { text: 'Start Date', for: 'cfg-start' }));
    g1.appendChild(el('input', { className: 'input-field', type: 'date', id: 'cfg-start', value: cfg.startDate || todayISO() }));
    form.appendChild(g1);

    // Length
    const g2 = el('div', { className: 'form-group' });
    g2.appendChild(el('label', { text: 'Program Length (days, optional)', for: 'cfg-length' }));
    g2.appendChild(el('input', { className: 'input-field', type: 'number', id: 'cfg-length', min: '1', placeholder: 'e.g. 90 (leave blank for ongoing)', value: cfg.length || '' }));
    form.appendChild(g2);

    // Reminder
    const g3 = el('div', { className: 'form-group' });
    g3.appendChild(el('label', { text: 'Daily Reminder Time', for: 'cfg-reminder' }));
    g3.appendChild(el('input', { className: 'input-field', type: 'time', id: 'cfg-reminder', value: cfg.reminderTime || '07:00' }));
    form.appendChild(g3);

    form.appendChild(el('div', { className: 'setup-info', html: '<strong>How it works:</strong> Each day, list 10 things you\'re grateful for, set 10 intentions, then reflect deeply on both. The practice builds awareness and manifestation through consistency.' }));

    const saveBtn = el('button', { className: 'btn btn-primary', type: 'submit', text: cfg.startDate ? 'Update Settings' : 'Start Journal' });
    form.appendChild(saveBtn);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const newCfg = {
        startDate: $('#cfg-start').value || todayISO(),
        reminderTime: $('#cfg-reminder').value || '07:00'
      };
      const len = $('#cfg-length').value;
      if (len) newCfg.length = Number(len);
      saveConfig(newCfg);
      scheduleNotification(newCfg);
      toast('Settings saved ✓');
      navigate('entry');
    });

    card.appendChild(form);
    main.appendChild(card);

    // Data management
    const section = el('div', { className: 'settings-section' });
    section.appendChild(el('h3', { text: 'Data Management' }));

    const entries = getEntries();
    section.appendChild(el('p', { style: 'font-size:0.85rem;color:var(--text-muted);margin-bottom:0.75rem;', text: `${entries.length} entries stored locally on this device.` }));

    const btnRow = el('div', { className: 'btn-row' });
    if (entries.length) {
      const expBtn = el('button', { className: 'btn btn-ghost', text: '↓ Export CSV', type: 'button' });
      expBtn.addEventListener('click', () => exportCSV(entries));
      btnRow.appendChild(expBtn);
    }
    const resetBtn = el('button', { className: 'btn btn-danger', text: 'Reset All Data', type: 'button' });
    resetBtn.addEventListener('click', () => {
      if (confirm('This will permanently delete all entries and settings. Continue?')) {
        localStorage.removeItem(STORE_CFG);
        localStorage.removeItem(STORE_ENTRIES);
        toast('All data cleared');
        navigate('setup');
      }
    });
    btnRow.appendChild(resetBtn);
    section.appendChild(btnRow);
    main.appendChild(section);
  }

  /* ── Notifications ────────────────────────────── */
  function scheduleNotification(cfg) {
    if (!cfg?.reminderTime) return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') Notification.requestPermission();
    if (window.__tenTenTimer) clearTimeout(window.__tenTenTimer);
    const [h, m] = cfg.reminderTime.split(':').map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(h, m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    window.__tenTenTimer = setTimeout(() => {
      if (Notification.permission === 'granted') {
        new Notification('10:10 Journal', { body: 'Time for your daily practice ✦', icon: 'ten10-icon-192.png' });
      }
      scheduleNotification(cfg);
    }, target - now);
  }

  /* ── Service Worker ───────────────────────────── */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }

  /* ── Init ─────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    const v = $('#version');
    if (v) v.textContent = VERSION;
    const cfg = getConfig();
    if (cfg) {
      scheduleNotification(cfg);
      navigate('entry');
    } else {
      navigate('setup');
    }
  });
})();

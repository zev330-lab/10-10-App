/* global Notification */

// Version string for debugging and verification
const APP_VERSION = 'v3.0.0';

// Insert version string into footer once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const versionEl = document.getElementById('version');
  if (versionEl) versionEl.textContent = APP_VERSION;
});

// Retrieve the application configuration from localStorage
function getConfig() {
  try {
    return JSON.parse(localStorage.getItem('tenTenConfig')) || null;
  } catch (e) {
    return null;
  }
}

// Persist the application configuration to localStorage
function saveConfig(cfg) {
  localStorage.setItem('tenTenConfig', JSON.stringify(cfg));
}

// Retrieve entries (an array of log objects) from localStorage
function getEntries() {
  try {
    return JSON.parse(localStorage.getItem('tenTenEntries')) || [];
  } catch (e) {
    return [];
  }
}

// Persist entries array to localStorage
function saveEntries(entries) {
  localStorage.setItem('tenTenEntries', JSON.stringify(entries));
}

// Return today's date in ISO format but adjusted for local timezone
function localISODate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  const local = new Date(now.getTime() - offset);
  return local.toISOString().split('T')[0];
}

// Compute the end date given a start date and length (number of days)
function computeEndDate(startDate, length) {
  if (!startDate || !length) return null;
  const date = new Date(startDate);
  date.setDate(date.getDate() + Number(length) - 1);
  // adjust for timezone offset
  const offset = date.getTimezoneOffset() * 60000;
  const local = new Date(date.getTime() - offset);
  return local.toISOString().split('T')[0];
}

// Request notification permission and schedule a reminder at the specified time (HH:MM)
function scheduleNotification() {
  const cfg = getConfig();
  if (!cfg || !cfg.reminderTime) return;
  // Request permission only once
  if (Notification && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  // Clear existing timers
  if (window.__tenTenTimeout) {
    clearTimeout(window.__tenTenTimeout);
  }
  // Compute delay until next scheduled time
  const [hours, minutes] = cfg.reminderTime.split(':').map(Number);
  const now = new Date();
  let target = new Date();
  target.setHours(hours, minutes, 0, 0);
  // if target time has already passed today, schedule for tomorrow
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }
  const delay = target.getTime() - now.getTime();
  window.__tenTenTimeout = setTimeout(() => {
    if (Notification && Notification.permission === 'granted') {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg) {
          reg.showNotification('10‑10 Journal Reminder', {
            body: 'It’s time to complete your 10‑10 practice.',
            icon: 'icon-192x192.png'
          });
        } else {
          new Notification('10‑10 Journal Reminder', { body: 'It’s time to complete your 10‑10 practice.' });
        }
      });
    }
    // Reschedule for next day
    scheduleNotification();
  }, delay);
}

// Render the setup form
function renderSetup() {
  setActiveNav('setup');
  const app = document.getElementById('app');
  const cfg = getConfig() || {};
  // Determine default values
  const defaultStart = cfg.startDate || localISODate();
  const defaultLength = cfg.length != null ? cfg.length : '';
  const defaultTime = cfg.reminderTime || '07:00';
  app.innerHTML = '';
  const form = document.createElement('form');
  form.innerHTML = `
    <label for="startDate">Start Date</label>
    <input type="date" id="startDate" value="${defaultStart}">
    <label for="length">Program Length (days, optional)</label>
    <input type="number" id="length" min="1" placeholder="e.g. 28" value="${defaultLength}">
    <label for="reminderTime">Reminder Time (HH:MM)</label>
    <input type="time" id="reminderTime" value="${defaultTime}">
    <button type="submit" class="submit">Save & Start</button>
  `;
  form.onsubmit = e => {
    e.preventDefault();
    const startDate = form.querySelector('#startDate').value;
    const length = form.querySelector('#length').value;
    const reminderTime = form.querySelector('#reminderTime').value || '07:00';
    const newCfg = { startDate, reminderTime };
    if (length) newCfg.length = Number(length);
    saveConfig(newCfg);
    scheduleNotification();
    renderEntry();
  };
  app.appendChild(form);
}

// Render the daily entry form
function renderEntry() {
  setActiveNav('entry');
  const app = document.getElementById('app');
  const cfg = getConfig();
  if (!cfg) {
    app.innerHTML = `<div class="message">Please complete setup first.</div>`;
    return;
  }
  const today = localISODate();
  // Check start and end dates
  if (cfg.startDate && today < cfg.startDate) {
    app.innerHTML = `<div class="message">Your program begins on <strong>${cfg.startDate}</strong>. Come back then.</div>`;
    return;
  }
  if (cfg.length && cfg.startDate) {
    const endDate = computeEndDate(cfg.startDate, cfg.length);
    if (today > endDate) {
      app.innerHTML = `<div class="message">Your program ended on <strong>${endDate}</strong>. View your history or reset in settings.</div>`;
      return;
    }
  }
  const entries = getEntries();
  const existingIndex = entries.findIndex(e => e.date === today);
  const existing = existingIndex >= 0 ? entries[existingIndex] : null;
  // Build form
  app.innerHTML = '';
  const form = document.createElement('form');
  let gratitudeInputs = '';
  let intentionInputs = '';
  for (let i = 0; i < 10; i++) {
    const gVal = existing && existing.gratitudes && existing.gratitudes[i] ? existing.gratitudes[i] : '';
    const iVal = existing && existing.intentions && existing.intentions[i] ? existing.intentions[i] : '';
    gratitudeInputs += `<input type="text" placeholder="Gratitude ${i+1}" value="${gVal.replace(/"/g,'&quot;')}">`;
    intentionInputs += `<input type="text" placeholder="Intention ${i+1}" value="${iVal.replace(/"/g,'&quot;')}">`;
  }
  const ref1 = existing && existing.reflection1 ? existing.reflection1 : '';
  const ref2 = existing && existing.reflection2 ? existing.reflection2 : '';
  const notes = existing && existing.notes ? existing.notes : '';
  form.innerHTML = `
    <h2>Daily Entry for ${today}</h2>
    <label>Gratitudes</label>
    ${gratitudeInputs}
    <label>Intentions</label>
    ${intentionInputs}
    <label>Reflection on Gratitude (visualise life without these blessings)</label>
    <textarea id="reflection1">${ref1}</textarea>
    <label>Reflection on Intentions (feel as if they are reality)</label>
    <textarea id="reflection2">${ref2}</textarea>
    <label>Closing Thoughts</label>
    <textarea id="closingNotes">${notes}</textarea>
    <button type="submit" class="submit">Save Entry</button>
  `;
  form.onsubmit = e => {
    e.preventDefault();
    const inputs = Array.from(form.querySelectorAll('input[type="text"]'));
    const gratitudes = inputs.slice(0, 10).map(inp => inp.value.trim()).filter(v => v);
    const intentions = inputs.slice(10).map(inp => inp.value.trim()).filter(v => v);
    const reflection1 = form.querySelector('#reflection1').value.trim();
    const reflection2 = form.querySelector('#reflection2').value.trim();
    const closingNotes = form.querySelector('#closingNotes').value.trim();
    const newEntry = {
      date: today,
      gratitudes,
      intentions,
      reflection1,
      reflection2,
      notes: closingNotes,
      timestamp: new Date().toISOString()
    };
    if (existing) {
      entries[existingIndex] = newEntry;
    } else {
      entries.push(newEntry);
    }
    saveEntries(entries);
    alert('Entry saved for ' + today + '.');
    renderHistory();
  };
  app.appendChild(form);
}

// Render the history table
function renderHistory() {
  setActiveNav('history');
  const app = document.getElementById('app');
  const entries = getEntries();
  if (!entries.length) {
    app.innerHTML = `<div class="message">No journal entries recorded yet.</div>`;
    return;
  }
  // Sort entries by date descending
  entries.sort((a,b) => b.date.localeCompare(a.date));
  let table = `<h2>History</h2><table><thead><tr><th>Date</th><th># Gratitudes</th><th># Intentions</th><th>Preview</th></tr></thead><tbody>`;
  for (const entry of entries) {
    const previewG = entry.gratitudes && entry.gratitudes[0] ? entry.gratitudes[0] : '';
    const previewI = entry.intentions && entry.intentions[0] ? entry.intentions[0] : '';
    table += `<tr><td>${entry.date}</td><td>${entry.gratitudes.length}</td><td>${entry.intentions.length}</td><td>${previewG} / ${previewI}</td></tr>`;
  }
  table += '</tbody></table>';
  // Download CSV button
  table += `<button class="submit" id="downloadCsv">Download CSV</button>`;
  app.innerHTML = table;
  const btn = document.getElementById('downloadCsv');
  btn.onclick = () => downloadCSV(entries);
}

// Convert entries array to CSV and trigger download
function downloadCSV(entries) {
  let csv = 'Date,Gratitudes,Intentions,Reflection1,Reflection2,ClosingNotes\n';
  for (const entry of entries) {
    const g = entry.gratitudes.join(' | ');
    const i = entry.intentions.join(' | ');
    const r1 = entry.reflection1.replace(/\n/g, ' ');
    const r2 = entry.reflection2.replace(/\n/g, ' ');
    const notes = entry.notes.replace(/\n/g, ' ');
    csv += `${entry.date},"${g}","${i}","${r1}","${r2}","${notes}"\n`;
  }
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ten-ten-history.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Render settings page
function renderSettings() {
  setActiveNav('settings');
  const app = document.getElementById('app');
  const cfg = getConfig();
  let html = `<h2>Settings</h2>`;
  if (cfg) {
    html += `<p><strong>Start Date:</strong> ${cfg.startDate}</p>`;
    html += `<p><strong>Program Length:</strong> ${cfg.length || 'Indefinite'}</p>`;
    html += `<p><strong>Reminder Time:</strong> ${cfg.reminderTime}</p>`;
  } else {
    html += `<p>No configuration found. Please complete setup.</p>`;
  }
  html += `<button class="submit" id="resetAll">Reset Data</button>`;
  app.innerHTML = html;
  document.getElementById('resetAll').onclick = () => {
    if (confirm('This will clear all configuration and entries. Continue?')) {
      localStorage.removeItem('tenTenConfig');
      localStorage.removeItem('tenTenEntries');
      alert('All data cleared.');
      renderSetup();
    }
  };
}

// Helper to update nav button states
function setActiveNav(id) {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    if (btn.id === 'nav-' + id) btn.classList.add('active');
    else btn.classList.remove('active');
  });
}

// Attach event listeners to nav buttons and initialise page
function init() {
  document.getElementById('nav-setup').addEventListener('click', renderSetup);
  document.getElementById('nav-entry').addEventListener('click', renderEntry);
  document.getElementById('nav-history').addEventListener('click', renderHistory);
  document.getElementById('nav-settings').addEventListener('click', renderSettings);
  // Attempt to restore state: if config exists and valid date, go to Entry; else Setup
  const cfg = getConfig();
  if (cfg) {
    const today = localISODate();
    if (cfg.startDate && today < cfg.startDate) {
      renderEntry();
    } else if (cfg.length && cfg.startDate && today > computeEndDate(cfg.startDate, cfg.length)) {
      renderHistory();
    } else {
      renderEntry();
    }
    scheduleNotification();
  } else {
    renderSetup();
  }
}

// Register service worker and initialise app
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js')
    .then(() => {
      init();
    })
    .catch(() => {
      // If service worker registration fails (e.g. when loaded via file:// scheme), still initialise app
      init();
    });
} else {
  init();
}
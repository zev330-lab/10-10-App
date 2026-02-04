/*
 * 10‑10 Journal application logic.
 *
 * This script powers a daily practice of gratitude and intention setting.
 * Users configure a start date and a reminder time, then each day they
 * record ten things they are grateful for and ten things they wish to
 * co‑create in their life. After each set they pause for reflection and
 * add closing thoughts. Entries are stored locally and can be exported
 * to CSV for review or analysis.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Populate the footer with the current year
  document.getElementById('year').textContent = new Date().getFullYear();

  const app = document.getElementById('app');
  const navButtons = Array.from(document.querySelectorAll('#nav button'));

  // Simple navigation: when a nav button is clicked, render the
  // corresponding page and highlight the active button.
  function navigate(page) {
    navButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === page);
    });
    if (pages[page]) pages[page]();
  }

  // Page rendering functions are stored in this object for easy access.
  const pages = {
    setup: renderSetup,
    entry: renderEntry,
    history: renderHistory,
    settings: renderSettings
  };

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      navigate(btn.dataset.page);
    });
  });

  // Decide which page to show on load: if no configuration, show setup;
  // otherwise, direct the user to the daily entry page.
  if (!getConfig()) {
    navigate('setup');
  } else {
    navigate('entry');
  }

  /* Helper functions for configuration and entries
   * Configuration is stored as an object with the following properties:
   *   startDate: ISO date string
   *   reminder: HH:MM string
   *   length: number of days (optional)
   * Entries are stored as an array of objects with properties:
   *   date: ISO date string
   *   gratitude: array of 10 strings
   *   intentions: array of 10 strings
   *   reflection1: string
   *   reflection2: string
   *   closing: string
   */
  function getConfig() {
    try {
      return JSON.parse(localStorage.getItem('tenConfig') || 'null');
    } catch {
      return null;
    }
  }

  function saveConfig(cfg) {
    localStorage.setItem('tenConfig', JSON.stringify(cfg));
  }

  function getEntries() {
    try {
      return JSON.parse(localStorage.getItem('tenEntries') || '[]');
    } catch {
      return [];
    }
  }

  function saveEntries(list) {
    localStorage.setItem('tenEntries', JSON.stringify(list));
  }

  /* Notification helper
   * Requests permission and schedules a daily notification using
   * service worker registrations if available. The notification time is
   * interpreted relative to the user's local timezone. If the user
   * disables notifications or the browser does not support them, this
   * function simply returns.
   */
  async function scheduleDailyNotification(timeStr, title, body) {
    if (!('Notification' in window)) return;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
    } catch {
      return;
    }
    // Register service worker if not already
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('service-worker.js');
      } catch (e) {
        // Silently fail if registration fails
      }
    }
    // Calculate delay until next notification
    const [hours, minutes] = timeStr.split(':').map(n => parseInt(n, 10));
    function schedule() {
      const now = new Date();
      const next = new Date();
      next.setHours(hours, minutes, 0, 0);
      if (next <= now) {
        next.setDate(now.getDate() + 1);
      }
      const timeout = next.getTime() - now.getTime();
      setTimeout(async () => {
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'notify',
            title,
            body
          });
        } else {
          // Fallback: directly show notification
          new Notification(title, { body });
        }
        schedule();
      }, timeout);
    }
    schedule();
  }

  // Handle messages from service worker to display notifications
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data && event.data.type === 'notify') {
        new Notification(event.data.title, { body: event.data.body });
      }
    });
  }

  // Render the setup page
  function renderSetup() {
    app.innerHTML = '';
    const header = document.createElement('div');
    header.innerHTML = `
      <h2>Setup Your Journal</h2>
      <p>Welcome to the <strong>10‑10 Journal</strong>. This practice invites you
      to start each day by listing ten things you are grateful for and ten
      things you intend to co‑create in your life. After writing your
      gratitudes, pause to reflect on what your life would be like without
      these blessings. After writing your intentions, pause to feel
      gratitude as if those desires have already come true. Consistency is
      more powerful than perfection—allow your lists to evolve as you do.</p>
    `;
    app.appendChild(header);
    const form = document.createElement('form');
    form.id = 'setup-form';
    form.innerHTML = `
      <label>Start Date
        <input type="date" name="startDate" required />
      </label>
      <label>Daily Reminder Time
        <input type="time" name="reminder" required />
      </label>
      <label>Program Length (days, optional)
        <input type="number" name="length" min="1" max="365" placeholder="30" />
      </label>
      <button type="submit" class="submit">Save &amp; Begin</button>
    `;
    form.addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(form);
      const cfg = {
        startDate: data.get('startDate'),
        reminder: data.get('reminder'),
        length: data.get('length') ? parseInt(data.get('length'), 10) : null
      };
      saveConfig(cfg);
      saveEntries([]);
      // Schedule notifications
      scheduleDailyNotification(cfg.reminder, '10‑10 Journal', 'Time to record your gratitudes and intentions');
      navigate('entry');
    });
    app.appendChild(form);
  }

  // Render the daily entry page
  function renderEntry() {
    const cfg = getConfig();
    if (!cfg) {
      navigate('setup');
      return;
    }
    app.innerHTML = '';
    // Use the user's local date rather than UTC to avoid off‑by‑one errors.
    // new Date().toISOString() returns a date in UTC; if the user is behind UTC the day
    // will appear as yesterday. Convert to local ISO date by adjusting with the
    // timezone offset. See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#examples for details.
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    const today = local.toISOString().split('T')[0];

    // Determine if the journal is within its configured schedule. If the
    // program has not started yet, or has ended (when a length is set),
    // show an informative message instead of the entry form.
    const start = cfg.startDate;
    const programStart = new Date(start);
    // Compute end date if a length is provided. The program length is in days
    // and includes the start date itself, so subtract 1 when adding days.
    let programEnd = null;
    if (cfg.length && !isNaN(cfg.length)) {
      const end = new Date(programStart);
      end.setDate(end.getDate() + parseInt(cfg.length, 10) - 1);
      programEnd = end;
    }
    const todayDateObj = new Date(today);
    if (todayDateObj < programStart) {
      app.innerHTML = '';
      const section = document.createElement('section');
      section.innerHTML = `<h2>Program Not Started</h2><p>Your journal begins on <strong>${cfg.startDate}</strong>. Please come back then to record your first entry.</p>`;
      app.appendChild(section);
      return;
    }
    if (programEnd && todayDateObj > programEnd) {
      app.innerHTML = '';
      const section = document.createElement('section');
      const endDateStr = programEnd.toISOString().split('T')[0];
      section.innerHTML = `<h2>Program Completed</h2><p>Your journal ended on <strong>${endDateStr}</strong>. You can review your history or reset the program in settings.</p>`;
      app.appendChild(section);
      return;
    }

    const section = document.createElement('section');
    section.innerHTML = `<h2>Daily Entry for ${today}</h2>`;
    const form = document.createElement('form');
    form.id = 'entry-form';
    // Create inputs for 10 gratitude items
    const gratitudeFieldset = document.createElement('fieldset');
    const gratitudeLegend = document.createElement('legend');
    gratitudeLegend.textContent = 'Gratitude (10 items)';
    gratitudeFieldset.appendChild(gratitudeLegend);
    for (let i = 0; i < 10; i++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.name = `gratitude${i}`;
      input.placeholder = `Grateful for ...`;
      input.required = i === 0; // require at least one
      gratitudeFieldset.appendChild(input);
    }
    form.appendChild(gratitudeFieldset);
    // Reflection after gratitude
    const reflection1 = document.createElement('label');
    reflection1.innerHTML = 'Reflection after Gratitude<br><textarea name="reflection1" placeholder="Reflect on life without these blessings..."></textarea>';
    form.appendChild(reflection1);
    // Inputs for 10 intentions
    const intentionFieldset = document.createElement('fieldset');
    const intentionLegend = document.createElement('legend');
    intentionLegend.textContent = 'Intentions (10 items)';
    intentionFieldset.appendChild(intentionLegend);
    for (let i = 0; i < 10; i++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.name = `intention${i}`;
      input.placeholder = `I co‑create ...`;
      input.required = i === 0;
      intentionFieldset.appendChild(input);
    }
    form.appendChild(intentionFieldset);
    // Reflection after intentions
    const reflection2 = document.createElement('label');
    reflection2.innerHTML = 'Reflection after Intentions<br><textarea name="reflection2" placeholder="Feel as if your intentions have already come true..."></textarea>';
    form.appendChild(reflection2);
    // Closing thoughts
    const closing = document.createElement('label');
    closing.innerHTML = 'Closing Thoughts<br><textarea name="closing" placeholder="How did this practice make you feel?"></textarea>';
    form.appendChild(closing);
    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'submit';
    submitBtn.textContent = 'Save Entry';
    form.appendChild(submitBtn);
    // Submission handler
    form.addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(form);
      // Build arrays of gratitudes and intentions, filter out empty strings
      const gratitudes = [];
      const intentions = [];
      for (let i = 0; i < 10; i++) {
        const g = data.get(`gratitude${i}`);
        if (g && g.trim().length > 0) gratitudes.push(g.trim());
        const q = data.get(`intention${i}`);
        if (q && q.trim().length > 0) intentions.push(q.trim());
      }
      const entry = {
        date: today,
        gratitude: gratitudes,
        intentions: intentions,
        reflection1: (data.get('reflection1') || '').trim(),
        reflection2: (data.get('reflection2') || '').trim(),
        closing: (data.get('closing') || '').trim()
      };
      const entries = getEntries();
      // Replace existing entry for today if exists
      const index = entries.findIndex(e => e.date === today);
      if (index >= 0) {
        entries[index] = entry;
      } else {
        entries.push(entry);
      }
      saveEntries(entries);
      alert('Entry saved. Thank you for practicing gratitude and intention setting!');
      form.reset();
    });
    section.appendChild(form);
    app.appendChild(section);
  }

  // Render the history page
  function renderHistory() {
    const entries = getEntries();
    app.innerHTML = '<h2>History</h2>';
    if (entries.length === 0) {
      app.innerHTML += '<p>No entries yet. Record your first day!</p>';
      return;
    }
    // Summary: show number of entries
    const summary = document.createElement('p');
    summary.textContent = `You have recorded ${entries.length} entry(ies).`;
    app.appendChild(summary);
    // Table of entries with truncated examples
    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr>
          <th>Date</th>
          <th># Gratitudes</th>
          <th># Intentions</th>
          <th>First Gratitude</th>
          <th>First Intention</th>
        </tr>
      </thead>
      <tbody>
        ${entries
          .map(
            e => `<tr>
          <td>${e.date}</td>
          <td>${e.gratitude.length}</td>
          <td>${e.intentions.length}</td>
          <td>${e.gratitude[0] || ''}</td>
          <td>${e.intentions[0] || ''}</td>
        </tr>`
          )
          .join('')}
      </tbody>
    `;
    app.appendChild(table);
    // Export button
    const exportBtn = document.createElement('button');
    exportBtn.className = 'submit';
    exportBtn.textContent = 'Export CSV';
    exportBtn.addEventListener('click', () => {
      const csvRows = [];
      csvRows.push('date,gratitudes,intentions,reflection1,reflection2,closing');
      entries.forEach(e => {
        const g = e.gratitude.map(s => s.replace(/"/g, '""')).join('; ');
        const i = e.intentions.map(s => s.replace(/"/g, '""')).join('; ');
        const row = [
          e.date,
          '"' + g + '"',
          '"' + i + '"',
          '"' + (e.reflection1 || '').replace(/"/g, '""') + '"',
          '"' + (e.reflection2 || '').replace(/"/g, '""') + '"',
          '"' + (e.closing || '').replace(/"/g, '""') + '"'
        ];
        csvRows.push(row.join(','));
      });
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '10-10-journal-data.csv';
      a.click();
      URL.revokeObjectURL(url);
    });
    app.appendChild(exportBtn);
  }

  // Render the settings page
  function renderSettings() {
    const cfg = getConfig();
    app.innerHTML = '<h2>Settings</h2>';
    if (!cfg) {
      app.innerHTML += '<p>No configuration found. Please set up the app first.</p>';
      return;
    }
    const info = document.createElement('div');
    info.innerHTML = `
      <p><strong>Start Date:</strong> ${cfg.startDate}</p>
      <p><strong>Reminder Time:</strong> ${cfg.reminder}</p>
      <p><strong>Program Length:</strong> ${cfg.length ? cfg.length + ' day(s)' : 'Not specified'}</p>
    `;
    app.appendChild(info);
    // Reset button
    const resetBtn = document.createElement('button');
    resetBtn.className = 'submit';
    resetBtn.textContent = 'Reset Configuration & Data';
    resetBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset configuration and all entries?')) {
        localStorage.removeItem('tenConfig');
        localStorage.removeItem('tenEntries');
        navigate('setup');
      }
    });
    app.appendChild(resetBtn);
  }
});
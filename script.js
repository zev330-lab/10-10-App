/* 10:10 Journal — v5.0.0 — Complete PWA */
(function () {
  'use strict';

  var VERSION = 'v5.0.0';
  var STORE_CONFIG = 'ten10_config';
  var STORE_ENTRIES = 'ten10_entries';

  /* ═══════════════════════════════════════════════════
     UTILITIES
     ═══════════════════════════════════════════════════ */

  function $(selector, parent) {
    return (parent || document).querySelector(selector);
  }

  function $$(selector, parent) {
    return Array.from((parent || document).querySelectorAll(selector));
  }

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    attrs = attrs || {};
    children = children || [];
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (k === 'className') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.indexOf('on') === 0 && typeof v === 'function') {
        e.addEventListener(k.slice(2).toLowerCase(), v);
      }
      else e.setAttribute(k, v);
    });
    children.forEach(function (c) {
      if (!c) return;
      if (typeof c === 'string') e.appendChild(document.createTextNode(c));
      else e.appendChild(c);
    });
    return e;
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function dateToISO(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function friendlyDate(iso) {
    var d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric'
    });
  }

  function longDate(iso) {
    var d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric'
    });
  }

  function daysBetween(iso1, iso2) {
    var a = new Date(iso1 + 'T12:00:00');
    var b = new Date(iso2 + 'T12:00:00');
    return Math.round((b - a) / 86400000);
  }

  /* ═══════════════════════════════════════════════════
     DATA LAYER
     ═══════════════════════════════════════════════════ */

  function getConfig() {
    try { return JSON.parse(localStorage.getItem(STORE_CONFIG)) || null; }
    catch (e) { return null; }
  }

  function saveConfig(cfg) {
    localStorage.setItem(STORE_CONFIG, JSON.stringify(cfg));
  }

  function getEntries() {
    try { return JSON.parse(localStorage.getItem(STORE_ENTRIES)) || []; }
    catch (e) { return []; }
  }

  function saveEntries(arr) {
    localStorage.setItem(STORE_ENTRIES, JSON.stringify(arr));
  }

  function getEntryForDate(iso) {
    var entries = getEntries();
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].date === iso) return entries[i];
    }
    return null;
  }

  function calculateStreak() {
    var entries = getEntries().sort(function (a, b) {
      return b.date.localeCompare(a.date);
    });
    if (!entries.length) return { current: 0, longest: 0 };

    var entryDates = {};
    entries.forEach(function (e) { entryDates[e.date] = true; });

    var streak = 0;
    var check = new Date();
    var today = todayISO();

    // If today has no entry, start checking from yesterday
    if (!entryDates[today]) {
      check.setDate(check.getDate() - 1);
    }

    for (var i = 0; i < 1000; i++) {
      var iso = dateToISO(check);
      if (entryDates[iso]) {
        streak++;
        check.setDate(check.getDate() - 1);
      } else {
        break;
      }
    }

    // Calculate longest streak
    var sortedDates = Object.keys(entryDates).sort();
    var longest = 0;
    var currentRun = 1;
    for (var j = 1; j < sortedDates.length; j++) {
      var diff = daysBetween(sortedDates[j - 1], sortedDates[j]);
      if (diff === 1) {
        currentRun++;
      } else {
        if (currentRun > longest) longest = currentRun;
        currentRun = 1;
      }
    }
    if (currentRun > longest) longest = currentRun;

    return { current: streak, longest: longest };
  }

  /* ═══════════════════════════════════════════════════
     TOAST SYSTEM
     ═══════════════════════════════════════════════════ */

  var toastContainer = null;
  var toastEl = null;
  var toastTimer = null;

  function showToast(msg) {
    if (!toastContainer) {
      toastContainer = el('div', { className: 'toast-container' });
      toastEl = el('div', { className: 'toast' });
      toastContainer.appendChild(toastEl);
      document.body.appendChild(toastContainer);
    }
    if (toastTimer) clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.classList.remove('show');
    // Force reflow
    void toastEl.offsetHeight;
    toastEl.classList.add('show');
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('show');
    }, 2500);
  }

  /* ═══════════════════════════════════════════════════
     CONFIRMATION MODAL
     ═══════════════════════════════════════════════════ */

  function showConfirm(title, message, confirmText, onConfirm) {
    var overlay = el('div', { className: 'modal-overlay' });
    var box = el('div', { className: 'modal-box' }, [
      el('div', { className: 'modal-title', text: title }),
      el('div', { className: 'modal-message', text: message }),
      el('div', { className: 'modal-actions' }, [
        el('button', {
          className: 'modal-btn cancel',
          text: 'Cancel',
          onClick: function () {
            overlay.classList.remove('visible');
            setTimeout(function () { overlay.remove(); }, 300);
          }
        }),
        el('button', {
          className: 'modal-btn confirm-danger',
          text: confirmText,
          onClick: function () {
            overlay.classList.remove('visible');
            setTimeout(function () {
              overlay.remove();
              onConfirm();
            }, 300);
          }
        })
      ])
    ]);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    // Trigger animation
    requestAnimationFrame(function () {
      overlay.classList.add('visible');
    });
  }

  /* ═══════════════════════════════════════════════════
     SPARKLE ANIMATION
     ═══════════════════════════════════════════════════ */

  function spawnSparkles() {
    var emojis = ['✨', '⭐', '🌟', '💛', '✦'];
    for (var i = 0; i < 12; i++) {
      (function (idx) {
        setTimeout(function () {
          var s = el('div', { className: 'sparkle' });
          s.textContent = emojis[idx % emojis.length];
          var startX = window.innerWidth / 2 + (Math.random() - 0.5) * 200;
          var startY = window.innerHeight / 2;
          s.style.left = startX + 'px';
          s.style.top = startY + 'px';
          var sx = (Math.random() - 0.5) * 200;
          var sy = -(Math.random() * 200 + 50);
          s.style.setProperty('--sx', sx + 'px');
          s.style.setProperty('--sy', sy + 'px');
          document.body.appendChild(s);
          setTimeout(function () { s.remove(); }, 1000);
        }, idx * 60);
      })(i);
    }
  }

  /* ═══════════════════════════════════════════════════
     CSV EXPORT
     ═══════════════════════════════════════════════════ */

  function exportCSV() {
    var entries = getEntries().sort(function (a, b) {
      return b.date.localeCompare(a.date);
    });
    if (!entries.length) {
      showToast('No entries to export');
      return;
    }

    var rows = ['Date,Gratitude 1,Gratitude 2,Gratitude 3,Gratitude 4,Gratitude 5,Gratitude 6,Gratitude 7,Gratitude 8,Gratitude 9,Gratitude 10,Intention 1,Intention 2,Intention 3,Intention 4,Intention 5,Intention 6,Intention 7,Intention 8,Intention 9,Intention 10,Reflection 1,Reflection 2,Notes'];

    entries.forEach(function (entry) {
      var cols = [entry.date];
      for (var g = 0; g < 10; g++) {
        cols.push(csvEscape((entry.gratitudes && entry.gratitudes[g]) || ''));
      }
      for (var n = 0; n < 10; n++) {
        cols.push(csvEscape((entry.intentions && entry.intentions[n]) || ''));
      }
      cols.push(csvEscape(entry.reflection1 || ''));
      cols.push(csvEscape(entry.reflection2 || ''));
      cols.push(csvEscape(entry.notes || ''));
      rows.push(cols.join(','));
    });

    var csv = rows.join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: 'ten10-journal-export.csv' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('CSV downloaded');
  }

  function csvEscape(str) {
    if (!str) return '""';
    var escaped = str.replace(/"/g, '""').replace(/\n/g, ' ');
    return '"' + escaped + '"';
  }

  /* ═══════════════════════════════════════════════════
     NOTIFICATIONS
     ═══════════════════════════════════════════════════ */

  function scheduleNotification(cfg) {
    if (!cfg || !cfg.reminderTime) return;
    if (!('Notification' in window)) return;
    if (window.__tenTenTimer) clearTimeout(window.__tenTenTimer);
    if (!cfg.notificationsEnabled) return;

    var parts = cfg.reminderTime.split(':');
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    var now = new Date();
    var target = new Date();
    target.setHours(h, m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);

    window.__tenTenTimer = setTimeout(function () {
      if (Notification.permission === 'granted') {
        new Notification('10:10 Journal', {
          body: 'Time for your daily gratitude and intention practice.',
          icon: 'ten10-icon-192.png'
        });
      }
      scheduleNotification(cfg);
    }, target - now);
  }

  function requestNotificationPermission(callback) {
    if (!('Notification' in window)) {
      callback(false);
      return;
    }
    if (Notification.permission === 'granted') {
      callback(true);
      return;
    }
    if (Notification.permission === 'denied') {
      callback(false);
      return;
    }
    Notification.requestPermission().then(function (result) {
      callback(result === 'granted');
    });
  }

  /* ═══════════════════════════════════════════════════
     APP STATE
     ═══════════════════════════════════════════════════ */

  var currentTab = 'today';
  var appRoot = null;

  /* ═══════════════════════════════════════════════════
     ONBOARDING
     ═══════════════════════════════════════════════════ */

  function renderOnboarding() {
    var overlay = el('div', { className: 'onboarding-overlay' });
    var steps = [];
    var currentStep = 0;
    var trialCompleted = false;

    // -- Step 1: Welcome --
    var step1 = el('div', { className: 'onboarding-step active' }, [
      el('div', { className: 'welcome-logo' }, [
        document.createTextNode('10'),
        el('span', { className: 'colon', text: ':' }),
        document.createTextNode('10')
      ]),
      el('div', { className: 'welcome-subtitle', text: 'Ten gratitudes. Ten intentions. Every day.' }),
      el('p', { className: 'welcome-desc', text: 'A daily practice that rewires your brain for positivity and purpose.' })
    ]);
    steps.push(step1);

    // -- Step 2: The Science --
    var sciLine1 = el('div', { className: 'science-line', text: 'Research shows that writing down gratitudes literally rewires neural pathways.' });
    var sciLine2 = el('div', { className: 'science-line', text: 'After just 21 days, your brain starts scanning for positives instead of negatives.' });
    var sciLine3 = el('div', { className: 'science-line', text: 'Adding intentions turns reflection into action.' });

    var step2 = el('div', { className: 'onboarding-step' }, [
      el('h2', {
        className: 'welcome-subtitle',
        text: 'Why This Works',
        style: 'margin-bottom:24px;font-size:1.4rem;'
      }),
      el('div', { className: 'science-brain', text: '🧠' }),
      el('div', { className: 'science-text' }, [sciLine1, sciLine2, sciLine3])
    ]);
    steps.push(step2);

    // -- Step 3: Daily Practice --
    var pCard1 = el('div', { className: 'practice-card' }, [
      el('div', { className: 'practice-card-icon', text: '📝' }),
      el('div', { className: 'practice-card-title', text: 'Write 10 Gratitudes' }),
      el('div', { className: 'practice-card-desc', text: 'Things you\'re thankful for, big and small.' })
    ]);
    var pCard2 = el('div', { className: 'practice-card' }, [
      el('div', { className: 'practice-card-icon', text: '🎯' }),
      el('div', { className: 'practice-card-title', text: 'Set 10 Intentions' }),
      el('div', { className: 'practice-card-desc', text: 'What you\'ll focus on and bring to life today.' })
    ]);
    var pCard3 = el('div', { className: 'practice-card' }, [
      el('div', { className: 'practice-card-icon', text: '💭' }),
      el('div', { className: 'practice-card-title', text: 'Reflect' }),
      el('div', { className: 'practice-card-desc', text: 'Two guided prompts to deepen your practice.' })
    ]);

    var step3 = el('div', { className: 'onboarding-step' }, [
      el('h2', {
        className: 'welcome-subtitle',
        text: 'Your Daily Ritual',
        style: 'margin-bottom:24px;font-size:1.4rem;'
      }),
      el('div', { className: 'practice-cards' }, [pCard1, pCard2, pCard3])
    ]);
    steps.push(step3);

    // -- Step 4: Try It --
    var tryResult = el('div', { className: 'try-result' }, [
      el('div', { className: 'try-checkmark', text: '✓' }),
      el('div', { className: 'try-text-glow' }),
      el('div', { className: 'try-followup', text: 'That\'s the feeling. Imagine doing this 10 times every morning.' })
    ]);

    var tryInput = el('input', {
      className: 'try-input',
      type: 'text',
      placeholder: 'Write one thing you\'re grateful for...'
    });

    tryInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && tryInput.value.trim()) {
        e.preventDefault();
        completeTrial();
      }
    });

    function completeTrial() {
      if (trialCompleted) return;
      trialCompleted = true;
      var glowText = $('.try-text-glow', tryResult);
      if (glowText) glowText.textContent = '"' + tryInput.value.trim() + '"';
      tryResult.classList.add('visible');
      tryInput.style.borderColor = 'var(--success)';
      tryInput.disabled = true;
    }

    var step4 = el('div', { className: 'onboarding-step' }, [
      el('h2', {
        className: 'welcome-subtitle',
        text: 'Let\'s try one right now',
        style: 'margin-bottom:8px;font-size:1.4rem;'
      }),
      el('p', {
        className: 'welcome-desc',
        text: 'Type something you\'re grateful for and press Enter.',
        style: 'margin-bottom:0;'
      }),
      el('div', { className: 'try-input-wrap' }, [tryInput]),
      tryResult
    ]);
    steps.push(step4);

    // -- Step 5: Set Reminder --
    var reminderInput = el('input', {
      className: 'reminder-time-input',
      type: 'time',
      value: '07:00'
    });

    var notifCheckbox = el('input', { type: 'checkbox' });
    var toggleLabel = el('label', { className: 'toggle-switch' }, [
      notifCheckbox,
      el('span', { className: 'toggle-slider' })
    ]);

    notifCheckbox.addEventListener('change', function () {
      if (notifCheckbox.checked) {
        requestNotificationPermission(function (granted) {
          if (!granted) {
            notifCheckbox.checked = false;
            showToast('Notification permission denied');
          }
        });
      }
    });

    var startBtn = el('button', {
      className: 'onboarding-btn primary',
      text: 'Start My Practice →',
      style: 'margin-top:16px;',
      onClick: function () {
        var cfg = {
          startDate: todayISO(),
          reminderTime: reminderInput.value || '07:00',
          programLength: null,
          onboardingComplete: true,
          notificationsEnabled: notifCheckbox.checked
        };
        saveConfig(cfg);
        scheduleNotification(cfg);
        // Fade out overlay
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.5s ease';
        setTimeout(function () {
          overlay.remove();
          renderApp();
        }, 500);
      }
    });

    var step5 = el('div', { className: 'onboarding-step' }, [
      el('h2', {
        className: 'welcome-subtitle',
        text: 'Make It a Habit',
        style: 'margin-bottom:24px;font-size:1.4rem;'
      }),
      el('p', { className: 'welcome-desc', text: 'Set a daily reminder time:', style: 'margin-bottom:12px;' }),
      el('div', { className: 'reminder-time-wrap' }, [reminderInput]),
      el('div', { className: 'notif-toggle-wrap' }, [
        toggleLabel,
        document.createTextNode('Enable notifications')
      ]),
      startBtn
    ]);
    steps.push(step5);

    // Navigation
    var dots = [];
    var dotsWrap = el('div', { className: 'onboarding-dots' });
    for (var i = 0; i < steps.length; i++) {
      var dot = el('div', { className: 'onboarding-dot' + (i === 0 ? ' active' : '') });
      dots.push(dot);
      dotsWrap.appendChild(dot);
    }

    var prevBtn = el('button', {
      className: 'onboarding-btn',
      text: '← Back',
      style: 'visibility:hidden;',
      onClick: function () { goToStep(currentStep - 1); }
    });

    var nextBtn = el('button', {
      className: 'onboarding-btn primary',
      text: 'Begin →',
      onClick: function () {
        if (currentStep === 3 && !trialCompleted && tryInput.value.trim()) {
          completeTrial();
          return;
        }
        goToStep(currentStep + 1);
      }
    });

    function goToStep(idx) {
      if (idx < 0 || idx >= steps.length) return;
      steps[currentStep].classList.remove('active');
      currentStep = idx;
      steps[currentStep].classList.add('active');

      dots.forEach(function (d, i) {
        d.classList.toggle('active', i === currentStep);
      });

      prevBtn.style.visibility = currentStep === 0 ? 'hidden' : 'visible';

      if (currentStep === steps.length - 1) {
        nextBtn.style.display = 'none';
      } else {
        nextBtn.style.display = '';
        nextBtn.textContent = currentStep === 0 ? 'Begin →' : 'Next →';
      }

      // Trigger step-specific animations
      if (currentStep === 1) animateScience();
      if (currentStep === 2) animatePractice();
      if (currentStep === 3) {
        tryInput.disabled = false;
        setTimeout(function () { tryInput.focus(); }, 400);
      }
    }

    function animateScience() {
      var lines = [sciLine1, sciLine2, sciLine3];
      lines.forEach(function (line, i) {
        line.classList.remove('revealed');
        setTimeout(function () {
          line.classList.add('revealed');
        }, 300 + i * 600);
      });
    }

    function animatePractice() {
      var cards = [pCard1, pCard2, pCard3];
      cards.forEach(function (card, i) {
        card.classList.remove('revealed');
        setTimeout(function () {
          card.classList.add('revealed');
        }, 200 + i * 300);
      });
    }

    var nav = el('div', { className: 'onboarding-nav' }, [
      prevBtn, dotsWrap, nextBtn
    ]);

    // Build overlay
    var stepsContainer = el('div', { style: 'flex:1;position:relative;' });
    steps.forEach(function (s) { stepsContainer.appendChild(s); });
    overlay.appendChild(stepsContainer);
    overlay.appendChild(nav);

    document.body.appendChild(overlay);
  }

  /* ═══════════════════════════════════════════════════
     MAIN APP SHELL
     ═══════════════════════════════════════════════════ */

  function renderApp() {
    appRoot = $('#app');
    appRoot.innerHTML = '';

    // Header
    var streakPill = el('div', { className: 'streak-pill', id: 'streak-pill' });
    var header = el('header', { className: 'app-header' }, [
      el('div', { className: 'header-inner' }, [
        el('div', { className: 'header-logo' }, [
          document.createTextNode('10'),
          el('span', { className: 'colon', text: ':' }),
          document.createTextNode('10')
        ]),
        streakPill
      ])
    ]);

    // Bottom nav
    var navToday = el('button', {
      className: 'nav-tab active',
      'data-tab': 'today',
      onClick: function () { navigate('today'); }
    }, [
      el('span', { className: 'nav-tab-icon', text: '✦' }),
      el('span', { text: 'Today' })
    ]);
    var navHistory = el('button', {
      className: 'nav-tab',
      'data-tab': 'history',
      onClick: function () { navigate('history'); }
    }, [
      el('span', { className: 'nav-tab-icon', text: '📖' }),
      el('span', { text: 'History' })
    ]);
    var navSettings = el('button', {
      className: 'nav-tab',
      'data-tab': 'settings',
      onClick: function () { navigate('settings'); }
    }, [
      el('span', { className: 'nav-tab-icon', text: '⚙' }),
      el('span', { text: 'Settings' })
    ]);

    var bottomNav = el('nav', { className: 'bottom-nav' }, [
      el('div', { className: 'bottom-nav-inner' }, [navToday, navHistory, navSettings])
    ]);

    // Content area
    var mainContent = el('div', { className: 'main-content', id: 'main-content' });

    appRoot.appendChild(header);
    appRoot.appendChild(mainContent);
    appRoot.appendChild(bottomNav);

    updateStreakPill();
    navigate('today');
  }

  function navigate(tab) {
    currentTab = tab;
    var mainContent = $('#main-content');
    if (!mainContent) return;
    mainContent.innerHTML = '';
    mainContent.className = 'main-content page-enter';

    // Update nav active state
    $$('.nav-tab').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });

    switch (tab) {
      case 'today': renderToday(mainContent); break;
      case 'history': renderHistory(mainContent); break;
      case 'settings': renderSettings(mainContent); break;
    }

    updateStreakPill();
  }

  function updateStreakPill() {
    var pill = $('#streak-pill');
    if (!pill) return;
    var streakData = calculateStreak();
    if (streakData.current > 0) {
      pill.textContent = '';
      pill.appendChild(document.createTextNode('🔥 ' + streakData.current));
      pill.style.display = 'flex';
    } else {
      pill.style.display = 'none';
    }
  }

  /* ═══════════════════════════════════════════════════
     TODAY VIEW
     ═══════════════════════════════════════════════════ */

  function renderToday(container) {
    var today = todayISO();
    var existing = getEntryForDate(today);
    var cfg = getConfig();

    // Date display
    container.appendChild(el('div', { className: 'date-display', text: friendlyDate(today) }));

    // Day counter if program length set
    if (cfg && cfg.programLength && cfg.startDate) {
      var dayNum = daysBetween(cfg.startDate, today) + 1;
      if (dayNum > 0 && dayNum <= cfg.programLength) {
        container.appendChild(el('div', { className: 'day-counter', text: 'Day ' + dayNum + ' of ' + cfg.programLength }));
        var progressBar = el('div', { className: 'day-progress-bar' }, [
          el('div', {
            className: 'day-progress-fill',
            style: 'width:' + Math.min(100, (dayNum / cfg.programLength) * 100) + '%'
          })
        ]);
        container.appendChild(progressBar);
      }
    }

    // --- Gratitude Section ---
    var gCount = 0;
    var gCountBadge = el('span', { className: 'section-count incomplete', text: '0/10' });

    var gHeader = el('div', { className: 'section-header' }, [
      el('span', { className: 'section-title', text: 'Gratitudes' }),
      gCountBadge
    ]);
    container.appendChild(gHeader);

    var gratInputs = [];
    for (var g = 0; g < 10; g++) {
      var gVal = (existing && existing.gratitudes && existing.gratitudes[g]) || '';
      if (gVal) gCount++;

      var gInput = el('input', {
        className: 'entry-input' + (gVal ? ' filled' : ''),
        type: 'text',
        placeholder: 'I\'m grateful for...',
        value: gVal,
        'data-idx': String(g)
      });
      gratInputs.push(gInput);

      (function (input, idx) {
        input.addEventListener('input', function () {
          input.classList.toggle('filled', input.value.trim().length > 0);
          updateCounts();
        });
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            // Auto-advance to next field
            if (idx < 9 && gratInputs[idx + 1]) {
              gratInputs[idx + 1].focus();
            } else if (idx === 9 && intInputs.length) {
              intInputs[0].focus();
            }
          }
        });
      })(gInput, g);

      var gRow = el('div', {
        className: 'entry-input-row stagger-item',
        style: 'animation-delay:' + (g * 30) + 'ms'
      }, [
        el('span', { className: 'entry-input-num', text: String(g + 1) }),
        gInput
      ]);
      container.appendChild(gRow);
    }

    // --- Intention Section ---
    var iCount = 0;
    var iCountBadge = el('span', { className: 'section-count incomplete', text: '0/10' });

    var iHeader = el('div', { className: 'section-header' }, [
      el('span', { className: 'section-title', text: 'Intentions' }),
      iCountBadge
    ]);
    container.appendChild(iHeader);

    var intInputs = [];
    for (var n = 0; n < 10; n++) {
      var iVal = (existing && existing.intentions && existing.intentions[n]) || '';
      if (iVal) iCount++;

      var iInput = el('input', {
        className: 'entry-input' + (iVal ? ' filled' : ''),
        type: 'text',
        placeholder: 'Today I will...',
        value: iVal,
        'data-idx': String(n)
      });
      intInputs.push(iInput);

      (function (input, idx) {
        input.addEventListener('input', function () {
          input.classList.toggle('filled', input.value.trim().length > 0);
          updateCounts();
        });
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (idx < 9 && intInputs[idx + 1]) {
              intInputs[idx + 1].focus();
            }
          }
        });
      })(iInput, n);

      var iRow = el('div', {
        className: 'entry-input-row stagger-item',
        style: 'animation-delay:' + ((n + 10) * 30) + 'ms'
      }, [
        el('span', { className: 'entry-input-num', text: String(n + 1) }),
        iInput
      ]);
      container.appendChild(iRow);
    }

    // --- Reflection Section ---
    var reflHeader = el('div', { className: 'section-header', style: 'margin-top:28px;' }, [
      el('span', { className: 'section-title', text: 'Reflections' })
    ]);
    container.appendChild(reflHeader);

    var r1Textarea = el('textarea', {
      className: 'reflection-textarea',
      placeholder: 'Your thoughts...',
      rows: '3'
    });
    r1Textarea.value = (existing && existing.reflection1) || '';

    var reflCard1 = el('div', { className: 'reflection-card' }, [
      el('div', { className: 'reflection-prompt', text: 'What patterns do you notice in your gratitudes today?' }),
      r1Textarea
    ]);
    container.appendChild(reflCard1);

    var r2Textarea = el('textarea', {
      className: 'reflection-textarea',
      placeholder: 'Your thoughts...',
      rows: '3'
    });
    r2Textarea.value = (existing && existing.reflection2) || '';

    var reflCard2 = el('div', { className: 'reflection-card' }, [
      el('div', { className: 'reflection-prompt', text: 'Which intention feels most important to act on?' }),
      r2Textarea
    ]);
    container.appendChild(reflCard2);

    // Notes
    container.appendChild(el('div', { className: 'notes-label', text: 'Notes' }));
    var notesTextarea = el('textarea', {
      className: 'reflection-textarea',
      placeholder: 'Any other thoughts...',
      rows: '2'
    });
    notesTextarea.value = (existing && existing.notes) || '';
    container.appendChild(notesTextarea);

    // Save button
    var saveBtn = el('button', {
      className: 'save-btn',
      text: existing ? 'Update Entry' : 'Save Entry ✓',
      onClick: function () {
        var gratitudes = gratInputs.map(function (inp) { return inp.value.trim(); });
        var intentions = intInputs.map(function (inp) { return inp.value.trim(); });

        var filledGratitudes = gratitudes.filter(Boolean);
        if (filledGratitudes.length < 1) {
          showToast('Please add at least 1 gratitude');
          gratInputs[0].focus();
          return;
        }

        var entry = {
          date: today,
          gratitudes: gratitudes,
          intentions: intentions,
          reflection1: r1Textarea.value.trim(),
          reflection2: r2Textarea.value.trim(),
          notes: notesTextarea.value.trim(),
          timestamp: new Date().toISOString()
        };

        var all = getEntries();
        var existingIdx = -1;
        for (var k = 0; k < all.length; k++) {
          if (all[k].date === today) { existingIdx = k; break; }
        }
        if (existingIdx >= 0) {
          all[existingIdx] = entry;
        } else {
          all.push(entry);
        }
        saveEntries(all);

        spawnSparkles();
        showToast(existing ? 'Entry updated ✓' : 'Entry saved ✓');
        updateStreakPill();

        // Update button text
        saveBtn.textContent = 'Update Entry';
      }
    });
    container.appendChild(saveBtn);

    // Initial count update
    updateGCount();
    updateICount();

    function updateGCount() {
      var c = gratInputs.filter(function (inp) { return inp.value.trim().length > 0; }).length;
      gCountBadge.textContent = c + '/10';
      gCountBadge.className = c >= 10 ? 'section-count complete' : 'section-count incomplete';
      return c;
    }

    function updateICount() {
      var c = intInputs.filter(function (inp) { return inp.value.trim().length > 0; }).length;
      iCountBadge.textContent = c + '/10';
      iCountBadge.className = c >= 10 ? 'section-count complete' : 'section-count incomplete';
      return c;
    }

    function updateCounts() {
      var gc = updateGCount();
      updateICount();
      saveBtn.disabled = gc < 1;
    }

    saveBtn.disabled = gCount < 1;
  }

  /* ═══════════════════════════════════════════════════
     HISTORY VIEW
     ═══════════════════════════════════════════════════ */

  function renderHistory(container) {
    container.appendChild(el('div', { className: 'history-title', text: 'History' }));

    var entries = getEntries().sort(function (a, b) {
      return b.date.localeCompare(a.date);
    });

    if (!entries.length) {
      container.appendChild(el('div', { className: 'history-empty' }, [
        el('div', { className: 'history-empty-icon', text: '📖' }),
        el('p', { text: 'Your journal awaits. Start with today\'s entry.' })
      ]));
      return;
    }

    entries.forEach(function (entry, idx) {
      var gLen = (entry.gratitudes || []).filter(Boolean).length;
      var iLen = (entry.intentions || []).filter(Boolean).length;
      var isComplete = gLen >= 10 && iLen >= 10;

      var card = el('div', {
        className: 'history-card stagger-item',
        style: 'animation-delay:' + (idx * 50) + 'ms'
      });

      // Badge
      var badge;
      if (isComplete) {
        badge = el('span', { className: 'history-badge-complete', text: '✓ Complete' });
      } else {
        badge = el('span', { className: 'history-badge-partial', text: 'Partial' });
      }

      var statsText = gLen + ' gratitudes · ' + iLen + ' intentions';

      var header = el('div', { className: 'history-card-header' }, [
        el('span', { className: 'history-card-date', text: longDate(entry.date) }),
        el('div', { className: 'history-card-meta' }, [
          el('span', { className: 'history-card-stats', text: statsText }),
          badge
        ])
      ]);

      // Detail section
      var detail = el('div', { className: 'history-card-detail' });

      // Show first 3 gratitudes
      var filledGratitudes = (entry.gratitudes || []).filter(Boolean);
      if (filledGratitudes.length) {
        detail.appendChild(el('h4', { text: 'Gratitudes' }));
        var gOl = el('ol');
        var gShow = filledGratitudes.slice(0, 3);
        gShow.forEach(function (g) {
          gOl.appendChild(el('li', { text: g }));
        });
        if (filledGratitudes.length > 3) {
          gOl.appendChild(el('li', {
            text: '... and ' + (filledGratitudes.length - 3) + ' more',
            style: 'color:var(--text-muted);font-style:italic;'
          }));
        }
        detail.appendChild(gOl);
      }

      // Show first 3 intentions
      var filledIntentions = (entry.intentions || []).filter(Boolean);
      if (filledIntentions.length) {
        detail.appendChild(el('h4', { text: 'Intentions' }));
        var iOl = el('ol');
        var iShow = filledIntentions.slice(0, 3);
        iShow.forEach(function (item) {
          iOl.appendChild(el('li', { text: item }));
        });
        if (filledIntentions.length > 3) {
          iOl.appendChild(el('li', {
            text: '... and ' + (filledIntentions.length - 3) + ' more',
            style: 'color:var(--text-muted);font-style:italic;'
          }));
        }
        detail.appendChild(iOl);
      }

      // Reflections
      if (entry.reflection1) {
        detail.appendChild(el('h4', { text: 'Reflection 1' }));
        detail.appendChild(el('div', { className: 'history-reflection-text', text: entry.reflection1 }));
      }
      if (entry.reflection2) {
        detail.appendChild(el('h4', { text: 'Reflection 2' }));
        detail.appendChild(el('div', { className: 'history-reflection-text', text: entry.reflection2 }));
      }
      if (entry.notes) {
        detail.appendChild(el('h4', { text: 'Notes' }));
        detail.appendChild(el('div', { className: 'history-reflection-text', text: entry.notes }));
      }

      header.addEventListener('click', function () {
        detail.classList.toggle('open');
      });

      card.appendChild(header);
      card.appendChild(detail);
      container.appendChild(card);
    });
  }

  /* ═══════════════════════════════════════════════════
     SETTINGS VIEW
     ═══════════════════════════════════════════════════ */

  function renderSettings(container) {
    container.appendChild(el('div', { className: 'settings-title', text: 'Settings' }));

    var cfg = getConfig() || {};
    var entries = getEntries();
    var streakData = calculateStreak();

    // Stats
    var statsGrid = el('div', { className: 'settings-stats' }, [
      el('div', { className: 'stat-item' }, [
        el('div', { className: 'stat-value', text: cfg.startDate ? longDate(cfg.startDate).split(',')[0] : '--' }),
        el('div', { className: 'stat-label', text: 'Started' })
      ]),
      el('div', { className: 'stat-item' }, [
        el('div', { className: 'stat-value', text: String(entries.length) }),
        el('div', { className: 'stat-label', text: 'Total Entries' })
      ]),
      el('div', { className: 'stat-item' }, [
        el('div', { className: 'stat-value', text: String(streakData.current) }),
        el('div', { className: 'stat-label', text: 'Current Streak' })
      ]),
      el('div', { className: 'stat-item' }, [
        el('div', { className: 'stat-value', text: String(streakData.longest) }),
        el('div', { className: 'stat-label', text: 'Longest Streak' })
      ])
    ]);
    container.appendChild(statsGrid);

    // Reminder time
    var reminderSection = el('div', { className: 'settings-section' });
    reminderSection.appendChild(el('div', { className: 'settings-section-title', text: 'Reminder' }));

    var timeInput = el('input', {
      className: 'settings-time-input',
      type: 'time',
      value: cfg.reminderTime || '07:00'
    });
    timeInput.addEventListener('change', function () {
      cfg.reminderTime = timeInput.value;
      saveConfig(cfg);
      scheduleNotification(cfg);
      showToast('Reminder updated');
    });

    reminderSection.appendChild(el('div', { className: 'settings-row' }, [
      el('span', { className: 'settings-row-label', text: 'Reminder Time' }),
      timeInput
    ]));
    container.appendChild(reminderSection);

    // Actions
    var actionsSection = el('div', { className: 'settings-section' });
    actionsSection.appendChild(el('div', { className: 'settings-section-title', text: 'Actions' }));

    var exportBtn = el('button', {
      className: 'settings-btn export',
      text: 'Export Data as CSV',
      onClick: function () { exportCSV(); }
    });
    actionsSection.appendChild(exportBtn);

    var resetBtn = el('button', {
      className: 'settings-btn danger',
      text: 'Reset Journal',
      onClick: function () {
        showConfirm(
          'Reset Journal',
          'This will permanently delete all entries and settings. This action cannot be undone.',
          'Delete Everything',
          function () {
            localStorage.removeItem(STORE_CONFIG);
            localStorage.removeItem(STORE_ENTRIES);
            showToast('All data cleared');
            // Show onboarding again
            appRoot.innerHTML = '';
            renderOnboarding();
          }
        );
      }
    });
    actionsSection.appendChild(resetBtn);

    var rerunBtn = el('button', {
      className: 'settings-btn ghost',
      text: 'Re-run Onboarding',
      onClick: function () {
        renderOnboarding();
      }
    });
    actionsSection.appendChild(rerunBtn);

    container.appendChild(actionsSection);

    // Version
    container.appendChild(el('div', { className: 'settings-version', text: VERSION }));
  }

  /* ═══════════════════════════════════════════════════
     SERVICE WORKER REGISTRATION
     ═══════════════════════════════════════════════════ */

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(function () {});
  }

  /* ═══════════════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════════════ */

  document.addEventListener('DOMContentLoaded', function () {
    appRoot = $('#app');
    var cfg = getConfig();

    if (cfg && cfg.onboardingComplete) {
      renderApp();
      scheduleNotification(cfg);
    } else {
      renderOnboarding();
    }
  });

})();

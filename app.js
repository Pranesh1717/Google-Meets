/* =========================================================
   SETTINGS: edit these to personalise the app.
   ========================================================= */
var USER_NAME = "";            // e.g. "Amma". Leave empty for no name in the greeting.
var DEFAULT_LEAD_MINUTES = 5;  // default alarm time before a meeting

(function () {
  var KEY = 'meetlinks.v1';
  var DAYN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var S = { meetings: [], alarmsOn: false };
  var fired = {}, snooze = {}, filter = 'All', editing = null;
  var formDays = [0, 1, 2, 3, 4, 5, 6];
  var actx = null, ringTimer = null, wake = null;

  /* ---------- helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function extractUrl(t) {
    var m = String(t).match(/https?:\/\/[^\s<>"]+/i);
    return m ? m[0].replace(/[.,;)]+$/, '') : '';
  }
  function platform(u) {
    var h = u.toLowerCase();
    if (h.indexOf('zoom.') > -1) return 'Zoom';
    if (h.indexOf('meet.google') > -1) return 'Google Meet';
    if (h.indexOf('teams.') > -1) return 'Microsoft Teams';
    if (h.indexOf('webex') > -1) return 'Webex';
    if (h.indexOf('whatsapp') > -1) return 'WhatsApp';
    if (h.indexOf('youtube') > -1 || h.indexOf('youtu.be') > -1) return 'YouTube';
    return 'Online meeting';
  }
  function hm(t) {
    var p = t.split(':'), h = +p[0], m = +p[1], ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
  }
  function dayKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function at(m, d) { var p = m.time.split(':'), x = new Date(d); x.setHours(+p[0], +p[1], 0, 0); return x; }
  function occursOn(m, d) { return (m.days || []).indexOf(d.getDay()) > -1; }
  function nextOcc(m, now) {
    for (var i = 0; i < 8; i++) {
      var d = new Date(now); d.setDate(d.getDate() + i);
      if (occursOn(m, d)) {
        var s = at(m, d);
        if (s.getTime() >= now.getTime() - 10 * 60000) return s;
      }
    }
    return null;
  }
  function dur(ms) {
    var m = Math.max(0, Math.round(ms / 60000));
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60); m = m % 60;
    if (h >= 24) return Math.floor(h / 24) + ' day' + (h >= 48 ? 's' : '');
    return h + ' hr' + (m ? ' ' + m + ' min' : '');
  }
  function daysLabel(a) {
    if (a.length === 7) return 'Every day';
    if (!a.length) return 'No days';
    if (a.length === 5 && [1, 2, 3, 4, 5].every(function (x) { return a.indexOf(x) > -1; })) return 'Weekdays';
    return a.slice().sort().map(function (x) { return DAYN[x]; }).join(', ');
  }
  function greeting(now) {
    var h = now.getHours();
    var g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    return USER_NAME ? g + ', ' + USER_NAME : g;
  }

  /* ---------- storage ---------- */
  function load() {
    try {
      var r = localStorage.getItem(KEY);
      if (r) { var d = JSON.parse(r); if (d && Array.isArray(d.meetings)) S = d; }
    } catch (e) {}
    try { fired = JSON.parse(localStorage.getItem(KEY + '.fired') || '{}'); } catch (e) { fired = {}; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function saveFired() { try { localStorage.setItem(KEY + '.fired', JSON.stringify(fired)); } catch (e) {} }

  /* ---------- rendering ---------- */
  function render() {
    var now = new Date();
    $('greeting').textContent = greeting(now);
    $('today').textContent = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

    $('alarmBar').innerHTML = S.alarmsOn
      ? '<p><span class="on">Alarms are on.</span> Keep this page open so it can ring.</p><div class="acts"><button class="small" id="testAlarm">Test alarm</button><button class="small" id="alarmOff">Turn off</button></div>'
      : '<p><strong>Alarms are off.</strong> Turn them on to get a reminder before each meeting.</p><button class="primary" id="alarmOn">Turn on alarms</button>';

    var best = null, bt = null;
    S.meetings.forEach(function (m) {
      var s = nextOcc(m, now);
      if (s && (!bt || s < bt)) { bt = s; best = m; }
    });
    if (best) {
      var diff = bt - now, tm = new Date(now); tm.setDate(tm.getDate() + 1);
      var dl = dayKey(bt) === dayKey(now) ? 'Today' : dayKey(bt) === dayKey(tm) ? 'Tomorrow' : DAYN[bt.getDay()];
      var cnt = diff <= 0 ? 'Started ' + dur(-diff) + ' ago' : 'Starts in ' + dur(diff);
      $('hero').innerHTML = '<div class="hero"><p class="lbl">Next meeting</p><h2>' + esc(best.title) + '</h2><p class="when">' + dl + ' at ' + hm(best.time) + ' · <span class="count">' + cnt + '</span></p><a class="join" href="' + esc(best.url) + '" target="_blank" rel="noopener">Join meeting</a></div>';
    } else {
      $('hero').innerHTML = '<div class="hero empty"><h2>No meetings yet</h2><p>Paste a meeting link from WhatsApp below and set its time. It will show up here.</p></div>';
    }

    var list = S.meetings.filter(function (m) { return occursOn(m, now); })
      .sort(function (a, b) { return a.time < b.time ? -1 : 1; });
    $('todayList').innerHTML = list.length ? list.map(function (m) {
      var past = at(m, now).getTime() < now.getTime() - 10 * 60000;
      return '<div class="row' + (past ? ' past' : '') + '"><span class="t">' + hm(m.time) + '</span><span class="n">' + esc(m.title) + '<small>' + esc(m.group || platform(m.url)) + '</small></span><a class="join" href="' + esc(m.url) + '" target="_blank" rel="noopener">Join</a></div>';
    }).join('') : '<p class="muted">Nothing scheduled for today.</p>';

    var groups = [];
    S.meetings.forEach(function (m) { var g = m.group || 'Ungrouped'; if (groups.indexOf(g) < 0) groups.push(g); });
    groups.sort();
    if (filter !== 'All' && groups.indexOf(filter) < 0) filter = 'All';
    $('filters').innerHTML = groups.length > 1
      ? ['All'].concat(groups).map(function (g) { return '<button class="chip" data-g="' + esc(g) + '" aria-pressed="' + (g === filter) + '">' + esc(g) + '</button>'; }).join('')
      : '';
    $('groups').innerHTML = groups.filter(function (g) { return g !== 'Ungrouped'; })
      .map(function (g) { return '<option value="' + esc(g) + '">'; }).join('');

    var shown = S.meetings.filter(function (m) { return filter === 'All' || (m.group || 'Ungrouped') === filter; })
      .sort(function (a, b) { return a.time < b.time ? -1 : 1; });
    $('all').innerHTML = shown.length ? shown.map(function (m) {
      return '<div class="card" data-id="' + m.id + '"><div class="top"><div><h3>' + esc(m.title) + '</h3><p class="meta">' + hm(m.time) + ' · ' + daysLabel(m.days) + ' · ' + (+m.lead ? 'Alarm ' + m.lead + ' min before' : 'No alarm') + '<br>' + esc(platform(m.url)) + (m.group ? ' · ' + esc(m.group) : '') + (m.notes ? '<br>' + esc(m.notes) : '') + '</p></div><a class="join" href="' + esc(m.url) + '" target="_blank" rel="noopener">Join</a></div><div class="acts"><button class="small" data-act="edit">Edit</button><button class="small" data-act="copy">Copy link</button><button class="small danger" data-act="del">Delete</button></div></div>';
    }).join('') : '<p class="muted">No meetings saved yet.</p>';
  }

  /* ---------- form ---------- */
  function drawDays() {
    $('f-days').innerHTML = DAYN.map(function (n, i) {
      return '<button type="button" data-d="' + i + '" aria-pressed="' + (formDays.indexOf(i) > -1) + '">' + n + '</button>';
    }).join('');
  }
  function resetForm() {
    editing = null; $('form').reset();
    $('f-lead').value = String(DEFAULT_LEAD_MINUTES);
    formDays = [0, 1, 2, 3, 4, 5, 6]; drawDays();
    $('formTitle').textContent = 'Add a meeting';
    $('saveBtn').textContent = 'Save meeting';
    $('cancelEdit').hidden = true;
  }
  $('f-days').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var d = +b.dataset.d, i = formDays.indexOf(d);
    if (i > -1) formDays.splice(i, 1); else formDays.push(d);
    drawDays();
  });
  $('f-link').addEventListener('input', function () {
    this.setCustomValidity(extractUrl(this.value) ? '' : 'Please include a link that starts with http');
  });
  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    var url = extractUrl($('f-link').value);
    if (!url) { $('f-link').setCustomValidity('Please include a link that starts with http'); $('f-link').reportValidity(); return; }
    if (!formDays.length) { alert('Please pick at least one day.'); return; }
    var m = {
      id: editing || uid(), title: $('f-title').value.trim(), url: url, time: $('f-time').value,
      days: formDays.slice().sort(), lead: +$('f-lead').value,
      group: $('f-group').value.trim(), notes: $('f-notes').value.trim()
    };
    if (editing) S.meetings = S.meetings.map(function (x) { return x.id === editing ? m : x; });
    else S.meetings.push(m);
    save(); resetForm(); render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('cancelEdit').addEventListener('click', resetForm);
  $('addTop').addEventListener('click', function () {
    $('f-link').scrollIntoView({ behavior: 'smooth', block: 'center' }); $('f-link').focus();
  });

  $('all').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-act]'); if (!b) return;
    var id = b.closest('.card').dataset.id;
    var m = S.meetings.filter(function (x) { return x.id === id; })[0]; if (!m) return;
    if (b.dataset.act === 'del') {
      if (confirm('Delete "' + m.title + '"?')) { S.meetings = S.meetings.filter(function (x) { return x.id !== id; }); save(); render(); }
    } else if (b.dataset.act === 'copy') {
      try { navigator.clipboard.writeText(m.url).then(function () { b.textContent = 'Copied'; }, function () { b.textContent = 'Copy failed'; }); }
      catch (er) { b.textContent = 'Copy failed'; }
    } else {
      editing = id;
      $('f-link').value = m.url; $('f-title').value = m.title; $('f-time').value = m.time;
      $('f-lead').value = String(m.lead); $('f-group').value = m.group || ''; $('f-notes').value = m.notes || '';
      formDays = m.days.slice(); drawDays();
      $('formTitle').textContent = 'Edit meeting'; $('saveBtn').textContent = 'Save changes';
      $('cancelEdit').hidden = false;
      $('f-title').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
  $('filters').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return; filter = b.dataset.g; render();
  });

  /* ---------- backup ---------- */
  $('bkExport').addEventListener('click', function () {
    $('bk').value = JSON.stringify({ meetings: S.meetings }); $('bk').select();
    $('bkMsg').textContent = 'Copy all of this text and keep it safe.';
  });
  $('bkImport').addEventListener('click', function () {
    try {
      var d = JSON.parse($('bk').value);
      if (!d || !Array.isArray(d.meetings)) throw 0;
      d.meetings.forEach(function (m) { if (!m.url || !m.time || !m.title) throw 0; });
      if (confirm('Replace the current list with ' + d.meetings.length + ' meetings from this backup?')) {
        S.meetings = d.meetings; save(); render(); $('bkMsg').textContent = 'Restored.';
      }
    } catch (e) { $('bkMsg').textContent = 'That text is not a valid backup.'; }
  });

  /* ---------- alarms ---------- */
  function unlockAudio() {
    try {
      if (!actx) { var C = window.AudioContext || window.webkitAudioContext; if (C) actx = new C(); }
      if (actx && actx.state === 'suspended') actx.resume();
    } catch (e) {}
  }
  function beep() {
    if (actx) {
      try {
        [0, 0.25, 0.5].forEach(function (t) {
          var o = actx.createOscillator(), g = actx.createGain();
          o.type = 'sine'; o.frequency.value = 880; o.connect(g); g.connect(actx.destination);
          var s = actx.currentTime + t;
          g.gain.setValueAtTime(0.0001, s);
          g.gain.exponentialRampToValueAtTime(0.5, s + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, s + 0.2);
          o.start(s); o.stop(s + 0.22);
        });
      } catch (e) {}
    }
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) {}
  }
  function keepAwake() {
    try {
      if (navigator.wakeLock && !wake) {
        navigator.wakeLock.request('screen').then(function (l) {
          wake = l; l.addEventListener('release', function () { wake = null; });
        }, function () {});
      }
    } catch (e) {}
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && S.alarmsOn) keepAwake(); });
  document.addEventListener('pointerdown', function () { if (S.alarmsOn) unlockAudio(); });

  document.addEventListener('click', function (e) {
    var id = e.target.id;
    if (id === 'alarmOn') {
      S.alarmsOn = true; save(); unlockAudio(); keepAwake();
      try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().then(render); } catch (er) {}
      render(); beep();
    }
    if (id === 'alarmOff') { S.alarmsOn = false; save(); stopRing(); render(); }
    if (id === 'testAlarm') {
      unlockAudio();
      ring({ id: 'test', title: 'Test alarm', url: '#', time: '00:00' }, 'This is how the alarm will look and sound.', true);
    }
  });

  function ring(m, when, isTest) {
    stopRing();
    $('ringT').textContent = m.title; $('ringWhen').textContent = when;
    var j = $('ringJoin'); j.href = m.url; j.style.display = isTest ? 'none' : '';
    $('ring').classList.add('show'); $('ringStop').focus();
    beep();
    var n = 0;
    ringTimer = setInterval(function () { n++; if (n > 40) stopRing(); else beep(); }, 3000);
    try {
      if ('Notification' in window && Notification.permission === 'granted' && !isTest)
        new Notification(m.title, { body: when, requireInteraction: true });
    } catch (e) {}
    window.__ringMeeting = isTest ? null : m;
  }
  function stopRing() {
    if (ringTimer) { clearInterval(ringTimer); ringTimer = null; }
    $('ring').classList.remove('show'); window.__ringMeeting = null;
  }
  $('ringStop').addEventListener('click', stopRing);
  $('ringJoin').addEventListener('click', function () { setTimeout(stopRing, 200); });
  $('ringSnooze').addEventListener('click', function () {
    var m = window.__ringMeeting;
    if (m) snooze[m.id + '|' + dayKey(new Date())] = Date.now() + 60000;
    stopRing();
  });

  function check() {
    if (!S.alarmsOn) return;
    var now = new Date(), t = now.getTime();
    S.meetings.forEach(function (m) {
      if (!+m.lead || !occursOn(m, now)) return;
      var s = at(m, now).getTime(), k = m.id + '|' + dayKey(now), diff = s - t;
      if (snooze[k] && t >= snooze[k]) {
        delete snooze[k];
        ring(m, diff > 0 ? 'Starts in ' + dur(diff) : 'Starting now', false);
        return;
      }
      if (!fired[k] && diff <= m.lead * 60000 && diff > -120000) {
        fired[k] = 1; saveFired();
        ring(m, diff > 0 ? 'Starts in ' + dur(diff) + ' at ' + hm(m.time) : 'Starting now', false);
      }
    });
    var today = dayKey(now);
    Object.keys(fired).forEach(function (k) { if (k.split('|')[1] !== today) delete fired[k]; });
  }

  /* ---------- start ---------- */
  load(); resetForm(); render(); check();
  setInterval(check, 5000);
  setInterval(function () { if (!$('ring').classList.contains('show')) render(); }, 20000);
  if (S.alarmsOn) keepAwake();
})();

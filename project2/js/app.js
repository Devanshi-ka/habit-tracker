/* =====================================================
   HabitFlow — app.js
   ===================================================== */

// ─────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────
const AUTH = { currentUser: null, users: [] };

function loadAuth() {
  // load users into memory ONCE — never re-read inside signin/signup
  try {
    AUTH.users = JSON.parse(localStorage.getItem('hf_users') || '[]');
  } catch(e) { AUTH.users = []; }
  const session = localStorage.getItem('hf_session');
  if (session) AUTH.currentUser = AUTH.users.find(u => u.id === session) || null;
}

function persistUsers() {
  localStorage.setItem('hf_users', JSON.stringify(AUTH.users));
}

function userPrefix() {
  return AUTH.currentUser ? `hf_u_${AUTH.currentUser.id}_` : 'hf_';
}

function authSignup(name, email, password) {
  const key = email.toLowerCase().trim();
  if (AUTH.users.find(u => u.email.toLowerCase() === key)) {
    return { ok: false, msg: 'An account with this email already exists.' };
  }
  if (password.length < 6) {
    return { ok: false, msg: 'Password must be at least 6 characters.' };
  }
  const user = { id: uid(), name, email: key, password, createdAt: Date.now() };
  AUTH.users.push(user);
  persistUsers();
  localStorage.setItem('hf_session', user.id);
  AUTH.currentUser = user;
  return { ok: true };
}

function authSignin(email, password) {
  const key  = email.toLowerCase().trim();
  const user = AUTH.users.find(u => u.email.toLowerCase() === key);
  if (!user)                    return { ok: false, msg: 'No account found with this email.' };
  if (user.password !== password) return { ok: false, msg: 'Incorrect password.' };
  localStorage.setItem('hf_session', user.id);
  AUTH.currentUser = user;
  return { ok: true };
}

function authLogout() {
  localStorage.removeItem('hf_session');
  AUTH.currentUser = null;
  STATE.habits = []; STATE.log = {};
  showAuthScreen();
}

function showAuthScreen() {
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('appWrap').classList.add('app-hidden');
}

function showApp() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appWrap').classList.remove('app-hidden');
  // render user chip
  const u = AUTH.currentUser;
  const initials = u.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  const colors = ['#FF6BB5','#5DA9FF','#55E6C1','#B388FF','#FFD93D','#FF7B72'];
  const col = colors[u.id.charCodeAt(0) % colors.length];
  document.getElementById('userChip').innerHTML =
    `<span class="user-avatar" style="background:${col}">${initials}</span> ${u.name.split(' ')[0]}`;
}

// ─────────────────────────────────────────────────────
// AUTH EVENT WIRING
// ─────────────────────────────────────────────────────
function wireAuth() {
  // tab switching
  document.querySelectorAll('.auth-tab, .auth-switch-link').forEach(el => {
    el.addEventListener('click', () => {
      const tab = el.dataset.tab;
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
      document.getElementById('signinForm').classList.toggle('hidden', tab !== 'signin');
      document.getElementById('signupForm').classList.toggle('hidden', tab !== 'signup');
    });
  });

  // password toggle
  document.querySelectorAll('.auth-eye').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = document.getElementById(btn.dataset.target);
      inp.type = inp.type === 'password' ? 'text' : 'password';
      btn.textContent = inp.type === 'password' ? '👁' : '🙈';
    });
  });

  // sign in
  document.getElementById('signinForm').addEventListener('submit', e => {
    e.preventDefault();
    const email    = document.getElementById('siEmail').value.trim();
    const password = document.getElementById('siPassword').value;
    const res = authSignin(email, password);
    const errEl = document.getElementById('siError');
    if (!res.ok) { errEl.textContent = res.msg; errEl.classList.remove('hidden'); return; }
    errEl.classList.add('hidden');
    loadState();
    showApp();
    renderAll();
  });

  // sign up
  document.getElementById('signupForm').addEventListener('submit', e => {
    e.preventDefault();
    const name     = document.getElementById('suName').value.trim();
    const email    = document.getElementById('suEmail').value.trim();
    const password = document.getElementById('suPassword').value;
    const res = authSignup(name, email, password);
    const errEl = document.getElementById('suError');
    if (!res.ok) { errEl.textContent = res.msg; errEl.classList.remove('hidden'); return; }
    errEl.classList.add('hidden');
    STATE.habits = []; STATE.log = {};
    showApp();
    renderAll();
  });

  // logout
  document.getElementById('logoutBtn').addEventListener('click', () => {
    if (confirm('Log out of HabitFlow?')) authLogout();
  });
}

// ─────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────
const STATE = {
  habits:    [],   // [{id, name, category, difficulty, color, target, createdAt}]
  log:       {},   // {"YYYY-MM-DD": {habitId: true/false}}
  view: {
    year:  new Date().getFullYear(),
    month: new Date().getMonth()   // 0-based
  }
};

const CATEGORIES = ['Health','Study','Spiritual','Business','Fitness','Personal'];

const CAT_COLORS = {
  Health:   '#FF7B72',
  Study:    '#5DA9FF',
  Spiritual:'#B388FF',
  Business: '#FFD93D',
  Fitness:  '#FF6BB5',
  Personal: '#55E6C1'
};

const ACHIEVEMENTS_DEF = [
  { id:'streak7',   icon:'🔥', name:'7-Day Streak',   desc:'Complete habits 7 days in a row',        check: s => s.current >= 7  },
  { id:'streak30',  icon:'🔥', name:'30-Day Streak',  desc:'Complete habits 30 days in a row',       check: s => s.current >= 30 },
  { id:'perfect',   icon:'💯', name:'Perfect Week',   desc:'100% completion for a full week',        check: s => s.perfectWeek   },
  { id:'master',    icon:'🏆', name:'Habit Master',   desc:'Maintain 10+ habits for 30 days',        check: s => s.habitMaster   },
  { id:'first',     icon:'🌱', name:'First Habit',    desc:'Add your very first habit',              check: s => s.habits >= 1   },
  { id:'five',      icon:'⭐', name:'Five Habits',    desc:'Track 5 habits simultaneously',          check: s => s.habits >= 5   },
  { id:'best28',    icon:'🥇', name:'28-Day Best',    desc:'Reach a 28-day streak',                  check: s => s.best >= 28    },
  { id:'monthly',   icon:'📅', name:'Month Complete', desc:'Finish a full calendar month',           check: s => s.monthComplete }
];

// ─────────────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────────────
function saveState() {
  const p = userPrefix();
  localStorage.setItem(p + 'habits', JSON.stringify(STATE.habits));
  localStorage.setItem(p + 'log',    JSON.stringify(STATE.log));
}

function loadState() {
  const p = userPrefix();
  try {
    const h = localStorage.getItem(p + 'habits');
    const l = localStorage.getItem(p + 'log');
    STATE.habits = h ? JSON.parse(h) : [];
    STATE.log    = l ? JSON.parse(l) : {};
  } catch (e) { STATE.habits = []; STATE.log = {}; }
}

// ─────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function dateKey(y, m, d) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function todayKey() {
  const t = new Date();
  return dateKey(t.getFullYear(), t.getMonth(), t.getDate());
}

function daysInMonth(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

function monthName(m) {
  return ['January','February','March','April','May','June',
          'July','August','September','October','November','December'][m];
}

function isChecked(habitId, dk) {
  return !!(STATE.log[dk] && STATE.log[dk][habitId]);
}

function toggleCheck(habitId, dk) {
  if (!STATE.log[dk]) STATE.log[dk] = {};
  STATE.log[dk][habitId] = !STATE.log[dk][habitId];
  saveState();
}

function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (type ? ' ' + type : '');
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = 'toast hidden'; }, 2800);
}

// ─────────────────────────────────────────────────────
// STREAK CALCULATION
// ─────────────────────────────────────────────────────
function computeStreaks() {
  if (!STATE.habits.length) return { current: 0, best: 0 };
  const today = new Date();
  let current = 0, best = 0, run = 0;

  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dk = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
    const total = STATE.habits.length;
    const done  = STATE.habits.filter(h => isChecked(h.id, dk)).length;
    if (total && done / total >= 0.5) { run++; best = Math.max(best, run); }
    else run = 0;
  }

  // current streak (backwards from today)
  run = 0;
  for (let i = 0; i <= 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dk = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
    const total = STATE.habits.length;
    const done  = STATE.habits.filter(h => isChecked(h.id, dk)).length;
    if (total && done / total >= 0.5) run++;
    else break;
  }
  current = run;
  return { current, best };
}

// ─────────────────────────────────────────────────────
// PROGRESS CALCULATIONS
// ─────────────────────────────────────────────────────
function dayProgress(dk) {
  if (!STATE.habits.length) return 0;
  const done = STATE.habits.filter(h => isChecked(h.id, dk)).length;
  return Math.round(done / STATE.habits.length * 100);
}

function weekProgress() {
  const today = new Date();
  let total = 0, done = 0;
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const dk = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
    total += STATE.habits.length;
    done  += STATE.habits.filter(h => isChecked(h.id, dk)).length;
  }
  return total ? Math.round(done / total * 100) : 0;
}

function monthProgressVal(y, m) {
  const days = daysInMonth(y, m);
  const today = new Date();
  let total = 0, done = 0;
  for (let d = 1; d <= days; d++) {
    const dk = dateKey(y, m, d);
    const dayD = new Date(y, m, d);
    if (dayD > today) continue;
    total += STATE.habits.length;
    done  += STATE.habits.filter(h => isChecked(h.id, dk)).length;
  }
  return total ? Math.round(done / total * 100) : 0;
}

function weeklyBreakdown(y, m) {
  const days = daysInMonth(y, m);
  const today = new Date();
  const weeks = [];
  let week = 1, total = 0, done = 0;
  for (let d = 1; d <= days; d++) {
    const dk = dateKey(y, m, d);
    const dayD = new Date(y, m, d);
    if (dayD <= today) {
      total += STATE.habits.length;
      done  += STATE.habits.filter(h => isChecked(h.id, dk)).length;
    }
    if (d % 7 === 0 || d === days) {
      weeks.push({ label: `Week ${week}`, pct: total ? Math.round(done/total*100) : 0 });
      week++; total = 0; done = 0;
    }
  }
  return weeks;
}

// ─────────────────────────────────────────────────────
// TOP HABITS
// ─────────────────────────────────────────────────────
function topHabits() {
  const today = new Date();
  const y = today.getFullYear(), m = today.getMonth();
  const days = daysInMonth(y, m);
  return STATE.habits.map(h => {
    let total = 0, done = 0;
    for (let d = 1; d <= days; d++) {
      const dk = dateKey(y, m, d);
      const dayD = new Date(y, m, d);
      if (dayD > today) continue;
      total++;
      if (isChecked(h.id, dk)) done++;
    }
    return { ...h, pct: total ? Math.round(done/total*100) : 0 };
  }).sort((a,b) => b.pct - a.pct).slice(0, 10);
}

// ─────────────────────────────────────────────────────
// ACHIEVEMENTS CHECK
// ─────────────────────────────────────────────────────
function achievementsStatus() {
  const { current, best } = computeStreaks();

  // perfect week check
  let perfectWeek = false;
  const today = new Date();
  for (let w = 0; w < 4; w++) {
    let allGood = true;
    for (let d = 0; d < 7; d++) {
      const dd = new Date(today); dd.setDate(dd.getDate() - w*7 - d);
      const dk = dateKey(dd.getFullYear(), dd.getMonth(), dd.getDate());
      if (dayProgress(dk) < 100) { allGood = false; break; }
    }
    if (allGood && STATE.habits.length) { perfectWeek = true; break; }
  }

  const monthComplete = monthProgressVal(today.getFullYear(), today.getMonth()) >= 90;
  const habitMaster = STATE.habits.length >= 10 && best >= 30;

  return { current, best, perfectWeek, habitMaster, monthComplete, habits: STATE.habits.length };
}

// ─────────────────────────────────────────────────────
// RENDER: HEADER
// ─────────────────────────────────────────────────────
function renderHeader() {
  const today = new Date();
  document.getElementById('currentMonth').textContent =
    `📅 ${monthName(today.getMonth())} ${today.getFullYear()}`;

  const mp = monthProgressVal(today.getFullYear(), today.getMonth());
  document.getElementById('headerProgress').textContent = `📈 ${mp}% Monthly`;

  const { current } = computeStreaks();
  document.getElementById('headerStreak').textContent = `🔥 ${current} Day Streak`;
}

// ─────────────────────────────────────────────────────
// RENDER: STATS ROW
// ─────────────────────────────────────────────────────
function renderStats() {
  const { current, best } = computeStreaks();
  const today = todayKey();
  document.getElementById('currentStreak').textContent = current;
  document.getElementById('bestStreak').textContent    = best;
  document.getElementById('todayProgress').textContent  = dayProgress(today) + '%';
  document.getElementById('weeklyProgress').textContent = weekProgress() + '%';
  const t = new Date();
  document.getElementById('monthlyProgress').textContent = monthProgressVal(t.getFullYear(), t.getMonth()) + '%';
}

// ─────────────────────────────────────────────────────
// RENDER: HABIT GRID
// ─────────────────────────────────────────────────────
function renderGrid() {
  const { year: y, month: m } = STATE.view;
  const days = daysInMonth(y, m);
  const today = new Date();
  const tk = todayKey();

  document.getElementById('gridMonthLabel').textContent = `${monthName(m)} ${y}`;

  const thead = document.querySelector('#habitGrid thead');
  const tbody = document.querySelector('#habitGrid tbody');
  thead.innerHTML = ''; tbody.innerHTML = '';

  // Header row
  const hr = document.createElement('tr');
  const th0 = document.createElement('th');
  th0.textContent = 'Habit';
  hr.appendChild(th0);
  for (let d = 1; d <= days; d++) {
    const th = document.createElement('th');
    const dk = dateKey(y, m, d);
    th.textContent = d;
    if (dk === tk) th.classList.add('today-th');
    hr.appendChild(th);
  }
  // % column
  const thPct = document.createElement('th');
  thPct.textContent = '%';
  hr.appendChild(thPct);
  thead.appendChild(hr);

  // Habit rows
  STATE.habits.forEach(habit => {
    const tr = document.createElement('tr');

    // Name cell
    const td0 = document.createElement('td');
    td0.innerHTML = `
      <div class="habit-name-cell">
        <span class="habit-color-dot" style="background:${habit.color}"></span>
        <span class="habit-name-text">${habit.name}</span>
        <span class="habit-category-tag">${habit.category}</span>
        <div class="habit-actions">
          <button class="habit-action-btn edit-btn" data-id="${habit.id}" title="Edit">✏️</button>
          <button class="habit-action-btn del-btn"  data-id="${habit.id}" title="Delete">🗑</button>
        </div>
      </div>`;
    tr.appendChild(td0);

    let monthDone = 0, monthTotal = 0;
    for (let d = 1; d <= days; d++) {
      const dk = dateKey(y, m, d);
      const dayD = new Date(y, m, d);
      const isFuture = dayD > today;
      const checked  = isChecked(habit.id, dk);
      if (!isFuture) { monthTotal++; if (checked) monthDone++; }

      const td = document.createElement('td');
      const cell = document.createElement('span');
      cell.className = 'check-cell' +
        (checked ? ' checked' : '') +
        (isFuture ? ' future' : '') +
        (dk === tk ? ' today-col' : '');
      cell.style.setProperty('--habit-color', habit.color);
      cell.textContent = checked ? '✓' : '';
      if (!isFuture) {
        cell.addEventListener('click', () => {
          toggleCheck(habit.id, dk);
          renderAll();
        });
      }
      td.appendChild(cell);
      tr.appendChild(td);
    }

    // % cell
    const tdPct = document.createElement('td');
    const pct = monthTotal ? Math.round(monthDone/monthTotal*100) : 0;
    tdPct.innerHTML = `<strong style="color:${habit.color}">${pct}%</strong>`;
    tr.appendChild(tdPct);

    tbody.appendChild(tr);
  });

  // Empty state
  if (!STATE.habits.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = days + 2;
    td.innerHTML = `
      <div class="empty-grid-state">
        <div class="empty-grid-graphic">
          <span class="eg-dot" style="background:#FF6BB5"></span>
          <span class="eg-dot" style="background:#5DA9FF"></span>
          <span class="eg-dot" style="background:#55E6C1"></span>
          <span class="eg-dot" style="background:#B388FF"></span>
          <span class="eg-dot" style="background:#FFD93D"></span>
        </div>
        <div class="empty-grid-title">Start Your Habit Journey</div>
        <div class="empty-grid-sub">Track daily habits, build streaks, and watch your consistency grow.</div>
        <div class="empty-grid-steps">
          <div class="eg-step"><span class="eg-step-num" style="background:#FF6BB5">1</span>Click <strong>+ Add Habit</strong> above</div>
          <div class="eg-step"><span class="eg-step-num" style="background:#5DA9FF">2</span>Name it, pick a color &amp; category</div>
          <div class="eg-step"><span class="eg-step-num" style="background:#55E6C1">3</span>Check off each day — build your streak!</div>
        </div>
      </div>`;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  // Wire edit/delete
  tbody.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openEditModal(btn.dataset.id); });
  });
  tbody.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); deleteHabit(btn.dataset.id); });
  });
}

// ─────────────────────────────────────────────────────
// RENDER: TOP HABITS
// ─────────────────────────────────────────────────────
function renderTopHabits() {
  const list = topHabits();
  const el = document.getElementById('topHabits');
  if (!list.length) {
    el.innerHTML = `
      <div class="empty-list-state">
        <span class="empty-list-icon">🏅</span>
        <div class="empty-list-text">Your top habits will appear here once you start tracking.</div>
      </div>`;
    return;
  }
  el.innerHTML = list.map((h, i) => `
    <div class="top-habit-item">
      <span class="top-habit-rank">#${i+1}</span>
      <span class="habit-color-dot" style="background:${h.color}"></span>
      <span class="top-habit-name">${h.name}</span>
      <div class="top-habit-bar-wrap">
        <div class="top-habit-bar" style="width:${h.pct}%;background:${h.color}"></div>
      </div>
      <span class="top-habit-pct" style="color:${h.color}">${h.pct}%</span>
    </div>`).join('');
}

// ─────────────────────────────────────────────────────
// RENDER: WEEKLY RINGS
// ─────────────────────────────────────────────────────
function renderWeeklyRings() {
  const today = new Date();
  const noData = !STATE.habits.length;
  const colors = ['#FF6BB5','#5DA9FF','#55E6C1','#B388FF','#FFD93D'];
  const r = 30, circ = 2 * Math.PI * r;
  const el = document.getElementById('weeklyRings');

  // demo ring values when no habits
  const demoWeeks = [
    { label:'Week 1', pct:78 }, { label:'Week 2', pct:85 },
    { label:'Week 3', pct:61 }, { label:'Week 4', pct:92 }
  ];
  const weeks = noData ? demoWeeks : weeklyBreakdown(today.getFullYear(), today.getMonth());

  el.innerHTML = (noData ? `<div class="rings-preview-note">✦ Sample Preview — start tracking to see your real weekly data</div>` : '') +
    weeks.map((w, i) => {
      const col = colors[i % colors.length];
      const offset = circ - (w.pct / 100) * circ;
      return `
      <div class="ring-item">
        <svg class="ring-svg" width="80" height="80" viewBox="0 0 80 80">
          <circle class="ring-bg" cx="40" cy="40" r="${r}" stroke-width="8"/>
          <circle class="ring-fill" cx="40" cy="40" r="${r}" stroke-width="8"
            stroke="${col}" stroke-dasharray="${circ}" stroke-dashoffset="${offset}"/>
        </svg>
        <span class="ring-pct" style="color:${col}">${w.pct}%</span>
        <span class="ring-label">${w.label}</span>
      </div>`;
    }).join('');
}

// ─────────────────────────────────────────────────────
// CHARTS
// ─────────────────────────────────────────────────────
let charts = {};

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

// ── demo data shown before any habits are added ──
const DEMO = {
  weeklyBar: {
    labels: ['Week 1','Week 2','Week 3','Week 4'],
    data:   [78, 85, 61, 92]
  },
  monthlyArea: {
    labels: Array.from({length:20},(_,i)=>i+1),
    data:   [60,65,70,55,80,85,90,75,88,92,70,65,78,82,95,88,72,80,91,87]
  },
  pie: {
    labels: ['Exercise','Reading','Coding','Meditation','Gym','Water'],
    data:   [92, 84, 95, 76, 88, 100],
    colors: ['#FF6BB5','#5DA9FF','#55E6C1','#B388FF','#FFD93D','#FF7B72']
  },
  trend: {
    labels: Array.from({length:30},(_,i)=>i+1),
    data:   [50,55,60,45,70,75,80,65,85,90,72,68,78,82,95,88,72,80,91,87,76,83,89,93,85,79,88,92,96,100]
  }
};

const PREVIEW_PLUGIN = {
  id: 'previewWatermark',
  beforeDraw(chart) {
    const { ctx, chartArea: a } = chart;
    if (!a) return;
    ctx.save();
    ctx.font = 'bold 11px Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(180,180,200,0.55)';
    ctx.textAlign = 'center';
    ctx.translate(a.left + a.width/2, a.top + a.height/2);
    ctx.rotate(-Math.PI/6);
    ctx.fillText('PREVIEW — add habits to see real data', 0, 0);
    ctx.restore();
  }
};

function renderCharts() {
  const today = new Date();
  const y = today.getFullYear(), m = today.getMonth();
  const noData = !STATE.habits.length;

  // badge on each chart panel
  document.querySelectorAll('.chart-panel').forEach(p => {
    p.querySelector('.preview-badge')?.remove();
    if (noData) {
      const b = document.createElement('span');
      b.className = 'preview-badge';
      b.textContent = '✦ Sample Preview';
      p.querySelector('.chart-title').appendChild(b);
    }
  });

  // 1. Weekly Bar
  destroyChart('weeklyBar');
  let wkLabels, wkData;
  if (noData) {
    wkLabels = DEMO.weeklyBar.labels;
    wkData   = DEMO.weeklyBar.data;
  } else {
    wkLabels = []; wkData = [];
    weeklyBreakdown(y, m).forEach(w => { wkLabels.push(w.label); wkData.push(w.pct); });
  }
  charts.weeklyBar = new Chart(document.getElementById('weeklyBarChart'), {
    type: 'bar',
    data: {
      labels: wkLabels,
      datasets: [{
        label: 'Completion %',
        data: wkData,
        backgroundColor: ['#FF6BB5','#5DA9FF','#55E6C1','#B388FF','#FFD93D'],
        borderRadius: 10, borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, ...(noData && { previewWatermark: {} }) },
      scales: { y: { beginAtZero: true, max: 100, grid: { color: '#eef0f5' } }, x: { grid: { display: false } } }
    },
    plugins: noData ? [PREVIEW_PLUGIN] : []
  });

  // 2. Monthly Area
  destroyChart('monthlyArea');
  let mLabels, mData;
  if (noData) {
    mLabels = DEMO.monthlyArea.labels;
    mData   = DEMO.monthlyArea.data;
  } else {
    mLabels = []; mData = [];
    const days = daysInMonth(y, m);
    for (let d = 1; d <= days; d++) {
      const dk = dateKey(y, m, d);
      if (new Date(y, m, d) > today) break;
      mLabels.push(d);
      mData.push(dayProgress(dk));
    }
  }
  charts.monthlyArea = new Chart(document.getElementById('monthlyAreaChart'), {
    type: 'line',
    data: {
      labels: mLabels,
      datasets: [{
        label: 'Daily %', data: mData, fill: true,
        backgroundColor: 'rgba(93,169,255,0.12)',
        borderColor: '#5DA9FF', tension: 0.4, pointRadius: 3, pointBackgroundColor: '#5DA9FF'
      }]
    },
    options: {
      responsive: true, plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, max: 100, grid: { color: '#eef0f5' } }, x: { grid: { display: false } } }
    },
    plugins: noData ? [PREVIEW_PLUGIN] : []
  });

  // 3. Doughnut
  destroyChart('habitPie');
  let pieLabels, pieData, pieColors;
  if (noData) {
    pieLabels = DEMO.pie.labels; pieData = DEMO.pie.data; pieColors = DEMO.pie.colors;
  } else {
    const top = topHabits().slice(0, 6);
    pieLabels = top.map(h => h.name); pieData = top.map(h => h.pct); pieColors = top.map(h => h.color);
  }
  charts.habitPie = new Chart(document.getElementById('habitPieChart'), {
    type: 'doughnut',
    data: {
      labels: pieLabels,
      datasets: [{ data: pieData, backgroundColor: pieColors, borderWidth: 0 }]
    },
    options: {
      responsive: true, cutout: '60%',
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10, font: { size: 11 } } } }
    },
    plugins: noData ? [PREVIEW_PLUGIN] : []
  });

  // 4. 30-Day Trend
  destroyChart('progressTrend');
  let tLabels, tData;
  if (noData) {
    tLabels = DEMO.trend.labels; tData = DEMO.trend.data;
  } else {
    tLabels = []; tData = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const dk = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
      tLabels.push(d.getDate());
      tData.push(dayProgress(dk));
    }
  }
  charts.progressTrend = new Chart(document.getElementById('progressTrendChart'), {
    type: 'line',
    data: {
      labels: tLabels,
      datasets: [{
        label: '30-Day Trend', data: tData, fill: true,
        backgroundColor: 'rgba(255,107,181,0.12)',
        borderColor: '#FF6BB5', tension: 0.4, pointRadius: 2
      }]
    },
    options: {
      responsive: true, plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, max: 100, grid: { color: '#eef0f5' } }, x: { grid: { display: false } } }
    },
    plugins: noData ? [PREVIEW_PLUGIN] : []
  });
}

// ─────────────────────────────────────────────────────
// RENDER: HEATMAP
// ─────────────────────────────────────────────────────
function renderHeatmap() {
  const container = document.getElementById('heatmapContainer');
  const today = new Date();
  const yr = today.getFullYear();

  // Build a map of dateKey -> intensity level (0-4)
  const maxH = STATE.habits.length || 1;
  function level(dk) {
    const done = STATE.habits.filter(h => isChecked(h.id, dk)).length;
    if (!done) return 0;
    const pct = done / maxH;
    if (pct < 0.25) return 1;
    if (pct < 0.5)  return 2;
    if (pct < 0.75) return 3;
    return 4;
  }

  // Start from first Sunday on or before Jan 1
  const jan1 = new Date(yr, 0, 1);
  const startDay = new Date(jan1);
  startDay.setDate(jan1.getDate() - jan1.getDay());

  const endDay = new Date(yr, 11, 31);

  // Build weeks array
  const weeks = [];
  let cur = new Date(startDay);
  while (cur <= endDay) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }

  // Month label positions
  const monthPositions = {};
  weeks.forEach((wk, wi) => {
    wk.forEach(day => {
      if (day.getDate() === 1 && day.getFullYear() === yr) {
        monthPositions[wi] = monthName(day.getMonth()).slice(0,3);
      }
    });
  });

  // Render month labels row
  const monthsRow = document.createElement('div');
  monthsRow.className = 'heatmap-months-row';
  monthsRow.style.cssText = 'display:flex;gap:0;padding-left:36px;margin-bottom:4px;';
  weeks.forEach((_, wi) => {
    const span = document.createElement('span');
    span.style.cssText = `width:18px;font-size:.68rem;color:var(--text-2);font-weight:600;`;
    span.textContent = monthPositions[wi] || '';
    monthsRow.appendChild(span);
  });

  // Day labels
  const dayLabels = ['S','M','T','W','T','F','S'];
  const daysCol = document.createElement('div');
  daysCol.className = 'heatmap-days-col';
  dayLabels.forEach(dl => {
    const span = document.createElement('span');
    span.className = 'heatmap-day-label';
    span.textContent = dl;
    daysCol.appendChild(span);
  });

  // Weeks grid
  const weeksEl = document.createElement('div');
  weeksEl.className = 'heatmap-weeks';
  weeks.forEach(wk => {
    const wkEl = document.createElement('div');
    wkEl.className = 'heatmap-week';
    wk.forEach(day => {
      const cell = document.createElement('div');
      cell.className = 'heatmap-cell';
      if (day.getFullYear() !== yr || day > today) {
        cell.classList.add('empty');
      } else {
        const dk = dateKey(day.getFullYear(), day.getMonth(), day.getDate());
        const lv = level(dk);
        cell.classList.add(`lv${lv}`);
        cell.dataset.count = lv;
        cell.title = `${day.toDateString()}: ${dayProgress(dk)}%`;
        // tooltip on hover
        cell.addEventListener('mouseenter', e => showTooltip(e, cell.title));
        cell.addEventListener('mouseleave', hideTooltip);
      }
      wkEl.appendChild(cell);
    });
    weeksEl.appendChild(wkEl);
  });

  const gridRow = document.createElement('div');
  gridRow.className = 'heatmap-grid';
  gridRow.style.cssText = 'display:flex;align-items:flex-start;';
  gridRow.appendChild(daysCol);
  gridRow.appendChild(weeksEl);

  container.innerHTML = '';
  container.appendChild(monthsRow);
  container.appendChild(gridRow);
}

let tooltipEl = null;
function showTooltip(e, text) {
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'cell-tooltip';
    document.body.appendChild(tooltipEl);
  }
  tooltipEl.textContent = text;
  tooltipEl.style.display = 'block';
  tooltipEl.style.left = (e.clientX + 10) + 'px';
  tooltipEl.style.top  = (e.clientY - 28) + 'px';
}
function hideTooltip() {
  if (tooltipEl) tooltipEl.style.display = 'none';
}
document.addEventListener('mouseleave', hideTooltip);

// ─────────────────────────────────────────────────────
// RENDER: ACHIEVEMENTS
// ─────────────────────────────────────────────────────
function renderAchievements() {
  const s = achievementsStatus();
  const el = document.getElementById('achievementsGrid');
  el.innerHTML = ACHIEVEMENTS_DEF.map(a => {
    const unlocked = a.check(s);
    return `
    <div class="achievement-card ${unlocked ? 'unlocked' : ''}">
      <div class="achievement-icon">${a.icon}</div>
      <div class="achievement-name">${a.name}</div>
      <div class="achievement-desc">${a.desc}</div>
      ${!unlocked ? '<div class="achievement-locked-overlay">🔒</div>' : ''}
    </div>`;
  }).join('');
}

// ─────────────────────────────────────────────────────
// RENDER ALL
// ─────────────────────────────────────────────────────
function renderAll() {
  renderHeader();
  renderStats();
  renderGrid();
  renderTopHabits();
}

function renderAnalytics() {
  renderWeeklyRings();
  renderCharts();
  renderAdvancedCharts();
}

// ─────────────────────────────────────────────────────
// DATA: ADVANCED CHARTS
// ─────────────────────────────────────────────────────

function dayOfWeekData() {
  const totals = [0,0,0,0,0,0,0];
  const counts  = [0,0,0,0,0,0,0];
  const today = new Date();
  for (let i = 0; i < 28; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const dow = (d.getDay() + 6) % 7; // 0=Mon … 6=Sun
    const dk  = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
    totals[dow] += dayProgress(dk);
    counts[dow]++;
  }
  return counts.map((c, i) => c ? Math.round(totals[i] / c) : 0);
}

function categoryRadarData() {
  const cats = ['Health','Study','Spiritual','Business','Fitness','Personal'];
  const today = new Date();
  const y = today.getFullYear(), m = today.getMonth();
  const days = daysInMonth(y, m);
  return cats.map(cat => {
    const hs = STATE.habits.filter(h => h.category === cat);
    if (!hs.length) return 0;
    let total = 0, done = 0;
    for (let d = 1; d <= days; d++) {
      const dayD = new Date(y, m, d);
      if (dayD > today) continue;
      const dk = dateKey(y, m, d);
      hs.forEach(h => { total++; if (isChecked(h.id, dk)) done++; });
    }
    return total ? Math.round(done / total * 100) : 0;
  });
}

function habitStreakData() {
  const today = new Date();
  return STATE.habits.map(h => {
    let streak = 0;
    for (let i = 0; i <= 365; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const dk = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
      if (isChecked(h.id, dk)) streak++;
      else break;
    }
    return { name: h.name, color: h.color, streak };
  }).sort((a, b) => b.streak - a.streak).slice(0, 7);
}

function monthCompareData() {
  const today = new Date();
  const y = today.getFullYear(), m = today.getMonth();
  const lm = m === 0 ? 11 : m - 1;
  const ly = m === 0 ? y - 1 : y;
  const thisM = weeklyBreakdown(y, m).map(w => w.pct);
  const lastM = weeklyBreakdown(ly, lm).map(w => w.pct);
  const len = Math.max(thisM.length, lastM.length);
  return {
    labels:   Array.from({length: len}, (_, i) => `Week ${i+1}`),
    thisMonth: thisM,
    lastMonth: lastM
  };
}

// ─────────────────────────────────────────────────────
// RENDER: ADVANCED CHARTS
// ─────────────────────────────────────────────────────
const DEMO_ADV = {
  dow:     [72, 85, 68, 91, 78, 55, 62],
  radar:   [85, 72, 91, 64, 88, 76],
  streaks: [
    { name:'Exercise',  color:'#FF6BB5', streak:12 },
    { name:'Coding',    color:'#55E6C1', streak:10 },
    { name:'Water',     color:'#5DA9FF', streak:15 },
    { name:'Meditation',color:'#B388FF', streak: 8 },
    { name:'Gym',       color:'#FFD93D', streak: 7 },
    { name:'Reading',   color:'#FF7B72', streak: 5 }
  ],
  compare: {
    labels:    ['Week 1','Week 2','Week 3','Week 4'],
    thisMonth: [78, 85, 61, 92],
    lastMonth: [65, 70, 55, 80]
  }
};

function renderAdvancedCharts() {
  const noData = !STATE.habits.length;

  // badge helper (same as main charts)
  ['dowChart','categoryRadarChart','streakBarChart','monthCompareChart'].forEach(id => {
    const panel = document.getElementById(id)?.closest('.chart-panel');
    if (!panel) return;
    panel.querySelector('.preview-badge')?.remove();
    if (noData) {
      const b = document.createElement('span');
      b.className = 'preview-badge';
      b.textContent = '✦ Sample Preview';
      panel.querySelector('.chart-title').appendChild(b);
    }
  });

  // ── 1. Day of Week ──
  destroyChart('dow');
  const dowValues = noData ? DEMO_ADV.dow : dayOfWeekData();
  const DOW_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const DOW_COLORS = ['#FF6BB5','#5DA9FF','#55E6C1','#B388FF','#FFD93D','#FF7B72','#FF6BB5'];
  charts.dow = new Chart(document.getElementById('dowChart'), {
    type: 'bar',
    data: {
      labels: DOW_LABELS,
      datasets: [{
        label: 'Avg Completion %',
        data: dowValues,
        backgroundColor: DOW_COLORS,
        borderRadius: 10, borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, max: 100, grid: { color: '#eef0f5' } },
        x: { grid: { display: false } }
      }
    },
    plugins: noData ? [PREVIEW_PLUGIN] : []
  });

  // ── 2. Category Radar ──
  destroyChart('categoryRadar');
  const radarValues = noData ? DEMO_ADV.radar : categoryRadarData();
  const CAT_LABELS  = ['Health','Study','Spiritual','Business','Fitness','Personal'];
  charts.categoryRadar = new Chart(document.getElementById('categoryRadarChart'), {
    type: 'radar',
    data: {
      labels: CAT_LABELS,
      datasets: [{
        label: 'Completion %',
        data: radarValues,
        backgroundColor: 'rgba(179,136,255,0.18)',
        borderColor: '#B388FF',
        pointBackgroundColor: '#B388FF',
        pointBorderColor: '#fff',
        pointRadius: 5,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        r: {
          beginAtZero: true, max: 100,
          ticks: { stepSize: 25, font: { size: 10 }, backdropColor: 'transparent' },
          grid: { color: '#eef0f5' },
          pointLabels: { font: { size: 11, weight: '700' }, color: '#6B7280' }
        }
      }
    },
    plugins: noData ? [PREVIEW_PLUGIN] : []
  });

  // ── 3. Streak Leaders (horizontal bar) ──
  destroyChart('streakBar');
  const streakData = noData ? DEMO_ADV.streaks : habitStreakData();
  charts.streakBar = new Chart(document.getElementById('streakBarChart'), {
    type: 'bar',
    data: {
      labels: streakData.map(h => h.name),
      datasets: [{
        label: 'Current Streak (days)',
        data:  streakData.map(h => h.streak),
        backgroundColor: streakData.map(h => h.color),
        borderRadius: 8, borderSkipped: false
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, grid: { color: '#eef0f5' },
             ticks: { callback: v => v + 'd' } },
        y: { grid: { display: false } }
      }
    },
    plugins: noData ? [PREVIEW_PLUGIN] : []
  });

  // ── 4. This Month vs Last Month (grouped bar) ──
  destroyChart('monthCompare');
  const cmp = noData ? DEMO_ADV.compare : monthCompareData();
  charts.monthCompare = new Chart(document.getElementById('monthCompareChart'), {
    type: 'bar',
    data: {
      labels: cmp.labels,
      datasets: [
        {
          label: 'Last Month',
          data: cmp.lastMonth,
          backgroundColor: 'rgba(179,136,255,0.35)',
          borderColor: '#B388FF',
          borderWidth: 1.5,
          borderRadius: 8, borderSkipped: false
        },
        {
          label: 'This Month',
          data: cmp.thisMonth,
          backgroundColor: '#5DA9FF',
          borderRadius: 8, borderSkipped: false
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
          labels: { boxWidth: 12, padding: 10, font: { size: 11 } }
        }
      },
      scales: {
        y: { beginAtZero: true, max: 100, grid: { color: '#eef0f5' } },
        x: { grid: { display: false } }
      }
    },
    plugins: noData ? [PREVIEW_PLUGIN] : []
  });
}

// ─────────────────────────────────────────────────────
// MODAL: ADD / EDIT
// ─────────────────────────────────────────────────────
let selectedColor = '#FF6BB5';

function openAddModal() {
  selectedColor = '#FF6BB5';
  document.getElementById('modalTitle').textContent = 'Add Habit';
  document.getElementById('habitForm').reset();
  document.getElementById('habitId').value = '';
  document.getElementById('habitTarget').value = '7';
  updateColorPicker('#FF6BB5');
  document.getElementById('habitModal').classList.remove('hidden');
}

function openEditModal(id) {
  const h = STATE.habits.find(h => h.id === id);
  if (!h) return;
  selectedColor = h.color;
  document.getElementById('modalTitle').textContent = 'Edit Habit';
  document.getElementById('habitId').value    = h.id;
  document.getElementById('habitName').value  = h.name;
  document.getElementById('habitCategory').value   = h.category;
  document.getElementById('habitDifficulty').value = h.difficulty;
  document.getElementById('habitTarget').value     = h.target;
  updateColorPicker(h.color);
  document.getElementById('habitModal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('habitModal').classList.add('hidden');
}

function updateColorPicker(color) {
  document.querySelectorAll('.color-swatch').forEach(sw => {
    sw.classList.toggle('active', sw.dataset.color === color);
  });
  selectedColor = color;
}

document.getElementById('colorPicker').addEventListener('click', e => {
  const sw = e.target.closest('.color-swatch');
  if (sw) updateColorPicker(sw.dataset.color);
});

document.getElementById('habitForm').addEventListener('submit', e => {
  e.preventDefault();
  const id   = document.getElementById('habitId').value;
  const name = document.getElementById('habitName').value.trim();
  if (!name) return;

  const data = {
    name,
    category:   document.getElementById('habitCategory').value,
    difficulty: document.getElementById('habitDifficulty').value,
    color:      selectedColor,
    target:     parseInt(document.getElementById('habitTarget').value) || 7
  };

  if (id) {
    const idx = STATE.habits.findIndex(h => h.id === id);
    if (idx !== -1) STATE.habits[idx] = { ...STATE.habits[idx], ...data };
    toast('Habit updated!', 'success');
  } else {
    STATE.habits.push({ id: uid(), createdAt: Date.now(), ...data });
    toast('Habit added!', 'success');
  }
  saveState();
  closeModal();
  renderAll();
});

function deleteHabit(id) {
  if (!confirm('Delete this habit? All its data will be removed.')) return;
  STATE.habits = STATE.habits.filter(h => h.id !== id);
  Object.keys(STATE.log).forEach(dk => { delete STATE.log[dk][id]; });
  saveState();
  renderAll();
  toast('Habit deleted.', 'error');
}

// ─────────────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────────────
function switchSection(name) {
  document.querySelectorAll('.sidebar-nav li').forEach(li => {
    li.classList.toggle('active', li.dataset.section === name);
  });
  document.querySelectorAll('.section').forEach(s => {
    s.classList.toggle('active', s.id === 'section-' + name);
  });
  if (name === 'analytics') renderAnalytics();
  if (name === 'heatmap')   renderHeatmap();
  if (name === 'achievements') renderAchievements();
}

// ─────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────
function exportJSON() {
  const data = { habits: STATE.habits, log: STATE.log, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  download(blob, 'habitflow-export.json');
  toast('Exported JSON!', 'success');
}

function exportCSV() {
  const today = new Date();
  const y = today.getFullYear(), m = today.getMonth();
  const days = daysInMonth(y, m);
  const headers = ['Habit', 'Category', 'Difficulty', ...Array.from({length:days},(_,i)=>i+1), 'Total%'];
  const rows = STATE.habits.map(h => {
    let done = 0, total = 0;
    const cells = Array.from({length: days}, (_, i) => {
      const dk = dateKey(y, m, i+1);
      const c = isChecked(h.id, dk) ? 1 : 0;
      const dayD = new Date(y, m, i+1);
      if (dayD <= today) { total++; done += c; }
      return c;
    });
    const pct = total ? Math.round(done/total*100) : 0;
    return [h.name, h.category, h.difficulty, ...cells, pct+'%'];
  });
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  download(blob, 'habitflow-export.csv');
  toast('Exported CSV!', 'success');
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}


// ─────────────────────────────────────────────────────
// EVENT LISTENERS
// ─────────────────────────────────────────────────────
document.getElementById('addHabitBtn').addEventListener('click', openAddModal);
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('cancelBtn').addEventListener('click', closeModal);
document.getElementById('habitModal').addEventListener('click', e => {
  if (e.target === document.getElementById('habitModal')) closeModal();
});

document.getElementById('exportBtn').addEventListener('click', () => {
  document.getElementById('exportModal').classList.remove('hidden');
});
document.getElementById('exportModalClose').addEventListener('click', () => {
  document.getElementById('exportModal').classList.add('hidden');
});
document.getElementById('exportModal').addEventListener('click', e => {
  if (e.target === document.getElementById('exportModal'))
    document.getElementById('exportModal').classList.add('hidden');
});
document.getElementById('exportJSON').addEventListener('click', () => {
  exportJSON();
  document.getElementById('exportModal').classList.add('hidden');
});
document.getElementById('exportCSV').addEventListener('click', () => {
  exportCSV();
  document.getElementById('exportModal').classList.add('hidden');
});

document.querySelectorAll('.sidebar-nav li').forEach(li => {
  li.addEventListener('click', () => switchSection(li.dataset.section));
});

document.getElementById('prevMonth').addEventListener('click', () => {
  STATE.view.month--;
  if (STATE.view.month < 0) { STATE.view.month = 11; STATE.view.year--; }
  renderGrid();
});
document.getElementById('nextMonth').addEventListener('click', () => {
  const today = new Date();
  if (STATE.view.year === today.getFullYear() && STATE.view.month >= today.getMonth()) return;
  STATE.view.month++;
  if (STATE.view.month > 11) { STATE.view.month = 0; STATE.view.year++; }
  renderGrid();
});

// ─────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────
wireAuth();
loadAuth();

if (AUTH.currentUser) {
  loadState();
  showApp();
  renderAll();
} else {
  showAuthScreen();
}

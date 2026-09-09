/**
 * Clinic Stock — read-only dashboard.
 *
 * Opened from the home screen on a phone that is not in the clinic, to answer
 * two questions: is there stock, and did today actually get entered.
 *
 * Three rules shape it:
 *
 *  1. NO ARITHMETIC HERE. Every number comes from a Postgres view that mirrors
 *     the app's own definitions. Two implementations of "what is on hand" would
 *     drift, and the drifting one would still look authoritative.
 *  2. FRESHNESS BEFORE FIGURES. A stock count read at home while a device has
 *     not synced for hours is wrong and reads as fact. So staleness is stated
 *     above the numbers, not below them.
 *  3. READ ONLY. No write path exists in this file.
 */

const CFG = window.CLINIC_CONFIG;
const SESSION_KEY = 'clinic.session';

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------------------------------------------------------- session */

const loadSession = () => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
};
const saveSession = (s) => localStorage.setItem(SESSION_KEY, JSON.stringify(s));
const clearSession = () => localStorage.removeItem(SESSION_KEY);

async function authRequest(path, body) {
  const r = await fetch(`${CFG.url}${path}`, {
    method: 'POST',
    headers: { apikey: CFG.key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.msg || j.error_description || `Sign-in failed (${r.status})`);
  return {
    access: j.access_token,
    refresh: j.refresh_token,
    // 60s of slack so a slow page load does not expire mid-request.
    expires: Date.now() + (j.expires_in - 60) * 1000,
  };
}

async function token() {
  let s = loadSession();
  if (!s) throw new Error('not signed in');
  if (Date.now() < s.expires) return s.access;
  // Refreshing keeps her signed in for months, so the password is typed once.
  s = await authRequest('/auth/v1/token?grant_type=refresh_token', { refresh_token: s.refresh });
  saveSession(s);
  return s.access;
}

async function read(pathAndQuery) {
  const t = await token();
  const r = await fetch(`${CFG.url}/rest/v1/${pathAndQuery}`, {
    headers: { apikey: CFG.key, Authorization: `Bearer ${t}` },
  });
  if (r.status === 401 || r.status === 403) throw new Error('signed out');
  if (!r.ok) throw new Error(`Could not load data (${r.status})`);
  return r.json();
}

/* ------------------------------------------------------------ formatting */

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function ago(ms) {
  if (!ms) return 'never';
  const mins = Math.floor((Date.now() - ms) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ${hrs === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

function clockTime(d = new Date()) {
  const h = d.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/**
 * The device's own local date, matching how `local_date` is stamped at write
 * time on the phone. Deliberately not the server's date: "today" has to mean
 * the clinic's day, and the server runs in UTC.
 */
function todayLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const PILL = { LOW: 'p-low', OUT: 'p-out', NEGATIVE: 'p-check', OK: 'p-ok' };
const WORD = { LOW: 'LOW', OUT: 'OUT', NEGATIVE: 'CHECK', OK: '' };

/* ---------------------------------------------------------------- render */

/** Two hours of silence during clinic hours is worth saying out loud. */
const STALE_MS = 2 * 60 * 60 * 1000;

/**
 * A fingerprint of everything on screen, so Refresh can answer the only
 * question a click actually asks: did anything change?
 *
 * Built from the fields that move when real work happens - each device's entry
 * count and last upload, and every vaccine's balance. Deliberately NOT the
 * whole payload: `synced_at` on an unrelated row would make every check look
 * like news, which is the same as telling her nothing.
 */
function signature(stock, devices, entries) {
  return JSON.stringify([
    devices.map((d) => [d.device_id, d.entries, d.last_synced_at]).sort(),
    stock.map((s) => [s.vaccine_id, s.on_hand_doses]).sort(),
    entries.length,
  ]);
}

let lastSignature = null;

function renderDevices(devices) {
  if (!devices.length) {
    $('devices').innerHTML = '<p class="meta">No entries recorded yet.</p>';
    return [];
  }
  const stale = [];
  $('devices').innerHTML = devices
    .map((d) => {
      const entryAt = Number(d.last_entry_at) || 0;
      const syncAt = d.last_synced_at ? new Date(d.last_synced_at).getTime() : 0;
      const isStale = syncAt && Date.now() - syncAt > STALE_MS;
      if (isStale) stale.push(d);
      return `<div class="row">
        <div class="grow">
          <div class="name">Device ${esc(String(d.device_id).slice(0, 6).toUpperCase())}</div>
          <div class="meta">last entry ${esc(ago(entryAt))} · reached the server ${esc(ago(syncAt))}</div>
        </div>
        ${isStale ? '<span class="pill p-low">BEHIND</span>' : '<span class="pill p-ok">UP TO DATE</span>'}
      </div>`;
    })
    .join('');
  return stale;
}

/** Most urgent first. Ordering in SQL would sort the WORDS alphabetically -
 *  LOW, NEGATIVE, OK, OUT - which is not a severity order. */
const RANK = { NEGATIVE: 0, OUT: 1, LOW: 2, OK: 3 };

function renderStock(rows) {
  const attention = rows
    .filter((r) => r.level !== 'OK')
    .sort((a, b) => (RANK[a.level] ?? 9) - (RANK[b.level] ?? 9));
  const line = (r) => `<div class="row">
      <div class="grow">
        <div class="name">${esc(r.name)}</div>
        ${Number(r.min_balance_doses) > 0
          ? `<div class="meta">keep ${esc(r.min_balance_doses)} doses</div>` : ''}
      </div>
      ${r.level !== 'OK' ? `<span class="pill ${PILL[r.level]}">${WORD[r.level]}</span>` : ''}
      <div class="num">${esc(r.on_hand_doses)}</div>
    </div>`;

  $('attention').innerHTML = attention.length
    ? attention.map(line).join('')
    : '<p class="meta">Nothing low or out. Everything is above its safety limit.</p>';

  $('stock').innerHTML = rows.length
    ? rows.map(line).join('')
    : '<p class="meta">No vaccines yet.</p>';
}

function renderEntries(rows) {
  $('entries').innerHTML = rows.length
    ? rows
        .map((m) => `<div class="row">
            <div class="grow">
              <div class="name">${esc(m.vaccine_name || 'Vaccine')}${
                Math.abs(Number(m.delta_doses)) > 1 ? ` × ${Math.abs(Number(m.delta_doses))}` : ''}</div>
              <div class="meta">${esc(m.local_time)}${m.patient_label ? ` · ${esc(m.patient_label)}` : ''}</div>
            </div>
          </div>`)
        .join('')
    : '<p class="meta">Nothing recorded today yet.</p>';
}

async function load() {
  const today = todayLocal();

  // Every figure comes from a view. Nothing is computed in this file.
  const [stock, devices, given] = await Promise.all([
    read('v_stock_on_hand?select=*&order=name.asc'),
    read('v_device_activity?select=*'),
    read(
      `v_movement_effective?select=local_time,delta_doses,patient_label,vaccine_id` +
      `&movement_type=eq.ADMINISTRATION&local_date=eq.${today}&order=local_time.desc`,
    ),
  ]);

  // Fail loudly on an out-of-date view. Without this check `r.level !== 'OK'`
  // is true for every row, because `undefined !== 'OK'` - so every vaccine
  // would appear under "Needs attention" with a blank badge. A dashboard that
  // is confidently wrong is worse than one that says it cannot load.
  if (stock.length && !('level' in stock[0])) {
    throw new Error(
      'The server is out of date: v_stock_on_hand has no "level" column. ' +
      'Re-run supabase/schema.sql in the Supabase SQL Editor.',
    );
  }

  const nameOf = new Map(stock.map((s) => [s.vaccine_id, s.name]));
  const entries = given.map((g) => ({ ...g, vaccine_name: nameOf.get(g.vaccine_id) }));

  const doses = entries.reduce((n, e) => n + Math.abs(Number(e.delta_doses) || 0), 0);
  $('todayCount').textContent = `${doses} ${doses === 1 ? 'dose' : 'doses'}`;

  const lastEntry = Math.max(0, ...devices.map((d) => Number(d.last_entry_at) || 0));
  $('lastEntry').textContent = lastEntry
    ? `Last entry ${ago(lastEntry)}`
    : 'Nothing has been recorded on any device yet.';

  const stale = renderDevices(devices);
  renderStock(stock);
  renderEntries(entries);

  // Freshness ABOVE the numbers, not below them.
  if (stale.length) {
    $('staleWarn').textContent =
      `${stale.length === 1 ? 'A device has' : `${stale.length} devices have`} not reached the ` +
      `server for over 2 hours. Anything entered there since is not shown below yet.`;
    $('staleWarn').classList.remove('hide');
  } else {
    $('staleWarn').classList.add('hide');
  }

  $('asOf').textContent = `Stock as of ${clockTime()} today`;
  $('footNote').textContent =
    'This page only reads. Doses and deliveries are recorded in the app on the clinic phone.';

  // Whether anything moved since the previous check, and when that check was.
  // `firstLoad` matters: on the very first load there is nothing to compare
  // against, and claiming "nothing new" then would be a guess dressed up as a
  // fact.
  const sig = signature(stock, devices, entries);
  const firstLoad = lastSignature === null;
  const changed = !firstLoad && sig !== lastSignature;
  lastSignature = sig;

  $('checked').textContent = firstLoad
    ? `Checked ${clockTime()}`
    : changed
      ? `Checked ${clockTime()} — new entries loaded`
      : `Checked ${clockTime()} — nothing new since the last check`;

  return { changed, firstLoad };
}

/* ------------------------------------------------------------------ boot */

function showLogin(msg) {
  $('dash').classList.add('hide');
  $('login').classList.remove('hide');
  if (msg) { $('loginError').textContent = msg; $('loginError').classList.remove('hide'); }
  $('email').value = $('email').value || CFG.email || '';
}

async function showDash() {
  $('login').classList.add('hide');
  $('dash').classList.remove('hide');
  $('loadError').classList.add('hide');
  try {
    return await load();
  } catch (e) {
    if (String(e.message).includes('signed out') || String(e.message).includes('not signed in')) {
      clearSession();
      showLogin('Please sign in again.');
    } else {
      // In the red banner above the figures, not in the subtitle. A page that
      // failed to load must not look like a page that loaded.
      $('loadError').textContent = e.message;
      $('loadError').classList.remove('hide');
      // Never leave a stale "Checked 3:04pm" implying this read succeeded.
      $('checked').textContent = `Could not check — last shown figures are from earlier`;
    }
    return null;
  }
}

$('signin').addEventListener('click', async () => {
  const btn = $('signin');
  btn.disabled = true;
  btn.textContent = 'Signing in…';
  $('loginError').classList.add('hide');
  try {
    saveSession(await authRequest('/auth/v1/token?grant_type=password', {
      email: $('email').value.trim(),
      password: $('password').value,
    }));
    $('password').value = '';
    await showDash();
  } catch (e) {
    showLogin(e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign in';
  }
});

$('password').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('signin').click(); });

/**
 * Refresh has to SAY it did something.
 *
 * It always worked, but it re-rendered the same figures into the same DOM and
 * changed nothing on screen - and `asOf` is minute-resolution, so two clicks in
 * one minute produced byte-identical output. A button with no feedback is
 * indistinguishable from a broken button, and it got reported as broken.
 *
 * So: disabled with a label change while in flight, then a brief confirmation.
 * Same pattern the Sign in button already used.
 */
$('refresh').addEventListener('click', async () => {
  const btn = $('refresh');
  if (btn.disabled) return;
  btn.disabled = true;
  btn.textContent = 'Refreshing…';
  let result = null;
  try {
    result = await showDash();
  } finally {
    // The label answers the click; the line above it keeps the answer around
    // after the label reverts.
    btn.textContent = !result
      ? 'Refresh'
      : result.changed
        ? 'Updated'
        : 'No changes';
    btn.disabled = false;
    if (result) setTimeout(() => { btn.textContent = 'Refresh'; }, 1800);
  }
});
$('signout').addEventListener('click', () => { clearSession(); showLogin(); });

// Coming back to the page is the moment the numbers matter, so re-read then.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && loadSession()) void showDash();
});

if (!CFG || !CFG.url || !CFG.key) {
  document.body.innerHTML =
    '<div class="wrap"><p class="err">config.js is missing. Copy web/config.example.js to ' +
    'web/config.js and fill it in.</p></div>';
} else if (loadSession()) {
  void showDash();
} else {
  showLogin();
}

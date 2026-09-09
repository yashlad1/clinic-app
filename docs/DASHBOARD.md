# The iPhone page

A read-only page for checking stock from home. Saved to the home screen it looks and opens like an
app, with no Apple Developer account, no App Store, and no yearly fee.

It answers the two questions that prompted it: **is there stock**, and **did today get entered**.

---

## What it shows, in this order

1. **A warning if any device has not reached the server for over 2 hours.** Above the numbers, not
   below them — a stock count read at home while the clinic phone is behind is wrong and reads as
   fact.
2. **Doses today**, and how long ago the last entry was.
3. **Each device**: last entry, last contact with the server, and `UP TO DATE` or `BEHIND`.
4. **Needs attention**: only what is `CHECK`, `OUT` or `LOW`, most urgent first.
5. **All stock**, alphabetical.
6. **Today's entries**, with times.

Every figure comes from a Postgres view. **Nothing is calculated in the page**, including whether a
vaccine counts as low — that would be a second definition of "low", and the one that drifts would
still look authoritative.

## What it cannot do

Write anything. There is no write path in the code. Doses and deliveries are recorded only in the
app on the clinic devices.

---

## Deploying it

### 1. Fill in the config

```sh
cp web/config.example.js web/config.js
```

Put the project URL, the `sb_publishable_…` key, and the clinic email in it. **No password** — the
page asks for that and the browser remembers the session.

`web/config.js` is gitignored. The publishable key is safe in a web page — `anon` is `REVOKE`d from
every table and view, so the key alone returns 401 for everything — but the repo is public, and
CLAUDE.md section 13 forbids committing anything that identifies the clinic.

### 2. Put the `web/` folder on any static host

Cloudflare Pages, Netlify, Vercel, or anything else. It is plain HTML and JavaScript with no build
step. With Netlify Drop you can literally drag the folder onto the page.

```sh
npx --yes wrangler pages deploy web --project-name clinic-stock
```

### 3. Add it to the home screen

On the iPhone, open the URL in **Safari** → **Share** → **Add to Home Screen**.

Safari specifically: Chrome on iOS cannot add a web app to the home screen.

### 4. Sign in once

Email is pre-filled; type the password. The session refreshes itself, so this is a one-time step
that survives for months.

---

## Notes worth keeping

**"Today" is the phone's own date**, matching how `local_date` is stamped when a dose is recorded.
Not the server's, which runs in UTC — a dose given at 8am IST would otherwise land on the wrong day.

**It needs internet**, unlike the app. That is fine: it exists for checking from outside the clinic.
The app itself never depends on this page or on the network.

**If it says the server is out of date**, re-run `supabase/schema.sql`. The page checks for the
`level` column and refuses to render rather than mark every vaccine as needing attention.

**Anyone with the URL still needs the password.** Row-level security scopes every row to the signed-in
clinic account, and that isolation is verified: a second account cannot see this clinic's rows,
through the tables or through the views.

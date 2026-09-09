# Server backup — the exact commands

Run these once, from the project folder, on the laptop.

---

## Step 0 — one toggle in Supabase (do this first)

**Authentication → Providers → Email → "Confirm email" → OFF → Save.**

The app creates its own account on first launch. With confirmation on, that account exists but
cannot sign in, because confirming means clicking a link in an inbox nobody opens.

---

## Step 1 — make the password and SAVE it

Generate it on its own line so you can actually read it:

```sh
python3 -c "import secrets,string; a=string.ascii_letters+string.digits; print(''.join(secrets.choice(a) for _ in range(28)))"
```

**Copy the output into your password manager now, before going further.** EAS will not show it
again, and it is the only way into the clinic's server data.

---

## Step 2 — set the four variables

Replace `YOUR_EMAIL` with your own real email address, and `THE_PASSWORD` with what step 1 printed.

- The **URL** and **KEY** below are already correct for this project — nothing to look up.
- The **email** and **password** are not found anywhere in Supabase. They are the account the app
  creates for itself.

```sh
E="npx --yes eas-cli@23.2.0 env:create --scope project --environment production --visibility plaintext --non-interactive"

$E --name EXPO_PUBLIC_SYNC_URL      --value "https://sxgvsslhtttjfltuoodm.supabase.co"
$E --name EXPO_PUBLIC_SYNC_KEY      --value "sb_publishable_ZpWboAqep2Y2LYiYjpbNPA_-SNFzdv8"
$E --name EXPO_PUBLIC_SYNC_EMAIL    --value "YOUR_EMAIL"
$E --name EXPO_PUBLIC_SYNC_PASSWORD --value "THE_PASSWORD"
```

If a name already exists, `env:create` refuses rather than overwriting. Change it with:

```sh
npx --yes eas-cli@23.2.0 env:update --environment production --name EXPO_PUBLIC_SYNC_PASSWORD --value "NEW_PASSWORD"
```

---

## Step 3 — check they landed

```sh
npx --yes eas-cli@23.2.0 env:list --environment production
```

All four must be listed. `EXPO_PUBLIC_*` values are inlined into the app bundle, so `plaintext`
visibility is honest rather than careless — marking them "secret" would imply a protection that does
not exist. See the security note in [SERVER-SETUP.md](SERVER-SETUP.md).

---

## Step 4 — check the fingerprint did not move

```sh
npx --yes eas-cli@23.2.0 fingerprint:generate --platform android --environment production
```

- **`fa84bf12d3c530121ae0f71a302990527a15188c`** → unchanged. An OTA update reaches the installed
  build 5, and no new APK is needed.
- **Anything else** → a new APK is required, because an update whose fingerprint does not match the
  installed build is **silently ignored** on the phone. Build one with
  `npm run build:apk`.

This is worth checking rather than assuming: a single npm script rotated this hash once already.

---

## Step 5 — publish

```sh
npx --yes eas-cli@23.2.0 update --branch production --environment production \
  --platform android --message "server backup on"
```

`--environment production` is required. It is what loads those four variables into the bundle;
without it the app ships with no credentials and quietly reports "not set up".

---

## Step 6 — confirm on the phone

Open the app → **More → Server backup**. It should read **"Already set up"** with **0 entries waiting
to upload**.

If it says something else, the message names the cause. Nothing is at risk either way: entries live
in SQLite on the phone, and a failed upload leaves them queued.

# Server backup — one-time setup

Everything here is done **once, by you, from the laptop**. The clinic phone needs no setup at all:
the credentials are baked into the build, so server backup is on from the first launch.

That is the whole point of this file. A seven-step configuration relayed over WhatsApp to a doctor
on another continent does not happen, and an unconfigured backup protects nobody.

---

## 1. Turn off email confirmation (one toggle)

**Supabase → Authentication → Providers → Email → "Confirm email" → off.**

The app creates its own account on first run. With confirmation on, that account is created but
cannot sign in, because confirming means clicking a link in an inbox nobody will open. The app
detects exactly this case and says so rather than reporting a generic auth failure.

*Alternative, if you would rather leave confirmation on:* **Authentication → Users → Add user**, tick
**Auto Confirm User**, and use the same email and password you set below.

## 2. Create the tables

**Supabase → SQL Editor** → paste all of [`../supabase/schema.sql`](../supabase/schema.sql) → Run.

Regenerate that file after any future migration — never hand-edit it:

```sh
NODE_OPTIONS=--disable-warning=ExperimentalWarning \
  node scripts/supabase-schema.ts > supabase/schema.sql
```

It is generated from the live SQLite schema via `PRAGMA table_info`, because PostgREST rejects an
unknown column with a 400 — so one missed column silently breaks every push of that table, and the
failure looks like a network problem.

## 3. Put the credentials in EAS (not in this repo)

Pick a real email address you control and a long random password. Generate one:

```sh
python3 -c "import secrets,string; a=string.ascii_letters+string.digits; print(''.join(secrets.choice(a) for _ in range(28)))"
```

Then set all four. **Store the password in your password manager first** — EAS will not show it
again, and it is the only way into the clinic's server data:

```sh
E="npx --yes eas-cli@23.2.0 env:create --scope project --environment production --visibility plaintext --non-interactive"

$E --name EXPO_PUBLIC_SYNC_URL      --value "https://YOURPROJECT.supabase.co"
$E --name EXPO_PUBLIC_SYNC_KEY      --value "sb_publishable_..."
$E --name EXPO_PUBLIC_SYNC_EMAIL    --value "you@example.com"
$E --name EXPO_PUBLIC_SYNC_PASSWORD --value "the-password-you-generated"
```

`--visibility plaintext` is deliberate and not a mistake: `EXPO_PUBLIC_*` values are inlined into the
JavaScript bundle, so marking them "secret" would imply a protection that does not exist. See the
security note below.

Check them:

```sh
npx --yes eas-cli@23.2.0 env:list --environment production
```

## 4. Ship it

```sh
npx --yes eas-cli@23.2.0 update --branch production --environment production \
  --platform android --message "server backup on"
```

`--environment production` is required — it is what loads those variables into the bundle. Without
it the build has no credentials and the app quietly falls back to "not set up".

Confirm the phone is really backing up: **More → Server backup** should read *"Already set up"* with
**0 entries waiting to upload**.

---

## Security note, stated honestly

`EXPO_PUBLIC_*` values are inlined into the bundle. **Anyone who unzips the APK can read the clinic
login**, and could then read and append to this clinic's rows.

What contains the damage:

| Guard | Effect |
| --- | --- |
| Row-level security (`owner = auth.uid()`) | A leak reaches only this clinic's data, nothing else in the project |
| No `UPDATE` or `DELETE` policy on `stock_movements` | A leaked credential **cannot erase history** — only read and append |
| Distribution is a private link, not a public store | The APK is not sitting somewhere to be scraped |

The trade was made deliberately: the real risk to this clinic is a lost or broken phone, not a
targeted attacker, and a backup that runs unattended beats a stricter one that is never switched on.

**If it ever leaks:** change the Supabase password, update `EXPO_PUBLIC_SYNC_PASSWORD`, and publish
an update. The phone picks up the new password on next launch and the old one stops working. Nothing
is lost, because the phone — not the server — is the source of truth.

**If you would rather not embed anything:** leave the four variables unset. The app then reads as
"not set up", and the Server backup screen accepts the details typed in by hand. Everything still
works; it just needs those seven steps performed on the phone.

## This does not replace the backup file

Keep taking the zip backups. A file the clinician holds herself is the only copy that does not depend
on an account still working, a card not expiring, or a free tier not changing.

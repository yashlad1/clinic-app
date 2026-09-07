# Release & Distribution

How to get the app onto the doctor's phone in India, from a laptop in the USA, with **no QR code and
no laptop running as a server**.

---

## The short version

`npm start` + Expo Go is a **development** loop: it needs your Mac awake, on the same task, and the
phone talking to your Metro server. That is fine for you and useless for her.

**EAS Build produces a real, standalone APK.** It is built in Expo's cloud, downloaded from a link,
installed once, and then runs entirely offline forever. No laptop, no QR, no server, no internet
needed to use it. That is what she gets.

**EAS Update then lets you fix things from the USA without touching the APK.** You push a JavaScript
update; the next time she opens the app it picks it up. Her data is untouched.

---

## One-time setup

You are signed up at expo.dev already. Log in and initialise:

```sh
npx eas login          # interactive — only you can do this
npm run eas:setup      # eas init && eas update:configure
```

`eas init` writes `extra.eas.projectId` into `app.json`; `eas update:configure` writes `updates.url`.
Commit both.

## Build the APK

```sh
npm run build:apk      # eas build --platform android --profile production
```

Takes roughly 10–20 minutes on the free tier (shared queue). It ends with a URL like
`https://expo.dev/artifacts/eas/….apk`.

The production profile deliberately builds an **APK, not an AAB**, because this app is sideloaded and
will never go through the Play Store.

## Then, immediately — archive the keystore

```sh
npm run keystore       # eas credentials  →  Android → download the keystore
```

**Do this on day one and store the keystore file and its password somewhere you will still have in
three years** (password manager, not just a laptop folder).

Why this matters more than anything else here: **an APK can only be upgraded in place if the new one
is signed with the same key.** If that keystore is lost or rotated, the only way to install a new
version is to uninstall the old one first — **and uninstalling deletes the clinic's entire database.**

Related, same reason: **never change `android.package`** (`in.clinicstock.app`).

## Send it to her

Send the artifact URL over WhatsApp. On her phone:

1. Tap the link, let Chrome download the `.apk`.
2. Android will ask to allow installs from this source — allow it once.
3. Tap the downloaded file → Install.
4. Open it. The vaccine catalog is already there.

**First thing to do together, before she relies on it:** open the **Vaccines** tab and check
*doses per vial* against what is actually in her fridge. Pack sizes vary by manufacturer, and a wrong
number there multiplies into every stock count for that vaccine.

Second thing: take one backup and confirm the file arrives on her phone, so you both know the
recovery path works before it is ever needed.

## Shipping a fix later (the part that solves the distance)

For anything that is JavaScript — screens, logic, wording, even new database migrations, since those
are just JS and SQL strings:

```sh
npm run ota -- "fixed the low-stock warning"
```

She reopens the app and has it. No reinstall, no new APK, no involvement from her.

You only need a **new APK** when native code changes — adding a native module, or upgrading the Expo
SDK. Those are rare.

**Always have her take a backup before an update.** It costs one tap and removes the only scenario
where an update could cost data.

## What the app talks to

Nothing, except the Expo update check. All clinical data stays in the app's private storage on that
phone. This is stated on the Settings screen, and it is worth telling her plainly, because "does this
send my patients' details somewhere" is a fair question.

## Free-tier limits

The free EAS plan gives a limited number of Android builds per month on a shared queue. Since native
builds are rare and OTA updates are unlimited in practice, this is unlikely to bind. If it does,
`npm run build:preview` uses the same APK output on the `preview` channel for testing.

---

## Quick reference

| Task | Command |
| --- | --- |
| Develop, on your phone | `npm start` (Expo Go, needs your Mac) |
| Build the standalone APK | `npm run build:apk` |
| Archive / inspect the keystore | `npm run keystore` |
| Ship a JS-only fix to India | `npm run ota -- "what changed"` |
| Install over an existing copy by USB | `adb install -r clinic-stock.apk` |
| Run the tests | `npm test` |

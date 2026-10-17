# Doll knit Pattern Studio

Graded knitting patterns for BJD dolls — hand and machine knitting — generated from your doll's
measurements and your gauge. Personal use, fully offline, no AI at runtime: all pattern maths runs
on the device. Sibling of Doll crochet Pattern Studio (dolls move between the two apps).

## Get the APK (built on GitHub)

1. Create a new **private** repository on GitHub (e.g. `doll-knit`).
2. Push this folder to it:
   ```bash
   git remote add origin https://github.com/<you>/doll-knit.git
   git push -u origin main
   ```
3. Open the repository's **Actions** tab. *Build Android APK* starts on its own and takes about
   5–8 minutes (run it again any time from Actions → Build Android APK → *Run workflow*).
4. When it's green, open **Releases** on your tablet, download `doll-knit-1.0.N.apk` and open it.
   The first time, Android asks you to allow installing apps from your browser or Files app.

Every push to `main` builds a new release, signed with the same key (`signing/debug.keystore`), so a
new APK installs over the old one and your data stays. Keep the repository private, or replace the
key with a `KEYSTORE_BASE64` repository secret (store/key password `android`, alias `androiddebugkey`).

### Moving your data from the browser version

The APK has its own storage. In the old browser version tap **⬇ Backup all data**, copy the file to
the tablet, then in the APK open ⚙ → **Restore from backup**. Old backups are fully supported.

## The app

| Tab | What it does |
| --- | --- |
| **Dolls** | Photo cards with each doll's key measurements, how complete the profile is, and which garments it's ready for. Tap a doll for the full measurement sheet; *Edit* opens a grouped form (Body, Arms, Length landmarks, Legs & feet, Head & neck). *Import* reads Doll crochet / Doll sewing backups or doll files; *Export* writes a doll file the other apps can import. |
| **Gauge & Yarn** | Hand and machine gauges (sts/rows per 10 cm, tension, yardage). |
| **Build Pattern** | 16 garment types with all their style options. Every pattern starts with a **technical drawing** — front and back flats to scale, with the finished bust/hem/length/sleeve measurements, the stitch texture, ribbing, collar, closures and pockets. Tap it to enlarge. |
| **Saved** | Saved patterns and collections; view, duplicate & tweak for another doll, notes, adjustments. |
| **Custom Grade** | Scale the numbers of your own pattern to another doll and gauge. |

⚙ holds **Backup & restore**. A backup is one JSON file with everything, doll photos included, and
any size works: the APK writes it to disk in small pieces, then offers the Android share sheet
(Drive, Files, email…) or saves it straight into *Documents/Doll knit*.

## Developing

```bash
npm install
npm run vendor   # copies the fonts into www/vendor (needed once after install)
npm run serve    # http://localhost:5179
npm test         # generates every garment with every option for several dolls and gauges (~10 min)
node tests/app.test.mjs --quick   # shorter run
```

Plain HTML/CSS/JS in `www/`, no build step: `js/app.js` (pattern engine, Gauge/Build/Saved/Grade
tabs), `js/dolls.js` (Dolls tab), `js/drawing.js` (technical drawings), `js/backup.js` (backup,
restore, settings), `js/platform.js` (IndexedDB storage, photos, dialogs, chunked file saving).
The Android project is generated fresh by the workflow (`npx cap add android`), so it isn't
committed. When hosting the PWA version, bump `CACHE_NAME` in `www/sw.js` whenever files change.

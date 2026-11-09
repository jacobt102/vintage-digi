# iPhone setup: SideStore + EAS Update

One-time setup to get Vintage Digi on your iPhone so that:

- **JS changes** (shader, UI, capture logic) reach the phone over the air when you push to `main`.
- **Native changes** build automatically on GitHub and appear as an update in SideStore.
- **The weekly re-sign** is a tap in SideStore, with no computer.

It's free: a free Apple ID, a free Expo account, and a public GitHub repo. You need the Windows
PC **once**, in Part D, and again only if SideStore's pairing breaks (see Troubleshooting).

Parts A–C can be done from a phone browser. Allow about an hour in total, most of it waiting
for the first build.

---

## Part A — Expo account and project (5 min)

1. Go to **https://expo.dev/signup** and create a free account.
2. Create the project: **Projects → Create a project**.
   - **Display name:** `Vintage Digi`
   - **Slug:** `vintage-digi`. This must match `slug` in `app.json` exactly, or publishing
     fails with a "slug does not match" error.
3. Open the new project. Copy its **Project ID** (a UUID like
   `1a2b3c4d-…`) from the project overview page. You'll need it in step 6.
4. Create a token: click your avatar → **Account settings → Access tokens → Create token**.
   Name it `github-actions` and copy it now, because it's only shown once. You'll need it in
   step 7.

## Part B — GitHub repository settings (5 min)

On **github.com/jacobt102/vintage-digi**:

5. Keep the repo **public** (Settings → General → Danger Zone shows the visibility).
   SideStore downloads the builds anonymously, and macOS build minutes are free only on
   public repos.
6. **Settings → Secrets and variables → Actions → Variables tab → New repository
   variable**
   - Name: `EAS_PROJECT_ID`
   - Value: the Project ID from step 3
7. Same page, **Secrets tab → New repository secret**
   - Name: `EXPO_TOKEN`
   - Value: the token from step 4

   The project ID is a *variable*: it isn't secret and the build reads it. The token is a
   *secret*. Don't swap them.

## Part C — Merge and make the first build (~30 min, mostly waiting)

8. Open a pull request from `claude/ios-distribution-no-manual-builds-k09nha` into `main`
   and **merge** it. GitHub only shows workflows that exist on `main`.
9. Merging runs **Actions → OTA Update**. There's no iOS build yet, so it publishes the first
   update and then **starts "iOS Build (SideStore)" automatically**. If it doesn't start, run
   it yourself: **Actions → iOS Build (SideStore) → Run workflow**.
10. Wait for the iOS build to go green (about 20–30 min). Then check **Releases**. There
    should be `ios-build-N` with three files: `VintageDigi.ipa`, `source.json` and
    `runtime-version.txt`.
    - If the build shows the warning *"EAS_PROJECT_ID repository variable is not set"*,
      step 6 is missing. Fix it and run the build again; a build without it never gets
      over-the-air updates.

## Part D — Install SideStore (one time, needs the Windows PC, ~20 min)

You need: an iPhone with a passcode, on Wi-Fi; a 64-bit Windows PC (not Windows-on-Arm);
a USB cable; and an Apple ID. A free one is fine, and it doesn't have to be the one on the
phone. **The email is case-sensitive.**

**On the iPhone:**

11. Install **LocalDevVPN** from the App Store
    (https://apps.apple.com/app/localdevvpn/id6755608044). Open it, tap **Connect**, and
    allow the VPN configuration.

**On the PC:**

12. Install **iTunes** using Apple's own installer (https://www.apple.com/itunes/download/win64),
    *not* the Microsoft Store version. If it gives you trouble, the Apple Devices app also
    works.
13. Download and install **iloader**:
    https://github.com/nab138/iloader/releases/latest/download/iloader-windows-x64.msi
    (Only download it from GitHub or iloader.app.)
14. Plug the iPhone in by USB. On the phone, tap **Trust** and enter your passcode.
15. Open iloader, sign in with your Apple ID, select your iPhone and click
    **Install SideStore (Stable)**. iloader also installs the pairing file, so there's no
    separate step for it.

**Back on the iPhone:**

16. **Settings → General → VPN & Device Management →** your Apple ID under *Developer App* →
    **Trust**.
17. **Settings → Privacy & Security → Developer Mode → On**. The phone restarts; confirm when
    it comes back. iOS 16+ needs this.
18. Open **LocalDevVPN → Connect**.
19. Open **SideStore** and sign in with the **same Apple ID** you used in iloader.
20. In **My Apps**, tap the **7 DAYS** counter next to SideStore to refresh it. Accept if it
    asks about the certificate. It may briefly drop to the Home Screen and come back.
    **Do this before installing anything else.**

You can unplug the PC now. You won't need it again unless the pairing breaks.

## Part E — Add the source and install Vintage Digi (5 min)

21. Make sure **LocalDevVPN is connected** and you're on **Wi-Fi**. SideStore needs both for
    every install, update and refresh.
22. SideStore → **Sources** tab → **+** → paste:

    ```
    https://github.com/jacobt102/vintage-digi/releases/latest/download/source.json
    ```

    Confirm to add it. This link always points at the newest build, so you only add it once.
23. Open the **Vintage Digi** source and tap **Free / Get** to install the app. It's
    signed on the phone with your Apple ID.
24. Open Vintage Digi and allow Camera and Photos access. The overlay's last line reads
    `JS EMBEDDED`, meaning it's running the bundle that shipped inside the build.

## Part F — Check that over-the-air updates work (5 min)

25. Push any small JS change to `main`, e.g. tweak a constant in
    `src/shaders/vintageGrade.sksl.ts`. (Pushes that only change Markdown files don't publish
    an update.)
26. Watch **Actions → OTA Update** go green (a few minutes). Its log prints
    `This commit: <hash>` and `Latest iOS release: <hash>`. They should **match**, which means
    no rebuild was needed.
27. On the phone, open Vintage Digi. If it was already open, switch away for a moment and come
    back. Within a few seconds it reloads, and the overlay shows `JS OTA <id> <date>`.
    - If it doesn't show up straight away, force-quit and reopen the app once more.

That's everything. 🎉

---

## Day to day

| Situation | What to do |
|---|---|
| Changed JS/TS | Push to `main`. The phone updates itself next time you open the app. |
| Added/upgraded a native module, changed native config in `app.json`, bumped the Expo SDK | Push to `main`. OTA Update notices the fingerprint changed and starts a build. ~30 min later, SideStore → **My Apps** → **Update** next to Vintage Digi (VPN on, Wi-Fi). |
| Once a week | LocalDevVPN **Connect** → SideStore → My Apps → **Refresh All**. Background refresh exists but is unreliable, so don't count on it. |
| Want a build right now | Actions → **iOS Build (SideStore)** → Run workflow. |

Free Apple ID limits: 3 active sideloaded apps, and SideStore counts as one (Vintage Digi is the
second). There's also a limit of 10 new App IDs per rolling 7 days; updating Vintage Digi
doesn't use a new one.

## Troubleshooting

- **Vintage Digi won't open / "no longer available".** The 7-day signature lapsed. Connect
  LocalDevVPN and refresh in SideStore. Your photos are in the Photos app and are safe.
- **SideStore error 1414, or installs/refreshes hang.** LocalDevVPN isn't connected, or
  you're not on Wi-Fi.
- **SideStore says the pairing file is invalid** (happens after some iOS updates, and
  sometimes at random). On the PC in iloader: **Delete Stored Pairing** → select the device and
  tap Trust on the phone → **Manage Pairing File** → **Place** next to SideStore.
- **Adding the source shows a decoding error.** No release exists yet (the URL 404s). Finish
  Part C first.
- **"Version mismatch" when installing.** The release's `source.json` and IPA came from
  different runs. Re-run the iOS Build workflow.
- **OTA Update fails at "Check configuration".** `EAS_PROJECT_ID` (variable) or
  `EXPO_TOKEN` (secret) is missing; see Part B.
- **OTA Update fails with a slug mismatch.** The Expo project's slug must be `vintage-digi`.
- **Updates publish but the app stays on `EMBEDDED`.**
  - Compare the two hashes in the OTA Update log. If they differ, the phone needs the new
    native build: install it from SideStore.
  - If they match, force-quit and reopen the app twice. The first launch downloads, and the
    reload applies.
  - The phone needs internet access to reach Expo's server (u.expo.dev).
- **Every push starts a new iOS build.** The fingerprint is changing between runs. Compare
  the "Latest iOS release" and "This commit" hashes across runs and open an issue with the
  OTA Update log.

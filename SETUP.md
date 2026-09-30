# Setting up Suite Nothings

This guide takes us from nothing to both phones sharing one diary. We don't need to write any
code: we copy, paste and click. Menu names are in **bold**, exactly as Google and GitHub show
them. After each step there's a line telling us what we should see, so we always know it worked.

Here's how the pieces fit: our stays live in a Google Sheet, a small script attached to that
Sheet (Apps Script) lets the app read and write it, and the app itself is a website on GitHub
Pages that we add to our home screens.

---

## 0. What you need

- A Google account that will stay active for years. The Sheet, the script and the photos all
  live in it, so use one we won't close.
- A GitHub account (free).
- About 20 minutes.
- Both phones: Nirsh's and Shady's.
- The computer with the Suite Nothings folder on it (only for step 2 and step 6).

---

## 1. Create the Sheet and paste the script

1. In the browser, signed in to the Google account from step 0, go to **sheets.new**. A blank
   spreadsheet opens.
2. Click **Untitled spreadsheet** at the top left and name it `Suite Nothings`.
3. Open **Extensions → Apps Script**. A new tab opens with the script editor and a file called
   `Code.gs`.
4. In `Code.gs`, select all the sample code (`function myFunction() { … }`) and delete it.
5. Open `apps-script/Code.gs` from our repo. On GitHub, click the file, then the **Raw** button,
   and copy everything (Cmd+A, Cmd+C on a Mac; Ctrl+A, Ctrl+C on Windows). On the computer, open
   the file in any text editor and copy all of it.
6. Paste it into the empty `Code.gs` in the editor.
7. On the left, click **Project Settings** (the gear icon) and tick
   **Show "appsscript.json" manifest file in editor**.
8. Click **Editor** (the `< >` icon) on the left. A new file, `appsscript.json`, is now in the
   file list. Open it, delete everything in it, and paste the contents of our
   `apps-script/appsscript.json`.
9. Click **Save** (the disk icon) at the top.

**You should see:** two files in the list, `Code.gs` and `appsscript.json`, with no red error
bar at the top after saving.

---

## 2. Add the letter file (private)

This step puts a private letter into the Sheet. The letter never goes to GitHub, on purpose: it
lives only in the `private/` folder on our computer, which git ignores.

1. On the computer with the repo, open Terminal in the Suite Nothings folder and run:
   ```
   npm run letter:gs
   ```
2. It writes a file called `private/Letter.gs`. Open it in a text editor and copy everything.
3. Back in the Apps Script editor, click **+** next to **Files** (Add a file) → **Script**.
4. Name it `Letter` (the editor adds `.gs` itself) and press Enter.
5. Delete the sample code in the new file and paste what we copied.
6. Click **Save** (the disk icon).

`setup()` in the next step adds the letter to the **Letters** tab once. Running `setup()` again
later is safe: it won't add it a second time.

If we skip this step, everything still works. The letter just won't be in the Sheet.

**You should see:** three files in the list: `Code.gs`, `Letter.gs` and `appsscript.json`.

---

## 3. Run `setup()`

`setup()` builds everything the app needs inside the Sheet and in Drive. It's safe to run again
at any time; it never deletes anything.

1. Open `Code.gs`. In the toolbar at the top, pick `setup` in the function dropdown (next to
   **Debug**).
2. Click **Run**.
3. A box says **Authorization required**. Click **Review permissions**.
4. Pick the Google account from step 0.
5. Google shows "Google hasn't verified this app". That's expected: it's our own script, written
   for us, and nobody else runs it. Click **Advanced**, then
   **Go to Suite Nothings (unsafe)**. (If the project still has its default name, this reads
   **Go to Untitled project (unsafe)**, which is fine too.)
6. Read the list and click **Allow**. The script asks to manage our spreadsheets, our Drive files
   and to connect to outside services, because it reads and writes the Sheet, stores photos in
   Drive and answers the app.
7. Switch to the browser tab with the Sheet. A box titled **Choose our passphrase** is waiting.
   Type a passphrase we'll both remember (a short sentence works well) and click **OK**.
   Write it down somewhere safe: both phones need it.

**You should see:**
- New tabs along the bottom of the Sheet: **Hotels**, **Visits**, **Photos**, **Wishlist**,
  **Letters**, **Settings** and **Log**, each with a bold header row that stays put when we
  scroll.
- A new folder called **Suite Nothings photos** in Google Drive.
- In the editor, the **Execution log** at the bottom ends with `setup finished`.

**If no passphrase box appeared** (this happens when the script was opened on its own, not from
the Sheet): in the editor go to **Project Settings** (gear) → scroll to **Script properties** →
**Add script property**. Property: `APP_KEY`. Value: our passphrase. Click
**Save script properties**.

---

## 4. Run `selfTest()`

This checks that the script can write to the Sheet, read it back and clean up after itself.

1. Pick `selfTest` in the function dropdown.
2. Click **Run**.

**You should see:** the **Execution log** ends with `selfTest passed`. The test rows are
removed again; a few new lines in the **Log** tab are normal.

---

## 5. Deploy the script as a web app

This gives the script a web address (a link) that the phones talk to.

1. In the editor, top right: **Deploy → New deployment**.
2. Next to **Select type**, click the gear and choose **Web app**.
3. Fill in:
   - **Description:** `Suite Nothings`
   - **Execute as:** **Me** (our Google account)
   - **Who has access:** **Anyone**
4. Click **Deploy**. If Google asks to authorise again, repeat step 3.3 to 3.6.
5. Under **Web app**, click **Copy** next to the URL.

"Anyone" sounds scary, but the script refuses every request that doesn't carry our passphrase.
"Anyone" simply lets our phones reach it without signing in to Google.

Keep this link. It looks like `https://script.google.com/macros/s/AKfy…/exec` and it must end in
`/exec`. Don't use the **Test deployments** link that ends in `/dev`: that one only works for
the script's owner, inside their own browser.

**You should see:** a box with a **Deployment ID** and a **Web app** URL ending in `/exec`.
Paste the link into a note for later.

---

## 6. Put the app online (GitHub)

1. On github.com, click **+** (top right) → **New repository**. Name it, for example,
   `suite-nothings`. Choose **Public** (GitHub Pages is free for public repositories; a private
   one needs a paid plan). Don't tick any of the "Initialize" options. Click
   **Create repository**.
2. On the computer, in Terminal in the Suite Nothings folder, push our code (GitHub shows these
   exact lines under "…or push an existing repository from the command line"):
   ```
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```
   The letter and the `private/` folder are never pushed: git ignores them.
3. In the repository on GitHub: **Settings → Pages → Build and deployment → Source:**
   **GitHub Actions**.
4. Open the **Actions** tab. A run called **Deploy to GitHub Pages** starts (or click it and
   **Run workflow** if nothing is running yet). It takes about 3 minutes; wait for the green
   tick.
5. Our site is now at `https://<user>.github.io/<repo>/`, for example
   `https://nirsh.github.io/suite-nothings/`.

**Optional: a default link for new installs.** In the repository: **Settings → Secrets and
variables → Actions → Variables** tab → **New repository variable**. Name: `VITE_API_URL`.
Value: the `/exec` link from step 5. Click **Add variable**, then run the deploy again
(**Actions → Deploy to GitHub Pages → Run workflow**). New installs then start with that link
filled in. Never put the passphrase here: it would end up inside the public website. A link
pasted in the app always wins over this default.

**You should see:** a green tick next to the latest run in **Actions**, and the site opening on
the address above with the intro animation.

---

## 7. Nirsh's phone

1. Open the site address from step 6 in the phone's browser (Chrome on Android, Safari on
   iPhone).
2. After the intro, the app asks **Who's checking in?** Tap **Nirsh**.
3. On **Connect our stays**, under **Or connect with our link**, paste the `/exec` link into
   **Apps Script URL** and type our passphrase into **Passphrase**. Tap **Connect**.
4. It says "Checking our connection…" and then **Connected: {n} stays synced**, with the number
   of stays in the Sheet (0 on a brand-new Sheet).
5. Confirm home base on **Where's home base?** with **That's home**, or tap **Change city**.
6. Install to the home screen:
   - Android: the app offers **Add to home screen**. Or, in Chrome, tap the menu (**⋮**) →
     **Install app** (some phones say **Add to home screen**).
   - iPhone: in Safari tap **Share** (the square with an arrow) → **Add to Home Screen** →
     **Add**.

We can check the connection again at any time in **Us → Settings → Connection → Test
connection**.

**You should see:** "Connected: {n} stays synced", no **Demo** badge, and an **Our Suites** icon
on the home screen.

On iPhone, the home-screen app can keep its own storage, separate from Safari. If the icon opens
without our connection, go to **Us → Settings → Connection** in it and paste the link and
passphrase again.

---

## 8. Shady's phone

1. On Nirsh's phone: **Us → Settings → Connection → Invite Shady**. A QR code appears with
   "Scan to join as Shady".
2. On Shady's phone, open the Camera and point it at the QR code. Tap the link that pops up.
3. The app opens on **You've been invited**. Tap **Join as Shady**. The link and passphrase are
   filled in for her, and she's set as Shady.
4. Install to the home screen, as in step 7.6.

No camera handy? On Nirsh's phone tap **Share link** under the QR code and send it to Shady in
a private chat. Or, on Shady's phone, pick **Shady** on **Who's checking in?** and paste the
link and passphrase by hand, exactly like step 7. The invite link contains our passphrase, so
only ever send it to each other.

**Now the fun part.** Add a stay on one phone (the **+** in the middle of the tab bar). Within
about 20 seconds it appears on the other phone, with a small note like
"Shady just checked in at …".

**You should see:** the same stays on both phones, and new ones arriving on the other phone by
themselves.

---

## 9. Updating the script without changing the link

Sometimes we'll get a newer `Code.gs`. Here's how to update it so the link on both phones keeps
working.

1. In the editor, open `Code.gs`, replace its contents with the new version and click **Save**.
2. **Deploy → Manage deployments**.
3. Select our **Suite Nothings** deployment on the left, then click the pencil (**Edit**).
4. Under **Version**, choose **New version**.
5. Click **Deploy**.
6. Good habit: run `setup()` once more (step 3). It adds any new columns and asks to authorise
   again if the new version needs it.

**Don't use Deploy → New deployment for updates.** That makes a brand-new link, and both phones
would show "Can't reach our Sheet. Paste the new link in Settings." (If it happens anyway,
nothing is lost: paste the new `/exec` link on both phones.)

**You should see:** in **Manage deployments**, the same Web app URL as before, now with a higher
version number.

---

## 10. Everyday changes

### Change home base
In the app: **Us → Settings → Home base → Change**. Both phones pick it up. Don't edit the
`home_base` row in the Settings tab by hand; let the app do it.

**You should see:** the new city under **Home base**, and the map opening there.

### Add a future letter
Letters can stay sealed until a moment arrives. Add one as a new row in the **Letters** tab:

| Column | What to type |
|---|---|
| `letter_id` | Any unique text, for example `LETTER-2027-01` |
| `title` | The title on the envelope |
| `body_md` | The letter itself. For a new line inside the cell, press Ctrl+Enter (Cmd+Enter on a Mac) |
| `from` | Pick from the dropdown: `nirsh` or `shady` |
| `to` | Pick from the dropdown: `nirsh` or `shady` |
| `unlock_rule` | When it opens (see below) |
| `written_at` | The day we wrote it, like `2026-12-19` |
| `created_at` | Leave blank: the script stamps it |
| `read_at` | Leave blank: the app fills it the first time it's opened |

Unlock rules:

| Rule | Opens… | Example |
|---|---|---|
| `always` | straight away | `always` |
| `visits>=N` | once we've logged N stays | `visits>=50` |
| `hotels>=N` | once we've stayed at N different hotels | `hotels>=25` |
| `first_abroad` | after our first stay outside our home country | `first_abroad` |
| `date>=YYYY-MM-DD` | on or after that day | `date>=2027-06-19` (19 Jun 2027) |

**You should see:** within about 20 seconds, the letter in the app's Letters, sealed until its
rule is met.

### Editing the Sheet safely
The Sheet is ours to edit. When we type in a row, the script stamps its `updated_at` column
automatically, so the app picks up the change within about 20 seconds.

Do:
- Fix typos, change names, ratings, notes, dates and anything else inside a row.
- Add our own extra columns, or reorder columns. The app finds columns by their header name.

Don't:
- Rename the headers in row 1.
- Delete or change the ID columns (`hotel_id`, `visit_id`, `photo_id`, `wish_id`,
  `letter_id`).
- Delete rows. To remove a stay, set its `deleted` cell to `TRUE`; the app hides it on
  both phones. Setting it back to `FALSE` brings the stay back.
- Change `server_updated_at`. That's the script's own clock.

**You should see:** our edit on both phones within about 20 seconds. On the phone, **Sync now**
in **Us → Settings → Connection** makes it immediate.

### Backups
- **File → Make a copy** in the Sheet makes a full snapshot. Worth doing now and then, say every
  19 Jun.
- **File → Version history → See version history** shows every earlier version of the Sheet and
  can restore one.
- In the app, **Us → Settings → Download our data** saves everything as JSON and CSV.

Photos live in the **Suite Nothings photos** folder in Drive. Leave that folder where it is.

---

## 11. Troubleshooting

| What we see | Why | What to do |
|---|---|---|
| "Wrong passphrase" | The passphrase on the phone doesn't match the one in the script | Re-enter it in **Us → Settings → Connection** and tap **Test connection**. To look it up: editor → **Project Settings → Script properties → `APP_KEY`** |
| "This isn't an Apps Script web app link" (or "That's not an Apps Script web app link. It should end in /exec.") | We pasted the Sheet's address, the editor's address, or the `/dev` test link | In the editor, **Deploy → Manage deployments**, copy the **Web app** URL ending in `/exec`, and paste that |
| "This link ends in /dev, it only works for its owner." | We copied the test link | Same fix: copy the `/exec` link from **Deploy → Manage deployments** |
| "Can't reach Google right now" | The phone is offline, or Google is having a moment | Wait and try again. Everything we add is saved on the phone and syncs later |
| Banner: "Can't reach our Sheet. Paste the new link in Settings." | A **New deployment** changed the link, or the deployment was archived | Copy the current `/exec` link from **Deploy → Manage deployments** and paste it in **Us → Settings → Connection** on both phones. Nothing is lost: waiting changes sync once the link is in |
| "The passphrase isn't set yet. Run setup() in the Apps Script editor." | `setup()` never finished | Run `setup()` again (step 3) and enter the passphrase |
| "Authorization required" or permission errors after updating the script | The new version needs permissions it didn't have | Run `setup()` once more and allow access again (step 3.3 to 3.6) |
| Photos don't show on the other phone | The **Suite Nothings photos** folder was moved to the trash, or `PHOTOS_FOLDER_ID` in Script properties is wrong | Restore the folder from the Drive trash. If it's gone for good, run `setup()` again: it creates a new folder |
| A stay we edited in the Sheet doesn't update in the app | The edit came from an import or a paste from another file, which doesn't trigger the automatic stamp | Type any change in that row again, or clear its `updated_at` cell. Both make the script stamp it |
| "Exceeded maximum execution time" or a quota message | Google's free limits, very rarely reached | Wait a minute and try again |
| The app shows old data after installing | The home-screen app hasn't synced yet | **Us → Settings → Connection → Sync now** |
| The iPhone app is empty after weeks without opening it | iOS can clear a home-screen app's storage after long disuse | Reconnect with the invite link from the other phone (step 8). The Sheet is our backup, so every stay comes back |
| `selfTest` doesn't say "selfTest passed" | `setup()` hasn't run yet, or a tab header was renamed | Run `setup()`, then `selfTest()` again |

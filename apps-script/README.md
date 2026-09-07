# Glebe Heights — Apps Script backend

This folder is the small server that a static GitHub Pages site can't provide on its
own. One **Google Calendar** is the single source of truth; this script:

- serves the calendar to the website as JSON (`doGet?action=feed`),
- receives reservation requests from the website form (`doPost`) and emails an admin
  an **Approve / Decline** link,
- adds a reservation to the calendar only after it's approved,
- emails a **monthly events digest** on the 1st of each month.

## One-time setup (~15 min)

1. **Sign in** to the shared community Google account (e.g. `glebeheights.secretary@gmail.com`).
2. **Create the calendar:** Google Calendar → *+ → Create new calendar* → name it
   **"Glebe Heights Events"** → Create. Then open its **Settings** and:
   - Under *Access permissions*, tick **Make available to public** → *See all event details*.
   - Copy the **Calendar ID** (Integrate calendar → *Calendar ID*, looks like
     `...@group.calendar.google.com`).
3. **Create the script:** go to <https://script.google.com> → *New project*. In the
   left panel, paste the contents of `Code.gs` over the default file, and (via
   *Project Settings → Show "appsscript.json"*) paste `appsscript.json`.
   > Prefer the CLI? `npm i -g @google/clasp`, `clasp login`, then from this folder
   > `clasp create --type webapp` and `clasp push`.
4. **Edit `CONFIG`** at the top of `Code.gs`:
   - `CALENDAR_ID` → the ID you copied.
   - `ADMIN_EMAIL` → who approves requests.
   - `MAILING_LIST` → who gets the monthly email (use a **Google Group** address for
     lists over ~50 people so it counts as one recipient).
   - `APPROVAL_SECRET` → replace with a long random string (or leave the placeholder;
     `setup()` will generate one).
5. **Run `setup()`** (function dropdown → `setup` → Run). Approve the Google
   permission prompts. This creates the "Glebe Heights Reservations" sheet and
   schedules the monthly email. Check *Executions/Logs* for the sheet link.
6. **Deploy:** *Deploy → New deployment → Web app*.
   - **Execute as:** *Me*.
   - **Who has access:** *Anyone*.
   - Deploy, copy the **Web app URL** (ends in `/exec`).
7. **Connect the website:** paste that `/exec` URL into `site-config.js`
   (`webAppUrl`) at the repo root, commit, and push. Done.

## Day-to-day

- **Add an event / meeting:** add it in the *Glebe Heights Events* calendar. Put the
  word *"Meeting"* in the title for it to show as a meeting; anything else shows as an
  event. It appears on the website within a minute.
- **Approve a reservation:** click **Approve** in the notification email (or set the
  row's `Status` to `approved` in the sheet and run `approveOrReject_`… easier to just
  use the email link).
- **Test the monthly email now:** run `sendTestDigest()` — it emails *this* month's
  digest to `ADMIN_EMAIL` only.
- **Change the send day/time:** edit `DIGEST_HOUR` / the `onMonthDay(1)` line in
  `installMonthlyTrigger_()`, then run `installMonthlyTrigger_()` again.

## Notes

- No API key or secret ever lives in the website code. The browser only talks to this
  web app: GET feed responses are CORS-open, and the form POSTs a `text/plain` body to
  avoid a preflight the platform can't answer.
- Resident names are **not** put on the public calendar (reservations show as
  "Reserved"); names/details stay in the private sheet and the admin email.
- Timezone is **America/New_York** (Edgewater, MD). The original brief said
  *America/Toronto* assuming "the Glebe" in Ottawa — same clock, but this is the
  correct label.

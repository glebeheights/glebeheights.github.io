# Glebe Heights Community Association website

The website for the Glebe Heights Community Association in Edgewater, Maryland,
served free from **GitHub Pages** at <https://glebeheights.github.io>.

It's a plain HTML/CSS/JS site (no build step). To preview locally:

```bash
python3 -m http.server 8899
# then open http://localhost:8899
```

---

## Events, calendar & reservations — how it all fits together

GitHub Pages is *static* — it can't receive form submissions, store data, or send
email. So those three features are powered by one small free backend: a **Google
Apps Script** web app tied to a shared **Google Calendar**.

**One Google Calendar ("Glebe Heights Events") is the single source of truth.**

```
                    ┌──────────────────────────┐
   staff add  ───▶  │  Google Calendar          │  ◀── approved reservations
   events           │  "Glebe Heights Events"   │       are added here
                    └────────────┬─────────────┘
                                 │  (Apps Script web app)
                 feed (JSON) ────┼──── monthly email (1st of month)
                                 ▼
                    ┌──────────────────────────┐
                    │  website (index.html)     │
                    │  • month calendar         │  both read the SAME feed,
                    │  • "Upcoming Events" list │  so they can never drift
                    └──────────────────────────┘
```

Because the calendar grid *and* the "Upcoming Events" list both read that one feed,
**an event added once shows up in both places** automatically.

### Files involved
| File | Purpose |
|------|---------|
| `apps-script/Code.gs` | The backend: events feed, reservation intake + approval, monthly email. Runs on Google's servers. |
| `apps-script/appsscript.json` | Apps Script manifest (timezone = `America/New_York`). |
| `apps-script/README.md` | Step-by-step deploy guide. |
| `site-config.js` | Holds the one setting that connects the site to the backend (the web-app URL). Public — no secrets. |
| `events.json` | Fallback event list used only until the backend is connected (or if it's briefly unreachable). |
| `index.html` / `script.js` / `styles.css` | The calendar, Upcoming Events list, and reservation form. |

> **Works before setup:** with `site-config.js` `webAppUrl` empty, the calendar/events
> read `events.json` and the reservation form opens the visitor's email app. Once you
> paste in the web-app URL, everything upgrades to the full backend automatically.

---

## Everyday tasks

### ➕ Add an event (or meeting)
1. Open the **Glebe Heights Events** Google Calendar.
2. Create the event. Put the word **"Meeting"** in the title for it to show as a
   *meeting* (blue); anything else shows as an *event* (green).
3. It appears on the website — calendar **and** Upcoming Events — within ~1 minute.

*(No GitHub or code needed. Non-dated notices like "Volunteer Opportunities" are still
managed as **Announcements** cards via the site's Admin Mode — the little 🔒 in the
footer.)*

### ✅ Approve a reservation
1. A resident submits the **Request a Reservation** form on the site.
2. It's saved to the **Glebe Heights Reservations** Google Sheet as `pending`, and the
   admin gets an email with the details.
3. Click **"Approve & add to calendar"** in that email. Done — it's now on the public
   calendar. Click **"Decline"** to reject it. *Nothing is published until you approve.*

> Resident names are **not** shown on the public calendar (reservations appear as
> "Reserved"). Names and contact details stay in the private Sheet and the admin email.

### ✉️ The monthly events email
- Sent automatically on the **1st of each month at ~8am ET** to the mailing list,
  listing every event that month.
- **Test it now:** in the Apps Script editor, run `sendTestDigest()` — it emails this
  month's digest to the admin only.
- **Change recipients / send time:** edit `MAILING_LIST` / `DIGEST_HOUR` in
  `apps-script/Code.gs`, then run `installMonthlyTrigger_()` again.

---

## 🧑‍🔧 Human setup checklist (one-time — an agent can't do these)

These need a person with the shared Google account and repo access. Full walkthrough
in [`apps-script/README.md`](apps-script/README.md).

- [ ] Sign in to the shared community **Google account** (e.g. `glebeheights.secretary@gmail.com`).
- [ ] Pick the calendar: the account's **primary** calendar (ID = the account email, already preset) or a dedicated **"Glebe Heights Events"** calendar. Public sharing is **optional** (the script reads it as the account).
- [ ] Create the Apps Script project, paste in `Code.gs` + `appsscript.json`, and fill in `CONFIG`
      (`CALENDAR_ID`, `ADMIN_EMAIL`, `MAILING_LIST`, `APPROVAL_SECRET`).
- [ ] Run **`setup()`** once (creates the *Glebe Heights Reservations* sheet + schedules the email).
- [ ] **Deploy** as a Web app (*Execute as: Me*, *Who has access: Anyone*); copy the `/exec` URL.
- [ ] Paste that URL into **`site-config.js`** → `webAppUrl`, commit, and push.
- [ ] Decide the monthly email recipient list — for more than ~50 people, use a **Google Group**
      address so it counts as a single recipient against the daily send quota.
- [ ] *(Optional)* Add the current season's events to the calendar so it isn't empty.

---

## Notes & decisions

- **No secrets in the site.** GitHub Pages is public, so nothing sensitive lives in the
  repo. The browser only ever talks to the Apps Script web app (which runs as the
  Google account); there is **no Google API key** in the client code.
- **Spam protection.** The reservation form has a hidden *honeypot* field plus basic
  server-side rate limiting; required-field validation happens on both sides.
- **Approval required.** Reservations never appear publicly until an admin approves them.
- **Timezone.** Everything uses **`America/New_York`** (Edgewater, MD). *(The original
  task brief said `America/Toronto`, assuming "the Glebe" in Ottawa — same clock and DST,
  but `America/New_York` is the correct label for our community.)*
- **Single source of truth.** The old hard-coded event/meeting/reservation lists were
  removed from `script.js`; the calendar and Upcoming Events now come only from the feed,
  so the two views can't drift apart.
- **Existing Admin Mode is unchanged** — inline content editing, the photo gallery, and
  Announcements cards still publish via the site's GitHub token flow as before.

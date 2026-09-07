/**
 * Glebe Heights Community Association
 * Events + Reservations + Monthly Email — Google Apps Script backend
 * ---------------------------------------------------------------------------
 * ONE Google Calendar ("Glebe Heights Events") is the single source of truth.
 * This Web App is the glue between that calendar and the static GitHub Pages site:
 *
 *   doGet(?action=feed)   -> returns calendar events as JSON for the website
 *                            (calendar grid + "Upcoming Events" list read this).
 *   doGet(?action=approve)-> an admin clicks the link in the notification email;
 *                            the pending reservation is added to the calendar.
 *   doPost                -> the website reservation form posts here; the row is
 *                            saved to the "Reservations" sheet as `pending` and an
 *                            admin notification email is sent. Nothing is published
 *                            to the public calendar until it is approved.
 *   sendMonthlyDigest()   -> time-driven trigger (1st of the month) emails an HTML
 *                            digest of that month's events to the mailing list.
 *
 * WHY THIS AVOIDS EXPOSING ANY SECRET / API KEY IN THE STATIC SITE:
 *   - The site never touches the Google Calendar API. It only calls THIS web app.
 *   - GET requests to a published web app are returned with
 *     `Access-Control-Allow-Origin: *`, so the browser can read the JSON feed.
 *   - The form POSTs with a text/plain body (a CORS "simple request"), which
 *     skips the preflight OPTIONS that Apps Script cannot answer. The JSON is
 *     parsed from e.postData.contents on the server.
 *   - A ?callback= JSONP fallback is also supported for the feed, just in case.
 *
 * SETUP: see apps-script/README.md (or the repo README "Human setup checklist").
 * After editing CONFIG below, run setup() once, then Deploy > New deployment >
 * Web app (Execute as: Me, Who has access: Anyone), and paste the /exec URL into
 * the website's site-config.js.
 */

/*************************  CONFIG — EDIT THESE  *****************************/
var CONFIG = {
  // The Google Calendar that is the single source of truth.
  // Set to the community account's PRIMARY calendar (its Calendar ID is simply the
  // account email). The calendar does NOT need to be public — this script reads it
  // while running as the account. To use a different calendar instead, paste its ID
  // from Calendar Settings > "Integrate calendar" (like "...@group.calendar.google.com").
  CALENDAR_ID: 'glebeheights.secretary@gmail.com',

  // Where reservation requests are logged. Leave blank to have setup() create a
  // spreadsheet named "Glebe Heights Reservations" automatically (recommended).
  RESERVATION_SHEET_ID: '',

  // Who gets the "new reservation request" notification (with approve/reject links).
  ADMIN_EMAIL: 'glebeheights.secretary@gmail.com',

  // Who receives the monthly events email. For lists > ~50 people, use a Google
  // Group address (e.g. glebeheights-residents@googlegroups.com) so it counts as
  // a single recipient against the daily send quota. Comma-separate multiple.
  MAILING_LIST: 'glebe-heights-community-association@googlegroups.com',

  // Display name on outgoing email.
  FROM_NAME: 'Glebe Heights Community Association',

  // Edgewater, Maryland is US Eastern. (The brief said America/Toronto assuming
  // "the Glebe" in Ottawa — same offset & DST, but this is the correct label.)
  TIMEZONE: 'America/New_York',

  // Public website URL (used in emails).
  SITE_URL: 'https://glebeheights.github.io',

  // Signs the approve/reject links so they can't be guessed. Replace with a long
  // random string, OR leave the REPLACE placeholder and setup() will generate and
  // remember one for you.
  APPROVAL_SECRET: 'REPLACE_WITH_A_LONG_RANDOM_STRING',

  // If true, reservation events are shown on the public feed as "Reserved"
  // (no resident names). Names/details stay only in the private sheet + admin
  // email. Recommended true, because the calendar is public.
  MASK_RESERVATION_TITLES: true,

  // Hour of day (0-23, in TIMEZONE) to send the monthly email on the 1st.
  DIGEST_HOUR: 8
};

// Reservable spaces offered on the form (kept here so the notification email can
// show a friendly label). Purely informational for the backend.
var SPACES = ['Entire Beach Area', 'Beach Area', 'Fire Pit', 'Community Dock'];

var SHEET_NAME = 'Reservations';
var HEADERS = ['Timestamp', 'ID', 'Status', 'Name', 'Email', 'Event Title',
  'Date', 'Start Time', 'End Time', 'Space', 'Guests', 'Notes',
  'Approved At', 'Calendar Event ID'];

/***************************  WEB APP ENTRY POINTS  **************************/

function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var action = (p.action || 'feed').toString().toLowerCase();

  if (action === 'approve') return approveOrReject_(p.id, p.token, 'approved');
  if (action === 'reject') return approveOrReject_(p.id, p.token, 'rejected');
  if (action === 'ping') return jsonOutput_({ ok: true, time: new Date().toISOString() }, p.callback);

  try {
    return jsonOutput_({ ok: true, events: buildFeed_(p) }, p.callback);
  } catch (err) {
    return jsonOutput_({ ok: false, error: String(err && err.message || err), events: [] }, p.callback);
  }
}

function doPost(e) {
  var data = {};
  try {
    if (e && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      data = e.parameter;
    }
  } catch (parseErr) {
    return jsonOutput_({ ok: false, error: 'Could not read request.' });
  }

  try {
    return jsonOutput_(handleReservation_(data), data.callback);
  } catch (err) {
    return jsonOutput_({ ok: false, error: String(err && err.message || err) });
  }
}

/*******************************  EVENTS FEED  *******************************/

function buildFeed_(p) {
  var cal = getCalendar_();
  var start = p.start ? new Date(p.start + 'T00:00:00') : monthStart_(-2);
  var end = p.end ? new Date(p.end + 'T23:59:59') : monthStart_(14);

  return cal.getEvents(start, end).map(function (ev) {
    var allDay = ev.isAllDayEvent();
    var s = ev.getStartTime();
    var en = ev.getEndTime();

    var type = (ev.getTag('ghcaType') || '').toLowerCase();
    if (!type) type = /meeting/i.test(ev.getTitle()) ? 'meeting' : 'event';

    var title = ev.getTitle();
    if (type === 'reservation' && CONFIG.MASK_RESERVATION_TITLES) title = 'Reserved';

    var time = allDay ? '' : fmtDate_(s, 'h:mm a');
    var endTime = allDay ? '' : fmtDate_(en, 'h:mm a');

    return {
      id: ev.getId(),
      title: title,
      type: type,                                   // reservation | meeting | event
      allDay: allDay,
      date: fmtDate_(s, 'yyyy-MM-dd'),
      // For all-day events getEndTime() is exclusive midnight; step back 1ms.
      endDate: fmtDate_(allDay ? new Date(en.getTime() - 1) : en, 'yyyy-MM-dd'),
      time: time,
      endTime: endTime,
      timeRange: time ? (time + (endTime ? ' \u2013 ' + endTime : '')) : '',
      location: ev.getLocation() || ''
    };
  });
}

/*****************************  RESERVATIONS  ********************************/

function handleReservation_(data) {
  // Honeypot: bots fill hidden fields. Pretend success, store nothing.
  if ((data.company || data.website || data.hp || '').toString().trim()) {
    return { ok: true, message: 'Thanks! Your request has been received.' };
  }

  var name = (data.name || '').toString().trim();
  var email = (data.email || '').toString().trim();
  var date = (data.date || '').toString().trim();

  if (!name || !email || !date) {
    return { ok: false, error: 'Please include your name, email and a preferred date.' };
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: 'That email address does not look valid.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: 'Please choose a valid date.' };
  }

  // Light per-email rate limit (blunts spam bursts; honeypot is the main guard).
  var cache = CacheService.getScriptCache();
  var rlKey = 'rl_' + email.toLowerCase();
  if (cache.get(rlKey)) {
    return { ok: false, error: 'We just received a request from you — please wait a minute before sending another.' };
  }
  cache.put(rlKey, '1', 60);

  var sheet = getSheet_();
  var id = Utilities.getUuid().replace(/-/g, '').substring(0, 12);
  var token = sign_(id);

  var rec = {
    'Timestamp': new Date(),
    'ID': id,
    'Status': 'pending',
    'Name': name,
    'Email': email,
    'Event Title': (data.title || data.purpose || '').toString().trim(),
    'Date': date,
    'Start Time': (data.startTime || '').toString().trim(),
    'End Time': (data.endTime || '').toString().trim(),
    'Space': (data.space || '').toString().trim(),
    'Guests': (data.guests || '').toString().trim(),
    'Notes': (data.notes || '').toString().trim(),
    'Approved At': '',
    'Calendar Event ID': ''
  };
  sheet.appendRow(HEADERS.map(function (h) { return rec[h]; }));

  try { notifyAdmin_(id, token, rec); } catch (mailErr) { /* don't fail the user if email hiccups */ }

  return {
    ok: true,
    message: 'Thanks, ' + name.split(' ')[0] + '! Your reservation request was sent to the association. ' +
      'You\u2019ll hear back once it\u2019s approved, and it will then appear on the community calendar.'
  };
}

function notifyAdmin_(id, token, rec) {
  var base = webAppUrl_();
  var approveUrl = base + '?action=approve&id=' + encodeURIComponent(id) + '&token=' + encodeURIComponent(token);
  var rejectUrl = base + '?action=reject&id=' + encodeURIComponent(id) + '&token=' + encodeURIComponent(token);

  var when = friendlyDate_(rec['Date']);
  if (rec['Start Time']) when += ', ' + rec['Start Time'] + (rec['End Time'] ? '\u2013' + rec['End Time'] : '');

  var rows = [
    ['Name', rec['Name']],
    ['Email', rec['Email']],
    ['Event', rec['Event Title'] || '(not specified)'],
    ['When', when],
    ['Space', rec['Space'] || '(not specified)'],
    ['Guests', rec['Guests'] || '(not specified)'],
    ['Notes', rec['Notes'] || '(none)']
  ].map(function (r) {
    return '<tr><td style="padding:4px 12px 4px 0;color:#5d6d7e;vertical-align:top">' + r[0] +
      '</td><td style="padding:4px 0"><strong>' + escapeHtml_(String(r[1])) + '</strong></td></tr>';
  }).join('');

  var html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;color:#0e2f44">' +
    '<h2 style="margin:0 0 4px">New beach reservation request</h2>' +
    '<p style="margin:0 0 16px;color:#5d6d7e">Review the details and approve to add it to the community calendar.</p>' +
    '<table style="border-collapse:collapse;margin-bottom:20px">' + rows + '</table>' +
    '<p style="margin:0 0 20px">' +
    '<a href="' + approveUrl + '" style="background:#e67e22;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:bold;margin-right:10px">Approve &amp; add to calendar</a>' +
    '<a href="' + rejectUrl + '" style="background:#f2f4f6;color:#5d6d7e;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:bold">Decline</a>' +
    '</p>' +
    '<p style="font-size:12px;color:#95a5a6;margin:0">Nothing is published until you approve it. Request ID: ' + id + '</p>' +
    '</div>';

  MailApp.sendEmail({
    to: CONFIG.ADMIN_EMAIL,
    replyTo: rec['Email'],
    subject: 'Reservation request: ' + (rec['Event Title'] || 'Beach') + ' \u2014 ' + when,
    htmlBody: html,
    name: CONFIG.FROM_NAME
  });
}

function approveOrReject_(id, token, decision) {
  if (!id || !verifyToken_(id, token)) {
    return htmlPage_('Invalid link', 'This link is invalid or has expired. Open the reservations sheet to action it manually.');
  }
  var sheet = getSheet_();
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var col = indexMap_(headers);

  for (var r = 1; r < values.length; r++) {
    if (String(values[r][col['ID']]) === String(id)) {
      var status = String(values[r][col['Status']]).toLowerCase();
      if (status !== 'pending') {
        return htmlPage_('Already handled', 'This reservation was already <strong>' + status + '</strong>. Nothing changed.');
      }
      var rec = rowToObj_(headers, values[r]);

      if (decision === 'rejected') {
        sheet.getRange(r + 1, col['Status'] + 1).setValue('rejected');
        return htmlPage_('Reservation declined', 'The request from <strong>' + escapeHtml_(rec['Name']) +
          '</strong> was declined and will NOT appear on the calendar.');
      }

      var eventId = createCalendarEventForRow_(rec);
      sheet.getRange(r + 1, col['Status'] + 1).setValue('approved');
      sheet.getRange(r + 1, col['Approved At'] + 1).setValue(new Date());
      sheet.getRange(r + 1, col['Calendar Event ID'] + 1).setValue(eventId);

      return htmlPage_('Reservation approved \u2705',
        '<strong>' + escapeHtml_(rec['Event Title'] || 'Beach reservation') + '</strong> on ' +
        escapeHtml_(friendlyDate_(rec['Date'])) + ' was added to the Glebe Heights calendar. ' +
        'It now shows on the website calendar and Upcoming Events list.');
    }
  }
  return htmlPage_('Not found', 'Could not find a reservation with that ID.');
}

function createCalendarEventForRow_(rec) {
  var cal = getCalendar_();
  var space = rec['Space'] || '';
  var title = 'Beach Reservation' + (space ? ' \u2014 ' + space : '');   // no resident names on the public calendar
  var date = rec['Date'];
  var event;

  if (rec['Start Time'] && rec['End Time']) {
    event = cal.createEvent(title,
      new Date(date + 'T' + padTime_(rec['Start Time']) + ':00'),
      new Date(date + 'T' + padTime_(rec['End Time']) + ':00'));
  } else {
    event = cal.createAllDayEvent(title, new Date(date + 'T00:00:00'));
  }
  event.setTag('ghcaType', 'reservation');
  if (space) event.setLocation(space);
  event.setDescription('Community beach reservation approved via the website. Requester details are in the Reservations sheet.');
  return event.getId();
}

/*****************************  MONTHLY EMAIL  *******************************/

function sendMonthlyDigest() {
  var now = new Date();
  var start = new Date(now.getFullYear(), now.getMonth(), 1);
  var end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  var monthLabel = fmtDate_(start, 'MMMM yyyy');

  var cal = getCalendar_();
  var events = cal.getEvents(start, end).sort(function (a, b) {
    return a.getStartTime() - b.getStartTime();
  });

  MailApp.sendEmail({
    to: CONFIG.MAILING_LIST,
    subject: 'Glebe Heights \u2014 What\u2019s happening in ' + monthLabel,
    htmlBody: buildDigestHtml_(events, monthLabel),
    name: CONFIG.FROM_NAME
  });
}

/** Sends this month's digest to the ADMIN only, for testing. */
function sendTestDigest() {
  var now = new Date();
  var start = new Date(now.getFullYear(), now.getMonth(), 1);
  var end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  var monthLabel = fmtDate_(start, 'MMMM yyyy');
  var events = getCalendar_().getEvents(start, end).sort(function (a, b) { return a.getStartTime() - b.getStartTime(); });
  MailApp.sendEmail({
    to: CONFIG.ADMIN_EMAIL,
    subject: '[TEST] Glebe Heights \u2014 What\u2019s happening in ' + monthLabel,
    htmlBody: buildDigestHtml_(events, monthLabel),
    name: CONFIG.FROM_NAME
  });
}

function buildDigestHtml_(events, monthLabel) {
  var accent = '#e67e22', ink = '#0e2f44', soft = '#5d6d7e';
  var items;

  if (!events.length) {
    items = '<p style="color:' + soft + ';margin:0">No events are on the calendar yet this month. ' +
      'Check <a href="' + CONFIG.SITE_URL + '#reservations" style="color:' + accent + '">the website</a> for updates, ' +
      'and reply to this email to add something!</p>';
  } else {
    items = events.map(function (ev) {
      var allDay = ev.isAllDayEvent();
      var day = fmtDate_(ev.getStartTime(), 'EEE, MMM d');
      var time = allDay ? 'All day' : (fmtDate_(ev.getStartTime(), 'h:mm a') + ' \u2013 ' + fmtDate_(ev.getEndTime(), 'h:mm a'));
      var type = (ev.getTag('ghcaType') || '').toLowerCase();
      if (!type) type = /meeting/i.test(ev.getTitle()) ? 'meeting' : 'event';
      var title = ev.getTitle();
      if (type === 'reservation' && CONFIG.MASK_RESERVATION_TITLES) title = 'Beach reserved';
      var loc = ev.getLocation();
      return '' +
        '<tr>' +
        '<td style="padding:14px 16px;border-bottom:1px solid #e8edf2;white-space:nowrap;vertical-align:top;color:' + accent + ';font-weight:bold">' + day + '</td>' +
        '<td style="padding:14px 16px;border-bottom:1px solid #e8edf2;vertical-align:top">' +
        '<div style="font-weight:bold;color:' + ink + '">' + escapeHtml_(title) + '</div>' +
        '<div style="color:' + soft + ';font-size:13px">' + time + (loc ? ' &middot; ' + escapeHtml_(loc) : '') + '</div>' +
        '</td>' +
        '</tr>';
    }).join('');
    items = '<table style="border-collapse:collapse;width:100%">' + items + '</table>';
  }

  return '' +
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:' + ink + '">' +
    '<div style="background:' + ink + ';color:#fff;padding:24px 20px;border-radius:12px 12px 0 0">' +
    '<div style="font-size:13px;letter-spacing:1px;opacity:.8">GLEBE HEIGHTS COMMUNITY ASSOCIATION</div>' +
    '<div style="font-size:24px;font-weight:bold;margin-top:4px">This Month at the Beach</div>' +
    '<div style="opacity:.85;margin-top:2px">' + monthLabel + '</div>' +
    '</div>' +
    '<div style="border:1px solid #e8edf2;border-top:none;border-radius:0 0 12px 12px;padding:20px">' +
    '<p style="margin:0 0 14px;color:' + soft + '">Here\u2019s what\u2019s coming up in our community this month:</p>' +
    items +
    '<div style="text-align:center;margin-top:22px">' +
    '<a href="' + CONFIG.SITE_URL + '#reservations" style="background:' + accent + ';color:#fff;text-decoration:none;padding:12px 26px;border-radius:8px;font-weight:bold;display:inline-block">View the full calendar</a>' +
    '</div>' +
    '<p style="margin:22px 0 0;font-size:12px;color:#95a5a6;text-align:center">' +
    'You\u2019re receiving this because you\u2019re part of the Glebe Heights community in Edgewater, MD.' +
    '</p>' +
    '</div>' +
    '</div>';
}

/******************************  SETUP / TRIGGERS  ***************************/

/** Run this ONCE after editing CONFIG (Run > setup). Grant permissions when asked. */
function setup() {
  getSecret_();                 // generate & store an approval secret if needed
  var sheet = getSheet_();      // create / prepare the Reservations sheet
  installMonthlyTrigger_();     // schedule the monthly email

  var url = webAppUrl_();
  Logger.log('Setup complete.');
  Logger.log('Reservations sheet: ' + sheet.getParent().getUrl());
  Logger.log('Web app URL (paste into site-config.js AFTER you Deploy): ' + (url || '(deploy the web app first, then re-run to see it)'));
}

function installMonthlyTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendMonthlyDigest') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendMonthlyDigest')
    .timeBased()
    .onMonthDay(1)
    .atHour(CONFIG.DIGEST_HOUR)
    .inTimezone(CONFIG.TIMEZONE)
    .create();
}

/*********************************  HELPERS  *********************************/

function getCalendar_() {
  if (!CONFIG.CALENDAR_ID || CONFIG.CALENDAR_ID.indexOf('REPLACE') === 0) {
    throw new Error('Set CONFIG.CALENDAR_ID to your Google Calendar ID first.');
  }
  var cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  if (!cal) throw new Error('Calendar not found. Check CONFIG.CALENDAR_ID and that this account can see it.');
  return cal;
}

function getSheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = CONFIG.RESERVATION_SHEET_ID || props.getProperty('SHEET_ID');
  var ss;
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create('Glebe Heights Reservations');
    props.setProperty('SHEET_ID', ss.getId());
  }
  var sh = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  sh.setName(SHEET_NAME);
  ensureHeaders_(sh);
  return sh;
}

function ensureHeaders_(sh) {
  var first = sh.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  var hasHeaders = first.join('') && String(first[0]).toLowerCase() === 'timestamp';
  if (!hasHeaders) {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
}

function rowToObj_(headers, row) {
  var o = {};
  headers.forEach(function (h, i) { o[h] = row[i]; });
  return o;
}

function indexMap_(headers) {
  var m = {};
  headers.forEach(function (h, i) { m[h] = i; });
  return m;
}

function monthStart_(offsetMonths) {
  var now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
}

function fmtDate_(d, pattern) {
  return Utilities.formatDate(d, CONFIG.TIMEZONE, pattern);
}

function friendlyDate_(ymd) {
  // ymd is "YYYY-MM-DD"
  try {
    return Utilities.formatDate(new Date(ymd + 'T12:00:00'), CONFIG.TIMEZONE, 'EEEE, MMMM d, yyyy');
  } catch (e) {
    return ymd;
  }
}

function padTime_(t) {
  // Accepts "9:30" or "09:30" -> "09:30"
  var parts = String(t).split(':');
  var h = ('0' + (parts[0] || '0')).slice(-2);
  var m = ('0' + (parts[1] || '0')).slice(-2);
  return h + ':' + m;
}

function getSecret_() {
  if (CONFIG.APPROVAL_SECRET && CONFIG.APPROVAL_SECRET.indexOf('REPLACE') !== 0) return CONFIG.APPROVAL_SECRET;
  var props = PropertiesService.getScriptProperties();
  var s = props.getProperty('APPROVAL_SECRET');
  if (!s) {
    s = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('APPROVAL_SECRET', s);
  }
  return s;
}

function sign_(text) {
  var bytes = Utilities.computeHmacSha256Signature(text, getSecret_());
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

function verifyToken_(id, token) {
  if (!token) return false;
  return sign_(String(id)) === String(token);
}

function webAppUrl_() {
  try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; }
}

function jsonOutput_(obj, callback) {
  var json = JSON.stringify(obj);
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function htmlPage_(title, message) {
  var html =
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + escapeHtml_(title) + '</title></head>' +
    '<body style="font-family:Arial,Helvetica,sans-serif;background:#f5f8fa;margin:0;padding:40px 16px;color:#0e2f44">' +
    '<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;padding:32px;box-shadow:0 10px 30px rgba(0,0,0,.08)">' +
    '<div style="font-size:13px;letter-spacing:1px;color:#95a5a6">GLEBE HEIGHTS COMMUNITY ASSOCIATION</div>' +
    '<h1 style="margin:8px 0 12px;font-size:22px">' + escapeHtml_(title) + '</h1>' +
    '<p style="color:#5d6d7e;line-height:1.5;margin:0 0 20px">' + message + '</p>' +
    '<a href="' + CONFIG.SITE_URL + '" style="color:#e67e22;font-weight:bold;text-decoration:none">\u2190 Back to the website</a>' +
    '</div></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle(title);
}

function escapeHtml_(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* Glebe Heights — homepage behavior
 * -----------------------------------------------------------------------------
 * The calendar AND the "Upcoming Events" list are rendered from a SINGLE source:
 * the events feed served by the Apps Script web app (see apps-script/). If the
 * backend isn't connected yet (site-config.js `webAppUrl` empty) or is briefly
 * unreachable, we fall back to the bundled events.json so the site still works.
 */
function ghcaInitIndex() {
    const CFG = window.GHCA_CONFIG || {};
    const WEB_APP_URL = (CFG.webAppUrl || '').trim();
    const RES_EMAIL = (CFG.reservationEmail || 'glebeheights.secretary@gmail.com').trim();
    const UPCOMING_LIMIT = CFG.upcomingLimit || 6;

    // ---------- helpers ----------
    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function ymd(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    function addDay(ymdStr) {
        const dt = new Date(ymdStr + 'T00:00:00');
        dt.setDate(dt.getDate() + 1);
        return ymd(dt);
    }

    // ---------- events feed (single source of truth) ----------
    function normalizeEvents(list) {
        if (!Array.isArray(list)) return [];
        return list
            .filter(e => e && e.date)
            .map(e => ({
                id: e.id || `${e.type || 'event'}-${e.date}-${e.title || ''}`,
                title: e.title || 'Event',
                type: (e.type || 'event').toLowerCase(),
                allDay: e.allDay !== false,
                date: e.date,
                endDate: e.endDate || e.date,
                time: e.time || '',
                endTime: e.endTime || '',
                timeRange: e.timeRange || (e.time ? (e.time + (e.endTime ? ' \u2013 ' + e.endTime : '')) : ''),
                location: e.location || ''
            }))
            .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
    }

    async function fetchFeed() {
        // 1) live backend feed
        if (WEB_APP_URL) {
            try {
                const sep = WEB_APP_URL.indexOf('?') >= 0 ? '&' : '?';
                const res = await fetch(WEB_APP_URL + sep + 'action=feed', { method: 'GET' });
                if (res.ok) {
                    const data = await res.json();
                    const events = Array.isArray(data) ? data : (data && data.events);
                    if (Array.isArray(events)) return normalizeEvents(events);
                }
            } catch (err) { /* fall through to the bundled seed */ }
        }
        // 2) bundled fallback (keeps the site working before the backend is connected)
        try {
            const res = await fetch('events.json?t=' + Date.now(), { cache: 'no-store' });
            if (res.ok) return normalizeEvents(await res.json());
        } catch (err) { /* ignore */ }
        return [];
    }

    // Expand each (possibly multi-day) event into a per-day lookup for the grid.
    function eventsByDate(events) {
        const map = {};
        events.forEach(ev => {
            let d = ev.date;
            const last = ev.endDate || ev.date;
            let guard = 0;
            while (d <= last && guard < 400) {
                (map[d] = map[d] || []).push(ev);
                d = addDay(d);
                guard++;
            }
        });
        return map;
    }

    // ---------- calendar ----------
    const calDays = document.getElementById('cal-days');
    const calLabel = document.getElementById('cal-month-label');
    const calPrev = document.getElementById('cal-prev');
    const calNext = document.getElementById('cal-next');

    const now = new Date();
    let currentMonth = now.getMonth();
    let currentYear = now.getFullYear();
    let byDate = {};

    const TYPE_CLASS = { reservation: 'cal-reserved', meeting: 'cal-meeting', event: 'cal-event' };
    const NAME_CLASS = { reservation: 'cal-reservation-name', meeting: 'cal-meeting-name', event: 'cal-event-name' };
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    function renderCalendar(month, year) {
        if (!calDays) return;
        calDays.innerHTML = '';
        if (calLabel) calLabel.textContent = `${MONTHS[month]} ${year}`;

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();

        for (let i = 0; i < firstDay; i++) {
            const empty = document.createElement('div');
            empty.className = 'cal-day cal-empty';
            calDays.appendChild(empty);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEvents = byDate[dateStr] || [];
            const isToday = (day === today.getDate() && month === today.getMonth() && year === today.getFullYear());

            const dayEl = document.createElement('div');
            dayEl.className = 'cal-day';
            ['meeting', 'event', 'reservation'].forEach(t => {
                if (dayEvents.some(e => e.type === t)) dayEl.classList.add(TYPE_CLASS[t]);
            });
            if (isToday) dayEl.classList.add('cal-today');

            let html = `<span class="cal-day-num">${day}</span>`;
            dayEvents.slice(0, 2).forEach(ev => {
                const cls = NAME_CLASS[ev.type] || 'cal-event-name';
                html += `<span class="${cls}">${escapeHtml(ev.title)}</span>`;
            });
            if (dayEvents.length > 2) {
                html += `<span class="cal-more">+${dayEvents.length - 2} more</span>`;
            }
            dayEl.innerHTML = html;

            if (dayEvents.length) {
                dayEl.classList.add('cal-has-events');
                dayEl.setAttribute('title', dayEvents
                    .map(e => e.title + (e.timeRange ? ' (' + e.timeRange + ')' : ''))
                    .join('\n'));
            }
            calDays.appendChild(dayEl);
        }
    }

    if (calPrev) calPrev.addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        renderCalendar(currentMonth, currentYear);
    });
    if (calNext) calNext.addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        renderCalendar(currentMonth, currentYear);
    });

    // ---------- Upcoming Events list (same feed as the calendar) ----------
    const TYPE_LABEL = { reservation: 'Reserved', meeting: 'Meeting', event: 'Event' };

    function renderUpcoming(events) {
        const list = document.getElementById('events-feed-list');
        if (!list) return;

        const todayStr = ymd(new Date());
        const upcoming = events
            .filter(e => (e.endDate || e.date) >= todayStr)
            .slice(0, UPCOMING_LIMIT);

        if (!upcoming.length) {
            list.innerHTML = '<p class="events-feed-empty">No upcoming events are scheduled yet \u2014 check back soon!</p>';
            return;
        }

        list.innerHTML = upcoming.map(ev => {
            const d = new Date(ev.date + 'T00:00:00');
            const mon = d.toLocaleDateString('en-US', { month: 'short' });
            const dayNum = d.getDate();
            const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
            const when = ev.timeRange ? ev.timeRange : (ev.allDay ? 'All day' : '');
            const metaBits = [weekday];
            if (when) metaBits.push(escapeHtml(when));
            if (ev.location) metaBits.push(escapeHtml(ev.location));
            return `
                <article class="event-feed-card event-type-${ev.type}">
                    <div class="event-feed-date">
                        <span class="event-feed-mon">${mon}</span>
                        <span class="event-feed-day">${dayNum}</span>
                    </div>
                    <div class="event-feed-body">
                        <span class="event-feed-badge event-badge-${ev.type}">${TYPE_LABEL[ev.type] || 'Event'}</span>
                        <h4 class="event-feed-name">${escapeHtml(ev.title)}</h4>
                        <p class="event-feed-meta">${metaBits.join(' &middot; ')}</p>
                    </div>
                </article>`;
        }).join('');
    }

    // ---------- paint the calendar grid immediately, then fill in events ----------
    // Render right away so the month grid never sits blank while the (sometimes slow,
    // cold-starting) Google feed loads; re-render once events arrive.
    renderCalendar(currentMonth, currentYear);
    fetchFeed().then(events => {
        byDate = eventsByDate(events);
        renderCalendar(currentMonth, currentYear);
        renderUpcoming(events);
    });

    // ---------- header / mobile nav ----------
    const header = document.getElementById('header');
    const nav = document.getElementById('nav');
    const toggle = document.getElementById('mobile-toggle');

    if (toggle && nav) {
        toggle.addEventListener('click', () => {
            nav.classList.toggle('active');
            toggle.classList.toggle('active');
        });
        nav.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                nav.classList.remove('active');
                toggle.classList.remove('active');
            });
        });
    }

    if (header) {
        window.addEventListener('scroll', () => {
            header.classList.toggle('scrolled', window.pageYOffset > 50);
        });
    }

    // ---------- scroll-in animations ----------
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.amenity-card, .event-card, .update-card, .contact-card, .highlight-card, .collage-grid-img').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    const style = document.createElement('style');
    style.textContent = `
        .animate-in { opacity: 1 !important; transform: translateY(0) !important; }
        .lightbox { position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 9999; display: flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0; transition: opacity 0.3s ease; }
        .lightbox.active { opacity: 1; }
        .lightbox img { max-width: 90vw; max-height: 90vh; object-fit: contain; border-radius: 8px; box-shadow: 0 0 40px rgba(0,0,0,0.5); }
    `;
    document.head.appendChild(style);

    // ---------- announcements filter ----------
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.dataset.filter;
            document.querySelectorAll('.update-card').forEach(card => {
                if (filter === 'all' || card.dataset.category === filter) {
                    card.classList.remove('hidden');
                } else {
                    card.classList.add('hidden');
                }
            });
        });
    });

    // ---------- reservation request form ----------
    const reservationForm = document.getElementById('reservation-form');
    if (reservationForm) {
        const statusEl = document.getElementById('reservation-status');
        const submitBtn = reservationForm.querySelector('button[type="submit"]');

        function showStatus(type, msg) {
            if (!statusEl) return;
            statusEl.hidden = false;
            statusEl.className = 'form-status ' + type;
            statusEl.textContent = msg;
        }
        function setSubmitting(on) {
            if (!submitBtn) return;
            submitBtn.disabled = on;
            submitBtn.textContent = on ? 'Sending\u2026' : 'Send Reservation Request';
        }
        function submitViaEmail(p, prefixMsg) {
            const dateObj = new Date(p.date + 'T00:00:00');
            const formattedDate = dateObj.toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });
            const subject = `Beach Reservation Request - ${formattedDate} - ${p.name}`;
            let body = `Hi,\n\nI would like to request a reservation for the community beach.\n\n`;
            body += `Name: ${p.name}\n`;
            body += `Email: ${p.email}\n`;
            body += `Preferred Date: ${formattedDate}\n`;
            if (p.space) body += `Space/Area: ${p.space}\n`;
            if (p.startTime) body += `Start Time: ${p.startTime}\n`;
            if (p.endTime) body += `End Time: ${p.endTime}\n`;
            if (p.title) body += `Event Title: ${p.title}\n`;
            if (p.guests) body += `Expected Guests: ${p.guests}\n`;
            if (p.notes) body += `Additional Notes: ${p.notes}\n`;
            body += `\nThank you!`;
            window.location.href = `mailto:${RES_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            showStatus('success', (prefixMsg ? prefixMsg + ' ' : '') +
                'Your email client should now open with the reservation details. If it didn\u2019t open, please email ' + RES_EMAIL + ' directly.');
        }

        reservationForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('res-name');
            const email = document.getElementById('res-email');
            const date = document.getElementById('res-date');
            const space = document.getElementById('res-space');
            const start = document.getElementById('res-start');
            const end = document.getElementById('res-end');
            const title = document.getElementById('res-title');
            const guests = document.getElementById('res-guests');
            const notes = document.getElementById('res-notes');
            const honeypot = document.getElementById('res-company');

            [name, email, date].forEach(el => el.classList.remove('invalid'));
            let valid = true;
            if (!name.value.trim()) { name.classList.add('invalid'); valid = false; }
            if (!email.value.trim() || !email.validity.valid) { email.classList.add('invalid'); valid = false; }
            if (!date.value) { date.classList.add('invalid'); valid = false; }
            if (!valid) { showStatus('error', 'Please fill in all required fields.'); return; }

            // Honeypot: real people never fill this. If filled, act successful, do nothing.
            if (honeypot && honeypot.value.trim()) {
                showStatus('success', 'Thank you! Your request has been received.');
                reservationForm.reset();
                return;
            }

            const payload = {
                name: name.value.trim(),
                email: email.value.trim(),
                date: date.value,
                space: space ? space.value : '',
                startTime: start ? start.value : '',
                endTime: end ? end.value : '',
                title: title ? title.value.trim() : '',
                guests: guests ? guests.value : '',
                notes: notes ? notes.value.trim() : '',
                company: ''
            };

            // Backend not connected yet -> open the visitor's email client.
            if (!WEB_APP_URL) { submitViaEmail(payload); return; }

            setSubmitting(true);
            try {
                // A text/plain body is a CORS "simple request", so the browser skips the
                // preflight OPTIONS that Apps Script web apps cannot answer.
                const res = await fetch(WEB_APP_URL, { method: 'POST', body: JSON.stringify(payload) });
                const data = await res.json().catch(() => ({}));
                if (res.ok && data && data.ok) {
                    showStatus('success', data.message ||
                        'Thanks! Your reservation request was sent. You\u2019ll hear back once it\u2019s approved.');
                    reservationForm.reset();
                } else {
                    showStatus('error', (data && data.error) ||
                        ('Sorry, something went wrong. Please email ' + RES_EMAIL + '.'));
                }
            } catch (err) {
                // Network failure -> graceful email fallback so the resident isn't stuck.
                submitViaEmail(payload, 'We couldn\u2019t reach the server, so we\u2019ve opened your email app instead.');
            } finally {
                setSubmitting(false);
            }
        });

        reservationForm.querySelectorAll('input, textarea, select').forEach(el => {
            el.addEventListener('input', () => el.classList.remove('invalid'));
        });
    }

    // ---------- lightbox for collage images ----------
    document.querySelectorAll('.collage-grid-img').forEach(img => {
        img.addEventListener('click', () => {
            const lightbox = document.createElement('div');
            lightbox.className = 'lightbox';
            lightbox.innerHTML = `<img src="${img.src}" alt="${img.alt}">`;
            document.body.appendChild(lightbox);
            requestAnimationFrame(() => lightbox.classList.add('active'));
            lightbox.addEventListener('click', () => {
                lightbox.classList.remove('active');
                setTimeout(() => lightbox.remove(), 300);
            });
        });
    });

    // ---------- admin content editing (unchanged) ----------
    if (window.GHCAAdmin && GHCAAdmin.isAdmin()) {
        GHCAAdmin.makeEditable('.about-text', 'about-text');
        GHCAAdmin.makeEditable('.amenity-card', 'amenity');
        GHCAAdmin.makeEditable('.highlight-card', 'highlight');
        GHCAAdmin.makeEditable('.contact-card', 'contact');
        GHCAAdmin.initUpdatesAdmin();
        GHCAAdmin.loadSavedEdits();
    } else if (window.GHCAAdmin) {
        GHCAAdmin.loadSavedEdits();
    }
}

if (window.GHCA_ready) {
    window.GHCA_ready(ghcaInitIndex);
} else {
    document.addEventListener('DOMContentLoaded', ghcaInitIndex);
}

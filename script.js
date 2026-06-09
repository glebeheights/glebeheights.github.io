document.addEventListener('DOMContentLoaded', () => {
    const isAdmin = window.GHCAAdmin && window.GHCAAdmin.isAdmin();

    // Beach Reservation Calendar
    const reservations = [
        { date: '2025-05-24', name: 'Louis Lavezzo' },
        { date: '2025-05-31', name: 'Patrick Bacci' },
        { date: '2025-07-18', name: 'Brian Goodwin' },
        { date: '2025-08-16', name: 'Lavezzo' },
        { date: '2025-09-07', name: 'Davidson' },
        { date: '2025-11-01', name: 'Denaro' },
        { date: '2026-05-02', name: 'Katie Williams' },
        { date: '2026-06-05', name: 'Denaro' },
        { date: '2026-07-25', name: 'Lavezzo' },
    ];

    // Monthly meetings — 2nd Monday, April–October
    const meetings = [
        { date: '2025-04-14', name: 'Monthly Meeting' },
        { date: '2025-05-12', name: 'Monthly Meeting' },
        { date: '2025-06-09', name: 'Monthly Meeting' },
        { date: '2025-07-14', name: 'Monthly Meeting' },
        { date: '2025-08-11', name: 'Monthly Meeting' },
        { date: '2025-09-08', name: 'Monthly Meeting' },
        { date: '2025-10-13', name: 'Monthly Meeting' },
        { date: '2026-04-13', name: 'Monthly Meeting' },
        { date: '2026-05-11', name: 'Monthly Meeting' },
        { date: '2026-06-08', name: 'Monthly Meeting' },
        { date: '2026-07-13', name: 'Monthly Meeting' },
        { date: '2026-08-10', name: 'Monthly Meeting' },
        { date: '2026-09-14', name: 'Monthly Meeting' },
        { date: '2026-10-12', name: 'Monthly Meeting' },
    ];

    // Special community events
    const events = [
        { date: '2025-04-05', name: 'Spring Cleanup' },
        { date: '2025-11-01', name: 'Fall Closeup' },
        { date: '2026-04-04', name: 'Spring Cleanup' },
        { date: '2026-06-12', name: 'Work Party 5:30PM' },
        { date: '2026-07-05', name: 'Independence Day Party 2PM' },
        { date: '2026-11-07', name: 'Fall Closeup' },
    ];

    const calDays = document.getElementById('cal-days');
    const calLabel = document.getElementById('cal-month-label');
    const calPrev = document.getElementById('cal-prev');
    const calNext = document.getElementById('cal-next');

    if (calDays) {
        let currentDate = new Date();
        let currentMonth = currentDate.getMonth();
        let currentYear = currentDate.getFullYear();

        function getAdminReservations() {
            if (window.GHCAAdmin && window.GHCAAdmin.getAdminReservations) {
                return window.GHCAAdmin.getAdminReservations();
            }
            return [];
        }

        function renderCalendar(month, year) {
            calDays.innerHTML = '';
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
            calLabel.textContent = `${monthNames[month]} ${year}`;

            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const today = new Date();
            const adminRes = getAdminReservations();

            for (let i = 0; i < firstDay; i++) {
                const empty = document.createElement('div');
                empty.className = 'cal-day cal-empty';
                calDays.appendChild(empty);
            }

            const isMemberLoggedIn = !!localStorage.getItem('ghca_member_email');

            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const reservation = reservations.find(r => r.date === dateStr);
                const meeting = meetings.find(m => m.date === dateStr);
                const event = events.find(e => e.date === dateStr);
                const adminReservation = adminRes.find(r => r.date === dateStr);
                const isToday = (day === today.getDate() && month === today.getMonth() && year === today.getFullYear());

                const dayEl = document.createElement('div');
                dayEl.className = 'cal-day';
                if (adminReservation) dayEl.classList.add('cal-admin-reserved');
                else if (reservation) dayEl.classList.add('cal-reserved');
                if (meeting && !adminReservation) dayEl.classList.add('cal-meeting');
                if (event && !adminReservation) dayEl.classList.add('cal-event');
                if (isToday) dayEl.classList.add('cal-today');

                dayEl.innerHTML = `<span class="cal-day-num">${day}</span>`;
                if (adminReservation) {
                    dayEl.innerHTML += `<span class="cal-admin-name">${isMemberLoggedIn ? adminReservation.name : 'Reserved'}</span>`;
                } else if (reservation) {
                    dayEl.innerHTML += `<span class="cal-reservation-name">${isMemberLoggedIn ? reservation.name : 'Reserved'}</span>`;
                } else if (meeting) {
                    dayEl.innerHTML += `<span class="cal-meeting-name">${meeting.name}</span>`;
                } else if (event) {
                    dayEl.innerHTML += `<span class="cal-event-name">${event.name}</span>`;
                }

                if (isAdmin) {
                    dayEl.addEventListener('click', function() {
                        handleCalendarDayClick(dateStr, adminReservation, reservation);
                    });
                }

                calDays.appendChild(dayEl);
            }
        }

        function handleCalendarDayClick(dateStr, adminReservation, existingReservation) {
            if (adminReservation) {
                if (confirm(`Remove admin reservation "${adminReservation.name}" on ${dateStr}?`)) {
                    GHCAAdmin.removeAdminReservation(dateStr);
                    renderCalendar(currentMonth, currentYear);
                    GHCAAdmin.showNotification('Reservation removed', 'success');
                }
            } else if (!existingReservation) {
                const name = prompt('Add reservation — enter name:');
                if (name && name.trim()) {
                    GHCAAdmin.addAdminReservation(dateStr, name.trim());
                    renderCalendar(currentMonth, currentYear);
                    GHCAAdmin.showNotification('Reservation added', 'success');
                }
            } else {
                alert(`This date already has a reservation: ${existingReservation.name}`);
            }
        }

        calPrev.addEventListener('click', () => {
            currentMonth--;
            if (currentMonth < 0) { currentMonth = 11; currentYear--; }
            renderCalendar(currentMonth, currentYear);
        });

        calNext.addEventListener('click', () => {
            currentMonth++;
            if (currentMonth > 11) { currentMonth = 0; currentYear++; }
            renderCalendar(currentMonth, currentYear);
        });

        renderCalendar(currentMonth, currentYear);

        if (isAdmin) {
            GHCAAdmin.initCalendarAdmin();
        }
    }
    const header = document.getElementById('header');
    const nav = document.getElementById('nav');
    const toggle = document.getElementById('mobile-toggle');

    // Mobile navigation toggle
    toggle.addEventListener('click', () => {
        nav.classList.toggle('active');
        toggle.classList.toggle('active');
    });

    // Close mobile nav when a link is clicked
    nav.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            nav.classList.remove('active');
            toggle.classList.remove('active');
        });
    });

    // Header scroll effect
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        header.classList.toggle('scrolled', currentScroll > 50);
        lastScroll = currentScroll;
    });

    // Animate elements on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.amenity-card, .event-card, .update-card, .contact-card, .highlight-card, .collage-grid-img').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // Add animation class styles
    const style = document.createElement('style');
    style.textContent = `
        .animate-in { opacity: 1 !important; transform: translateY(0) !important; }
        .lightbox { position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 9999; display: flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0; transition: opacity 0.3s ease; }
        .lightbox.active { opacity: 1; }
        .lightbox img { max-width: 90vw; max-height: 90vh; object-fit: contain; border-radius: 8px; box-shadow: 0 0 40px rgba(0,0,0,0.5); }
    `;
    document.head.appendChild(style);

    // Updates filter
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

    // Reservation request form
    const reservationForm = document.getElementById('reservation-form');
    if (reservationForm) {
        reservationForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const name = document.getElementById('res-name');
            const email = document.getElementById('res-email');
            const date = document.getElementById('res-date');
            const purpose = document.getElementById('res-purpose');
            const guests = document.getElementById('res-guests');
            const notes = document.getElementById('res-notes');
            const status = document.getElementById('reservation-status');

            [name, email, date].forEach(el => el.classList.remove('invalid'));

            let valid = true;
            if (!name.value.trim()) { name.classList.add('invalid'); valid = false; }
            if (!email.value.trim() || !email.validity.valid) { email.classList.add('invalid'); valid = false; }
            if (!date.value) { date.classList.add('invalid'); valid = false; }

            if (!valid) {
                status.hidden = false;
                status.className = 'form-status error';
                status.textContent = 'Please fill in all required fields.';
                return;
            }

            const dateObj = new Date(date.value + 'T00:00:00');
            const formattedDate = dateObj.toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });

            const subject = `Beach Reservation Request - ${formattedDate} - ${name.value.trim()}`;

            let body = `Hi,\n\nI would like to request a reservation for the community beach.\n\n`;
            body += `Name: ${name.value.trim()}\n`;
            body += `Email: ${email.value.trim()}\n`;
            body += `Preferred Date: ${formattedDate}\n`;
            if (purpose.value.trim()) body += `Event/Purpose: ${purpose.value.trim()}\n`;
            if (guests.value) body += `Expected Guests: ${guests.value}\n`;
            if (notes.value.trim()) body += `Additional Notes: ${notes.value.trim()}\n`;
            body += `\nThank you!`;

            const mailtoUrl = `mailto:glebeheights.secretary@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            window.location.href = mailtoUrl;

            status.hidden = false;
            status.className = 'form-status success';
            status.textContent = 'Your email client should now open with the reservation details. If it didn\u2019t open, please email glebeheights.secretary@gmail.com directly.';
        });

        reservationForm.querySelectorAll('input, textarea').forEach(el => {
            el.addEventListener('input', () => el.classList.remove('invalid'));
        });
    }

    // Lightbox for collage images
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

    // Admin mode initialization for index.html
    if (window.GHCAAdmin && GHCAAdmin.isAdmin()) {
        // Make content sections editable
        GHCAAdmin.makeEditable('.about-text', 'about-text');
        GHCAAdmin.makeEditable('.amenity-card', 'amenity');
        GHCAAdmin.makeEditable('.highlight-card', 'highlight');
        GHCAAdmin.makeEditable('.contact-card', 'contact');

        // Initialize updates admin controls
        GHCAAdmin.initUpdatesAdmin();

        // Load any previously saved edits
        GHCAAdmin.loadSavedEdits();
    } else if (window.GHCAAdmin) {
        // Non-admin: still load saved content so visitors see admin edits
        GHCAAdmin.loadSavedEdits();
    }
});

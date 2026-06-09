/* GHCA Site-Wide Admin Mode */
(function() {
    'use strict';

    const ADMIN_EMAILS = ['glebeheights.secretary@gmail.com', 'sheiilindley99@gmail.com'];
    const STORAGE_KEY = 'ghca_member_email';
    const EDITS_KEY = 'ghca-admin-edits';

    window.GHCAAdmin = {
        ADMIN_EMAILS,
        STORAGE_KEY,
        EDITS_KEY,

        isAdmin: function() {
            const email = localStorage.getItem(STORAGE_KEY);
            return email && ADMIN_EMAILS.includes(email.toLowerCase());
        },

        getAdminEmail: function() {
            const email = localStorage.getItem(STORAGE_KEY);
            if (email && ADMIN_EMAILS.includes(email.toLowerCase())) return email;
            return null;
        },

        adminLogin: function(email) {
            email = email.trim().toLowerCase();
            if (ADMIN_EMAILS.includes(email)) {
                localStorage.setItem(STORAGE_KEY, email);
                return true;
            }
            return false;
        },

        adminLogout: function() {
            localStorage.removeItem(STORAGE_KEY);
            location.reload();
        },

        getSavedEdits: function() {
            try {
                return JSON.parse(localStorage.getItem(EDITS_KEY)) || {};
            } catch(e) {
                return {};
            }
        },

        saveEdits: function(edits) {
            const current = this.getSavedEdits();
            Object.assign(current, edits);
            localStorage.setItem(EDITS_KEY, JSON.stringify(current));
        },

        resetEdits: function() {
            localStorage.removeItem(EDITS_KEY);
            location.reload();
        },

        showNotification: function(msg, type) {
            const note = document.createElement('div');
            note.className = 'admin-notification admin-notification-' + (type || 'success');
            note.textContent = msg;
            document.body.appendChild(note);
            requestAnimationFrame(() => note.classList.add('visible'));
            setTimeout(() => {
                note.classList.remove('visible');
                setTimeout(() => note.remove(), 300);
            }, 2500);
        }
    };

    function createAdminToolbar() {
        if (document.getElementById('ghca-admin-toolbar')) return;

        const toolbar = document.createElement('div');
        toolbar.id = 'ghca-admin-toolbar';
        toolbar.className = 'admin-toolbar';
        toolbar.innerHTML = `
            <div class="admin-toolbar-inner">
                <span class="admin-toolbar-label">🔑 Admin Mode</span>
                <span class="admin-toolbar-email">${GHCAAdmin.getAdminEmail()}</span>
                <div class="admin-toolbar-actions">
                    <button class="admin-toolbar-btn admin-toolbar-save" id="admin-save-btn">Save Changes</button>
                    <button class="admin-toolbar-btn admin-toolbar-reset" id="admin-reset-btn">Reset to Default</button>
                    <button class="admin-toolbar-btn admin-toolbar-logout" id="admin-logout-btn">Logout</button>
                </div>
            </div>
        `;
        document.body.prepend(toolbar);
        document.body.classList.add('admin-mode-active');

        document.getElementById('admin-save-btn').addEventListener('click', saveAllEdits);
        document.getElementById('admin-reset-btn').addEventListener('click', function() {
            if (confirm('Reset all admin edits to default content? This cannot be undone.')) {
                GHCAAdmin.resetEdits();
            }
        });
        document.getElementById('admin-logout-btn').addEventListener('click', function() {
            GHCAAdmin.adminLogout();
        });
    }

    function createAdminFooterLink() {
        const footer = document.querySelector('.footer-inner');
        if (!footer || document.getElementById('admin-footer-link')) return;

        const link = document.createElement('div');
        link.id = 'admin-footer-link';
        link.className = 'admin-footer-access';

        if (GHCAAdmin.isAdmin()) {
            link.innerHTML = '<span class="admin-footer-indicator">🔑 Admin Active</span>';
        } else {
            link.innerHTML = '<a href="#" class="admin-login-trigger" title="Admin Login">🔒</a>';
            link.querySelector('.admin-login-trigger').addEventListener('click', function(e) {
                e.preventDefault();
                showAdminLoginModal();
            });
        }
        footer.appendChild(link);
    }

    function showAdminLoginModal() {
        if (document.getElementById('admin-login-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'admin-login-modal';
        modal.className = 'admin-modal-overlay';
        modal.innerHTML = `
            <div class="admin-modal">
                <button class="admin-modal-close">&times;</button>
                <h3>Admin Login</h3>
                <p>Enter your admin email to activate admin mode.</p>
                <form id="admin-login-form">
                    <input type="email" id="admin-email-input" placeholder="admin@email.com" required autocomplete="email">
                    <button type="submit">Login</button>
                </form>
                <p class="admin-modal-error" id="admin-login-error">Invalid admin email.</p>
            </div>
        `;
        document.body.appendChild(modal);
        requestAnimationFrame(() => modal.classList.add('visible'));

        modal.querySelector('.admin-modal-close').addEventListener('click', closeAdminModal);
        modal.addEventListener('click', function(e) {
            if (e.target === modal) closeAdminModal();
        });

        modal.querySelector('#admin-login-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const email = document.getElementById('admin-email-input').value;
            if (GHCAAdmin.adminLogin(email)) {
                closeAdminModal();
                location.reload();
            } else {
                document.getElementById('admin-login-error').classList.add('visible');
            }
        });

        document.getElementById('admin-email-input').focus();
    }

    function closeAdminModal() {
        const modal = document.getElementById('admin-login-modal');
        if (modal) {
            modal.classList.remove('visible');
            setTimeout(() => modal.remove(), 300);
        }
    }

    function makeEditable(selector, editKey) {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el, idx) => {
            const key = editKey + '-' + idx;
            el.setAttribute('data-edit-key', key);
            el.classList.add('admin-editable');

            const editBtn = document.createElement('button');
            editBtn.className = 'admin-inline-edit-btn';
            editBtn.textContent = '✏️';
            editBtn.title = 'Edit this content';
            editBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (el.contentEditable === 'true') {
                    el.contentEditable = false;
                    el.classList.remove('admin-editing-active');
                    editBtn.textContent = '✏️';
                } else {
                    el.contentEditable = true;
                    el.classList.add('admin-editing-active');
                    el.focus();
                    editBtn.textContent = '✓';
                }
            });

            el.style.position = 'relative';
            el.appendChild(editBtn);
        });
    }

    function saveAllEdits() {
        const edits = GHCAAdmin.getSavedEdits();
        const page = location.pathname.split('/').pop() || 'index.html';
        edits[page] = edits[page] || {};

        document.querySelectorAll('[data-edit-key]').forEach(el => {
            const key = el.getAttribute('data-edit-key');
            const btn = el.querySelector('.admin-inline-edit-btn');
            const content = el.cloneNode(true);
            if (btn) {
                const btnInClone = content.querySelector('.admin-inline-edit-btn');
                if (btnInClone) btnInClone.remove();
            }
            edits[page][key] = content.innerHTML.trim();
            el.contentEditable = false;
            el.classList.remove('admin-editing-active');
            if (btn) btn.textContent = '✏️';
        });

        const updatesData = collectUpdatesData();
        if (updatesData) edits[page]['updates-cards'] = updatesData;

        const calData = collectCalendarData();
        if (calData) edits[page]['calendar-reservations'] = calData;

        localStorage.setItem(EDITS_KEY, JSON.stringify(edits));
        GHCAAdmin.showNotification('Changes saved successfully!', 'success');
    }

    function collectUpdatesData() {
        const grid = document.querySelector('.updates-grid');
        if (!grid) return null;
        const cards = [];
        grid.querySelectorAll('.update-card').forEach(card => {
            const dateEl = card.querySelector('.update-date');
            const h3El = card.querySelector('h3');
            const paragraphs = Array.from(card.querySelectorAll('p')).map(p => p.innerHTML);
            cards.push({
                category: card.dataset.category || 'announcements',
                urgent: card.classList.contains('update-urgent'),
                date: dateEl ? dateEl.textContent : '',
                title: h3El ? h3El.textContent : '',
                content: paragraphs
            });
        });
        return cards;
    }

    function collectCalendarData() {
        const saved = GHCAAdmin.getSavedEdits();
        const page = location.pathname.split('/').pop() || 'index.html';
        if (saved[page] && saved[page]['calendar-reservations']) {
            return saved[page]['calendar-reservations'];
        }
        return null;
    }

    function loadSavedEdits() {
        const edits = GHCAAdmin.getSavedEdits();
        const page = location.pathname.split('/').pop() || 'index.html';
        if (!edits[page]) return;

        const selectorMap = {
            'about-text': '.about-text',
            'amenity': '.amenity-card',
            'highlight': '.highlight-card',
            'contact': '.contact-card'
        };

        Object.keys(edits[page]).forEach(key => {
            if (key === 'updates-cards' || key === 'calendar-reservations') return;

            let el = document.querySelector(`[data-edit-key="${key}"]`);

            if (!el) {
                const parts = key.match(/^(.+)-(\d+)$/);
                if (parts && selectorMap[parts[1]]) {
                    const all = document.querySelectorAll(selectorMap[parts[1]]);
                    const idx = parseInt(parts[2], 10);
                    if (all[idx]) {
                        el = all[idx];
                        el.setAttribute('data-edit-key', key);
                    }
                }
            }

            if (el) {
                const btn = el.querySelector('.admin-inline-edit-btn');
                el.innerHTML = edits[page][key];
                if (btn) el.appendChild(btn);
                else if (GHCAAdmin.isAdmin()) {
                    const editBtn = document.createElement('button');
                    editBtn.className = 'admin-inline-edit-btn';
                    editBtn.textContent = '✏️';
                    editBtn.title = 'Edit this content';
                    editBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        if (el.contentEditable === 'true') {
                            el.contentEditable = false;
                            el.classList.remove('admin-editing-active');
                            editBtn.textContent = '✏️';
                        } else {
                            el.contentEditable = true;
                            el.classList.add('admin-editing-active');
                            el.focus();
                            editBtn.textContent = '✓';
                        }
                    });
                    el.appendChild(editBtn);
                }
            }
        });

        if (edits[page]['updates-cards']) {
            loadSavedUpdates(edits[page]['updates-cards']);
        }
    }

    function loadSavedUpdates(cardsData) {
        const grid = document.querySelector('.updates-grid');
        if (!grid || !cardsData) return;
        grid.innerHTML = '';
        cardsData.forEach(card => {
            const article = document.createElement('article');
            article.className = 'update-card' + (card.urgent ? ' update-urgent' : '');
            article.dataset.category = card.category;
            let html = `<div class="update-date">${card.date}</div><h3>${card.title}</h3>`;
            card.content.forEach(p => { html += `<p>${p}</p>`; });
            article.innerHTML = html;
            grid.appendChild(article);
        });
    }

    function initUpdatesAdmin() {
        const grid = document.querySelector('.updates-grid');
        if (!grid) return;

        const section = grid.closest('.section') || grid.parentElement;
        const controls = document.createElement('div');
        controls.className = 'admin-updates-controls';
        controls.innerHTML = '<button class="admin-add-card-btn" id="admin-add-update">+ Add Update Card</button>';
        grid.insertAdjacentElement('afterend', controls);

        document.getElementById('admin-add-update').addEventListener('click', function() {
            showUpdateCardModal();
        });

        grid.querySelectorAll('.update-card').forEach(card => {
            addCardAdminControls(card);
        });
    }

    function addCardAdminControls(card) {
        const controls = document.createElement('div');
        controls.className = 'admin-card-controls';
        controls.innerHTML = `
            <button class="admin-card-edit-btn" title="Edit">✏️</button>
            <button class="admin-card-remove-btn" title="Remove">×</button>
        `;
        card.style.position = 'relative';
        card.appendChild(controls);

        controls.querySelector('.admin-card-remove-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            if (confirm('Remove this update card?')) {
                card.remove();
                saveAllEdits();
            }
        });

        controls.querySelector('.admin-card-edit-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            const dateEl = card.querySelector('.update-date');
            const h3El = card.querySelector('h3');
            const paragraphs = Array.from(card.querySelectorAll('p')).map(p => p.textContent);
            showUpdateCardModal({
                category: card.dataset.category,
                urgent: card.classList.contains('update-urgent'),
                date: dateEl ? dateEl.textContent : '',
                title: h3El ? h3El.textContent : '',
                content: paragraphs.join('\n\n')
            }, card);
        });
    }

    function showUpdateCardModal(data, existingCard) {
        if (document.getElementById('admin-update-modal')) return;
        data = data || { category: 'announcements', urgent: false, date: '', title: '', content: '' };

        const modal = document.createElement('div');
        modal.id = 'admin-update-modal';
        modal.className = 'admin-modal-overlay';
        modal.innerHTML = `
            <div class="admin-modal admin-modal-wide">
                <button class="admin-modal-close">&times;</button>
                <h3>${existingCard ? 'Edit' : 'Add'} Update Card</h3>
                <form id="admin-update-form">
                    <label>Category</label>
                    <select id="auc-category">
                        <option value="events" ${data.category === 'events' ? 'selected' : ''}>Events</option>
                        <option value="meetings" ${data.category === 'meetings' ? 'selected' : ''}>Meetings</option>
                        <option value="announcements" ${data.category === 'announcements' ? 'selected' : ''}>Announcements</option>
                    </select>
                    <label><input type="checkbox" id="auc-urgent" ${data.urgent ? 'checked' : ''}> Mark as Urgent</label>
                    <label>Date Label</label>
                    <input type="text" id="auc-date" value="${data.date}" placeholder="e.g. July 2026, Monthly, Action Needed">
                    <label>Title</label>
                    <input type="text" id="auc-title" value="${data.title}" placeholder="Card title">
                    <label>Content (paragraphs separated by blank lines)</label>
                    <textarea id="auc-content" rows="5" placeholder="Card content...">${typeof data.content === 'string' ? data.content : ''}</textarea>
                    <button type="submit">${existingCard ? 'Update' : 'Add'} Card</button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        requestAnimationFrame(() => modal.classList.add('visible'));

        modal.querySelector('.admin-modal-close').addEventListener('click', () => closeModal('admin-update-modal'));
        modal.addEventListener('click', function(e) {
            if (e.target === modal) closeModal('admin-update-modal');
        });

        modal.querySelector('#admin-update-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const category = document.getElementById('auc-category').value;
            const urgent = document.getElementById('auc-urgent').checked;
            const date = document.getElementById('auc-date').value;
            const title = document.getElementById('auc-title').value;
            const contentRaw = document.getElementById('auc-content').value;
            const paragraphs = contentRaw.split(/\n\n+/).filter(p => p.trim());

            const article = existingCard || document.createElement('article');
            article.className = 'update-card' + (urgent ? ' update-urgent' : '');
            article.dataset.category = category;
            let html = `<div class="update-date">${date}</div><h3>${title}</h3>`;
            paragraphs.forEach(p => { html += `<p>${p}</p>`; });
            article.innerHTML = html;

            if (!existingCard) {
                const grid = document.querySelector('.updates-grid');
                grid.appendChild(article);
            }
            addCardAdminControls(article);
            closeModal('admin-update-modal');
            saveAllEdits();
        });
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.remove('visible');
            setTimeout(() => modal.remove(), 300);
        }
    }

    function initCalendarAdmin() {
        if (!document.getElementById('cal-days')) return;

        const edits = GHCAAdmin.getSavedEdits();
        const page = location.pathname.split('/').pop() || 'index.html';
        if (edits[page] && edits[page]['calendar-reservations']) {
            window.ghcaAdminReservations = edits[page]['calendar-reservations'];
        } else {
            window.ghcaAdminReservations = [];
        }

        const legend = document.querySelector('.calendar-legend');
        if (legend) {
            const adminLegend = document.createElement('span');
            adminLegend.className = 'legend-item';
            adminLegend.innerHTML = '<span class="legend-dot" style="background:#8e44ad;"></span> Admin Added';
            legend.appendChild(adminLegend);
        }
    }

    function getAdminReservations() {
        const edits = GHCAAdmin.getSavedEdits();
        const page = location.pathname.split('/').pop() || 'index.html';
        return (edits[page] && edits[page]['calendar-reservations']) || [];
    }

    function addAdminReservation(dateStr, name) {
        const edits = GHCAAdmin.getSavedEdits();
        const page = location.pathname.split('/').pop() || 'index.html';
        edits[page] = edits[page] || {};
        edits[page]['calendar-reservations'] = edits[page]['calendar-reservations'] || [];
        edits[page]['calendar-reservations'].push({ date: dateStr, name: name });
        localStorage.setItem(EDITS_KEY, JSON.stringify(edits));
        window.ghcaAdminReservations = edits[page]['calendar-reservations'];
    }

    function removeAdminReservation(dateStr) {
        const edits = GHCAAdmin.getSavedEdits();
        const page = location.pathname.split('/').pop() || 'index.html';
        if (!edits[page] || !edits[page]['calendar-reservations']) return;
        edits[page]['calendar-reservations'] = edits[page]['calendar-reservations'].filter(r => r.date !== dateStr);
        localStorage.setItem(EDITS_KEY, JSON.stringify(edits));
        window.ghcaAdminReservations = edits[page]['calendar-reservations'];
    }

    window.GHCAAdmin.getAdminReservations = getAdminReservations;
    window.GHCAAdmin.addAdminReservation = addAdminReservation;
    window.GHCAAdmin.removeAdminReservation = removeAdminReservation;
    window.GHCAAdmin.initCalendarAdmin = initCalendarAdmin;
    window.GHCAAdmin.makeEditable = makeEditable;
    window.GHCAAdmin.initUpdatesAdmin = initUpdatesAdmin;
    window.GHCAAdmin.loadSavedEdits = loadSavedEdits;
    window.GHCAAdmin.createAdminToolbar = createAdminToolbar;
    window.GHCAAdmin.saveAllEdits = saveAllEdits;

    function initPublicGalleryAdmin() {
        const gallery = document.getElementById('public-gallery');
        if (!gallery || !GHCAAdmin.isAdmin()) return;

        const section = gallery.closest('.section');
        const controls = document.createElement('div');
        controls.className = 'admin-gallery-controls';
        controls.style.cssText = 'display:flex;gap:10px;justify-content:center;margin-top:16px;flex-wrap:wrap;';
        controls.innerHTML = `
            <button class="admin-add-btn" id="admin-add-public-photo" style="margin-top:0;">+ Add Photo</button>
            <button class="admin-add-btn" id="admin-remove-public-photo" style="margin-top:0;background:#e74c3c;">Remove Photos</button>
        `;
        gallery.insertAdjacentElement('afterend', controls);

        document.getElementById('admin-add-public-photo').addEventListener('click', function() {
            const url = prompt('Enter image path (e.g. images/newphoto.jpg):');
            if (!url) return;
            const alt = prompt('Enter description:') || 'Community photo';
            const img = document.createElement('img');
            img.src = url;
            img.alt = alt;
            img.className = 'collage-grid-img';
            gallery.appendChild(img);
            savePublicGallery();
        });

        document.getElementById('admin-remove-public-photo').addEventListener('click', function() {
            const imgs = gallery.querySelectorAll('.collage-grid-img');
            const isRemoving = this.textContent.includes('Remove');
            if (isRemoving) {
                this.textContent = 'Done Removing';
                this.style.background = '#27ae60';
                imgs.forEach(img => {
                    img.style.cursor = 'pointer';
                    img.style.outline = '3px solid #e74c3c';
                    img._removeHandler = function() {
                        if (confirm('Remove this photo from the public gallery?')) {
                            img.remove();
                            savePublicGallery();
                        }
                    };
                    img.addEventListener('click', img._removeHandler);
                });
            } else {
                this.textContent = 'Remove Photos';
                this.style.background = '#e74c3c';
                imgs.forEach(img => {
                    img.style.cursor = '';
                    img.style.outline = '';
                    if (img._removeHandler) {
                        img.removeEventListener('click', img._removeHandler);
                        delete img._removeHandler;
                    }
                });
            }
        });
    }

    function savePublicGallery() {
        const gallery = document.getElementById('public-gallery');
        if (!gallery) return;
        const photos = [];
        gallery.querySelectorAll('.collage-grid-img').forEach(img => {
            photos.push({ src: img.getAttribute('src'), alt: img.alt });
        });
        const edits = GHCAAdmin.getSavedEdits();
        const page = 'index.html';
        edits[page] = edits[page] || {};
        edits[page]['public-gallery'] = photos;
        localStorage.setItem(EDITS_KEY, JSON.stringify(edits));
        GHCAAdmin.showNotification('Gallery saved!', 'success');
    }

    function loadPublicGallery() {
        const gallery = document.getElementById('public-gallery');
        if (!gallery) return;
        const edits = GHCAAdmin.getSavedEdits();
        const photos = edits['index.html'] && edits['index.html']['public-gallery'];
        if (!photos) return;
        gallery.innerHTML = '';
        photos.forEach(p => {
            const img = document.createElement('img');
            img.src = p.src;
            img.alt = p.alt;
            img.className = 'collage-grid-img';
            gallery.appendChild(img);
        });
    }

    window.GHCAAdmin.initPublicGalleryAdmin = initPublicGalleryAdmin;
    window.GHCAAdmin.loadPublicGallery = loadPublicGallery;

    document.addEventListener('DOMContentLoaded', function() {
        createAdminFooterLink();

        loadPublicGallery();

        if (GHCAAdmin.isAdmin()) {
            createAdminToolbar();
            initPublicGalleryAdmin();
        }
    });
})();

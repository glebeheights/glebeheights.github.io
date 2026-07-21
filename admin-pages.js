/* GHCA Member Pages Admin Editing
   Provides inline editing for tables, content blocks, and meeting minutes.
   Requires admin.js to be loaded first (for GHCAAdmin global). */
(function() {
    'use strict';

    const ADMIN_EMAILS = ['glebeheights.secretary@gmail.com', 'sheiilindley99@gmail.com'];
    const STORAGE_KEY = 'ghca_member_email';
    const PAGE_EDITS_KEY = 'ghca_page_edits';

    function isAdmin() {
        const email = localStorage.getItem(STORAGE_KEY);
        return email && ADMIN_EMAILS.includes(email.toLowerCase());
    }

    function getPageKey() {
        return location.pathname.split('/').pop() || 'unknown';
    }

    function getSavedPageData() {
        try {
            const all = JSON.parse(localStorage.getItem(PAGE_EDITS_KEY)) || {};
            return all[getPageKey()] || null;
        } catch(e) { return null; }
    }

    function savePageData(data) {
        try {
            const all = JSON.parse(localStorage.getItem(PAGE_EDITS_KEY)) || {};
            all[getPageKey()] = data;
            localStorage.setItem(PAGE_EDITS_KEY, JSON.stringify(all));
            if (window.GHCAPublish) GHCAPublish.markDirty();
        } catch(e) {}
    }

    function showNotice(msg) {
        if (window.GHCAAdmin && GHCAAdmin.showNotification) {
            GHCAAdmin.showNotification(msg, 'success');
        } else {
            const n = document.createElement('div');
            n.style.cssText = 'position:fixed;top:20px;right:20px;background:#27ae60;color:white;padding:12px 20px;border-radius:8px;font-size:0.9rem;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.2);';
            n.textContent = msg;
            document.body.appendChild(n);
            setTimeout(() => n.remove(), 2500);
        }
    }

    // ============ TABLE EDITING ============

    function initTableAdmin(tableSelector, storageField) {
        if (!isAdmin()) {
            loadTableData(tableSelector, storageField);
            return;
        }

        loadTableData(tableSelector, storageField);

        const table = document.querySelector(tableSelector);
        if (!table) return;

        const wrapper = table.closest('.table-wrapper') || table.parentElement;

        // Add admin toolbar above table
        const toolbar = document.createElement('div');
        toolbar.className = 'admin-table-toolbar';
        toolbar.innerHTML = `
            <span class="admin-table-label">🔑 Admin: Table Editing</span>
            <button class="admin-tbl-btn admin-tbl-add" id="admin-add-row-${storageField}">+ Add Row</button>
            <button class="admin-tbl-btn admin-tbl-save" id="admin-save-tbl-${storageField}">Save Changes</button>
        `;
        wrapper.insertAdjacentElement('beforebegin', toolbar);

        // Make existing cells editable
        makeTableCellsEditable(table);

        // Add delete buttons to each row
        addDeleteButtons(table);

        // Add row handler
        document.getElementById(`admin-add-row-${storageField}`).addEventListener('click', function() {
            addNewRow(table);
        });

        // Save handler
        document.getElementById(`admin-save-tbl-${storageField}`).addEventListener('click', function() {
            saveTableState(table, storageField);
            showNotice('Draft saved. Click "Publish Live" (top bar) to update the website.');
        });
    }

    function makeTableCellsEditable(table) {
        table.querySelectorAll('tbody td').forEach(td => {
            if (td.classList.contains('admin-action-cell')) return;
            td.contentEditable = true;
            td.style.cursor = 'text';
            td.addEventListener('focus', function() {
                this.style.background = 'rgba(39, 174, 96, 0.05)';
                this.style.outline = '2px solid rgba(39, 174, 96, 0.3)';
                this.style.outlineOffset = '-2px';
            });
            td.addEventListener('blur', function() {
                this.style.background = '';
                this.style.outline = '';
            });
        });
    }

    function addDeleteButtons(table) {
        const thead = table.querySelector('thead tr');
        if (thead && !thead.querySelector('.admin-action-header')) {
            const th = document.createElement('th');
            th.className = 'admin-action-header';
            th.textContent = '';
            th.style.width = '40px';
            thead.appendChild(th);
        }

        table.querySelectorAll('tbody tr').forEach(row => {
            if (row.querySelector('.admin-action-cell')) return;
            const td = document.createElement('td');
            td.className = 'admin-action-cell';
            td.contentEditable = false;
            td.innerHTML = '<button class="admin-row-delete" title="Delete row">&times;</button>';
            td.querySelector('.admin-row-delete').addEventListener('click', function() {
                if (confirm('Delete this row?')) {
                    row.remove();
                }
            });
            row.appendChild(td);
        });
    }

    function addNewRow(table) {
        const tbody = table.querySelector('tbody');
        const headerCells = table.querySelectorAll('thead th');
        const row = document.createElement('tr');

        headerCells.forEach((th, idx) => {
            if (th.classList.contains('admin-action-header')) return;
            const td = document.createElement('td');
            td.contentEditable = true;
            td.style.cursor = 'text';
            td.textContent = '';
            td.style.background = 'rgba(39, 174, 96, 0.08)';
            td.addEventListener('focus', function() {
                this.style.background = 'rgba(39, 174, 96, 0.05)';
                this.style.outline = '2px solid rgba(39, 174, 96, 0.3)';
                this.style.outlineOffset = '-2px';
            });
            td.addEventListener('blur', function() {
                this.style.background = '';
                this.style.outline = '';
            });
            row.appendChild(td);
        });

        // Add delete button
        const actionTd = document.createElement('td');
        actionTd.className = 'admin-action-cell';
        actionTd.contentEditable = false;
        actionTd.innerHTML = '<button class="admin-row-delete" title="Delete row">&times;</button>';
        actionTd.querySelector('.admin-row-delete').addEventListener('click', function() {
            if (confirm('Delete this row?')) row.remove();
        });
        row.appendChild(actionTd);

        tbody.appendChild(row);
        row.querySelector('td').focus();
    }

    function saveTableState(table, storageField) {
        const headers = [];
        table.querySelectorAll('thead th').forEach(th => {
            if (!th.classList.contains('admin-action-header')) {
                headers.push(th.textContent.trim());
            }
        });

        const rows = [];
        table.querySelectorAll('tbody tr').forEach(tr => {
            const cells = [];
            tr.querySelectorAll('td').forEach(td => {
                if (!td.classList.contains('admin-action-cell')) {
                    cells.push(td.innerHTML.trim());
                }
            });
            if (cells.length > 0) rows.push(cells);
        });

        const data = getSavedPageData() || {};
        data[storageField] = { headers, rows };
        savePageData(data);
    }

    function loadTableData(tableSelector, storageField) {
        const data = getSavedPageData();
        if (!data || !data[storageField]) return;

        const table = document.querySelector(tableSelector);
        if (!table) return;

        const { headers, rows } = data[storageField];
        const tbody = table.querySelector('tbody');
        tbody.innerHTML = '';

        rows.forEach(cells => {
            const tr = document.createElement('tr');
            cells.forEach(cellHtml => {
                const td = document.createElement('td');
                td.innerHTML = cellHtml;
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }

    // ============ CONTENT BLOCK EDITING ============

    function initContentAdmin(selector, storageField) {
        if (!isAdmin()) {
            loadContentData(selector, storageField);
            return;
        }

        loadContentData(selector, storageField);

        const elements = document.querySelectorAll(selector);
        if (!elements.length) return;

        elements.forEach((el, idx) => {
            el.style.position = 'relative';

            const editBtn = document.createElement('button');
            editBtn.className = 'admin-content-edit-btn';
            editBtn.textContent = '✏️ Edit';
            editBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (el.contentEditable === 'true') {
                    el.contentEditable = false;
                    el.classList.remove('admin-content-editing');
                    editBtn.textContent = '✏️ Edit';
                    saveContentState(selector, storageField);
                    showNotice('Draft saved. Click "Publish Live" (top bar) to update the website.');
                } else {
                    el.contentEditable = true;
                    el.classList.add('admin-content-editing');
                    el.focus();
                    editBtn.textContent = '✓ Done';
                }
            });
            el.appendChild(editBtn);
        });
    }

    function saveContentState(selector, storageField) {
        const elements = document.querySelectorAll(selector);
        const contents = [];
        elements.forEach(el => {
            const clone = el.cloneNode(true);
            const btn = clone.querySelector('.admin-content-edit-btn');
            if (btn) btn.remove();
            contents.push(clone.innerHTML.trim());
        });

        const data = getSavedPageData() || {};
        data[storageField] = contents;
        savePageData(data);
    }

    function loadContentData(selector, storageField) {
        const data = getSavedPageData();
        if (!data || !data[storageField]) return;

        const elements = document.querySelectorAll(selector);
        data[storageField].forEach((html, idx) => {
            if (elements[idx]) {
                elements[idx].innerHTML = html;
            }
        });
    }

    // ============ MINUTES EDITING ============

    let minutesToolbar = null;
    let currentMinutesEntry = null;

    function initMinutesAdmin() {
        if (!isAdmin()) {
            loadMinutesData();
            return;
        }

        loadMinutesData();

        document.querySelectorAll('.minutes-entry').forEach(entry => {
            attachMinutesEditor(entry);
        });

        // Add new minutes entry button
        const container = document.querySelector('.page-content') || document.querySelector('.page-body');
        if (container) {
            const addBtn = document.createElement('button');
            addBtn.className = 'admin-tbl-btn admin-tbl-add';
            addBtn.style.cssText = 'margin:20px 0;';
            addBtn.textContent = '+ Add New Meeting Minutes';
            addBtn.addEventListener('click', addNewMinutesEntry);

            const backLink = container.querySelector('.back-link');
            if (backLink) {
                backLink.insertAdjacentElement('beforebegin', addBtn);
            } else {
                container.appendChild(addBtn);
            }
        }
    }

    function attachMinutesEditor(entry, startEditing) {
        entry.style.position = 'relative';

        const editBtn = document.createElement('button');
        editBtn.className = 'admin-content-edit-btn';
        editBtn.textContent = startEditing ? '✓ Done' : '✏️ Edit';
        editBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (entry.contentEditable === 'true') {
                exitMinutesEdit(entry, editBtn);
            } else {
                enterMinutesEdit(entry, editBtn);
            }
        });
        entry.appendChild(editBtn);

        // Tab / Shift+Tab nests / un-nests the current bullet
        entry.addEventListener('keydown', function(e) {
            if (e.key !== 'Tab' || entry.contentEditable !== 'true') return;
            if (!getSelectionListItem()) return;
            e.preventDefault();
            document.execCommand(e.shiftKey ? 'outdent' : 'indent');
        });

        if (startEditing) enterMinutesEdit(entry, editBtn);
    }

    function enterMinutesEdit(entry, editBtn) {
        entry.contentEditable = true;
        entry.classList.add('admin-content-editing');
        editBtn.textContent = '✓ Done';
        currentMinutesEntry = entry;
        showMinutesToolbar();
        entry.focus();
    }

    function exitMinutesEdit(entry, editBtn) {
        entry.contentEditable = false;
        entry.classList.remove('admin-content-editing');
        editBtn.textContent = '✏️ Edit';
        if (currentMinutesEntry === entry) {
            currentMinutesEntry = null;
            hideMinutesToolbar();
        }
        saveMinutesState();
        rebuildMinutesIndex();
        showNotice('Draft saved. Click "Publish Live" (top bar) to update the website.');
    }

    function getSelectionListItem() {
        const sel = window.getSelection();
        if (!sel || !sel.anchorNode) return null;
        let node = sel.anchorNode;
        while (node && node !== document.body) {
            if (node.nodeType === 1 && node.tagName === 'LI') return node;
            node = node.parentNode;
        }
        return null;
    }

    const MINUTES_TOOLBAR_BUTTONS = [
        { label: 'B', title: 'Bold', style: 'font-weight:700;', cmd: () => document.execCommand('bold') },
        { label: 'H', title: 'Section heading', style: 'font-weight:700;', cmd: () => document.execCommand('formatBlock', false, 'h3') },
        { label: '¶', title: 'Normal text', cmd: () => document.execCommand('formatBlock', false, 'p') },
        { label: '• List', title: 'Bulleted list', cmd: () => document.execCommand('insertUnorderedList') },
        { label: '⇥ Nest', title: 'Indent / nest bullet (Tab)', cmd: () => document.execCommand('indent') },
        { label: '⇤ Un-nest', title: 'Outdent bullet (Shift+Tab)', cmd: () => document.execCommand('outdent') },
        { label: '☑ Task', title: 'Flag this bullet as a task for the Members task list (click again to unflag)', cmd: () => toggleMinutesTask() },
        { label: '⌫ Clear', title: 'Clear formatting on the selected text', cmd: () => document.execCommand('removeFormat') },
    ];

    function toggleMinutesTask() {
        const li = getSelectionListItem();
        if (!li) {
            alert('Put your cursor on a bullet line first, then click Task.');
            return;
        }
        if (li.classList.contains('ghca-task')) {
            li.classList.remove('ghca-task');
            li.removeAttribute('data-task-id');
        } else {
            li.classList.add('ghca-task');
            if (!li.getAttribute('data-task-id')) {
                li.setAttribute('data-task-id', 't-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6));
            }
        }
    }

    function showMinutesToolbar() {
        if (!minutesToolbar) {
            minutesToolbar = document.createElement('div');
            minutesToolbar.className = 'admin-format-toolbar';
            const hint = document.createElement('span');
            hint.className = 'admin-fmt-hint';
            hint.textContent = 'Format:';
            minutesToolbar.appendChild(hint);
            MINUTES_TOOLBAR_BUTTONS.forEach(btn => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'admin-fmt-btn';
                b.textContent = btn.label;
                b.title = btn.title;
                if (btn.style) b.setAttribute('style', btn.style);
                // Prevent the button from stealing the text selection
                b.addEventListener('mousedown', e => e.preventDefault());
                b.addEventListener('click', function(e) {
                    e.preventDefault();
                    if (currentMinutesEntry) currentMinutesEntry.focus();
                    btn.cmd();
                });
                minutesToolbar.appendChild(b);
            });
            document.body.appendChild(minutesToolbar);
        }
        minutesToolbar.classList.add('visible');
    }

    function hideMinutesToolbar() {
        if (minutesToolbar) minutesToolbar.classList.remove('visible');
    }

    function addNewMinutesEntry() {
        const today = new Date();
        const dateStr = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        const entry = document.createElement('div');
        entry.className = 'minutes-entry';
        entry.innerHTML = `
            <h2>GHCA Monthly Meeting</h2>
            <div class="minutes-meta">${dateStr} &bull; 6:30 PM &bull; Beach Fire Pit Area</div>
            <p>Minutes from previous meeting read and approved.</p>
            <h3>Treasury Report</h3>
            <p>Report details here...</p>
            <h3>Old Business</h3>
            <ul><li>Item 1</li></ul>
            <h3>New Business</h3>
            <ul><li>Item 1</li></ul>
            <p style="margin-top: 24px; font-style: italic;">Meeting adjourned.</p>
        `;

        const container = document.querySelector('.page-content') || document.querySelector('.page-body');
        const index = container.querySelector('.minutes-index');
        if (index) {
            index.insertAdjacentElement('afterend', entry);
        } else {
            container.appendChild(entry);
        }

        attachMinutesEditor(entry, true);
        rebuildMinutesIndex();
    }

    function saveMinutesState() {
        const entries = document.querySelectorAll('.minutes-entry');
        const contents = [];
        entries.forEach(entry => {
            const clone = entry.cloneNode(true);
            const btn = clone.querySelector('.admin-content-edit-btn');
            if (btn) btn.remove();
            contents.push(clone.innerHTML.trim());
        });

        const data = getSavedPageData() || {};
        data['minutes-entries'] = contents;
        savePageData(data);
    }

    function loadMinutesData() {
        const data = getSavedPageData();
        const container = document.querySelector('.page-content') || document.querySelector('.page-body');

        if (container && data && data['minutes-entries']) {
            // Remove existing entries
            container.querySelectorAll('.minutes-entry').forEach(e => e.remove());

            // Re-insert saved entries, preserving their stored (newest-first) order
            const index = container.querySelector('.minutes-index');
            let anchor = index || container.querySelector('.breadcrumbs');

            data['minutes-entries'].forEach(html => {
                const entry = document.createElement('div');
                entry.className = 'minutes-entry';
                entry.innerHTML = html;
                if (anchor) {
                    anchor.insertAdjacentElement('afterend', entry);
                    anchor = entry;
                } else {
                    container.appendChild(entry);
                }
            });
        }

        rebuildMinutesIndex();
    }

    function rebuildMinutesIndex() {
        const indexList = document.querySelector('.minutes-index ul');
        if (!indexList) return;
        const entries = document.querySelectorAll('.minutes-entry');
        indexList.innerHTML = '';
        entries.forEach(function(entry) {
            const meta = entry.querySelector('.minutes-meta');
            const metaText = meta ? meta.textContent.trim() : '';
            const datePart = (metaText.split('\u2022')[0] || '').trim();
            let id = entry.id;
            if (!id) {
                id = 'minutes-' + (datePart.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
                    || Math.random().toString(36).slice(2, 8));
                entry.id = id;
            }
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = '#' + id;
            a.textContent = (datePart || 'Meeting') + ' \u2014 Monthly Meeting';
            li.appendChild(a);
            indexList.appendChild(li);
        });
    }

    // ============ ADMIN STYLES ============

    function injectAdminStyles() {
        if (document.getElementById('admin-pages-styles')) return;
        const style = document.createElement('style');
        style.id = 'admin-pages-styles';
        style.textContent = `
            .admin-table-toolbar {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                background: linear-gradient(135deg, #27ae60, #2ecc71);
                border-radius: 8px 8px 0 0;
                margin-bottom: -4px;
                position: relative;
                z-index: 1;
            }
            .admin-table-label {
                color: white;
                font-size: 0.85rem;
                font-weight: 600;
                margin-right: auto;
            }
            .admin-tbl-btn {
                padding: 8px 16px;
                border: none;
                border-radius: 6px;
                font-size: 0.8rem;
                font-weight: 600;
                cursor: pointer;
                transition: 0.2s;
            }
            .admin-tbl-add {
                background: white;
                color: #27ae60;
            }
            .admin-tbl-add:hover {
                background: #f0fff4;
                transform: translateY(-1px);
            }
            .admin-tbl-save {
                background: rgba(255,255,255,0.2);
                color: white;
                border: 1px solid rgba(255,255,255,0.4);
            }
            .admin-tbl-save:hover {
                background: rgba(255,255,255,0.3);
            }
            .admin-row-delete {
                background: none;
                border: none;
                color: #e74c3c;
                font-size: 1.3rem;
                cursor: pointer;
                padding: 2px 8px;
                border-radius: 4px;
                transition: 0.2s;
                line-height: 1;
            }
            .admin-row-delete:hover {
                background: rgba(231, 76, 60, 0.1);
            }
            .admin-action-cell {
                width: 40px;
                text-align: center;
            }
            .admin-action-header {
                width: 40px;
            }
            .admin-content-edit-btn {
                position: absolute;
                top: 8px;
                right: 8px;
                padding: 6px 12px;
                background: #27ae60;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 0.75rem;
                font-weight: 600;
                cursor: pointer;
                z-index: 10;
                transition: 0.2s;
            }
            .admin-content-edit-btn:hover {
                background: #219a52;
                transform: translateY(-1px);
            }
            .admin-content-editing {
                outline: 2px dashed #27ae60 !important;
                outline-offset: 4px;
                min-height: 100px;
            }
            .admin-format-toolbar {
                position: fixed;
                top: 72px;
                left: 50%;
                transform: translateX(-50%) translateY(-12px);
                display: flex;
                align-items: center;
                gap: 6px;
                flex-wrap: wrap;
                justify-content: center;
                max-width: 92vw;
                padding: 8px 12px;
                background: #1f2d3d;
                border-radius: 10px;
                box-shadow: 0 8px 30px rgba(0,0,0,0.25);
                z-index: 99998;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s ease, transform 0.2s ease;
            }
            .admin-format-toolbar.visible {
                opacity: 1;
                pointer-events: auto;
                transform: translateX(-50%) translateY(0);
            }
            .admin-fmt-hint {
                color: rgba(255,255,255,0.7);
                font-size: 0.8rem;
                font-weight: 600;
                margin-right: 2px;
            }
            .admin-fmt-btn {
                background: #fff;
                color: #1f2d3d;
                border: none;
                border-radius: 6px;
                padding: 6px 10px;
                font-size: 0.85rem;
                line-height: 1;
                cursor: pointer;
                transition: 0.15s;
            }
            .admin-fmt-btn:hover {
                background: #27ae60;
                color: #fff;
            }
        `;
        document.head.appendChild(style);
    }

    // ============ INITIALIZATION ============

    function init() {
        const page = getPageKey();

        if (isAdmin()) {
            injectAdminStyles();
        }

        switch(page) {
            case 'workhours.html':
                initTableAdmin('.hours-table', 'workhours-table');
                initContentAdmin('.requirements-banner', 'requirements');
                break;

            case 'boatslips.html':
                initTableAdmin('.slip-table', 'boatslips-table');
                initContentAdmin('.contact-note', 'contact-note');
                break;

            case 'minutes.html':
                initMinutesAdmin();
                break;

            case 'bylaws.html':
                initContentAdmin('.article', 'bylaw-articles');
                break;

            case 'signin.html':
                // Sign-in already has full CRUD via localStorage
                break;
        }
    }

    if (window.GHCA_ready) {
        window.GHCA_ready(init);
    } else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

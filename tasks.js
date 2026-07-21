/* GHCA Tasks
   Builds the Members "Open Items / Tasks Needed" list from:
     1) bullets flagged as tasks in the meeting minutes (li.ghca-task), and
     2) one-off manual tasks added on the Members page.
   Task status (Needs Volunteer / In Progress / Done) is set on the Members page.
   Everything is stored in the published content bundle (pageEdits) so it goes
   live via "Publish Live". Requires github-publish.js to be loaded first. */
(function() {
    'use strict';

    const ADMIN_EMAILS = ['glebeheights.secretary@gmail.com', 'sheiilindley99@gmail.com'];
    const PAGE_EDITS_KEY = 'ghca_page_edits';

    const STATUSES = [
        { cls: 'status-volunteer', label: 'Needs Volunteer' },
        { cls: 'status-progress', label: 'In Progress' },
        { cls: 'status-done', label: 'Done' }
    ];
    const DEFAULT_STATUS = 'status-volunteer';

    let editing = false;

    function isAdmin() {
        const e = localStorage.getItem('ghca_member_email');
        return e && ADMIN_EMAILS.includes(e.toLowerCase());
    }

    function statusLabel(cls) {
        const s = STATUSES.find(x => x.cls === cls);
        return s ? s.label : 'Needs Volunteer';
    }

    // ---------------- storage ----------------
    function readPageEdits() {
        try { return JSON.parse(localStorage.getItem(PAGE_EDITS_KEY)) || {}; } catch (e) { return {}; }
    }

    function getMembersData() {
        const all = readPageEdits();
        const d = all['members.html'] || {};
        if (!d.manualTasks) d.manualTasks = [];
        if (!d.taskStatus) d.taskStatus = {};
        return d;
    }

    function saveMembersData(d) {
        const all = readPageEdits();
        all['members.html'] = d;
        localStorage.setItem(PAGE_EDITS_KEY, JSON.stringify(all));
        if (window.GHCAPublish) GHCAPublish.markDirty();
    }

    function getMinutesEntries() {
        const all = readPageEdits();
        const m = all['minutes.html'];
        return (m && m['minutes-entries']) || null;
    }

    // ---------------- model ----------------
    function collectMinutesTasks() {
        const entries = getMinutesEntries();
        const tasks = [];
        if (!entries) return tasks;
        entries.forEach(html => {
            const tmp = document.createElement('div');
            tmp.innerHTML = html;
            const meta = tmp.querySelector('.minutes-meta');
            const meeting = meta ? (meta.textContent.split('\u2022')[0] || '').trim() : '';
            tmp.querySelectorAll('li.ghca-task').forEach(li => {
                const id = li.getAttribute('data-task-id');
                if (!id) return;
                const clone = li.cloneNode(true);
                clone.querySelectorAll('ul, ol').forEach(n => n.remove());
                const text = clone.textContent.replace(/\s+/g, ' ').trim();
                if (text) tasks.push({ id: id, text: text, meeting: meeting, source: 'minutes' });
            });
        });
        return tasks;
    }

    function buildModel() {
        const data = getMembersData();
        const statusMap = data.taskStatus || {};
        const seen = {};
        const model = [];
        collectMinutesTasks().forEach(t => {
            if (seen[t.id]) return;
            seen[t.id] = true;
            model.push({ id: t.id, text: t.text, meeting: t.meeting, source: 'minutes', cls: statusMap[t.id] || DEFAULT_STATUS });
        });
        (data.manualTasks || []).forEach(t => {
            if (seen[t.id]) return;
            seen[t.id] = true;
            model.push({ id: t.id, text: t.text, meeting: '', source: 'manual', cls: statusMap[t.id] || DEFAULT_STATUS });
        });
        return model;
    }

    // ---------------- mutations ----------------
    function setStatus(id, cls) {
        const d = getMembersData();
        d.taskStatus[id] = cls;
        saveMembersData(d);
        render();
    }

    function updateManualText(id, text) {
        const d = getMembersData();
        const t = d.manualTasks.find(x => x.id === id);
        if (t) { t.text = text; saveMembersData(d); }
    }

    function addManualTask() {
        const d = getMembersData();
        const id = 'm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
        d.manualTasks.push({ id: id, text: 'New task' });
        d.taskStatus[id] = DEFAULT_STATUS;
        saveMembersData(d);
        render();
        const el = document.querySelector('.task-card[data-task-id="' + id + '"] .task-card-text');
        if (el) { el.focus(); document.getSelection().selectAllChildren(el); }
    }

    function removeManualTask(id) {
        const d = getMembersData();
        d.manualTasks = d.manualTasks.filter(x => x.id !== id);
        delete d.taskStatus[id];
        saveMembersData(d);
        render();
    }

    // ---------------- rendering ----------------
    function makeStatusSelect(cls, onChange) {
        const sel = document.createElement('select');
        sel.className = 'ghca-task-select';
        STATUSES.forEach(s => {
            const o = document.createElement('option');
            o.value = s.cls; o.textContent = s.label;
            if (s.cls === cls) o.selected = true;
            sel.appendChild(o);
        });
        sel.addEventListener('change', () => onChange(sel.value));
        return sel;
    }

    function makeCard(t) {
        const card = document.createElement('div');
        card.className = 'task-card' + (t.cls === 'status-done' ? ' task-done' : '');
        card.dataset.taskId = t.id;

        const main = document.createElement('div');
        main.className = 'task-main';
        const text = document.createElement('span');
        text.className = 'task-card-text';
        text.textContent = t.text;
        if (editing && t.source === 'manual') {
            text.contentEditable = true;
            text.classList.add('ghca-editable');
            text.addEventListener('blur', () => updateManualText(t.id, text.textContent.trim()));
        }
        main.appendChild(text);
        if (t.meeting) {
            const m = document.createElement('span');
            m.className = 'task-meeting';
            m.textContent = 'From ' + t.meeting;
            main.appendChild(m);
        }
        card.appendChild(main);

        const actions = document.createElement('div');
        actions.className = 'task-actions';
        if (editing) {
            actions.appendChild(makeStatusSelect(t.cls, cls => setStatus(t.id, cls)));
            if (t.source === 'manual') {
                const rm = document.createElement('button');
                rm.className = 'admin-remove-btn';
                rm.type = 'button';
                rm.textContent = '\u00d7';
                rm.title = 'Remove task';
                rm.addEventListener('click', () => removeManualTask(t.id));
                actions.appendChild(rm);
            }
        } else {
            const badge = document.createElement('span');
            badge.className = 'task-status ' + t.cls;
            badge.textContent = statusLabel(t.cls);
            actions.appendChild(badge);
        }
        card.appendChild(actions);
        return card;
    }

    function ensureCompletedWrap(openItems) {
        let wrap = openItems.querySelector('.task-completed-wrap');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.className = 'task-completed-wrap';
            wrap.innerHTML = '<h3 class="task-completed-title">Completed</h3><div class="task-list task-completed"></div>';
            const note = openItems.querySelector('.task-note');
            if (note) note.insertAdjacentElement('beforebegin', wrap);
            else openItems.appendChild(wrap);
        }
        return wrap;
    }

    function renderAdminControls(openItems) {
        if (!isAdmin()) return;
        const header = openItems.querySelector('h2');
        if (header && !header.querySelector('.ghca-tasks-admin')) {
            const wrap = document.createElement('span');
            wrap.className = 'ghca-tasks-admin';

            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'admin-edit-btn';
            editBtn.textContent = editing ? '\u2713 Done' : '\u270f\ufe0f Edit Tasks';
            editBtn.addEventListener('click', () => { editing = !editing; render(); });
            wrap.appendChild(editBtn);

            const pubBtn = document.createElement('button');
            pubBtn.type = 'button';
            pubBtn.className = 'admin-edit-btn ghca-tasks-publish';
            pubBtn.textContent = 'Publish Live';
            pubBtn.title = 'Publish task changes to the live site for all members';
            pubBtn.addEventListener('click', () => { if (window.GHCAPublish) GHCAPublish.publish(); });
            wrap.appendChild(pubBtn);

            header.appendChild(wrap);
        } else if (header) {
            const editBtn = header.querySelector('.ghca-tasks-admin .admin-edit-btn');
            if (editBtn) editBtn.textContent = editing ? '\u2713 Done' : '\u270f\ufe0f Edit Tasks';
        }

        // "+ Add Task" button below the list (only while editing)
        const list = openItems.querySelector('.task-list');
        let addBtn = openItems.querySelector('#ghca-add-task');
        if (editing) {
            if (!addBtn) {
                addBtn = document.createElement('button');
                addBtn.id = 'ghca-add-task';
                addBtn.type = 'button';
                addBtn.className = 'admin-add-btn';
                addBtn.textContent = '+ Add Task';
                addBtn.addEventListener('click', addManualTask);
                list.insertAdjacentElement('afterend', addBtn);
            }
        } else if (addBtn) {
            addBtn.remove();
        }
    }

    function render() {
        const taskList = document.querySelector('.task-list');
        if (!taskList) return;
        const openItems = taskList.closest('.open-items') || taskList.parentElement;

        const model = buildModel();
        const open = model.filter(t => t.cls !== 'status-done');
        const done = model.filter(t => t.cls === 'status-done');

        taskList.innerHTML = '';
        if (!open.length) {
            const p = document.createElement('p');
            p.className = 'ghca-tasks-empty';
            p.textContent = editing
                ? 'No open tasks. Use "+ Add Task", or flag bullets as tasks in the meeting minutes.'
                : 'No open tasks right now.';
            taskList.appendChild(p);
        }
        open.forEach(t => taskList.appendChild(makeCard(t)));

        const wrap = ensureCompletedWrap(openItems);
        const completedList = wrap.querySelector('.task-completed');
        completedList.innerHTML = '';
        done.forEach(t => completedList.appendChild(makeCard(t)));
        wrap.style.display = done.length ? '' : 'none';

        renderAdminControls(openItems);
    }

    function init() {
        if (!document.querySelector('.task-list')) return;
        render();
        if (window.GHCA_ready) window.GHCA_ready(render);
    }

    window.GHCATasks = { init: init, render: render };
})();

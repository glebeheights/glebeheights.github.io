/* GHCA GitHub Publishing
   Lets admins publish their local edits to the live site by committing a single
   content file (site-content.json) to the GitHub repo via the GitHub REST API.

   Model:
   - All visitors load the published content file and apply it (shared source of truth).
   - Admin edits are kept as a local draft in localStorage until "Publish Live" commits
     them to GitHub. GitHub Pages then redeploys (~1 min) and everyone sees the update.

   Must be loaded BEFORE admin.js / admin-pages.js / script.js on every page. */
(function() {
    'use strict';

    const REPO_OWNER = 'glebeheights';
    const REPO_NAME = 'glebeheights.github.io';
    const BRANCH = 'main';
    const CONTENT_PATH = 'site-content.json';

    const TOKEN_KEY = 'ghca_gh_token';
    const ADMIN_EDITS_KEY = 'ghca-admin-edits';   // written by admin.js
    const PAGE_EDITS_KEY = 'ghca_page_edits';      // written by admin-pages.js
    const PUB_VERSION_KEY = 'ghca_pub_version';    // last published version applied locally
    const DIRTY_KEY = 'ghca_draft_dirty';          // admin has unpublished local edits

    const API_BASE = 'https://api.github.com/repos/' + REPO_OWNER + '/' + REPO_NAME + '/contents/' + CONTENT_PATH;

    // ---------------- token ----------------
    function getToken() { return (localStorage.getItem(TOKEN_KEY) || '').trim(); }
    function setToken(t) { localStorage.setItem(TOKEN_KEY, (t || '').trim()); }
    function clearToken() { localStorage.removeItem(TOKEN_KEY); }
    function hasToken() { return !!getToken(); }

    // ---------------- dirty tracking ----------------
    function markDirty() { try { localStorage.setItem(DIRTY_KEY, '1'); } catch (e) {} refreshButton(); }
    function isDirty() { return localStorage.getItem(DIRTY_KEY) === '1'; }
    function clearDirty() { localStorage.removeItem(DIRTY_KEY); refreshButton(); }

    // ---------------- edit bundle ----------------
    function readJSON(key) {
        try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; }
    }

    function collectBundle() {
        return {
            version: Date.now(),
            updatedBy: localStorage.getItem('ghca_member_email') || 'admin',
            adminEdits: readJSON(ADMIN_EDITS_KEY),
            pageEdits: readJSON(PAGE_EDITS_KEY)
        };
    }

    function applyBundleToLocal(bundle) {
        if (bundle.adminEdits) localStorage.setItem(ADMIN_EDITS_KEY, JSON.stringify(bundle.adminEdits));
        if (bundle.pageEdits) localStorage.setItem(PAGE_EDITS_KEY, JSON.stringify(bundle.pageEdits));
    }

    // ---------------- UTF-8 safe base64 ----------------
    function utf8ToBase64(str) {
        const bytes = new TextEncoder().encode(str);
        let binary = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        return btoa(binary);
    }

    // ---------------- sync: read the published file ----------------
    function fetchPublished() {
        return fetch('/' + CONTENT_PATH + '?t=' + Date.now(), { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .catch(function () { return null; });
    }

    function seedFromPublished(bundle) {
        if (!bundle || typeof bundle.version === 'undefined') return;
        // Protect an admin's unpublished local draft from being overwritten.
        if (isDirty()) return;
        const localVer = parseInt(localStorage.getItem(PUB_VERSION_KEY) || '0', 10);
        if (bundle.version === localVer) return; // already applied this version
        applyBundleToLocal(bundle);
        localStorage.setItem(PUB_VERSION_KEY, String(bundle.version));
    }

    const syncReady = fetchPublished().then(function (bundle) {
        try { seedFromPublished(bundle); } catch (e) {}
        window.__ghcaPublished = bundle || null;
    });
    window.__ghcaSyncReady = syncReady;

    // Run cb once the published content is synced AND the DOM is ready.
    window.GHCA_ready = function (cb) {
        const domReady = (document.readyState !== 'loading')
            ? Promise.resolve()
            : new Promise(function (res) { document.addEventListener('DOMContentLoaded', res); });
        Promise.all([syncReady, domReady]).then(function () { cb(); });
    };

    // ---------------- publish: write the file ----------------
    function getFileSha(token) {
        return fetch(API_BASE + '?ref=' + BRANCH, {
            headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' }
        }).then(function (r) {
            if (r.status === 200) return r.json().then(function (j) { return j.sha; });
            if (r.status === 404) return null;
            return r.json().then(function (j) { throw new Error(j.message || ('GitHub error ' + r.status)); });
        });
    }

    function putFile(token, contentB64, sha, message) {
        const body = { message: message, content: contentB64, branch: BRANCH };
        if (sha) body.sha = sha;
        return fetch(API_BASE, {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' },
            body: JSON.stringify(body)
        }).then(function (r) {
            return r.json().then(function (j) {
                if (!r.ok) throw new Error(j.message || ('GitHub error ' + r.status));
                return j;
            });
        });
    }

    function notify(msg, type) {
        if (window.GHCAAdmin && GHCAAdmin.showNotification) GHCAAdmin.showNotification(msg, type);
        else alert(msg);
    }

    function publish() {
        if (!hasToken()) { showTokenModal(publish); return; }
        const token = getToken();
        const bundle = collectBundle();
        const json = JSON.stringify(bundle, null, 2);
        const b64 = utf8ToBase64(json);

        setButtonState('publishing');
        getFileSha(token)
            .then(function (sha) {
                return putFile(token, b64, sha, 'Update site content via admin panel (' + new Date().toISOString() + ')');
            })
            .then(function () {
                localStorage.setItem(PUB_VERSION_KEY, String(bundle.version));
                clearDirty();
                setButtonState('done');
                notify('Published! The live site will update in about a minute.', 'success');
                setTimeout(function () { setButtonState('idle'); }, 3000);
            })
            .catch(function (err) {
                setButtonState('idle');
                let msg;
                if (/401|Bad credentials/i.test(err.message)) {
                    msg = 'GitHub rejected the token — it may be expired or invalid. Click "GitHub" to re-enter it.';
                } else if (/403|404|not accessible|permission/i.test(err.message)) {
                    msg = 'This token cannot write to the site repo. It needs "Contents: Read and write" on glebeheights.github.io.';
                } else {
                    msg = 'Publish failed: ' + err.message;
                }
                notify(msg, 'error');
            });
    }

    // ---------------- publish button state ----------------
    function refreshButton() {
        const btn = document.getElementById('admin-publish-btn');
        if (!btn || btn.dataset.state === 'publishing') return;
        if (isDirty()) {
            btn.textContent = 'Publish Live \u2022';
            btn.title = 'You have unpublished changes. Click to publish them to the live site.';
            btn.classList.add('admin-toolbar-publish-dirty');
        } else {
            btn.textContent = 'Publish Live';
            btn.title = 'Everything is published.';
            btn.classList.remove('admin-toolbar-publish-dirty');
        }
    }

    function setButtonState(state) {
        const btn = document.getElementById('admin-publish-btn');
        if (!btn) return;
        btn.dataset.state = state;
        if (state === 'publishing') {
            btn.textContent = 'Publishing\u2026';
            btn.disabled = true;
        } else if (state === 'done') {
            btn.textContent = 'Published \u2713';
            btn.disabled = false;
        } else {
            btn.disabled = false;
            btn.dataset.state = 'idle';
            refreshButton();
        }
    }

    // ---------------- token modal ----------------
    function showTokenModal(onSaved) {
        if (document.getElementById('ghca-token-modal')) return;
        const connected = hasToken();

        const modal = document.createElement('div');
        modal.id = 'ghca-token-modal';
        modal.className = 'admin-modal-overlay';
        modal.innerHTML = ''
            + '<div class="admin-modal admin-modal-wide">'
            + '  <button class="admin-modal-close" type="button">&times;</button>'
            + '  <h3>Connect GitHub to Publish</h3>'
            + '  <p>To publish your changes to the live website, paste a GitHub access token below. '
            + '     It is stored only in this browser and only used to update this site.</p>'
            + '  <ol class="ghca-token-steps">'
            + '    <li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub fine-grained tokens</a> (you must be signed in to a GitHub account with access to the site repo).</li>'
            + '    <li>Under <strong>Repository access</strong>, choose <strong>Only select repositories</strong> and pick <strong>glebeheights/glebeheights.github.io</strong>.</li>'
            + '    <li>Under <strong>Permissions &rsaquo; Repository permissions</strong>, set <strong>Contents</strong> to <strong>Read and write</strong>.</li>'
            + '    <li>Click <strong>Generate token</strong>, copy it, and paste it here.</li>'
            + '  </ol>'
            + '  <form id="ghca-token-form">'
            + '    <label>GitHub token</label>'
            + '    <input type="password" id="ghca-token-input" placeholder="github_pat_..." autocomplete="off" '
            +        (connected ? 'value="" ' : '') + '>'
            + '    <button type="submit">' + (connected ? 'Update Token' : 'Save Token') + '</button>'
            + '  </form>'
            + (connected ? '<button type="button" id="ghca-token-disconnect" class="ghca-token-disconnect">Disconnect this browser</button>' : '')
            + '  <p class="admin-modal-error" id="ghca-token-error">Please paste a token.</p>'
            + '</div>';
        document.body.appendChild(modal);
        requestAnimationFrame(function () { modal.classList.add('visible'); });

        function close() {
            modal.classList.remove('visible');
            setTimeout(function () { modal.remove(); }, 300);
        }

        modal.querySelector('.admin-modal-close').addEventListener('click', close);
        modal.addEventListener('click', function (e) { if (e.target === modal) close(); });

        modal.querySelector('#ghca-token-form').addEventListener('submit', function (e) {
            e.preventDefault();
            const val = document.getElementById('ghca-token-input').value.trim();
            if (!val) { document.getElementById('ghca-token-error').classList.add('visible'); return; }
            setToken(val);
            close();
            notify('GitHub connected.', 'success');
            if (typeof onSaved === 'function') onSaved();
        });

        const disc = modal.querySelector('#ghca-token-disconnect');
        if (disc) {
            disc.addEventListener('click', function () {
                clearToken();
                close();
                notify('GitHub disconnected from this browser.', 'success');
            });
        }

        const input = document.getElementById('ghca-token-input');
        if (input) input.focus();
    }

    window.GHCAPublish = {
        publish: publish,
        showTokenModal: showTokenModal,
        markDirty: markDirty,
        isDirty: isDirty,
        clearDirty: clearDirty,
        hasToken: hasToken,
        getToken: getToken,
        setToken: setToken,
        clearToken: clearToken,
        refreshButton: refreshButton
    };
})();

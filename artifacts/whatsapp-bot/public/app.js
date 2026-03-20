'use strict';

let creds = sessionStorage.getItem('bot_creds') || '';
let pollInterval = null;
let currentPage = 'overview';

// ── Utility: Fetch with Auth ──
async function fetchWithAuth(url, options = {}) {
    const headers = { 
        'Authorization': 'Basic ' + creds,
        ...options.headers
    };
    if (options.body && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
        handleLogout();
        throw new Error('Unauthorized');
    }
    return response.json();
}

// ── Authentication ──
async function handleLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    if (!username || !password) return alert('Credentials required');

    const basic = btoa(username + ':' + password);
    try {
        const response = await fetch('api/status', {
            headers: { 'Authorization': 'Basic ' + basic }
        });
        if (response.ok) {
            creds = basic;
            sessionStorage.setItem('bot_creds', creds);
            initDashboard();
        } else {
            document.getElementById('login-error').textContent = 'Invalid username or password';
        }
    } catch (err) {
        document.getElementById('login-error').textContent = 'Connection failed';
    }
}

function handleLogout() {
    sessionStorage.removeItem('bot_creds');
    location.reload();
}

// ── Dashboard Navigation ──
function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    
    document.getElementById('section-' + id).classList.add('active');
    document.querySelector(`.nav-item[data-id="${id}"]`).classList.add('active');
    
    document.getElementById('current-page-title').textContent = 
        document.querySelector(`.nav-item[data-id="${id}"] span`).textContent;
    
    currentPage = id;
    refreshData();
}

// ── Data Refresh Logic ──
async function refreshData() {
    if (!creds) return;

    try {
        const [status, health, speed, mods, bans, settings, logs] = await Promise.all([
            fetchWithAuth('api/status'),
            fetchWithAuth('api/health'),
            fetchWithAuth('api/speed'),
            fetchWithAuth('api/mods'),
            fetchWithAuth('api/bans'),
            fetchWithAuth('api/settings'),
            fetchWithAuth('api/logs?limit=50')
        ]);

        updateOverview(status, health, speed, mods);
        updateSettings(settings.settings);
        updateLists(mods.mods, bans.bans);
        updateTerminal(logs.logs);
        updateQR(status);
        
        // Dynamic stats updates
        document.getElementById('stat-uptime').textContent = formatSeconds(status.uptime || 0);
        document.getElementById('stat-ram').textContent = status.memory || '-';
        document.getElementById('stat-conn').textContent = status.connected ? 'ACTIVE' : 'OFFLINE';
        document.getElementById('stat-conn').style.color = status.connected ? 'var(--accent)' : 'var(--danger)';
        document.getElementById('sidebar-dot').className = `status-dot ${status.connected ? 'online' : ''}`;
        document.getElementById('sidebar-status-text').textContent = status.connected ? 'Synchronized' : 'Loss of Signal';

    } catch (err) {
        console.error('Refresh failed:', err);
    }
}

function updateOverview(status, health, speed, mods) {
    document.getElementById('ov-cpu').textContent = health.cpu ? health.cpu + '%' : '-';
    document.getElementById('ov-mem').textContent = health.memUsed ? health.memUsed + ' / ' + health.memTotal + ' GB' : '-';
    document.getElementById('ov-mods').textContent = mods.mods.length;
    
    // Net speed bars
    const dl = parseFloat(speed.dlKbps) || 0;
    const ul = parseFloat(speed.ulKbps) || 0;
    document.getElementById('dl-val').textContent = dl > 1024 ? (dl/1024).toFixed(1) + ' MB/s' : dl.toFixed(1) + ' KB/s';
    document.getElementById('ul-val').textContent = ul > 1024 ? (ul/1024).toFixed(1) + ' MB/s' : ul.toFixed(1) + ' KB/s';
    document.getElementById('dl-bar').style.width = Math.min(100, dl / 50) + '%';
    document.getElementById('ul-bar').style.width = Math.min(100, ul / 50) + '%';
}

function updateSettings(settings) {
    const container = document.getElementById('settings-list');
    if (!container) return;
    
    // We expect settings like 'antilink', 'nsfw', 'welcome'
    const keys = [
        { key: 'antilink', label: 'Anti-Link System', desc: 'Automatically remove members who send links' },
        { key: 'nsfw', label: 'NSFW Content', desc: 'Enable adult content commands and auto-downloads' },
        { key: 'welcome', label: 'Welcome Messages', desc: 'Greet new members in groups' },
        { key: 'public', label: 'Public Mode', desc: 'Allow everyone to use the bot commands' }
    ];

    container.innerHTML = keys.map(s => `
        <div class="setting-item">
            <div class="setting-info">
                <h4>${s.label}</h4>
                <p>${s.desc}</p>
            </div>
            <label class="switch">
                <input type="checkbox" ${settings[s.key] ? 'checked' : ''} onchange="toggleSetting('${s.key}', this.checked)">
                <span class="slider"></span>
            </label>
        </div>
    `).join('');
}

async function toggleSetting(key, value) {
    try {
        await fetchWithAuth('api/settings', {
            method: 'POST',
            body: JSON.stringify({ key, value })
        });
    } catch (err) {
        alert('Failed to update setting');
    }
}

function updateLists(mods, bans) {
    const modEl = document.getElementById('mod-list');
    const banEl = document.getElementById('ban-list');
    
    modEl.innerHTML = mods.length ? mods.map(m => `
        <div class="list-item">
            <span class="list-item-key">+${m.number}</span>
            <button class="btn-icon" onclick="removeMod('${m.jid}')">撤</button>
        </div>
    `).join('') : '<p style="color:var(--text-muted)">No active moderators</p>';

    banEl.innerHTML = bans.length ? bans.map(b => `
        <div class="list-item">
            <span class="list-item-key">+${b.number}</span>
            <button class="btn-icon" onclick="removeBan('${b.jid}')">撤</button>
        </div>
    `).join('') : '<p style="color:var(--text-muted)">No banned users</p>';
}

function updateTerminal(logs) {
    const box = document.getElementById('terminal-box');
    if (!box) return;
    
    // Only update if logs changed to avoid scroll issues
    const content = logs.map(l => {
        let type = '';
        if (l.includes('✅') || l.includes('Success')) type = 'log-ok';
        if (l.includes('❌') || l.includes('Error') || l.includes('Fatal')) type = 'log-err';
        if (l.includes('⚠️') || l.includes('Warning')) type = 'log-warn';
        
        // Extract time if possible
        const timeMatch = l.match(/\[(\d{2}:\d{2}:\d{2})\]/);
        const time = timeMatch ? `<span class="log-time">${timeMatch[1]}</span>` : '';
        const msg = l.replace(/\[\d{2}:\d{2}:\d{2}\]\s*/, '');
        
        return `<div class="log-entry">${time}<span class="${type}">${msg}</span></div>`;
    }).join('');

    const atBottom = box.scrollHeight - box.scrollTop <= box.clientHeight + 10;
    box.innerHTML = content;
    if (atBottom) box.scrollTop = box.scrollHeight;
}

async function updateQR(status) {
    const canvas = document.getElementById('qr-canvas');
    const msg = document.getElementById('qr-message');
    
    if (status.qr && !status.connected) {
        canvas.parentElement.style.display = 'inline-block';
        msg.textContent = 'Scan this QR code with your WhatsApp';
        
        if (!window.QRious) {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js');
        }
        new QRious({ element: canvas, value: status.qr, size: 240 });
    } else {
        canvas.parentElement.style.display = 'none';
        msg.textContent = status.connected ? 'Device is already connected' : 'Waiting for system signal...';
    }
}

// ── Actions ──
async function addMod() {
    const input = document.getElementById('mod-number');
    const number = input.value.trim();
    if (!number) return;
    await fetchWithAuth('api/mods', { method: 'POST', body: JSON.stringify({ number }) });
    input.value = '';
    refreshData();
}

async function addBan() {
    const input = document.getElementById('ban-number');
    const number = input.value.trim();
    if (!number) return;
    await fetchWithAuth('api/bans', { method: 'POST', body: JSON.stringify({ number }) });
    input.value = '';
    refreshData();
}

async function removeMod(jid) {
    await fetchWithAuth(`api/mods/${encodeURIComponent(jid)}`, { method: 'DELETE' });
    refreshData();
}

async function removeBan(jid) {
    await fetchWithAuth(`api/bans/${encodeURIComponent(jid)}`, { method: 'DELETE' });
    refreshData();
}

async function sysAction(url, confirmText) {
    if (confirm(confirmText)) {
        const res = await fetchWithAuth(url, { method: 'POST' });
        alert(res.message);
    }
}

// ── Lifecycle ──
function initDashboard() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    refreshData();
    pollInterval = setInterval(refreshData, 3000);
}

function formatSeconds(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return [h, m, sec].map(v => v.toString().padStart(2, '0')).join(':');
}

function loadScript(src) {
    return new Promise((resolve) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        document.head.appendChild(s);
    });
}

// Start
if (creds) {
    initDashboard();
} else {
    document.getElementById('login-screen').style.display = 'flex';
}

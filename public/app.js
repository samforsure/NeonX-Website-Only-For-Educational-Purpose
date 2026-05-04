const backendUrl = window.CONFIG?.BACKEND_URL || "";
const socket = io(backendUrl, { 
    transports: ['polling', 'websocket'],
    upgrade: true,
    rememberUpgrade: true
});
let currentUserId = null;
async function checkLogin() {
    const res = await fetch(`${backendUrl}/api/me`);
    if (!res.ok) {
        window.location.href = '/login.html';
        return;
    }
    const data = await res.json();
    currentUserId = data.id;

    if (document.getElementById('user-role-label')) document.getElementById('user-role-label').innerText = data.role.toUpperCase();
    if (document.getElementById('user-email-label')) document.getElementById('user-email-label').innerText = data.email;

    if (data.role === 'admin' && document.getElementById('user-role-label')) {
        document.getElementById('user-role-label').style.color = 'var(--accent-pink)';
    }

    // Force auth check immediately if socket already connected
    if (socket.connected) socket.emit('auth');
}
checkLogin();

// PARTICLE SYSTEM ENGINE
const canvas = document.getElementById('quantum-particles');
if (canvas) {
    const ctx = canvas.getContext('2d');
    let particles = [];
    
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    
    window.addEventListener('resize', resize);
    resize();

    class Particle {
        constructor() {
            this.reset();
        }
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            this.size = Math.random() * 2;
            this.alpha = Math.random() * 0.5;
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset();
        }
        draw() {
            ctx.fillStyle = `rgba(0, 170, 255, ${this.alpha})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    for (let i = 0; i < 150; i++) particles.push(new Particle());

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        requestAnimationFrame(animate);
    }
    animate();
}

// Socket Connectivity Monitoring
socket.on('connect', () => {
    console.log('[SOCKET] Connected to Bridge.');
    showToast('SUCCESS: QUANTUM BRIDGE SYNCED', 'success');
    socket.emit('auth'); // Authenticate once connected
    
    // Initial UI log to prevent empty appearance
    const feed = document.getElementById('log-feed');
    if (feed && feed.children.length === 0) {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = `<span class="log-time">[${new Date().toLocaleTimeString()}]</span> <span class="log-msg cyan">SYSTEM: NeonX Nexus v2 Initialized. Awaiting token deployment...</span>`;
        feed.appendChild(entry);
    }
});

socket.on('connect_error', (err) => {
    console.error('[SOCKET] Connection Error:', err);
    showToast(`CRITICAL: BRIDGE REFUSED (${err.message})`, 'error');
});

socket.on('err', (data) => {
    console.error('[SOCKET] Server Error:', data.msg);
    showToast(`BRIDGE ERROR: ${data.msg}`, 'error');
});

// Force Key Renewal Overlay
socket.on('force_key_renewal', () => {
    let overlay = document.getElementById('key-renewal-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'key-renewal-overlay';
        overlay.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.85);backdrop-filter:blur(20px);z-index:9999;display:flex;justify-content:center;align-items:center;flex-direction:column;';
        
        overlay.innerHTML = `
            <div style="background:#08090b;border:1px solid var(--accent-cyan);padding:2.5rem;border-radius:24px;text-align:center;max-width:450px;box-shadow:0 25px 50px rgba(0,0,0,0.5), 0 0 30px rgba(0,170,255,0.15);animation:macos-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                <h2 style="color:var(--accent-cyan);margin-bottom:15px;font-family:var(--font-display);letter-spacing:2px;font-size:1.2rem;"><i class="fas fa-key"></i> ACCESS EXPIRED</h2>
                <p style="color:#b5bac1;margin-bottom:25px;font-size:0.85rem;line-height:1.5;">Your 24-hour access fragment has expired. Please generate a new key from Discord (.gen key) to resume your session.</p>
                <input type="text" id="renewal-key-input" placeholder="ENTER NEW ACCESS KEY" style="width:100%;padding:15px;background:#000;border:1px solid var(--panel-border);border-radius:12px;color:#fff;margin-bottom:20px;text-align:center;font-weight:bold;letter-spacing:3px;text-transform:uppercase;transition:0.3s;" onfocus="this.style.borderColor='var(--accent-cyan)'" onblur="this.style.borderColor='var(--panel-border)'">
                <button onclick="submitKeyRenewal()" class="glow-btn pink" style="width:100%;height:50px;">VALIDATE & CONTINUE</button>
                <p id="renewal-error" style="color:#ff4444;margin-top:15px;font-size:0.8rem;display:none;font-weight:bold;"><i class="fas fa-exclamation-triangle"></i> Invalid or expired key.</p>
            </div>
        `;
        document.body.appendChild(overlay);

        window.submitKeyRenewal = async () => {
            const btn = document.querySelector('#key-renewal-overlay button');
            const key = document.getElementById('renewal-key-input').value.trim();
            if (!key) return;
            
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> VALIDATING...';
            btn.style.opacity = '0.7';
            
            try {
                const res = await fetch(`${backendUrl}/api/renew-key`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key })
                });
                const data = await res.json();
                if (data.success) {
                    overlay.style.animation = 'fade-in 0.3s ease reverse forwards';
                    setTimeout(() => {
                        overlay.remove();
                        socket.emit('auth'); // Re-authenticate session
                        showToast('ACCESS RESTORED: SESSION RESUMED', 'success');
                    }, 300);
                } else {
                    document.getElementById('renewal-error').style.display = 'block';
                    document.getElementById('renewal-error').innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${data.msg || 'Invalid key.'}`;
                    btn.innerHTML = 'VALIDATE & CONTINUE';
                    btn.style.opacity = '1';
                }
            } catch (e) {
                document.getElementById('renewal-error').style.display = 'block';
                document.getElementById('renewal-error').innerHTML = '<i class="fas fa-wifi"></i> Network Error.';
                btn.innerHTML = 'VALIDATE & CONTINUE';
                btn.style.opacity = '1';
            }
        };
    }
});

// Tab Handling
function showTab(event, tabId) {
    const tab = document.getElementById(tabId);
    if (!tab) return;

    // Handle button highlighting
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    // Determine which button triggered the event or find the corresponding nav button
    if (event) {
        event.currentTarget.classList.add('active');
    } else {
        const targetBtn = document.querySelector(`button[onclick*='${tabId}']`);
        if (targetBtn) targetBtn.classList.add('active');
    }

    // ALWAYS close other open tabs first to prevent modal stacking/blocking
    closeAllTabs();

    // Reset Token Hub state when opening it
    if (tabId === 'token-portal') {
        const qrContainer = document.getElementById('qr-container');
        if (qrContainer) qrContainer.innerHTML = '<i class="fas fa-qrcode" style="font-size: 5rem; opacity: 0.2;"></i><div class="qr-overlay-text">READY TO SYNC</div>';
        const challenge = document.getElementById('auth-challenge-container');
        if (challenge) challenge.style.display = 'none';
        const btn = document.getElementById('login-sub-btn');
        if (btn) btn.disabled = false;
    }

    if (tabId === 'sniper-portal') {
        socket.emit('get_sniper_config');
    }

    // If switching to dashboard, we're already done after closeAllTabs()

    if (tabId === 'dash') {
        // closeAllTabs already handled highlighting the dash button
    } else if (tab.classList.contains('standalone-tab')) {
        tab.classList.add('active');
    }
}

function closeAllTabs() {
    document.querySelectorAll('.standalone-tab').forEach(tab => tab.classList.remove('active'));
    // If we're closing everything, highlight Dashboard button
    const dashBtn = document.querySelector('button[onclick*="dash"]');
    if (dashBtn) {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        dashBtn.classList.add('active');
    }
}

// LOGS
socket.on('log', (data) => {
    const feed = document.getElementById('log-feed');
    const questFeed = document.getElementById('quest-feed');
    const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const logType = data.lv || 'INF';

    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `
        <span class="log-time">[${time}]</span>
        <span class="log-type ${logType}">${logType}</span>
        <span class="log-msg">${data.msg}</span>
    `;

    // Add to main feed
    if (feed) {
        feed.appendChild(entry);
        feed.scrollTop = feed.scrollHeight;
    }

    // Duplicate Quest/Success logs to Quest Terminal
    if (questFeed && (['QUEST', 'SUCCESS', 'SYS', 'ERR', 'PLAY', 'VOL', 'STAT', 'UPTIME', 'PING', 'FILTER'].includes(logType) || data.msg.toLowerCase().includes('progress') || data.msg.includes('STATE:'))) {
        const qEntry = entry.cloneNode(true);
        questFeed.appendChild(qEntry);
        questFeed.scrollTop = questFeed.scrollHeight;

        // Show toasts for important events
        if (data.msg.includes('STATE: COMPLETED')) showToast(`QUEST COMPLETED: ${data.msg.split('COMPLETED:')[1] || 'Task Finished'}`, 'success');
        if (logType === 'ERR' || data.msg.includes('ERR:')) showToast(data.msg, 'error');
    }
});

function showToast(msg, type = '') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<i class="fas ${type === 'error' ? 'fa-exclamation-triangle' : (type === 'success' ? 'fa-check-circle' : 'fa-info-circle')}"></i> <span>${msg}</span>`;
    container.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(50px)'; setTimeout(() => t.remove(), 500); }, 4000);
}

// STATUS & GAUGE UPDATE
socket.on('status', (data) => {
    const percent = Math.floor((data.clients / (data.tokens || 1)) * 100);
    const circle = document.getElementById('tokens-gauge-circle');

    // New Circumference for r=42 is ~264
    const circumference = 264;
    const offset = circumference - (percent / 100) * circumference;

    circle.style.strokeDasharray = `${circumference}`;
    circle.style.strokeDashoffset = offset;

    document.getElementById('tokens-percent').innerText = `${percent}%`;
    document.getElementById('tokens-online-txt').innerText = `${data.clients}/${data.tokens} NODES`;
    document.getElementById('total-tokens-mini').innerText = data.tokens;

    // Update active count in header
    const activeCountEl = document.getElementById('active-count');
    if (activeCountEl) activeCountEl.innerText = `${data.clients} READY`;

    // Update User Grid with REAL Profile Pictures
    const grid = document.getElementById('user-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (data.users && data.users.length > 0) {
        data.users.forEach((user, i) => {
            const u = document.createElement('div');
            u.className = 'u-card';
            const roleLabel = document.getElementById('user-role-label');
            const isAdmin = roleLabel ? roleLabel.innerText.includes('ADMIN') : false;
            u.innerHTML = `
                <img src="${user.avatar || 'https://github.com/Lucifer05321.png'}" alt="${user.username || 'Token'}">
                <span class="status-dot"></span>
                <div class="u-info">
                    <span class="u-tag">${user.tag || 'Unknown'}</span>
                    <span class="u-role">ID #${i + 1}</span>
                    ${isAdmin && user.ownerEmail ? `
                        <div class="u-admin-meta" style="font-size: 0.65rem; opacity: 0.7; margin-top: 5px; max-width: 150px;">
                            <div style="color: var(--accent-cyan); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${user.ownerEmail}">👤 ${user.ownerEmail}</div>
                            <div class="copyable-token" 
                                 onclick="navigator.clipboard.writeText('${user.token}'); showToast('Token Copied!', 'success')"
                                 style="font-family: 'JetBrains Mono', monospace; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; background: rgba(255,255,255,0.1); padding: 2px 4px; border-radius: 3px;" 
                                 title="Click to copy full token: ${user.token}">
                                🔑 ${user.token}
                            </div>
                        </div>
                    ` : ''}
                </div>
                <button class="delete-btn" onclick="deleteToken('${user.token}')" title="Remove Token">
                    <i class="fas fa-trash"></i>
                </button>
            `;
            grid.appendChild(u);
        });
    }
});

socket.on('config', (rpc) => {
    // These only exist for admins
    const fields = [
        'rpc-type', 'rpc-name', 'rpc-details', 'rpc-state', 'rpc-largeImg', 'rpc-smallImg',
        'rpc-largeTxt', 'rpc-smallTxt', 'rpc-applicationId', 'rpc-streamingUrl',
        'rpc-btn1-label', 'rpc-btn1-url', 'rpc-btn2-label', 'rpc-btn2-url'
    ];

    if (document.getElementById('rpc-name')) {
        document.getElementById('rpc-type').value = rpc.type || 'STREAMING';
        document.getElementById('rpc-name').value = rpc.name || '';
        document.getElementById('rpc-details').value = rpc.details || '';
        document.getElementById('rpc-state').value = rpc.state || '';
        document.getElementById('rpc-largeImg').value = rpc.largeImg || '';
        document.getElementById('rpc-smallImg').value = rpc.smallImg || '';
        document.getElementById('rpc-largeTxt').value = rpc.largeTxt || '';
        document.getElementById('rpc-smallTxt').value = rpc.smallTxt || '';
        document.getElementById('rpc-applicationId').value = rpc.applicationId || '';
        document.getElementById('rpc-streamingUrl').value = rpc.streamingUrl || '';

        if (rpc.buttons && rpc.buttons.length > 0) {
            document.getElementById('rpc-btn1-label').value = rpc.buttons[0].label || '';
            document.getElementById('rpc-btn1-url').value = rpc.buttons[0].url || '';
            if (rpc.buttons[1]) {
                document.getElementById('rpc-btn2-label').value = rpc.buttons[1].label || '';
                document.getElementById('rpc-btn2-url').value = rpc.buttons[1].url || '';
            }
        }
        updatePreview(rpc);
    }
});

function updatePreview(rpc) {
    if (!document.getElementById('prev-name')) return;
    document.getElementById('prev-name').innerText = rpc.name || '...';
    document.getElementById('prev-details').innerText = rpc.details || '...';
    document.getElementById('prev-state').innerText = rpc.state || '...';
    document.getElementById('prev-limg').src = rpc.largeImg || '';
    document.getElementById('prev-simg').src = rpc.smallImg || '';

    const b1 = rpc.buttons?.[0];
    const b2 = rpc.buttons?.[1];
    document.getElementById('prev-btn1').innerText = b1?.label || 'Button 1';
    document.getElementById('prev-btn2').innerText = b2?.label || 'Button 2';
}

function updateVolLabel(val) {
    document.getElementById('vol-val-label').innerText = val;
}

function sendCommand(command, args) {
    socket.emit('command', { command, args: args || [] });
}

function updateRPC() {
    const btns = [];
    const b1l = document.getElementById('rpc-btn1-label').value;
    const b1u = document.getElementById('rpc-btn1-url').value;
    if (b1l && b1u) btns.push({ label: b1l, url: b1u });

    const b2l = document.getElementById('rpc-btn2-label').value;
    const b2u = document.getElementById('rpc-btn2-url').value;
    if (b2l && b2u) btns.push({ label: b2l, url: b2u });

    const newRpc = {
        type: document.getElementById('rpc-type').value,
        name: document.getElementById('rpc-name').value,
        details: document.getElementById('rpc-details').value,
        state: document.getElementById('rpc-state').value,
        largeImg: document.getElementById('rpc-largeImg').value,
        smallImg: document.getElementById('rpc-smallImg').value,
        largeTxt: document.getElementById('rpc-largeTxt').value,
        smallTxt: document.getElementById('rpc-smallTxt').value,
        applicationId: document.getElementById('rpc-applicationId').value,
        streamingUrl: document.getElementById('rpc-streamingUrl').value,
        buttons: btns
    };

    socket.emit('update_rpc', newRpc);
    updatePreview(newRpc);
}

// TOKEN MANAGEMENT (PREMIUM v2)
function deploySingleToken() {
    const input = document.getElementById('manual-token-input');
    const token = input.value.trim().replace(/^"|"$/g, '');

    if (!token) {
        showToast('System: Please enter a valid token fragment.', 'error');
        return;
    }

    showToast('System: Initiating secure node deployment...', 'info');
    socket.emit('add_token', { token });
    input.value = '';
}

function deployBulkTokens() {
    const input = document.getElementById('bulk-tokens-input');
    const raw = input.value.trim();
    if (!raw) {
        showToast('System: No data detected in bulk expansion field.', 'error');
        return;
    }

    const tokens = raw.split('\n').map(t => t.trim().replace(/^"|"$/g, '')).filter(t => t.length > 20);

    if (tokens.length === 0) {
        showToast('System: No valid tokens found in input.', 'error');
        return;
    }

    showToast(`System: Launching batch deployment for ${tokens.length} nodes...`, 'info');

    // Staggered bulk emit to keep UI responsive
    tokens.forEach((token, i) => {
        setTimeout(() => {
            socket.emit('add_token', { token });
        }, i * 200);
    });

    input.value = '';
    showToast('Success: Bulk sequence queued.', 'success');
}

socket.on('token_added', (data) => {
    if (data.success) {
        showToast(`Success: Node ${data.tag || ''} initialized in your fleet.`, 'success');
        if (typeof fetchQuests === 'function') fetchQuests();
    } else {
        showToast(`Error: ${data.msg || 'Login failed'}`, 'error');
    }
});

function uploadTokens() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.csv';
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            const lines = event.target.result.split('\n');
            lines.forEach(line => {
                const token = line.trim().replace(/^"|"$/g, '');
                if (token.length > 20) {
                    socket.emit('add_token', { token });
                }
            });
            showToast(`System: Uploading ${lines.length} tokens...`, 'info');
        };
        reader.readAsText(file);
    };
    input.click();
}

function deleteToken(token) {
    if (confirm('Permanently decommission this node?')) {
        socket.emit('delete_token', { token });
    }
}

socket.on('token_deleted', (data) => {
    if (data.success) {
        showToast('System: Node decommissioned.', 'success');
        fetchQuests();
    }
});

// ADMIN COMMANDER LOGIC
function fetchAdminStats() {
    socket.emit('fetch_admin_stats');
    showToast('SYSTEM: Querying Central Registry...', 'info');
}

socket.on('admin_stats', (data) => {
    const userGrid = document.getElementById('admin-user-grid');
    const deletedGrid = document.getElementById('admin-deleted-grid');
    const ipGrid = document.getElementById('admin-ip-grid');
    const totalVisitsEl = document.getElementById('admin-total-visits');

    if (totalVisitsEl) totalVisitsEl.innerText = (data.totalVisits || 0).toLocaleString();

    if (userGrid) {
        userGrid.innerHTML = data.users.map(u => `
            <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; border-left: 4px solid var(--accent-cyan); margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div>
                        <div style="font-weight: bold; color: #fff; font-size: 0.95rem;">${u.email}</div>
                        <div style="font-size: 0.7rem; color: var(--accent-cyan); margin-top: 2px; letter-spacing: 1px;">ROLE: ${u.role.toUpperCase()}</div>
                    </div>
                    <div style="font-family: 'JetBrains Mono', monospace; background: rgba(0,0,0,0.3); padding: 5px 10px; border-radius: 6px; font-size: 0.8rem; cursor: pointer; color: #fff; border: 1px solid rgba(255,255,255,0.1);" 
                         onclick="navigator.clipboard.writeText('${u.password}'); showToast('Password Copied!', 'success')"
                         title="Click to Copy Password">
                        ${u.password}
                    </div>
                </div>
                
                <!-- TOKEN LISTING FOR USER -->
                <div style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px; border: 1px dashed rgba(255,255,255,0.1);">
                    <div style="font-size: 0.65rem; color: var(--text-dim); margin-bottom: 5px; font-weight: 800;">📜 OWNED TOKENS (${u.tokens?.length || 0})</div>
                    ${u.tokens && u.tokens.length > 0 ? u.tokens.map(t => `
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; font-family: 'JetBrains Mono', monospace; font-size: 0.65rem;">
                            <span style="color: var(--accent-pink); flex-shrink: 0;">#</span>
                            <div style="background: rgba(255,255,255,0.05); padding: 4px 6px; border-radius: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-grow: 1; cursor: pointer;"
                                 onclick="navigator.clipboard.writeText('${t.token}'); showToast('Token Copied!', 'success')">
                                ${t.token}
                            </div>
                        </div>
                    `).join('') : '<div style="font-size: 0.65rem; opacity: 0.5; font-style: italic;">No tokens associated.</div>'}
                </div>
            </div>
        `).join('');
    }

    if (ipGrid && data.visitLogs) {
        ipGrid.innerHTML = data.visitLogs.reverse().map(log => {
            const diff = Math.floor((Date.now() - log.at) / 60000);
            const relative = diff < 1 ? 'Just now' : `${diff}m ago`;
            return `
                <div style="padding: 6px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; gap: 2px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--accent-cyan); font-weight: bold;">${log.ip}</span>
                        <span style="opacity: 0.5; font-size: 0.6rem;">${relative}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // [NEW] Key Registry Live Sync
    const keysGrid = document.getElementById('admin-keys-grid');
    if (keysGrid && data.keys) {
        renderKeysList(data.keys);
    }

    if (deletedGrid) {
        deletedGrid.innerHTML = data.deleted.reverse().map(t => {
            const time = new Date(t.deletedAt).toLocaleString();
            return `
                <div style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(255,64,129,0.03); border-radius: 6px; margin-bottom: 8px;">
                    <div style="color: var(--accent-pink); font-weight: bold; font-size: 0.7rem; margin-bottom: 4px;">🗑️ DELETED: ${time}</div>
                    <div style="opacity: 0.7; font-size: 0.65rem;">OWNER: ${t.userId}</div>
                    <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.6rem; background: rgba(0,0,0,0.3); padding: 4px; border-radius: 4px; margin-top: 5px; word-break: break-all;">
                        ${t.token}
                    </div>
                </div>
            `;
        }).join('');
    }
});

// [NEW] Key Registry Helpers
function generateMasterKey() {
    showToast('SYSTEM: Initializing Quantum Key Generation...', 'info');
    socket.emit('generate_key');
}

function deleteKey(key) {
    if (confirm(`Decommission fragment [${key}]?`)) {
        socket.emit('delete_key', key);
        showToast('SYSTEM: Fragment revoked.', 'success');
    }
}

socket.on('admin_keys_update', (keys) => {
    renderKeysList(keys);
});

socket.on('key_generated', (data) => {
    showToast(`Key Generated: ${data.key}`, 'success');
    navigator.clipboard.writeText(data.key);
});

function renderKeysList(keys) {
    const grid = document.getElementById('admin-keys-grid');
    if (!grid) return;
    
    if (keys.length === 0) {
        grid.innerHTML = '<div style="font-size: 0.65rem; opacity: 0.5; text-align: center; padding: 20px;">No active fragments detected.</div>';
        return;
    }

    grid.innerHTML = keys.map(k => {
        const remaining = Math.max(0, k.expiresAt - Date.now());
        const hours = Math.floor(remaining / 3600000);
        const mins = Math.floor((remaining % 3600000) / 60000);
        const progress = (remaining / 86400000) * 100;
        
        return `
            <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                    <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; color: #fff; cursor: pointer;" 
                          onclick="navigator.clipboard.writeText('${k.key}'); showToast('Key Copied!', 'success')"
                          title="Click to copy key">
                        ${k.key}
                    </span>
                    <i class="fas fa-trash-alt" style="color: var(--accent-pink); font-size: 0.65rem; cursor: pointer; opacity: 0.6;" 
                       onclick="deleteKey('${k.key}')" title="Revoke Key"></i>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.55rem; color: var(--text-dim); margin-bottom: 3px;">
                    <span>EXPIRING IN</span>
                    <span>${hours}h ${mins}m</span>
                </div>
                <div style="height: 2px; background: rgba(255,255,255,0.05); border-radius: 1px; overflow: hidden;">
                    <div style="height: 100%; width: ${progress}%; background: var(--accent-cyan); box-shadow: 0 0 5px var(--accent-cyan);"></div>
                </div>
            </div>
        `;
    }).join('');
}

// Global update interval for key countdowns
setInterval(() => {
    const adminPortal = document.getElementById('admin-portal');
    if (adminPortal && adminPortal.classList.contains('active')) {
        socket.emit('fetch_keys');
    }
}, 30000);

// QUEST HUB LOGIC
let scanCooldown = false;
function fetchQuests() {
    if (scanCooldown) {
        showToast('SYSTEM: Scan cooldown active. Wait 30s.', 'error');
        return;
    }
    socket.emit('fetch_quests');
    scanCooldown = true;
    const scanBtn = document.querySelector('button[onclick="fetchQuests()"]');
    if (scanBtn) {
        scanBtn.disabled = true;
        scanBtn.style.opacity = '0.5';
        setTimeout(() => {
            scanCooldown = false;
            scanBtn.disabled = false;
            scanBtn.style.opacity = '1';
        }, 30000);
    }
}

function completeQuests(tag) {
    socket.emit('complete_quests', { tag });
    showToast('SYSTEM: Launching Quest Protocol...', 'success');
    setTimeout(fetchQuests, 2000);
}

function formatTime(seconds) {
    if (seconds <= 0) return '0s';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// Auto-refresh Quests every 5 minutes to reduce rate-limit pressure
setInterval(() => {
    const questPortal = document.getElementById('quest-portal');
    if (questPortal && questPortal.classList.contains('active')) {
        // Add a random jitter (0-20s) to stagger requests between different IDs/tabs
        setTimeout(fetchQuests, Math.random() * 20000);
    }
}, 300000);

socket.on('quest_log', (data) => {
    const questFeed = document.getElementById('quest-feed');
    if (!questFeed) return;
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `<span class="log-msg"><span class="cyan">[${data.tag}]</span> ${data.msg}</span>`;
    questFeed.appendChild(entry);
    questFeed.scrollTop = questFeed.scrollHeight;
});

socket.on('quest_progress', (data) => {
    const liveContainer = document.getElementById('live-quest-container');
    if (!liveContainer) return;

    // Remove placeholder if present
    const placeholder = liveContainer.querySelector('.la-placeholder');
    if (placeholder) placeholder.remove();

    // Find or create the chip for this session+quest
    const chipId = `op-${data.tag}-${data.id}`.replace(/[^a-zA-Z0-9-]/g, '');
    let chip = document.getElementById(chipId);

    if (!chip) {
        chip = document.createElement('div');
        chip.id = chipId;
        chip.className = 'active-op-chip';
        liveContainer.appendChild(chip);
    }

    const percent = Math.min(100, (data.current / (data.target || 1)) * 100);

    chip.innerHTML = `
        <div class="ao-info">
            <span class="ao-name">${data.name}</span>
            <span class="ao-task">${data.task.replace(/_/g, ' ')}</span>
        </div>
        <div class="ao-progress-wrap">
            <div class="ao-progress-bar" style="width: ${percent}%"></div>
        </div>
    `;

    // Also update the card in the main grid if it exists
    const cardId = `card-${data.tag}-${data.id}`.replace(/[^a-zA-Z0-9-]/g, '');
    const card = document.getElementById(cardId);
    if (card) {
        card.classList.add('processing');
        const bar = card.querySelector('.q-bar');
        const percentText = card.querySelector('.q-progress-header span:last-child');
        const statusText = card.querySelector('.q-status');

        if (bar) bar.style.width = `${percent}%`;
        if (percentText) percentText.innerText = `${Math.round(percent)}%`;
        if (statusText && !data.completed) {
            statusText.innerHTML = `<i class="fas fa-hourglass-half"></i> REMAINING: ${formatTime(data.target - data.current)}`;
        }

        // Add Live Badge if not present
        if (!card.querySelector('.q-status-badge.live')) {
            const badge = document.createElement('div');
            badge.className = 'q-status-badge live';
            badge.innerText = 'LAUNCHED';
            card.appendChild(badge);
        }
    }
});

socket.on('quests_data_chunk', (data) => {
    const grid = document.getElementById('quest-results');
    // Don't clear the grid, just append or update
    renderQuestCard(data, grid);
});

socket.on('quests_scan_finished', (data) => {
    showToast(`Scan complete: ${data.count} accounts checked.`, 'success');
});

function renderQuestCard(session, grid) {
    if (!session.quests || session.quests.length === 0) return;

    session.quests.forEach(q => {
        const cardId = `card-${session.tag}-${q.id}`.replace(/[^a-zA-Z0-9-]/g, '');
        let card = document.getElementById(cardId);
        
        if (!card) {
            card = document.createElement('div');
            card.id = cardId;
            card.className = 'quest-card';
            grid.appendChild(card);
        }

        const percent = Math.min(100, (q.current / (q.target || 1)) * 100);
        const isDone = q.completed;

        card.innerHTML = `
            <div class="q-header">
                <span class="q-tag">SESSION: ${session.tag}</span>
                <h3 class="q-title">${q.name}</h3>
            </div>
            <div class="q-progress-container">
                <div class="q-progress-header">
                    <span>PROGRESSION</span>
                    <span>${Math.round(percent)}%</span>
                </div>
                <div class="q-progress">
                    <div class="q-bar" style="width: ${percent}%"></div>
                </div>
            </div>
            <div class="q-status">
                ${isDone ? '<span class="q-done"><i class="fas fa-check-circle"></i> COMPLETED</span>' : `<i class="fas fa-hourglass-half"></i> REMAINING: ${formatTime(q.target - q.current)}`}
            </div>
            ${isDone ? '<div class="q-status-badge done">FINALIZED</div>' : ''}
        `;

        // 3D TILT EFFECT LOGIC
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const xc = rect.width / 2;
            const yc = rect.height / 2;
            const dx = x - xc;
            const dy = y - yc;
            card.style.transform = `translateY(-10px) rotateX(${-dy / 10}deg) rotateY(${dx / 10}deg)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    });
    
    updateFleetGlobalStats();
}

function updateFleetGlobalStats() {
    const grid = document.getElementById('quest-results');
    const cards = grid.querySelectorAll('.quest-card');
    
    let totalPercent = 0;
    let count = cards.length;

    cards.forEach(card => {
        const percentText = card.querySelector('.q-progress-header span:last-child');
        if (percentText) {
            totalPercent += parseInt(percentText.innerText) || 0;
        }
    });

    const fleetBar = document.getElementById('fleet-progress');
    const fleetTxt = document.getElementById('fleet-percent');
    if (fleetBar && fleetTxt) {
        const globalPercent = count > 0 ? Math.floor(totalPercent / count) : 0;
        fleetBar.style.width = `${globalPercent}%`;
        fleetTxt.innerText = `${globalPercent}%`;
    }
}

socket.on('quests_data', (data) => {
    const grid = document.getElementById('quest-results');
    if (grid) {
        grid.innerHTML = '';
        data.forEach(session => renderQuestCard(session, grid));
    }
});

// GIVEAWAY SNIPER LOGIC
let sniperSettings = { enabled: false, delay: 3000, whitelistBots: [], whitelistChannels: [] };

socket.on('sniper_config', (config) => {
    sniperSettings = config;
    updateSniperUI();
});

socket.on('sniper_sync', (data) => {
    updateFleetCard(data);
});

socket.on('sniper_log', (data) => {
    const sniperFeed = document.getElementById('sniper-feed');
    if (!sniperFeed) return;
    const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `
        <span class="log-time">[${time}]</span>
        <span class="log-msg"><span class="cyan">[${data.tag}]</span> ${data.msg}</span>
    `;
    sniperFeed.appendChild(entry);
    sniperFeed.scrollTop = sniperFeed.scrollHeight;

    if (data.success) showToast(`GIVEAWAY SNIPED: ${data.msg}`, 'success');
});

function updateSniperUI() {
    const toggleTrack = document.getElementById('sniper-toggle-track');
    const toggleThumb = document.getElementById('sniper-toggle-thumb');
    const toggleLabel = document.getElementById('sniper-toggle-label');
    const statusText = document.getElementById('sniper-status-text');
    const radar = document.getElementById('sniper-radar');
    const delayInput = document.getElementById('sniper-delay');
    
    // Roxy Extras
    const allTrack = document.getElementById('snipe-all-track');
    const allThumb = document.getElementById('snipe-all-thumb');
    const allLabel = document.getElementById('snipe-all-label');

    const nitroTrack = document.getElementById('nitro-sniper-track');
    const nitroThumb = document.getElementById('nitro-sniper-thumb');
    const nitroLabel = document.getElementById('nitro-sniper-label');

    const joinTrack = document.getElementById('auto-join-track');
    const joinThumb = document.getElementById('auto-join-thumb');
    const joinLabel = document.getElementById('auto-join-label');

    if (sniperSettings.enabled) {
        toggleTrack.classList.add('active');
        toggleThumb.classList.add('active');
        toggleLabel.innerText = 'OPERATIONAL';
        statusText.innerText = 'QUANTUM CORE ACTIVE';
        statusText.style.color = 'var(--accent-cyan)';
        if (radar) radar.classList.add('active');
    } else {
        toggleTrack.classList.remove('active');
        toggleThumb.classList.remove('active');
        toggleLabel.innerText = 'DISABLED';
        statusText.innerText = 'OFFLINE';
        statusText.style.color = 'var(--text-dim)';
        if (radar) radar.classList.remove('active');
    }

    // Toggle Sync Helper
    const syncToggle = (set, track, thumb, label, onTxt) => {
        if (!track) return;
        if (set) {
            track.classList.add('active');
            thumb.classList.add('active');
            label.innerText = onTxt;
        } else {
            track.classList.remove('active');
            thumb.classList.remove('active');
            label.innerText = 'OFF';
        }
    };

    syncToggle(sniperSettings.snipeAllBots, allTrack, allThumb, allLabel, 'GLOBAL');
    syncToggle(sniperSettings.nitroSniper, nitroTrack, nitroThumb, nitroLabel, 'ACTIVE');
    syncToggle(sniperSettings.autoJoin, joinTrack, joinThumb, joinLabel, 'ENABLED');

    if (delayInput && document.activeElement !== delayInput) delayInput.value = sniperSettings.delay || 3000;

    renderSniperChips('bots');
    renderSniperChips('channels');
}

function renderSniperChips(type) {
    const container = document.getElementById(`sniper-${type.slice(0, -1)}-chips`);
    const list = type === 'bots' ? sniperSettings.whitelistBots : sniperSettings.whitelistChannels;
    if (!container) return;

    container.innerHTML = '';
    list.forEach(id => {
        const chip = document.createElement('div');
        chip.className = 'id-chip glass';
        chip.innerHTML = `
            <span>${id}</span>
            <i class="fas fa-times delete-id" onclick="removeSniperId('${type}', '${id}')"></i>
        `;
        container.appendChild(chip);
    });
}

function addSniperId(type) {
    const input = document.getElementById(`sniper-${type.slice(0, -1)}-input`);
    if (!input || !input.value.trim()) return;

    // Handle single or multi-paste (comma/space/newline)
    const newIds = input.value.split(/[\n, ]/).map(id => id.trim()).filter(id => id.length > 5);
    const list = type === 'bots' ? sniperSettings.whitelistBots : sniperSettings.whitelistChannels;

    newIds.forEach(id => {
        if (!list.includes(id)) list.push(id);
    });

    input.value = '';
    renderSniperChips(type);
    saveSniperSettings();
    showToast(`${newIds.length} ID(s) Deployed to Fleet`, 'success');
}

function removeSniperId(type, id) {
    const list = type === 'bots' ? sniperSettings.whitelistBots : sniperSettings.whitelistChannels;
    const index = list.indexOf(id);
    if (index > -1) {
        list.splice(index, 1);
        renderSniperChips(type);
        saveSniperSettings();
    }
}

function updateFleetCard(data) {
    const fleetList = document.getElementById('sniper-fleet-list');
    if (!fleetList) return;

    let card = document.querySelector(`.fleet-item[data-tag="${data.tag}"]`);
    if (!card) {
        const empty = fleetList.querySelector('.fleet-empty');
        if (empty) empty.remove();
        card = document.createElement('div');
        card.className = 'fleet-item glass';
        card.setAttribute('data-tag', data.tag);
        fleetList.appendChild(card);
    }

    const channels = data.channels && data.channels.length > 0 ? `${data.channels.length} CHANNELS` : 'GLOBAL';
    card.innerHTML = `
        <div class="f-info">
            <div class="f-tag">${data.tag}</div>
            <div class="f-status ${data.enabled ? 'active' : ''}">${data.enabled ? 'SCANNING' : 'IDLE'}</div>
        </div>
        <div class="f-meta">
            <i class="fas fa-satellite-dish"></i> ${channels}
        </div>
    `;
}

let saveTimeout;
function instantSaveSniper() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveSniperSettings();
    }, 800);
}

function toggleSniper() {
    sniperSettings.enabled = !sniperSettings.enabled;
    updateSniperUI();
    saveSniperSettings();
}

function toggleSnipeAll() {
    sniperSettings.snipeAllBots = !sniperSettings.snipeAllBots;
    updateSniperUI();
    saveSniperSettings();
}

function toggleNitro() {
    sniperSettings.nitroSniper = !sniperSettings.nitroSniper;
    updateSniperUI();
    saveSniperSettings();
}

function toggleAutoJoin() {
    sniperSettings.autoJoin = !sniperSettings.autoJoin;
    updateSniperUI();
    saveSniperSettings();
}

function saveSniperSettings() {
    const delay = parseInt(document.getElementById('sniper-delay').value) || 3000;
    sniperSettings.delay = delay;
    socket.emit('update_sniper_config', sniperSettings);
}

// Enter Key listeners for ID adding
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        if (document.activeElement.id === 'sniper-bot-input') addSniperId('bots');
        if (document.activeElement.id === 'sniper-channel-input') addSniperId('channels');
    }
});




// ==================== UI ENHANCEMENTS (QUANTUM ULTRA) ====================


function logout() {
    window.location.href = '/api/logout';
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const target = current === 'blood' ? 'neon' : 'blood';
    document.documentElement.setAttribute('data-theme', target);
    localStorage.setItem('neonx_theme', target);
    showToast(`Theme switched to ${target.toUpperCase()} RED`, 'success');
}

// Particle Engine
function initParticles() {
    const canvas = document.getElementById('quantum-particles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    class Particle {
        constructor() {
            this.reset();
        }
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            this.size = Math.random() * 2;
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset();
        }
    }

    for (let i = 0; i < 100; i++) particles.push(new Particle());

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Dynamic color based on theme
        const color = getComputedStyle(document.documentElement).getPropertyValue('--accent-cyan');
        ctx.fillStyle = color;
        ctx.strokeStyle = color;

        ctx.globalAlpha = 0.2;

        particles.forEach(p => {
            p.update();
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.lineWidth = 0.5;
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 150) {
                    ctx.globalAlpha = (1 - dist / 150) * 0.1;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }
        requestAnimationFrame(animate);
    }
    animate();
}

// Initializing
document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    const savedTheme = localStorage.getItem('neonx_theme');
    if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
});

// TOKEN HUB v3 LOGIC
function switchTokenTab(event, targetId) {
    document.querySelectorAll('.token-tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.m-tab-btn').forEach(b => b.classList.remove('active'));

    document.getElementById(targetId).classList.add('active');
    event.currentTarget.classList.add('active');
}

// QR LOGIC
function generateQR() {
    const btn = document.getElementById('gen-qr-btn');
    const status = document.getElementById('qr-status');
    const qrContainer = document.getElementById('qr-container');

    btn.disabled = true;
    btn.innerText = 'INITIALIZING...';
    status.innerText = 'CONNECTING TO AUTH GATEWAY...';

    socket.emit('initiate_qr_login');
}

socket.on('qr_data', (data) => {
    const qrContainer = document.getElementById('qr-container');
    const status = document.getElementById('qr-status');
    const btn = document.getElementById('gen-qr-btn');

    if (data.image) {
        qrContainer.innerHTML = `<img src="${data.image}" alt="Discord QR Code">`;
        status.innerText = 'WAITING FOR SCAN...';
        btn.innerText = 'QR GENERATED';
    } else if (data.status) {
        status.innerText = data.status.toUpperCase();
    }
});

// DIRECT LOGIN LOGIC
function initiateLogin() {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    const code2fa = document.getElementById('login-2fa').value.trim();

    const btn = document.getElementById('login-sub-btn');

    if (!email || !pass) {
        showToast('Error: Email and password are required.', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerText = 'AUTHENTICATING...';

    socket.emit('initiate_credential_login', {
        email,
        pass,
        code: code2fa,
        captchaToken: window.hcaptchaToken || null
    });
}

socket.on('login_status', (data) => {
    const btn = document.getElementById('login-sub-btn');
    const challenge = document.getElementById('auth-challenge-container');
    const sec2fa = document.getElementById('2fa-section');
    const secCaptcha = document.getElementById('captcha-section');

    if (data.error) {
        showToast(`Auth Error: ${data.error}`, 'error');
        btn.disabled = false;
        btn.innerText = 'RE-INITIALIZE LOGIN';
    }

    if (data.step === '2fa') {
        challenge.style.display = 'block';
        sec2fa.style.display = 'block';
        btn.disabled = false;
        btn.innerText = 'SUBMIT 2FA CODE';
        showToast('Login: Two-Factor Authentication required.', 'info');
    }

    if (data.step === 'captcha') {
        challenge.style.display = 'block';
        secCaptcha.style.display = 'block';
        btn.disabled = true;
        btn.innerText = 'SOLVE CAPTCHA ABOVE';

        // Render hCaptcha
        if (window.hcaptcha) {
            hcaptcha.render('hcaptcha-widget', {
                sitekey: data.sitekey,
                callback: (token) => {
                    window.hcaptchaToken = token;
                    btn.disabled = false;
                    btn.innerText = 'CAPTCHA SOLVED - PROCEED';
                    initiateLogin(); // Resubmit with token
                }
            });
        }
    }

    if (data.success) {
        showToast('Success: Account Linked via Credentials!', 'success');
        closeAllTabs();
    }
});

socket.on('qr_success', (data) => {
    showToast(`Success: ${data.tag} Linked via QR!`, 'success');
    closeAllTabs();
});

// ACCESS KEY RENEWAL
async function renewKey() {
    const key = document.getElementById('renewal-key').value.trim();
    if (!key) return showToast('Error: Please enter a new key.', 'error');

    const res = await fetch('/api/renew-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
    });

    if (res.ok) {
        document.getElementById('key-renewal-modal').classList.remove('active');
        showToast('SUCCESS: ACCESS RESTORED', 'success');
        // Re-authenticate socket
        socket.emit('auth');
    } else {
        const data = await res.json();
        showToast(`ERROR: ${data.msg}`, 'error');
    }
}

// REFERRAL SYSTEM
function copyRefLink() {
    const input = document.getElementById('ref-link-input');
    input.select();
    document.execCommand('copy');
    showToast('Link Copied to Clipboard!', 'success');
}

async function redeemInviteKey() {
    try {
        const res = await fetch('/api/redeem-invite-key', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast(`KEY REDEEMED: ${data.key}`, 'success');
            socket.emit('get_ref_stats'); // Refresh
        } else {
            showToast(data.msg, 'error');
        }
    } catch (e) {
        showToast('Redemption Failed', 'error');
    }
}

socket.on('ref_stats_update', (data) => {
    document.getElementById('my-invites-val').innerText = data.invites;
    document.getElementById('my-rank-val').innerText = data.rank;
    document.getElementById('ref-link-input').value = `${window.location.origin}/register.html?ref=${data.email}`;

    const lbList = document.getElementById('leaderboard-list');
    lbList.innerHTML = data.leaderboard.map((u, i) => `
        <div class="lb-item glass" style="display: flex; justify-content: space-between; padding: 10px 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
            <div style="display: flex; gap: 10px; align-items: center;">
                <span style="font-weight: 800; color: var(--accent-cyan);">#${i + 1}</span>
                <span style="font-size: 0.85rem; opacity: 0.8;">${u.email}</span>
            </div>
            <span style="font-weight: 700; color: var(--accent-pink);">${u.invites} 🔥</span>
        </div>
    `).join('');
});

// ADMIN ACTIONS
function fetchAdminStats() {
    socket.emit('fetch_admin_stats');
    showToast('Refreshing system intelligence...', 'info');
}

function generateMasterKey() {
    socket.emit('admin_generate_key', '24h');
    showToast('Initializing 24H Fragment...', 'info');
}

socket.on('admin_stats', (data) => {
    // 1. Render User Grid
    const userGrid = document.getElementById('admin-user-grid');
    if (userGrid) {
        userGrid.innerHTML = data.users.map(u => `
            <div class="user-card glass" style="padding: 15px; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; background: rgba(0,0,0,0.3);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <div>
                        <div style="font-weight: 800; color: var(--accent-cyan); font-size: 0.9rem;">${u.email}</div>
                        <div style="font-size: 0.65rem; opacity: 0.6; font-family: var(--font-mono);">${u.id}</div>
                    </div>
                    <div style="background: ${u.role === 'admin' ? 'var(--accent-pink)' : 'rgba(255,255,255,0.1)'}; padding: 2px 8px; border-radius: 4px; font-size: 0.6rem; font-weight: 900;">
                        ${u.role.toUpperCase()}
                    </div>
                </div>
                <div style="display: flex; gap: 15px; font-size: 0.75rem;">
                    <div><span style="opacity: 0.5;">PASS:</span> <span style="color: #fff; font-family: var(--font-mono);">${u.password}</span></div>
                    <div><span style="opacity: 0.5;">INVITES:</span> <span style="color: var(--accent-pink);">${u.invites || 0}</span></div>
                    <div><span style="opacity: 0.5;">TOKENS:</span> <span style="color: var(--accent-cyan);">${u.tokens?.length || 0}</span></div>
                </div>
            </div>
        `).join('') || '<div style="text-align:center; opacity:0.5; padding:20px;">No users registered yet.</div>';
    }

    // 2. Total Visits
    if (document.getElementById('admin-total-visits')) {
        document.getElementById('admin-total-visits').innerText = data.totalVisits.toLocaleString();
    }

    // 3. IP Logs
    const ipGrid = document.getElementById('admin-ip-grid');
    if (ipGrid) {
        ipGrid.innerHTML = data.visitLogs.reverse().map(l => `
            <div style="padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <span style="color: var(--accent-pink);">[${new Date(l.at).toLocaleTimeString()}]</span> 
                <span style="color: var(--accent-cyan);">${l.ip}</span> - 
                <span style="opacity: 0.8;">${l.userId}</span>
            </div>
        `).join('') || 'No activity detected.';
    }

    // 4. Active Keys
    const keysGrid = document.getElementById('admin-keys-grid');
    if (keysGrid) {
        keysGrid.innerHTML = data.keys.map(k => `
            <div class="key-item glass" style="padding: 15px; border: 1px solid var(--accent-cyan); border-radius: 12px; margin-bottom: 10px; transition: 0.3s; background: rgba(0, 170, 255, 0.05); position: relative;">
                <div style="display: flex; justify-content: space-between; font-size: 0.7rem; margin-bottom: 8px;">
                    <span style="color: var(--accent-cyan); font-weight: 900; text-transform: uppercase;">FRAGMENT NODE</span>
                    <span style="opacity: 0.7; font-weight: bold;">EXPIRES: ${new Date(k.expiresAt).toLocaleTimeString()}</span>
                </div>
                <div style="font-family: var(--font-mono); font-size: 1.1rem; color: #fff; letter-spacing: 3px; font-weight: 900; text-align: center; cursor: pointer; text-shadow: 0 0 10px var(--accent-cyan);" onclick="copyToClipboard('${k.key}')">${k.key}</div>
                <div style="display: flex; gap: 8px; margin-top: 12px;">
                    <button class="glow-btn mini cyan" onclick="copyToClipboard('${k.key}')" style="flex: 1.5; height: 32px; font-size: 0.6rem; font-weight: 900;">COPY</button>
                    <button class="glow-btn mini blue" onclick="editKey('${k.key}')" style="flex: 1; height: 32px; font-size: 0.6rem; font-weight: 900;"><i class="fas fa-edit"></i></button>
                    <button class="glow-btn mini red" onclick="deleteKey('${k.key}')" style="flex: 1; height: 32px; font-size: 0.6rem; font-weight: 900;"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        `).join('') || '<div style="text-align:center; opacity:0.5; padding:20px;">No active 24H fragments.</div>';
    }

    // 5. Deleted Tokens
    const delGrid = document.getElementById('admin-deleted-grid');
    if (delGrid) {
        delGrid.innerHTML = data.deleted.map(t => `
            <div style="padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.05); opacity: 0.7;">
                <span style="color: #ff4d4d;">[DELETED]</span> ${t.userId} - <span style="font-size:0.6rem;">${t.token.substring(0,20)}...</span>
            </div>
        `).join('') || 'No deletions backed up.';
    }
});

function deleteKey(key) {
    if (confirm(`CRITICAL: Are you sure you want to REVOKE fragment ${key}? This action is permanent.`)) {
        socket.emit('admin_delete_key', key);
        showToast('Revoking Access...', 'info');
    }
}

function editKey(key) {
    const hours = prompt('Enter new validity duration in HOURS (e.g., 48, 72, 168):', '24');
    if (hours && !isNaN(hours)) {
        socket.emit('admin_edit_key', { key, hours: parseInt(hours) });
        showToast('Updating Fragment Lifespan...', 'info');
    }
}

function copyToClipboard(text) {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast('FRAGMENT COPIED TO CLIPBOARD', 'success');
}

socket.on('admin_keys_update', (keys) => {
    fetchAdminStats(); // Lazy refresh
});

// ==================== WELCOME ENGINE ====================
let welcomeConfig = {
    enabled: false,
    delay: 2000,
    channels: [],
    messages: [],
    pingUser: false
};

socket.on('welcome_config', (config) => {
    if (config) {
        welcomeConfig = { ...welcomeConfig, ...config };
        updateWelcomeUI();
    }
});

socket.on('welcome_sync', (data) => {
    const statusText = document.getElementById('welcome-status-text');
    if (statusText) {
        statusText.innerText = data.enabled ? 'ACTIVE' : 'OFFLINE';
        statusText.style.color = data.enabled ? 'var(--accent-cyan)' : 'var(--text-dim)';
    }
});

socket.on('welcome_log', (data) => {
    const feed = document.getElementById('welcome-feed');
    if (!feed) return;
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const logColor = data.success ? 'var(--accent-cyan)' : 'var(--accent-pink)';
    entry.innerHTML = `<span class="log-msg"><span style="color:${logColor}; font-weight:bold;">[${data.tag}]</span> ${data.msg}</span>`;
    feed.appendChild(entry);
    feed.scrollTop = feed.scrollHeight;
});

function toggleWelcomeEngine() {
    welcomeConfig.enabled = !welcomeConfig.enabled;
    socket.emit('update_welcome_config', welcomeConfig);
    updateWelcomeUI();
}

function toggleWelcomePing() {
    welcomeConfig.pingUser = !welcomeConfig.pingUser;
    instantSaveWelcome();
}

function updateWelcomeUI() {
    // Toggle
    const toggleTrack = document.getElementById('welcome-toggle-track');
    const toggleLabel = document.getElementById('welcome-toggle-label');
    if (toggleTrack && toggleLabel) {
        if (welcomeConfig.enabled) {
            toggleTrack.classList.add('active');
            toggleLabel.innerText = 'ENABLED';
            toggleLabel.style.color = 'var(--accent-cyan)';
        } else {
            toggleTrack.classList.remove('active');
            toggleLabel.innerText = 'DISABLED';
            toggleLabel.style.color = 'var(--text-dim)';
        }
    }

    // Ping Toggle
    const pingTrack = document.getElementById('welcome-ping-track');
    const pingLabel = document.getElementById('welcome-ping-label');
    if (pingTrack && pingLabel) {
        if (welcomeConfig.pingUser) {
            pingTrack.classList.add('active');
            pingLabel.innerText = 'ON';
            pingLabel.style.color = 'var(--accent-cyan)';
        } else {
            pingTrack.classList.remove('active');
            pingLabel.innerText = 'OFF';
            pingLabel.style.color = 'var(--text-dim)';
        }
    }

    // Delay
    const delayInput = document.getElementById('welcome-delay');
    if (delayInput) delayInput.value = welcomeConfig.delay;

    // Messages
    const messagesInput = document.getElementById('welcome-messages');
    if (messagesInput) messagesInput.value = welcomeConfig.messages.join('\n');

    // Channels
    renderWelcomeChannels();
}

function addWelcomeChannel() {
    const input = document.getElementById('welcome-channel-input');
    const val = input.value.trim();
    if (val && !welcomeConfig.channels.includes(val)) {
        welcomeConfig.channels.push(val);
        input.value = '';
        instantSaveWelcome();
    }
}

function removeWelcomeChannel(val) {
    welcomeConfig.channels = welcomeConfig.channels.filter(c => c !== val);
    instantSaveWelcome();
}

function renderWelcomeChannels() {
    const container = document.getElementById('welcome-channel-chips');
    if (!container) return;
    container.innerHTML = welcomeConfig.channels.map(c => `
        <div class="chip">
            ${c} <i class="fas fa-times" onclick="removeWelcomeChannel('${c}')"></i>
        </div>
    `).join('');
}

function instantSaveWelcome() {
    const delay = parseInt(document.getElementById('welcome-delay').value) || 2000;
    const messages = document.getElementById('welcome-messages').value.split('\n').map(m => m.trim()).filter(m => m.length > 0);
    
    welcomeConfig.delay = delay;
    welcomeConfig.messages = messages;
    
    socket.emit('update_welcome_config', welcomeConfig);
    updateWelcomeUI();
}

// Ensure the config is fetched when the welcome tab is opened
const originalShowTab = showTab;
showTab = function(event, tabId) {
    originalShowTab(event, tabId);
    if (tabId === 'welcome-portal') {
        socket.emit('get_welcome_config');
    }
};

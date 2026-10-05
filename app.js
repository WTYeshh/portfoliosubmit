/**
 * PORTFOLIO DROP — STUDENT SUBMISSION & ADMIN VAULT
 * Secured with double-click Admin Authentication
 */

(function () {
  'use strict';

  // Ensure no persistent admin session is kept
  try {
    sessionStorage.removeItem('portfolio_admin_unlocked');
  } catch (e) {}

  // Constants
  const STORAGE_KEY = 'portfolio_vault_student_v1';
  const ADMIN_PASS = 'dsaandcode';

  let portfolios = [];
  let isServerConnected = false;
  let isAdmin = false; // Always locked by default

  // DOM Elements - Public Form
  const form = document.getElementById('portfolioForm');
  const nameInput = document.getElementById('studentName');
  const usnInput = document.getElementById('studentUsn');
  const urlInput = document.getElementById('portfolioUrl');
  const submitBtn = document.getElementById('submitBtn');
  const pasteBtn = document.getElementById('pasteClipboardBtn');
  const platformIconContainer = document.getElementById('platformIconContainer');
  const vercelPresetBtn = document.getElementById('vercelPresetBtn');
  const storageModeLabel = document.getElementById('storageModeLabel');

  // Admin Header & Auth Elements
  const adminLogoBtn = document.getElementById('adminLogoBtn');
  const adminStatusContainer = document.getElementById('adminStatusContainer');
  const publicStatusBadge = document.getElementById('publicStatusBadge');
  const headerCountBadge = document.getElementById('headerCountBadge');
  const viewVaultBtn = document.getElementById('viewVaultBtn');
  const lockAdminBtn = document.getElementById('lockAdminBtn');

  // Admin Password Modal Elements
  const adminPassModal = document.getElementById('adminPassModal');
  const passDialog = document.getElementById('passDialog');
  const adminPassForm = document.getElementById('adminPassForm');
  const adminPasswordInput = document.getElementById('adminPasswordInput');
  const adminPassError = document.getElementById('adminPassError');
  const cancelAdminPassBtn = document.getElementById('cancelAdminPassBtn');
  const togglePassVisibility = document.getElementById('togglePassVisibility');
  const adminPassBackdrop = document.getElementById('adminPassBackdrop');

  // Admin Submissions Vault Modal
  const vaultModal = document.getElementById('vaultModal');
  const closeVaultBtn = document.getElementById('closeVaultBtn');
  const vaultBackdrop = document.getElementById('vaultBackdrop');
  const vaultList = document.getElementById('vaultList');
  const vaultTotalBadge = document.getElementById('vaultTotalBadge');
  const vaultSearchInput = document.getElementById('vaultSearchInput');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const copyAllBtn = document.getElementById('copyAllBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');

  const toastContainer = document.getElementById('toastContainer');
  const confettiCanvas = document.getElementById('confettiCanvas');

  // =========================================================================
  // Initialize Admin State
  // =========================================================================
  function updateAdminUIState() {
    if (isAdmin) {
      adminStatusContainer.style.display = 'flex';
      publicStatusBadge.style.display = 'none';
    } else {
      adminStatusContainer.style.display = 'none';
      publicStatusBadge.style.display = 'flex';
    }
  }

  // =========================================================================
  // Data Storage & Synchronization
  // =========================================================================
  function loadLocalPortfolios() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('LocalStorage error:', e);
      return [];
    }
  }

  function saveLocalPortfolios(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('LocalStorage write failed:', e);
    }
  }

  async function checkServerAndSync() {
    try {
      const res = await fetch('/api/portfolios', { method: 'GET', cache: 'no-cache' });
      if (res.ok) {
        const body = await res.json();
        isServerConnected = true;
        storageModeLabel.textContent = 'Auto-saving to CSV & JSON';

        const serverList = body.data || [];
        const localList = loadLocalPortfolios();

        // Unique merge
        const map = new Map();
        serverList.forEach(item => map.set(item.id || item.url, item));
        localList.forEach(item => {
          if (!map.has(item.id || item.url)) {
            map.set(item.id || item.url, item);
          }
        });

        portfolios = Array.from(map.values());
        saveLocalPortfolios(portfolios);
        updateCounters();
        if (isAdmin) renderVault();
        return;
      }
    } catch (err) {
      isServerConnected = false;
      storageModeLabel.textContent = 'Browser Storage Active';
    }

    portfolios = loadLocalPortfolios();
    updateCounters();
    if (isAdmin) renderVault();
  }

  async function addPortfolio(entry) {
    portfolios.unshift(entry);
    saveLocalPortfolios(portfolios);
    updateCounters();
    if (isAdmin) renderVault();

    if (isServerConnected) {
      try {
        await fetch('/api/portfolios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry)
        });
      } catch (err) {
        console.warn('Failed to sync with local server:', err);
      }
    }
  }

  async function removePortfolio(id) {
    portfolios = portfolios.filter(p => p.id !== id);
    saveLocalPortfolios(portfolios);
    updateCounters();
    renderVault();

    if (isServerConnected) {
      try {
        await fetch(`/api/portfolios/${id}`, { method: 'DELETE' });
      } catch (err) {
        console.warn('Failed to delete on server:', err);
      }
    }

    showToast('Deleted', 'Entry removed from submissions', 'info');
  }

  function updateCounters() {
    const count = portfolios.length;
    if (headerCountBadge) headerCountBadge.textContent = count;
    if (vaultTotalBadge) vaultTotalBadge.textContent = `${count} submission${count === 1 ? '' : 's'}`;
  }

  // =========================================================================
  // Admin Authentication & Trigger Flow
  // Double-click top left logo to access admin (always prompts for password)
  // =========================================================================
  adminLogoBtn.addEventListener('dblclick', (e) => {
    e.preventDefault();
    openAdminPassModal();
  });

  function openAdminPassModal() {
    adminPassModal.classList.add('is-open');
    adminPassModal.setAttribute('aria-hidden', 'false');
    adminPasswordInput.value = '';
    adminPassError.style.display = 'none';
    passDialog.classList.remove('shake');
    setTimeout(() => adminPasswordInput.focus(), 150);
  }

  function closeAdminPassModal() {
    adminPassModal.classList.remove('is-open');
    adminPassModal.setAttribute('aria-hidden', 'true');
    adminPasswordInput.value = '';
    adminPassError.style.display = 'none';
  }

  cancelAdminPassBtn.addEventListener('click', closeAdminPassModal);
  adminPassBackdrop.addEventListener('click', closeAdminPassModal);

  togglePassVisibility.addEventListener('click', () => {
    const type = adminPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    adminPasswordInput.setAttribute('type', type);
  });

  adminPassForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const entered = adminPasswordInput.value.trim();

    let verified = false;

    // Verify against server if available, or compare with ADMIN_PASS
    if (isServerConnected) {
      try {
        const res = await fetch('/api/admin/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: entered })
        });
        const data = await res.json();
        if (data.success) {
          verified = true;
        }
      } catch (err) {
        // Fallback to local check
        if (entered === ADMIN_PASS) verified = true;
      }
    } else {
      if (entered === ADMIN_PASS) verified = true;
    }

    if (verified) {
      isAdmin = true;
      closeAdminPassModal();
      updateAdminUIState();
      showToast('Admin Access Granted 🔓', 'Welcome to Submissions Vault', 'success');
      openVault();
    } else {
      adminPassError.style.display = 'block';
      passDialog.classList.remove('shake');
      void passDialog.offsetWidth; // re-trigger animation
      passDialog.classList.add('shake');
      adminPasswordInput.select();
    }
  });

  // Lock Admin Access
  if (lockAdminBtn) {
    lockAdminBtn.addEventListener('click', () => {
      isAdmin = false;
      updateAdminUIState();
      closeVault();
      showToast('Admin Locked 🔒', 'Admin access locked successfully', 'info');
    });
  }

  // =========================================================================
  // Student Submission Form
  // Collects: Name, USN, and Portfolio/GitHub Link
  // =========================================================================
  // Auto-uppercase Name & allow only letters and spaces
  nameInput.addEventListener('input', () => {
    nameInput.value = nameInput.value.replace(/[^A-Za-z\s]/g, '').toUpperCase();
  });

  // Auto-uppercase USN & alphanumeric only
  usnInput.addEventListener('input', () => {
    usnInput.value = usnInput.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  });

  // Strict HTTPS URL validator
  function isValidHttpsUrl(str) {
    if (!str || typeof str !== 'string') return false;
    const clean = str.trim();
    if (!clean.startsWith('https://')) return false;

    try {
      const parsed = new URL(clean);
      if (parsed.protocol !== 'https:') return false;
      const hostname = parsed.hostname;
      if (!hostname || hostname.length < 3) return false;
      // Must have valid domain with dot and valid TLD (e.g. xyz.vercel.app)
      if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/.test(hostname)) {
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  // Quick Preset: Only Vercel
  if (vercelPresetBtn) {
    vercelPresetBtn.addEventListener('click', () => {
      urlInput.value = 'https://.vercel.app';
      urlInput.focus();
      // Set cursor right after 'https://' so student can instantly type 'xyz'
      urlInput.setSelectionRange(8, 8);
    });
  }

  // Paste from clipboard button
  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        urlInput.value = text.trim();
        urlInput.focus();
        showToast('Pasted', 'Link inserted from clipboard', 'info');
      }
    } catch (err) {
      urlInput.focus();
      showToast('Paste', 'Press Ctrl+V to paste link', 'info');
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = nameInput.value.trim().toUpperCase();
    const usn = usnInput.value.trim().toUpperCase();
    let rawUrl = urlInput.value.trim();

    // 1. Strict Name validation: characters and spaces only, at least 2 characters
    if (!name || !/^[A-Z\s]{2,60}$/.test(name)) {
      showToast('Invalid Name', 'Name must contain letters only (A-Z) and at least 2 characters', 'warning');
      nameInput.focus();
      return;
    }

    // 2. Strict USN validation: alphanumeric only, at least 4 characters
    if (!usn || !/^[A-Z0-9]{4,20}$/.test(usn)) {
      showToast('Invalid USN', 'USN must be a valid alphanumeric ID (e.g. 1MS21CS001)', 'warning');
      usnInput.focus();
      return;
    }

    // 3. Strict URL validation: must be a valid HTTPS URL (no random numbers, words or gibberish)
    if (!/^https?:\/\//i.test(rawUrl)) {
      if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(rawUrl)) {
        rawUrl = 'https://' + rawUrl;
      }
    }

    if (!isValidHttpsUrl(rawUrl)) {
      showToast('Invalid URL', 'Please enter a valid https:// URL (e.g. https://xyz.vercel.app)', 'warning');
      urlInput.focus();
      return;
    }

    const isVercel = rawUrl.toLowerCase().includes('vercel');
    const newEntry = {
      id: 'pf_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      name: name,
      usn: usn,
      url: rawUrl,
      platform: isVercel ? 'Vercel' : (rawUrl.toLowerCase().includes('github.com') ? 'GitHub' : 'Portfolio'),
      timestamp: new Date().toISOString()
    };

    addPortfolio(newEntry);

    // Trigger celebration
    triggerConfetti();
    showToast('Submitted Successfully! 🚀', `Thank you ${name} (${usn})! Saved to file.`, 'success');

    // Reset Form
    nameInput.value = '';
    usnInput.value = '';
    urlInput.value = '';
    nameInput.focus();
  });

  // =========================================================================
  // Admin Vault Drawer Rendering & Exports
  // =========================================================================
  function openVault() {
    if (!isAdmin) {
      openAdminPassModal();
      return;
    }
    vaultModal.classList.add('is-open');
    vaultModal.setAttribute('aria-hidden', 'false');
    vaultSearchInput.value = '';
    renderVault();
    vaultSearchInput.focus();
  }

  function closeVault() {
    vaultModal.classList.remove('is-open');
    vaultModal.setAttribute('aria-hidden', 'true');
    // Lock admin immediately on close - never keep logged in
    isAdmin = false;
    updateAdminUIState();
  }

  if (viewVaultBtn) viewVaultBtn.addEventListener('click', openVault);
  closeVaultBtn.addEventListener('click', closeVault);
  vaultBackdrop.addEventListener('click', closeVault);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (adminPassModal.classList.contains('is-open')) closeAdminPassModal();
      if (vaultModal.classList.contains('is-open')) closeVault();
    }
  });

  vaultSearchInput.addEventListener('input', (e) => {
    renderVault(e.target.value);
  });

  function renderVault(filterTerm = '') {
    const query = filterTerm.trim().toLowerCase();
    const filtered = portfolios.filter(p => {
      if (!query) return true;
      return (
        (p.name && p.name.toLowerCase().includes(query)) ||
        (p.usn && p.usn.toLowerCase().includes(query)) ||
        (p.url && p.url.toLowerCase().includes(query))
      );
    });

    if (filtered.length === 0) {
      if (portfolios.length === 0) {
        vaultList.innerHTML = `
          <div class="vault-empty-state">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
            </svg>
            <p><strong>No submissions collected yet</strong></p>
            <p style="font-size: 0.8rem; margin-top: 4px;">Student submissions will appear here in real-time.</p>
          </div>
        `;
      } else {
        vaultList.innerHTML = `
          <div class="vault-empty-state">
            <p>No results matching "<em>${escapeHtml(query)}</em>"</p>
          </div>
        `;
      }
      return;
    }

    vaultList.innerHTML = filtered.map(item => {
      const timeStr = formatRelativeTime(item.timestamp);
      return `
        <div class="vault-item" data-id="${item.id}">
          <div class="vault-item-header">
            <div class="vault-creator">
              <span class="creator-name">${escapeHtml(item.name || 'Anonymous')}</span>
              <span class="usn-badge">${escapeHtml(item.usn || 'N/A')}</span>
            </div>
            <span style="font-size: 0.72rem; color: #a5b4fc; font-weight: 600;">${escapeHtml(item.platform || 'Link')}</span>
          </div>

          <div class="vault-url-box">
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="vault-url" title="${escapeHtml(item.url)}">
              ${escapeHtml(item.url)}
            </a>
            <div class="vault-item-actions">
              <button class="icon-action-btn btn-copy" data-url="${escapeHtml(item.url)}" title="Copy Link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
              <button class="icon-action-btn btn-delete" data-id="${item.id}" title="Delete Entry">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>

          <div class="vault-item-footer">
            <span>Submitted ${timeStr}</span>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" style="color: #93c5fd; text-decoration: none; font-weight: 600;">
              Open Link ↗
            </a>
          </div>
        </div>
      `;
    }).join('');

    // Attach row events
    vaultList.querySelectorAll('.btn-copy').forEach(btn => {
      btn.addEventListener('click', () => {
        copyTextToClipboard(btn.dataset.url);
        showToast('Copied!', 'Link copied to clipboard', 'info');
      });
    });

    vaultList.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        removePortfolio(btn.dataset.id);
      });
    });
  }

  // Export CSV
  exportCsvBtn.addEventListener('click', () => {
    if (portfolios.length === 0) {
      showToast('Empty Vault', 'No submissions to export', 'info');
      return;
    }

    if (isServerConnected) {
      window.location.href = '/api/export/csv';
      showToast('Downloading CSV', 'portfolios.csv downloaded', 'success');
      return;
    }

    const sanitize = (str) => `"${String(str || '').replace(/"/g, '""').replace(/\r?\n|\r/g, ' ')}"`;
    let csv = 'ID,Name,USN,Portfolio_URL,Platform,Submitted_At\n';
    portfolios.forEach(item => {
      csv += [
        sanitize(item.id),
        sanitize(item.name || 'Anonymous'),
        sanitize(item.usn || 'N/A'),
        sanitize(item.url),
        sanitize(item.platform || 'GitHub'),
        sanitize(item.timestamp)
      ].join(',') + '\n';
    });

    downloadFile(csv, 'portfolios.csv', 'text/csv;charset=utf-8;');
    showToast('Downloaded CSV', 'portfolios.csv ready for Excel/Sheets', 'success');
  });

  // Export JSON
  exportJsonBtn.addEventListener('click', () => {
    if (portfolios.length === 0) {
      showToast('Empty Vault', 'No submissions to export', 'info');
      return;
    }
    const jsonStr = JSON.stringify(portfolios, null, 2);
    downloadFile(jsonStr, 'portfolios.json', 'application/json');
    showToast('Downloaded JSON', 'portfolios.json exported', 'success');
  });

  // Copy All Entries
  copyAllBtn.addEventListener('click', () => {
    if (portfolios.length === 0) {
      showToast('Empty Vault', 'No submissions to copy', 'info');
      return;
    }
    const formatted = portfolios.map(p => `${p.name} (${p.usn}): ${p.url}`).join('\n');
    copyTextToClipboard(formatted);
    showToast('Copied All!', `${portfolios.length} entries copied to clipboard`, 'success');
  });

  // Clear All
  clearAllBtn.addEventListener('click', () => {
    if (portfolios.length === 0) return;
    if (confirm('Are you sure you want to permanently clear all submissions?')) {
      portfolios = [];
      saveLocalPortfolios([]);
      updateCounters();
      renderVault();
      showToast('Cleared', 'All submissions removed', 'info');
    }
  });

  // =========================================================================
  // Helper Utilities
  // =========================================================================
  function showToast(title, desc, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          ${type === 'success' ? '<path d="M20 6L9 17l-5-5"/>' : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'}
        </svg>
      </div>
      <div class="toast-content">
        <div class="toast-title">${escapeHtml(title)}</div>
        ${desc ? `<div class="toast-desc">${escapeHtml(desc)}</div>` : ''}
      </div>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  function downloadFile(content, fileName, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatRelativeTime(isoString) {
    if (!isoString) return 'recently';
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  // Lightweight Confetti
  function triggerConfetti() {
    const ctx = confettiCanvas.getContext('2d');
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;

    const colors = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];
    const particles = [];

    for (let i = 0; i < 70; i++) {
      particles.push({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2 - 40,
        vx: (Math.random() - 0.5) * 15,
        vy: (Math.random() - 0.8) * 15,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        alpha: 1,
        decay: Math.random() * 0.02 + 0.015
      });
    }

    function renderParticles() {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      let alive = false;

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.4;
        p.vx *= 0.98;
        p.rotation += p.rotationSpeed;
        p.alpha -= p.decay;

        if (p.alpha > 0) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        }
      });

      if (alive) {
        requestAnimationFrame(renderParticles);
      } else {
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      }
    }

    requestAnimationFrame(renderParticles);
  }

  window.addEventListener('resize', () => {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  });

  // Run initialization
  updateAdminUIState();
  checkServerAndSync();
})();

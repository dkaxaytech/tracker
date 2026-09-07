/**
 * Personal Attendance Tracker
 * Single-user attendance management with localStorage persistence.
 */

// =============================================================================
// 1. Storage Manager (localStorage with YYYY-MM-DD key format)
// =============================================================================
const Storage = {
  // Regex to identify attendance record keys (YYYY-MM-DD)
  dateKeyPattern: /^\d{4}-\d{2}-\d{2}$/,

  /**
   * Retrieves an attendance record for a specific date.
   * @param {string} dateKey - Format 'YYYY-MM-DD'
   * @returns {Object|null}
   */
  get(dateKey) {
    try {
      const data = localStorage.getItem(dateKey);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error(`Error reading record for ${dateKey}:`, e);
      return null;
    }
  },

  /**
   * Saves an attendance record with the date as the primary key.
   * @param {string} dateKey - Format 'YYYY-MM-DD'
   * @param {Object} record
   */
  save(dateKey, record) {
    try {
      localStorage.setItem(dateKey, JSON.stringify(record));
      return true;
    } catch (e) {
      console.error(`Error saving record for ${dateKey}:`, e);
      return false;
    }
  },

  /**
   * Deletes an attendance record.
   * @param {string} dateKey - Format 'YYYY-MM-DD'
   */
  delete(dateKey) {
    try {
      localStorage.removeItem(dateKey);
      return true;
    } catch (e) {
      console.error(`Error deleting record for ${dateKey}:`, e);
      return false;
    }
  },

  /**
   * Retrieves all attendance records currently in localStorage.
   * @returns {Array<Object>}
   */
  getAll() {
    const records = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && this.dateKeyPattern.test(key)) {
        const item = this.get(key);
        if (item) records.push(item);
      }
    }
    return records;
  },

  /**
   * Retrieves all attendance records for a specific year and month.
   * @param {number} year - 4-digit year (e.g. 2026)
   * @param {number} month - 0-indexed month (0 = Jan, 11 = Dec)
   * @returns {Array<Object>}
   */
  getMonthRecords(year, month) {
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const all = this.getAll();
    return all.filter(record => record.date && record.date.startsWith(monthPrefix));
  },

  /**
   * Retrieves all records as a map of dateKey -> record.
   * @returns {Object}
   */
  getAllAsMap() {
    const map = {};
    const all = this.getAll();
    all.forEach(item => {
      if (item.date) map[item.date] = item;
    });
    return map;
  },

  /**
   * Merges an incoming map of records into localStorage.
   * Compares updatedAt timestamps to keep the latest changes.
   * @param {Object} recordsMap
   * @returns {number} count of updated records
   */
  mergeFromMap(recordsMap) {
    if (!recordsMap || typeof recordsMap !== 'object') return 0;
    let count = 0;
    Object.keys(recordsMap).forEach(dateKey => {
      if (this.dateKeyPattern.test(dateKey)) {
        const incoming = recordsMap[dateKey];
        const existing = this.get(dateKey);
        if (!existing) {
          this.save(dateKey, incoming);
          count++;
        } else {
          const incomingTime = new Date(incoming.updatedAt || 0).getTime();
          const existingTime = new Date(existing.updatedAt || 0).getTime();
          if (incomingTime >= existingTime) {
            this.save(dateKey, incoming);
            count++;
          }
        }
      }
    });
    return count;
  },

  /**
   * Clears all attendance date keys from localStorage.
   */
  clearAll() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && this.dateKeyPattern.test(key)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  }
};

// =============================================================================
// 2. Date & Calculation Utilities
// =============================================================================
const DateUtils = {
  /**
   * Formats year, month (0-indexed), and day into 'YYYY-MM-DD'.
   */
  formatDateKey(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  },

  /**
   * Returns today's date formatted as 'YYYY-MM-DD'.
   */
  getTodayKey() {
    const now = new Date();
    return this.formatDateKey(now.getFullYear(), now.getMonth(), now.getDate());
  },

  /**
   * Returns current local time formatted as 'HH:MM'.
   */
  getCurrentTime() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  },

  /**
   * Parses 'YYYY-MM-DD' into { year, month (0-indexed), day }.
   */
  parseDateKey(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number);
    return { year: y, month: m - 1, day: d };
  },

  /**
   * Checks if a date falls on Saturday (6) or Sunday (0).
   * @param {string} dateKey - 'YYYY-MM-DD'
   * @returns {boolean}
   */
  isWeekend(dateKey) {
    if (!dateKey) return false;
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay(); // 0 = Sun, 6 = Sat
    return dayOfWeek === 0 || dayOfWeek === 6;
  },

  /**
   * Formats 'YYYY-MM-DD' into a user-friendly string (e.g., 'Friday, Sep 4, 2026').
   */
  formatDisplayDate(dateKey) {
    if (!dateKey) return '';
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },

  /**
   * Formats Month and Year heading (e.g., 'September 2026').
   */
  formatMonthYear(year, month) {
    const date = new Date(year, month, 1);
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  },

  /**
   * Converts minutes into 'Xh Ym' string.
   */
  formatHoursMinutes(totalMinutes) {
    if (isNaN(totalMinutes) || totalMinutes < 0) return '0h 0m';
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${mins}m`;
  },

  /**
   * Calculates net working hours given login, logout, and break.
   * Supports shifts crossing midnight (e.g. 22:00 to 06:00).
   *
   * Formula: logout - login - break
   *
   * @param {string} loginStr - 'HH:MM'
   * @param {string} logoutStr - 'HH:MM'
   * @param {number} breakMinutes - Break in minutes
   * @returns {Object} calculation result
   */
  calculateWorkingHours(loginStr, logoutStr, breakMinutes = 0) {
    if (!loginStr || !logoutStr) {
      return {
        valid: false,
        totalMinutes: 0,
        formatted: '0h 0m',
        isOvernight: false,
        error: 'Please enter both login and logout times.'
      };
    }

    const [loginH, loginM] = loginStr.split(':').map(Number);
    const [logoutH, logoutM] = logoutStr.split(':').map(Number);

    if (isNaN(loginH) || isNaN(loginM) || isNaN(logoutH) || isNaN(logoutM)) {
      return {
        valid: false,
        totalMinutes: 0,
        formatted: '0h 0m',
        isOvernight: false,
        error: 'Invalid time format.'
      };
    }

    let breakVal = parseInt(breakMinutes, 10);
    if (isNaN(breakVal) || breakVal < 0) {
      breakVal = 0;
    }

    const loginTotalMinutes = loginH * 60 + loginM;
    let logoutTotalMinutes = logoutH * 60 + logoutM;
    let isOvernight = false;

    // Overnight shift: logout is earlier than login
    if (logoutTotalMinutes < loginTotalMinutes) {
      logoutTotalMinutes += 24 * 60; // Add 24 hours (1440 minutes)
      isOvernight = true;
    }

    const grossDuration = logoutTotalMinutes - loginTotalMinutes;

    if (breakVal > grossDuration) {
      return {
        valid: false,
        totalMinutes: 0,
        formatted: '0h 0m',
        isOvernight,
        error: `Break (${breakVal}m) exceeds total shift duration (${this.formatHoursMinutes(grossDuration)}).`
      };
    }

    const netMinutes = grossDuration - breakVal;

    return {
      valid: true,
      totalMinutes: netMinutes,
      formatted: this.formatHoursMinutes(netMinutes),
      isOvernight,
      error: null
    };
  }
};

// =============================================================================
// 3. Cloud Sync & Backup Engine (GitHub REST API + Unauthenticated Fallback)
// =============================================================================
const CloudSync = {
  CONFIG_KEY: 'tracker_cloud_config',
  CACHE_SHA_KEY: 'tracker_cloud_sha',
  LAST_SYNC_KEY: 'tracker_last_sync_time',

  /**
   * UTF-8 safe base64 encoder
   */
  toBase64(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) =>
      String.fromCharCode('0x' + p1)
    ));
  },

  /**
   * UTF-8 safe base64 decoder
   */
  fromBase64(b64) {
    return decodeURIComponent(Array.prototype.map.call(atob(b64), c =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
  },

  getConfig() {
    try {
      const raw = localStorage.getItem(this.CONFIG_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {
      owner: 'dkaxaytech',
      repo: 'tracker',
      branch: 'main',
      path: 'data/attendance.json',
      token: ''
    };
  },

  saveConfig(cfg) {
    localStorage.setItem(this.CONFIG_KEY, JSON.stringify(cfg));
  },

  getToken() {
    return this.getConfig().token || '';
  },

  setToken(token) {
    const cfg = this.getConfig();
    cfg.token = (token || '').trim();
    this.saveConfig(cfg);
  },

  clearToken() {
    const cfg = this.getConfig();
    cfg.token = '';
    this.saveConfig(cfg);
    localStorage.removeItem(this.CACHE_SHA_KEY);
  },

  getLastSyncTime() {
    return localStorage.getItem(this.LAST_SYNC_KEY) || null;
  },

  setLastSyncTime() {
    localStorage.setItem(this.LAST_SYNC_KEY, new Date().toISOString());
  },

  /**
   * Pulls latest attendance records from GitHub.
   * If token is present: uses authenticated GitHub API and caches SHA.
   * If token is not present: uses raw.githubusercontent.com for unauthenticated cross-browser read.
   */
  async pull() {
    const cfg = this.getConfig();
    const token = cfg.token;

    try {
      if (token) {
        const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}?ref=${cfg.branch}&_t=${Date.now()}`;
        const res = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json'
          }
        });

        if (res.status === 404) {
          return { success: true, count: 0, sha: null };
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (res.status === 403) {
            throw new Error("Token lacks access to 'tracker' repo. Use your Classic Token (ghp_) with 'repo' scope.");
          }
          if (res.status === 401) {
            throw new Error("Invalid or expired GitHub token. Please check and re-enter your token.");
          }
          throw new Error(err.message || `GitHub error ${res.status}`);
        }

        const data = await res.json();
        if (data.sha) {
          localStorage.setItem(this.CACHE_SHA_KEY, data.sha);
        }

        if (data.content) {
          const cleanB64 = data.content.replace(/\s/g, '');
          const decoded = this.fromBase64(cleanB64);
          const parsed = JSON.parse(decoded);
          if (parsed && parsed.records) {
            const count = Storage.mergeFromMap(parsed.records);
            this.setLastSyncTime();
            return { success: true, count, sha: data.sha };
          }
        }
        return { success: true, count: 0, sha: data.sha };
      } else {
        // Unauthenticated read via raw GitHub CDN
        const rawUrl = `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${cfg.path}?_t=${Date.now()}`;
        const res = await fetch(rawUrl);
        if (res.ok) {
          const parsed = await res.json();
          if (parsed && parsed.records) {
            const count = Storage.mergeFromMap(parsed.records);
            this.setLastSyncTime();
            return { success: true, count };
          }
        }
        return { success: true, count: 0 };
      }
    } catch (e) {
      console.warn('CloudSync.pull failed:', e);
      return { success: false, count: 0, error: e.message };
    }
  },

  /**
   * Pushes local attendance records to GitHub via Contents API.
   */
  async push() {
    const cfg = this.getConfig();
    if (!cfg.token) {
      return { success: false, error: 'No GitHub token configured in this browser.' };
    }

    try {
      // 1. Fetch latest SHA from GitHub
      let latestSha = localStorage.getItem(this.CACHE_SHA_KEY);
      const getUrl = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}?ref=${cfg.branch}&_t=${Date.now()}`;
      const getRes = await fetch(getUrl, {
        headers: {
          'Authorization': `Bearer ${cfg.token}`,
          'Accept': 'application/vnd.github+json'
        }
      });

      if (getRes.status === 403) {
        throw new Error("Token lacks access to 'tracker' repo. Use your Classic Token (ghp_) with 'repo' scope.");
      }
      if (getRes.status === 401) {
        throw new Error("Invalid or expired GitHub token. Please check and re-enter your token.");
      }

      if (getRes.ok) {
        const fileInfo = await getRes.json();
        latestSha = fileInfo.sha;
        localStorage.setItem(this.CACHE_SHA_KEY, latestSha);

        // Merge any remote records that may have been saved from another browser
        if (fileInfo.content) {
          try {
            const remoteParsed = JSON.parse(this.fromBase64(fileInfo.content.replace(/\s/g, '')));
            if (remoteParsed && remoteParsed.records) {
              Storage.mergeFromMap(remoteParsed.records);
            }
          } catch (err) {}
        }
      }

      // 2. Prepare JSON payload
      const allRecords = Storage.getAllAsMap();
      const payload = {
        version: 1,
        lastUpdated: new Date().toISOString(),
        records: allRecords
      };

      const jsonStr = JSON.stringify(payload, null, 2);
      const b64Content = this.toBase64(jsonStr);

      const putBody = {
        message: `Sync attendance records [${new Date().toLocaleDateString()}]`,
        content: b64Content,
        branch: cfg.branch
      };
      if (latestSha) {
        putBody.sha = latestSha;
      }

      // 3. Put to GitHub Contents API
      const putUrl = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}`;
      const putRes = await fetch(putUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${cfg.token}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(putBody)
      });

      if (!putRes.ok) {
        const err = await putRes.json().catch(() => ({}));
        if (putRes.status === 403 || (err.message && err.message.includes('not accessible by personal access token'))) {
          throw new Error("Token lacks access to 'tracker' repo. Use your Classic Token (starts with 'ghp_') with 'repo' scope.");
        }
        if (putRes.status === 401) {
          throw new Error("Invalid or expired GitHub token. Please re-enter your Classic Token.");
        }
        throw new Error(err.message || `Push failed (status ${putRes.status})`);
      }

      const putResult = await putRes.json();
      if (putResult && putResult.content && putResult.content.sha) {
        localStorage.setItem(this.CACHE_SHA_KEY, putResult.content.sha);
      }

      this.setLastSyncTime();
      return { success: true };
    } catch (e) {
      console.error('CloudSync.push error:', e);
      return { success: false, error: e.message };
    }
  }
};

// =============================================================================
// 4. Application State & Controller
// =============================================================================
class AttendanceApp {
  constructor() {
    const today = new Date();
    this.viewYear = today.getFullYear();
    this.viewMonth = today.getMonth(); // 0 - 11
    this.selectedDate = DateUtils.getTodayKey();
    this.unlockedDates = new Set();

    this.cacheDomElements();
    this.bindEvents();
    this.render();
    this.initCloudSync();
  }

  cacheDomElements() {
    // Header & Navigation
    this.todayBtn = document.getElementById('today-btn');
    this.prevMonthBtn = document.getElementById('prev-month-btn');
    this.nextMonthBtn = document.getElementById('next-month-btn');
    this.calendarMonthYear = document.getElementById('calendar-month-year');
    this.calendarGrid = document.getElementById('calendar-grid');

    // Cloud Sync & Backup Elements
    this.syncModalBtn = document.getElementById('sync-modal-btn');
    this.syncStatusDot = document.getElementById('sync-status-dot');
    this.syncStatusText = document.getElementById('sync-status-text');
    this.syncModal = document.getElementById('sync-modal');
    this.closeSyncModal = document.getElementById('close-sync-modal');
    this.tabBtnCloud = document.getElementById('tab-btn-cloud');
    this.tabBtnBackup = document.getElementById('tab-btn-backup');
    this.tabCloud = document.getElementById('tab-cloud');
    this.tabBackup = document.getElementById('tab-backup');
    this.syncRepoDisplay = document.getElementById('sync-repo-display');
    this.modalSyncBadge = document.getElementById('modal-sync-badge');
    this.modalLastSynced = document.getElementById('modal-last-synced');
    this.cloudSyncForm = document.getElementById('cloud-sync-form');
    this.syncTokenInput = document.getElementById('sync-token-input');
    this.toggleTokenVisibility = document.getElementById('toggle-token-visibility');
    this.syncNowBtn = document.getElementById('sync-now-btn');
    this.saveTokenBtn = document.getElementById('save-token-btn');
    this.disconnectSyncBtn = document.getElementById('disconnect-sync-btn');
    this.exportBackupBtn = document.getElementById('export-backup-btn');
    this.importBackupBtn = document.getElementById('import-backup-btn');
    this.importFileInput = document.getElementById('import-file-input');

    // KPI Cards
    this.cardTodayHours = document.getElementById('card-today-hours');
    this.cardTodayStatus = document.getElementById('card-today-status');
    this.cardMonthHours = document.getElementById('card-month-hours');
    this.cardMonthLabel = document.getElementById('card-month-label');
    this.cardDaysLogged = document.getElementById('card-days-logged');
    this.cardDaysMeta = document.getElementById('card-days-meta');

    // Attendance Entry Form
    this.entrySelectedDate = document.getElementById('entry-selected-date');
    this.entryBadge = document.getElementById('entry-badge');
    this.formAlert = document.getElementById('form-alert');
    this.form = document.getElementById('attendance-form');
    this.shiftInput = document.getElementById('shift-input');
    this.loginInput = document.getElementById('login-time');
    this.logoutInput = document.getElementById('logout-time');
    this.loginNowBtn = document.getElementById('login-now-btn');
    this.logoutNowBtn = document.getElementById('logout-now-btn');
    this.loginLockedBadge = document.getElementById('login-locked-badge');
    this.loginUnlockBtn = document.getElementById('login-unlock-btn');
    this.breakInput = document.getElementById('break-time');
    this.calculatedHours = document.getElementById('calculated-hours');
    this.overnightIndicator = document.getElementById('overnight-indicator');
    this.saveBtn = document.getElementById('save-btn');
    this.deleteBtn = document.getElementById('delete-btn');
    this.clearBtn = document.getElementById('clear-btn');

    // Leave / Holiday Controls
    this.markLeaveBtn = document.getElementById('mark-leave-btn');
    this.unblockLeaveBtn = document.getElementById('unblock-leave-btn');
    this.leaveFormModal = document.getElementById('leave-form-modal');
    this.closeLeaveModal = document.getElementById('close-leave-modal');
    this.leaveTypeSelect = document.getElementById('leave-type-select');
    this.leaveReasonInput = document.getElementById('leave-reason-input');
    this.confirmLeaveBtn = document.getElementById('confirm-leave-btn');
    this.cancelLeaveBtn = document.getElementById('cancel-leave-btn');

    // History Table
    this.historyHeading = document.getElementById('history-heading');
    this.historySubtitle = document.getElementById('history-subtitle');
    this.historyCountBadge = document.getElementById('history-count-badge');
    this.historyTbody = document.getElementById('history-tbody');
    this.historyEmpty = document.getElementById('history-empty');

    // Toast
    this.toast = document.getElementById('toast');
  }

  bindEvents() {
    // Today button
    this.todayBtn.addEventListener('click', () => {
      const now = new Date();
      this.viewYear = now.getFullYear();
      this.viewMonth = now.getMonth();
      this.selectedDate = DateUtils.getTodayKey();
      this.render();
      this.showToast('Navigated to Today', 'info');
    });

    // Month navigation
    this.prevMonthBtn.addEventListener('click', () => {
      this.viewMonth--;
      if (this.viewMonth < 0) {
        this.viewMonth = 11;
        this.viewYear--;
      }
      this.render();
    });

    this.nextMonthBtn.addEventListener('click', () => {
      this.viewMonth++;
      if (this.viewMonth > 11) {
        this.viewMonth = 0;
        this.viewYear++;
      }
      this.render();
    });

    // Form inputs: Live calculation listeners
    const liveInputs = [this.loginInput, this.logoutInput, this.breakInput];
    liveInputs.forEach(input => {
      input.addEventListener('input', () => this.updateLiveCalculation());
      input.addEventListener('change', () => this.updateLiveCalculation());
    });

    // Set Login to Current Time via Now button
    this.loginNowBtn.addEventListener('click', () => {
      if (this.loginInput.disabled) return;
      const cur = DateUtils.getCurrentTime();
      this.loginInput.value = cur;
      this.updateLiveCalculation();
      this.showToast(`Login time set to ${cur}`, 'info');
    });

    // Set Logout to Current Time via Now button
    this.logoutNowBtn.addEventListener('click', () => {
      if (this.logoutInput.disabled) return;
      const cur = DateUtils.getCurrentTime();
      this.logoutInput.value = cur;
      this.updateLiveCalculation();
      this.showToast(`Logout time set to ${cur}`, 'info');
    });

    // Clicking directly on Login input: auto-populate if empty
    this.loginInput.addEventListener('click', () => {
      if (!this.loginInput.disabled && !this.loginInput.value) {
        const cur = DateUtils.getCurrentTime();
        this.loginInput.value = cur;
        this.updateLiveCalculation();
        this.showToast(`Login time set to ${cur}`, 'info');
      }
    });

    // Clicking directly on Logout input: auto-populate if empty
    this.logoutInput.addEventListener('click', () => {
      if (!this.logoutInput.disabled && !this.logoutInput.value) {
        const cur = DateUtils.getCurrentTime();
        this.logoutInput.value = cur;
        this.updateLiveCalculation();
        this.showToast(`Logout time set to ${cur}`, 'info');
      }
    });

    // Unlock Login Time for editing
    this.loginUnlockBtn.addEventListener('click', () => {
      this.unlockedDates.add(this.selectedDate);
      this.renderEntryForm();
      this.loginInput.focus();
      this.showToast('Login time unlocked for editing', 'info');
    });

    // Form submission (Save / Update)
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleFormSubmit();
    });

    // Delete record button
    this.deleteBtn.addEventListener('click', () => {
      this.handleDeleteRecord();
    });

    // Clear form button
    this.clearBtn.addEventListener('click', () => {
      this.resetFormInputs();
      this.hideAlert();
      this.updateLiveCalculation();
    });

    // Leave / Holiday Events
    this.markLeaveBtn.addEventListener('click', () => {
      if (DateUtils.isWeekend(this.selectedDate)) {
        this.showAlert('Saturdays and Sundays are already weekly leaves.', 'info');
        return;
      }
      this.leaveFormModal.style.display = 'block';
      this.leaveReasonInput.focus();
    });

    this.closeLeaveModal.addEventListener('click', () => {
      this.leaveFormModal.style.display = 'none';
    });

    this.cancelLeaveBtn.addEventListener('click', () => {
      this.leaveFormModal.style.display = 'none';
    });

    this.confirmLeaveBtn.addEventListener('click', () => {
      this.handleConfirmLeave();
    });

    this.unblockLeaveBtn.addEventListener('click', () => {
      this.handleUnblockLeave();
    });

    // Cloud Sync Modal Toggle
    if (this.syncModalBtn) {
      this.syncModalBtn.addEventListener('click', () => {
        this.openSyncModal();
      });
    }

    if (this.closeSyncModal) {
      this.closeSyncModal.addEventListener('click', () => {
        this.closeSyncModalDialog();
      });
    }

    if (this.syncModal) {
      this.syncModal.addEventListener('click', (e) => {
        if (e.target === this.syncModal) {
          this.closeSyncModalDialog();
        }
      });
    }

    // Modal Tabs
    if (this.tabBtnCloud) {
      this.tabBtnCloud.addEventListener('click', () => {
        this.switchModalTab('tab-cloud');
      });
    }

    if (this.tabBtnBackup) {
      this.tabBtnBackup.addEventListener('click', () => {
        this.switchModalTab('tab-backup');
      });
    }

    // Token Visibility Toggle
    if (this.toggleTokenVisibility) {
      this.toggleTokenVisibility.addEventListener('click', () => {
        const isPwd = this.syncTokenInput.type === 'password';
        this.syncTokenInput.type = isPwd ? 'text' : 'password';
        this.toggleTokenVisibility.textContent = isPwd ? '🔒' : '👁️';
      });
    }

    // Save Token & Trigger Initial Sync
    if (this.cloudSyncForm) {
      this.cloudSyncForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const val = this.syncTokenInput.value.trim();
        if (!val) {
          this.showToast('Please enter a GitHub Personal Access Token', 'error');
          return;
        }
        CloudSync.setToken(val);
        this.showToast('Token saved! Syncing with GitHub...', 'info');
        this.refreshSyncModalUI();
        await this.triggerCloudSync();
      });
    }

    // Manual Sync Now Button
    if (this.syncNowBtn) {
      this.syncNowBtn.addEventListener('click', async () => {
        await this.triggerCloudSync();
      });
    }

    // Disconnect Token
    if (this.disconnectSyncBtn) {
      this.disconnectSyncBtn.addEventListener('click', () => {
        if (confirm('Disconnect GitHub Cloud Sync from this browser? Your local data will be preserved.')) {
          CloudSync.clearToken();
          this.syncTokenInput.value = '';
          this.refreshSyncModalUI();
          this.updateSyncStatusUI('offline');
          this.showToast('Disconnected from GitHub Cloud Sync', 'info');
        }
      });
    }

    // Export Backup File
    if (this.exportBackupBtn) {
      this.exportBackupBtn.addEventListener('click', () => {
        this.handleExportBackup();
      });
    }

    // Import Backup File
    if (this.importBackupBtn) {
      this.importBackupBtn.addEventListener('click', () => {
        this.importFileInput.click();
      });
    }

    if (this.importFileInput) {
      this.importFileInput.addEventListener('change', (e) => {
        this.handleImportBackup(e);
      });
    }
  }

  // ===========================================================================
  // Rendering
  // ===========================================================================
  render() {
    this.renderHeaderAndMonthTitles();
    this.renderSummaryCards();
    this.renderCalendar();
    this.renderEntryForm();
    this.renderHistoryTable();
  }

  renderHeaderAndMonthTitles() {
    const formattedMonth = DateUtils.formatMonthYear(this.viewYear, this.viewMonth);
    this.calendarMonthYear.textContent = formattedMonth;
    this.historySubtitle.textContent = `Records for ${formattedMonth}`;
    this.cardMonthLabel.textContent = `${formattedMonth} total`;
    this.cardDaysMeta.textContent = `Logged in ${formattedMonth}`;
  }

  renderSummaryCards() {
    // 1. Today's Hours
    const todayKey = DateUtils.getTodayKey();
    const todayRecord = Storage.get(todayKey);
    if (todayRecord && todayRecord.login && todayRecord.login !== '-') {
      if (todayRecord.logout) {
        this.cardTodayHours.textContent = todayRecord.totalFormatted || '0h 0m';
        this.cardTodayStatus.textContent = todayRecord.shift ? `Shift: ${todayRecord.shift}` : 'Logged today';
        this.cardTodayStatus.style.color = 'var(--success)';
      } else {
        this.cardTodayHours.textContent = 'In progress';
        this.cardTodayStatus.textContent = `Logged in at ${todayRecord.login}`;
        this.cardTodayStatus.style.color = 'var(--primary)';
      }
    } else {
      this.cardTodayHours.textContent = '0h 0m';
      this.cardTodayStatus.textContent = 'Not logged';
      this.cardTodayStatus.style.color = 'var(--text-muted)';
    }

    // 2. This Month's Total Hours & 3. Days Logged
    const monthRecords = Storage.getMonthRecords(this.viewYear, this.viewMonth);
    const workRecords = monthRecords.filter(r => !r.isLeave);
    const leaveRecords = monthRecords.filter(r => r.isLeave);

    const totalMonthMinutes = workRecords.reduce((acc, curr) => acc + (curr.totalMinutes || 0), 0);
    const daysLoggedCount = workRecords.length;

    this.cardMonthHours.textContent = DateUtils.formatHoursMinutes(totalMonthMinutes);
    this.cardDaysLogged.textContent = `${daysLoggedCount} ${daysLoggedCount === 1 ? 'day' : 'days'}`;
    this.cardDaysMeta.textContent = leaveRecords.length > 0 
      ? `${daysLoggedCount} worked • ${leaveRecords.length} leave/holiday`
      : `Logged in ${DateUtils.formatMonthYear(this.viewYear, this.viewMonth)}`;
  }

  renderCalendar() {
    this.calendarGrid.innerHTML = '';

    const year = this.viewYear;
    const month = this.viewMonth;

    // Total days in the current month
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();

    // First day of current month
    const firstDayDate = new Date(year, month, 1);
    // Convert getDay() (0=Sun, 1=Mon, ..., 6=Sat) to Monday-first (0=Mon, ..., 6=Sun)
    const firstDayIndex = (firstDayDate.getDay() + 6) % 7;

    // Total days in previous month for leading padding
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const todayKey = DateUtils.getTodayKey();

    // 1. Render Previous Month Padding Days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const dateKey = DateUtils.formatDateKey(prevYear, prevMonth, dayNum);

      const cell = this.createCalendarCell(dayNum, dateKey, true, todayKey);
      this.calendarGrid.appendChild(cell);
    }

    // 2. Render Current Month Days
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const dateKey = DateUtils.formatDateKey(year, month, day);
      const cell = this.createCalendarCell(day, dateKey, false, todayKey);
      this.calendarGrid.appendChild(cell);
    }

    // 3. Render Next Month Trailing Padding Days to complete 7-column rows
    const totalCellsSoFar = firstDayIndex + daysInCurrentMonth;
    const remainingCells = (7 - (totalCellsSoFar % 7)) % 7;

    for (let day = 1; day <= remainingCells; day++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const dateKey = DateUtils.formatDateKey(nextYear, nextMonth, day);

      const cell = this.createCalendarCell(day, dateKey, true, todayKey);
      this.calendarGrid.appendChild(cell);
    }
  }

  createCalendarCell(dayNum, dateKey, isOtherMonth, todayKey) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cal-day';
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-label', DateUtils.formatDisplayDate(dateKey));

    if (isOtherMonth) {
      cell.classList.add('other-month');
    }

    if (dateKey === todayKey) {
      cell.classList.add('today');
    }

    if (dateKey === this.selectedDate) {
      cell.classList.add('selected');
      cell.setAttribute('aria-selected', 'true');
    }

    // Check if date falls on weekend (Saturday or Sunday = Leave)
    const isWeekend = DateUtils.isWeekend(dateKey);
    if (isWeekend) {
      cell.classList.add('weekend-blocked');
      cell.setAttribute('title', `${DateUtils.formatDisplayDate(dateKey)} (Weekly Leave)`);
      const leaveTag = document.createElement('span');
      leaveTag.className = 'weekend-tag';
      leaveTag.textContent = 'Leave';
      cell.appendChild(leaveTag);
    }

    // Check if an attendance record exists for this date
    const record = Storage.get(dateKey);
    if (record) {
      if (record.isLeave) {
        cell.classList.add('custom-leave');
        cell.setAttribute('title', `${DateUtils.formatDisplayDate(dateKey)} (${record.leaveType || 'Leave'}: ${record.reason || 'Leave'})`);
        const leaveTag = document.createElement('span');
        leaveTag.className = 'custom-leave-tag';
        leaveTag.textContent = record.leaveType || 'Leave';
        cell.appendChild(leaveTag);
      } else {
        cell.classList.add('has-record');
        const indicator = document.createElement('span');
        indicator.className = 'day-indicator';
        cell.appendChild(indicator);
      }
    }

    const dayText = document.createTextNode(dayNum);
    cell.appendChild(dayText);

    // Clicking a date selects it
    cell.addEventListener('click', () => {
      this.selectDate(dateKey);
    });

    return cell;
  }

  selectDate(dateKey) {
    this.selectedDate = dateKey;
    const { year, month } = DateUtils.parseDateKey(dateKey);

    // If user clicked a padding day from another month, navigate to that month
    if (year !== this.viewYear || month !== this.viewMonth) {
      this.viewYear = year;
      this.viewMonth = month;
    }

    this.render();
  }

  renderEntryForm() {
    this.entrySelectedDate.textContent = DateUtils.formatDisplayDate(this.selectedDate);
    this.hideAlert();

    const isWeekend = DateUtils.isWeekend(this.selectedDate);

    // If selected date is Saturday or Sunday, block the entry form
    if (isWeekend) {
      this.entryBadge.textContent = 'Weekly Leave';
      this.entryBadge.className = 'entry-status-badge badge-leave';
      this.resetFormInputs();
      this.markLeaveBtn.style.display = 'none';
      this.unblockLeaveBtn.style.display = 'none';
      this.leaveFormModal.style.display = 'none';
      this.shiftInput.disabled = true;
      this.loginInput.disabled = true;
      this.logoutInput.disabled = true;
      this.loginNowBtn.disabled = true;
      this.logoutNowBtn.disabled = true;
      this.breakInput.disabled = true;
      this.saveBtn.disabled = true;
      this.clearBtn.disabled = true;
      this.deleteBtn.style.display = 'none';
      this.calculatedHours.textContent = '0h 0m';
      this.overnightIndicator.style.display = 'none';
      this.showAlert('🏖️ Saturdays and Sundays are weekly leave days. Attendance entry is blocked.', 'info');
      return;
    }

    const record = Storage.get(this.selectedDate);

    // Check if date is custom marked as Leave or Holiday
    if (record && record.isLeave) {
      this.entryBadge.textContent = `${record.leaveType} (Blocked)`;
      this.entryBadge.className = 'entry-status-badge badge-holiday';
      this.resetFormInputs();
      this.markLeaveBtn.style.display = 'none';
      this.unblockLeaveBtn.style.display = 'inline-flex';
      this.leaveFormModal.style.display = 'none';
      this.shiftInput.value = record.reason || record.shift || '';
      this.shiftInput.disabled = true;
      this.loginInput.disabled = true;
      this.logoutInput.disabled = true;
      this.loginNowBtn.disabled = true;
      this.logoutNowBtn.disabled = true;
      this.breakInput.disabled = true;
      this.saveBtn.disabled = true;
      this.clearBtn.disabled = true;
      this.deleteBtn.style.display = 'none';
      this.calculatedHours.textContent = '0h 0m';
      this.overnightIndicator.style.display = 'none';
      this.showAlert(`🏖️ Date is blocked as ${record.leaveType}: "${record.reason || 'Leave'}". Attendance entry is blocked.`, 'info');
      return;
    }

    // Normal working day: ensure inputs and mark-leave actions are enabled
    this.markLeaveBtn.style.display = 'inline-flex';
    this.unblockLeaveBtn.style.display = 'none';
    this.leaveFormModal.style.display = 'none';
    this.shiftInput.disabled = false;
    this.logoutInput.disabled = false;
    this.logoutNowBtn.disabled = false;
    this.breakInput.disabled = false;
    this.saveBtn.disabled = false;
    this.clearBtn.disabled = false;

    if (record) {
      // Editing existing record
      this.entryBadge.textContent = 'Editing Entry';
      this.entryBadge.className = 'entry-status-badge badge-edit';
      this.shiftInput.value = record.shift || '';
      this.loginInput.value = record.login || '';
      this.logoutInput.value = record.logout || '';
      this.breakInput.value = record.breakMinutes !== undefined ? record.breakMinutes : 0;
      this.saveBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
        Update Attendance
      `;
      this.deleteBtn.style.display = 'inline-flex';

      // Lock and grey out Login Time if already saved, unless explicitly unlocked by user
      const hasSavedLogin = record.login && record.login !== '-';
      const isUnlocked = this.unlockedDates.has(this.selectedDate);

      if (hasSavedLogin && !isUnlocked) {
        this.loginInput.disabled = true;
        this.loginInput.classList.add('input-locked');
        this.loginNowBtn.style.display = 'none';
        this.loginLockedBadge.style.display = 'inline-flex';
        this.loginUnlockBtn.style.display = 'inline-flex';
      } else {
        this.loginInput.disabled = false;
        this.loginInput.classList.remove('input-locked');
        this.loginNowBtn.disabled = false;
        this.loginNowBtn.style.display = 'inline-flex';
        this.loginLockedBadge.style.display = 'none';
        this.loginUnlockBtn.style.display = 'none';
      }
    } else {
      // New record entry
      this.entryBadge.textContent = 'New Entry';
      this.entryBadge.className = 'entry-status-badge badge-new';
      this.resetFormInputs();
      this.loginInput.disabled = false;
      this.loginInput.classList.remove('input-locked');
      this.loginNowBtn.disabled = false;
      this.loginNowBtn.style.display = 'inline-flex';
      this.loginLockedBadge.style.display = 'none';
      this.loginUnlockBtn.style.display = 'none';
      this.saveBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
        Save Attendance
      `;
      this.deleteBtn.style.display = 'none';
    }

    this.updateLiveCalculation();
  }

  resetFormInputs() {
    this.shiftInput.value = '';
    this.loginInput.value = '';
    this.logoutInput.value = '';
    this.breakInput.value = 0;
  }

  updateLiveCalculation() {
    const login = this.loginInput.value;
    const logout = this.logoutInput.value;
    let breakMin = parseInt(this.breakInput.value, 10);

    if (isNaN(breakMin) || breakMin < 0) {
      breakMin = 0;
    }

    if (!login || !logout) {
      this.calculatedHours.textContent = '0h 0m';
      this.overnightIndicator.style.display = 'none';
      return;
    }

    const calc = DateUtils.calculateWorkingHours(login, logout, breakMin);

    if (!calc.valid) {
      this.calculatedHours.textContent = '0h 0m';
      this.overnightIndicator.style.display = 'none';
      return;
    }

    this.calculatedHours.textContent = calc.formatted;
    if (calc.isOvernight) {
      this.overnightIndicator.style.display = 'inline-block';
    } else {
      this.overnightIndicator.style.display = 'none';
    }
  }

  handleConfirmLeave() {
    if (DateUtils.isWeekend(this.selectedDate)) {
      this.showAlert('Saturdays and Sundays are already weekly leaves.', 'info');
      this.leaveFormModal.style.display = 'none';
      return;
    }

    const type = this.leaveTypeSelect.value;
    const reason = this.leaveReasonInput.value.trim() || type;

    const record = {
      date: this.selectedDate,
      isLeave: true,
      leaveType: type,
      reason: reason,
      shift: `${type}: ${reason}`,
      login: '-',
      logout: '-',
      breakMinutes: 0,
      totalMinutes: 0,
      totalFormatted: type,
      updatedAt: new Date().toISOString()
    };

    Storage.save(this.selectedDate, record);
    this.leaveFormModal.style.display = 'none';
    this.leaveReasonInput.value = '';
    this.showToast(`${this.selectedDate} marked as ${type}. Date blocked.`, 'success');
    this.render();
    this.triggerCloudSync(true);
  }

  handleUnblockLeave() {
    if (!this.selectedDate) return;
    const confirmUnblock = window.confirm(`Remove leave and unblock ${DateUtils.formatDisplayDate(this.selectedDate)}?`);
    if (confirmUnblock) {
      Storage.delete(this.selectedDate);
      this.showToast(`Leave removed for ${this.selectedDate}. Date unblocked.`, 'info');
      this.render();
      this.triggerCloudSync(true);
    }
  }

  handleFormSubmit() {
    // Guard 1: Prevent saving attendance on weekend leave days
    if (DateUtils.isWeekend(this.selectedDate)) {
      this.showAlert('🏖️ Attendance cannot be logged for Saturdays and Sundays (Weekly Leave).', 'error');
      return;
    }

    // Guard 2: Prevent saving attendance on dates marked as Leave or Holiday
    const existing = Storage.get(this.selectedDate);
    if (existing && existing.isLeave) {
      this.showAlert('🏖️ This date is blocked as Leave/Holiday. Please unblock it first to log attendance.', 'error');
      return;
    }

    const shift = this.shiftInput.value.trim();
    const login = this.loginInput.value;
    const logout = this.logoutInput.value;
    let breakMin = parseInt(this.breakInput.value, 10);

    // Validation 1: Required login
    if (!login) {
      this.showAlert('Please enter or select a Login Time.', 'error');
      this.loginInput.focus();
      return;
    }

    // Validation 2: Negative break time
    if (isNaN(breakMin) || breakMin < 0) {
      this.showAlert('Break time cannot be negative.', 'error');
      this.breakInput.focus();
      return;
    }

    let totalMin = 0;
    let totalFormatted = 'In progress';
    let isOvernight = false;
    let status = 'in-progress';

    // If logout is provided, calculate working hours
    if (logout) {
      const calc = DateUtils.calculateWorkingHours(login, logout, breakMin);
      if (!calc.valid) {
        this.showAlert(calc.error || 'Invalid time combination.', 'error');
        return;
      }
      totalMin = calc.totalMinutes;
      totalFormatted = calc.formatted;
      isOvernight = calc.isOvernight;
      status = 'completed';
    }

    // Build record object
    const record = {
      date: this.selectedDate,
      shift: shift,
      login: login,
      logout: logout || '',
      breakMinutes: breakMin,
      totalMinutes: totalMin,
      totalFormatted: totalFormatted,
      status: status,
      isOvernight: isOvernight,
      updatedAt: new Date().toISOString()
    };

    // Save to localStorage
    const success = Storage.save(this.selectedDate, record);
    if (success) {
      // Re-lock login time after saving
      this.unlockedDates.delete(this.selectedDate);
      const msg = logout 
        ? `Attendance saved for ${this.selectedDate}` 
        : `Login time saved for ${this.selectedDate} (locked)`;
      this.showToast(msg, 'success');
      this.render();
      this.triggerCloudSync(true);
    } else {
      this.showAlert('Failed to save record to storage.', 'error');
    }
  }

  handleDeleteRecord() {
    if (!this.selectedDate) return;
    const confirmDelete = window.confirm(`Are you sure you want to delete attendance for ${DateUtils.formatDisplayDate(this.selectedDate)}?`);
    if (confirmDelete) {
      this.unlockedDates.delete(this.selectedDate);
      Storage.delete(this.selectedDate);
      this.showToast(`Record deleted for ${this.selectedDate}`, 'info');
      this.render();
      this.triggerCloudSync(true);
    }
  }

  renderHistoryTable() {
    const records = Storage.getMonthRecords(this.viewYear, this.viewMonth);
    // Sort descending by date (most recent first)
    records.sort((a, b) => b.date.localeCompare(a.date));

    this.historyCountBadge.textContent = `${records.length} ${records.length === 1 ? 'record' : 'records'}`;

    if (records.length === 0) {
      this.historyTbody.innerHTML = '';
      this.historyEmpty.style.display = 'block';
      return;
    }

    this.historyEmpty.style.display = 'none';
    this.historyTbody.innerHTML = '';

    records.forEach(rec => {
      const tr = document.createElement('tr');
      tr.className = 'history-row';
      if (rec.date === this.selectedDate) {
        tr.classList.add('active-row');
      }

      const displayDate = DateUtils.formatDisplayDate(rec.date);

      if (rec.isLeave) {
        tr.innerHTML = `
          <td>
            <strong style="display:block;">${rec.date}</strong>
            <small style="color:var(--text-secondary);">${displayDate.split(',')[0]}</small>
          </td>
          <td><span class="badge-leave-history">🏖️ ${this.escapeHtml(rec.leaveType || 'Leave')}: ${this.escapeHtml(rec.reason || 'Leave')}</span></td>
          <td><span style="color:var(--text-muted);">&mdash;</span></td>
          <td><span style="color:var(--text-muted);">&mdash;</span></td>
          <td><span style="color:var(--text-muted);">&mdash;</span></td>
          <td><span class="badge-leave-history">${rec.leaveType || 'Leave'}</span></td>
          <td class="text-right">
            <button type="button" class="btn-table-action" title="View / Unblock leave" aria-label="View or unblock leave">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
          </td>
        `;
      } else {
        const shiftDisplay = rec.shift ? `<span class="badge-shift" title="${this.escapeHtml(rec.shift)}">${this.escapeHtml(rec.shift)}</span>` : '<span style="color:var(--text-muted);">&mdash;</span>';
        const overnightBadge = rec.isOvernight ? ' <span title="Overnight shift" style="font-size:0.8rem;">🌙</span>' : '';
        const logoutDisplay = rec.logout 
          ? `${rec.logout}${overnightBadge}` 
          : '<span style="color:var(--text-muted); font-style:italic;">In progress</span>';
        const hoursDisplay = rec.logout
          ? `<span class="badge-hours">${rec.totalFormatted || '0h 0m'}</span>`
          : '<span class="badge-hours" style="background:#eef2ff; color:var(--primary); font-size:0.75rem;">In progress</span>';

        tr.innerHTML = `
          <td>
            <strong style="display:block;">${rec.date}</strong>
            <small style="color:var(--text-secondary);">${displayDate.split(',')[0]}</small>
          </td>
          <td>${shiftDisplay}</td>
          <td>${rec.login}</td>
          <td>${logoutDisplay}</td>
          <td>${rec.breakMinutes || 0}m</td>
          <td>${hoursDisplay}</td>
          <td class="text-right">
            <button type="button" class="btn-table-action" title="Edit entry" aria-label="Edit entry">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
          </td>
        `;
      }

      // Clicking any history record row loads it into the attendance form
      tr.addEventListener('click', () => {
        this.selectDate(rec.date);
        // Smooth scroll to entry panel on smaller screens
        if (window.innerWidth < 900) {
          this.form.scrollIntoView({ behavior: 'smooth' });
        }
      });

      this.historyTbody.appendChild(tr);
    });
  }

  // ===========================================================================
  // Alerts & Notifications
  // ===========================================================================
  showAlert(message, type = 'error') {
    this.formAlert.className = `form-alert alert-${type}`;
    this.formAlert.textContent = message;
    this.formAlert.style.display = 'flex';
  }

  hideAlert() {
    this.formAlert.style.display = 'none';
    this.formAlert.textContent = '';
  }

  showToast(message, type = 'success') {
    this.toast.textContent = message;
    this.toast.className = `toast show toast-${type}`;
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toast.className = 'toast';
    }, 2800);
  }

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ===========================================================================
  // Cloud Sync & Backup Methods
  // ===========================================================================
  initCloudSync() {
    const hasToken = !!CloudSync.getToken();
    const localCount = Storage.getAll().length;

    if (hasToken) {
      this.updateSyncStatusUI('connected');
    } else if (localCount > 0) {
      this.updateSyncStatusUI('pending');
      this.syncStatusText.textContent = `Sync Records (${localCount})`;
      this.syncModalBtn.title = `You have ${localCount} attendance record(s) in this browser. Connect Cloud Sync to share across Chrome & mobile.`;
    } else {
      this.updateSyncStatusUI('offline');
    }

    // Run non-blocking pull on initial load to get any remote changes from other browsers
    CloudSync.pull().then(res => {
      if (res.success && res.count > 0) {
        this.render();
        this.showToast(`☁️ Loaded ${res.count} updated records from cloud`, 'info');
      }
      if (CloudSync.getToken()) {
        this.updateSyncStatusUI('connected');
      } else {
        const curCount = Storage.getAll().length;
        if (curCount > 0) {
          this.updateSyncStatusUI('pending');
          this.syncStatusText.textContent = `Sync Records (${curCount})`;
        } else {
          this.updateSyncStatusUI('offline');
        }
      }
    }).catch(err => {
      console.warn('Initial cloud sync error:', err);
    });
  }

  updateSyncStatusUI(status) {
    if (!this.syncStatusDot || !this.syncStatusText) return;

    this.syncStatusDot.className = `sync-dot ${status}`;
    if (status === 'connected') {
      this.syncStatusText.textContent = 'Cloud Synced';
      this.syncModalBtn.title = 'Cloud Synced with GitHub';
    } else if (status === 'syncing') {
      this.syncStatusText.textContent = 'Syncing...';
      this.syncModalBtn.title = 'Syncing with GitHub...';
    } else if (status === 'pending') {
      this.syncStatusText.textContent = 'Sync Pending';
      this.syncModalBtn.title = 'Changes pending upload';
    } else {
      this.syncStatusText.textContent = 'Cloud Sync';
      this.syncModalBtn.title = 'Connect GitHub Cloud Sync';
    }

    if (this.modalSyncBadge) {
      if (status === 'connected') {
        this.modalSyncBadge.className = 'badge-status badge-connected';
        this.modalSyncBadge.textContent = 'Connected & Synced';
      } else if (status === 'syncing') {
        this.modalSyncBadge.className = 'badge-status badge-syncing';
        this.modalSyncBadge.textContent = 'Syncing in Progress...';
      } else if (status === 'pending') {
        this.modalSyncBadge.className = 'badge-status badge-pending';
        this.modalSyncBadge.textContent = 'Sync Pending / Error';
      } else {
        this.modalSyncBadge.className = 'badge-status badge-offline';
        this.modalSyncBadge.textContent = 'Offline / Local Only';
      }
    }
  }

  openSyncModal() {
    if (!this.syncModal) return;
    this.refreshSyncModalUI();
    this.syncModal.style.display = 'flex';
  }

  closeSyncModalDialog() {
    if (!this.syncModal) return;
    this.syncModal.style.display = 'none';
  }

  switchModalTab(tabId) {
    if (this.tabBtnCloud && this.tabBtnBackup) {
      this.tabBtnCloud.classList.toggle('active', tabId === 'tab-cloud');
      this.tabBtnBackup.classList.toggle('active', tabId === 'tab-backup');
    }
    if (this.tabCloud && this.tabBackup) {
      this.tabCloud.style.display = tabId === 'tab-cloud' ? 'flex' : 'none';
      this.tabBackup.style.display = tabId === 'tab-backup' ? 'flex' : 'none';
    }
  }

  refreshSyncModalUI() {
    const cfg = CloudSync.getConfig();
    if (this.syncRepoDisplay) {
      this.syncRepoDisplay.textContent = `${cfg.owner}/${cfg.repo}`;
    }

    const token = CloudSync.getToken();
    if (this.syncTokenInput) {
      this.syncTokenInput.value = token;
    }

    if (this.disconnectSyncBtn) {
      this.disconnectSyncBtn.style.display = token ? 'inline-block' : 'none';
    }

    if (this.modalLastSynced) {
      const last = CloudSync.getLastSyncTime();
      if (last) {
        const d = new Date(last);
        this.modalLastSynced.textContent = d.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } else {
        this.modalLastSynced.textContent = 'Never';
      }
    }

    if (token) {
      this.updateSyncStatusUI('connected');
    } else {
      const localCount = Storage.getAll().length;
      if (localCount > 0) {
        this.updateSyncStatusUI('pending');
        this.syncStatusText.textContent = `Sync Records (${localCount})`;
        if (this.modalSyncBadge) {
          this.modalSyncBadge.className = 'badge-status badge-pending';
          this.modalSyncBadge.textContent = `Local (${localCount} records ready to sync)`;
        }
      } else {
        this.updateSyncStatusUI('offline');
      }
    }
  }

  async triggerCloudSync(isSilent = false) {
    const token = CloudSync.getToken();
    if (!token) {
      this.updateSyncStatusUI('offline');
      return;
    }

    this.updateSyncStatusUI('syncing');
    const result = await CloudSync.push();
    if (result.success) {
      this.updateSyncStatusUI('connected');
      this.refreshSyncModalUI();
      if (!isSilent) {
        this.showToast('☁️ Cloud synchronization complete!', 'success');
      }
    } else {
      this.updateSyncStatusUI('pending');
      this.refreshSyncModalUI();
      if (!isSilent) {
        this.showToast(`Cloud sync issue: ${result.error}`, 'error');
      }
    }
  }

  handleExportBackup() {
    const records = Storage.getAllAsMap();
    const count = Object.keys(records).length;
    const data = {
      app: 'Personal Attendance Tracker',
      version: 1,
      exportedAt: new Date().toISOString(),
      totalRecords: count,
      records: records
    };

    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_backup_${DateUtils.getTodayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showToast(`📥 Exported backup with ${count} record(s)`, 'success');
  }

  handleImportBackup(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const parsed = JSON.parse(content);
        if (!parsed || !parsed.records || typeof parsed.records !== 'object') {
          throw new Error('Invalid backup file format.');
        }

        const count = Storage.mergeFromMap(parsed.records);
        this.render();
        this.showToast(`📤 Restored ${count} record(s) from backup!`, 'success');
        this.triggerCloudSync(true);
      } catch (err) {
        this.showToast(`Failed to restore backup: ${err.message}`, 'error');
      } finally {
        this.importFileInput.value = '';
      }
    };
    reader.readAsText(file);
  }
}

// =============================================================================
// Initialize Application on DOM Ready
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  window.attendanceApp = new AttendanceApp();
});

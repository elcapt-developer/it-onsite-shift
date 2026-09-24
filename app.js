/**
 * IT Onsite Weekly Shift - 3-Stage View Application (Monthly, Weekly, Daily)
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'IT_ONSITE_SHIFT_DATA_V6';
  const OLD_STORAGE_KEY_V5 = 'IT_ONSITE_SHIFT_DATA_V5';
  const EMPLOYEE_ORDER = ['John', 'Ben', 'Harry', 'Joseph'];
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DAY_NAMES_FULL_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function getTodayDate() {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  // --- State ---
  const state = {
    currentView: 'month', // 'month' | 'day'
    selectedDate: getTodayDate(),
    miniCalDate: getTodayDate(),
    year: getTodayDate().getUTCFullYear(),
    weekNum: 39,
    isSupervisor: sessionStorage.getItem('it_shift_supervisor') === 'true',
    employees: window.DEFAULT_EMPLOYEES || [
      { id: 'john', name: 'John', campus: 'RDM' },
      { id: 'ben', name: 'Ben', campus: 'RDM' },
      { id: 'harry', name: 'Harry', campus: 'HIO' },
      { id: 'joseph', name: 'Joseph', campus: 'HIO' }
    ],
    timeSlots: window.TIME_SLOTS || [],
    schedules: {},
    hasUnsavedChanges: false,
    lastSavedSnapshot: '',
    lastSavedTimestamp: 0
  };

  // --- DOM Elements ---
  const elements = {
    viewSwitcher: document.getElementById('viewSwitcher'),
    btnNavPrev: document.getElementById('btnNavPrev'),
    btnNavToday: document.getElementById('btnNavToday'),
    btnNavNext: document.getElementById('btnNavNext'),
    btnPeriodTrigger: document.getElementById('btnPeriodTrigger'),
    miniCalPopover: document.getElementById('miniCalPopover'),
    btnMiniCalPrevMonth: document.getElementById('btnMiniCalPrevMonth'),
    btnMiniCalNextMonth: document.getElementById('btnMiniCalNextMonth'),
    btnMiniCalToday: document.getElementById('btnMiniCalToday'),
    miniCalMonthTitle: document.getElementById('miniCalMonthTitle'),
    miniCalGrid: document.getElementById('miniCalGrid'),
    navTitleLabel: document.getElementById('navTitleLabel'),
    instructionsBar: document.getElementById('instructionsBar'),
    monthlyViewContainer: document.getElementById('monthlyViewContainer'),
    dailyViewContainer: document.getElementById('dailyViewContainer'),
    btnApproveWeekHeader: document.getElementById('btnApproveWeekHeader'),
    btnSupervisor: document.getElementById('btnSupervisor'),
    supervisorGroup: document.getElementById('supervisorGroup'),
    supervisorModal: document.getElementById('supervisorModal'),
    supervisorPasswordInput: document.getElementById('supervisorPasswordInput'),
    supervisorErrorMsg: document.getElementById('supervisorErrorMsg'),
    btnSubmitSupervisorModal: document.getElementById('btnSubmitSupervisorModal'),
    btnCancelSupervisorModal: document.getElementById('btnCancelSupervisorModal'),
    btnCloseSupervisorModal: document.getElementById('btnCloseSupervisorModal'),
    btnExportCSV: document.getElementById('btnExportCSV'),
    btnSaveChanges: document.getElementById('btnSaveChanges'),
    btnDiscardChanges: document.getElementById('btnDiscardChanges'),
    cloudStatusBadge: document.getElementById('cloudStatusBadge'),
    cloudStatusText: document.getElementById('cloudStatusText'),
    csvExportModal: document.getElementById('csvExportModal'),
    btnCloseCsvModal: document.getElementById('btnCloseCsvModal'),
    btnCancelCsvModal: document.getElementById('btnCancelCsvModal'),
    btnSubmitCsvModal: document.getElementById('btnSubmitCsvModal'),
    csvStartDate: document.getElementById('csvStartDate'),
    csvEndDate: document.getElementById('csvEndDate'),
    csvModalErrorMsg: document.getElementById('csvModalErrorMsg'),
    btnPresetThisWeek: document.getElementById('btnPresetThisWeek'),
    btnPresetThisMonth: document.getElementById('btnPresetThisMonth'),
    btnPresetAll: document.getElementById('btnPresetAll'),
    toastContainer: document.getElementById('toastContainer')
  };

  // --- Initialization ---
  function init() {
    loadSchedules();
    syncDateState();
    setupEventListeners();
    render();
    updateSaveButtons();
  }

  // --- Date & ISO Week Calculation Helpers ---
  function syncDateState() {
    const yyyy = state.selectedDate.getUTCFullYear();
    const mm = String(state.selectedDate.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(state.selectedDate.getUTCDate()).padStart(2, '0');
    const isoInfo = getIsoWeekAndYear(`${yyyy}-${mm}-${dd}`);
    state.year = isoInfo.year;
    state.weekNum = isoInfo.week;
  }

  function getMondayOfIsoWeek(year, weekNum) {
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const dayOfWeek = jan4.getUTCDay() || 7;
    const mondayWeek1 = new Date(jan4.getTime() - (dayOfWeek - 1) * 86400000);
    return new Date(mondayWeek1.getTime() + (weekNum - 1) * 7 * 86400000);
  }

  function formatDateShort(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getUTCDate()} ${months[date.getUTCMonth()]}`;
  }

  function getPeriodString(year, weekNum) {
    const monday = getMondayOfIsoWeek(year, weekNum);
    const friday = new Date(monday.getTime() + 4 * 86400000);
    return `${formatDateShort(monday)} ~ ${formatDateShort(friday)} ${year}`;
  }

  function getDayHeaderString(dayIndex, year, weekNum) {
    const monday = getMondayOfIsoWeek(year, weekNum);
    const dayDate = new Date(monday.getTime() + dayIndex * 86400000);
    const dayNames = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
    return `${dayNames[dayIndex]} (${formatDateShort(dayDate)})`;
  }

  function getIsoWeekAndYear(dateStr) {
    const parts = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return { year: d.getUTCFullYear(), week: weekNo };
  }

  function formatDateIso(date) {
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function getTodayIso() {
    return formatDateIso(getTodayDate());
  }

  function getThisWeekMondayAndFridayFromToday() {
    const today = getTodayDate();
    const day = today.getUTCDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(today.getTime() + diffToMonday * 86400000);
    const friday = new Date(monday.getTime() + 4 * 86400000);
    return {
      monday: formatDateIso(monday),
      friday: formatDateIso(friday)
    };
  }

  function sortShiftsByEmployeeOrder(shifts) {
    if (!Array.isArray(shifts)) return [];
    return shifts.sort((a, b) => {
      const idxA = EMPLOYEE_ORDER.indexOf(a.name);
      const idxB = EMPLOYEE_ORDER.indexOf(b.name);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });
  }

  // --- Storage ---
  function parseShiftTimeToSlots(shiftTimeStr) {
    if (!shiftTimeStr || shiftTimeStr === '-' || shiftTimeStr === 'OFF') return { startSlot: -1, endSlot: -1 };
    const parts = shiftTimeStr.split('-');
    if (parts.length !== 2) return { startSlot: -1, endSlot: -1 };

    function parseTimeToSlot(timeStr, isEnd) {
      const match = timeStr.trim().match(/(\d+)(?::(\d+))?\s*(AM|PM)/i);
      if (!match) return -1;
      let h = parseInt(match[1], 10);
      const m = parseInt(match[2] || '0', 10);
      const ampm = match[3].toUpperCase();
      if (ampm === 'PM' && h !== 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      const totalMin = h * 60 + m;

      // 8 slots: 8:00 AM (480 min) to 4:00 PM (960 min)
      if (isEnd) {
        if (totalMin >= 960) return 7; // Clamp to 4:00 PM
        for (let i = 0; i < state.timeSlots.length; i++) {
          const slotEndMin = (8 + i + 1) * 60;
          if (totalMin <= slotEndMin) return i;
        }
        return 7;
      } else {
        if (totalMin <= 480) return 0;
        for (let i = 0; i < state.timeSlots.length; i++) {
          const slotStartMin = (8 + i) * 60;
          if (totalMin <= slotStartMin + 29) return i;
        }
        return 7;
      }
    }

    const startSlot = parseTimeToSlot(parts[0], false);
    const endSlot = parseTimeToSlot(parts[1], true);
    if (startSlot !== -1 && endSlot !== -1 && startSlot <= endSlot) {
      return { startSlot, endSlot };
    }
    return { startSlot: -1, endSlot: -1 };
  }

  const API_ENDPOINT = '/api/schedules';

  function updateCloudBadge(status) {
    if (!elements.cloudStatusBadge || !elements.cloudStatusText) return;
    elements.cloudStatusBadge.classList.remove('syncing', 'offline');

    if (status === 'syncing') {
      elements.cloudStatusBadge.classList.add('syncing');
      elements.cloudStatusText.textContent = 'Syncing...';
      elements.cloudStatusBadge.title = 'Synchronizing with cloud database...';
    } else if (status === 'offline') {
      elements.cloudStatusBadge.classList.add('offline');
      elements.cloudStatusText.textContent = 'Offline Cache';
      elements.cloudStatusBadge.title = 'Running on local offline cache';
    } else {
      elements.cloudStatusText.textContent = 'Cloud Synced';
      elements.cloudStatusBadge.title = 'Connected to Vercel Upstash Cloud Database';
    }
  }

  function loadLocalCache() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.schedules && typeof parsed.updated_at === 'number') {
          state.schedules = parsed.schedules;
          state.lastSavedTimestamp = parsed.updated_at;
        } else {
          state.schedules = parsed || {};
          state.lastSavedTimestamp = Date.now();
        }

        Object.values(state.schedules).forEach(weekObj => {
          if (weekObj && Array.isArray(weekObj.days)) {
            weekObj.days.forEach(day => {
              if (Array.isArray(day.shifts)) {
                sortShiftsByEmployeeOrder(day.shifts);
              }
            });
          }
        });

        state.lastSavedSnapshot = JSON.stringify(state.schedules);
        state.hasUnsavedChanges = false;
        return true;
      }
    } catch (e) {
      console.warn('Failed to load local cache', e);
    }
    return false;
  }

  function saveLocalCache() {
    try {
      const envelope = {
        schedules: state.schedules,
        updated_at: state.lastSavedTimestamp
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    } catch (e) {
      console.warn('Failed to save local cache', e);
    }
  }

  function loadSchedules() {
    // 1. Immediately load local cache for instantaneous UI rendering
    const hasCached = loadLocalCache();
    if (!hasCached) {
      initializeFromDefaults();
    }

    // 2. Fetch latest from Cloud Database asynchronously
    fetchCloudSchedules(false);
  }

  async function fetchCloudSchedules(silent = false) {
    if (!silent) updateCloudBadge('syncing');
    try {
      const res = await fetch(API_ENDPOINT);
      if (!res.ok) {
        updateCloudBadge('offline');
        return;
      }

      const data = await res.json();
      if (data && data.schedules) {
        // If cloud data is newer or local had no timestamp
        if (!state.lastSavedTimestamp || (typeof data.updated_at === 'number' && data.updated_at > state.lastSavedTimestamp)) {
          if (!state.hasUnsavedChanges) {
            state.schedules = data.schedules;
            state.lastSavedTimestamp = data.updated_at;
            Object.values(state.schedules).forEach(weekObj => {
              if (weekObj && Array.isArray(weekObj.days)) {
                weekObj.days.forEach(day => {
                  if (Array.isArray(day.shifts)) {
                    sortShiftsByEmployeeOrder(day.shifts);
                  }
                });
              }
            });
            state.lastSavedSnapshot = JSON.stringify(state.schedules);
            state.hasUnsavedChanges = false;
            saveLocalCache();
            render();
            if (silent) {
              showToast('Schedule synchronized with cloud.');
            }
          } else {
            showToast('Notice: Newer schedules are available on cloud. Please save or discard your changes.');
          }
        }
        updateCloudBadge('synced');
      } else if (data && data.schedules === null) {
        // Cloud is currently empty: seed cloud with current schedules
        updateCloudBadge('syncing');
        await sendSchedulesToCloud(state.schedules, 0, true);
        updateCloudBadge('synced');
      }
    } catch (err) {
      console.warn('Could not connect to cloud API, using local cache:', err);
      updateCloudBadge('offline');
    }
  }

  async function sendSchedulesToCloud(schedules, lastKnownUpdatedAt, force = false) {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schedules: schedules,
        lastKnownUpdatedAt: lastKnownUpdatedAt,
        force: force
      })
    });
    return res;
  }

  function initializeFromDefaults() {
    state.schedules = {};
    const defaultData = window.DEFAULT_SCHEDULES || [];

    defaultData.forEach(item => {
      const weekMatch = (item.week || '').match(/\d+/);
      const weekNum = weekMatch ? parseInt(weekMatch[0], 10) : 39;
      const year = parseInt(item.year, 10) || 2026;
      const key = `${year}-W${weekNum}`;

      const days = DAYS.map((dayName, dIdx) => {
        const foundDay = (item.days || []).find(d => d.day.toLowerCase() === dayName.toLowerCase());
        const shifts = state.employees.map(emp => {
          let s = null;
          if (foundDay && foundDay.shifts) {
            s = foundDay.shifts.find(sh => (sh.name || '').trim().toLowerCase() === emp.name.toLowerCase());
          }

          let startSlot = -1;
          let endSlot = -1;

          if (s && s.shift_time) {
            const parsed = parseShiftTimeToSlots(s.shift_time);
            startSlot = parsed.startSlot;
            endSlot = parsed.endSlot;
          }

          return {
            campus: (s && s.campus) || emp.campus,
            name: emp.name,
            dayoff: s ? !!s.dayoff : false,
            startSlot: startSlot,
            endSlot: endSlot,
            approval: s && (s.approval === '✓ Approved' || s.approval === 'Approved') ? 'Approved' : 'Pending',
            notes: s && s.notes ? s.notes : ''
          };
        });

        return {
          day: dayName,
          header: getDayHeaderString(dIdx, year, weekNum),
          shifts: shifts
        };
      });

      state.schedules[key] = {
        year: year,
        week: `Week ${weekNum}`,
        period: getPeriodString(year, weekNum),
        days: days
      };
    });

    state.lastSavedTimestamp = Date.now();
    state.lastSavedSnapshot = JSON.stringify(state.schedules);
    state.hasUnsavedChanges = false;
    saveLocalCache();
  }

  function saveSchedules() {
    state.lastSavedTimestamp = Date.now();
    state.lastSavedSnapshot = JSON.stringify(state.schedules);
    state.hasUnsavedChanges = false;
    saveLocalCache();
    updateSaveButtons();
  }

  // --- Change Tracking & Persistence Controls ---
  function markDirty() {
    state.hasUnsavedChanges = true;
    updateSaveButtons();
  }

  function updateSaveButtons() {
    if (!elements.btnSaveChanges) return;

    if (state.hasUnsavedChanges) {
      elements.btnSaveChanges.disabled = false;
      elements.btnSaveChanges.classList.add('has-changes');
      elements.btnSaveChanges.classList.remove('is-saved');
      elements.btnSaveChanges.textContent = '💾 Save Changes';
      elements.btnSaveChanges.title = 'Click to save pending changes to cloud';

      if (elements.btnDiscardChanges) {
        elements.btnDiscardChanges.style.display = 'inline-flex';
      }
    } else {
      elements.btnSaveChanges.disabled = true;
      elements.btnSaveChanges.classList.remove('has-changes');
      if (!elements.btnSaveChanges.classList.contains('is-saved')) {
        elements.btnSaveChanges.textContent = '💾 Save Changes';
        elements.btnSaveChanges.title = 'No unsaved changes';
      }
      if (elements.btnDiscardChanges) {
        elements.btnDiscardChanges.style.display = 'none';
      }
    }
  }

  async function handleSaveChanges() {
    if (!state.hasUnsavedChanges) return;

    if (elements.btnSaveChanges) {
      elements.btnSaveChanges.disabled = true;
      elements.btnSaveChanges.textContent = '💾 Saving...';
    }
    updateCloudBadge('syncing');

    let forceOverwrite = false;

    try {
      let res = await sendSchedulesToCloud(state.schedules, state.lastSavedTimestamp, false);

      // Handle 409 Conflict (Another user saved newer changes)
      if (res.status === 409) {
        const proceed = confirm(
          '⚠️ Cloud Conflict Warning:\n\n' +
          'Another team member recently saved newer changes to the cloud database.\n\n' +
          'Saving now will overwrite their changes with your current edits.\n\n' +
          'Click OK to overwrite and save, or Cancel to review.'
        );

        if (!proceed) {
          updateSaveButtons();
          updateCloudBadge('synced');
          return;
        }

        // User confirmed overwrite
        forceOverwrite = true;
        res = await sendSchedulesToCloud(state.schedules, state.lastSavedTimestamp, true);
      }

      if (res.ok) {
        const json = await res.json();
        state.lastSavedTimestamp = json.updated_at || Date.now();
        state.lastSavedSnapshot = JSON.stringify(state.schedules);
        state.hasUnsavedChanges = false;
        saveLocalCache();
        updateCloudBadge('synced');

        if (elements.btnSaveChanges) {
          elements.btnSaveChanges.classList.remove('has-changes');
          elements.btnSaveChanges.classList.add('is-saved');
          elements.btnSaveChanges.textContent = '✓ Saved!';
          setTimeout(() => {
            if (elements.btnSaveChanges) {
              elements.btnSaveChanges.classList.remove('is-saved');
              updateSaveButtons();
            }
          }, 1800);
        }

        showToast('All changes have been successfully saved to cloud.');
        return;
      } else {
        throw new Error('Server returned ' + res.status);
      }
    } catch (err) {
      console.warn('Cloud save failed, falling back to local cache:', err);
      state.lastSavedTimestamp = Date.now();
      state.lastSavedSnapshot = JSON.stringify(state.schedules);
      state.hasUnsavedChanges = false;
      saveLocalCache();
      updateCloudBadge('offline');

      if (elements.btnSaveChanges) {
        elements.btnSaveChanges.classList.remove('has-changes');
        elements.btnSaveChanges.classList.add('is-saved');
        elements.btnSaveChanges.textContent = '✓ Saved (Local)!';
        setTimeout(() => {
          if (elements.btnSaveChanges) {
            elements.btnSaveChanges.classList.remove('is-saved');
            updateSaveButtons();
          }
        }, 1800);
      }

      showToast('Cloud unreachable: Changes saved to local cache.');
    }
  }

  function handleDiscardChanges() {
    if (!state.hasUnsavedChanges) return;

    const confirmDiscard = confirm(
      'Are you sure you want to discard all unsaved changes?\n\n' +
      'All uncommitted edits made in this session will be reverted to the last saved state.'
    );
    if (!confirmDiscard) return;

    if (state.lastSavedSnapshot) {
      try {
        state.schedules = JSON.parse(state.lastSavedSnapshot);
      } catch (e) {
        console.error('Failed to parse last saved snapshot', e);
      }
    }

    state.hasUnsavedChanges = false;
    updateSaveButtons();
    render();
    showToast('Unsaved changes discarded.');
    fetchCloudSchedules(true);
  }

  function getCurrentWeekKey() {
    return `${state.year}-W${state.weekNum}`;
  }

  function getOrCreateWeekData(year, weekNum) {
    const key = `${year}-W${weekNum}`;
    if (!state.schedules[key]) {
      const days = DAYS.map((dayName, dIdx) => ({
        day: dayName,
        header: getDayHeaderString(dIdx, year, weekNum),
        shifts: state.employees.map(emp => ({
          campus: emp.campus,
          name: emp.name,
          dayoff: false,
          startSlot: -1,
          endSlot: -1,
          approval: 'Pending',
          notes: ''
        }))
      }));

      state.schedules[key] = {
        year: year,
        week: `Week ${weekNum}`,
        period: getPeriodString(year, weekNum),
        days: days
      };
    }
    return state.schedules[key];
  }

  function getOrCreateCurrentWeekData() {
    return getOrCreateWeekData(state.year, state.weekNum);
  }

  // Get shift info for a specific calendar date (Date object in UTC)
  function getShiftForDate(date) {
    const dateStr = formatDateIso(date);
    const dayOfWeek = date.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    if (dayOfWeek < 1 || dayOfWeek > 5) {
      return null; // Weekend
    }

    const { year, week } = getIsoWeekAndYear(dateStr);
    const weekData = getOrCreateWeekData(year, week);
    if (!weekData || !weekData.days) return null;

    const dayIndex = dayOfWeek - 1; // 0=Mon, 1=Tue, ..., 4=Fri
    return weekData.days[dayIndex] || null;
  }

  // Find the latest calendar date (YYYY-MM-DD) that has a registered shift/schedule
  function getLatestScheduledDate() {
    let latestIso = '';

    Object.keys(state.schedules).forEach(key => {
      const weekData = state.schedules[key];
      if (!weekData || !Array.isArray(weekData.days)) return;

      const parts = key.split('-W');
      if (parts.length !== 2) return;
      const yr = parseInt(parts[0], 10);
      const wk = parseInt(parts[1], 10);
      if (isNaN(yr) || isNaN(wk)) return;

      const monday = getMondayOfIsoWeek(yr, wk);

      weekData.days.forEach((dayObj, dIdx) => {
        const hasSchedule = dayObj && Array.isArray(dayObj.shifts) && dayObj.shifts.some(s => {
          if (s.dayoff) return true;
          if (s.startSlot !== -1 && s.endSlot !== -1 && s.startSlot <= s.endSlot) return true;
          if (s.notes && s.notes.trim() !== '') return true;
          return false;
        });

        if (hasSchedule) {
          const dayIdx = DAYS.indexOf(dayObj.day) !== -1 ? DAYS.indexOf(dayObj.day) : dIdx;
          const dayDate = new Date(monday.getTime() + dayIdx * 86400000);
          const dayIso = formatDateIso(dayDate);
          if (!latestIso || dayIso > latestIso) {
            latestIso = dayIso;
          }
        }
      });
    });

    return latestIso;
  }

  // Find the earliest calendar date (YYYY-MM-DD) that has a registered shift/schedule
  function getEarliestScheduledDate() {
    let earliestIso = '';

    Object.keys(state.schedules).forEach(key => {
      const weekData = state.schedules[key];
      if (!weekData || !Array.isArray(weekData.days)) return;

      const parts = key.split('-W');
      if (parts.length !== 2) return;
      const yr = parseInt(parts[0], 10);
      const wk = parseInt(parts[1], 10);
      if (isNaN(yr) || isNaN(wk)) return;

      const monday = getMondayOfIsoWeek(yr, wk);

      weekData.days.forEach((dayObj, dIdx) => {
        const hasSchedule = dayObj && Array.isArray(dayObj.shifts) && dayObj.shifts.some(s => {
          if (s.dayoff) return true;
          if (s.startSlot !== -1 && s.endSlot !== -1 && s.startSlot <= s.endSlot) return true;
          if (s.notes && s.notes.trim() !== '') return true;
          return false;
        });

        if (hasSchedule) {
          const dayIdx = DAYS.indexOf(dayObj.day) !== -1 ? DAYS.indexOf(dayObj.day) : dIdx;
          const dayDate = new Date(monday.getTime() + dayIdx * 86400000);
          const dayIso = formatDateIso(dayDate);
          if (!earliestIso || dayIso < earliestIso) {
            earliestIso = dayIso;
          }
        }
      });
    });

    return earliestIso;
  }

  // --- Approval Helpers (Pending, Approved, Denied) ---
  function normalizeApproval(val) {
    if (!val || val === '-' || val === 'Pending' || val === 'pending') return 'Pending';
    if (val === 'Approved' || val === 'approved' || val === '✓ Approved') return 'Approved';
    if (val === 'Denied' || val === 'denied' || val === '✕ Denied') return 'Denied';
    return 'Pending';
  }

  function getApprovalDetails(status) {
    const s = normalizeApproval(status);
    if (s === 'Approved') {
      return {
        status: 'Approved',
        className: 'approved',
        label: '✓ Approved',
        next: 'Denied'
      };
    }
    if (s === 'Denied') {
      return {
        status: 'Denied',
        className: 'denied',
        label: '✕ Denied',
        next: 'Pending'
      };
    }
    return {
      status: 'Pending',
      className: 'pending',
      label: 'Pending',
      next: 'Approved'
    };
  }

  // --- Supervisor Mode & Modal Logic ---
  let pendingApprovalTarget = null;

  function updateSupervisorButton() {
    if (!elements.btnSupervisor) return;
    if (elements.supervisorGroup) {
      elements.supervisorGroup.classList.toggle('is-unlocked', state.isSupervisor);
    }
    if (elements.btnApproveWeekHeader) {
      elements.btnApproveWeekHeader.style.display = state.isSupervisor ? 'inline-flex' : 'none';
    }
    if (state.isSupervisor) {
      elements.btnSupervisor.textContent = '🔓 Supervisor ON';
      elements.btnSupervisor.classList.add('is-active-supervisor');
      elements.btnSupervisor.title = 'Supervisor mode active (click to log out)';
    } else {
      elements.btnSupervisor.textContent = '🔒 Supervisor';
      elements.btnSupervisor.classList.remove('is-active-supervisor');
      elements.btnSupervisor.title = 'Switch to Supervisor mode (Password: haa)';
    }
  }

  function openSupervisorModal(target) {
    pendingApprovalTarget = target || null;
    if (elements.supervisorModal) {
      elements.supervisorModal.style.display = 'flex';
      if (elements.supervisorPasswordInput) {
        elements.supervisorPasswordInput.value = '';
        setTimeout(() => elements.supervisorPasswordInput.focus(), 60);
      }
      if (elements.supervisorErrorMsg) {
        elements.supervisorErrorMsg.textContent = '';
      }
    }
  }

  function closeSupervisorModal() {
    if (elements.supervisorModal) {
      elements.supervisorModal.style.display = 'none';
    }
    pendingApprovalTarget = null;
  }

  function handleSupervisorAuth() {
    const entered = (elements.supervisorPasswordInput ? elements.supervisorPasswordInput.value : '').trim();
    if (entered === 'haa') {
      state.isSupervisor = true;
      sessionStorage.setItem('it_shift_supervisor', 'true');
      const target = pendingApprovalTarget;
      closeSupervisorModal();

      if (target) {
        if (target.action === 'approve_week') {
          executeApproveEntireWeek();
        } else if (target.action === 'export_csv') {
          openCsvExportModal();
        } else {
          const { day, empIdx } = target;
          const weekData = getOrCreateCurrentWeekData();
          const dObj = weekData.days.find(d => d.day === day);
          if (dObj && dObj.shifts[empIdx]) {
            const shift = dObj.shifts[empIdx];
            const cur = getApprovalDetails(shift.approval);
            shift.approval = cur.next;
            markDirty();
            showToast(`${state.employees[empIdx].name}: Status changed to [${cur.next}]`);
          }
        }
      } else {
        showToast('Supervisor mode activated.');
      }
      render();
    } else {
      if (elements.supervisorErrorMsg) {
        elements.supervisorErrorMsg.textContent = 'Incorrect password.';
      }
      if (elements.supervisorPasswordInput) {
        elements.supervisorPasswordInput.select();
      }
    }
  }

  // --- Bulk Week Approval ---
  function handleApproveWeekRequest() {
    if (!state.isSupervisor) {
      openSupervisorModal({ action: 'approve_week' });
      return;
    }
    executeApproveEntireWeek();
  }

  function executeApproveEntireWeek() {
    executeApproveWeekByYearAndNumber(state.year, state.weekNum);
  }

  function executeApproveWeekByYearAndNumber(year, weekNum) {
    const weekData = getOrCreateWeekData(year, weekNum);
    let totalCount = 0;
    let approvedCount = 0;

    weekData.days.forEach(d => {
      d.shifts.forEach(s => {
        const details = computeShiftDetails(s);
        if (s.dayoff || details.isActive) {
          totalCount++;
          if (s.approval === 'Approved') approvedCount++;
        }
      });
    });

    if (totalCount === 0) {
      showToast(`No scheduled shifts found for Week ${weekNum} (${year}).`);
      return;
    }

    if (approvedCount === totalCount) {
      const confirmReset = confirm(`All shifts for Week ${weekNum} (${year}) (${totalCount} shifts) are already Approved.\n\nDo you want to reset all of them to 'Pending'?`);
      if (confirmReset) {
        weekData.days.forEach(d => {
          d.shifts.forEach(s => {
            const details = computeShiftDetails(s);
            if (s.dayoff || details.isActive) {
              s.approval = 'Pending';
            }
          });
        });
        markDirty();
        render();
        showToast(`Week ${weekNum} (${year}): Shifts reset to Pending.`);
      }
      return;
    }

    weekData.days.forEach(d => {
      d.shifts.forEach(s => {
        const details = computeShiftDetails(s);
        if (s.dayoff || details.isActive) {
          s.approval = 'Approved';
        }
      });
    });

    markDirty();
    render();
    showToast(`🎉 Week ${weekNum} (${year}): All ${totalCount} shifts Approved.`);
  }

  function updateApproveWeekButtons() {
    const weekData = getOrCreateCurrentWeekData();
    let weekTotalCount = 0;
    let weekApprovedCount = 0;
    weekData.days.forEach(d => {
      d.shifts.forEach(s => {
        const details = computeShiftDetails(s);
        if (s.dayoff || details.isActive) {
          weekTotalCount++;
          if (s.approval === 'Approved') weekApprovedCount++;
        }
      });
    });

    const isWeekAllApproved = weekApprovedCount === weekTotalCount && weekTotalCount > 0;
    const weekApproveLabel = isWeekAllApproved 
      ? `✓ Week Approved (${weekApprovedCount}/${weekTotalCount})` 
      : `✓ Approve Entire Week (${weekApprovedCount}/${weekTotalCount})`;
    const weekApproveClass = isWeekAllApproved ? 'btn-approve-week is-all-approved' : 'btn-approve-week';

    if (elements.btnApproveWeekHeader) {
      elements.btnApproveWeekHeader.style.display = (state.isSupervisor && state.currentView === 'day') ? 'inline-flex' : 'none';
      elements.btnApproveWeekHeader.textContent = weekApproveLabel;
      elements.btnApproveWeekHeader.classList.toggle('is-all-approved', isWeekAllApproved);
      elements.btnApproveWeekHeader.title = isWeekAllApproved
        ? `All ${weekApprovedCount}/${weekTotalCount} shifts approved (click to reset to Pending)`
        : `Approve all shifts for this week as Supervisor (${weekApprovedCount}/${weekTotalCount})`;
    }

    const dailyApproveBtn = document.getElementById('btnApproveWeek');
    if (dailyApproveBtn) {
      dailyApproveBtn.style.display = state.isSupervisor ? 'inline-flex' : 'none';
      dailyApproveBtn.textContent = weekApproveLabel;
      dailyApproveBtn.className = weekApproveClass;
    }
  }

  // --- Event Listeners ---
  function setupEventListeners() {
    // Bulk Week Approval Header Button
    if (elements.btnApproveWeekHeader) {
      elements.btnApproveWeekHeader.addEventListener('click', handleApproveWeekRequest);
    }

    // Supervisor Mode Header Button
    if (elements.btnSupervisor) {
      elements.btnSupervisor.addEventListener('click', () => {
        if (state.isSupervisor) {
          state.isSupervisor = false;
          sessionStorage.removeItem('it_shift_supervisor');
          render();
          showToast('Supervisor mode deactivated.');
        } else {
          openSupervisorModal(null);
        }
      });
    }

    // Supervisor Modal Controls
    if (elements.btnSubmitSupervisorModal) {
      elements.btnSubmitSupervisorModal.addEventListener('click', handleSupervisorAuth);
    }
    if (elements.supervisorPasswordInput) {
      elements.supervisorPasswordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSupervisorAuth();
        if (e.key === 'Escape') closeSupervisorModal();
      });
    }
    if (elements.btnCancelSupervisorModal) {
      elements.btnCancelSupervisorModal.addEventListener('click', closeSupervisorModal);
    }
    if (elements.btnCloseSupervisorModal) {
      elements.btnCloseSupervisorModal.addEventListener('click', closeSupervisorModal);
    }
    if (elements.supervisorModal) {
      elements.supervisorModal.addEventListener('click', (e) => {
        if (e.target === elements.supervisorModal) closeSupervisorModal();
      });
    }
    // 2-Stage View Switcher
    elements.viewSwitcher.addEventListener('click', (e) => {
      const btn = e.target.closest('.view-btn');
      if (!btn) return;
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentView = btn.dataset.view;
      render();
    });

    // Navigator Prev / Next / Today
    elements.btnNavPrev.addEventListener('click', () => navigateDate(-1));
    elements.btnNavNext.addEventListener('click', () => navigateDate(1));
    elements.btnNavToday.addEventListener('click', () => {
      state.selectedDate = getTodayDate();
      state.miniCalDate = new Date(state.selectedDate.getTime());
      syncDateState();
      render();
      showToast(`Jumped to today (${formatDateIso(state.selectedDate)}).`);
    });

    // Mini-Calendar Popover trigger
    if (elements.btnPeriodTrigger && elements.miniCalPopover) {
      elements.btnPeriodTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = elements.miniCalPopover.style.display === 'block';
        if (!isOpen) {
          state.miniCalDate = new Date(state.selectedDate.getTime());
          elements.miniCalPopover.style.display = 'block';
          renderMiniCal();
        } else {
          elements.miniCalPopover.style.display = 'none';
        }
      });

      elements.btnMiniCalPrevMonth.addEventListener('click', (e) => {
        e.stopPropagation();
        state.miniCalDate.setUTCMonth(state.miniCalDate.getUTCMonth() - 1);
        renderMiniCal();
      });

      elements.btnMiniCalNextMonth.addEventListener('click', (e) => {
        e.stopPropagation();
        state.miniCalDate.setUTCMonth(state.miniCalDate.getUTCMonth() + 1);
        renderMiniCal();
      });

      elements.btnMiniCalToday.addEventListener('click', (e) => {
        e.stopPropagation();
        state.selectedDate = getTodayDate();
        state.miniCalDate = new Date(state.selectedDate.getTime());
        syncDateState();
        elements.miniCalPopover.style.display = 'none';
        render();
        showToast(`Jumped to today (${formatDateIso(state.selectedDate)}).`);
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-display-wrap')) {
          elements.miniCalPopover.style.display = 'none';
        }
      });
    }

    // Top Header Actions
    if (elements.btnExportCSV) {
      elements.btnExportCSV.addEventListener('click', () => {
        if (!state.isSupervisor) {
          openSupervisorModal({ action: 'export_csv' });
          return;
        }
        openCsvExportModal();
      });
    }

    // CSV Modal Controls
    if (elements.btnCloseCsvModal) {
      elements.btnCloseCsvModal.addEventListener('click', closeCsvExportModal);
    }
    if (elements.btnCancelCsvModal) {
      elements.btnCancelCsvModal.addEventListener('click', closeCsvExportModal);
    }
    if (elements.btnSubmitCsvModal) {
      elements.btnSubmitCsvModal.addEventListener('click', handleCsvExportSubmit);
    }
    if (elements.csvExportModal) {
      elements.csvExportModal.addEventListener('click', (e) => {
        if (e.target === elements.csvExportModal) closeCsvExportModal();
      });
    }
    if (elements.csvStartDate) {
      elements.csvStartDate.addEventListener('input', () => {
        if (elements.csvModalErrorMsg) elements.csvModalErrorMsg.textContent = '';
      });
    }
    if (elements.csvEndDate) {
      elements.csvEndDate.addEventListener('input', () => {
        if (elements.csvModalErrorMsg) elements.csvModalErrorMsg.textContent = '';
      });
    }

    // CSV Presets
    if (elements.btnPresetThisWeek) {
      elements.btnPresetThisWeek.addEventListener('click', () => {
        const range = getThisWeekMondayAndFridayFromToday();
        if (elements.csvStartDate) elements.csvStartDate.value = range.monday;
        if (elements.csvEndDate) elements.csvEndDate.value = range.friday;
        if (elements.csvModalErrorMsg) elements.csvModalErrorMsg.textContent = '';
      });
    }

    if (elements.btnPresetThisMonth) {
      elements.btnPresetThisMonth.addEventListener('click', () => {
        const today = getTodayDate();
        const y = today.getUTCFullYear();
        const m = today.getUTCMonth();
        const firstDay = new Date(Date.UTC(y, m, 1));
        const lastDay = new Date(Date.UTC(y, m + 1, 0));
        if (elements.csvStartDate) elements.csvStartDate.value = formatDateIso(firstDay);
        if (elements.csvEndDate) elements.csvEndDate.value = formatDateIso(lastDay);
        if (elements.csvModalErrorMsg) elements.csvModalErrorMsg.textContent = '';
      });
    }

    if (elements.btnPresetAll) {
      elements.btnPresetAll.addEventListener('click', () => {
        const earliest = getEarliestScheduledDate();
        const latest = getLatestScheduledDate();
        if (earliest && latest) {
          if (elements.csvStartDate) elements.csvStartDate.value = earliest;
          if (elements.csvEndDate) elements.csvEndDate.value = latest;
        } else {
          if (elements.csvStartDate) elements.csvStartDate.value = '2026-09-01';
          if (elements.csvEndDate) elements.csvEndDate.value = '2026-09-30';
        }
        if (elements.csvModalErrorMsg) elements.csvModalErrorMsg.textContent = '';
      });
    }

    // Save & Discard Controls
    if (elements.btnSaveChanges) {
      elements.btnSaveChanges.addEventListener('click', handleSaveChanges);
    }
    if (elements.btnDiscardChanges) {
      elements.btnDiscardChanges.addEventListener('click', handleDiscardChanges);
    }

    // Warn before closing tab if unsaved changes exist
    window.addEventListener('beforeunload', (e) => {
      if (state.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    // Cross-tab synchronization & conflict warning
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) {
        if (!state.hasUnsavedChanges) {
          loadLocalCache();
          render();
          showToast('Schedule data updated from another tab.');
        } else {
          showToast('Notice: Schedules updated in another tab. Save or discard your changes.');
        }
      }
    });

    // Periodic & window-focus cloud synchronization
    window.addEventListener('focus', () => {
      fetchCloudSchedules(true);
    });

    setInterval(() => {
      fetchCloudSchedules(true);
    }, 45000);
  }

  function navigateDate(delta) {
    if (state.currentView === 'month') {
      // Navigate month
      const y = state.selectedDate.getUTCFullYear();
      const m = state.selectedDate.getUTCMonth() + delta;
      state.selectedDate = new Date(Date.UTC(y, m, 1));
    } else {
      // Navigate day (skip weekends for weekday work shift: Fri -> Mon, Mon -> Fri)
      const dayOfWeek = state.selectedDate.getUTCDay();
      let dayStep = delta;
      if (delta > 0) {
        if (dayOfWeek === 5) dayStep = 3; // Fri -> Mon
        else if (dayOfWeek === 6) dayStep = 2; // Sat -> Mon
      } else if (delta < 0) {
        if (dayOfWeek === 1) dayStep = -3; // Mon -> Fri
        else if (dayOfWeek === 0) dayStep = -2; // Sun -> Fri
      }
      state.selectedDate = new Date(state.selectedDate.getTime() + dayStep * 86400000);
    }
    syncDateState();
    render();
  }

  // --- Main Render Dispatcher ---
  function render() {
    if (state.currentView !== 'month') {
      const dayOfWeek = state.selectedDate.getUTCDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        state.selectedDate = getMondayOfIsoWeek(state.year, state.weekNum);
        syncDateState();
      }
    }

    updateSupervisorButton();
    updateApproveWeekButtons();
    updateSaveButtons();
    updateNavigatorBar();
    syncViewSwitcherButtons();
    toggleViewContainers();

    if (state.currentView === 'month') {
      renderMonthlyView();
    } else {
      renderDailyView();
    }
  }

  function syncViewSwitcherButtons() {
    if (!elements.viewSwitcher) return;
    elements.viewSwitcher.querySelectorAll('.view-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.view === state.currentView);
    });
  }

  function toggleViewContainers() {
    elements.monthlyViewContainer.style.display = state.currentView === 'month' ? 'block' : 'none';
    elements.dailyViewContainer.style.display = state.currentView === 'day' ? 'block' : 'none';

    if (state.currentView === 'month') {
      elements.instructionsBar.textContent = 'Click a date cell to view and edit that day\'s schedule.';
    } else {
      elements.instructionsBar.textContent = 'Click the 5-day cards at top to switch days, and click time slots to set shifts.';
    }
  }

  function updateNavigatorBar() {
    const y = state.selectedDate.getUTCFullYear();
    const m = state.selectedDate.getUTCMonth();
    const d = state.selectedDate.getUTCDate();
    const dayOfWeek = state.selectedDate.getUTCDay();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Update title based on active view
    if (state.currentView === 'month') {
      elements.navTitleLabel.textContent = `${monthNames[m]} ${y}`;
    } else {
      elements.navTitleLabel.textContent = `${DAY_NAMES_FULL_EN[dayOfWeek]}, ${monthShort[m]} ${d}, ${y}`;
    }

    if (elements.miniCalPopover && elements.miniCalPopover.style.display === 'block') {
      renderMiniCal();
    }
  }

  // --- Compute Shift Details ---
  function computeShiftDetails(shift) {
    if (shift.dayoff) {
      return { text: 'OFF', shortText: 'OFF', hours: 0, isOff: true, isActive: false };
    }
    if (shift.startSlot === -1 || shift.endSlot === -1 || shift.startSlot > shift.endSlot) {
      return { text: '-', shortText: '-', hours: 0, isOff: false, isActive: false };
    }

    const startSlotObj = state.timeSlots[shift.startSlot];
    const endSlotObj = state.timeSlots[shift.endSlot];

    if (!startSlotObj || !endSlotObj) {
      return { text: '-', shortText: '-', hours: 0, isOff: false, isActive: false };
    }

    const text = `${startSlotObj.start} - ${endSlotObj.end}`;
    // Short format for monthly view: e.g. "9A-1P" or "8A-12P"
    const startShort = startSlotObj.start.replace(':00', '').replace(' ', '');
    const endShort = endSlotObj.end.replace(':00', '').replace(' ', '');
    const shortText = `${startShort}-${endShort}`;

    const hours = (shift.endSlot - shift.startSlot + 1) * 1.0;
    return { text, shortText, hours, isOff: false, isActive: true };
  }

  // ==========================================================================
  // MINI-CALENDAR POPOVER (Week Highlight & Date Jump)
  // ==========================================================================
  function renderMiniCal() {
    if (!elements.miniCalPopover || elements.miniCalPopover.style.display === 'none') return;

    const y = state.miniCalDate.getUTCFullYear();
    const m = state.miniCalDate.getUTCMonth();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    elements.miniCalMonthTitle.textContent = `${monthNames[m]} ${y}`;

    const firstDay = new Date(Date.UTC(y, m, 1));
    const lastDay = new Date(Date.UTC(y, m + 1, 0));
    const totalDays = lastDay.getUTCDate();
    const startDayOfWeek = firstDay.getUTCDay(); // 0=Sun
    const gridStartDate = new Date(firstDay.getTime() - startDayOfWeek * 86400000);

    const rowCount = (startDayOfWeek + totalDays) > 35 ? 6 : 5;
    let html = '';

    for (let r = 0; r < rowCount; r++) {
      html += `<div class="mini-cal-week-row">`;

      for (let c = 0; c < 7; c++) {
        const cellDate = new Date(gridStartDate.getTime() + (r * 7 + c) * 86400000);
        const cellDateStr = formatDateIso(cellDate);
        const isCurrentMonth = cellDate.getUTCMonth() === m;
        const isToday = cellDateStr === getTodayIso();
        const isSelectedDay = cellDateStr === formatDateIso(state.selectedDate);
        const dayNum = cellDate.getUTCDate();

        let dayClass = 'mini-cal-day';
        if (!isCurrentMonth) dayClass += ' other-month';
        if (c === 0) dayClass += ' is-sun';
        if (c === 6) dayClass += ' is-sat';
        if (isToday) dayClass += ' is-today';
        if (isSelectedDay) dayClass += ' is-selected-day';

        html += `<span class="${dayClass}" data-date="${cellDateStr}">${dayNum}</span>`;
      }

      html += `</div>`;
    }

    elements.miniCalGrid.innerHTML = html;

    elements.miniCalGrid.querySelectorAll('.mini-cal-day').forEach(daySpan => {
      daySpan.addEventListener('click', (e) => {
        e.stopPropagation();
        const dateStr = daySpan.dataset.date;
        if (!dateStr) return;
        const parts = dateStr.split('-').map(Number);
        state.selectedDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
        syncDateState();
        elements.miniCalPopover.style.display = 'none';
        render();
      });
    });
  }

  // ==========================================================================
  // 1. MONTHLY VIEW
  // ==========================================================================
  function renderMonthlyView() {
    const y = state.selectedDate.getUTCFullYear();
    const m = state.selectedDate.getUTCMonth();

    // Find all Monday-Friday weeks that contain at least one weekday of this month
    const firstDay = new Date(Date.UTC(y, m, 1));
    let curFirst = new Date(firstDay.getTime());
    while (curFirst.getUTCDay() === 0 || curFirst.getUTCDay() === 6) {
      curFirst.setUTCDate(curFirst.getUTCDate() + 1);
    }
    // Monday of the week containing the first weekday
    const startMonday = new Date(curFirst.getTime());
    const startDow = startMonday.getUTCDay(); // 1 = Mon
    startMonday.setUTCDate(startMonday.getUTCDate() - (startDow - 1));

    // Last weekday of month
    const lastDay = new Date(Date.UTC(y, m + 1, 0));
    let curLast = new Date(lastDay.getTime());
    while (curLast.getUTCDay() === 0 || curLast.getUTCDay() === 6) {
      curLast.setUTCDate(curLast.getUTCDate() - 1);
    }
    // Monday of the week containing the last weekday
    const endMonday = new Date(curLast.getTime());
    const endDow = endMonday.getUTCDay();
    endMonday.setUTCDate(endMonday.getUTCDate() - (endDow - 1));

    const weekMondays = [];
    let curMonday = new Date(startMonday.getTime());
    while (curMonday.getTime() <= endMonday.getTime()) {
      weekMondays.push(new Date(curMonday.getTime()));
      curMonday.setUTCDate(curMonday.getUTCDate() + 7);
    }

    const weekColHeader = state.isSupervisor ? 'Week / Approval' : 'Wk';

    let html = `
      <div class="month-calendar-card ${state.isSupervisor ? 'is-supervisor' : ''}">
        <div class="month-weekdays-grid">
          <div class="month-weekday-header month-week-col-header">${weekColHeader}</div>
          <div class="month-weekday-header">Mon</div>
          <div class="month-weekday-header">Tue</div>
          <div class="month-weekday-header">Wed</div>
          <div class="month-weekday-header">Thu</div>
          <div class="month-weekday-header">Fri</div>
        </div>
        <div class="month-days-grid">
    `;

    for (let r = 0; r < weekMondays.length; r++) {
      const rowMonday = weekMondays[r];
      // Thursday of this row (ISO-8601 standard week anchor)
      const rowThursday = new Date(rowMonday.getTime() + 3 * 86400000);
      const rowIso = getIsoWeekAndYear(formatDateIso(rowThursday));
      const isActiveWeek = rowIso.year === state.year && rowIso.week === state.weekNum;

      // Shifts count for this row's week
      const weekData = getOrCreateWeekData(rowIso.year, rowIso.week);
      let totalCount = 0;
      let approvedCount = 0;
      if (weekData && Array.isArray(weekData.days)) {
        weekData.days.forEach(d => {
          d.shifts.forEach(s => {
            const details = computeShiftDetails(s);
            if (s.dayoff || details.isActive) {
              totalCount++;
              if (s.approval === 'Approved') approvedCount++;
            }
          });
        });
      }

      const isAllApproved = approvedCount === totalCount && totalCount > 0;
      const isEmpty = totalCount === 0;

      let weekCellHtml = '';
      if (state.isSupervisor) {
        let btnText = `✓ Approve (${approvedCount}/${totalCount})`;
        let btnClass = 'btn-month-approve';
        let btnTitle = `Approve all shifts for Week ${rowIso.week} (${approvedCount}/${totalCount})`;

        if (isAllApproved) {
          btnText = `✓ Approved (${approvedCount}/${totalCount})`;
          btnClass += ' is-all-approved';
          btnTitle = `All ${totalCount} shifts approved (click to reset to Pending)`;
        } else if (isEmpty) {
          btnText = '✓ Approve (0/0)';
          btnClass += ' is-empty';
          btnTitle = `No shifts scheduled for Week ${rowIso.week}`;
        }

        weekCellHtml = `
          <div class="month-week-cell ${isActiveWeek ? 'is-active-week' : ''}" data-year="${rowIso.year}" data-week="${rowIso.week}">
            <div class="month-week-badge-wrap">
              <span class="month-week-badge" data-year="${rowIso.year}" data-week="${rowIso.week}" title="Jump to Week ${rowIso.week}">W${rowIso.week}</span>
            </div>
            <button type="button" class="${btnClass}" data-action="approve-week" data-year="${rowIso.year}" data-week="${rowIso.week}" ${isEmpty ? 'disabled' : ''} title="${btnTitle}">
              ${btnText}
            </button>
          </div>
        `;
      } else {
        weekCellHtml = `
          <div class="month-week-cell ${isActiveWeek ? 'is-active-week' : ''}" data-year="${rowIso.year}" data-week="${rowIso.week}">
            <span class="month-week-badge" data-year="${rowIso.year}" data-week="${rowIso.week}" title="Jump to Week ${rowIso.week}">W${rowIso.week}</span>
          </div>
        `;
      }

      html += weekCellHtml;

      // 5 Weekdays of this row: Monday to Friday
      for (let c = 0; c < 5; c++) {
        const cellDate = new Date(rowMonday.getTime() + c * 86400000);
        const cellDateStr = formatDateIso(cellDate);
        const isCurrentMonth = cellDate.getUTCMonth() === m;
        const isToday = cellDateStr === getTodayIso();
        const isSelected = cellDateStr === formatDateIso(state.selectedDate);
        const dayNum = cellDate.getUTCDate();

        let cellClass = 'month-day-cell';
        if (!isCurrentMonth) cellClass += ' other-month';
        if (isActiveWeek) cellClass += ' is-active-week-cell';
        if (isToday) cellClass += ' is-today';
        if (isSelected) cellClass += ' is-selected';

        let contentHtml = '';
        let monthApprovalNeededHtml = '';

        // Weekday shift summary
        const dayData = getShiftForDate(cellDate);
        if (dayData && dayData.shifts) {
          let hasAnySchedule = false;
          let hasUnapproved = false;
          dayData.shifts.forEach(s => {
            const details = computeShiftDetails(s);
            const hasSchedule = s.dayoff || details.isActive;
            if (hasSchedule) {
              hasAnySchedule = true;
              if (s.approval !== 'Approved') {
                hasUnapproved = true;
              }
            }
          });

          if (hasAnySchedule && hasUnapproved) {
            monthApprovalNeededHtml = '<span class="month-approval-needed" title="Pending approval shifts exist"><span class="month-approval-dot"></span>Needs Approval</span>';
          }

          contentHtml = '<div class="month-shifts-list">';
          dayData.shifts.forEach((s, idx) => {
            const emp = state.employees[idx];
            const details = computeShiftDetails(s);
            const isOff = details.isOff;
            const shiftBadgeClass = isOff ? 'month-shift-tag is-off' : 'month-shift-tag';
            contentHtml += `
              <div class="${shiftBadgeClass}">
                <span><strong>${emp.name}</strong></span>
                <span>${details.shortText}</span>
              </div>
            `;
          });
          contentHtml += '</div>';
        }

        html += `
          <div class="${cellClass}" data-date="${cellDateStr}">
            <div class="month-cell-header">
              <span class="month-cell-date">${dayNum}</span>
              ${monthApprovalNeededHtml}
            </div>
            ${contentHtml}
          </div>
        `;
      }
    }

    html += `
        </div>
      </div>
    `;

    elements.monthlyViewContainer.innerHTML = html;

    // Attach click events on week approve buttons
    elements.monthlyViewContainer.querySelectorAll('.btn-month-approve').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const yr = parseInt(btn.dataset.year, 10);
        const wk = parseInt(btn.dataset.week, 10);
        if (!isNaN(yr) && !isNaN(wk)) {
          executeApproveWeekByYearAndNumber(yr, wk);
        }
      });
    });

    // Attach click events on week badges / cells to jump to that week's daily schedule
    elements.monthlyViewContainer.querySelectorAll('.month-week-badge, .month-week-cell').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.btn-month-approve')) return;
        const yr = parseInt(el.dataset.year, 10);
        const wk = parseInt(el.dataset.week, 10);
        if (!isNaN(yr) && !isNaN(wk)) {
          const mondayDate = getMondayOfIsoWeek(yr, wk);
          state.selectedDate = mondayDate;
          syncDateState();
          switchView('day');
          showToast(`Jumped to Week ${wk} (${formatDateIso(mondayDate)}).`);
        }
      });
    });

    // Attach click events on day cells
    elements.monthlyViewContainer.querySelectorAll('.month-day-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const dateStr = cell.dataset.date;
        if (!dateStr) return;
        const parts = dateStr.split('-').map(Number);
        state.selectedDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
        syncDateState();
        switchView('day');
      });
    });
  }

  // ==========================================================================
  // DAILY VIEW (with 5-Day Weekly Strip at top)
  // ==========================================================================
  function renderDailyView() {
    const dayOfWeek = state.selectedDate.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat

    // If selected date is weekend, jump to Monday of current week
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      state.selectedDate = getMondayOfIsoWeek(state.year, state.weekNum);
      syncDateState();
    }

    const currentDayOfWeek = state.selectedDate.getUTCDay();
    const dayIndex = Math.max(0, Math.min(4, currentDayOfWeek - 1)); // 0=Mon, ..., 4=Fri
    const weekData = getOrCreateCurrentWeekData();
    const dayObj = weekData.days[dayIndex];
    const dateHeaderString = getDayHeaderString(dayIndex, state.year, state.weekNum);

    // 1. Build 5-Day Weekly Strip
    const monday = getMondayOfIsoWeek(state.year, state.weekNum);
    const dayNamesEn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

    let stripHtml = '<div class="weekly-calendar-strip">';
    weekData.days.forEach((d, dIdx) => {
      const dayDate = new Date(monday.getTime() + dIdx * 86400000);
      const dayDateIso = formatDateIso(dayDate);
      const isToday = dayDateIso === getTodayIso();
      const isActiveDay = dIdx === dayIndex;
      const dayNum = dayDate.getUTCDate();
      const monthShort = formatDateShort(dayDate).split(' ')[1];

      let workingCount = 0;
      let offCount = 0;
      let hasUnapproved = false;
      d.shifts.forEach(s => {
        const details = computeShiftDetails(s);
        const hasSchedule = s.dayoff || details.isActive;
        if (s.dayoff) offCount++;
        else if (details.isActive) workingCount++;

        if (hasSchedule && s.approval !== 'Approved') {
          hasUnapproved = true;
        }
      });

      const hasAnySchedule = (workingCount + offCount) > 0;
      const todayBadgeHtml = isToday ? '<span class="today-badge">TODAY</span>' : '';

      let statusHtml = '';
      if (!hasAnySchedule) {
        statusHtml = '<span class="weekly-strip-status status-empty">— No Shifts</span>';
      } else if (hasUnapproved) {
        statusHtml = '<span class="weekly-strip-status status-needs-approval" title="Shifts need approval">● Needs Approval</span>';
      } else {
        statusHtml = '<span class="weekly-strip-status status-approved" title="All shifts approved">✓ Approved</span>';
      }

      stripHtml += `
        <div class="weekly-strip-card ${isActiveDay ? 'is-active-day' : ''} ${isToday ? 'is-today' : ''}" 
             data-date="${dayDateIso}" 
             title="Switch to ${d.header}">
          <div class="weekly-strip-top">
            <span class="weekly-strip-day">${dayNamesEn[dIdx]}</span>
            ${todayBadgeHtml}
          </div>
          <div class="weekly-strip-middle">
            <span class="weekly-strip-date-num">${dayNum}</span>
            <span class="weekly-strip-date-month">${monthShort}</span>
          </div>
          <div class="weekly-strip-bottom">
            ${statusHtml}
          </div>
        </div>
      `;
    });
    stripHtml += '</div>';

    // 2. Build Focused Daily Table
    let weekTotalCount = 0;
    let weekApprovedCount = 0;
    weekData.days.forEach(d => {
      d.shifts.forEach(s => {
        const details = computeShiftDetails(s);
        if (s.dayoff || details.isActive) {
          weekTotalCount++;
          if (s.approval === 'Approved') weekApprovedCount++;
        }
      });
    });
    const isWeekAllApproved = weekApprovedCount === weekTotalCount && weekTotalCount > 0;
    const weekApproveLabel = isWeekAllApproved 
      ? `✓ Week Approved (${weekApprovedCount}/${weekTotalCount})` 
      : `✓ Approve Entire Week (${weekApprovedCount}/${weekTotalCount})`;
    const weekApproveClass = isWeekAllApproved ? 'btn-approve-week is-all-approved' : 'btn-approve-week';

    elements.dailyViewContainer.innerHTML = `
      ${stripHtml}

      <div class="day-section">
        <div class="day-header">
          <span class="day-name" style="cursor: default;">
            ${dateHeaderString}
          </span>
          <div class="day-header-actions">
            ${state.isSupervisor ? `
            <button type="button" class="${weekApproveClass}" id="btnApproveWeek" title="Approve all shifts for this week">
              ${weekApproveLabel}
            </button>
            ` : ''}
          </div>
        </div>

        <div class="schedule-table-wrap">
          <table class="schedule-table daily-table">
            <thead>
              <tr>
                <th class="col-campus">Campus</th>
                <th class="col-name">Onsite</th>
                <th class="col-off">Day Off</th>
                <th class="col-timeline">
                  <div class="timeline-header-grid">
                    ${state.timeSlots.map(ts => `
                      <div class="timeline-hour-slot major" title="${ts.start} ~ ${ts.end}">${ts.label || ts.hour}</div>
                    `).join('')}
                  </div>
                </th>
                <th class="col-shifttime">Shift Time</th>
                <th class="col-approval">Approval</th>
                <th class="col-notes">Notes</th>
              </tr>
            </thead>
            <tbody id="tbody-daily">
            </tbody>
          </table>
        </div>
      </div>
    `;

    // 3. Attach Click on 5-Day Strip Cards to switch active day instantly
    elements.dailyViewContainer.querySelectorAll('.weekly-strip-card').forEach(card => {
      card.addEventListener('click', () => {
        const dateStr = card.dataset.date;
        if (!dateStr) return;
        const parts = dateStr.split('-').map(Number);
        state.selectedDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
        syncDateState();
        render();
      });
    });

    const tbody = elements.dailyViewContainer.querySelector('#tbody-daily');
    renderEmployeeRows(tbody, dayObj, 'daily');
    bindTableEvents(elements.dailyViewContainer);
  }


  // --- Render Employee Rows (shared for Weekly & Daily) ---
  function renderEmployeeRows(tbody, dayObj, viewContext) {
    dayObj.shifts.forEach((shift, empIdx) => {
      const emp = state.employees[empIdx];
      const shiftDetails = computeShiftDetails(shift);

      const tr = document.createElement('tr');
      tr.className = shift.dayoff ? 'row-off' : '';

      // Time slots
      let timeSlotsHtml = '';
      state.timeSlots.forEach(ts => {
        let cellClass = 'time-slot-cell';
        if (shiftDetails.isActive) {
          if (ts.index >= shift.startSlot && ts.index <= shift.endSlot) {
            cellClass += ' active-shift';
          }
          if (ts.index === shift.startSlot) cellClass += ' slot-in';
          if (ts.index === shift.endSlot) cellClass += ' slot-out';
        }
        if (shift.dayoff) {
          cellClass += ' disabled-slot';
        }

        timeSlotsHtml += `
          <div class="${cellClass}" 
               data-day="${dayObj.day}" 
               data-empidx="${empIdx}" 
               data-slotidx="${ts.index}"
               title="${ts.start} ~ ${ts.end}">
          </div>
        `;
      });

      const appDetails = getApprovalDetails(shift.approval);
      const isLocked = !state.isSupervisor;
      const lockTitle = isLocked 
        ? 'Requires Supervisor authentication to change' 
        : 'Click to toggle status (Pending ➔ Approved ➔ Denied)';
      const approvalBtnHtml = `<button class="approval-btn ${appDetails.className} ${isLocked ? 'is-locked' : ''}" 
                                       data-day="${dayObj.day}" 
                                       data-empidx="${empIdx}"
                                       title="${lockTitle}">
                                 ${appDetails.label}
                               </button>`;

      tr.innerHTML = `
        <td class="col-campus">
          <span class="campus-badge">${shift.campus || (emp && emp.campus) || ''}</span>
        </td>
        <td class="col-name">${shift.name || (emp && emp.name) || ''}</td>
        <td class="col-off">
          <input type="checkbox" 
                 class="dayoff-checkbox" 
                 data-day="${dayObj.day}" 
                 data-empidx="${empIdx}" 
                 ${shift.dayoff ? 'checked' : ''}>
        </td>
        <td class="col-timeline">
          <div class="timeline-container">
            <div class="timeline-grid">
              ${timeSlotsHtml}
            </div>
          </div>
        </td>
        <td class="col-shifttime">${shiftDetails.text}</td>
        <td class="col-approval">${approvalBtnHtml}</td>
        <td class="col-notes">
          <input type="text" 
                 class="notes-input" 
                 data-day="${dayObj.day}" 
                 data-empidx="${empIdx}" 
                 value="${escapeHtml(shift.notes || '')}" 
                 placeholder="Notes">
        </td>
      `;

      tbody.appendChild(tr);
    });
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // --- Bind Table Interaction Events ---
  function bindTableEvents(container) {
    // 1. Day Off Toggle
    container.querySelectorAll('.dayoff-checkbox').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const day = e.target.dataset.day;
        const empIdx = parseInt(e.target.dataset.empidx, 10);
        const weekData = getOrCreateCurrentWeekData();
        const dObj = weekData.days.find(d => d.day === day);
        if (dObj && dObj.shifts[empIdx]) {
          dObj.shifts[empIdx].dayoff = e.target.checked;
          if (e.target.checked) dObj.shifts[empIdx].approval = 'Pending';
          markDirty();
          render();
        }
      });
    });

    // 2. Timeline Slot Click
    container.querySelectorAll('.time-slot-cell').forEach(cell => {
      cell.addEventListener('click', (e) => {
        const day = e.target.dataset.day;
        const empIdx = parseInt(e.target.dataset.empidx, 10);
        const slotIdx = parseInt(e.target.dataset.slotidx, 10);

        const weekData = getOrCreateCurrentWeekData();
        const dObj = weekData.days.find(d => d.day === day);
        if (!dObj || !dObj.shifts[empIdx]) return;

        const shift = dObj.shifts[empIdx];
        if (shift.dayoff) return;

        if (shift.startSlot === -1 || shift.endSlot === -1) {
          shift.startSlot = slotIdx;
          shift.endSlot = slotIdx;
        } else if (shift.startSlot === shift.endSlot && shift.startSlot === slotIdx) {
          shift.startSlot = -1;
          shift.endSlot = -1;
        } else if (slotIdx < shift.startSlot) {
          shift.startSlot = slotIdx;
        } else if (slotIdx > shift.endSlot) {
          shift.endSlot = slotIdx;
        } else {
          shift.endSlot = slotIdx;
        }

        markDirty();
        render();
      });
    });

    // 3. Approval Toggle (Supervisor Only)
    container.querySelectorAll('.approval-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const day = btn.dataset.day;
        const empIdx = parseInt(btn.dataset.empidx, 10);

        if (!state.isSupervisor) {
          openSupervisorModal({ day, empIdx });
          return;
        }

        const weekData = getOrCreateCurrentWeekData();
        const dObj = weekData.days.find(d => d.day === day);
        if (dObj && dObj.shifts[empIdx]) {
          const shift = dObj.shifts[empIdx];
          const cur = getApprovalDetails(shift.approval);
          shift.approval = cur.next;
          markDirty();
          render();
          showToast(`${state.employees[empIdx].name}: Status changed to [${cur.next}]`);
        }
      });
    });

    // 4. Notes Input
    container.querySelectorAll('.notes-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const day = e.target.dataset.day;
        const empIdx = parseInt(e.target.dataset.empidx, 10);
        const weekData = getOrCreateCurrentWeekData();
        const dObj = weekData.days.find(d => d.day === day);
        if (dObj && dObj.shifts[empIdx]) {
          dObj.shifts[empIdx].notes = e.target.value;
          markDirty();
        }
      });

      input.addEventListener('change', (e) => {
        const day = e.target.dataset.day;
        const empIdx = parseInt(e.target.dataset.empidx, 10);
        const weekData = getOrCreateCurrentWeekData();
        const dObj = weekData.days.find(d => d.day === day);
        if (dObj && dObj.shifts[empIdx]) {
          dObj.shifts[empIdx].notes = e.target.value.trim();
          markDirty();
        }
      });
    });

    // 5. Bulk Week Approval Button
    const btnApproveWeek = container.querySelector('#btnApproveWeek');
    if (btnApproveWeek) {
      btnApproveWeek.addEventListener('click', handleApproveWeekRequest);
    }
  }

  function switchView(viewName) {
    state.currentView = viewName;
    document.querySelectorAll('.view-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.view === viewName);
    });
    render();
  }

  // --- CSV Export with Date Range Modal ---
  function openCsvExportModal() {
    if (!elements.csvExportModal) return;

    // Automatically set end date to the latest date that has a registered schedule
    const latestDate = getLatestScheduledDate();
    const todayWeek = getThisWeekMondayAndFridayFromToday();

    if (elements.csvStartDate) {
      if (latestDate && todayWeek.monday > latestDate) {
        const { year: lYr, week: lWk } = getIsoWeekAndYear(latestDate);
        elements.csvStartDate.value = formatDateIso(getMondayOfIsoWeek(lYr, lWk));
      } else {
        elements.csvStartDate.value = todayWeek.monday;
      }
    }

    if (elements.csvEndDate) {
      if (latestDate) {
        elements.csvEndDate.value = latestDate;
      } else {
        elements.csvEndDate.value = todayWeek.friday;
      }
    }

    if (elements.csvModalErrorMsg) elements.csvModalErrorMsg.textContent = '';

    elements.csvExportModal.style.display = 'flex';
  }

  function closeCsvExportModal() {
    if (elements.csvExportModal) {
      elements.csvExportModal.style.display = 'none';
    }
    if (elements.csvModalErrorMsg) {
      elements.csvModalErrorMsg.textContent = '';
    }
  }

  function handleCsvExportSubmit() {
    const startStr = elements.csvStartDate ? elements.csvStartDate.value : '';
    const endStr = elements.csvEndDate ? elements.csvEndDate.value : '';

    if (!startStr || !endStr) {
      if (elements.csvModalErrorMsg) {
        elements.csvModalErrorMsg.textContent = 'Please select both start date and end date.';
      }
      return;
    }

    const start = new Date(startStr + 'T00:00:00Z');
    const end = new Date(endStr + 'T00:00:00Z');

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      if (elements.csvModalErrorMsg) {
        elements.csvModalErrorMsg.textContent = 'Start date must be before or equal to end date.';
      }
      return;
    }

    closeCsvExportModal();
    exportDateRangeToCSV(startStr, endStr);
  }

  function exportDateRangeToCSV(startStr, endStr) {
    const start = new Date(startStr + 'T00:00:00Z');
    const end = new Date(endStr + 'T00:00:00Z');

    // Columns: Date, Onsite, Shift Time, Approval, Notes
    const rows = [
      ['Date', 'Onsite', 'Shift Time', 'Approval', 'Notes']
    ];

    let curr = new Date(start.getTime());
    let rowCount = 0;

    while (curr <= end) {
      const dayOfWeek = curr.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        const dayIso = formatDateIso(curr);
        const dayNameEn = DAY_NAMES_EN[dayOfWeek];
        const dateDisplay = `${dayIso} (${dayNameEn})`;

        const dayData = getShiftForDate(curr);
        if (dayData && Array.isArray(dayData.shifts)) {
          dayData.shifts.forEach(shift => {
            const details = computeShiftDetails(shift);
            let timeStr = details.text;
            if (shift.dayoff) {
              timeStr = 'Day Off';
            } else if (!details.isActive) {
              timeStr = '-';
            }

            rows.push([
              dateDisplay,
              shift.name,
              timeStr,
              shift.approval || 'Pending',
              shift.notes || ''
            ]);
            rowCount++;
          });
        }
      }
      curr.setUTCDate(curr.getUTCDate() + 1);
    }

    if (rowCount === 0) {
      alert('No shift records found for the selected date range.');
      return;
    }

    // Generate CSV content with UTF-8 BOM for Excel compatibility
    const csvContent = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IT_Onsite_Shift_${startStr}_${endStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`CSV export complete (${startStr} ~ ${endStr}, ${rowCount} records)`);
  }

  function showToast(message) {
    if (!elements.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => {
        toast.remove();
      }, 250);
    }, 2600);
  }

  document.addEventListener('DOMContentLoaded', init);
})();

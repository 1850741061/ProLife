// 本地存储与数据持久化


function exportWidgetData() {
    if (typeof require === 'undefined') return;
    try {
        const fs = require('fs');
        const path = require('path');
        const dir = path.join(process.env.APPDATA || '', 'ProLife');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'widget-data.json'), JSON.stringify({
            todos: state.todos,
            projects: state.projects,
            dailyPlans: state.dailyPlans,
            groups: state.groups,
            ideas: state.ideas,
            ideaTags: state.ideaTags,
            auth: {
                user_id: localStorage.getItem('user_id'),
                access_token: localStorage.getItem('access_token'),
                refresh_token: localStorage.getItem('refresh_token')
            },
            themePrefs: window.getThemePrefs ? window.getThemePrefs() : {},
            updatedAt: new Date().toISOString()
        }));
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('main-data-changed');
    } catch (e) {
        console.warn('[Widget Export]', e);
    }
}
window.exportWidgetData = exportWidgetData;

function baseSave() {
    try {
        localStorage.setItem('todos', JSON.stringify(ensureSyncArray(state.todos)));
        localStorage.setItem('groups', JSON.stringify(ensureSyncArray(state.groups)));
        localStorage.setItem('transactions', JSON.stringify(dedupeFinanceTransactions(state.transactions)));
        localStorage.setItem('templates', JSON.stringify(ensureSyncArray(state.templates)));
        localStorage.setItem('archivedTodos', JSON.stringify(ensureSyncArray(state.archivedTodos)));
        localStorage.setItem('habits', JSON.stringify(ensureSyncArray(state.habits)));
        localStorage.setItem('habitRecords', JSON.stringify(ensureSyncObject(state.habitRecords)));
        localStorage.setItem('projects', JSON.stringify(ensureSyncArray(state.projects)));
        localStorage.setItem('milktea', JSON.stringify(ensureSyncObject(state.milktea)));
        localStorage.setItem('coffee', JSON.stringify(ensureSyncObject(state.coffee)));
        localStorage.setItem('drinkViewFilter', state.drinkViewFilter);
        localStorage.setItem('dailyPlans', JSON.stringify(ensureSyncArray(state.dailyPlans)));
        localStorage.setItem('ideas', JSON.stringify(ensureSyncArray(state.ideas)));
        localStorage.setItem('ideaTags', JSON.stringify(ensureSyncArray(state.ideaTags)));
        localStorage.setItem('deletedIds', JSON.stringify(ensureSyncArray(state.deletedIds)));
        if (currentUser && currentUser.id) {
            localStorage.setItem('data_owner_user_id', currentUser.id);
        }
        exportWidgetData();
    } catch (e) {
        console.error('[save] local cache failed:', e);
        window.__lastSyncErrorMessage = e?.stack || e?.message || String(e);
    }
}
window.baseSave = baseSave;

function normalizeFinanceTransactionId(id) {
    const raw = String(id ?? '').trim();
    if (!raw) return '';
    const prefixed = raw.match(/^(?:tx|mt)_(\d+)$/i);
    const normalized = prefixed ? prefixed[1] : raw;
    return /^\d+$/.test(normalized) ? String(Number(normalized)) : normalized;
}

function scoreFinanceTransaction(record) {
    if (!record || typeof record !== 'object') return 0;
    let score = 0;
    Object.values(record).forEach(value => {
        if (value !== null && value !== undefined && value !== '') score += 1;
    });
    if (record.milkteaRecordId != null) score += 5;
    if (record.catColor) score += 1;
    if (typeof record.id === 'number') score += 1;
    if (/^mt_\d+$/i.test(String(record.id ?? ''))) score += 2;
    return score;
}

function mergeFinanceTransactionRecords(primary, secondary, normalizedId) {
    const merged = { ...(secondary || {}), ...(primary || {}) };
    [primary, secondary].forEach(source => {
        if (!source || typeof source !== 'object') return;
        Object.entries(source).forEach(([key, value]) => {
            if (merged[key] === null || merged[key] === undefined || merged[key] === '') merged[key] = value;
        });
    });
    const milkteaRecordId = merged.milkteaRecordId ?? primary?.milkteaRecordId ?? secondary?.milkteaRecordId;
    if (milkteaRecordId != null) {
        merged.milkteaRecordId = milkteaRecordId;
        merged.id = 'mt_' + normalizeFinanceTransactionId(milkteaRecordId);
    } else if (/^\d+$/.test(normalizedId)) {
        merged.id = Number(normalizedId);
    } else {
        merged.id = normalizedId;
    }
    return merged;
}

function sameFinanceTransactionId(left, right) {
    const normalizedLeft = normalizeFinanceTransactionId(left);
    const normalizedRight = normalizeFinanceTransactionId(right);
    return normalizedLeft && normalizedLeft === normalizedRight;
}

function dedupeFinanceTransactions(records) {
    const merged = new Map();
    (records || []).forEach(record => {
        if (!record || typeof record !== 'object') return;
        const key = normalizeFinanceTransactionId(record.id);
        if (!key) return;
        const existing = merged.get(key);
        if (!existing) {
            merged.set(key, mergeFinanceTransactionRecords(record, null, key));
            return;
        }
        const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime() || 0;
        const currentTime = new Date(record.updatedAt || record.createdAt || 0).getTime() || 0;
        let preferred = existing;
        let fallback = record;
        if (currentTime > existingTime) {
            preferred = record;
            fallback = existing;
        } else if (currentTime === existingTime && scoreFinanceTransaction(record) > scoreFinanceTransaction(existing)) {
            preferred = record;
            fallback = existing;
        }
        merged.set(key, mergeFinanceTransactionRecords(preferred, fallback, key));
    });
    return Array.from(merged.values());
}

function mergeArrays(local, remote, deletedIds = []) {
    local = ensureSyncArray(local);
    remote = ensureSyncArray(remote);
    deletedIds = ensureSyncArray(deletedIds);
    const merged = new Map();
    const deletedSet = new Set(deletedIds);
    local.forEach(item => {
        if (!deletedSet.has(item.id)) merged.set(item.id, item);
    });
    remote.forEach(remoteItem => {
        if (deletedSet.has(remoteItem.id)) return;
        const localItem = merged.get(remoteItem.id);
        if (!localItem) {
            merged.set(remoteItem.id, remoteItem);
        } else {
            const localTime = new Date(localItem.updatedAt || localItem.createdAt || 0);
            const remoteTime = new Date(remoteItem.updatedAt || remoteItem.createdAt || 0);
            if (remoteTime > localTime) merged.set(remoteItem.id, remoteItem);
        }
    });
    return Array.from(merged.values());
}

function getSyncErrorToastMessage(fallback) {
    const detail = window.__lastSyncErrorMessage ? String(window.__lastSyncErrorMessage).replace(/\s+/g, ' ').slice(0, 96) : '';
    return detail ? (fallback + '：' + detail) : fallback;
}

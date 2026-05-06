// 应用主入口 - 初始化与事件绑定

function backupAccountScopedLocalData(ownerUserId) {
    try {
        const snapshot = {
            ownerUserId: ownerUserId || null,
            createdAt: new Date().toISOString(),
            data: {
                todos: ensureSyncArray(state.todos),
                groups: ensureSyncArray(state.groups),
                transactions: dedupeFinanceTransactions(state.transactions),
                templates: ensureSyncArray(state.templates),
                archivedTodos: ensureSyncArray(state.archivedTodos),
                habits: ensureSyncArray(state.habits),
                habitRecords: ensureSyncObject(state.habitRecords),
                projects: ensureSyncArray(state.projects),
                milktea: ensureSyncObject(state.milktea),
                coffee: ensureSyncObject(state.coffee),
                dailyPlans: ensureSyncArray(state.dailyPlans),
                deletedIds: ensureSyncArray(state.deletedIds)
            }
        };
        localStorage.setItem('last_account_data_backup', JSON.stringify(snapshot));
    } catch (e) { console.warn('[account-isolation] backup failed:', e); }
}

function hasAccountScopedLocalData() {
    const defaults = getAccountScopedDefaults();
    return ACCOUNT_SCOPED_STORAGE_KEYS.some(key => JSON.stringify(state[key]) !== JSON.stringify(defaults[key]));
}

function isolateLocalDataForUser(nextUserId) {
    if (!nextUserId) return false;
    const ownerUserId = localStorage.getItem('data_owner_user_id');
    if (!ownerUserId || ownerUserId === nextUserId) return false;
    if (hasAccountScopedLocalData()) backupAccountScopedLocalData(ownerUserId);
    console.warn('[account-isolation] switching cached local data owner:', ownerUserId, '=>', nextUserId);
    resetAccountScopedState();
    localStorage.setItem('data_owner_user_id', nextUserId);
    baseSave();
    renderAll();
    return true;
}

function renderStats() { updateStats(); }

function updateIdeasSidebarCount() {
    const countEl = document.getElementById('ideasSidebarCount');
    if (countEl && state.ideas) countEl.textContent = state.ideas.length || '';
}

function renderAll() {
    renderGroups();
    renderSidebarProjects();
    renderTodos();
    renderCalendar();
    renderFinance();
    if (document.getElementById('statTotal')) {
        updateStats();
    }
    if (document.getElementById('statTotalTasks')) {
        updateStatsCards();
    }
}

// --- 启动桌面小组件 ---
window.launchWidget = function() {
    if (typeof require !== 'undefined') {
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('launch-widget');
        ipcRenderer.once('widget-launch-result', (event, result) => {
            if (result.alreadyOpen) {
                showSyncToast('小组件已在运行中，已切换到前台', 'warning');
            } else {
                showSyncToast('正在启动桌面小组件...', 'success');
            }
        });
    } else {
        alert('桌面小组件仅在 Electron 桌面版中可用');
    }
};

// 监听小组件数据变更
if (typeof require !== 'undefined') {
    const { ipcRenderer: ipcR } = require('electron');
    ipcR.on('refresh-main-data', () => {
        try {
            const fs = require('fs');
            const path = require('path');
            const dataFile = path.join(process.env.APPDATA || '', 'ProLife', 'widget-data.json');
            if (fs.existsSync(dataFile)) {
                const raw = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
                if (raw.todos) state.todos = raw.todos;
                if (raw.projects) state.projects = raw.projects;
                if (raw.dailyPlans) state.dailyPlans = raw.dailyPlans;
                if (raw.groups) state.groups = raw.groups;
                if (raw.ideas) state.ideas = raw.ideas;
                if (raw.ideaTags) state.ideaTags = raw.ideaTags;
                const syncedThemeStyle = normalizeThemeStyle(raw.themePrefs?.style);
                if (raw.themePrefs && THEME_STYLE_META[syncedThemeStyle]) {
                    themeState.style = syncedThemeStyle;
                    if (raw.themePrefs.mode === 'light' || raw.themePrefs.mode === 'dark') {
                        themeState.mode = raw.themePrefs.mode;
                    }
                    applyTheme({ persist: true, syncWidget: false, rerenderCharts: true });
                }
                localStorage.setItem('todos', JSON.stringify(state.todos));
                localStorage.setItem('groups', JSON.stringify(state.groups));
                localStorage.setItem('projects', JSON.stringify(state.projects));
                localStorage.setItem('dailyPlans', JSON.stringify(state.dailyPlans));
                localStorage.setItem('ideas', JSON.stringify(state.ideas));
                localStorage.setItem('ideaTags', JSON.stringify(state.ideaTags));
                renderAll();
            }
        } catch(e) { console.warn('[Widget Sync]', e); }
    });

    ipcR.on('open-task-detail', (event, taskId) => {
        const todoTab = document.querySelector('.view-tab[data-view="todo"]');
        if (todoTab) todoTab.click();
        setTimeout(() => {
            if (typeof window.openTaskDetailModal === 'function') window.openTaskDetailModal(taskId);
        }, 200);
    });

    ipcR.on('open-project-task-detail', (event, { projectId, taskId }) => {
        if (typeof window.openProjectMindmap === 'function') window.openProjectMindmap(projectId);
        setTimeout(() => {
            const task = state.todos.find(t => t.id == taskId);
            if (task && typeof window.showTaskDetail === 'function') window.showTaskDetail(task);
        }, 400);
    });
}

// --- 初始化 ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initColorPicker();
    initFinanceCategorySelect();
    initCustomSelects();
    renderAll();
    document.getElementById('transDate').valueAsDate = new Date();
    document.getElementById('todoDate').valueAsDate = new Date();
    updateTodoFilterUI();
    initSearchFeature();
    initGlobalSearch();
    initBatchMode();
    initArchive();
    initRepeatOptions();
    initHabits();
    initProjects();
    initNotifications();
    initDragAndDrop();
    initTemplates();
    initStats();
    initPomodoro();
    initKeyboardShortcuts();
    initIdeas();
});

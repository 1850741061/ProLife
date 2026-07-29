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
                ideas: ensureSyncArray(state.ideas),
                ideaTags: ensureSyncArray(state.ideaTags),
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
    if (isElectron) {
        const ipcRenderer = window.desktopAPI.ipc;
        ipcRenderer.send('launch-widget');
        ipcRenderer.once('widget-launch-result', (event, result) => {
            if (result.alreadyOpen) {
                showSyncToast('小组件已在运行中，已切换到前台', 'warning');
            } else {
                showSyncToast('正在启动桌面小组件...', 'success');
            }
        });
    } else {
        showSyncToast('桌面小组件仅在 Electron 桌面版中可用', 'error');
    }
};

// 监听小组件数据变更
if (isElectron) {
    const ipcR = window.desktopAPI.ipc;
    ipcR.on('refresh-main-data', () => {
        try {
            const serialized = window.desktopAPI.readWidgetData();
            if (serialized) {
                const raw = JSON.parse(serialized);
                const legacyBase = {
                    todos: ensureSyncArray(raw.todos),
                    archivedTodos: ensureSyncArray(raw.archivedTodos),
                    groups: ensureSyncArray(raw.groups),
                    projects: ensureSyncArray(raw.projects),
                    dailyPlans: ensureSyncArray(raw.dailyPlans),
                    ideas: ensureSyncArray(raw.ideas),
                    deletedIds: ensureSyncArray(raw.deletedIds || raw.deletedids)
                };
                const candidateBase = raw.syncBase && typeof raw.syncBase === 'object' && !Array.isArray(raw.syncBase)
                    ? raw.syncBase
                    : legacyBase;
                const mergedDeletedIds = compactSyncTombstones(mergeSyncValue(
                    ensureSyncArray(state.deletedIds),
                    ensureSyncArray(raw.deletedIds || raw.deletedids),
                    ensureSyncArray(candidateBase.deletedIds || candidateBase.deletedids)
                ));
                const todoCollections = reconcileTodoCollections(
                    state.todos,
                    state.archivedTodos,
                    ensureSyncArray(raw.todos),
                    ensureSyncArray(raw.archivedTodos),
                    mergedDeletedIds,
                    ensureSyncArray(candidateBase.todos),
                    ensureSyncArray(candidateBase.archivedTodos)
                );
                state.todos = todoCollections.todos;
                state.archivedTodos = todoCollections.archivedTodos;
                state.groups = mergeEntityArrays(
                    state.groups,
                    ensureSyncArray(raw.groups),
                    mergedDeletedIds,
                    'group',
                    ensureSyncArray(candidateBase.groups)
                );
                state.projects = mergeEntityArrays(
                    state.projects,
                    ensureSyncArray(raw.projects),
                    mergedDeletedIds,
                    'project',
                    ensureSyncArray(candidateBase.projects)
                );
                state.dailyPlans = mergeEntityArrays(
                    state.dailyPlans,
                    ensureSyncArray(raw.dailyPlans),
                    mergedDeletedIds,
                    'daily-plan',
                    ensureSyncArray(candidateBase.dailyPlans)
                );
                state.ideas = mergeEntityArrays(
                    state.ideas,
                    ensureSyncArray(raw.ideas),
                    mergedDeletedIds,
                    'idea',
                    ensureSyncArray(candidateBase.ideas)
                );
                state.deletedIds = mergedDeletedIds;
                syncIdeaTags();
                const syncedThemeStyle = normalizeThemeStyle(raw.themePrefs?.style);
                if (raw.themePrefs && THEME_STYLE_META[syncedThemeStyle]) {
                    themeState.style = syncedThemeStyle;
                    if (raw.themePrefs.mode === 'light' || raw.themePrefs.mode === 'dark') {
                        themeState.mode = raw.themePrefs.mode;
                    }
                    applyTheme({ persist: true, syncWidget: false, rerenderCharts: true });
                }
                // save() 会按记录更新时间写回并走乐观并发同步；
                // main-data-changed 只让小组件刷新，不会反向触发 widget-data-changed，因而不会形成回环。
                save();
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
            const task = state.todos.find(t => String(t.id) === String(taskId));
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

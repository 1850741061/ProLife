// 应用状态管理

const DATA_VERSION = 1;
const DATA_VERSION_KEY = 'dataVersion';

let _idCounter = 0;
function uniqueId() { return Date.now() * 1000 + (++_idCounter % 1000); }

// 数据迁移机制
const migrations = [];

function migrateData() {
    const currentVersion = parseInt(localStorage.getItem(DATA_VERSION_KEY) || '0', 10);
    if (currentVersion >= DATA_VERSION) return;

    for (let v = currentVersion; v < DATA_VERSION; v++) {
        if (migrations[v]) migrations[v]();
    }
    localStorage.setItem(DATA_VERSION_KEY, String(DATA_VERSION));
}

// 示例迁移：v0 → v1 确保所有 ID 都是字符串
migrations[0] = function () {
    console.log('[migration] v0 → v1: normalizing IDs to strings');
    const ensureStringIds = (arr) => {
        if (!Array.isArray(arr)) return;
        arr.forEach(item => {
            if (item && item.id != null) item.id = String(item.id);
        });
    };
    ['todos', 'groups', 'templates', 'archivedTodos', 'habits', 'projects', 'dailyPlans'].forEach(key => {
        try { ensureStringIds(JSON.parse(localStorage.getItem(key) || '[]')); } catch (e) {}
    });
    // 写回
    ['todos', 'groups', 'templates', 'archivedTodos', 'habits', 'projects', 'dailyPlans'].forEach(key => {
        try {
            const data = JSON.parse(localStorage.getItem(key) || '[]');
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {}
    });
};

// 启动前先迁移
migrateData();

const state = {
    todos: JSON.parse(localStorage.getItem('todos')) || [],
    groups: JSON.parse(localStorage.getItem('groups')) || [{ id: 'default', name: '默认', color: '#3b82f6' }],
    transactions: JSON.parse(localStorage.getItem('transactions')) || [],
    currentGroupId: 'all',
    currentProjectId: null,
    filter: 'all',
    financeFilter: 'all',
    financeViewMode: 'list',
    view: 'todo',
    editingId: null,
    editingGroupId: null,
    editingTransId: null,
    selectedColorIndex: 3,
    calendarDate: new Date(),
    selectedDate: null,
    notificationsEnabled: localStorage.getItem('notificationsEnabled') === 'true',
    notificationTime: localStorage.getItem('notificationTime') || '09:00',
    searchQuery: '',
    batchMode: false,
    selectedTodos: new Set(),
    templates: JSON.parse(localStorage.getItem('templates')) || [],
    draggedTodoId: null,
    dragOverGroupId: null,
    expandedSubtasks: {},
    todoViewMode: localStorage.getItem('todoViewMode') || 'list',
    sortByDDL: 'off',
    archivedTodos: JSON.parse(localStorage.getItem('archivedTodos')) || [],
    habits: JSON.parse(localStorage.getItem('habits')) || [],
    habitRecords: JSON.parse(localStorage.getItem('habitRecords')) || {},
    projects: JSON.parse(localStorage.getItem('projects')) || [],
    milktea: JSON.parse(localStorage.getItem('milktea')) || { records: [], settings: { weeklyLimit: 2, monthlyLimit: 8 } },
    coffee: JSON.parse(localStorage.getItem('coffee')) || { records: [], settings: { weeklyLimit: 3, monthlyLimit: 12 } },
    drinkViewFilter: localStorage.getItem('drinkViewFilter') || 'all',
    dailyPlans: JSON.parse(localStorage.getItem('dailyPlans')) || [],
    ideas: JSON.parse(localStorage.getItem('ideas')) || [],
    ideaTags: JSON.parse(localStorage.getItem('ideaTags')) || [],
    deletedIds: JSON.parse(localStorage.getItem('deletedIds')) || [],
    ideaFilter: 'all',
    ideaFilterTag: null,
    ideaFullView: 'timeline',
    ideaFullFilter: 'all',
    ideaFullFilterTag: null,
};

const ACCOUNT_SCOPED_STORAGE_KEYS = [
    'todos', 'groups', 'transactions', 'templates', 'archivedTodos',
    'habits', 'habitRecords', 'projects', 'milktea', 'coffee', 'dailyPlans', 'deletedIds',
    'ideas', 'ideaTags'
];

let financeCats = {
    expense: JSON.parse(localStorage.getItem('customExpenseCategories')) || defaultFinanceCats.expense,
    income: JSON.parse(localStorage.getItem('customIncomeCategories')) || defaultFinanceCats.income
};

function saveCustomCategories() {
    localStorage.setItem('customExpenseCategories', JSON.stringify(financeCats.expense));
    localStorage.setItem('customIncomeCategories', JSON.stringify(financeCats.income));
}

function getCategoriesByType(type) {
    return financeCats[type] || [];
}

function getAllCategories() {
    return [...financeCats.expense, ...financeCats.income];
}

const financeCatsArray = financeCats.expense;

// 当前认证用户（由 sync.js 设置）
let currentUser = null;
let accessToken = null;
let refreshToken = null;
let supabaseClient = null;
let realtimeChannel = null;

function setCurrentUser(user) { currentUser = user; }
function setAccessToken(token) { accessToken = token; }
function setRefreshToken(token) { refreshToken = token; }
function setSupabaseClient(client) { supabaseClient = client; }
function setRealtimeChannel(channel) { realtimeChannel = channel; }

function resetAccountScopedState() {
    const defaults = getAccountScopedDefaults();
    state.todos = defaults.todos;
    state.groups = defaults.groups;
    state.transactions = defaults.transactions;
    state.templates = defaults.templates;
    state.archivedTodos = defaults.archivedTodos;
    state.habits = defaults.habits;
    state.habitRecords = defaults.habitRecords;
    state.projects = defaults.projects;
    state.milktea = defaults.milktea;
    state.coffee = defaults.coffee;
    state.dailyPlans = defaults.dailyPlans;
    state.ideas = defaults.ideas;
    state.ideaTags = defaults.ideaTags;
    state.deletedIds = defaults.deletedIds;
    state.currentGroupId = 'all';
    state.selectedTodos = new Set();
    state.batchMode = false;
    state.editingId = null;
    state.editingGroupId = null;
    state.editingTransId = null;
}

function getAccountScopedDefaults() {
    return {
        todos: [],
        groups: [{ id: 'default', name: '默认', color: '#3b82f6' }],
        transactions: [],
        templates: [],
        archivedTodos: [],
        habits: [],
        habitRecords: {},
        projects: [],
        milktea: { records: [], settings: { weeklyLimit: 2, monthlyLimit: 8 } },
        coffee: { records: [], settings: { weeklyLimit: 3, monthlyLimit: 12 } },
        dailyPlans: [],
        ideas: [],
        ideaTags: [],
        deletedIds: []
    };
}

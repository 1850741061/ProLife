// 主题系统


const THEME_STYLE_ALIASES = {
    'risograph': 'ink-wash',
    'glassmorphism': 'vaporwave'
};

function normalizeThemeStyle(style) {
    const normalized = THEME_STYLE_ALIASES[style] || style;
    return THEME_STYLE_META[normalized] ? normalized : 'pop-art';
}

function getStoredThemeStyle() {
    return normalizeThemeStyle(localStorage.getItem('themeStyle'));
}

function getStoredThemeMode() {
    const stored = localStorage.getItem('themeMode');
    if (stored === 'light' || stored === 'dark') return stored;
    return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
}

let themeState = {
    style: getStoredThemeStyle(),
    mode: getStoredThemeMode()
};

function getThemePrefs() {
    return { style: themeState.style, mode: themeState.mode };
}

function persistThemePrefs() {
    localStorage.setItem('themeStyle', themeState.style);
    localStorage.setItem('themeMode', themeState.mode);
    localStorage.setItem('theme', themeState.mode === 'dark' ? 'dark' : 'light');
}

function updateMetaThemeColor() {
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeMeta) return;
    const themeColor = getComputedStyle(document.body).getPropertyValue('--header-bg').trim()
        || getComputedStyle(document.body).getPropertyValue('--accent-color').trim();
    if (themeColor) themeMeta.setAttribute('content', themeColor);
}

function updateThemeUI() {
    const themeToggleBtn = document.getElementById('themeToggle');
    const themeStyleBtn = document.getElementById('themeStyleBtn');
    const themeModeBadge = document.getElementById('themeModeBadge');
    if (themeToggleBtn) {
        const isDark = themeState.mode === 'dark';
        themeToggleBtn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        themeToggleBtn.title = isDark ? '切换到亮色模式' : '切换到暗色模式';
    }
    if (themeStyleBtn) themeStyleBtn.title = THEME_STYLE_META[themeState.style].paletteTitle;
    if (themeModeBadge) themeModeBadge.textContent = THEME_STYLE_META[themeState.style].modeLabels[themeState.mode];
    document.querySelectorAll('.theme-style-option').forEach(option => {
        option.classList.toggle('active', option.dataset.themeStyle === themeState.style);
    });
}

function toggleThemePanel(forceOpen) {
    const panel = document.getElementById('themeStylePanel');
    if (!panel) return;
    const nextState = typeof forceOpen === 'boolean' ? forceOpen : !panel.classList.contains('open');
    panel.classList.toggle('open', nextState);
}

function refreshThemeCharts() {
    if (window.renderGroupDistributionChart) window.renderGroupDistributionChart();
    if (window.renderCompletionTrendChart) window.renderCompletionTrendChart();
    if (window.renderHabitStreakChart) window.renderHabitStreakChart();
}

function applyTheme(options = {}) {
    const { persist = false, syncWidget = false, rerenderCharts = false } = options;
    document.body.dataset.theme = themeState.style;
    document.body.dataset.colorMode = themeState.mode;
    document.body.classList.toggle('dark-mode', themeState.mode === 'dark');
    updateThemeUI();
    updateMetaThemeColor();
    if (persist) persistThemePrefs();
    if (syncWidget && window.exportWidgetData) window.exportWidgetData();
    if (rerenderCharts) refreshThemeCharts();
}

function setThemeStyle(style, showToast = true) {
    if (!THEME_STYLE_META[style] || themeState.style === style) return;
    themeState.style = style;
    applyTheme({ persist: true, syncWidget: true, rerenderCharts: true });
    toggleThemePanel(false);
    if (showToast && window.showSyncToast) window.showSyncToast(`已切换到${THEME_STYLE_META[style].label}`);
}

function toggleColorMode(showToast = true) {
    themeState.mode = themeState.mode === 'dark' ? 'light' : 'dark';
    applyTheme({ persist: true, syncWidget: true, rerenderCharts: true });
    if (showToast && window.showSyncToast) window.showSyncToast(themeState.mode === 'dark' ? '已切换到暗色模式' : '已切换到亮色模式');
}

function initTheme() {
    const themeStyleBtn = document.getElementById('themeStyleBtn');
    const themeStylePanel = document.getElementById('themeStylePanel');
    const themeToggleBtn = document.getElementById('themeToggle');
    if (themeStyleBtn) {
        themeStyleBtn.addEventListener('click', (event) => { event.stopPropagation(); toggleThemePanel(); });
    }
    if (themeStylePanel) {
        themeStylePanel.addEventListener('click', (event) => { event.stopPropagation(); });
    }
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => toggleColorMode());
    }
    document.addEventListener('click', (event) => {
        if (themeStylePanel && !themeStylePanel.contains(event.target) && event.target !== themeStyleBtn) {
            toggleThemePanel(false);
        }
    });
    document.querySelectorAll('.theme-style-option').forEach(option => {
        option.addEventListener('click', () => setThemeStyle(option.dataset.themeStyle));
    });
    applyTheme();
}
window.getThemePrefs = getThemePrefs;

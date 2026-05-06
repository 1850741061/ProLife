const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let widgetWindow = null;
let widgetTray = null;
let mainTray = null;
let isQuitting = false;

const SETTINGS_FILE = path.join(process.env.APPDATA || '', 'ProLife', 'settings.json');
const APP_DIR = __dirname;

function readSettings() {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
        }
    } catch(e) {}
    return { minimizeToTray: undefined };
}

function writeSettings(settings) {
    try {
        const dir = path.dirname(SETTINGS_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings));
    } catch(e) {}
}

const WIDGET_WIDTH = 400;
const WIDGET_HEIGHT = 700;
const WIDGET_REVEAL_MARGIN = 24;

function getDefaultWidgetPosition(width = WIDGET_WIDTH, height = WIDGET_HEIGHT) {
    const area = screen.getPrimaryDisplay().workArea;
    return {
        x: Math.round(area.x + area.width - width - WIDGET_REVEAL_MARGIN),
        y: Math.round(area.y + WIDGET_REVEAL_MARGIN)
    };
}

function isWidgetPositionVisible(x, y, width, height) {
    return screen.getAllDisplays().some(display => {
        const area = display.workArea;
        const visibleWidth = Math.min(x + width, area.x + area.width) - Math.max(x, area.x);
        const visibleHeight = Math.min(y + height, area.y + area.height) - Math.max(y, area.y);
        return visibleWidth >= Math.min(160, width * 0.45) && visibleHeight >= Math.min(160, height * 0.35);
    });
}

function getSafeWidgetPosition(x, y, width = WIDGET_WIDTH, height = WIDGET_HEIGHT) {
    const fallback = getDefaultWidgetPosition(width, height);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return fallback;
    if (isWidgetPositionVisible(x, y, width, height)) return { x, y };
    const nearestDisplay = screen.getDisplayNearestPoint({ x, y }) || screen.getPrimaryDisplay();
    const area = nearestDisplay.workArea;
    return {
        x: Math.max(area.x, Math.min(x, area.x + area.width - width)),
        y: Math.max(area.y, Math.min(y, area.y + area.height - height))
    };
}

function revealWidgetWindow({ focus = true } = {}) {
    if (!widgetWindow || widgetWindow.isDestroyed()) return;
    if (widgetWindow.isMinimized()) widgetWindow.restore();
    const [width, height] = widgetWindow.getSize();
    const [currentX, currentY] = widgetWindow.getPosition();
    const safePos = getSafeWidgetPosition(currentX, currentY, width, height);
    widgetWindow.setBounds({ x: safePos.x, y: safePos.y, width, height }, false);
    widgetWindow.setOpacity(1);
    widgetWindow.show();
    if (typeof widgetWindow.moveTop === 'function') widgetWindow.moveTop();
    if (focus) widgetWindow.focus();
    widgetWindow.webContents.send('widget-focus');
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 800,
        minHeight: 600,
        frame: false,
        titleBarStyle: 'hidden',
        icon: path.join(APP_DIR, 'assets', 'icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            devTools: true
        },
        backgroundColor: '#fdfdfd'
    });

    mainWindow.loadFile('index.html');

    mainWindow.on('closed', () => {
        mainWindow = null;
        if (isQuitting) {
            if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.close();
        }
    });
}

// IPC handlers
ipcMain.on('window-minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('window-maximize', () => {
    if (mainWindow) {
        mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
    }
});
ipcMain.on('window-close', () => {
    const settings = readSettings();
    if (settings.minimizeToTray === undefined) {
        if (mainWindow) mainWindow.webContents.send('ask-close-behavior');
    } else if (settings.minimizeToTray) {
        if (mainWindow) mainWindow.hide();
        if (!mainTray) createMainTray();
    } else {
        isQuitting = true;
        if (mainWindow) mainWindow.close();
    }
});
ipcMain.on('window-close-direct', () => {
    const settings = readSettings();
    if (settings.minimizeToTray) {
        if (mainWindow) mainWindow.hide();
        if (!mainTray) createMainTray();
    } else {
        isQuitting = true;
        if (mainWindow) mainWindow.close();
    }
});
ipcMain.on('app-quit', () => {
    isQuitting = true;
    if (mainWindow) mainWindow.close();
    if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.close();
    app.quit();
});
ipcMain.on('get-close-behavior', (e) => {
    e.reply('close-behavior', readSettings().minimizeToTray);
});
ipcMain.on('set-close-behavior', (e, val) => {
    const settings = readSettings();
    settings.minimizeToTray = val;
    writeSettings(settings);
});

ipcMain.on('launch-widget', (event) => {
    const alreadyOpen = widgetWindow && !widgetWindow.isDestroyed();
    launchWidget();
    event.reply('widget-launch-result', { alreadyOpen });
});
ipcMain.on('widget-toggle-top', (e, val) => {
    if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.setAlwaysOnTop(val);
});
ipcMain.on('widget-open-main', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
});
ipcMain.on('main-data-changed', () => {
    if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.webContents.send('refresh-widget-data');
});
ipcMain.on('widget-data-changed', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('refresh-main-data');
});
ipcMain.on('widget-open-task-detail', (e, taskId) => {
    if (mainWindow) {
        mainWindow.show(); mainWindow.focus();
        mainWindow.webContents.send('open-task-detail', taskId);
    }
});
ipcMain.on('widget-open-project-task-detail', (e, { projectId, taskId }) => {
    if (mainWindow) {
        mainWindow.show(); mainWindow.focus();
        mainWindow.webContents.send('open-project-task-detail', { projectId, taskId });
    }
});

function launchWidget() {
    if (widgetWindow && !widgetWindow.isDestroyed()) {
        revealWidgetWindow();
        return;
    }
    try {
        let posX, posY;
        try {
            const posFile = path.join(process.env.APPDATA || '', 'ProLife', 'widget-pos.json');
            if (fs.existsSync(posFile)) {
                const pos = JSON.parse(fs.readFileSync(posFile, 'utf-8'));
                posX = pos.x; posY = pos.y;
            }
        } catch(e) {}
        const initialPos = getSafeWidgetPosition(posX, posY, WIDGET_WIDTH, WIDGET_HEIGHT);

        widgetWindow = new BrowserWindow({
            width: WIDGET_WIDTH, height: WIDGET_HEIGHT,
            x: initialPos.x, y: initialPos.y,
            frame: false, transparent: true, alwaysOnTop: true,
            resizable: true, minimizable: false, maximizable: false, skipTaskbar: true,
            icon: path.join(APP_DIR, 'assets', 'icon.ico'),
            webPreferences: { nodeIntegration: true, contextIsolation: false }
        });

        widgetWindow.loadFile(path.join(APP_DIR, 'widget', 'widget.html'));

        let posSaveTimer = null;
        widgetWindow.on('moved', () => {
            if (widgetWindow.isDestroyed()) return;
            clearTimeout(posSaveTimer);
            posSaveTimer = setTimeout(() => {
                if (widgetWindow && !widgetWindow.isDestroyed()) {
                    const pos = widgetWindow.getPosition();
                    try {
                        const dir = path.join(process.env.APPDATA || '', 'ProLife');
                        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                        fs.writeFileSync(path.join(dir, 'widget-pos.json'), JSON.stringify({ x: pos[0], y: pos[1] }));
                    } catch(e) {}
                }
            }, 300);
        });
        widgetWindow.on('closed', () => {
            widgetWindow = null;
            if (widgetTray) { widgetTray.destroy(); widgetTray = null; }
        });
        widgetWindow.on('blur', () => {
            if (widgetWindow && !widgetWindow.isDestroyed() && widgetWindow.isAlwaysOnTop()) {
                widgetWindow.setOpacity(0.94);
                widgetWindow.webContents.send('widget-blur');
            }
        });
        widgetWindow.on('focus', () => {
            if (widgetWindow && !widgetWindow.isDestroyed()) {
                widgetWindow.setOpacity(1);
                widgetWindow.webContents.send('widget-focus');
            }
        });
        createWidgetTray();
        revealWidgetWindow();
    } catch (e) {
        console.error('[Widget] 启动异常:', e);
    }
}

function createWidgetTray() {
    if (widgetTray) return;
    const iconPath = path.join(APP_DIR, 'assets', 'icon.ico');
    let trayIcon;
    try { trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 }); }
    catch(e) { trayIcon = nativeImage.createEmpty(); }
    widgetTray = new Tray(trayIcon);
    widgetTray.setToolTip('Todo Widget');
    const contextMenu = Menu.buildFromTemplate([
        { label: '显示/隐藏', click: () => {
            if (widgetWindow && !widgetWindow.isDestroyed()) {
                widgetWindow.isVisible() ? widgetWindow.hide() : revealWidgetWindow({ focus: false });
            }
        }},
        { label: '刷新', click: () => { if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.reload(); }},
        { type: 'separator' },
        { label: '关闭小组件', click: () => { if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.close(); }}
    ]);
    widgetTray.setContextMenu(contextMenu);
    widgetTray.on('click', () => {
        if (widgetWindow && !widgetWindow.isDestroyed()) {
            widgetWindow.isVisible() ? widgetWindow.hide() : revealWidgetWindow({ focus: false });
        }
    });
}

function createMenu() {
    const template = [
        { label: '文件', submenu: [
            { label: '重新加载', accelerator: 'CmdOrCtrl+R', click: () => { if (mainWindow) mainWindow.reload(); }},
            { type: 'separator' },
            { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => { app.quit(); }}
        ]},
        { label: '编辑', submenu: [
            { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
            { label: '重做', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
            { type: 'separator' },
            { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
            { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
            { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' }
        ]},
        { label: '视图', submenu: [
            { label: '放大', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
            { label: '缩小', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
            { label: '重置缩放', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
            { type: 'separator' },
            { label: '切换全屏', accelerator: 'F11', role: 'togglefullscreen' },
            { type: 'separator' },
            { label: '开发者工具', accelerator: 'F12', click: () => { if (mainWindow) mainWindow.webContents.toggleDevTools(); }}
        ]}
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createMainTray() {
    if (mainTray) return;
    const iconPath = path.join(APP_DIR, 'assets', 'icon.ico');
    let trayIcon;
    try { trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 }); }
    catch(e) { trayIcon = nativeImage.createEmpty(); }
    mainTray = new Tray(trayIcon);
    mainTray.setToolTip('Todo');
    const contextMenu = Menu.buildFromTemplate([
        { label: '显示主窗口', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } }},
        { type: 'separator' },
        { label: '退出', click: () => {
            isQuitting = true;
            if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.close();
            if (mainWindow) mainWindow.close();
            app.quit();
        }}
    ]);
    mainTray.setContextMenu(contextMenu);
    mainTray.on('click', () => {
        if (mainWindow) {
            mainWindow.isVisible() ? mainWindow.focus() : (mainWindow.show(), mainWindow.focus());
        }
    });
}

app.whenReady().then(() => {
    createWindow();
    createMenu();
});

app.on('window-all-closed', () => {
    if (isQuitting && process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) createWindow();
});

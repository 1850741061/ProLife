// Electron 环境检测与窗口控制

const isElectron = (function () {
    try {
        return typeof window !== 'undefined' && window.desktopAPI?.isElectron === true;
    } catch (e) {
        return false;
    }
})();

if (isElectron) {
    document.body.classList.add('electron-env');
    const ipcRenderer = window.desktopAPI.ipc;
    document.getElementById('btnMinimize').addEventListener('click', () => {
        ipcRenderer.send('window-minimize');
    });
    document.getElementById('btnMaximize').addEventListener('click', () => {
        ipcRenderer.send('window-maximize');
    });
    document.getElementById('btnClose').addEventListener('click', () => {
        ipcRenderer.send('window-close');
    });
} else {
    document.body.classList.add('browser-env');
}

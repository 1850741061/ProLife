// Electron 环境检测与窗口控制

const isElectron = (function () {
    try {
        return typeof require !== 'undefined' && typeof window !== 'undefined' && window.process && window.process.type === 'renderer';
    } catch (e) {
        return false;
    }
})();

if (isElectron) {
    document.body.classList.add('electron-env');
    const { ipcRenderer } = require('electron');
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

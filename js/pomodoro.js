// 番茄钟


function initPomodoro() {
    document.getElementById('pomodoroBtn').onclick = () => {
        openModal('pomodoroModal');
    };
}

// 开始番茄钟
window.startPomodoro = function () {
    if (pomodoroIsRunning) return;

    pomodoroIsRunning = true;
    document.getElementById('pomodoroStartBtn').style.display = 'none';
    document.getElementById('pomodoroPauseBtn').style.display = 'inline-block';

    pomodoroTimer = setInterval(() => {
        pomodoroSeconds--;

        if (pomodoroSeconds <= 0) {
            clearInterval(pomodoroTimer);
            pomodoroIsRunning = false;

            // 切换模式
            if (pomodoroIsWorkMode) {
                // 工作结束，进入休息
                pomodoroIsWorkMode = false;
                pomodoroSeconds = 5 * 60;
                document.getElementById('pomodoroMode').textContent = '休息时间';
                showNotification('工作结束', '休息 5 分钟吧！');
            } else {
                // 休息结束，进入工作
                pomodoroIsWorkMode = true;
                pomodoroSeconds = 25 * 60;
                document.getElementById('pomodoroMode').textContent = '工作时间';
                showNotification('休息结束', '开始新的番茄钟！');
            }

            document.getElementById('pomodoroStartBtn').style.display = 'inline-block';
            document.getElementById('pomodoroPauseBtn').style.display = 'none';
        }

        updatePomodoroDisplay();
    }, 1000);
};

// 暂停番茄钟
window.pausePomodoro = function () {
    if (!pomodoroIsRunning) return;

    clearInterval(pomodoroTimer);
    pomodoroIsRunning = false;
    document.getElementById('pomodoroStartBtn').style.display = 'inline-block';
    document.getElementById('pomodoroPauseBtn').style.display = 'none';
};

// 重置番茄钟
window.resetPomodoro = function () {
    clearInterval(pomodoroTimer);
    pomodoroIsRunning = false;
    pomodoroIsWorkMode = true;
    pomodoroSeconds = 25 * 60;
    document.getElementById('pomodoroMode').textContent = '工作时间';
    document.getElementById('pomodoroStartBtn').style.display = 'inline-block';
    document.getElementById('pomodoroPauseBtn').style.display = 'none';
    updatePomodoroDisplay();
};

// 更新番茄钟显示
function updatePomodoroDisplay() {
    const minutes = Math.floor(pomodoroSeconds / 60);
    const seconds = pomodoroSeconds % 60;
    const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    document.getElementById('pomodoroDisplay').textContent = display;
}

// 显示通知（复用现有通知功能）
function showNotification(title, body) {
    if (!state.notificationsEnabled) return;

    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: './icon-192.png',
            badge: './icon-192.png'
        });
    }
}

// ========== 键盘快捷键 ==========

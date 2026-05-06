// 通知提醒系统


function initNotifications() {
    const notificationBtn = document.getElementById('notificationBtn');

    // 点击按钮打开设置
    notificationBtn.onclick = () => {
        openNotificationSettings();
    };

    // 更新按钮状态
    updateNotificationButtonStatus();

    // 如果已启用通知，开始检查
    if (state.notificationsEnabled) {
        startNotificationCheck();
    }
}

// 打开通知设置
function openNotificationSettings() {
    document.getElementById('notificationToggle').checked = state.notificationsEnabled;
    document.getElementById('notificationTimeInput').value = state.notificationTime;
    openModal('notificationModal');
}

// 保存通知设置
window.saveNotificationSettings = () => {
    const enabled = document.getElementById('notificationToggle').checked;
    const time = document.getElementById('notificationTimeInput').value;

    state.notificationsEnabled = enabled;
    state.notificationTime = time;

    localStorage.setItem('notificationsEnabled', enabled);
    localStorage.setItem('notificationTime', time);

    // 请求通知权限
    if (enabled && 'Notification' in window) {
        if (Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    startNotificationCheck();
                    showSyncToast('通知权限已授予');
                } else {
                    showSyncToast('通知权限被拒绝', 'error');
                    state.notificationsEnabled = false;
                    localStorage.setItem('notificationsEnabled', false);
                }
            });
        } else if (Notification.permission === 'granted') {
            startNotificationCheck();
        } else {
            showSyncToast('请在浏览器设置中允许通知', 'error');
            state.notificationsEnabled = false;
            localStorage.setItem('notificationsEnabled', false);
        }
    } else if (!enabled) {
        stopNotificationCheck();
    }

    updateNotificationButtonStatus();
    closeModal('notificationModal');
};

// 更新通知按钮状态
function updateNotificationButtonStatus() {
    const btn = document.getElementById('notificationBtn');
    if (state.notificationsEnabled) {
        btn.style.color = 'var(--success-color)';
        btn.title = '提醒已启用';
    } else {
        btn.style.color = '';
        btn.title = '提醒设置';
    }
}

// 开始通知检查
function startNotificationCheck() {
    if (notificationCheckInterval) {
        clearInterval(notificationCheckInterval);
    }

    // 立即检查一次
    checkAndSendNotifications();

    // 每5分钟检查一次
    notificationCheckInterval = setInterval(checkAndSendNotifications, 5 * 60 * 1000);

    // 每日定时提醒
    scheduleDailyNotification();
}

// 停止通知检查
function stopNotificationCheck() {
    if (notificationCheckInterval) {
        clearInterval(notificationCheckInterval);
        notificationCheckInterval = null;
    }
}

// 检查并发送通知
function checkAndSendNotifications() {
    if (!state.notificationsEnabled || Notification.permission !== 'granted') {
        return;
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const notificationTasks = [];

    state.todos.forEach(t => {
        if (t.completed) return;

        // 今日到期的任务
        if (t.date === today) {
            notificationTasks.push({
                task: t,
                type: '今日到期',
                message: `任务今日到期：${t.text}`
            });
        }

        // 已过期的任务
        else if (t.date && t.date < today) {
            notificationTasks.push({
                task: t,
                type: '已逾期',
                message: `任务已逾期：${t.text}`
            });
        }

        // 即将开始的任务（提前15分钟）
        if (t.date === today && t.startTime) {
            const [startHour, startMin] = t.startTime.split(':').map(Number);
            const startMinutes = startHour * 60 + startMin;
            const nowMinutes = now.getHours() * 60 + now.getMinutes();
            const diff = startMinutes - nowMinutes;

            if (diff > 0 && diff <= 15) {
                notificationTasks.push({
                    task: t,
                    type: '即将开始',
                    message: `任务将在 ${diff} 分钟后开始：${t.text}`
                });
            }
        }
    });

    // 发送通知（每个任务每天只通知一次）
    const notifiedToday = JSON.parse(localStorage.getItem('notifiedToday_' + today)) || [];

    notificationTasks.forEach(({ task, type, message }, idx) => {
        const key = `${task.id}_${type}`;
        if (!notifiedToday.includes(key)) {
            setTimeout(() => sendNotification(type, message, task), idx * 500);
            notifiedToday.push(key);
        }
    });

    localStorage.setItem('notifiedToday_' + today, JSON.stringify(notifiedToday));
}

// 发送通知
function sendNotification(title, message, task) {
    if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification(title, {
            body: message,
            icon: 'https://img.shields.io/badge/Todo-v3.3.3-blue?style=for-the-badge',
            tag: 'prolife-' + task.id,
            requireInteraction: false
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
            // 切换到待办视图并选中该任务
            switchView('todo');
            state.currentGroupId = task.groupId;
            renderAll();
        };
    }
}

// 每日定时提醒
function scheduleDailyNotification() {
    const now = new Date();
    const [targetHour, targetMin] = state.notificationTime.split(':').map(Number);

    const target = new Date(now);
    target.setHours(targetHour, targetMin, 0, 0);

    // 如果今天的时间已过，设置为明天
    if (target <= now) {
        target.setDate(target.getDate() + 1);
    }

    const delay = target - now;

    setTimeout(() => {
        sendDailyReminder();
        // 递归设置下一天的提醒
        scheduleDailyNotification();
    }, delay);
}

// 发送每日提醒
function sendDailyReminder() {
    const today = new Date().toISOString().split('T')[0];
    const todayTasks = state.todos.filter(t => !t.completed && t.date === today);

    if (todayTasks.length > 0) {
        sendNotification(
            '每日提醒',
            `您今天有 ${todayTasks.length} 项待办任务`,
            todayTasks[0]
        );
    }
}

// ========== 拖拽功能 ==========

// 键盘快捷键

function initKeyboardShortcuts() {
    // 绑定帮助按钮
    const helpBtn = document.getElementById('helpBtn');
    if (helpBtn) {
        helpBtn.onclick = function () {
            showKeyboardShortcutsHelp();
        };
    }

    document.addEventListener('keydown', (e) => {
        // Ctrl+N: 快速添加任务
        if ((e.ctrlKey || e.metaKey) && e.key === 'n' && state.view === 'todo') {
            e.preventDefault();
            document.getElementById('todoInput').focus();
        }

        // Ctrl+/: 显示快捷键帮助
        if ((e.ctrlKey || e.metaKey) && e.key === '/') {
            e.preventDefault();
            showKeyboardShortcutsHelp();
        }

        // Ctrl+D: 切换明暗模式
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
            e.preventDefault();
            toggleColorMode();
        }

        // ESC: 关闭模态框
        if (e.key === 'Escape') {
            toggleThemePanel(false);
            const openModals = document.querySelectorAll('.modal-overlay');
            openModals.forEach(modal => {
                if (modal.style.display !== 'none' && !modal.classList.contains('hidden')) {
                    const modalId = modal.id;
                    closeModal(modalId);
                }
            });
        }

        // Ctrl+S: 云端同步
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (currentUser) {
                syncToCloud();
                showSyncToast('手动同步中...');
            }
        }

        // Ctrl+B: 切换批量模式
        if ((e.ctrlKey || e.metaKey) && e.key === 'b' && state.view === 'todo') {
            e.preventDefault();
            document.getElementById('batchModeBtn').click();
        }

        // Ctrl+Shift+N: 打开随想录
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
            e.preventDefault();
            toggleIdeasPanel();
        }
    });

    // 在添加任务输入框中按 Enter 快速保存
    document.getElementById('todoInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            addTodo();
        }
    });
}

// 显示快捷键帮助
window.showKeyboardShortcutsHelp = function () {
    const helpContent = `
📌 Todo 功能帮助

⌨️ 快捷键：
  Ctrl+N        快速添加任务
  Ctrl+F        打开全局搜索
  Ctrl+S        云端同步
  Ctrl+B        切换批量操作
  Ctrl+D        切换明暗模式
  Ctrl+/        显示此帮助
  ESC          关闭弹窗
  Enter        快速保存任务

🎯 功能说明：

【任务管理】
• 点击任务左侧圆圈完成/取消完成
• 拖拽任务可重新排序
• 点击编辑图标修改任务
• 可添加子任务、设置优先级、日期
• 支持任务分组和项目关联

【归档功能】
• 批量选中任务后点击"归档"按钮
• 或在归档界面管理已完成任务
• 可恢复或永久删除归档任务

【重复任务】
• 编辑任务时可设置重复周期
• 支持：每天/每周/每月/每年
• 完成后自动创建下一次
• 可设置重复结束日期

【习惯打卡】
• 点击习惯打卡按钮添加习惯
• 每天点击"今日打卡"记录
• 查看连续打卡天数统计
• 最近7天记录可视化

【项目管理】
• 点击项目管理按钮创建项目
• 编辑任务时可关联到项目
• 查看项目进度和任务统计
• 支持项目截止日期提醒

【全局搜索】
• 搜索任务、记账、模板
• 点击结果直接跳转
• 支持关键词高亮

💡 提示：
  Mac 用户请使用 Cmd 代替 Ctrl
  快捷键在任务输入框外生效
  风格切换在右上角调色板按钮中设置
    `.trim();

    // 使用自定义确认框样式显示帮助
    const helpDialog = document.createElement('div');
    helpDialog.className = 'modal-overlay active';
    helpDialog.id = 'helpDialog';
    helpDialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2000;
        opacity: 1;
        visibility: visible;
    `;

    helpDialog.innerHTML = `
        <div class="modal" style="
            background: var(--card-bg);
            padding: 30px;
            border: 3px solid var(--border-color);
            border-radius: var(--radius);
            box-shadow: 10px 10px 0 0 var(--border-color);
            width: 90%;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            transform: scale(1);
        ">
            <h2 style="margin: 0 0 20px 0; font-size: 1.5rem; display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-question-circle" style="color: var(--accent-color);"></i>
                Todo 使用帮助
            </h2>
            <div style="
                white-space: pre-wrap;
                font-family: inherit;
                font-size: 0.9rem;
                line-height: 1.8;
                color: var(--text-secondary);
                background: var(--bg-color);
                padding: 20px;
                border-radius: var(--radius);
                border: 2px solid var(--border-color);
            ">${helpContent}</div>
            <button class="btn btn-primary" id="helpCloseBtn" style="width: 100%; margin-top: 20px; justify-content: center;">
                <i class="fas fa-check"></i> 知道了
            </button>
        </div>
    `;

    document.body.appendChild(helpDialog);

    // 关闭按钮事件
    document.getElementById('helpCloseBtn').onclick = () => {
        helpDialog.classList.remove('active');
        setTimeout(() => {
            helpDialog.remove();
        }, 300);
    };

    // 点击遮罩关闭
    helpDialog.addEventListener('click', (e) => {
        if (e.target === helpDialog) {
            helpDialog.classList.remove('active');
            setTimeout(() => {
                helpDialog.remove();
            }, 300);
        }
    });
}

// ========== 子任务展开/折叠 ==========
window.toggleSubtasksExpand = function (todoId) {
    // 切换展开状态
    state.expandedSubtasks[todoId] = !state.expandedSubtasks[todoId];

    // 更新图标和列表显示
    const icon = document.getElementById(`expand-icon-${todoId}`);
    const list = document.getElementById(`subtask-list-${todoId}`);
    const input = document.getElementById(`subtask-input-${todoId}`);

    if (state.expandedSubtasks[todoId]) {
        // 展开
        icon.classList.remove('fa-chevron-right');
        icon.classList.add('fa-chevron-down');
        list.style.display = 'flex';
        if (input) input.style.display = 'flex';
    } else {
        // 折叠
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-right');
        list.style.display = 'none';
        if (input) input.style.display = 'none';
    }
};

// ========== 项目思维导图（Blender节点风格） ==========
let currentMindmapProjectId = null;
let mmActiveNodeId = null;

// 打开项目思维导图

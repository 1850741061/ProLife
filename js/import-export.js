// 数据导入导出


function showImportExportMenu() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        animation: fadeIn 0.15s ease;
    `;

    // 添加淡入动画
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
    `;
    if (!document.querySelector('style[data-dialog-animation]')) {
        style.setAttribute('data-dialog-animation', '');
        document.head.appendChild(style);
    }

    const menu = document.createElement('div');
    menu.style.cssText = `
        background: var(--card-bg);
        border: 3px solid var(--border-color);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        padding: 30px;
        max-width: 450px;
        width: 90%;
        font-family: var(--font-family);
    `;

    menu.innerHTML = `
        <h2 style="margin: 0 0 20px 0; font-weight: 800; font-size: 24px; color: var(--text-main);">
            📦 导入/导出
        </h2>
        <div style="margin-bottom: 20px;">
            <p style="margin: 0 0 15px 0; font-weight: 600; color: var(--text-secondary); font-size: 14px;">
                导出数据
            </p>
            <button class="io-menu-btn" data-action="exportJSON" style="
                width: 100%;
                padding: 12px 15px;
                margin-bottom: 8px;
                border: 2px solid var(--border-color);
                background: var(--card-bg);
                cursor: pointer;
                text-align: left;
                border-radius: var(--radius);
                transition: var(--transition);
                font-family: var(--font-family);
                font-size: 14px;
                font-weight: 600;
                color: var(--text-main);
                display: flex;
                align-items: center;
                gap: 10px;
            ">
                <i class="fas fa-download" style="color: var(--accent-color);"></i>
                导出为 JSON
            </button>
            <button class="io-menu-btn" data-action="exportCSV" style="
                width: 100%;
                padding: 12px 15px;
                margin-bottom: 8px;
                border: 2px solid var(--border-color);
                background: var(--card-bg);
                cursor: pointer;
                text-align: left;
                border-radius: var(--radius);
                transition: var(--transition);
                font-family: var(--font-family);
                font-size: 14px;
                font-weight: 600;
                color: var(--text-main);
                display: flex;
                align-items: center;
                gap: 10px;
            ">
                <i class="fas fa-file-csv" style="color: var(--success-color);"></i>
                导出为 CSV
            </button>
            <button class="io-menu-btn" data-action="exportMarkdown" style="
                width: 100%;
                padding: 12px 15px;
                margin-bottom: 15px;
                border: 2px solid var(--border-color);
                background: var(--card-bg);
                cursor: pointer;
                text-align: left;
                border-radius: var(--radius);
                transition: var(--transition);
                font-family: var(--font-family);
                font-size: 14px;
                font-weight: 600;
                color: var(--text-main);
                display: flex;
                align-items: center;
                gap: 10px;
            ">
                <i class="fab fa-markdown" style="color: var(--warning-color);"></i>
                导出为 Markdown
            </button>

            <p style="margin: 15px 0 15px 0; font-weight: 600; color: var(--text-secondary); font-size: 14px;">
                导入数据
            </p>
            <button class="io-menu-btn" data-action="importJSON" style="
                width: 100%;
                padding: 12px 15px;
                margin-bottom: 8px;
                border: 2px solid var(--border-color);
                background: var(--card-bg);
                cursor: pointer;
                text-align: left;
                border-radius: var(--radius);
                transition: var(--transition);
                font-family: var(--font-family);
                font-size: 14px;
                font-weight: 600;
                color: var(--text-main);
                display: flex;
                align-items: center;
                gap: 10px;
            ">
                <i class="fas fa-upload" style="color: var(--accent-color);"></i>
                导入 JSON
            </button>
            <button class="io-menu-btn" data-action="importCSV" style="
                width: 100%;
                padding: 12px 15px;
                margin-bottom: 15px;
                border: 2px solid var(--border-color);
                background: var(--card-bg);
                cursor: pointer;
                text-align: left;
                border-radius: var(--radius);
                transition: var(--transition);
                font-family: var(--font-family);
                font-size: 14px;
                font-weight: 600;
                color: var(--text-main);
                display: flex;
                align-items: center;
                gap: 10px;
            ">
                <i class="fas fa-table" style="color: var(--success-color);"></i>
                导入 CSV/Excel
            </button>

            <button class="io-menu-btn" data-action="cancel" style="
                width: 100%;
                padding: 12px 15px;
                border: 2px solid var(--border-color);
                background: var(--card-bg);
                cursor: pointer;
                text-align: left;
                border-radius: var(--radius);
                transition: var(--transition);
                font-family: var(--font-family);
                font-size: 14px;
                font-weight: 600;
                color: var(--danger-color);
                display: flex;
                align-items: center;
                gap: 10px;
            ">
                <i class="fas fa-times"></i>
                取消
            </button>
        </div>
    `;

    overlay.appendChild(menu);
    document.body.appendChild(overlay);

    // 按钮交互
    const buttons = menu.querySelectorAll('.io-menu-btn');
    buttons.forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'translateX(5px)';
            btn.style.boxShadow = '4px 4px 0 0 var(--border-color)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translateX(0)';
            btn.style.boxShadow = 'none';
        });
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            overlay.remove();

            switch (action) {
                case 'exportJSON':
                    showExportJSONDialog();
                    break;
                case 'exportCSV':
                    showExportCSVDialog();
                    break;
                case 'exportMarkdown':
                    showExportMarkdownDialog();
                    break;
                case 'importJSON':
                    showImportJSONDialog();
                    break;
                case 'importCSV':
                    importFromSpreadsheet();
                    break;
                case 'cancel':
                    break;
            }
        });
    });

    // 点击遮罩关闭
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });
}

// 显示导出 JSON 对话框
function showExportJSONDialog() {
    const overlay = createDialogOverlay();
    const dialog = createDialog('导出 JSON', `
        <div style="margin-bottom: 20px;">
            <p style="margin: 0 0 15px 0; font-size: 14px; color: var(--text-secondary); line-height: 1.6;">
                导出所有数据为 JSON 格式，包括：<br>
                • 所有任务 (${state.todos.length} 个)<br>
                • 所有账目 (${state.transactions.length} 个)<br>
                • 所有分组 (${state.groups.length} 个)
            </p>
        </div>
        <button class="dialog-btn-primary" data-action="confirm" style="
            width: 100%;
            padding: 15px;
            margin-bottom: 10px;
            border: 3px solid var(--border-color);
            background: var(--accent-color);
            color: white;
            cursor: pointer;
            border-radius: var(--radius);
            font-family: var(--font-family);
            font-size: 16px;
            font-weight: 700;
            transition: var(--transition);
        ">
            <i class="fas fa-download"></i> 确认导出
        </button>
        <button class="dialog-btn-secondary" data-action="cancel" style="
            width: 100%;
            padding: 15px;
            border: 2px solid var(--border-color);
            background: var(--card-bg);
            color: var(--text-main);
            cursor: pointer;
            border-radius: var(--radius);
            font-family: var(--font-family);
            font-size: 14px;
            font-weight: 600;
            transition: var(--transition);
        ">
            取消
        </button>
    `);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    setupDialogButtons(overlay, (action) => {
        if (action === 'confirm') {
            exportData();
        }
    });
}

// 显示导出 CSV 对话框
function showExportCSVDialog() {
    const overlay = createDialogOverlay();
    const dialog = createDialog('导出 CSV', `
        <div style="margin-bottom: 20px;">
            <p style="margin: 0 0 15px 0; font-size: 14px; color: var(--text-secondary); line-height: 1.6;">
                导出任务列表为 CSV 表格格式，包含：<br>
                • 任务标题、描述<br>
                • 优先级、状态<br>
                • 日期、分组<br>
                <br>
                共 ${state.todos.length} 个任务将被导出
            </p>
        </div>
        <button class="dialog-btn-primary" data-action="confirm">
            <i class="fas fa-file-csv"></i> 确认导出
        </button>
        <button class="dialog-btn-secondary" data-action="cancel">
            取消
        </button>
    `);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    setupDialogButtons(overlay, (action) => {
        if (action === 'confirm') {
            exportToCSV();
        }
    });
}

// 显示导出 Markdown 对话框
function showExportMarkdownDialog() {
    const overlay = createDialogOverlay();
    const dialog = createDialog('导出 Markdown', `
        <div style="margin-bottom: 20px;">
            <p style="margin: 0 0 15px 0; font-size: 14px; color: var(--text-secondary); line-height: 1.6;">
                导出为 Markdown 文档格式，适合：<br>
                • 在笔记应用中查看<br>
                • 分享给团队成员<br>
                • 打印或保存为PDF<br>
                <br>
                将导出 ${state.todos.length} 个任务
            </p>
        </div>
        <button class="dialog-btn-primary" data-action="confirm">
            <i class="fab fa-markdown"></i> 确认导出
        </button>
        <button class="dialog-btn-secondary" data-action="cancel">
            取消
        </button>
    `);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    setupDialogButtons(overlay, (action) => {
        if (action === 'confirm') {
            exportToMarkdown();
        }
    });
}

// 显示导入 JSON 对话框
function showImportJSONDialog() {
    const overlay = createDialogOverlay();
    const dialog = createDialog('导入 JSON', `
        <div style="margin-bottom: 20px;">
            <div style="background: var(--warning-color); color: white; padding: 15px; border-radius: var(--radius); margin-bottom: 15px; font-weight: 600;">
                ⚠️ 警告：导入将完全覆盖现有数据！
            </div>
            <p style="margin: 0 0 15px 0; font-size: 14px; color: var(--text-secondary); line-height: 1.6;">
                您当前有：<br>
                • ${state.todos.length} 个任务<br>
                • ${state.transactions.length} 个账目<br>
                • ${state.groups.length} 个分组<br>
                <br>
                导入后，这些数据将被替换为导入文件中的数据。
            </p>
        </div>
        <button class="dialog-btn-primary" data-action="confirm" style="background: var(--warning-color);">
            <i class="fas fa-upload"></i> 选择文件并导入
        </button>
        <button class="dialog-btn-secondary" data-action="cancel">
            取消
        </button>
    `);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    setupDialogButtons(overlay, (action) => {
        if (action === 'confirm') {
            importData();
        }
    });
}

// 创建对话框遮罩层
function createDialogOverlay() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        animation: fadeIn 0.15s ease;
    `;
    return overlay;
}

// 创建对话框
function createDialog(title, content) {
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        background: var(--card-bg);
        border: 3px solid var(--border-color);
        box-shadow: var(--shadow);
        padding: 30px;
        max-width: 500px;
        width: 90%;
        border-radius: var(--radius);
        font-family: var(--font-family);
    `;
    dialog.innerHTML = `
        <h2 style="margin: 0 0 20px 0; font-weight: 800; font-size: 24px; color: var(--text-main);">
            ${title}
        </h2>
        ${content}
    `;
    return dialog;
}

// 设置对话框按钮事件
function setupDialogButtons(overlay, callback) {
    const buttons = overlay.querySelectorAll('[data-action]');
    buttons.forEach(btn => {
        // 添加样式
        if (!btn.style.width) {
            btn.style.cssText = `
                width: 100%;
                padding: 15px;
                ${btn.classList.contains('dialog-btn-primary') ? 'margin-bottom: 10px;' : ''}
                border: ${btn.classList.contains('dialog-btn-primary') ? '3px' : '2px'} solid var(--border-color);
                background: ${btn.classList.contains('dialog-btn-primary') ? 'var(--accent-color)' : 'var(--card-bg)'};
                color: ${btn.classList.contains('dialog-btn-primary') ? 'white' : 'var(--text-main)'};
                cursor: pointer;
                border-radius: var(--radius);
                font-family: var(--font-family);
                font-size: ${btn.classList.contains('dialog-btn-primary') ? '16px' : '14px'};
                font-weight: ${btn.classList.contains('dialog-btn-primary') ? '700' : '600'};
                transition: var(--transition);
            `;
        }

        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'translateY(-2px)';
            btn.style.boxShadow = '4px 4px 0 0 var(--border-color)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translateY(0)';
            btn.style.boxShadow = 'none';
        });
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            overlay.remove();
            callback(action);
        });
    });

    // 点击遮罩关闭
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
            callback('cancel');
        }
    });
}

// 导出数据
function exportData() {
    const data = {
        todos: state.todos,
        transactions: state.transactions,
        groups: state.groups,
        archivedTodos: state.archivedTodos,
        exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prolife-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// 导入数据
function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);

                // 验证数据格式
                if (data.todos && data.transactions && data.groups) {
                    const confirmed = await showConfirm('导入数据', '导入将覆盖现有数据，是否继续？');
                    if (confirmed === 1) {
                        state.todos = data.todos;
                        state.transactions = data.transactions;
                        state.groups = data.groups;
                        state.archivedTodos = data.archivedTodos || [];
                        save();
                        renderAll();
                        showSyncToast('数据导入成功！');
                    }
                } else {
                    showSyncToast('文件格式不正确', 'error');
                }
            } catch (err) {
                showSyncToast('文件解析失败：' + err.message, 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// 导出为 CSV
window.exportToCSV = function () {
    // CSV 表头
    let csv = '任务内容,优先级,日期,开始时间,结束时间,分组,备注,完成状态\n';

    // 添加所有待办事项
    state.todos.forEach(todo => {
        const row = [
            `"${(todo.text || '').replace(/"/g, '""')}"`,
            todo.priority || 'medium',
            todo.date || '',
            todo.startTime || '',
            todo.endTime || '',
            `"${(todo.groupName || '').replace(/"/g, '""')}"`,
            `"${(todo.notes || '').replace(/"/g, '""')}"`,
            todo.completed ? '已完成' : '未完成'
        ].join(',');
        csv += row + '\n';
    });

    // 创建并下载文件
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prolife-todos-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showSyncToast('CSV 导出成功！');
};

// 导出为 Markdown
window.exportToMarkdown = function () {
    const today = new Date().toISOString().split('T')[0];
    let markdown = `# Todo 待办事项导出\n\n`;
    markdown += `> 导出时间: ${today}\n\n`;

    // 统计信息
    const total = state.todos.length;
    const completed = state.todos.filter(t => t.completed).length;
    const active = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    markdown += `## 📊 统计概览\n\n`;
    markdown += `- **总任务**: ${total}\n`;
    markdown += `- **已完成**: ${completed}\n`;
    markdown += `- **进行中**: ${active}\n`;
    markdown += `- **完成率**: ${completionRate}%\n\n`;

    // 按分组整理
    markdown += `## 📁 任务列表\n\n`;

    // 按分组分组
    const groupedTasks = {};
    state.groups.forEach(g => {
        groupedTasks[g.id] = { name: g.name, tasks: [] };
    });

    state.todos.forEach(t => {
        if (groupedTasks[t.groupId]) {
            groupedTasks[t.groupId].tasks.push(t);
        } else {
            if (!groupedTasks['other']) {
                groupedTasks['other'] = { name: '其他', tasks: [] };
            }
            groupedTasks['other'].tasks.push(t);
        }
    });

    // 渲染每个分组
    Object.values(groupedTasks).forEach(group => {
        if (group.tasks.length === 0) return;

        markdown += `### ${group.name}\n\n`;

        group.tasks.forEach(t => {
            const checkbox = t.completed ? '[x]' : '[ ]';
            const priority = { high: '🔴', medium: '🟡', low: '🟢' }[t.priority] || '⚪';
            const timeRange = (t.startTime || t.endTime) ? ` ⏰ ${t.startTime || '--'} - ${t.endTime || '--'}` : '';

            markdown += `- ${checkbox} ${priority} **${t.text}**`;

            if (t.date) {
                markdown += ` 📅 ${t.date}`;
            }

            if (timeRange) {
                markdown += timeRange;
            }

            markdown += `\n`;

            // 添加备注
            if (t.notes) {
                markdown += `  > ${t.notes}\n`;
            }

            // 添加子任务
            if (t.subtasks && t.subtasks.length > 0) {
                markdown += `  **子任务**:\n`;
                t.subtasks.forEach(st => {
                    const stCheckbox = st.completed ? '[x]' : '[ ]';
                    markdown += `    - ${stCheckbox} ${st.text}\n`;
                });
            }

            markdown += `\n`;
        });
    });

    // 已完成任务单独列出（如果需要）
    const completedTasks = state.todos.filter(t => t.completed);
    if (completedTasks.length > 0) {
        markdown += `## ✅ 已完成任务 (${completedTasks.length})\n\n`;
        completedTasks.forEach(t => {
            markdown += `- [x] ${t.text} _(${t.date || '无日期'})_\n`;
        });
    }

    // 创建并下载文件
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prolife-todos-${today}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showSyncToast('Markdown 导出成功！');
};

// 显示导入选项对话框
function showImportDialog(newTodos, resolve, reject) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        animation: fadeIn 0.15s ease;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
        background: var(--card-bg);
        border: 3px solid var(--border-color);
        box-shadow: var(--shadow);
        padding: 30px;
        max-width: 500px;
        width: 90%;
        border-radius: var(--radius);
        font-family: var(--font-family);
    `;

    dialog.innerHTML = `
        <h2 style="margin: 0 0 20px 0; font-weight: 800; font-size: 24px; color: var(--text-main);">
            📥 导入任务
        </h2>
        <div style="background: var(--bg-color); border: 2px solid var(--border-color); padding: 15px; margin-bottom: 20px; border-radius: var(--radius);">
            <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600;">
                检测到 <span style="color: var(--accent-color); font-weight: 800;">${newTodos.length}</span> 个待导入的任务
            </p>
            <p style="margin: 0; font-size: 14px; color: var(--text-secondary);">
                您当前有 <strong>${state.todos.length}</strong> 个任务
            </p>
        </div>
        <div style="margin-bottom: 20px;">
            <p style="margin: 0 0 15px 0; font-weight: 600; color: var(--text-main);">请选择导入方式：</p>

            <button class="import-option-btn" data-mode="append" style="
                width: 100%;
                padding: 15px;
                margin-bottom: 10px;
                border: 3px solid var(--border-color);
                background: var(--card-bg);
                cursor: pointer;
                text-align: left;
                border-radius: var(--radius);
                transition: var(--transition);
                font-family: var(--font-family);
            ">
                <div style="font-weight: 700; font-size: 16px; margin-bottom: 5px; color: var(--success-color);">
                    ✅ 追加模式
                </div>
                <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
                    → 保留现有任务，新增导入的任务<br>
                    → 导入后共 <strong>${state.todos.length + newTodos.length}</strong> 个任务
                </div>
            </button>

            <button class="import-option-btn" data-mode="replace" style="
                width: 100%;
                padding: 15px;
                margin-bottom: 10px;
                border: 3px solid var(--border-color);
                background: var(--card-bg);
                cursor: pointer;
                text-align: left;
                border-radius: var(--radius);
                transition: var(--transition);
                font-family: var(--font-family);
            ">
                <div style="font-weight: 700; font-size: 16px; margin-bottom: 5px; color: var(--warning-color);">
                    ⚠️ 覆盖模式
                </div>
                <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
                    → 删除所有现有任务<br>
                    → 仅保留导入的 <strong>${newTodos.length}</strong> 个任务
                </div>
            </button>

            <button class="import-option-btn" data-mode="cancel" style="
                width: 100%;
                padding: 15px;
                border: 3px solid var(--border-color);
                background: var(--card-bg);
                cursor: pointer;
                text-align: left;
                border-radius: var(--radius);
                transition: var(--transition);
                font-family: var(--font-family);
            ">
                <div style="font-weight: 700; font-size: 16px; color: var(--danger-color);">
                    ❌ 取消导入
                </div>
            </button>
        </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // 添加按钮悬停效果
    const buttons = dialog.querySelectorAll('.import-option-btn');
    buttons.forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'translateX(5px)';
            btn.style.boxShadow = '8px 8px 0 0 var(--border-color)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translateX(0)';
            btn.style.boxShadow = 'none';
        });
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            overlay.remove();

            if (mode === 'cancel') {
                reject(new Error('用户取消导入'));
                return;
            }

            if (mode === 'append') {
                // 追加模式
                state.todos = [...newTodos, ...state.todos];
            } else if (mode === 'replace') {
                // 覆盖模式
                state.todos = newTodos;
            }

            save();
            renderAll();
            showSyncToast(`成功导入 ${newTodos.length} 个任务！`);
            resolve();
        });
    });

    // 点击遮罩层关闭
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
            reject(new Error('用户取消导入'));
        }
    });
}

// 从表格导入
window.importFromSpreadsheet = function () {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.xlsx,.xls';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const fileName = file.name.toLowerCase();

        try {
            if (fileName.endsWith('.csv')) {
                await importCSV(file);
            } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                showSyncToast('Excel 格式需要先转换为 CSV 格式', 'error');
                showSyncToast('请在 Excel 中另存为 CSV 格式后重新导入', 'error');
            } else {
                showSyncToast('不支持的文件格式', 'error');
            }
        } catch (err) {
            console.error('导入失败:', err);
            showSyncToast('导入失败: ' + err.message, 'error');
        }
    };
    input.click();
};

// 解析 CSV 文件
async function importCSV(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target.result;
                const rows = parseCSV(text);

                if (rows.length < 2) {
                    throw new Error('CSV 文件为空或格式不正确');
                }

                // 解析表头
                const headers = rows[0].map(h => h.trim());
                const dataRows = rows.slice(1);

                // 查找列索引
                const findIndex = (names) => {
                    for (let name of names) {
                        const idx = headers.findIndex(h => h.includes(name));
                        if (idx !== -1) return idx;
                    }
                    return -1;
                };

                const textIdx = findIndex(['任务', '内容', 'task', 'title']);
                const priorityIdx = findIndex(['优先级', 'priority']);
                const dateIdx = findIndex(['日期', 'date']);
                const startTimeIdx = findIndex(['开始时间', 'start']);
                const endTimeIdx = findIndex(['结束时间', 'end']);
                const groupIdx = findIndex(['分组', 'group', '标签']);
                const notesIdx = findIndex(['备注', 'note', '描述']);

                if (textIdx === -1) {
                    throw new Error('未找到任务内容列，请确保表格中有"任务"或"内容"列');
                }

                // 解析任务
                const newTodos = [];
                const defaultGroup = state.groups[0];

                dataRows.forEach((row, index) => {
                    const text = row[textIdx]?.trim();
                    if (!text) return; // 跳过空行

                    // 解析优先级
                    let priority = 'medium';
                    if (priorityIdx !== -1) {
                        const p = row[priorityIdx]?.trim().toLowerCase();
                        if (p.includes('高') || p.includes('high')) priority = 'high';
                        else if (p.includes('低') || p.includes('low')) priority = 'low';
                    }

                    // 解析日期
                    let date = new Date().toISOString().split('T')[0];
                    if (dateIdx !== -1 && row[dateIdx]) {
                        const dateStr = row[dateIdx].trim();
                        // 尝试解析各种日期格式
                        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                            date = dateStr;
                        } else {
                            const parsed = new Date(dateStr);
                            if (!isNaN(parsed)) {
                                date = parsed.toISOString().split('T')[0];
                            }
                        }
                    }

                    // 解析分组
                    let groupName = defaultGroup.name;
                    let groupColor = defaultGroup.color;
                    let groupId = defaultGroup.id;

                    if (groupIdx !== -1 && row[groupIdx]) {
                        const gName = row[groupIdx].trim();
                        const existingGroup = state.groups.find(g => g.name === gName);
                        if (existingGroup) {
                            groupName = existingGroup.name;
                            groupColor = existingGroup.color;
                            groupId = existingGroup.id;
                        } else {
                            // 创建新分组
                            const newGroup = {
                                id: `g_${uniqueId()}_${index}`,
                                name: gName,
                                color: colors[state.groups.length % colors.length]
                            };
                            state.groups.push(newGroup);
                            groupName = newGroup.name;
                            groupColor = newGroup.color;
                            groupId = newGroup.id;
                        }
                    }

                    newTodos.push({
                        id: uniqueId() + index,
                        text: text,
                        notes: notesIdx !== -1 ? (row[notesIdx]?.trim() || '') : '',
                        completed: false,
                        priority: priority,
                        groupId: groupId,
                        groupName: groupName,
                        groupColor: groupColor,
                        date: date,
                        startTime: startTimeIdx !== -1 ? (row[startTimeIdx]?.trim() || null) : null,
                        endTime: endTimeIdx !== -1 ? (row[endTimeIdx]?.trim() || null) : null,
                        subtasks: [],
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                });

                if (newTodos.length === 0) {
                    throw new Error('没有找到有效的任务数据');
                }

                // 显示导入选项对话框
                showImportDialog(newTodos, resolve, reject);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsText(file, 'UTF-8');
    });
}

// 简单的 CSV 解析器
function parseCSV(text) {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // 转义的引号
                currentField += '"';
                i++;
            } else {
                // 切换引号状态
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // 字段分隔符
            currentRow.push(currentField);
            currentField = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            // 行分隔符
            if (currentField || currentRow.length > 0) {
                currentRow.push(currentField);
                rows.push(currentRow);
                currentRow = [];
                currentField = '';
            }
            // 跳过 \r\n 中的 \n
            if (char === '\r' && nextChar === '\n') {
                i++;
            }
        } else {
            currentField += char;
        }
    }

    // 添加最后一行
    if (currentField || currentRow.length > 0) {
        currentRow.push(currentField);
        rows.push(currentRow);
    }

    return rows;
}

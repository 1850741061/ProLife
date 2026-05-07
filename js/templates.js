// 任务模板


function initTemplates() {
    const templateBtn = document.getElementById('templateBtn');
    templateBtn.onclick = () => {
        openTemplateManager();
    };
}

// 打开模板管理器
function openTemplateManager() {
    renderTemplateList();
    openModal('templateModal');
}

// 渲染模板列表
function renderTemplateList() {
    const list = document.getElementById('templateList');
    const emptyState = document.getElementById('emptyTemplateState');

    if (state.templates.length === 0) {
        list.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    list.style.display = 'flex';
    emptyState.style.display = 'none';
    list.innerHTML = '';

    state.templates.forEach(template => {
        const div = document.createElement('div');
        div.style.cssText = `
            padding: 15px;
            background: var(--card-bg);
            border: 3px solid var(--border-color);
            border-radius: var(--radius);
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: var(--transition);
            cursor: pointer;
        `;

        div.innerHTML = `
            <div style="flex: 1;">
                <div style="font-weight: 800; font-size: 1.05rem; margin-bottom: 5px; text-transform: uppercase;">${escapeHtml(template.text)}</div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    ${template.date ? `<span class="attribute-badge"><i class="far fa-calendar"></i> 模板日期</span>` : ''}
                    ${template.startTime || template.endTime ? `<span class="attribute-badge" style="color: var(--accent-color); border-color: var(--accent-color);"><i class="far fa-clock"></i> 带时间段</span>` : ''}
                    <span class="attribute-badge priority-${template.priority}">${pMap[template.priority] || '中'}优先级</span>
                    ${template.notes ? `<span class="attribute-badge" style="color: var(--text-secondary);"><i class="fas fa-sticky-note"></i> 有备注</span>` : ''}
                </div>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <button class="btn btn-primary" onclick="createFromTemplate(${template.id}); event.stopPropagation();" style="padding: 8px 16px;">
                    <i class="fas fa-plus"></i> 使用
                </button>
                <button class="btn" onclick="deleteTemplate(${template.id}); event.stopPropagation();" style="color: var(--danger-color); border-color: var(--danger-color); padding: 8px 12px;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        // 点击模板显示详情
        div.onclick = () => {
            showTemplateDetail(template);
        };

        list.appendChild(div);
    });
}

// 保存当前编辑任务为模板（打开输入模态框）
window.saveAsTemplate = function () {
    if (!state.editingId) {
        showSyncToast('请先编辑一个任务', 'error');
        return;
    }

    const task = state.todos.find(t => t.id === state.editingId);
    if (!task) return;

    // 打开保存模板名称的模态框，并填入默认名称
    document.getElementById('templateNameInput').value = task.text;
    openModal('saveTemplateModal');

    // 聚焦输入框
    setTimeout(() => {
        document.getElementById('templateNameInput').focus();
        document.getElementById('templateNameInput').select();
    }, 100);
};

// 确认保存模板
window.confirmSaveTemplate = function () {
    const templateName = document.getElementById('templateNameInput').value.trim();

    if (!templateName) {
        showSyncToast('请输入模板名称', 'error');
        return;
    }

    const task = state.todos.find(t => t.id === state.editingId);
    if (!task) return;

    const template = {
        id: uniqueId(),
        text: templateName,
        notes: task.notes || '',
        priority: task.priority,
        groupId: task.groupId,
        groupName: task.groupName,
        groupColor: task.groupColor,
        date: null, // 模板不保存具体日期
        startTime: task.startTime || null,
        endTime: task.endTime || null,
        subtasks: task.subtasks || [],
        createdAt: new Date().toISOString()
    };

    state.templates.push(template);
    save();

    closeModal('saveTemplateModal');
    showSyncToast(`模板 "${templateName}" 已保存`);
};

// 从搜索结果应用模板
function applyTemplate(templateId) {
    window.createFromTemplate(templateId);
}

// 从模板创建新任务
window.createFromTemplate = function (templateId) {
    const template = state.templates.find(t => t.id === templateId);
    if (!template) return;

    const today = new Date().toISOString().split('T')[0];

    const newTodo = {
        id: uniqueId(),
        text: template.text,
        notes: template.notes,
        completed: false,
        priority: template.priority,
        groupId: template.groupId,
        groupName: template.groupName,
        groupColor: template.groupColor,
        date: today, // 使用今天的日期
        startTime: template.startTime,
        endTime: template.endTime,
        subtasks: template.subtasks ? template.subtasks.map(st => ({
            ...st,
            id: uniqueId() + Math.random(), // 新的子任务 ID
            completed: false // 重置完成状态
        })) : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    state.todos.unshift(newTodo);
    save();
    renderTodos();
    closeModal('templateModal');
    showSyncToast(`已从模板创建任务：${template.text}`);
};

// 删除模板
window.deleteTemplate = async function (templateId) {
    const template = state.templates.find(t => t.id === templateId);
    if (!template) return;

    const confirmed = await showConfirm('删除模板', `确定删除模板 "${template.text}"？`);
    if (confirmed === 0) return;

    // 记录删除ID
    if (!state.deletedIds.includes(templateId)) {
        state.deletedIds.push(templateId);
    }
    state.templates = state.templates.filter(t => t.id !== templateId);
    save();
    renderTemplateList();
    showSyncToast('模板已删除');
};

// 显示模板详情
function showTemplateDetail(template) {
    let lines = [];
    lines.push(`模板名称：${template.text}`);
    lines.push(`优先级：${pMap[template.priority] || '中'}`);
    lines.push(`分组：${template.groupName}`);
    if (template.startTime || template.endTime) lines.push(`时间段：${template.startTime || '--'} - ${template.endTime || '--'}`);
    if (template.notes) lines.push(`备注：${template.notes}`);
    if (template.subtasks && template.subtasks.length > 0) {
        lines.push(`子任务 (${template.subtasks.length})：`);
        template.subtasks.forEach(st => lines.push('  - ' + st.text));
    }
    showConfirm('模板详情', lines.join('\n'));
}

// ========== 数据统计功能 ==========
let groupChart = null;
let habitStreakChart = null;
let trendChart = null;

// 初始化数据统计

// 项目思维导图（Blender节点风格）


window.openProjectMindmap = function (projectId) {
    const project = state.projects.find(p => p.id == projectId);
    if (!project) return;

    // 确保项目有subGroups字段
    if (!project.subGroups) project.subGroups = [];

    currentMindmapProjectId = projectId;
    document.getElementById('mindmapTitle').textContent = project.name;
    closeMmDetail();

    // 切换时再次显示侧边栏项目区域
    const projectSection = document.getElementById('sidebarProjectSection');
    if (projectSection) projectSection.style.display = '';

    // 关闭可能打开的projectModal
    closeModal('projectModal');

    // 切换到思维导图视图
    switchView('projectMindmap');

    renderMindmap();
};

// 关闭思维导图（回到待办视图）
window.closeMindmap = function () {
    closeMmDetail();
    currentMindmapProjectId = null;
    mmActiveNodeId = null;
    switchView('todo');
};

// 渲染思维导图
function renderMindmap() {
    const project = state.projects.find(p => p.id == currentMindmapProjectId);
    if (!project) return;

    const canvas = document.getElementById('mindmapCanvas');
    const svg = document.getElementById('mindmapSvg');

    // 清除旧内容（保留SVG元素）
    canvas.querySelectorAll('.mm-node').forEach(n => n.remove());
    svg.innerHTML = '';

    // 获取该项目所有任务
    const projectTasks = state.todos.filter(t => t.projectId == project.id);

    // 递归构建分组树
    const subGroups = project.subGroups || [];
    function buildTree(parentId) {
        const children = subGroups.filter(sg => {
            const pid = sg.parentId || null;
            return parentId === null ? pid === null : pid == parentId;
        });
        return children.map(sg => ({
            group: sg,
            tasks: projectTasks.filter(t => t.projectSubGroupId == sg.id),
            children: buildTree(sg.id)
        }));
    }
    let tree = buildTree(null);

    // 未分组任务
    const assignedGroupIds = subGroups.map(sg => sg.id);
    const ungroupedTasks = projectTasks.filter(t => !t.projectSubGroupId || !assignedGroupIds.includes(Number(t.projectSubGroupId)));
    if (ungroupedTasks.length > 0 || tree.length === 0) {
        tree.push({
            group: { id: '__ungrouped__', name: '未分类', color: '#6b7280' },
            tasks: ungroupedTasks,
            children: []
        });
    }

    // ===== 布局 =====
    const NODE_H_GAP = 180;
    const NODE_V_GAP = 16;
    const PROJECT_NODE_W = 220;
    const GROUP_NODE_W = 160;
    const TASK_NODE_W = 220;
    const TASK_NODE_H = 65;
    const GROUP_NODE_H = 50;
    const PROJECT_NODE_H = 90;

    function calcHeight(node) {
        const taskH = node.tasks.length * (TASK_NODE_H + NODE_V_GAP);
        const childrenH = node.children.reduce((s, c) => s + calcHeight(c) + NODE_V_GAP, 0);
        return Math.max(taskH, childrenH, GROUP_NODE_H + NODE_V_GAP);
    }
    const totalTreeH = tree.reduce((s, n) => s + calcHeight(n) + NODE_V_GAP, 0);

    const col1X = 60;
    const totalT = projectTasks.length;
    const completedT = projectTasks.filter(t => t.completed).length;
    const progress = totalT > 0 ? Math.round((completedT / totalT) * 100) : 0;
    const projectY = Math.max(60, totalTreeH / 2 - PROJECT_NODE_H / 2 + 60);

    const projectNode = createNode('project-node', col1X, projectY, PROJECT_NODE_W, `
        <div class="mm-node-header" style="background:${project.color};">
            <i class="fas fa-project-diagram"></i> ${project.name}
        </div>
        <div class="mm-node-body">
            <div style="font-size:0.8rem;color:var(--text-secondary);">${completedT}/${totalT} 任务完成</div>
            <div class="mm-progress-bar">
                <div class="mm-progress-fill" style="width:${progress}%;background:${project.color};"></div>
            </div>
        </div>
        <div class="mm-socket output" style="background:${project.color};border-color:${project.color};"></div>
    `, () => showProjectDetail(project));
    canvas.appendChild(projectNode);

    const connections = [];
    let maxColX = col1X + PROJECT_NODE_W;

    function renderSubTree(nodes, pX, pW, pY, pH, startY) {
        const colX = pX + pW + NODE_H_GAP;
        const taskColX = colX + GROUP_NODE_W + NODE_H_GAP;
        if (taskColX + TASK_NODE_W > maxColX) maxColX = taskColX + TASK_NODE_W;
        let curY = startY;

        nodes.forEach(nd => {
            const nodeH = calcHeight(nd);
            const gcY = curY + nodeH / 2 - GROUP_NODE_H / 2;
            const gColor = nd.group.color || '#6b7280';

            function countAll(n) { return n.tasks.length + n.children.reduce((s, c) => s + countAll(c), 0); }
            function countDone(n) { return n.tasks.filter(t => t.completed).length + n.children.reduce((s, c) => s + countDone(c), 0); }

            const groupNode = createNode('group-node', colX, gcY, GROUP_NODE_W, `
                <div class="mm-socket input" style="background:${gColor};border-color:${gColor};"></div>
                <div class="mm-node-header" style="background:${gColor};"><i class="fas fa-layer-group"></i> ${nd.group.name}</div>
                <div class="mm-node-body"><div style="font-size:0.8rem;color:var(--text-secondary);">${countDone(nd)}/${countAll(nd)} 完成</div></div>
                <div class="mm-socket output" style="background:${gColor};border-color:${gColor};"></div>
            `, () => showSubGroupDetail(project, nd.group));

            groupNode.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; groupNode.classList.add('drag-over'); });
            groupNode.addEventListener('dragleave', () => groupNode.classList.remove('drag-over'));
            groupNode.addEventListener('drop', e => {
                e.preventDefault(); groupNode.classList.remove('drag-over');
                const tid = e.dataTransfer.getData('text/mm-task-id');
                if (tid) mmMoveTaskToGroup(Number(tid), nd.group.id === '__ungrouped__' ? null : nd.group.id);
            });
            canvas.appendChild(groupNode);

            connections.push({ fromX: pX + pW, fromY: pY + pH / 2, toX: colX, toY: gcY + GROUP_NODE_H / 2, color: gColor });

            // 渲染子分组（递归）
            if (nd.children.length > 0) {
                renderSubTree(nd.children, colX, GROUP_NODE_W, gcY, GROUP_NODE_H, curY);
            }

            // 渲染直属任务
            const taskStartY = nd.children.length > 0 ? curY + nd.children.reduce((s, c) => s + calcHeight(c) + NODE_V_GAP, 0) : curY;
            nd.tasks.forEach((task, ti) => {
                const taskY = taskStartY + ti * (TASK_NODE_H + NODE_V_GAP);
                const pLabel = { low: '低', medium: '中', high: '高' }[task.priority] || '中';
                const taskNode = createNode(`task-node ${task.completed ? 'completed' : ''}`, taskColX, taskY, TASK_NODE_W, `
                    <div class="mm-socket input" style="background:${gColor};border-color:${gColor};"></div>
                    <div class="mm-node-header" style="background:${task.completed ? 'var(--success-color)' : gColor};">
                        <i class="fas ${task.completed ? 'fa-check-circle' : 'fa-circle'}"></i> ${pLabel}优先级
                    </div>
                    <div class="mm-node-body">
                        <div class="mm-task-text">${task.text}</div>
                        <div class="mm-task-meta">${task.date ? '<i class="far fa-calendar"></i> ' + task.date.substring(5) : ''} ${task.startTime ? '<i class="far fa-clock"></i> ' + task.startTime : ''}</div>
                    </div>
                `, () => showTaskDetail(task));
                taskNode.draggable = true;
                taskNode.addEventListener('dragstart', e => { e.dataTransfer.setData('text/mm-task-id', String(task.id)); e.dataTransfer.effectAllowed = 'move'; taskNode.style.opacity = '0.5'; });
                taskNode.addEventListener('dragend', () => { taskNode.style.opacity = '1'; });
                canvas.appendChild(taskNode);
                connections.push({ fromX: colX + GROUP_NODE_W, fromY: gcY + GROUP_NODE_H / 2, toX: taskColX, toY: taskY + TASK_NODE_H / 2, color: gColor });
            });

            curY += nodeH + NODE_V_GAP;
        });
    }

    let startRY = projectY - totalTreeH / 2 + PROJECT_NODE_H / 2;
    if (startRY < 30) startRY = 30;
    renderSubTree(tree, col1X, PROJECT_NODE_W, projectY, PROJECT_NODE_H, startRY);

    connections.forEach(c => {
        const dx = (c.toX - c.fromX) * 0.5;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${c.fromX} ${c.fromY} C ${c.fromX + dx} ${c.fromY}, ${c.toX - dx} ${c.toY}, ${c.toX} ${c.toY}`);
        path.setAttribute('stroke', c.color);
        path.setAttribute('opacity', '0.6');
        svg.appendChild(path);
    });

    const canvasW = maxColX + 100;
    const canvasH = (startRY < 30 ? 30 : startRY) + totalTreeH + 100;
    canvas.style.width = canvasW + 'px';
    canvas.style.height = Math.max(canvasH, 600) + 'px';
    svg.setAttribute('width', canvasW);
    svg.setAttribute('height', Math.max(canvasH, 600));
}

// 创建节点DOM元素
function createNode(classNames, x, y, width, innerHTML, onClick) {
    const node = document.createElement('div');
    node.className = `mm-node ${classNames}`;
    node.style.left = x + 'px';
    node.style.top = y + 'px';
    node.style.width = width + 'px';
    node.innerHTML = innerHTML;
    if (onClick) node.addEventListener('click', (e) => {
        e.stopPropagation();
        // 清除所有active
        document.querySelectorAll('.mm-node.active').forEach(n => n.classList.remove('active'));
        node.classList.add('active');
        onClick();
    });
    return node;
}

// 适应视图
window.fitMindmapView = function () {
    const wrapper = document.getElementById('mindmapWrapper');
    wrapper.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
};

// ===== 弹窗通用 =====
window.closeMmPopup = function (id) {
    document.getElementById(id).style.display = 'none';
};

// ===== 添加分组 =====
window.openMmAddGroup = function (presetParentId) {
    document.getElementById('mmGroupNameInput').value = '';
    // 填充父分组下拉框
    const project = state.projects.find(p => p.id == currentMindmapProjectId);
    const sel = document.getElementById('mmParentGroupSelect');
    sel.innerHTML = '<option value="">顶层（直属项目）</option>';
    if (project && project.subGroups) {
        // 递归展开所有分组
        function addOptions(groups, depth) {
            groups.forEach(sg => {
                const prefix = '—'.repeat(depth) + ' ';
                sel.innerHTML += `<option value="${sg.id}">${prefix}${sg.name}</option>`;
                const children = project.subGroups.filter(c => c.parentId == sg.id);
                if (children.length > 0) addOptions(children, depth + 1);
            });
        }
        const topLevel = project.subGroups.filter(sg => !sg.parentId);
        addOptions(topLevel, 1);
    }
    if (presetParentId) sel.value = String(presetParentId);
    document.getElementById('mmAddGroupPopup').style.display = 'flex';
    setTimeout(() => document.getElementById('mmGroupNameInput').focus(), 100);
};

window.confirmAddSubGroup = function () {
    const project = state.projects.find(p => p.id == currentMindmapProjectId);
    if (!project) return;
    if (!project.subGroups) project.subGroups = [];

    const name = document.getElementById('mmGroupNameInput').value.trim();
    if (!name) return;

    const parentId = document.getElementById('mmParentGroupSelect').value || null;
    const randomColor = colors[Math.floor(Math.random() * 12)];
    project.subGroups.push({
        id: uniqueId(),
        name: name,
        color: randomColor,
        parentId: parentId ? Number(parentId) : null
    });

    save();
    closeMmPopup('mmAddGroupPopup');
    renderMindmap();
};

// 兼容旧调用
window.addProjectSubGroup = window.openMmAddGroup;

// ===== 添加任务 =====
window.openMmAddTask = function () {
    const project = state.projects.find(p => p.id == currentMindmapProjectId);
    if (!project) return;

    document.getElementById('mmTaskTextInput').value = '';
    document.getElementById('mmTaskDateInput').value = new Date().toISOString().split('T')[0];
    document.getElementById('mmTaskPriorityInput').value = 'medium';
    document.getElementById('mmTaskNotesInput').value = '';

    // 填充分组选择器
    const groupSelect = document.getElementById('mmTaskGroupInput');
    const subGroups = project.subGroups || [];
    groupSelect.innerHTML = `<option value="">未分类</option>` +
        subGroups.map(sg => `<option value="${sg.id}">${sg.name}</option>`).join('');

    document.getElementById('mmAddTaskPopup').style.display = 'flex';
    setTimeout(() => document.getElementById('mmTaskTextInput').focus(), 100);
};

window.confirmMmAddTask = function () {
    const project = state.projects.find(p => p.id == currentMindmapProjectId);
    if (!project) return;

    const text = document.getElementById('mmTaskTextInput').value.trim();
    if (!text) return;

    const date = document.getElementById('mmTaskDateInput').value;
    const priority = document.getElementById('mmTaskPriorityInput').value;
    const subGroupId = document.getElementById('mmTaskGroupInput').value || null;
    const notes = document.getElementById('mmTaskNotesInput').value.trim();

    const newTodo = {
        id: uniqueId(),
        text: text,
        completed: false,
        date: date || null,
        priority: priority,
        notes: notes || '',
        projectId: String(project.id),
        projectName: project.name,
        projectColor: project.color,
        projectSubGroupId: subGroupId ? Number(subGroupId) : null,
        subtasks: [],
        startTime: null,
        endTime: null,
        groupId: null,
        groupName: null,
        groupColor: null,
        createdAt: new Date().toISOString()
    };

    state.todos.push(newTodo);
    save();
    closeMmPopup('mmAddTaskPopup');
    renderMindmap();
    showSyncToast('任务已添加到项目');
};

// ===== 任务列表弹窗 =====
window.showMmTaskList = function () {
    const project = state.projects.find(p => p.id == currentMindmapProjectId);
    if (!project) return;

    const projectTasks = state.todos.filter(t => t.projectId == project.id);
    const pending = projectTasks.filter(t => !t.completed);
    const completed = projectTasks.filter(t => t.completed);

    const renderItem = (t) => {
        const pColor = { low: 'var(--success-color)', medium: 'var(--warning-color)', high: 'var(--danger-color)' }[t.priority] || 'var(--warning-color)';
        const sgName = t.projectSubGroupId
            ? ((project.subGroups || []).find(sg => sg.id == t.projectSubGroupId) || {}).name || '未分类'
            : '未分类';
        return `
            <div class="mm-task-item ${t.completed ? 'completed' : ''}" style="border-left-color:${pColor};">
                <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTodo(${t.id});setTimeout(()=>showMmTaskList(),50);" style="width:16px;height:16px;flex-shrink:0;">
                <div style="flex:1;min-width:0;">
                    <div class="mm-task-item-text" style="font-weight:600;margin-bottom:2px;">${t.text}</div>
                    <div style="font-size:0.75rem;color:var(--text-secondary);display:flex;gap:8px;flex-wrap:wrap;">
                        ${t.date ? '<i class="far fa-calendar"></i> ' + t.date.substring(5) : ''}
                        <span style="background:var(--border-color);padding:1px 6px;border-radius:3px;">${sgName}</span>
                    </div>
                </div>
            </div>`;
    };

    document.getElementById('mmTaskListContent').innerHTML = `
        ${pending.length > 0 ? `
            <div style="font-weight:800;font-size:0.8rem;text-transform:uppercase;margin-bottom:10px;color:var(--text-secondary);">进行中 (${pending.length})</div>
            ${pending.map(renderItem).join('')}
        ` : ''}
        ${completed.length > 0 ? `
            <div style="font-weight:800;font-size:0.8rem;text-transform:uppercase;margin:16px 0 10px 0;color:var(--text-secondary);">已完成 (${completed.length})</div>
            ${completed.map(renderItem).join('')}
        ` : ''}
        ${projectTasks.length === 0 ? '<div style="text-align:center;padding:30px;color:var(--text-secondary);">暂无任务，点击"添加任务"创建</div>' : ''}
    `;
    document.getElementById('mmTaskListPopup').style.display = 'flex';
};

// 拖动任务到不同分组
window.mmMoveTaskToGroup = function (taskId, targetGroupId) {
    const task = state.todos.find(t => t.id === taskId);
    if (!task) return;

    // 避免无意义移动
    const currentGroupId = task.projectSubGroupId || null;
    if (currentGroupId == targetGroupId) return;

    task.projectSubGroupId = targetGroupId ? Number(targetGroupId) : null;
    save();
    renderMindmap();

    const project = state.projects.find(p => p.id == currentMindmapProjectId);
    const sgName = targetGroupId
        ? ((project && project.subGroups || []).find(sg => sg.id == targetGroupId) || {}).name || '未分类'
        : '未分类';
    showSyncToast(`已移动到「${sgName}」`);
};

// ===== 子分组 CRUD =====
window.editSubGroup = function (subGroupId) {
    const project = state.projects.find(p => p.id == currentMindmapProjectId);
    if (!project) return;
    const sg = project.subGroups.find(g => g.id == subGroupId);
    if (!sg) return;

    // 复用添加分组弹窗进行编辑
    document.getElementById('mmGroupNameInput').value = sg.name;
    document.getElementById('mmAddGroupPopup').style.display = 'flex';
    setTimeout(() => document.getElementById('mmGroupNameInput').focus(), 100);

    // 临时替换确认按钮行为
    const confirmBtn = document.getElementById('mmAddGroupPopup').querySelector('.btn-primary');
    const originalOnclick = confirmBtn.onclick;
    confirmBtn.onclick = function () {
        const newName = document.getElementById('mmGroupNameInput').value.trim();
        if (!newName) return;
        sg.name = newName;
        save();
        closeMmPopup('mmAddGroupPopup');
        renderMindmap();
        showSubGroupDetail(project, sg);
        confirmBtn.onclick = originalOnclick; // 恢复原始行为
    };
};

window.deleteSubGroup = async function (subGroupId) {
    const project = state.projects.find(p => p.id == currentMindmapProjectId);
    if (!project) return;

    const tasksInGroup = state.todos.filter(t => t.projectSubGroupId == subGroupId);
    if (tasksInGroup.length > 0) {
        const confirmed = await showConfirm(
            '删除分组',
            `该分组下有 ${tasksInGroup.length} 个任务，删除后任务将变为未分类。`,
            ['取消', '确认删除']
        );
        if (confirmed === 0) return;
        // 将任务移到未分类
        tasksInGroup.forEach(t => { t.projectSubGroupId = null; });
    }

    project.subGroups = project.subGroups.filter(g => g.id != subGroupId);
    save();
    closeMmDetail();
    renderMindmap();
};

window.assignTaskToSubGroup = function (taskId, subGroupId) {
    const task = state.todos.find(t => t.id == taskId);
    if (!task) return;
    task.projectSubGroupId = subGroupId === '__ungrouped__' ? null : subGroupId;
    save();
    renderMindmap();
};

// ===== 详情面板 =====
function closeMmDetail() {
    document.getElementById('mmDetailPanel').classList.remove('open');
    mmActiveNodeId = null;
}
window.closeMmDetail = closeMmDetail;

function showProjectDetail(project) {
    const projectTasks = state.todos.filter(t => t.projectId == project.id);
    const totalT = projectTasks.length;
    const completedT = projectTasks.filter(t => t.completed).length;
    const progress = totalT > 0 ? Math.round((completedT / totalT) * 100) : 0;

    let deadlineHtml = '';
    if (project.deadline) {
        const daysLeft = Math.ceil((new Date(project.deadline) - new Date()) / (1000 * 60 * 60 * 24));
        deadlineHtml = `<div style="margin-top:10px;font-size:0.9rem;">
            <i class="far fa-calendar-alt"></i>
            截止：${project.deadline}
            <span style="color:${daysLeft < 0 ? 'var(--danger-color)' : daysLeft <= 3 ? 'var(--warning-color)' : 'var(--success-color)'};font-weight:700;margin-left:8px;">
                ${daysLeft < 0 ? '已逾期 ' + Math.abs(daysLeft) + ' 天' : daysLeft === 0 ? '今天截止' : '还剩 ' + daysLeft + ' 天'}
            </span>
        </div>`;
    }

    document.getElementById('mmDetailContent').innerHTML = `
        <h3 style="margin:0 0 20px 0;display:flex;align-items:center;gap:10px;">
            <span style="width:16px;height:16px;border-radius:4px;background:${project.color};display:inline-block;"></span>
            ${project.name}
        </h3>
        ${project.description ? `<p style="color:var(--text-secondary);margin-bottom:15px;">${project.description}</p>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:15px;">
            <div style="padding:12px;background:var(--bg-color);border-radius:var(--radius);text-align:center;">
                <div style="font-size:1.5rem;font-weight:900;color:${project.color};">${totalT}</div>
                <div style="font-size:0.75rem;color:var(--text-secondary);">总任务</div>
            </div>
            <div style="padding:12px;background:var(--bg-color);border-radius:var(--radius);text-align:center;">
                <div style="font-size:1.5rem;font-weight:900;color:var(--success-color);">${completedT}</div>
                <div style="font-size:0.75rem;color:var(--text-secondary);">已完成</div>
            </div>
        </div>
        <div style="margin-bottom:15px;">
            <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:5px;">
                <span>进度</span><span style="font-weight:700;">${progress}%</span>
            </div>
            <div class="mm-progress-bar"><div class="mm-progress-fill" style="width:${progress}%;background:${project.color};"></div></div>
        </div>
        ${deadlineHtml}
        <div style="margin-top:20px;display:flex;flex-direction:column;gap:8px;">
            <button class="btn btn-primary" onclick="showMmTaskList()" style="width:100%;justify-content:center;">
                <i class="fas fa-tasks"></i> 查看任务列表
            </button>
            <button class="btn" onclick="openMmAddTask()" style="width:100%;justify-content:center;">
                <i class="fas fa-plus-circle"></i> 添加任务
            </button>
            <button class="btn" onclick="editProject(${project.id});closeMindmap();" style="width:100%;justify-content:center;">
                <i class="fas fa-pen"></i> 编辑项目
            </button>
        </div>
    `;
    document.getElementById('mmDetailPanel').classList.add('open');
}

function showSubGroupDetail(project, subGroup) {
    const isUngrouped = subGroup.id === '__ungrouped__';
    const tasks = isUngrouped
        ? state.todos.filter(t => t.projectId == project.id && (!t.projectSubGroupId || !project.subGroups.find(sg => sg.id == t.projectSubGroupId)))
        : state.todos.filter(t => t.projectId == project.id && t.projectSubGroupId == subGroup.id);

    const completedCount = tasks.filter(t => t.completed).length;

    // 分组选择器（用于任务重新分配）
    const groupOptions = (project.subGroups || []).map(sg =>
        `<option value="${sg.id}" ${sg.id == subGroup.id ? 'selected' : ''}>${sg.name}</option>`
    ).join('') + `<option value="__ungrouped__" ${isUngrouped ? 'selected' : ''}>未分类</option>`;

    document.getElementById('mmDetailContent').innerHTML = `
        <h3 style="margin:0 0 5px 0;display:flex;align-items:center;gap:10px;">
            <span style="width:14px;height:14px;border-radius:3px;background:${subGroup.color};display:inline-block;"></span>
            ${subGroup.name}
        </h3>
        <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:20px;">${completedCount}/${tasks.length} 任务完成</div>
        ${!isUngrouped ? `
        <div style="display:flex;gap:8px;margin-bottom:20px;">
            <button class="btn" onclick="editSubGroup(${subGroup.id})" style="flex:1;justify-content:center;"><i class="fas fa-pen"></i> 编辑</button>
            <button class="btn" onclick="deleteSubGroup(${subGroup.id})" style="flex:1;justify-content:center;color:var(--danger-color);border-color:var(--danger-color);"><i class="fas fa-trash"></i> 删除</button>
        </div>
        ` : ''}
        <div style="font-weight:800;font-size:0.8rem;text-transform:uppercase;margin-bottom:10px;">任务列表</div>
        ${tasks.length === 0 ? '<div style="color:var(--text-secondary);font-size:0.9rem;padding:20px 0;text-align:center;">暂无任务</div>' : ''}
        ${tasks.map(t => `
            <div style="padding:12px;background:var(--bg-color);border-radius:var(--radius);margin-bottom:8px;border-left:4px solid ${t.completed ? 'var(--success-color)' : subGroup.color};">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
                    <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTodo(${t.id});setTimeout(()=>{renderMindmap();showSubGroupDetail(state.projects.find(p=>p.id==${project.id}),${JSON.stringify(subGroup).replace(/"/g, '&quot;')})},50);" style="width:16px;height:16px;">
                    <span style="font-weight:600;${t.completed ? 'text-decoration:line-through;opacity:0.6;' : ''}">${t.text}</span>
                </div>
                <div style="display:flex;gap:8px;align-items:center;font-size:0.75rem;color:var(--text-secondary);">
                    ${t.date ? '<i class="far fa-calendar"></i> ' + t.date.substring(5) : ''}
                    <select onchange="assignTaskToSubGroup(${t.id}, this.value);setTimeout(()=>{renderMindmap();},50);" style="font-size:0.75rem;padding:2px 6px;border:1px solid var(--border-color);border-radius:4px;background:var(--card-bg);color:var(--text-main);">
                        ${groupOptions.replace(`value="${t.projectSubGroupId || '__ungrouped__'}" `, `value="${t.projectSubGroupId || '__ungrouped__'}" selected `)}
                    </select>
                </div>
            </div>
        `).join('')}
    `;
    document.getElementById('mmDetailPanel').classList.add('open');
}

function showTaskDetail(task) {
    const project = state.projects.find(p => p.id == currentMindmapProjectId);
    const subGroups = project ? (project.subGroups || []) : [];
    const groupOptions = subGroups.map(sg =>
        `<option value="${sg.id}" ${sg.id == task.projectSubGroupId ? 'selected' : ''}>${sg.name}</option>`
    ).join('') + `<option value="__ungrouped__" ${!task.projectSubGroupId ? 'selected' : ''}>未分类</option>`;

    const pLabel = { low: '低', medium: '中', high: '高' }[task.priority] || '中';
    const pColor = { low: 'var(--success-color)', medium: 'var(--warning-color)', high: 'var(--danger-color)' }[task.priority] || 'var(--warning-color)';

    let subtasksHtml = '';
    const completedSt = task.subtasks ? task.subtasks.filter(st => st.completed).length : 0;
    const subtaskCount = task.subtasks ? task.subtasks.length : 0;

    subtasksHtml = `
        <div style="margin-top:15px;">
            <div style="font-weight:800;font-size:0.8rem;text-transform:uppercase;margin-bottom:8px;">子任务 (${completedSt}/${subtaskCount})</div>
            ${task.subtasks && task.subtasks.length > 0 ? task.subtasks.map(st => `
                <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border-color);">
                    <input type="checkbox" ${st.completed ? 'checked' : ''} onchange="toggleSubtask(${task.id},${st.id});setTimeout(()=>{renderMindmap();showTaskDetail(state.todos.find(t=>t.id==${task.id}))},50);" style="width:16px;height:16px;cursor:pointer;">
                    <span style="flex:1;${st.completed ? 'text-decoration:line-through;opacity:0.6;' : ''}">${st.text}</span>
                    <button onclick="deleteSubtask(${task.id},${st.id});setTimeout(()=>{renderMindmap();showTaskDetail(state.todos.find(t=>t.id==${task.id}))},50);" style="background:none;border:none;color:var(--danger-color);cursor:pointer;padding:4px;"><i class="fas fa-times"></i></button>
                </div>
            `).join('') : '<div style="color:var(--text-secondary);font-size:0.85rem;padding:10px 0;">暂无子任务</div>'}
            <div style="display:flex;gap:8px;margin-top:12px;">
                <input type="text" id="mmSubtaskInput" placeholder="添加子任务..." onkeypress="if(event.key==='Enter') mmAddSubtask(${task.id})"
                    style="flex:1;padding:8px 12px;border:2px solid var(--border-color);border-radius:var(--radius);background:var(--bg-color);color:var(--text-main);">
                <button class="btn btn-primary" onclick="mmAddSubtask(${task.id})" style="padding:8px 14px;"><i class="fas fa-plus"></i></button>
            </div>
        </div>
    `;

    document.getElementById('mmDetailContent').innerHTML = `
        <h3 style="margin:0 0 15px 0;">${task.text}</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:15px;">
            <span style="padding:4px 10px;border-radius:var(--radius);font-size:0.8rem;font-weight:700;background:${pColor};color:#fff;">${pLabel}优先级</span>
            ${task.completed ? '<span style="padding:4px 10px;border-radius:var(--radius);font-size:0.8rem;font-weight:700;background:var(--success-color);color:#fff;">已完成</span>' : ''}
        </div>
        ${task.date ? `<div style="margin-bottom:8px;font-size:0.9rem;"><i class="far fa-calendar" style="margin-right:8px;"></i>${task.date}</div>` : ''}
        ${task.startTime ? `<div style="margin-bottom:8px;font-size:0.9rem;"><i class="far fa-clock" style="margin-right:8px;"></i>${task.startTime}${task.endTime ? ' - ' + task.endTime : ''}</div>` : ''}
        ${task.notes ? `<div style="padding:12px;background:var(--bg-color);border-radius:var(--radius);margin-bottom:15px;font-size:0.9rem;color:var(--text-secondary);">${task.notes}</div>` : ''}
        <div style="margin-bottom:15px;">
            <label style="font-weight:800;font-size:0.8rem;text-transform:uppercase;display:block;margin-bottom:6px;">所属分组</label>
            <select onchange="assignTaskToSubGroup(${task.id}, this.value);setTimeout(()=>{renderMindmap();showTaskDetail(state.todos.find(t=>t.id==${task.id}))},50);"
                    style="width:100%;padding:8px 12px;border:2px solid var(--border-color);border-radius:var(--radius);background:var(--bg-color);color:var(--text-main);">
                ${groupOptions}
            </select>
        </div>
        ${subtasksHtml}
        <div style="display:flex;gap:8px;margin-top:20px;">
            <button class="btn" onclick="openEditTask(${task.id});closeMindmap();" style="flex:1;justify-content:center;"><i class="fas fa-pen"></i> 编辑</button>
            <button class="btn" onclick="toggleTodo(${task.id});setTimeout(()=>{renderMindmap();showTaskDetail(state.todos.find(t=>t.id==${task.id}))},50);"
                    style="flex:1;justify-content:center;${task.completed ? 'color:var(--warning-color);border-color:var(--warning-color);' : 'color:var(--success-color);border-color:var(--success-color);'}">
                <i class="fas ${task.completed ? 'fa-undo' : 'fa-check'}"></i> ${task.completed ? '撤销完成' : '标记完成'}
            </button>
        </div>
    `;
    document.getElementById('mmDetailPanel').classList.add('open');
}

// === 饮品（奶茶/咖啡）追踪功能 ===
    // 当前选择的饮品类型（记录时用）
    let currentDrinkType = 'milktea';


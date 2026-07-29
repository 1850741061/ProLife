// 分组管理


function initColorPicker() {
    const p = document.getElementById('groupColorPicker');
    p.innerHTML = '';
    colors.forEach((c, i) => {
        const div = document.createElement('div');
        div.className = `color-option ${state.selectedColorIndex === i ? 'selected' : ''}`;
        div.style.background = c;
        div.onclick = () => {
            state.selectedColorIndex = i;
            initColorPicker();
        };
        p.appendChild(div);
    });
}

document.getElementById('addGroupBtn').onclick = () => {
    state.editingGroupId = null;
    document.getElementById('groupModalTitle').innerText = '新建分组';
    document.getElementById('groupNameInput').value = '';
    state.selectedColorIndex = Math.floor(Math.random() * colors.length);
    initColorPicker();
    openModal('groupModal');
};

window.openEditGroupModal = (id) => {
            const g = state.groups.find(x => sameEntityId(x.id, id));
            if (!g) return;
            state.editingGroupId = id;
            document.getElementById('groupModalTitle').innerText = '编辑分组';
            document.getElementById('groupNameInput').value = g.name;
            state.selectedColorIndex = colors.indexOf(g.color);
            initColorPicker();
            openModal('groupModal');
        };

window.saveGroup = () => {
            const name = document.getElementById('groupNameInput').value.trim();
            if (!name) return showSyncToast('名称不能为空', 'error');
            const color = colors[state.selectedColorIndex];

            if (state.editingGroupId) {
                state.groups = state.groups.map(g => sameEntityId(g.id, state.editingGroupId) ? { ...g, name, color } : g);
                state.todos = state.todos.map(t => sameEntityId(t.groupId, state.editingGroupId) ? { ...t, groupName: name, groupColor: color } : t);
            } else {
                state.groups.push({ id: `g_${uniqueId()}`, name, color });
            }
            save();
            closeModal('groupModal');
            renderGroups();
            renderTodos();
        };

window.deleteGroup = async (id) => {
            const confirmed = await showConfirm(
                '删除分组',
                '删除分组后，该分组的任务会移到其他分组。确定删除？',
                ['取消', '删除']
            );
            if (confirmed === 0) return;
            let fallbackGroup = state.groups.find(g => !sameEntityId(g.id, id));
            if (!fallbackGroup) {
                fallbackGroup = { id: `g_${uniqueId()}`, name: '默认', color: '#3b82f6' };
                state.groups.push(fallbackGroup);
            }
            state.todos = state.todos.map(t => sameEntityId(t.groupId, id) ? {
                ...t,
                groupId: fallbackGroup.id,
                groupName: fallbackGroup.name,
                groupColor: fallbackGroup.color
            } : t);
            // 记录分组ID到 deletedIds
            const groupTombstone = entityTombstone('group', id);
            if (!state.deletedIds.includes(groupTombstone)) {
                state.deletedIds.push(groupTombstone);
            }
            state.groups = state.groups.filter(g => !sameEntityId(g.id, id));
            if (sameEntityId(state.currentGroupId, id)) state.currentGroupId = 'all';
            save();
            renderAll();
        };

function renderGroups() {
    const l = document.getElementById('groupList');
    l.innerHTML = `<li class="group-item ${state.currentGroupId === 'all' && state.filter !== 'today' ? 'active' : ''}" onclick="selectGroup('all')">
        <div class="group-name"><i class="fas fa-th-large"></i> 全部任务</div>
    </li>
    <li class="group-item ${state.filter === 'today' ? 'active' : ''}" id="btnSidebarToday" onclick="selectTodayFilter()">
        <div class="group-name"><i class="fas fa-sun" style="color: var(--warning-color);"></i> 今日</div>
    </li>`;

    state.groups.forEach((g, index) => {
        const li = document.createElement('li');
        li.className = `group-item ${state.currentGroupId === g.id ? 'active' : ''}`;
        li.innerHTML = `
            <div class="group-name">
                <i class="fas fa-grip-vertical" style="cursor: move; color: var(--text-secondary); margin-right: 8px;"></i>
                <div class="group-color" style="background:${g.color}"></div>
                <span>${g.name}</span>
            </div>
            <div class="group-actions">
                <i class="fas fa-pen action-icon" onclick="event.stopPropagation();openEditGroupModal('${g.id}')"></i>
                <i class="fas fa-trash action-icon" onclick="event.stopPropagation();deleteGroup('${g.id}')" style="color:var(--danger-color)"></i>
            </div>
        `;
        li.onclick = () => selectGroup(g.id);

        // 添加拖拽功能（用于排序）
        li.draggable = true;
        li.ondragstart = (e) => onGroupDragStart(e, index);
        li.ondragend = (e) => onGroupDragEnd(e);
        li.ondragover = (e) => onGroupDragOver(e, index);
        li.ondragleave = (e) => onGroupDragLeave(e);
        // 处理任务拖拽到分组
        li.addEventListener('drop', (e) => {
            if (state.draggedTodoId) {
                onGroupDrop(e, g.id);
            } else {
                onGroupDropReorder(e, index);
            }
        });

        l.appendChild(li);
    });
    updateGroupSelects();
}

// 渲染侧边栏项目列表
function renderSidebarProjects() {
    const l = document.getElementById('projectListSidebar');
    if (!l) return;

    l.innerHTML = '';

    if (state.projects.length === 0) {
        l.innerHTML = `<li style="padding: 12px 15px; color: var(--text-secondary); font-size: 0.9rem; text-align: center;">暂无项目</li>`;
        return;
    }

    state.projects.forEach((p) => {
        const li = document.createElement('li');
        li.className = `group-item ${String(state.currentProjectId) === String(p.id) ? 'active' : ''}`;
        li.innerHTML = `
            <div class="group-name">
                <i class="fas fa-project-diagram" style="margin-right: 8px; color: ${p.color};"></i>
                <span>${p.name}</span>
            </div>
        `;
        li.onclick = () => openProjectMindmap(p.id);
        l.appendChild(li);
    });
}

window.selectProject = (id) => {
    const project = state.projects.find(p => String(p.id) === String(id));
    if (!project) return;

    // 点击项目时，清除分组选择（包括"全部任务"）
    state.currentProjectId = id;
    state.currentGroupId = null;
    state.filter = 'all';
    switchView('todo');

    // 更新UI - 重新渲染侧边栏和任务
    renderGroups();
    renderSidebarProjects();
    renderTodos();
    updateStats();
    updateTodoFilterUI();

    // 延迟更新表单选择器，确保updateGroupSelects已完成
    setTimeout(() => {
        const categoryCustom = document.getElementById('categorySelectCustom');
        if (categoryCustom) {
            const trigger = categoryCustom.querySelector('.custom-select-trigger');
            const options = categoryCustom.querySelectorAll('.custom-select-option');
            const targetOption = Array.from(options).find(opt => sameEntityId(opt.dataset.value, id));

            if (targetOption && trigger) {
                trigger.innerHTML = `<span style="display:flex;align-items:center;gap:8px;"><i class="fas fa-project-diagram" style="color:${project.color};"></i>${project.name}</span>`;
                trigger.dataset.value = String(id);
                options.forEach(o => o.classList.remove('selected'));
                targetOption.classList.add('selected');
            }
        }
    }, 150);

    // 检查该项目是否有任务 (原逻辑展开表单，已移除)
    const projectTasks = state.todos.filter(t => sameEntityId(t.projectId, id));
    // 移动端：关闭侧边栏
    if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('mobileSidebarOverlay');
        if (sidebar) sidebar.classList.remove('mobile-open');
        if (overlay) overlay.classList.remove('active');
    }
};

window.selectGroup = (id) => {
    // 点击分组时，清除项目选择，切换到待办视图，清除今日筛选
    state.currentGroupId = id;
    state.currentProjectId = null;
    state.filter = 'all';
    switchView('todo');

    renderGroups();
    renderSidebarProjects();
    renderTodos();
    updateStats();
    updateTodoFilterUI();  // 更新筛选栏显示状态

    // 更新表单选择器（如果是具体分组）
    if (id !== 'all') {
        const categoryCustom = document.getElementById('categorySelectCustom');
        if (categoryCustom) {
            setTimeout(() => {
                const trigger = categoryCustom.querySelector('.custom-select-trigger');
                const options = categoryCustom.querySelectorAll('.custom-select-option');
                const targetOption = Array.from(options).find(opt => sameEntityId(opt.dataset.value, id));

                if (targetOption && trigger) {
                    // 查找分组信息
                    const g = state.groups.find(gr => sameEntityId(gr.id, id));
                    if (g) {
                        trigger.innerHTML = `<span style="display:flex;align-items:center;gap:8px;"><span class="group-color" style="width:12px;height:12px;border-radius:2px;border:2px solid var(--border-color);background:${g.color};flex-shrink:0;"></span>${g.name}</span>`;
                        trigger.dataset.value = id;
                        options.forEach(o => o.classList.remove('selected'));
                        targetOption.classList.add('selected');
                    }
                }
            }, 50);
        }
    }

    // 检查该分组是否有任务 (原逻辑展开表单，已移除)
    if (id !== 'all') {
        const groupTasks = state.todos.filter(t => sameEntityId(t.groupId, id) && !t.projectId);
    }

    // 移动端：关闭侧边栏
    if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('mobileSidebarOverlay');
        if (sidebar) sidebar.classList.remove('mobile-open');
        if (overlay) overlay.classList.remove('active');
        updateMobileGroupToggle();
    }
};

// --- 分组拖拽排序 ---
let draggedGroupIndex = null;

function onGroupDragStart(e, index) {
    draggedGroupIndex = index;
    e.target.style.opacity = '0.5';
}

function onGroupDragEnd(e) {
    e.target.style.opacity = '';
}

function onGroupDragOver(e, index) {
    e.preventDefault();
    if (draggedGroupIndex === null || draggedGroupIndex === index) return;
    e.currentTarget.style.borderTop = '3px solid var(--accent-color)';
}

function onGroupDragLeave(e) {
    e.currentTarget.style.borderTop = '';
}

function onGroupDropReorder(e, targetIndex) {
    e.preventDefault();
    e.currentTarget.style.borderTop = '';

    if (draggedGroupIndex === null || draggedGroupIndex === targetIndex) return;

    // 重新排序分组数组
    const movedGroup = state.groups.splice(draggedGroupIndex, 1)[0];
    state.groups.splice(targetIndex, 0, movedGroup);

    draggedGroupIndex = null;
    save();
    renderGroups();
};

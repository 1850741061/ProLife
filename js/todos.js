// 任务管理：增删改查、渲染、子任务、重复任务


function addTodo() {
    const text = document.getElementById('todoInput').value.trim();
    if (!text) return;

    const dateInput = document.getElementById('todoDate').value;
    const dateStr = dateInput ? dateInput : new Date().toISOString().split('T')[0];

    const startTime = document.getElementById('todoStartTime').value;
    const endTime = document.getElementById('todoEndTime').value;
    const priority = getCustomSelectValue('prioritySelectCustom');

    // 获取选择的分类（分组或项目）
    const categoryId = getCustomSelectValue('categorySelectCustom');
    const categoryNative = document.getElementById('categorySelect');
    const selectedOption = categoryNative ? categoryNative.querySelector(`option[value="${categoryId}"]`) : null;
    const categoryType = selectedOption ? selectedOption.getAttribute('data-type') : null;

    console.log('[addTodo] categoryId:', categoryId, 'type:', categoryType, 'selectedOption:', selectedOption);

    let newTask = {
        id: uniqueId(),
        text, notes: document.getElementById('todoNotes').value.trim(),
        completed: false, priority: priority,
        date: dateStr,
        startTime: startTime || null,
        endTime: endTime || null,
        subtasks: [],
        createdAt: new Date().toISOString(),
        projectId: null,
        projectName: null,
        projectColor: null,
        groupId: null,
        groupName: null,
        groupColor: null
    };

    // 根据选择的类型设置分组或项目信息
    if (categoryType === 'project' && categoryId) {
        const project = state.projects.find(p => String(p.id) === String(categoryId));
        console.log('[addTodo] 找到项目:', project);
        if (project) {
            newTask.projectId = String(project.id);
            newTask.projectName = project.name;
            newTask.projectColor = project.color;
            console.log('[addTodo] 设置项目信息:', newTask.projectId, newTask.projectName);
        }
    } else if (categoryType === 'group' && categoryId) {
        const group = state.groups.find(g => String(g.id) === String(categoryId));
        if (group) {
            newTask.groupId = group.id;
            newTask.groupName = group.name;
            newTask.groupColor = group.color;
        }
    } else {
        // 如果当前在项目视图，默认使用当前项目
        if (state.currentProjectId) {
            const currentProject = state.projects.find(p => String(p.id) === String(state.currentProjectId));
            if (currentProject) {
                newTask.projectId = String(currentProject.id);
                newTask.projectName = currentProject.name;
                newTask.projectColor = currentProject.color;
            }
        }
        // 否则使用第一个分组
        else if (state.groups.length > 0) {
            const defaultGroup = state.groups[0];
            newTask.groupId = defaultGroup.id;
            newTask.groupName = defaultGroup.name;
            newTask.groupColor = defaultGroup.color;
        }
    }

    console.log('[addTodo] 最终任务:', newTask);
    state.todos.unshift(newTask);

    document.getElementById('todoInput').value = '';
    document.getElementById('todoNotes').value = '';
    document.getElementById('todoDate').valueAsDate = new Date();
    document.getElementById('todoStartTime').value = '';
    document.getElementById('todoEndTime').value = '';
    closeModal('addTodoModal');
    save();
    renderTodos();
    renderProjects();
}

window.openAddTodoModal = function () {
    // 自动选中当前项目或分组
    const categoryCustom = document.getElementById('categorySelectCustom');
    if (categoryCustom) {
        const trigger = categoryCustom.querySelector('.custom-select-trigger');
        const options = categoryCustom.querySelectorAll('.custom-select-option');

        let targetValue = state.currentProjectId ? 'p_' + state.currentProjectId :
            (state.currentGroupId !== 'all' ? state.currentGroupId : '');

        if (targetValue) {
            const targetOption = Array.from(options).find(opt => opt.dataset.value === targetValue);
            if (targetOption) {
                trigger.innerHTML = targetOption.innerHTML;
                trigger.dataset.value = targetOption.dataset.value;
                options.forEach(o => o.classList.remove('selected'));
                targetOption.classList.add('selected');

                const nativeSelect = document.getElementById('categorySelect');
                if (nativeSelect) nativeSelect.value = targetValue;
            }
        }
    }
    openModal('addTodoModal');
    setTimeout(() => {
        document.getElementById('todoInput').focus();
    }, 100);
};

function createTodoItem(t, index) {
            const li = document.createElement('li');
            li.className = `todo-item ${t.completed ? 'completed' : ''} ${t.projectId ? 'project-task' : ''} fade-in`;
            li.style.setProperty('--group-color', t.projectId ? t.projectColor : t.groupColor);
            li.style.animationDelay = `${index * 0.03}s`;

            li.draggable = true;
            li.ondragstart = (e) => onTodoDragStart(e, t.id);
            li.ondragend = (e) => onTodoDragEnd(e);
            li.ondragover = (e) => onTodoDragOver(e, t.id);
            li.ondragleave = (e) => onTodoDragLeave(e);
            li.ondrop = (e) => onTodoDrop(e, t.id);

            const pLabel = pMap[t.priority] || '中';
            const dateDisplay = t.date ? t.date.substring(5) : '无日期';

            let timeRangeHtml = '';
            if (t.startTime || t.endTime) {
                timeRangeHtml = `<div class="todo-time-range"><i class="far fa-clock"></i> ${t.startTime || '--:--'} - ${t.endTime || '--:--'}</div>`;
            }

            let subtasksHtml = '';
            if (t.subtasks && t.subtasks.length > 0) {
                const completedSubtasks = t.subtasks.filter(st => st.completed).length;
                const hasManualSetting = state.expandedSubtasks[t.id] !== undefined;
                const allSubtasksCompleted = t.subtasks.every(st => st.completed);
                const isExpanded = hasManualSetting ? state.expandedSubtasks[t.id] : !allSubtasksCompleted;
                const expandIcon = isExpanded ? 'fa-chevron-down' : 'fa-chevron-right';
                const subtaskListDisplay = isExpanded ? 'flex' : 'none';

                subtasksHtml = `
                    <div class="subtasks-section">
                        <div class="subtasks-header" style="cursor: pointer;" onclick="toggleSubtasksExpand(${t.id})">
                            <span>
                                <i class="fas ${expandIcon}" id="expand-icon-${t.id}" style="margin-right: 5px; transition: transform 0.2s;"></i>
                                <i class="fas fa-tasks"></i> 子任务 (${completedSubtasks}/${t.subtasks.length})
                            </span>
                            <button class="add-subtask-btn" onclick="event.stopPropagation(); toggleSubtaskInput(${t.id})"><i class="fas fa-plus"></i> 添加</button>
                        </div>
                        <ul class="subtask-list slide-in" id="subtask-list-${t.id}" style="display: ${subtaskListDisplay};">
                            ${t.subtasks.map(st => `
                                <li class="subtask-item ${st.completed ? 'completed' : ''}" data-subtask-id="${st.id}">
                                    <input type="checkbox" class="subtask-checkbox" ${st.completed ? 'checked' : ''} onchange="toggleSubtask(${t.id}, ${st.id})">
                                    <span class="subtask-text" onclick="startEditSubtask(${t.id}, ${st.id})" style="cursor: pointer; flex: 1;">${escapeHtml(st.text)}</span>
                                    <button class="subtask-edit" onclick="startEditSubtask(${t.id}, ${st.id})" style="margin-right: 5px;"><i class="fas fa-edit"></i></button>
                                    <button class="subtask-delete" onclick="deleteSubtask(${t.id}, ${st.id})"><i class="fas fa-times"></i></button>
                                </li>
                            `).join('')}
                        </ul>
                        <div class="add-subtask-input" id="subtask-input-${t.id}" style="display: ${isExpanded ? 'flex' : 'none'};">
                            <input type="text" placeholder="子任务内容..." id="subtask-text-${t.id}" onkeypress="if(event.key==='Enter') addSubtask(${t.id})">
                            <button onclick="addSubtask(${t.id})"><i class="fas fa-plus"></i></button>
                        </div>
                    </div>
                `;
            } else {
                subtasksHtml = `
                    <div class="subtasks-section">
                        <div class="subtasks-header">
                            <span><i class="fas fa-tasks"></i> 子任务</span>
                            <button class="add-subtask-btn" onclick="toggleSubtaskInput(${t.id})"><i class="fas fa-plus"></i> 添加</button>
                        </div>
                        <ul class="subtask-list" id="subtask-list-${t.id}"></ul>
                        <div class="add-subtask-input" id="subtask-input-${t.id}">
                            <input type="text" placeholder="子任务内容..." id="subtask-text-${t.id}" onkeypress="if(event.key==='Enter') addSubtask(${t.id})">
                            <button onclick="addSubtask(${t.id})"><i class="fas fa-plus"></i></button>
                        </div>
                    </div>
                `;
            }

            const batchCheckboxHtml = state.batchMode ? `
                <input type="checkbox" id="batch-checkbox-${t.id}" ${state.selectedTodos.has(String(t.id)) ? 'checked' : ''}
                       onclick="event.stopPropagation(); toggleTodoSelection(${t.id})"
                       style="width: 20px; height: 20px; cursor: pointer; margin-right: 10px;">
            ` : '';

            li.innerHTML = `
                <div class="todo-main">
                    ${batchCheckboxHtml}
                    <label class="checkbox"><input type="checkbox" ${t.completed ? 'checked' : ''} onchange="event.stopPropagation(); toggleTodo(${t.id})"><span class="checkmark"></span></label>
                    <div class="todo-content" style="flex:1">
                        <div class="todo-text">${t.text}</div>
                        <div class="todo-attributes">
                            <span class="attribute-badge" style="color:var(--text-secondary); border-color:var(--border-color); background:var(--bg-color);"><i class="far fa-calendar"></i> ${dateDisplay}</span>
                            ${timeRangeHtml ? `<span class="attribute-badge" style="color:var(--accent-color); border-color:var(--accent-color);"><i class="far fa-clock"></i> ${t.startTime || '--'} - ${t.endTime || '--'}</span>` : ''}
                            ${t.repeat && t.repeat !== 'none' ? `<span class="attribute-badge" style="color:var(--warning-color); border-color:var(--warning-color);"><i class="fas fa-redo"></i> ${getRepeatLabel(t.repeat)}</span>` : ''}
                            <span class="attribute-badge priority-${t.priority}">${pLabel}优先级</span>
                            ${t.projectId
                    ? `<span class="attribute-badge" style="color:${t.projectColor}; border-color:${t.projectColor};"><i class="fas fa-project-diagram"></i> ${t.projectName}</span>`
                    : `<span class="attribute-badge" style="color:${t.groupColor}; border-color:${t.groupColor};">${t.groupName}</span>`
                }
                        </div>
                    </div>
                </div>
                ${t.notes ? `<div class="todo-notes">${t.notes}</div>` : ''}
                ${subtasksHtml}
                <div class="todo-actions">
                    <i class="fas fa-grip-vertical action-icon drag-handle" title="拖拽排序" style="cursor: grab; color: var(--text-secondary);"></i>
                    <i class="fas fa-archive action-icon" onclick="archiveTodo(${t.id})" title="归档任务" style="color: var(--warning-color);"></i>
                    <i class="fas fa-pen action-icon" onclick="openEditTask(${t.id})"></i>
                    <i class="fas fa-trash action-icon" onclick="deleteTodo(${t.id})" style="color:var(--danger-color)"></i>
                </div>
            `;

            return li;
        }

function renderTodos() {
    // 根据视图模式渲染不同的布局
    if (state.todoViewMode === 'kanban') {
        document.getElementById('todoList').style.display = 'none';
        document.getElementById('kanbanView').style.display = 'block';
        document.getElementById('connectionView').style.display = 'none';
        // 同步按钮状态
        document.getElementById('todoViewList').classList.remove('active');
        document.getElementById('todoViewKanban').classList.add('active');
        document.getElementById('todoViewConnection').classList.remove('active');
        renderKanban();
        return;
    } else if (state.todoViewMode === 'connection') {
        document.getElementById('todoList').style.display = 'none';
        document.getElementById('kanbanView').style.display = 'none';
        document.getElementById('connectionView').style.display = 'block';
        document.getElementById('todoViewList').classList.remove('active');
        document.getElementById('todoViewKanban').classList.remove('active');
        document.getElementById('todoViewConnection').classList.add('active');
        renderConnectionView();
        return;
    } else {
        document.getElementById('todoList').style.display = 'flex';
        document.getElementById('kanbanView').style.display = 'none';
        document.getElementById('connectionView').style.display = 'none';
        // 同步按钮状态
        document.getElementById('todoViewList').classList.add('active');
        document.getElementById('todoViewKanban').classList.remove('active');
        document.getElementById('todoViewConnection').classList.remove('active');
    }

    const l = document.getElementById('todoList');
    l.innerHTML = '';

    let list = state.todos;

    // 项目视图：显示该项目的所有任务
    if (state.currentProjectId) {
        list = list.filter(t => String(t.projectId) === String(state.currentProjectId));
    } else if (state.currentGroupId && state.currentGroupId !== 'all') {
        // 分组视图：只显示该分组且不属于项目的任务
        list = list.filter(t => t.groupId === state.currentGroupId && !t.projectId);
    } else {
        // "全部任务"：只显示不属于项目的任务
        list = list.filter(t => !t.projectId);
    }

    if (state.filter === 'active') list = list.filter(t => !t.completed);
    if (state.filter === 'completed') list = list.filter(t => t.completed);
    if (state.filter === 'overdue') {
        const todayStr = new Date().toISOString().split('T')[0];
        list = list.filter(t => !t.completed && t.date && t.date < todayStr);
    }

    // "今日"视图：按分组/项目折叠显示
    if (state.filter === 'today') {
        const todayStr = new Date().toISOString().split('T')[0];
        const allTodos = state.todos;

        const todayTasks = allTodos.filter(t => t.date === todayStr);
        const overdueTasks = allTodos.filter(t => !t.completed && t.date && t.date < todayStr);

        const pOrder = { high: 0, medium: 1, low: 2 };
        const sortFn = (a, b) => {
            const pa = pOrder[a.priority] ?? 1;
            const pb = pOrder[b.priority] ?? 1;
            if (pa !== pb) return pa - pb;
            return (a.startTime || '').localeCompare(b.startTime || '');
        };

        function buildGroupBanners(tasks, sectionClass) {
            if (tasks.length === 0) return;
            // 按分组/项目归类
            const groupMap = new Map();
            tasks.forEach(t => {
                const key = t.projectId ? `p:${t.projectId}` : `g:${t.groupId || 'none'}`;
                const label = t.projectId
                    ? (t.projectName || '未命名项目')
                    : (t.groupName || '未分组');
                const color = t.projectId
                    ? (t.projectColor || '#8b5cf6')
                    : (t.groupColor || '#3b82f6');
                const icon = t.projectId ? 'fa-project-diagram' : 'fa-folder';
                if (!groupMap.has(key)) {
                    groupMap.set(key, { label, color, icon, isProject: !!t.projectId, tasks: [] });
                }
                groupMap.get(key).tasks.push(t);
            });
            // 按未完成数排序
            const groups = [...groupMap.values()].sort((a, b) => {
                const ua = a.tasks.filter(t => !t.completed).length;
                const ub = b.tasks.filter(t => !t.completed).length;
                return ub - ua;
            });
            groups.forEach(g => {
                g.tasks.sort(sortFn);
                const pending = g.tasks.filter(t => !t.completed).length;
                const banner = document.createElement('div');
                banner.className = 'today-group-banner' + (pending > 0 ? ' expanded' : '');
                banner.innerHTML = `
                    <div class="today-group-banner-header">
                        <div class="today-group-color" style="background:${g.color}"></div>
                        <i class="fas ${g.icon}" style="color:${g.color};font-size:0.85rem;"></i>
                        <span>${g.label}</span>
                        <span class="group-task-count">${g.tasks.length} 项${pending > 0 ? ` · ${pending} 待办` : ''}</span>
                        <i class="fas fa-chevron-right expand-arrow"></i>
                    </div>
                    <div class="today-group-banner-body"></div>`;
                banner.querySelector('.today-group-banner-header').onclick = () => {
                    banner.classList.toggle('expanded');
                };
                const body = banner.querySelector('.today-group-banner-body');
                g.tasks.forEach((t, i) => body.appendChild(createTodoItem(t, i)));
                l.appendChild(banner);
            });
        }

        const total = todayTasks.length + overdueTasks.length;

        if (todayTasks.length > 0) {
            const h1 = document.createElement('div');
            h1.className = 'today-section-header';
            h1.innerHTML = `<i class="fas fa-calendar-day" style="color:var(--warning-color);"></i> 今日到期 <span class="today-count">${todayTasks.length}</span>`;
            l.appendChild(h1);
            buildGroupBanners(todayTasks);
        }

        if (overdueTasks.length > 0) {
            const h2 = document.createElement('div');
            h2.className = 'today-section-header overdue';
            h2.innerHTML = `<i class="fas fa-exclamation-triangle"></i> 已超期 <span class="today-count">${overdueTasks.length}</span>`;
            l.appendChild(h2);
            buildGroupBanners(overdueTasks);
        }

        if (total === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.style.cssText = 'text-align: center; padding: 40px 20px; color: var(--text-secondary);';
            emptyDiv.innerHTML = `
                <i class="fas fa-check-circle" style="font-size: 2.5rem; opacity: 0.3; margin-bottom: 15px; display: block;"></i>
                <div style="font-size: 1rem; font-weight: 700; margin-bottom: 8px;">今日无到期任务</div>
                <div style="font-size: 0.85rem;">也没有超期任务，状态良好</div>`;
            l.appendChild(emptyDiv);
        }

        const dpSection = document.getElementById('dailyPlanSection');
        if (dpSection) {
            dpSection.style.display = 'block';
            renderDailyPlans();
        }
        updateStats();
        renderGroups();
        return;
    }

    // 新增：搜索过滤
    if (state.searchQuery) {
        list = list.filter(t =>
            t.text.toLowerCase().includes(state.searchQuery) ||
            (t.notes && t.notes.toLowerCase().includes(state.searchQuery)) ||
            (t.groupName && t.groupName.toLowerCase().includes(state.searchQuery)) ||
            (t.projectName && t.projectName.toLowerCase().includes(state.searchQuery))
        );
    }

    // DDL排序
    if (state.sortByDDL === 'time') {
        // 纯按截止日期排序
        list.sort((a, b) => {
            const da = a.date ? new Date(a.date) : new Date('9999-12-31');
            const db = b.date ? new Date(b.date) : new Date('9999-12-31');
            return da - db;
        });
    } else if (state.sortByDDL === 'priority') {
        // 同优先级下按截止日期排序
        const pOrder = { high: 0, medium: 1, low: 2 };
        list.sort((a, b) => {
            const pa = pOrder[a.priority] ?? 1;
            const pb = pOrder[b.priority] ?? 1;
            if (pa !== pb) return pa - pb;
            const da = a.date ? new Date(a.date) : new Date('9999-12-31');
            const db = b.date ? new Date(b.date) : new Date('9999-12-31');
            return da - db;
        });
    } else {
        list.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    list.forEach((t, index) => {
        l.appendChild(createTodoItem(t, index));
    });

    // 空状态提示
    if (list.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.style.cssText = 'text-align: center; padding: 40px 20px; color: var(--text-secondary);';
        emptyDiv.innerHTML = `
            <i class="fas fa-inbox" style="font-size: 2.5rem; opacity: 0.3; margin-bottom: 15px; display: block;"></i>
            <div style="font-size: 1rem; font-weight: 700; margin-bottom: 8px;">暂无任务</div>
            <div style="font-size: 0.85rem;">点击右下角 + 进行添加</div>
        `;
        l.appendChild(emptyDiv);
    }

    // 今日筛选时显示每日计划区域
    const dpSection = document.getElementById('dailyPlanSection');
    if (dpSection) {
        dpSection.style.display = state.filter === 'today' ? 'block' : 'none';
        if (state.filter === 'today') renderDailyPlans();
    }
    updateStats();
    renderGroups();
}

window.setFilter = (type) => {
    state.filter = type;
    updateTodoFilterUI();
    renderTodos();
};

window.selectTodayFilter = () => {
    state.currentGroupId = 'all';
    state.currentProjectId = null;
    state.filter = 'today';
    updateTodoFilterUI();
    renderTodos();
    renderGroups();
    // 移动端：关闭侧边栏
    if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('mobileSidebarOverlay');
        if (sidebar) sidebar.classList.remove('mobile-open');
        if (overlay) overlay.classList.remove('active');
    }
};

window.selectOverdueFilter = () => { selectTodayFilter(); };

function highlightCurrentGroup() {
    if (state.currentGroupId === 'all') {
        const allTasksItem = document.querySelector('.group-item[onclick*="selectGroup(\'all\'"]');
        if (allTasksItem) allTasksItem.classList.add('active');
    } else {
        document.querySelectorAll('.group-item').forEach(el => {
            const onclick = el.getAttribute('onclick') || '';
            if (onclick.includes(`selectGroup('${state.currentGroupId}')`) ||
                onclick.includes(`selectGroup("${state.currentGroupId}")`)) {
                el.classList.add('active');
            }
        });
    }
}

function updateTodoFilterUI() {
    const isTodayView = state.filter === 'today';

    // 今日筛选时隐藏筛选按钮和视图切换按钮
    const filterBar = document.getElementById('todoFilterBar');
    if (filterBar) {
        filterBar.style.display = isTodayView ? 'none' : 'flex';
    }

    // 隐藏视图切换和清除按钮的父容器
    const viewTabsContainer = filterBar?.nextElementSibling;
    if (viewTabsContainer) {
        viewTabsContainer.style.display = isTodayView ? 'none' : 'flex';
    }

    const allBtn = document.getElementById('btnFilterAll');
    const activeBtn = document.getElementById('btnFilterActive');
    const completedBtn = document.getElementById('btnFilterCompleted');
    const todayBtn = document.getElementById('btnFilterToday');
    const sidebarTodayBtn = document.getElementById('btnSidebarToday');

    [allBtn, activeBtn, completedBtn, todayBtn].forEach(btn => {
        if (btn) {
            btn.style.background = 'transparent';
            btn.style.borderColor = 'transparent';
        }
    });

    // 清除侧边栏高亮
    document.querySelectorAll('.group-item').forEach(el => {
        el.classList.remove('active');
    });

    const filterBtnMap = { all: allBtn, active: activeBtn, completed: completedBtn };
    const activeFilterBtn = filterBtnMap[state.filter];
    if (activeFilterBtn) {
        activeFilterBtn.style.background = 'var(--accent-color)';
        highlightCurrentGroup();
    } else if (state.filter === 'today') {
        if (todayBtn) todayBtn.style.background = 'var(--warning-color)';
        if (sidebarTodayBtn) sidebarTodayBtn.classList.add('active');
    }
}

// DDL排序切换（两种模式）
window.setDDLSort = function (mode) {
    // 点击已激活的按钮则关闭
    state.sortByDDL = (state.sortByDDL === mode) ? 'off' : mode;
    const btnTime = document.getElementById('btnSortDDLTime');
    const btnPri = document.getElementById('btnSortDDLPriority');
    if (btnTime) {
        btnTime.style.background = state.sortByDDL === 'time' ? 'var(--accent-color)' : 'transparent';
        btnTime.style.color = state.sortByDDL === 'time' ? '#fff' : '';
    }
    if (btnPri) {
        btnPri.style.background = state.sortByDDL === 'priority' ? 'var(--accent-color)' : 'transparent';
        btnPri.style.color = state.sortByDDL === 'priority' ? '#fff' : '';
    }
    renderTodos();
};

window.toggleTodo = (id) => {
            const task = state.todos.find(t => sameEntityId(t.id, id));
            if (!task) return;

            // 检查子任务状态
            const hasIncompleteSubtasks = task.subtasks && task.subtasks.length > 0 &&
                !task.subtasks.every(st => st.completed);

            // 在日历页面点击含有未完成子任务的主任务，标记为完成并弹出详情页
            const isInCalendarView = state.view === 'calendar' && state.selectedDate;

            if (!task.completed && hasIncompleteSubtasks && isInCalendarView) {
                // 先标记为完成
                state.todos = state.todos.map(t => sameEntityId(t.id, id) ? { ...t, completed: true } : t);

                // 如果是重复任务，创建下一个实例
                if (task.repeat && task.repeat !== 'none') {
                    createNextRecurringTask(task);
                }

                save();
                renderTodos();
                if (state.selectedDate) renderCalendarDetail();
                // 然后弹出详情页
                setTimeout(() => openTaskDetailModal(id), 100);
                return;
            }

            // 其他情况正常切换完成状态
            const newCompletedState = !task.completed;
            state.todos = state.todos.map(t => sameEntityId(t.id, id) ? { ...t, completed: newCompletedState } : t);

            // 如果任务是重复任务且刚刚被标记为完成，创建下一个实例
            if (newCompletedState && task.repeat && task.repeat !== 'none') {
                createNextRecurringTask(task);
            }

            save();
            renderTodos();
            if (state.view === 'calendar' && state.selectedDate) renderCalendarDetail();
        };

// 获取重复类型标签
function getRepeatLabel(repeatType) {
    const labels = {
        'daily': '每天',
        'weekly': '每周',
        'monthly': '每月',
        'yearly': '每年'
    };
    return labels[repeatType] || repeatType;
}

// 创建下一个重复任务
function createNextRecurringTask(task) {
    // 检查是否已过结束日期
    if (task.repeatEndDate) {
        const endDate = new Date(task.repeatEndDate);
        const taskDate = new Date(task.date);
        if (taskDate >= endDate) {
            // 已到达结束日期，不再创建新任务
            return;
        }
    }

    // 计算下一个日期
    const nextDate = calculateNextDate(task.date, task.repeat);
    if (!nextDate) return;

    // 检查下一个日期是否超过结束日期
    if (task.repeatEndDate) {
        const endDate = new Date(task.repeatEndDate);
        if (nextDate > endDate) {
            return;
        }
    }

    // 创建新任务
    const newTask = {
        ...task,
        id: uniqueId(),
        date: nextDate.toISOString().split('T')[0],
        completed: false,
        // 重置子任务完成状态
        subtasks: task.subtasks ? task.subtasks.map(st => ({ ...st, completed: false })) : []
    };

    // 删除临时属性
    delete newTask.repeatEndDate;

    state.todos.push(newTask);
}

// 计算下一个重复日期
function calculateNextDate(currentDateStr, repeatType) {
    const currentDate = new Date(currentDateStr);
    let nextDate = new Date(currentDate);

    switch (repeatType) {
        case 'daily':
            nextDate.setDate(currentDate.getDate() + 1);
            break;
        case 'weekly':
            nextDate.setDate(currentDate.getDate() + 7);
            break;
        case 'monthly':
            nextDate.setMonth(currentDate.getMonth() + 1);
            break;
        case 'yearly':
            nextDate.setFullYear(currentDate.getFullYear() + 1);
            break;
        default:
            return null;
    }

    return nextDate;
}

window.deleteTodo = async (id) => {
            const confirmed = await showConfirm('删除任务', '确定要删除这个任务吗？', ['取消', '删除']);
            if (confirmed === 0) return;
            // 记录已删除的ID，用于云端同步
            const tombstone = entityTombstone('todo', id);
            if (!state.deletedIds.includes(tombstone)) {
                state.deletedIds.push(tombstone);
            }
            state.todos = state.todos.filter(t => !sameEntityId(t.id, id));
            save(); renderTodos();
        };

// 归档单个任务
window.archiveTodo = async (id) => {
            const task = state.todos.find(t => sameEntityId(t.id, id));
            if (!task) return;

            const confirmed = await showConfirm('归档任务', `确定要归档"${task.text}"吗？`, ['取消', '归档']);
            if (confirmed === 0) return;

            // 添加到归档列表
            const now = new Date().toISOString();
            task.archivedAt = now;
            task.updatedAt = now;
            state.archivedTodos.push(task);

            // 从主列表移除
            state.todos = state.todos.filter(t => !sameEntityId(t.id, id));

            save();
            renderTodos();
            renderGroups();
            renderStats();

            showSyncToast('任务已归档');
        };

// 查看任务详情（只读）
window.viewTodo = (id) => {
            const t = state.todos.find(x => sameEntityId(x.id, id));
            if (!t) return;

            const priorityLabels = { low: '低', medium: '中', high: '高' };
            const priorityColors = { low: 'var(--success-color)', medium: 'var(--warning-color)', high: 'var(--danger-color)' };

            // 构建详情内容
            let content = `
                <div style="margin-bottom: 20px;">
                    <div style="font-size: 0.8rem; text-transform: uppercase; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px;">任务内容</div>
                    <div style="font-size: 1.2rem; font-weight: 600; line-height: 1.6;">${t.text}</div>
                </div>
            `;

            if (t.notes) {
                content += `
                    <div style="margin-bottom: 20px;">
                        <div style="font-size: 0.8rem; text-transform: uppercase; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px;">备注</div>
                        <div style="background: var(--bg-color); padding: 15px; border-radius: var(--radius); border: 2px solid var(--border-color); line-height: 1.6;">${t.notes}</div>
                    </div>
                `;
            }

            content += `
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">
                    <div>
                        <div style="font-size: 0.8rem; text-transform: uppercase; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px;">日期</div>
                        <div style="font-size: 1rem; font-weight: 600;"><i class="far fa-calendar"></i> ${t.date || '未设置'}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.8rem; text-transform: uppercase; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px;">优先级</div>
                        <div style="font-size: 1rem; font-weight: 600; color: ${priorityColors[t.priority] || 'var(--text-primary)'};">
                            <i class="fas fa-flag"></i> ${priorityLabels[t.priority] || '中'}
                        </div>
                    </div>
                </div>
            `;

            if (t.startTime || t.endTime) {
                content += `
                    <div style="margin-bottom: 20px;">
                        <div style="font-size: 0.8rem; text-transform: uppercase; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px;">时间段</div>
                        <div style="font-size: 1rem; font-weight: 600;"><i class="far fa-clock"></i> ${t.startTime || '--:--'} - ${t.endTime || '--:--'}</div>
                    </div>
                `;
            }

            content += `
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">
                    <div>
                        <div style="font-size: 0.8rem; text-transform: uppercase; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px;">分组</div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="group-color" style="width: 12px; height: 12px; border-radius: 2px; border: 2px solid var(--border-color); background: ${t.groupColor}; flex-shrink: 0;"></span>
                            <span style="font-weight: 600;">${t.groupName || '默认'}</span>
                        </div>
                    </div>
            `;

            if (t.projectName) {
                content += `
                    <div>
                        <div style="font-size: 0.8rem; text-transform: uppercase; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px;">项目</div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="group-color" style="width: 12px; height: 12px; border-radius: 2px; border: 2px solid var(--border-color); background: ${t.projectColor}; flex-shrink: 0;"></span>
                            <span style="font-weight: 600;">${t.projectName}</span>
                        </div>
                    </div>
                `;
            }

            content += `</div>`;

            if (t.repeat && t.repeat !== 'none') {
                const repeatLabels = { daily: '每天', weekly: '每周', monthly: '每月', yearly: '每年' };
                content += `
                    <div style="margin-bottom: 20px;">
                        <div style="font-size: 0.8rem; text-transform: uppercase; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px;">重复</div>
                        <div style="font-size: 1rem; font-weight: 600;"><i class="fas fa-redo"></i> ${repeatLabels[t.repeat]}</div>
                        ${t.repeatEndDate ? `<div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 5px;">至 ${t.repeatEndDate}</div>` : ''}
                    </div>
                `;
            }

            if (t.subtasks && t.subtasks.length > 0) {
                const completedCount = t.subtasks.filter(st => st.completed).length;
                content += `
                    <div style="margin-bottom: 20px;">
                        <div style="font-size: 0.8rem; text-transform: uppercase; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px;">
                            <i class="fas fa-tasks"></i> 子任务 (${completedCount}/${t.subtasks.length})
                        </div>
                        <div style="background: var(--bg-color); padding: 15px; border-radius: var(--radius); border: 2px solid var(--border-color);">
                            ${t.subtasks.map(st => `
                                <div style="display: flex; align-items: center; gap: 10px; padding: 8px 0; ${st.completed ? 'opacity: 0.6;' : ''}">
                                    <i class="fas ${st.completed ? 'fa-check-circle' : 'fa-circle'}" style="color: ${st.completed ? 'var(--success-color)' : 'var(--text-secondary)'};"></i>
                                    <span style="${st.completed ? 'text-decoration: line-through;' : ''}">${st.text}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            document.getElementById('viewTodoContent').innerHTML = content;

            // 设置编辑按钮的点击事件
            document.getElementById('viewTodoEditBtn').onclick = () => {
                closeModal('viewTodoModal');
                openEditTask(id);
            };

            openModal('viewTodoModal');
        };

window.openEditTask = (id) => {
            const t = state.todos.find(x => sameEntityId(x.id, id));
            if (!t) return;
            state.editingId = id;
            document.getElementById('editInput').value = t.text;
            document.getElementById('editNotes').value = t.notes || '';
            document.getElementById('editTodoDate').value = t.date;
            setCustomSelectValue('editPriorityCustom', t.priority);
            document.getElementById('editStartTime').value = t.startTime || '';
            document.getElementById('editEndTime').value = t.endTime || '';

            // 设置重复选项
            const repeatValue = t.repeat || 'none';
            setCustomSelectValue('editRepeatCustom', repeatValue);
            document.getElementById('editRepeatEndDate').value = t.repeatEndDate || '';

            // 显示/隐藏重复结束日期
            const endDateContainer = document.getElementById('repeatEndDateContainer');
            if (repeatValue !== 'none') {
                endDateContainer.style.display = 'block';
            } else {
                endDateContainer.style.display = 'none';
            }

            // 更新编辑分类选择器
            updateEditCategorySelect();

            // 设置当前归属
            if (t.projectId) {
                setCustomSelectValue('editCategorySelectCustom', t.projectId);
            } else if (t.groupId) {
                setCustomSelectValue('editCategorySelectCustom', t.groupId);
            }

            openModal('editModal');
        };

// 更新编辑分类选择器（合并分组和项目）
function updateEditCategorySelect() {
    const categoryCustom = document.getElementById('editCategorySelectCustom');
    const categoryNative = document.getElementById('editCategorySelect');

    // 如果元素不存在，直接返回
    if (!categoryCustom || !categoryNative) return;

    const categoryOptions = categoryCustom.querySelector('.custom-select-options');
    const categoryTrigger = categoryCustom.querySelector('.custom-select-trigger');

    categoryOptions.innerHTML = '';
    categoryNative.innerHTML = '';

    // 1. 添加分组（如果有分组）
    if (state.groups.length > 0) {
        // 分组分界线
        const groupDivider = document.createElement('div');
        groupDivider.className = 'custom-select-divider';
        groupDivider.innerHTML = '分组';
        categoryOptions.appendChild(groupDivider);

        state.groups.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.setAttribute('data-type', 'group');
            opt.innerText = g.name;
            categoryNative.appendChild(opt);

            const optionDiv = document.createElement('div');
            optionDiv.className = 'custom-select-option';
            optionDiv.dataset.value = g.id;
            optionDiv.dataset.type = 'group';
            optionDiv.innerHTML = `<span style="display:flex;align-items:center;gap:8px;flex:1;"><span class="group-color" style="width:12px;height:12px;border-radius:2px;border:2px solid var(--border-color);background:${g.color};flex-shrink:0;"></span>${g.name}</span><span class="category-type-label group">分组</span>`;
            optionDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                categoryTrigger.innerHTML = `<span style="display:flex;align-items:center;gap:8px;"><span class="group-color" style="width:12px;height:12px;border-radius:2px;border:2px solid var(--border-color);background:${g.color};flex-shrink:0;"></span>${g.name}</span>`;
                categoryTrigger.dataset.value = g.id;
                categoryNative.value = g.id;
                categoryOptions.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
                optionDiv.classList.add('selected');
                categoryCustom.classList.remove('open');
            });
            categoryOptions.appendChild(optionDiv);
        });
    }

    // 2. 添加项目（如果有项目）
    if (state.projects.length > 0) {
        // 项目分界线
        const projectDivider = document.createElement('div');
        projectDivider.className = 'custom-select-divider';
        projectDivider.innerHTML = '项目';
        categoryOptions.appendChild(projectDivider);

        state.projects.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.setAttribute('data-type', 'project');
            opt.innerText = p.name;
            categoryNative.appendChild(opt);

            const optionDiv = document.createElement('div');
            optionDiv.className = 'custom-select-option';
            optionDiv.dataset.value = p.id;
            optionDiv.dataset.type = 'project';
            optionDiv.innerHTML = `<span style="display:flex;align-items:center;gap:8px;flex:1;"><i class="fas fa-project-diagram" style="color:${p.color};"></i>${p.name}</span><span class="category-type-label project">项目</span>`;
            optionDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                categoryTrigger.innerHTML = `<span style="display:flex;align-items:center;gap:8px;"><i class="fas fa-project-diagram" style="color:${p.color};"></i>${p.name}</span>`;
                categoryTrigger.dataset.value = p.id;
                categoryNative.value = p.id;
                categoryOptions.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
                optionDiv.classList.add('selected');
                categoryCustom.classList.remove('open');
            });
            categoryOptions.appendChild(optionDiv);
        });
    }

    // 初始化选择器
    initCustomSelect('editCategorySelectCustom');
}

window.saveEditTask = () => {
            if (!state.editingId) return;
            const text = document.getElementById('editInput').value.trim();
            if (!text) return;

            const categoryId = getCustomSelectValue('editCategorySelectCustom');
            const categoryNative = document.getElementById('editCategorySelect');
            const selectedOption = categoryNative ? categoryNative.querySelector(`option[value="${categoryId}"]`) : null;
            const categoryType = selectedOption ? selectedOption.getAttribute('data-type') : null;

            const priority = getCustomSelectValue('editPriorityCustom');
            const repeat = getCustomSelectValue('editRepeatCustom');
            const repeatEndDate = document.getElementById('editRepeatEndDate').value || null;

            // 项目和分组互斥
            let finalGroupId = null;
            let finalGroupName = null;
            let finalGroupColor = null;
            let finalProjectId = null;
            let finalProjectName = null;
            let finalProjectColor = null;

            if (categoryType === 'project' && categoryId) {
                const project = state.projects.find(p => sameEntityId(p.id, categoryId));
                if (project) {
                    finalProjectId = String(project.id);  // 转为字符串
                    finalProjectName = project.name;
                    finalProjectColor = project.color;
                }
            } else if (categoryType === 'group' && categoryId) {
                const group = state.groups.find(g => sameEntityId(g.id, categoryId));
                if (group) {
                    finalGroupId = group.id;
                    finalGroupName = group.name;
                    finalGroupColor = group.color;
                }
            } else {
                // 都没选，使用默认分组
                if (state.groups.length > 0) {
                    const defaultGroup = state.groups[0];
                    finalGroupId = defaultGroup.id;
                    finalGroupName = defaultGroup.name;
                    finalGroupColor = defaultGroup.color;
                }
            }

            state.todos = state.todos.map(t => sameEntityId(t.id, state.editingId) ? {
                ...t, text, notes: document.getElementById('editNotes').value.trim(),
                priority: priority,
                groupId: finalGroupId,
                groupName: finalGroupName,
                groupColor: finalGroupColor,
                date: document.getElementById('editTodoDate').value,
                startTime: document.getElementById('editStartTime').value || null,
                endTime: document.getElementById('editEndTime').value || null,
                repeat: repeat,
                repeatEndDate: repeatEndDate,
                projectId: finalProjectId,
                projectName: finalProjectName,
                projectColor: finalProjectColor
            } : t);
            save();
            closeModal('editModal');
            renderTodos();
            renderProjects(); // 更新项目统计
        };

window.clearCompleted = async () => {
            const confirmed = await showConfirm('清除已完成任务', '确定要清除所有已完成的任务吗？', ['取消', '清除']);
            if (confirmed === 0) return;
            state.todos.filter(t => t.completed).forEach(t => {
                const tombstone = entityTombstone('todo', t.id);
                if (!state.deletedIds.includes(tombstone)) state.deletedIds.push(tombstone);
            });
            state.todos = state.todos.filter(t => !t.completed);
            save(); renderTodos();
        };

// --- 子任务相关函数 ---
window.toggleSubtaskInput = (todoId) => {
    // 如果子任务栏是折叠状态，先展开
    if (state.expandedSubtasks[todoId] === false) {
        toggleSubtasksExpand(todoId);
    }

    const inputDiv = document.getElementById(`subtask-input-${todoId}`);
    inputDiv.classList.toggle('active');
    if (inputDiv.classList.contains('active')) {
        document.getElementById(`subtask-text-${todoId}`).focus();
    }
};

window.addSubtask = (todoId) => {
            const input = document.getElementById(`subtask-text-${todoId}`);
            const text = input.value.trim();
            if (!text) return;

            state.todos = state.todos.map(t => {
                if (sameEntityId(t.id, todoId)) {
                    const subtasks = t.subtasks || [];
                    return {
                        ...t,
                        subtasks: [...subtasks, { id: uniqueId(), text, completed: false }]
                    };
                }
                return t;
            });

            save();
            renderTodos();
        };

window.toggleSubtask = (todoId, subtaskId) => {
            state.todos = state.todos.map(t => {
                if (sameEntityId(t.id, todoId)) {
                    const updatedSubtasks = t.subtasks.map(st =>
                        sameEntityId(st.id, subtaskId) ? { ...st, completed: !st.completed } : st
                    );

                    return {
                        ...t,
                        subtasks: updatedSubtasks
                        // 不再自动标记主任务为完成，主任务完成状态独立管理
                    };
                }
                return t;
            });
            save();
            renderTodos();

            // 如果详情页打开着，更新详情页中的计数和子任务列表
            const modal = document.getElementById('taskDetailModal');
            if (modal.classList.contains('active')) {
                const task = state.todos.find(t => sameEntityId(t.id, todoId));
                if (task && task.subtasks && task.subtasks.length > 0) {
                    const completed = task.subtasks.filter(st => st.completed).length;
                    document.getElementById('detailSubtaskCount').innerText = `(${completed}/${task.subtasks.length})`;

                    // 更新子任务列表的显示
                    const subtaskList = document.getElementById('detailSubtaskList');
                    subtaskList.innerHTML = task.subtasks.map(st => `
                        <li class="subtask-item ${st.completed ? 'completed' : ''}">
                            <input type="checkbox" class="subtask-checkbox" ${st.completed ? 'checked' : ''} onchange="toggleSubtask(${task.id}, ${st.id});">
                            <span class="subtask-text">${escapeHtml(st.text)}</span>
                        </li>
                    `).join('');
                }
            }
        };

window.deleteSubtask = async (todoId, subtaskId) => {
            const result = await showConfirm('删除子任务', '确定要删除这个子任务吗？');
            if (result !== 1) return; // 1是第二个按钮（确定）

            state.todos = state.todos.map(t => {
                if (sameEntityId(t.id, todoId)) {
                    return {
                        ...t,
                        subtasks: t.subtasks.filter(st => !sameEntityId(st.id, subtaskId))
                    };
                }
                return t;
            });
            save();
            renderTodos();
        };

// 思维导图视图：添加子任务
window.mmAddSubtask = (todoId) => {
            const input = document.getElementById('mmSubtaskInput');
            const text = input.value.trim();
            if (!text) return;

            const todo = state.todos.find(t => sameEntityId(t.id, todoId));
            if (!todo) return;

            if (!todo.subtasks) todo.subtasks = [];
            todo.subtasks.push({
                id: uniqueId(),
                text: text,
                completed: false
            });

            save();
            renderMindmap();
            showTaskDetail(todo);
        };

// 开始编辑子任务
window.startEditSubtask = (todoId, subtaskId) => {
            const subtaskItem = document.querySelector(`li[data-subtask-id="${subtaskId}"]`);
            const subtaskText = subtaskItem.querySelector('.subtask-text');
            const currentText = subtaskText.textContent;

            // 创建编辑输入框
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentText;
            input.className = 'subtask-edit-input';
            input.style.cssText = 'flex: 1; padding: 4px 8px; border: 2px solid var(--accent-color); border-radius: var(--radius); font-size: 0.9rem;';

            // 替换文本为输入框
            subtaskText.style.display = 'none';
            subtaskItem.insertBefore(input, subtaskText.nextSibling);
            input.focus();
            input.select();

            // 保存编辑的函数
            const saveEdit = () => {
                const newText = input.value.trim();
                if (newText) {
                    state.todos = state.todos.map(t => {
                        if (sameEntityId(t.id, todoId)) {
                            return {
                                ...t,
                                subtasks: t.subtasks.map(st => {
                                    if (sameEntityId(st.id, subtaskId)) {
                                        return { ...st, text: newText };
                                    }
                                    return st;
                                })
                            };
                        }
                        return t;
                    });
                    save();
                    renderTodos();
                } else {
                    // 如果为空，恢复原样
                    input.remove();
                    subtaskText.style.display = '';
                }
            };

            // 按Enter保存，按Esc取消
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    saveEdit();
                } else if (e.key === 'Escape') {
                    input.remove();
                    subtaskText.style.display = '';
                }
            };

            // 失去焦点时自动保存
            input.onblur = () => {
                saveEdit();
            };
        };

function updateStats() {
    let list = state.todos;

    // 根据当前选择过滤任务
    if (state.currentProjectId) {
        // 项目视图：显示该项目的统计
        list = list.filter(t => String(t.projectId) === String(state.currentProjectId));
    } else if (state.currentGroupId && state.currentGroupId !== 'all') {
        // 分组视图：只显示该分组且不属于项目的任务
        list = list.filter(t => t.groupId === state.currentGroupId && !t.projectId);
    } else {
        // "全部任务"：只显示不属于项目的任务
        list = list.filter(t => !t.projectId);
    }

    const total = list.length;
    const completed = list.filter(t => t.completed).length;
    const active = total - completed;
    const rate = total === 0 ? 0 : Math.round((completed / total) * 100);

    animateValue("statTotal", parseInt(document.getElementById("statTotal").innerText) || 0, total, 500);
    animateValue("statActive", parseInt(document.getElementById("statActive").innerText) || 0, active, 500);
    document.getElementById("statRate").innerText = rate + "%";
}

// ========== 看板视图功能 ==========
// 切换待办视图模式（列表/看板）
window.setTodoViewMode = function (mode) {
    state.todoViewMode = mode;
    localStorage.setItem('todoViewMode', mode);

    // 更新按钮状态
    document.getElementById('todoViewList').classList.toggle('active', mode === 'list');
    document.getElementById('todoViewKanban').classList.toggle('active', mode === 'kanban');
    document.getElementById('todoViewConnection').classList.toggle('active', mode === 'connection');

    // 重新渲染
    renderTodos();
};

// 渲染看板视图
function renderKanban() {
    // 获取并过滤任务列表
    let list = state.todos;

    // 根据当前视图过滤：项目视图或分组视图
    if (state.currentProjectId) {
        list = list.filter(t => String(t.projectId) === String(state.currentProjectId));
    } else if (state.currentGroupId !== 'all') {
        list = list.filter(t => t.groupId === state.currentGroupId && !t.projectId);
    } else {
        // "全部任务"：只显示不属于项目的任务
        list = list.filter(t => !t.projectId);
    }

    // 搜索过滤
    if (state.searchQuery) {
        list = list.filter(t =>
            t.text.toLowerCase().includes(state.searchQuery) ||
            (t.notes && t.notes.toLowerCase().includes(state.searchQuery)) ||
            (t.groupName && t.groupName.toLowerCase().includes(state.searchQuery)) ||
            (t.projectName && t.projectName.toLowerCase().includes(state.searchQuery))
        );
    }

    // 根据状态分组（注意：看板视图中不使用filter过滤器）
    const todoTasks = list.filter(t => !t.completed && !t.kanbanStatus);
    const inProgressTasks = list.filter(t => !t.completed && t.kanbanStatus === 'in-progress');
    const completedTasks = list.filter(t => t.completed);

    // 渲染各列
    renderKanbanColumn('kanbanTodoContent', 'kanbanTodoCount', todoTasks, 'todo');
    renderKanbanColumn('kanbanInProgressContent', 'kanbanInProgressCount', inProgressTasks, 'in-progress');
    renderKanbanColumn('kanbanCompletedContent', 'kanbanCompletedCount', completedTasks, 'completed');

    // 更新统计
    updateStats();
}

// 渲染看板列
function renderKanbanColumn(contentId, countId, tasks, status) {
    const container = document.getElementById(contentId);
    const countEl = document.getElementById(countId);

    container.innerHTML = '';
    countEl.textContent = tasks.length;

    tasks.forEach((t, index) => {
        const card = document.createElement('div');
        card.className = 'kanban-card slide-in';
        // 项目任务使用项目颜色，分组任务使用分组颜色
        const cardColor = t.projectId ? t.projectColor : t.groupColor;
        card.style.setProperty('--group-color', cardColor);
        card.style.borderLeftColor = cardColor;
        card.style.animationDelay = `${index * 0.05}s`;
        card.draggable = true;
        card.dataset.todoId = t.id;

        // 拖拽事件
        card.ondragstart = (e) => onKanbanCardDragStart(e, t.id);
        card.ondragend = (e) => onKanbanCardDragEnd(e);

        const pLabel = pMap[t.priority] || '中';
        const dateDisplay = t.date ? t.date.substring(5) : '无日期';

        // 根据是否项目任务显示不同的标签
        const categoryBadge = t.projectId
            ? `<span class="attribute-badge" style="color:${t.projectColor}; border-color:${t.projectColor};"><i class="fas fa-project-diagram"></i> ${t.projectName}</span>`
            : `<span class="attribute-badge" style="color:${t.groupColor}; border-color:${t.groupColor};">${t.groupName}</span>`;

        // 构建元数据HTML
        let metaHtml = `
            <span class="attribute-badge" style="background:var(--bg-color);"><i class="far fa-calendar"></i> ${dateDisplay}</span>
            <span class="attribute-badge priority-${t.priority}">${pLabel}优先级</span>
            ${categoryBadge}
        `;

        if (t.startTime || t.endTime) {
            metaHtml += `<span class="attribute-badge" style="color:var(--accent-color); border-color:var(--accent-color);"><i class="far fa-clock"></i> ${t.startTime || '--'} - ${t.endTime || '--'}</span>`;
        }

        if (t.subtasks && t.subtasks.length > 0) {
            const completedSubtasks = t.subtasks.filter(st => st.completed).length;
            metaHtml += `<span class="attribute-badge"><i class="fas fa-tasks"></i> ${completedSubtasks}/${t.subtasks.length}</span>`;
        }

        card.innerHTML = `
            <div class="kanban-card-title">${escapeHtml(t.text)}</div>
            <div class="kanban-card-meta">${metaHtml}</div>
            ${t.notes ? `<div style="margin-top:8px; font-size:0.85rem; color:var(--text-secondary); line-height:1.4;">${escapeHtml(t.notes).substring(0, 60)}${t.notes.length > 60 ? '...' : ''}</div>` : ''}
            <div class="kanban-card-actions">
                <button class="btn" onclick="event.stopPropagation(); openEditTask(${t.id});" style="padding:6px 12px; font-size:0.8rem;"><i class="fas fa-pen"></i></button>
                <button class="btn" onclick="event.stopPropagation(); deleteTodo(${t.id});" style="padding:6px 12px; font-size:0.8rem; color:var(--danger-color); border-color:var(--danger-color);"><i class="fas fa-trash"></i></button>
            </div>
        `;

        // 点击卡片打开详情
        card.onclick = (e) => {
            if (!e.target.classList.contains('btn') && !e.target.closest('.btn')) {
                openTaskDetailModal(t.id);
            }
        };

        container.appendChild(card);
    });

    // 设置拖拽目标区域
    container.ondragover = (e) => onKanbanColumnDragOver(e, status);
    container.ondragleave = (e) => onKanbanColumnDragLeave(e);
    container.ondrop = (e) => onKanbanColumnDrop(e, status);
}

// 看板卡片拖拽事件处理
let draggedKanbanCardId = null;

function onKanbanCardDragStart(e, todoId) {
    draggedKanbanCardId = todoId;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', todoId);
}

function onKanbanCardDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedKanbanCardId = null;

    // 移除所有拖拽样式
    document.querySelectorAll('.kanban-column-content').forEach(col => {
        col.style.background = '';
        col.style.borderColor = '';
    });
}

function onKanbanColumnDragOver(e, status) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const container = e.currentTarget;
    container.style.background = 'var(--accent-color)';
    container.style.opacity = '0.3';
}

function onKanbanColumnDragLeave(e) {
    if (e.target === e.currentTarget) {
        e.currentTarget.style.background = '';
        e.currentTarget.style.opacity = '';
    }
}

function onKanbanColumnDrop(e, status) {
            e.preventDefault();
            e.currentTarget.style.background = '';
            e.currentTarget.style.opacity = '';

            if (!draggedKanbanCardId) return;

            // 更新任务状态
            state.todos = state.todos.map(t => {
                if (sameEntityId(t.id, draggedKanbanCardId)) {
                    if (status === 'completed') {
                        return { ...t, completed: true, kanbanStatus: null };
                    } else if (status === 'todo') {
                        return { ...t, completed: false, kanbanStatus: null };
                    } else if (status === 'in-progress') {
                        return { ...t, completed: false, kanbanStatus: 'in-progress' };
                    }
                }
                return t;
            });

            save();
            renderKanban();
            showSyncToast('已移动任务');
        }

// ========== 连线视图 ==========
function renderConnectionView() {
            const canvas = document.getElementById('connectionCanvas');
            const svg = document.getElementById('connectionSvg');
            canvas.innerHTML = '';
            svg.innerHTML = '';

            // 获取并过滤任务
            let list = state.todos.filter(t => !t.projectId);
            if (state.currentGroupId && state.currentGroupId !== 'all') {
                list = list.filter(t => t.groupId === state.currentGroupId);
            }
            if (state.filter === 'active') list = list.filter(t => !t.completed);
            if (state.filter === 'completed') list = list.filter(t => t.completed);
            if (state.sortByDDL === 'time') {
                list.sort((a, b) => {
                    const da = a.date ? new Date(a.date) : new Date('9999-12-31');
                    const db = b.date ? new Date(b.date) : new Date('9999-12-31');
                    return da - db;
                });
            } else if (state.sortByDDL === 'priority') {
                const pOrder = { high: 0, medium: 1, low: 2 };
                list.sort((a, b) => {
                    const pa = pOrder[a.priority] ?? 1;
                    const pb = pOrder[b.priority] ?? 1;
                    if (pa !== pb) return pa - pb;
                    const da = a.date ? new Date(a.date) : new Date('9999-12-31');
                    const db = b.date ? new Date(b.date) : new Date('9999-12-31');
                    return da - db;
                });
            }

            // 按分组聚合
            const groupMap = {};
            list.forEach(t => {
                const gId = t.groupId || 'default';
                if (!groupMap[gId]) groupMap[gId] = [];
                groupMap[gId].push(t);
            });

            const groupIds = Object.keys(groupMap);
            if (groupIds.length === 0) {
                canvas.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-secondary);font-size:1.1rem;"><i class="fas fa-project-diagram" style="font-size:2rem;margin-bottom:15px;display:block;opacity:0.3;"></i>当前无任务可展示</div>';
                return;
            }

            // 布局参数
            const GROUP_W = 160, GROUP_H = 50;
            const TASK_W = 220, TASK_H = 40;
            const H_GAP = 200, V_GAP = 12;
            const START_X = 40, TASK_X = START_X + GROUP_W + H_GAP;
            let currentY = 30;
            const connections = [];

            groupIds.forEach(gId => {
                const group = state.groups.find(g => sameEntityId(g.id, gId)) || { id: gId, name: '默认', color: '#3b82f6' };
                const tasks = groupMap[gId];
                const groupCenterY = currentY + Math.max(tasks.length * (TASK_H + V_GAP) - V_GAP, GROUP_H) / 2 - GROUP_H / 2;

                // 分组节点
                const gNode = document.createElement('div');
                gNode.style.cssText = `position:absolute;left:${START_X}px;top:${groupCenterY}px;width:${GROUP_W}px;height:${GROUP_H}px;background:var(--card-bg);border:3px solid ${group.color};border-radius:var(--radius);display:flex;align-items:center;justify-content:center;gap:8px;font-weight:800;font-size:0.85rem;text-transform:uppercase;cursor:pointer;transition:all 0.2s;`;
                gNode.innerHTML = `<div style="width:10px;height:10px;border-radius:50%;background:${group.color};"></div>${group.name} <span style="color:var(--text-secondary);font-size:0.7rem;">(${tasks.length})</span>`;
                gNode.onmouseenter = () => { gNode.style.transform = 'scale(1.03)'; gNode.style.boxShadow = `0 4px 16px ${group.color}33`; };
                gNode.onmouseleave = () => { gNode.style.transform = ''; gNode.style.boxShadow = ''; };
                canvas.appendChild(gNode);

                // 任务节点
                tasks.forEach((task, ti) => {
                    const taskY = currentY + ti * (TASK_H + V_GAP);
                    const pColor = { high: 'var(--danger-color)', medium: 'var(--warning-color)', low: 'var(--success-color)' }[task.priority] || 'var(--warning-color)';
                    const tNode = document.createElement('div');
                    tNode.style.cssText = `position:absolute;left:${TASK_X}px;top:${taskY}px;width:${TASK_W}px;min-height:${TASK_H}px;background:var(--card-bg);border:2px solid var(--border-color);border-left:4px solid ${pColor};border-radius:var(--radius);display:flex;align-items:center;gap:8px;padding:6px 10px;font-size:0.8rem;cursor:default;transition:all 0.2s;${task.completed ? 'opacity:0.5;' : ''}`;
                    tNode.innerHTML = `
                        <input type="checkbox" ${task.completed ? 'checked' : ''} onclick="toggleTodo(${task.id});setTimeout(()=>renderConnectionView(),100);" style="cursor:pointer;width:16px;height:16px;">
                        <div style="flex:1;overflow:hidden;">
                            <div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${task.completed ? 'text-decoration:line-through;' : ''}">${task.text}</div>
                            <div style="font-size:0.7rem;color:var(--text-secondary);margin-top:2px;">${task.date ? task.date.substring(5) : ''} ${task.startTime || ''}</div>
                        </div>`;
                    tNode.onmouseenter = () => { tNode.style.borderColor = pColor; tNode.style.transform = 'translateX(3px)'; };
                    tNode.onmouseleave = () => { tNode.style.borderColor = 'var(--border-color)'; tNode.style.transform = ''; };
                    canvas.appendChild(tNode);

                    // 连线数据
                    connections.push({
                        fromX: START_X + GROUP_W, fromY: groupCenterY + GROUP_H / 2,
                        toX: TASK_X, toY: taskY + TASK_H / 2,
                        color: group.color
                    });
                });

                currentY += Math.max(tasks.length * (TASK_H + V_GAP), GROUP_H + V_GAP) + 30;
            });

            // 设置画布高度
            const totalH = currentY + 30;
            canvas.style.height = totalH + 'px';
            svg.style.height = totalH + 'px';
            const container = document.getElementById('connectionView');
            container.style.minHeight = totalH + 'px';

            // 绘制贝塞尔曲线
            connections.forEach(c => {
                const midX = (c.fromX + c.toX) / 2;
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', `M ${c.fromX} ${c.fromY} C ${midX} ${c.fromY}, ${midX} ${c.toY}, ${c.toX} ${c.toY}`);
                path.setAttribute('stroke', c.color);
                path.setAttribute('stroke-width', '2');
                path.setAttribute('fill', 'none');
                path.setAttribute('stroke-opacity', '0.5');
                svg.appendChild(path);
            });
        }

document.getElementById('addBtn').onclick = addTodo;
document.getElementById('todoInput').onkeypress = e => { if (e.key === 'Enter') addTodo(); };

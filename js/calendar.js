// 日历视图


function renderCalendar() {
    const y = state.calendarDate.getFullYear();
    const m = state.calendarDate.getMonth();
    document.getElementById('calendarTitle').innerText = `${y}年 ${m + 1}月`;
    const g = document.getElementById('calendarGrid');
    g.innerHTML = '';

    const fd = new Date(y, m, 1).getDay();
    const dim = new Date(y, m + 1, 0).getDate();

    const weeks = ['日', '一', '二', '三', '四', '五', '六'];
    weeks.forEach(w => {
        const d = document.createElement('div');
        d.style.textAlign = 'center'; d.style.fontWeight = '800'; d.style.padding = '10px'; d.style.textTransform = 'uppercase';
        d.innerText = w;
        g.appendChild(d);
    });

    for (let i = 0; i < fd; i++) g.appendChild(document.createElement('div'));
    for (let i = 1; i <= dim; i++) {
        const dStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const groupTasks = state.todos.filter(t => t.date === dStr && !t.projectId);
        const projectTasks = state.todos.filter(t => t.date === dStr && t.projectId);

        const div = document.createElement('div');
        const isSelected = state.selectedDate === dStr;
        div.className = `calendar-day ${isSelected ? 'selected' : ''}`;

        let dotsHtml = '';

        // 每个分组任务显示一个圆点
        groupTasks.slice(0, 8).forEach(t => {
            dotsHtml += `<div class="day-task-dot" style="background:${t.groupColor}"></div>`;
        });

        // 每个项目显示一个方块（去重）
        const uniqueProjects = {};
        projectTasks.forEach(t => {
            if (!uniqueProjects[t.projectId]) {
                uniqueProjects[t.projectId] = t.projectColor;
            }
        });
        Object.values(uniqueProjects).slice(0, 3).forEach(color => {
            dotsHtml += `<div class="day-task-project" style="background:${color}"></div>`;
        });

        div.innerHTML = `<div class="day-number">${i}</div>` + dotsHtml;
        div.onclick = () => selectCalendarDay(dStr);
        g.appendChild(div);
    }
}

window.changeMonth = (d) => {
    state.calendarDate.setMonth(state.calendarDate.getMonth() + d);
    renderCalendar();
    if (state.selectedDate) {
        const sY = parseInt(state.selectedDate.split('-')[0]);
        const sM = parseInt(state.selectedDate.split('-')[1]) - 1;
        if (sY === state.calendarDate.getFullYear() && sM === state.calendarDate.getMonth()) {
            renderCalendarDetail();
        } else {
            state.selectedDate = null;
            document.getElementById('calendarDetailPanel').style.display = 'none';
        }
    }
};

window.selectCalendarDay = (dateStr) => {
    if (state.selectedDate === dateStr) {
        state.selectedDate = null;
        document.getElementById('calendarDetailPanel').style.display = 'none';
    } else {
        state.selectedDate = dateStr;
        document.getElementById('calendarDetailPanel').style.display = 'block';
        renderCalendarDetail();
        renderMilkteaDayRecords(dateStr);
    }
    renderCalendar();
};

function renderCalendarDetail() {
    if (!state.selectedDate) return;
    const [y, m, d] = state.selectedDate.split('-');
    document.getElementById('calendarDetailDate').innerText = `${y}年${m}月${d}日`;

    const l = document.getElementById('calendarDetailList');
    l.innerHTML = '';

    // 分别获取分组任务和项目任务
    const groupTasks = state.todos.filter(t => t.date === state.selectedDate && !t.projectId);
    const projectTasks = state.todos.filter(t => t.date === state.selectedDate && t.projectId);

    // 按项目分组项目任务
    const projectsMap = {};
    projectTasks.forEach(t => {
        if (!projectsMap[t.projectId]) {
            projectsMap[t.projectId] = {
                name: t.projectName,
                color: t.projectColor,
                tasks: []
            };
        }
        projectsMap[t.projectId].tasks.push(t);
    });

    // 先显示项目卡片
    Object.values(projectsMap).forEach(project => {
        const projectCard = document.createElement('div');
        projectCard.className = 'project-card';
        projectCard.style.cssText = `
            background: var(--card-bg);
            border: 3px solid ${project.color};
            border-radius: var(--radius);
            padding: 15px;
            margin-bottom: 15px;
            cursor: pointer;
            transition: all 0.2s;
        `;
        projectCard.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-project-diagram" style="color: ${project.color}; font-size: 1.2rem;"></i>
                <div style="flex: 1;">
                    <div style="font-weight: 700; font-size: 1rem;">${project.name}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">${project.tasks.length} 个任务</div>
                </div>
                <i class="fas fa-chevron-right" style="color: var(--text-secondary);"></i>
            </div>
        `;
        projectCard.onclick = () => showProjectTasksInCalendar(project);
        l.appendChild(projectCard);
    });

    // 显示分组任务
    groupTasks.forEach(t => {
        const li = document.createElement('li');
        li.className = `todo-item ${t.completed ? 'completed' : ''}`;
        li.style.setProperty('--group-color', t.groupColor);
        li.style.cursor = 'pointer';
        const pLabel = pMap[t.priority] || '中';

        // 构建时间显示
        let timeDisplay = '';
        if (t.startTime || t.endTime) {
            timeDisplay = `<span class="attribute-badge" style="color:var(--accent-color); border-color:var(--accent-color);"><i class="far fa-clock"></i> ${t.startTime || '--'} - ${t.endTime || '--'}</span>`;
        }

        // 子任务进度
        let subtaskProgress = '';
        if (t.subtasks && t.subtasks.length > 0) {
            const completed = t.subtasks.filter(st => st.completed).length;
            subtaskProgress = `<span class="attribute-badge" style="color:var(--text-secondary);"><i class="fas fa-tasks"></i> ${completed}/${t.subtasks.length}</span>`;
        }

        li.innerHTML = `
            <div class="todo-main">
                <label class="checkbox"><input type="checkbox" ${t.completed ? 'checked' : ''} onchange="event.stopPropagation(); toggleTodo(${t.id})"><span class="checkmark"></span></label>
                <div class="todo-content" style="flex:1">
                    <div class="todo-text">${t.text}</div>
                    <div class="todo-attributes">
                        ${timeDisplay}
                        <span class="attribute-badge priority-${t.priority}">${pLabel}优先级</span>
                        <span class="attribute-badge" style="color:${t.groupColor}; border-color:${t.groupColor};">${t.groupName}</span>
                        ${subtaskProgress}
                    </div>
                </div>
            </div>
        `;
        li.onclick = (e) => {
            const clickedCheckbox = e.target.tagName === 'INPUT' && e.target.type === 'checkbox';
            const clickedCheckmark = e.target.classList.contains('checkmark');
            const clickedLabel = e.target.tagName === 'LABEL' && e.target.classList.contains('checkbox');

            if (!clickedCheckbox && !clickedCheckmark && !clickedLabel) {
                openTaskDetailModal(t.id);
            }
        };
        l.appendChild(li);
    });

    if (groupTasks.length === 0 && Object.keys(projectsMap).length === 0) {
        l.innerHTML = `<li style="text-align:center; color:var(--text-secondary); padding:20px;">暂无任务</li>`;
    }
}

// 显示项目任务详情
function showProjectTasksInCalendar(project) {
    const l = document.getElementById('calendarDetailList');
    l.innerHTML = '';

    // 返回按钮
    const backBtn = document.createElement('button');
    backBtn.className = 'btn';
    backBtn.innerHTML = '<i class="fas fa-arrow-left"></i> 返回';
    backBtn.style.marginBottom = '15px';
    backBtn.onclick = renderCalendarDetail;
    l.appendChild(backBtn);

    // 标题
    const title = document.createElement('div');
    title.style.cssText = 'font-weight: 700; font-size: 1.1rem; margin-bottom: 15px; color: ' + project.color;
    title.innerHTML = `<i class="fas fa-project-diagram"></i> ${project.name}`;
    l.appendChild(title);

    // 显示项目任务
    project.tasks.forEach(t => {
        const li = document.createElement('li');
        li.className = `todo-item ${t.completed ? 'completed' : ''} project-task`;
        li.style.setProperty('--group-color', project.color);
        li.style.cursor = 'pointer';
        const pLabel = pMap[t.priority] || '中';

        let timeDisplay = '';
        if (t.startTime || t.endTime) {
            timeDisplay = `<span class="attribute-badge" style="color:var(--accent-color); border-color:var(--accent-color);"><i class="far fa-clock"></i> ${t.startTime || '--'} - ${t.endTime || '--'}</span>`;
        }

        let subtaskProgress = '';
        if (t.subtasks && t.subtasks.length > 0) {
            const completed = t.subtasks.filter(st => st.completed).length;
            subtaskProgress = `<span class="attribute-badge" style="color:var(--text-secondary);"><i class="fas fa-tasks"></i> ${completed}/${t.subtasks.length}</span>`;
        }

        li.innerHTML = `
            <div class="todo-main">
                <label class="checkbox"><input type="checkbox" ${t.completed ? 'checked' : ''} onchange="event.stopPropagation(); toggleTodo(${t.id})"><span class="checkmark"></span></label>
                <div class="todo-content" style="flex:1">
                    <div class="todo-text">${t.text}</div>
                    <div class="todo-attributes">
                        ${timeDisplay}
                        <span class="attribute-badge priority-${t.priority}">${pLabel}优先级</span>
                        ${subtaskProgress}
                    </div>
                </div>
            </div>
        `;
        li.onclick = (e) => {
            const clickedCheckbox = e.target.tagName === 'INPUT' && e.target.type === 'checkbox';
            const clickedCheckmark = e.target.classList.contains('checkmark');
            const clickedLabel = e.target.tagName === 'LABEL' && e.target.classList.contains('checkbox');

            if (!clickedCheckbox && !clickedCheckmark && !clickedLabel) {
                openTaskDetailModal(t.id);
            }
        };
        l.appendChild(li);
    });
}

// --- 任务详情模态框 ---
window.openTaskDetailModal = (taskId) => {
            const t = state.todos.find(x => sameEntityId(x.id, taskId));
            if (!t) return;

            // 设置标题
            document.getElementById('detailTaskTitle').innerText = t.text;

            // 设置属性徽章
            document.getElementById('detailTaskDate').innerHTML = `<i class="far fa-calendar"></i> ${t.date}`;
            document.getElementById('detailTaskDate').style.setProperty('--group-color', t.groupColor);

            // 时间段
            if (t.startTime || t.endTime) {
                document.getElementById('detailTaskTime').style.display = 'inline-block';
                document.getElementById('detailTaskTime').innerHTML = `<i class="far fa-clock"></i> ${t.startTime || '--'} - ${t.endTime || '--'}`;
                document.getElementById('detailTaskTime').style.color = 'var(--accent-color)';
                document.getElementById('detailTaskTime').style.borderColor = 'var(--accent-color)';
            } else {
                document.getElementById('detailTaskTime').style.display = 'none';
            }

            // 优先级
            const pLabel = pMap[t.priority] || '中';
            const priorityEl = document.getElementById('detailTaskPriority');
            priorityEl.innerText = `${pLabel}优先级`;
            priorityEl.className = `attribute-badge priority-${t.priority}`;

            // 分组
            document.getElementById('detailTaskGroup').innerText = t.groupName;
            document.getElementById('detailTaskGroup').style.color = t.groupColor;
            document.getElementById('detailTaskGroup').style.borderColor = t.groupColor;

            // 备注
            if (t.notes) {
                document.getElementById('detailTaskNotesSection').style.display = 'block';
                document.getElementById('detailTaskNotes').innerText = t.notes;
            } else {
                document.getElementById('detailTaskNotesSection').style.display = 'none';
            }

            // 子任务
            if (t.subtasks && t.subtasks.length > 0) {
                document.getElementById('detailSubtasksSection').style.display = 'block';
                const completed = t.subtasks.filter(st => st.completed).length;
                document.getElementById('detailSubtaskCount').innerText = `(${completed}/${t.subtasks.length})`;

                const subtaskList = document.getElementById('detailSubtaskList');
                subtaskList.innerHTML = t.subtasks.map(st => `
                    <li class="subtask-item ${st.completed ? 'completed' : ''}">
                        <input type="checkbox" class="subtask-checkbox" ${st.completed ? 'checked' : ''} onchange="toggleSubtask(${t.id}, ${st.id});">
                        <span class="subtask-text">${escapeHtml(st.text)}</span>
                    </li>
                `).join('');
            } else {
                document.getElementById('detailSubtasksSection').style.display = 'none';
            }

            // 设置编辑按钮
            document.getElementById('detailEditBtn').onclick = () => {
                closeModal('taskDetailModal');
                openEditTask(t.id);
            };

            openModal('taskDetailModal');
        };

// 检查是否所有子任务都完成了，如果是则关闭详情页
window.closeIfNeeded = (taskId) => {
            const task = state.todos.find(t => sameEntityId(t.id, taskId));
            if (!task || !task.subtasks || task.subtasks.length === 0) return;

            const allCompleted = task.subtasks.every(st => st.completed);
            if (allCompleted) {
                closeModal('taskDetailModal');
            }
        };

// --- 记账 ---

// 项目管理

let editingProjectId = null;
let selectedProjectColor = '#3b82f6';

function initProjects() {
    const projectBtn = document.getElementById('projectBtn');
    projectBtn.onclick = () => {
        renderProjects();  // 先渲染项目列表
        openModal('projectModal');  // 再打开模态框
    };
}

function openAddProjectModal() {
    editingProjectId = null;
    selectedProjectColor = '#3b82f6';

    document.getElementById('projectModalTitle').textContent = '添加项目';
    document.getElementById('projectNameInput').value = '';
    document.getElementById('projectDescription').value = '';
    document.getElementById('projectDeadline').value = '';

    renderProjectColors();

    openModal('addProjectModal');
}

function renderProjectColors() {
    const grid = document.getElementById('projectColorGrid');
    grid.innerHTML = colors.slice(0, 12).map(color => `
        <div class="project-color-option ${color === selectedProjectColor ? 'selected' : ''}"
             onclick="selectProjectColor('${color}')"
             style="width: 40px; height: 40px; border-radius: 50%; cursor: pointer;
                    border: 3px solid ${color === selectedProjectColor ? color : 'var(--border-color)'};
                    background: ${color}; transition: var(--transition);">
        </div>
    `).join('');
}

function selectProjectColor(color) {
    selectedProjectColor = color;
    renderProjectColors();
}

window.saveProject = function () {
    const name = document.getElementById('projectNameInput').value.trim();
    if (!name) {
        showSyncToast('请输入项目名称', 'error');
        return;
    }

    const description = document.getElementById('projectDescription').value.trim();
    const deadline = document.getElementById('projectDeadline').value;

    if (editingProjectId) {
        const project = state.projects.find(p => p.id === editingProjectId);
        if (project) {
            project.name = name;
            project.description = description;
            project.deadline = deadline;
            project.color = selectedProjectColor;
        }
    } else {
        const newProject = {
            id: uniqueId(),
            name,
            description,
            deadline,
            color: selectedProjectColor,
            createdAt: new Date().toISOString()
        };
        state.projects.push(newProject);
    }

    save();
    closeModal('addProjectModal');
    renderProjects();
    renderSidebarProjects();
};

function renderProjects() {
    const container = document.getElementById('projectList');
    const emptyState = document.getElementById('projectEmptyState');

    if (state.projects.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    container.innerHTML = state.projects.map(project => {
        const projectTodos = state.todos.filter(t => String(t.projectId) === String(project.id));
        const totalTodos = projectTodos.length;
        const completedTodos = projectTodos.filter(t => t.completed).length;
        const progress = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;

        // 截止日期状态
        let deadlineStatus = '';
        if (project.deadline) {
            const today = new Date();
            const deadline = new Date(project.deadline);
            const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));

            if (daysLeft < 0) {
                deadlineStatus = `<span style="color: var(--danger-color); font-weight: 700;">已逾期 ${Math.abs(daysLeft)} 天</span>`;
            } else if (daysLeft === 0) {
                deadlineStatus = `<span style="color: var(--warning-color); font-weight: 700;">今天截止</span>`;
            } else if (daysLeft <= 3) {
                deadlineStatus = `<span style="color: var(--warning-color); font-weight: 700;">还剩 ${daysLeft} 天</span>`;
            } else {
                deadlineStatus = `<span style="color: var(--success-color);">还剩 ${daysLeft} 天</span>`;
            }
        }

        return `
            <div style="background: var(--card-bg); border: 3px solid ${project.color}; border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow);">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                    <div style="flex: 1;">
                        <div style="font-weight: 700; font-size: 1.1rem; margin-bottom: 5px;">${project.name}</div>
                        ${deadlineStatus ? `<div style="font-size: 0.85rem; margin-bottom: 8px;">${deadlineStatus}</div>` : ''}
                    </div>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn-icon" onclick="editProject(${project.id})" title="编辑" style="padding: 6px 10px;">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button class="btn-icon" onclick="deleteProject(${project.id})" title="删除" style="padding: 6px 10px; color: var(--danger-color);">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>

                ${project.description ? `<div style="margin-bottom: 15px; font-size: 0.9rem; color: var(--text-secondary);">${project.description}</div>` : ''}

                <!-- 进度条 -->
                <div style="margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 0.85rem;">
                        <span>进度</span>
                        <span style="font-weight: 700;">${progress}%</span>
                    </div>
                    <div style="width: 100%; height: 8px; background: var(--bg-color); border-radius: 4px; overflow: hidden;">
                        <div style="width: ${progress}%; height: 100%; background: ${project.color}; transition: width 0.3s;"></div>
                    </div>
                </div>

                <!-- 统计信息 -->
                <div style="display: flex; gap: 15px; padding-top: 15px; border-top: 2px solid var(--border-color);">
                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 1.5rem; font-weight: 900; color: ${project.color};">${totalTodos}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">任务总数</div>
                    </div>
                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 1.5rem; font-weight: 900; color: var(--success-color);">${completedTodos}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">已完成</div>
                    </div>
                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 1.5rem; font-weight: 900; color: var(--warning-color);">${totalTodos - completedTodos}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">进行中</div>
                    </div>
                </div>

                <!-- 查看任务按钮 -->
                <div style="display:flex;gap:8px;margin-top:15px;">
                    <button class="btn" onclick="openProjectMindmap(${project.id})" style="flex:1; justify-content: center;">
                        <i class="fas fa-project-diagram"></i> 思维导图
                    </button>
                    <button class="btn" onclick="viewProjectTodos(${project.id})" style="flex:1; justify-content: center;">
                        <i class="fas fa-tasks"></i> 任务列表
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // 同时更新侧边栏项目列表
    renderSidebarProjects();
}

window.viewProjectTodos = function (projectId) {
    const project = state.projects.find(p => String(p.id) === String(projectId));
    if (!project) return;

    // 设置当前项目过滤
    state.currentProjectId = String(projectId);
    state.currentGroupId = null;

    closeModal('projectModal');

    // 切换到待办视图
    switchView('todo');

    // 更新UI
    renderGroups();
    renderSidebarProjects();
    renderTodos();
    updateStats();

    showSyncToast(`已切换到项目"${project.name}"`);
};

// 清除项目筛选
window.editProject = function (projectId) {
    const project = state.projects.find(p => p.id === projectId);
    if (!project) return;

    editingProjectId = projectId;
    selectedProjectColor = project.color;

    document.getElementById('projectModalTitle').textContent = '编辑项目';
    document.getElementById('projectNameInput').value = project.name;
    document.getElementById('projectDescription').value = project.description || '';
    document.getElementById('projectDeadline').value = project.deadline || '';

    renderProjectColors();

    openModal('addProjectModal');
};

window.deleteProject = async function (projectId) {
    try {
        const project = state.projects.find(p => p.id === projectId);
        if (!project) return;

        // 检查该项目下是否有任务
        const projectTasks = state.todos.filter(t => String(t.projectId) === String(projectId));
        const defaultGroup = state.groups[0];

        if (projectTasks.length > 0) {
            // 有任务，询问如何处理 - 提供三个选项
            const action = await showConfirm(
                `删除项目"${project.name}"`,
                `该项目下有 ${projectTasks.length} 个任务，请选择处理方式：`,
                ['取消删除', '删除项目下的所有任务', `保留任务并移至默认分组"${defaultGroup ? defaultGroup.name : '无'}"`]
            );

            if (action === 0) {
                // 用户选择取消删除 - 直接返回
                return;
            } else if (action === 1) {
                // 用户选择删除项目下的所有任务
                projectTasks.forEach(t => {
                    if (!state.deletedIds.includes(t.id)) {
                        state.deletedIds.push(t.id);
                    }
                });
                state.todos = state.todos.filter(t => String(t.projectId) !== String(projectId));
            } else if (action === 2) {
                // 用户选择移至默认分组
                if (defaultGroup) {
                    state.todos = state.todos.map(t => {
                        if (String(t.projectId) === String(projectId)) {
                            return {
                                ...t,
                                projectId: null,
                                projectName: null,
                                projectColor: null,
                                groupId: defaultGroup.id,
                                groupName: defaultGroup.name,
                                groupColor: defaultGroup.color
                            };
                        }
                        return t;
                    });
                } else {
                    // 没有默认分组，提示用户并删除任务
                    showSyncToast('没有默认分组，项目任务将被删除', 'error');
                    state.todos = state.todos.filter(t => String(t.projectId) !== String(projectId));
                }
            }
        } else {
            // 没有任务，简单确认删除
            const confirmed = await showConfirm(
                `删除项目"${project.name}"`,
                '确定要删除这个项目吗？',
                ['取消', '删除']
            );

            if (confirmed === 0) return; // 取消删除
        }

        // 删除项目
        if (!state.deletedIds.includes(projectId)) {
            state.deletedIds.push(projectId);
        }
        state.projects = state.projects.filter(p => p.id !== projectId);

        // 清除当前项目选择（如果删除的是当前选中的项目）
        if (String(state.currentProjectId) === String(projectId)) {
            state.currentProjectId = null;
        }

        save();
        renderProjects();
        renderSidebarProjects();
        renderTodos();
        updateStats();

        // 显示成功提示
        showSyncToast(`项目"${project.name}"已删除`);
    } catch (error) {
        console.error('删除项目时出错:', error);
        showSyncToast('删除项目失败，请重试', 'error');
    }
};

// --- 2. 批量操作功能 ---

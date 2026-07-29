// 批量操作


function initBatchMode() {
    const batchBtn = document.getElementById('batchModeBtn');

    batchBtn.onclick = () => {
        state.batchMode = !state.batchMode;
        state.selectedTodos.clear();

        // 更新按钮样式
        if (state.batchMode) {
            batchBtn.style.background = 'var(--accent-color)';
            document.getElementById('batchToolbar').style.display = 'block';
        } else {
            batchBtn.style.background = '';
            document.getElementById('batchToolbar').style.display = 'none';
        }

        renderTodos();
    };
}

// 切换任务选择状态
window.toggleTodoSelection = (id) => {
            const key = String(id);
            if (state.selectedTodos.has(key)) {
                state.selectedTodos.delete(key);
            } else {
                state.selectedTodos.add(key);
            }
            document.getElementById('selectedCount').innerText = state.selectedTodos.size;

            // 更新复选框状态
            const checkbox = document.getElementById(`batch-checkbox-${id}`);
            if (checkbox) checkbox.checked = state.selectedTodos.has(key);
        };

// 全选
window.selectAllTodos = () => {
            let list = state.todos;
            if (state.currentGroupId !== 'all') list = list.filter(t => t.groupId === state.currentGroupId);
            if (state.filter === 'active') list = list.filter(t => !t.completed);
            if (state.filter === 'completed') list = list.filter(t => t.completed);
            if (state.searchQuery) {
                list = list.filter(t =>
                    t.text.toLowerCase().includes(state.searchQuery) ||
                    (t.notes && t.notes.toLowerCase().includes(state.searchQuery))
                );
            }

            list.forEach(t => state.selectedTodos.add(String(t.id)));
            document.getElementById('selectedCount').innerText = state.selectedTodos.size;
            renderTodos();
        };

// 取消全选
window.deselectAllTodos = () => {
    state.selectedTodos.clear();
    document.getElementById('selectedCount').innerText = 0;
    renderTodos();
};

// 批量完成
window.batchCompleteTodos = () => {
            if (state.selectedTodos.size === 0) {
                showSyncToast('请先选择任务', 'error');
                return;
            }

            const count = state.selectedTodos.size;
            state.todos = state.todos.map(t =>
                state.selectedTodos.has(String(t.id)) ? { ...t, completed: true } : t
            );

            state.selectedTodos.clear();
            save();
            renderTodos();
            showSyncToast(`已标记 ${count} 项为完成`);
        };

// 批量删除
window.batchDeleteTodos = async () => {
            if (state.selectedTodos.size === 0) {
                showSyncToast('请先选择任务', 'error');
                return;
            }

            const confirmed = await showConfirm(
                '批量删除任务',
                `确定删除选中的 ${state.selectedTodos.size} 项任务？`,
                ['取消', '删除']
            );
            if (confirmed === 0) return;

            const count = state.selectedTodos.size;
            // 记录所有删除的ID
            state.selectedTodos.forEach(id => {
                const tombstone = entityTombstone('todo', id);
                if (!state.deletedIds.includes(tombstone)) {
                    state.deletedIds.push(tombstone);
                }
            });
            state.todos = state.todos.filter(t => !state.selectedTodos.has(String(t.id)));
            state.selectedTodos.clear();
            save();
            renderTodos();
            showSyncToast(`已删除 ${count} 项任务`);
        };

// 批量移动分组
window.batchMoveTodos = () => {
    if (state.selectedTodos.size === 0) {
        showSyncToast('请先选择任务', 'error');
        return;
    }

    // 更新批量移动模态框的分类选择器（包含分组和项目）
    updateBatchMoveCategorySelect();
    openModal('batchMoveModal');
};

// 更新批量移动模态框的分类选择器
function updateBatchMoveCategorySelect() {
    const customSelect = document.getElementById('batchMoveCategorySelectCustom');
    const nativeSelect = document.getElementById('batchMoveCategorySelect');
    const optionsContainer = customSelect.querySelector('.custom-select-options');
    const trigger = customSelect.querySelector('.custom-select-trigger');

    optionsContainer.innerHTML = '';
    nativeSelect.innerHTML = '';

    let html = '';

    // 添加分组分隔符和分组
    html += `<div class="custom-select-divider">分组</div>`;
    state.groups.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.dataset.type = 'group';
        opt.innerText = g.name;
        nativeSelect.appendChild(opt);

        const optionDiv = document.createElement('div');
        optionDiv.className = 'custom-select-option';
        optionDiv.dataset.value = g.id;
        optionDiv.dataset.type = 'group';
        optionDiv.innerHTML = `<span style="display:flex;align-items:center;gap:8px;"><span class="group-color" style="width:12px;height:12px;border-radius:2px;border:2px solid var(--border-color);background:${g.color};flex-shrink:0;"></span>${g.name}</span>`;
        optionDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            trigger.innerHTML = `<span style="display:flex;align-items:center;gap:8px;"><span class="group-color" style="width:12px;height:12px;border-radius:2px;border:2px solid var(--border-color);background:${g.color};flex-shrink:0;"></span>${g.name}</span>`;
            trigger.dataset.value = g.id;
            trigger.dataset.type = 'group';
            nativeSelect.value = g.id;
            optionsContainer.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
            optionDiv.classList.add('selected');
            customSelect.classList.remove('open');
        });
        optionsContainer.appendChild(optionDiv);
    });

    // 添加项目分隔符和项目
    html += `<div class="custom-select-divider">项目</div>`;
    state.projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.dataset.type = 'project';
        opt.innerText = p.name;
        nativeSelect.appendChild(opt);

        const optionDiv = document.createElement('div');
        optionDiv.className = 'custom-select-option';
        optionDiv.dataset.value = p.id;
        optionDiv.dataset.type = 'project';
        optionDiv.innerHTML = `<span style="display:flex;align-items:center;gap:8px;"><i class="fas fa-project-diagram" style="color:${p.color};"></i>${p.name}</span>`;
        optionDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            trigger.innerHTML = `<span style="display:flex;align-items:center;gap:8px;"><i class="fas fa-project-diagram" style="color:${p.color};"></i>${p.name}</span>`;
            trigger.dataset.value = p.id;
            trigger.dataset.type = 'project';
            nativeSelect.value = p.id;
            optionsContainer.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
            optionDiv.classList.add('selected');
            customSelect.classList.remove('open');
        });
        optionsContainer.appendChild(optionDiv);
    });

    // 初始化：默认选择第一个分组
    if (state.groups.length > 0) {
        const firstGroup = state.groups[0];
        trigger.innerHTML = `<span style="display:flex;align-items:center;gap:8px;"><span class="group-color" style="width:12px;height:12px;border-radius:2px;border:2px solid var(--border-color);background:${firstGroup.color};flex-shrink:0;"></span>${firstGroup.name}</span>`;
        trigger.dataset.value = firstGroup.id;
        trigger.dataset.type = 'group';
        nativeSelect.value = firstGroup.id;
    }

    // 初始化自定义下拉框
    initCustomSelects();
}

// 确认批量移动
window.confirmBatchMove = () => {
            const trigger = document.getElementById('batchMoveCategorySelectCustom').querySelector('.custom-select-trigger');
            const targetId = trigger.dataset.value;
            const targetType = trigger.dataset.type;

            if (!targetId || !targetType) {
                showSyncToast('请选择移动目标', 'error');
                return;
            }

            const count = state.selectedTodos.size;

            if (targetType === 'group') {
                // 移动到分组
                const targetGroup = state.groups.find(g => sameEntityId(g.id, targetId));
                if (!targetGroup) return;

                state.todos = state.todos.map(t =>
                    state.selectedTodos.has(String(t.id))
                        ? {
                            ...t,
                            groupId: targetGroup.id,
                            groupName: targetGroup.name,
                            groupColor: targetGroup.color,
                            projectId: null,
                            projectName: null,
                            projectColor: null
                        }
                        : t
                );

                state.selectedTodos.clear();
                save();
                closeModal('batchMoveModal');
                renderTodos();
                showSyncToast(`已将 ${count} 项任务移动到 "${targetGroup.name}"`);
            } else {
                // 移动到项目
                const targetProject = state.projects.find(p => sameEntityId(p.id, targetId));
                if (!targetProject) return;

                state.todos = state.todos.map(t =>
                    state.selectedTodos.has(String(t.id))
                        ? {
                            ...t,
                            projectId: String(targetProject.id),
                            projectName: targetProject.name,
                            projectColor: targetProject.color,
                            projectSubGroupId: null,
                            groupId: null,
                            groupName: null,
                            groupColor: null
                        }
                        : t
                );

                state.selectedTodos.clear();
                save();
                closeModal('batchMoveModal');
                renderTodos();
                showSyncToast(`已将 ${count} 项任务移动到项目 "${targetProject.name}"`);
            }
        };

// --- 3. 提醒通知功能 ---
let notificationCheckInterval = null;

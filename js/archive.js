// 归档功能


function initArchive() {
    const archiveBtn = document.getElementById('archiveBtn');
    archiveBtn.onclick = () => {
        openArchiveModal();
    };
}

function openArchiveModal() {
    renderArchiveList();
    openModal('archiveModal');
}

// 批量归档选中的任务
window.batchArchiveTodos = async function () {
            if (state.selectedTodos.size === 0) {
                showSyncToast('请先选择要归档的任务', 'error');
                return;
            }

            const confirmed = await showConfirm(
                '批量归档',
                `确定要将选中的 ${state.selectedTodos.size} 个任务归档吗？`,
                ['取消', '归档']
            );
            if (confirmed === 0) return;

            // 将选中的任务移到归档
            const tasksToArchive = state.todos.filter(t => state.selectedTodos.has(String(t.id)));
            tasksToArchive.forEach(task => {
                const now = new Date().toISOString();
                task.archivedAt = now;
                task.updatedAt = now;
                state.archivedTodos.push(task);
            });

            // 从主列表中移除
            state.todos = state.todos.filter(t => !state.selectedTodos.has(String(t.id)));

            // 清空选择
            state.selectedTodos.clear();

            save();
            renderTodos();
            renderStats();

            // 退出批量模式
            state.batchMode = false;
            document.getElementById('batchModeBtn').style.background = '';
            document.getElementById('batchToolbar').style.display = 'none';

            showSyncToast(`已归档 ${tasksToArchive.length} 个任务`);
        };

// 渲染归档任务列表
function renderArchiveList() {
            const archiveList = document.getElementById('archiveList');
            const emptyState = document.getElementById('archiveEmptyState');
            const archiveCount = document.getElementById('archiveCount');
            const archiveCompletedCount = document.getElementById('archiveCompletedCount');

            // 更新统计
            archiveCount.textContent = state.archivedTodos.length;
            archiveCompletedCount.textContent = state.archivedTodos.filter(t => t.completed).length;

            if (state.archivedTodos.length === 0) {
                archiveList.innerHTML = '';
                emptyState.style.display = 'block';
                document.getElementById('archiveBatchActions').style.display = 'none';
                return;
            }

            emptyState.style.display = 'none';

            // 按归档时间倒序排列
            const sorted = [...state.archivedTodos].sort((a, b) =>
                new Date(b.archivedAt) - new Date(a.archivedAt)
            );

            archiveList.innerHTML = sorted.map(todo => {
                const isSelected = selectedArchivedTodos.has(String(todo.id));
                // 根据是否项目任务显示不同的标签
                const categoryLabel = todo.projectName
                    ? `<i class="fas fa-project-diagram"></i> ${todo.projectName}`
                    : (todo.groupName || '无分组');
                const categoryColor = todo.projectColor || todo.groupColor || '#6b7280';
                const completedSubtasks = todo.subtasks ? todo.subtasks.filter(st => st.completed).length : 0;
                const totalSubtasks = todo.subtasks ? todo.subtasks.length : 0;

                return `
                    <li class="todo-item ${todo.completed ? 'completed' : ''} ${isSelected ? 'selected' : ''}"
                        style="border: 3px solid var(--border-color); border-radius: var(--radius); padding: 12px 15px; margin-bottom: 10px; background: var(--card-bg); box-shadow: var(--shadow); transition: var(--transition);"
                        data-id="${todo.id}">
                        <div style="display: flex; align-items: flex-start; gap: 10px;">
                            <input type="checkbox"
                                   class="archive-checkbox"
                                   ${isSelected ? 'checked' : ''}
                                   onchange="toggleArchiveSelection(${todo.id})"
                                   style="margin-top: 5px; width: 18px; height: 18px; cursor: pointer;">
                            <div style="flex: 1; min-width: 0;">
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                                    <span style="font-weight: 600; font-size: 1rem; flex: 1; word-break: break-word;">${todo.text}</span>
                                    <span style="padding: 3px 8px; background: ${categoryColor}; color: white; border-radius: 12px; font-size: 0.75rem; font-weight: 700; white-space: nowrap;">${categoryLabel}</span>
                                    ${todo.completed ? '<i class="fas fa-check-circle" style="color: var(--success-color); font-size: 1.2rem;"></i>' : ''}
                                </div>
                                ${todo.notes ? `<div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${todo.notes}</div>` : ''}
                                <div style="display: flex; gap: 12px; font-size: 0.8rem; color: var(--text-secondary); flex-wrap: wrap;">
                                    ${todo.date ? `<span><i class="fas fa-calendar"></i> ${todo.date}</span>` : ''}
                                    ${todo.startTime && todo.endTime ? `<span><i class="fas fa-clock"></i> ${todo.startTime} - ${todo.endTime}</span>` : ''}
                                    ${totalSubtasks > 0 ? `<span><i class="fas fa-tasks"></i> ${completedSubtasks}/${totalSubtasks}</span>` : ''}
                                    <span><i class="fas fa-archive"></i> 归档于 ${new Date(todo.archivedAt).toLocaleDateString()}</span>
                                </div>
                                ${totalSubtasks > 0 ? `
                                    <div style="margin-top: 8px; padding-left: 12px;">
                                        ${todo.subtasks.map(sub => `
                                            <div style="display: flex; align-items: center; gap: 6px; padding: 4px 0; font-size: 0.85rem;">
                                                <i class="fas ${sub.completed ? 'fa-check-circle' : 'fa-circle'}" style="color: ${sub.completed ? 'var(--success-color)' : 'var(--text-secondary)'}; font-size: 0.7rem;"></i>
                                                <span style="${sub.completed ? 'text-decoration: line-through; color: var(--text-secondary);' : ''}">${sub.text}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                            <div style="display: flex; gap: 5px;">
                                <button class="btn-icon" onclick="restoreTodo(${todo.id})" title="恢复任务" style="padding: 6px 10px;">
                                    <i class="fas fa-undo"></i>
                                </button>
                                <button class="btn-icon" onclick="deleteArchivedTodo(${todo.id})" title="永久删除" style="padding: 6px 10px; color: var(--danger-color);">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </li>
                `;
            }).join('');

            // 显示/隐藏批量操作栏
            const batchActions = document.getElementById('archiveBatchActions');
            if (selectedArchivedTodos.size > 0) {
                batchActions.style.display = 'block';
                document.getElementById('archiveSelectedCount').textContent = selectedArchivedTodos.size;
            } else {
                batchActions.style.display = 'none';
            }
        }

// 切换归档任务选择状态
window.toggleArchiveSelection = function (id) {
            const key = String(id);
            if (selectedArchivedTodos.has(key)) {
                selectedArchivedTodos.delete(key);
            } else {
                selectedArchivedTodos.add(key);
            }
            renderArchiveList();
        };

// 全选归档任务
window.selectAllArchived = function () {
            state.archivedTodos.forEach(t => selectedArchivedTodos.add(String(t.id)));
            renderArchiveList();
        };

// 取消全选归档任务
window.deselectAllArchived = function () {
    selectedArchivedTodos.clear();
    renderArchiveList();
};

// 恢复单个归档任务
window.restoreTodo = function (id) {
            const todo = state.archivedTodos.find(t => sameEntityId(t.id, id));
            if (!todo) return;

            // 从归档中移除
            state.archivedTodos = state.archivedTodos.filter(t => !sameEntityId(t.id, id));
            // 删除归档时间戳
            delete todo.archivedAt;
            todo.updatedAt = new Date().toISOString();
            // 添加回主列表
            state.todos.unshift(todo);

            save();
            renderTodos();
            renderArchiveList();
            renderStats();
        };

// 批量恢复归档任务
window.batchRestoreArchived = async function () {
            if (selectedArchivedTodos.size === 0) {
                showSyncToast('请先选择要恢复的任务', 'error');
                return;
            }

            const confirmed = await showConfirm(
                '批量恢复',
                `确定要恢复选中的 ${selectedArchivedTodos.size} 个任务吗？`,
                ['取消', '恢复']
            );
            if (confirmed === 0) return;

            const todosToRestore = state.archivedTodos.filter(t => selectedArchivedTodos.has(String(t.id)));
            todosToRestore.forEach(todo => {
                delete todo.archivedAt;
                todo.updatedAt = new Date().toISOString();
                state.todos.unshift(todo);
            });

            state.archivedTodos = state.archivedTodos.filter(t => !selectedArchivedTodos.has(String(t.id)));
            selectedArchivedTodos.clear();

            save();
            renderTodos();
            renderArchiveList();
            renderStats();

            showSyncToast(`已恢复 ${todosToRestore.length} 个任务`);
        };

// 删除单个归档任务
window.deleteArchivedTodo = async function (id) {
            const confirmed = await showConfirm(
                '永久删除归档任务',
                '确定要永久删除此归档任务吗？此操作无法撤销！',
                ['取消', '永久删除']
            );
            if (confirmed === 0) return;

            // 记录删除的ID
            const tombstone = entityTombstone('todo', id);
            if (!state.deletedIds.includes(tombstone)) {
                state.deletedIds.push(tombstone);
            }
            state.archivedTodos = state.archivedTodos.filter(t => !sameEntityId(t.id, id));
            const key = String(id);
            if (selectedArchivedTodos.has(key)) {
                selectedArchivedTodos.delete(key);
            }

            save();
            renderArchiveList();
            renderStats();
        };

// 批量删除归档任务
window.batchDeleteArchived = async function () {
            if (selectedArchivedTodos.size === 0) {
                showSyncToast('请先选择要删除的任务', 'error');
                return;
            }

            const confirmed = await showConfirm(
                '批量永久删除',
                `确定要永久删除选中的 ${selectedArchivedTodos.size} 个任务吗？此操作无法撤销！`,
                ['取消', '永久删除']
            );
            if (confirmed === 0) return;

            const count = selectedArchivedTodos.size;
            // 记录所有删除的ID
            selectedArchivedTodos.forEach(id => {
                const tombstone = entityTombstone('todo', id);
                if (!state.deletedIds.includes(tombstone)) {
                    state.deletedIds.push(tombstone);
                }
            });
            state.archivedTodos = state.archivedTodos.filter(t => !selectedArchivedTodos.has(String(t.id)));
            selectedArchivedTodos.clear();

            save();
            renderArchiveList();
            renderStats();

            showSyncToast(`已永久删除 ${count} 个任务`);
        };

// --- 重复任务功能 ---

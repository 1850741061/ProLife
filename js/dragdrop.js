// 拖拽排序


function initDragAndDrop() {
    // 侧边栏分组拖拽目标初始化
    updateGroupDragTargets();
}

// 更新分组拖拽目标
function updateGroupDragTargets() {
    // 在 renderGroups 后会自动调用
}

// 任务开始拖拽
window.onTodoDragStart = function (e, todoId) {
    state.draggedTodoId = todoId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', todoId);

    // 添加拖拽样式
    const todoItem = e.currentTarget;
    todoItem.style.opacity = '0.5';
    todoItem.style.transform = 'scale(1.02)';
    todoItem.style.boxShadow = '0 8px 16px rgba(0,0,0,0.2)';

    // 高亮所有可拖拽区域
    document.querySelectorAll('.group-item').forEach(item => {
        item.style.background = 'var(--bg-color)';
    });
};

// 任务拖拽结束
window.onTodoDragEnd = function (e) {
    const todoItem = e.currentTarget;
    todoItem.style.opacity = '1';
    todoItem.style.transform = '';
    todoItem.style.boxShadow = '';
    todoItem.style.borderTop = '';
    state.draggedTodoId = null;

    // 移除高亮
    document.querySelectorAll('.group-item').forEach(item => {
        item.style.background = '';
    });

    // 移除所有任务的拖拽指示线
    document.querySelectorAll('.todo-item').forEach(item => {
        item.style.borderTop = '';
        item.style.borderBottom = '';
    });
};

// 任务在另一个任务上方拖拽
window.onTodoDragOver = function (e, targetTodoId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (!state.draggedTodoId || state.draggedTodoId === targetTodoId) return;

    const targetElement = e.currentTarget;
    const rect = targetElement.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;

    // 根据鼠标位置决定插入到上方还是下方
    if (e.clientY < midY) {
        targetElement.style.borderTop = '4px solid var(--accent-color)';
        targetElement.style.borderBottom = '';
    } else {
        targetElement.style.borderBottom = '4px solid var(--accent-color)';
        targetElement.style.borderTop = '';
    }
};

// 离开拖拽目标
window.onTodoDragLeave = function (e) {
    e.currentTarget.style.borderTop = '';
    e.currentTarget.style.borderBottom = '';
};

// 在任务位置放下
window.onTodoDrop = function (e, targetTodoId) {
    e.preventDefault();
    e.currentTarget.style.borderTop = '';
    e.currentTarget.style.borderBottom = '';

    if (!state.draggedTodoId || state.draggedTodoId === targetTodoId) return;

    // 重新排序任务列表
    const draggedIndex = state.todos.findIndex(t => t.id === state.draggedTodoId);
    const targetIndex = state.todos.findIndex(t => t.id === targetTodoId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // 判断是插入到目标上方还是下方
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const insertAfter = e.clientY >= midY;

    // 移动元素
    const [draggedTodo] = state.todos.splice(draggedIndex, 1);

    // 如果是插入到下方，目标索引需要+1（因为已经删除了被拖拽的元素）
    const finalIndex = insertAfter && targetIndex > draggedIndex
        ? targetIndex
        : targetIndex + (insertAfter ? 1 : 0);

    state.todos.splice(finalIndex, 0, draggedTodo);

    save();
    renderTodos();
    showSyncToast('任务已重新排序');
};

// 分组拖拽进入
window.onGroupDragOver = function (e, groupId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    state.dragOverGroupId = groupId;

    // 高亮分组
    const groupElement = e.currentTarget;
    groupElement.style.background = 'var(--accent-color)';
    groupElement.style.transform = 'scale(1.05)';
};

// 离开分组
window.onGroupDragLeave = function (e) {
    e.currentTarget.style.background = '';
    e.currentTarget.style.transform = '';
    state.dragOverGroupId = null;
};

// 放到分组上
window.onGroupDrop = function (e, groupId) {
    e.preventDefault();
    e.currentTarget.style.background = '';
    e.currentTarget.style.transform = '';

    if (!state.draggedTodoId) return;

    const group = state.groups.find(g => g.id === groupId);
    if (!group) return;

    // 更新任务的分组，同时清除项目字段（项目与分组互斥）
    state.todos = state.todos.map(t =>
        t.id === state.draggedTodoId
            ? {
                ...t,
                groupId: group.id,
                groupName: group.name,
                groupColor: group.color,
                projectId: null,
                projectName: null,
                projectColor: null
            }
            : t
    );

    state.draggedTodoId = null;
    state.dragOverGroupId = null;

    save();
    renderTodos();
    showSyncToast(`已移动到 "${group.name}"`);
};

// ========== 任务模板系统 ==========

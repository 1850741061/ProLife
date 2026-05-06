// UI 组件：自定义下拉框、视图切换、移动端导航


function initCustomSelects() {
    document.querySelectorAll('.custom-select').forEach(select => {
        // 跳过编辑模态框的分类选择器，它会单独初始化
        if (select.id === 'editCategorySelectCustom') return;

        const trigger = select.querySelector('.custom-select-trigger');
        const options = select.querySelectorAll('.custom-select-option');
        const nativeSelect = select.querySelector('select');

        // 点击触发器打开/关闭下拉
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            // 关闭其他打开的下拉
            document.querySelectorAll('.custom-select.open').forEach(s => {
                if (s !== select) s.classList.remove('open');
            });
            select.classList.toggle('open');
        });

        // 点击选项
        options.forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = option.dataset.value;

                // 更新触发器内容（复制HTML以保留颜色方块）
                trigger.innerHTML = option.innerHTML;
                trigger.dataset.value = value;

                // 更新选中状态
                options.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');

                // 更新原生select的值
                nativeSelect.value = value;

                // 关闭下拉
                select.classList.remove('open');
            });
        });

        // 点击外部关闭
        document.addEventListener('click', (e) => {
            if (!select.contains(e.target)) {
                select.classList.remove('open');
            }
        });
    });
}

// 获取自定义选择器的值
function getCustomSelectValue(customSelectId) {
    const select = document.getElementById(customSelectId);
    const trigger = select.querySelector('.custom-select-trigger');
    return trigger.dataset.value;
}

// 设置自定义选择器的值
function setCustomSelectValue(customSelectId, value) {
    const select = document.getElementById(customSelectId);
    const trigger = select.querySelector('.custom-select-trigger');
    const options = select.querySelectorAll('.custom-select-option');
    const nativeSelect = select.querySelector('select');

    // 找到对应的选项
    options.forEach(option => {
        if (option.dataset.value === value) {
            trigger.innerHTML = option.innerHTML;  // 使用innerHTML复制颜色方块
            trigger.dataset.value = value;
            options.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            nativeSelect.value = value;
        }
    });
}

function initFinanceCategorySelect() {
    // 主分类选择器
    updateTransactionCategorySelector('transCategoryCustom', 'transCategory');

    // 编辑分类选择器
    updateTransactionCategorySelector('editTransCategoryCustom', 'editTransCategory');

    // 监听类型变化，自动更新分类选项
    const transTypeCustom = document.getElementById('transTypeCustom');
    const editTransTypeCustom = document.getElementById('editTransTypeCustom');

    if (transTypeCustom) {
        const typeTrigger = transTypeCustom.querySelector('.custom-select-trigger');
        const typeOptions = transTypeCustom.querySelectorAll('.custom-select-option');

        typeOptions.forEach(option => {
            option.addEventListener('click', () => {
                const type = option.dataset.value;
                updateTransactionCategorySelector('transCategoryCustom', 'transCategory', type);
            });
        });
    }

    if (editTransTypeCustom) {
        const editTypeOptions = editTransTypeCustom.querySelectorAll('.custom-select-option');

        editTypeOptions.forEach(option => {
            option.addEventListener('click', () => {
                const type = option.dataset.value;
                updateTransactionCategorySelector('editTransCategoryCustom', 'editTransCategory', type);
            });
        });
    }
}

// 根据类型更新分类选择器
function updateTransactionCategorySelector(customSelectId, selectId, type = 'expense') {
    const customSelect = document.getElementById(customSelectId);
    if (!customSelect) return;

    const nativeSelect = document.getElementById(selectId);
    const optionsContainer = customSelect.querySelector('.custom-select-options');
    const trigger = customSelect.querySelector('.custom-select-trigger');

    if (!nativeSelect || !optionsContainer || !trigger) return;

    // 清空选项
    nativeSelect.innerHTML = '';
    optionsContainer.innerHTML = '';

    // 根据类型获取对应的分类
    const categories = getCategoriesByType(type);

    // 保存当前选中的值
    const currentValue = trigger.dataset.value;

    categories.forEach((cat, index) => {
        // 原生 select
        const opt = document.createElement('option');
        opt.value = cat.name;
        opt.innerText = cat.name;
        nativeSelect.appendChild(opt);

        // 自定义选项
        const optionDiv = document.createElement('div');
        optionDiv.className = 'custom-select-option';
        optionDiv.dataset.value = cat.name;
        optionDiv.innerHTML = `<i class="fas ${cat.icon}" style="color: ${cat.color}; margin-right: 5px;"></i> ${cat.name}`;

        if (index === 0) {
            optionDiv.classList.add('selected');
        }

        optionDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            trigger.innerText = cat.name;
            trigger.dataset.value = cat.name;
            nativeSelect.value = cat.name;
            optionsContainer.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
            optionDiv.classList.add('selected');
            customSelect.classList.remove('open');
        });

        optionsContainer.appendChild(optionDiv);
    });

    // 设置默认值或恢复之前的值
    let defaultCat = categories[0];
    if (currentValue) {
        const exists = categories.find(cat => cat.name === currentValue);
        if (exists) defaultCat = exists;
    }

    trigger.innerHTML = `<i class="fas ${defaultCat.icon}" style="color: ${defaultCat.color}; margin-right: 5px;"></i> ${defaultCat.name}`;
    trigger.dataset.value = defaultCat.name;
    nativeSelect.value = defaultCat.name;
}

// --- 视图切换 ---
document.querySelectorAll('.view-tab[data-view]').forEach(t => t.onclick = () => switchView(t.dataset.view));

function switchView(view) {
    state.view = view;
    document.querySelectorAll('.view-tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
    document.querySelectorAll('.content-view').forEach(v => v.classList.toggle('active', v.id === view + 'View'));

    // 同步移动端底部导航栏
    document.querySelectorAll('.mobile-bottom-nav .nav-item[data-view]').forEach(n => n.classList.toggle('active', n.dataset.view === view));

    const layout = document.getElementById('mainLayout');
    // 仅待办和项目思维导图显示侧边栏
    layout.classList.toggle('todo-mode', view === 'todo' || view === 'projectMindmap');

    // FAB仅在待办页面显示
    const fab = document.getElementById('globalFab');
    if (fab) fab.style.display = (view === 'todo') ? 'flex' : 'none';

    if (view === 'calendar') {
        // 自动选择今天，并设置日历显示月份为当前月
        const today = new Date();
        state.calendarDate = today;
        const dateStr = today.toISOString().split('T')[0];
        state.selectedDate = dateStr;
        renderCalendar();
        document.getElementById('calendarDetailPanel').style.display = 'block';
        renderCalendarDetail();
        renderMilkteaView();
    }
    if (view === 'finance') renderFinance();
}

// 创建 setView 全局函数供移动端底部导航使用
window.setView = switchView;

// --- 移动端侧边栏折叠控制 ---
window.toggleMobileSidebar = function () {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('mobileSidebarOverlay');

    if (sidebar.classList.contains('mobile-open')) {
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('active');
    } else {
        sidebar.classList.add('mobile-open');
        overlay.classList.add('active');
    }
};

// --- 移动端待办导航处理 ---
window.handleMobileTodoNav = function () {
    if (window.innerWidth > 768) {
        setView('todo');
        return;
    }

    // 如果已经在待办视图，则打开分组选择
    if (state.view === 'todo') {
        toggleMobileSidebar();
    } else {
        // 否则切换到待办视图
        setView('todo');
    }
};

// 更新移动端分组按钮显示的当前分组名称
function updateMobileGroupToggle() {
    if (window.innerWidth <= 768) {
        const groupToggle = document.getElementById('mobileGroupToggle');
        const currentGroupNameSpan = document.getElementById('currentGroupName');

        if (groupToggle) {
            groupToggle.style.display = 'block';

            if (state.currentGroupId === 'all') {
                currentGroupNameSpan.textContent = '全部';
            } else {
                const group = state.groups.find(g => g.id === state.currentGroupId);
                currentGroupNameSpan.textContent = group ? group.name : '全部';
            }
        }
    } else {
        const groupToggle = document.getElementById('mobileGroupToggle');
        if (groupToggle) groupToggle.style.display = 'none';
    }
}

// 窗口大小改变时更新
window.addEventListener('resize', updateMobileGroupToggle);
updateMobileGroupToggle();

// --- 悬浮添加按钮处理 ---
window.handleMobileFabClick = function () {
    const currentView = state.view;

    if (currentView === 'todo') {
        // 待办视图：切换输入区域显示/隐藏
        const inputSection = document.querySelector('.input-section');
        const isCollapsed = inputSection.classList.contains('collapsed');

        if (isCollapsed) {
            // 展开
            inputSection.classList.remove('collapsed');
            // 滚动到输入区域
            setTimeout(() => {
                inputSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                document.getElementById('todoInput').focus();
            }, 100);
        } else {
            // 收起
            inputSection.classList.add('collapsed');
        }
    } else if (currentView === 'finance') {
        // 记账视图：打开添加记账模态框
        const addFinanceBtn = document.getElementById('addFinanceBtn');
        if (addFinanceBtn) {
            addFinanceBtn.click();
        }
    } else if (currentView === 'calendar') {
        // 日历视图：切换到待办视图并展开输入区域
        switchView('todo');
        setTimeout(() => {
            const inputSection = document.querySelector('.input-section');
            inputSection.classList.remove('collapsed');
            setTimeout(() => {
                inputSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                document.getElementById('todoInput').focus();
            }, 100);
        }, 300);
    }
};

// --- 分组管理 ---
function updateInputSectionVisibility() {
    let list = state.todos;

    // 根据当前选择过滤任务
    if (state.currentProjectId) {
        list = list.filter(t => t.projectId == state.currentProjectId);  // 使用 == 比较
    } else if (state.currentGroupId && state.currentGroupId !== 'all') {
        list = list.filter(t => t.groupId === state.currentGroupId && !t.projectId);
    } else {
        list = list.filter(t => !t.projectId);
    }

    const inputSection = document.querySelector('.input-section');

    // 只在没有任务时展开表单，有任务时不改变当前状态
    if (list.length === 0) {
        inputSection.classList.remove('collapsed');
    }
}



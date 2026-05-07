// 搜索功能


function initSearchFeature() {
    const searchBtn = document.getElementById('searchBtn');
    const searchBox = document.getElementById('searchBoxContainer');
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearchBtn');

    // 点击搜索按钮打开全局搜索模态框
    searchBtn.onclick = () => {
        openModal('globalSearchModal');
        setTimeout(() => {
            const globalSearchInput = document.getElementById('globalSearchInput');
            globalSearchInput.value = '';
            globalSearchInput.focus();
            document.getElementById('globalSearchResults').innerHTML = '';
            document.getElementById('globalSearchNoResults').style.display = 'none';
        }, 100);
    };

    // 实时搜索（带防抖）
    let searchTimer = null;
    searchInput.oninput = (e) => {
        state.searchQuery = e.target.value.toLowerCase();
        clearTimeout(searchTimer);
        searchTimer = setTimeout(renderTodos, 200);
    };

    // 清除搜索
    clearBtn.onclick = () => {
        searchInput.value = '';
        state.searchQuery = '';
        searchBox.style.display = 'none';
        renderTodos();
    };

    // 移动端搜索框事件
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    const clearMobileSearchBtn = document.getElementById('clearMobileSearchBtn');

    if (mobileSearchInput) {
        mobileSearchInput.oninput = (e) => {
            state.searchQuery = e.target.value.toLowerCase();
            clearTimeout(searchTimer);
            searchTimer = setTimeout(renderTodos, 200);
        };
    }

    if (clearMobileSearchBtn) {
        clearMobileSearchBtn.onclick = () => {
            mobileSearchInput.value = '';
            state.searchQuery = '';
            renderTodos();
            document.getElementById('mobileSearchContainer').style.display = 'none';
        };
    }

    // 回车搜索
    searchInput.onkeypress = (e) => {
        if (e.key === 'Enter') {
            state.searchQuery = searchInput.value.toLowerCase();
            renderTodos();
        }
    };
}

// --- 全局搜索功能 ---
function initGlobalSearch() {
    const globalSearchInput = document.getElementById('globalSearchInput');

    // 实时搜索
    globalSearchInput.oninput = (e) => {
        const query = e.target.value.toLowerCase().trim();
        const resultsContainer = document.getElementById('globalSearchResults');
        const noResultsDiv = document.getElementById('globalSearchNoResults');

        if (!query) {
            resultsContainer.innerHTML = '';
            noResultsDiv.style.display = 'none';
            return;
        }

        // 搜索所有模块
        const results = {
            todos: searchTodos(query),
            transactions: searchTransactions(query),
            templates: searchTemplates(query),
            projects: searchProjects(query)
        };

        // 渲染搜索结果
        renderGlobalSearchResults(results, query);

        // 显示/隐藏无结果提示
        const totalResults = results.todos.length + results.transactions.length + results.templates.length + results.projects.length;
        noResultsDiv.style.display = totalResults === 0 ? 'block' : 'none';
    };

    // 支持 Ctrl+F 快捷键打开全局搜索
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            openModal('globalSearchModal');
            setTimeout(() => {
                globalSearchInput.value = '';
                globalSearchInput.focus();
                document.getElementById('globalSearchResults').innerHTML = '';
                document.getElementById('globalSearchNoResults').style.display = 'none';
            }, 100);
        }
    });
}

// 搜索任务
function searchTodos(query) {
    return state.todos.filter(todo => {
        return todo.text.toLowerCase().includes(query) ||
            (todo.notes && todo.notes.toLowerCase().includes(query)) ||
            (todo.groupName && todo.groupName.toLowerCase().includes(query)) ||
            (todo.projectName && todo.projectName.toLowerCase().includes(query));
    }).map(todo => ({
        type: 'task',
        id: todo.id,
        title: todo.text,
        subtitle: todo.projectName ? `<i class="fas fa-project-diagram"></i> ${todo.projectName}` : (todo.groupName || '无分组'),
        notes: todo.notes || '',
        completed: todo.completed,
        icon: todo.completed ? 'fa-check-circle' : 'fa-circle',
        color: todo.completed ? 'var(--success-color)' : (todo.projectColor || todo.groupColor || 'var(--accent-color)')
    }));
}

// 搜索记账记录
function searchTransactions(query) {
    return state.transactions.filter(trans => {
        return trans.category.toLowerCase().includes(query) ||
            (trans.note && trans.note.toLowerCase().includes(query) ||
                trans.amount.toString().includes(query));
    }).map(trans => ({
        type: 'transaction',
        id: trans.id,
        title: `${trans.category} - ¥${trans.amount}`,
        subtitle: `${trans.type === 'expense' ? '支出' : '收入'} · ${trans.date}`,
        notes: trans.note || '',
        icon: trans.type === 'expense' ? 'fa-arrow-down' : 'fa-arrow-up',
        color: trans.type === 'expense' ? 'var(--danger-color)' : 'var(--success-color)'
    }));
}

// 搜索模板
function searchTemplates(query) {
    return state.templates.filter(template => {
        return template.text.toLowerCase().includes(query) ||
            (template.notes && template.notes.toLowerCase().includes(query)) ||
            (template.groupName && template.groupName.toLowerCase().includes(query));
    }).map(template => ({
        type: 'template',
        id: template.id,
        title: template.text,
        subtitle: `模板 · ${template.groupName || '无分组'}`,
        notes: template.notes || '',
        icon: 'fa-clone',
        color: 'var(--warning-color)'
    }));
}

// 搜索项目
function searchProjects(query) {
    return state.projects.filter(project => {
        return project.name.toLowerCase().includes(query) ||
            (project.description && project.description.toLowerCase().includes(query));
    }).map(project => ({
        type: 'project',
        id: project.id,
        title: project.name,
        subtitle: `项目 · ${project.description ? project.description.substring(0, 30) + '...' : '无描述'}`,
        notes: project.description || '',
        icon: 'fa-project-diagram',
        color: project.color
    }));
}

// 渲染全局搜索结果
function renderGlobalSearchResults(results, query) {
    const container = document.getElementById('globalSearchResults');
    let html = '';

    const sectionTemplate = (icon, color, title, items, query) => `
        <div class="mb-25">
            <div class="section-header">
                <i class="fas ${icon}" style="color: ${color}; font-size: 1.2rem;"></i>
                <h3 style="margin: 0;" class="fs-lg">${title} (${items.length})</h3>
            </div>
            ${items.map(item => createSearchResultItem(item, query)).join('')}
        </div>
    `;

    if (results.todos.length > 0) html += sectionTemplate('fa-tasks', 'var(--accent-color)', '任务', results.todos, query);
    if (results.transactions.length > 0) html += sectionTemplate('fa-wallet', 'var(--success-color)', '记账', results.transactions, query);
    if (results.templates.length > 0) html += sectionTemplate('fa-clone', 'var(--warning-color)', '模板', results.templates, query);
    if (results.projects.length > 0) html += sectionTemplate('fa-project-diagram', '#8b5cf6', '项目', results.projects, query);

    container.innerHTML = html;
}

// 创建搜索结果项
function createSearchResultItem(item, query) {
    // 高亮搜索关键词
    const highlightText = (text) => {
        if (!text) return '';
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark style="background: var(--warning-color); padding: 2px 4px; border-radius: 3px;">$1</mark>');
    };

    return `
        <div class="search-result-item"
             data-type="${item.type}"
             data-id="${item.id}">
            <i class="fas ${item.icon}" style="color: ${item.color}; font-size: 1.3rem; margin-top: 2px;"></i>
            <div class="flex-1">
                <div class="fw-600 mb-5 word-break">${highlightText(item.title)}</div>
                <div class="fs-sm text-secondary mb-5">${item.subtitle}</div>
                ${item.notes ? `<div class="fs-sm text-secondary italic ellipsis">${highlightText(item.notes)}</div>` : ''}
            </div>
            <i class="fas fa-chevron-right text-secondary" style="font-size: 0.9rem; margin-top: 5px;"></i>
        </div>
    `;
}

// 高亮显示记账记录
function highlightTransaction(id) {
    const items = document.querySelectorAll('.transaction-item');
    items.forEach(item => {
        if (parseInt(item.dataset.id) === id) {
            // 高亮效果
            item.style.animation = 'none';
            item.offsetHeight; // 触发重绘
            item.style.animation = 'highlight-pulse 1s ease-in-out 2';
            item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            // 其他项变暗
            item.style.opacity = '0.3';
        }
    });

    // 2秒后恢复
    setTimeout(() => {
        items.forEach(item => {
            item.style.opacity = '';
            item.style.animation = '';
        });
    }, 2000);
}

// 处理搜索结果点击
document.addEventListener('click', (e) => {
    const searchItem = e.target.closest('.search-result-item');
    if (!searchItem) return;

    const type = searchItem.dataset.type;
    const id = parseInt(searchItem.dataset.id);

    closeModal('globalSearchModal');

    // 根据类型执行相应操作
    if (type === 'task') {
        viewTodo(id);
    } else if (type === 'transaction') {
        switchView('finance');
        setTimeout(() => highlightTransaction(id), 100);
    } else if (type === 'template') {
        switchView('todo');
        setTimeout(() => applyTemplate(id), 100);
    } else if (type === 'project') {
        // 打开项目模态框并定位到该项目
        openModal('projectModal');
        renderProjects();
        setTimeout(() => {
            // 高亮显示该项目
            const projectCards = document.querySelectorAll('#projectList > div');
            projectCards.forEach(card => {
                card.style.border = '3px solid var(--border-color)';
                card.style.transform = '';
            });
        }, 100);
    }
});

// --- 归档功能 ---
let selectedArchivedTodos = new Set();


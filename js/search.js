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

    // 渲染任务结果
    if (results.todos.length > 0) {
        html += `
            <div style="margin-bottom: 25px;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 3px solid var(--border-color);">
                    <i class="fas fa-tasks" style="color: var(--accent-color); font-size: 1.2rem;"></i>
                    <h3 style="margin: 0; font-size: 1.1rem;">任务 (${results.todos.length})</h3>
                </div>
                ${results.todos.map(item => createSearchResultItem(item, query)).join('')}
            </div>
        `;
    }

    // 渲染记账结果
    if (results.transactions.length > 0) {
        html += `
            <div style="margin-bottom: 25px;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 3px solid var(--border-color);">
                    <i class="fas fa-wallet" style="color: var(--success-color); font-size: 1.2rem;"></i>
                    <h3 style="margin: 0; font-size: 1.1rem;">记账 (${results.transactions.length})</h3>
                </div>
                ${results.transactions.map(item => createSearchResultItem(item, query)).join('')}
            </div>
        `;
    }

    // 渲染模板结果
    if (results.templates.length > 0) {
        html += `
            <div style="margin-bottom: 25px;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 3px solid var(--border-color);">
                    <i class="fas fa-clone" style="color: var(--warning-color); font-size: 1.2rem;"></i>
                    <h3 style="margin: 0; font-size: 1.1rem;">模板 (${results.templates.length})</h3>
                </div>
                ${results.templates.map(item => createSearchResultItem(item, query)).join('')}
            </div>
        `;
    }

    // 渲染项目结果
    if (results.projects.length > 0) {
        html += `
            <div style="margin-bottom: 25px;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 3px solid var(--border-color);">
                    <i class="fas fa-project-diagram" style="color: #8b5cf6; font-size: 1.2rem;"></i>
                    <h3 style="margin: 0; font-size: 1.1rem;">项目 (${results.projects.length})</h3>
                </div>
                ${results.projects.map(item => createSearchResultItem(item, query)).join('')}
            </div>
        `;
    }

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
             data-id="${item.id}"
             style="padding: 12px 15px; margin-bottom: 10px; background: var(--card-bg); border: 3px solid var(--border-color); border-radius: var(--radius); cursor: pointer; transition: var(--transition); display: flex; align-items: flex-start; gap: 12px;"
             onmouseover="this.style.transform = 'translate(-2px, -2px)'; this.style.boxShadow = 'var(--shadow)';"
             onmouseout="this.style.transform = ''; this.style.boxShadow = '';">
            <i class="fas ${item.icon}" style="color: ${item.color}; font-size: 1.3rem; margin-top: 2px;"></i>
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; font-size: 1rem; margin-bottom: 4px; word-break: break-word;">${highlightText(item.title)}</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 4px;">${item.subtitle}</div>
                ${item.notes ? `<div style="font-size: 0.85rem; color: var(--text-secondary); font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${highlightText(item.notes)}</div>` : ''}
            </div>
            <i class="fas fa-chevron-right" style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 5px;"></i>
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


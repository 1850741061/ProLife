// 记账功能


function renderFinance() {
    // 根据视图模式切换显示
    const listContainer = document.getElementById('transactionList');
    const monthContainer = document.getElementById('transactionMonthList');
    const financeCards = document.querySelector('.finance-cards');

    if (state.financeViewMode === 'month') {
        listContainer.style.display = 'none';
        monthContainer.style.display = 'flex';
        // 月份视图下隐藏统计卡片
        financeCards.style.display = 'none';
        renderFinanceByMonth();
    } else {
        listContainer.style.display = 'flex';
        monthContainer.style.display = 'none';
        // 列表视图下显示统计卡片
        financeCards.style.display = 'flex';
        renderFinanceList();
    }

    // 更新视图切换按钮状态
    document.getElementById('financeViewList').classList.toggle('active', state.financeViewMode === 'list');
    document.getElementById('financeViewMonth').classList.toggle('active', state.financeViewMode === 'month');
}

// 列表视图渲染 - 只显示当前月份
function renderFinanceList() {
    const l = document.getElementById('transactionList');
    const filterBar = document.getElementById('financeFilterBar');
    l.innerHTML = '';
    filterBar.innerHTML = '';

    let inc = 0, exp = 0;

    // 获取当前月份 (YYYY-MM)
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const uniqueCats = [...new Set(state.transactions.map(t => t.category))];

    const chips = [{ name: '全部', val: 'all' }, ...uniqueCats.map(c => ({ name: c, val: c }))];
    chips.forEach(c => {
        const chip = document.createElement('div');
        chip.className = `filter-chip ${state.financeFilter === c.val ? 'active' : ''}`;
        chip.innerText = c.name;
        chip.onclick = () => setFinanceFilter(c.val);
        filterBar.appendChild(chip);
    });

    // 只显示当前月份的交易
    const listToRender = [...state.transactions]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .filter(t => {
            const tMonth = t.date.substring(0, 7); // YYYY-MM
            return tMonth === currentMonth && (state.financeFilter === 'all' || t.category === state.financeFilter);
        });

    listToRender.forEach(t => {
        if (t.type === 'income') inc += parseFloat(t.amount); else exp += parseFloat(t.amount);

        // 获取分类颜色对象
        const catObj = getAllCategories().find(c => c.name === t.category);
        const color = catObj ? catObj.color : '#ccc'; // 兼容旧数据

        const div = document.createElement('div');
        div.className = `transaction-item`;
        div.dataset.id = t.id; // 添加ID以便高亮

        // 动态设置左侧边框颜色
        div.style.borderLeftColor = color;

        div.innerHTML = `
            <div>
                <div style="font-weight:800; text-transform:uppercase; display:flex; align-items:center; gap:5px;">
                    <span class="cat-badge" style="background:${color}; border-color:${color}; color:var(--card-bg);">${t.category}</span>
                </div>
                <div style="font-size:0.8rem; color:var(--text-secondary);">${t.date} ${t.note ? '| ' + t.note : ''}</div>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <div class="t-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${t.amount}</div>
                <i class="fas fa-pen action-icon" onclick='openEditTransaction(${JSON.stringify(String(t.id))})' style="cursor:pointer; font-size:0.9rem; color:var(--text-secondary);"></i>
            </div>
        `;
        l.appendChild(div);
    });

    document.getElementById('totalIncome').innerText = '¥' + inc.toFixed(2);
    document.getElementById('totalExpense').innerText = '¥' + exp.toFixed(2);
    document.getElementById('totalBalance').innerText = '¥' + (inc - exp).toFixed(2);
    // 计算日均消费（当月已过天数）
    const dayOfMonth = new Date().getDate();
    const dailyAvg = dayOfMonth > 0 ? (exp / dayOfMonth) : 0;
    document.getElementById('dailyAvgExpense').innerText = '¥' + dailyAvg.toFixed(2);
}

// 月份视图渲染
function renderFinanceByMonth() {
    const monthContainer = document.getElementById('transactionMonthList');
    const filterBar = document.getElementById('financeFilterBar');
    monthContainer.innerHTML = '';
    filterBar.innerHTML = '';

    let totalInc = 0, totalExp = 0;

    // 按月份分组
    const groupedByMonth = {};
    state.transactions.forEach(t => {
        const monthKey = t.date.substring(0, 7); // YYYY-MM
        if (!groupedByMonth[monthKey]) {
            groupedByMonth[monthKey] = [];
        }
        groupedByMonth[monthKey].push(t);
    });

    // 按月份降序排序
    const sortedMonths = Object.keys(groupedByMonth).sort().reverse();

    // 渲染每个月份
    sortedMonths.forEach(monthKey => {
        const transactions = groupedByMonth[monthKey];
        let monthInc = 0, monthExp = 0;

        // 计算该月统计
        transactions.forEach(t => {
            if (t.type === 'income') monthInc += parseFloat(t.amount);
            else monthExp += parseFloat(t.amount);
        });

        totalInc += monthInc;
        totalExp += monthExp;

        // 创建月份分组容器
        const monthGroup = document.createElement('div');
        monthGroup.className = 'month-group';

        // 月份头部
        const [year, month] = monthKey.split('-');
        const isExpanded = state.financeExpandedMonths && state.financeExpandedMonths.has(monthKey);
        monthGroup.innerHTML = `
            <div class="month-header" style="cursor: pointer;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-chevron-${isExpanded ? 'down' : 'right'} month-toggle-icon" style="font-size: 0.8rem; transition: transform 0.2s; width: 12px;"></i>
                    <div class="month-title">
                        <i class="fas fa-calendar-alt"></i>
                        ${year}年 ${parseInt(month)}月
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div class="month-stats">
                        <div class="month-stat income">
                            <i class="fas fa-arrow-up"></i>
                            <span>收入 ¥${monthInc.toFixed(2)}</span>
                        </div>
                        <div class="month-stat expense">
                            <i class="fas fa-arrow-down"></i>
                            <span>支出 ¥${monthExp.toFixed(2)}</span>
                        </div>
                    </div>
                    <i class="fas fa-external-link-alt" onclick="event.stopPropagation(); openMonthDetail('${monthKey}', ${monthInc}, ${monthExp})" style="cursor:pointer; font-size:0.85rem; color:var(--text-secondary); padding: 4px;" title="查看详情"></i>
                </div>
            </div>
            <div class="month-transactions" style="display: ${isExpanded ? 'block' : 'none'};"></div>
        `;

        // 点击月份头部切换展开/折叠
        const header = monthGroup.querySelector('.month-header');
        header.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!state.financeExpandedMonths) state.financeExpandedMonths = new Set();
            const transEl = monthGroup.querySelector('.month-transactions');
            const iconEl = monthGroup.querySelector('.month-toggle-icon');
            if (state.financeExpandedMonths.has(monthKey)) {
                state.financeExpandedMonths.delete(monthKey);
                transEl.style.display = 'none';
                iconEl.className = 'fas fa-chevron-right month-toggle-icon';
            } else {
                state.financeExpandedMonths.add(monthKey);
                transEl.style.display = 'block';
                iconEl.className = 'fas fa-chevron-down month-toggle-icon';
            }
        });

        // 添加该月的交易记录
        const transContainer = monthGroup.querySelector('.month-transactions');
        transactions
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .forEach(t => {
                const catObj = getAllCategories().find(c => c.name === t.category);
                const color = catObj ? catObj.color : '#ccc';

                const div = document.createElement('div');
                div.className = 'transaction-item';
                div.style.borderLeftColor = color;

                div.innerHTML = `
                    <div>
                        <div style="font-weight:800; text-transform:uppercase; display:flex; align-items:center; gap:5px;">
                            <span class="cat-badge" style="background:${color}; border-color:${color}; color:var(--card-bg);">${t.category}</span>
                        </div>
                        <div style="font-size:0.8rem; color:var(--text-secondary);">${t.date} ${t.note ? '| ' + t.note : ''}</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div class="t-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${t.amount}</div>
                        <i class="fas fa-pen action-icon" onclick='openEditTransaction(${JSON.stringify(String(t.id))})' style="cursor:pointer; font-size:0.9rem; color:var(--text-secondary);"></i>
                    </div>
                `;
                transContainer.appendChild(div);
            });

        monthContainer.appendChild(monthGroup);
    });

    // 更新总统计
    document.getElementById('totalIncome').innerText = '¥' + totalInc.toFixed(2);
    document.getElementById('totalExpense').innerText = '¥' + totalExp.toFixed(2);
    document.getElementById('totalBalance').innerText = '¥' + (totalInc - totalExp).toFixed(2);
    const dayOfMonth2 = new Date().getDate();
    const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const currentMonthExp = groupedByMonth[currentMonthKey] ? groupedByMonth[currentMonthKey].filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0) : 0;
    const dailyAvg2 = dayOfMonth2 > 0 ? (currentMonthExp / dayOfMonth2) : 0;
    document.getElementById('dailyAvgExpense').innerText = '¥' + dailyAvg2.toFixed(2);
}

// 切换记账视图模式
window.setFinanceViewMode = (mode, event) => {
    if (event) {
        event.stopPropagation();
    }
    state.financeViewMode = mode;
    // 确保主视图保持在 finance，防止侧边栏出现
    if (state.view !== 'finance') {
        state.view = 'finance';
        const layout = document.getElementById('mainLayout');
        layout.classList.remove('todo-mode');
    }
    renderFinance();
};

// 打开月份详情弹窗
window.openMonthDetail = (monthKey, monthInc, monthExp) => {
    const [year, month] = monthKey.split('-');

    // 设置标题
    document.getElementById('monthDetailTitle').innerText = `${year}年 ${parseInt(month)}月 详情`;

    // 设置统计数据
    document.getElementById('monthDetailIncome').innerText = '¥' + monthInc.toFixed(2);
    document.getElementById('monthDetailExpense').innerText = '¥' + monthExp.toFixed(2);
    document.getElementById('monthDetailBalance').innerText = '¥' + (monthInc - monthExp).toFixed(2);

    // 计算日均消费
    const now = new Date();
    const isCurrentMonth = (parseInt(year) === now.getFullYear() && parseInt(month) === now.getMonth() + 1);
    const daysElapsed = isCurrentMonth ? now.getDate() : new Date(parseInt(year), parseInt(month), 0).getDate();
    const monthDailyAvg = daysElapsed > 0 ? (monthExp / daysElapsed) : 0;
    document.getElementById('monthDetailDailyAvg').innerText = '¥' + monthDailyAvg.toFixed(2);

    // 获取该月的所有交易
    const monthTransactions = state.transactions.filter(t => t.date.substring(0, 7) === monthKey);

    // 按分类统计
    const catStats = {};
    monthTransactions.forEach(t => {
        if (!catStats[t.category]) {
            catStats[t.category] = { income: 0, expense: 0, color: t.catColor || '#ccc' };
        }
        if (t.type === 'income') {
            catStats[t.category].income += parseFloat(t.amount);
        } else {
            catStats[t.category].expense += parseFloat(t.amount);
        }
    });

    // 生成饼图
    renderExpensePieChart(catStats);

    // 渲染分类统计
    const catStatsContainer = document.getElementById('monthCategoryStats');
    catStatsContainer.innerHTML = '';

    Object.entries(catStats).forEach(([cat, stats]) => {
        const div = document.createElement('div');
        div.style.cssText = 'padding: 12px; background: var(--card-bg); border: 2px solid var(--border-color); border-radius: var(--radius);';

        const catObj = getAllCategories().find(c => c.name === cat);
        const color = catObj ? catObj.color : stats.color;

        // 检查是否有预算设置（仅支出分类）
        const budget = catObj && catObj.budget ? catObj.budget : null;
        const hasBudget = budget && stats.expense > 0;
        const budgetPercent = hasBudget ? (stats.expense / budget * 100) : 0;
        const isOverBudget = hasBudget && budgetPercent > 100;
        const isNearBudget = hasBudget && budgetPercent >= 80 && budgetPercent <= 100;

        // 预算进度条颜色
        let progressColor = 'var(--success-color)';
        if (isOverBudget) progressColor = 'var(--danger-color)';
        else if (isNearBudget) progressColor = '#f59e0b';

        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: ${hasBudget ? '10px' : '0'};">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="cat-badge" style="background: ${color}; border-color: ${color}; color: var(--card-bg);">${cat}</span>
                </div>
                <div style="display: flex; gap: 15px; font-size: 0.85rem;">
                    ${stats.income > 0 ? `<span style="color: var(--success-color);">收入 ¥${stats.income.toFixed(2)}</span>` : ''}
                    ${stats.expense > 0 ? `<span style="color: var(--danger-color);">支出 ¥${stats.expense.toFixed(2)}</span>` : ''}
                </div>
            </div>
            ${hasBudget ? `
                <div style="margin-top: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; font-size: 0.8rem;">
                        <span style="color: var(--text-secondary);">
                            <i class="fas fa-wallet" style="margin-right: 5px;"></i>
                            预算: ¥${budget.toFixed(0)}
                        </span>
                        <span style="color: ${progressColor}; font-weight: 700;">
                            ${isOverBudget ? '⚠️ ' : ''}${budgetPercent.toFixed(1)}%
                        </span>
                    </div>
                    <div style="
                        width: 100%;
                        height: 8px;
                        background: var(--bg-color);
                        border: 2px solid var(--border-color);
                        border-radius: 4px;
                        overflow: hidden;
                    ">
                        <div style="
                            width: ${Math.min(budgetPercent, 100)}%;
                            height: 100%;
                            background: ${progressColor};
                            transition: width 0.3s ease;
                        "></div>
                    </div>
                    ${isOverBudget ? `
                        <div style="margin-top: 5px; font-size: 0.8rem; color: var(--danger-color); font-weight: 600;">
                            <i class="fas fa-exclamation-triangle"></i> 超出预算 ¥${(stats.expense - budget).toFixed(2)}
                        </div>
                    ` : ''}
                </div>
            ` : ''}
        `;
        catStatsContainer.appendChild(div);
    });

    // 渲染交易列表
    const transContainer = document.getElementById('monthDetailTransactions');
    transContainer.innerHTML = '';

    monthTransactions
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .forEach(t => {
            const catObj = getAllCategories().find(c => c.name === t.category);
            const color = catObj ? catObj.color : '#ccc';

            const div = document.createElement('div');
            div.className = 'transaction-item';
            div.style.borderLeftColor = color;
            div.style.cssText += ' margin-bottom: 10px;';

            div.innerHTML = `
                <div>
                    <div style="font-weight:800; text-transform:uppercase; display:flex; align-items:center; gap:5px;">
                        <span class="cat-badge" style="background:${color}; border-color:${color}; color:var(--card-bg);">${t.category}</span>
                    </div>
                    <div style="font-size:0.8rem; color:var(--text-secondary);">${t.date} ${t.note ? '| ' + t.note : ''}</div>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="t-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${t.amount}</div>
                </div>
            `;
            transContainer.appendChild(div);
        });

    openModal('monthDetailModal');
};

window.addTransaction = () => {
    const type = getCustomSelectValue('transTypeCustom');
    const date = document.getElementById('transDate').value;
    const cat = getCustomSelectValue('transCategoryCustom');
    const amt = document.getElementById('transAmount').value;
    const note = document.getElementById('transNote').value.trim();

    if (!cat || !amt || !date) return showSyncToast('请填写完整', 'error');

    // 获取对应颜色
    const catObj = getAllCategories().find(c => c.name === cat);

    state.transactions.unshift({ id: uniqueId(), type, date, category: cat, amount: amt, note, catColor: catObj.color });
    save();
    renderFinance();
    document.getElementById('transAmount').value = '';
    document.getElementById('transNote').value = '';
};

window.setFinanceFilter = (cat) => {
    state.financeFilter = cat;
    renderFinance();
};

window.openEditTransaction = (id) => {
    const t = state.transactions.find(x => sameFinanceTransactionId(x.id, id));
    if (!t) return;
    state.editingTransId = t.id;
    setCustomSelectValue('editTransTypeCustom', t.type);
    document.getElementById('editTransDate').value = t.date;
    setCustomSelectValue('editTransCategoryCustom', t.category);
    document.getElementById('editTransAmount').value = t.amount;
    document.getElementById('editTransNote').value = t.note || '';
    openModal('transModal');
};

window.saveEditTransaction = () => {
    if (!state.editingTransId) return;
    const type = getCustomSelectValue('editTransTypeCustom');
    const date = document.getElementById('editTransDate').value;
    const category = getCustomSelectValue('editTransCategoryCustom');
    const amount = document.getElementById('editTransAmount').value;
    const note = document.getElementById('editTransNote').value.trim();

    if (!category || !amount || !date) return showSyncToast('请填写完整', 'error');

    // 更新颜色
    const catObj = getAllCategories().find(c => c.name === category);

    state.transactions = state.transactions.map(t => sameFinanceTransactionId(t.id, state.editingTransId) ? {
        ...t, type, date, category, amount, note, catColor: catObj.color
    } : t);

    save();
    closeModal('transModal');
    state.editingTransId = null;
    renderFinance();
};

window.deleteEditTransaction = async () => {
    const confirmed = await showConfirm('删除记录', '确定删除此记录？');
    if (confirmed === 0) return;
    // 记录删除ID
    if (!state.deletedIds.some(id => sameFinanceTransactionId(id, state.editingTransId) || id === state.editingTransId)) {
        state.deletedIds.push(state.editingTransId);
    }
    state.transactions = state.transactions.filter(t => !sameFinanceTransactionId(t.id, state.editingTransId));
    save();
    closeModal('transModal');
    state.editingTransId = null;
    renderFinance();
};

// ========== 分类管理功能 ==========
let currentCategoryManagerType = 'expense'; // 'expense' or 'income'

// 生成支出分类饼图
function renderExpensePieChart(catStats) {
    const svg = document.getElementById('expensePieChart');
    const legend = document.getElementById('pieChartLegend');

    if (!svg || !legend) return;

    // 清空
    svg.innerHTML = '';
    legend.innerHTML = '';

    // 过滤出有支出的分类
    const expenseCategories = Object.entries(catStats)
        .filter(([cat, stats]) => stats.expense > 0)
        .sort((a, b) => b[1].expense - a[1].expense);

    if (expenseCategories.length === 0) {
        // 如果没有支出数据，显示空圆
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '0');
        circle.setAttribute('cy', '0');
        circle.setAttribute('r', '1');
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', 'var(--border-color)');
        circle.setAttribute('stroke-width', '0.1');
        svg.appendChild(circle);

        legend.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: 20px;">本月暂无支出记录</div>';
        return;
    }

    // 计算总支出
    const totalExpense = expenseCategories.reduce((sum, [cat, stats]) => sum + stats.expense, 0);

    // 生成饼图切片
    let cumulativePercent = 0;

    expenseCategories.forEach(([cat, stats], index) => {
        const percent = stats.expense / totalExpense;
        const startPercent = cumulativePercent;
        const endPercent = cumulativePercent + percent;

        // 计算弧度
        const startX = Math.cos(2 * Math.PI * startPercent);
        const startY = Math.sin(2 * Math.PI * startPercent);
        const endX = Math.cos(2 * Math.PI * endPercent);
        const endY = Math.sin(2 * Math.PI * endPercent);

        // 判断是否是大角度弧（超过50%）
        const largeArcFlag = percent > 0.5 ? 1 : 0;

        // 获取分类颜色
        const catObj = getAllCategories().find(c => c.name === cat);
        const color = catObj ? catObj.color : stats.color;

        // 创建路径
        const pathData = `M 0 0 L ${startX} ${startY} A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('fill', color);
        path.setAttribute('stroke', 'var(--card-bg)');
        path.setAttribute('stroke-width', '0.02');
        path.style.cursor = 'pointer';

        // 添加hover效果
        path.addEventListener('mouseenter', () => {
            path.setAttribute('opacity', '0.8');
            path.setAttribute('transform', 'scale(1.05)');
        });
        path.addEventListener('mouseleave', () => {
            path.setAttribute('opacity', '1');
            path.setAttribute('transform', 'scale(1)');
        });
        path.addEventListener('click', () => {
            showConfirm(cat, `支出：¥${stats.expense.toFixed(2)}\n占比：${(percent * 100).toFixed(1)}%`, ['确定']);
        });

        svg.appendChild(path);

        // 添加图例
        const legendItem = document.createElement('div');
        legendItem.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px;
            background: var(--card-bg);
            border: 2px solid var(--border-color);
            border-radius: var(--radius);
            cursor: pointer;
            transition: var(--transition);
        `;
        legendItem.addEventListener('mouseenter', () => {
            legendItem.style.transform = 'scale(1.05)';
            legendItem.style.boxShadow = '2px 2px 0 0 var(--border-color)';
        });
        legendItem.addEventListener('mouseleave', () => {
            legendItem.style.transform = 'scale(1)';
            legendItem.style.boxShadow = 'none';
        });
        legendItem.addEventListener('click', () => {
            showConfirm(cat, `支出：¥${stats.expense.toFixed(2)}\n占比：${(percent * 100).toFixed(1)}%`, ['确定']);
        });

        legendItem.innerHTML = `
            <div style="width: 20px; height: 20px; border-radius: 50%; background: ${color}; flex-shrink: 0;"></div>
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 700; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${cat}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary);">¥${stats.expense.toFixed(2)} (${(percent * 100).toFixed(1)}%)</div>
            </div>
        `;

        legend.appendChild(legendItem);

        cumulativePercent += percent;
    });
}

// 打开分类管理器
window.openCategoryManager = () => {
    currentCategoryManagerType = 'expense';
    renderCategoryManager();
    updateCategoryManagerButtons();
    openModal('categoryManagerModal');
};

// 切换分类管理器类型
window.switchCategoryManagerType = (type) => {
    currentCategoryManagerType = type;
    renderCategoryManager();
    updateCategoryManagerButtons();
};

// 更新按钮状态
function updateCategoryManagerButtons() {
    const expenseBtn = document.getElementById('categoryTypeExpense');
    const incomeBtn = document.getElementById('categoryTypeIncome');
    const budgetTip = document.getElementById('budgetTip');

    if (currentCategoryManagerType === 'expense') {
        expenseBtn.style.background = 'var(--danger-color)';
        expenseBtn.style.color = 'white';
        incomeBtn.style.background = 'var(--card-bg)';
        incomeBtn.style.color = 'var(--text-main)';
        budgetTip.style.display = 'block';
    } else {
        incomeBtn.style.background = 'var(--success-color)';
        incomeBtn.style.color = 'white';
        expenseBtn.style.background = 'var(--card-bg)';
        expenseBtn.style.color = 'var(--text-main)';
        budgetTip.style.display = 'none';
    }
}

// 渲染分类列表
function renderCategoryManager() {
    const categories = financeCats[currentCategoryManagerType];
    const listContainer = document.getElementById('categoryManagerList');
    listContainer.innerHTML = '';

    categories.forEach((cat, index) => {
        const div = document.createElement('div');
        div.className = 'category-item';
        div.style.cssText = `
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 15px;
            background: var(--card-bg);
            border: 3px solid var(--border-color);
            border-radius: var(--radius);
            margin-bottom: 10px;
            transition: var(--transition);
        `;

        // 判断是否显示预算设置（仅支出分类显示）
        const isExpense = currentCategoryManagerType === 'expense';
        const budgetValue = cat.budget || '';

        div.innerHTML = `
            <div style="
                width: 50px;
                height: 50px;
                border-radius: var(--radius);
                background: ${cat.color};
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                border: 2px solid ${cat.color};
            ">
                <i class="fas ${cat.icon || 'fa-tag'}" style="color: white; font-size: 1.2rem;"></i>
            </div>
            <div style="flex: 1;">
                <div style="font-weight: 800; font-size: 1.1rem; text-transform: uppercase; margin-bottom: 5px;">${cat.name}</div>
                ${isExpense ? `
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-wallet" style="color: var(--text-secondary); font-size: 0.9rem;"></i>
                        <input type="number"
                            id="budget_${cat.name}"
                            value="${budgetValue}"
                            placeholder="设置月度预算"
                            onchange="updateCategoryBudget('${cat.name}', this.value)"
                            style="width: 150px; padding: 6px 10px; font-size: 0.9rem;"
                            min="0" step="100">
                        <span style="font-size: 0.85rem; color: var(--text-secondary);">元/月</span>
                    </div>
                ` : ''}
            </div>
            <button class="btn" onclick="deleteCategory(${index})" style="
                background: var(--danger-color);
                color: white;
                padding: 8px 15px;
                font-size: 0.85rem;
            ">
                <i class="fas fa-trash"></i> 删除
            </button>
        `;

        listContainer.appendChild(div);
    });
}

// 更新分类预算
window.updateCategoryBudget = (catName, value) => {
    const categories = financeCats[currentCategoryManagerType];
    const cat = categories.find(c => c.name === catName);

    if (cat) {
        cat.budget = value ? parseFloat(value) : null;
        saveCustomCategories();
        showSyncToast(`${catName} 预算已更新`, 'success');
    }
};

// 添加新分类
window.addNewCategory = () => {
    const name = document.getElementById('newCategoryName').value.trim();
    const color = document.getElementById('newCategoryColor').value;
    const icon = document.getElementById('newCategoryIcon').value;

    if (!name) {
        showSyncToast('请输入分类名称', 'error');
        return;
    }

    // 检查是否重名
    const categories = financeCats[currentCategoryManagerType];
    if (categories.some(cat => cat.name === name)) {
        showSyncToast('分类名称已存在', 'error');
        return;
    }

    // 添加新分类
    categories.push({
        name: name,
        color: color,
        icon: icon
    });

    // 保存并重新渲染
    saveCustomCategories();
    renderCategoryManager();

    // 清空输入
    document.getElementById('newCategoryName').value = '';

    // 更新记账界面的分类选择器
    updateCategorySelectors();

    showSyncToast('分类添加成功', 'success');
};

// 删除分类
window.deleteCategory = async (index) => {
    const categories = financeCats[currentCategoryManagerType];
    const cat = categories[index];

    if (categories.length <= 1) {
        showSyncToast('至少需要保留一个分类', 'error');
        return;
    }

    const confirmed = await showConfirm('删除分类', `确定删除"${cat.name}"分类吗？`);
    if (confirmed === 0) {
        return;
    }

    categories.splice(index, 1);
    saveCustomCategories();
    renderCategoryManager();
    updateCategorySelectors();

    showSyncToast('分类已删除', 'success');
};

// 恢复默认分类
window.resetCategoriesToDefault = async () => {
    const confirmed = await showConfirm('恢复默认分类', '确定要恢复默认分类吗？这将删除所有自定义分类。');
    if (confirmed === 0) {
        return;
    }

    financeCats.expense = JSON.parse(JSON.stringify(defaultFinanceCats.expense));
    financeCats.income = JSON.parse(JSON.stringify(defaultFinanceCats.income));

    saveCustomCategories();
    renderCategoryManager();
    updateCategorySelectors();

    showSyncToast('已恢复默认分类', 'success');
};

// 更新记账界面的分类选择器
function updateCategorySelectors() {
    // 更新添加交易的分类选择器
    updateSingleCategorySelector('transCategoryCustom', 'transCategory');
    updateSingleCategorySelector('editTransCategoryCustom', 'editTransCategory');
    updateSingleCategorySelector('expenseFilterCategoryCustom', 'expenseFilterCategory');
}

function updateSingleCategorySelector(customId, selectId) {
    const customSelect = document.getElementById(customId);
    if (!customSelect) return;

    const optionsContainer = customSelect.querySelector('.custom-select-options');
    const trigger = customSelect.querySelector('.custom-select-trigger');
    const select = document.getElementById(selectId);

    if (!optionsContainer || !trigger || !select) return;

    // 获取当前选中的值
    const currentValue = trigger.dataset.value || '';

    // 清空选项
    optionsContainer.innerHTML = '';
    select.innerHTML = '';

    // 添加新选项
    const categories = getAllCategories();
    categories.forEach((cat, index) => {
        // 原生 select
        const opt = document.createElement('option');
        opt.value = cat.name;
        opt.innerText = cat.name;
        select.appendChild(opt);

        // 自定义选项
        const optionDiv = document.createElement('div');
        optionDiv.className = 'custom-select-option';
        optionDiv.dataset.value = cat.name;
        optionDiv.innerHTML = `<i class="fas ${cat.icon}" style="color: ${cat.color}; margin-right: 5px;"></i> ${cat.name}`;
        optionDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            trigger.innerText = cat.name;
            trigger.dataset.value = cat.name;
            select.value = cat.name;
            optionsContainer.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
            optionDiv.classList.add('selected');
            customSelect.classList.remove('open');
        });
        optionsContainer.appendChild(optionDiv);
    });

    // 恢复选中状态
    if (currentValue && categories.some(cat => cat.name === currentValue)) {
        trigger.innerText = currentValue;
        trigger.dataset.value = currentValue;
        select.value = currentValue;
    } else if (categories.length > 0) {
        trigger.innerText = categories[0].name;
        trigger.dataset.value = categories[0].name;
        select.value = categories[0].name;
    }
}

// --- 通用 ---
// 根据任务数量更新输入区域状态（仅在添加/删除任务时调用）

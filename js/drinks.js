// 奶茶/咖啡摄入追踪

let currentDrinkType = 'milktea';

    window.selectDrinkType = function(type) {
        currentDrinkType = type;
        const mtLabel = document.getElementById('drinkTypeMilktea');
        const cfLabel = document.getElementById('drinkTypeCoffee');
        const mtDot = document.getElementById('drinkRadioMtDot');
        const cfDot = document.getElementById('drinkRadioCfDot');
        const sugarRow = document.getElementById('mtSugarRow');
        if (type === 'milktea') {
            mtLabel.style.borderColor = 'var(--accent-color)';
            cfLabel.style.borderColor = 'var(--border-color)';
            mtDot.style.background = 'var(--accent-color)';
            cfDot.style.background = 'transparent';
            sugarRow.style.display = '';
        } else {
            mtLabel.style.borderColor = 'var(--border-color)';
            cfLabel.style.borderColor = 'var(--accent-color)';
            mtDot.style.background = 'transparent';
            cfDot.style.background = 'var(--accent-color)';
            sugarRow.style.display = 'none';
        }
    };

    window.setDrinkFilter = function(filter) {
        state.drinkViewFilter = filter;
        save();
        // 更新标签样式
        document.querySelectorAll('#drinkFilterTabs .drink-tab').forEach(btn => {
            if (btn.dataset.filter === filter) {
                btn.style.background = 'var(--accent-color)';
                btn.style.color = 'white';
                btn.classList.add('active');
            } else {
                btn.style.background = 'transparent';
                btn.style.color = 'var(--text-secondary)';
                btn.classList.remove('active');
            }
        });
        renderMilkteaView();
    };

    window.openMilkteaModal = function () {
        document.getElementById('mtDateInput').valueAsDate = new Date();
        document.getElementById('mtAmountInput').value = 1;
        document.getElementById('mtCostInput').value = '';
        document.getElementById('mtBrandInput').value = '';
        document.getElementById('mtNotesInput').value = '';
        document.getElementById('mtSugarInput').value = '三分甜';
        // 默认类型根据当前筛选
        if (state.drinkViewFilter === 'coffee') {
            selectDrinkType('coffee');
        } else {
            selectDrinkType('milktea');
        }
        openModal('milkteaModal');
    };

window.saveMilkteaRecord = function () {
                const dateStr = document.getElementById('mtDateInput').value;
                const amount = parseFloat(document.getElementById('mtAmountInput').value);
                const cost = parseFloat(document.getElementById('mtCostInput').value);
                const sugar = currentDrinkType === 'milktea' ? document.getElementById('mtSugarInput').value : '';
                const brand = (document.getElementById('mtBrandInput').value || '').trim();
                const notes = document.getElementById('mtNotesInput').value.trim();

                if (!dateStr || isNaN(amount) || amount <= 0) {
                    showSyncToast('请输入有效的日期和杯数');
                    return;
                }
                if (isNaN(cost) || cost <= 0) {
                    showSyncToast('请输入有效的金额');
                    return;
                }

                const record = {
                    id: uniqueDrinkId(currentDrinkType),
                    date: dateStr,
                    amount,
                    price: cost / amount,
                    cost,
                    sugar,
                    name: brand,
                    brand,
                    note: notes,
                    notes,
                    drinkType: currentDrinkType,
                    updatedAt: new Date().toISOString()
                };

                // 存入对应数据集
                if (currentDrinkType === 'coffee') {
                    state.coffee.records.push(record);
                } else {
                    state.milktea.records.push(record);
                }

                // 同步到记账（支出）- 奶茶对应奶茶类、咖啡对应咖啡类
                const category = currentDrinkType === 'coffee' ? '咖啡' : '奶茶';
                const drinkLabel = currentDrinkType === 'coffee' ? '咖啡消费' : '奶茶消费';
                const transaction = {
                    id: 'mt_' + record.id,
                    type: 'expense',
                    amount: cost,
                    category: category,
                    date: dateStr,
                    note: (brand ? brand + ' ' : '') + (notes || drinkLabel),
                    milkteaRecordId: record.id,
                    updatedAt: record.updatedAt
                };
                state.transactions.push(transaction);

                save();
                closeModal('milkteaModal');
                showSyncToast(currentDrinkType === 'coffee' ? '☕ 咖啡记录成功！' : '🧋 奶茶记录成功！');
                renderMilkteaView();
            };

    window.openMilkteaSettings = function () {
        document.getElementById('mtWeeklyLimitInput').value = state.milktea.settings.weeklyLimit;
        document.getElementById('mtMonthlyLimitInput').value = state.milktea.settings.monthlyLimit;
        document.getElementById('cfWeeklyLimitInput').value = state.coffee.settings.weeklyLimit;
        document.getElementById('cfMonthlyLimitInput').value = state.coffee.settings.monthlyLimit;
        openModal('milkteaSettingsModal');
    };

window.saveMilkteaSettings = function () {
                const wLimit = parseInt(document.getElementById('mtWeeklyLimitInput').value, 10);
                const mLimit = parseInt(document.getElementById('mtMonthlyLimitInput').value, 10);
                const cfWLimit = parseInt(document.getElementById('cfWeeklyLimitInput').value, 10);
                const cfMLimit = parseInt(document.getElementById('cfMonthlyLimitInput').value, 10);

                if (isNaN(wLimit) || isNaN(mLimit) || wLimit < 0 || mLimit < 0 || isNaN(cfWLimit) || isNaN(cfMLimit) || cfWLimit < 0 || cfMLimit < 0) {
                    showSyncToast('请输入有效的额度');
                    return;
                }

                state.milktea.settings.weeklyLimit = wLimit;
                state.milktea.settings.monthlyLimit = mLimit;
                state.coffee.settings.weeklyLimit = cfWLimit;
                state.coffee.settings.monthlyLimit = cfMLimit;
                const settingsUpdatedAt = new Date().toISOString();
                state.milktea.settings.updatedAt = settingsUpdatedAt;
                state.coffee.settings.updatedAt = settingsUpdatedAt;
                save();
                closeModal('milkteaSettingsModal');
                showSyncToast('额度设定保存成功');
                renderMilkteaView();
            };

    // 热力图当前显示月份（独立于今日）
    if (typeof state.mtHeatmapYear === 'undefined') {
        const _now = new Date();
        state.mtHeatmapYear = _now.getFullYear();
        state.mtHeatmapMonth = _now.getMonth();
    }

    window.changeMtHeatmapMonth = function (delta) {
        state.mtHeatmapMonth += delta;
        if (state.mtHeatmapMonth > 11) { state.mtHeatmapMonth = 0; state.mtHeatmapYear++; }
        if (state.mtHeatmapMonth < 0) { state.mtHeatmapMonth = 11; state.mtHeatmapYear--; }
        renderMilkteaView();
    };

    // 获取当前筛选下的记录
function getDrinkRecords() {
                const filter = state.drinkViewFilter;
                const milktea = state.milktea.records.map(record => ({ ...record, drinkType: 'milktea' }));
                const coffee = state.coffee.records.map(record => ({ ...record, drinkType: 'coffee' }));
                if (filter === 'milktea') return milktea;
                if (filter === 'coffee') return coffee;
                return [...milktea, ...coffee];
            }

    function getDrinkSettings() {
        const filter = state.drinkViewFilter;
        if (filter === 'milktea') return state.milktea.settings;
        if (filter === 'coffee') return state.coffee.settings;
        // 全部模式：合并额度
        return {
            weeklyLimit: state.milktea.settings.weeklyLimit + state.coffee.settings.weeklyLimit,
            monthlyLimit: state.milktea.settings.monthlyLimit + state.coffee.settings.monthlyLimit
        };
    }

    window.renderMilkteaView = function () {
        const records = getDrinkRecords();
        const settings = getDrinkSettings();
        const filter = state.drinkViewFilter;
        const today = new Date();
        const currYear = today.getFullYear();
        const currMonth = today.getMonth(); // 0-11

        // 初始化筛选标签样式
        document.querySelectorAll('#drinkFilterTabs .drink-tab').forEach(btn => {
            if (btn.dataset.filter === filter) {
                btn.style.background = 'var(--accent-color)';
                btn.style.color = 'white';
            } else {
                btn.style.background = 'transparent';
                btn.style.color = 'var(--text-secondary)';
            }
        });

        // 计算本周范围 (周一到周日)
        const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - dayOfWeek + 1);
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        // 过滤本周和本月记录
        let weeklyAmount = 0;
        let monthlyAmount = 0;
        let monthlyCost = 0;
        const sugarCounts = {};
        const monthRecords = [];

        records.forEach(r => {
            const rDate = new Date(r.date);
            if (rDate.getFullYear() === currYear && rDate.getMonth() === currMonth) {
                monthlyAmount += r.amount;
                monthlyCost += r.cost;
                monthRecords.push(r);
                if (r.sugar) {
                    sugarCounts[r.sugar] = (sugarCounts[r.sugar] || 0) + 1;
                }
            }
            if (rDate >= startOfWeek && rDate <= endOfWeek) {
                weeklyAmount += r.amount;
            }
        });

        // 设置进度环颜色
        const weeklyProgressEl = document.getElementById('mtWeeklyProgress');
        const monthlyProgressEl = document.getElementById('mtMonthlyProgress');
        if (filter === 'coffee') {
            weeklyProgressEl.style.stroke = '#8b6914';
            monthlyProgressEl.style.stroke = '#b8860b';
        } else if (filter === 'milktea') {
            weeklyProgressEl.style.stroke = 'var(--accent-color)';
            monthlyProgressEl.style.stroke = 'var(--warning-color)';
        } else {
            weeklyProgressEl.style.stroke = 'var(--accent-color)';
            monthlyProgressEl.style.stroke = 'var(--warning-color)';
        }

        // 更新仪表盘文字
        document.getElementById('mtWeeklyText').textContent = `${weeklyAmount}/${settings.weeklyLimit}`;
        document.getElementById('mtMonthlyText').textContent = `${monthlyAmount}/${settings.monthlyLimit}`;

        // 更新仪表盘 SVG 进度 (175.93 是圆周长, r=28)
        const updateProgress = (elementId, current, limit) => {
            const el = document.getElementById(elementId);
            const perc = limit > 0 ? Math.min(current / limit, 1) : 0;
            const offset = 175.93 - (perc * 175.93);
            el.style.strokeDashoffset = offset;
        };

        updateProgress('mtWeeklyProgress', weeklyAmount, settings.weeklyLimit);
        updateProgress('mtMonthlyProgress', monthlyAmount, settings.monthlyLimit);

        // 更新数据洞察
        document.getElementById('mtTotalCost').textContent = `￥${monthlyCost.toFixed(2)}`;
        const avgCost = monthlyAmount > 0 ? (monthlyCost / monthRecords.length) : 0;
        document.getElementById('mtAvgCost').textContent = `￥${avgCost.toFixed(2)}`;

        // 总额行（仅全部模式时显示）
        const totalRow = document.getElementById('drinkTotalRow');
        if (filter === 'all') {
            totalRow.style.display = 'block';
            // 分别计算奶茶和咖啡的花费
            let mtCost = 0, cfCost = 0;
            state.milktea.records.forEach(r => {
                const rDate = new Date(r.date);
                if (rDate.getFullYear() === currYear && rDate.getMonth() === currMonth) mtCost += r.cost;
            });
            state.coffee.records.forEach(r => {
                const rDate = new Date(r.date);
                if (rDate.getFullYear() === currYear && rDate.getMonth() === currMonth) cfCost += r.cost;
            });
            document.getElementById('drinkTotalCost').textContent = `￥${(mtCost + cfCost).toFixed(2)}  (🧋${mtCost.toFixed(0)} + ☕${cfCost.toFixed(0)})`;
        } else {
            totalRow.style.display = 'none';
        }

        let favSugar = '无';
        let maxCount = 0;
        for (const [sugar, count] of Object.entries(sugarCounts)) {
            if (count > maxCount) {
                maxCount = count;
                favSugar = sugar;
            }
        }
        document.getElementById('mtFavSugar').textContent = favSugar;

        // 甜度标签 - 咖啡模式不显示甜度
        const sugarStatEl = document.getElementById('mtFavSugar').parentElement;
        if (filter === 'coffee') {
            sugarStatEl.querySelector('div:first-child').textContent = '类型';
            document.getElementById('mtFavSugar').textContent = '☕ 咖啡';
            document.getElementById('mtFavSugar').style.color = '#8b6914';
        } else {
            sugarStatEl.querySelector('div:first-child').textContent = '甜度';
            document.getElementById('mtFavSugar').style.color = 'var(--warning-color)';
        }

        // 心理建议提示词
        const msgEl = document.getElementById('mtInsightMessage');
        const drinkName = filter === 'coffee' ? '咖啡' : filter === 'milktea' ? '奶茶' : '饮品';
        if (weeklyAmount >= settings.weeklyLimit) {
            msgEl.textContent = `💔 本周${drinkName}额度已达标，为了健康，请克制一下哦！`;
            msgEl.style.color = 'var(--danger-color)';
            msgEl.style.borderColor = 'var(--danger-color)';
        } else if (monthlyAmount >= settings.monthlyLimit) {
            msgEl.textContent = `🚨 本月${drinkName}额度已爆表，快去喝点热水吧！`;
            msgEl.style.color = 'var(--danger-color)';
            msgEl.style.borderColor = 'var(--danger-color)';
        } else if (weeklyAmount === 0) {
            msgEl.textContent = `🌟 哇！本周还没喝${drinkName}，继续保持健康作息！`;
            msgEl.style.color = 'var(--success-color)';
            msgEl.style.borderColor = 'var(--success-color)';
        } else {
            msgEl.textContent = `💪 本周还能喝 ${settings.weeklyLimit - weeklyAmount} 杯${drinkName}，合理分配！`;
            msgEl.style.color = 'var(--accent-color)';
            msgEl.style.borderColor = 'var(--accent-color)';
        }

        // 渲染热力图（用独立月份状态，默认当月）
        state.mtHeatmapYear = state.mtHeatmapYear ?? currYear;
        state.mtHeatmapMonth = state.mtHeatmapMonth ?? currMonth;
        const heatRecords = records.filter(r => {
            const d = new Date(r.date);
            return d.getFullYear() === state.mtHeatmapYear && d.getMonth() === state.mtHeatmapMonth;
        });
        renderMilkteaHeatmap(state.mtHeatmapYear, state.mtHeatmapMonth, heatRecords);
    };

    function renderMilkteaHeatmap(year, month, monthRecords) {
        const heatmapEl = document.getElementById('mtHeatmap');
        const labelEl = document.getElementById('mtMonthLabel');
        labelEl.textContent = `(${year}年${month + 1}月)`;
        heatmapEl.innerHTML = '';

        // 获取当月天数
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // 建立日期 -> 杯数的映射
        const dayMap = {};
        monthRecords.forEach(r => {
            const day = new Date(r.date).getDate();
            dayMap[day] = (dayMap[day] || 0) + r.amount;
        });

        for (let i = 1; i <= daysInMonth; i++) {
            const amount = dayMap[i] || 0;
            let bgColor = 'var(--bg-color)';
            let textColor = 'var(--text-secondary)';
            let opacity = 1;

            if (amount > 0) {
                if (amount < 1) opacity = 0.4;
                else if (amount === 1) opacity = 0.7;
                else opacity = 1.0;

                // 根据当前筛选使用不同颜色
                const filter = state.drinkViewFilter;
                if (filter === 'coffee') {
                    bgColor = `rgba(139, 105, 20, ${opacity})`; // 咖啡色
                } else if (filter === 'milktea') {
                    bgColor = `rgba(236, 72, 153, ${opacity})`; // 粉红色
                } else {
                    bgColor = `rgba(111, 194, 255, ${opacity})`; // 蓝色表示合并
                }
                textColor = '#fff';
            }

            const dayBlock = document.createElement('div');
            dayBlock.style.cssText = `
            aspect-ratio: 1;
            background: ${bgColor};
            color: ${textColor};
            border-radius: var(--radius);
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 0.8rem;
            font-weight: 700;
            border: 2px solid var(--border-color);
            cursor: pointer;
            transition: transform 0.2s;
        `;
            dayBlock.textContent = i;
            const dayNum = i;
            dayBlock.onclick = () => {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                renderMilkteaDayRecords(dateStr);
            };
            if (amount > 0) {
                dayBlock.title = `${year}-${month + 1}-${i}: 喝了 ${amount} 杯`;
                dayBlock.onmouseover = () => dayBlock.style.transform = 'scale(1.1)';
                dayBlock.onmouseout = () => dayBlock.style.transform = 'scale(1)';
            }

            heatmapEl.appendChild(dayBlock);
        }
    }

    // 渲染某日的饮品记录
function renderMilkteaDayRecords(dateStr) {
                const container = document.getElementById('mtDayRecords');
                const listEl = document.getElementById('mtDayRecordsList');
                if (!container || !listEl) return;

                const dayRecords = getDrinkRecords().filter(r => r.date === dateStr);
                if (dayRecords.length === 0) {
                    container.style.display = 'block';
                    listEl.innerHTML = `<div style="text-align: center; padding: 15px; color: var(--text-secondary); font-size: 0.85rem;">该日无记录</div>`;
                    return;
                }

                container.style.display = 'block';
                listEl.innerHTML = dayRecords.map(r => {
                    const typeIcon = (r.drinkType === 'coffee') ? '☕' : '🧋';
                    const defaultName = (r.drinkType === 'coffee') ? '咖啡' : '奶茶';
                    return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: var(--bg-color); border: 2px solid var(--border-color); border-radius: var(--radius);">
                        <div>
                            <div style="font-weight: 800; font-size: 0.85rem;">${typeIcon} ${r.brand || defaultName} x${r.amount}</div>
                            <div style="font-size: 0.75rem; color: var(--text-secondary);">${r.sugar || ''} ${r.cost > 0 ? '￥' + r.cost : ''}</div>
                            ${r.notes ? `<div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 2px;">${r.notes}</div>` : ''}
                        </div>
                        <button class="btn" onclick='deleteMilkteaRecord(${JSON.stringify(r.drinkType)}, ${JSON.stringify(String(r.id))})' style="padding: 4px 8px; font-size: 0.75rem; color: var(--danger-color); border-color: var(--danger-color);">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>`;
                }).join('');
            }

    // 删除饮品记录（同步删除对应交易）
window.deleteMilkteaRecord = function (type, recordId) {
                const collection = type === 'coffee' ? state.coffee : state.milktea;
                collection.records = collection.records.filter(r => String(r.id) !== String(recordId));
                const expectedCategory = type === 'coffee' ? '咖啡' : '奶茶';
                // 同步删除交易记录
                const deletedTransactions = state.transactions.filter(t => (
                    sameFinanceTransactionId(t.id, 'mt_' + recordId)
                    || String(t.milkteaRecordId) === String(recordId)
                ) && (
                    String(recordId).startsWith(`${type}_`) || t.category === expectedCategory
                ));
                state.transactions = state.transactions.filter(t => !deletedTransactions.includes(t));
                state.deletedIds.push(
                    drinkRecordTombstone(type, recordId),
                    ...deletedTransactions.map(financeTransactionTombstone)
                );
                state.deletedIds = [...new Set(state.deletedIds)];
                save();
                showSyncToast('记录已删除');
                renderMilkteaView();
            };

    // ===== 每日计划逻辑 =====

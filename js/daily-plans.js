// 每日计划


    function renderDailyPlans() {
        // 只在今日视图时渲染
        if (state.filter !== 'today') return;

        const listEl = document.getElementById('dailyPlanList');
        const emptyEl = document.getElementById('dailyPlanEmpty');
        if (!listEl) return;

        const todayStr = new Date().toISOString().split('T')[0];
        let plans = (state.dailyPlans || []).filter(p => p.date === todayStr);
        plans.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
            if (a.startTime) return -1;
            if (b.startTime) return 1;
            return 0;
        });

        if (plans.length === 0) {
            listEl.innerHTML = '';
            if (emptyEl) emptyEl.style.display = 'block';
            return;
        }
        if (emptyEl) emptyEl.style.display = 'none';

        listEl.innerHTML = plans.map(p => {
            const timeLabel = p.startTime ? `${p.startTime}${p.endTime ? ' - ' + p.endTime : ''}` : '';
            return `
            <div class="todo-item" style="padding: 12px 15px; background: var(--card-bg); border: 3px solid var(--border-color); border-left: 5px solid var(--warning-color); border-radius: var(--radius); box-shadow: var(--shadow); ${p.completed ? 'opacity: 0.6;' : ''} transition: transform 0.2s;">
                <div style="display: flex; align-items: flex-start; gap: 10px;">
                    <input type="checkbox" ${p.completed ? 'checked' : ''} onchange="toggleDailyPlan(${p.id})" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--warning-color); margin-top: 2px;">
                    <div style="flex: 1; min-width: 0; cursor: pointer;" onclick="editDailyPlan(${p.id})">
                        <div style="font-weight: 800; font-size: 0.95rem; text-align: left; ${p.completed ? 'text-decoration: line-through; color: var(--text-secondary);' : ''}">${escapeHtml(p.text)}</div>
                        ${timeLabel ? `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px; text-align: left;"><i class="far fa-clock"></i> ${timeLabel}</div>` : ''}
                    </div>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 8px;">
                    <i class="fas fa-pen action-icon" onclick="editDailyPlan(${p.id})" title="编辑" style="cursor:pointer;"></i>
                    <i class="fas fa-trash action-icon" onclick="deleteDailyPlan(${p.id})" title="删除" style="color:var(--danger-color); cursor:pointer;"></i>
                </div>
            </div>`;
        }).join('');
    }

    let editingDailyPlanId = null;

    window.openAddDailyPlan = function () {
        editingDailyPlanId = null;
        document.getElementById('dpTextInput').value = '';
        document.getElementById('dpStartTimeInput').value = '';
        document.getElementById('dpEndTimeInput').value = '';
        document.querySelector('#dailyPlanModal h2').textContent = '添加每日计划';
        openModal('dailyPlanModal');
    };

window.editDailyPlan = function (id) {
                const plan = state.dailyPlans.find(p => sameEntityId(p.id, id));
                if (!plan) return;

                editingDailyPlanId = id;
                document.getElementById('dpTextInput').value = plan.text || '';
                document.getElementById('dpStartTimeInput').value = plan.startTime || '';
                document.getElementById('dpEndTimeInput').value = plan.endTime || '';
                document.querySelector('#dailyPlanModal h2').textContent = '编辑每日计划';
                openModal('dailyPlanModal');
            };

window.saveDailyPlan = function () {
                const text = document.getElementById('dpTextInput').value.trim();
                if (!text) { showSyncToast('请输入计划内容'); return; }

                if (editingDailyPlanId) {
                    // 编辑现有计划
                    const plan = state.dailyPlans.find(p => sameEntityId(p.id, editingDailyPlanId));
                    if (plan) {
                        plan.text = text;
                        plan.startTime = document.getElementById('dpStartTimeInput').value || '';
                        plan.endTime = document.getElementById('dpEndTimeInput').value || '';
                    }
                } else {
                    // 添加新计划
                    state.dailyPlans.push({
                        id: uniqueId(),
                        date: new Date().toISOString().split('T')[0],
                        text,
                        startTime: document.getElementById('dpStartTimeInput').value || '',
                        endTime: document.getElementById('dpEndTimeInput').value || '',
                        completed: false
                    });
                }

                save();
                closeModal('dailyPlanModal');
                renderDailyPlans();
                editingDailyPlanId = null;
            };

window.toggleDailyPlan = function (id) {
                const p = state.dailyPlans.find(p => sameEntityId(p.id, id));
                if (p) { p.completed = !p.completed; save(); renderDailyPlans(); }
            };

window.deleteDailyPlan = async function (id) {
                const confirmed = await showConfirm('删除计划', '确定要删除这个计划吗？', ['取消', '删除']);
                if (confirmed === 0) return;
                // 记录删除ID
                const tombstone = entityTombstone('daily-plan', id);
                if (!state.deletedIds.includes(tombstone)) {
                    state.deletedIds.push(tombstone);
                }
                state.dailyPlans = state.dailyPlans.filter(p => !sameEntityId(p.id, id));
                save();
                renderDailyPlans();
            };

    // 启动桌面小组件

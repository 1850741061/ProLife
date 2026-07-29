// 习惯打卡


function initHabits() {
    const habitBtn = document.getElementById('habitBtn');
    habitBtn.onclick = () => {
        openModal('habitModal');
        renderHabits();
    };
}

function openAddHabitModal() {
    editingHabitId = null;
    selectedHabitIcon = 'fa-check';
    selectedHabitColor = '#3b82f6';

    document.getElementById('habitModalTitle').textContent = '添加习惯';
    document.getElementById('habitNameInput').value = '';
    document.getElementById('habitFrequency').value = 'daily';
    document.getElementById('habitNotes').value = '';

    renderHabitIcons();
    renderHabitColors();

    openModal('addHabitModal');
}

function renderHabitIcons() {
    const grid = document.getElementById('habitIconGrid');
    grid.innerHTML = habitIcons.map(icon => `
        <div class="habit-icon-option ${icon === selectedHabitIcon ? 'selected' : ''}"
             onclick="selectHabitIcon('${icon}')"
             style="padding: 10px; text-align: center; cursor: pointer; border: 3px solid var(--border-color); border-radius: var(--radius); transition: var(--transition);">
            <i class="fas ${icon}" style="font-size: 1.5rem; color: var(--text-secondary);"></i>
        </div>
    `).join('');

    // 更新选中状态的样式
    grid.querySelectorAll('.habit-icon-option.selected').forEach(el => {
        el.style.borderColor = selectedHabitColor;
        el.style.background = selectedHabitColor + '20';
        el.querySelector('i').style.color = selectedHabitColor;
    });
}

function selectHabitIcon(icon) {
    selectedHabitIcon = icon;
    renderHabitIcons();
}

function renderHabitColors() {
    const grid = document.getElementById('habitColorGrid');
    grid.innerHTML = colors.slice(0, 12).map(color => `
        <div class="habit-color-option ${color === selectedHabitColor ? 'selected' : ''}"
             onclick="selectHabitColor('${color}')"
             style="width: 40px; height: 40px; border-radius: 50%; cursor: pointer;
                    border: 3px solid ${color === selectedHabitColor ? color : 'var(--border-color)'};
                    background: ${color}; transition: var(--transition);">
        </div>
    `).join('');
}

function selectHabitColor(color) {
    selectedHabitColor = color;
    renderHabitColors();
    renderHabitIcons(); // 更新图标选中状态的颜色
}

window.saveHabit = function () {
            const name = document.getElementById('habitNameInput').value.trim();
            if (!name) {
                showSyncToast('请输入习惯名称', 'error');
                return;
            }

            const frequency = document.getElementById('habitFrequency').value;
            const notes = document.getElementById('habitNotes').value.trim();

            if (editingHabitId) {
                // 编辑现有习惯
                const habit = state.habits.find(h => sameEntityId(h.id, editingHabitId));
                if (habit) {
                    habit.name = name;
                    habit.icon = selectedHabitIcon;
                    habit.color = selectedHabitColor;
                    habit.frequency = frequency;
                    habit.notes = notes;
                }
            } else {
                // 添加新习惯
                const newHabit = {
                    id: uniqueId(),
                    name,
                    icon: selectedHabitIcon,
                    color: selectedHabitColor,
                    frequency,
                    notes,
                    createdAt: new Date().toISOString()
                };
                state.habits.push(newHabit);
            }

            save();
            closeModal('addHabitModal');
            renderHabits();
        };

function renderHabits() {
    const container = document.getElementById('habitList');
    const emptyState = document.getElementById('habitEmptyState');

    if (state.habits.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    container.innerHTML = state.habits.map(habit => {
        const streak = calculateStreak(habit.id);
        const today = new Date().toISOString().split('T')[0];
        const isCompletedToday = state.habitRecords[habit.id] && state.habitRecords[habit.id][today];

        // 获取最近7天的打卡记录
        const last7Days = getLast7Days();
        const weekRecords = last7Days.map(date => ({
            date,
            completed: state.habitRecords[habit.id] && state.habitRecords[habit.id][date]
        }));

        return `
            <div style="background: var(--card-bg); border: 3px solid var(--border-color); border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow);">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                    <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                        <div style="width: 50px; height: 50px; border-radius: 50%; background: ${habit.color}20; display: flex; align-items: center; justify-content: center; border: 3px solid ${habit.color};">
                            <i class="fas ${habit.icon}" style="color: ${habit.color}; font-size: 1.5rem;"></i>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: 700; font-size: 1.1rem; margin-bottom: 4px;">${habit.name}</div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary);">
                                ${getFrequencyLabel(habit.frequency)}
                                ${streak > 0 ? `<span style="color: var(--accent-color); font-weight: 700; margin-left: 10px;"><i class="fas fa-fire"></i> ${streak}天</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn-icon" onclick="editHabit(${habit.id})" title="编辑" style="padding: 6px 10px;">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button class="btn-icon" onclick="deleteHabit(${habit.id})" title="删除" style="padding: 6px 10px; color: var(--danger-color);">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>

                <!-- 今日打卡按钮 -->
                <button class="btn ${isCompletedToday ? 'btn-success' : ''}"
                        onclick="toggleHabitCheckIn(${habit.id})"
                        style="width: 100%; margin-bottom: 15px; justify-content: center; ${isCompletedToday ? 'background: var(--success-color);' : ''}">
                    <i class="fas ${isCompletedToday ? 'fa-check-circle' : 'fa-circle'}"></i>
                    ${isCompletedToday ? '今日已完成' : '今日打卡'}
                </button>

                <!-- 最近7天打卡记录 -->
                <div style="display: flex; gap: 5px; justify-content: space-between;">
                    ${weekRecords.map(record => {
            const dayOfWeek = new Date(record.date).getDay();
            const dayLabels = ['日', '一', '二', '三', '四', '五', '六'];
            return `
                            <div style="flex: 1; text-align: center; padding: 8px 4px; border-radius: var(--radius);
                                       background: ${record.completed ? habit.color + '30' : 'var(--bg-color)'};
                                       border: 2px solid ${record.completed ? habit.color : 'var(--border-color)'};">
                                <div style="font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 4px;">${dayLabels[dayOfWeek]}</div>
                                <div style="width: 8px; height: 8px; border-radius: 50%; margin: 0 auto;
                                           background: ${record.completed ? habit.color : 'var(--text-secondary)'};"></div>
                            </div>
                        `;
        }).join('')}
                </div>

                ${habit.notes ? `<div style="margin-top: 10px; padding: 10px; background: var(--bg-color); border-radius: var(--radius); font-size: 0.85rem; color: var(--text-secondary);">${habit.notes}</div>` : ''}
            </div>
        `;
    }).join('');
}

function calculateStreak(habitId) {
    const records = state.habitRecords[habitId];
    if (!records) return 0;

    let streak = 0;
    let date = new Date();

    while (true) {
        const dateStr = date.toISOString().split('T')[0];
        if (records[dateStr]) {
            streak++;
            date.setDate(date.getDate() - 1);
        } else {
            break;
        }
    }

    return streak;
}

function getLast7Days() {
    const days = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        days.push(date.toISOString().split('T')[0]);
    }

    return days;
}

function getFrequencyLabel(frequency) {
    const labels = {
        'daily': '每天',
        'weekly': '每周',
        'monthly': '每月'
    };
    return labels[frequency] || frequency;
}

window.toggleHabitCheckIn = function (habitId) {
            const today = new Date().toISOString().split('T')[0];
            const tombstone = habitRecordTombstone(habitId, today);
            const eventTime = nextHabitRecordEventTime(
                state.habitRecords,
                state.deletedIds,
                habitId,
                today
            );

            if (!state.habitRecords[habitId]) {
                state.habitRecords[habitId] = {};
            }

            if (state.habitRecords[habitId][today]) {
                // 取消打卡
                delete state.habitRecords[habitId][today];
                state.deletedIds = [...new Set([
                    ...state.deletedIds.filter(id => String(id) !== tombstone),
                    tombstone,
                    habitRecordDeleteEvent(habitId, today, eventTime)
                ])];
            } else {
                // 打卡
                state.habitRecords[habitId][today] = eventTime;
                state.deletedIds = [...new Set([
                    ...state.deletedIds.filter(id => String(id) !== tombstone).map(String),
                    habitRecordLiveEvent(habitId, today, eventTime)
                ])];
            }

            save();
            renderHabits();
        };

window.editHabit = function (habitId) {
            const habit = state.habits.find(h => sameEntityId(h.id, habitId));
            if (!habit) return;

            editingHabitId = habitId;
            selectedHabitIcon = habit.icon;
            selectedHabitColor = habit.color;

            document.getElementById('habitModalTitle').textContent = '编辑习惯';
            document.getElementById('habitNameInput').value = habit.name;
            document.getElementById('habitFrequency').value = habit.frequency;
            document.getElementById('habitNotes').value = habit.notes || '';

            renderHabitIcons();
            renderHabitColors();

            openModal('addHabitModal');
        };

window.deleteHabit = async function (habitId) {
            const confirmed = await showConfirm(
                '删除习惯',
                '确定要删除这个习惯吗？打卡记录也会被删除。',
                ['取消', '删除']
            );
            if (confirmed === 0) return;

            // 记录删除的ID
            const tombstone = entityTombstone('habit', habitId);
            if (!state.deletedIds.includes(tombstone)) {
                state.deletedIds.push(tombstone);
            }
            state.habits = state.habits.filter(h => !sameEntityId(h.id, habitId));
            delete state.habitRecords[habitId];

            save();
            renderHabits();
        };

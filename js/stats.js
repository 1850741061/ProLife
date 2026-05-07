// 数据统计与图表


function initStats() {
    document.getElementById('statsBtn').onclick = () => {
        openStatsModal();
    };
}

// 打开数据统计模态框
function openStatsModal() {
    updateStatsCards();
    renderGroupDistributionChart();
    renderHabitStreakChart();
    renderProjectStatsList();
    openModal('statsModal');
}

// 更新统计卡片
function updateStatsCards() {
    const total = state.todos.length;
    const completed = state.todos.filter(t => t.completed).length;
    const pending = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    document.getElementById('statTotalTasks').textContent = total;
    document.getElementById('statCompleted').textContent = completed;
    document.getElementById('statPending').textContent = pending;
    document.getElementById('statCompletionRate').textContent = completionRate + '%';

    // 新功能统计
    document.getElementById('statHabits').textContent = state.habits.length;
    document.getElementById('statProjects').textContent = state.projects.length;

    // 计算今日打卡数
    const today = new Date().toISOString().split('T')[0];
    let todayCheckIns = 0;
    Object.values(state.habitRecords).forEach(records => {
        if (records[today]) todayCheckIns++;
    });
    document.getElementById('statCheckIns').textContent = todayCheckIns;

    // 归档任务数
    document.getElementById('statArchived').textContent = state.archivedTodos.length;
}

function hexToRgba(color, alpha) {
    if (!color) return `rgba(0, 0, 0, ${alpha})`;
    const value = color.trim();

    if (value.startsWith('#')) {
        let hex = value.slice(1);
        if (hex.length === 3) {
            hex = hex.split('').map(ch => ch + ch).join('');
        }
        if (hex.length !== 6) return value;
        const parsed = parseInt(hex, 16);
        const r = (parsed >> 16) & 255;
        const g = (parsed >> 8) & 255;
        const b = parsed & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    if (value.startsWith('rgb(')) {
        return value.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
    }

    if (value.startsWith('rgba(')) {
        return value.replace(/rgba\(([^)]+),\s*[\d.]+\)/, `rgba($1, ${alpha})`);
    }

    return value;
}

function getChartThemeTokens() {
    const styles = getComputedStyle(document.body);
    const text = styles.getPropertyValue('--text-main').trim() || '#374151';
    const textMuted = styles.getPropertyValue('--text-secondary').trim() || '#6b7280';
    const border = styles.getPropertyValue('--border-color').trim() || '#d1d5db';
    const accent = styles.getPropertyValue('--accent-color').trim() || '#6fc2ff';
    const success = styles.getPropertyValue('--success-color').trim() || '#10b981';
    const surface = styles.getPropertyValue('--card-bg').trim() || '#ffffff';

    return {
        text,
        textMuted,
        border,
        accent,
        success,
        surface,
        grid: hexToRgba(border, 0.18),
        accentSoft: hexToRgba(accent, 0.16),
        successSoft: hexToRgba(success, 0.16)
    };
}

// 渲染分组任务分布饼图
function renderGroupDistributionChart() {
    const canvas = document.getElementById('groupDistributionChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const chartTheme = getChartThemeTokens();

    // 销毁旧图表
    if (groupChart) {
        groupChart.destroy();
    }

    // 统计每个分组的任务数（不包含项目任务）
    const groupCounts = {};
    state.groups.forEach(g => {
        groupCounts[g.id] = 0;
    });

    // 只统计分组任务
    state.todos.forEach(t => {
        if (!t.projectId && groupCounts.hasOwnProperty(t.groupId)) {
            groupCounts[t.groupId]++;
        }
    });

    const labels = [];
    const data = [];
    const colors = [];

    // 添加分组数据
    state.groups.forEach(g => {
        if (groupCounts[g.id] > 0) {
            labels.push(g.name);
            data.push(groupCounts[g.id]);
            colors.push(g.color);
        }
    });

    groupChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 3,
                borderColor: chartTheme.surface
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: chartTheme.text,
                        padding: 15,
                        font: {
                            size: 12,
                            weight: '700'
                        }
                    }
                }
            }
        }
    });
}

// 渲染7天完成趋势图
function renderCompletionTrendChart() {
    const canvas = document.getElementById('completionTrendChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const chartTheme = getChartThemeTokens();

    // 销毁旧图表
    if (trendChart) {
        trendChart.destroy();
    }

    // 获取最近7天的日期
    const labels = [];
    const completedData = [];
    const createdData = [];

    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        labels.push(dateStr.substring(5)); // MM-DD

        // 统计该天完成的任务数
        const completedCount = state.todos.filter(t => {
            if (!t.updatedAt) return false;
            const updateDate = t.updatedAt.split('T')[0];
            return t.completed && updateDate === dateStr;
        }).length;

        // 统计该天创建的任务数
        const createdCount = state.todos.filter(t => {
            if (!t.createdAt) return false;
            const createDate = t.createdAt.split('T')[0];
            return createDate === dateStr;
        }).length;

        completedData.push(completedCount);
        createdData.push(createdCount);
    }

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '已完成',
                    data: completedData,
                    borderColor: chartTheme.success,
                    backgroundColor: chartTheme.successSoft,
                    borderWidth: 3,
                    tension: 0.3,
                    fill: true
                },
                {
                    label: '新建',
                    data: createdData,
                    borderColor: chartTheme.accent,
                    backgroundColor: chartTheme.accentSoft,
                    borderWidth: 3,
                    tension: 0.3,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: chartTheme.text,
                        padding: 15,
                        font: {
                            size: 12,
                            weight: '700'
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: chartTheme.grid
                    },
                    ticks: {
                        stepSize: 1,
                        color: chartTheme.text
                    }
                },
                x: {
                    grid: {
                        color: chartTheme.grid
                    },
                    ticks: {
                        color: chartTheme.text
                    }
                }
            }
        }
    });
}

// 渲染连续打卡统计图表
function renderHabitStreakChart() {
    const canvas = document.getElementById('habitStreakChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const chartTheme = getChartThemeTokens();

    // 销毁旧图表
    if (habitStreakChart) {
        habitStreakChart.destroy();
    }

    // 准备数据：每个习惯的连续打卡天数
    const labels = [];
    const streakData = [];
    const chartColors = [];

    state.habits.forEach(habit => {
        // 计算连续打卡天数
        let streak = calculateHabitStreak(habit.id);
        if (streak > 0) {
            labels.push(habit.name);
            streakData.push(streak);
            chartColors.push(habit.color || '#ec4899');
        }
    });

    if (labels.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '16px sans-serif';
        ctx.fillStyle = chartTheme.textMuted;
        ctx.textAlign = 'center';
        ctx.fillText('暂无打卡记录', canvas.width / 2, canvas.height / 2);
        return;
    }

    habitStreakChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '连续打卡天数',
                data: streakData,
                backgroundColor: chartColors.map(c => c + '80'),
                borderColor: chartColors,
                borderWidth: 3,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `连续打卡 ${context.parsed.y} 天`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: chartTheme.grid
                    },
                    ticks: {
                        stepSize: 1,
                        color: chartTheme.text
                    }
                },
                x: {
                    grid: {
                        color: chartTheme.grid
                    },
                    ticks: {
                        color: chartTheme.text,
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

// 渲染项目统计列表
function renderProjectStatsList() {
    const container = document.getElementById('projectStatsList');
    container.innerHTML = '';

    if (state.projects.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-secondary); background: var(--bg-color); border-radius: var(--radius); border: 3px solid var(--border-color);">
                <i class="fas fa-project-diagram" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                <div style="font-size: 1.1rem; font-weight: 600;">暂无项目</div>
            </div>
        `;
        return;
    }

    state.projects.forEach(project => {
        const projectTasks = state.todos.filter(t => String(t.projectId) === String(project.id));
        const total = projectTasks.length;
        const completed = projectTasks.filter(t => t.completed).length;
        const inProgress = total - completed;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        const projectCard = document.createElement('div');
        projectCard.style.cssText = `
            padding: 25px;
            background: var(--card-bg);
            border-radius: var(--radius);
            border: 3px solid ${project.color};
            box-shadow: var(--shadow);
            display: grid;
            grid-template-columns: 200px 1fr;
            gap: 25px;
        `;

        projectCard.innerHTML = `
            <!-- 左侧：项目名称 -->
            <div style="display: flex; flex-direction: column; justify-content: center; border-right: 3px solid var(--border-color); padding-right: 25px;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                    <i class="fas fa-project-diagram" style="color: ${project.color}; font-size: 1.5rem;"></i>
                    <h3 style="margin: 0; font-size: 1.3rem; color: ${project.color}; font-weight: 800;">${project.name}</h3>
                </div>
                ${project.description ? `<div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5;">${project.description}</div>` : ''}
            </div>

            <!-- 右侧：统计数据 -->
            <div>
                <!-- 统计卡片 -->
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px;">
                    <div style="text-align: center; padding: 15px; background: var(--bg-color); border-radius: var(--radius); border: 2px solid var(--border-color);">
                        <div style="font-size: 2rem; font-weight: 900; color: ${project.color};">${total}</div>
                        <div style="font-size: 0.7rem; text-transform: uppercase; font-weight: 700; color: var(--text-secondary); margin-top: 5px;">总任务</div>
                    </div>
                    <div style="text-align: center; padding: 15px; background: var(--bg-color); border-radius: var(--radius); border: 2px solid var(--success-color);">
                        <div style="font-size: 2rem; font-weight: 900; color: var(--success-color);">${completed}</div>
                        <div style="font-size: 0.7rem; text-transform: uppercase; font-weight: 700; color: var(--text-secondary); margin-top: 5px;">已完成</div>
                    </div>
                    <div style="text-align: center; padding: 15px; background: var(--bg-color); border-radius: var(--radius); border: 2px solid var(--warning-color);">
                        <div style="font-size: 2rem; font-weight: 900; color: var(--warning-color);">${inProgress}</div>
                        <div style="font-size: 0.7rem; text-transform: uppercase; font-weight: 700; color: var(--text-secondary); margin-top: 5px;">进行中</div>
                    </div>
                    <div style="text-align: center; padding: 15px; background: var(--bg-color); border-radius: var(--radius); border: 2px solid var(--accent-color);">
                        <div style="font-size: 2rem; font-weight: 900; color: var(--accent-color);">${completionRate}%</div>
                        <div style="font-size: 0.7rem; text-transform: uppercase; font-weight: 700; color: var(--text-secondary); margin-top: 5px;">完成率</div>
                    </div>
                </div>

                <!-- 进度条 -->
                <div style="margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-secondary);">项目进度</span>
                        <span style="font-size: 0.85rem; font-weight: 700; color: ${project.color};">${completed}/${total}</span>
                    </div>
                    <div style="height: 12px; background: var(--bg-color); border-radius: 6px; overflow: hidden; border: 2px solid var(--border-color);">
                        <div style="height: 100%; background: ${project.color}; transition: width 0.3s; width: ${completionRate}%;"></div>
                    </div>
                </div>

                <!-- 可视化图表 -->
                <div style="height: 150px;">
                    <canvas id="projectChart-${project.id}"></canvas>
                </div>
            </div>
        `;

        container.appendChild(projectCard);

        // 为每个项目渲染饼图
        setTimeout(() => renderProjectPieChart(project), 100);
    });
}

// 渲染单个项目的饼图
function renderProjectPieChart(project) {
    const canvas = document.getElementById(`projectChart-${project.id}`);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const chartTheme = getChartThemeTokens();
    const projectTasks = state.todos.filter(t => String(t.projectId) === String(project.id));
    const completed = projectTasks.filter(t => t.completed).length;
    const inProgress = projectTasks.length - completed;

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['已完成', '进行中'],
            datasets: [{
                data: [completed, inProgress],
                backgroundColor: [project.color + 'cc', project.color + '33'],
                borderColor: [project.color, project.color],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 10,
                        font: {
                            size: 12
                        },
                        color: chartTheme.text
                    }
                }
            }
        }
    });
}

// 计算习惯的连续打卡天数
function calculateHabitStreak(habitId) {
    const records = state.habitRecords[habitId];
    if (!records) return 0;

    let streak = 0;
    const today = new Date();

    for (let i = 0; i < 365; i++) { // 最多检查365天
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        if (records[dateStr]) {
            streak++;
        } else {
            break;
        }
    }

    return streak;
}


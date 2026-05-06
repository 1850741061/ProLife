// 重复任务选项初始化

function initRepeatOptions() {
    // 监听重复选项变化
    const editRepeatCustom = document.getElementById('editRepeatCustom');
    if (editRepeatCustom) {
        const options = editRepeatCustom.querySelectorAll('.custom-select-option');
        options.forEach(option => {
            option.addEventListener('click', () => {
                const value = option.dataset.value;
                const endDateContainer = document.getElementById('repeatEndDateContainer');
                if (value !== 'none') {
                    endDateContainer.style.display = 'block';
                } else {
                    endDateContainer.style.display = 'none';
                }
            });
        });
    }
}

// --- 习惯打卡功能 ---
let editingHabitId = null;
let selectedHabitIcon = 'fa-check';
let selectedHabitColor = '#3b82f6';

const habitIcons = [
    'fa-check', 'fa-running', 'fa-book', 'fa-spa', 'fa-dumbbell',
    'fa-water', 'fa-apple-alt', 'fa-bed', 'fa-sun', 'fa-moon',
    'fa-heart', 'fa-brain', 'fa-music', 'fa-code', 'fa-pencil-alt',
    'fa-coffee'
];


// 通用下拉框更新逻辑


function updateGroupSelects() {
    // 更新分类选择器（合并分组、项目）
    const categoryCustom = document.getElementById('categorySelectCustom');
    const categoryNative = document.getElementById('categorySelect');

    // 如果元素不存在，直接返回（可能在非待办视图）
    if (!categoryCustom || !categoryNative) return;

    const categoryOptions = categoryCustom.querySelector('.custom-select-options');
    const categoryTrigger = categoryCustom.querySelector('.custom-select-trigger');

    // 确定当前应该选择的值
    let currentValue = null;
    if (state.currentProjectId) {
        currentValue = state.currentProjectId;
    } else if (state.currentGroupId && state.currentGroupId !== 'all') {
        currentValue = state.currentGroupId;
    }

    categoryOptions.innerHTML = '';
    categoryNative.innerHTML = '';

    // 1. 添加分组（如果有分组）
    if (state.groups.length > 0) {
        // 分组分界线
        const groupDivider = document.createElement('div');
        groupDivider.className = 'custom-select-divider';
        groupDivider.innerHTML = '分组';
        categoryOptions.appendChild(groupDivider);

        state.groups.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.setAttribute('data-type', 'group');
            opt.innerText = g.name;
            categoryNative.appendChild(opt);

            const optionDiv = document.createElement('div');
            optionDiv.className = 'custom-select-option';
            optionDiv.dataset.value = g.id;
            optionDiv.dataset.type = 'group';
            optionDiv.innerHTML = `<span style="display:flex;align-items:center;gap:8px;flex:1;"><span class="group-color" style="width:12px;height:12px;border-radius:2px;border:2px solid var(--border-color);background:${g.color};flex-shrink:0;"></span>${g.name}</span><span class="category-type-label group">分组</span>`;
            optionDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                categoryTrigger.innerHTML = `<span style="display:flex;align-items:center;gap:8px;"><span class="group-color" style="width:12px;height:12px;border-radius:2px;border:2px solid var(--border-color);background:${g.color};flex-shrink:0;"></span>${g.name}</span>`;
                categoryTrigger.dataset.value = g.id;
                categoryNative.value = g.id;
                categoryOptions.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
                optionDiv.classList.add('selected');
                categoryCustom.classList.remove('open');
            });
            categoryOptions.appendChild(optionDiv);
        });
    }

    // 2. 添加项目（如果有项目）
    if (state.projects.length > 0) {
        // 项目分界线
        const projectDivider = document.createElement('div');
        projectDivider.className = 'custom-select-divider';
        projectDivider.innerHTML = '项目';
        categoryOptions.appendChild(projectDivider);

        state.projects.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.setAttribute('data-type', 'project');
            opt.innerText = p.name;
            categoryNative.appendChild(opt);

            const optionDiv = document.createElement('div');
            optionDiv.className = 'custom-select-option';
            optionDiv.dataset.value = p.id;
            optionDiv.dataset.type = 'project';
            optionDiv.innerHTML = `<span style="display:flex;align-items:center;gap:8px;flex:1;"><i class="fas fa-project-diagram" style="color:${p.color};"></i>${p.name}</span><span class="category-type-label project">项目</span>`;
            optionDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                categoryTrigger.innerHTML = `<span style="display:flex;align-items:center;gap:8px;"><i class="fas fa-project-diagram" style="color:${p.color};"></i>${p.name}</span>`;
                categoryTrigger.dataset.value = p.id;
                categoryNative.value = p.id;
                categoryOptions.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
                optionDiv.classList.add('selected');
                categoryCustom.classList.remove('open');
            });
            categoryOptions.appendChild(optionDiv);
        });
    }

    // 恢复选中状态：自动选择当前分组/项目
    if (currentValue && (state.groups.find(g => g.id === currentValue) || state.projects.find(p => p.id === currentValue))) {
        setCustomSelectValue('categorySelectCustom', currentValue);
    } else if (state.groups.length > 0) {
        // 默认选择第一个分组
        setCustomSelectValue('categorySelectCustom', state.groups[0].id);
    } else if (state.projects.length > 0) {
        // 如果没有分组，选择第一个项目
        setCustomSelectValue('categorySelectCustom', state.projects[0].id);
    }

    // 重新初始化选择器的点击事件
    initCustomSelect('categorySelectCustom');
}

// 初始化单个自定义选择器
function initCustomSelect(customSelectId) {
    const select = document.getElementById(customSelectId);
    if (!select) return;

    const trigger = select.querySelector('.custom-select-trigger');
    const options = select.querySelectorAll('.custom-select-option');

    // 移除旧的监听器（通过克隆重建）
    const newTrigger = trigger.cloneNode(true);
    trigger.parentNode.replaceChild(newTrigger, trigger);

    // 重新获取引用
    const updatedTrigger = select.querySelector('.custom-select-trigger');
    const updatedOptions = select.querySelectorAll('.custom-select-option');

    // 点击触发器打开/关闭下拉
    updatedTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.custom-select.open').forEach(s => {
            if (s !== select) s.classList.remove('open');
        });
        select.classList.toggle('open');
    });

    // 点击选项
    updatedOptions.forEach(option => {
        const newOption = option.cloneNode(true);
        option.parentNode.replaceChild(newOption, option);
    });

    // 重新获取选项并添加事件
    const finalOptions = select.querySelectorAll('.custom-select-option');
    finalOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const value = option.dataset.value;
            const htmlContent = option.innerHTML;

            // 更新触发器HTML
            updatedTrigger.innerHTML = htmlContent;
            updatedTrigger.dataset.value = value;

            // 更新选中状态
            finalOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');

            // 关闭下拉
            select.classList.remove('open');
        });
    });
}

// --- 日历 ---

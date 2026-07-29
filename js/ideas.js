// 随想录

let _pendingIdeaTags = [];
let currentEditIdeaId = null;

function initIdeas() {
    const tagInput = document.getElementById('ideaTagInput');
    const quickText = document.getElementById('ideaQuickText');
    tagInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const tag = tagInput.value.trim();
            if (tag && !_pendingIdeaTags.includes(tag)) {
                _pendingIdeaTags.push(tag);
                tagInput.value = '';
                renderIdeaQuickTags();
            }
        }
    });
    quickText.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            quickAddIdea();
        }
    });
    updateIdeasSidebarCount();
}

function renderIdeaQuickTags() {
    const container = document.getElementById('ideaQuickTags');
    container.innerHTML = _pendingIdeaTags.map((tag, i) =>
        `<span class="idea-tag-chip active">${escapeHtml(tag)}<span class="idea-tag-remove" onclick="removePendingTag(${i})">×</span></span>`
    ).join('');
}

window.removePendingTag = function(index) {
    _pendingIdeaTags.splice(index, 1);
    renderIdeaQuickTags();
};

window.toggleIdeasPanel = function(forceOpen) {
    const panel = document.getElementById('ideasPanel');
    const overlay = document.getElementById('ideasOverlay');
    const isOpen = panel.classList.contains('open');
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !isOpen;
    panel.classList.toggle('open', shouldOpen);
    overlay.style.display = shouldOpen ? 'block' : 'none';
    if (shouldOpen) {
        buildIdeaLinkCustomSelect('ideaPanelLinkCustom', 'ideaPanelLink', '');
        renderIdeasPanel();
        renderIdeaFilterTags();
        document.getElementById('ideaQuickText').focus();
    }
};

window.quickAddIdea = function() {
            const text = document.getElementById('ideaQuickText').value.trim();
            if (!text) return;
            const linkVal = document.getElementById('ideaPanelLink').value;
            let linkedId = null, linkedType = null, linkedName = null;
            if (linkVal.startsWith('todo:')) {
                const tid = Number(linkVal.split(':')[1]);
                const task = state.todos.find(t => sameEntityId(t.id, tid));
                linkedId = tid; linkedType = 'task';
                linkedName = task ? task.text.substring(0, 30) : '';
            } else if (linkVal.startsWith('project:')) {
                const pid = linkVal.split(':')[1];
                const project = state.projects.find(p => String(p.id) === pid);
                linkedId = pid; linkedType = 'project';
                linkedName = project ? project.name : '';
            } else if (linkVal.startsWith('group:')) {
                const gid = linkVal.split(':')[1];
                const group = state.groups.find(g => String(g.id) === gid);
                linkedId = gid; linkedType = 'group';
                linkedName = group ? group.name : '';
            }
            const idea = {
                id: uniqueId(),
                text,
                tags: [..._pendingIdeaTags],
                linkedId, linkedType, linkedName,
                pinned: false,
                important: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            state.ideas.unshift(idea);
            syncIdeaTags();
            _pendingIdeaTags = [];
            document.getElementById('ideaQuickText').value = '';
            document.getElementById('ideaTagInput').value = '';
            renderIdeaQuickTags();
            setIdeaLinkValue('ideaPanelLinkCustom', 'ideaPanelLink', '', '关联 (可选)');
            save();
            renderIdeasPanel();
            updateIdeasSidebarCount();
            showSyncToast('已记录');
        };

function syncIdeaTags() {
    const allTags = new Set();
    state.ideas.forEach(idea => (idea.tags || []).forEach(t => allTags.add(t)));
    state.ideaTags = [...allTags].sort();
}

function getFilteredIdeas(filter, filterTag) {
    let list = [...state.ideas];
    if (filter === 'pinned') list = list.filter(i => i.pinned);
    else if (filter === 'important') list = list.filter(i => i.important);
    if (filterTag) list = list.filter(i => (i.tags || []).includes(filterTag));
    return list.sort((a, b) => {
        if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
        if (a.important !== b.important) return b.important ? 1 : -1;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
}

function renderIdeaCard(idea, showActions = true) {
            const tagHtml = (idea.tags || []).map(t =>
                `<span class="idea-tag-chip" style="font-size:0.65rem;padding:1px 6px;">${escapeHtml(t)}</span>`
            ).join('');
            const linkIcon = idea.linkedType === 'task' ? 'fa-check-circle' : idea.linkedType === 'project' ? 'fa-project-diagram' : idea.linkedType === 'group' ? 'fa-folder' : 'fa-link';
            let linkHtml = '';
            if (idea.linkedName) {
                let dotHtml = '';
                if (idea.linkedType === 'group') {
                    const g = state.groups.find(g => String(g.id) === String(idea.linkedId));
                    const gc = g ? g.color : '#888';
                    dotHtml = `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${gc};border:1px solid var(--border-color);margin-right:3px;vertical-align:middle;"></span>`;
                } else if (idea.linkedType === 'project') {
                    const p = state.projects.find(p => String(p.id) === String(idea.linkedId));
                    const pc = p ? (p.color || '#8b5cf6') : '#8b5cf6';
                    dotHtml = `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${pc};margin-right:3px;vertical-align:middle;"></span>`;
                }
                linkHtml = `<span class="idea-card-link">${dotHtml}<i class="fas ${linkIcon}" style="margin-right:2px;"></i>${escapeHtml(idea.linkedName)}</span>`;
            }
            const actionsHtml = showActions ? `
                <div class="idea-card-actions">
                    <button class="idea-action-btn ${idea.pinned ? 'pin-active' : ''}" onclick="toggleIdeaPin(${idea.id})" title="置顶"><i class="fas fa-thumbtack"></i></button>
                    <button class="idea-action-btn ${idea.important ? 'important-active' : ''}" onclick="toggleIdeaImportant(${idea.id})" title="重要"><i class="fas fa-star"></i></button>
                    <button class="idea-action-btn" onclick="openEditIdea(${idea.id})" title="编辑"><i class="fas fa-pen"></i></button>
                    <button class="idea-action-btn" onclick="deleteIdea(${idea.id})" title="删除" style="color:var(--danger-color);"><i class="fas fa-trash"></i></button>
                </div>` : '';
            const cls = `idea-card${idea.pinned ? ' pinned' : ''}${idea.important ? ' important' : ''}`;
            const time = new Date(idea.createdAt);
            const timeStr = `${(time.getMonth()+1).toString().padStart(2,'0')}-${time.getDate().toString().padStart(2,'0')} ${time.getHours().toString().padStart(2,'0')}:${time.getMinutes().toString().padStart(2,'0')}`;
            return `<div class="${cls}" data-id="${idea.id}">
                <div class="idea-card-top">
                    <div class="idea-card-text">${escapeHtml(idea.text)}</div>
                </div>
                <div class="idea-card-meta">
                    <span class="idea-card-time">${timeStr}</span>
                    ${tagHtml}${linkHtml}
                </div>
                ${actionsHtml}
            </div>`;
        }

window.addPendingTag = function(tag) {
    if (!_pendingIdeaTags.includes(tag)) {
        _pendingIdeaTags.push(tag);
        renderIdeaQuickTags();
    }
};

function renderIdeaTagChips() {
    const container = document.getElementById('ideaTagChips');
    if (state.ideaTags.length === 0) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = '<span style="font-size:0.65rem;color:var(--text-secondary);margin-right:2px;">已有:</span>' +
        state.ideaTags.map(t =>
            `<span class="idea-tag-chip" onclick="addPendingTag('${escapeHtml(t).replace(/'/g, "\\'")}')" style="cursor:pointer;" title="点击添加">${escapeHtml(t)}</span>`
        ).join('');
}

function renderIdeasPanel() {
    const list = getFilteredIdeas(state.ideaFilter, state.ideaFilterTag);
    const container = document.getElementById('ideasList');
    if (list.length === 0) {
        container.innerHTML = `<div class="idea-empty-state"><i class="fas fa-lightbulb"></i><div>暂无随想</div></div>`;
    } else {
        container.innerHTML = list.map(i => renderIdeaCard(i)).join('');
    }
    updateIdeaFilterUI();
    renderIdeaTagChips();
}

function renderIdeaFilterTags() {
    const container = document.getElementById('ideaFilterTags');
    container.innerHTML = state.ideaTags.map(t =>
        `<button class="idea-tag-chip ${state.ideaFilterTag === t ? 'active' : ''}" onclick="setIdeaFilter('tag','${escapeHtml(t)}')">${escapeHtml(t)}</button>`
    ).join('');
}

function updateIdeaFilterUI() {
    const btns = { all: 'ideaFilterAll' };
    Object.entries(btns).forEach(([key, id]) => {
        const el = document.getElementById(id);
        if (el) {
            el.style.background = state.ideaFilter === key ? 'var(--accent-color)' : '';
            el.style.color = state.ideaFilter === key ? 'var(--accent-contrast)' : '';
        }
    });
}

window.setIdeaFilter = function(filter, tag) {
    if (filter === 'tag') {
        state.ideaFilterTag = state.ideaFilterTag === tag ? null : tag;
        state.ideaFilter = state.ideaFilterTag ? 'tag' : 'all';
    } else {
        state.ideaFilter = filter;
        state.ideaFilterTag = null;
    }
    renderIdeasPanel();
    renderIdeaFilterTags();
};

window.toggleIdeaPin = function(id) {
            const idea = state.ideas.find(i => sameEntityId(i.id, id));
            if (!idea) return;
            idea.pinned = !idea.pinned;
            idea.updatedAt = new Date().toISOString();
            save();
            renderIdeasPanel();
            renderIdeasFull();
        };

window.toggleIdeaImportant = function(id) {
            const idea = state.ideas.find(i => sameEntityId(i.id, id));
            if (!idea) return;
            idea.important = !idea.important;
            idea.updatedAt = new Date().toISOString();
            save();
            renderIdeasPanel();
            renderIdeasFull();
        };

window.deleteIdea = async function(id) {
            const confirmed = await showConfirm('删除随想', '确定要删除这条随想吗？', ['取消', '删除']);
            if (confirmed === 0) return;
            state.ideas = state.ideas.filter(i => !sameEntityId(i.id, id));
            const tombstone = entityTombstone('idea', id);
            if (!state.deletedIds.includes(tombstone)) state.deletedIds.push(tombstone);
            syncIdeaTags();
            save();
            renderIdeasPanel();
            renderIdeasFull();
            updateIdeasSidebarCount();
            try { closeModal('ideaEditModal'); } catch(e) {}
        };

window.openEditIdea = function(id) {
            const idea = state.ideas.find(i => sameEntityId(i.id, id));
            if (!idea) return;
            currentEditIdeaId = id;
            document.getElementById('ideaEditText').value = idea.text;
            document.getElementById('ideaEditTags').value = (idea.tags || []).join(', ');
            updateIdeaEditLinkSelect(idea);
            openModal('ideaEditModal');
        };

function buildIdeaLinkCustomSelect(customId, nativeId, selectedValue) {
    const customSelect = document.getElementById(customId);
    const nativeSelect = document.getElementById(nativeId);
    if (!customSelect || !nativeSelect) return;
    const optionsContainer = customSelect.querySelector('.custom-select-options');
    const trigger = customSelect.querySelector('.custom-select-trigger');
    optionsContainer.innerHTML = '';
    nativeSelect.innerHTML = '<option value="">无关联</option>';

    // 无关联选项
    const noneOpt = document.createElement('div');
    noneOpt.className = 'custom-select-option' + (!selectedValue ? ' selected' : '');
    noneOpt.dataset.value = '';
    noneOpt.innerHTML = '<span style="color:var(--text-secondary);"><i class="fas fa-unlink" style="margin-right:6px;"></i>无关联</span>';
    noneOpt.addEventListener('click', (e) => { e.stopPropagation(); setIdeaLinkValue(customId, nativeId, '', '无关联'); });
    optionsContainer.appendChild(noneOpt);

    // 分组
    if (state.groups.length > 0) {
        const groupDivider = document.createElement('div');
        groupDivider.className = 'custom-select-divider';
        groupDivider.innerHTML = '分组';
        optionsContainer.appendChild(groupDivider);
        state.groups.forEach(g => {
            const val = `group:${g.id}`;
            const opt = document.createElement('option');
            opt.value = val;
            opt.setAttribute('data-type', 'group');
            opt.innerText = g.name;
            nativeSelect.appendChild(opt);
            const div = document.createElement('div');
            div.className = 'custom-select-option';
            div.dataset.value = val;
            div.innerHTML = `<span style="display:flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;border-radius:2px;border:2px solid var(--border-color);background:${g.color};flex-shrink:0;"></span>${escapeHtml(g.name)}</span>`;
            if (String(selectedValue) === String(val)) { div.classList.add('selected'); }
            div.addEventListener('click', (e) => { e.stopPropagation(); setIdeaLinkValue(customId, nativeId, val, g.name); });
            optionsContainer.appendChild(div);
        });
    }

    // 任务
    const todos = state.todos.filter(t => !t.projectId && !t.completed).slice(0, 100);
    if (todos.length > 0) {
        const taskDivider = document.createElement('div');
        taskDivider.className = 'custom-select-divider';
        taskDivider.innerHTML = '任务';
        optionsContainer.appendChild(taskDivider);
        todos.forEach(t => {
            const val = `todo:${t.id}`;
            const opt = document.createElement('option');
            opt.value = val;
            opt.setAttribute('data-type', 'task');
            opt.innerText = t.text.substring(0, 30);
            nativeSelect.appendChild(opt);
            const div = document.createElement('div');
            div.className = 'custom-select-option';
            div.dataset.value = val;
            const label = t.text.substring(0, 30) + (t.text.length > 30 ? '...' : '');
            div.innerHTML = `<span style="display:flex;align-items:center;gap:6px;"><i class="fas fa-check-circle" style="color:var(--text-secondary);font-size:0.7rem;"></i>${escapeHtml(label)}</span>`;
            if (String(selectedValue) === String(val)) { div.classList.add('selected'); }
            div.addEventListener('click', (e) => { e.stopPropagation(); setIdeaLinkValue(customId, nativeId, val, label); });
            optionsContainer.appendChild(div);
        });
    }

    // 项目
    if (state.projects.length > 0) {
        const projDivider = document.createElement('div');
        projDivider.className = 'custom-select-divider';
        projDivider.innerHTML = '项目';
        optionsContainer.appendChild(projDivider);
        state.projects.forEach(p => {
            const val = `project:${p.id}`;
            const opt = document.createElement('option');
            opt.value = val;
            opt.setAttribute('data-type', 'project');
            opt.innerText = p.name;
            nativeSelect.appendChild(opt);
            const div = document.createElement('div');
            div.className = 'custom-select-option';
            div.dataset.value = val;
            div.innerHTML = `<span style="display:flex;align-items:center;gap:6px;"><i class="fas fa-project-diagram" style="color:${p.color};font-size:0.75rem;"></i>${escapeHtml(p.name)}</span>`;
            if (String(selectedValue) === String(val)) { div.classList.add('selected'); }
            div.addEventListener('click', (e) => { e.stopPropagation(); setIdeaLinkValue(customId, nativeId, val, p.name); });
            optionsContainer.appendChild(div);
        });
    }

    // restore selected display
    if (selectedValue) {
        const allOpts = optionsContainer.querySelectorAll('.custom-select-option');
        allOpts.forEach(o => {
            if (o.dataset.value === String(selectedValue)) {
                trigger.innerHTML = o.innerHTML;
                trigger.dataset.value = selectedValue;
                nativeSelect.value = selectedValue;
            }
        });
    } else {
        trigger.innerHTML = '关联 (可选)';
        trigger.dataset.value = '';
        nativeSelect.value = '';
    }
}

function setIdeaLinkValue(customId, nativeId, value, label) {
    const customSelect = document.getElementById(customId);
    const nativeSelect = document.getElementById(nativeId);
    if (!customSelect || !nativeSelect) return;
    const trigger = customSelect.querySelector('.custom-select-trigger');
    const optionsContainer = customSelect.querySelector('.custom-select-options');
    if (!value) {
        trigger.innerHTML = '关联 (可选)';
    } else {
        trigger.innerHTML = escapeHtml(label);
    }
    trigger.dataset.value = value;
    nativeSelect.value = value;
    optionsContainer.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
    if (value) {
        const target = optionsContainer.querySelector(`[data-value="${CSS.escape(value)}"]`);
        if (target) target.classList.add('selected');
    } else {
        const noneTarget = optionsContainer.querySelector('[data-value=""]');
        if (noneTarget) noneTarget.classList.add('selected');
    }
    customSelect.classList.remove('open');
}

function updateIdeaEditLinkSelect(idea) {
    let selVal = '';
    if (idea) {
        if (idea.linkedType === 'task') selVal = `todo:${idea.linkedId}`;
        else if (idea.linkedType === 'project') selVal = `project:${idea.linkedId}`;
        else if (idea.linkedType === 'group') selVal = `group:${idea.linkedId}`;
    }
    buildIdeaLinkCustomSelect('ideaEditLinkCustom', 'ideaEditLink', selVal);
}

window.saveIdeaEdit = function() {
            const idea = state.ideas.find(i => sameEntityId(i.id, currentEditIdeaId));
            if (!idea) return;
            idea.text = document.getElementById('ideaEditText').value.trim();
            idea.tags = document.getElementById('ideaEditTags').value.split(/[,，]/).map(t => t.trim()).filter(Boolean);
            const linkVal = document.getElementById('ideaEditLink').value;
            if (linkVal.startsWith('todo:')) {
                const taskId = Number(linkVal.split(':')[1]);
                const task = state.todos.find(t => sameEntityId(t.id, taskId));
                idea.linkedId = taskId;
                idea.linkedType = 'task';
                idea.linkedName = task ? task.text.substring(0, 30) : '';
            } else if (linkVal.startsWith('project:')) {
                const pid = linkVal.split(':')[1];
                const project = state.projects.find(p => String(p.id) === pid);
                idea.linkedId = pid;
                idea.linkedType = 'project';
                idea.linkedName = project ? project.name : '';
            } else if (linkVal.startsWith('group:')) {
                const gid = linkVal.split(':')[1];
                const group = state.groups.find(g => String(g.id) === gid);
                idea.linkedId = gid;
                idea.linkedType = 'group';
                idea.linkedName = group ? group.name : '';
            } else {
                idea.linkedId = null;
                idea.linkedType = null;
                idea.linkedName = null;
            }
            idea.updatedAt = new Date().toISOString();
            syncIdeaTags();
            save();
            renderIdeasPanel();
            renderIdeasFull();
            updateIdeasSidebarCount();
            closeModal('ideaEditModal');
            showSyncToast('已保存');
        };

// 全屏模态相关
window.openIdeasFullModal = function() {
    buildIdeaLinkCustomSelect('ideasFullLinkCustom', 'ideasFullLinkNative', '');
    renderIdeasFull();
    renderIdeaFullTagFilters();
    openModal('ideasFullModal');
};

window.addIdeaFromFullModal = function() {
            const text = document.getElementById('ideasFullText').value.trim();
            if (!text) return;
            const tags = document.getElementById('ideasFullTags').value.split(/[,，]/).map(t => t.trim()).filter(Boolean);
            const linkVal = document.getElementById('ideasFullLinkNative').value;
            let linkedId = null, linkedType = null, linkedName = null;
            if (linkVal.startsWith('todo:')) {
                const taskId = Number(linkVal.split(':')[1]);
                const task = state.todos.find(t => sameEntityId(t.id, taskId));
                linkedId = taskId; linkedType = 'task';
                linkedName = task ? task.text.substring(0, 30) : '';
            } else if (linkVal.startsWith('project:')) {
                const pid = linkVal.split(':')[1];
                const project = state.projects.find(p => String(p.id) === pid);
                linkedId = pid; linkedType = 'project';
                linkedName = project ? project.name : '';
            } else if (linkVal.startsWith('group:')) {
                const gid = linkVal.split(':')[1];
                const group = state.groups.find(g => String(g.id) === gid);
                linkedId = gid; linkedType = 'group';
                linkedName = group ? group.name : '';
            }
            const idea = {
                id: uniqueId(), text, tags,
                linkedId, linkedType, linkedName,
                pinned: false, important: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            state.ideas.unshift(idea);
            syncIdeaTags();
            document.getElementById('ideasFullText').value = '';
            document.getElementById('ideasFullTags').value = '';
            setIdeaLinkValue('ideasFullLinkCustom', 'ideasFullLinkNative', '', '关联 (可选)');
            save();
            renderIdeasFull();
            updateIdeasSidebarCount();
            showSyncToast('已添加');
        };

window.setIdeaFullView = function(view) {
    state.ideaFullView = view;
    const tl = document.getElementById('ideasViewTimeline');
    const fl = document.getElementById('ideasViewFiltered');
    const filters = document.getElementById('ideasFullFilters');
    tl.style.background = view === 'timeline' ? 'var(--accent-color)' : '';
    tl.style.color = view === 'timeline' ? 'var(--accent-contrast)' : '';
    fl.style.background = view === 'filtered' ? 'var(--accent-color)' : '';
    fl.style.color = view === 'filtered' ? 'var(--accent-contrast)' : '';
    filters.style.display = view === 'filtered' ? 'flex' : 'none';
    renderIdeasFull();
};

window.setIdeaFullFilter = function(filter, tag) {
    if (filter === 'tag') {
        state.ideaFullFilterTag = state.ideaFullFilterTag === tag ? null : tag;
        state.ideaFullFilter = state.ideaFullFilterTag ? 'tag' : 'all';
    } else {
        state.ideaFullFilter = filter;
        state.ideaFullFilterTag = null;
    }
    renderIdeasFull();
    renderIdeaFullTagFilters();
};

function renderIdeaFullTagFilters() {
    const container = document.getElementById('ideaFullTagFilters');
    container.innerHTML = state.ideaTags.map(t =>
        `<button class="idea-tag-chip ${state.ideaFullFilterTag === t ? 'active' : ''}" onclick="setIdeaFullFilter('tag','${escapeHtml(t)}')">${escapeHtml(t)}</button>`
    ).join('');
}

window.renderIdeasFull = function() {
    // populate tag chips
    const tagChipsEl = document.getElementById('ideaFullTagChips');
    if (tagChipsEl && state.ideaTags.length > 0) {
        tagChipsEl.innerHTML = '<span style="font-size:0.65rem;color:var(--text-secondary);margin-right:2px;">已有:</span>' +
            state.ideaTags.map(t =>
                `<span class="idea-tag-chip" onclick="addFullTag('${escapeHtml(t).replace(/'/g, "\\'")}')" style="cursor:pointer;" title="点击添加">${escapeHtml(t)}</span>`
            ).join('');
    } else if (tagChipsEl) {
        tagChipsEl.innerHTML = '';
    }

    const search = (document.getElementById('ideasFullSearch')?.value || '').toLowerCase();
    let list;
    if (state.ideaFullView === 'filtered') {
        list = getFilteredIdeas(state.ideaFullFilter, state.ideaFullFilterTag);
    } else {
        list = [...state.ideas].sort((a, b) => {
            if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
    }
    if (search) {
        list = list.filter(i =>
            i.text.toLowerCase().includes(search) ||
            (i.tags || []).some(t => t.toLowerCase().includes(search)) ||
            (i.linkedName || '').toLowerCase().includes(search)
        );
    }
    const container = document.getElementById('ideasFullList');
    const empty = document.getElementById('ideasFullEmpty');
    if (list.length === 0) {
        container.innerHTML = '';
        empty.style.display = 'block';
    } else {
        empty.style.display = 'none';
        container.innerHTML = list.map(i => renderIdeaCard(i, true)).join('');
    }
};

window.addFullTag = function(tag) {
    const input = document.getElementById('ideasFullTags');
    const current = input.value.split(/[,，]/).map(t => t.trim()).filter(Boolean);
    if (!current.includes(tag)) {
        current.push(tag);
        input.value = current.join(', ');
    }
};

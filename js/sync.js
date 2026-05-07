// 云同步与认证系统

// 初始化 Supabase 客户端（带错误处理）
try {
    if (typeof supabase !== 'undefined' && supabase.createClient) {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('[Supabase] 客户端初始化成功');
    } else {
        console.warn('[Supabase] SDK 未加载，Realtime 功能将不可用');
    }
} catch (e) {
    console.error('[Supabase] 客户端初始化失败:', e);
    console.warn('[Supabase] 将继续使用基础同步功能');
}

function showSyncToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? 'var(--success-color)' : 'var(--danger-color)'};
        color: white;
        padding: 15px 25px;
        border-radius: var(--radius);
        border: 3px solid var(--border-color);
        box-shadow: var(--shadow);
        z-index: 2000;
        font-weight: 700;
        animation: slideIn 0.3s ease;
    `;
    toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

async function ensureUserDataRow(payload) {
    const lookupUrl = `${SUPABASE_URL}/rest/v1/user_data?id=eq.${currentUser.id}&select=id`;
    const res = await apiRequest(lookupUrl, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`ensure user_data lookup failed (${res.status}) ${errorText}`.trim());
    }

    const rows = await res.json().catch(() => []);
    if (Array.isArray(rows) && rows[0]) {
        return { created: false };
    }

    console.log('[sync] user_data row missing, creating...');
    const createRes = await apiRequest(`${SUPABASE_URL}/rest/v1/user_data`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${accessToken}`,
            'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
    });

    if (createRes.ok) {
        try {
            console.log('[sync] user_data row created:', await createRes.json());
        } catch (e) {
            console.log('[sync] user_data row created (no response body)');
        }
        return { created: true };
    }

    if (createRes.status === 409) {
        console.warn('[sync] user_data row already created by another client');
        return { created: false, raced: true };
    }

    const errorText = await createRes.text().catch(() => '');
    throw new Error(`create user_data failed (${createRes.status}) ${errorText}`.trim());
}

// 登录时的同步：以云端数据为准
async function syncDataOnLogin() {
    try {
        console.log('[同步] 开始检查云端数据...');
        console.log('[同步] 当前用户ID:', currentUser.id);

        const res = await apiRequest(`${SUPABASE_URL}/rest/v1/user_data?id=eq.${currentUser.id}`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (res.ok) {
            const data = await res.json();
            console.log('[同步] 云端响应:', data);

            if (data && data[0]) {
                // 云端有数据，智能合并（排除已删除的ID）
                console.log('[同步] 云端有数据，智能合并...');

                // 合并本地的 deletedIds 和云端的 deletedids（取并集）
                const cloudDeletedIds = data[0].deletedids || [];
                const localDeletedIds = state.deletedIds || [];
                // 合并并去重
                const allDeletedIds = [...new Set([...localDeletedIds, ...cloudDeletedIds])];

                // 使用 mergeArrays 智能合并（传递合并后的 deletedIds 过滤云端数据）
                state.todos = mergeArrays(state.todos, data[0].todos || [], allDeletedIds);
                state.transactions = dedupeFinanceTransactions(mergeArrays(dedupeFinanceTransactions(state.transactions), dedupeFinanceTransactions(data[0].transactions || []), allDeletedIds.map(normalizeFinanceTransactionId)));
                state.groups = mergeArrays(state.groups, data[0].groups || [], allDeletedIds);
                state.templates = mergeArrays(state.templates, data[0].templates || [], allDeletedIds);
                state.archivedTodos = mergeArrays(state.archivedTodos, data[0].archivedTodos || data[0].archivedtodos || [], allDeletedIds);
                state.habits = mergeArrays(state.habits, data[0].habits || [], allDeletedIds);
                state.habitRecords = { ...ensureSyncObject(data[0].habitRecords || data[0].habitrecords), ...ensureSyncObject(state.habitRecords) };
                state.projects = mergeArrays(state.projects, data[0].projects || [], allDeletedIds);
                state.milktea = { ...(data[0].milktea || { records: [], settings: { weeklyLimit: 2, monthlyLimit: 8 } }), ...state.milktea };
                state.coffee = { ...(data[0].coffee || { records: [], settings: { weeklyLimit: 3, monthlyLimit: 12 } }), ...state.coffee };
                state.ideas = mergeArrays(state.ideas, data[0].ideas || [], allDeletedIds);
                const cloudIdeaTags = data[0].ideaTags || [];
                state.ideaTags = [...new Set([...state.ideaTags, ...cloudIdeaTags])].sort();

                // 同步完成后清除本地的 deletedIds（已合并到上传中）
                state.deletedIds = [];

                // 保存到本地
                baseSave(); // 使用 baseSave 避免循环上传
                renderAll();

                // 上传合并后的数据到云端，让其他设备也能同步到
                console.log('[同步] 上传合并后的数据到云端...');
                const uploaded = await syncToCloud(allDeletedIds);
                if (uploaded) {
                    console.log('[同步] 合并数据已上传到云端');
                }

                showSyncToast(`已合并数据: ${state.todos.length} 个待办，${state.transactions.length} 条记录`);
            } else {
                // 云端无数据，上传本地数据
                console.log('[同步] 云端无数据，上传本地数据...');
                const uploaded = await syncToCloud();
                if (uploaded) {
                    showSyncToast(`已上传本地数据到云端 (${state.todos.length} 个待办)`);
                } else {
                    showSyncToast(getSyncErrorToastMessage('上传失败'), 'error');
                }
            }
        } else {
            // 请求失败
            console.log('[同步] 检查云端数据失败:', res.status);

            if (res.status === 401) {
                // 401 错误已经在 apiRequest 中处理了
                console.log('[同步] Token验证失败，已尝试自动刷新');
            } else {
                // 其他错误，尝试上传本地数据
                const uploaded = await syncToCloud();
                if (uploaded) {
                    showSyncToast('已上传本地数据到云端');
                } else {
                    showSyncToast(getSyncErrorToastMessage('同步失败'), 'error');
                }
            }
        }
    } catch (e) {
        console.error('[同步] 登录同步异常:', e);
        // 出错时上传本地数据作为后备
        const uploaded = await syncToCloud();
        if (uploaded) {
            showSyncToast('已上传本地数据到云端');
        } else {
            showSyncToast(getSyncErrorToastMessage('同步失败'), 'error');
        }
    }
}

// 登录
// Token 刷新变量（refreshToken 在 state.js 中声明）
let tokenRefreshTimer = null;

// API 请求包装器：自动处理 token 过期并重试
async function apiRequest(url, options = {}, retry = true) {
    const res = await fetch(url, options);

    // 如果是 401 错误且允许重试，尝试刷新 token 并重试
    if (res.status === 401 && retry) {
        console.warn('[API] 收到401错误，Token已过期');
        console.log('[API] 当前refreshToken:', refreshToken ? '存在' : '不存在');

        if (refreshToken) {
            console.warn('[API] 尝试刷新token...');
            showSyncToast('正在刷新登录状态...', 'info');

            const refreshed = await refreshAccessToken();

            if (refreshed) {
                console.log('[API] Token刷新成功，重试请求...');
                showSyncToast('登录状态已自动刷新', 'success');
                // 更新 Authorization header
                if (options.headers) {
                    options.headers['Authorization'] = `Bearer ${accessToken}`;
                }
                // 重试一次（不再重试避免死循环）
                return apiRequest(url, options, false);
            } else {
                console.error('[API] Token刷新失败');
            }
        } else {
            console.error('[API] 没有refresh_token，无法自动刷新');
            showSyncToast('登录已失效，请重新登录', 'error');
        }
    }

    return res;
}

// 刷新 access token
async function refreshAccessToken() {
    if (!refreshToken) {
        console.warn('[Token刷新] 没有refresh_token，无法刷新');
        return false;
    }

    try {
        console.log('[Token刷新] 开始刷新token...');
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify({ refresh_token: refreshToken })
        });

        const data = await res.json();

        if (!res.ok || !data.access_token) {
            console.error('[Token刷新] 刷新失败:', data);
            console.error('[Token刷新] 错误详情:', data.error_description || data.error || 'Unknown error');

            // 如果是 refresh_token 过期，提示用户重新登录
            if (data.error === 'invalid_grant' || data.error_description?.includes('expired')) {
                console.error('[Token刷新] Refresh token已过期，需要重新登录');

                // 显示明显的全屏提示
                const overlay = createDialogOverlay();
                const dialog = createDialog('登录已过期', `
                    <div style="text-align: center;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--danger-color); margin-bottom: 20px;"></i>
                        <p style="margin: 0 0 20px 0; color: var(--text-secondary); line-height: 1.6;">
                            您的登录状态已过期，需要重新登录以继续使用云同步功能。<br>
                            点击确定后将自动跳转到登录页面。
                        </p>
                    </div>
                    <button class="dialog-btn-primary" data-action="confirm">确定</button>
                `);

                overlay.appendChild(dialog);
                document.body.appendChild(overlay);
                setupDialogButtons(overlay, (action) => {
                    if (action === 'confirm') signOut();
                });
            } else {
                // 其他刷新失败，显示简单提示
                showSyncToast('Token刷新失败，可能需要重新登录', 'error');
            }

            return false;
        }

        // 更新 token
        accessToken = data.access_token;
        if (data.refresh_token) {
            refreshToken = data.refresh_token;
            localStorage.setItem('refresh_token', data.refresh_token);
        }
        localStorage.setItem('access_token', data.access_token);

        console.log('[Token刷新] Token刷新成功');

        // 重新设置定时刷新
        scheduleTokenRefresh();

        return true;
    } catch (e) {
        console.error('[Token刷新] 刷新异常:', e);
        return false;
    }
}

// 设置定时刷新 token（每25分钟刷新一次）
function scheduleTokenRefresh() {
    if (tokenRefreshTimer) {
        clearTimeout(tokenRefreshTimer);
    }

    // 25分钟后刷新
    tokenRefreshTimer = setTimeout(async () => {
        console.log('[Token刷新] 定时刷新token...');
        const success = await refreshAccessToken();
        if (success) {
            console.log('[Token刷新] 定时续期成功');
        } else {
            console.warn('[Token刷新] 定时刷新失败');
        }
    }, 25 * 60 * 1000);
}

async function signIn(email, password) {
    try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        console.log('登录响应:', data);

        if (!res.ok) {
            return { error: data.error_description || data.error?.message || '登录失败' };
        }

        if (!data.user || !data.access_token) {
            return { error: '登录失败：未返回用户信息，请确认邮箱已验证' };
        }

        currentUser = data.user;
        accessToken = data.access_token;
        refreshToken = data.refresh_token;
        localStorage.setItem('user_id', data.user.id);
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        console.log('[signIn] 登录凭证已保存到localStorage: user_id=', data.user.id);
        isolateLocalDataForUser(data.user.id);
        localStorage.setItem('data_owner_user_id', data.user.id);
        // 确保所有数据立即持久化
        baseSave();

        // 启动定时刷新
        scheduleTokenRefresh();

        // 先检查云端是否有数据，有则下载，无则上传本地数据
        await syncDataOnLogin();

        // 启动 Realtime 实时同步
        subscribeToRealtime();

        return { success: true };
    } catch (e) {
        console.error('登录异常:', e);
        return { error: '网络错误：' + e.message };
    }
}

// 注册
async function signUp(email, password) {
    try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        console.log('注册响应:', data);
        console.log('响应状态:', res.status);

        if (!res.ok) {
            let errorMsg = data.msg || data.error_description || data.error?.message || JSON.stringify(data);
            return { error: '注册失败: ' + errorMsg };
        }

        // 注册成功，需要验证邮箱
        return {
            success: true,
            needVerification: true,
            message: '注册成功！请检查邮箱并点击验证链接，然后返回登录。'
        };
    } catch (e) {
        console.error('注册异常:', e);
        return { error: '网络错误：' + e.message };
    }
}

// 登出
async function signOut() {
    try {
        // 取消 Realtime 订阅（静默失败，不阻塞登出）
        try {
            unsubscribeToRealtime();
        } catch (e) {
            console.warn('[登出] 取消订阅失败（非致命）:', e);
        }

        // 清理本地状态
        if (currentUser && currentUser.id) {
            localStorage.setItem('data_owner_user_id', currentUser.id);
        }
        currentUser = null;
        accessToken = null;
        refreshToken = null;

        // 停止定时刷新
        if (tokenRefreshTimer) {
            clearTimeout(tokenRefreshTimer);
            tokenRefreshTimer = null;
        }

        // 清理 localStorage
        localStorage.removeItem('user_id');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        // 登出时保留记住的账号信息，方便下次登录

        // 清理 Supabase SDK 自己的 session
        try {
            if (supabaseClient && supabaseClient.auth) {
                await supabaseClient.auth.signOut();
            }
        } catch (e) {
            console.warn('[登出] Supabase signOut 失败（非致命）:', e);
        }

        console.log('[登出] 已清理登录状态');

        // 刷新页面
        setTimeout(() => location.reload(), 100);
    } catch (e) {
        console.error('[登出] 错误:', e);
        // 即使出错也尝试刷新
        location.reload();
    }
}

// 云端同步 - 上传（使用 PATCH 确保数据更新）
// deletedIds 参数用于在同步时使用合并后的 deletedIds（可选）
async function syncToCloud(mergedDeletedIds = null) {
    if (!currentUser || !accessToken) {
        console.log('[同步] 未登录，跳过上传');
        return false;
    }

    try {
        console.log('[同步] 开始上传数据到云端...');
        console.log('[同步] 当前用户ID:', currentUser.id);
        console.log('[同步] 待办数量:', state.todos.length);
        console.log('[同步] 记账数量:', state.transactions.length);
        console.log('[同步] 分组数量:', state.groups.length);

        // 使用传入的 mergedDeletedIds 或 state.deletedIds
        const deletedIds = mergedDeletedIds || state.deletedIds || [];

        // 过滤掉已删除的数据
        const normalizedDeletedIds = [...new Set((deletedIds || []).map(normalizeFinanceTransactionId).filter(Boolean))];
        const deletedSet = new Set(normalizedDeletedIds);
        const filterDeleted = (arr) => (arr || []).filter(item => !deletedSet.has(normalizeFinanceTransactionId(item.id)));
        const normalizedTransactions = dedupeFinanceTransactions(state.transactions);
        state.transactions = normalizedTransactions;

        const payload = {
            id: currentUser.id,
            todos: filterDeleted(state.todos),
            transactions: filterDeleted(normalizedTransactions),
            groups: filterDeleted(state.groups),
            templates: filterDeleted(state.templates),
            archivedTodos: filterDeleted(state.archivedTodos),
            habits: filterDeleted(state.habits),
            habitRecords: state.habitRecords,
            projects: filterDeleted(state.projects),
            milktea: state.milktea,
            coffee: state.coffee,
            dailyPlans: filterDeleted(state.dailyPlans),
            ideas: filterDeleted(state.ideas),
            ideaTags: state.ideaTags,
            // 上传 deletedIds，让其他设备知道哪些被删除了
            deletedids: normalizedDeletedIds.map(id => /^\d+$/.test(id) ? Number(id) : id),
            updated_at: new Date().toISOString()
        };

        const ensureResult = await ensureUserDataRow(payload);
        if (ensureResult.created) {
            console.log('[sync] first sync created user_data row');
            return true;
        }
        // 先尝试更新（PATCH）
        let res = await apiRequest(`${SUPABASE_URL}/rest/v1/user_data?id=eq.${currentUser.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${accessToken}`,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(payload)
        });

        // 如果没有数据可更新（404），则创建新数据（POST）
        if (res.status === 404) {
            console.log('[同步] 数据不存在，创建新数据...');
            res = await apiRequest(`${SUPABASE_URL}/rest/v1/user_data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${accessToken}`,
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(payload)
            });
        }

        console.log('[同步] 上传响应状态:', res.status);

        if (!res.ok) {
            const errorText = await res.text();
            console.error('[同步] 上传失败响应:', errorText);
            return false;
        }

        // 尝试解析响应，获取返回的数据
        try {
            const responseData = await res.json();
            console.log('[同步] 上传成功，云端数据:', responseData);
        } catch (e) {
            console.log('[同步] 上传成功（无响应体）');
        }

        return true;
    } catch (e) {
        console.error('[同步] 上传异常:', e);
        return false;
    }
}

// 云端同步 - 下载（智能合并，用于手动刷新）
async function syncFromCloud() {
    if (!currentUser || !accessToken) {
        showSyncToast('未登录，无法刷新', 'error');
        return;
    }

    try {
        console.log('[刷新] 从云端下载数据...');
        const res = await apiRequest(`${SUPABASE_URL}/rest/v1/user_data?id=eq.${currentUser.id}`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!res.ok) {
            console.error('[刷新] 下载失败:', res.status);
            showSyncToast(getSyncErrorToastMessage('刷新失败'), 'error');
            return;
        }

        const data = await res.json();
        if (data && data[0]) {
            // 合并本地的 deletedIds 和云端的 deletedids（取并集）
            const cloudDeletedIds = data[0].deletedids || [];
            const localDeletedIds = state.deletedIds || [];
            const allDeletedIds = [...new Set([...localDeletedIds, ...cloudDeletedIds])];

            // 智能合并（排除已删除的ID，按时间戳保留最新）
            state.todos = mergeArrays(state.todos, data[0].todos || [], allDeletedIds);
            state.transactions = dedupeFinanceTransactions(mergeArrays(dedupeFinanceTransactions(state.transactions), dedupeFinanceTransactions(data[0].transactions || []), allDeletedIds.map(normalizeFinanceTransactionId)));
            state.groups = mergeArrays(state.groups, data[0].groups || [], allDeletedIds);
            state.templates = mergeArrays(state.templates, data[0].templates || [], allDeletedIds);
            state.archivedTodos = mergeArrays(state.archivedTodos, data[0].archivedTodos || [], allDeletedIds);
            state.habits = mergeArrays(state.habits, data[0].habits || [], allDeletedIds);
            state.habitRecords = { ...(data[0].habitRecords || {}), ...state.habitRecords };
            state.projects = mergeArrays(state.projects, data[0].projects || [], allDeletedIds);
            state.milktea = { ...(data[0].milktea || { records: [], settings: { weeklyLimit: 2, monthlyLimit: 8 } }), ...state.milktea };
            state.coffee = { ...(data[0].coffee || { records: [], settings: { weeklyLimit: 3, monthlyLimit: 12 } }), ...state.coffee };
            state.dailyPlans = mergeArrays(state.dailyPlans, data[0].dailyPlans || data[0].dailyplans || [], allDeletedIds);
            state.ideas = mergeArrays(state.ideas, data[0].ideas || [], allDeletedIds);
            const cloudIdeaTags2 = data[0].ideaTags || [];
            state.ideaTags = [...new Set([...state.ideaTags, ...cloudIdeaTags2])].sort();

            // 同步完成后清除已删除的ID记录
            state.deletedIds = [];

            // 更新本地存储
            baseSave();
            renderAll();

            // 上传合并后的数据到云端，让其他设备也能同步到
            console.log('[刷新] 上传合并后的数据到云端...');
            await syncToCloud(allDeletedIds);

            showSyncToast('刷新成功');
            console.log('[刷新] 数据已更新');
        } else {
            showSyncToast('云端无数据', 'error');
        }
    } catch (e) {
        console.error('[刷新] 下载异常:', e);
        showSyncToast(getSyncErrorToastMessage('刷新失败'), 'error');
    }
}

// 保存时自动同步 - 无防抖，立即上传
// 保存原始 baseSave 函数的引用（在重定义之前）
const originalBaseSave = baseSave;

// ========== Realtime 实时同步 ==========
function subscribeToRealtime() {
    try {
        // 检查 Supabase 客户端是否可用
        if (!supabaseClient) {
            console.log('[Realtime] Supabase 客户端未初始化，跳过订阅');
            return;
        }

        // 先清理旧的订阅
        unsubscribeToRealtime();

        if (!currentUser || !accessToken) {
            console.log('[Realtime] 未登录，跳过订阅');
            return;
        }

        console.log('[Realtime] 正在订阅数据变化...');

        // 订阅 user_data 表的变化
        realtimeChannel = supabaseClient
            .channel('public:user_data')
            .on(
                'postgres_changes',
                {
                    event: '*', // 监听所有事件
                    schema: 'public',
                    table: 'user_data',
                    filter: `id=eq.${currentUser.id}`
                },
                (payload) => {
                    console.log('[Realtime] 收到数据变化:', payload);

                    // 处理不同类型的事件
                    if (payload.eventType === 'UPDATE' && payload.new) {
                        const cloudTodos = payload.new.todos || [];
                        const cloudTransactions = payload.new.transactions || [];
                        const cloudGroups = payload.new.groups || [];
                        const cloudTemplates = payload.new.templates || [];
                        const cloudArchivedTodos = payload.new.archivedTodos || [];
                        const cloudHabits = payload.new.habits || [];
                        const cloudHabitRecords = payload.new.habitRecords || {};
                        const cloudProjects = payload.new.projects || [];
                        const cloudMilktea = payload.new.milktea || { records: [], settings: { weeklyLimit: 2, monthlyLimit: 8 } };
                        const cloudCoffee = payload.new.coffee || { records: [], settings: { weeklyLimit: 3, monthlyLimit: 12 } };
                        const cloudDailyPlans = payload.new.dailyPlans || [];

                        // 比较是否有变化
                        const oldTodosJson = JSON.stringify(state.todos);

                        // 如果数据有变化，更新本地
                        if (oldTodosJson !== JSON.stringify(cloudTodos)) {
                            console.log('[Realtime] 检测到云端数据变化，更新本地...');
                            state.todos = cloudTodos;
                            state.transactions = cloudTransactions;
                            state.groups = cloudGroups;
                            state.templates = cloudTemplates;
                            state.archivedTodos = cloudArchivedTodos;
                            state.habits = cloudHabits;
                            state.habitRecords = cloudHabitRecords;
                            state.projects = cloudProjects;
                            state.milktea = cloudMilktea;
                            state.coffee = cloudCoffee;
                            state.dailyPlans = cloudDailyPlans;
                            state.ideas = payload.new.ideas || [];
                            state.ideaTags = payload.new.ideaTags || [];

                            // 更新本地存储
                            baseSave();

                            // 更新 UI
                            renderAll();
                            showSyncToast('数据已同步');
                        }
                    } else if (payload.eventType === 'INSERT' && payload.new) {
                        // 新数据插入，更新本地
                        const cloudTodos = payload.new.todos || [];
                        const cloudTransactions = payload.new.transactions || [];
                        const cloudGroups = payload.new.groups || [];
                        const cloudTemplates = payload.new.templates || [];
                        const cloudArchivedTodos = payload.new.archivedTodos || [];
                        const cloudHabits = payload.new.habits || [];
                        const cloudHabitRecords = payload.new.habitRecords || {};
                        const cloudProjects = payload.new.projects || [];
                        const cloudMilktea2 = payload.new.milktea || { records: [], settings: { weeklyLimit: 2, monthlyLimit: 8 } };
                        const cloudCoffee2 = payload.new.coffee || { records: [], settings: { weeklyLimit: 3, monthlyLimit: 12 } };
                        const cloudDailyPlans2 = payload.new.dailyPlans || [];

                        console.log('[Realtime] 检测到新数据，更新本地...');
                        state.todos = cloudTodos;
                        state.transactions = cloudTransactions;
                        state.groups = cloudGroups;
                        state.templates = cloudTemplates;
                        state.archivedTodos = cloudArchivedTodos;
                        state.habits = cloudHabits;
                        state.habitRecords = cloudHabitRecords;
                        state.projects = cloudProjects;
                        state.milktea = cloudMilktea2;
                        state.coffee = cloudCoffee2;
                        state.dailyPlans = cloudDailyPlans2;
                        state.ideas = payload.new.ideas || [];
                        state.ideaTags = payload.new.ideaTags || [];

                        // 更新本地存储
                        baseSave();

                        // 更新 UI
                        renderAll();
                        showSyncToast('数据已同步');
                    }
                }
            )
            .subscribe((status, err) => {
                if (err) {
                    console.error('[Realtime] 订阅错误:', err);
                } else {
                    console.log('[Realtime] 订阅状态:', status);
                    if (status === 'SUBSCRIBED') {
                        console.log('[Realtime] ✓ 订阅成功，将实时接收数据变化');
                    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        console.log('[Realtime] 连接断开，5秒后重连...');
                        setTimeout(() => {
                            if (currentUser && accessToken) subscribeToRealtime();
                        }, 5000);
                    } else if (status === 'CLOSED') {
                        console.log('[Realtime] 连接已关闭');
                    }
                }
            });
    } catch (e) {
        console.error('[Realtime] 订阅异常:', e);
    }
}

function unsubscribeToRealtime() {
    if (realtimeChannel) {
        try {
            console.log('[Realtime] 取消订阅');
            supabaseClient.removeChannel(realtimeChannel);
        } catch (e) {
            console.warn('[Realtime] 取消订阅失败（非致命）:', e);
        }
        realtimeChannel = null;
    }
}

function save() {
    state.transactions = dedupeFinanceTransactions(state.transactions);

    // 立即保存到本地
    baseSave();

    // 发布数据变更通知
    publish('data-changed', state);

    // 云同步（带防抖）
    if (currentUser) {
        clearTimeout(save._debounceTimer);
        save._debounceTimer = setTimeout(() => {
            console.log('[自动同步] 上传数据到云端...');
            syncToCloud();
        }, 500);
    }
}

// 页面卸载前立即同步并保存
window.addEventListener('beforeunload', () => {
    baseSave();
    if (currentUser) {
        syncToCloud();
    }
});

// 检查已保存的登录状态（静默失败，不阻塞应用）
async function checkAuthStatus() {
    try {
        const savedUserId = localStorage.getItem('user_id');
        const savedToken = localStorage.getItem('access_token');
        const savedRefreshToken = localStorage.getItem('refresh_token');

        console.log('[checkAuthStatus] 开始检查本地存储的登录状态:',
            'user_id=', savedUserId ? '存在' : '无',
            'access_token=', savedToken ? '存在' : '无',
            'refresh_token=', savedRefreshToken ? '存在' : '无');

        if (savedUserId && savedToken) {
            console.log('[checkAuthStatus] 找到已保存的登录凭证，正在恢复会话...');
            currentUser = { id: savedUserId };
            accessToken = savedToken;
            refreshToken = savedRefreshToken;
            isolateLocalDataForUser(savedUserId);
            localStorage.setItem('data_owner_user_id', savedUserId);

            // 先主动刷新token（确保token有效），再启动定时刷新
            if (refreshToken) {
                const preRefreshed = await refreshAccessToken().catch(() => false);
                if (!preRefreshed) {
                    console.warn('[检查登录状态] 预刷新token失败，使用旧token尝试');
                }
                scheduleTokenRefresh();
            }

            // 尝试同步，但不阻塞应用启动
            await syncDataOnLogin().catch(async (e) => {
                console.warn('[检查登录状态] 同步失败，尝试刷新token...', e);
                // 如果同步失败，可能是 token 过期，尝试刷新
                if (refreshToken) {
                    const refreshed = await refreshAccessToken();
                    if (refreshed) {
                        // 刷新成功，重试同步
                        await syncDataOnLogin().catch(e2 => {
                            console.warn('[检查登录状态] 刷新后同步仍失败:', e2);
                        });
                    }
                }
            });
            // 启动 Realtime 实时同步
            subscribeToRealtime();
            updateCloudStatus();
            console.log('[checkAuthStatus] 登录状态恢复完成，currentUser=', currentUser ? currentUser.id : 'null');
        } else {
            console.log('[checkAuthStatus] 未找到已保存的登录凭证，跳过自动登录');
        }
    } catch (e) {
        console.error('[检查登录状态] 错误:', e);
        // 确保应用能正常使用
        currentUser = null;
        accessToken = null;
        refreshToken = null;
    }
}
checkAuthStatus();

// 页面可见性变化时刷新token
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && refreshToken && currentUser) {
        console.log('[Token刷新] 页面重新激活，检查token...');
        refreshAccessToken().then(ok => {
            if (ok) console.log('[Token刷新] 页面恢复后自动续期成功');
        });
    }
});

// 迁移旧版账号数据
function migrateOldAccountData() {
    const oldEmail = localStorage.getItem('remembered_email');
    const oldPassword = localStorage.getItem('remembered_password');

    if (oldEmail) {
        const accounts = getSavedAccounts();
        const exists = accounts.some(acc => acc.email === oldEmail);

        if (!exists) {
            saveAccount(oldEmail, oldPassword ? atob(oldPassword) : '', !!oldPassword);
        }

        // 清除旧数据
        localStorage.removeItem('remembered_email');
        localStorage.removeItem('remembered_password');
    }
}
migrateOldAccountData();

// 点击外部关闭账号列表
document.addEventListener('click', function (event) {
    const dropdown = document.getElementById('accountListDropdown');
    const listBtn = document.getElementById('accountListBtn');
    const emailInput = document.getElementById('authEmail');

    if (dropdown && listBtn && !dropdown.contains(event.target) && !listBtn.contains(event.target) && event.target !== emailInput) {
        hideAccountList();
    }
});

// 认证模式切换
let isLoginMode = true;
function switchAuthMode() {
    isLoginMode = !isLoginMode;
    const titleElement = document.getElementById('authTitle');
    titleElement.innerHTML = isLoginMode
        ? '<i class="fas fa-user-circle" style="color: var(--accent-color);"></i> 登录账号'
        : '<i class="fas fa-user-plus" style="color: var(--accent-color);"></i> 注册账号';
    document.getElementById('authSwitchText').innerText = isLoginMode ? '没有账号？去注册' : '已有账号？去登录';
    document.getElementById('authSubmitBtnText').innerText = isLoginMode ? '登录' : '注册';
    document.getElementById('authError').style.display = 'none';
    document.getElementById('authSuccess').style.display = 'none';
    // 显示/隐藏忘记密码链接（仅登录模式显示）
    document.getElementById('forgotPassword').style.display = isLoginMode ? 'inline' : 'none';
    // 显示/隐藏记住密码选项（仅登录模式显示）
    document.getElementById('rememberPasswordSection').style.display = isLoginMode ? 'flex' : 'none';
    // 显示/隐藏账号列表按钮（仅登录模式显示）
    const accountListBtn = document.getElementById('accountListBtn');
    if (isLoginMode) {
        updateAccountListButton();
        // 切换回登录模式时，自动填充最后使用的账号
        const accounts = getSavedAccounts();
        if (accounts.length > 0) {
            const lastAccount = accounts[0];
            document.getElementById('authEmail').value = lastAccount.email;
            if (lastAccount.password) {
                document.getElementById('authPassword').value = atob(lastAccount.password);
                document.getElementById('rememberPassword').checked = true;
            }
        }
    } else {
        // 切换到注册模式时清空输入框
        document.getElementById('authEmail').value = '';
        document.getElementById('authPassword').value = '';
        document.getElementById('rememberPassword').checked = false;
        accountListBtn.style.display = 'none';
        hideAccountList();
    }
}

// 提交认证
async function submitAuth() {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const errorDiv = document.getElementById('authError');
    const errorText = document.getElementById('authErrorText');
    const successDiv = document.getElementById('authSuccess');
    const successText = document.getElementById('authSuccessText');
    const submitBtn = document.getElementById('authSubmitBtn');
    const submitBtnText = document.getElementById('authSubmitBtnText');
    const submitLoader = document.getElementById('authSubmitLoader');

    // 隐藏之前的消息
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !password) {
        errorText.innerText = '请填写邮箱和密码';
        errorDiv.style.display = 'block';
        return;
    }

    if (!emailRegex.test(email)) {
        errorText.innerText = '请输入有效的邮箱地址';
        errorDiv.style.display = 'block';
        return;
    }

    if (password.length < 6) {
        errorText.innerText = '密码至少需要6位字符';
        errorDiv.style.display = 'block';
        return;
    }

    // 显示加载状态
    submitBtn.disabled = true;
    submitLoader.style.display = 'inline-block';
    submitBtnText.innerText = isLoginMode ? '登录中...' : '注册中...';

    try {
        let result = isLoginMode ? await signIn(email, password) : await signUp(email, password);

        if (result.error) {
            errorText.innerText = result.error;
            errorDiv.style.display = 'block';
        } else if (result.needVerification) {
            // 注册成功，需要验证邮箱
            successText.innerText = '注册成功！请检查邮箱并点击验证链接';
            successDiv.style.display = 'block';
            setTimeout(() => {
                switchAuthMode(); // 切换到登录模式
            }, 2000);
        } else {
            // 登录成功
            successText.innerText = isLoginMode ? '登录成功！' : '注册成功！';
            successDiv.style.display = 'block';

            // 保存账号（登录模式下）
            if (isLoginMode) {
                const rememberPass = document.getElementById('rememberPassword').checked;
                saveAccount(email, password, rememberPass);
            }

            setTimeout(() => {
                closeModal('authModal');
                updateCloudStatus();
            }, 800);
        }
    } finally {
        // 恢复按钮状态
        submitBtn.disabled = false;
        submitLoader.style.display = 'none';
        submitBtnText.innerText = isLoginMode ? '登录' : '注册';
    }
}

// ========== 多账号管理系统 ==========

// 获取所有保存的账号
function getSavedAccounts() {
    try {
        const accounts = localStorage.getItem('saved_accounts');
        return accounts ? JSON.parse(accounts) : [];
    } catch (e) {
        console.error('读取账号列表失败:', e);
        return [];
    }
}

// 保存账号列表
function saveSavedAccounts(accounts) {
    try {
        localStorage.setItem('saved_accounts', JSON.stringify(accounts));
    } catch (e) {
        console.error('保存账号列表失败:', e);
    }
}

// 添加或更新账号
function saveAccount(email, password, rememberPassword) {
    console.log('[saveAccount] 保存账号:', email, '记住密码:', rememberPassword);
    const accounts = getSavedAccounts();
    const existingIndex = accounts.findIndex(acc => acc.email === email);

    const accountData = {
        email: email,
        password: rememberPassword ? btoa(password) : null,
        lastUsed: new Date().toISOString()
    };

    if (existingIndex >= 0) {
        accounts[existingIndex] = accountData;
    } else {
        accounts.unshift(accountData); // 添加到开头
    }

    // 最多保存10个账号
    if (accounts.length > 10) {
        accounts.length = 10;
    }

    saveSavedAccounts(accounts);
    console.log('[saveAccount] 账号已保存，当前账号数:', accounts.length);
}

// 删除账号
function deleteAccount(email) {
    const accounts = getSavedAccounts();
    const filtered = accounts.filter(acc => acc.email !== email);
    saveSavedAccounts(filtered);
    updateAccountListButton();
    if (document.getElementById('accountListDropdown').style.display === 'block') {
        renderAccountList();
    }
}

// 选择账号
function selectAccount(email) {
    const accounts = getSavedAccounts();
    const account = accounts.find(acc => acc.email === email);

    if (account) {
        document.getElementById('authEmail').value = account.email;
        document.getElementById('authPassword').value = account.password ? atob(account.password) : '';
        document.getElementById('rememberPassword').checked = !!account.password;
        hideAccountList();
        // 聚焦到密码框
        setTimeout(() => {
            document.getElementById('authPassword').focus();
        }, 100);
    }
}

// 渲染账号列表
function renderAccountList() {
    const accounts = getSavedAccounts();
    const dropdown = document.getElementById('accountListDropdown');

    if (accounts.length === 0) {
        dropdown.innerHTML = `
            <div style="padding: 15px; text-align: center; color: var(--text-secondary); font-size: 0.9rem;">
                <i class="fas fa-info-circle"></i> 暂无保存的账号
            </div>
        `;
        return;
    }

    dropdown.innerHTML = accounts.map(account => `
        <div style="display: flex; align-items: center; gap: 10px; padding: 12px; border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.2s;"
            onmouseover="this.style.background='var(--bg-color)'"
            onmouseout="this.style.background='white'"
            onclick="selectAccount('${account.email.replace(/'/g, "\\'")}')">
            <i class="fas fa-user-circle" style="color: var(--accent-color); font-size: 1.2rem;"></i>
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${account.email}
                </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary);">
                    ${account.password ? '<i class="fas fa-key"></i> 已保存密码' : '<i class="fas fa-key-slash"></i> 未保存密码'}
                </div>
            </div>
            <button type="button"
                style="background: none; border: none; color: var(--danger-color); cursor: pointer; padding: 5px; font-size: 1rem;"
                onclick="event.stopPropagation(); deleteAccount('${account.email.replace(/'/g, "\\'")}')"
                title="删除此账号">
                <i class="fas fa-times-circle"></i>
            </button>
        </div>
    `).join('');
}

// 切换账号列表显示
function toggleAccountList() {
    const dropdown = document.getElementById('accountListDropdown');
    if (dropdown.style.display === 'block') {
        hideAccountList();
    } else {
        renderAccountList();
        dropdown.style.display = 'block';
    }
}

// 隐藏账号列表
function hideAccountList() {
    document.getElementById('accountListDropdown').style.display = 'none';
}

// 更新账号列表按钮显示状态
function updateAccountListButton() {
    const accounts = getSavedAccounts();
    const btn = document.getElementById('accountListBtn');
    btn.style.display = accounts.length > 0 ? 'block' : 'none';
}

// 打开登录窗口
function openAuthModal() {
    console.log('[登录] 打开登录窗口');

    // 检查是否有保存的账号，决定默认显示登录还是注册
    const accounts = getSavedAccounts();
    const hasAccounts = accounts.length > 0;

    // 设置模式：有账号显示登录，无账号显示注册
    isLoginMode = hasAccounts;

    // 更新 UI
    const titleElement = document.getElementById('authTitle');
    titleElement.innerHTML = isLoginMode
        ? '<i class="fas fa-user-circle" style="color: var(--accent-color);"></i> 登录账号'
        : '<i class="fas fa-user-plus" style="color: var(--accent-color);"></i> 注册账号';
    document.getElementById('authSwitchText').innerText = isLoginMode ? '没有账号？去注册' : '已有账号？去登录';
    document.getElementById('authSubmitBtnText').innerText = isLoginMode ? '登录' : '注册';
    document.getElementById('forgotPassword').style.display = isLoginMode ? 'inline' : 'none';
    document.getElementById('rememberPasswordSection').style.display = isLoginMode ? 'flex' : 'none';

    // 清空输入
    document.getElementById('authEmail').value = '';
    document.getElementById('authPassword').value = '';
    document.getElementById('rememberPassword').checked = false;

    // 自动填充最后使用的账号（仅在登录模式）
    if (isLoginMode && accounts.length > 0) {
        const lastAccount = accounts[0]; // 最近使用的账号
        document.getElementById('authEmail').value = lastAccount.email;
        if (lastAccount.password) {
            document.getElementById('authPassword').value = atob(lastAccount.password);
            document.getElementById('rememberPassword').checked = true;
        }
    }

    document.getElementById('authError').style.display = 'none';
    document.getElementById('authSuccess').style.display = 'none';
    hideAccountList();
    updateAccountListButton();

    openModal('authModal');

    // 自动聚焦
    setTimeout(() => {
        const emailInput = document.getElementById('authEmail');
        if (emailInput.value) {
            document.getElementById('authPassword').focus();
        } else {
            emailInput.focus();
        }
    }, 100);
}

// 切换密码显示/隐藏
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('authPassword');
    const toggleBtn = document.getElementById('togglePassword');
    const icon = toggleBtn.querySelector('i');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.className = 'fas fa-eye-slash';
        toggleBtn.title = '隐藏密码';
    } else {
        passwordInput.type = 'password';
        icon.className = 'fas fa-eye';
        toggleBtn.title = '显示密码';
    }
}

// 处理回车键登录
function handleAuthKeyPress(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        submitAuth();
    }
}

// 显示忘记密码信息
function showForgotPasswordInfo() {
    const overlay = createDialogOverlay();
    const dialog = createDialog('忘记密码', `
        <p style="margin: 15px 0; line-height: 1.6; color: var(--text-secondary);">
            如果您忘记了密码，可以通过以下步骤重置：
        </p>
        <ol style="margin: 15px 0; padding-left: 20px; line-height: 1.8; color: var(--text-secondary);">
            <li>访问 Supabase 项目管理页面</li>
            <li>进入 Authentication → Users</li>
            <li>找到您的账号并重置密码</li>
        </ol>
        <p style="margin: 15px 0; padding: 10px; background: var(--bg-color); border-radius: var(--radius); border: 2px solid var(--border-color); font-size: 0.9rem;">
            <i class="fas fa-info-circle" style="color: var(--accent-color);"></i>
            或者您可以注册一个新账号
        </p>
        <button class="dialog-btn-primary" data-action="confirm">知道了</button>
    `);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    setupDialogButtons(overlay, () => {});
}

// 更新云同步状态
function updateCloudStatus() {
    const cloudBtn = document.getElementById('cloudSyncBtn');
    console.log('[updateCloudStatus] currentUser:', currentUser ? currentUser.id : 'null', 'cloudBtn:', !!cloudBtn);
    if (currentUser) {
        cloudBtn.style.color = 'var(--success-color)';
        cloudBtn.title = '已登录云端同步';
    } else {
        cloudBtn.style.color = '';
        cloudBtn.title = '点击登录开启云同步';
    }
}

// 云同步按钮点击
document.getElementById('cloudSyncBtn').onclick = async () => {
    if (currentUser) {
        const confirmed = await showConfirm('退出登录', '当前已登录，是否退出？');
        if (confirmed === 1) {
            await signOut();
        }
    } else {
        openAuthModal();
    }
};

// 刷新按钮点击
document.getElementById('refreshBtn').onclick = () => {
    if (!currentUser) {
        showSyncToast('请先登录', 'error');
        return;
    }
    syncFromCloud();
};

// 设置按钮
(function() {
    const btn = document.getElementById('settingsBtn');
    if (!btn) return;
    let panel = document.getElementById('settingsPanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'settingsPanel';
        panel.style.cssText = 'position:absolute;top:100%;right:0;margin-top:4px;background:var(--card-bg);border:2px solid var(--border-color);border-radius:var(--radius);box-shadow:var(--shadow);padding:12px 16px;z-index:999;min-width:220px;display:none;';
        panel.innerHTML = `
            <div style="font-weight:800;font-size:0.8rem;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em;">应用设置</div>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.8rem;">
                <input type="checkbox" id="settingMinimizeToTray" style="width:16px;height:16px;accent-color:var(--accent-color);">
                关闭时最小化到托盘
            </label>
            <div id="widgetOpacitySetting" style="margin-top:10px;">
                <div style="font-weight:700;font-size:0.8rem;margin-bottom:6px;">小组件失焦透明度</div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <input type="range" id="settingWidgetOpacity" min="0.1" max="1" step="0.02" value="0.94"
                           style="flex:1;accent-color:var(--accent-color);">
                    <span id="widgetOpacityValue" style="font-size:0.8rem;font-weight:700;min-width:35px;text-align:right;">94%</span>
                </div>
            </div>`;
        btn.parentElement.style.position = 'relative';
        btn.parentElement.appendChild(panel);
    }
    btn.onclick = (e) => {
        e.stopPropagation();
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    };
    document.addEventListener('click', (e) => {
        if (!panel.contains(e.target) && e.target !== btn) panel.style.display = 'none';
    });
    if (isElectron) {
        const { ipcRenderer: _ipcSettings } = require('electron');
        _ipcSettings.send('get-close-behavior');
        _ipcSettings.on('close-behavior', (_, val) => {
            document.getElementById('settingMinimizeToTray').checked = !!val;
        });
        document.getElementById('settingMinimizeToTray').addEventListener('change', (e) => {
            _ipcSettings.send('set-close-behavior', e.target.checked);
        });

        // Widget opacity setting
        const opacitySlider = document.getElementById('settingWidgetOpacity');
        const opacityValue = document.getElementById('widgetOpacityValue');
        if (opacitySlider && opacityValue) {
            _ipcSettings.send('get-widget-opacity');
            _ipcSettings.on('widget-opacity', (_, val) => {
                opacitySlider.value = val;
                opacityValue.textContent = Math.round(val * 100) + '%';
            });
            opacitySlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                opacityValue.textContent = Math.round(val * 100) + '%';
                _ipcSettings.send('set-widget-opacity', val);
            });
        }

        // 关闭行为选择对话框
        const closeDialog = document.getElementById('closeBehaviorDialog');
        _ipcSettings.on('ask-close-behavior', () => {
            closeDialog.classList.add('active');
            closeDialog.style.display = 'flex';
        });
        document.getElementById('closeActionQuit').onclick = () => {
            closeDialog.classList.remove('active');
            closeDialog.style.display = 'none';
            if (document.getElementById('closeRememberChoice').checked) {
                _ipcSettings.send('set-close-behavior', false);
                document.getElementById('settingMinimizeToTray').checked = false;
            }
            _ipcSettings.send('window-close-direct');
        };
        document.getElementById('closeActionTray').onclick = () => {
            closeDialog.classList.remove('active');
            closeDialog.style.display = 'none';
            if (document.getElementById('closeRememberChoice').checked) {
                _ipcSettings.send('set-close-behavior', true);
                document.getElementById('settingMinimizeToTray').checked = true;
            }
            _ipcSettings.send('window-close-direct');
        };
    } else {
        panel.style.display = 'none';
        btn.style.display = 'none';
    }
})();

// 导入/导出功能
document.getElementById('importExportBtn').onclick = () => {
    showImportExportMenu();
};

// 显示导入导出菜单

// Expose to window for cross-module access
window.showSyncToast = showSyncToast;
window.save = save;
window.signIn = signIn;
window.signOut = signOut;
window.openAuthModal = openAuthModal;
window.submitAuth = submitAuth;
window.switchAuthMode = switchAuthMode;
window.updateCloudStatus = updateCloudStatus;

console.log('[sync.js] 全部加载完成，按钮处理程序已设置');
console.log('[sync.js] cloudSyncBtn:', !!document.getElementById('cloudSyncBtn').onclick);
console.log('[sync.js] refreshBtn:', !!document.getElementById('refreshBtn').onclick);
console.log('[sync.js] settingsBtn:', !!document.getElementById('settingsBtn').onclick);
console.log('[sync.js] importExportBtn:', !!document.getElementById('importExportBtn').onclick);

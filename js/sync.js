// 云同步与认证系统

// 初始化 Supabase 客户端（带错误处理）
try {
    if (typeof supabase !== 'undefined' && supabase.createClient) {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                // Authentication is deliberately owned by the serialized REST
                // session flow below. A second SDK refresh loop can rotate the
                // same refresh token behind our back and invalidate the session.
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        });
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

// 登录同步与手动刷新共享同一条串行、乐观并发安全的路径。
async function syncDataOnLogin() {
            return syncFromCloud({ loginSync: true });
        }

// 登录
// Token 刷新变量（refreshToken 在 state.js 中声明）
let tokenRefreshTimer = null;
let refreshAccessTokenPromise = null;
let authSessionGeneration = 0;
let syncOperationTail = Promise.resolve();
const SYNC_REQUEST_TIMEOUT_MS = 15000;
const SYNC_RETURN_COLUMNS = [
    'id', 'updated_at',
    'todos', 'transactions', 'groups', 'templates',
    'archivedTodos', 'archivedtodos',
    'habits', 'habitRecords', 'habitrecords',
    'projects', 'milktea', 'dailyPlans', 'coffee',
    'deletedids', 'ideas', 'ideaTags'
].join(',');

function enqueueSyncOperation(operation) {
            const run = syncOperationTail.then(operation, operation);
            syncOperationTail = run.then(() => undefined, () => undefined);
            return run;
        }

function captureSyncSession(expectedUserId) {
            if (!currentUser || !accessToken) return null;
            if (expectedUserId && expectedUserId !== currentUser.id) return null;
            return {
                userId: currentUser.id,
                generation: authSessionGeneration,
                accessToken
            };
        }

function isSyncSessionCurrent(session) {
            return !!session
                && session.generation === authSessionGeneration
                && currentUser?.id === session.userId
                && !!accessToken;
        }

async function sessionApiRequest(session, url, options = {}, retry = true) {
            if (!isSyncSessionCurrent(session)) return null;
            if (accessToken) session.accessToken = accessToken;
            const headers = new Headers(options.headers || {});
            headers.set('apikey', SUPABASE_ANON_KEY);
            headers.set('Authorization', `Bearer ${session.accessToken}`);
            const timeoutController = typeof AbortController === 'function'
                ? new AbortController()
                : null;
            const callerSignal = options.signal;
            let callerAbortHandler = null;
            if (timeoutController && callerSignal) {
                callerAbortHandler = () => timeoutController.abort();
                if (callerSignal.aborted) callerAbortHandler();
                else callerSignal.addEventListener('abort', callerAbortHandler, { once: true });
            }
            const timeoutId = timeoutController
                ? setTimeout(() => timeoutController.abort(), SYNC_REQUEST_TIMEOUT_MS)
                : null;
            let response;
            try {
                response = await fetch(url, {
                    ...options,
                    headers,
                    ...(timeoutController ? { signal: timeoutController.signal } : {})
                });
            } finally {
                if (timeoutId) clearTimeout(timeoutId);
                if (callerSignal && callerAbortHandler) {
                    callerSignal.removeEventListener('abort', callerAbortHandler);
                }
            }
            if (!isSyncSessionCurrent(session)) return null;
            if (response.status === 401 && retry && refreshToken) {
                const refreshed = await refreshAccessToken();
                if (!refreshed || !isSyncSessionCurrent(session) || !accessToken) return null;
                session.accessToken = accessToken;
                return sessionApiRequest(session, url, options, false);
            }
            return response;
        }

function isRetryableSyncStatus(status) {
            return status === 408 || status === 409 || status === 429 || status >= 500;
        }

async function waitForSyncRetry(attempt) {
            const delay = Math.min(1600, 120 * (2 ** attempt)) + Math.floor(Math.random() * 120);
            await new Promise(resolve => setTimeout(resolve, delay));
        }

// 刷新 access token
async function refreshAccessToken() {
            const generation = authSessionGeneration;
            if (refreshAccessTokenPromise?.generation === generation) {
                return refreshAccessTokenPromise.promise;
            }
            const pendingRefresh = performRefreshAccessToken(generation);
            const entry = { generation, promise: pendingRefresh };
            refreshAccessTokenPromise = entry;
            try {
                return await pendingRefresh;
            } finally {
                if (refreshAccessTokenPromise === entry) {
                    refreshAccessTokenPromise = null;
                }
            }
        }

async function performRefreshAccessToken(generation) {
            if (!refreshToken) {
                console.warn('[Token刷新] 没有refresh_token，无法刷新');
                return false;
            }
            const tokenBeingRefreshed = refreshToken;

            try {
                console.log('[Token刷新] 开始刷新token...');
                const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_ANON_KEY
                    },
                    body: JSON.stringify({ refresh_token: tokenBeingRefreshed })
                });

                const data = await res.json();

                if (generation !== authSessionGeneration || !currentUser) {
                    console.warn('[Token刷新] 会话已变化，忽略旧刷新结果');
                    return false;
                }

                if (!res.ok || !data.access_token) {
                    console.error('[Token刷新] 刷新失败:', data);
                    console.error('[Token刷新] 错误详情:', data.error_description || data.error || 'Unknown error');

                    // 如果是 refresh_token 过期，提示用户重新登录
                    if (data.error === 'invalid_grant' || data.error_description?.includes('expired')) {
                        console.error('[Token刷新] Refresh token已过期，需要重新登录');

                        // 显示明显的全屏提示
                        const overlay = createDialogOverlay();
                        const dialog = createDialog(`
                            <div style="text-align: center;">
                                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--danger-color); margin-bottom: 20px;"></i>
                                <h3 style="margin: 0 0 15px 0; font-size: 1.5rem;">登录已过期</h3>
                                <p style="margin: 0 0 20px 0; color: var(--text-secondary); line-height: 1.6;">
                                    您的登录状态已过期，需要重新登录以继续使用云同步功能。<br>
                                    点击确定后将自动跳转到登录页面。
                                </p>
                            </div>
                        `);

                        setupDialogButtons(overlay, dialog, '确定', null, () => {
                            // 失效会话无法再上传；保留账号归属的本地数据，
                            // 同账号重新登录后会继续合并。
                            signOut({ allowUnsynced: true });
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
                if (supabaseClient?.realtime?.setAuth) {
                    supabaseClient.realtime.setAuth(data.access_token);
                }
                // The main renderer is the single owner of refresh-token
                // rotation. Export the new access token to the widget instead
                // of allowing two processes to rotate the same session.
                exportWidgetData();

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

                if (!res.ok) {
                    return { error: data.error_description || data.error?.message || '登录失败' };
                }

                if (!data.user || !data.access_token) {
                    return { error: '登录失败：未返回用户信息，请确认邮箱已验证' };
                }

                authSessionGeneration += 1;
                refreshAccessTokenPromise = null;
                currentUser = data.user;
                accessToken = data.access_token;
                refreshToken = data.refresh_token;
                localStorage.setItem('user_id', data.user.id);
                localStorage.setItem('access_token', data.access_token);
                localStorage.setItem('refresh_token', data.refresh_token);
                const ownerUserId = localStorage.getItem('data_owner_user_id');
                const hasAnonymousData = !ownerUserId && hasAccountScopedLocalData();
                if (ownerUserId && ownerUserId !== data.user.id) {
                    isolateLocalDataForUser(data.user.id);
                }
                if (!hasAnonymousData) {
                    localStorage.setItem('data_owner_user_id', data.user.id);
                }

                // 启动定时刷新
                scheduleTokenRefresh();

                // 未归属数据必须先由用户明确决定，不能因为一次登录就
                // 自动写入新账号的云端行。
                if (hasAnonymousData) {
                    return { success: true, hasAnonymousData: true };
                }

                await syncDataOnLogin();

                // 启动 Realtime 实时同步
                subscribeToRealtime();

                return { success: true };
            } catch (e) {
                console.error('登录异常:', e);
                return { error: '网络错误：' + e.message };
            }
        }

async function resolveAnonymousData(keepLocal) {
            const session = captureSyncSession();
            if (!session) return false;
            const accountKeys = Object.keys(getAccountScopedDefaults());
            const backup = Object.fromEntries(accountKeys.map(key => [
                key,
                JSON.parse(JSON.stringify(state[key]))
            ]));

            if (keepLocal) {
                localStorage.setItem('data_owner_user_id', session.userId);
                return syncDataOnLogin();
            }

            backupAccountScopedLocalData(null);
            resetAccountScopedState();
            localStorage.setItem('data_owner_user_id', session.userId);
            baseSave();
            const synced = await syncDataOnLogin();
            if (synced) return true;

            Object.assign(state, backup);
            baseSave();
            localStorage.removeItem('data_owner_user_id');
            renderAll();
            return false;
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
async function signOut({ allowUnsynced = false } = {}) {
            try {
                if (currentUser && accessToken && !allowUnsynced) {
                    showSyncToast('正在确认云端已保存...', 'info');
                    const uploaded = await Promise.race([
                        syncToCloud(),
                        new Promise(resolve => setTimeout(() => resolve(false), 5000))
                    ]);
                    if (!uploaded) {
                        showSyncToast('云端尚未保存，为防止数据丢失已取消退出', 'error');
                        return false;
                    }
                }

                // 取消 Realtime 订阅（静默失败，不阻塞登出）
                try {
                    unsubscribeToRealtime();
                } catch (e) {
                    console.warn('[登出] 取消订阅失败（非致命）:', e);
                }

                // 使仍在途中的刷新请求失效，避免退出后被旧响应重新写回凭证。
                authSessionGeneration += 1;

                // Direct REST sign-in is not owned by supabase-js, so revoke
                // this exact server session explicitly before dropping tokens.
                const tokenToRevoke = accessToken;
                if (tokenToRevoke) {
                    try {
                        await Promise.race([
                            fetch(`${SUPABASE_URL}/auth/v1/logout?scope=local`, {
                                method: 'POST',
                                headers: {
                                    'apikey': SUPABASE_ANON_KEY,
                                    'Authorization': `Bearer ${tokenToRevoke}`
                                }
                            }),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('logout timeout')), 5000))
                        ]);
                    } catch (error) {
                        console.warn('[登出] 无法确认服务器会话撤销:', error);
                    }
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

                console.log('[登出] 已清理登录状态');

                // 刷新页面
                setTimeout(() => location.reload(), 100);
                return true;
            } catch (e) {
                console.error('[登出] 错误:', e);
                showSyncToast('退出失败，本地数据仍已保留', 'error');
                return false;
            }
        }

// 云端同步 - 上传（使用 PATCH 确保数据更新）
// deletedIds 参数用于在同步时使用合并后的 deletedIds（可选）
function canonicalSyncJson(value) {
            const compareSyncStrings = (left, right) => {
                const a = String(left);
                const b = String(right);
                return a < b ? -1 : (a > b ? 1 : 0);
            };
            const normalize = input => {
                if (Array.isArray(input)) return input.map(normalize);
                if (input && typeof input === 'object') {
                    return Object.fromEntries(
                        Object.entries(input)
                            .sort(([a], [b]) => compareSyncStrings(a, b))
                            .map(([key, nested]) => [key, normalize(nested)])
                    );
                }
                return input;
            };
            return JSON.stringify(normalize(value));
        }

function stateSyncFingerprint() {
            return canonicalSyncJson({
                todos: state.todos,
                transactions: state.transactions,
                groups: state.groups,
                templates: state.templates,
                archivedTodos: state.archivedTodos,
                habits: state.habits,
                habitRecords: state.habitRecords,
                projects: state.projects,
                milktea: state.milktea,
                coffee: state.coffee,
                dailyPlans: state.dailyPlans,
                ideas: state.ideas,
                ideaTags: state.ideaTags,
                deletedIds: state.deletedIds,
                focusSessions: state.focusSessions
            });
        }

function cloudPayloadHasChanges(payload, cloudRow) {
            return Object.entries(payload).some(([key, value]) =>
                key !== 'id'
                && key !== 'updated_at'
                && canonicalSyncJson(value) !== canonicalSyncJson(cloudRow?.[key])
            );
        }

function buildCloudPayloadForSync(deletedIds, userId = currentUser?.id) {
            const normalizedDeletedIds = compactSyncTombstones(
                migrateLegacyTombstones(
                    [...new Map(ensureSyncArray(deletedIds).map(id => [String(id), id])).values()],
                    buildLegacyTombstoneSources()
                )
            );
            const filterDeleted = (arr, kind) => ensureSyncArray(arr)
                .filter(item => !isEntityDeleted(kind, item.id, normalizedDeletedIds));
            const normalizedTransactions = dedupeFinanceTransactions(state.transactions);
            state.transactions = normalizedTransactions;
            state.milktea.records = ensureSyncArray(state.milktea?.records)
                .map(record => normalizeDrinkRecord(record, 'milktea'));
            state.coffee.records = ensureSyncArray(state.coffee?.records)
                .map(record => normalizeDrinkRecord(record, 'coffee'));
            syncIdeaTags();

            const archivedTodos = filterDeleted(state.archivedTodos, 'todo');
            const habits = filterDeleted(state.habits, 'habit');
            const habitRecords = pruneOrphanHabitRecords(state.habitRecords, habits);
            return {
                id: userId,
                todos: filterDeleted(state.todos, 'todo'),
                transactions: normalizedTransactions.filter(record => !isFinanceTransactionDeleted(record, normalizedDeletedIds)),
                groups: filterDeleted(state.groups, 'group'),
                templates: filterDeleted(state.templates, 'template'),
                archivedTodos,
                archivedtodos: archivedTodos,
                habits,
                habitRecords,
                habitrecords: habitRecords,
                projects: filterDeleted(state.projects, 'project'),
                milktea: {
                    ...state.milktea,
                    records: ensureSyncArray(state.milktea?.records)
                        .filter(record => !isDrinkRecordDeleted('milktea', record.id, normalizedDeletedIds))
                        .map(record => normalizeDrinkRecord(record, 'milktea'))
                },
                coffee: {
                    ...state.coffee,
                    records: ensureSyncArray(state.coffee?.records)
                        .filter(record => !isDrinkRecordDeleted('coffee', record.id, normalizedDeletedIds))
                        .map(record => normalizeDrinkRecord(record, 'coffee'))
                },
                dailyPlans: filterDeleted(state.dailyPlans, 'daily-plan'),
                ideas: filterDeleted(state.ideas, 'idea'),
                ideaTags: ensureSyncArray(state.ideaTags),
                // Keep unmatched generation-one numeric tombstones as strings.
                // The v4 server normalizer preserves them monotonically.
                deletedids: normalizedDeletedIds.map(id => String(id))
            };
        }

async function syncToCloud(mergedDeletedIds = null) {
            const session = captureSyncSession();
            if (!session) {
                console.log('[同步] 未登录，跳过上传');
                return false;
            }
            const deletedIds = mergedDeletedIds == null
                ? null
                : JSON.parse(JSON.stringify(ensureSyncArray(mergedDeletedIds)));
            const result = await enqueueSyncOperation(() => syncToCloudInternal(session, deletedIds));
            // A logout/account switch invalidates the request's session. Do
            // not report that cancelled write as a successful cloud save to
            // the caller (especially the logout guard).
            return isSyncSessionCurrent(session) ? result : false;
        }

async function syncToCloudInternal(session, mergedDeletedIds = null) {
            if (!isSyncSessionCurrent(session)) return false;
            try {
                console.log('[同步] 开始上传数据到云端...');
                console.log('[同步] 当前用户ID:', session.userId);
                console.log('[同步] 待办数量:', state.todos.length);
                console.log('[同步] 记账数量:', state.transactions.length);
                console.log('[同步] 分组数量:', state.groups.length);

                for (let attempt = 0; attempt < 4; attempt++) {
                    const stateBeforeLookup = stateSyncFingerprint();
                    const lookupRes = await sessionApiRequest(
                        session,
                        `${SUPABASE_URL}/rest/v1/user_data?id=eq.${encodeURIComponent(session.userId)}&select=*`
                    );
                    if (!lookupRes) return false;
                    if (!lookupRes.ok) {
                        if (attempt < 3 && isRetryableSyncStatus(lookupRes.status)) {
                            await waitForSyncRetry(attempt);
                            continue;
                        }
                        return false;
                    }
                    const serverNow = responseServerNow(lookupRes);
                    const lookupRows = await lookupRes.json();
                    if (!isSyncSessionCurrent(session)) return false;
                    // A UI mutation that happened during the GET must not be
                    // merged against a stale capture. Re-read and merge the
                    // newest visible state on the next serialized attempt.
                    if (stateSyncFingerprint() !== stateBeforeLookup) {
                        if (attempt < 3) {
                            await waitForSyncRetry(attempt);
                            continue;
                        }
                        return false;
                    }
                    sanitizeStateSyncTimestamps(serverNow);
                    const cloudRow = lookupRows && lookupRows[0] ? lookupRows[0] : null;
                    if (cloudRow) mergeCloudRowIntoState(cloudRow, loadSyncBaseSnapshot(session.userId), serverNow);

                    const deletedIds = mergeDeletedIdsThreeWay(
                        [...ensureSyncArray(mergedDeletedIds), ...ensureSyncArray(state.deletedIds)],
                        ensureSyncArray(cloudRow?.deletedids),
                        undefined,
                        cloudRow || {}
                    );
                    const payload = buildCloudPayloadForSync(deletedIds, session.userId);
                    const writtenStateFingerprint = stateSyncFingerprint();

                    if (!cloudRow) {
                        const createRes = await sessionApiRequest(session, `${SUPABASE_URL}/rest/v1/user_data`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Prefer': 'return=representation'
                            },
                            body: JSON.stringify(payload)
                        });
                        if (!createRes) return false;
                        if (createRes.ok) {
                            const createdRows = await createRes.json().catch(() => []);
                            if (!isSyncSessionCurrent(session)) return false;
                            const acceptedRow = createdRows?.[0] || payload;
                            saveSyncBaseSnapshot(acceptedRow, session.userId);
                            const changedDuringWrite = stateSyncFingerprint() !== writtenStateFingerprint;
                            mergeCloudRowIntoState(acceptedRow, payload, responseServerNow(createRes));
                            baseSave();
                            if (changedDuringWrite && attempt < 3) {
                                await waitForSyncRetry(attempt);
                                continue;
                            }
                            console.log('[sync] first sync created user_data row');
                            return true;
                        }
                        if (attempt < 3 && isRetryableSyncStatus(createRes.status)) {
                            await waitForSyncRetry(attempt);
                            continue;
                        }
                        return false;
                    }

                    if (!cloudPayloadHasChanges(payload, cloudRow)) {
                        console.log('[同步] 内容未变化，跳过回声上传');
                        saveSyncBaseSnapshot(cloudRow, session.userId);
                        return true;
                    }

                    const versionFilter = cloudRow.updated_at
                        ? `&updated_at=eq.${encodeURIComponent(cloudRow.updated_at)}`
                        : '';
                    const res = await sessionApiRequest(
                        session,
                        `${SUPABASE_URL}/rest/v1/user_data?id=eq.${encodeURIComponent(session.userId)}${versionFilter}&select=${SYNC_RETURN_COLUMNS}`,
                        {
                            method: 'PATCH',
                            headers: {
                                'Content-Type': 'application/json',
                                'Prefer': 'return=representation'
                            },
                            body: JSON.stringify(payload)
                        }
                    );
                    if (!res) return false;
                    console.log('[同步] 上传响应状态:', res.status);
                    if (!res.ok) {
                        const errorText = await res.text().catch(() => '');
                        console.error('[同步] 上传失败响应:', errorText);
                        if (attempt < 3 && isRetryableSyncStatus(res.status)) {
                            await waitForSyncRetry(attempt);
                            continue;
                        }
                        return false;
                    }

                    const responseData = await res.json().catch(() => []);
                    if (!isSyncSessionCurrent(session)) return false;
                    if (!responseData || responseData.length === 0) {
                        console.warn('[同步] 检测到并发写入，重新读取合并');
                        if (attempt < 3) {
                            await waitForSyncRetry(attempt);
                            continue;
                        }
                        return false;
                    }
                    const acceptedRow = responseData[0];
                    saveSyncBaseSnapshot(acceptedRow, session.userId);
                    const changedDuringWrite = stateSyncFingerprint() !== writtenStateFingerprint;
                    mergeCloudRowIntoState(acceptedRow, payload, responseServerNow(res));
                    baseSave();
                    renderAll();
                    if (changedDuringWrite && attempt < 3) {
                        await waitForSyncRetry(attempt);
                        continue;
                    }
                    console.log('[同步] 上传成功');
                    return true;
                }
                return false;
            } catch (e) {
                console.error('[同步] 上传异常:', e);
                return false;
            }
        }

// 云端同步 - 下载（智能合并，用于手动刷新）
async function syncFromCloud(options = {}) {
            const session = captureSyncSession();
            if (!session) {
                if (!options.loginSync && !options.silent) showSyncToast('未登录，无法刷新', 'error');
                return false;
            }
            return enqueueSyncOperation(() => syncFromCloudInternal(session, options));
        }

async function syncFromCloudInternal(session, options = {}) {
            if (!isSyncSessionCurrent(session)) return false;
            const shouldAnnounce = !options.loginSync && !options.silent;
            try {
                console.log('[刷新] 从云端下载数据...');
                let res = null;
                for (let attempt = 0; attempt < 4; attempt++) {
                    res = await sessionApiRequest(
                        session,
                        `${SUPABASE_URL}/rest/v1/user_data?id=eq.${encodeURIComponent(session.userId)}&select=*`
                    );
                    if (!res) return false;
                    if (res.ok) break;
                    if (attempt < 3 && isRetryableSyncStatus(res.status)) {
                        await waitForSyncRetry(attempt);
                        continue;
                    }
                    console.error('[刷新] 下载失败:', res.status);
                    if (shouldAnnounce) showSyncToast(getSyncErrorToastMessage('刷新失败'), 'error');
                    return false;
                }

                const data = await res.json();
                if (!isSyncSessionCurrent(session)) return false;
                const serverNow = responseServerNow(res);
                if (data && data[0]) {
                    const cloudRow = data[0];
                    const allDeletedIds = mergeCloudRowIntoState(
                        cloudRow,
                        loadSyncBaseSnapshot(session.userId),
                        serverNow
                    );
                    saveSyncBaseSnapshot(cloudRow, session.userId);
                    baseSave();
                    renderAll();
                    console.log('[刷新] 上传合并后的数据到云端...');
                    const uploaded = await syncToCloudInternal(session, allDeletedIds);

                    if (shouldAnnounce) {
                        showSyncToast(uploaded ? '刷新成功' : '已合并云端数据，但本地修改尚未上传', uploaded ? 'success' : 'error');
                    }
                    console.log('[刷新] 数据已更新');
                    return uploaded;
                } else {
                    const uploaded = await syncToCloudInternal(session);
                    if (shouldAnnounce) {
                        showSyncToast(uploaded ? '云端为空，已上传本地数据' : '云端无数据且上传失败', uploaded ? 'success' : 'error');
                    }
                    return uploaded;
                }
            } catch (e) {
                console.error('[刷新] 下载异常:', e);
                if (shouldAnnounce) showSyncToast(getSyncErrorToastMessage('刷新失败'), 'error');
                return false;
            }
        }

// 保存时自动同步：本地立即落盘，云端短暂防抖。

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
                const subscriptionSession = captureSyncSession();
                if (!subscriptionSession) return;

                console.log('[Realtime] 正在订阅数据变化...');

                // Realtime WebSocket 需要与当前 REST 会话使用同一 access token。
                if (supabaseClient.realtime?.setAuth) {
                    supabaseClient.realtime.setAuth(accessToken);
                }

                // 订阅 user_data 表的变化
                realtimeChannel = supabaseClient
                    .channel('public:user_data')
                    .on(
                        'postgres_changes',
                        {
                            event: '*', // 监听所有事件
                            schema: 'public',
                            table: 'user_data',
                            filter: `id=eq.${subscriptionSession.userId}`
                        },
                        (payload) => {
                            console.log('[Realtime] 收到数据变化:', payload);
                            if (!payload.new || !['UPDATE', 'INSERT'].includes(payload.eventType)) return;
                            void enqueueSyncOperation(async () => {
                                if (!isSyncSessionCurrent(subscriptionSession)) return;
                                const base = loadSyncBaseSnapshot(subscriptionSession.userId);
                                const localPayload = buildCloudPayloadForSync(state.deletedIds, subscriptionSession.userId);
                                const localWasDirty = !base || cloudPayloadHasChanges(localPayload, base);
                                console.log('[Realtime] 检测到云端数据变化，记录级合并...');
                                mergeCloudRowIntoState(payload.new, base);
                                baseSave();
                                // If the local state was exactly at its base,
                                // the incoming row becomes the new common
                                // ancestor. Keeping the old base here would
                                // later make an ordinary user edit look like a
                                // concurrent conflict and could discard it.
                                if (!localWasDirty) {
                                    saveSyncBaseSnapshot(payload.new, subscriptionSession.userId);
                                } else {
                                    // The incoming row was merged with an
                                    // offline/local edit. Push that merged
                                    // state promptly instead of waiting for
                                    // the next foreground poll.
                                    void syncToCloud();
                                }
                                renderAll();
                                showSyncToast('数据已同步');
                            });
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
                                    if (isSyncSessionCurrent(subscriptionSession)) subscribeToRealtime();
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

            // 只给实际新增或修改的记录更新时间。旧实现会在任意保存时刷新
            // 所有记录，导致陈旧本地快照覆盖其他应用刚写入的内容。
            const now = new Date().toISOString();
            const comparable = item => {
                if (!item || typeof item !== 'object') return item;
                const copy = { ...item };
                delete copy.updatedAt;
                return copy;
            };
            const stampChangedRecords = (records, storageKey) => {
                let previous = [];
                try {
                    previous = JSON.parse(localStorage.getItem(storageKey) || '[]');
                } catch (_) {}
                const previousById = new Map(ensureSyncArray(previous).map(item => [String(item.id), item]));
                ensureSyncArray(records).forEach(item => {
                    const old = previousById.get(String(item.id));
                    if (!old || JSON.stringify(comparable(old)) !== JSON.stringify(comparable(item))) {
                        item.updatedAt = now;
                    }
                });
            };
            stampChangedRecords(state.todos, 'todos');
            stampChangedRecords(state.groups, 'groups');
            stampChangedRecords(state.transactions, 'transactions');
            stampChangedRecords(state.projects, 'projects');
            stampChangedRecords(state.templates, 'templates');
            stampChangedRecords(state.archivedTodos, 'archivedTodos');
            stampChangedRecords(state.habits, 'habits');
            stampChangedRecords(state.dailyPlans, 'dailyPlans');
            stampChangedRecords(state.ideas, 'ideas');

            // 立即保存到本地
            baseSave();

            // 通知重构版的其他页面组件刷新。
            publish('data-changed', state);

            // 云同步（保留重构版防抖，避免高频编辑造成写入竞争）。
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

                if (savedUserId && savedToken) {
                    const restoredSessionChanged = currentUser?.id !== savedUserId
                        || accessToken !== savedToken
                        || refreshToken !== savedRefreshToken;
                    if (restoredSessionChanged) authSessionGeneration += 1;
                    if (currentUser?.id !== savedUserId) currentUser = { id: savedUserId };
                    accessToken = savedToken;
                    refreshToken = savedRefreshToken;
                    const ownerUserId = localStorage.getItem('data_owner_user_id');
                    const hasAnonymousData = !ownerUserId && hasAccountScopedLocalData();
                    if (ownerUserId && ownerUserId !== savedUserId) {
                        isolateLocalDataForUser(savedUserId);
                    }
                    if (!hasAnonymousData) localStorage.setItem('data_owner_user_id', savedUserId);

                    // 先主动刷新token（确保token有效），再启动定时刷新
                    if (refreshToken) {
                        const preRefreshed = await refreshAccessToken().catch(() => false);
                        if (!preRefreshed) {
                            console.warn('[检查登录状态] 预刷新token失败，使用旧token尝试');
                        }
                        scheduleTokenRefresh();
                    }

                    if (hasAnonymousData) {
                        const keepLocal = window.confirm(
                            '检测到尚未归属账号的本地数据。\n\n'
                            + '点击“确定”合并到当前账号；点击“取消”仅使用云端数据（本地数据会先备份）。'
                        );
                        const resolved = await resolveAnonymousData(keepLocal);
                        if (!resolved) {
                            await signOut({ allowUnsynced: true });
                            localStorage.removeItem('data_owner_user_id');
                            return;
                        }
                    } else {
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
                    }
                    // 启动 Realtime 实时同步
                    subscribeToRealtime();
                    updateCloudStatus();
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

function syncWhenActive() {
    if (
        document.visibilityState !== 'visible'
        || !navigator.onLine
        || !currentUser
        || !accessToken
    ) return;
    void syncFromCloud({ silent: true });
}

window.addEventListener('online', syncWhenActive);
window.addEventListener('focus', syncWhenActive);
setInterval(syncWhenActive, 60_000);

// 页面可见性变化时刷新token
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && refreshToken && currentUser) {
        console.log('[Token刷新] 页面重新激活，检查token...');
        refreshAccessToken().then(ok => {
            if (ok) console.log('[Token刷新] 页面恢复后自动续期成功');
            syncWhenActive();
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
                    saveAccount(oldEmail);
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
            document.getElementById('rememberPasswordSection').style.display = 'none';
            // 显示/隐藏账号列表按钮（仅登录模式显示）
            const accountListBtn = document.getElementById('accountListBtn');
            if (isLoginMode) {
                updateAccountListButton();
                // 切换回登录模式时，自动填充最后使用的账号
                const accounts = getSavedAccounts();
                if (accounts.length > 0) {
                    const lastAccount = accounts[0];
                    document.getElementById('authEmail').value = lastAccount.email;
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

                if (result.hasAnonymousData) {
                    const keepLocal = window.confirm(
                        '检测到尚未归属任何账号的本地数据。\n\n'
                        + '点击“确定”：将本地数据与该账号云端数据合并。\n'
                        + '点击“取消”：放弃当前本地数据，仅使用该账号云端数据（会先创建本地恢复备份）。'
                    );
                    const resolved = await resolveAnonymousData(keepLocal);
                    if (!resolved) {
                        result = { error: '匿名数据处理失败；原本地数据已保留，请检查网络后重试' };
                    } else {
                        subscribeToRealtime();
                        result = { success: true };
                    }
                }

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
                        saveAccount(email);
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
                const parsed = accounts ? JSON.parse(accounts) : [];
                const sanitized = Array.isArray(parsed)
                    ? parsed.map(account => ({ ...account, password: null }))
                    : [];
                if (JSON.stringify(parsed) !== JSON.stringify(sanitized)) {
                    localStorage.setItem('saved_accounts', JSON.stringify(sanitized));
                }
                return sanitized;
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
function saveAccount(email) {
            const accounts = getSavedAccounts();
            const existingIndex = accounts.findIndex(acc => acc.email === email);

            const accountData = {
                email: email,
                password: null,
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
                document.getElementById('authPassword').value = '';
                document.getElementById('rememberPassword').checked = false;
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
                            <i class="fas fa-key-slash"></i> 密码不会保存在本机
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
            document.getElementById('rememberPasswordSection').style.display = 'none';

            // 清空输入
            document.getElementById('authEmail').value = '';
            document.getElementById('authPassword').value = '';
            document.getElementById('rememberPassword').checked = false;

            // 自动填充最后使用的账号（仅在登录模式）
            if (isLoginMode && accounts.length > 0) {
                const lastAccount = accounts[0]; // 最近使用的账号
                document.getElementById('authEmail').value = lastAccount.email;
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
        const _ipcSettings = window.desktopAPI.ipc;
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

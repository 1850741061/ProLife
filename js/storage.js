// 本地存储与数据持久化

const ACTIVE_SYNC_MARKUP_PATTERN = /<\s*\/?\s*[a-z!][^>]*>|<\s*\/?\s*(?:script|iframe|object|embed|svg|math|img|video|audio|source|track|body|style|link|meta|base|form|input|button|textarea|select|option|details|marquee)(?:[\s/>]|$)/i;
const SAFE_SYNC_COLOR_PATTERN = /^(?:#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla)\([0-9.,%\s+-]+\)|var\(--[a-z0-9_-]+\)|[a-z]+)$/i;
const SAFE_SYNC_ICON_PATTERN = /^[a-z0-9 _-]+$/i;
const SAFE_SYNC_ID_PATTERN = /^[a-z0-9_.:-]+$/i;
const SYNC_STATE_FIELDS_TO_SANITIZE = [
    'todos', 'groups', 'transactions', 'templates', 'archivedTodos',
    'habits', 'habitRecords', 'projects', 'milktea', 'coffee',
    'dailyPlans', 'ideas', 'ideaTags', 'focusSessions'
];

function syncContentHash(value) {
    const input = stableSyncJson(value);
    let hash = 0x811c9dc5;
    for (let index = 0; index < input.length; index++) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
}

function encodeUnsafeSyncId(value, fallbackSeed = value) {
    const raw = String(value ?? '').trim();
    if (!raw) return `invalid_${syncContentHash(fallbackSeed)}`;
    if (SAFE_SYNC_ID_PATTERN.test(raw)) return raw;
    return [...raw].map(character => SAFE_SYNC_ID_PATTERN.test(character)
        ? character
        : `_u${character.codePointAt(0).toString(16)}_`
    ).join('');
}

function sanitizeSyncTombstone(value) {
    const raw = String(value ?? '').trim();
    const habitEvent = raw.match(/^(habit-record-(?:delete|live):)(.*):(\d{4}-\d{2}-\d{2}):(\d+)$/);
    if (habitEvent) {
        return `${habitEvent[1]}${encodeUnsafeSyncId(habitEvent[2], raw)}:${habitEvent[3]}:${habitEvent[4]}`;
    }
    const entity = raw.match(/^(todo|group|template|habit|project|daily-plan|idea|focus-session|finance:tx|finance:drink-tx|drink-record:milktea|drink-record:coffee):(.*)$/);
    if (entity) return `${entity[1]}:${encodeUnsafeSyncId(entity[2], raw)}`;
    return encodeUnsafeSyncId(raw, raw);
}

function neutralizeActiveSyncMarkup(value, keyName = '', fallbackSeed = value) {
    if (typeof value === 'string') {
        let normalized = value;
        if (ACTIVE_SYNC_MARKUP_PATTERN.test(normalized)) {
            normalized = normalized.replace(/</g, '＜').replace(/>/g, '＞');
            normalized = normalized.replace(/((?:javascript|vbscript)\s*):/gi, '$1：');
            normalized = normalized.replace(/(data\s*):\s*(text\/html)/gi, '$1：$2');
        }
        if (/^deletedIds?$/i.test(keyName)) return sanitizeSyncTombstone(normalized);
        if (/^(?:id|.*Id|.*ID)$/.test(keyName)) return encodeUnsafeSyncId(normalized, fallbackSeed);
        if (/color$/i.test(keyName) && !SAFE_SYNC_COLOR_PATTERN.test(normalized.trim())) return '#6b7280';
        if (/icon$/i.test(keyName) && !SAFE_SYNC_ICON_PATTERN.test(normalized.trim())) return 'circle';
        return normalized;
    }
    if (Array.isArray(value)) {
        return value.map(item => neutralizeActiveSyncMarkup(item, keyName, fallbackSeed));
    }
    if (value && typeof value === 'object') {
        Object.entries(value).forEach(([childKey, child]) => {
            value[childKey] = neutralizeActiveSyncMarkup(child, childKey, value);
        });
    }
    return value;
}

function neutralizeSyncStateInPlace() {
    SYNC_STATE_FIELDS_TO_SANITIZE.forEach(key => {
        if (state[key] !== undefined) state[key] = neutralizeActiveSyncMarkup(state[key], key);
    });
}

// Local/imported data is sanitized before the first render. React and Compose
// escape text by default, but this legacy renderer builds HTML templates.
neutralizeSyncStateInPlace();


function exportWidgetData() {
            if (typeof window === 'undefined' || !window.desktopAPI?.isElectron) return;
            try {
                const deletedIds = compactSyncTombstones(state.deletedIds);
                const syncBase = {
                    todos: state.todos,
                    archivedTodos: state.archivedTodos,
                    projects: state.projects,
                    dailyPlans: state.dailyPlans,
                    groups: state.groups,
                    ideas: state.ideas,
                    ideaTags: state.ideaTags,
                    deletedIds
                };
                const serialized = JSON.stringify({
                    ...syncBase,
                    syncBase,
                    themePrefs: getThemePrefs(),
                    updatedAt: new Date().toISOString()
                });
                const result = window.desktopAPI.writeWidgetData(serialized);
                if (!result?.ok) throw new Error(result?.error || 'widget data write failed');
                window.desktopAPI.ipc.send('main-data-changed');
            } catch (e) {
                console.warn('[Widget Export]', e);
            }
        }
window.exportWidgetData = exportWidgetData;

function baseSave() {
            try {
                neutralizeSyncStateInPlace();
                state.milktea.records = ensureSyncArray(state.milktea?.records)
                    .map(record => normalizeDrinkRecord(record, 'milktea'));
                state.coffee.records = ensureSyncArray(state.coffee?.records)
                    .map(record => normalizeDrinkRecord(record, 'coffee'));
                syncIdeaTags();
                state.deletedIds = compactSyncTombstones(state.deletedIds);
                localStorage.setItem('todos', JSON.stringify(ensureSyncArray(state.todos)));
                localStorage.setItem('groups', JSON.stringify(ensureSyncArray(state.groups)));
                localStorage.setItem('transactions', JSON.stringify(dedupeFinanceTransactions(state.transactions)));
                localStorage.setItem('templates', JSON.stringify(ensureSyncArray(state.templates)));
                localStorage.setItem('archivedTodos', JSON.stringify(ensureSyncArray(state.archivedTodos)));
                localStorage.setItem('habits', JSON.stringify(ensureSyncArray(state.habits)));
                localStorage.setItem('habitRecords', JSON.stringify(ensureSyncObject(state.habitRecords)));
                localStorage.setItem('projects', JSON.stringify(ensureSyncArray(state.projects)));
                localStorage.setItem('milktea', JSON.stringify(ensureSyncObject(state.milktea)));
                localStorage.setItem('coffee', JSON.stringify(ensureSyncObject(state.coffee)));
                localStorage.setItem('drinkViewFilter', state.drinkViewFilter);
                localStorage.setItem('dailyPlans', JSON.stringify(ensureSyncArray(state.dailyPlans)));
                localStorage.setItem('ideas', JSON.stringify(ensureSyncArray(state.ideas)));
                localStorage.setItem('ideaTags', JSON.stringify(ensureSyncArray(state.ideaTags)));
                localStorage.setItem('deletedIds', JSON.stringify(state.deletedIds));
                if (currentUser && currentUser.id) {
                    localStorage.setItem('data_owner_user_id', currentUser.id);
                }
                exportWidgetData();
            } catch (e) {
                console.error('[save] local cache failed:', e);
                window.__lastSyncErrorMessage = e?.stack || e?.message || String(e);
            }
        }
window.baseSave = baseSave;

function normalizeFinanceTransactionId(id) {
            const raw = String(id ?? '').trim();
            if (!raw) return '';
            const prefixed = raw.match(/^tx_(\d+)$/i);
            const normalized = prefixed ? prefixed[1] : raw;
            return /^\d+$/.test(normalized) ? String(Number(normalized)) : normalized;
        }

function scoreFinanceTransaction(record) {
    if (!record || typeof record !== 'object') return 0;
    let score = 0;
    Object.values(record).forEach(value => {
        if (value !== null && value !== undefined && value !== '') score += 1;
    });
    if (record.milkteaRecordId != null) score += 5;
    if (record.catColor) score += 1;
    if (typeof record.id === 'number') score += 1;
    if (/^mt_\d+$/i.test(String(record.id ?? ''))) score += 2;
    return score;
}

function mergeFinanceTransactionRecords(primary, secondary, key) {
            const merged = { ...(secondary || {}), ...(primary || {}) };

            [primary, secondary].forEach(source => {
                if (!source || typeof source !== 'object') return;
                Object.entries(source).forEach(([key, value]) => {
                    if (merged[key] === null || merged[key] === undefined || merged[key] === '') {
                        merged[key] = value;
                    }
                });
            });

            const milkteaRecordId = merged.milkteaRecordId ?? primary?.milkteaRecordId ?? secondary?.milkteaRecordId;
            if (milkteaRecordId != null) {
                merged.milkteaRecordId = String(milkteaRecordId);
                merged.id = 'mt_' + normalizeFinanceTransactionId(milkteaRecordId);
            } else {
                const normalizedId = key.replace(/^tx:/, '');
                merged.id = /^\d+$/.test(normalizedId) ? Number(normalizedId) : normalizedId;
            }

            return merged;
        }

function sameFinanceTransactionId(left, right) {
            const normalizedLeft = financeTransactionKey(left);
            const normalizedRight = financeTransactionKey(right);
            return normalizedLeft && normalizedLeft === normalizedRight;
        }

function dedupeFinanceTransactions(records) {
            const merged = new Map();

            (records || []).forEach(record => {
                if (!record || typeof record !== 'object') return;

                const key = financeTransactionKey(record);
                if (!key) return;

                const existing = merged.get(key);
                if (!existing) {
                    merged.set(key, mergeFinanceTransactionRecords(record, null, key));
                    return;
                }

                const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime() || 0;
                const currentTime = new Date(record.updatedAt || record.createdAt || 0).getTime() || 0;

                let preferred = existing;
                let fallback = record;

                if (
                    currentTime > existingTime
                    || (currentTime === existingTime
                        && stableSyncJson(record) > stableSyncJson(existing))
                ) {
                    preferred = record;
                    fallback = existing;
                }

                merged.set(key, mergeFinanceTransactionRecords(preferred, fallback, key));
            });

            return Array.from(merged.values());
        }

function stableSyncJson(value) {
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
            return JSON.stringify(normalize(value)) ?? 'undefined';
        }

function mergeSyncValue(local, remote, base, conflictWinner = 'canonical') {
            if (stableSyncJson(local) === stableSyncJson(remote)) return local;
            const localChanged = stableSyncJson(local) !== stableSyncJson(base);
            const remoteChanged = stableSyncJson(remote) !== stableSyncJson(base);
            if (!localChanged) return remote;
            if (!remoteChanged) return local;

            const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
            if (isObject(local) && isObject(remote) && isObject(base)) {
                const merged = {};
                const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
                keys.forEach(key => {
                    const localHas = Object.prototype.hasOwnProperty.call(local, key);
                    const remoteHas = Object.prototype.hasOwnProperty.call(remote, key);
                    const baseHas = Object.prototype.hasOwnProperty.call(base, key);
                    if (!localHas) {
                        if (baseHas && remoteHas && stableSyncJson(remote[key]) === stableSyncJson(base[key])) return;
                        if (remoteHas) merged[key] = remote[key];
                        return;
                    }
                    if (!remoteHas) {
                        if (baseHas && stableSyncJson(local[key]) === stableSyncJson(base[key])) return;
                        merged[key] = local[key];
                        return;
                    }
                    merged[key] = mergeSyncValue(
                        local[key],
                        remote[key],
                        baseHas ? base[key] : undefined,
                        conflictWinner
                    );
                });
                return merged;
            }

            if (Array.isArray(local) && Array.isArray(remote) && Array.isArray(base)) {
                const isIdArray = value => value.every(item =>
                    isObject(item) && (typeof item.id === 'string' || typeof item.id === 'number')
                );
                if (isIdArray(local) && isIdArray(remote) && isIdArray(base)) {
                    const localById = new Map(local.map(item => [String(item.id), item]));
                    const remoteById = new Map(remote.map(item => [String(item.id), item]));
                    const baseById = new Map(base.map(item => [String(item.id), item]));
                    const ids = new Set([...baseById.keys(), ...localById.keys(), ...remoteById.keys()]);
                    const merged = [];
                    [...ids].sort().forEach(id => {
                        const localItem = localById.get(id);
                        const remoteItem = remoteById.get(id);
                        const baseItem = baseById.get(id);
                        if (!localItem) {
                            if (baseItem && remoteItem && stableSyncJson(remoteItem) === stableSyncJson(baseItem)) return;
                            if (remoteItem) merged.push(remoteItem);
                            return;
                        }
                        if (!remoteItem) {
                            if (baseItem && stableSyncJson(localItem) === stableSyncJson(baseItem)) return;
                            merged.push(localItem);
                            return;
                        }
                        merged.push(baseItem
                            ? mergeSyncValue(localItem, remoteItem, baseItem, conflictWinner)
                            : conflictWinner === 'local'
                                ? localItem
                                : conflictWinner === 'remote'
                                    ? remoteItem
                                    : (stableSyncJson(localItem) >= stableSyncJson(remoteItem) ? localItem : remoteItem));
                    });
                    return merged;
                }

                const isPrimitiveArray = value => value.every(item =>
                    item == null || ['string', 'number', 'boolean'].includes(typeof item)
                );
                if (isPrimitiveArray(local) && isPrimitiveArray(remote) && isPrimitiveArray(base)) {
                    const toMap = values => new Map(values.map(value => [stableSyncJson(value), value]));
                    const baseMap = toMap(base);
                    const localMap = toMap(local);
                    const remoteMap = toMap(remote);
                    const merged = new Map(baseMap);
                    baseMap.forEach((_, key) => {
                        if (!localMap.has(key) || !remoteMap.has(key)) merged.delete(key);
                    });
                    [...localMap, ...remoteMap].forEach(([key, value]) => {
                        if (!baseMap.has(key)) merged.set(key, value);
                    });
                    const compareSyncStrings = (left, right) => {
                        const a = String(left);
                        const b = String(right);
                        return a < b ? -1 : (a > b ? 1 : 0);
                    };
                    return [...merged.entries()]
                        .sort(([a], [b]) => compareSyncStrings(a, b))
                        .map(([, value]) => value);
                }
            }

            if (conflictWinner === 'local') return local;
            if (conflictWinner === 'remote') return remote;
            return stableSyncJson(local) >= stableSyncJson(remote) ? local : remote;
        }

function mergeRecordThreeWay(local, remote, base) {
            const localTime = new Date(local?.updatedAt || local?.createdAt || 0).getTime() || 0;
            const remoteTime = new Date(remote?.updatedAt || remote?.createdAt || 0).getTime() || 0;
            const merged = mergeSyncValue(
                local,
                remote,
                base,
                localTime > remoteTime
                    ? 'local'
                    : remoteTime > localTime
                        ? 'remote'
                        : 'canonical'
            );
            const latest = Math.max(localTime, remoteTime);
            if (latest > 0) merged.updatedAt = new Date(latest).toISOString();
            merged.id = local.id;
            return merged;
        }

function mergeArrays(local, remote, deletedIds = [], base = []) {
            local = ensureSyncArray(local);
            remote = ensureSyncArray(remote);
            deletedIds = ensureSyncArray(deletedIds);
            base = ensureSyncArray(base);
            const merged = new Map();
            const deletedSet = new Set(deletedIds.map(id => String(id)));
            const baseById = new Map(base.map(item => [String(item.id), item]));

            // 先添加所有本地数据（排除在 deletedIds 中的）
            local.forEach(item => {
                // 如果本地数据在 deletedIds 中，跳过（云端已删除）
                const key = String(item.id);
                if (!deletedSet.has(key)) {
                    merged.set(key, item);
                }
            });

            // 处理远程数据
            remote.forEach(remoteItem => {
                const key = String(remoteItem.id);
                // 跳过已删除的ID
                if (deletedSet.has(key)) {
                    return;
                }

                const localItem = merged.get(key);

                if (!localItem) {
                    // 本地没有这个数据，添加远程数据
                    merged.set(key, remoteItem);
                } else {
                    const baseItem = baseById.get(key);
                    if (baseItem) {
                        merged.set(key, mergeRecordThreeWay(localItem, remoteItem, baseItem));
                        return;
                    }
                    // 本地和远程都有，比较 updatedAt
                    const localTime = new Date(localItem.updatedAt || localItem.createdAt || 0);
                    const remoteTime = new Date(remoteItem.updatedAt || remoteItem.createdAt || 0);

                    // 保留最新的数据（基于时间戳）
                    if (
                        remoteTime > localTime
                        || (remoteTime.getTime() === localTime.getTime()
                            && stableSyncJson(remoteItem) > stableSyncJson(localItem))
                    ) {
                        merged.set(key, remoteItem);
                    }
                    // 否则保留本地数据
                }
            });

            // 返回合并后的数据
            return Array.from(merged.values());
        }

function financeTransactionKey(value) {
            const record = value && typeof value === 'object' ? value : null;
            const rawId = String(record?.id ?? value ?? '').trim();
            const linkedId = record?.milkteaRecordId != null
                ? String(record.milkteaRecordId)
                : rawId.match(/^mt_(.+)$/i)?.[1];
            if (linkedId != null && linkedId !== '') {
                return `drink-tx:${normalizeFinanceTransactionId(linkedId)}`;
            }
            const normalizedId = normalizeFinanceTransactionId(rawId);
            return normalizedId ? `tx:${normalizedId}` : '';
        }

function financeTransactionTombstone(value) {
            return `finance:${financeTransactionKey(value)}`;
        }

function drinkRecordTombstone(type, id) {
            return `drink-record:${type}:${String(id)}`;
        }

function entityTombstone(kind, id) {
            return `${kind}:${String(id)}`;
        }

function detectDrinkTypeForTransaction(transaction, linkedId) {
            const normalizedId = String(linkedId || '');
            if (normalizedId.startsWith('coffee_')) return 'coffee';
            if (normalizedId.startsWith('milktea_')) return 'milktea';
            if (transaction?.category === '咖啡') return 'coffee';
            if (transaction?.category === '奶茶') return 'milktea';
            if (ensureSyncArray(state.coffee?.records).some(record => String(record.id) === normalizedId)) return 'coffee';
            return 'milktea';
        }

function isEntityDeleted(kind, id, deletedIds) {
            const deleted = new Set(ensureSyncArray(deletedIds).map(String));
            return deleted.has(entityTombstone(kind, id)) || deleted.has(String(id));
        }

function isFinanceTransactionDeleted(record, deletedIds) {
            const deleted = new Set(ensureSyncArray(deletedIds).map(String));
            if (deleted.has(financeTransactionTombstone(record))) return true;
            return deleted.has(normalizeFinanceTransactionId(record.id))
                || (record.milkteaRecordId != null && deleted.has(normalizeFinanceTransactionId(record.milkteaRecordId)));
        }

function isDrinkRecordDeleted(type, id, deletedIds) {
            const deleted = new Set(ensureSyncArray(deletedIds).map(String));
            return deleted.has(drinkRecordTombstone(type, id))
                || deleted.has(entityTombstone('drink-record', id))
                || deleted.has(String(id));
        }

function financeTieBreaker(record) {
            return [
                record.type || '',
                record.date || '',
                record.category || '',
                String(Number(record.amount) || 0),
                record.note || '',
                record.catColor || '',
                record.milkteaRecordId == null ? '' : String(record.milkteaRecordId)
            ].join('\u001f');
        }

function canonicalDrinkNumber(value) {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? String(parsed) : '0';
        }

function normalizeDrinkRecord(record, type) {
            const amountValue = Number(record?.amount);
            const amount = Number.isFinite(amountValue) && amountValue > 0 ? amountValue : 1;
            const priceValue = Number(record?.price);
            const hasUnitPrice = record?.price !== null
                && record?.price !== undefined
                && Number.isFinite(priceValue)
                && priceValue >= 0;
            const costValue = Number(record?.cost);
            const legacyTotalCost = Number.isFinite(costValue) && costValue >= 0 ? costValue : 0;
            const price = hasUnitPrice ? priceValue : legacyTotalCost / amount;
            const cost = hasUnitPrice ? priceValue * amount : legacyTotalCost;
            const brand = String(record?.brand || record?.name || '').trim();
            const notes = String(record?.notes || record?.note || '').trim();
            const shop = typeof record?.shop === 'string' ? record.shop.trim() : '';
            return {
                ...record,
                amount,
                price,
                cost,
                name: brand,
                brand,
                note: notes,
                notes,
                shop,
                drinkType: type
            };
        }

function drinkTieBreaker(record, type) {
            const normalized = normalizeDrinkRecord(record, type);
            return [
                normalized.date || '',
                canonicalDrinkNumber(normalized.amount),
                canonicalDrinkNumber(normalized.cost),
                normalized.sugar || '',
                normalized.brand || '',
                normalized.notes || '',
                normalized.shop || '',
                type
            ].join('\u001f');
        }

function mergeDrinkRecords(local, remote, type, base) {
            if (base === undefined) base = loadSyncBaseSnapshot()?.[type]?.records || [];
            const merged = new Map();
            const baseById = new Map(ensureSyncArray(base).filter(record => record?.id != null).map(record => [String(record.id), record]));
            const localById = new Map(ensureSyncArray(local).filter(record => record?.id != null).map(record => [String(record.id), record]));
            [...ensureSyncArray(local), ...ensureSyncArray(remote)].forEach(rawRecord => {
                if (!rawRecord || rawRecord.id == null) return;
                const key = String(rawRecord.id);
                const localRecord = localById.get(key);
                const baseRecord = baseById.get(key);
                const source = localRecord && rawRecord !== localRecord && baseRecord
                    ? mergeRecordThreeWay(localRecord, rawRecord, baseRecord)
                    : rawRecord;
                const record = normalizeDrinkRecord(source, type);
                const normalizedKey = String(record.id);
                const existing = merged.get(normalizedKey);
                const recordTime = new Date(record.updatedAt || 0).getTime() || 0;
                const existingTime = new Date(existing?.updatedAt || 0).getTime() || 0;
                if (
                    !existing
                    || recordTime > existingTime
                    || (recordTime === existingTime
                        && stableSyncJson(record) > stableSyncJson(existing))
                ) merged.set(normalizedKey, record);
            });
            return [...merged.values()];
        }

function mergeFinanceTransactions(local, remote, deletedIds, base) {
            if (base === undefined) base = loadSyncBaseSnapshot()?.transactions || [];
            const localRecords = dedupeFinanceTransactions(ensureSyncArray(local));
            const remoteRecords = dedupeFinanceTransactions(ensureSyncArray(remote));
            const baseByKey = new Map(
                dedupeFinanceTransactions(ensureSyncArray(base)).map(record => [financeTransactionKey(record), record])
            );
            const localByKey = new Map(localRecords.map(record => [financeTransactionKey(record), record]));
            const combined = [...localRecords];
            remoteRecords.forEach(remoteRecord => {
                const key = financeTransactionKey(remoteRecord);
                const localRecord = localByKey.get(key);
                const baseRecord = baseByKey.get(key);
                combined.push(localRecord && baseRecord
                    ? mergeRecordThreeWay(localRecord, remoteRecord, baseRecord)
                    : remoteRecord);
            });
            const merged = new Map();
            dedupeFinanceTransactions(combined).forEach(record => {
                if (isFinanceTransactionDeleted(record, deletedIds)) return;
                const key = financeTransactionKey(record);
                const existing = merged.get(key);
                const existingTime = new Date(existing?.updatedAt || existing?.createdAt || 0).getTime() || 0;
                const recordTime = new Date(record.updatedAt || record.createdAt || 0).getTime() || 0;
                if (
                    !existing
                    || recordTime > existingTime
                    || (recordTime === existingTime
                        && stableSyncJson(record) > stableSyncJson(existing))
                ) merged.set(key, record);
            });
            return [...merged.values()];
        }

function mergeDrinkSettings(local = {}, cloud = {}, base, type) {
            if (base === undefined && type) base = loadSyncBaseSnapshot()?.[type]?.settings || {};
            base = base || {};
            const localTime = new Date(local.updatedAt || 0).getTime() || 0;
            const cloudTime = new Date(cloud.updatedAt || 0).getTime() || 0;
            const hasBase = base && typeof base === 'object' && Object.keys(base).length > 0;
            const merged = {};
            const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(cloud)]);
            const defaults = type === 'coffee'
                ? { weeklyLimit: 3, monthlyLimit: 12 }
                : { weeklyLimit: 2, monthlyLimit: 8 };
            keys.delete('updatedAt');
            keys.forEach(key => {
                const localHas = Object.prototype.hasOwnProperty.call(local, key);
                const cloudHas = Object.prototype.hasOwnProperty.call(cloud, key);
                const baseHas = Object.prototype.hasOwnProperty.call(base, key);
                const isDefaultField = (settings, field) => {
                    if (field === 'weeklyLimit') {
                        return Number(settings?.[field]) === defaults.weeklyLimit;
                    }
                    if (field === 'monthlyLimit') {
                        return Number(settings?.[field]) === defaults.monthlyLimit;
                    }
                    // Android tracks whether caffeine was explicitly supplied.
                    // An absent field is the default; a present field remains
                    // authoritative even when its value happens to equal 400.
                    if (field === 'dailyCaffeineLimitMg') {
                        return !Object.prototype.hasOwnProperty.call(settings || {}, field);
                    }
                    return false;
                };
                const localIsDefault = isDefaultField(local, key);
                const cloudIsDefault = isDefaultField(cloud, key);
                if (!localHas && !cloudHas) {
                    if (baseHas) merged[key] = base[key];
                    return;
                }
                if (!localHas) {
                    merged[key] = cloud[key];
                    return;
                }
                if (!cloudHas) {
                    merged[key] = local[key];
                    return;
                }
                if (stableSyncJson(local[key]) === stableSyncJson(cloud[key])) {
                    merged[key] = local[key];
                    return;
                }
                if (hasBase && baseHas) {
                    const localChanged = stableSyncJson(local[key]) !== stableSyncJson(base[key]);
                    const cloudChanged = stableSyncJson(cloud[key]) !== stableSyncJson(base[key]);
                    if (!localChanged) {
                        merged[key] = cloud[key];
                        return;
                    }
                    if (!cloudChanged) {
                        merged[key] = local[key];
                        return;
                    }
                }
                if (localTime > cloudTime) merged[key] = local[key];
                else if (cloudTime > localTime) merged[key] = cloud[key];
                else if (localIsDefault && !cloudIsDefault) merged[key] = cloud[key];
                else if (cloudIsDefault && !localIsDefault) merged[key] = local[key];
                else {
                    merged[key] = stableSyncJson(local[key]) >= stableSyncJson(cloud[key])
                        ? local[key]
                        : cloud[key];
                }
            });
            const normalizeLimit = (value, fallback) => {
                const parsed = Number(value);
                return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
            };
            merged.weeklyLimit = normalizeLimit(merged.weeklyLimit, defaults.weeklyLimit);
            merged.monthlyLimit = normalizeLimit(merged.monthlyLimit, defaults.monthlyLimit);
            const latest = Math.max(localTime, cloudTime);
            if (latest > 0) merged.updatedAt = new Date(latest).toISOString();
            return merged;
        }

function habitRecordTombstone(habitId, date) {
            return `habit-record:${String(habitId)}:${date}`;
        }

function habitRecordDeleteEvent(habitId, date, timestamp) {
            return `habit-record-delete:${String(habitId)}:${date}:${Math.trunc(timestamp)}`;
        }

function habitRecordLiveEvent(habitId, date, timestamp) {
            return `habit-record-live:${String(habitId)}:${date}:${Math.trunc(timestamp)}`;
        }

function latestHabitRecordEventTime(deletedIds, prefix) {
            let latest = 0;
            ensureSyncArray(deletedIds).forEach(raw => {
                const value = String(raw);
                if (!value.startsWith(prefix)) return;
                const timestamp = Number(value.slice(prefix.length));
                if (Number.isFinite(timestamp)) latest = Math.max(latest, timestamp);
            });
            return latest;
        }

function nextHabitRecordEventTime(records, deletedIds, habitId, date) {
            const id = String(habitId);
            return Math.max(
                Date.now(),
                Number(records?.[id]?.[date]) || 0,
                latestHabitRecordEventTime(deletedIds, `habit-record-delete:${id}:${date}:`),
                latestHabitRecordEventTime(deletedIds, `habit-record-live:${id}:${date}:`)
            ) + 1;
        }

function mergeHabitRecords(local = {}, cloud = {}, deletedIds = []) {
            const deleted = new Set(ensureSyncArray(deletedIds).map(String));
            const merged = {};
            const habitIds = new Set([...Object.keys(cloud || {}), ...Object.keys(local || {})]);
            habitIds.forEach(habitId => {
                if (isEntityDeleted('habit', habitId, deletedIds)) return;
                merged[habitId] = {};
                const dates = new Set([
                    ...Object.keys(cloud?.[habitId] || {}),
                    ...Object.keys(local?.[habitId] || {})
                ]);
                dates.forEach(date => {
                    const recordTime = Math.max(
                        Number(cloud?.[habitId]?.[date]) || 0,
                        Number(local?.[habitId]?.[date]) || 0
                    );
                    const deleteTime = latestHabitRecordEventTime(
                        deletedIds,
                        `habit-record-delete:${habitId}:${date}:`
                    );
                    const liveTime = latestHabitRecordEventTime(
                        deletedIds,
                        `habit-record-live:${habitId}:${date}:`
                    );
                    const hasLegacyDelete = deleted.has(habitRecordTombstone(habitId, date));
                    const winningLiveTime = Math.max(recordTime, liveTime);
                    if (hasLegacyDelete && liveTime === 0) return;
                    if (deleteTime > 0 && deleteTime >= winningLiveTime) return;
                    if (winningLiveTime > 0) merged[habitId][date] = winningLiveTime;
                });
            });
            return merged;
        }

function pruneOrphanHabitRecords(records = {}, habits = []) {
            // A temporarily missing habit must not erase historical check-ins
            // created by another client or an older built-in habit catalogue.
            void habits;
            return records && typeof records === 'object' && !Array.isArray(records)
                ? { ...records }
                : {};
        }

function mergeEntityArrays(local, remote, deletedIds, kind, base) {
            const baseKey = {
                'daily-plan': 'dailyPlans',
                'focus-session': 'focusSessions'
            }[kind] || `${kind}s`;
            if (base === undefined) base = loadSyncBaseSnapshot()?.[baseKey] || [];
            return mergeArrays(local || [], remote || [], [], base)
                .filter(item => !isEntityDeleted(kind, item.id, deletedIds));
        }

function reconcileTodoCollections(
            localTodos,
            localArchived,
            cloudTodos,
            cloudArchived,
            deletedIds,
            baseTodos,
            baseArchived
        ) {
            const storedBase = loadSyncBaseSnapshot() || {};
            if (baseTodos === undefined) baseTodos = ensureSyncArray(storedBase.todos);
            if (baseArchived === undefined) {
                baseArchived = [...ensureSyncArray(storedBase.archivedTodos), ...ensureSyncArray(storedBase.archivedtodos)];
            }
            const merged = new Map();
            const candidates = [
                ...ensureSyncArray(cloudArchived).map(todo => ({ todo, archived: true, local: false })),
                ...ensureSyncArray(cloudTodos).map(todo => ({ todo, archived: false, local: false })),
                ...ensureSyncArray(localArchived).map(todo => ({ todo, archived: true, local: true })),
                ...ensureSyncArray(localTodos).map(todo => ({ todo, archived: false, local: true }))
            ];
            candidates.forEach(candidate => {
                if (!candidate.todo || isEntityDeleted('todo', candidate.todo.id, deletedIds)) return;
                const key = String(candidate.todo.id);
                const current = merged.get(key);
                const candidateTime = new Date(
                    candidate.todo.updatedAt || candidate.todo.archivedAt || candidate.todo.createdAt || 0
                ).getTime() || 0;
                const currentTime = current
                    ? (new Date(current.todo.updatedAt || current.todo.archivedAt || current.todo.createdAt || 0).getTime() || 0)
                    : -1;
                if (!current
                    || candidateTime > currentTime
                    || (
                        candidateTime === currentTime
                        && (
                            (current.archived && !candidate.archived)
                            || (
                                current.archived === candidate.archived
                                && canonicalSyncJson(candidate.todo) > canonicalSyncJson(current.todo)
                            )
                        )
                    )
                ) {
                    merged.set(key, candidate);
                }
            });
            const buildSideMap = (active, archived) => {
                const result = new Map();
                const sideCandidates = [
                    ...ensureSyncArray(archived).map(todo => ({ todo, archived: true })),
                    ...ensureSyncArray(active).map(todo => ({ todo, archived: false }))
                ];
                sideCandidates.forEach(candidate => {
                    if (!candidate.todo) return;
                    const key = String(candidate.todo.id);
                    const current = result.get(key);
                    const candidateTime = new Date(
                        candidate.todo.updatedAt || candidate.todo.archivedAt || candidate.todo.createdAt || 0
                    ).getTime() || 0;
                    const currentTime = current
                        ? (new Date(current.todo.updatedAt || current.todo.archivedAt || current.todo.createdAt || 0).getTime() || 0)
                        : -1;
                    if (!current
                        || candidateTime > currentTime
                        || (candidateTime === currentTime && current.archived && !candidate.archived)
                    ) result.set(key, candidate);
                });
                return result;
            };
            const localById = buildSideMap(localTodos, localArchived);
            const remoteById = buildSideMap(cloudTodos, cloudArchived);
            const baseById = buildSideMap(baseTodos, baseArchived);
            merged.forEach((candidate, key) => {
                const local = localById.get(key);
                const remote = remoteById.get(key);
                const base = baseById.get(key);
                if (!local || !remote || !base) return;
                candidate.todo = mergeRecordThreeWay(local.todo, remote.todo, base.todo);
                const localStateChanged = local.archived !== base.archived;
                const remoteStateChanged = remote.archived !== base.archived;
                if (localStateChanged && !remoteStateChanged) candidate.archived = local.archived;
                else if (remoteStateChanged && !localStateChanged) candidate.archived = remote.archived;
                else if (localStateChanged && remoteStateChanged && local.archived === remote.archived) {
                    candidate.archived = local.archived;
                }
            });
            const todos = [];
            const archivedTodos = [];
            merged.forEach(candidate => {
                if (candidate.archived) {
                    archivedTodos.push({
                        ...candidate.todo,
                        archivedAt: candidate.todo.archivedAt
                            || candidate.todo.updatedAt
                            || candidate.todo.createdAt
                    });
                } else {
                    const active = { ...candidate.todo };
                    delete active.archivedAt;
                    todos.push(active);
                }
            });
            return { todos, archivedTodos };
        }

const SYNC_BASE_STORAGE_KEY = 'sync_base_snapshots_v2';
const MAX_PERSISTED_SYNC_BASES = 4;
const memorySyncBaseSnapshots = new Map();
let syncBaseStorageWarningShown = false;
const MAX_SYNC_CLOCK_SKEW_MS = 5 * 60 * 1000;

function responseServerNow(response) {
            const parsed = new Date(response?.headers?.get?.('date') || '').getTime();
            return Number.isFinite(parsed) ? parsed : Date.now();
        }

function sanitizeFutureSyncTimestamps(value, serverNow = Date.now()) {
            const anchor = Number.isFinite(serverNow) && serverNow > 0 ? serverNow : Date.now();
            const visit = (input, key = '') => {
                if (Array.isArray(input)) return input.map(item => visit(item));
                if (input && typeof input === 'object') {
                    return Object.fromEntries(
                        Object.entries(input).map(([nestedKey, nested]) => [nestedKey, visit(nested, nestedKey)])
                    );
                }
                if (typeof input === 'string') {
                    if ([
                        'updatedAt', 'createdAt', 'archivedAt', 'startedAt', 'endedAt',
                        'startTime', 'endTime', 'completedAt'
                    ].includes(key)) {
                        const timestamp = new Date(input).getTime();
                        if (Number.isFinite(timestamp) && timestamp > anchor + MAX_SYNC_CLOCK_SKEW_MS) {
                            return new Date(anchor).toISOString();
                        }
                    }
                    if (/^(habit-record-(?:delete|live):|sync-(?:delete|live):)/.test(input)) {
                        const match = input.match(/^(.*:)(\d+)$/);
                        if (match && Number(match[2]) > anchor + MAX_SYNC_CLOCK_SKEW_MS) {
                            return `${match[1]}${Math.trunc(anchor)}`;
                        }
                    }
                }
                if (
                    typeof input === 'number'
                    && /^\d{4}-\d{2}-\d{2}$/.test(key)
                    && Number.isFinite(input)
                    && input > anchor + MAX_SYNC_CLOCK_SKEW_MS
                ) {
                    return Math.trunc(anchor);
                }
                return input;
            };
            return visit(value);
        }

function sanitizeStateSyncTimestamps(serverNow = Date.now()) {
            const safeLocal = sanitizeFutureSyncTimestamps({
                todos: state.todos,
                archivedTodos: state.archivedTodos,
                transactions: state.transactions,
                groups: state.groups,
                templates: state.templates,
                habits: state.habits,
                habitRecords: state.habitRecords,
                projects: state.projects,
                milktea: state.milktea,
                coffee: state.coffee,
                dailyPlans: state.dailyPlans,
                ideas: state.ideas,
                deletedIds: state.deletedIds
            }, serverNow);
            Object.assign(state, safeLocal);
        }

function loadSyncBaseSnapshot(userId = currentUser?.id || localStorage.getItem('user_id')) {
            if (!userId) return null;
            if (memorySyncBaseSnapshots.has(userId)) {
                return JSON.parse(JSON.stringify(memorySyncBaseSnapshots.get(userId)));
            }
            try {
                const raw = localStorage.getItem(SYNC_BASE_STORAGE_KEY);
                if (!raw) return null;
                const snapshots = JSON.parse(raw);
                const snapshot = snapshots?.[userId];
                if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
                const cloned = JSON.parse(JSON.stringify(snapshot));
                memorySyncBaseSnapshots.set(userId, cloned);
                return JSON.parse(JSON.stringify(cloned));
            } catch (_) {
                return null;
            }
        }

function saveSyncBaseSnapshot(snapshot, userId = currentUser?.id || localStorage.getItem('user_id')) {
            if (!userId || !snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return;
            const storedSnapshot = JSON.parse(JSON.stringify({ ...snapshot, _syncBaseSavedAt: Date.now() }));
            memorySyncBaseSnapshots.set(userId, storedSnapshot);
            try {
                const raw = localStorage.getItem(SYNC_BASE_STORAGE_KEY);
                const snapshots = raw ? JSON.parse(raw) : {};
                snapshots[userId] = storedSnapshot;
                const savedAt = value => {
                    const explicit = Number(value?._syncBaseSavedAt);
                    if (Number.isFinite(explicit)) return explicit;
                    const updated = new Date(value?.updated_at || 0).getTime();
                    return Number.isFinite(updated) ? updated : 0;
                };
                const kept = Object.entries(snapshots)
                    .filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value))
                    .sort(([leftId, left], [rightId, right]) => {
                        if (leftId === userId) return -1;
                        if (rightId === userId) return 1;
                        return savedAt(right) - savedAt(left);
                    })
                    .slice(0, MAX_PERSISTED_SYNC_BASES);
                localStorage.setItem(SYNC_BASE_STORAGE_KEY, JSON.stringify(Object.fromEntries(kept)));
            } catch (error) {
                console.warn('[sync-base] 无法保存三方合并基线，当前会话使用内存基线:', error);
                if (!syncBaseStorageWarningShown) {
                    syncBaseStorageWarningShown = true;
                    showSyncToast?.('同步基线无法写入本地存储；重启前请保持网络连接', 'error');
                }
            }
        }

function buildLegacyTombstoneSources(cloud = {}) {
            const cloudMilktea = cloud?.milktea || {};
            const cloudCoffee = cloud?.coffee || {};
            return {
                todos: [
                    ...ensureSyncArray(state.todos),
                    ...ensureSyncArray(state.archivedTodos),
                    ...ensureSyncArray(cloud.todos),
                    ...ensureSyncArray(cloud.archivedTodos),
                    ...ensureSyncArray(cloud.archivedtodos)
                ],
                transactions: [
                    ...ensureSyncArray(state.transactions),
                    ...ensureSyncArray(cloud.transactions)
                ],
                groups: [...ensureSyncArray(state.groups), ...ensureSyncArray(cloud.groups)],
                templates: [...ensureSyncArray(state.templates), ...ensureSyncArray(cloud.templates)],
                habits: [...ensureSyncArray(state.habits), ...ensureSyncArray(cloud.habits)],
                projects: [...ensureSyncArray(state.projects), ...ensureSyncArray(cloud.projects)],
                dailyPlans: [
                    ...ensureSyncArray(state.dailyPlans),
                    ...ensureSyncArray(cloud.dailyPlans),
                    ...ensureSyncArray(cloud.dailyplans)
                ],
                ideas: [...ensureSyncArray(state.ideas), ...ensureSyncArray(cloud.ideas)],
                focusSessions: [
                    ...ensureSyncArray(state.focusSessions),
                    ...ensureSyncArray(cloud.focusSessions),
                    ...ensureSyncArray(cloud.focussessions)
                ],
                milkteaRecords: [
                    ...ensureSyncArray(state.milktea?.records),
                    ...ensureSyncArray(cloudMilktea.records)
                ],
                coffeeRecords: [
                    ...ensureSyncArray(state.coffee?.records),
                    ...ensureSyncArray(cloudCoffee.records)
                ]
            };
        }

function migrateLegacyTombstones(deletedIds, sources) {
            const result = new Map();
            const entitySources = [
                ['todo', sources.todos],
                ['group', sources.groups],
                ['template', sources.templates],
                ['habit', sources.habits],
                ['project', sources.projects],
                ['daily-plan', sources.dailyPlans],
                ['idea', sources.ideas],
                ['focus-session', sources.focusSessions]
            ];
            const add = value => result.set(String(value), value);

            for (const raw of ensureSyncArray(deletedIds)) {
                const legacyId = String(raw);
                if (!/^\d+$/.test(legacyId)) {
                    add(raw);
                    continue;
                }
                let matched = false;
                entitySources.forEach(([kind, records]) => {
                    if (ensureSyncArray(records).some(record => String(record?.id) === legacyId)) {
                        add(entityTombstone(kind, legacyId));
                        matched = true;
                    }
                });
                ensureSyncArray(sources.transactions).forEach(record => {
                    if (
                        normalizeFinanceTransactionId(record?.id) === normalizeFinanceTransactionId(legacyId)
                        || (record?.milkteaRecordId != null
                            && normalizeFinanceTransactionId(record.milkteaRecordId) === normalizeFinanceTransactionId(legacyId))
                    ) {
                        add(financeTransactionTombstone(record));
                        matched = true;
                    }
                });
                if (ensureSyncArray(sources.milkteaRecords).some(record => String(record?.id) === legacyId)) {
                    add(drinkRecordTombstone('milktea', legacyId));
                    matched = true;
                }
                if (ensureSyncArray(sources.coffeeRecords).some(record => String(record?.id) === legacyId)) {
                    add(drinkRecordTombstone('coffee', legacyId));
                    matched = true;
                }
                // A generation-one numeric tombstone may refer to a record
                // that is no longer present on this device or in the cloud.
                // Preserve it as a string so v4's monotonic server normalizer
                // can round-trip it instead of silently dropping it.
                if (!matched) add(legacyId);
            }
            return [...result.values()];
        }

function compactSyncTombstones(deletedIds = []) {
            const ordinary = new Map();
            const habitEvents = new Map();
            for (const rawValue of ensureSyncArray(deletedIds)) {
                const raw = String(rawValue);
                const event = raw.match(/^habit-record-(delete|live):(.+):(\d{4}-\d{2}-\d{2}):(\d+)$/);
                if (!event) {
                    ordinary.set(raw, rawValue);
                    continue;
                }
                const timestamp = Number(event[4]);
                if (!Number.isFinite(timestamp)) {
                    ordinary.set(raw, rawValue);
                    continue;
                }
                const key = `${event[2]}\u001f${event[3]}`;
                const candidate = { raw, timestamp, isDelete: event[1] === 'delete' };
                const current = habitEvents.get(key);
                if (!current
                    || candidate.timestamp > current.timestamp
                    || (candidate.timestamp === current.timestamp && candidate.isDelete && !current.isDelete)
                ) habitEvents.set(key, candidate);
            }
            habitEvents.forEach(event => ordinary.set(event.raw, event.raw));
            return [...ordinary.entries()]
                .sort(([left], [right]) => {
                    const a = String(left);
                    const b = String(right);
                    return a < b ? -1 : (a > b ? 1 : 0);
                })
                .map(([, value]) => value);
        }

function mergeDeletedIdsThreeWay(local, cloud, base, cloudRow = {}) {
            const localIds = ensureSyncArray(local);
            const cloudIds = ensureSyncArray(cloud);
            if (base === undefined) base = loadSyncBaseSnapshot()?.deletedids;
            // Accepted entity deletions are monotonic. Versioned habit
            // live/delete events are still resolved by the compactor below.
            const merged = [
                ...ensureSyncArray(base),
                ...localIds,
                ...cloudIds
            ];
            const unique = [...new Map(ensureSyncArray(merged).map(id => [String(id), id])).values()];
            return compactSyncTombstones(
                migrateLegacyTombstones(unique, buildLegacyTombstoneSources(cloudRow))
            );
        }

function mergeCloudRowIntoState(cloud, base = loadSyncBaseSnapshot(), serverNow = Date.now()) {
            if (!cloud) return [];
            base = base || {};
            sanitizeStateSyncTimestamps(serverNow);
            const cloudDeletedIds = ensureSyncArray(cloud.deletedids);
            const localDeletedIds = ensureSyncArray(state.deletedIds);
            const allDeletedIds = mergeDeletedIdsThreeWay(
                localDeletedIds,
                cloudDeletedIds,
                base.deletedids,
                cloud
            );
            const todoCollections = reconcileTodoCollections(
                state.todos,
                state.archivedTodos,
                cloud.todos,
                [...ensureSyncArray(cloud.archivedTodos), ...ensureSyncArray(cloud.archivedtodos)],
                allDeletedIds,
                ensureSyncArray(base.todos),
                [...ensureSyncArray(base.archivedTodos), ...ensureSyncArray(base.archivedtodos)]
            );
            state.todos = todoCollections.todos;
            state.archivedTodos = todoCollections.archivedTodos;
            state.transactions = mergeFinanceTransactions(
                state.transactions,
                cloud.transactions || [],
                allDeletedIds,
                base.transactions || []
            );
            state.groups = mergeEntityArrays(state.groups, cloud.groups || [], allDeletedIds, 'group', base.groups || []);
            state.templates = mergeEntityArrays(state.templates, cloud.templates || [], allDeletedIds, 'template', base.templates || []);
            state.habits = mergeEntityArrays(state.habits, cloud.habits || [], allDeletedIds, 'habit', base.habits || []);
            state.habitRecords = pruneOrphanHabitRecords(
                mergeHabitRecords(
                    state.habitRecords,
                    mergeHabitRecords(cloud.habitRecords || {}, cloud.habitrecords || {}, allDeletedIds),
                    allDeletedIds
                ),
                state.habits
            );
            state.projects = mergeEntityArrays(state.projects, cloud.projects || [], allDeletedIds, 'project', base.projects || []);
            state.milktea = {
                records: mergeDrinkRecords(
                    state.milktea?.records || [],
                    cloud.milktea?.records || [],
                    'milktea',
                    base.milktea?.records || []
                )
                    .filter(record => !isDrinkRecordDeleted('milktea', record.id, allDeletedIds)),
                settings: mergeDrinkSettings(state.milktea?.settings, cloud.milktea?.settings, base.milktea?.settings, 'milktea')
            };
            state.coffee = {
                records: mergeDrinkRecords(
                    state.coffee?.records || [],
                    cloud.coffee?.records || [],
                    'coffee',
                    base.coffee?.records || []
                )
                    .filter(record => !isDrinkRecordDeleted('coffee', record.id, allDeletedIds)),
                settings: mergeDrinkSettings(state.coffee?.settings, cloud.coffee?.settings, base.coffee?.settings, 'coffee')
            };
            state.dailyPlans = mergeEntityArrays(
                state.dailyPlans,
                [...ensureSyncArray(cloud.dailyPlans), ...ensureSyncArray(cloud.dailyplans)],
                allDeletedIds,
                'daily-plan',
                [...ensureSyncArray(base.dailyPlans), ...ensureSyncArray(base.dailyplans)]
            );
            state.ideas = mergeEntityArrays(state.ideas, cloud.ideas || [], allDeletedIds, 'idea', base.ideas || []);
            neutralizeSyncStateInPlace();
            syncIdeaTags();
            state.deletedIds = allDeletedIds;
            return allDeletedIds;
        }

function getSyncErrorToastMessage(fallback) {
    const detail = window.__lastSyncErrorMessage ? String(window.__lastSyncErrorMessage).replace(/\s+/g, ' ').slice(0, 96) : '';
    return detail ? (fallback + '：' + detail) : fallback;
}

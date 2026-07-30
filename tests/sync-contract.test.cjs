const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function emptyState() {
  return {
    todos: [], groups: [], transactions: [], templates: [], archivedTodos: [],
    habits: [], habitRecords: {}, projects: [],
    milktea: { records: [], settings: { weeklyLimit: 2, monthlyLimit: 8 } },
    coffee: { records: [], settings: { weeklyLimit: 3, monthlyLimit: 12 } },
    dailyPlans: [], ideas: [], ideaTags: [], deletedIds: [], focusSessions: []
  };
}

function createHarness(values = new Map()) {
  const context = {
    console: { log() {}, warn() {}, error() {} },
    currentUser: { id: 'roundtrip-user' },
    getThemePrefs: () => ({}),
    localStorage: {
      getItem: key => values.has(key) ? values.get(key) : null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key)
    },
    require,
    ensureSyncArray: value => Array.isArray(value) ? value : [],
    ensureSyncObject: value => value && typeof value === 'object' && !Array.isArray(value) ? value : {},
    state: emptyState(),
    syncIdeaTags() {
      context.state.ideaTags = [...new Set(
        context.state.ideas.flatMap(idea => Array.isArray(idea.tags) ? idea.tags : [])
      )];
    },
    window: {}
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'storage.js'), 'utf8'), context);
  const syncSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'sync.js'), 'utf8');
  const helperStart = syncSource.indexOf('function canonicalSyncJson');
  const helperEnd = syncSource.indexOf('async function syncToCloud', helperStart);
  vm.runInContext(syncSource.slice(helperStart, helperEnd), context);
  return context;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('three-way merge combines changes to different fields', () => {
  const context = createHarness();
  context.baseValue = { id: '1', text: 'base', completed: false };
  context.localValue = { id: '1', text: 'local', completed: false };
  context.remoteValue = { id: '1', text: 'base', completed: true };
  const merged = vm.runInContext('mergeSyncValue(localValue, remoteValue, baseValue)', context);
  assert.deepEqual(plain(merged), { id: '1', text: 'local', completed: true });
});

test('custom drink limits beat untimestamped defaults and unknown settings survive', () => {
  const context = createHarness();
  context.defaults = { weeklyLimit: 2, monthlyLimit: 8 };
  context.custom = { weeklyLimit: 1, monthlyLimit: 3, dailyCaffeineLimitMg: 350 };
  const defaultFirst = vm.runInContext(
    "mergeDrinkSettings(defaults, custom, {}, 'milktea')",
    context
  );
  const customFirst = vm.runInContext(
    "mergeDrinkSettings(custom, defaults, {}, 'milktea')",
    context
  );
  assert.deepEqual(plain(defaultFirst), plain(customFirst));
  assert.deepEqual(plain(defaultFirst), {
    weeklyLimit: 1,
    monthlyLimit: 3,
    dailyCaffeineLimitMg: 350
  });
});

test('drink limits resolve defaults per field and preserve explicit caffeine settings', () => {
  const context = createHarness();
  context.partialLocal = {
    weeklyLimit: 1,
    monthlyLimit: 8,
    dailyCaffeineLimitMg: 350
  };
  context.partialCloud = {
    weeklyLimit: 2,
    monthlyLimit: 3,
    dailyCaffeineLimitMg: 400,
    extraLimit: 7
  };
  const merged = vm.runInContext(
    "mergeDrinkSettings(partialLocal, partialCloud, {}, 'milktea')",
    context
  );
  assert.deepEqual(plain(merged), {
    weeklyLimit: 1,
    monthlyLimit: 3,
    dailyCaffeineLimitMg: 400,
    extraLimit: 7
  });
});

test('accepted cloud payload followed by another sync is a no-op', () => {
  const context = createHarness();
  context.state.transactions = [{
    id: '42', type: 'expense', amount: 12.5, category: '餐饮',
    date: '2026-07-18', note: 'cloud',
    createdAt: '2026-07-18T01:00:00.000Z',
    updatedAt: '2026-07-18T01:00:00.000Z'
  }];
  context.cloudRow = vm.runInContext('buildCloudPayloadForSync([], currentUser.id)', context);

  context.state = emptyState();
  vm.runInContext('mergeCloudRowIntoState(cloudRow, {}, Date.parse("2026-07-18T02:00:00.000Z"))', context);
  context.nextPayload = vm.runInContext(
    'buildCloudPayloadForSync(state.deletedIds, currentUser.id)',
    context
  );

  assert.equal(vm.runInContext('cloudPayloadHasChanges(nextPayload, cloudRow)', context), false);
  context.secondPayload = vm.runInContext(
    'buildCloudPayloadForSync(state.deletedIds, currentUser.id)',
    context
  );
  assert.equal(vm.runInContext('cloudPayloadHasChanges(secondPayload, cloudRow)', context), false);
});

test('legacy numeric tombstones are typed for matches and string-preserved when unmatched', () => {
  const context = createHarness();
  context.cloudRow = {
    todos: [{
      id: 123, text: 'stale', completed: false, subtasks: [],
      createdAt: '2026-07-18T00:00:00.000Z',
      updatedAt: '2026-07-18T00:00:00.000Z'
    }],
    deletedids: [123]
  };
  vm.runInContext('mergeCloudRowIntoState(cloudRow, {}, Date.parse("2026-07-18T02:00:00.000Z"))', context);
  assert.deepEqual(plain(context.state.todos), []);
  assert.deepEqual(plain(context.state.deletedIds), ['todo:123']);

  context.state = emptyState();
  context.cloudRow = { deletedids: [999] };
  vm.runInContext('mergeCloudRowIntoState(cloudRow, {}, Date.parse("2026-07-18T02:00:00.000Z"))', context);
  assert.deepEqual(plain(context.state.deletedIds), ['999']);
  context.payload = vm.runInContext(
    'buildCloudPayloadForSync(state.deletedIds, currentUser.id)',
    context
  );
  assert.deepEqual(plain(context.payload.deletedids), ['999']);
});

test('accepted entity tombstones stay monotonic across stale clients', () => {
  const context = createHarness();
  context.localIds = [];
  context.cloudIds = [];
  context.baseIds = ['todo:accepted-delete'];
  const merged = vm.runInContext(
    'mergeDeletedIdsThreeWay(localIds, cloudIds, baseIds, {})',
    context
  );
  assert.deepEqual(plain(merged), ['todo:accepted-delete']);
});

test('cross-tab local snapshots merge additions and advance a complete-snapshot marker', () => {
  const context = createHarness();
  context.localTodo = {
    id: 'local-tab-todo', text: '本标签页', completed: false, subtasks: [],
    createdAt: '2026-07-29T01:00:00.000Z',
    updatedAt: '2026-07-29T01:00:00.000Z'
  };
  context.otherTodo = {
    id: 'other-tab-todo', text: '另一标签页', completed: false, subtasks: [],
    createdAt: '2026-07-29T01:01:00.000Z',
    updatedAt: '2026-07-29T01:01:00.000Z'
  };
  context.state.todos = [context.localTodo];
  context.localStorage.setItem('data_owner_user_id', context.currentUser.id);
  context.localStorage.setItem('todos', JSON.stringify([context.otherTodo]));

  assert.equal(
    vm.runInContext('reconcileCrossTabBusinessCache()', context),
    true
  );
  assert.deepEqual(
    plain(context.state.todos.map(todo => todo.id).sort()),
    ['local-tab-todo', 'other-tab-todo']
  );
  const revision = JSON.parse(
    context.localStorage.getItem('local_data_revision_v1')
  );
  assert.equal(revision.ownerId, context.currentUser.id);
  assert.equal(revision.operation, 'save');
  assert.equal(
    context.localStorage.getItem('storage_metadata_cleanup_v1'),
    'complete'
  );
});

test('stale account tabs cannot overwrite the active account cache', () => {
  const context = createHarness();
  const activeAccountTodos = [{
    id: 'active-account-todo', text: '当前账号数据', completed: false,
    subtasks: []
  }];
  context.localStorage.setItem('data_owner_user_id', 'active-account');
  context.localStorage.setItem('todos', JSON.stringify(activeAccountTodos));
  context.state.todos = [{
    id: 'stale-account-todo', text: '过期标签页数据', completed: false,
    subtasks: []
  }];

  assert.equal(vm.runInContext('baseSave()', context), false);
  assert.deepEqual(
    JSON.parse(context.localStorage.getItem('todos')),
    activeAccountTodos
  );
  assert.equal(
    context.localStorage.getItem('local_data_revision_v1'),
    null
  );
});

test('logout and account-switch revisions fence stale writers before and after owner removal', () => {
  const sharedValues = new Map();
  const staleTab = createHarness(sharedValues);
  const boundaryTab = createHarness(sharedValues);
  staleTab.currentUser = { id: 'old-account' };
  boundaryTab.currentUser = { id: 'old-account' };
  staleTab.state.todos = [{
    id: 'stale-write', text: '旧标签页', completed: false, subtasks: []
  }];
  staleTab.localStorage.setItem('data_owner_user_id', 'old-account');

  assert.equal(
    vm.runInContext(
      "signalCrossTabOwnershipBoundary(null, 'logout')",
      boundaryTab
    ),
    true
  );
  assert.equal(vm.runInContext('baseSave()', staleTab), false);

  staleTab.localStorage.removeItem('data_owner_user_id');
  assert.equal(vm.runInContext('baseSave()', staleTab), false);

  assert.equal(
    vm.runInContext(
      "signalCrossTabOwnershipBoundary('new-account', 'switch')",
      boundaryTab
    ),
    true
  );
  staleTab.localStorage.setItem('data_owner_user_id', 'old-account');
  assert.equal(vm.runInContext('baseSave()', staleTab), false);
});

test('a target account or anonymous tab can intentionally claim a matching boundary', () => {
  const context = createHarness();
  context.currentUser = { id: 'new-account' };
  assert.equal(
    vm.runInContext("claimCrossTabDataOwnership('new-account')", context),
    true
  );
  assert.equal(vm.runInContext('baseSave()', context), true);

  assert.equal(
    vm.runInContext(
      "signalCrossTabOwnershipBoundary(null, 'logout')",
      context
    ),
    true
  );
  context.localStorage.removeItem('data_owner_user_id');
  context.currentUser = null;
  assert.equal(vm.runInContext('baseSave()', context), true);
  const revision = JSON.parse(
    context.localStorage.getItem('local_data_revision_v1')
  );
  assert.equal(revision.ownerId, null);
  assert.equal(revision.operation, 'save');
});

test('logout and account isolation publish boundaries before clearing ownership data', () => {
  const root = path.join(__dirname, '..');
  const syncSource = fs.readFileSync(path.join(root, 'js', 'sync.js'), 'utf8');
  const signOutSource = syncSource.slice(
    syncSource.indexOf('async function signOut'),
    syncSource.indexOf('// 检查已保存的登录状态', syncSource.indexOf('async function signOut'))
  );
  assert.ok(
    signOutSource.indexOf("signalCrossTabOwnershipBoundary(null, 'logout')")
      < signOutSource.indexOf("localStorage.removeItem('data_owner_user_id')")
  );
  assert.ok(
    signOutSource.indexOf("localStorage.removeItem('data_owner_user_id')")
      < signOutSource.indexOf('baseSave(null)')
  );

  const appSource = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
  const isolateSource = appSource.slice(
    appSource.indexOf('function isolateLocalDataForUser'),
    appSource.indexOf('function renderStats')
  );
  assert.ok(
    isolateSource.indexOf("signalCrossTabOwnershipBoundary(nextUserId, 'switch')")
      < isolateSource.indexOf('resetAccountScopedState()')
  );
});

test('Electron renderers are sandboxed and remote sync dependencies are pinned', () => {
  const root = path.join(__dirname, '..');
  const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const widget = fs.readFileSync(path.join(root, 'widget', 'widget.html'), 'utf8');

  assert.equal((main.match(/nodeIntegration:\s*false/g) || []).length, 2);
  assert.equal((main.match(/contextIsolation:\s*true/g) || []).length, 2);
  assert.equal((main.match(/sandbox:\s*true/g) || []).length, 2);
  assert.match(main, /containsSensitiveWidgetKey/);
  assert.match(main, /setWindowOpenHandler\(\(\) => \(\{ action: 'deny' \}\)\)/);
  assert.ok(fs.existsSync(path.join(root, 'preload.js')));
  assert.ok(fs.existsSync(path.join(root, 'widget', 'preload.js')));

  for (const [name, renderer] of [['index.html', index], ['widget.html', widget]]) {
    assert.doesNotMatch(renderer, /\brequire\s*\(/, `${name} must not access Node directly`);
    assert.doesNotMatch(renderer, /\bprocess\.env\b/, `${name} must not access the environment`);
  }
  assert.match(index, /chart\.js@4\.4\.0[^>]+integrity="sha384-e6nUZLBkQ86NJ6TVVKAeSaK8jWa3NhkYWZFomE39AvDbQWeie9PlQqM3pmYW5d1g"/);
  assert.match(index, /supabase-js@2\.110\.7[^>]+integrity="sha384-BmlQlKlDvXvKoxkn5OQuUo\/aJQCTXeB\+Kls6EccBmG4Kf8AXvp89RtO9MtPxP\/r5"/);
  assert.doesNotMatch(index.match(/Content-Security-Policy" content="([^"]+)"/)?.[1] || '', /localhost|127\.0\.0\.1/);
  const widgetCsp = widget.match(/Content-Security-Policy" content="([^"]+)"/)?.[1] || '';
  assert.match(widgetCsp, /connect-src 'self'/);
  assert.doesNotMatch(widgetCsp, /supabase/i);
});

test('Realtime SDK cannot run a competing auth refresh loop', () => {
  const syncSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'sync.js'), 'utf8');
  assert.match(syncSource, /persistSession:\s*false/);
  assert.match(syncSource, /autoRefreshToken:\s*false/);
  assert.match(syncSource, /detectSessionInUrl:\s*false/);
  assert.match(syncSource, /SYNC_REQUEST_TIMEOUT_MS\s*=\s*15000/);
  assert.match(syncSource, /callerSignal/);
  assert.match(syncSource, /select=\$\{SYNC_RETURN_COLUMNS\}/);
});

test('browser storage and auth tokens are application-scoped', () => {
  const config = fs.readFileSync(path.join(__dirname, '..', 'js', 'config.js'), 'utf8');
  assert.match(config, /PROLIFE_STORAGE_PREFIX\s*=\s*'prolife_rebuild::'/);
  assert.match(config, /legacyStorageKeysNotToCopy[\s\S]*'access_token'[\s\S]*'refresh_token'[\s\S]*'sync_base_snapshots_v2'[\s\S]*'data_owner_user_id'[\s\S]*'saved_accounts'[\s\S]*'pendingLogoutBackup'/);
  assert.match(config, /rawLocalStorage\.getItem\(`\$\{PROLIFE_STORAGE_PREFIX\}/);
  assert.match(config, /local_data_revision_v1/);
});

test('legacy renderer neutralizes active markup and unsafe attribute values', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'storage.js'), 'utf8');
  const start = source.indexOf('const ACTIVE_SYNC_MARKUP_PATTERN');
  const end = source.indexOf('function exportWidgetData', start);
  const context = { state: {
    todos: [{ id: "bad');alert(1)//", text: '<img src=x onerror=alert(1)>', projectColor: 'red;position:fixed', icon: 'x" onclick="alert(1)' }],
    ideas: [{ id: 'safe-id', content: '2 < 3' }]
  } };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  vm.runInContext('neutralizeSyncStateInPlace()', context);

  assert.equal(context.state.todos[0].text, '＜img src=x onerror=alert(1)＞');
  assert.match(context.state.todos[0].id, /^[a-z0-9_.:-]+$/i);
  assert.equal(context.state.todos[0].projectColor, '#6b7280');
  assert.equal(context.state.todos[0].icon, 'circle');
  assert.equal(context.state.ideas[0].content, '2 < 3');
});

test('legacy habit tombstones and nested habit-record keys use the same sanitized id', () => {
  const context = createHarness();
  context.unsafeHabitId = '中文 habit';
  context.rawState = {
    habits: [{ id: context.unsafeHabitId, name: '兼容习惯' }],
    habitRecords: { [context.unsafeHabitId]: { '2026-07-29': 100 } },
    deletedIds: [
      `habit-record:${context.unsafeHabitId}:2026-07-28`,
      `habit-record-delete:${context.unsafeHabitId}:2026-07-29:200`
    ]
  };
  const sanitized = vm.runInContext(
    'neutralizeActiveSyncMarkup(rawState, "")',
    context
  );
  const safeHabitId = vm.runInContext(
    'encodeUnsafeSyncId(unsafeHabitId)',
    context
  );

  assert.equal(
    safeHabitId,
    'u_46d75b0f__u4e2d__u6587__u20_habit'
  );
  assert.equal(vm.runInContext("encodeUnsafeSyncId('')", context), 'invalid_1yz14zp');
  assert.equal(sanitized.habits[0].id, safeHabitId);
  assert.deepEqual(plain(sanitized.habitRecords), {
    [safeHabitId]: { '2026-07-29': 100 }
  });
  assert.deepEqual(plain(sanitized.deletedIds), [
    `habit-record:${safeHabitId}:2026-07-28`,
    `habit-record-delete:${safeHabitId}:2026-07-29:200`
  ]);
  assert.notEqual(safeHabitId, '_u4e2d__u6587__u20_habit');
});

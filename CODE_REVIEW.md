# ProLife Todo 全面代码审查

审查日期: 2026-05-07
审查范围: 全部源码文件（33个JS文件 + index.html + main.js + vite.config.js）

---

## 一、架构总览

- **技术栈**: 原生 JS（无框架），Electron 桌面端 + PWA 浏览器端
- **模块系统**: 全局变量 + 同步 `<script>` 标签（依赖顺序加载）
- **状态管理**: `window.state` 全局可变对象，所有模块直接读写
- **数据持久化**: localStorage + Supabase 云端同步
- **构建工具**: Vite（concat 插件将30个JS文件打包为单模块）

### 文件依赖顺序
```
config → state → utils → storage → theme → electron → ui → groups → todos
→ selects → calendar → finance → ideas → search → archive → repeat
→ habits → projects → batch → notifications → dragdrop → templates → stats
→ pomodoro → shortcuts → mindmap → drinks → daily-plans → import-export
→ app → pubsub → [supabase CDN] → sync
```

---

## 二、按模块审查结果

### 2.1 config.js (57行) - 无问题

配置常量文件，结构清晰。包含颜色数组、记账分类、Supabase凭证、主题配置。

**注意**: `SUPABASE_ANON_KEY` 硬编码在前端代码中，这是 anon key（设计如此），但建议确认 RLS 策略已正确配置。

### 2.2 state.js (172行)

**问题**:
1. **ID生成**: `uniqueId()` 使用 `Date.now() * 1000 + (++_idCounter % 1000)`，高并发时可能冲突（_idCounter 取模1000循环）
2. **迁移机制**: `migrations[0]` 只处理了7个数组类型的 ID 规范化，遗漏了 `transactions` 的 ID（财务记录的ID有特殊前缀 `mt_`）
3. **全局变量过多**: `currentUser`, `accessToken`, `refreshToken`, `supabaseClient`, `realtimeChannel` 都是全局变量，与 state 对象混在一起

### 2.3 utils.js (91行)

**问题**:
1. **showConfirm()**: `confirmResolve` 只保存一个引用，如果连续弹出两个确认框，第一个的 resolve 会被覆盖
2. **confirmDialog.style.display**: `showConfirm()` 设置 `dialog.style.display = 'flex'`，但 `closeModal()` 通过 `classList.remove('active')` 关闭，不恢复 display 属性

### 2.4 storage.js (163行)

**问题**:
1. **mergeArrays()**: 只比较 `updatedAt` 或 `createdAt`，如果本地和云端同时修改了不同字段，只会取时间戳更新的整个对象，无法做字段级合并

### 2.5 theme.js (126行) - 良好

主题系统设计合理，有别名映射、持久化、UI同步。`applyTheme()` 支持条件式执行。

### 2.6 electron.js (26行) - 良好

Electron 环境检测和窗口控制按钮绑定，简洁无问题。

### 2.7 ui.js (332行)

**问题**:
1. **initCustomSelects()**: 遍历所有 `.custom-select` 但跳过硬编码 ID 的编辑选择器，后续添加新选择器时容易遗漏

### 2.8 groups.js (280行)

**问题**:
1. **selectProject()** 第171行: `opt.dataset.value == id` 使用 `==` 而非 `===` 或 `String()` 比较
2. **selectGroup()** 第183行: `String(t.projectId) == String(id)` 混用了 `==` 和 `String()` 包装

### 2.9 todos.js (1508行) - 最大的文件

**问题**:
1. **console.log 调试语句**: 第21、43、48、76行有 `console.log('[addTodo]...')` 调试日志，应移除
2. **renderTodos()**: 函数过长（~220行），包含了列表视图、今日视图、看板视图、连线视图四种渲染逻辑
3. **createTodoItem()**: 第151行 `onclick="toggleSubtasksExpand(${t.id})"` 使用内联事件，ID 作为数字嵌入 HTML，大数字时可能丢失精度
4. **viewTodo()**: 整个函数100+行构建 HTML 字符串

### 2.10 selects.js (159行)

**问题**:
1. **updateGroupSelects()**: 分组和项目的选项构建逻辑在 `selects.js`、`todos.js`（updateEditCategorySelect）、`batch.js`（updateBatchMoveCategorySelect）中重复出现三次

### 2.11 calendar.js (317行)

**问题**:
1. **renderCalendarDetail()**: 点击任务时使用内联 `onchange="toggleTodo(${t.id})"` — ID 精度问题同 todos.js
2. **showProjectTasksInCalendar()**: 与 `renderCalendarDetail()` 有大量重复的HTML构建代码

### 2.12 finance.js (838行)

**问题**:
1. **renderExpensePieChart()**: 第515行使用 `alert()` 显示饼图点击详情，应使用自定义弹窗
2. **Chart 实例泄漏**: `renderProjectPieChart()` 在 `stats.js` 中每次都创建新 Chart 实例但从不销毁

### 2.13 ideas.js (568行)

**问题**:
1. **quickAddIdea()** 第62行: `Number(linkVal.split(':')[1])` — 如果ID很大可能精度丢失
2. **renderIdeaCard()**: 第140行 `onclick="toggleIdeaPin(${idea.id})"` — 大ID精度丢失

### 2.14 search.js (292行) - 良好

已完成优化: 使用 `sectionTemplate` 辅助函数，CSS 工具类替代内联样式。

### 2.15 archive.js (262行)

**问题**:
1. **renderArchiveList()**: 使用 `innerHTML` 构建长列表，大数据量时性能差
2. 第94行: `onchange="toggleArchiveSelection(${todo.id})"` — 大ID精度丢失

### 2.16 repeat.js (34行) - 良好

简洁的习惯打卡变量定义和图标列表。

### 2.17 habits.js (283行)

**问题**:
1. **calculateStreak()**: 如果用户某天忘了打卡，连续天数直接归零，没有容错

### 2.18 projects.js (305行)

**问题**:
1. **deleteProject()**: 逻辑复杂，有3种删除选项，但 `try-catch` 包裹了整个函数

### 2.19 batch.js (262行)

**问题**:
1. **batchCompleteTodos()** 第77行: `showSyncToast()` 在 `state.selectedTodos.clear()` 之后调用，所以显示 "已标记 0 项为完成" — **BUG**

### 2.20 notifications.js (223行)

**问题**:
1. **sendNotification()** 第172行: 通知图标使用 shields.io URL（外部依赖）
2. **scheduleDailyNotification()**: 使用 `setTimeout` 递归调度，页面刷新后定时器丢失

### 2.21 dragdrop.js (113行) - 良好

### 2.22 templates.js (202行)

**问题**:
1. **showTemplateDetail()** 第189行: 使用 `alert()` 显示模板详情
2. **createFromTemplate()** 第156行: `id: uniqueId() + Math.random()` — 子任务ID生成方式不一致

### 2.23 stats.js (517行)

**问题**:
1. **renderProjectPieChart()**: 每次调用都创建新 Chart 实例但不销毁旧实例 — **内存泄漏**
2. **calculateHabitStreak()**: 与 `habits.js` 中的 `calculateStreak()` 逻辑完全重复

### 2.24 pomodoro.js (91行) - 良好

### 2.25 shortcuts.js (231行)

**问题**:
1. **showKeyboardShortcutsHelp()**: 动态创建模态框但不使用 `closeModal()` 系统
2. **ESC 关闭模态框**: 遍历所有 `.modal-overlay` 关闭，未考虑 z-index 优先级

### 2.26 mindmap.js (625行)

**问题**:
1. **showSubGroupDetail()** 第550行: `onchange` 中使用 `p.id==${project.id}` — `==` 比较问题
2. **showTaskDetail()** 第584、608、616行: 多处使用 `t.id==${task.id}` — `==` 比较问题
3. **editSubGroup()**: 临时替换按钮 onclick 的方式很脆弱

### 2.27 drinks.js (451行)

**问题**:
1. **renderMilkteaView()**: 函数过长（~150行），混合了数据计算和DOM操作
2. **state.mtHeatmapYear/month**: 赋值给 state 对象但不持久化

### 2.28 daily-plans.js (117行) - 良好

### 2.29 import-export.js (1013行)

**问题**:
1. **showImportExportMenu()**: 所有按钮样式内联在JS中（~200行CSS字符串）
2. **parseCSV()**: 手写的CSV解析器，复杂CSV可能解析错误

### 2.30 app.js (160行) - 良好

初始化顺序清晰，所有模块初始化在 `DOMContentLoaded` 中完成。

### 2.31 pubsub.js (22行) - 良好

### 2.32 sync.js (1398行) - 第二大文件

**问题**:
1. **syncDataOnLogin()**: 合并逻辑与 `syncFromCloud()` 中重复（~30行完全重复）
2. **Realtime handler**: 只比较 `todos` JSON 判断变化，忽略其他数据变化
3. **openAuthModal()**: 密码以 Base64 存储在 localStorage（不是加密）
4. **save()**: 重新定义全局 `save` 函数，覆盖可能存在的定义

### 2.33 main.js (Electron主进程, 362行)

**问题**:
1. **nodeIntegration: true + contextIsolation: false**: 不安全的配置
2. 单实例锁正确实现，`second-instance` 事件处理合理

### 2.34 vite.config.js (82行) - 良好

自定义 concat 插件设计合理。

---

## 三、跨模块问题汇总

### 3.1 BUG（需修复）

| 编号 | 严重度 | 文件 | 描述 |
|------|--------|------|------|
| B1 | 高 | batch.js:77 | `batchCompleteTodos()` 在 `clear()` 后读取 size，显示 "已标记 0 项" |
| B2 | 中 | groups.js:171 | `selectProject()` 中 `==` 松散比较 |
| B3 | 中 | mindmap.js:550,584,608 | 多处使用 `==` 比较 ID |
| B4 | 低 | templates.js:156 | 子任务ID使用 `uniqueId() + Math.random()` |

### 3.2 调试代码残留

| 文件 | 行号 | 内容 |
|------|------|------|
| todos.js | 21, 43, 48, 76 | `console.log('[addTodo]...')` |

### 3.3 代码重复

| 描述 | 出现位置 | 估计行数 |
|------|----------|----------|
| 分类选择器构建 | selects.js, todos.js, batch.js | ~90行 × 3 |
| 习惯连续打卡计算 | habits.js, stats.js | ~20行 × 2 |
| 云端数据合并逻辑 | sync.js (两处) | ~30行 × 2 |
| 日历任务HTML构建 | calendar.js (两处) | ~50行 × 2 |

### 3.4 性能隐患

| 编号 | 文件 | 描述 |
|------|------|------|
| P1 | stats.js:455-493 | Chart 实例不销毁，内存泄漏 |
| P2 | todos.js | `state.todos = state.todos.map(...)` 频繁创建新数组 |
| P3 | mindmap.js | 每次渲染清除重建所有DOM节点 |
| P4 | archive.js | innerHTML 构建长列表 |

### 3.5 安全问题

| 编号 | 文件 | 描述 |
|------|------|------|
| S1 | main.js:89 | `nodeIntegration: true, contextIsolation: false` |
| S2 | sync.js:1056 | 密码以 Base64 存储（非加密） |

### 3.6 ID精度问题

多处使用 `onclick="functionName(${largeNumberId})"`，当ID超过 `Number.MAX_SAFE_INTEGER` 时精度丢失。涉及文件：todos.js, calendar.js, archive.js, habits.js, ideas.js, mindmap.js, drinks.js。

**建议**: 将 `onclick="${fn}(${id})"` 改为 `onclick="${fn}('${id}')"` 并在函数内做类型转换。

### 3.7 用户体验问题

| 编号 | 文件 | 描述 |
|------|------|------|
| U1 | finance.js:533 | 饼图点击使用 `alert()` |
| U2 | templates.js:189 | 模板详情使用 `alert()` |
| U3 | utils.js:52 | showConfirm() 连续弹出会被覆盖 |

---

## 四、建议优化优先级

### P0（立即修复）
1. 修复 batch.js `batchCompleteTodos()` 的 size 读取 BUG
2. 移除 todos.js 中的 console.log 调试语句

### P1（近期修复）
1. 统一所有 `==` ID 比较为 `String(a) === String(b)`
2. 修复 stats.js Chart 实例泄漏
3. 提取重复的分类选择器构建代码

### P2（中期优化）
1. 消除 sync.js 中的合并逻辑重复
2. 将 `alert()` 替换为自定义弹窗
3. 解决大ID精度问题（使用字符串形式传递）

### P3（长期改进）
1. 评估 `nodeIntegration` 安全风险
2. 密码存储改用更安全的方式
3. 性能优化：大数据量列表渲染、减少DOM重建

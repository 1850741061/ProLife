# ProLife

生活管理系统 —— 任务管理、项目管理、习惯打卡、番茄钟、记账，一站式效率工具。

## 维护约定

自 2026-07-18 起，`F:\rebuild_todo` 是唯一继续维护的重构版目录；`F:\claude` 仅作为旧版单文件实现和历史对照，不再直接开发。新功能应修改本仓库的 `js/` 模块，避免再把改动只写进旧版 `index.html`。

本轮已经把旧版尚未提交的数据合并、类型化删除墓碑、乐观并发同步、Realtime、桌面小组件和关闭行为设置迁入本仓库。迁移后仍以模块文件为源码，不把旧版整份内联脚本覆盖回来。

## 技术栈

- 原生 HTML/CSS/JS（无框架）
- Electron 桌面端
- Supabase 云同步
- PWA 离线支持

## 项目结构

```
├── index.html          # 主入口
├── main.js             # Electron 主进程
├── package.json        # Electron 配置
├── manifest.json       # PWA manifest
├── sw.js               # Service Worker
├── css/                # 样式文件（18 个）
├── js/                 # 逻辑模块（32 个）
│   ├── config.js       # 配置/Supabase 密钥
│   ├── state.js        # 全局状态
│   ├── storage.js      # 本地存储
│   ├── sync.js         # 云同步与认证
│   ├── app.js          # 初始化入口
│   └── ...
├── widget/             # Electron 桌面小组件
├── supabase/migrations # 云端表、RLS 与 Realtime 迁移
└── dist/               # Electron 打包产物（gitignore）
```

## 运行

```bash
# 安装 Web 构建依赖
npm install

# Web 开发与生产构建
npm run dev
npm run build

# Electron 桌面模式（当前仍使用全局 Electron）
npm install -g electron
electron .
```

Electron 直接加载源码 `index.html` 中的经典脚本；Vite 会在 Web 开发/构建时移除这些标签，并改用同一批 `js/` 文件生成的单一 bundle，避免模块重复执行。

## 相关链接

原单文件版本：[Todo (monolithic)](https://github.com/1850741061/Todo)

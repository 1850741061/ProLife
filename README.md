# ProLife

生活管理系统 —— 任务管理、项目管理、习惯打卡、番茄钟、记账，一站式效率工具。

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
├── js/                 # 逻辑模块（31 个）
│   ├── config.js       # 配置/Supabase 密钥
│   ├── state.js        # 全局状态
│   ├── storage.js      # 本地存储
│   ├── sync.js         # 云同步与认证
│   ├── app.js          # 初始化入口
│   └── ...
└── dist/               # Electron 打包产物（gitignore）
```

## 运行

```bash
# 开发模式
npm install -g electron
electron .

# 生产模式
dist/Todo-dev/ProLife.exe
```

## 相关链接

原单文件版本：[Todo (monolithic)]([https://github.com/1850741061/Todo](https://github.com/1850741061/life-manager))

# 🌌 Mydream OS —— 梦之桌面

网页版桌面操作系统，延续 Mydream「深蓝 → 晨曦 → 亮黄」渐变体系。
纯前端、无构建步骤、无框架、无 npm 依赖；可作 PWA 安装到主屏幕。

## 运行

```bash
cd /Users/zhangziluo/Downloads/Mydream
python3 -m http.server 8000     # 从「项目根目录」起服务
# 然后打开 http://localhost:8000/web-os/
```

- 必须从**项目根目录**起服务：OS 里的「本站」应用（Mydream 主页 `../index.html`、html-writer `../html-writer/`）是上级目录的同源页面，用 `cd web-os` 起服务将访问不到。
- 直接双击 `web-os/index.html`（`file://`）也能跑基本功能，但 **Service Worker / PWA 安装 / 上级目录 iframe / 天气** 需经 HTTP(S)。
- 本机 `localhost` 即满足 PWA 的 secure-context 要求。

## 内置「本站」应用

开始菜单顶部「本站」分组 / 桌面图标前两枚：

- **梦之主页**：iframe 加载同项目根目录 `index.html`（个人创作站）。
- **写作工具**：iframe 加载 `html-writer/index.html`（登录密码同 html-writer 设置，默认 `2026`）。

两者与 OS 同源，因此可被正常嵌套；同源的其它页面导航不会被 OS 的
Service Worker 误当成 OS 外壳（见 `sw.js` 导航分支）。
「梦之主页」里点作品链接会用新标签页打开（其页面自身设定），属预期行为。

## 功能

| 模块 | 说明 |
|------|------|
| 桌面图标 | 拖拽定位（吸附网格）、单击打开，位置存 `localStorage.os.iconPos`；开始菜单可「复位图标」 |
| 开始菜单 | 按分类列出应用 + 顶部即时搜索；底部可开关时钟/天气/待办挂件 |
| 窗口 | 单击图标/菜单项在桌面弹出 iframe 窗口；可拖拽 / 最小化 / 最大化 / 关闭；任务栏同步显示，点任务栏按钮可切换 |
| 任务栏 | 窗口按钮（聚焦高亮 / 最小化变暗）+ 系统托盘时钟 |
| 挂件 | 时钟（秒级）、天气（`wttr.in`，可设城市，10 分钟自动刷新）、待办（增删勾选，本地保存）；三者均可拖动换位 |
| PWA | `manifest.webmanifest` + `sw.js` 缓存外壳 + SVG/PNG 图标，可安装到主屏幕并离线打开桌面 |

## 目录结构

```
web-os/
├── index.html
├── manifest.webmanifest
├── sw.js                  # 外壳缓存（改 VERSION 后重新注册即更新）
├── css/style.css
├── js/
│   ├── apps.js            # ← 应用清单（增删应用改这里）
│   ├── store.js           # localStorage 封装 + 事件总线 + toast
│   ├── window-manager.js  # 窗口创建/拖拽/最小化/最大化/关闭/焦点
│   ├── desktop.js         # 桌面图标与拖拽
│   ├── taskbar.js         # 开始菜单 + 任务栏
│   ├── widgets.js         # 时钟 / 天气 / 待办
│   └── main.js            # 启动装配 + PWA + 星点壁纸
├── icons/                 # icon.svg + icon-192/512.png + apple-touch-icon.png
└── README.md
```

## 增删「网页应用」

编辑 `js/apps.js` 顶部注释与 `APPS` 数组。每条：

```js
{
  id: 'myapp',              // 唯一 id
  name: '我的应用',          // 显示名
  cat: '工具',               // 分类（开始菜单按 OS.apps.cats 分组）
  glyph: '🧭',               // 图标字符
  url: 'https://…',          // iframe 地址
  note: '一句话说明',        // 描述
  w: 800, h: 560,           // 默认窗口尺寸
  pin: true                 // 是否固定到桌面（默认 true）
}
```

⚠️ **iframe 能否嵌入取决于对方站点**：若目标站返回
`X-Frame-Options` 或 CSP `frame-ancestors`，窗口里会空白。
自测方法：

```bash
curl -sI -A "Mozilla/5.0" "https://目标站点" | grep -iE 'x-frame-options|content-security-policy'
```

任何应用都可通过窗口右上角「↗ 外部打开」在新标签页打开。
想加「本地内置」应用（离线可用，不走 iframe）：设 `inline: true`
并给 `doc` 一段 HTML 即可（参考内置的「使用说明」）。

## 本地数据（都在当前浏览器，键以 `os.` 开头）

| 键 | 内容 |
|----|------|
| `os.iconPos` | 桌面图标位置 |
| `os.winState` | 各应用窗口位置/尺寸 |
| `os.widgetPos` | 挂件位置 |
| `os.widgets` | 挂件显示开关 |
| `os.weatherCity` | 天气城市（留空按 IP 定位） |
| `os.todos` | 待办列表 |

清空 localStorage 即完全恢复默认排布。

## 离线 / 网络

- 桌面外壳被 `sw.js` 缓存，断网可开桌面、时钟与待办照常。
- 天气挂件需联网（数据源 `wttr.in`，免费、无需 Key，支持 CORS），失败会显示占位与原因。
- iframe 应用内容由对应网站自己决定，不在本项目的离线能力内。

## 配色来源

沿用首页 `index.html` / `assets/style.css`：`#081226→#1f4474→#6a5d74→#c0803f→#f2c457`
与 `--dream:#aecbff`、`--murmur:#d9e4ff`、`--wake:#ffd98a`。

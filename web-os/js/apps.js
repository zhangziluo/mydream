/* =========================================================
   apps.js —— 应用目录（可自行增删）
   字段说明：
     id     唯一标识（同时用作窗口/taskbar 键）
     name   显示名      cat   分类（按 CATS 顺序分组）
     glyph  图标字符    note  描述
     url    在窗口 iframe 中加载的地址（须允许被嵌入！
            若站点返回 X-Frame-Options / CSP frame-ancestors
            会拒绝 iframe，此时请点窗口右上「↗」新标签打开）
     inline 置 true 表示「本地内置应用」（不走 iframe，离线可用）
     pin    是否显示在桌面上（默认 true）
     w/h    默认窗口尺寸
   ========================================================= */
(function () {
  'use strict';

  var HELP_DOC = `\
<h1>梦之桌面 · 使用说明</h1>
<p>这是延续 Mydream「深蓝 → 晨曦 → 亮黄」渐变体系的小型网页桌面。所有偏好都保存在本机浏览器 localStorage 中，不会上传任何内容。</p>

<h2>桌面图标</h2>
<ul>
  <li>按住图标拖动即可改变位置（自动吸附网格，位置会记住）。</li>
  <li>单击图标打开对应应用；右下角任务栏也会出现它的按钮。</li>
  <li>想让图标“回到默认位置”：打开开始菜单 → 点「复位图标」。</li>
</ul>

<h2>窗口</h2>
<ul>
  <li>拖动标题栏移动窗口；标题栏右侧为最小化 / 最大化 / 关闭。</li>
  <li>点窗口任意处可把它带到最前；点任务栏按钮可最小化或还原。</li>
  <li>窗口内容用 iframe 打开对应网站。部分网站禁止被嵌入，若窗口空白，
      请点标题栏的「↗ 外部打开」在新标签页查看。</li>
</ul>

<h2>开始菜单</h2>
<ul>
  <li>左下「✧ 开始」按分类列出应用，顶部输入框可按名称即时过滤。</li>
  <li>菜单底部可开关「时钟 / 天气 / 待办」挂件，并复位图标。</li>
</ul>

<h2>挂件</h2>
<ul>
  <li>时钟：本地时间，每秒刷新。</li>
  <li>天气：数据来自 <code>wttr.in</code>（免费、无需 Key）。右上小齿轮可填城市名，
      留空则按你的 IP 自动定位；离线时显示占位并保留刷新入口。</li>
  <li>待办：增删勾选均即时保存到本地。</li>
</ul>

<h2>安装 / 离线</h2>
<ul>
  <li>支持 PWA：浏览器地址栏或任务栏出现「安装」时点一下，即可加入主屏幕独立运行。</li>
  <li>Service Worker 会缓存本桌面外壳；断网时桌面、时钟与待办仍可用。</li>
</ul>
<hr>
<p class="tip">新增应用：编辑 <code>js/apps.js</code> 的清单即可（见文件头注释）。</p>`;

  var CATS = ['本站', '系统', '工具', '阅读'];

  var APPS = [
    {
      id: 'mydream', name: '梦之主页', cat: '本站', glyph: '🌙', pin: true,
      url: '../index.html',
      note: 'Mydream 个人创作站 · 梦 · 梦呓 · 醒', w: 1100, h: 700
    },
    {
      id: 'writer', name: '写作工具', cat: '本站', glyph: '✍️', pin: true,
      url: '../html-writer/index.html',
      note: 'html-writer：Markdown → 单文件 HTML', w: 1150, h: 720
    },
    {
      id: 'help', name: '使用说明', cat: '系统', glyph: '💡', pin: false,
      note: '本桌面用法与数据存储说明', inline: true, doc: HELP_DOC, w: 600, h: 520
    },
    {
      id: 'osm', name: '开放地图', cat: '工具', glyph: '🗺',
      url: 'https://www.openstreetmap.org/export/embed.html?bbox=116.06,39.62,116.62,40.08&layer=mapnik&marker=39.90,116.40',
      note: 'OpenStreetMap 官方嵌入视图', w: 840, h: 580
    },
    {
      id: 'gmap', name: '谷歌地图', cat: '工具', glyph: '📍',
      url: 'https://maps.google.com/maps?q=%E5%8C%97%E4%BA%AC&z=10&output=embed',
      note: 'Google Maps 嵌入视图（需网络）', w: 880, h: 600
    },
    {
      id: 'wiki', name: '维基百科', cat: '阅读', glyph: '📚',
      url: 'https://zh.wikipedia.org/wiki/%E6%A2%A6',
      note: '中文维基百科 · 梦', w: 900, h: 640
    },
    {
      id: 'wikis', name: '维基文库', cat: '阅读', glyph: '📖',
      url: 'https://zh.wikisource.org/wiki/%E9%A6%96%E9%A1%B5',
      note: '自由的图书馆', w: 900, h: 640
    },
    {
      id: 'wttr', name: '天气终端', cat: '工具', glyph: '🌤',
      url: 'https://wttr.in/Shanghai?format=3',
      note: 'wttr.in 文本天气', w: 520, h: 300
    }
  ];

  var byId = {};
  APPS.forEach(function (a) { byId[a.id] = a; });

  OS.apps = {
    list: APPS,
    byId: function (id) { return byId[id] || null; },
    cats: CATS,
    pinned: function () { return APPS.filter(function (a) { return a.pin !== false; }); }
  };
})();

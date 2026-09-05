/* =========================================================
   Mydream 主页脚本
   1) 标记 JS 可用（启用卡片进场动画）
   2) 栏目进场渐显（IntersectionObserver）
   3) 页脚年份
   作品卡片由根目录 build.js 扫描 dream/ whisper/ awake/
   三目录的 HTML 文件，构建时静态写入 index.html（勿在 JS 重复渲染）。
   ========================================================= */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  /* ---------------- 栏目进场渐显 ---------------- */
  var cols = document.querySelectorAll('.col');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    cols.forEach(function (col) { io.observe(col); });
  } else {
    cols.forEach(function (col) { col.classList.add('in'); });
  }

  /* ---------------- 页脚年份 ---------------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------------- 已发布文章（KV 动态源，/api/posts） ----------------
     加载成功后按栏目渲染卡片；失败（本地无 Functions 等）则静默，
     保留 build.js 生成的静态卡片与占位。 */
  function createCard(post) {
    var li = document.createElement('li');

    var a = document.createElement('a');
    a.className = 'work';
    a.href = 'api/post?slug=' + encodeURIComponent(post.slug);
    a.target = '_blank';
    a.rel = 'noopener';

    var info = document.createElement('span');
    info.className = 'w-info';

    var title = document.createElement('span');
    title.className = 'w-title';
    title.textContent = '《' + post.title + '》';
    info.appendChild(title);

    if (post.note) {
      var note = document.createElement('span');
      note.className = 'w-note';
      note.textContent = post.note;
      info.appendChild(note);
    }

    var badge = document.createElement('span');
    badge.className = 'w-badge';
    badge.textContent = 'html';

    var go = document.createElement('span');
    go.className = 'w-go';
    go.setAttribute('aria-hidden', 'true');
    go.textContent = '→';

    a.appendChild(info);
    a.appendChild(badge);
    a.appendChild(go);
    li.appendChild(a);
    return li;
  }

  /* API 分类键 dream/murmur/awake → 首页板块 data-works 值 */
  var BOARD_MAP = { dream: 'dream', murmur: 'murmur', awake: 'wake' };

  fetch('api/posts', { cache: 'no-cache' })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (postsByBoard) {
      Object.keys(BOARD_MAP).forEach(function (category) {
        var ul = document.querySelector('.works[data-works="' + BOARD_MAP[category] + '"]');
        var list = postsByBoard[category];
        if (!ul || !list || !list.length) return;

        var empty = ul.querySelector('li.empty');
        if (empty) empty.remove();

        var anchor = ul.querySelector('li');   // 静态卡片锚点（可能为 null）
        // 每栏只展示最新 2 篇已发布文章，更多请进入分类管理页（dream/murmur/awake.html）
        list.slice(0, 2).forEach(function (post) {
          ul.insertBefore(createCard(post), anchor);
        });
      });
    })
    .catch(function () { /* 无后端时静默 */ });
})();


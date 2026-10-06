/* =========================================================
   book.js —— 长文目录页（/book?slug=<bookSlug>）
   1) 从地址取 slug，拉 GET /api/book?slug=… 拿书名 + 章节表
   2) 渲染「开始阅读」+ 章节列表；章节链接 → /api/post?slug=…
      （阅读页底部由后端注入「上一章 / 目录 / 下一章」导航）
   3) 页头分类配色随长文分类切换（cat-dream / cat-murmur / cat-awake）
   ========================================================= */
(function () {
  'use strict';

  var CATEGORY_NAMES = { dream: '梦', murmur: '梦呓', awake: '醒' };
  var CATEGORY_PAGE  = { dream: 'dream.html', murmur: 'murmur.html', awake: 'awake.html' };
  var CATEGORY_CLASS = { dream: 'cat-dream', murmur: 'cat-murmur', awake: 'cat-awake' };
  var CATEGORY_CLS_ALL = ['cat-dream', 'cat-murmur', 'cat-awake'];

  var titleEl = document.getElementById('bookTitle');
  var metaEl  = document.getElementById('bookMeta');
  var backEl  = document.getElementById('bookBack');
  var startEl = document.getElementById('bookStart');
  var listEl  = document.getElementById('bookChapters');
  if (!titleEl || !metaEl || !listEl) return;

  /* ---------------- 小工具 ---------------- */
  function fmtDate(ts) {
    var d = new Date(ts);
    function p(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function postHref(slug) {
    return '/api/post?slug=' + encodeURIComponent(slug);
  }

  function setEmpty(text) {
    listEl.textContent = '';
    var empty = document.createElement('div');
    empty.className = 'book-empty';
    empty.innerHTML = '<em>' + text + '</em>';
    listEl.appendChild(empty);
  }

  function setMeta(text) { metaEl.textContent = text; }

  /* ---------------- 渲染 ---------------- */
  function applyCategory(category) {
    var cls = CATEGORY_CLASS[category];
    if (cls) {
      CATEGORY_CLS_ALL.forEach(function (c) { document.body.classList.remove(c); });
      document.body.classList.add(cls);
    }
    var page = CATEGORY_PAGE[category];
    if (backEl && page) {
      backEl.href = page;
      backEl.textContent = '← 返回「' + (CATEGORY_NAMES[category] || '') + '」';
    }
  }

  function renderStart(first) {
    startEl.textContent = '';
    if (!first) return;
    var a = document.createElement('a');
    a.className = 'book-start';
    a.href = postHref(first.slug);
    a.appendChild(document.createTextNode('从第一章开始'));
    var go = document.createElement('span');
    go.className = 'go';
    go.setAttribute('aria-hidden', 'true');
    go.textContent = '→';
    a.appendChild(go);
    startEl.appendChild(a);
  }

  function renderChapters(chapters) {
    listEl.textContent = '';
    if (!chapters.length) { setEmpty('这部长文还没有章节'); return; }

    var ol = document.createElement('ol');
    ol.className = 'chapter-list';
    chapters.forEach(function (ch, i) {
      var li = document.createElement('li');
      li.className = 'chapter-item';

      var a = document.createElement('a');
      a.className = 'chapter-link';
      a.href = postHref(ch.slug);

      var no = document.createElement('span');
      no.className = 'chapter-no';
      no.textContent = '第 ' + (i + 1) + ' 章';

      var t = document.createElement('span');
      t.className = 'chapter-title';
      t.textContent = ch.title || '（无标题）';

      var date = document.createElement('span');
      date.className = 'chapter-date';
      date.textContent = ch.createdAt ? fmtDate(ch.createdAt) : '';

      var go = document.createElement('span');
      go.className = 'chapter-go';
      go.setAttribute('aria-hidden', 'true');
      go.textContent = '→';

      a.appendChild(no);
      a.appendChild(t);
      a.appendChild(date);
      a.appendChild(go);
      li.appendChild(a);
      ol.appendChild(li);
    });
    listEl.appendChild(ol);
  }

  /* ---------------- 初始化 ---------------- */
  var slug = '';
  try {
    slug = new URLSearchParams(location.search).get('slug') || '';
  } catch (e) { /* 极旧浏览器忽略 */ }

  if (!slug) {
    titleEl.textContent = '长文目录';
    setMeta('缺少长文参数');
    setEmpty('地址缺少 ?slug=… 参数：请从首页或分类页的长文卡片进入');
    return;
  }

  fetch('/api/book?slug=' + encodeURIComponent(slug), { cache: 'no-store' })
    .then(function (res) {
      if (res.status === 404) throw new Error('notfound');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (book) {
      var name = book.title || '未命名长文';
      document.title = '《' + name + '》· 目录 · Mydream';
      titleEl.textContent = '《' + name + '》';

      applyCategory(book.category);

      var parts = [];
      if (CATEGORY_NAMES[book.category]) parts.push(CATEGORY_NAMES[book.category]);
      parts.push('共 ' + (book.chapterCount || 0) + ' 章');
      if (book.updatedAt) parts.push('更新于 ' + fmtDate(book.updatedAt));
      setMeta(parts.join(' · '));

      var chapters = Array.isArray(book.chapters) ? book.chapters : [];
      renderStart(chapters[0]);
      renderChapters(chapters);
    })
    .catch(function (err) {
      titleEl.textContent = '长文目录';
      if (String(err && err.message) === 'notfound') {
        setMeta('没有找到这部长文');
        setEmpty('这部长文不存在或已被删除');
      } else {
        setMeta('加载失败');
        setEmpty('加载失败：请确认站点已部署 Functions（/api/book）');
      }
    });
})();

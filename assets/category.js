/* =========================================================
   category.js —— 分类管理页逻辑（梦/梦呓/醒）
   1) 按 <body data-category> 拉取 /api/posts?category=…
   2) 瀑布流渲染卡片（标题/摘要/日期，点击进入阅读页）
   3) 搜索框：标题 + 正文全文本地过滤（中文子串 + 空格多关键词）
   ========================================================= */
(function () {
  'use strict';

  var CAT = (document.body && document.body.dataset.category) || '';
  var searchEl = document.getElementById('catSearch');
  var countEl = document.getElementById('catCount');
  var cardsEl = document.getElementById('catCards');
  if (!CAT || !searchEl || !countEl || !cardsEl) return;

  var posts = [];
  var timer = null;

  /* ---------------- 小工具 ---------------- */
  function fmtDate(ts) {
    var d = new Date(ts);
    function p(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
      + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function makeCard(post) {
    var a = document.createElement('a');
    a.className = 'cat-card';
    a.href = '/api/post?slug=' + encodeURIComponent(post.slug);
    a.target = '_blank';
    a.rel = 'noopener';

    var top = document.createElement('div');
    top.className = 'card-top';
    var date = document.createElement('span');
    date.className = 'card-date';
    date.textContent = fmtDate(post.createdAt);
    top.appendChild(date);

    var h = document.createElement('h2');
    h.textContent = '《' + post.title + '》';

    var note = document.createElement('p');
    note.className = 'card-note';
    var text = post.note || ((post.text || '').slice(0, 130) + '…');
    note.textContent = text;

    var go = document.createElement('span');
    go.className = 'card-go';
    go.textContent = '阅读全文 →';

    a.appendChild(top);
    a.appendChild(h);
    a.appendChild(note);
    a.appendChild(go);
    return a;
  }

  function setEmpty(text) {
    cardsEl.textContent = '';
    var empty = document.createElement('div');
    empty.className = 'cat-empty';
    empty.innerHTML = '<em>' + text + '</em>';
    cardsEl.appendChild(empty);
  }

  function render(list, query) {
    cardsEl.textContent = '';
    if (!list.length) {
      if (!posts.length) setEmpty('还没有发布文章');
      else if (query) setEmpty('未找到匹配「' + query + '」的文章');
      else setEmpty('空空如也');
      return;
    }
    list.forEach(function (post) {
      cardsEl.appendChild(makeCard(post));
    });
  }

  function matches(post, terms) {
    var hay = (post.title + '\n' + (post.text || '')).toLowerCase();
    return terms.every(function (t) { return hay.indexOf(t) !== -1; });
  }

  function applySearch() {
    var raw = searchEl.value.trim();
    countEl.textContent = '';
    if (!raw) {
      render(posts, '');
      countEl.textContent = '共 ' + posts.length + ' 篇';
      return;
    }
    var terms = raw.toLowerCase().split(/\s+/).filter(Boolean);
    var hit = posts.filter(function (p) { return matches(p, terms); });
    render(hit, raw);
    countEl.textContent = '命中 ' + hit.length + ' 篇 · 共 ' + posts.length + ' 篇';
  }

  /* ---------------- 初始化 ---------------- */
  fetch('/api/posts?category=' + encodeURIComponent(CAT), { cache: 'no-store' })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      posts = Array.isArray(data) ? data : [];
      applySearch();
    })
    .catch(function () {
      setEmpty('加载失败：请确认站点已部署 Functions（/api/posts）');
      countEl.textContent = '';
    });

  searchEl.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(applySearch, 160);
  });
})();

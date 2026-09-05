/* =========================================================
   guestbook.js —— 纯前端留言板（localStorage，无后端）
   昵称   → localStorage["guest_name"]
   留言   → localStorage["guestbook_messages"]（数组，最多 50 条，超限删最早）
   页面加载时按时间倒序展示；渲染一律用 textContent，防注入。
   ========================================================= */
(function () {
  'use strict';

  var NAME_KEY = 'guest_name';
  var MSG_KEY = 'guestbook_messages';
  var MAX_MSGS = 50;
  var MAX_LEN = 500;

  var ADJECTIVES = ['清醒的', '沉默的', '失眠的', '梦游的', '温柔的', '迟到的', '远方的', '未名的', '打盹的', '追风的'];
  var NOUNS = ['雷东宝', '奥德修斯', '狐狸', '夜莺', '白鹭', '鲸鱼', '麋鹿', '萤火虫', '信天翁', '守夜人', '牧星人', '白日梦'];

  var nameEl = document.getElementById('gbName');
  var renameEl = document.getElementById('gbRename');
  var formEl = document.getElementById('gbForm');
  var textEl = document.getElementById('gbText');
  var countEl = document.getElementById('gbCount');
  var errorEl = document.getElementById('gbError');
  var listEl = document.getElementById('gbList');
  if (!nameEl || !renameEl || !formEl || !textEl || !countEl || !errorEl || !listEl) return;

  /* ---------------- localStorage 小工具（隐私模式失败时静默降级） ---------------- */
  function read(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, val); } catch (e) { /* ignore */ }
  }

  /* ---------------- 昵称：随机生成 + 持久化 ---------------- */
  function randItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function makeName(avoid) {
    var n;
    for (var i = 0; i < 6; i += 1) {
      n = randItem(ADJECTIVES) + randItem(NOUNS);
      if (n !== avoid) return n;
    }
    return n;
  }

  function ensureName() {
    var n = String(read(NAME_KEY, '') || '').trim();
    if (!n) {
      n = makeName('');
      write(NAME_KEY, n);
    }
    nameEl.value = n;
  }

  renameEl.addEventListener('click', function () {
    var n = makeName(nameEl.value);
    write(NAME_KEY, n);
    nameEl.value = n;
    textEl.focus();
  });

  /* ---------------- 留言读取 / 存储 ---------------- */
  function readMsgs() {
    var arr;
    try {
      arr = JSON.parse(read(MSG_KEY, '[]'));
    } catch (e) { arr = []; }
    if (!Array.isArray(arr)) return [];
    return arr.filter(function (m) {
      return m && typeof m === 'object'
        && typeof m.name === 'string' && typeof m.text === 'string'
        && typeof m.ts === 'number';
    });
  }
  function saveMsgs(msgs) {
    write(MSG_KEY, JSON.stringify(msgs));
  }

  /* ---------------- 相对时间 ---------------- */
  function relTime(ts) {
    var diff = Date.now() - ts;
    var MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;
    if (diff < MIN) return '刚刚';
    if (diff < HOUR) return Math.max(1, Math.floor(diff / MIN)) + ' 分钟前';
    if (diff < DAY) return Math.floor(diff / HOUR) + ' 小时前';
    if (diff < 30 * DAY) return Math.floor(diff / DAY) + ' 天前';
    var d = new Date(ts);
    function p(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
      + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* ---------------- 渲染（倒序，最新在前） ---------------- */
  function renderMsgs(msgs) {
    listEl.textContent = '';
    if (!msgs.length) {
      var empty = document.createElement('p');
      empty.className = 'gb-empty';
      empty.textContent = '还没有留言，来写下第一句吧';
      listEl.appendChild(empty);
      return;
    }
    var sorted = msgs.slice().sort(function (a, b) { return b.ts - a.ts; });
    sorted.forEach(function (m) {
      var item = document.createElement('div');
      item.className = 'gb-item';

      var head = document.createElement('div');
      head.className = 'gb-item-head';
      var who = document.createElement('span');
      who.className = 'gb-item-name';
      who.textContent = m.name;
      var when = document.createElement('span');
      when.className = 'gb-item-time';
      when.textContent = relTime(m.ts);
      head.appendChild(who);
      head.appendChild(when);

      var body = document.createElement('p');
      body.className = 'gb-item-text';
      body.textContent = m.text;

      item.appendChild(head);
      item.appendChild(body);
      listEl.appendChild(item);
    });
  }

  /* ---------------- 字数统计 ---------------- */
  function updateCount() {
    countEl.textContent = String(textEl.value.length);
  }
  textEl.addEventListener('input', updateCount);

  /* ---------------- 提交 ---------------- */
  formEl.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = textEl.value.replace(/^\s+|\s+$/g, '');
    if (!text) {
      errorEl.textContent = '说点什么再提交吧';
      textEl.focus();
      return;
    }
    if (text.length > MAX_LEN) {
      errorEl.textContent = '留言最长 ' + MAX_LEN + ' 字';
      return;
    }
    errorEl.textContent = '';

    var msgs = readMsgs();
    msgs.push({
      name: nameEl.value || '未名的人',
      text: text,
      ts: Date.now(),
    });
    // 最多保留 50 条：超出删除最早的
    while (msgs.length > MAX_MSGS) msgs.shift();
    saveMsgs(msgs);

    textEl.value = '';
    updateCount();
    renderMsgs(msgs);
    textEl.focus();
  });

  /* ---------------- 初始化 ---------------- */
  ensureName();
  updateCount();
  renderMsgs(readMsgs());
})();

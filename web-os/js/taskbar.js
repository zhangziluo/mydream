/* =========================================================
   taskbar.js —— 开始菜单 + 任务栏窗口按钮 + 系统托盘时钟
   ========================================================= */
(function () {
  'use strict';

  var startBtn, menu, search, groupsEl, taskBox, trayClock;
  var PREF = 'widgets'; // {clock, weather, todo}

  function prefs() {
    var p = OS.store.get(PREF, {});
    return {
      clock: p.clock !== false,
      weather: p.weather !== false,
      todo: p.todo !== false
    };
  }
  function setPref(id, v) {
    var p = OS.store.get(PREF, {});
    p[id] = v;
    OS.store.set(PREF, p);
  }

  /* ---------- 开始菜单 ---------- */
  function setMenu(open) {
    menu.hidden = !open;
    startBtn.classList.toggle('on', open);
    if (open) {
      search.value = '';
      renderMenu('');
      search.focus();
    }
  }
  function toggleMenu() { setMenu(menu.hidden); }

  var CAT_TITLES = { 系统: '系统', 工具: '工具', 阅读: '阅读', 媒体: '媒体', 创作: '创作' };
  function catTitle(cat) { return CAT_TITLES[cat] || cat; }

  function renderMenu(query) {
    var q = (query || '').trim().toLowerCase();
    groupsEl.innerHTML = '';
    var shown = 0;

    OS.apps.cats.forEach(function (cat) {
      var list = OS.apps.list.filter(function (a) { return a.cat === cat; });
      var hits = q
        ? list.filter(function (a) {
            return (a.name + ' ' + (a.note || '')).toLowerCase().indexOf(q) >= 0;
          })
        : list;
      if (!hits.length) return;

      var sec = document.createElement('section');
      sec.className = 'group';
      var h = document.createElement('h3');
      h.className = 'group-title';
      h.textContent = catTitle(cat);
      sec.appendChild(h);

      hits.forEach(function (app) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'apptile';
        var g = document.createElement('span'); g.className = 'glyph'; g.textContent = app.glyph;
        var meta = document.createElement('span'); meta.className = 'meta';
        var nm = document.createElement('div'); nm.className = 'name'; nm.textContent = app.name;
        var dc = document.createElement('div'); dc.className = 'desc'; dc.textContent = app.note || '';
        meta.appendChild(nm); meta.appendChild(dc);
        b.appendChild(g); b.appendChild(meta);
        b.addEventListener('click', function () {
          OS.wm.open(app.id);
          setMenu(false);
        });
        sec.appendChild(b);
        shown++;
      });
      groupsEl.appendChild(sec);
    });

    if (!shown) {
      var empty = document.createElement('div');
      empty.className = 'menu-empty';
      empty.textContent = '没有匹配的应用';
      groupsEl.appendChild(empty);
    }
  }
  /* ---------- 任务栏窗口按钮 ---------- */
  function renderTasks(list) {
    taskBox.innerHTML = '';
    list.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tbtn' + (t.active ? ' on' : '') + (t.min ? ' mini' : '');
      b.title = t.name;
      var g = document.createElement('span'); g.className = 'glyph'; g.textContent = t.glyph;
      var tx = document.createElement('span'); tx.className = 't'; tx.textContent = t.name;
      b.appendChild(g); b.appendChild(tx);
      b.addEventListener('click', function () { OS.wm.taskClick(t.key); });
      taskBox.appendChild(b);
    });
  }

  /* ---------- 托盘时钟 ---------- */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function tick() {
    var d = new Date();
    var wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    trayClock.innerHTML = pad(d.getHours()) + ':' + pad(d.getMinutes())
      + '<small>' + (d.getMonth() + 1) + '月' + d.getDate() + '日 · 周' + wd + '</small>';
  }

  function syncWidgetChecks() {
    var p = prefs();
    menu.querySelectorAll('[data-widget]').forEach(function (inp) {
      inp.checked = !!p[inp.dataset.widget];
    });
  }

  function setInstallable(on) {
    document.getElementById('installBtn').hidden = !on;
    document.getElementById('trayInstall').hidden = !on;
  }

  function init() {
    startBtn = document.getElementById('startBtn');
    menu = document.getElementById('startMenu');
    search = document.getElementById('menuSearch');
    groupsEl = document.getElementById('menuGroups');
    taskBox = document.getElementById('taskButtons');
    trayClock = document.getElementById('trayClock');

    startBtn.addEventListener('click', function (ev) { ev.stopPropagation(); toggleMenu(); });
    search.addEventListener('input', function () { renderMenu(search.value); });
    search.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') setMenu(false);
    });

    document.addEventListener('pointerdown', function (ev) {
      if (menu.hidden) return;
      if (!menu.contains(ev.target) && !startBtn.contains(ev.target)) setMenu(false);
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') setMenu(false);
    });

    document.getElementById('resetIconsBtn').addEventListener('click', function () {
      setMenu(false);
      OS.desktop.reset();
    });

    menu.querySelectorAll('[data-widget]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        setPref(inp.dataset.widget, inp.checked);
        OS.widgets.setVisible(inp.dataset.widget, inp.checked);
      });
    });
    syncWidgetChecks();

    var installs = [document.getElementById('installBtn'), document.getElementById('trayInstall')];
    installs.forEach(function (b) {
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (OS.install && typeof OS.install.prompt === 'function') OS.install.prompt();
      });
    });

    OS.bus.on('windows', renderTasks);
    tick();
    setInterval(tick, 30000);
  }

  OS.taskbar = {
    init: init,
    setMenu: setMenu,
    setInstallable: setInstallable,
    setWidgetChecked: function (id, v) {
      var inp = menu && menu.querySelector('[data-widget="' + id + '"]');
      if (inp) inp.checked = v;
    },
    updateWidget: function (id, v) { setPref(id, v); syncWidgetChecks(); },
    prefs: prefs
  };
})();


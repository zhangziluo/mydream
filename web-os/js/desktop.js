/* =========================================================
   desktop.js —— 桌面图标
   图标绝对定位 + 拖拽（自动吸附网格）；位置存 os.iconPos。
   单击打开应用；「复位图标」清除记录回到默认排布。
   ========================================================= */
(function () {
  'use strict';

  var desktop = null;
  var layer = null;

  var PAD_X = 14, PAD_Y = 14;
  var CELL_W = 98, CELL_H = 104;
  var DRAG_HINT = 6; // px：超过才算拖动（区分单击）

  var sel = null; // 当前选中的 appId

  function grid() {
    var avail = Math.max(1, desktop.clientHeight - PAD_Y * 2);
    var rows = Math.max(1, Math.floor(avail / CELL_H));
    var cols = Math.max(1, Math.ceil(OS.apps.pinned().length / rows));
    return { rows: rows, cols: cols, colW: Math.max(CELL_W, (desktop.clientWidth - PAD_X * 2) / Math.max(1, cols)) };
  }

  function nextSlot(index, cols) {
    var col = Math.floor(index / cols.rows);
    var row = index % cols.rows;
    return {
      x: PAD_X + col * cols.colW,
      y: PAD_Y + row * CELL_H
    };
  }

  function snap(x, y, cols) {
    var sx = Math.round((x - PAD_X) / cols.colW) * cols.colW + PAD_X;
    var sy = Math.round((y - PAD_Y) / CELL_H) * CELL_H + PAD_Y;
    sx = Math.min(Math.max(sx, 4), Math.max(4, desktop.clientWidth - 92));
    sy = Math.min(Math.max(sy, 4), Math.max(4, desktop.clientHeight - 110));
    return { x: sx, y: sy };
  }

  function addIcon(app, p, cols) {
    var icon = document.createElement('div');
    icon.className = 'app-icon';
    icon.dataset.id = app.id;
    icon.title = app.note || app.name;
    icon.style.left = p.x + 'px';
    icon.style.top = p.y + 'px';
    icon.style.touchAction = 'none';

    var ico = document.createElement('div');
    ico.className = 'ico';
    ico.textContent = app.glyph;
    var lbl = document.createElement('div');
    lbl.className = 'lbl';
    lbl.textContent = app.name;
    icon.appendChild(ico);
    icon.appendChild(lbl);

    attachDrag(icon, app, cols);
    layer.appendChild(icon);
  }

  function attachDrag(icon, app, cols) {
    var dragging = false;
    var moved = false;
    var offX = 0, offY = 0, startX = 0, startY = 0;

    icon.addEventListener('pointerdown', function (ev) {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      var r = desktop.getBoundingClientRect();
      startX = ev.clientX; startY = ev.clientY;
      offX = startX - r.left - (icon.offsetLeft || 0);
      offY = startY - r.top - (icon.offsetTop || 0);
      moved = false;
      dragging = true;
      try { icon.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
    });

    icon.addEventListener('pointermove', function (ev) {
      if (!dragging) return;
      if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) < DRAG_HINT) return;
      moved = true;
      icon.classList.add('dragging');
      var r = desktop.getBoundingClientRect();
      var nx = ev.clientX - r.left - offX;
      var ny = ev.clientY - r.top - offY;
      nx = Math.min(Math.max(nx, 4), Math.max(4, desktop.clientWidth - 92));
      ny = Math.min(Math.max(ny, 4), Math.max(4, desktop.clientHeight - 110));
      icon.style.left = nx + 'px';
      icon.style.top = ny + 'px';
    });

    function stop(ev) {
      if (!dragging) return;
      dragging = false;
      icon.classList.remove('dragging');
      try { icon.releasePointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
      if (moved) {
        var cols = grid();
        var sp = snap(parseFloat(icon.style.left) || 0, parseFloat(icon.style.top) || 0, cols);
        icon.style.left = sp.x + 'px';
        icon.style.top = sp.y + 'px';
        persist(app.id, sp);
      }
    }
    icon.addEventListener('pointerup', stop);
    icon.addEventListener('pointercancel', stop);

    icon.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (moved) { moved = false; return; }   // 拖完不触发打开
      select(app.id);
      OS.wm.open(app.id);
    });
  }

  function persist(appId, p) {
    var all = OS.store.get('iconPos', {});
    all[appId] = p;
    OS.store.set('iconPos', all);
  }

  function select(appId) {
    sel = appId;
    layer.querySelectorAll('.app-icon').forEach(function (ic) {
      ic.classList.toggle('sel', ic.dataset.id === appId);
    });
  }
  function deselect() {
    sel = null;
    layer.querySelectorAll('.app-icon').forEach(function (ic) {
      ic.classList.remove('sel');
    });
  }

  function build() {
    layer.innerHTML = '';
    var cols = grid();
    var pos = OS.store.get('iconPos', {});
    var idx = 0;
    OS.apps.pinned().forEach(function (app) {
      var p = pos[app.id];
      if (!p) {
        p = nextSlot(idx, cols);
        pos[app.id] = p;
      }
      addIcon(app, p, cols);
      idx++;
    });
    OS.store.set('iconPos', pos);
  }

  OS.desktop = {
    init: function () {
      desktop = document.getElementById('desktop');
      layer = document.getElementById('iconLayer');
    },
    build: build,
    reset: function () {
      OS.store.del('iconPos');
      build();
      OS.toast('桌面图标已复位');
    },
    deselect: deselect,
    select: select
  };
})();

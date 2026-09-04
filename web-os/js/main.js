/* =========================================================
   main.js —— 启动装配
   顺序：星点壁纸 → 桌面图标 → 任务栏 → 挂件 →
         PWA（Service Worker + beforeinstallprompt 安装）
   ========================================================= */
(function () {
  'use strict';

  /* ---------- 星点（随机生成，复用 Mydream 的闪烁节奏） ---------- */
  function buildStars() {
    var host = document.getElementById('stars');
    if (!host) return;
    var count = Math.min(140, Math.max(40, Math.floor(window.innerWidth * window.innerHeight / 22000)));
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < count; i++) {
      var s = document.createElement('i');
      var size = (Math.random() * 1.7 + 1).toFixed(2);
      s.style.left = (Math.random() * 100).toFixed(2) + '%';
      s.style.top = (Math.random() * 68).toFixed(2) + '%';   // 上半夜空更密
      s.style.width = size + 'px';
      s.style.height = size + 'px';
      s.style.opacity = (Math.random() * 0.6 + 0.25).toFixed(2);
      if (!reduced) {
        s.style.animationDelay = (-Math.random() * 4).toFixed(2) + 's';
        s.style.animationDuration = (Math.random() * 2.2 + 2.4).toFixed(2) + 's';
      } else {
        s.style.animation = 'none';
      }
      frag.appendChild(s);
    }
    host.appendChild(frag);
  }

  /* ---------- PWA 安装 ---------- */
  function initInstall() {
    var deferred = null;

    function hide() {
      if (OS.taskbar && OS.taskbar.setInstallable) OS.taskbar.setInstallable(false);
    }
    window.addEventListener('beforeinstallprompt', function (ev) {
      ev.preventDefault();
      deferred = ev;
      if (OS.taskbar && OS.taskbar.setInstallable) OS.taskbar.setInstallable(true);
    });
    window.addEventListener('appinstalled', function () {
      hide();
      OS.toast('已安装，可从主屏幕打开');
    });

    OS.install = {
      prompt: function () {
        if (!deferred) {
          OS.toast('当前浏览器暂不支持安装，可用地址栏手动添加');
          return;
        }
        deferred.prompt();
        deferred.userChoice.then(function (choice) {
          if (choice && choice.outcome === 'accepted') hide();
          deferred = null;
        }).catch(function () { deferred = null; });
      }
    };
  }

  /* ---------- Service Worker ---------- */
  function initSW() {
    if (!('serviceWorker' in navigator)) return;
    if (!/^https?:$/.test(location.protocol)) return; // file:// 不注册
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(function () {
      /* 注册失败静默（如本地 http 直开） */
    });
  }

  function boot() {
    buildStars();
    initInstall();
    initSW();

    OS.wm.init();
    OS.desktop.init();
    OS.taskbar.init();
    OS.desktop.build();
    OS.widgets.init();

    /* 点桌面空白处：取消图标选中 */
    document.getElementById('desktop').addEventListener('pointerdown', function (ev) {
      if (ev.target === document.getElementById('desktop')) OS.desktop.deselect();
    });
  }

  boot();
})();

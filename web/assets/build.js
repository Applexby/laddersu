/* Laddersu - la web "se arma sola": agentes (cursores) recuadran cada pieza y la colocan.
   Lo de la primera pantalla se arma al entrar; lo de abajo, al llegar con el scroll.
   Saltar lo muestra todo; Repetir lo vuelve a armar. Sin JavaScript o con "reducir movimiento" no se hace. */
(function () {
  'use strict';
  var root = document.documentElement;
  if (!root.classList.contains('bld')) { return; }
  window.__bldOK = true;

  var SEL = '.top .logo, .top nav a, .top .pill, .hero h1, .hero .lede, .hero .cta > *, .phone, .block .head > *, .tourList > button, .win, .flow > li, .style, .feat, .instGrid .steps > li, .appWin, .note, .final .wrap > *';
  var COLORS = ['#ff6b6b', '#ffd166', '#06d6a0', '#4d7cff', '#c77dff', '#ff9f1c'];
  var NAMES = ['Ana', 'Leo', 'Mia', 'Teo', 'Sol', 'Iker'];
  var mobile = window.matchMedia('(max-width: 700px)').matches;
  var NA = mobile ? 4 : 6;

  var layer = document.createElement('div'); layer.className = 'bLayer'; layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  function sizeLayer() { layer.style.height = document.documentElement.scrollHeight + 'px'; }
  sizeLayer();

  // HUD
  var hud = document.createElement('div'); hud.className = 'hud'; hud.setAttribute('role', 'status');
  var dots = '<span class="dots">' + COLORS.slice(0, NA).map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('') + '</span>';
  hud.innerHTML = dots + '<span class="txt"></span><span class="prog"><i></i></span><button type="button">Saltar</button>';
  document.body.appendChild(hud);
  var htxt = hud.querySelector('.txt'), hbar = hud.querySelector('.prog i'), hbtn = hud.querySelector('button');

  var arrow = function (c) { return '<svg viewBox="0 0 18 18"><path d="M2 1.5 15.5 8 9.2 9.6 6.6 16z" fill="' + c + '" stroke="#111" stroke-width="1.2" stroke-linejoin="round"/></svg>'; };
  var agents = [], i;
  for (i = 0; i < NA; i++) {
    var a = document.createElement('div'); a.className = 'agent';
    a.innerHTML = arrow(COLORS[i]) + '<span style="background:' + COLORS[i] + '">' + NAMES[i] + '</span>';
    layer.appendChild(a);
    var x0 = window.innerWidth * (0.3 + Math.random() * 0.4), y0 = window.scrollY + window.innerHeight * (0.35 + Math.random() * 0.3);
    a.style.transform = 'translate(' + x0 + 'px,' + y0 + 'px)';
    agents.push({ el: a, busy: false, c: COLORS[i] });
  }

  var all = [].slice.call(document.querySelectorAll(SEL));
  var total = all.length, done = 0, queue = [], started = performance.now(), finished = false, running = true;

  function label(el) {
    var t = el.tagName.toLowerCase();
    if (/^h[1-3]$/.test(t)) { return t + ' · ' + Math.round(parseFloat(getComputedStyle(el).fontSize)) + 'px'; }
    if (el.classList.contains('phone')) { return 'iphone · demo'; }
    if (el.classList.contains('win')) { return 'panel · captura'; }
    if (t === 'a' || t === 'button') { return t === 'a' && el.classList.contains('btn') ? 'button' : t; }
    if (t === 'p') { return 'texto'; }
    return el.className.split(' ')[0] || t;
  }
  // texto que se "decodifica" (solo elementos con texto plano y cortos)
  var GLY = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#%&*';
  function scramble(el) {
    if (el.children.length || !el.textContent || el.textContent.length > 70) { return; }
    var txt = el.textContent, n = 0, steps = 10;
    var iv = setInterval(function () {
      n++;
      var keep = Math.floor(txt.length * n / steps), out = txt.slice(0, keep), k;
      for (k = keep; k < txt.length; k++) { out += txt[k] === ' ' ? ' ' : GLY[(Math.random() * GLY.length) | 0]; }
      el.textContent = out;
      if (n >= steps) { clearInterval(iv); el.textContent = txt; }
    }, 34);
  }
  function reveal(el) {
    if (el.classList.contains('built')) { return; }
    el.classList.add('built');
    if (el.matches('.hero h1') && window.ladderTitle) { window.ladderTitle(); }
    else if (el.matches('h2, h3, .tourList b')) { scramble(el); }
    done++; hudUpdate();
  }
  var hideT = 0, idleShown = false;
  function busyCount() { return agents.filter(function (a) { return a.busy; }).length; }
  function hudUpdate() {
    var busy = busyCount();
    hbar.style.width = (100 * done / total).toFixed(1) + '%';
    if (done >= total) { complete(); return; }
    if (busy || queue.length) {
      clearTimeout(hideT); idleShown = false; hud.classList.remove('gone'); hbtn.textContent = 'Saltar';
      htxt.innerHTML = (mobile ? 'Armando · ' : 'Armando la página · <b>' + Math.max(busy, 1) + '</b> agentes · ') + done + '/' + total + ' capas';
    } else if (!idleShown) {
      // lo que se ve ya esta armado: el resto se arma al bajar
      idleShown = true;
      htxt.innerHTML = 'Pantalla armada en ' + secs() + ' s' + (mobile ? '' : ' · baja para ver el resto');
      hbtn.textContent = 'Ver todo';
      hideT = setTimeout(function () { hud.classList.add('gone'); }, 3500);
    }
  }
  function secs() { return ((performance.now() - started) / 1000).toFixed(1).replace('.', ','); }
  function complete() {
    if (finished) { return; }
    finished = true;
    agents.forEach(function (a) { a.el.style.opacity = '0'; a.busy = false; });
    root.classList.remove('bld');
    clearTimeout(hideT); hud.classList.remove('gone');
    htxt.innerHTML = 'Armada por <b>' + NA + ' agentes</b> en ' + secs() + ' s';
    hbar.style.width = '100%';
    hbtn.textContent = 'Repetir';
    hideT = setTimeout(function () { hud.classList.add('gone'); }, 5000);
  }

  function work(a) {
    if (!running) { return; }
    var el = queue.shift();
    if (!el) { a.busy = false; a.el.style.opacity = '.0'; hudUpdate(); return; }
    if (el.classList.contains('built')) { work(a); return; }
    a.busy = true;
    var r = el.getBoundingClientRect(), x = r.left + window.scrollX, y = r.top + window.scrollY;
    a.el.style.opacity = '1';
    a.el.style.transform = 'translate(' + (x - 4) + 'px,' + (y - 4) + 'px)';
    setTimeout(function () {
      if (!running) { return; }
      var box = document.createElement('div'); box.className = 'bBox' + (Math.random() < 0.18 ? ' red' : '');
      box.style.left = x + 'px'; box.style.top = y + 'px';
      box.innerHTML = '<b></b>'; box.querySelector('b').textContent = label(el);
      layer.appendChild(box);
      a.el.style.transform = 'translate(' + (x + r.width - 6) + 'px,' + (y + r.height - 6) + 'px)';
      requestAnimationFrame(function () { box.style.width = r.width + 'px'; box.style.height = r.height + 'px'; });
      setTimeout(function () {
        reveal(el);
        setTimeout(function () { box.classList.add('out'); setTimeout(function () { box.remove(); }, 320); }, 260);
        work(a);
      }, 360);
    }, 420);
  }
  function enqueue(list) {
    list.forEach(function (el) { if (queue.indexOf(el) < 0 && !el.classList.contains('built')) { queue.push(el); } });
    queue.sort(function (p, q) { var a = p.getBoundingClientRect(), b = q.getBoundingClientRect(); return (a.top - b.top) || (a.left - b.left); });
    agents.forEach(function (a) { if (!a.busy) { work(a); } });
  }

  // primera pantalla al entrar; lo demas al llegar con el scroll
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    var vis = es.filter(function (e) { return e.isIntersecting; }).map(function (e) { io.unobserve(e.target); return e.target; });
    if (vis.length) { sizeLayer(); enqueue(vis); }
  }, { rootMargin: '0px 0px -8% 0px' }) : null;
  if (!io) { all.forEach(reveal); complete(); return; }
  all.forEach(function (el) { io.observe(el); });
  hudUpdate();

  function skip() {
    running = false; queue = [];
    layer.querySelectorAll('.bBox').forEach(function (b) { b.remove(); });
    all.forEach(function (el) { if (!el.classList.contains('built')) { el.classList.add('built'); done++; } });
    if (window.ladderTitle) { window.ladderTitle(); }
    complete();
  }
  function replay() {
    hud.classList.remove('gone');
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    all.forEach(function (el) { el.classList.remove('built'); io.unobserve(el); });
    done = 0; finished = false; running = true; started = performance.now(); queue = []; idleShown = false;
    if (window.ladderTitleReset) { window.ladderTitleReset(); }
    root.classList.add('bld'); hbtn.textContent = 'Saltar';
    agents.forEach(function (a) { a.busy = false; a.el.style.opacity = '1'; });
    setTimeout(function () { sizeLayer(); all.forEach(function (el) { io.observe(el); }); hudUpdate(); }, 60);
  }
  hbtn.addEventListener('click', function () { if (finished) { replay(); } else { skip(); } });
  // tambien desde el pie de pagina
  var rp = document.getElementById('replayBuild');
  if (rp) { rp.hidden = false; rp.addEventListener('click', function () { if (!finished) { skip(); } replay(); }); }
  window.addEventListener('resize', sizeLayer);
})();

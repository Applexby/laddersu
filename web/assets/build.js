/* Laddersu - la web "se arma sola": agentes (cursores) con guias recuadran cada pieza y la colocan.
   Lo de la primera pantalla se arma al entrar; lo de abajo, al llegar con el scroll.
   "Ver todo" lo muestra todo; "Repetir" lo vuelve a armar. Sin JavaScript o con "reducir movimiento" no se hace. */
(function () {
  'use strict';
  var root = document.documentElement;
  if (!root.classList.contains('bld')) { return; }
  window.__bldOK = true;

  var SEL = '.top .logo, .top nav a, .top .pill, .hero h1, .hero .lede, .hero .cta > *, .phone, .block .head > *, .tourList > button, .win, .flow > li, .style, .feat, .instGrid .steps > li, .appWin, .note, .final .wrap > *';
  var COLORS = ['#ff6b6b', '#ffd166', '#06d6a0', '#4d7cff', '#c77dff', '#ff9f1c', '#2ec4f1', '#f15bb5'];
  var NAMES = ['Ana', 'Leo', 'Mia', 'Teo', 'Sol', 'Iker', 'Noa', 'Gael'];
  var mobile = window.matchMedia('(max-width: 700px)').matches;
  var NA = mobile ? 4 : 8;
  var rnd = function (a, b) { return a + Math.random() * (b - a); };

  var layer = document.createElement('div'); layer.className = 'bLayer'; layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  function sizeLayer() { layer.style.height = document.documentElement.scrollHeight + 'px'; }
  sizeLayer();

  // HUD
  var hud = document.createElement('div'); hud.className = 'hud'; hud.setAttribute('role', 'status');
  var dots = '<span class="dots">' + COLORS.slice(0, NA).map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('') + '</span>';
  hud.innerHTML = dots + '<span class="txt"></span><span class="prog"><i></i></span><button type="button">Ver todo</button>';
  document.body.appendChild(hud);
  var htxt = hud.querySelector('.txt'), hbar = hud.querySelector('.prog i'), hbtn = hud.querySelector('button');

  // ---------- agentes: se mueven en curvas, con velocidades distintas y algo de temblor ----------
  var arrow = function (c) { return '<svg viewBox="0 0 18 18"><path d="M2 1.5 15.5 8 9.2 9.6 6.6 16z" fill="' + c + '" stroke="#111" stroke-width="1.2" stroke-linejoin="round"/></svg>'; };
  var agents = [], i;
  for (i = 0; i < NA; i++) {
    var el = document.createElement('div'); el.className = 'agent';
    el.innerHTML = arrow(COLORS[i]) + '<span style="background:' + COLORS[i] + '">' + NAMES[i] + '</span>';
    layer.appendChild(el);
    var ag = { el: el, busy: false, c: COLORS[i], x: window.scrollX + rnd(0.15, 0.85) * window.innerWidth, y: window.scrollY + rnd(0.2, 0.9) * window.innerHeight, anim: null };
    place(ag);
    agents.push(ag);
  }
  function place(a) { a.el.style.transform = 'translate(' + a.x.toFixed(1) + 'px,' + a.y.toFixed(1) + 'px)'; }
  function moveTo(a, x, y, dur, cb) {
    if (a.anim) { cancelAnimationFrame(a.anim); }
    var x0 = a.x, y0 = a.y, dx = x - x0, dy = y - y0, len = Math.sqrt(dx * dx + dy * dy) || 1;
    // punto de control desplazado a un lado: trayectoria curva distinta cada vez
    var bend = rnd(-0.45, 0.45) * Math.min(len, 380);
    var cx = x0 + dx * rnd(0.3, 0.7) - dy / len * bend, cy = y0 + dy * rnd(0.3, 0.7) + dx / len * bend;
    var t0 = performance.now(), jit = rnd(0.6, 2.2);
    function step(now) {
      var p = Math.min(1, (now - t0) / dur), e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2, u = 1 - e;
      a.x = u * u * x0 + 2 * u * e * cx + e * e * x + (p < 1 ? Math.sin(now / 37 + len) * jit : 0);
      a.y = u * u * y0 + 2 * u * e * cy + e * e * y + (p < 1 ? Math.cos(now / 43 + len) * jit : 0);
      place(a);
      if (p < 1) { a.anim = requestAnimationFrame(step); } else { a.anim = null; if (cb) { cb(); } }
    }
    a.anim = requestAnimationFrame(step);
  }
  // los que no tienen trabajo deambulan un poco
  function wander(a) {
    if (a.busy || !running || a.el.style.opacity === '0') { return; }
    moveTo(a, a.x + rnd(-140, 140), Math.max(window.scrollY + 40, a.y + rnd(-90, 90)), rnd(700, 1400), function () {
      setTimeout(function () { wander(a); }, rnd(150, 900));
    });
  }

  var all = [].slice.call(document.querySelectorAll(SEL));
  var total = all.length, done = 0, queue = [], started = performance.now(), finished = false, running = true;

  function label(el, w, h) {
    var t = el.tagName.toLowerCase(), n;
    if (/^h[1-3]$/.test(t)) { n = t; }
    else if (el.classList.contains('phone')) { n = 'iphone'; }
    else if (el.classList.contains('win')) { n = 'panel'; }
    else if (t === 'a' || t === 'button') { n = 'button'; }
    else if (t === 'p') { n = 'texto'; }
    else { n = el.className.split(' ')[0] || t; }
    return n + ' · ' + Math.round(w) + '×' + Math.round(h);
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
  function secs() { return ((performance.now() - started) / 1000).toFixed(1).replace('.', ','); }
  function hudUpdate() {
    var busy = busyCount();
    hbar.style.width = (100 * done / total).toFixed(1) + '%';
    if (done >= total) { complete(); return; }
    if (busy || queue.length) {
      clearTimeout(hideT); idleShown = false; hud.classList.remove('gone'); hbtn.textContent = 'Ver todo';
      htxt.innerHTML = (mobile ? 'Armando · ' : 'Armando la página · <b>' + Math.max(busy, 1) + '</b> agentes · ') + done + '/' + total + ' capas';
    } else if (!idleShown) {
      idleShown = true;
      htxt.innerHTML = 'Pantalla armada en ' + secs() + ' s' + (mobile ? '' : ' · baja para ver el resto');
      hideT = setTimeout(function () { hud.classList.add('gone'); }, 3500);
    }
  }
  function complete() {
    if (finished) { return; }
    finished = true; running = false;
    agents.forEach(function (a) { a.el.style.opacity = '0'; a.busy = false; });
    root.classList.remove('bld');
    clearTimeout(hideT); hud.classList.remove('gone');
    htxt.innerHTML = 'Armada por <b>' + NA + ' agentes</b> en ' + secs() + ' s';
    hbar.style.width = '100%';
    hbtn.textContent = 'Repetir';
    hideT = setTimeout(function () { hud.classList.add('gone'); }, 5000);
  }

  // guias que cruzan la pantalla en los bordes de la pieza
  function guides(x, y, w, h, red) {
    var g = [['h', y], ['h', y + h], ['v', x], ['v', x + w]], out = [];
    g.forEach(function (d, k) {
      if (Math.random() < 0.35 && k > 1) { return; }
      var l = document.createElement('i'); l.className = 'bGuide ' + d[0] + (red && k === 2 ? ' red' : '');
      if (d[0] === 'h') { l.style.top = d[1] + 'px'; } else { l.style.left = d[1] + 'px'; }
      layer.appendChild(l); out.push(l);
      requestAnimationFrame(function () { l.classList.add('in'); });
    });
    return out;
  }

  function nextTarget() {
    if (!queue.length) { return null; }
    // no siempre en orden: cualquiera de los primeros que esten a la vista
    var k = Math.floor(Math.random() * Math.min(queue.length, mobile ? 2 : 4));
    return queue.splice(k, 1)[0];
  }
  function work(a) {
    if (!running) { return; }
    var el = nextTarget();
    if (!el) {
      // sin trabajo: deambula un momento y se oculta hasta que haya algo nuevo que armar
      a.busy = false; hudUpdate();
      setTimeout(function () { wander(a); }, rnd(100, 400));
      setTimeout(function () { if (!a.busy) { a.el.style.opacity = '0'; } }, rnd(700, 1500));
      return;
    }
    if (el.classList.contains('built')) { work(a); return; }
    a.busy = true; a.el.style.opacity = '1';
    var r = el.getBoundingClientRect(), x = r.left + window.scrollX, y = r.top + window.scrollY, w = r.width, h = r.height;
    // empieza por una esquina al azar
    var cx = Math.random() < 0.5 ? 0 : 1, cy = Math.random() < 0.7 ? 0 : 1;
    var sx = x + cx * w, sy = y + cy * h;
    moveTo(a, sx - 3, sy - 3, rnd(380, 820), function () {
      if (!running) { return; }
      var red = Math.random() < 0.16;
      var box = document.createElement('div'); box.className = 'bBox' + (red ? ' red' : '');
      box.style.left = sx + 'px'; box.style.top = sy + 'px';
      box.innerHTML = '<b></b>'; box.querySelector('b').textContent = label(el, w, h);
      layer.appendChild(box);
      var gl = guides(x, y, w, h, red);
      requestAnimationFrame(function () { box.style.left = x + 'px'; box.style.top = y + 'px'; box.style.width = w + 'px'; box.style.height = h + 'px'; });
      moveTo(a, x + (1 - cx) * w - 4, y + (1 - cy) * h - 4, rnd(300, 460), function () {
        var ring = document.createElement('i'); ring.className = 'bClick'; ring.style.left = a.x + 'px'; ring.style.top = a.y + 'px'; ring.style.borderColor = a.c;
        layer.appendChild(ring); setTimeout(function () { ring.remove(); }, 500);
        reveal(el);
        setTimeout(function () {
          box.classList.add('out'); gl.forEach(function (l) { l.classList.remove('in'); });
          setTimeout(function () { box.remove(); gl.forEach(function (l) { l.remove(); }); }, 380);
        }, rnd(160, 420));
        setTimeout(function () { work(a); }, rnd(40, 260));
      });
    });
  }
  function enqueue(list) {
    list.forEach(function (el) { if (queue.indexOf(el) < 0 && !el.classList.contains('built')) { queue.push(el); } });
    queue.sort(function (p, q) { var a = p.getBoundingClientRect(), b = q.getBoundingClientRect(); return (a.top - b.top) || (a.left - b.left); });
    // los agentes arrancan desfasados, no todos a la vez
    agents.forEach(function (a) { if (!a.busy) { a.busy = true; setTimeout(function () { a.busy = false; work(a); }, rnd(0, 420)); } });
    hudUpdate();
  }

  // primera pantalla al entrar; lo demas al llegar con el scroll
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    var vis = es.filter(function (e) { return e.isIntersecting; }).map(function (e) { io.unobserve(e.target); return e.target; });
    if (vis.length) { sizeLayer(); enqueue(vis); }
  }, { rootMargin: '0px 0px -8% 0px' }) : null;
  if (!io) { all.forEach(reveal); complete(); return; }
  all.forEach(function (el) { io.observe(el); });
  htxt.textContent = 'Armando la p\u00e1gina\u2026';

  function skip() {
    running = false; queue = [];
    layer.querySelectorAll('.bBox, .bGuide').forEach(function (b) { b.remove(); });
    all.forEach(function (el) { if (!el.classList.contains('built')) { el.classList.add('built'); done++; } });
    if (window.ladderTitle) { window.ladderTitle(); }
    complete();
  }
  function replay() {
    hud.classList.remove('gone');
    window.scrollTo(0, 0);
    all.forEach(function (el) { el.classList.remove('built'); io.unobserve(el); });
    done = 0; finished = false; running = true; started = performance.now(); queue = []; idleShown = false;
    if (window.ladderTitleReset) { window.ladderTitleReset(); }
    root.classList.add('bld'); hbtn.textContent = 'Ver todo';
    agents.forEach(function (a) { a.busy = false; a.el.style.opacity = '1'; a.x = rnd(0.15, 0.85) * window.innerWidth; a.y = rnd(0.2, 0.9) * window.innerHeight; place(a); });
    setTimeout(function () { sizeLayer(); all.forEach(function (el) { io.observe(el); }); hudUpdate(); }, 60);
  }
  hbtn.addEventListener('click', function () { if (finished) { replay(); } else { skip(); } });
  var rp = document.getElementById('replayBuild');
  if (rp) { rp.hidden = false; rp.addEventListener('click', function () { if (!finished) { skip(); } replay(); }); }
  window.addEventListener('resize', sizeLayer);
})();

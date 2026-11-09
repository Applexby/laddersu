/* Laddersu - titulo animado, demo del telefono, botones de descarga y novedades desde GitHub */
(function () {
  'use strict';
  var REPO = 'Applexby/laddersu';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // barra superior con borde al hacer scroll
  var top = document.getElementById('top');
  if (top) { var onS = function () { top.classList.toggle('scrolled', window.scrollY > 8); }; window.addEventListener('scroll', onS, { passive: true }); onS(); }

  // menu en movil
  var mb = document.querySelector('.menuBtn');
  if (mb && top) {
    var setMenu = function (open) { top.classList.toggle('open', open); mb.setAttribute('aria-expanded', open ? 'true' : 'false'); };
    mb.addEventListener('click', function () { setMenu(!top.classList.contains('open')); });
    top.querySelectorAll('nav a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { setMenu(false); } });
  }

  // ---------- titulo: entra palabra por palabra, como un subtitulo, y la caja pasa a "reels." ----------
  // Si la pagina se esta armando (assets/build.js), el titulo arranca cuando le toca.
  var ttl = document.querySelector('.ttl'), ttlDone = false;
  window.ladderTitle = function () {
    if (!ttl || ttlDone) { return; } ttlDone = true;
    if (reduce) { ttl.classList.add('done'); return; }
    var tws = ttl.querySelectorAll('.tw');
    [].forEach.call(tws, function (w, k) { w.style.animationDelay = (60 + k * 140) + 'ms'; });
    ttl.classList.add('play');
    setTimeout(function () { ttl.classList.add('done'); }, 60 + tws.length * 140 + 380);
  };
  window.ladderTitleReset = function () { if (ttl) { ttlDone = false; ttl.classList.remove('play', 'done'); } };
  if (ttl) { ttl.classList.add('wait'); setTimeout(function () { if (!document.documentElement.classList.contains('bld')) { window.ladderTitle(); } }, 0); }

  // ---------- el panel por dentro: capturas reales con puntos que explican cada parte ----------
  var TOUR = {
    texto: 'paso Texto, la transcripción', frases: 'paso Frases, estilos por tramo', diseno: 'paso Diseño con vista previa',
    generar: 'paso Generar con el resumen', biblioteca: 'Biblioteca de composiciones con grupos'
  };
  var tabs = [].slice.call(document.querySelectorAll('.tourList [data-shot]'));
  var timg = document.getElementById('tourImg'), tcap = document.getElementById('tourCap');
  if (tabs.length && timg) {
    var ti = 0, t0 = performance.now(), paused = false, DUR = 6500;
    // precarga
    tabs.forEach(function (b) { var im = new Image(); im.src = '/assets/ui/' + b.getAttribute('data-shot') + '-c.webp?v=7'; });
    var pick = function (i, user) {
      ti = (i + tabs.length) % tabs.length; t0 = performance.now();
      var b = tabs[ti], k = b.getAttribute('data-shot');
      tabs.forEach(function (x, j) { x.setAttribute('aria-selected', j === ti ? 'true' : 'false'); x.style.setProperty('--p', 0); });
      timg.classList.add('swap');
      setTimeout(function () {
        timg.src = '/assets/ui/' + k + '-c.webp?v=7'; timg.alt = 'Panel de Laddersu: ' + TOUR[k];
        timg.classList.remove('swap');
      }, user ? 140 : 220);
      if (tcap) { tcap.textContent = b.querySelector('span').textContent; }
      if (user && window.matchMedia('(max-width: 900px)').matches) { b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); }
    };
    tabs.forEach(function (b, i) {
      b.addEventListener('click', function () { pick(i, true); paused = true; });
      b.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); pick(ti + 1, true); tabs[ti].focus(); paused = true; }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); pick(ti - 1, true); tabs[ti].focus(); paused = true; }
      });
    });
    var win = document.querySelector('.win');
    if (win) { win.addEventListener('mouseenter', function () { paused = true; }); }
    pick(0, false);
    if (!reduce) {
      var tick = function (now) {
        if (!paused) {
          var p = Math.min(1, (now - t0) / DUR); tabs[ti].style.setProperty('--p', p.toFixed(3));
          if (p >= 1) { pick(ti + 1, false); }
        } else { t0 = now - (parseFloat(tabs[ti].style.getPropertyValue('--p')) || 0) * DUR; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  // ---------- frases de ejemplo (como las arma el plugin) ----------
  // cada linea: [alineacion, [[texto, tamano, clave]]]
  var LOCKS = [
    [['l', [['se', 's'], ['trata', 'm']]], ['c', [['de', 's'], ['estar', 'm']]], ['r', [['presente,', 'l', 1]]]],
    [['l', [['nunca', 'm'], ['frenes', 'l', 1]]], ['c', [['solo', 's'], ['con', 's'], ['el', 's']]], ['r', [['de', 's'], ['adelante', 'm']]]],
    [['c', [['con', 's'], ['los', 's'], ['días', 'm']]], ['c', [['aprendí', 'l', 1]]], ['c', [['a', 's'], ['escuchar', 'm']]]]
  ];
  var LINES = [
    [['El', 0], ['tiempo', 0], ['que', 0], ['mides', 0], ['no', 0], ['es', 0], ['el', 0], ['que', 0], ['vives', 1]],
    [['Frieren', 1], ['camina', 0], ['sola', 0], ['hacia', 0], ['el', 0], ['norte', 0]]
  ];
  // Una linea: frases cortas (1 o 2 palabras; la palabra funcion va con la siguiente), siempre en una sola linea
  var SHORT = [['El', 'tiempo'], ['que', 'mides'], ['no', 'es'], ['el', 'que', 'vives']];

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) { e.className = cls; } if (txt != null) { e.textContent = txt; } return e; }
  var timers = [];
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clear() { timers.forEach(clearTimeout); timers = []; }

  function playLock(box, i, loop) {
    box.innerHTML = '';
    var words = [];
    LOCKS[i % LOCKS.length].forEach(function (ln) {
      var row = el('div', 'ln ' + ln[0]);
      ln[1].forEach(function (w) { var s = el('span', 'w ' + w[1] + (w[2] ? ' k' : ''), w[0]); row.appendChild(s); words.push(s); });
      box.appendChild(row);
    });
    if (reduce) { words.forEach(function (w) { w.classList.add('on'); }); return; }
    words.forEach(function (w, k) { later(function () { w.classList.add('on'); }, 250 + k * 260); });
    if (loop) { later(function () { words.forEach(function (w) { w.classList.remove('on'); }); }, 250 + words.length * 260 + 1900); later(function () { playLock(box, i + 1, true); }, 250 + words.length * 260 + 2400); }
  }

  function playKara(box, i, loop) {
    box.innerHTML = '';
    var line = LINES[i % LINES.length], spans = [], bx = el('span', 'box');
    box.appendChild(bx);
    line.forEach(function (w, k) { var s = el('span', 'w', w[0]); spans.push(s); box.appendChild(s); if (k < line.length - 1) { box.appendChild(document.createTextNode(' ')); } });
    function at(k) {
      spans.forEach(function (s, j) { s.classList.toggle('on', j === k); });
      var r = spans[k].getBoundingClientRect(), p = box.getBoundingClientRect();
      bx.style.left = (r.left - p.left - 3) + 'px'; bx.style.top = (r.top - p.top) + 'px'; bx.style.width = (r.width + 6) + 'px'; bx.style.height = r.height + 'px';
    }
    at(0);
    if (reduce) { return; }
    spans.forEach(function (s, k) { if (k) { later(function () { at(k); }, k * 380); } });
    if (loop) { later(function () { playKara(box, i + 1, true); }, spans.length * 380 + 1600); }
  }

  function playShort(box, i, loop) {
    box.innerHTML = '';
    var line = SHORT[i % SHORT.length], spans = [];
    line.forEach(function (w, k) { var s = el('span', 'w', w); spans.push(s); box.appendChild(s); if (k < line.length - 1) { box.appendChild(document.createTextNode(' ')); } });
    if (reduce) { spans.forEach(function (s) { s.classList.add('on'); }); return; }
    spans.forEach(function (s, k) { later(function () { s.classList.add('on'); }, 150 + k * 260); });
    if (loop) {
      later(function () { spans.forEach(function (s) { s.classList.add('off'); }); }, 150 + spans.length * 260 + 900);
      later(function () { playShort(box, i + 1, true); }, 150 + spans.length * 260 + 1150);
    }
  }

  // telefono principal
  var demo = document.getElementById('demo');
  if (demo) {
    var lock = document.getElementById('demoLock');
    var kara = el('div', 'kara'), line = el('div', 'one');
    var show = function (style) {
      clear();
      lock.hidden = style !== 'lock'; kara.remove(); line.remove();
      if (style === 'lock') { playLock(lock, 0, true); }
      if (style === 'kara') { demo.appendChild(kara); playKara(kara, 0, true); }
      if (style === 'line') { demo.appendChild(line); playShort(line, 0, true); }
      demo.querySelectorAll('.tag button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-style') === style ? 'true' : 'false'); });
      startMinis();
    };
    demo.querySelectorAll('.tag button').forEach(function (b) { b.addEventListener('click', function () { show(b.getAttribute('data-style')); }); });
    show('lock');
  }

  // miniaturas de la seccion de estilos (se repiten solas)
  function startMinis() {
    document.querySelectorAll('[data-mini]').forEach(function (m) {
      var kind = m.getAttribute('data-mini');
      if (kind === 'lock') { playLock(m, 1, true); }
      if (kind === 'kara') { playKara(m, 1, true); }
      if (kind === 'line') { playShort(m, 2, true); }
    });
  }
  if (!demo) { startMinis(); }

  // ---------- botones de descarga ----------
  // Si todavia no hay ninguna version publicada, los botones no llevan a un 404 de GitHub.
  function noRelease() {
    document.querySelectorAll('[data-dl]').forEach(function (a) {
      a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); a.classList.add('soon');
      if (a.classList.contains('btn') || a.classList.contains('pill')) {
        var svg = a.querySelector('svg'); a.textContent = a.classList.contains('pill') ? 'Muy pronto' : 'Disponible muy pronto'; if (svg && a.classList.contains('btn')) { a.insertBefore(svg, a.firstChild); }
      }
    });
    var note = document.getElementById('soonNote');
    if (note) { note.hidden = false; }
  }

  // ---------- novedades (pagina /novedades/) ----------
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function inline(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>'); }
  // el estilo APPLEXBY es de uso interno: no se anuncia en la web
  function publicLine(l) {
    l = l.replace(/Una l\u00ednea y APPLEXBY/g, 'Una l\u00ednea').replace(/\s*\(Idealo, APPLEXBY[^)]*\)/g, '');
    return /APPLEXBY/i.test(l) ? '' : l;
  }
  function notesToList(md) {
    return String(md || '').split(/\r?\n/).map(function (l) { return publicLine(l.trim()); })
      .filter(function (l) { return /^[-*]\s+/.test(l); })
      .map(function (l) { return '<li>' + inline(l.replace(/^[-*]\s+/, '')) + '</li>'; }).join('');
  }
  function fmtDate(d) { return new Date(d).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' }); }
  var box = document.getElementById('releases');
  fetch('https://api.github.com/repos/' + REPO + '/releases?per_page=20', { headers: { Accept: 'application/vnd.github+json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (list) {
      // sin respuesta (por ejemplo, GitHub limito las consultas): los botones de descarga se quedan como estan
      if (!list) { if (box) { box.innerHTML = '<p class="soft">No se pudieron cargar las versiones. <a href="https://github.com/' + REPO + '/releases">M\u00edralas en GitHub</a>.</p>'; } return; }
      list = list.filter(function (r) { return !r.draft && !r.prerelease; });
      if (!list.length) { noRelease(); if (box) { box.innerHTML = '<p class="soft">Todavía no hay versiones publicadas.</p>'; } return; }
      if (!box) { return; }
      box.innerHTML = list.map(function (r, i) {
        var items = notesToList(r.body), v = esc(String(r.tag_name).replace(/^v/, ''));
        return '<article class="relItem' + (i === 0 ? ' latest' : '') + '"><header><b>' + v + '</b>' + (i === 0 ? '<em>Última</em>' : '') + '<span>' + esc(fmtDate(r.published_at)) + '</span></header>' +
          (items ? '<ul>' + items + '</ul>' : '<p class="soft">Mejoras y correcciones.</p>') + '</article>';
      }).join('');
    })
    .catch(function () { if (box) { box.innerHTML = '<p class="soft">No se pudieron cargar las versiones. <a href="https://github.com/' + REPO + '/releases">Míralas en GitHub</a>.</p>'; } });
})();

/* Laddersu - demo del telefono, version publicada y novedades desde GitHub */
(function () {
  'use strict';
  var REPO = 'Applexby/laddersu';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // barra superior con borde al hacer scroll
  var top = document.getElementById('top');
  if (top) { var onS = function () { top.classList.toggle('scrolled', window.scrollY > 8); }; window.addEventListener('scroll', onS, { passive: true }); onS(); }

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

  // frases cortas de los estilos de una linea (1 o 2 palabras; la palabra funcion va con la siguiente)
  var SHORT = [['o', 'simplemente'], ['nunca', 'frenes,'], ['sigue', 'caminando'], ['hacia', 'el', 'norte']];

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

  // Una linea y APPLEXBY: frase corta, palabra por palabra; luego la siguiente
  function playShort(box, i, loop) {
    box.innerHTML = '';
    var line = SHORT[i % SHORT.length], spans = [];
    line.forEach(function (w, k) { var s = el('span', 'w', w); spans.push(s); box.appendChild(s); if (k < line.length - 1) { box.appendChild(document.createTextNode(' ')); } });
    if (reduce) { spans.forEach(function (s) { s.classList.add('on'); }); return; }
    spans.forEach(function (s, k) { later(function () { s.classList.add('on'); }, 150 + k * 260); });
    if (loop) {
      later(function () { spans.forEach(function (s) { s.classList.remove('on'); }); }, 150 + spans.length * 260 + 900);
      later(function () { playShort(box, i + 1, true); }, 150 + spans.length * 260 + 1250);
    }
  }

  // telefono principal
  var demo = document.getElementById('demo');
  if (demo) {
    var lock = document.getElementById('demoLock'), current = 'lock';
    var kara = el('div', 'kara'), apx = el('div', 'apx red'), line = el('div', 'apx line');
    var show = function (style) {
      clear(); current = style;
      lock.hidden = style !== 'lock'; kara.remove(); apx.remove(); line.remove();
      demo.querySelector('.zone').hidden = style !== 'lock';
      if (style === 'lock') { playLock(lock, 0, true); }
      if (style === 'kara') { demo.appendChild(kara); playKara(kara, 0, true); }
      if (style === 'line') { demo.appendChild(line); playShort(line, 0, true); }
      if (style === 'apx') { demo.appendChild(apx); playShort(apx, 0, true); }
      demo.querySelectorAll('.tag button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-style') === style ? 'true' : 'false'); });
      startMinis();
    };
    demo.querySelectorAll('.tag button').forEach(function (b) { b.addEventListener('click', function () { show(b.getAttribute('data-style')); }); });
    show('lock');
  }

  // miniaturas de la seccion de estilos (se repiten solas)
  function startMinis() {
    document.querySelectorAll('[data-mini]').forEach(function (m, idx) {
      var kind = m.getAttribute('data-mini');
      if (kind === 'lock') { playLock(m, 1, true); }
      if (kind === 'kara') { playKara(m, 1, true); }
      if (kind === 'line') { playShort(m, 2, true); }
      if (kind === 'apx') { playShort(m, 0, true); }
    });
  }
  if (!demo) { startMinis(); }

  // ---------- botones de descarga ----------
  // Si todavia no hay ninguna version publicada, los botones no llevan a un 404 de GitHub:
  // pasan a "Disponible muy pronto" y explican el estado.
  function noRelease() {
    document.querySelectorAll('[data-dl]').forEach(function (a) {
      a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); a.classList.add('soon');
      if (a.classList.contains('btn') || a.classList.contains('pill')) {
        var svg = a.querySelector('svg'); a.textContent = a.classList.contains('pill') ? 'Muy pronto' : 'Disponible muy pronto'; if (svg && a.classList.contains('btn')) { a.insertBefore(svg, a.firstChild); }
      }
    });
    var vl = document.getElementById('verLine');
    if (vl) { vl.textContent = 'Primera versión en preparación'; }
    var note = document.getElementById('soonNote');
    if (note) { note.hidden = false; }
  }
  fetch('https://api.github.com/repos/' + REPO + '/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
    .then(function (r) { if (r.status === 404) { noRelease(); } })
    .catch(function () {});

  // ---------- version publicada y novedades ----------
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function notesToList(md) {
    return String(md || '').split(/\r?\n/).map(function (l) { return l.trim(); })
      .filter(function (l) { return /^[-*]\s+/.test(l); }).slice(0, 8)
      .map(function (l) { return '<li>' + esc(l.replace(/^[-*]\s+/, '').replace(/\*\*/g, '').replace(/`/g, '')) + '</li>'; }).join('');
  }
  fetch('https://api.github.com/repos/' + REPO + '/releases?per_page=5', { headers: { Accept: 'application/vnd.github+json' } })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (list) {
      list = (list || []).filter(function (r) { return !r.draft && !r.prerelease; });
      if (!list.length) { return; }
      var v = String(list[0].tag_name).replace(/^v/, ''), d = new Date(list[0].published_at);
      var vl = document.getElementById('verLine');
      if (vl) { vl.textContent = 'Versión ' + v + ' · ' + d.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' }); }
      var box = document.getElementById('releases');
      if (!box) { return; }
      box.innerHTML = list.map(function (r) {
        var items = notesToList(r.body);
        return '<article class="relItem"><header><b>' + esc(String(r.tag_name).replace(/^v/, '')) + '</b><span>' +
          esc(new Date(r.published_at).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })) + '</span></header>' +
          (items ? '<ul>' + items + '</ul>' : '<p class="soft">Mejoras y correcciones.</p>') + '</article>';
      }).join('');
    })
    .catch(function () {});
})();

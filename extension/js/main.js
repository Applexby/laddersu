/* Laddersu - interfaz del panel (Chromium de CEP). Usa ES (engine), Model, Pres, SFX_LIB. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined && text !== null) { e.textContent = text; }
    return e;
  }
  function icon(name) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('class', 'ic');
    var u = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    u.setAttribute('href', '#i-' + name);
    s.appendChild(u);
    return s;
  }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function btn(cls, label, fn, ic) {
    var b = h('button', cls); b.type = 'button';
    if (ic) { b.appendChild(icon(ic)); }
    if (label) { b.appendChild(h('span', '', label)); }
    if (fn) { b.addEventListener('click', fn); }
    return b;
  }

  // ================= estado =================
  var st = { seqs: [] };
  var sel = Model.newSel();
  var S = Model.defaults();
  var fonts = [], fontsState = 'loading';
  var ui = { tab: 'editor', step: 'texto', lib: 'comp', sndCat: 'Todos', drag: null, fsel: {}, inspTab: '', genOnly: true, gen: null };
  var sounds = [];
  var EXT = '';
  var history = [];
  var logs = [];

  // ================= registro y mensajes =================
  // say(texto) -> aviso flotante (con Deshacer si viene de un cambio); say(texto, cls, id) -> linea de mensaje
  function say(text, cls, id) {
    if (!id) { toast(text, cls); logLine(text, cls); return; }
    var el = $(id); el.textContent = text || ''; el.className = 'msg' + (cls ? ' ' + cls : '');

  }
  var toastTimer = 0;
  function toast(text, cls) {
    var t = $('toast'); if (!text) { return; }
    t.innerHTML = ''; t.className = 'toast' + (cls === 'err' ? ' err' : '');
    t.appendChild(h('span', '', text));
    if (cls !== 'err' && Date.now() - (ui.lastMut || 0) < 400) {
      var u = h('button', '', 'Deshacer'); u.type = 'button';
      u.addEventListener('click', function () { undo(); t.hidden = true; });
      t.appendChild(u);
    }
    var foot = $('foot');
    t.style.bottom = ((foot.hidden ? 0 : foot.offsetHeight) + 12) + 'px';
    t.hidden = false; clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, cls === 'err' ? 5200 : 3200);
  }
  function logLine(text, cls) {
    var d = new Date(), t = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
    logs.push({ t: t, m: text, c: cls || '' }); if (logs.length > 80) { logs.shift(); }

  }
  window.__ES_log = logs;

  // ================= ajustes =================
  function saveCfg() { lsSet('escaleraSubs3', { S: S }); }
  function loadCfg() {
    var o = lsGet('escaleraSubs3', null), k;
    if (o && o.S) { for (k in o.S) { if (o.S.hasOwnProperty(k)) { S[k] = o.S[k]; } } Model.migrateCfg(S); }
  }
  function getF(f) { return f.k === 'autoSfx' ? S.sfxAuto.sfx : (f.k === 'autoOn' ? S.sfxAuto.on : S[f.k]); }
  function setF(f, v) { if (f.k === 'autoSfx') { S.sfxAuto.sfx = v; } else if (f.k === 'autoOn') { S.sfxAuto.on = v; } else { S[f.k] = v; } saveCfg(); drawPreview(); }

  // ----- ajustes: controles -----
  function fld(label, ctrl, note) {
    var row = h('div', 'fld'), lab = h('label', '', label);
    if (ctrl.id) { lab.setAttribute('for', ctrl.id); }
    row.appendChild(lab); row.appendChild(ctrl);
    if (note) { row.title = note; }
    return row;
  }
  function numIn(k, min, max, step) {
    var i = h('input'); i.type = 'number'; i.min = min; i.max = max; i.step = step; i.value = S[k]; i.id = 'f_' + k;
    i.addEventListener('change', function () { var v = parseFloat(i.value); if (!isNaN(v)) { S[k] = Math.max(min, Math.min(max, v)); } i.value = S[k]; saveCfg(); drawPreview(); afterSet(k); });
    return i;
  }
  function slider(k, min, max, step, unit) {
    var w = h('span', 'sld'), r = h('input'), o = h('output');
    r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = S[k]; r.id = 'f_' + k;
    var show = function () { o.textContent = (step < 1 ? Number(S[k]).toFixed(2).replace(/0$/, '') : S[k]) + (unit || ''); };
    r.addEventListener('input', function () { S[k] = parseFloat(r.value); show(); afterSet(k); });
    r.addEventListener('change', function () { saveCfg(); drawPreview(); });
    show(); w.appendChild(r); w.appendChild(o); w.id = 'w_' + k;
    return w;
  }
  function toggle(k, getter, setter) {
    var b = h('button', 'switch'); b.type = 'button'; b.id = 'f_' + k; b.setAttribute('role', 'switch');
    var cur = function () { return getter ? getter() : !!S[k]; };
    var paint = function () { b.setAttribute('aria-checked', cur() ? 'true' : 'false'); };
    b.addEventListener('click', function () { if (setter) { setter(!cur()); } else { S[k] = !S[k]; } paint(); saveCfg(); drawPreview(); afterSet(k); });
    paint(); return b;
  }
  function segc(k, opts, onChange) {
    var w = h('div', 'segc'); w.id = 'f_' + k;
    opts.forEach(function (o) {
      var b = h('button', S[k] === o[0] ? 'on' : '', o[1]); b.type = 'button'; b.setAttribute('data-v', o[0]);
      b.addEventListener('click', function () { S[k] = o[0]; saveCfg(); drawPreview(); renderSettings(); if (onChange) { onChange(); } });
      w.appendChild(b);
    });
    return w;
  }
  function colorIn(k) {
    var i = h('input'); i.type = 'color'; i.value = S[k]; i.id = 'f_' + k;
    i.addEventListener('input', function () { S[k] = i.value; afterSet(k); });
    i.addEventListener('change', function () { saveCfg(); drawPreview(); });
    return i;
  }
  function selectIn(k, opts, getter, setter) {
    var i = h('select'); i.id = 'f_' + k;
    opts.forEach(function (o) { var op = h('option', '', o[1]); op.value = o[0]; i.appendChild(op); });
    i.value = getter ? getter() : S[k];
    i.addEventListener('change', function () { if (setter) { setter(i.value); } else { S[k] = i.value; } saveCfg(); drawPreview(); });
    return i;
  }
  function card(ic, title, desc) {
    var c = h('section', 'scard'), hd = h('div', 'shead');
    hd.appendChild(icon(ic)); var tt = h('div'); tt.appendChild(h('b', '', title)); if (desc) { tt.appendChild(h('small', '', desc)); } hd.appendChild(tt);
    c.appendChild(hd); return c;
  }
  // diagrama de la zona segura (9:16) que se actualiza al mover los controles
  function zoneDiagram() {
    var wrap = h('div', 'zdiag'), ph = h('div', 'phone'), z = h('div', 'zone'), cl = h('div', 'cline'), blk = h('div', 'blk');
    ph.appendChild(z); ph.appendChild(cl); ph.appendChild(blk); wrap.appendChild(ph);
    var paint = function () {
      z.style.left = S.marginX + '%'; z.style.right = S.marginX + '%'; z.style.top = S.zoneTop + '%'; z.style.bottom = (100 - S.zoneBottom) + '%';
      cl.style.top = S.centerY + '%'; blk.style.top = S.centerY + '%'; blk.style.left = (S.marginX + 6) + '%'; blk.style.right = (S.marginX + 6) + '%';
    };
    paint(); wrap.paint = paint; zoneDiagram.cur = wrap;
    return wrap;
  }
  function afterSet(k) {
    if (/^(marginX|zoneTop|zoneBottom|centerY)$/.test(k) && zoneDiagram.cur) { zoneDiagram.cur.paint(); }
  }
  function apxFontIn(k, ph) {
    k = k || 'apxFont';
    var w = h('span', 'fontIn'), i = h('input'); i.type = 'text'; i.value = S[k] || ''; i.id = 'f_' + k; i.setAttribute('list', 'fontNames');
    if (ph) { i.placeholder = ph; }
    var dl = h('datalist'); dl.id = 'fontNames';
    fonts.forEach(function (f) { var o = h('option'); o.value = f.n; o.label = f.f + ' ' + f.s; dl.appendChild(o); });
    var warn = h('small', 'fontWarn');
    var check = function () {
      var ok = !fonts.length || !S[k] || !!Model.findFont(fonts, S[k]);
      warn.textContent = ok ? '' : 'No está instalada: se usará la fuente por defecto.';
    };
    i.addEventListener('change', function () { S[k] = i.value.replace(/^\s+|\s+$/g, ''); saveCfg(); check(); drawPreview(); });
    check(); w.appendChild(i); w.appendChild(dl); w.appendChild(warn);
    return w;
  }
  // mini ilustraciones de los estilos de edicion
  function styleArt(kind) {
    var a = h('div', 'art ' + kind);
    if (kind === 'lockup') {
      [['s', 'w30', 'x6'], ['l', 'w58', 'x20'], ['m', 'w40', 'x40']].forEach(function (b) { a.appendChild(h('i', b.join(' '))); });
    } else if (kind === 'applexby') {
      [['m red', 'w10', 'x26', 'y3'], ['m red', 'w44', 'x37', 'y3']].forEach(function (b) { a.appendChild(h('i', b.join(' '))); });
    } else if (kind === 'line') {
      [['m', 'w24', 'x20', 'y3'], ['m', 'w30', 'x50', 'y3']].forEach(function (b) { a.appendChild(h('i', b.join(' '))); });
    } else {
      a.appendChild(h('span', 'kbox'));
      [['m', 'w22', 'x8', 'y1'], ['m', 'w26', 'x36', 'y1'], ['m', 'w20', 'x68', 'y1'], ['m', 'w30', 'x16', 'y2'], ['m', 'w34', 'x52', 'y2']].forEach(function (b) { a.appendChild(h('i', b.join(' '))); });
    }
    return a;
  }

  function renderSettings() {
    var body = $('settingsBody'); body.innerHTML = '';
    var c, row;

    var LS = ui.lookStyle || (ES.isLineStyle(S.editStyle) || S.editStyle === 'karaoke' ? S.editStyle : 'lockup');
    c = card('stair', 'Aspecto de los estilos', 'Cómo se ve cada estilo. Qué frases usan cada uno se decide en el paso Frases.');
    c.id = 'lookCard';
    row = h('div', 'segc lookSeg'); row.setAttribute('role', 'group'); row.setAttribute('aria-label', 'Estilo');
    [['lockup', 'Escalera'], ['karaoke', 'Caja'], ['line', 'Una línea'], ['applexby', 'APPLEXBY']].forEach(function (o) {
      var b = h('button', LS === o[0] ? 'on' : '', o[1]); b.type = 'button'; b.setAttribute('data-v', o[0]); b.setAttribute('aria-pressed', LS === o[0] ? 'true' : 'false');
      b.addEventListener('click', function () { ui.lookStyle = o[0]; renderSettings(); });
      row.appendChild(b);
    });
    c.appendChild(row);
    if (LS === 'applexby' || LS === 'line') {
      var ax = LS === 'applexby', P = ax ? 'apx' : 'lin';
      c.appendChild(fld('Fuente (nombre PostScript)', apxFontIn(P + 'Font', ax ? '' : 'La de la edición')));
      c.appendChild(fld('Tamaño', slider(P + 'Size', 30, 140, 1, ' px')));
      c.appendChild(fld('Altura en el video', slider(P + 'CenterY', 50, 90, 1, '%')));
      if (ax) {
        c.appendChild(fld('Juntar letras', slider('apxTrack', -150, 0, 5, '')));
        c.appendChild(fld('Espacio entre palabras', slider('apxGap', 0, 30, 1, '%')));
      }
      row = h('div', 'colors two');
      [[P + 'Color', 'Texto'], [P + 'Key', 'Palabra clave ★']].forEach(function (x) { var cell = h('label', 'ccell'); cell.appendChild(colorIn(x[0])); cell.appendChild(h('small', '', x[1])); row.appendChild(cell); });
      c.appendChild(row);
      if (ax) {
        c.appendChild(fld('Minúsculas', toggle('apxLower')));
      } else {
        c.appendChild(fld('Mayúsculas', toggle('linUpper')));
      }
      c.appendChild(fld('Sombra suave', toggle(P + 'Shadow')));
      c.appendChild(fld('Salida al terminar la frase', toggle(P + 'Exit'), 'Apagada: las palabras solo tienen entrada y desaparecen al cortar.'));
      c.appendChild(h('p', 'secNote', ax ? 'Cada palabra entra con desenfoque y transparencia (0,30 s), sin salida. Si una frase no cabe en una línea se parte en dos, nunca en tres.'
        : 'Cada palabra entra con la animación de la edición (Ajustes ▸ Animación). Si no cabe en una línea se parte en dos, nunca en tres.'));
    } else if (LS === 'karaoke') {
      c.appendChild(fld('Tamaño de las palabras', segc('karSize', [['S', 'S'], ['M', 'M'], ['L', 'L']])));
      c.appendChild(fld('Color de la caja', colorIn('karBox')));
      c.appendChild(fld('Tiempo del cambio', slider('karMove', 0.04, 0.4, 0.02, ' s')));
      c.appendChild(fld('Redondeo de la caja', slider('karRadius', 0, 40, 1, ' px')));
    } else {
      c.appendChild(h('div', 'lab2', 'Patrón de las frases'));
      c.appendChild(segc('align', [['auto', 'Variado'], ['center', 'Centro'], ['stair', 'Escalera'], ['zigzag', 'Zigzag'], ['left', 'Izq.'], ['right', 'Der.']]));
    }
    body.appendChild(c);

    c = card('type', 'Texto', 'Tamaños de la escalera y espacios.');
    row = h('div', 'trio');
    [['szS', 'S'], ['szM', 'M'], ['szL', 'L']].forEach(function (x) {
      var cell = h('label', 'tcell'); var sp = h('span', 'tsz ' + x[1], 'Aa'); cell.appendChild(sp);
      var i = numIn(x[0], 10, 500, 1); cell.appendChild(i); cell.appendChild(h('small', '', x[1] + ' · px')); row.appendChild(cell);
    });
    c.appendChild(row);
    c.appendChild(fld('Espacio entre palabras', slider('gapPx', 0, 60, 1, ' px')));
    c.appendChild(fld('Espacio entre líneas', slider('lineGap', 0, 60, 1, ' px')));
    c.appendChild(fld('Todo en mayúsculas', toggle('upper')));
    c.appendChild(fld('Reducir si no cabe en la zona', toggle('fit')));
    body.appendChild(c);

    c = card('eye', 'Márgenes seguros', 'Dónde puede ir el texto dentro del video vertical.');
    row = h('div', 'zoneRow');
    var ctr = h('div', 'zoneCtrls');
    ctr.appendChild(fld('Margen lateral', slider('marginX', 0, 40, 1, '%')));
    ctr.appendChild(fld('Zona desde arriba', slider('zoneTop', 0, 90, 1, '%')));
    ctr.appendChild(fld('Zona hasta abajo', slider('zoneBottom', 10, 100, 1, '%')));
    ctr.appendChild(fld('Centro del bloque', slider('centerY', 0, 100, 1, '%')));
    row.appendChild(zoneDiagram()); row.appendChild(ctr);
    c.appendChild(row);
    c.appendChild(fld('Crear una guía visible en la composición', toggle('guide')));
    body.appendChild(c);

    c = card('drop', 'Colores y brillo', 'Colores automáticos; cada palabra puede tener el suyo.');
    row = h('div', 'colors');
    [['colBase', 'Texto'], ['colBrand', 'Palabra ★'], ['colHl', 'Caja'], ['glowColor', 'Brillo']].forEach(function (x) {
      var cell = h('label', 'ccell'); cell.appendChild(colorIn(x[0])); cell.appendChild(h('small', '', x[1])); row.appendChild(cell);
    });
    c.appendChild(row);
    c.appendChild(fld('Tamaño del brillo', slider('glowSize', 1, 120, 1, ' px')));
    c.appendChild(fld('Intensidad del brillo', slider('glowOpacity', 0, 100, 1, '%')));
    body.appendChild(c);

    c = card('motion', 'Animación de entrada', 'La que usan las palabras sin animación propia.');
    c.appendChild(fld('Transición', selectIn('animPreset', ES.TRANS_ORDER.map(function (i) { return [i, ES.TRANS[i].name]; }))));
    c.appendChild(fld('Duración', slider('animDur', 0.05, 1, 0.01, ' s')));
    c.appendChild(fld('Distancia', slider('animDist', 0, 200, 1, ' px')));
    c.appendChild(fld('Desenfoque', slider('animBlur', 0, 80, 1, ' px')));
    c.appendChild(fld('Animar solo las palabras grandes', toggle('animBig')));
    body.appendChild(c);

    c = card('speaker', 'Sonido automático', 'Se coloca solo en las palabras que elijas.');
    c.appendChild(fld('Sonido', selectIn('autoSfx', [['', 'Ninguno']].concat(sounds.map(function (x) { return [x.id, x.name]; })), function () { return S.sfxAuto.sfx; }, function (v) { S.sfxAuto.sfx = v; })));
    c.appendChild(fld('Se aplica en', selectIn('autoOn', [['L', 'Palabras grandes'], ['brand', 'Palabras clave ★'], ['first', 'Primera de cada frase'], ['all', 'Todas']], function () { return S.sfxAuto.on; }, function (v) { S.sfxAuto.on = v; })));
    c.appendChild(fld('Volumen', slider('sfxDb', -40, 6, 1, ' dB')));
    body.appendChild(c);

    c = card('refresh', 'Tiempos y frases', 'Pausa y peso cambian al volver a importar el SRT.');
    c.appendChild(fld('Cola al final de la frase', slider('tail', 0, 1.5, 0.05, ' s')));
    c.appendChild(fld('Pausa que corta una frase', slider('groupGap', 0.1, 2, 0.05, ' s')));
    c.appendChild(fld('Peso máximo por frase', numIn('groupWeight', 2, 10, 1)));
    body.appendChild(c);

    c = card('comp', 'Generación', '');
    c.appendChild(fld('Al regenerar, reemplazar lo creado antes', toggle('replacePrev', function () { return S.replacePrev !== false; }, function (v) { S.replacePrev = v; })));
    c.appendChild(fld('Crear una composición nueva', toggle('newComp')));
    if (S.newComp) {
      row = h('div', 'trio');
      [['compW', 'Ancho'], ['compH', 'Alto'], ['compFps', 'FPS']].forEach(function (x) { var cell = h('label', 'tcell'); cell.appendChild(numIn(x[0], 1, 8000, 1)); cell.appendChild(h('small', '', x[1])); row.appendChild(cell); });
      c.appendChild(row);
    }
    body.appendChild(c);

    var reset = h('button', 'pill ghost resetAll', 'Restablecer ajustes'); reset.type = 'button';
    reset.addEventListener('click', function () {
      if (reset.getAttribute('data-sure') !== '1') { reset.setAttribute('data-sure', '1'); reset.textContent = 'Pulsa otra vez para restablecer'; setTimeout(function () { reset.removeAttribute('data-sure'); reset.textContent = 'Restablecer ajustes'; }, 2500); return; }
      var font = S.font; S = Model.defaults(); S.font = font; saveCfg(); renderSettings(); render(); say('Ajustes restablecidos.', 'ok');
    });
    body.appendChild(reset);
    var about = h('div', 'about');
    about.appendChild(h('span', '', 'Laddersu ' + (appVersion || Model.HOST_VER)));
    var chk = h('button', 'link', 'Buscar actualizaciones'); chk.type = 'button'; chk.addEventListener('click', openUpdater);
    about.appendChild(chk); body.appendChild(about);
  }
  // ================= puente con After Effects =================
  function hasAE() { return typeof window.__adobe_cep__ !== 'undefined'; }
  function evalAE(script, cb) {
    if (!hasAE()) { if (cb) { cb('NOAE'); } return; }
    try { window.__adobe_cep__.evalScript(script, function (r) { if (cb) { cb(r); } }); }
    catch (e) { if (cb) { cb('EvalScript error: ' + e); } }
  }
  function jsq(s) { return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }
  function parseJSON(r) { try { return JSON.parse(r); } catch (e) { return null; } }
  function readText(url, cb) {
    var x = new XMLHttpRequest();
    x.onload = function () { cb((x.status === 200 || x.status === 0) && x.responseText ? x.responseText : null); };
    x.onerror = function () { cb(null); };
    try { x.open('GET', url); x.send(); } catch (e) { cb(null); }
  }
  var STATUS = 'typeof ES_status==="function" ? ES_status() : "none"';

  // Garantiza que host.jsx y engine.js esten cargados en AE (por ruta; si no, inyectando el texto).
  function ensureHost(cb) {
    if (!hasAE()) { cb(false, 'noae'); return; }
    evalAE(STATUS, function (r) {
      var o = parseJSON(r);
      if (o && o.engine && o.ver === Model.HOST_VER && o.ev === Model.HOST_VER) { cb(true, o); return; }
      var loadByPath = function (done) {
        if (!EXT) { done(); return; }
        var js = '(function(){var out="";try{$.evalFile(new File("' + jsq(EXT) + '/jsx/host.jsx"));$.evalFile(new File("' + jsq(EXT) + '/jsx/engine.js"));}catch(e){out="ERR "+e;}return out;})()';
        evalAE(js, function () { done(); });
      };
      var loadByText = function (done) {
        var files = ['jsx/host.jsx', 'jsx/engine.js'], i = 0;
        (function next() {
          if (i >= files.length) { done(); return; }
          readText(files[i++], function (txt) { if (txt) { evalAE(txt, next); } else { next(); } });
        })();
      };
      var recheck = function (then) {
        evalAE(STATUS, function (r2) { var o2 = parseJSON(r2); then(!!(o2 && o2.engine && o2.ver === Model.HOST_VER && o2.ev === Model.HOST_VER), o2 || r2); });
      };
      loadByPath(function () { recheck(function (ok, info) { if (ok) { cb(true, info); return; } loadByText(function () { recheck(cb); }); }); });
    });
  }

  function refreshComp() {
    if (!hasAE()) { return; }
    evalAE('typeof ES_compInfo==="function" ? ES_compInfo() : "{}"', function (r) {
      var b = $('compBadge'), o = parseJSON(r);
      var prev = ui.comp ? JSON.stringify(ui.comp) : '';
      if (o && o.ok) {
        b.textContent = o.name + ' · ' + o.w + '×' + o.h; b.title = o.name + ' · ' + o.w + '×' + o.h + ' · ' + Math.round(o.fps) + ' fps'; b.className = 'comp ok';
        ui.comp = { ok: true, name: o.name, w: o.w, h: o.h, fps: o.fps };
      }
      else { b.textContent = 'sin composición activa'; b.className = 'comp'; ui.comp = ui.comp ? { ok: false, w: ui.comp.w, h: ui.comp.h } : { ok: false }; }
      if (JSON.stringify(ui.comp) !== prev) { if (ui.step === 'diseno') { drawPreview(); } if (ui.step === 'generar' && !gen) { renderGenerar(); } }
    });
  }

  // ================= tipografias del sistema =================
  var fontPickers = [];
  function loadFonts() {
    fontsState = 'loading'; renderFontPickers();
    if (!hasAE()) { fontsState = 'none'; renderFontPickers(); return; }
    ensureHost(function (ok) {
      if (!ok) { fontsState = 'none'; renderFontPickers(); return; }
      evalAE('ES_listFonts()', function (r) {
        var o = parseJSON(r);
        if (o && o.ok && o.fonts.length) { fonts = o.fonts; fontsState = 'ok'; } else { fonts = []; fontsState = 'none'; }
        renderFontPickers(); render();
      });
    });
  }
  function fontLabelOf(ps) { if (!ps) { return ''; } var f = Model.findFont(fonts, ps); return f ? f.f + ' · ' + f.s : ps; }
  function applyFontStyle(el, ps) {
    var f = ps ? Model.findFont(fonts, ps) : null;
    if (!f) { return; }
    var c = Model.fontCss(f);
    el.style.fontFamily = '"' + c.family + '", sans-serif'; el.style.fontWeight = c.weight; el.style.fontStyle = c.italic ? 'italic' : 'normal';
  }
  // opts: {getValue,onPick,inheritText,onInherit}
  function FontPicker(host, opts) {
    var box = h('div', 'fp'), query = '';
    var cur = h('div', 'fpCur'), top = h('div', 'fpTop'), input = h('input'), list = h('div', 'fpList'), foot = h('div', 'fpFoot');
    var refresh = h('button', 'iconBtn'); refresh.type = 'button'; refresh.title = 'Actualizar la lista de fuentes'; refresh.appendChild(icon('refresh'));
    input.type = 'text'; input.placeholder = 'Buscar fuente…'; input.setAttribute('aria-label', 'Buscar fuente');
    top.appendChild(input); top.appendChild(refresh);
    box.appendChild(top); box.appendChild(list); box.appendChild(foot);
    host.appendChild(cur); host.appendChild(box);
    function renderList() {
      list.innerHTML = ''; foot.innerHTML = '';
      var val = opts.getValue();
      if (fontsState === 'loading') { list.appendChild(h('div', 'fpFoot', 'Leyendo fuentes instaladas…')); return; }
      if (fontsState === 'none') {
        list.appendChild(h('div', 'fpFoot', 'No pude leer la lista (hace falta After Effects 2024 o superior). Escribe el nombre PostScript:'));
        var manual = h('input'); manual.type = 'text'; manual.value = val; manual.placeholder = 'Montserrat-ExtraBold';
        manual.style.margin = '6px 10px'; manual.style.width = 'calc(100% - 20px)';
        manual.addEventListener('change', function () { opts.onPick(manual.value.trim()); });
        list.appendChild(manual); return;
      }
      var res = Model.filterFonts(fonts, query, 60), i;
      for (i = 0; i < res.length; i++) {
        (function (f) {
          var row = h('button', 'fpRow' + (f.n === val ? ' on' : '')); row.type = 'button';
          var pv = h('span', 'pv', f.f); applyFontStyle(pv, f.n);
          row.appendChild(pv); row.appendChild(h('span', 'st', f.s));
          row.addEventListener('click', function () { opts.onPick(f.n); });
          list.appendChild(row);
        })(res[i]);
      }
      if (!res.length) { list.appendChild(h('div', 'fpFoot', 'Ninguna fuente coincide con “' + query + '”.')); }
      foot.appendChild(h('span', '', res.length >= 60 ? 'Mostrando 60 de ' + fonts.length + '. Afina la búsqueda.' : res.length + ' de ' + fonts.length));
      if (opts.onInherit) { var inh = h('button', 'pill ghost small', opts.inheritText || 'Usar la global'); inh.type = 'button'; inh.addEventListener('click', opts.onInherit); foot.appendChild(inh); }
    }
    function renderAll2() {
      var v = opts.getValue();
      cur.textContent = v ? 'Elegida: ' + fontLabelOf(v) : (opts.emptyText || 'Ninguna elegida');
      applyFontStyle(cur, v); renderList();
    }
    input.addEventListener('input', function () { query = input.value; renderList(); });
    refresh.addEventListener('click', function () { loadFonts(); });
    var api = { render: renderAll2, host: host, focus: function () { input.focus(); } };
    fontPickers.push(api); renderAll2();
    return api;
  }
  function renderFontPickers() {
    var keep = [], i;
    for (i = 0; i < fontPickers.length; i++) { if (document.body.contains(fontPickers[i].host)) { keep.push(fontPickers[i]); fontPickers[i].render(); } }
    fontPickers = keep;
    $('fontLabel').textContent = S.font ? 'Fuente: ' + fontLabelOf(S.font) : 'Fuente por defecto (la de After Effects)';
  }

  // ================= sonidos =================
  function allSounds() {
    var out = [], i, custom = lsGet('escaleraSubsSounds', []);
    for (i = 0; i < SFX_LIB.length; i++) {
      out.push({ id: SFX_LIB[i].id, name: SFX_LIB[i].name, cat: SFX_LIB[i].cat, dur: SFX_LIB[i].dur, url: 'sounds/' + SFX_LIB[i].file, path: EXT ? EXT + '/sounds/' + SFX_LIB[i].file : '' });
    }
    // carpeta sounds/user del panel (tus .wav/.mp3 + library.json opcional)
    try {
      if (EXT && typeof require === 'function' && typeof LadderSounds !== 'undefined') {
        LadderSounds.scan(EXT + '/sounds/user', { fs: require('fs'), path: require('path') }).forEach(function (u) {
          out.push({ id: u.id, name: u.name, cat: u.cat, dur: 0, url: 'sounds/user/' + encodeURIComponent(u.file), path: u.path.replace(/\\/g, '/') });
        });
      }
    } catch (e) {}
    for (i = 0; i < custom.length; i++) {
      out.push({ id: custom[i].id, name: custom[i].name, cat: 'Mis sonidos', dur: 0, url: encodeURI('file:///' + custom[i].path.replace(/^\//, '')), path: custom[i].path });
    }
    return out;
  }
  function soundById(id) { var i; for (i = 0; i < sounds.length; i++) { if (sounds[i].id === id) { return sounds[i]; } } return null; }
  function sfxPath(id) { var s = soundById(id); return s ? s.path : ''; }
  var audio = null;
  function preview(id) { var s = soundById(id); if (!s) { return; } try { if (audio) { audio.pause(); } audio = new Audio(s.url); audio.volume = 0.9; audio.play(); } catch (e) {} }
  function sfxUses(id) {
    var n = 0; st.seqs.forEach(function (q) { q.words.forEach(function (w) { if (w.c.sfx === id) { n++; } }); }); return n;
  }
  function renderSounds() {
    var cats = ['Todos'];
    sounds.forEach(function (s) { if (cats.indexOf(s.cat) < 0) { cats.push(s.cat); } });
    var cw = $('sndCats'); cw.innerHTML = '';
    cats.forEach(function (c) {
      var b = btn('opt' + (c === ui.sndCat ? ' on' : ''), c, function () { ui.sndCat = c; renderSounds(); }); cw.appendChild(b);
    });
    var ul = $('sndList'); ul.innerHTML = '';
    var cur = Model.uniform(st, sel, 'sfx'), hasSel = Model.selCount(st, sel) > 0;
    sounds.forEach(function (s) {
      if (ui.sndCat !== 'Todos' && s.cat !== ui.sndCat) { return; }
      var on = hasSel && cur === s.id, li = h('li', 'snd' + (on ? ' on' : ''));
      var pb = h('button', 'playBtn'); pb.type = 'button'; pb.title = 'Escuchar'; pb.setAttribute('aria-label', 'Escuchar ' + s.name); pb.appendChild(icon('play'));
      pb.addEventListener('click', function () { preview(s.id); });
      var uses = sfxUses(s.id);
      var meta = h('span', 'meta', (s.dur ? s.dur.toFixed(2) + ' s' : '') + (uses ? (s.dur ? ' · ' : '') + uses + (uses === 1 ? ' palabra' : ' palabras') : ''));
      var use = h('button', 'pill small', on ? 'Quitar' : 'Usar'); use.type = 'button'; use.disabled = !hasSel; use.title = hasSel ? '' : 'Elige palabras en el Editor primero';
      use.addEventListener('click', function () { mutate(function () { Model.applyPatch(st, sel, { sfx: on ? '' : s.id }); }); if (!on) { preview(s.id); } renderSounds(); });
      li.appendChild(pb); li.appendChild(h('span', 'nm', s.name)); li.appendChild(meta); li.appendChild(use); ul.appendChild(li);
    });
  }
  function addSound() {
    var add = function (path) {
      if (!path) { return; }
      path = String(path).replace(/\\/g, '/');
      var list = lsGet('escaleraSubsSounds', []), base = path.split('/').pop().replace(/\.[^.]+$/, '');
      list.push({ id: 'c' + Date.now(), name: base, path: path }); lsSet('escaleraSubsSounds', list);
      sounds = allSounds(); ui.sndCat = 'Mis sonidos'; renderSounds(); renderSettings(); say('Agregado: ' + base, 'ok', 'sndMsg');
    };
    try {
      if (window.cep && window.cep.fs && window.cep.fs.showOpenDialog) {
        var r = window.cep.fs.showOpenDialog(false, false, 'Elegir sonido', '', ['wav', 'mp3', 'aif', 'aiff', 'm4a']);
        if (r && r.data && r.data.length) { add(r.data[0]); }
        return;
      }
    } catch (e) {}
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'audio/*';
    inp.onchange = function () { var f = inp.files[0]; if (f && f.path) { add(f.path); } else { say('Este entorno no permite leer la ruta del archivo.', 'err', 'sndMsg'); } };
    inp.click();
  }

  // ================= presentaciones (almacen) =================
  function cepPath() {
    try { return Model.cleanExtPath(window.__adobe_cep__.getSystemPath('userData')) + '/Laddersu'; } catch (e) { return ''; }
  }
  var pstore = Pres.createStore({
    readLS: function () { try { return localStorage.getItem('escaleraSubs3.pres'); } catch (e) { return null; } },
    writeLS: function (s) { try { localStorage.setItem('escaleraSubs3.pres', s); } catch (e) {} },
    readFile: function () {
      var d = cepPath(); if (!d || !window.cep || !window.cep.fs) { return null; }
      var r = window.cep.fs.readFile(d + '/presentations.json');
      if (!(r && r.err === 0)) { r = window.cep.fs.readFile(d.replace(/\/Laddersu$/, '/EscaleraSubs') + '/presentations.json'); }
      return r && r.err === 0 ? r.data : null;
    },
    writeFile: function (s) {
      var d = cepPath(); if (!d || !window.cep || !window.cep.fs) { return; }
      window.cep.fs.makedir(d); window.cep.fs.writeFile(d + '/presentations.json', s);
    }
  });

  function saveText(name, text, ext, cb) {
    try {
      if (window.cep && window.cep.fs && window.cep.fs.showSaveDialogEx) {
        var r = window.cep.fs.showSaveDialogEx('Guardar', '', [ext], name, '');
        if (r && r.data) { var w = window.cep.fs.writeFile(r.data, text); if (cb) { cb(w && w.err === 0, r.data); } return; }
        if (r && r.err !== undefined) { return; }
      }
    } catch (e) {}
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    if (cb) { cb(true, name); }
  }
  function readPicked(inputEl, cb) {
    inputEl.addEventListener('change', function (ev) {
      var f = ev.target.files[0]; if (!f) { return; }
      var rd = new FileReader(); rd.onload = function () { cb(String(rd.result), f.name); }; rd.readAsText(f, 'utf-8'); ev.target.value = '';
    });
  }

  function thumb(def) {
    var box = h('div', 'thumb'), items = Pres.previewItems(def), W = 64;
    items.forEach(function (it) {
      var e;
      if (it.k === 'text') {
        e = h('div', 't', it.text.length > 10 ? it.text.substr(0, 10) : it.text);
        e.style.fontSize = Math.max(6, it.size * W * 1.6) + 'px'; e.style.color = it.color;
      } else {
        e = h('div', 'r'); e.style.width = it.w * 100 + '%'; e.style.height = it.h * 100 + '%';
        e.style.background = it.fill || 'transparent'; e.style.borderRadius = it.k === 'ellipse' ? '50%' : Math.min(it.r * W, 8) + 'px';
        if (it.stroke) { e.style.border = '1px solid ' + it.stroke; }
      }
      e.style.left = it.x * 100 + '%'; e.style.top = it.y * 100 + '%'; box.appendChild(e);
    });
    return box;
  }

  function renderPres() {
    var ul = $('presList'); ul.innerHTML = '';
    var list = pstore.list.slice().sort(function (a, b) { return (b.fav ? 1 : 0) - (a.fav ? 1 : 0); });
    if (!list.length) { ul.appendChild(h('p', 'hint', 'No hay plantillas. Usa “Restaurar pack” o crea las tuyas.')); }
    var hasSel = Model.selCount(st, sel) > 0;
    list.forEach(function (d) {
      var card = h('div', 'pcard'), info = h('div', 'pinfo');
      var nm = h('div', 'nm'); nm.appendChild(h('span', '', d.name)); nm.appendChild(h('span', 'badge', 'Plantilla'));
      info.appendChild(nm); info.appendChild(h('div', 'sm', Pres.summary(d) + (d.builtin ? ' · incluida' : '')));
      var act = h('div', 'pact');
      var use = h('button', 'pill small', 'Aplicar a selección'); use.type = 'button'; use.disabled = !hasSel; use.title = hasSel ? '' : 'Elige palabras en el Editor primero';
      use.addEventListener('click', function () { applyPres(d.id); });
      act.appendChild(use);
      var fav = btn('iconBtn' + (d.fav ? ' on' : ''), '', function () { pstore.toggleFav(d.id); renderPres(); }, 'star'); fav.title = 'Favorita';
      var ren = btn('iconBtn', '', function () {
        var inp = h('input', 'ren'); inp.type = 'text'; inp.value = d.name; nm.firstChild.replaceWith(inp); inp.focus(); inp.select();
        var fin = function () { pstore.rename(d.id, inp.value); renderPres(); };
        inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { fin(); } if (ev.key === 'Escape') { renderPres(); } });
        inp.addEventListener('blur', fin);
      }, 'pencil'); ren.title = 'Renombrar';
      var dup = btn('iconBtn', '', function () { pstore.duplicate(d.id); renderPres(); }, 'copy'); dup.title = 'Duplicar';
      var exp = btn('iconBtn', '', function () {
        saveText((d.name.replace(/[^\w\- ]+/g, '') || 'presentacion') + '.escpres', pstore.exportJSON(d.id), 'escpres', function (ok, p) { say(ok ? 'Exportada: ' + p : 'No se pudo guardar el archivo.', ok ? 'ok' : 'err', 'msgPres'); });
      }, 'export'); exp.title = 'Exportar a archivo';
      var del = btn('iconBtn', '', function () {
        if (del.getAttribute('data-sure') === '1') { pstore.remove(d.id); renderPres(); } else { del.setAttribute('data-sure', '1'); del.title = 'Pulsa otra vez para borrar'; del.style.color = 'var(--red)'; setTimeout(function () { del.removeAttribute('data-sure'); del.style.color = ''; }, 2500); }
      }, 'trash'); del.title = 'Borrar';
      [fav, ren, dup, exp, del].forEach(function (b) { act.appendChild(b); });
      info.appendChild(act); card.appendChild(thumb(d)); card.appendChild(info); ul.appendChild(card);
    });
  }

  function applyPres(id) {
    var n = 0;
    mutate(function () { n = Model.applyPresentation(st, sel, id); });
    var d = pstore.get(id);
    say(n ? 'Plantilla “' + d.name + '” aplicada. Se crea al generar.' : 'Elige palabras primero.', n ? 'ok' : 'err');
  }

  function savePresentation() {
    if (!hasAE()) { say('Abre este panel dentro de After Effects.', 'err', 'msgPres'); return; }
    say('Leyendo las capas seleccionadas…', '', 'msgPres');
    ensureHost(function (ok) {
      if (!ok) { say('No pude cargar el motor en After Effects.', 'err', 'msgPres'); return; }
      evalAE('ES_capture()', function (r) {
        var o = parseJSON(r);
        if (!o) { say('Respuesta inesperada de After Effects: ' + r, 'err', 'msgPres'); return; }
        if (!o.ok) { say(o.msg, 'err', 'msgPres'); return; }
        ui.pendingDef = o.def;
        var msg = o.def.layers.length + ' capas leídas' + (o.skipped ? ' (' + o.skipped + ' ignoradas: solo se guardan texto y formas)' : '') + '. Ponle nombre:';
        say(msg, 'ok', 'msgPres');
        $('presName').hidden = false; $('presNameIn').value = ''; $('presNameIn').focus();
      });
    });
  }

  // ================= biblioteca de composiciones =================
  var lib = { items: [], groups: [], root: '', loaded: false, mode: 'comp', state: null, group: '*' };
  function fileUrl(p) { return encodeURI('file:///' + String(p).replace(/\\/g, '/').replace(/^\/+/, '')) + '?v=' + Date.now(); }
  function fmtDur(d) { return (Math.round(d * 10) / 10).toString().replace('.', ',') + ' s'; }
  function loadLib() {
    if (!hasAE()) { renderComps(); return; }
    ensureHost(function (ok) {
      if (!ok) { renderComps(); return; }
      evalAE('ES_libList()', function (r) {
        var o = parseJSON(r);
        if (o && o.ok) {
          lib.items = o.items.sort(function (a, b) { return b.created - a.created; }); lib.root = o.root; lib.groups = o.groups || [];
          if (lib.group !== '*' && lib.group !== '' && !groupById(lib.group)) { lib.group = '*'; }
        }
        lib.loaded = true; renderComps();
      });
    });
  }
  function libCall(fn, arg, cb) {
    ensureHost(function (ok) {
      if (!ok) { say('No se pudo conectar con After Effects.', 'err', 'msgLib'); return; }
      evalAE(fn + '(' + (arg === undefined ? '' : JSON.stringify(arg)) + ')', function (r) { var o = parseJSON(r); cb(o || { ok: false, msg: 'Respuesta inesperada: ' + r }); });
    });
  }
  // ---------- grupos (Idealo, APPLEXBY...) ----------
  function groupById(id) { var i; for (i = 0; i < lib.groups.length; i++) { if (lib.groups[i].id === id) { return lib.groups[i]; } } return null; }
  function groupOf(it) { return it.group && groupById(it.group) ? it.group : ''; }
  function saveGroups(cb) {
    libCall('ES_libGroupsSave', JSON.stringify({ groups: lib.groups }), function (o) {
      if (!o.ok) { say(o.msg, 'err', 'msgLib'); return; }
      if (o.moved) { lib.items.forEach(function (it) { if (it.group && !groupById(it.group)) { it.group = ''; } }); }
      if (cb) { cb(o); } renderComps();
    });
  }
  function setItemGroup(ids, gid) {
    libCall('ES_libSetGroup', JSON.stringify({ ids: ids, group: gid }), function (o) {
      if (!o.ok) { say(o.msg, 'err', 'msgLib'); return; }
      lib.items.forEach(function (it) { if (ids.indexOf(it.id) >= 0) { it.group = gid; } });
      var g = groupById(gid);
      say(g ? 'Movido a “' + g.name + '”.' : 'Movido a Sin grupo.', 'ok', 'msgLib'); renderComps();
    });
  }
  function groupNameInput(start, onDone) {
    var inp = h('input', 'grpIn'); inp.type = 'text'; inp.value = start || ''; inp.placeholder = 'Nombre del grupo'; inp.maxLength = 40;
    var done = false;
    var fin = function (ok) { if (done) { return; } done = true; var v = inp.value.replace(/^\s+|\s+$/g, ''); onDone(ok && v ? v : ''); };
    inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { fin(true); } if (ev.key === 'Escape') { fin(false); } ev.stopPropagation(); });
    inp.addEventListener('blur', function () { fin(true); });
    setTimeout(function () { inp.focus(); inp.select(); }, 0);
    return inp;
  }
  function newGroup(name) {
    var g = { id: 'g' + Date.now().toString(36), name: name };
    lib.groups.push(g); return g;
  }
  function renderGroupBar() {
    var bar = $('grpBar'); bar.innerHTML = '';
    var count = function (gid) { return lib.items.filter(function (it) { return gid === '*' ? true : groupOf(it) === gid; }).length; };
    var chip = function (gid, label) {
      var b = btn('opt grp' + (lib.group === gid ? ' on' : ''), '', function () { lib.group = gid; renderComps(); });
      b.appendChild(h('span', '', label)); b.appendChild(h('small', '', String(count(gid))));
      b.setAttribute('aria-pressed', lib.group === gid ? 'true' : 'false');
      if (gid !== '*') {
        b.addEventListener('dragover', function (ev) { if (ui.libDrag) { ev.preventDefault(); b.classList.add('drop'); } });
        b.addEventListener('dragleave', function () { b.classList.remove('drop'); });
        b.addEventListener('drop', function (ev) { ev.preventDefault(); b.classList.remove('drop'); if (ui.libDrag) { setItemGroup([ui.libDrag], gid); ui.libDrag = null; } });
      }
      bar.appendChild(b); return b;
    };
    chip('*', 'Todas');
    lib.groups.forEach(function (g) {
      var b = chip(g.id, g.name);
      if (lib.group === g.id && ui.renGroup === g.id) {
        b.replaceWith(groupNameInput(g.name, function (v) { ui.renGroup = null; if (v && v !== g.name) { g.name = v; saveGroups(); } else { renderComps(); } }));
      }
    });
    if (lib.groups.length && count('') > 0) { chip('', 'Sin grupo'); }
    if (ui.addGroup) {
      bar.appendChild(groupNameInput('', function (v) {
        ui.addGroup = false;
        if (!v) { renderComps(); return; }
        var g = newGroup(v); lib.group = g.id; saveGroups(function () { say('Grupo “' + v + '” creado. Arrastra composiciones a él o guárdalas directamente ahí.', 'ok', 'msgLib'); });
      }));
    } else {
      var add = btn('opt add', 'Grupo', function () { ui.addGroup = true; renderComps(); }, 'plus'); add.title = 'Crear un grupo (por ejemplo: Idealo, APPLEXBY)';
      bar.appendChild(add);
    }
    var cur = groupById(lib.group);
    if (cur) {
      var tools = h('span', 'grpTools');
      var rn = btn('iconBtn', '', function () { ui.renGroup = cur.id; renderComps(); }, 'pencil'); rn.title = 'Renombrar el grupo'; rn.setAttribute('aria-label', 'Renombrar el grupo ' + cur.name);
      var del = btn('iconBtn', '', function () {
        if (del.getAttribute('data-sure') === '1') {
          lib.groups = lib.groups.filter(function (g) { return g.id !== cur.id; }); lib.group = '*';
          saveGroups(function () { say('Grupo “' + cur.name + '” borrado. Sus composiciones pasaron a Sin grupo.', 'ok', 'msgLib'); });
        } else { del.setAttribute('data-sure', '1'); del.classList.add('danger'); del.title = 'Pulsa otra vez: el grupo se borra y sus composiciones quedan en Sin grupo'; setTimeout(function () { del.removeAttribute('data-sure'); del.classList.remove('danger'); del.title = 'Borrar el grupo'; }, 2500); }
      }, 'trash'); del.title = 'Borrar el grupo'; del.setAttribute('aria-label', 'Borrar el grupo ' + cur.name);
      tools.appendChild(rn); tools.appendChild(del); bar.appendChild(tools);
    }
    bar.hidden = !lib.items.length && !lib.groups.length;
  }
  function groupPop(anchor, it) {
    closeGroupPop();
    var pop = h('div', 'grpPop'); pop.id = 'grpPop'; pop.setAttribute('role', 'menu');
    pop.appendChild(h('div', 'lab', 'Mover a'));
    var opts = lib.groups.map(function (g) { return [g.id, g.name]; }); opts.push(['', 'Sin grupo']);
    opts.forEach(function (o) {
      var b = btn('it' + (groupOf(it) === o[0] ? ' on' : ''), o[1], function () { closeGroupPop(); if (groupOf(it) !== o[0]) { setItemGroup([it.id], o[0]); } });
      b.setAttribute('role', 'menuitem'); pop.appendChild(b);
    });
    var nb = btn('it', 'Nuevo grupo…', function () {
      nb.replaceWith(groupNameInput('', function (v) {
        closeGroupPop(); if (!v) { return; }
        var g = newGroup(v); saveGroups(function () { setItemGroup([it.id], g.id); });
      }));
    }, 'plus');
    pop.appendChild(nb);
    document.body.appendChild(pop);
    var r = anchor.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    pop.style.left = Math.max(6, Math.min(window.innerWidth - pw - 6, r.right - pw)) + 'px';
    pop.style.top = (r.bottom + 4 + ph > window.innerHeight ? Math.max(6, r.top - ph - 4) : r.bottom + 4) + 'px';
    setTimeout(function () { document.addEventListener('mousedown', groupPopOutside, true); }, 0);
  }
  function groupPopOutside(ev) { var p = $('grpPop'); if (p && !p.contains(ev.target)) { closeGroupPop(); } }
  function closeGroupPop() { var p = $('grpPop'); if (p) { p.remove(); } document.removeEventListener('mousedown', groupPopOutside, true); }

  function compCard(it) {
      var card = h('div', 'ccard');
      card.draggable = !!lib.groups.length;
      card.addEventListener('dragstart', function (ev) { ui.libDrag = it.id; try { ev.dataTransfer.setData('text/plain', it.name); ev.dataTransfer.effectAllowed = 'move'; } catch (e) {} card.classList.add('dragging'); });
      card.addEventListener('dragend', function () { ui.libDrag = null; card.classList.remove('dragging'); });
      var th = h('div', 'cthumb');
      if (it.thumb) { var im = h('img'); im.src = fileUrl(it.thumb); im.alt = ''; im.draggable = false; im.onerror = function () { im.remove(); }; th.appendChild(im); }
      else { th.appendChild(icon('comp')); }
      th.style.aspectRatio = it.w && it.h ? (it.w + ' / ' + it.h) : '';
      th.title = 'Doble clic: insertar en la composición activa';
      th.addEventListener('dblclick', function () { libInsert(it, 'insert'); });
      var nm = h('div', 'cname', it.name); nm.title = it.name;
      var meta = h('div', 'cmeta', (it.w ? it.w + '×' + it.h + ' · ' : '') + (it.dur ? fmtDur(it.dur) : '') + (it.files ? ' · ' + it.files + (it.files === 1 ? ' archivo' : ' archivos') : ''));
      var act = h('div', 'cact');
      var ins = h('button', 'pill small', 'Insertar'); ins.type = 'button'; ins.title = 'Añadir como capa en la composición activa, en el tiempo actual';
      ins.addEventListener('click', function () { libInsert(it, 'insert'); });
      act.appendChild(ins);
      var op = h('button', 'pill ghost small', 'Abrir'); op.type = 'button'; op.title = 'Abrir para editar'; op.addEventListener('click', function () { libInsert(it, 'open'); });
      var rn = btn('iconBtn', '', function () {
        var inp = h('input', 'ren'); inp.type = 'text'; inp.value = it.name; nm.replaceWith(inp); inp.focus(); inp.select();
        var done = false;
        var fin = function () { if (done) { return; } done = true; var v = inp.value.replace(/^\s+|\s+$/g, '') || it.name; libCall('ES_libRename', JSON.stringify({ id: it.id, name: v }), function () { it.name = v; renderComps(); }); };
        inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { fin(); } if (ev.key === 'Escape') { done = true; renderComps(); } ev.stopPropagation(); });
        inp.addEventListener('blur', fin);
      }, 'pencil'); rn.title = 'Renombrar'; rn.setAttribute('aria-label', 'Renombrar ' + it.name);
      var gb = btn('iconBtn grpBtn', '', function () { groupPop(gb, it); }, 'tag'); gb.title = 'Mover a un grupo'; gb.setAttribute('aria-label', 'Mover ' + it.name + ' a un grupo');
      var fo = btn('iconBtn', '', function () { libCall('ES_libReveal', it.id, function () {}); }, 'folder'); fo.title = 'Mostrar en la carpeta';
      var del = btn('iconBtn', '', function () {
        if (del.getAttribute('data-sure') === '1') { libCall('ES_libDelete', it.id, function (o) { if (o.ok) { lib.items = lib.items.filter(function (x) { return x.id !== it.id; }); renderComps(); say('“' + it.name + '” borrado de la biblioteca.', 'ok', 'msgLib'); } }); }
        else { del.setAttribute('data-sure', '1'); del.classList.add('danger'); del.title = 'Pulsa otra vez para borrar'; setTimeout(function () { del.removeAttribute('data-sure'); del.classList.remove('danger'); del.title = 'Borrar'; }, 2500); }
      }, 'trash'); del.title = 'Borrar';
      [op, gb, rn, fo, del].forEach(function (b) { act.appendChild(b); });
      card.appendChild(th); card.appendChild(nm); card.appendChild(meta); card.appendChild(act);
      return card;
  }
  function renderComps() {
    var g = $('compGrid'), q = ($('libSearch').value || '').toLowerCase(); g.innerHTML = '';
    closeGroupPop();
    if (!hasAE()) { $('grpBar').hidden = true; g.appendChild(h('p', 'hint', 'Abre este panel dentro de After Effects para usar la biblioteca.')); return; }
    renderGroupBar();
    var list = lib.items.filter(function (it) { return (!q || String(it.name).toLowerCase().indexOf(q) >= 0) && (lib.group === '*' || groupOf(it) === lib.group); });
    $('libSearch').hidden = lib.items.length < 4;
    if (!lib.items.length) {
      var e = h('div', 'libEmpty');
      e.appendChild(icon('comp'));
      e.appendChild(h('b', '', 'Tu biblioteca está vacía'));
      e.appendChild(h('span', '', 'Abre una composición (o selecciona capas) y pulsa “Guardar composición”. Se guarda con sus precomposiciones y archivos, y la puedes insertar en cualquier proyecto.'));
      g.appendChild(e); return;
    }
    if (lib.group === '*' && lib.groups.length && !q) {
      // todas, ordenadas por grupo
      var sec = lib.groups.map(function (gr) { return [gr.id, gr.name]; }); sec.push(['', 'Sin grupo']);
      sec.forEach(function (sg) {
        var its = list.filter(function (it) { return groupOf(it) === sg[0]; });
        if (!its.length) { return; }
        var hd = h('button', 'grpHead'); hd.type = 'button'; hd.appendChild(h('b', '', sg[1])); hd.appendChild(h('small', '', its.length + (its.length === 1 ? ' composición' : ' composiciones')));
        hd.title = 'Ver solo este grupo'; hd.addEventListener('click', function () { lib.group = sg[0]; renderComps(); });
        g.appendChild(hd);
        its.forEach(function (it) { g.appendChild(compCard(it)); });
      });
      return;
    }
    list.forEach(function (it) { g.appendChild(compCard(it)); });
    if (!list.length) {
      if (q) { g.appendChild(h('p', 'hint', 'Nada coincide con “' + q + '”.')); }
      else { g.appendChild(h('p', 'hint', 'Este grupo está vacío. Arrastra una composición sobre su nombre, usa el botón de etiqueta de cada composición o guarda una nueva aquí.')); }
    }
  }
  function libInsert(it, mode) {
    say(mode === 'insert' ? 'Insertando “' + it.name + '”…' : 'Abriendo “' + it.name + '”…', '', 'msgLib');
    libCall('ES_libInsert', JSON.stringify({ id: it.id, mode: mode }), function (o) { say(o.msg, o.ok ? 'ok' : 'err', 'msgLib'); refreshComp(); });
  }
  function openCompSave() {
    if (!hasAE()) { say('Abre este panel dentro de After Effects.', 'err', 'msgLib'); return; }
    libCall('ES_libState', undefined, function (o) {
      if (!o.ok) { say(o.msg, 'err', 'msgLib'); return; }
      if (!o.hasComp) { say('Abre la composición que quieres guardar (doble clic en ella en el panel Proyecto).', 'err', 'msgLib'); return; }
      lib.state = o; lib.mode = o.sel ? 'selection' : 'comp';
      var box = $('compMode'); box.innerHTML = '';
      [['comp', 'Composición activa', '“' + o.comp + '” completa'], ['selection', 'Capas seleccionadas', o.sel ? o.sel + (o.sel === 1 ? ' capa: se precompone' : ' capas: se precomponen') : 'no hay capas seleccionadas']].forEach(function (c) {
        var b = h('button', 'choiceBtn' + (lib.mode === c[0] ? ' on' : '')); b.type = 'button'; b.disabled = c[0] === 'selection' && !o.sel;
        b.appendChild(h('b', '', c[1])); b.appendChild(h('small', '', c[2]));
        b.addEventListener('click', function () { lib.mode = c[0]; openCompSaveRefresh(); });
        box.appendChild(b);
      });
      $('compName').value = o.comp;
      var gs = $('compGroup'); gs.innerHTML = '';
      [['', 'Sin grupo']].concat(lib.groups.map(function (gr) { return [gr.id, gr.name]; })).concat([['__new', 'Nuevo grupo…']]).forEach(function (x) {
        var op = h('option', '', x[1]); op.value = x[0]; gs.appendChild(op);
      });
      gs.value = groupById(lib.group) ? lib.group : '';
      $('compNewGroup').hidden = true; $('compNewGroup').value = '';
      openCompSaveRefresh();
      $('compSave').hidden = false; $('compName').focus(); $('compName').select();
    });
  }
  function openCompSaveRefresh() {
    var o = lib.state, bs = $('compMode').querySelectorAll('.choiceBtn'), i;
    for (i = 0; i < bs.length; i++) { bs[i].classList.toggle('on', i === (lib.mode === 'comp' ? 0 : 1)); }
    var note = '';
    if (!o.saved) { note = 'Tu proyecto aún no tiene archivo: guárdalo primero en After Effects (Archivo ▸ Guardar).'; }
    else { note = 'Se guardará tu proyecto “' + o.project + '” antes de copiar' + (lib.mode === 'selection' ? ' (con la nueva precomposición)' : '') + '. Las imágenes y videos que use se copian dentro del elemento.'; }
    $('compNote').textContent = note;
    $('compSaveOk').disabled = !o.saved;
  }
  function closeCompSave() { $('compSave').hidden = true; }
  function doCompSave() {
    var name = $('compName').value.replace(/^\s+|\s+$/g, '');
    if (!name) { $('compName').focus(); return; }
    var gsel = $('compGroup'), gid = gsel.value;
    if (gid === '__new') {
      var nameIn = $('compNewGroup'), gv = nameIn ? nameIn.value.replace(/^\s+|\s+$/g, '') : '';
      if (!gv) { if (nameIn) { nameIn.focus(); } return; }
      var ng = newGroup(gv); gid = ng.id;
      libCall('ES_libGroupsSave', JSON.stringify({ groups: lib.groups }), function () {});
    }
    $('compSaveOk').disabled = true; say('Guardando “' + name + '”… After Effects puede tardar unos segundos.', '', 'msgLib');
    libCall('ES_libSave', JSON.stringify({ name: name, mode: lib.mode, group: gid }), function (o) {
      $('compSaveOk').disabled = false;
      if (!o.ok) { say(o.msg, 'err', 'msgLib'); return; }
      closeCompSave();
      say('“' + o.name + '” guardado en la biblioteca' + (o.files ? ' con ' + o.files + (o.files === 1 ? ' archivo' : ' archivos') : '') + '.', 'ok', 'msgLib');
      loadLib();
    });
  }

  // ================= historial y cambios =================
  var future = [];
  function snap() { history.push(JSON.stringify(st)); if (history.length > 80) { history.shift(); } future = []; }
  function persistEdit() { try { localStorage.setItem('escaleraSubs3.edit', JSON.stringify(st)); } catch (e) {} }
  function mutate(fn) { snap(); fn(); ui.lastMut = Date.now(); persistEdit(); render(); }
  function afterRestore() {
    Model.reseed(st);
    var keep = {}, k; for (k in sel.m) { if (Model.find(st, parseInt(k, 10))) { keep[k] = true; } } sel.m = keep;
    persistEdit(); render();
  }
  function undo() {
    if (!history.length) { say('No hay nada que deshacer.'); return; }
    future.push(JSON.stringify(st)); st = JSON.parse(history.pop()); afterRestore();
  }
  function redo() {
    if (!future.length) { say('No hay nada que rehacer.'); return; }
    history.push(JSON.stringify(st)); st = JSON.parse(future.pop()); afterRestore();
  }

  // ================= editor: frases y burbujas =================
  var ALIGNS = ['', 'center', 'stair', 'zigzag', 'left', 'right'];
  var ALIGN_NAME = { '': 'Automático', auto: 'Automático', center: 'Centrado', stair: 'Escalera', zigzag: 'Zigzag', left: 'Izquierda', right: 'Derecha' };

  function fmtTime(t) {
    var m = Math.floor(t / 60), s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
  }
  function wordTip(w) {
    var c = w.c, p = [];
    p.push('Tamaño ' + c.size + (c.brand ? ' · ★ palabra clave' : ''));
    if (c.color) { p.push('color ' + c.color); }
    if (c.font) { p.push('fuente ' + fontLabelOf(c.font)); }
    if (c.trans) { p.push('entrada: ' + ES.TRANS[c.trans].name); }
    if (c.fmt) { p.push(c.fmt === 'box' ? 'caja' : 'subrayado'); }
    if (c.glow) { p.push('brillo'); }
    if (c.sfx) { var s = soundById(c.sfx); p.push('sonido: ' + (s ? s.name : c.sfx)); }
    return p.join(' · ') + '  (' + fmtTime(w.start) + ')';
  }

  // frase activa = la de la ultima palabra tocada (la que se ve en la vista previa)
  function activeSi() {
    var f = ui.activeId != null ? Model.find(st, ui.activeId) : null;
    if (f) { return f.si; }
    var ws = Model.selWords(st, sel);
    if (ws.length) { return ws[0].si; }
    return st.seqs.length ? Math.min(ui.activeSi || 0, st.seqs.length - 1) : -1;
  }
  function setActiveSeq(si) {
    if (!st.seqs[si]) { return; }
    ui.activeSi = si; ui.activeId = st.seqs[si].words[0].id;
  }

  function chipEl(w, seq) {
    var c = w.c, cl = 'chip ' + c.size + (c.brand ? ' brand' : '') + (c.fmt ? ' fmt' : '') + (c.glow ? ' glow' : '') + (c.br ? ' br' : '') + (Model.isSel(sel, w.id) ? ' sel' : '');
    var b = h('button', cl); b.type = 'button'; b.setAttribute('data-id', w.id); b.draggable = true; b.title = wordTip(w);
    b.setAttribute('aria-pressed', Model.isSel(sel, w.id) ? 'true' : 'false');
    if (c.brand) { var star = icon('star'); star.setAttribute('class', 'ic st'); b.appendChild(star); }
    var tx = h('span', '', ES.displayText(w.text, c, S.upper));
    applyFontStyle(tx, c.font || S.font); b.appendChild(tx);
    if (c.color) { var d = h('span', 'dot'); d.style.background = c.color; b.appendChild(d); }
    if (c.glow) { b.style.setProperty('--gc', c.glowColor || S.glowColor); }
    var ic = [];
    if (c.trans) { ic.push('motion'); }
    if (c.sfx) { ic.push('speaker'); }
    if (ic.length) { var bb = h('span', 'b'); ic.forEach(function (n) { bb.appendChild(icon(n)); }); b.appendChild(bb); }

    b.addEventListener('click', function (ev) {
      Model.click(st, sel, w.id, { ctrl: ev.ctrlKey || ev.metaKey, shift: ev.shiftKey });
      ui.activeId = w.id; render();
    });
    b.addEventListener('contextmenu', function (ev) {
      ev.preventDefault();
      Model.contextTarget(st, sel, w.id); ui.activeId = w.id; render();
      openMenu(ev.clientX, ev.clientY, {});
    });
    b.addEventListener('dblclick', function (ev) {
      ev.preventDefault(); Model.click(st, sel, w.id, {}); ui.activeId = w.id; render();
      openMenu(ev.clientX, ev.clientY, { sub: 'edit' });
    });
    b.addEventListener('dragstart', function (ev) {
      var ids = Model.isSel(sel, w.id) ? Model.selWords(st, sel).map(function (x) { return x.w.id; }) : [w.id];
      ui.drag = ids; document.body.classList.add('dragging'); closeMenu();
      try { ev.dataTransfer.setData('text/plain', 'escalera'); ev.dataTransfer.effectAllowed = 'move'; } catch (e) {}
      setTimeout(function () { ids.forEach(function (i) { var e = document.querySelector('.chip[data-id="' + i + '"]'); if (e) { e.classList.add('dragged'); } }); }, 0);
    });
    b.addEventListener('dragend', endDrag);
    b.addEventListener('dragover', function (ev) {
      if (!ui.drag) { return; }
      ev.preventDefault(); ev.stopPropagation();
      clearDropMarks(); var r = b.getBoundingClientRect(), left = ev.clientX < r.left + r.width / 2;
      var target = beforeIdFor(seq, w.id, left);
      ui.dropInfo = { seq: seq, before: target };
      if (target != null) { var tEl = document.querySelector('.chip[data-id="' + target + '"]'); if (tEl) { tEl.classList.add('dropBefore'); } }
      else { b.parentNode.parentNode.classList.add('dropHere'); }
    });
    b.addEventListener('drop', function (ev) { ev.preventDefault(); ev.stopPropagation(); doDrop(); });
    return b;
  }
  function beforeIdFor(seq, id, left) {
    var i;
    for (i = 0; i < seq.words.length; i++) {
      if (seq.words[i].id === id) { return left ? id : (seq.words[i + 1] ? seq.words[i + 1].id : null); }
    }
    return null;
  }
  function clearDropMarks() {
    var els = document.querySelectorAll('.dropBefore,.dropHere,.gap.over'), i;
    for (i = 0; i < els.length; i++) { els[i].classList.remove('dropBefore'); els[i].classList.remove('dropHere'); els[i].classList.remove('over'); }
  }
  function endDrag() { ui.drag = null; ui.dropInfo = null; document.body.classList.remove('dragging'); clearDropMarks(); render(); }
  function doDrop() {
    var ids = ui.drag, di = ui.dropInfo; ui.drag = null; ui.dropInfo = null;
    document.body.classList.remove('dragging'); clearDropMarks();
    if (!ids || !di) { render(); return; }
    mutate(function () {
      if (di.newAt !== undefined) { Model.moveToNewSeq(st, ids, di.newAt); } else { Model.moveWords(st, ids, di.seq, di.before); }
    });
    ui.activeId = ids[0];
    flash(ids);
    say(ids.length === 1 ? 'Palabra movida.' : ids.length + ' palabras movidas.', 'ok');
  }
  function flash(ids) {
    setTimeout(function () { ids.forEach(function (i) { var e = document.querySelector('.chip[data-id="' + i + '"]'); if (e) { e.classList.add('flash'); } }); }, 0);
  }

  function gapEl(index) {
    var g = h('div', 'gap'); g.setAttribute('data-gap', index);
    g.addEventListener('dragover', function (ev) { if (!ui.drag) { return; } ev.preventDefault(); clearDropMarks(); g.classList.add('over'); ui.dropInfo = { newAt: index }; });
    g.addEventListener('drop', function (ev) { ev.preventDefault(); doDrop(); });
    return g;
  }

  function render() {
    if (!st.seqs.length && ui.step !== 'texto') { ui.step = 'texto'; }
    $('tab-editor').classList.toggle('fit', ui.step === 'diseno' && !!st.seqs.length);
    renderStepper();
    if (ui.step === 'texto') { renderTexto(); }
    else if (ui.step === 'frases') { renderFrases(); }
    else if (ui.step === 'diseno') { renderDiseno(); }
    else if (ui.step === 'generar') { renderGenerar(); }
    updateButtons();
    if (ui.tab === 'library') { if (ui.lib === 'snd') { renderSounds(); } else if (ui.lib === 'pres') { renderPres(); } }
  }
  // paso 3: todas las frases (la activa resaltada y en la vista previa) + el panel de ajustes abajo
  function renderDiseno() {
    var box = $('seqs'), act = activeSi();
    box.innerHTML = '';
    if (act >= 0) {
      box.appendChild(gapEl(0));
      st.seqs.forEach(function (seq, si) {
        var k = seq.pres ? 'pres' : Model.effStyle(seq, S);
        var row = h('div', 'seq ' + (STYLE_CLS[k] || 'pr') + (si === act ? ' active' : '') + (seq.pres ? ' pres' : '')); row.setAttribute('data-si', si);
        var lead = h('div', 'lead');
        var num = h('button', 'num', String(si + 1)); num.type = 'button';
        num.title = 'Elegir toda la frase (Ctrl suma)'; num.setAttribute('aria-label', 'Elegir la frase ' + (si + 1));
        num.addEventListener('click', function (ev) { Model.selectSeq(st, sel, si, ev.ctrlKey || ev.metaKey || ev.shiftKey); setActiveSeq(si); ui.activeId = seq.words[0].id; render(); });
        lead.appendChild(num); lead.appendChild(h('span', 'tc', fmtClock(seq.start)));
        row.appendChild(lead);
        var chips = h('div', 'chips');
        seq.words.forEach(function (w) { chips.appendChild(chipEl(w, seq)); });
        row.appendChild(chips);
        row.appendChild(h('span', 'tag sm ' + (STYLE_CLS[k] || 'pr'), k === 'pres' ? ((pstore.get(seq.pres) || {}).name || 'Plantilla') : STYLE_NAME[k]));
        row.addEventListener('click', function (ev) { if (ev.target === row || ev.target === chips) { stopPlay(); setActiveSeq(si); render(); } });
        row.addEventListener('dragover', function (ev) { if (!ui.drag) { return; } ev.preventDefault(); clearDropMarks(); row.classList.add('dropHere'); ui.dropInfo = { seq: seq, before: null }; });
        row.addEventListener('drop', function (ev) { ev.preventDefault(); doDrop(); });
        box.appendChild(row);
        box.appendChild(gapEl(si + 1));
      });
    }
    renderInspector(); drawPreview();
    if (ui.scrollAct !== act) { ui.scrollAct = act; var ae = box.querySelector('.seq.active'); if (ae) { ae.scrollIntoView({ block: 'nearest' }); } }
  }

  // ----- barra de seleccion con acciones rapidas -----
  function qBtn(label, title, on, fn, cls, ic) {
    var b = h('button', 'q' + (on ? ' on' : '') + (cls ? ' ' + cls : '')); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (ic) { b.appendChild(icon(ic)); }
    if (label) { b.appendChild(document.createTextNode(label)); }
    b.addEventListener('click', function (ev) { ev.stopPropagation(); fn(ev); });
    return b;
  }
  function placeSelBar() {}
  function renderSelBar() { if (ui.step === 'diseno') { renderInspector(); } }
  var INSP_TABS = [['anim', 'Animación'], ['style', 'Estilo'], ['color', 'Color'], ['font', 'Fuente'], ['sound', 'Sonido'], ['pres', 'Plantilla'], ['remove', 'Quitar']];
  function renderInspector() {
    var box = $('insp'), n = Model.selCount(st, sel); box.innerHTML = '';
    if (!st.seqs.length) { return; }
    if (!n) {
      var e = h('div', 'inspEmpty');
      e.appendChild(h('b', '', 'Elige una palabra'));
      e.appendChild(h('span', '', 'Tócala en la lista o en la vista previa. El número elige la frase entera; Ctrl suma varias.'));
      box.appendChild(e); return;
    }
    var u = function (f) { return Model.uniform(st, sel, f); };
    var head = h('div', 'inspHead');
    var ws = Model.selWords(st, sel);
    head.appendChild(h('b', '', n === 1 ? ES.displayText(ws[0].w.text, ws[0].w.c, S.upper) : n + ' palabras'));
    var q = h('div', 'inspQuick');
    ['S', 'M', 'L'].forEach(function (sz) { q.appendChild(qBtn(sz, 'Tamaño ' + sz + ' (tecla ' + ({ S: 1, M: 2, L: 3 })[sz] + ')', u('size') === sz, function () { quick({ size: sz }); })); });
    var br = u('brand') === true; q.appendChild(qBtn('', 'Palabra clave ★ (K)', br, function () { quick({ brand: !br }); }, 'amber', 'star'));
    var bx = u('fmt') === 'box'; q.appendChild(qBtn('', 'Caja (B)', bx, function () { quick({ fmt: bx ? '' : 'box' }); }, '', 'box'));
    var gl = u('glow') === true; q.appendChild(qBtn('', 'Brillo (G)', gl, function () { quick({ glow: !gl }); }, '', 'glow'));
    q.appendChild(qBtn('', 'Soltar selección (Esc)', false, function () { Model.clearSel(sel); render(); }, '', 'x'));
    head.appendChild(q); box.appendChild(head);
    var tabs = h('div', 'inspTabs'); tabs.setAttribute('role', 'tablist');
    INSP_TABS.forEach(function (t) {
      var b = h('button', ui.inspTab === t[0] ? 'on' : '', t[1]); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', ui.inspTab === t[0] ? 'true' : 'false');
      b.addEventListener('click', function () { ui.inspTab = ui.inspTab === t[0] ? '' : t[0]; renderInspector(); });
      tabs.appendChild(b);
    });
    box.appendChild(tabs);
    var after = null;
    if (ui.inspTab && BUILD[ui.inspTab]) {
      var body = h('div', 'inspBody menu inline' + ({ anim: ' grid', sound: ' grid', pres: ' grid' }[ui.inspTab] || ''));
      after = BUILD[ui.inspTab](body);
      box.appendChild(body);
    }
    // a que se aplica
    var scope = h('div', 'inspScope'), si = activeSi(), stl = st.seqs[si] ? Model.effStyle(st.seqs[si], S) : '';
    scope.appendChild(h('span', '', 'Elegir'));
    var b1 = h('button', 'link', 'toda la frase'); b1.type = 'button'; b1.addEventListener('click', function () { Model.selectSeq(st, sel, si, false); render(); });
    var b2 = h('button', 'link', 'todas las de ' + STYLE_NAME[stl].toLowerCase()); b2.type = 'button';
    b2.addEventListener('click', function () {
      Model.clearSel(sel);
      st.seqs.forEach(function (q2, i) { if (!q2.pres && Model.effStyle(q2, S) === stl) { Model.selectSeq(st, sel, i, true); } });
      render(); say('Elegidas todas las frases de ' + STYLE_NAME[stl].toLowerCase() + ': lo que apliques va a todas.', 'ok');
    });
    scope.appendChild(b1); scope.appendChild(h('span', '', '·')); scope.appendChild(b2);
    var look = h('button', 'lookLink'); look.type = 'button'; look.title = 'Aspecto de ' + STYLE_NAME[stl].toLowerCase() + ': tamaños, colores y más';
    look.appendChild(h('i', 'dot ' + (STYLE_CLS[stl] || 'st'))); look.appendChild(h('span', '', 'Aspecto'));
    look.appendChild(icon('chev'));
    look.addEventListener('click', function () { openLook(stl); });
    scope.appendChild(look);
    box.appendChild(scope);
    if (after && ui.inspTab !== 'font') { after(); }
  }
  function quick(patch) { mutate(function () { Model.applyPatch(st, sel, patch); }); }
  function openMenuFrom(el, sub) {
    var r = el.getBoundingClientRect();
    openMenu(r.left, r.top - 6, { above: true, sub: sub });
  }

  function updateButtons() {
    $('btnUndo').disabled = !history.length; $('btnRedo').disabled = !future.length;
  }

  // ----- recuadro de seleccion -----
  (function () {
    var box = $('seqs'), mq = null, start = null, base = null;
    box.addEventListener('mousedown', function (ev) {
      if (ev.button !== 0 || ev.target.closest('.chip,.num,.alignBtn,.presTag')) { return; }
      var r = box.getBoundingClientRect(), additive = ev.ctrlKey || ev.metaKey || ev.shiftKey;
      start = { x: ev.clientX - r.left, y: ev.clientY - r.top };
      base = additive ? JSON.parse(JSON.stringify(sel.m)) : {};
      if (!additive) { Model.clearSel(sel); }
    });
    document.addEventListener('mousemove', function (ev) {
      if (!start) { return; }
      var r = box.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
      if (!mq) { if (Math.abs(x - start.x) + Math.abs(y - start.y) < 5) { return; } mq = h('div', 'marquee'); box.appendChild(mq); }
      var l = Math.min(x, start.x), t = Math.min(y, start.y), w = Math.abs(x - start.x), hh = Math.abs(y - start.y);
      mq.style.left = l + 'px'; mq.style.top = t + 'px'; mq.style.width = w + 'px'; mq.style.height = hh + 'px';
      var ids = [], chips = box.querySelectorAll('.chip'), i;
      for (i = 0; i < chips.length; i++) {
        var cr = chips[i].getBoundingClientRect(), cx0 = cr.left - r.left, cy0 = cr.top - r.top;
        if (cx0 < l + w && cx0 + cr.width > l && cy0 < t + hh && cy0 + cr.height > t) { ids.push(parseInt(chips[i].getAttribute('data-id'), 10)); }
      }
      sel.m = JSON.parse(JSON.stringify(base)); Model.selectIds(sel, ids, true);
      for (i = 0; i < chips.length; i++) { chips[i].classList.toggle('sel', !!sel.m[chips[i].getAttribute('data-id')]); }
    });
    document.addEventListener('mouseup', function () {
      if (!start) { return; }
      start = null; if (mq) { mq.parentNode.removeChild(mq); mq = null; }
      var ws = Model.selWords(st, sel); if (ws.length) { ui.activeId = ws[0].w.id; }
      render();
    });
  })();

  // ================= vista previa (monitor) =================
  var mon = { open: lsGet('escaleraSubs3.mon', true), playing: false, t0: 0, raf: 0, hits: [] };
  var mctx = document.createElement('canvas').getContext('2d');
  function compDims() { return ui.comp && ui.comp.w ? ui.comp : { w: S.compW || 1080, h: S.compH || 1920 }; }
  function cssFont(ps, px, fbWeight) {
    var f = ps ? Model.findFont(fonts, ps) : null;
    if (f) { var c = Model.fontCss(f); return (c.italic ? 'italic ' : '') + c.weight + ' ' + px + 'px "' + c.family + '", "Segoe UI", sans-serif'; }
    // sin la lista de fuentes: se intenta la familia del nombre PostScript (Archivo-Bold -> "Archivo")
    var fam = ps ? '"' + String(ps).split('-')[0].replace(/([a-z])([A-Z])/g, '$1 $2') + '", ' : '';
    return (fbWeight || 800) + ' ' + px + 'px ' + fam + '"Segoe UI", Arial, sans-serif';
  }
  function layoutSeq(si) {
    var seq = st.seqs[si], comp = compDims(), W = comp.w, H = comp.h, cls = [], words = [];
    seq.words.forEach(function (w) { var c = ES.normalizeClass(w.c); cls.push(c); words.push({ text: ES.displayText(w.text, c, S.upper) }); });
    var safe = { x0: W * S.marginX / 100, x1: W * (1 - S.marginX / 100), y0: H * S.zoneTop / 100, y1: H * S.zoneBottom / 100 };
    var measure = function (text, px, font) { mctx.font = cssFont(font || S.font, px); return mctx.measureText(text).width; };
    var base = { sizes: { S: S.szS, M: S.szM, L: S.szL }, gap: S.gapPx, lineGap: S.lineGap, align: seq.align || S.align,
      alignIndex: si, safe: safe, centerX: W / 2, centerY: H * S.centerY / 100, fit: S.fit !== false, smallAlign: 'top', boxPad: { x: 14, y: 8 } };
    var style = seq.style || S.editStyle, karaoke = style === 'karaoke', lay, keys = null;
    if (ES.isLineStyle(style)) {
      var A = Model.lineLook(S, style), af = A.font || S.font;
      var am = function (text, px, font) { return trackedWidth(text, cssFont(font || af, px, 700), px, A.track); };
      var aw = []; seq.words.forEach(function (w, j) { aw.push({ text: lineText(w.text, cls[j], A) }); });
      lay = ES.layoutLine(aw, cls, { size: A.size, gap: A.size * A.gap, safe: safe, centerX: W / 2, centerY: H * A.centerY, font: af }, am);
      return { seq: seq, lay: lay, cls: cls, words: aw, safe: safe, W: W, H: H, line: A, font: af };
    }
    if (karaoke) {
      base.karaokeSize = S.karSize || 'M';
      lay = ES.layoutKaraoke(words, cls, base, measure);
      keys = ES.karaokeKeys(lay.boxes, seq.words, { move: S.karMove, padX: 14 * lay.scale, padY: 8 * lay.scale });
    } else { lay = ES.layoutLockup(words, cls, base, measure); }
    return { seq: seq, lay: lay, cls: cls, words: words, safe: safe, W: W, H: H, karaoke: karaoke, keys: keys };
  }
  // texto y medida de los estilos de una linea (mismo criterio que After Effects: tracking en milesimas de em)
  function lineText(text, c, A) {
    var t = ES.displayText(text, c, A.caps === 'upper');
    return (A.caps === 'lower' && !c.caps) ? t.toLowerCase() : t;
  }
  function trackedWidth(text, font, px, track) {
    mctx.font = font; var w = mctx.measureText(text).width, n = Array.from(text).length;
    return w + (n > 1 ? (n - 1) * (track || 0) / 1000 * px : 0);
  }
  // dibuja con tracking letra por letra (el canvas del panel no siempre tiene letterSpacing)
  function drawTracked(ctx, text, x, y, px, track, stroke) {
    var ch = Array.from(text), sp = (track || 0) / 1000 * px, i, xs = [], cx = x;
    for (i = 0; i < ch.length; i++) { xs.push(cx); cx += ctx.measureText(ch[i]).width + sp; }
    if (stroke) {
      ctx.save(); ctx.shadowColor = 'transparent'; ctx.lineJoin = 'round'; ctx.miterLimit = 2; ctx.strokeStyle = stroke.colorHex; ctx.lineWidth = stroke.width; // como AE: el contorno va centrado en el borde y la mitad queda bajo el relleno
      for (i = 0; i < ch.length; i++) { ctx.strokeText(ch[i], xs[i], y); }
      ctx.restore();
    }
    if (!sp) { ctx.fillText(text, x, y); return; }
    for (i = 0; i < ch.length; i++) { ctx.fillText(ch[i], xs[i], y); }
  }
  function rr(ctx, x, y, w, hh, r) {
    r = Math.min(r, hh / 2, w / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + hh, r); ctx.arcTo(x + w, y + hh, x, y + hh, r);
    ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function easeOut(p) { return 1 - Math.pow(1 - p, 3); }

  function drawPreview(t) {
    var m = $('monitor');
    m.hidden = !st.seqs.length;
    if (!st.seqs.length || ui.step !== 'diseno') { return; }
    var si = activeSi(), L = layoutSeq(si), seq = L.seq, lay = L.lay;
    var meta = (si + 1) + '/' + st.seqs.length + ' · ' + fmtTime(seq.start) + ' · ' + (L.karaoke ? 'Caja que recorre' : (L.line ? (L.line.style === 'applexby' ? 'APPLEXBY' : 'Una línea') : ALIGN_NAME[lay.align])) + (lay.scale < 0.999 ? ' · reducida ' + Math.round(lay.scale * 100) + '%' : '');
    if (seq.pres) { var pd = pstore.get(seq.pres); meta = 'Frase ' + (si + 1) + ' · plantilla “' + (pd ? pd.name : '?') + '”'; }
    $('monTitle').textContent = 'Frase ' + (si + 1) + ' de ' + st.seqs.length;
    meta = fmtTime(seq.start) + ' · ' + (seq.pres ? 'plantilla' : STYLE_NAME[Model.effStyle(seq, S)]) + (lay.scale < 0.999 && !seq.pres ? ' · reducida ' + Math.round(lay.scale * 100) + '%' : '');
    $('monMeta').textContent = meta; $('monMeta').title = meta;
    $('monPrev').disabled = si <= 0; $('monNext').disabled = si >= st.seqs.length - 1;
    var cv = $('monCanvas'), body = $('monBody'), cw = body.clientWidth || 400, dpr = window.devicePixelRatio || 1;
    var ya = Math.max(0, L.H * (S.zoneTop - 3) / 100), yb = Math.min(L.H, L.H * (S.zoneBottom + 3) / 100);
    var k = cw / L.W, ch = Math.round((yb - ya) * k);
    // la vista previa no se come el panel: alto maximo segun la ventana, centrada
    var maxH = Math.max(100, Math.round((window.innerHeight || 760) * 0.24));
    if (ch > maxH) { k = maxH / (yb - ya); ch = maxH; cw = Math.round(L.W * k); }
    if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); cv.style.height = ch + 'px'; cv.style.width = cw + 'px'; }
    var ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    // fondo tipo video
    var g = ctx.createLinearGradient(0, 0, cv.width, cv.height); g.addColorStop(0, '#34343b'); g.addColorStop(1, '#141416');
    ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(dpr * k, 0, 0, dpr * k, 0, -ya * dpr * k);
    // zona segura
    ctx.save(); ctx.setLineDash([10 / k, 8 / k]); ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1.2 / k;
    ctx.strokeRect(L.safe.x0, L.safe.y0, L.safe.x1 - L.safe.x0, L.safe.y1 - L.safe.y0); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.38)'; ctx.font = '600 ' + (10 / k) + 'px "Segoe UI", sans-serif'; ctx.textBaseline = 'bottom';
    ctx.fillText('zona segura', L.safe.x0 + 4 / k, L.safe.y0 - 3 / k);
    ctx.textBaseline = 'alphabetic';

    mon.hits = [];
    if (seq.pres) { drawPres(ctx, L, k, dpr); return; }
    if (L.karaoke) { drawKaraoke(ctx, L, k, dpr, t, ya); return; }
    if (L.line) { drawLine(ctx, L, k, dpr, t, ya); return; }
    var def = Model.defaultAnim(S), i;
    for (i = 0; i < lay.boxes.length; i++) {
      var bx = lay.boxes[i], c = L.cls[i], text = L.words[i].text, w = seq.words[i];
      var alpha = 1, dx = 0, dy = 0, sc = 1, blur = 0;
      if (t != null) {
        var a = ES.resolveAnim(def, c.trans);
        if (S.animBig && c.size !== 'L' && !c.trans) { a = ES.resolveAnim(def, 'none'); }
        if (!c.trans) { a = ES.fitAnim(a, ES.seqEnd(seq, S.tail, null) - w.start); }
        var rel = t - (w.start - seq.start); if (rel < 0) { continue; }
        var p = a.dur > 0 ? Math.min(1, rel / a.dur) : 1, e = easeOut(p);
        if (a.fade) { alpha = e; }
        var off = (a.dist || 0) * (1 - e);
        if (a.dir === 'up') { dy = off; } else if (a.dir === 'down') { dy = -off; } else if (a.dir === 'left') { dx = off; } else if (a.dir === 'right') { dx = -off; }
        if (a.scale) {
          var from = a.scale.from / 100, over = a.scale.over / 100;
          if (over > 0) { sc = p < 0.65 ? from + (over - from) * easeOut(p / 0.65) : over + (1 - over) * easeOut((p - 0.65) / 0.35); }
          else { sc = from + (1 - from) * e; }
        }
        blur = (a.blur || 0) * (1 - e);
      }
      var cx = bx.x + bx.w / 2, cy = bx.y - bx.size * 0.36;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cx + dx, cy + dy); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
      if (blur > 0.5) { ctx.filter = 'blur(' + (blur * k * 0.6).toFixed(2) + 'px)'; }
      if (c.fmt === 'box' || c.fmt === 'underline') {
        ctx.fillStyle = c.boxColor || S.colHl;
        if (c.fmt === 'box') { rr(ctx, bx.x - 14, bx.y - bx.size * 0.74 - 8, bx.w + 28, bx.size * 0.74 + 16, 18); ctx.fill(); }
        else { var th = Math.max(4, bx.size * 0.09); rr(ctx, bx.x, bx.y + bx.size * 0.16 - th / 2, bx.w, th, th / 2); ctx.fill(); }
      }
      ctx.font = cssFont(c.font || S.font, bx.size);
      if (c.glow) { ctx.shadowColor = c.glowColor || S.glowColor; ctx.shadowBlur = S.glowSize * k * dpr * 0.9; }
      ctx.fillStyle = ES.textColor(c, S.colBase, S.colBrand, S.colHl);
      ctx.fillText(text, bx.x, bx.y);
      if (c.glow) { ctx.fillText(text, bx.x, bx.y); }
      ctx.restore();
      if (t == null && Model.isSel(sel, w.id)) {
        ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5 / k; ctx.setLineDash([]);
        rr(ctx, bx.x - 8, bx.y - bx.size * 0.74 - 6, bx.w + 16, bx.size * 0.74 + 12, 10); ctx.stroke(); ctx.restore();
      }
      mon.hits.push({ id: w.id, x0: (bx.x - 8) * k, x1: (bx.x + bx.w + 8) * k, y0: (bx.y - bx.size * 0.8 - ya) * k, y1: (bx.y + 8 - ya) * k });
    }
  }
  // estilos de una linea: palabra por palabra (APPLEXBY con desenfoque; Una linea con la animacion de la edicion)
  function drawLine(ctx, L, k, dpr, t, ya) {
    var seq = L.seq, lay = L.lay, A = L.line, i, end = ES.seqEnd(seq, S.tail, null) - seq.start;
    var def = Model.defaultAnim(S), base = A.anim ? ES.resolveAnim(def, A.anim) : def;
    mon.hits = [];
    for (i = 0; i < lay.boxes.length; i++) {
      var bx = lay.boxes[i], c = L.cls[i], w = seq.words[i], alpha = 1, blur = 0, dx = 0, dy = 0, sc = 1;
      if (t != null) {
        var a = c.trans ? ES.resolveAnim(def, c.trans) : ES.fitAnim(base, end - (w.start - seq.start));
        var rel = t - (w.start - seq.start); if (rel < 0) { continue; }
        var p = a.dur > 0 ? Math.min(1, rel / a.dur) : 1, e = easeOut(p);
        if (a.fade) { alpha = e; }
        var off = (a.dist || 0) * (1 - e);
        if (a.dir === 'up') { dy = off; } else if (a.dir === 'down') { dy = -off; } else if (a.dir === 'left') { dx = off; } else if (a.dir === 'right') { dx = -off; }
        if (a.scale) { sc = a.scale.from / 100 + (1 - a.scale.from / 100) * e; }
        blur = (a.blur || 0) * (1 - e);
        if (A.exit && t > end - base.dur) {
          var x = Math.min(1, (t - (end - base.dur)) / base.dur);
          if (base.fade) { alpha *= 1 - x * x; }
          blur = Math.max(blur, (base.blur || 0) * x * x);
        }
      }
      var cx = bx.x + bx.w / 2, cy = bx.y - bx.size * 0.36;
      ctx.save(); ctx.globalAlpha = Math.max(0, alpha);
      ctx.translate(cx + dx, cy + dy); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
      if (blur > 0.5) { ctx.filter = 'blur(' + (blur * k * 0.6).toFixed(2) + 'px)'; }
      ctx.font = cssFont(c.font || L.font, bx.size, 700);
      if (A.shadow) {
        ctx.shadowColor = 'rgba(0,0,0,' + (A.shadowLook.opacity / 100).toFixed(2) + ')';
        ctx.shadowBlur = A.shadowLook.softness * k * dpr; ctx.shadowOffsetY = A.shadowLook.distance * k * dpr;
      }
      if (c.glow) { ctx.shadowColor = c.glowColor || S.glowColor; ctx.shadowBlur = S.glowSize * k * dpr * 0.9; ctx.shadowOffsetY = 0; }
      ctx.fillStyle = c.color || (c.brand ? A.keyHex : A.colorHex);
      drawTracked(ctx, L.words[i].text, bx.x, bx.y, bx.size, A.track, A.stroke ? { colorHex: A.stroke.colorHex, width: A.stroke.width * lay.scale } : null);
      ctx.restore();
      if (t == null && Model.isSel(sel, w.id)) {
        ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5 / k;
        rr(ctx, bx.x - 8, bx.y - bx.size * 0.74 - 6, bx.w + 16, bx.size * 0.74 + 12, 10); ctx.stroke(); ctx.restore();
      }
      mon.hits.push({ id: w.id, x0: (bx.x - 8) * k, x1: (bx.x + bx.w + 8) * k, y0: (bx.y - bx.size * 0.8 - ya) * k, y1: (bx.y + 8 - ya) * k });
    }
  }
  // estilo Caja que recorre: toda la frase + la caja en la palabra que suena
  function drawKaraoke(ctx, L, k, dpr, t, ya) {
    var seq = L.seq, lay = L.lay, n = seq.words.length, i, move = S.karMove == null ? 0.12 : S.karMove;
    var abs;
    if (t != null) { abs = seq.start + t; }
    else {
      abs = seq.words[0].start;
      for (i = 0; i < n; i++) { if (Model.isSel(sel, seq.words[i].id)) { abs = seq.words[i].start + 0.001; break; } }
    }
    var cur = -1;
    for (i = 0; i < n; i++) { if (seq.words[i].start - (i ? move / 2 : 0.08) <= abs) { cur = i; } }
    var alpha = t != null ? Math.min(1, Math.max(0, t / 0.15)) : 1;
    if (cur >= 0 && (t == null || abs >= L.keys[0].t - 0.08)) {
      var b = ES.karaokeAt(L.keys, abs), pop = t != null ? Math.min(1, Math.max(0.6, 0.6 + (abs - (L.keys[0].t - 0.08)) / 0.16 * 0.4)) : 1;
      ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = S.karBox || S.colHl;
      rr(ctx, b.cx - b.w * pop / 2, b.cy - b.h * pop / 2, b.w * pop, b.h * pop, (S.karRadius == null ? 14 : S.karRadius) * lay.scale); ctx.fill(); ctx.restore();
    }
    mon.hits = [];
    for (i = 0; i < n; i++) {
      var bx = lay.boxes[i], c = L.cls[i], w = seq.words[i];
      var col = c.color || (c.brand ? S.colBrand : S.colBase);
      if (i === cur) { col = ES.inkOn(col, S.karBox || S.colHl); }
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.font = cssFont(c.font || S.font, bx.size);
      if (c.glow) { ctx.shadowColor = c.glowColor || S.glowColor; ctx.shadowBlur = S.glowSize * k * dpr * 0.9; }
      ctx.fillStyle = col; ctx.fillText(L.words[i].text, bx.x, bx.y);
      ctx.restore();
      if (t == null && Model.isSel(sel, w.id) && i !== cur) {
        ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5 / k;
        rr(ctx, bx.x - 8, bx.y - bx.size * 0.74 - 6, bx.w + 16, bx.size * 0.74 + 12, 10); ctx.stroke(); ctx.restore();
      }
      mon.hits.push({ id: w.id, x0: (bx.x - 8) * k, x1: (bx.x + bx.w + 8) * k, y0: (bx.y - bx.size * 0.8 - ya) * k, y1: (bx.y + 8 - ya) * k });
    }
  }
  // presentacion: miniatura real con las palabras de la frase en sus textos
  function drawPres(ctx, L, k, dpr) {
    var def = pstore.get(L.seq.pres);
    if (!def) { return; }
    var words = L.seq.words.map(function (w) { return { text: ES.displayText(w.text, w.c, def.upper !== false) }; });
    var slots = Pres.assignSlots(def, words), items = Pres.previewItems(def);
    items.forEach(function (it) {
      var x = it.x * L.W, y = it.y * L.H;
      if (it.k === 'text') {
        var sl = slots[it.li] || []; if (!sl.length) { return; }
        var txt = sl.map(function (i) { return words[i].text; }).join(' '), px = it.size * L.W;
        ctx.font = cssFont(S.font, px); ctx.fillStyle = it.color; ctx.textAlign = it.just === 'L' ? 'left' : (it.just === 'R' ? 'right' : 'center');
        ctx.textBaseline = 'middle'; ctx.fillText(txt, x, y); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      } else {
        var w = it.w * L.W, hh = it.h * L.H;
        ctx.fillStyle = it.fill || 'rgba(255,255,255,.2)';
        if (it.k === 'ellipse') { ctx.beginPath(); ctx.ellipse(x, y, w / 2, hh / 2, 0, 0, Math.PI * 2); ctx.fill(); }
        else { rr(ctx, x - w / 2, y - hh / 2, w, hh, (it.r || 0) * L.W); ctx.fill(); }
      }
    });
  }
  function stopPlay() {
    mon.playing = false; cancelAnimationFrame(mon.raf);
    $('monPlay').innerHTML = ''; $('monPlay').appendChild(icon('play')); $('monPlay').title = 'Reproducir la entrada (Espacio)';
    drawPreview();
  }
  function togglePlay() {
    if (!st.seqs.length) { return; }
    if (mon.playing) { stopPlay(); return; }
    var si = activeSi(), seq = st.seqs[si];
    var len = ES.seqEnd(seq, S.tail, null) - seq.start + 0.6;
    mon.playing = true; mon.t0 = performance.now();
    $('monPlay').innerHTML = ''; $('monPlay').appendChild(icon('pause')); $('monPlay').title = 'Detener';
    (function frame() {
      if (!mon.playing) { return; }
      var t = (performance.now() - mon.t0) / 1000;
      if (t > len) { stopPlay(); return; }
      drawPreview(t); mon.raf = requestAnimationFrame(frame);
    })();
  }
  $('monPlay').addEventListener('click', togglePlay);
  function applyMonToggle() {
    var open = lsGet('laddersu.monOpen') !== '0';
    $('monitor').classList.toggle('closed', !open);
    $('monToggle').setAttribute('aria-pressed', open ? 'true' : 'false');
    $('monToggle').setAttribute('aria-label', open ? 'Ocultar la vista previa' : 'Mostrar la vista previa');
  }
  $('monToggle').addEventListener('click', function () {
    lsSet('laddersu.monOpen', $('monitor').classList.contains('closed') ? '1' : '0'); applyMonToggle(); drawPreview();
  });
  applyMonToggle();
  $('monPrev').addEventListener('click', function () { stopPlay(); setActiveSeq(Math.max(0, activeSi() - 1)); render(); });
  $('monNext').addEventListener('click', function () { stopPlay(); setActiveSeq(Math.min(st.seqs.length - 1, activeSi() + 1)); render(); });
  $('monCanvas').addEventListener('click', function (ev) {
    var r = ev.currentTarget.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top, i;
    for (i = 0; i < mon.hits.length; i++) {
      var hh = mon.hits[i];
      if (x >= hh.x0 && x <= hh.x1 && y >= hh.y0 && y <= hh.y1) {
        Model.click(st, sel, hh.id, { ctrl: ev.ctrlKey || ev.metaKey, shift: ev.shiftKey }); ui.activeId = hh.id; render(); return;
      }
    }
  });
  $('monCanvas').addEventListener('contextmenu', function (ev) {
    var r = ev.currentTarget.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top, i;
    for (i = 0; i < mon.hits.length; i++) {
      var hh = mon.hits[i];
      if (x >= hh.x0 && x <= hh.x1 && y >= hh.y0 && y <= hh.y1) { ev.preventDefault(); Model.contextTarget(st, sel, hh.id); ui.activeId = hh.id; render(); openMenu(ev.clientX, ev.clientY, {}); return; }
    }
  });
  window.addEventListener('resize', function () { drawPreview(); });

  // ================= menu contextual en cascada =================
  var SW = ['#ffffff', '#ffd400', '#ff9f1c', '#ff4d6d', '#ff6bd6', '#7c5cff', '#3b82f6', '#2de2e6', '#3ddc84', '#a3e635', '#f5a524', '#111111', '#ddb76a', '#9ca3af', '#8b5a2b', '#00ff9c'];
  var MN = { pos: null, openKey: null, timer: 0, layer: 'root', colorTab: 'text' };

  function closeFly() { $('ctxFly').hidden = true; MN.openKey = null; var o = $('ctx').querySelectorAll('.it.open'), i; for (i = 0; i < o.length; i++) { o[i].classList.remove('open'); } MN.layer = 'root'; }
  function closeMenu() { clearTimeout(MN.timer); $('ctx').hidden = true; closeFly(); }
  function menuOpen() { return !$('ctx').hidden; }

  function openMenu(x, y, opts) {
    opts = opts || {};
    if (!Model.selCount(st, sel)) { return; }
    MN.pos = { x: x, y: y, above: !!opts.above };
    MN.openKey = null; $('ctxFly').hidden = true;
    buildRoot(); placeRoot();
    if (opts.sub) { var el = $('ctx').querySelector('.it[data-k="' + opts.sub + '"]'); if (el) { openFly(el, opts.sub, true); } }
  }
  function placeRoot() {
    var m = $('ctx'), W = window.innerWidth, H = window.innerHeight;
    m.hidden = false; m.style.left = '0px'; m.style.top = '0px';
    var r = m.getBoundingClientRect(), x = MN.pos.x, y = MN.pos.above ? MN.pos.y - r.height : MN.pos.y;
    if (x + r.width > W - 6) { x = W - r.width - 6; } if (x < 6) { x = 6; }
    if (y + r.height > H - 6) { y = H - r.height - 6; } if (y < 6) { y = 6; }
    m.style.left = x + 'px'; m.style.top = y + 'px';
  }
  // el submenu se abre al lado; si no cabe a ningun lado, el menu principal se corre para que quepan los dos
  function placeFly(itemEl) {
    var m = $('ctx'), f = $('ctxFly'), W = window.innerWidth, H = window.innerHeight;
    f.style.left = '0px'; f.style.top = '0px';
    var r = m.getBoundingClientRect(), fr = f.getBoundingClientRect(), ir = itemEl.getBoundingClientRect(), x;
    if (r.right + fr.width - 2 <= W - 6) { x = r.right - 2; }
    else if (r.left - fr.width + 2 >= 6) { x = r.left - fr.width + 2; }
    else {
      var nl = Math.max(6, W - 6 - fr.width - r.width + 2);
      m.style.left = nl + 'px'; r = m.getBoundingClientRect(); ir = itemEl.getBoundingClientRect();
      x = Math.min(r.right - 2, W - 6 - fr.width);
    }
    var y = ir.top - 6;
    if (y + fr.height > H - 6) { y = H - fr.height - 6; } if (y < 6) { y = 6; }
    f.style.left = x + 'px'; f.style.top = y + 'px';
  }

  function itemEl(o) {
    var b = h('button', 'it' + (o.on ? ' on' : '')); b.type = 'button'; b.disabled = !!o.off; b.setAttribute('role', 'menuitem');
    if (o.k) { b.setAttribute('data-k', o.k); }
    if (o.check) { var ck = icon('check'); ck.setAttribute('class', 'ic chk'); b.appendChild(ck); }
    else if (o.ic) { b.appendChild(icon(o.ic)); }
    b.appendChild(h('span', '', o.label)); b.appendChild(h('span', 'sp'));
    if (o.key) { b.appendChild(h('span', 'k', o.key)); }
    if (o.sub) { var cv = icon('chev'); cv.setAttribute('class', 'ic chevR'); b.appendChild(cv); b.setAttribute('aria-haspopup', 'true'); }
    return b;
  }
  // item del menu principal
  function rootItem(m, o) {
    var b = itemEl(o);
    b.addEventListener('mouseenter', function () {
      clearTimeout(MN.timer);
      if (b.disabled) { return; }
      if (o.sub) { if (MN.openKey !== o.sub) { MN.timer = setTimeout(function () { openFly(b, o.sub); }, MN.openKey ? 240 : 90); } }
      else if (MN.openKey) { MN.timer = setTimeout(closeFly, 260); }
    });
    b.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (o.sub) { clearTimeout(MN.timer); openFly(b, o.sub, true); return; }
      o.act();
    });
    m.appendChild(b);
    return b;
  }
  // item de submenu
  function flyItem(f, o) {
    var b = itemEl(o);
    b.addEventListener('click', function (ev) { ev.stopPropagation(); o.act(); });
    if (o.hover) { b.addEventListener('mouseenter', o.hover); }
    f.appendChild(b);
    return b;
  }
  function apply(patch, msg, keepOpen) {
    mutate(function () { Model.applyPatch(st, sel, patch); });
    if (msg) { say(msg, 'ok'); }
    if (keepOpen) { refreshMenu(); } else { closeMenu(); }
  }
  function refreshMenu() {
    if (!menuOpen()) { if (ui.step === 'diseno') { renderInspector(); } return; }
    var key = MN.openKey, left = $('ctx').style.left, top = $('ctx').style.top;
    buildRoot(); $('ctx').style.left = left; $('ctx').style.top = top;
    if (key) { var el = $('ctx').querySelector('.it[data-k="' + key + '"]'); if (el) { MN.openKey = null; openFly(el, key, false, true); } }
  }
  function seg(m, label, options, cur, fn) {
    if (label) { m.appendChild(h('div', 'lab', label)); }
    var s = h('div', 'seg');
    options.forEach(function (o) { var b = h('button', cur === o[0] ? 'on' : '', o[1]); b.type = 'button'; b.addEventListener('click', function (ev) { ev.stopPropagation(); fn(o[0]); }); s.appendChild(b); });
    m.appendChild(s);
  }
  function swatches(m, cur, fn, inheritLabel) {
    var g = h('div', 'sw');
    SW.forEach(function (c) { var b = h('button', cur === c ? 'on' : ''); b.type = 'button'; b.style.background = c; b.title = c; b.setAttribute('aria-label', 'Color ' + c); b.addEventListener('click', function (ev) { ev.stopPropagation(); fn(c); }); g.appendChild(b); });
    m.appendChild(g);
    var row = h('div', 'swRow'), ci = h('input'); ci.type = 'color'; ci.value = /^#[0-9a-f]{6}$/i.test(cur || '') ? cur : '#ffffff'; ci.title = 'Otro color';
    ci.addEventListener('change', function () { fn(ci.value); });
    row.appendChild(ci); row.appendChild(h('span', 'k', 'Otro'));
    row.appendChild(h('span', 'grow'));
    var inh = h('button', cur ? '' : 'on', inheritLabel || 'Automático'); inh.type = 'button'; inh.addEventListener('click', function (ev) { ev.stopPropagation(); fn(''); }); row.appendChild(inh);
    m.appendChild(row);
  }
  function U(f) { return Model.uniform(st, sel, f); }

  function buildRoot() {
    var m = $('ctx'), ws = Model.selWords(st, sel), n = ws.length, single = n === 1;
    m.innerHTML = '';
    var first = ws[0], last = ws[ws.length - 1];
    var q = h('div', 'quick');
    var isHi = U('size') === 'L' && U('brand') === true && U('glow') === true, isLow = U('size') === 'S', isBox = U('fmt') === 'box';
    [['Destacar', 'star', isHi, function () { apply(isHi ? { size: 'M', brand: false, glow: false } : { size: 'L', brand: true, glow: true }, isHi ? 'Destacado quitado.' : (n === 1 ? 'Destacada: grande, ★ y brillo.' : n + ' destacadas: grande, ★ y brillo.'), true); }],
     ['Atenuar', 'size', isLow, function () { apply(isLow ? { size: 'M' } : { size: 'S', brand: false, glow: false }, isLow ? 'Tamaño normal.' : 'Atenuada: tamaño pequeño.', true); }],
     ['Caja', 'box', isBox, function () { apply({ fmt: isBox ? '' : 'box' }, isBox ? 'Caja quitada.' : 'Caja aplicada.', true); }]
    ].forEach(function (a) {
      var b = h('button', a[2] ? 'on' : ''); b.type = 'button'; b.setAttribute('aria-pressed', a[2] ? 'true' : 'false');
      b.appendChild(icon(a[1])); b.appendChild(h('span', '', a[0]));
      b.addEventListener('mouseenter', function () { clearTimeout(MN.timer); if (MN.openKey) { MN.timer = setTimeout(closeFly, 260); } });
      b.addEventListener('click', function (ev) { ev.stopPropagation(); a[3](); }); q.appendChild(b);
    });
    m.appendChild(q);
    rootItem(m, { label: 'Quitar', ic: 'eraser', k: 'remove', sub: 'remove' });
    rootItem(m, { label: 'Editar texto', ic: 'pencil', k: 'edit', sub: 'edit', off: !single, key: 'E' });
    m.appendChild(h('hr'));
    rootItem(m, { label: 'Animación', ic: 'motion', k: 'anim', sub: 'anim' });
    rootItem(m, { label: 'Estilo', ic: 'sliders', k: 'style', sub: 'style' });
    rootItem(m, { label: 'Color', ic: 'drop', k: 'color', sub: 'color' });
    rootItem(m, { label: 'Fuente', ic: 'type', k: 'font', sub: 'font' });
    rootItem(m, { label: 'Sonido', ic: 'speaker', k: 'sound', sub: 'sound' });
    rootItem(m, { label: 'Plantilla de texto', ic: 'layers', k: 'pres', sub: 'pres' });
    m.appendChild(h('hr'));
    rootItem(m, { label: 'Cortar aquí', ic: 'cut', off: !single || first.wi === 0, act: function () { mutate(function () { Model.split(st, first.si, first.wi); }); closeMenu(); say('Frase cortada antes de “' + first.w.text + '”.', 'ok'); } });
    rootItem(m, { label: 'Unir con la siguiente', ic: 'join', off: last.si >= st.seqs.length - 1, act: function () { mutate(function () { Model.merge(st, last.si); }); closeMenu(); say('Frases unidas.', 'ok'); } });
    rootItem(m, { label: 'Unir con la anterior', ic: 'join', off: first.si === 0, act: function () { mutate(function () { Model.mergeWithPrev(st, first.si); }); closeMenu(); say('Frases unidas.', 'ok'); } });
    rootItem(m, { label: U('br') ? 'Quitar salto de línea' : 'Salto de línea antes', ic: 'return', act: function () { mutate(function () { Model.toggleBreak(st, sel); }); closeMenu(); } });
    rootItem(m, { label: 'Mover a', ic: 'move', k: 'move', sub: 'move' });
    rootItem(m, { label: 'Estilo de la frase', ic: 'stair', k: 'seqstyle', sub: 'seqstyle' });
    m.appendChild(h('hr'));
    rootItem(m, { label: 'Eliminar', ic: 'trash', key: 'Supr', act: function () { mutate(function () { Model.deleteWords(st, sel); }); closeMenu(); say(n === 1 ? 'Palabra eliminada.' : n + ' palabras eliminadas.', 'ok'); } });
  }

  function openFly(itemElm, key, focusFirst, keepTop) {
    var f = $('ctxFly'), oldTop = f.style.top;
    var o = $('ctx').querySelectorAll('.it.open'), i; for (i = 0; i < o.length; i++) { o[i].classList.remove('open'); }
    itemElm.classList.add('open'); MN.openKey = key;
    f.innerHTML = ''; f.className = 'menu fly' + (key === 'font' || key === 'edit' ? ' wide' : '');
    f.hidden = false;
    var after = BUILD[key](f);
    placeFly(itemElm);
    if (keepTop && oldTop) { f.style.top = oldTop; }
    if (focusFirst) { MN.layer = 'fly'; var first = f.querySelector('.it:not([disabled])'); kbMark(f, first); }
    if (after) { after(); }
  }

  var BUILD = {
    edit: function (f) {
      var ws = Model.selWords(st, sel), pad = h('div', 'pad'), inp = h('input'); inp.type = 'text'; inp.value = ws[0].w.text; inp.setAttribute('aria-label', 'Texto de la palabra');
      var row = h('div', 'row'); row.style.marginTop = '6px';
      var ok = h('button', 'pill small', 'Aplicar'); ok.type = 'button';
      var commit = function () { var id = ws[0].w.id; mutate(function () { Model.editText(st, id, inp.value); }); closeMenu(); say('Texto actualizado.', 'ok'); };
      inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { commit(); } else if (ev.key === 'Escape') { closeMenu(); } ev.stopPropagation(); });
      ok.addEventListener('click', function (ev) { ev.stopPropagation(); commit(); });
      pad.appendChild(h('div', 'lab', 'Texto de la palabra')); pad.appendChild(inp);
      row.appendChild(h('span', 'k', 'Con espacios se divide en varias palabras.')); row.appendChild(ok); pad.appendChild(row);
      f.appendChild(pad);
      return function () { inp.focus(); inp.select(); };
    },
    anim: function (f) {
      var ws = Model.selWords(st, sel), cur = U('trans');
      var pv = h('div', 'animPrev'), sp = h('span', '', ES.displayText(ws[0].w.text, ws[0].w.c, S.upper)); pv.appendChild(sp); f.appendChild(pv);
      var show = function (id) { sp.className = ''; void sp.offsetWidth; sp.className = 'a-' + (id || S.animPreset); };
      show(cur || S.animPreset);
      flyItem(f, { label: 'Por defecto (' + ES.TRANS[S.animPreset].name + ')', check: true, on: cur === '', act: function () { apply({ trans: '' }, 'Entrada por defecto.'); }, hover: function () { show(S.animPreset); } });
      ES.TRANS_ORDER.forEach(function (id) {
        flyItem(f, { label: ES.TRANS[id].name, check: true, on: cur === id, act: function () { apply({ trans: id }, 'Entrada: ' + ES.TRANS[id].name + '.'); }, hover: function () { show(id); } });
      });
    },
    style: function (f) {
      seg(f, 'Tamaño', [['S', 'S'], ['M', 'M'], ['L', 'L']], U('size'), function (v) { apply({ size: v }, null, true); });
      seg(f, 'Palabra clave ★', [[true, 'Sí'], [false, 'No']], U('brand'), function (v) { apply({ brand: v }, null, true); });
      seg(f, 'Formato', [['', 'Normal'], ['box', 'Caja'], ['underline', 'Subrayado']], U('fmt'), function (v) { apply({ fmt: v }, null, true); });
      seg(f, 'Brillo', [[true, 'Con brillo'], [false, 'Sin brillo']], U('glow'), function (v) { apply({ glow: v }, null, true); });
      seg(f, 'Mayúsculas', [['', 'Auto'], ['upper', 'ABC'], ['lower', 'abc'], ['none', 'Abc']], U('caps'), function (v) { apply({ caps: v }, null, true); });
    },
    color: function (f) {
      var tabs = h('div', 'tabsMini');
      [['text', 'Texto'], ['box', 'Caja'], ['glow', 'Brillo']].forEach(function (t) {
        var b = h('button', MN.colorTab === t[0] ? 'on' : '', t[1]); b.type = 'button';
        b.addEventListener('click', function (ev) { ev.stopPropagation(); MN.colorTab = t[0]; refreshMenu(); });
        tabs.appendChild(b);
      });
      f.appendChild(tabs);
      if (MN.colorTab === 'text') { swatches(f, U('color'), function (v) { apply({ color: v }, null, true); }, v0('Automático')); }
      else if (MN.colorTab === 'box') { swatches(f, U('boxColor'), function (v) { apply({ boxColor: v, fmt: U('fmt') || 'box' }, null, true); }, 'Del ajuste'); }
      else { swatches(f, U('glowColor'), function (v) { apply({ glowColor: v, glow: true }, null, true); }, 'Del ajuste'); }
      function v0(x) { return x; }
    },
    font: function (f) {
      var host = h('div', 'pad'); f.appendChild(host);
      var fp = FontPicker(host, { getValue: function () { return U('font') || ''; }, emptyText: 'Usa la fuente por defecto',
        onPick: function (ps) { apply({ font: ps }, 'Fuente: ' + fontLabelOf(ps), false); },
        onInherit: function () { apply({ font: '' }, 'Fuente por defecto.', false); }, inheritText: 'Usar la de por defecto' });
      return function () { fp.focus(); };
    },
    sound: function (f) {
      var cur = U('sfx'), tmr = 0;
      flyItem(f, { label: 'Sin sonido', check: true, on: cur === '', act: function () { apply({ sfx: '' }, 'Sonido quitado.'); } });
      sounds.forEach(function (s) {
        flyItem(f, { label: s.name, check: true, on: cur === s.id, key: s.cat, act: function () { preview(s.id); apply({ sfx: s.id }, 'Sonido: ' + s.name + '.'); },
          hover: function () { clearTimeout(tmr); tmr = setTimeout(function () { preview(s.id); }, 280); } });
      });
      f.addEventListener('mouseleave', function () { clearTimeout(tmr); });
    },
    pres: function (f) {
      var list = pstore.list.slice().sort(function (a, b) { return (b.fav ? 1 : 0) - (a.fav ? 1 : 0); });
      var curP = (function () { var s2 = Model.seqsWithSelection(st, sel).map(function (i) { return st.seqs[i].pres; }); return s2.length && s2.every(function (x) { return x === s2[0]; }) ? s2[0] : null; })();
      list.forEach(function (d) { flyItem(f, { label: d.name, check: true, on: curP === d.id, key: Pres.summary(d).split(' · ')[0], act: function () { applyPres(d.id); closeMenu(); } }); });
      f.appendChild(h('hr'));
      flyItem(f, { label: 'Quitar plantilla', ic: 'x', off: !curP, act: function () {
        mutate(function () { Model.seqsWithSelection(st, sel).forEach(function (i) { st.seqs[i].pres = ''; }); }); closeMenu(); say('Plantilla quitada.', 'ok');
      } });
      flyItem(f, { label: 'Crear una nueva…', ic: 'plus', act: function () { closeMenu(); showTab('library'); showLib('pres'); } });
    },
    move: function (f) {
      var ws = Model.selWords(st, sel), ids = ws.map(function (x) { return x.w.id; });
      flyItem(f, { label: 'Nueva frase antes', ic: 'plus', act: function () { var s0 = ws[0].si; mutate(function () { Model.moveToNewSeq(st, ids, s0); }); closeMenu(); flash(ids); say('Movida(s) a una frase nueva.', 'ok'); } });
      flyItem(f, { label: 'Nueva frase después', ic: 'plus', act: function () { var s1 = ws[ws.length - 1].si + 1; mutate(function () { Model.moveToNewSeq(st, ids, s1); }); closeMenu(); flash(ids); say('Movida(s) a una frase nueva.', 'ok'); } });
      f.appendChild(h('div', 'lab', 'Al final de la frase…'));
      st.seqs.forEach(function (sq, i) {
        var label = (i + 1) + '  ' + sq.words.slice(0, 4).map(function (w) { return w.text; }).join(' ') + (sq.words.length > 4 ? '…' : '');
        flyItem(f, { label: label, off: ws.every(function (x) { return x.si === i; }), act: function () { mutate(function () { Model.moveWords(st, ids, sq, null); }); closeMenu(); flash(ids); say('Movida(s) a la frase ' + (i + 1) + '.', 'ok'); } });
      });
    },
    seqstyle: function (f) {
      var sis = Model.seqsWithSelection(st, sel);
      var one = function (get) { var v = sis.map(function (i) { return get(st.seqs[i]); }); return v.length && v.every(function (x) { return x === v[0]; }) ? v[0] : null; };
      var curStyle = one(function (q) { return q.style || ''; }), curAl = one(function (q) { return q.align || ''; });
      var setStyle = function (style, align, msg) {
        mutate(function () { sis.forEach(function (i) { st.seqs[i].style = style; if (align !== null) { st.seqs[i].align = align; } }); });
        refreshMenu(); say(msg, 'ok');
      };
      f.appendChild(h('div', 'lab', 'Escalera (bloque)'));
      ALIGNS.forEach(function (a) {
        flyItem(f, { label: ALIGN_NAME[a] + (a === '' ? ' (variado)' : ''), check: true, on: curStyle === 'lockup' && curAl === a,
          act: function () { setStyle('lockup', a, 'Escalera: ' + ALIGN_NAME[a].toLowerCase() + '.'); } });
      });
      f.appendChild(h('hr'));
      flyItem(f, { label: 'Caja que recorre', ic: 'karaoke', on: curStyle === 'karaoke', key: 'frase entera',
        act: function () { setStyle('karaoke', null, 'Estilo: caja que recorre.'); } });
      flyItem(f, { label: 'Una línea', ic: 'line', on: curStyle === 'line',
        act: function () { setStyle('line', null, 'Estilo: una línea.'); } });
      flyItem(f, { label: 'APPLEXBY', ic: 'line', on: curStyle === 'applexby', key: 'una línea',
        act: function () { setStyle('applexby', null, 'Estilo: APPLEXBY.'); } });
      f.appendChild(h('hr'));
      flyItem(f, { label: 'Usar el de la edición (' + ({ karaoke: 'caja', applexby: 'APPLEXBY', line: 'una línea' }[S.editStyle] || 'escalera') + ')', check: true, on: curStyle === '',
        act: function () { setStyle('', '', 'Estilo de la edición.'); } });
    },
    remove: function (f) {
      var eff = Model.presentEffects(st, sel);
      if (!eff.length) { var e0 = flyItem(f, { label: 'No hay efectos que quitar', off: true }); void e0; }
      eff.forEach(function (e) {
        flyItem(f, { label: e.label, ic: 'x', key: Model.selCount(st, sel) > 1 ? e.n + (e.n === 1 ? ' palabra' : ' palabras') : '',
          act: function () { mutate(function () { Model.removeEffect(st, sel, e.k); }); say(e.label + ' quitado.', 'ok'); refreshMenu(); } });
      });
      f.appendChild(h('hr'));
      flyItem(f, { label: 'Tamaño automático', ic: 'wand', act: function () {
        mutate(function () {
          Model.seqsWithSelection(st, sel).forEach(function (si) {
            var auto = ES.autoClassify(st.seqs[si].words);
            st.seqs[si].words.forEach(function (w, j) { if (Model.isSel(sel, w.id)) { w.c.size = auto[j].size; w.c.brand = auto[j].brand; } });
          });
        }); say('Tamaño y ★ automáticos.', 'ok'); refreshMenu();
      } });
      flyItem(f, { label: 'Quitar todo', ic: 'eraser', off: !eff.length, act: function () { mutate(function () { Model.resetEffects(st, sel); }); closeMenu(); say('Efectos quitados (el tamaño se mantiene).', 'ok'); } });
    }
  };

  // teclado dentro del menu
  function kbMark(layerEl, el) {
    var all = document.querySelectorAll('.menu .it.kb'), i; for (i = 0; i < all.length; i++) { all[i].classList.remove('kb'); }
    if (el) { el.classList.add('kb'); el.scrollIntoView({ block: 'nearest' }); }
  }
  function menuKey(ev) {
    var layerEl = MN.layer === 'fly' && !$('ctxFly').hidden ? $('ctxFly') : $('ctx');
    var items = Array.prototype.slice.call(layerEl.querySelectorAll('.it:not([disabled])')), cur = layerEl.querySelector('.it.kb'), idx = items.indexOf(cur);
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      idx = ev.key === 'ArrowDown' ? (idx + 1) % items.length : (idx <= 0 ? items.length - 1 : idx - 1);
      kbMark(layerEl, items[idx]); return true;
    }
    if (ev.key === 'ArrowRight' && MN.layer === 'root' && cur && cur.getAttribute('aria-haspopup')) { ev.preventDefault(); openFly(cur, cur.getAttribute('data-k'), true); return true; }
    if (ev.key === 'ArrowLeft' && MN.layer === 'fly') {
      ev.preventDefault(); var k = MN.openKey; closeFly(); kbMark($('ctx'), $('ctx').querySelector('.it[data-k="' + k + '"]')); return true;
    }
    if (ev.key === 'Enter' && cur) { ev.preventDefault(); cur.click(); return true; }
    if (ev.key === 'Escape') { ev.preventDefault(); if (MN.layer === 'fly' && !$('ctxFly').hidden) { var k2 = MN.openKey; closeFly(); kbMark($('ctx'), $('ctx').querySelector('.it[data-k="' + k2 + '"]')); } else { closeMenu(); } return true; }
    return false;
  }
  $('ctxFly').addEventListener('mouseenter', function () { clearTimeout(MN.timer); MN.layer = 'fly'; });
  $('ctx').addEventListener('mouseenter', function () { MN.layer = 'root'; });
  ['ctx', 'ctxFly'].forEach(function (id) { $(id).addEventListener('contextmenu', function (ev) { ev.preventDefault(); }); });
  document.addEventListener('mousedown', function (ev) {
    if (menuOpen() && !$('ctx').contains(ev.target) && !$('ctxFly').contains(ev.target)) { closeMenu(); }
  });
  document.addEventListener('scroll', function (ev) { if (menuOpen() && !$('ctx').contains(ev.target) && !$('ctxFly').contains(ev.target)) { closeMenu(); } }, true);
  window.addEventListener('blur', function () { if (menuOpen() && !document.activeElement.closest('.menu')) { closeMenu(); } });

  // ================= pasos: Texto · Frases · Diseño · Generar =================
  var STEPS = ['texto', 'frases', 'diseno', 'generar'];
  var STEP_NAME = { texto: 'Texto', frases: 'Frases', diseno: 'Diseño', generar: 'Generar' };
  var STYLE_NAME = { lockup: 'Escalera', karaoke: 'Caja que recorre', line: 'Una línea', applexby: 'APPLEXBY' };
  var STYLE_CLS = { lockup: 'st', karaoke: 'bx', line: 'ln', applexby: 'ax' };
  function goStep(name) {
    if (STEPS.indexOf(name) < 0) { return; }
    if (name !== 'texto' && !st.seqs.length) { say('Primero importa el SRT.', 'err'); return; }
    stopPlay(); closeMenu(); ui.step = name; lsSet('laddersu.step', name); $('toast').hidden = true;
    if (name === 'diseno' && activeSi() < 0) { setActiveSeq(0); }
    render();
    var v = $('step-' + name); if (v) { v.scrollTop = 0; }
    $('tab-editor').scrollTop = 0;
  }
  function renderStepper() {
    var idx = STEPS.indexOf(ui.step), btns = document.querySelectorAll('#stepper .stp'), i;
    for (i = 0; i < btns.length; i++) {
      var k = btns[i].getAttribute('data-step'), j = STEPS.indexOf(k);
      btns[i].classList.toggle('on', k === ui.step);
      btns[i].classList.toggle('done', j < idx);
      btns[i].disabled = j > 0 && !st.seqs.length;
      btns[i].setAttribute('aria-current', k === ui.step ? 'step' : 'false');
      btns[i].querySelector('b').textContent = j < idx ? '✓' : String(j + 1);
    }
    STEPS.forEach(function (k) { $('step-' + k).hidden = k !== ui.step; });
    // pie: atras / siguiente
    var back = $('btnBack'), next = $('btnNext'), info = $('stepInfo');
    back.hidden = idx === 0;
    info.textContent = 'Paso ' + (idx + 1) + ' de 4';
    next.hidden = ui.step === 'generar' || (ui.step === 'frases' && !st.based);
    next.disabled = !st.seqs.length;
    next.textContent = idx < 3 ? 'Siguiente: ' + STEP_NAME[STEPS[idx + 1]].toLowerCase() : '';
  }
  (function () {
    var btns = document.querySelectorAll('#stepper .stp'), i;
    for (i = 0; i < btns.length; i++) { btns[i].addEventListener('click', function (ev) { goStep(ev.currentTarget.getAttribute('data-step')); }); }
    $('btnBack').addEventListener('click', function () { goStep(STEPS[Math.max(0, STEPS.indexOf(ui.step) - 1)]); });
    $('btnNext').addEventListener('click', function () { goStep(STEPS[Math.min(3, STEPS.indexOf(ui.step) + 1)]); });
  })();

  // ---------- 1 · Texto ----------
  function allWords() { var a = []; st.seqs.forEach(function (q) { q.words.forEach(function (w) { a.push(w); }); }); return a; }
  function renderTexto() {
    var has = st.seqs.length > 0;
    $('empty').hidden = has; $('textoView').hidden = !has;
    if (!has) { return; }
    var ws = allWords(), dur = ws.length ? ws[ws.length - 1].end : 0, paras = Model.paragraphs(st);
    $('srcName').textContent = (st.src && st.src.name) || 'subtitulos.srt';
    $('srcMeta').textContent = ws.length + ' palabras · ' + fmtClock(dur) + ' · ' + paras.length + (paras.length === 1 ? ' bloque' : ' bloques');
    var box = $('transcript'); box.innerHTML = '';
    paras.forEach(function (p) {
      var row = h('div', 'para'); row.appendChild(h('span', 't', fmtClock(p.start)));
      var tx = h('p', 'tx');
      p.words.forEach(function (w, k) {
        var b = h('button', 'tw' + (ui.textSel === w.id ? ' sel' : ''), w.text); b.type = 'button'; b.setAttribute('data-id', w.id);
        b.title = fmtTime(w.start) + ' – ' + fmtTime(w.end);
        b.addEventListener('click', function (ev) { ev.stopPropagation(); ui.textSel = w.id; renderTexto(); openWordPop(w.id); });
        tx.appendChild(b); if (k < p.words.length - 1) { tx.appendChild(document.createTextNode(' ')); }
      });
      row.appendChild(tx); box.appendChild(row);
    });
    if (ui.textSel != null && !Model.find(st, ui.textSel)) { ui.textSel = null; }
    if (ui.textSel != null) { openWordPop(ui.textSel, true); }
  }
  function fmtClock(t) { var m = Math.floor(t / 60), s2 = Math.floor(t - m * 60); return m + ':' + (s2 < 10 ? '0' : '') + s2; }
  function closeWordPop() { var p = $('wordPop'); if (p) { p.remove(); } }
  function openWordPop(id, keepEdit) {
    closeWordPop();
    var el = document.querySelector('#transcript .tw[data-id="' + id + '"]'), f = Model.find(st, id); if (!el || !f) { return; }
    var pop = h('div', 'wordPop'); pop.id = 'wordPop'; pop.setAttribute('role', 'toolbar'); pop.setAttribute('aria-label', 'Palabra elegida');
    var inp = h('input'); inp.type = 'text'; inp.value = f.w.text; inp.setAttribute('aria-label', 'Corregir la palabra');
    var commit = function () {
      var v = inp.value.replace(/^\s+|\s+$/g, '');
      if (!v || v === f.w.text) { return; }
      mutate(function () { Model.editText(st, id, v); }); say(/\s/.test(v) ? 'Palabra separada.' : 'Palabra corregida.', 'ok');
    };
    inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { commit(); } if (ev.key === 'Escape') { ui.textSel = null; closeWordPop(); renderTexto(); } ev.stopPropagation(); });
    pop.appendChild(inp);
    var ok = h('button', 'q on', 'Corregir'); ok.type = 'button'; ok.addEventListener('click', commit); pop.appendChild(ok);
    var ids = Model.allIds(st), k = ids.indexOf(id);
    var jn = h('button', 'q', 'Unir con la siguiente'); jn.type = 'button'; jn.disabled = k >= ids.length - 1;
    jn.addEventListener('click', function () { mutate(function () { Model.joinWords(st, id); }); say('Palabras unidas.', 'ok'); });
    pop.appendChild(jn);
    var sp = h('button', 'q', 'Separar'); sp.type = 'button'; sp.disabled = !/\s/.test(f.w.text);
    sp.title = sp.disabled ? 'Escribe un espacio donde quieras separarla y pulsa Corregir' : 'Separar en varias palabras';
    sp.addEventListener('click', function () { mutate(function () { Model.splitWord(st, id); }); say('Palabra separada.', 'ok'); });
    pop.appendChild(sp);
    var del = h('button', 'q danger', 'Quitar'); del.type = 'button';
    del.addEventListener('click', function () { var s0 = Model.newSel(); s0.m[id] = true; mutate(function () { Model.deleteWords(st, s0); }); ui.textSel = null; say('Palabra quitada.', 'ok'); });
    pop.appendChild(del);
    el.parentNode.parentNode.insertAdjacentElement('afterend', pop);
    if (!keepEdit) { setTimeout(function () { inp.focus(); inp.select(); }, 0); }
  }
  document.addEventListener('mousedown', function (ev) {
    if (ui.textSel != null && !ev.target.closest('#wordPop,#transcript .tw')) { ui.textSel = null; closeWordPop(); var s2 = document.querySelector('#transcript .tw.sel'); if (s2) { s2.classList.remove('sel'); } }
  });
  $('btnReplace').addEventListener('click', function () {
    var f = $('findIn').value, r = $('replIn').value, n = 0;
    if (!f.replace(/\s+/g, '')) { $('findIn').focus(); return; }
    var probe = JSON.parse(JSON.stringify(st)); n = Model.replaceAll(probe, f, r);
    if (!n) { say('No encontré “' + f + '” como palabra.', 'err'); return; }
    mutate(function () { Model.replaceAll(st, f, r); });
    say(n === 1 ? '1 palabra reemplazada.' : n + ' palabras reemplazadas.', 'ok');
  });
  $('findIn').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { $('replIn').focus(); } });
  $('replIn').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { $('btnReplace').click(); } });
  function clearAll() {
    snap(); st = { seqs: [] }; Model.clearSel(sel); ui.activeId = null; ui.fsel = {}; ui.result = null; ui.step = 'texto'; persistEdit(); render();
    toastUndo('SRT quitado.');
  }
  function toastUndo(msg) { ui.lastMut = Date.now(); say(msg, 'ok'); }
  $('btnClear').addEventListener('click', clearAll);

  // ---------- 2 · Frases ----------
  var BASES = [
    { id: 'lockup', name: 'Escalera', words: '3 a 6 palabras', desc: 'Bloques con tamaños S, M y L y palabra clave.', key: 'stairLen', opts: ['Cortos', 'Medios', 'Largos'], lab: 'Largo de los bloques' },
    { id: 'line', name: 'Una línea', words: '1 a 3 palabras', desc: 'Frases cortas en una sola línea, abajo.', key: 'lineWords', opts: ['1 palabra', '2 palabras', '3 palabras'], lab: 'Palabras por frase', off: 1 },
    { id: 'karaoke', name: 'Caja que recorre', words: '4 a 8 palabras', desc: 'La frase entera y una caja que pasa de palabra en palabra.', key: 'boxLen', opts: ['Cortas', 'Medias', 'Largas'], lab: 'Largo de las frases' }
  ];
  function baseOf(style) { var i; for (i = 0; i < BASES.length; i++) { if (BASES[i].id === style) { return BASES[i]; } } return BASES[0]; }
  function lenVal(b) { var v = S[b.key]; return v == null ? 1 : (b.off ? v - b.off : v); }
  function renderFrases() {
    var showBase = !st.based || ui.baseOpen;
    $('baseView').hidden = !showBase; $('frasesView').hidden = showBase;
    if (showBase) { renderBase(); } else { renderFrasesList(); }
    renderStepper();
  }
  function renderBase() {
    var box = $('baseView'); box.innerHTML = '';
    var cur = ui.basePick || (ES.isLineStyle(S.editStyle) ? 'line' : S.editStyle) || 'lockup';
    ui.basePick = cur;
    var head = h('div', 'stepHead'); head.appendChild(h('h2', '', '¿Cómo será la mayoría de frases?'));
    head.appendChild(h('p', '', 'Con esto Laddersu decide cuántas palabras van juntas. Después puedes pasar cualquier tramo a otro estilo.'));
    box.appendChild(head);
    BASES.forEach(function (b) {
      var on = cur === b.id, c = h('button', 'baseCard ' + STYLE_CLS[b.id] + (on ? ' on' : '')); c.type = 'button'; c.setAttribute('aria-pressed', on ? 'true' : 'false');
      c.appendChild(h('span', 'radio'));
      var tx = h('span', 'tx'), t1 = h('span', 'nm'); t1.appendChild(h('b', '', b.name)); t1.appendChild(h('span', 'tag ' + STYLE_CLS[b.id], b.words));
      tx.appendChild(t1); tx.appendChild(h('small', '', b.desc)); c.appendChild(tx);
      c.appendChild(styleArt(b.id === 'lockup' ? 'lockup' : b.id));
      c.addEventListener('click', function () { ui.basePick = b.id; renderBase(); });
      box.appendChild(c);
    });
    var b0 = baseOf(cur);
    box.appendChild(h('div', 'lab2', b0.lab));
    var sg = h('div', 'segc'); sg.setAttribute('role', 'group'); sg.setAttribute('aria-label', b0.lab);
    b0.opts.forEach(function (o, i) {
      var bt = h('button', lenVal(b0) === i ? 'on' : '', o); bt.type = 'button';
      bt.addEventListener('click', function () { S[b0.key] = b0.off ? i + b0.off : i; saveCfg(); renderBase(); });
      sg.appendChild(bt);
    });
    box.appendChild(sg);
    // cuantas frases quedarian
    var S2 = JSON.parse(JSON.stringify(S)); S2.editStyle = cur;
    var est = Model.groupFor(allWords().slice().sort(function (a, b2) { return a.start - b2.start; }).map(function (w) { return { text: w.text, start: w.start, end: w.end, c: {} }; }), cur, S2).length;
    var act = h('div', 'baseAct');
    act.appendChild(h('span', 'est', 'Quedarán ' + est + (est === 1 ? ' frase' : ' frases')));
    if (st.based) { var cancel = h('button', 'pill ghost', 'Cancelar'); cancel.type = 'button'; cancel.addEventListener('click', function () { ui.baseOpen = false; render(); }); act.appendChild(cancel); }
    var go = h('button', 'pill', st.based ? 'Volver a agrupar' : 'Agrupar'); go.type = 'button'; go.id = 'btnGroup';
    go.addEventListener('click', function () {
      var hadMix = st.based && st.seqs.some(function (q) { return q.style; });
      mutate(function () { S.editStyle = cur; saveCfg(); Model.regroup(st, S); st.based = true; });
      ui.baseOpen = false; ui.fsel = {}; setActiveSeq(0); render();
      say(st.seqs.length + ' frases de ' + STYLE_NAME[cur].toLowerCase() + '.' + (hadMix ? ' Los estilos por frase se rearmaron.' : ''), 'ok');
    });
    act.appendChild(go); box.appendChild(act);
  }
  function renderFrasesList() {
    var counts = {}, total = st.seqs.length;
    st.seqs.forEach(function (q) { var k = q.pres ? 'pres' : Model.effStyle(q, S); counts[k] = (counts[k] || 0) + 1; });
    var stt = $('frStats'); stt.innerHTML = '';
    stt.appendChild(h('b', '', total + (total === 1 ? ' frase' : ' frases')));
    ['lockup', 'line', 'karaoke', 'applexby', 'pres'].forEach(function (k) {
      if (!counts[k]) { return; }
      var e = h('span', 'cnt ' + (STYLE_CLS[k] || 'pr')); e.appendChild(h('i')); e.appendChild(document.createTextNode(counts[k] + ' ' + (k === 'pres' ? 'plantilla' : STYLE_NAME[k].toLowerCase())));
      stt.appendChild(e);
    });
    // barra del video
    var bar = $('frBar'); bar.innerHTML = '';
    var t0 = st.seqs[0].start, t1 = st.seqs[total - 1].end, span = Math.max(0.01, t1 - t0);
    st.seqs.forEach(function (q, i) {
      var seg2 = h('i', STYLE_CLS[q.pres ? 'pres' : Model.effStyle(q, S)] || 'pr'); seg2.style.flexGrow = String(Math.max(0.2, (q.end - q.start) / span * 100));
      if (ui.fsel[firstId(q)]) { seg2.classList.add('sel'); }
      bar.appendChild(seg2); void i;
    });
    var list = $('frList'); list.innerHTML = '';
    st.seqs.forEach(function (q, i) { list.appendChild(frRow(q, i)); });
    renderFrSel();
  }
  function firstId(q) { return q.words[0].id; }
  function selSis() { var out = []; st.seqs.forEach(function (q, i) { if (ui.fsel[firstId(q)]) { out.push(i); } }); return out; }
  function frRow(q, i) {
    var k = q.pres ? 'pres' : Model.effStyle(q, S), on = !!ui.fsel[firstId(q)];
    var row = h('div', 'frRow ' + (STYLE_CLS[k] || 'pr') + (on ? ' on' : '')); row.setAttribute('data-si', i);
    var cb = h('button', 'cb' + (on ? ' on' : '')); cb.type = 'button'; cb.setAttribute('aria-pressed', on ? 'true' : 'false'); cb.setAttribute('aria-label', 'Elegir la frase ' + (i + 1));
    if (on) { cb.appendChild(icon('check')); }
    cb.addEventListener('click', function (ev) {
      var id = firstId(q);
      if (ev.shiftKey && ui.fLast != null) {
        var a = Math.min(ui.fLast, i), b = Math.max(ui.fLast, i), j; for (j = a; j <= b; j++) { ui.fsel[firstId(st.seqs[j])] = true; }
      } else if (ui.fsel[id]) { delete ui.fsel[id]; } else { ui.fsel[id] = true; }
      ui.fLast = i; renderFrasesList();
    });
    row.appendChild(cb);
    var n = h('span', 'n'); n.appendChild(document.createTextNode(String(i + 1))); n.appendChild(h('small', '', fmtClock(q.start))); row.appendChild(n);
    var w = h('span', 'w');
    q.words.forEach(function (wd, j) {
      if (j > 0) {
        var cut = h('button', 'cut'); cut.type = 'button'; cut.title = 'Cortar aquí'; cut.setAttribute('aria-label', 'Cortar la frase antes de “' + wd.text + '”');
        cut.appendChild(icon('cut'));
        cut.addEventListener('click', function () { mutate(function () { Model.split(st, i, j); }); say('Frase cortada.', 'ok'); });
        w.appendChild(cut);
      }
      var sp = h('span', 'wt', wd.text); w.appendChild(sp);
    });
    row.appendChild(w);
    var tag = h('span', 'tag ' + (STYLE_CLS[k] || 'pr'), k === 'pres' ? ((pstore.get(q.pres) || {}).name || 'Plantilla') : STYLE_NAME[k]);
    row.appendChild(tag);
    row.addEventListener('dblclick', function () { setActiveSeq(i); goStep('diseno'); });
    return row;
  }
  function renderFrSel() {
    var old = $('frSel'); if (old) { old.remove(); }
    var sis = selSis(); if (!sis.length) { return; }
    var bar = h('div', 'frSel'); bar.id = 'frSel'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Frases elegidas');
    bar.appendChild(h('b', '', sis.length + (sis.length === 1 ? ' frase' : ' frases')));
    [['lockup', 'Escalera'], ['line', 'Una línea'], ['karaoke', 'Caja']].forEach(function (o) {
      var b = h('button', 'sb ' + STYLE_CLS[o[0]], o[1]); b.type = 'button'; b.title = 'Pasar a ' + STYLE_NAME[o[0]].toLowerCase() + ' y reagrupar';
      b.insertBefore(h('i'), b.firstChild);
      b.addEventListener('click', function () {
        var n0 = st.seqs.length;
        mutate(function () { Model.regroupRange(st, sis, o[0], S); }); ui.fsel = {};
        render(); say('Pasadas a ' + STYLE_NAME[o[0]].toLowerCase() + ': ahora hay ' + st.seqs.length + ' frases (' + (st.seqs.length >= n0 ? '+' : '') + (st.seqs.length - n0) + ').', 'ok');
      });
      bar.appendChild(b);
    });
    var jn = h('button', 'sb', 'Unir'); jn.type = 'button'; jn.disabled = sis.length < 2;
    jn.addEventListener('click', function () {
      mutate(function () { var k2; for (k2 = sis.length - 1; k2 > 0; k2--) { if (sis[k2] === sis[k2 - 1] + 1) { Model.merge(st, sis[k2 - 1]); } } }); ui.fsel = {}; render(); say('Frases unidas.', 'ok');
    });
    bar.appendChild(jn);
    var nw = 0; sis.forEach(function (k3) { if (!st.seqs[k3].pres) { nw += st.seqs[k3].words.length - 1; } });
    var wb = h('button', 'sb', 'Palabra x palabra'); wb.type = 'button'; wb.id = 'btnWordByWord'; wb.disabled = nw < 1;
    wb.title = 'Separar cada palabra en su propia frase (mantiene el estilo)';
    wb.addEventListener('click', function () {
      var made = 0; mutate(function () { made = Model.wordByWord(st, sis); }); ui.fsel = {}; render();
      say('Separadas palabra por palabra: ' + made + ' frases nuevas.', 'ok');
    });
    bar.appendChild(wb);
    var x = h('button', 'iconBtn'); x.type = 'button'; x.setAttribute('aria-label', 'Quitar la selección'); x.appendChild(icon('x'));
    x.addEventListener('click', function () { ui.fsel = {}; renderFrasesList(); });
    bar.appendChild(x);
    $('step-frases').appendChild(bar);
  }
  $('btnBase').addEventListener('click', function () { ui.baseOpen = true; ui.basePick = null; render(); });

  // ---------- 4 · Generar ----------
  function usedFonts() {
    var m = {}; if (S.font) { m[S.font] = true; }
    st.seqs.forEach(function (q) {
      var stl = Model.effStyle(q, S);
      if (stl === 'line' && S.linFont) { m[S.linFont] = true; } if (stl === 'applexby' && S.apxFont) { m[S.apxFont] = true; }
      q.words.forEach(function (w) { if (w.c.font) { m[w.c.font] = true; } });
    });
    return Object.keys(m);
  }
  function genChecks() {
    var out = [];
    if (!ui.comp || !ui.comp.ok) {
      out.push({ k: S.newComp ? 'info' : 'err', t: S.newComp ? 'Se creará una composición nueva de ' + S.compW + '×' + S.compH + '.' : 'No hay una composición abierta en After Effects. Ábrela (doble clic en ella) o crea una nueva aquí abajo.' });
    }
    if (fonts.length) {
      var miss = usedFonts().filter(function (f) { return !Model.findFont(fonts, f); });
      if (miss.length) { out.push({ k: 'warn', t: (miss.length === 1 ? 'La fuente ' + miss[0] + ' no está instalada' : miss.length + ' fuentes no están instaladas (' + miss.slice(0, 3).join(', ') + ')') + ': se usará la de After Effects.', fix: 'Ir a diseño', go: 'diseno' }); }
    }
    var red = [];
    st.seqs.forEach(function (q, i) { if (!q.pres) { try { if (layoutSeq(i).lay.scale < 0.999) { red.push(i); } } catch (e) {} } });
    if (red.length) { out.push({ k: 'info', t: (red.length === 1 ? 'La frase ' + (red[0] + 1) + ' se reduce' : red.length + ' frases se reducen') + ' para caber en la zona segura.', fix: 'Ver', go: 'diseno', si: red[0] }); }
    if (!out.length) { out.push({ k: 'ok', t: 'Todo listo: las frases caben en la zona segura y las fuentes están instaladas.' }); }
    return out;
  }
  function renderGenerar() {
    var box = $('genView'); box.innerHTML = '';
    if (!st.seqs.length) { return; }
    var g = ui.gen;
    // destino
    var dest = h('div', 'genCard dest');
    dest.appendChild(h('span', 'gIc')).appendChild(icon('comp'));
    var dt = h('span', 'tx'); dt.appendChild(h('small', '', 'Se crea en'));
    dt.appendChild(h('b', '', ui.comp && ui.comp.ok ? ui.comp.name + ' · ' + ui.comp.w + '×' + ui.comp.h + ' · ' + Math.round(ui.comp.fps || 30) + ' fps' : (S.newComp ? 'Una composición nueva' : 'Ninguna composición abierta')));
    dest.appendChild(dt); box.appendChild(dest);
    if (g) {
      // generando
      var pr = h('div', 'genRun');
      var pct = Math.round(100 * g.done / Math.max(1, g.total));
      var ring = h('div', 'ring'); ring.style.background = 'conic-gradient(var(--violet) ' + pct + '%, #2c2c31 0)'; ring.appendChild(h('span', '', pct + '%'));
      pr.appendChild(ring);
      pr.appendChild(h('b', '', g.stop ? 'Deteniendo…' : (g.done < g.total ? 'Creando la frase ' + (g.done + 1) + ' de ' + g.total : 'Terminando…')));
      var cur = job0seq(g); if (cur) { pr.appendChild(h('span', 'soft', '“' + cur + '”')); }
      var stop = h('button', 'pill ghost', 'Detener'); stop.type = 'button'; stop.id = 'btnStop'; stop.disabled = g.stop;
      stop.addEventListener('click', function () { if (gen) { gen.stop = true; renderGenerar(); } });
      pr.appendChild(stop);
      pr.appendChild(h('small', 'soft', 'Si detienes, puedes quitar lo que alcanzó a crearse o dejarlo.'));
      box.appendChild(pr); return;
    }
    if (ui.result) {
      var r = ui.result, rc = h('div', 'genResult ' + (r.ok ? 'ok' : (r.stopped ? 'warn' : 'err')));
      rc.appendChild(h('b', '', r.title)); if (r.msg) { rc.appendChild(h('span', '', r.msg)); }
      if (!r.ok && r.si != null) {
        var row = h('div', 'row');
        var goF = h('button', 'pill small', 'Ir a la frase ' + (r.si + 1)); goF.type = 'button'; goF.addEventListener('click', function () { setActiveSeq(r.si); goStep('diseno'); });
        var cp = h('button', 'pill ghost small', 'Copiar detalle para soporte'); cp.type = 'button';
        cp.addEventListener('click', function () { copyText('Laddersu ' + (appVersion || Model.HOST_VER) + ' · frase ' + (r.si + 1) + '\n' + r.msg + '\n' + logs.slice(-12).map(function (l) { return l.t + ' ' + l.m; }).join('\n')); say('Detalle copiado.', 'ok'); });
        row.appendChild(goF); row.appendChild(cp); rc.appendChild(row);
      }
      box.appendChild(rc);
    }
    // resumen
    var nw = 0, nsfx = 0; st.seqs.forEach(function (q, i) { q.words.forEach(function (w, j) { nw++; if (ES.autoSfxFor(ES.normalizeClass(w.c), j, S.sfxAuto)) { nsfx++; } }); void i; });
    var stats = h('div', 'genStats');
    [[st.seqs.length, st.seqs.length === 1 ? 'frase' : 'frases'], [nw, 'capas de texto'], [nsfx, nsfx === 1 ? 'sonido' : 'sonidos']].forEach(function (x) { var c = h('div', 'stat'); c.appendChild(h('b', '', String(x[0]))); c.appendChild(h('span', '', x[1])); stats.appendChild(c); });
    box.appendChild(stats);
    box.appendChild(h('div', 'lab2', 'Antes de generar'));
    genChecks().forEach(function (c) {
      var e = h('div', 'chk ' + c.k); e.appendChild(icon(c.k === 'ok' ? 'check' : (c.k === 'err' ? 'x' : 'eye')));
      e.appendChild(h('span', '', c.t));
      if (c.fix) { var fx = h('button', 'pill ghost small', c.fix); fx.type = 'button'; fx.addEventListener('click', function () { if (c.si != null) { setActiveSeq(c.si); } goStep(c.go); }); e.appendChild(fx); }
      box.appendChild(e);
    });
    // opciones
    var ch = Model.changedSeqs(st, S);
    var opts = h('div', 'genOpts');
    opts.appendChild(fld('Reemplazar lo generado antes', toggle('replacePrev', function () { return S.replacePrev !== false; }, function (v) { S.replacePrev = v; saveCfg(); renderGenerar(); }), 'Tus propias capas no se tocan'));
    if (!ui.comp || !ui.comp.ok || S.newComp) { opts.appendChild(fld('Crear una composición nueva', toggle('newComp', null, function (v) { S.newComp = v; saveCfg(); renderGenerar(); }))); }
    var onlyOk = ch !== null && ch.length < st.seqs.length;
    var o2 = fld('Solo las frases que cambiaron', toggle('genOnly', function () { return onlyOk && ui.genOnly; }, function (v) { ui.genOnly = v; renderGenerar(); }),
      ch === null ? 'Se genera todo: es la primera vez o cambiaron los ajustes.' : (ch.length + (ch.length === 1 ? ' frase cambió' : ' frases cambiaron') + ' desde la última vez.'));
    o2.classList.toggle('dis', !onlyOk); var sw = o2.querySelector('.switch'); if (sw) { sw.disabled = !onlyOk; }
    o2.appendChild(h('small', 'soft', ch === null ? 'Se genera todo: es la primera vez o cambiaron los ajustes.' : (ch.length ? ch.length + (ch.length === 1 ? ' frase cambió' : ' frases cambiaron') + ' desde la última vez.' : 'Nada cambió desde la última vez.')));
    opts.appendChild(o2);
    box.appendChild(opts);
    var only = onlyOk && ui.genOnly ? ch : null;
    var n = only ? only.length : st.seqs.length;
    var btn = h('button', 'pill big', only && !only.length ? 'Nada que generar' : 'Generar ' + n + (n === 1 ? ' frase' : ' frases')); btn.type = 'button'; btn.id = 'btnGenAll';
    btn.disabled = !!(only && !only.length) || (!S.newComp && (!ui.comp || !ui.comp.ok) && hasAE());
    btn.addEventListener('click', function () { generate(only); });
    box.appendChild(btn);
  }
  function job0seq(g) { var q = g && g.texts ? g.texts[g.done] : null; return q || ''; }
  function copyText(t) { var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta); }

  // ---------- menu ⋯ ----------
  (function () {
    var btn = $('btnMore'), m = $('moreMenu');
    var close = function () { m.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', function (ev) { ev.stopPropagation(); var open = m.hidden; m.hidden = !open; btn.setAttribute('aria-expanded', open ? 'true' : 'false'); });
    document.addEventListener('click', function (ev) { if (!m.hidden && !m.contains(ev.target)) { close(); } });
    m.addEventListener('click', function (ev) { if (ev.target.closest('button')) { close(); } });
    $('btnNew').addEventListener('click', function () { if (st.seqs.length) { clearAll(); } });
  })();

  // ================= importar SRT / IA =================
  function processSRT(text, name) {
    var entries = ES.parseSRT(text);
    if (!entries.length) { say('No encontré subtítulos en ese texto. Revisa que sea un archivo .srt.', 'err'); return; }
    snap(); st = Model.fromEntries(entries, S);
    st.src = { name: name || 'subtitulos.srt' }; st.based = false;
    Model.clearSel(sel); ui.activeId = null; ui.activeSi = 0; ui.fsel = {}; ui.result = null; ui.step = 'texto'; persistEdit(); render();
    say(entries.length + ' palabras importadas. Revisa el texto y sigue con las frases.', 'ok');
  }
  readPicked($('srtFile'), function (txt, name) { processSRT(txt, name); });
  readPicked($('srtFile2'), function (txt, name) { processSRT(txt, name); });
  $('btnParse').addEventListener('click', function () { processSRT($('srtPaste').value, 'texto pegado'); });
  (function () {
    var dz = $('dropZone');
    ['dragenter', 'dragover'].forEach(function (e) { dz.addEventListener(e, function (ev) { ev.preventDefault(); dz.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (e) { dz.addEventListener(e, function (ev) { ev.preventDefault(); dz.classList.remove('over'); }); });
    dz.addEventListener('drop', function (ev) {
      var f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0]; if (!f) { return; }
      var rd = new FileReader(); rd.onload = function () { processSRT(String(rd.result), f.name); }; rd.readAsText(f, 'utf-8');
    });
  })();

  $('btnClean').addEventListener('click', function () {
    if (!st.seqs.length) { return; }
    var all = !Model.selCount(st, sel);
    mutate(function () { if (all) { Model.selectAll(st, sel); } Model.resetEffects(st, sel); if (all) { Model.clearSel(sel); } });
    say(all ? 'Efectos quitados de toda la edición.' : 'Efectos quitados de la selección.', 'ok');
  });
  $('btnUndo').addEventListener('click', undo);
  $('btnRedo').addEventListener('click', redo);

  function closeSizes() { $('sizesMenu').hidden = true; $('btnSizes').setAttribute('aria-expanded', 'false'); }
  $('btnSizes').addEventListener('click', function (ev) { ev.stopPropagation(); var open = $('sizesMenu').hidden; $('sizesMenu').hidden = !open; $('btnSizes').setAttribute('aria-expanded', open ? 'true' : 'false'); });
  document.addEventListener('click', function (ev) { if (!$('sizesMenu').contains(ev.target)) { closeSizes(); } if (!$('fontPop').contains(ev.target) && !$('btnFont').contains(ev.target)) { $('fontPop').hidden = true; } });
  $('btnLocal').addEventListener('click', function () { closeSizes(); mutate(function () { Model.autoSizes(st); }); say('Tamaños detectados con reglas locales.', 'ok'); });
  $('btnCopyPrompt').addEventListener('click', function () {
    closeSizes();
    var ta = document.createElement('textarea'); ta.value = ES.buildAIPrompt(st.seqs);
    document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta);
    say(ok ? 'Prompt copiado. Pégalo en tu IA y luego usa “Pegar respuesta de la IA”.' : 'No se pudo copiar. Vuelve a intentarlo.', ok ? 'ok' : 'err');
  });
  $('btnPasteJSON').addEventListener('click', function () { closeSizes(); $('aiBox').hidden = false; $('aiJSON').focus(); });
  $('btnCloseAI').addEventListener('click', function () { $('aiBox').hidden = true; });
  $('btnApplyJSON').addEventListener('click', function () {
    var r = ES.parseAIResponse($('aiJSON').value, st.seqs);
    if (!r.ok) { say(r.warnings.join(' '), 'err'); return; }
    mutate(function () { Model.applySizes(st, r.classes); }); $('aiBox').hidden = true;
    say('Respuesta de la IA aplicada.' + (r.warnings.length ? ' ' + r.warnings.join(' ') : ''), r.warnings.length ? '' : 'ok');
  });

  // fuente por defecto
  var defFontPicker = null;
  $('btnFont').addEventListener('click', function (ev) {
    ev.stopPropagation(); var p = $('fontPop');
    if (!p.hidden) { p.hidden = true; return; }
    p.hidden = false;
    if (!defFontPicker) {
      defFontPicker = FontPicker(p, { getValue: function () { return S.font; }, emptyText: 'Ninguna elegida: After Effects usa su fuente predeterminada',
        onPick: function (ps) { S.font = ps; saveCfg(); renderFontPickers(); render(); },
        onInherit: function () { S.font = ''; saveCfg(); renderFontPickers(); render(); }, inheritText: 'Usar la de After Effects' });
    }
    defFontPicker.render(); defFontPicker.focus();
  });
  $('fontPop').addEventListener('click', function (ev) { ev.stopPropagation(); });

  // ================= pestanas =================
  function showTab(name) {
    ui.tab = name;
    ['editor', 'library'].forEach(function (t) { $('tab-' + t).hidden = (t !== name); });
    var tabs = document.querySelectorAll('.tab'), i;
    for (i = 0; i < tabs.length; i++) { var on = tabs[i].getAttribute('data-tab') === name; tabs[i].classList.toggle('on', on); tabs[i].setAttribute('aria-selected', on ? 'true' : 'false'); }
    closeMenu(); $('toast').hidden = true; $('foot').hidden = name !== 'editor'; if (name === 'library') { showLib(ui.lib); } else { render(); }
  }
  function showLib(w) {
    ui.lib = w; $('lib-comp').hidden = w !== 'comp'; $('lib-pres').hidden = w !== 'pres'; $('lib-snd').hidden = w !== 'snd';
    var ss = document.querySelectorAll('.stab'), i; for (i = 0; i < ss.length; i++) { ss[i].classList.toggle('on', ss[i].getAttribute('data-lib') === w); }
    if (w === 'snd') { renderSounds(); } else if (w === 'pres') { renderPres(); } else { loadLib(); }
  }
  (function () {
    var i, tabs = document.querySelectorAll('.tab'), ss = document.querySelectorAll('.stab');
    for (i = 0; i < tabs.length; i++) { tabs[i].addEventListener('click', function (ev) { showTab(ev.currentTarget.getAttribute('data-tab')); }); }
    for (i = 0; i < ss.length; i++) { ss[i].addEventListener('click', function (ev) { showLib(ev.currentTarget.getAttribute('data-lib')); }); }
  })();
  $('btnSettings').addEventListener('click', function () { renderSettings(); $('settings').hidden = false; closeMenu(); });
  function openLook(style) { ui.lookStyle = style; renderSettings(); $('settings').hidden = false; closeMenu(); var c = $('lookCard'); if (c) { c.scrollIntoView({ block: 'start' }); } }
  $('btnCloseSettings').addEventListener('click', function () { $('settings').hidden = true; saveCfg(); render(); });

  // ----- atajos -----
  var KEYS = [
    ['Elegir', ''], [['Clic'], 'elige una palabra (reemplaza la anterior)'], [['Ctrl', 'Clic'], 'suma o quita'], [['Mayús', 'Clic'], 'elige un rango'],
    [['←', '→'], 'palabra anterior / siguiente (con Mayús amplía)'], [['↑', '↓'], 'frase anterior / siguiente'], [['Ctrl', 'A'], 'todo'], [['Esc'], 'soltar / cerrar'],
    ['Aplicar', ''], [['1', '2', '3'], 'tamaño S · M · L'], [['K'], 'palabra clave ★'], [['B'], 'caja'], [['U'], 'subrayado'], [['G'], 'brillo'],
    [['E'], 'editar texto'], [['Supr'], 'eliminar'], [['Mayús', 'F10'], 'menú de efectos'],
    ['General', ''], [['Espacio'], 'reproducir la vista previa'], [['Ctrl', 'Z'], 'deshacer'], [['Ctrl', 'Y'], 'rehacer'], [['?'], 'esta ayuda']
  ];
  function renderKeys() {
    var body = $('keysBody'); body.innerHTML = '';
    var g = h('div', 'keyList');
    KEYS.forEach(function (k) {
      if (typeof k[0] === 'string') { g.appendChild(h('div', 'kh', k[0])); return; }
      var kk = h('div', 'kk'); k[0].forEach(function (x) { kk.appendChild(h('kbd', '', x)); });
      g.appendChild(kk); g.appendChild(h('div', 'kd', k[1]));
    });
    body.appendChild(g);
  }
  $('btnKeys').addEventListener('click', function () { renderKeys(); $('keys').hidden = false; closeMenu(); });
  $('btnCloseKeys').addEventListener('click', function () { $('keys').hidden = true; });

  // biblioteca: botones
  $('btnSaveComp').addEventListener('click', openCompSave);
  $('compSaveX').addEventListener('click', closeCompSave);
  $('compSaveNo').addEventListener('click', closeCompSave);
  $('compSaveOk').addEventListener('click', doCompSave);
  $('compName').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { doCompSave(); } });
  $('btnLibRefresh').addEventListener('click', loadLib);
  $('btnLibFolder').addEventListener('click', function () { libCall('ES_libReveal', '', function () {}); });
  $('libSearch').addEventListener('input', renderComps);
  $('compGroup').addEventListener('change', function () { var n = $('compNewGroup'); n.hidden = $('compGroup').value !== '__new'; if (!n.hidden) { n.focus(); } });
  $('btnSavePres').addEventListener('click', savePresentation);
  $('presNameNo').addEventListener('click', function () { $('presName').hidden = true; ui.pendingDef = null; });
  $('presNameOk').addEventListener('click', function () {
    var d = ui.pendingDef; if (!d) { return; }
    var name = $('presNameIn').value.replace(/^\s+|\s+$/g, '') || ('Presentación ' + (pstore.list.length + 1));
    var def = pstore.add({ name: name, comp: d.comp, upper: d.upper, layers: d.layers });
    ui.pendingDef = null; $('presName').hidden = true; renderPres();
    say('Guardada “' + def.name + '” (' + Pres.summary(def) + ').', 'ok', 'msgPres');
  });
  $('presNameIn').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { $('presNameOk').click(); } });
  readPicked($('presFile'), function (txt) {
    var r = pstore.importJSON(txt); renderPres();
    say(r.ok ? r.count + (r.count === 1 ? ' presentación importada.' : ' presentaciones importadas.') : r.error, r.ok ? 'ok' : 'err', 'msgPres');
  });
  $('btnPack').addEventListener('click', function () { var n = pstore.restorePack(); renderPres(); say('Pack restaurado (' + n + ' presentaciones incluidas).', 'ok', 'msgPres'); });
  $('btnAddSound').addEventListener('click', addSound);

  // ================= guardar / importar edicion =================
  $('btnSaveEdit').addEventListener('click', function () {
    if (!st.seqs.length) { say('Todavía no hay nada que guardar.', 'err'); return; }
    saveText('edicion.escedit', JSON.stringify(Model.exportEdit(st, S), null, 1), 'escedit', function (ok, p) { say(ok ? 'Edición guardada: ' + p : 'No se pudo guardar el archivo.', ok ? 'ok' : 'err'); });
  });
  readPicked($('editFile'), function (txt) {
    var d; try { d = JSON.parse(txt); } catch (e) { d = null; }
    var r = Model.importEdit(d);
    if (!r) { say('Ese archivo no es una edición de Laddersu (ni de Escalera Subs).', 'err'); return; }
    snap(); st = r.st; Model.clearSel(sel); ui.activeId = null; ui.fsel = {}; ui.result = null; ui.step = 'frases'; persistEdit(); render(); say('Edición importada: ' + st.seqs.length + ' frases.', 'ok');
  });

  // ================= generar (por pasos, se puede detener) =================
  // Todo se ve en el paso Generar: progreso, Detener y el resultado (con la frase que falló, si alguna).
  var gen = null;   // {run, total, done, stop, idx, texts}
  function sayApply(m, c) { logLine(m, c); if (c === 'err') { say(m, 'err'); } }
  function genButtons() { ui.gen = gen; if (ui.step === 'generar') { renderGenerar(); } }
  function finishGen(result) {
    gen = null; ui.gen = null; ui.result = result; refreshComp(); logLine(result.title + (result.msg ? ' ' + result.msg : ''), result.ok ? 'ok' : 'err');
    if (ui.step === 'generar') { renderGenerar(); } else { say(result.title, result.ok ? 'ok' : 'err'); }
  }
  function generate(only) {
    if (gen) { gen.stop = true; genButtons(); return; }
    if (!st.seqs.length) { return; }
    saveCfg();
    var job = Model.buildJob(st, S, { only: only && only.length ? only : null, sfxPath: sfxPath, presDefs: pstore.defs(), assign: Pres.assignSlots });
    if (!hasAE()) { finishGen({ ok: false, title: 'Abre este panel dentro de After Effects para generar.' }); return; }
    var last = job.seqs[job.seqs.length - 1];
    var head = { cfg: job.cfg, sfx: job.sfx, pres: job.pres, replace: job.replace, need: last.words[last.words.length - 1].end + 2 };
    var idx = job.seqs.map(function (q) { return q.n - 1; });
    gen = { run: '', total: job.seqs.length, done: 0, stop: false, idx: idx, texts: job.seqs.map(function (q) { return q.words.map(function (w) { return w.text; }).join(' '); }) };
    ui.result = null; genButtons();
    ensureHost(function (ok) {
      if (!ok) { finishGen({ ok: false, title: 'No se pudo cargar el motor en After Effects.', msg: 'Cierra el panel, ábrelo de nuevo y reintenta.' }); return; }
      evalAE('ES_begin(' + JSON.stringify(JSON.stringify(head)) + ')', function (r) {
        var b = parseJSON(r);
        if (!b || !b.ok) { finishGen({ ok: false, title: 'No se pudo empezar.', msg: b ? b.msg : 'Respuesta inesperada de After Effects: ' + r }); return; }
        gen.run = b.run;
        if (b.removed) { logLine('Reemplazadas ' + b.removed + ' capas generadas antes.', ''); }
        (function next() {
          if (!gen) { return; }
          if (gen.stop) { stopped(); return; }
          if (gen.done >= gen.total) {
            evalAE('ES_end()', function (r3) {
              var e = parseJSON(r3);
              if (e && e.ok) { Model.markGenerated(st, S); persistEdit(); }
              finishGen({ ok: !!(e && e.ok), title: e && e.ok ? 'Listo: ' + gen.total + (gen.total === 1 ? ' frase creada.' : ' frases creadas.') : 'Algo falló al terminar.', msg: e ? e.msg : '' });
            });
            return;
          }
          evalAE('ES_step(' + JSON.stringify(JSON.stringify([job.seqs[gen.done]])) + ')', function (r2) {
            var o = parseJSON(r2);
            if (!o || !o.ok) {
              var run = gen.run, si = gen.idx[gen.done];
              evalAE('ES_stop(' + JSON.stringify(run) + ', false)');
              finishGen({ ok: false, title: 'No se pudo crear la frase ' + (si + 1) + '.', msg: o ? o.msg : 'Respuesta inesperada: ' + r2, si: si });
              return;
            }
            gen.done++; genButtons(); next();
          });
        })();
      });
    });
    function stopped() {
      var run = gen.run, done = gen.done, total = gen.total;
      evalAE('ES_stop(' + JSON.stringify(run) + ', false)', function () {
        finishGen({ ok: false, stopped: true, title: 'Detenido: ' + done + ' de ' + total + ' frases creadas.' });
        offerRemove(run, done);
      });
    }
  }
  // tras detener: ofrecer quitar lo que alcanzo a crearse
  function offerRemove(run, done) {
    var t = $('toast'); if (!done) { return; }
    t.innerHTML = ''; t.className = 'toast';
    t.appendChild(h('span', '', '¿Quitar las ' + done + ' frases ya creadas?'));
    var b = h('button', '', 'Quitar'); b.type = 'button';
    b.addEventListener('click', function () {
      t.hidden = true;
      evalAE('ES_stop(' + JSON.stringify(run) + ', true)', function (r) { var o = parseJSON(r); say(o ? 'Quitadas ' + o.removed + ' capas.' : 'Listo.', 'ok'); });
    });
    var k = h('button', '', 'Dejar'); k.type = 'button'; k.addEventListener('click', function () { t.hidden = true; });
    t.appendChild(b); t.appendChild(k);
    var foot = $('foot'); t.style.bottom = (foot.offsetHeight + 12) + 'px';
    t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 9000);
  }

  // ================= teclado =================
  function stepWord(dir, extend) {
    var ids = Model.allIds(st); if (!ids.length) { return; }
    var cur = ui.activeId != null && ids.indexOf(ui.activeId) >= 0 ? ids.indexOf(ui.activeId) : -1;
    var nx = Math.max(0, Math.min(ids.length - 1, cur + dir));
    Model.click(st, sel, ids[nx], { shift: extend }); ui.activeId = ids[nx]; render();
    var e = document.querySelector('.chip[data-id="' + ids[nx] + '"]'); if (e) { e.scrollIntoView({ block: 'nearest' }); }
  }
  function stepSeq(dir) {
    var si = Math.max(0, Math.min(st.seqs.length - 1, activeSi() + dir)); if (!st.seqs[si]) { return; }
    Model.click(st, sel, st.seqs[si].words[0].id, {}); ui.activeId = st.seqs[si].words[0].id; render();
    var e = document.querySelector('.seq[data-si="' + si + '"]'); if (e) { e.scrollIntoView({ block: 'nearest' }); }
  }
  document.addEventListener('keydown', function (ev) {
    if (menuOpen() && !(ev.target && ev.target.tagName === 'INPUT')) { if (menuKey(ev)) { return; } }
    var tag = (ev.target && ev.target.tagName) || '', typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (ev.key === 'Escape') {
      if (menuOpen()) { closeMenu(); } else if (!$('keys').hidden) { $('keys').hidden = true; } else if (!$('settings').hidden) { $('btnCloseSettings').click(); }
      else if (mon.playing) { stopPlay(); } else if (ui.step === 'frases' && selSis().length) { ui.fsel = {}; render(); } else { Model.clearSel(sel); render(); }
      return;
    }
    if (typing) { return; }
    var mod = ev.ctrlKey || ev.metaKey, k = ev.key, has = Model.selCount(st, sel) > 0, ed = ui.tab === 'editor' && ui.step === 'diseno' && $('settings').hidden && $('keys').hidden;
    if (mod && (k === 'z' || k === 'Z')) { ev.preventDefault(); if (ev.shiftKey) { redo(); } else { undo(); } return; }
    if (mod && (k === 'y' || k === 'Y')) { ev.preventDefault(); redo(); return; }
    if (!ed) { return; }
    if (mod && (k === 'a' || k === 'A')) { ev.preventDefault(); Model.selectAll(st, sel); render(); return; }
    if (mod) { return; }
    if (k === '?') { $('btnKeys').click(); return; }
    if (k === ' ') { ev.preventDefault(); togglePlay(); return; }
    if (k === 'ArrowRight' || k === 'ArrowLeft') { ev.preventDefault(); stepWord(k === 'ArrowRight' ? 1 : -1, ev.shiftKey); return; }
    if (k === 'ArrowDown' || k === 'ArrowUp') { ev.preventDefault(); stepSeq(k === 'ArrowDown' ? 1 : -1); return; }
    if (!has) { return; }
    var u = function (f) { return Model.uniform(st, sel, f); };
    if (k === '1' || k === '2' || k === '3') { quick({ size: ({ 1: 'S', 2: 'M', 3: 'L' })[k] }); }
    else if (k === 'k' || k === 'K') { quick({ brand: u('brand') !== true }); }
    else if (k === 'b' || k === 'B') { quick({ fmt: u('fmt') === 'box' ? '' : 'box' }); }
    else if (k === 'u' || k === 'U') { quick({ fmt: u('fmt') === 'underline' ? '' : 'underline' }); }
    else if (k === 'g' || k === 'G') { quick({ glow: u('glow') !== true }); }
    else if (k === 'e' || k === 'E' || k === 'Enter' || k === 'F2') {
      var e1 = document.querySelector('.chip.sel'); if (e1 && Model.selCount(st, sel) === 1) { ev.preventDefault(); var r1 = e1.getBoundingClientRect(); openMenu(r1.left, r1.bottom + 4, { sub: 'edit' }); }
    }
    else if (k === 'Delete' || k === 'Backspace') { ev.preventDefault(); var n = Model.selCount(st, sel); mutate(function () { Model.deleteWords(st, sel); }); say(n === 1 ? 'Palabra eliminada.' : n + ' palabras eliminadas.', 'ok'); }
    else if (k === 'ContextMenu' || (ev.shiftKey && k === 'F10')) {
      var e2 = document.querySelector('.chip.sel'); if (e2) { var r2 = e2.getBoundingClientRect(); ev.preventDefault(); openMenu(r2.left, r2.bottom + 4, {}); var f1 = $('ctx').querySelector('.it:not([disabled])'); kbMark($('ctx'), f1); }
    }
  });

  // ================= actualizaciones =================
  // Avisa en el panel cuando hay una version nueva publicada. La instala la app de escritorio "Laddersu"
  // (%LOCALAPPDATA%\Programs\Laddersu\Laddersu.exe), que se instala junto con el panel.
  var DL_URL = 'https://github.com/Applexby/laddersu/releases/latest/download/Laddersu-Setup.exe';
  var appVersion = '';
  function appExe() {
    try { var p = require('path'), base = process.env.LOCALAPPDATA; return base ? p.join(base, 'Programs', 'Laddersu', 'Laddersu.exe') : ''; } catch (e) { return ''; }
  }
  function openURL(u) {
    try { if (window.cep && window.cep.util) { window.cep.util.openURLInDefaultBrowser(u); return; } } catch (e) {}
    try { require('child_process').spawn('cmd', ['/c', 'start', '', u], { detached: true, stdio: 'ignore' }).unref(); } catch (e2) { window.open(u); }
  }
  function openUpdater() {
    var exe = appExe();
    try {
      if (exe && require('fs').existsSync(exe)) {
        require('child_process').spawn(exe, [], { detached: true, stdio: 'ignore' }).unref();
        say('Se abrió la app Laddersu: pulsa Actualizar y luego reinicia After Effects.', 'ok'); return;
      }
    } catch (e) {}
    say('No encontré la app Laddersu: se descarga el instalador de la última versión.', 'ok');
    openURL(DL_URL);
  }
  function updBar(text, btnLabel, fn, dismissKey) {
    var b = $('updBar'); b.innerHTML = '';
    if (!text) { b.hidden = true; return; }
    b.appendChild(icon('refresh')); b.appendChild(h('span', '', text));
    if (btnLabel) { var x = h('button', 'pill small', btnLabel); x.type = 'button'; x.addEventListener('click', fn); b.appendChild(x); }
    var c = h('button', 'iconBtn'); c.type = 'button'; c.title = 'Ocultar'; c.setAttribute('aria-label', 'Ocultar aviso'); c.appendChild(icon('x'));
    c.addEventListener('click', function () { b.hidden = true; if (dismissKey) { lsSet('laddersu.updDismiss', dismissKey); } });
    b.appendChild(c); b.hidden = false;
  }
  function showUpdate(latest) {
    if (!latest || LadderUpdates.compare(latest, appVersion) <= 0) { return; }
    if (lsGet('laddersu.updDismiss', '') === latest) { return; }
    updBar('Laddersu ' + latest + ' está disponible.', 'Actualizar', openUpdater, latest);
  }
  function checkUpdates(force) {
    if (!hasAE() || typeof require !== 'function' || typeof LadderUpdates === 'undefined' || !appVersion) { return; }
    var last = lsGet('laddersu.updLast', 0);
    if (!force && Date.now() - last < 6 * 3600 * 1000) { showUpdate(lsGet('laddersu.updLatest', '')); return; }
    LadderUpdates.check(appVersion, function (err, s) {
      lsSet('laddersu.updLast', Date.now());
      if (err || !s) { return; }
      lsSet('laddersu.updLatest', s.latest || '');
      if (s.state === 'update') { showUpdate(s.latest); }
    });
  }
  readText('version.json', function (txt) {
    try { appVersion = JSON.parse(txt).version; } catch (e) { appVersion = Model.HOST_VER; }
    if (!appVersion) { appVersion = Model.HOST_VER; }
    checkUpdates(false);
  });

  // ================= arranque =================
  try { if (hasAE()) { EXT = Model.cleanExtPath(window.__adobe_cep__.getSystemPath('extension')); } } catch (e) { EXT = ''; }
  loadCfg();
  sounds = allSounds();
  pstore.load();
  (function () {
    var saved = lsGet('escaleraSubs3.edit', null);
    if (saved && saved.seqs && saved.seqs.length) { st = saved; Model.reseed(st); if (st.based === undefined) { st.based = true; } ui.step = lsGet('laddersu.step', 'texto'); if (!st.based && ui.step !== 'texto') { ui.step = 'frases'; } }
  })();
  render(); renderFontPickers();
  loadFonts();
  refreshComp();
  setInterval(refreshComp, 3000);
  // utilidades para pruebas
  window.__ES = { goStep: goStep, get ui() { return ui; }, checkUpdates: checkUpdates, showUpdate: showUpdate, get st() { return st; }, get sel() { return sel; }, get S() { return S; }, pstore: pstore, processSRT: processSRT, get hits() { return mon.hits; } };
})();

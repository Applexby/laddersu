/*
 * Laddersu - modelo del panel (sin DOM). Se prueba en Node; en el panel se carga antes de main.js.
 * Depende del global ES (jsx/engine.js).
 *
 * Estado: st = {seqs:[{words:[{id,text,start,end,c}], start, end, align, pres}]}
 *   c    = clase de la palabra (ES.normalizeClass)  align = '' | patron  pres = '' | id de presentacion
 * Seleccion: sel = {m:{id:true}, anchor:id}  (por identidad de palabra: sobrevive a mover / cortar / unir)
 */
var Model = (function () {
  var M = {};
  var uid = 0;

  M.defaults = function () {
    return {
      font: '', upper: true, colBase: '#ffffff', colBrand: '#ffd400', colHl: '#ffd400',
      szS: 50, szM: 65, szL: 85, gapPx: 17, lineGap: 8,
      align: 'auto', fit: true,
      marginX: 16, zoneTop: 50, zoneBottom: 74, centerY: 61, guide: false,
      tail: 0.15, animPreset: 'slideUp', animDist: 40, animBlur: 20, animDur: 0.3, animBig: false,
      glowColor: '#ffd400', glowSize: 28, glowOpacity: 85,
      sfxAuto: { sfx: '', on: 'L' }, sfxDb: -8,
      newComp: false, compW: 1080, compH: 1920, compFps: 30,
      groupGap: 0.4, groupWeight: 4,
      editStyle: 'lockup', karSize: 'M', karBox: '#ffd400', karMove: 0.12, karRadius: 14, replacePrev: true,
      // estilos de una linea: frases cortas de lineWords palabras
      lineWords: 2,
      // "Una linea" (tradicional): fuente de la edicion, blanco, espacios normales, entra con la animacion de la edicion
      linFont: '', linSize: 64, linColor: '#ffffff', linKey: '#ffd400', linCenterY: 70, linShadow: true, linExit: false, linUpper: false,
      // APPLEXBY: rojo, minusculas, letras y palabras muy juntas, contorno blanco y sombra suave; entra con desenfoque
      apxFont: 'Archivo-Bold', apxSize: 64, apxColor: '#ff1a1a', apxKey: '#ff1a1a', apxCenterY: 70, apxShadow: true, apxExit: true,
      apxLower: true, apxTrack: -60, apxGap: 14, apxStroke: true, apxStrokeColor: '#ffffff', apxStrokeW: 5, apxLook: 2,
      hideUnderT2: true
    };
  };

  // ---------- construccion ----------
  M.HOST_VER = '0.6.1';
  M.newId = function () { uid++; return uid; };
  // tras restaurar un estado guardado: evita ids repetidos
  M.reseed = function (st) {
    var a = M.allIds(st), i;
    for (i = 0; i < a.length; i++) { if (a[i] > uid) { uid = a[i]; } }
  };

  M.makeWord = function (text, start, end, c) {
    return { id: M.newId(), text: text, start: start, end: end, c: ES.normalizeClass(c) };
  };

  M.makeSeq = function (words) {
    var s = { words: words, start: 0, end: 0, align: '', pres: '', style: '' };
    M.fitTimes(s);
    return s;
  };

  M.fitTimes = function (s) {
    var i, a = Infinity, b = -Infinity;
    for (i = 0; i < s.words.length; i++) {
      if (s.words[i].start < a) { a = s.words[i].start; }
      if (s.words[i].end > b) { b = s.words[i].end; }
    }
    if (s.words.length) { s.start = a; s.end = b; }
  };

  // entries: salida de ES.parseSRT -> estado con clases automaticas (reglas locales)
  // Estilos de una linea ("Una linea", APPLEXBY): frases cortas de S.lineWords palabras y sin palabra clave automatica.
  M.fromEntries = function (entries, S) {
    S = S || M.defaults();
    var seqs = [], i, j;
    if (ES.isLineStyle(S.editStyle)) {
      var flat = [];
      for (i = 0; i < entries.length; i++) { flat.push({ text: String(entries[i].text).replace(/^\s+|\s+$/g, ''), start: entries[i].start, end: entries[i].end }); }
      var gs = M.shortGroups(flat, S);
      for (i = 0; i < gs.length; i++) {
        var w1 = [];
        for (j = 0; j < gs[i].length; j++) { var c1 = ES.autoClassify([gs[i][j]])[0]; c1.size = 'M'; c1.brand = false; w1.push(M.makeWord(gs[i][j].text, gs[i][j].start, gs[i][j].end, c1)); }
        seqs.push(M.makeSeq(w1));
      }
      return { seqs: seqs };
    }
    var raw = ES.groupSequences(entries, { gap: S.groupGap, maxWeight: S.groupWeight });
    for (i = 0; i < raw.length; i++) {
      var cl = ES.autoClassify(raw[i].words), ws = [];
      for (j = 0; j < raw[i].words.length; j++) {
        var w = raw[i].words[j];
        ws.push(M.makeWord(w.text, w.start, w.end, cl[j]));
      }
      seqs.push(M.makeSeq(ws));
    }
    return { seqs: seqs };
  };
  M.shortGroups = function (items, S) {
    return ES.groupShort(items, { maxWords: S.lineWords || 2, gap: S.groupGap == null ? 0.4 : S.groupGap, maxChars: S.lineChars || 18 });
  };

  // Rearma las frases para el estilo de la edicion (al pasar de escalera/caja a una linea o al reves).
  // Las palabras se conservan con sus ajustes (color, fuente, sonido...); se pierden los cortes y estilos por frase.
  M.regroup = function (st, S) {
    var line = ES.isLineStyle(S.editStyle), out = [], run = [], i, j;
    function flush() {
      if (!run.length) { return; }
      run.sort(function (a, b) { return a.start - b.start; });
      var groups;
      if (line) {
        groups = M.shortGroups(run, S);
        for (var z = 0; z < run.length; z++) { run[z].c.brand = false; run[z].c.br = false; }
      } else {
        var raw = ES.groupSequences(run, { gap: S.groupGap, maxWeight: S.groupWeight }), k = 0, q;
        groups = [];
        for (q = 0; q < raw.length; q++) { var g = [], r; for (r = 0; r < raw[q].words.length; r++) { g.push(run[k++]); } groups.push(g); }
      }
      for (var gi = 0; gi < groups.length; gi++) {
        var sq = M.makeSeq(groups[gi]);
        if (!line) { var cl = ES.autoClassify(groups[gi]), w; for (w = 0; w < groups[gi].length; w++) { groups[gi][w].c.size = cl[w].size; groups[gi][w].c.brand = cl[w].brand === true; } }
        out.push(sq);
      }
      run = [];
    }
    // las frases con plantilla (presentacion) se quedan como estan; se rearma lo que hay entre ellas
    for (i = 0; i < st.seqs.length; i++) {
      var s0 = st.seqs[i];
      if (s0.pres) { flush(); out.push(s0); continue; }
      for (j = 0; j < s0.words.length; j++) { run.push(s0.words[j]); }
    }
    flush();
    st.seqs = out;
    return out.length;
  };
  // familia de agrupado del estilo: 'line' (frases cortas) o 'block' (escalera / caja)
  M.groupFamily = function (style) { return ES.isLineStyle(style) ? 'line' : 'block'; };

  // aplica tamanos/marca de reglas locales o de IA ([[{size,brand}]]) conservando efectos manuales
  M.applySizes = function (st, classes) {
    var i, j;
    for (i = 0; i < st.seqs.length && i < classes.length; i++) {
      for (j = 0; j < st.seqs[i].words.length && j < classes[i].length; j++) {
        st.seqs[i].words[j].c.size = classes[i][j].size;
        st.seqs[i].words[j].c.brand = classes[i][j].brand === true;
      }
    }
  };
  M.autoSizes = function (st) {
    var out = [], i;
    for (i = 0; i < st.seqs.length; i++) { out.push(ES.autoClassify(st.seqs[i].words)); }
    M.applySizes(st, out);
  };

  // ---------- busqueda ----------
  M.find = function (st, id) {
    var i, j;
    for (i = 0; i < st.seqs.length; i++) {
      for (j = 0; j < st.seqs[i].words.length; j++) {
        if (st.seqs[i].words[j].id === id) { return { si: i, wi: j, w: st.seqs[i].words[j] }; }
      }
    }
    return null;
  };
  M.allIds = function (st) {
    var out = [], i, j;
    for (i = 0; i < st.seqs.length; i++) { for (j = 0; j < st.seqs[i].words.length; j++) { out.push(st.seqs[i].words[j].id); } }
    return out;
  };

  // ---------- seleccion ----------
  M.newSel = function () { return { m: {}, anchor: null }; };
  M.isSel = function (sel, id) { return sel.m[id] === true; };
  M.clearSel = function (sel) { sel.m = {}; sel.anchor = null; };

  // palabras elegidas en orden de lectura: [{si,wi,w}]
  M.selWords = function (st, sel) {
    var out = [], i, j;
    for (i = 0; i < st.seqs.length; i++) {
      for (j = 0; j < st.seqs[i].words.length; j++) {
        if (sel.m[st.seqs[i].words[j].id]) { out.push({ si: i, wi: j, w: st.seqs[i].words[j] }); }
      }
    }
    return out;
  };
  M.selCount = function (st, sel) { return M.selWords(st, sel).length; };

  // clic: simple REEMPLAZA (cambiar de palabra no obliga a soltar la anterior);
  // Ctrl/Cmd alterna; Mayus elige el rango desde el ancla (en orden de lectura, entre frases tambien)
  M.click = function (st, sel, id, mods) {
    mods = mods || {};
    var ids = M.allIds(st), k, a, b;
    if (mods.shift && sel.anchor != null && M.find(st, sel.anchor)) {
      a = ids.indexOf(sel.anchor); b = ids.indexOf(id);
      if (a < 0 || b < 0) { return; }
      var lo = Math.min(a, b), hi = Math.max(a, b);
      if (!mods.ctrl) { sel.m = {}; }
      for (k = lo; k <= hi; k++) { sel.m[ids[k]] = true; }
      return;
    }
    if (mods.ctrl) {
      if (sel.m[id]) { delete sel.m[id]; } else { sel.m[id] = true; sel.anchor = id; }
      return;
    }
    sel.m = {}; sel.m[id] = true; sel.anchor = id;
  };

  // clic derecho: si la palabra ya esta elegida se conserva la seleccion; si no, pasa a ser la unica
  M.contextTarget = function (st, sel, id) {
    if (!sel.m[id]) { sel.m = {}; sel.m[id] = true; sel.anchor = id; }
  };

  M.selectSeq = function (st, sel, si, additive) {
    var s = st.seqs[si], i;
    if (!s) { return; }
    if (!additive) { sel.m = {}; }
    for (i = 0; i < s.words.length; i++) { sel.m[s.words[i].id] = true; }
    sel.anchor = s.words[0] ? s.words[0].id : null;
  };
  M.selectAll = function (st, sel) {
    var ids = M.allIds(st), i;
    sel.m = {};
    for (i = 0; i < ids.length; i++) { sel.m[ids[i]] = true; }
    sel.anchor = ids.length ? ids[0] : null;
  };
  // rectangulo (marquee): ids dentro del area
  M.selectIds = function (sel, ids, additive) {
    var i;
    if (!additive) { sel.m = {}; }
    for (i = 0; i < ids.length; i++) { sel.m[ids[i]] = true; }
    if (ids.length) { sel.anchor = ids[0]; }
  };
  M.seqsWithSelection = function (st, sel) {
    var ws = M.selWords(st, sel), out = [], i;
    for (i = 0; i < ws.length; i++) { if (!out.length || out[out.length - 1] !== ws[i].si) { out.push(ws[i].si); } }
    return out;
  };

  // ---------- efectos por palabra ----------
  // patch: {size,color,trans,fmt,boxColor,sfx,font,brand,glow,glowColor,caps}
  M.applyPatch = function (st, sel, patch) {
    var ws = M.selWords(st, sel), i, f;
    for (i = 0; i < ws.length; i++) { for (f in patch) { ws[i].w.c[f] = patch[f]; } }
    return ws.length;
  };

  // valor comun en la seleccion; undefined sin seleccion; null si hay valores distintos
  M.uniform = function (st, sel, field) {
    var ws = M.selWords(st, sel), i, v;
    if (!ws.length) { return undefined; }
    v = ws[0].w.c[field];
    for (i = 1; i < ws.length; i++) { if (ws[i].w.c[field] !== v) { return null; } }
    return v;
  };

  // ---------- quitar por partes ----------
  // efectos presentes en la seleccion: [{k, label, n}] (solo los que alguna palabra tiene)
  M.EFFECTS = [
    ['trans', 'Animación propia'], ['fmtBox', 'Caja'], ['fmtUnder', 'Subrayado'], ['glow', 'Brillo'], ['color', 'Color del texto'],
    ['font', 'Fuente propia'], ['sfx', 'Sonido'], ['caps', 'Mayúsculas propias'], ['br', 'Salto de línea'], ['brand', 'Palabra clave ★']
  ];
  function hasEff(c, k) {
    if (k === 'fmtBox') { return c.fmt === 'box'; }
    if (k === 'fmtUnder') { return c.fmt === 'underline'; }
    if (k === 'glow' || k === 'br' || k === 'brand') { return c[k] === true; }
    return !!c[k];
  }
  M.presentEffects = function (st, sel) {
    var ws = M.selWords(st, sel), out = [], i, j;
    for (i = 0; i < M.EFFECTS.length; i++) {
      var n = 0;
      for (j = 0; j < ws.length; j++) { if (hasEff(ws[j].w.c, M.EFFECTS[i][0])) { n++; } }
      if (n) { out.push({ k: M.EFFECTS[i][0], label: M.EFFECTS[i][1], n: n }); }
    }
    return out;
  };
  M.removeEffect = function (st, sel, k) {
    var ws = M.selWords(st, sel), i, n = 0;
    for (i = 0; i < ws.length; i++) {
      var c = ws[i].w.c;
      if (!hasEff(c, k)) { continue; }
      n++;
      if (k === 'fmtBox' || k === 'fmtUnder') { c.fmt = ''; c.boxColor = ''; }
      else if (k === 'glow') { c.glow = false; c.glowColor = ''; }
      else if (k === 'br' || k === 'brand') { c[k] = false; }
      else { c[k] = ''; }
    }
    return n;
  };

  M.resetEffects = function (st, sel) {
    return M.applyPatch(st, sel, { color: '', font: '', trans: '', fmt: '', boxColor: '', sfx: '', glow: false, glowColor: '', caps: '' });
  };

  // ---------- estructura: cortar / unir / saltos / texto ----------
  function copySeqProps(from, to) { to.align = from.align; to.pres = from.pres; to.style = from.style || ''; }

  M.split = function (st, si, wi) {
    var s = st.seqs[si];
    if (!s || wi <= 0 || wi >= s.words.length) { return false; }
    var b = M.makeSeq(s.words.splice(wi));
    copySeqProps(s, b);
    M.fitTimes(s);
    st.seqs.splice(si + 1, 0, b);
    return true;
  };

  M.merge = function (st, si) {
    var a = st.seqs[si], b = st.seqs[si + 1], i;
    if (!a || !b) { return false; }
    for (i = 0; i < b.words.length; i++) { a.words.push(b.words[i]); }
    M.fitTimes(a);
    st.seqs.splice(si + 1, 1);
    return true;
  };

  M.mergeWithPrev = function (st, si) { return si > 0 ? M.merge(st, si - 1) : false; };

  M.toggleBreak = function (st, sel) {
    var ws = M.selWords(st, sel), i, v;
    if (!ws.length) { return 0; }
    v = !ws[0].w.c.br;
    for (i = 0; i < ws.length; i++) { ws[i].w.c.br = v; }
    return ws.length;
  };

  // edita el texto; si el nuevo texto tiene varias palabras, reparte el tiempo en partes iguales
  M.editText = function (st, id, text) {
    var f = M.find(st, id), parts, w, k, t, dur, news = [];
    text = String(text || '').replace(/^\s+|\s+$/g, '');
    if (!f || !text) { return false; }
    parts = text.split(/\s+/);
    w = f.w;
    if (parts.length === 1) { w.text = text; return true; }
    dur = (w.end - w.start) / parts.length;
    for (k = 0; k < parts.length; k++) {
      t = k === 0 ? w : M.makeWord(parts[k], w.start + dur * k, w.start + dur * (k + 1), w.c);
      if (k === 0) { t.text = parts[0]; t.end = w.start + dur; } else { t.c.br = false; news.push(t); }
    }
    Array.prototype.splice.apply(st.seqs[f.si].words, [f.wi + 1, 0].concat(news));
    return true;
  };

  M.deleteWords = function (st, sel) {
    var ws = M.selWords(st, sel), i, j, ids = {};
    for (i = 0; i < ws.length; i++) { ids[ws[i].w.id] = true; }
    for (i = st.seqs.length - 1; i >= 0; i--) {
      var kept = [];
      for (j = 0; j < st.seqs[i].words.length; j++) { if (!ids[st.seqs[i].words[j].id]) { kept.push(st.seqs[i].words[j]); } }
      st.seqs[i].words = kept;
      if (!kept.length) { st.seqs.splice(i, 1); } else { M.fitTimes(st.seqs[i]); }
    }
    M.clearSel(sel);
    return ws.length;
  };

  // reasigna los tiempos de la secuencia segun su orden (tiempos ordenados) para que el orden visual
  // siempre coincida con el orden temporal
  function syncTimes(s) {
    var st = [], en = [], i;
    for (i = 0; i < s.words.length; i++) { st.push(s.words[i].start); en.push(s.words[i].end); }
    st.sort(function (a, b) { return a - b; });
    en.sort(function (a, b) { return a - b; });
    for (i = 0; i < s.words.length; i++) { s.words[i].start = st[i]; s.words[i].end = Math.max(en[i], st[i] + 0.05); }
    M.fitTimes(s);
  }

  function extract(st, ids) {
    var out = [], i, j;
    for (i = 0; i < st.seqs.length; i++) {
      var keep = [];
      for (j = 0; j < st.seqs[i].words.length; j++) {
        var w = st.seqs[i].words[j];
        if (ids[w.id]) { out.push(w); } else { keep.push(w); }
      }
      st.seqs[i].words = keep;
    }
    return out;
  }
  function cleanup(st) {
    var i;
    for (i = st.seqs.length - 1; i >= 0; i--) {
      if (!st.seqs[i].words.length) { st.seqs.splice(i, 1); } else { M.fitTimes(st.seqs[i]); }
    }
  }
  function idsOf(st, sel, list) {
    var m = {}, i;
    if (list) { for (i = 0; i < list.length; i++) { m[list[i]] = true; } } else { m = sel.m; }
    return m;
  }

  // mueve palabras a la frase destino (objeto seq), antes de la palabra `beforeId` (o al final)
  M.moveWords = function (st, ids, destSeq, beforeId) {
    var set = idsOf(st, null, ids), moved, pos, i;
    if (beforeId != null && set[beforeId]) { beforeId = null; }
    moved = extract(st, set);
    if (!moved.length) { return 0; }
    pos = destSeq.words.length;
    if (beforeId != null) {
      for (i = 0; i < destSeq.words.length; i++) { if (destSeq.words[i].id === beforeId) { pos = i; break; } }
    }
    Array.prototype.splice.apply(destSeq.words, [pos, 0].concat(moved));
    // si la frase destino quedo vacia de origen por cleanup, sigue en st.seqs (tiene palabras ahora)
    syncTimes(destSeq);
    cleanup(st);
    return moved.length;
  };

  // crea una frase nueva en la posicion `at` (indice en st.seqs tras limpiar) con las palabras
  M.moveToNewSeq = function (st, ids, at) {
    var set = idsOf(st, null, ids), before = st.seqs[at] || null, moved = extract(st, set), ns;
    if (!moved.length) { return null; }
    ns = M.makeSeq(moved);
    syncTimes(ns);
    var pos = before ? st.seqs.indexOf(before) : st.seqs.length;
    st.seqs.splice(pos, 0, ns);
    cleanup(st);
    return ns;
  };

  // ---------- presentaciones ----------
  // las palabras elegidas de cada tramo contiguo pasan a ser su propia frase con la presentacion
  M.applyPresentation = function (st, sel, presId) {
    var ws = M.selWords(st, sel), n = 0, si, runs = [], i, cur = null;
    for (i = 0; i < ws.length; i++) {
      var prev = ws[i - 1];
      if (cur && prev && prev.si === ws[i].si && prev.wi + 1 === ws[i].wi) { cur.ids.push(ws[i].w.id); }
      else { cur = { ids: [ws[i].w.id] }; runs.push(cur); }
    }
    for (i = 0; i < runs.length; i++) {
      var f = M.find(st, runs[i].ids[0]);
      var len = runs[i].ids.length;
      M.split(st, f.si, f.wi);                       // separa por delante (si no es el inicio)
      f = M.find(st, runs[i].ids[0]);
      if (len < st.seqs[f.si].words.length) { M.split(st, f.si, len); }
      f = M.find(st, runs[i].ids[0]);
      st.seqs[f.si].pres = presId || '';
      n++;
    }
    return n;
  };

  // ---------- anim por defecto desde el preset del panel ----------
  M.defaultAnim = function (S) {
    var p = ES.TRANS[S.animPreset] || ES.TRANS.slideUp;
    return { dir: p.dir, dist: p.dist > 0 ? S.animDist : 0, blur: p.blur > 0 ? S.animBlur : 0, fade: p.fade, dur: S.animDur, scale: p.scale };
  };

  // ---------- trabajo para After Effects ----------
  // o: {only:[indices de frase], sfxPath:fn(id)->ruta, presDefs:{id:def}, assign:fn(def, words)->slots}
  M.buildJob = function (st, S, o) {
    o = o || {};
    var idx = o.only && o.only.length ? o.only : (function () { var a = [], i; for (i = 0; i < st.seqs.length; i++) { a.push(i); } return a; })();
    var seqs = [], used = {}, sfx = {}, presOut = {}, i, j, id;

    for (i = 0; i < idx.length; i++) {
      var si = idx[i], s = st.seqs[si], cls = [], words = [];
      for (j = 0; j < s.words.length; j++) {
        var c = ES.normalizeClass(s.words[j].c);
        c.sfx = ES.autoSfxFor(c, j, S.sfxAuto);
        cls.push(c);
        words.push({ text: s.words[j].text, start: s.words[j].start, end: s.words[j].end });
        if (c.sfx) { used[c.sfx] = true; }
      }
      var item = {
        n: si + 1, words: words, cls: cls, start: s.start, end: s.end,
        nextStart: si < st.seqs.length - 1 ? st.seqs[si + 1].start : null,
        align: s.align || '', alignIndex: si, pres: '', style: s.style || S.editStyle || 'lockup'
      };
      if (s.pres && o.presDefs && o.presDefs[s.pres]) {
        item.pres = s.pres;
        presOut[s.pres] = o.presDefs[s.pres];
        item.slots = o.assign ? o.assign(o.presDefs[s.pres], words) : [];
      }
      seqs.push(item);
    }
    for (id in used) { var p = o.sfxPath ? o.sfxPath(id) : ''; if (p) { sfx[id] = p; } }

    var cfg = {
      font: S.font, upper: !!S.upper,
      baseColorHex: S.colBase, brandColorHex: S.colBrand,
      tail: S.tail, animOnlyBig: !!S.animBig,
      newComp: !!S.newComp, compW: S.compW, compH: S.compH, fps: S.compFps,
      sfxDb: S.sfxDb, guide: !!S.guide,
      zone: { marginX: S.marginX / 100, top: S.zoneTop / 100, bottom: S.zoneBottom / 100, centerY: S.centerY / 100 },
      layout: { sizes: { S: S.szS, M: S.szM, L: S.szL }, gap: S.gapPx, lineGap: S.lineGap, align: S.align, fit: S.fit !== false },
      hl: { colorHex: S.colHl, padX: 14, padY: 8, radius: 18 },
      glow: { colorHex: S.glowColor, size: S.glowSize, opacity: S.glowOpacity },
      anim: M.defaultAnim(S),
      karaoke: { size: S.karSize || 'M', boxColorHex: S.karBox || S.colHl, move: S.karMove == null ? 0.12 : S.karMove, radius: S.karRadius == null ? 14 : S.karRadius },
      line: M.lineLook(S, 'line'),
      apx: M.lineLook(S, 'applexby')
    };
    var replace = { mode: S.replacePrev === false ? 'none' : (o.only && o.only.length ? 'ranges' : 'all'), ranges: [] };
    if (replace.mode === 'ranges') {
      for (i = 0; i < seqs.length; i++) { replace.ranges.push([seqs[i].start, ES.seqEnd(seqs[i], S.tail, seqs[i].nextStart)]); }
    }
    // intervalos en los que los subtitulos (T1) se ocultan: frases con plantilla T2 + los que traiga o.hide (paquetes)
    var hide = [];
    if (S.hideUnderT2 !== false) {
      for (i = 0; i < st.seqs.length; i++) {
        var sq = st.seqs[i], dd = sq.pres && o.presDefs ? o.presDefs[sq.pres] : null;
        if (dd && dd.kind === 'T2') { hide.push([sq.start, ES.seqEnd(sq, S.tail, i < st.seqs.length - 1 ? st.seqs[i + 1].start : null)]); }
      }
      if (o.hide) { for (i = 0; i < o.hide.length; i++) { hide.push(o.hide[i]); } }
    }
    cfg.hide = ES.mergeIntervals(hide);
    return { cfg: cfg, seqs: seqs, sfx: sfx, pres: presOut, replace: replace };
  };

  // Aspecto de los estilos de una linea (lo usan la vista previa y After Effects).
  //   gap = espacio entre palabras (fraccion del tamano)  track = tracking de AE (milesimas de em)
  //   caps = 'lower' | 'upper' | 'none'   anim = id de ES.TRANS ('' = la animacion de la edicion)
  M.lineLook = function (S, style) {
    var d = M.defaults();
    function v(k) { return S[k] == null ? d[k] : S[k]; }
    if (style === 'applexby') {
      return { style: 'applexby', font: v('apxFont') || '', size: v('apxSize'), colorHex: v('apxColor'), keyHex: v('apxKey'),
        centerY: v('apxCenterY') / 100, shadow: v('apxShadow') !== false, exit: v('apxExit') !== false,
        caps: v('apxLower') ? 'lower' : 'none', track: v('apxTrack'), gap: v('apxGap') / 100,
        stroke: v('apxStroke') ? { colorHex: v('apxStrokeColor'), width: v('apxStrokeW') } : null,
        shadowLook: { opacity: 35, distance: 6, softness: 12 }, anim: 'blurIn' };
    }
    return { style: 'line', font: v('linFont') || '', size: v('linSize'), colorHex: v('linColor'), keyHex: v('linKey'),
      centerY: v('linCenterY') / 100, shadow: v('linShadow') !== false, exit: v('linExit') === true,
      caps: v('linUpper') ? 'upper' : 'none', track: 0, gap: 0.28, stroke: null,
      shadowLook: { opacity: 60, distance: 4, softness: 16 }, anim: '' };
  };
  // ajustes guardados de antes del nuevo aspecto APPLEXBY (0.6.0: blanco con clave roja) -> nuevo aspecto
  M.migrateCfg = function (S) {
    if (S.apxLook !== 2) {
      var d = M.defaults(), k;
      for (k in d) { if (d.hasOwnProperty(k) && /^apx/.test(k) && k !== 'apxFont' && k !== 'apxSize' && k !== 'apxCenterY') { S[k] = d[k]; } }
      S.apxLook = 2;
    }
    return S;
  };

  // ---------- guardar / importar edicion ----------
  M.exportEdit = function (st, S) {
    var seqs = [], i, j;
    for (i = 0; i < st.seqs.length; i++) {
      var s = st.seqs[i], ws = [];
      for (j = 0; j < s.words.length; j++) { ws.push({ t: s.words[j].text, s: s.words[j].start, e: s.words[j].end, c: s.words[j].c }); }
      seqs.push({ align: s.align, pres: s.pres, style: s.style || '', w: ws });
    }
    return { escalera: 3, settings: S, seqs: seqs };
  };
  M.importEdit = function (data) {
    var st = { seqs: [] }, i, j;
    if (!data || data.escalera !== 3 || !data.seqs) { return null; }
    for (i = 0; i < data.seqs.length; i++) {
      var d = data.seqs[i], ws = [];
      for (j = 0; j < d.w.length; j++) { ws.push(M.makeWord(d.w[j].t, d.w[j].s, d.w[j].e, d.w[j].c)); }
      var s = M.makeSeq(ws); s.align = d.align || ''; s.pres = d.pres || ''; s.style = d.style || '';
      st.seqs.push(s);
    }
    return { st: st, settings: data.settings || null };
  };

  // ---------- tipografias ----------
  // style de AE ("Bold Italic", "ExtraBold"...) -> peso CSS aproximado para la vista previa
  M.guessWeight = function (style) {
    var s = String(style || '').toLowerCase();
    if (/hairline|thin/.test(s)) { return 100; }
    if (/extra\s*light|ultra\s*light/.test(s)) { return 200; }
    if (/light/.test(s)) { return 300; }
    if (/black|heavy|ultra/.test(s)) { return 900; }
    if (/extra\s*bold|extrabold|ultra\s*bold/.test(s)) { return 800; }
    if (/semi\s*bold|demi/.test(s)) { return 600; }
    if (/bold/.test(s)) { return 700; }
    if (/medium/.test(s)) { return 500; }
    return 400;
  };
  M.fontCss = function (f) {
    return { family: f.f, weight: M.guessWeight(f.s), italic: /italic|oblique/i.test(f.s || '') };
  };

  // busca por familia, estilo o nombre PostScript; todas las palabras deben aparecer
  M.filterFonts = function (fonts, q, limit) {
    var words = String(q || '').toLowerCase().split(/\s+/), out = [], i, j;
    var clean = [];
    for (j = 0; j < words.length; j++) { if (words[j]) { clean.push(words[j]); } }
    for (i = 0; i < fonts.length; i++) {
      var hay = (fonts[i].f + ' ' + fonts[i].s + ' ' + fonts[i].n).toLowerCase(), ok = true;
      for (j = 0; j < clean.length; j++) { if (hay.indexOf(clean[j]) < 0) { ok = false; break; } }
      if (ok) { out.push(fonts[i]); if (limit && out.length >= limit) { break; } }
    }
    return out;
  };

  M.findFont = function (fonts, ps) {
    var i;
    for (i = 0; i < fonts.length; i++) { if (fonts[i].n === ps) { return fonts[i]; } }
    return null;
  };

  // "file:///C:/Users/x/ext" -> "C:/Users/x/ext" (Windows) o "/Users/x/ext" (Mac)
  M.cleanExtPath = function (raw) {
    var p = String(raw || '');
    try { p = decodeURI(p); } catch (e) {}
    p = p.replace(/^file:\/\/\//, '');
    if (!/^[A-Za-z]:/.test(p) && p.charAt(0) !== '/') { p = '/' + p; }
    return p.replace(/\\/g, '/').replace(/\/+$/, '');
  };

  return M;
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Model;

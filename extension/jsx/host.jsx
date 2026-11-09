/*
 * Laddersu - host de After Effects (ExtendScript, ES3).
 * El panel CEP llama a ES_apply(jsonString). El layout sale de engine.js (global ES);
 * aqui se crean capas, se mide el texto real, se animan y se colocan los sonidos.
 *
 * Carga del motor: se intenta aqui por rutas conocidas, pero la via fiable es que el panel
 * inyecte engine.js con evalScript si ES_status() dice que falta (ver js/main.js).
 */
var ES_VERSION = '0.6.2';

function ES_loadEngine() {
  if (typeof ES !== 'undefined' && ES.VERSION === ES_VERSION) { return true; }
  var cands = [], i;
  try { cands.push(File($.fileName).parent.fullName + '/engine.js'); } catch (e1) {}
  try { cands.push(Folder.userData.fullName + '/Adobe/CEP/extensions/com.idealo.laddersu/jsx/engine.js'); } catch (e2) {}
  for (i = 0; i < cands.length; i++) {
    try {
      var f = new File(cands[i]);
      if (f.exists) { $.evalFile(f); if (typeof ES !== 'undefined' && ES.VERSION === ES_VERSION) { return true; } }
    } catch (e3) {}
  }
  return false;
}
ES_loadEngine();

function ES_status() {
  var hasFonts = false;
  try { hasFonts = !!(app.fonts && app.fonts.allFonts); } catch (e) {}
  return '{"engine":' + (typeof ES !== 'undefined' ? 'true' : 'false') + ',"fonts":' + (hasFonts ? 'true' : 'false') +
         ',"ev":"' + (typeof ES !== 'undefined' && ES.VERSION ? ES.VERSION : '') + '","ver":"' + ES_VERSION + '","ae":"' + String(app.version).replace(/"/g, '') + '"}';
}

function ES_parse(s) { return eval('(' + s + ')'); }

function ES_esc(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n\t]/g, ' ');
}

function ES_hex(h, fallback) {
  h = String(h || '').replace('#', '');
  if (h.length === 3) { h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2); }
  if (h.length !== 6 || isNaN(parseInt(h, 16))) { return fallback || [1, 1, 1]; }
  return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255];
}

function ES_compInfo() {
  var c = app.project.activeItem;
  if (c && c instanceof CompItem) {
    return '{"ok":true,"name":"' + ES_esc(c.name) + '","w":' + c.width + ',"h":' + c.height + ',"fps":' + c.frameRate + ',"dur":' + c.duration + '}';
  }
  return '{"ok":false}';
}

// ---------- tipografias instaladas (las mismas que ve AE en el panel Caracter) ----------
function ES_listFonts() {
  try {
    if (!app.fonts || !app.fonts.allFonts) {
      return '{"ok":false,"msg":"Esta version de After Effects no expone la lista de fuentes (requiere 2024 o superior)."}';
    }
    var fam = app.fonts.allFonts, out = [], i, j;
    for (i = 0; i < fam.length; i++) {
      for (j = 0; j < fam[i].length; j++) {
        var f = fam[i][j];
        out.push('{"n":"' + ES_esc(f.postScriptName) + '","f":"' + ES_esc(f.familyName) + '","s":"' + ES_esc(f.styleName) + '"}');
      }
    }
    return '{"ok":true,"fonts":[' + out.join(',') + ']}';
  } catch (e) {
    return '{"ok":false,"msg":"' + ES_esc(e.toString()) + '"}';
  }
}

// ---------- animaciones de entrada ----------
function ES_easeOut(prop, nKeys) {
  var ease = new KeyframeEase(0, 85), i, dims = 1;
  // propiedades espaciales (Posicion) usan UNA curva; Escala usa una por dimension
  try { dims = ES_easeDims(prop); } catch (e0) { dims = 0; }
  if (!dims) { try { if (prop.value instanceof Array) { dims = prop.value.length; } else { dims = 1; } } catch (e1) { dims = 1; } }
  var arr = [];
  for (i = 0; i < dims; i++) { arr.push(ease); }
  try {
    for (i = 1; i <= nKeys; i++) { prop.setTemporalEaseAtKey(i, arr, arr); }
  } catch (e) {}
}

// a = ES.resolveAnim(...) => {dir,dist,blur,fade,dur,scale}
function ES_animateIn(layer, finalPos, a, t0) {
  var d = a.dur, tg = layer.property('ADBE Transform Group');

  if (a.fade) {
    var op = tg.property('ADBE Opacity');
    op.setValueAtTime(t0, 0);
    op.setValueAtTime(t0 + d, 100);
    ES_easeOut(op, 2);
  }
  if (a.blur > 0) {
    var fx = layer.property('ADBE Effect Parade').addProperty('ADBE Gaussian Blur 2');
    var bl = fx.property('ADBE Gaussian Blur 2-0001');
    bl.setValueAtTime(t0, a.blur);
    bl.setValueAtTime(t0 + d, 0);
    ES_easeOut(bl, 2);
  }
  if (a.dir && a.dir !== 'none' && a.dist > 0) {
    var dx = 0, dy = 0;
    if (a.dir === 'up') { dy = a.dist; }
    if (a.dir === 'down') { dy = -a.dist; }
    if (a.dir === 'left') { dx = a.dist; }
    if (a.dir === 'right') { dx = -a.dist; }
    var pos = tg.property('ADBE Position');
    pos.setValueAtTime(t0, [finalPos[0] + dx, finalPos[1] + dy]);
    pos.setValueAtTime(t0 + d, finalPos);
    ES_easeOut(pos, 2);
  }
  if (a.scale) {
    var sc = tg.property('ADBE Scale');
    sc.setValueAtTime(t0, [a.scale.from, a.scale.from]);
    if (a.scale.over > 0) {
      sc.setValueAtTime(t0 + d * 0.65, [a.scale.over, a.scale.over]);
      sc.setValueAtTime(t0 + d, [100, 100]);
      ES_easeOut(sc, 3);
    } else {
      sc.setValueAtTime(t0 + d, [100, 100]);
      ES_easeOut(sc, 2);
    }
  }
}

// ---------- serializador JSON (ExtendScript no trae JSON) ----------
function ES_json(v) {
  var t = typeof v, i, out, k;
  if (v === null || v === undefined) { return 'null'; }
  if (t === 'number') { return isFinite(v) ? String(Math.round(v * 100000) / 100000) : 'null'; }
  if (t === 'boolean') { return v ? 'true' : 'false'; }
  if (t === 'string') { return '"' + ES_esc(v) + '"'; }
  if (v instanceof Array) {
    out = [];
    for (i = 0; i < v.length; i++) { out.push(ES_json(v[i])); }
    return '[' + out.join(',') + ']';
  }
  out = [];
  for (k in v) { if (v.hasOwnProperty(k) && v[k] !== undefined) { out.push('"' + k + '":' + ES_json(v[k])); } }
  return '{' + out.join(',') + '}';
}

function ES_rgbHex(c) {
  function h(x) { var s = Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16); return s.length < 2 ? '0' + s : s; }
  return '#' + h(c[0]) + h(c[1]) + h(c[2]);
}

// ---------- capas de texto y formas ----------
function ES_addWord(comp, text, px, color, font, name, warn) {
  var L = comp.layers.addText(text);
  L.name = name;
  var tp = L.property('ADBE Text Properties').property('ADBE Text Document');
  var td = tp.value;
  td.resetCharStyle();
  td.fontSize = px;
  td.fillColor = color;
  td.applyFill = true;
  td.applyStroke = false;
  td.justification = ParagraphJustification.LEFT_JUSTIFY;
  if (font) {
    try { td.font = font; } catch (e) { if (warn) { warn.fontFail[font] = true; } }
  }
  tp.setValue(td);
  return L;
}

function ES_measurer(comp, cfg, warn) {
  var cache = {}, tmp = null;
  var fn = function (text, px, font, track) {
    font = font || cfg.font || '';
    track = track || 0;
    var k = text + '|' + px + '|' + font + '|' + track;
    if (cache[k] !== undefined) { return cache[k]; }
    if (!tmp) { tmp = ES_addWord(comp, text, px, [1, 1, 1], font, 'ES_tmp', warn); }
    var tp = tmp.property('ADBE Text Properties').property('ADBE Text Document');
    var td = tp.value;
    td.text = text; td.fontSize = px;
    try { td.tracking = track; } catch (eT) {}
    if (font) { try { td.font = font; } catch (e) {} }
    tp.setValue(td);
    cache[k] = tmp.sourceRectAtTime(0, false).width;
    return cache[k];
  };
  fn.dispose = function () { if (tmp) { try { tmp.remove(); } catch (e) {} tmp = null; } };
  return fn;
}

// Coloca la capa con su esquina izquierda sobre la linea base en (x,y).
// El ancla queda en el centro de la palabra para que escala y rebote giren sobre ella.
function ES_place(layer, x, y) {
  var r = layer.sourceRectAtTime(0, false);
  var tg = layer.property('ADBE Transform Group');
  var cx = x + r.width / 2;
  var cy = y + r.top + r.height / 2;
  tg.property('ADBE Anchor Point').setValue([r.left + r.width / 2, r.top + r.height / 2]);
  tg.property('ADBE Position').setValue([cx, cy]);
  return { pos: [cx, cy], w: r.width, h: r.height, base: y };
}

function ES_roundRect(comp, x, y, w, h, color, radius, name) {
  var s = comp.layers.addShape();
  s.name = name;
  var grp = s.property('ADBE Root Vectors Group').addProperty('ADBE Vector Group');
  var rect = grp.property('ADBE Vectors Group').addProperty('ADBE Vector Shape - Rect');
  rect.property('ADBE Vector Rect Size').setValue([w, h]);
  rect.property('ADBE Vector Rect Roundness').setValue(radius);
  var fill = grp.property('ADBE Vectors Group').addProperty('ADBE Vector Graphic - Fill');
  fill.property('ADBE Vector Fill Color').setValue(color);
  s.property('ADBE Transform Group').property('ADBE Position').setValue([x, y]);
  return s;
}

// brillo de neon: sombra sin desplazamiento con el color de la palabra
function ES_addGlow(layer, hexColor, size, opacityPct) {
  var fx = layer.property('ADBE Effect Parade').addProperty('ADBE Drop Shadow');
  var col = ES_hex(hexColor, [1, 0.83, 0]);
  fx.property('ADBE Drop Shadow-0001').setValue([col[0], col[1], col[2], 1]);
  fx.property('ADBE Drop Shadow-0002').setValue(Math.round((opacityPct == null ? 85 : opacityPct) * 2.55));
  fx.property('ADBE Drop Shadow-0003').setValue(0);
  fx.property('ADBE Drop Shadow-0004').setValue(0);
  fx.property('ADBE Drop Shadow-0005').setValue(size || 28);
  try { fx.name = 'Brillo'; } catch (e) {}
}

// zona segura en px a partir de los porcentajes del panel
function ES_zone(cfg, comp) {
  var z = cfg.zone, W = comp.width, H = comp.height;
  return {
    safe: { x0: W * z.marginX, x1: W * (1 - z.marginX), y0: H * z.top, y1: H * z.bottom },
    cx: W / 2, cy: H * z.centerY
  };
}

function ES_guideLayer(comp, zone) {
  var s = comp.layers.addShape();
  s.name = 'M\u00e1rgenes seguros';
  var grp = s.property('ADBE Root Vectors Group').addProperty('ADBE Vector Group');
  var rect = grp.property('ADBE Vectors Group').addProperty('ADBE Vector Shape - Rect');
  rect.property('ADBE Vector Rect Size').setValue([zone.safe.x1 - zone.safe.x0, zone.safe.y1 - zone.safe.y0]);
  var st = grp.property('ADBE Vectors Group').addProperty('ADBE Vector Graphic - Stroke');
  st.property('ADBE Vector Stroke Color').setValue([1, 0.2, 0.3, 1]);
  st.property('ADBE Vector Stroke Width').setValue(3);
  s.property('ADBE Transform Group').property('ADBE Position').setValue([(zone.safe.x0 + zone.safe.x1) / 2, (zone.safe.y0 + zone.safe.y1) / 2]);
  try { s.guideLayer = true; } catch (e) {}
  return s;
}

// ---------- sonidos ----------
function ES_sfxFolder() {
  var i;
  for (i = 1; i <= app.project.numItems; i++) {
    var it = app.project.item(i);
    if (it instanceof FolderItem && (it.name === 'Laddersu SFX' || it.name === 'Escalera SFX')) { return it; }
  }
  return app.project.items.addFolder('Laddersu SFX');
}

function ES_sfxFootage(path, ctx) {
  if (ctx.sfxCache[path] !== undefined) { return ctx.sfxCache[path]; }
  var item = null;
  try {
    var f = new File(path);
    if (f.exists) {
      item = app.project.importFile(new ImportOptions(f));
      try { item.parentFolder = ES_sfxFolder(); } catch (e1) {}
    }
  } catch (e) { item = null; }
  if (!item) { ctx.warn.sfxMissing[path] = true; }
  ctx.sfxCache[path] = item;
  return item;
}

function ES_addSfx(comp, sfxId, t, label, ctx) {
  var path = ctx.sfx[sfxId];
  if (!path) { ctx.warn.sfxMissing[sfxId] = true; return null; }
  if (t >= comp.duration) { return null; }
  var item = ES_sfxFootage(path, ctx);
  if (!item) { return null; }
  var L = comp.layers.add(item);
  L.startTime = t;
  L.name = 'sfx \u00b7 ' + label;
  try {
    var lv = L.property('ADBE Audio Group').property('ADBE Audio Levels');
    lv.setValue([ctx.cfg.sfxDb, ctx.cfg.sfxDb]);
  } catch (e) {}
  ctx.sfxCount++;
  if (ctx.sfxMade) { ctx.sfxMade.push(L); }
  return L;
}

// ---------- palabra: texto + color + fuente + transicion + formato + brillo + sonido ----------
// c = clase normalizada; box = {x,y,size}; txt = texto a mostrar (ya con mayusculas)
// La capa se llama como la palabra para identificarla en la linea de tiempo.
function ES_makeWord(ctx, seq, i, c, box, tin, tout, txt) {
  var comp = ctx.comp, cfg = ctx.cfg, made = ctx.made;
  var col = ES_hex(ES.textColor(c, cfg.baseColorHex, cfg.brandColorHex, cfg.hl.colorHex));
  var L = ES_addWord(comp, txt, box.size, col, c.font || cfg.font, txt, ctx.warn);
  var pl = ES_place(L, box.x, box.y);
  L.inPoint = tin;
  L.outPoint = tout;

  var anim = ES.resolveAnim(cfg.anim, c.trans);
  if (cfg.animOnlyBig && c.size !== 'L' && !c.trans) { anim = ES.resolveAnim(cfg.anim, 'none'); }
  ES_animateIn(L, pl.pos, anim, tin);
  if (c.glow) { ES_addGlow(L, c.glowColor || cfg.glow.colorHex, cfg.glow.size, cfg.glow.opacity); }
  made.push(L);

  if (c.fmt === 'box' || c.fmt === 'underline') {
    var bcol = ES_hex(c.boxColor || cfg.hl.colorHex, [1, 0.83, 0]);
    var R, rp;
    if (c.fmt === 'box') {
      R = ES_roundRect(comp, pl.pos[0], pl.pos[1], pl.w + cfg.hl.padX * 2, pl.h + cfg.hl.padY * 2, bcol, cfg.hl.radius, txt + ' \u00b7 caja');
    } else {
      var th = Math.max(4, box.size * 0.09);
      R = ES_roundRect(comp, pl.pos[0], pl.base + box.size * 0.16, pl.w, th, bcol, th / 2, txt + ' \u00b7 subrayado');
    }
    R.inPoint = tin; R.outPoint = tout;
    try { R.moveAfter(L); } catch (e) {}
    rp = R.property('ADBE Transform Group').property('ADBE Position').value;
    ES_animateIn(R, [rp[0], rp[1]], anim, tin);
    made.push(R);
  }

  if (c.sfx) { ES_addSfx(comp, c.sfx, tin, txt, ctx); }
  return { layer: L, place: pl };
}

// ---------- secuencia en bloque tipografico (escalera / zigzag / centrado ...) ----------
function ES_styleLockup(ctx, seq) {
  var cfg = ctx.cfg, cls = seq.cls, n = seq.words.length, i, words = [], disp = [];
  for (i = 0; i < n; i++) {
    disp.push(ES.displayText(seq.words[i].text, cls[i], cfg.upper));
    words.push({ text: disp[i] });
  }
  var lc = {
    sizes: cfg.layout.sizes, gap: cfg.layout.gap, lineGap: cfg.layout.lineGap,
    align: seq.align || cfg.layout.align, alignIndex: seq.alignIndex || 0,
    safe: ctx.zone.safe, centerX: ctx.zone.cx, centerY: ctx.zone.cy, fit: cfg.layout.fit, smallAlign: 'top',
    boxPad: { x: cfg.hl.padX, y: cfg.hl.padY }
  };
  var lay = ES.layoutLockup(words, cls, lc, ctx.measure);
  var times = ES.stairTimes(seq, cfg.tail, seq.nextStart);
  for (i = 0; i < n; i++) {
    ES_makeWord(ctx, seq, i, cls[i], lay.boxes[i], times[i].start, times[i].end, disp[i]);
  }
  ctx.scaleMin = Math.min(ctx.scaleMin, lay.scale);
}

// ---------- presentaciones: reconstruccion desde el arbol generico ----------
var ES_PX = {
  'ADBE Anchor Point': 1, 'ADBE Vector Rect Size': 1, 'ADBE Vector Rect Position': 1, 'ADBE Vector Rect Roundness': 1,
  'ADBE Vector Ellipse Size': 1, 'ADBE Vector Ellipse Position': 1, 'ADBE Vector Stroke Width': 1, 'ADBE Vector Position': 1,
  'ADBE Vector Anchor': 1, 'ADBE Vector Star Outer Radius': 1, 'ADBE Vector Star Inner Radius': 1, 'ADBE Vector Star Position': 1,
  'ADBE Gaussian Blur 2-0001': 1, 'ADBE Drop Shadow-0004': 1, 'ADBE Drop Shadow-0005': 1, 'ADBE Text Position 3D': 1
};
var ES_SKIP = { 'ADBE Text Document': 1, 'ADBE Marker': 1, 'ADBE Time Remapping': 1, 'ADBE Mask Parade': 1, 'ADBE Layer Styles': 1 };

function ES_scaleNum(v, f) {
  var i, o;
  if (v instanceof Array) { o = []; for (i = 0; i < v.length; i++) { o.push(v[i] * f); } return o; }
  return v * f;
}

function ES_scaleVal(m, v, ctx) {
  if (m === 'ADBE Position' && v instanceof Array) {
    var o = [v[0] * ctx.sx, v[1] * ctx.sy], i;
    for (i = 2; i < v.length; i++) { o.push(v[i]); }
    return o;
  }
  if (ES_PX[m]) {
    if (v && v.v) { return ES_scaleShape(v, ctx.f); }
    return ES_scaleNum(v, ctx.f);
  }
  if (v && v.v && v.v instanceof Array && v.c !== undefined) { return ES_scaleShape(v, ctx.f); }
  return v;
}

function ES_scaleShape(v, f) {
  var s = new Shape(), i, j, a;
  function sc(list) {
    var out = [], k;
    for (k = 0; k < list.length; k++) { out.push([list[k][0] * f, list[k][1] * f]); }
    return out;
  }
  s.vertices = sc(v.v); s.inTangents = sc(v.i); s.outTangents = sc(v.o); s.closed = v.c === true;
  return s;
}

function ES_interp(ch) {
  if (ch === 'H') { return KeyframeInterpolationType.HOLD; }
  if (ch === 'B') { return KeyframeInterpolationType.BEZIER; }
  return KeyframeInterpolationType.LINEAR;
}

function ES_easeDims(prop) {
  var t = prop.propertyValueType;
  if (t === PropertyValueType.TwoD_SPATIAL || t === PropertyValueType.ThreeD_SPATIAL || t === PropertyValueType.OneD) { return 1; }
  if (t === PropertyValueType.TwoD) { return 2; }
  if (t === PropertyValueType.ThreeD) { return 3; }
  return 0;
}

function ES_setProp(prop, node, ctx, tin) {
  var k, i, kf;
  if (node.kf && node.kf.length) {
    for (k = 0; k < node.kf.length; k++) {
      kf = node.kf[k];
      prop.setValueAtTime(tin + kf.t, ES_scaleVal(node.m, kf.v, ctx));
    }
    var dims = ES_easeDims(prop);
    for (k = 0; k < node.kf.length; k++) {
      kf = node.kf[k];
      try { prop.setInterpolationTypeAtKey(k + 1, ES_interp(kf.it), ES_interp(kf.ot)); } catch (e1) {}
      if (dims && kf.it === 'B' && kf.ei && kf.eo) {
        try {
          var ei = [], eo = [];
          for (i = 0; i < dims; i++) { ei.push(new KeyframeEase(kf.ei[0], Math.max(0.1, kf.ei[1]))); eo.push(new KeyframeEase(kf.eo[0], Math.max(0.1, kf.eo[1]))); }
          prop.setTemporalEaseAtKey(k + 1, ei, eo);
        } catch (e2) {}
      }
    }
  } else if (node.v !== undefined && node.v !== null) {
    prop.setValue(ES_scaleVal(node.m, node.v, ctx));
  }
  if (node.ex) { try { prop.expression = node.ex; } catch (e3) {} }
}

function ES_applyNodes(parent, nodes, ctx, tin) {
  var indexed = false, i, n, child, order = [];
  try { indexed = (parent.propertyType === PropertyType.INDEXED_GROUP); } catch (e0) {}
  try { if (parent.matchName === 'ADBE Text Selectors') { while (parent.numProperties > 0) { parent.property(1).remove(); } } } catch (e1) {}
  for (i = 0; i < nodes.length; i++) { order.push(i); }
  if (indexed) { order.reverse(); }               // addProperty inserta arriba: se agrega de abajo hacia arriba
  for (i = 0; i < order.length; i++) {
    n = nodes[order[i]];
    try {
      if (n.t === 'g') {
        child = null;
        if (!indexed) { try { child = parent.property(n.m); } catch (e2) { child = null; } }
        if (!child && parent.canAddProperty(n.m)) { child = parent.addProperty(n.m); }
        if (child) {
          if (n.n) { try { child.name = n.n; } catch (e3) {} }
          if (n.en === false) { try { child.enabled = false; } catch (e4) {} }
          if (n.ch && n.ch.length) { ES_applyNodes(child, n.ch, ctx, tin); }
        } else { ctx.warn.presFail++; }
      } else {
        child = parent.property(n.m);
        if (child) { ES_setProp(child, n, ctx, tin); } else { ctx.warn.presFail++; }
      }
    } catch (e5) { ctx.warn.presFail++; }
  }
}

function ES_justOf(j) {
  if (j === 'L') { return ParagraphJustification.LEFT_JUSTIFY; }
  if (j === 'R') { return ParagraphJustification.RIGHT_JUSTIFY; }
  return ParagraphJustification.CENTER_JUSTIFY;
}

function ES_makePres(ctx, seq, def, slots) {
  var comp = ctx.comp, cfg = ctx.cfg, i, n = seq.words.length;
  var pc = { f: comp.width / def.comp.w, sx: comp.width / def.comp.w, sy: comp.height / def.comp.h, warn: ctx.warn };
  var end = ES.seqEnd(seq, cfg.tail, seq.nextStart), first = null;
  var disp = [];
  for (i = 0; i < n; i++) { disp.push(ES.displayText(seq.words[i].text, seq.cls[i], def.upper !== false ? true : false)); }

  for (i = def.layers.length - 1; i >= 0; i--) {
    var D = def.layers[i], L, tin = seq.start + (D.dt || 0), tout, j;
    tout = (D.dur === null || D.dur === undefined) ? end : Math.min(end, tin + D.dur);
    if (tout <= tin) { tout = Math.min(end, tin + 0.5); }
    if (D.k === 'text') {
      var sl = slots && slots[i] ? slots[i] : [];
      if (!sl.length) { continue; }
      var parts = [];
      for (j = 0; j < sl.length; j++) { parts.push(disp[sl[j]]); }
      var txt = parts.join(' ');
      var c0 = seq.cls[sl[0]];
      var dd = D.doc || {};
      var col = ES_hex(dd.color || c0.color || (c0.brand ? cfg.brandColorHex : cfg.baseColorHex));
      L = comp.layers.addText(txt);
      L.name = txt;
      var tp = L.property('ADBE Text Properties').property('ADBE Text Document');
      var td = tp.value;
      td.resetCharStyle();
      td.fontSize = (dd.size || 80) * pc.f;
      td.fillColor = col; td.applyFill = true;
      td.applyStroke = false;
      if (dd.stroke && dd.stroke.w > 0) { td.applyStroke = true; td.strokeColor = ES_hex(dd.stroke.color); td.strokeWidth = dd.stroke.w * pc.f; }
      td.justification = ES_justOf(dd.just);
      var fnt = dd.font || c0.font || cfg.font;
      if (fnt) { try { td.font = fnt; } catch (e1) { ctx.warn.fontFail[fnt] = true; } }
      try { if (dd.tracking) { td.tracking = dd.tracking; } } catch (e2) {}
      tp.setValue(td);
      var r = L.sourceRectAtTime(0, false), ac = D.ac || [0, 0];
      L.property('ADBE Transform Group').property('ADBE Anchor Point').setValue([r.left + r.width / 2 + ac[0] * pc.f, r.top + r.height / 2 + ac[1] * pc.f]);
      L.inPoint = tin; L.outPoint = tout;
      if (D.tr) { ES_applyNodes(L.property('ADBE Transform Group'), D.tr, pc, tin); }
      if (D.fx && D.fx.length) { ES_applyNodes(L.property('ADBE Effect Parade'), D.fx, pc, tin); }
      if (D.an && D.an.length) { ES_applyNodes(L.property('ADBE Text Properties').property('ADBE Text Animators'), D.an, pc, tin); }
      var sfxId = '';
      for (j = 0; j < sl.length; j++) { if (seq.cls[sl[j]].sfx) { sfxId = seq.cls[sl[j]].sfx; break; } }
      if (sfxId) { ES_addSfx(comp, sfxId, tin, txt, ctx); }
    } else {
      L = comp.layers.addShape();
      L.name = (D.name || 'Forma');
      L.inPoint = tin; L.outPoint = tout;
      if (D.ct) { ES_applyNodes(L.property('ADBE Root Vectors Group'), D.ct, pc, tin); }
      if (D.tr) { ES_applyNodes(L.property('ADBE Transform Group'), D.tr, pc, tin); }
      if (D.fx && D.fx.length) { ES_applyNodes(L.property('ADBE Effect Parade'), D.fx, pc, tin); }
    }
    ctx.made.push(L);
  }
}

// ---------- captura de capas seleccionadas -> definicion de presentacion ----------
function ES_selInfo() {
  var c = app.project.activeItem;
  if (!(c && c instanceof CompItem)) { return '{"ok":false,"msg":"Abre una composicion."}'; }
  var sel = c.selectedLayers, t = 0, s = 0, o = 0, i;
  for (i = 0; i < sel.length; i++) {
    if (sel[i] instanceof TextLayer) { t++; } else if (sel[i] instanceof ShapeLayer) { s++; } else { o++; }
  }
  return '{"ok":true,"n":' + sel.length + ',"text":' + t + ',"shape":' + s + ',"other":' + o + ',"comp":"' + ES_esc(c.name) + '"}';
}

function ES_capVal(prop) {
  var t = prop.propertyValueType;
  if (t === PropertyValueType.NO_VALUE || t === PropertyValueType.CUSTOM_VALUE || t === PropertyValueType.LAYER_INDEX ||
      t === PropertyValueType.MASK_INDEX || t === PropertyValueType.MARKER || t === PropertyValueType.TEXT_DOCUMENT) { return { skip: true }; }
  return { skip: false, shape: t === PropertyValueType.SHAPE };
}

function ES_capShape(s) {
  function cp(list) { var out = [], k; for (k = 0; k < list.length; k++) { out.push([list[k][0], list[k][1]]); } return out; }
  return { v: cp(s.vertices), i: cp(s.inTangents), o: cp(s.outTangents), c: s.closed };
}

function ES_capProp(prop, tin, all) {
  var cv = ES_capVal(prop), node, k;
  if (cv.skip) { return null; }
  var modified = true;
  if (!all) { try { modified = prop.isModified; } catch (e0) { modified = true; } }
  if (!modified && !prop.numKeys) { return null; }
  node = { t: 'p', m: prop.matchName };
  if (prop.numKeys > 0) {
    node.kf = [];
    var types = { 6612: 'L', 6613: 'B', 6614: 'H' };
    for (k = 1; k <= prop.numKeys; k++) {
      var kv = prop.keyValue(k), e = { t: prop.keyTime(k) - tin, v: cv.shape ? ES_capShape(kv) : kv };
      try { e.it = types[prop.keyInInterpolationType(k)] || 'L'; e.ot = types[prop.keyOutInterpolationType(k)] || 'L'; } catch (e1) { e.it = 'L'; e.ot = 'L'; }
      try {
        var a = prop.keyInTemporalEase(k)[0], b = prop.keyOutTemporalEase(k)[0];
        e.ei = [a.speed, a.influence]; e.eo = [b.speed, b.influence];
      } catch (e2) {}
      node.kf.push(e);
    }
  } else {
    node.v = cv.shape ? ES_capShape(prop.value) : prop.value;
  }
  try { if (prop.expressionEnabled && prop.expression) { node.ex = prop.expression; } } catch (e3) {}
  return node;
}

function ES_capGroup(group, tin, skipM, all) {
  var out = [], i, p, n, ch;
  for (i = 1; i <= group.numProperties; i++) {
    p = group.property(i);
    if (ES_SKIP[p.matchName] || (skipM && skipM[p.matchName])) { continue; }
    if (p.propertyType === PropertyType.PROPERTY) {
      n = ES_capProp(p, tin, all);
      if (n) { out.push(n); }
    } else {
      ch = ES_capGroup(p, tin, null, false);
      n = { t: 'g', m: p.matchName, ch: ch };
      try { if (p.name && p.name !== p.matchName) { n.n = p.name; } } catch (e0) {}
      try { if (p.enabled === false) { n.en = false; } } catch (e1) {}
      out.push(n);
    }
  }
  return out;
}

function ES_trNodes(layer, tin, isText) {
  var tg = layer.property('ADBE Transform Group'), out = [], names = ['ADBE Anchor Point', 'ADBE Position', 'ADBE Scale', 'ADBE Rotate Z', 'ADBE Opacity'], i, p, n;
  for (i = 0; i < names.length; i++) {
    if (isText && names[i] === 'ADBE Anchor Point') { continue; }
    p = tg.property(names[i]);
    if (p) { n = ES_capProp(p, tin, true); if (n) { out.push(n); } }
  }
  return out;
}

function ES_capture() {
  try {
    var comp = app.project.activeItem;
    if (!(comp && comp instanceof CompItem)) { return '{"ok":false,"msg":"Abre una composicion y selecciona las capas."}'; }
    var sel = comp.selectedLayers, ls = [], i, skipped = 0;
    for (i = 0; i < sel.length; i++) {
      if (sel[i] instanceof TextLayer || sel[i] instanceof ShapeLayer) { ls.push(sel[i]); } else { skipped++; }
    }
    if (!ls.length) { return '{"ok":false,"msg":"Selecciona capas de texto o de forma en la linea de tiempo."}'; }
    ls.sort(function (a, b) { return a.index - b.index; });
    var minIn = 1e9, maxOut = -1e9;
    for (i = 0; i < ls.length; i++) { if (ls[i].inPoint < minIn) { minIn = ls[i].inPoint; } if (ls[i].outPoint > maxOut) { maxOut = ls[i].outPoint; } }
    var layers = [], hasText = false;
    for (i = 0; i < ls.length; i++) {
      var L = ls[i], isText = L instanceof TextLayer, tin = L.inPoint;
      var d = { k: isText ? 'text' : 'shape', name: L.name, dt: tin - minIn, dur: (Math.abs(L.outPoint - maxOut) < 0.002) ? null : (L.outPoint - tin) };
      d.tr = ES_trNodes(L, tin, isText);
      try { d.fx = ES_capGroup(L.property('ADBE Effect Parade'), tin, null, false); } catch (e1) { d.fx = []; }
      if (isText) {
        hasText = true;
        var td = L.property('ADBE Text Properties').property('ADBE Text Document').value;
        var r = L.sourceRectAtTime(tin, false), an = L.property('ADBE Transform Group').property('ADBE Anchor Point').value;
        d.ac = [an[0] - (r.left + r.width / 2), an[1] - (r.top + r.height / 2)];
        var j = 'C';
        try { if (td.justification === ParagraphJustification.LEFT_JUSTIFY) { j = 'L'; } else if (td.justification === ParagraphJustification.RIGHT_JUSTIFY) { j = 'R'; } } catch (e2) {}
        d.doc = { font: td.font, size: td.fontSize, color: td.applyFill ? ES_rgbHex(td.fillColor) : '#ffffff', just: j, tracking: td.tracking };
        if (td.applyStroke) { d.doc.stroke = { w: td.strokeWidth, color: ES_rgbHex(td.strokeColor) }; }
        d.sample = String(td.text).substr(0, 40);
        try { d.an = ES_capGroup(L.property('ADBE Text Properties').property('ADBE Text Animators'), tin, null, false); } catch (e3) { d.an = []; }
      } else {
        d.ct = ES_capGroup(L.property('ADBE Root Vectors Group'), tin, null, false);
      }
      layers.push(d);
    }
    if (!hasText) { return '{"ok":false,"msg":"La presentacion necesita al menos una capa de texto (para poner las palabras)."}'; }
    var def = { comp: { w: comp.width, h: comp.height }, upper: true, layers: layers };
    return '{"ok":true,"skipped":' + skipped + ',"def":' + ES_json(def) + '}';
  } catch (e) {
    return '{"ok":false,"msg":"Error al capturar: ' + ES_esc(e.toString()) + (e.line ? ' (linea ' + e.line + ')' : '') + '"}';
  }
}

// ---------- estilo "Caja que recorre" (karaoke) ----------
// Toda la frase en orden y una sola caja que se desliza de palabra en palabra segun los tiempos.
function ES_styleKaraoke(ctx, seq) {
  var comp = ctx.comp, cfg = ctx.cfg, K = cfg.karaoke || { size: 'M', boxColorHex: cfg.hl.colorHex, move: 0.12, radius: 14 };
  var n = seq.words.length, i, disp = [], words = [];
  for (i = 0; i < n; i++) { disp.push(ES.displayText(seq.words[i].text, seq.cls[i], cfg.upper)); words.push({ text: disp[i] }); }
  var padX = cfg.hl.padX, padY = cfg.hl.padY;
  var lc = {
    sizes: cfg.layout.sizes, gap: cfg.layout.gap, lineGap: cfg.layout.lineGap, alignIndex: seq.alignIndex || 0,
    safe: ctx.zone.safe, centerX: ctx.zone.cx, centerY: ctx.zone.cy, fit: cfg.layout.fit, boxPad: { x: padX, y: padY }, karaokeSize: K.size
  };
  var lay = ES.layoutKaraoke(words, seq.cls, lc, ctx.measure);
  var end = ES.seqEnd(seq, cfg.tail, seq.nextStart), t0 = seq.start;
  var keys = ES.karaokeKeys(lay.boxes, seq.words, { move: K.move, padX: padX * lay.scale, padY: padY * lay.scale });

  // la caja se crea primero para que quede debajo de las palabras
  var R = comp.layers.addShape();
  R.name = 'caja \u00b7 frase ' + seq.n;
  var grp = R.property('ADBE Root Vectors Group').addProperty('ADBE Vector Group');
  var rect = grp.property('ADBE Vectors Group').addProperty('ADBE Vector Shape - Rect');
  rect.property('ADBE Vector Rect Roundness').setValue(K.radius == null ? 14 : K.radius);
  var fill = grp.property('ADBE Vectors Group').addProperty('ADBE Vector Graphic - Fill');
  var bc = ES_hex(K.boxColorHex, [1, 0.83, 0]);
  fill.property('ADBE Vector Fill Color').setValue([bc[0], bc[1], bc[2], 1]);
  var tg = R.property('ADBE Transform Group'), pos = tg.property('ADBE Position'), size = rect.property('ADBE Vector Rect Size');
  for (i = 0; i < keys.length; i++) {
    pos.setValueAtTime(keys[i].t, [keys[i].cx, keys[i].cy]);
    size.setValueAtTime(keys[i].t, [keys[i].w, keys[i].h]);
  }
  ES_easeOut(pos, keys.length); ES_easeOut(size, keys.length);
  var tin = Math.max(t0, keys[0].t - 0.08);
  R.inPoint = tin; R.outPoint = end;
  var sc = tg.property('ADBE Scale');
  sc.setValueAtTime(tin, [60, 60]); sc.setValueAtTime(tin + 0.16, [100, 100]); ES_easeOut(sc, 2);
  var op = tg.property('ADBE Opacity');
  op.setValueAtTime(tin, 0); op.setValueAtTime(tin + 0.12, 100);
  ctx.made.push(R);

  var fadeIn = ES.resolveAnim(cfg.anim, 'fade');
  for (i = 0; i < n; i++) {
    var c = seq.cls[i];
    var colHex = c.color || (c.brand ? cfg.brandColorHex : cfg.baseColorHex);
    var L = ES_addWord(comp, disp[i], lay.boxes[i].size, ES_hex(colHex), c.font || cfg.font, disp[i], ctx.warn);
    var pl = ES_place(L, lay.boxes[i].x, lay.boxes[i].y);
    L.inPoint = t0; L.outPoint = end;
    ES_animateIn(L, pl.pos, fadeIn, t0);
    if (c.glow) { ES_addGlow(L, c.glowColor || cfg.glow.colorHex, cfg.glow.size, cfg.glow.opacity); }
    // tinta de contraste mientras la caja esta debajo de la palabra
    var ink = ES.inkOn(colHex, K.boxColorHex);
    if (String(ink).toLowerCase() !== String(colHex).toLowerCase()) {
      try {
        var tp = L.property('ADBE Text Properties').property('ADBE Text Document');
        var tdBase = tp.value, tdInk = tp.value;
        tdInk.fillColor = ES_hex(ink);
        var half = (K.move == null ? 0.12 : K.move) / 2;
        var tOn = i === 0 ? t0 : Math.max(t0, seq.words[i].start - half);
        var tOff = i < n - 1 ? seq.words[i + 1].start - half : -1;
        if (tOn > t0 + 0.001) { tp.setValueAtTime(t0, tdBase); }
        tp.setValueAtTime(tOn, tdInk);
        if (tOff > tOn) { tp.setValueAtTime(tOff, tdBase); }
      } catch (eInk) {}
    }
    ctx.made.push(L);
    if (c.sfx) { ES_addSfx(comp, c.sfx, seq.words[i].start, disp[i], ctx); }
  }
  ctx.scaleMin = Math.min(ctx.scaleMin, lay.scale);
}

// ---------- estilo APPLEXBY (T1): una linea, palabra por palabra con desenfoque ----------
// Salida: la entrada invertida (opacidad 100->0 y desenfoque 0->20) que termina en tEnd.
function ES_animateOut(layer, a, tEnd) {
  var x = ES.exitKeys(a, tEnd), tg = layer.property('ADBE Transform Group');
  if (x.t0 <= layer.inPoint + 0.01) { return; }
  if (x.fade) {
    var op = tg.property('ADBE Opacity');
    op.setValueAtTime(x.t0, 100); op.setValueAtTime(x.t1, 0);
    ES_easeIn(op);
  }
  if (x.blur > 0) {
    var fx = layer.property('ADBE Effect Parade').property('ADBE Gaussian Blur 2');
    if (!fx) { fx = layer.property('ADBE Effect Parade').addProperty('ADBE Gaussian Blur 2'); }
    var bl = fx.property('ADBE Gaussian Blur 2-0001');
    bl.setValueAtTime(x.t0, 0); bl.setValueAtTime(x.t1, x.blur);
    ES_easeIn(bl);
  }
}
// curva que acelera al salir (las dos ultimas claves)
function ES_easeIn(prop) {
  var n = prop.numKeys, dims = 1, arr = [], i;
  try { dims = ES_easeDims(prop) || 1; } catch (e0) { dims = 1; }
  for (i = 0; i < dims; i++) { arr.push(new KeyframeEase(0, 75)); }
  try { if (n >= 2) { prop.setTemporalEaseAtKey(n - 1, arr, arr); prop.setTemporalEaseAtKey(n, arr, arr); } } catch (e) {}
}
// sombra suave para leer sobre video. look = {opacity (%), distance, softness}
function ES_addShadow(layer, look) {
  look = look || { opacity: 60, distance: 4, softness: 16 };
  var fx = layer.property('ADBE Effect Parade').addProperty('ADBE Drop Shadow');
  fx.property('ADBE Drop Shadow-0001').setValue([0, 0, 0, 1]);
  fx.property('ADBE Drop Shadow-0002').setValue(Math.round(look.opacity * 2.55));
  fx.property('ADBE Drop Shadow-0003').setValue(180);
  fx.property('ADBE Drop Shadow-0004').setValue(look.distance);
  fx.property('ADBE Drop Shadow-0005').setValue(look.softness);
  try { fx.name = 'Sombra suave'; } catch (e) {}
}
// tracking y contorno (detras del relleno) sobre una capa de texto ya creada
function ES_textLook(layer, track, stroke) {
  var tp = layer.property('ADBE Text Properties').property('ADBE Text Document'), td = tp.value;
  if (track) { try { td.tracking = track; } catch (e0) {} }
  if (stroke && stroke.width > 0) {
    try {
      td.applyStroke = true; td.strokeColor = ES_hex(stroke.colorHex); td.strokeWidth = stroke.width; td.strokeOverFill = false;
    } catch (e1) {}
  }
  tp.setValue(td);
}

// ---------- estilos de una linea: "Una linea" (tradicional) y APPLEXBY ----------
// A = cfg.line o cfg.apx (Model.lineLook): fuente, tamano, colores, mayusculas/minusculas, tracking, espacio entre
// palabras, contorno, sombra, salida y animacion de entrada ('' = la de la edicion).
function ES_styleLine(ctx, seq, A) {
  var comp = ctx.comp, cfg = ctx.cfg;
  var n = seq.words.length, i, disp = [], words = [];
  for (i = 0; i < n; i++) {
    var c0 = seq.cls[i], t0 = ES.displayText(seq.words[i].text, c0, A.caps === 'upper');
    if (A.caps === 'lower' && !c0.caps) { t0 = t0.toLowerCase(); }
    disp.push(t0); words.push({ text: t0 });
  }
  var font = A.font || cfg.font, track = A.track || 0;
  var measure = function (text, px, f) { return ctx.measure(text, px, f || font, track); };
  var lay = ES.layoutLine(words, seq.cls, { size: A.size, gap: A.size * A.gap, safe: ctx.zone.safe, centerX: ctx.zone.cx, centerY: comp.height * A.centerY, font: font }, measure);
  var end = ES.seqEnd(seq, cfg.tail, seq.nextStart);
  var anim = A.anim ? ES.resolveAnim(cfg.anim, A.anim) : cfg.anim;
  for (i = 0; i < n; i++) {
    var c = seq.cls[i];
    var col = ES_hex(c.color || (c.brand ? A.keyHex : A.colorHex));
    var L = ES_addWord(comp, disp[i], lay.boxes[i].size, col, c.font || font, disp[i], ctx.warn);
    if (track || A.stroke) { ES_textLook(L, track, A.stroke ? { colorHex: A.stroke.colorHex, width: A.stroke.width * lay.scale } : null); }
    var pl = ES_place(L, lay.boxes[i].x, lay.boxes[i].y);
    var tin = seq.words[i].start;
    L.inPoint = tin; L.outPoint = end;
    if (A.shadow) { ES_addShadow(L, A.shadowLook); }
    var a = c.trans ? ES.resolveAnim(cfg.anim, c.trans) : anim;
    ES_animateIn(L, pl.pos, a, tin);
    if (A.exit && end - tin > a.dur + 0.32) { ES_animateOut(L, anim, end); }
    if (c.glow) { ES_addGlow(L, c.glowColor || cfg.glow.colorHex, cfg.glow.size, cfg.glow.opacity); }
    ctx.made.push(L);
    if (c.sfx) { ES_addSfx(comp, c.sfx, tin, disp[i], ctx); }
  }
  ctx.scaleMin = Math.min(ctx.scaleMin, lay.scale);
}
function ES_lineDefault() {
  return { style: 'line', font: '', size: 64, colorHex: '#ffffff', keyHex: '#ffd400', centerY: 0.7, shadow: true, exit: false,
    caps: 'none', track: 0, gap: 0.28, stroke: null, shadowLook: { opacity: 60, distance: 4, softness: 16 }, anim: '' };
}
function ES_styleApx(ctx, seq) {
  ES_styleLine(ctx, seq, ctx.cfg.apx || { style: 'applexby', font: '', size: 64, colorHex: '#ff1a1a', keyHex: '#ff1a1a', centerY: 0.7, shadow: true, exit: false,
    caps: 'lower', track: -60, gap: 0.14, stroke: null, shadowLook: { opacity: 35, distance: 6, softness: 12 }, anim: 'blurIn' });
}

// subtitulos ocultos mientras hay un T2 en pantalla (expresion en Opacidad, editable a mano)
function ES_applyHide(layers, intervals) {
  if (!intervals || !intervals.length) { return 0; }
  var ex = ES.hideExpr(intervals), n = 0, i;
  for (i = 0; i < layers.length; i++) {
    try { layers[i].property('ADBE Transform Group').property('ADBE Opacity').expression = ex; n++; } catch (e) {}
  }
  return n;
}

// ---------- generacion por pasos (se puede detener desde el panel) ----------
// ES_begin(cabecera) -> ES_step([frases]) x N -> ES_end(). Cada capa queda marcada en su comentario:
//   Laddersu|<run>|<inicio>|<fin>   (tambien se reconocen las de Escalera Subs)   para poder reemplazarla al regenerar o quitarla si se detiene.
var ES_RUN = null;
var ES_TAG = 'Laddersu|';
var ES_TAG_OLD = 'EscaleraSubs|';

function ES_tagOf(L) { try { return String(L.comment || ''); } catch (e) { return ''; } }

function ES_removeTagged(comp, test) {
  var n = 0, i;
  for (i = comp.numLayers; i >= 1; i--) {
    var L = comp.layer(i), tag = ES_tagOf(L);
    if (tag.indexOf(ES_TAG) !== 0 && tag.indexOf(ES_TAG_OLD) !== 0) { continue; }
    var p = tag.split('|');
    if (test(p[1], parseFloat(p[2]), parseFloat(p[3]))) { try { L.locked = false; L.remove(); n++; } catch (e) {} }
  }
  return n;
}

function ES_begin(jsonStr) {
  try {
    if (typeof ES === 'undefined' || ES.VERSION !== ES_VERSION) { ES_loadEngine(); }
    if (typeof ES === 'undefined') { return '{"ok":false,"msg":"El motor no esta cargado en After Effects. Cierra y abre el panel."}'; }
    var job = ES_parse(jsonStr), cfg = job.cfg;
    var comp = app.project.activeItem, need = job.need || 10;
    if (!(comp && comp instanceof CompItem)) {
      if (!cfg.newComp) { return '{"ok":false,"msg":"Selecciona una composicion o activa Crear composicion nueva en Ajustes."}'; }
      comp = app.project.items.addComp('Subtitulos Laddersu', cfg.compW, cfg.compH, 1, need, cfg.fps);
      comp.openInViewer();
    } else if (cfg.newComp) {
      comp = app.project.items.addComp('Subtitulos Laddersu', comp.width, comp.height, 1, Math.max(need, comp.duration), comp.frameRate);
      comp.openInViewer();
    }
    if (cfg.sfxDb === undefined) { cfg.sfxDb = -6; }
    var removed = 0, rep = job.replace || { mode: 'none' };
    app.beginUndoGroup('Laddersu: reemplazar');
    if (rep.mode === 'all') { removed = ES_removeTagged(comp, function () { return true; }); }
    else if (rep.mode === 'ranges' && rep.ranges) {
      removed = ES_removeTagged(comp, function (run, a, b) {
        var k;
        for (k = 0; k < rep.ranges.length; k++) { if (a < rep.ranges[k][1] - 0.001 && b > rep.ranges[k][0] + 0.001) { return true; } }
        return false;
      });
    }
    app.endUndoGroup();
    var runId = 'r' + new Date().getTime();
    ES_RUN = {
      id: runId, comp: comp, cfg: cfg, sfx: job.sfx || {}, pres: job.pres || {}, removed: removed,
      warn: { fontFail: {}, sfxMissing: {}, presFail: 0 }, sfxCache: {}, sfxCount: 0, layers: 0, seqs: 0, scaleMin: 1,
      zone: ES_zone(cfg, comp)
    };
    return '{"ok":true,"run":"' + runId + '","removed":' + removed + ',"comp":"' + ES_esc(comp.name) + '"}';
  } catch (e) {
    try { app.endUndoGroup(); } catch (e2) {}
    return '{"ok":false,"msg":"' + ES_esc('Error: ' + e.toString() + (e.line ? ' (linea ' + e.line + ')' : '')) + '"}';
  }
}

function ES_step(jsonStr) {
  var R = ES_RUN, ctx = null;
  if (!R) { return '{"ok":false,"msg":"No hay una generacion en curso."}'; }
  try {
    var list = ES_parse(jsonStr), s, k;
    ctx = { comp: R.comp, cfg: R.cfg, made: [], sfxMade: [], warn: R.warn, sfx: R.sfx, sfxCache: R.sfxCache, sfxCount: 0, measure: null,
            zone: R.zone, scaleMin: 1 };
    app.beginUndoGroup('Laddersu');
    ctx.measure = ES_measurer(R.comp, R.cfg, R.warn);
    for (s = 0; s < list.length; s++) {
      var seq = list[s], c2 = [];
      for (k = 0; k < seq.cls.length; k++) { c2.push(ES.normalizeClass(seq.cls[k])); }
      seq.cls = c2;
      if (seq.n === undefined) { seq.n = s + 1; }
      var m0 = ctx.made.length, f0 = ctx.sfxMade.length;
      var def = seq.pres && R.pres ? R.pres[seq.pres] : null;
      if (def) { ES_makePres(ctx, seq, def, seq.slots || []); }
      else if (seq.style === 'karaoke') { ES_styleKaraoke(ctx, seq); }
      else if (seq.style === 'applexby') { ES_styleApx(ctx, seq); }
      else if (seq.style === 'line') { ES_styleLine(ctx, seq, R.cfg.line || ES_lineDefault()); }
      else { ES_styleLockup(ctx, seq); }
      if (!def && R.cfg.hide && R.cfg.hide.length) {
        var hid = ES.hideFor(R.cfg.hide, seq.start, ES.seqEnd(seq, R.cfg.tail, seq.nextStart));
        if (hid.length) { ES_applyHide(ctx.made.slice(m0), hid); }
      }
      var tag = ES_TAG + R.id + '|' + seq.start.toFixed(3) + '|' + ES.seqEnd(seq, R.cfg.tail, seq.nextStart).toFixed(3);
      for (k = m0; k < ctx.made.length; k++) { try { ctx.made[k].comment = tag; } catch (e1) {} }
      for (k = f0; k < ctx.sfxMade.length; k++) { try { ctx.sfxMade[k].comment = tag; } catch (e2) {} }
    }
    ctx.measure.dispose();
    app.endUndoGroup();
    R.layers += ctx.made.length; R.sfxCount += ctx.sfxCount; R.seqs += list.length;
    R.scaleMin = Math.min(R.scaleMin, ctx.scaleMin);
    return '{"ok":true,"layers":' + ctx.made.length + ',"sfx":' + ctx.sfxCount + '}';
  } catch (e) {
    try { if (ctx && ctx.measure) { ctx.measure.dispose(); } } catch (e3) {}
    try { app.endUndoGroup(); } catch (e4) {}
    return '{"ok":false,"msg":"' + ES_esc('Error: ' + e.toString() + (e.line ? ' (linea ' + e.line + ')' : '')) + '"}';
  }
}

function ES_summary(R, prefix) {
  var notes = [], key, nf = 0, ns = 0;
  for (key in R.warn.fontFail) { nf++; }
  for (key in R.warn.sfxMissing) { ns++; }
  if (nf) { notes.push(nf + ' fuente(s) no se pudieron aplicar (se uso la predeterminada)'); }
  if (ns) { notes.push(ns + ' sonido(s) no se encontraron'); }
  if (R.warn.presFail) { notes.push(R.warn.presFail + ' propiedad(es) de plantillas no se pudieron recrear'); }
  if (R.scaleMin < 0.999) { notes.push('alguna frase se redujo hasta ' + Math.round(R.scaleMin * 100) + '% para caber en los margenes'); }
  return prefix + R.layers + ' capas' + (R.sfxCount ? ' y ' + R.sfxCount + ' sonidos' : '') + ' en "' + R.comp.name + '"' +
         (R.removed ? ' (reemplazadas ' + R.removed + ' capas anteriores)' : '') + '.' + (notes.length ? ' Avisos: ' + notes.join('; ') + '.' : '');
}

function ES_end() {
  var R = ES_RUN;
  if (!R) { return '{"ok":false,"msg":"No hay una generacion en curso."}'; }
  try {
    if (R.cfg.guide) {
      app.beginUndoGroup('Laddersu: guia');
      ES_removeTagged(R.comp, function (run, a) { return isNaN(a); });
      var g = ES_guideLayer(R.comp, R.zone); try { g.comment = ES_TAG + R.id + '|guia|guia'; } catch (e0) {}
      app.endUndoGroup();
    }
    var msg = ES_summary(R, 'Listo: ');
    var out = '{"ok":true,"layers":' + R.layers + ',"sfx":' + R.sfxCount + ',"msg":"' + ES_esc(msg) + '"}';
    ES_RUN = null;
    return out;
  } catch (e) {
    ES_RUN = null;
    return '{"ok":false,"msg":"' + ES_esc('Error: ' + e.toString()) + '"}';
  }
}

// detener: termina la generacion; con remove=true quita todo lo creado en esta tanda
function ES_stop(runId, remove) {
  var R = ES_RUN, n = 0, comp = R ? R.comp : app.project.activeItem;
  try {
    if (remove && comp && comp instanceof CompItem) {
      app.beginUndoGroup('Laddersu: quitar lo generado');
      n = ES_removeTagged(comp, function (run) { return run === runId; });
      app.endUndoGroup();
    }
  } catch (e) { try { app.endUndoGroup(); } catch (e2) {} }
  var made = R ? R.seqs : 0;
  if (R && R.id === runId) { ES_RUN = null; }
  return '{"ok":true,"removed":' + n + ',"seqs":' + made + '}';
}

// compatibilidad: todo de una vez
function ES_apply(jsonStr) {
  var job = ES_parse(jsonStr);
  if (!job.seqs || !job.seqs.length) { return '{"ok":false,"layers":0,"msg":"No hay secuencias para generar."}'; }
  var last = job.seqs[job.seqs.length - 1];
  var head = { cfg: job.cfg, sfx: job.sfx, pres: job.pres, replace: job.replace || { mode: 'none' }, need: last.words[last.words.length - 1].end + 2 };
  var b = ES_parse(ES_begin(ES_json(head)));
  if (!b.ok) { return '{"ok":false,"layers":0,"msg":"' + ES_esc(b.msg) + '"}'; }
  var st = ES_parse(ES_step(ES_json(job.seqs)));
  if (!st.ok) { ES_RUN = null; return '{"ok":false,"layers":0,"msg":"' + ES_esc(st.msg) + '"}'; }
  return ES_end();
}

// ---------- biblioteca de composiciones ----------
// Cada elemento: <userData>/Laddersu/biblioteca/<id>/  (si existe la de Escalera Subs se traslada sola) { elemento.aep, meta.json, thumb.png, archivos/ }
function ES_libRoot() {
  var f = new Folder(Folder.userData.fullName + '/Laddersu/biblioteca');
  if (f.exists) { return f; }
  // si ya tenias biblioteca de Escalera Subs, se sigue usando esa carpeta (no se mueve nada)
  var old = new Folder(Folder.userData.fullName + '/EscaleraSubs/biblioteca');
  if (old.exists) { return old; }
  var base = new Folder(Folder.userData.fullName + '/Laddersu');
  if (!base.exists) { base.create(); }
  f.create();
  return f;
}
function ES_readText(file) {
  var f = new File(file); if (!f.exists) { return null; }
  f.encoding = 'UTF-8'; f.open('r'); var s = f.read(); f.close(); return s;
}
function ES_writeText(file, text) {
  var f = new File(file); f.encoding = 'UTF-8'; f.open('w'); f.write(text); f.close();
}
function ES_rmrf(folder) {
  var list = folder.getFiles(), i;
  for (i = 0; i < list.length; i++) { if (list[i] instanceof Folder) { ES_rmrf(list[i]); } else { list[i].remove(); } }
  folder.remove();
}

function ES_libList() {
  try {
    var root = ES_libRoot(), dirs = root.getFiles(), out = [], i;
    for (i = 0; i < dirs.length; i++) {
      if (!(dirs[i] instanceof Folder)) { continue; }
      var txt = ES_readText(dirs[i].fullName + '/meta.json');
      if (!txt) { continue; }
      var m; try { m = ES_parse(txt); } catch (e) { continue; }
      m.id = dirs[i].name;
      var th = new File(dirs[i].fullName + '/thumb.png');
      m.thumb = th.exists ? th.fsName : '';
      m.dir = dirs[i].fsName;
      out.push(m);
    }
    return '{"ok":true,"root":"' + ES_esc(root.fsName) + '","items":' + ES_json(out) + ',"groups":' + ES_json(ES_libGroups()) + '}';
  } catch (e) {
    return '{"ok":false,"msg":"' + ES_esc(e.toString()) + '"}';
  }
}

function ES_libState() {
  var c = app.project.activeItem, comp = c && c instanceof CompItem;
  return ES_json({ ok: true, hasComp: !!comp, comp: comp ? c.name : '', sel: comp ? c.selectedLayers.length : 0,
                   saved: !!app.project.file, dirty: !!app.project.dirty, project: app.project.file ? app.project.file.name : '' });
}

// o = {name, mode:'comp'|'selection'}
function ES_libSave(jsonStr) {
  var orig = null;
  try {
    var o = ES_parse(jsonStr), comp = app.project.activeItem;
    if (!(comp && comp instanceof CompItem)) { return '{"ok":false,"msg":"Abre la composicion que quieres guardar."}'; }
    if (!app.project.file) { return '{"ok":false,"code":"unsaved","msg":"Guarda tu proyecto primero (Archivo > Guardar) y vuelve a intentarlo."}'; }
    var target = comp, name = o.name || comp.name;
    if (o.mode === 'selection') {
      var sl = comp.selectedLayers, idx = [], i;
      if (!sl.length) { return '{"ok":false,"msg":"Selecciona capas en la linea de tiempo o elige Composicion activa."}'; }
      for (i = 0; i < sl.length; i++) { idx.push(sl[i].index); }
      idx.sort(function (a, b) { return a - b; });
      app.beginUndoGroup('Laddersu: precomponer');
      target = comp.layers.precompose(idx, name, true);
      app.endUndoGroup();
    }
    var meta = { name: name, comp: target.name, w: target.width, h: target.height, dur: target.duration, fps: target.frameRate,
                 layers: target.numLayers, created: new Date().getTime(), from: app.project.file.name, group: o.group || '' };
    var targetId = target.id;
    app.project.save();                                  // tu proyecto queda guardado tal cual
    orig = app.project.file;
    var id = 'c' + new Date().getTime(), dir = new Folder(ES_libRoot().fullName + '/' + id);
    dir.create();
    // proyecto en memoria reducido a la composicion y lo que usa
    app.project.reduceProject([target]);
    // se copian los archivos (imagenes, videos, audio) dentro del elemento para que funcione en otra PC
    var files = new Folder(dir.fullName + '/archivos'), copied = 0, k;
    for (k = 1; k <= app.project.numItems; k++) {
      var it = app.project.item(k);
      try {
        // las secuencias de imagenes ("nombre_[0000-0100].png") se dejan con su ruta original
        if (it instanceof FootageItem && it.file && it.file.exists && !/\[\d+-\d+\]/.test(it.name)) {
          var src = it.file;
          if (!files.exists) { files.create(); }
          var dst = new File(files.fullName + '/' + src.name);
          if (!dst.exists) { src.copy(dst); }
          it.replace(dst); copied++;
        }
      } catch (eF) {}
    }
    meta.files = copied;
    app.project.save(new File(dir.fullName + '/elemento.aep'));
    ES_writeText(dir.fullName + '/meta.json', ES_json(meta));
    app.open(orig);                                      // vuelve a tu proyecto
    // miniatura (desde el proyecto original)
    try {
      var again = app.project.itemByID(targetId);
      if (again) { again.saveFrameToPng(again.workAreaStart + again.workAreaDuration / 2, new File(dir.fullName + '/thumb.png')); }
    } catch (eT) {}
    return '{"ok":true,"id":"' + id + '","name":"' + ES_esc(name) + '","files":' + copied + '}';
  } catch (e) {
    try { app.endUndoGroup(); } catch (e1) {}
    try { if (orig && (!app.project.file || app.project.file.fsName !== orig.fsName)) { app.open(orig); } } catch (e2) {}
    return '{"ok":false,"msg":"' + ES_esc('No se pudo guardar: ' + e.toString() + (e.line ? ' (linea ' + e.line + ')' : '')) + '"}';
  }
}

function ES_inFolder(item, folder) {
  var p = item.parentFolder;
  while (p) { if (p === folder || (p.id && folder.id && p.id === folder.id)) { return true; } if (p === app.project.rootFolder) { break; } p = p.parentFolder; }
  return false;
}

// o = {id, mode:'insert'|'open'}
function ES_libInsert(jsonStr) {
  try {
    var o = ES_parse(jsonStr), dir = ES_libRoot().fullName + '/' + o.id;
    var meta = ES_parse(ES_readText(dir + '/meta.json') || '{}');
    var aep = new File(dir + '/elemento.aep');
    if (!aep.exists) { return '{"ok":false,"msg":"No encuentro el archivo del elemento."}'; }
    var dest = app.project.activeItem;
    if (o.mode === 'insert' && !(dest && dest instanceof CompItem)) { return '{"ok":false,"msg":"Abre la composicion donde quieres insertarlo."}'; }
    app.beginUndoGroup('Laddersu: biblioteca');
    var folder = app.project.importFile(new ImportOptions(aep));
    try { folder.name = 'Biblioteca \u00b7 ' + (meta.name || o.id); } catch (e0) {}
    var comp = null, i;
    for (i = 1; i <= app.project.numItems; i++) {
      var it = app.project.item(i);
      if (it instanceof CompItem && it.name === meta.comp && ES_inFolder(it, folder)) { comp = it; break; }
    }
    if (!comp) {
      // plan B: la composicion con ese nombre importada mas recientemente
      for (i = app.project.numItems; i >= 1; i--) { var it2 = app.project.item(i); if (it2 instanceof CompItem && it2.name === meta.comp) { comp = it2; break; } }
    }
    if (!comp) { app.endUndoGroup(); return '{"ok":false,"msg":"El elemento se importo, pero no encontre su composicion principal."}'; }
    var msg;
    if (o.mode === 'insert') {
      var L = dest.layers.add(comp);
      L.startTime = dest.time;
      msg = '"' + (meta.name || comp.name) + '" insertado en "' + dest.name + '" en ' + dest.time.toFixed(2) + ' s.';
    } else {
      comp.openInViewer();
      msg = '"' + (meta.name || comp.name) + '" abierto para editar.';
    }
    app.endUndoGroup();
    return '{"ok":true,"msg":"' + ES_esc(msg) + '"}';
  } catch (e) {
    try { app.endUndoGroup(); } catch (e1) {}
    return '{"ok":false,"msg":"' + ES_esc('No se pudo insertar: ' + e.toString()) + '"}';
  }
}

function ES_libRename(jsonStr) {
  try {
    var o = ES_parse(jsonStr), file = ES_libRoot().fullName + '/' + o.id + '/meta.json';
    var m = ES_parse(ES_readText(file) || '{}'); m.name = o.name; ES_writeText(file, ES_json(m));
    return '{"ok":true}';
  } catch (e) { return '{"ok":false,"msg":"' + ES_esc(e.toString()) + '"}'; }
}
// ---------- grupos de la biblioteca (groups.json en la carpeta de la biblioteca; cada elemento guarda meta.group) ----------
function ES_libGroups() {
  var txt = ES_readText(ES_libRoot().fullName + '/groups.json'), g = null;
  try { g = txt ? ES_parse(txt) : null; } catch (e) { g = null; }
  return g && g.groups && g.groups.length !== undefined ? g.groups : [];
}
// o = {groups:[{id,name}]}: guarda la lista; los elementos de un grupo que ya no existe pasan a "Sin grupo"
function ES_libGroupsSave(jsonStr) {
  try {
    var o = ES_parse(jsonStr), root = ES_libRoot(), keep = {}, i, n = 0;
    for (i = 0; i < o.groups.length; i++) { keep[o.groups[i].id] = true; }
    ES_writeText(root.fullName + '/groups.json', ES_json({ groups: o.groups }));
    var dirs = root.getFiles();
    for (i = 0; i < dirs.length; i++) {
      if (!(dirs[i] instanceof Folder)) { continue; }
      var f = dirs[i].fullName + '/meta.json', txt = ES_readText(f);
      if (!txt) { continue; }
      var m; try { m = ES_parse(txt); } catch (e0) { continue; }
      if (m.group && !keep[m.group]) { m.group = ''; ES_writeText(f, ES_json(m)); n++; }
    }
    return '{"ok":true,"moved":' + n + '}';
  } catch (e) { return '{"ok":false,"msg":"' + ES_esc(e.toString()) + '"}'; }
}
// o = {ids:[...], group:''|id}
function ES_libSetGroup(jsonStr) {
  try {
    var o = ES_parse(jsonStr), root = ES_libRoot(), i;
    for (i = 0; i < o.ids.length; i++) {
      var f = root.fullName + '/' + o.ids[i] + '/meta.json', m = ES_parse(ES_readText(f) || '{}');
      m.group = o.group || ''; ES_writeText(f, ES_json(m));
    }
    return '{"ok":true}';
  } catch (e) { return '{"ok":false,"msg":"' + ES_esc(e.toString()) + '"}'; }
}
function ES_libDelete(id) {
  try { var d = new Folder(ES_libRoot().fullName + '/' + id); if (d.exists) { ES_rmrf(d); } return '{"ok":true}'; }
  catch (e) { return '{"ok":false,"msg":"' + ES_esc(e.toString()) + '"}'; }
}
function ES_libReveal(id) {
  try { var d = id ? new Folder(ES_libRoot().fullName + '/' + id) : ES_libRoot(); d.execute(); return '{"ok":true}'; }
  catch (e) { return '{"ok":false,"msg":"' + ES_esc(e.toString()) + '"}'; }
}

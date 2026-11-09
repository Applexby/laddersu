/*
 * Laddersu - plantillas de texto (biblioteca de capas reutilizables). Sin DOM; se prueba en Node.
 *
 * def = {id, name, v:1, comp:{w,h}, upper, builtin?, fav?, layers:[layer]}
 * layer = {k:'text'|'shape', name, dt (segundos desde el inicio), dur (null = hasta el final de la frase),
 *          tr:[nodo]   hijos de "ADBE Transform Group",
 *          ct:[nodo]   hijos de "ADBE Root Vectors Group" (formas),
 *          fx:[nodo]   hijos de "ADBE Effect Parade",
 *          an:[nodo]   hijos de "ADBE Text Animators" (texto),
 *          doc:{font,size,color,just,tracking}, ac:[dx,dy] (ancla respecto al centro del texto), sample:'texto'}
 * nodo  = {t:'g', m, n, en, ch:[nodo]} | {t:'p', m, v, kf:[{t,v,it,ot,ei,eo}], ex}
 * Los tiempos de los keyframes son relativos al inicio de la capa; los px son de comp.w x comp.h.
 */
var Pres = (function () {
  var P = {};

  P.p = function (m, v, kf) { var o = { t: 'p', m: m, v: v }; if (kf) { o.kf = kf; } return o; };
  P.g = function (m, ch, n) { var o = { t: 'g', m: m, ch: ch || [] }; if (n) { o.n = n; } return o; };
  // keyframe suave de salida (ease out) / lineal
  function K(t, v, ease) { return { t: t, v: v, it: ease ? 'B' : 'L', ot: ease ? 'B' : 'L', ei: ease ? [0, 33] : null, eo: ease ? [0, 66] : null }; }

  // ---------- validacion ----------
  P.validate = function (d) {
    var i, n = 0;
    if (!d || !d.layers || !d.layers.length) { return 'La presentacion no tiene capas.'; }
    for (i = 0; i < d.layers.length; i++) { if (d.layers[i].k === 'text') { n++; } }
    if (!n) { return 'La presentacion necesita al menos una capa de texto.'; }
    return '';
  };

  // ---------- reparto de palabras en los textos de la presentacion ----------
  // devuelve, por capa (mismo orden que def.layers), la lista de indices de palabra del texto (shape -> null)
  // Las capas de texto se ordenan por entrada (dt) y luego de arriba hacia abajo.
  P.textLayerOrder = function (def) {
    var arr = [], i;
    for (i = 0; i < def.layers.length; i++) {
      if (def.layers[i].k === 'text') { arr.push({ i: i, dt: def.layers[i].dt || 0, y: P.posOf(def.layers[i]).y }); }
    }
    arr.sort(function (a, b) { return a.dt !== b.dt ? a.dt - b.dt : (a.y !== b.y ? a.y - b.y : a.i - b.i); });
    var out = [];
    for (i = 0; i < arr.length; i++) { out.push(arr[i].i); }
    return out;
  };

  // reparto equilibrado y contiguo: slots de texto S, palabras W
  P.assignSlots = function (def, words) {
    var order = P.textLayerOrder(def), S = order.length, W = words.length, res = [], i, k = 0;
    for (i = 0; i < def.layers.length; i++) { res.push(null); }
    if (!S) { return res; }
    var use = Math.min(S, W);           // si hay menos palabras que textos, sobran textos (se omiten)
    var base = Math.floor(W / use), extra = W % use;
    for (i = 0; i < S; i++) {
      var arr = [];
      if (i < use) {
        var cnt = base + (i < extra ? 1 : 0), j;
        for (j = 0; j < cnt; j++) { arr.push(k++); }
      }
      res[order[i]] = arr;
    }
    for (i = 0; i < def.layers.length; i++) { if (def.layers[i].k === 'shape') { res[i] = null; } }
    return res;
  };

  // ---------- lectura de valores para vista previa ----------
  function findNode(list, m) {
    var i;
    for (i = 0; list && i < list.length; i++) { if (list[i].m === m) { return list[i]; } }
    return null;
  }
  P.findNode = findNode;
  function finalVal(n) {
    if (!n) { return null; }
    if (n.kf && n.kf.length) { return n.kf[n.kf.length - 1].v; }
    return n.v;
  }
  P.finalVal = finalVal;
  function walk(list, m, out) {
    var i;
    for (i = 0; list && i < list.length; i++) {
      if (list[i].m === m) { out.push(list[i]); }
      if (list[i].ch) { walk(list[i].ch, m, out); }
    }
    return out;
  }
  P.findAll = function (list, m) { return walk(list, m, []); };

  P.posOf = function (layer) {
    var v = finalVal(findNode(layer.tr, 'ADBE Position'));
    return v && v.length >= 2 ? { x: v[0], y: v[1] } : { x: 0, y: 0 };
  };
  function hex(c) {
    if (!c || c.length < 3) { return null; }
    function h(x) { var s = Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16); return s.length < 2 ? '0' + s : s; }
    return '#' + h(c[0]) + h(c[1]) + h(c[2]);
  }
  P.hexOf = hex;
  P.rgbOf = function (s) {
    var m = /^#?([0-9a-f]{6})$/i.exec(s || '');
    if (!m) { return [1, 1, 1, 1]; }
    var n = parseInt(m[1], 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
  };

  // elementos para dibujar una miniatura (coordenadas normalizadas 0..1)
  P.previewItems = function (def) {
    var out = [], i, W = def.comp.w, H = def.comp.h;
    for (i = def.layers.length - 1; i >= 0; i--) {
      var L = def.layers[i], pos = P.posOf(L), sc = finalVal(findNode(L.tr, 'ADBE Scale')) || [100, 100];
      if (L.k === 'text') {
        out.push({ k: 'text', li: i, x: pos.x / W, y: pos.y / H, text: L.sample || 'Texto', size: ((L.doc && L.doc.size) || 70) * sc[0] / 100 / W,
          color: (L.doc && L.doc.color) || '#ffffff', just: (L.doc && L.doc.just) || 'C', bold: true });
      } else {
        var rects = P.findAll(L.ct, 'ADBE Vector Shape - Rect'), r, fills = P.findAll(L.ct, 'ADBE Vector Graphic - Fill');
        var ells = P.findAll(L.ct, 'ADBE Vector Shape - Ellipse'), fill = fills.length ? hex(finalVal(findNode(fills[0].ch, 'ADBE Vector Fill Color'))) : null;
        var strokes = P.findAll(L.ct, 'ADBE Vector Graphic - Stroke');
        var gp = finalVal(P.findAll(L.ct, 'ADBE Vector Position')[0]) || [0, 0];
        if (rects.length) {
          r = rects[0];
          var sz = finalVal(findNode(r.ch, 'ADBE Vector Rect Size')) || [100, 100];
          var rp = finalVal(findNode(r.ch, 'ADBE Vector Rect Position')) || [0, 0];
          var rd = finalVal(findNode(r.ch, 'ADBE Vector Rect Roundness')) || 0;
          out.push({ k: 'rect', x: (pos.x + gp[0] + rp[0]) / W, y: (pos.y + gp[1] + rp[1]) / H, w: sz[0] * sc[0] / 100 / W, h: sz[1] * sc[1] / 100 / H,
            r: rd / W, fill: fill, stroke: strokes.length ? hex(finalVal(findNode(strokes[0].ch, 'ADBE Vector Stroke Color'))) : null });
        } else if (ells.length) {
          var es = finalVal(findNode(ells[0].ch, 'ADBE Vector Ellipse Size')) || [100, 100];
          out.push({ k: 'ellipse', x: (pos.x + gp[0]) / W, y: (pos.y + gp[1]) / H, w: es[0] * sc[0] / 100 / W, h: es[1] * sc[1] / 100 / H, fill: fill });
        } else {
          out.push({ k: 'rect', x: pos.x / W, y: pos.y / H, w: 0.2, h: 0.02, r: 0, fill: fill || '#888888' });
        }
      }
    }
    return out;
  };

  P.summary = function (def) {
    var t = 0, s = 0, a = 0, i;
    for (i = 0; i < def.layers.length; i++) {
      if (def.layers[i].k === 'text') { t++; } else { s++; }
      if (hasKf(def.layers[i].tr) || hasKf(def.layers[i].ct) || hasKf(def.layers[i].fx) || (def.layers[i].an && def.layers[i].an.length)) { a++; }
    }
    return t + (t === 1 ? ' texto' : ' textos') + ' · ' + s + (s === 1 ? ' forma' : ' formas') + (a ? ' · ' + a + ' animadas' : '');
  };
  function hasKf(list) {
    var i;
    for (i = 0; list && i < list.length; i++) {
      if (list[i].kf && list[i].kf.length > 1) { return true; }
      if (list[i].ch && hasKf(list[i].ch)) { return true; }
    }
    return false;
  }

  // ---------- paquete incluido ----------
  function popKf(from, over) { return [K(0, [from, from]), K(0.18, [over, over], true), K(0.3, [100, 100], true)]; }
  function fadeKf() { return [K(0, 0), K(0.16, 100, true)]; }
  function slideKf(x, y0, y1, d) { return [K(d || 0, [x, y0]), K((d || 0) + 0.28, [x, y1], true)]; }

  function textLayer(name, sample, x, y, size, color, dt, kfPos, extra) {
    var tr = [P.p('ADBE Position', [x, y], kfPos || null), P.p('ADBE Opacity', 100, kfPos ? [K(0, 0), K(0.16, 100, true)].map(function (k) { k.t += dt ? 0 : 0; return k; }) : null)];
    var L = { k: 'text', name: name, dt: dt || 0, dur: null, tr: tr, fx: [], an: [], doc: { font: '', size: size, color: color, just: 'C', tracking: 0 }, sample: sample };
    if (extra) { var f; for (f in extra) { L[f] = extra[f]; } }
    return L;
  }
  function rectLayer(name, x, y, w, h, r, color, dt, pop) {
    var fill = P.rgbOf(color);
    return {
      k: 'shape', name: name, dt: dt || 0, dur: null,
      tr: [P.p('ADBE Position', [x, y]), P.p('ADBE Scale', [100, 100], pop ? popKf(60, 108) : null), P.p('ADBE Opacity', 100, fadeKf())],
      ct: [P.g('ADBE Vector Group', [P.g('ADBE Vectors Group', [
        P.g('ADBE Vector Shape - Rect', [P.p('ADBE Vector Rect Size', [w, h]), P.p('ADBE Vector Rect Roundness', r)]),
        P.g('ADBE Vector Graphic - Fill', [P.p('ADBE Vector Fill Color', fill)])
      ])], 'Forma')],
      fx: [], sample: ''
    };
  }

  P.builtinPack = function () {
    var W = 1080, H = 1920, cy = 1171, list = [];
    var t1 = textLayer('Texto', 'Palabra clave', 540, cy + 28, 85, '#111111', 0, null);
    t1.tr = [P.p('ADBE Position', [540, cy + 28]), P.p('ADBE Scale', [100, 100], popKf(60, 108)), P.p('ADBE Opacity', 100, fadeKf())];
    list.push({ id: 'builtin:caja', name: 'Caja destacada', v: 1, builtin: true, comp: { w: W, h: H }, upper: true,
      layers: [t1, rectLayer('Caja', 540, cy, 560, 128, 28, '#ffd400', 0, true)] });

    var t2 = textLayer('Texto', 'Título', 540, cy, 90, '#ffffff', 0, null);
    t2.tr = [P.p('ADBE Position', [540, cy], slideKf(540, cy + 40, cy)), P.p('ADBE Opacity', 100, fadeKf())];
    var line = rectLayer('Subrayado', 540, cy + 46, 420, 10, 5, '#ffd400', 0.18, false);
    line.tr = [P.p('ADBE Position', [540, cy + 46]), P.p('ADBE Scale', [100, 100], [K(0, [0, 100]), K(0.3, [100, 100], true)]), P.p('ADBE Opacity', 100)];
    list.push({ id: 'builtin:subrayado', name: 'Título + subrayado', v: 1, builtin: true, comp: { w: W, h: H }, upper: true, layers: [t2, line] });

    var a = textLayer('Arriba', 'Pequeño', 540, cy - 60, 56, '#ffffff', 0, null);
    a.tr = [P.p('ADBE Position', [540, cy - 60], slideKf(540, cy - 20, cy - 60)), P.p('ADBE Opacity', 100, fadeKf())];
    var b = textLayer('Abajo', 'GRANDE', 540, cy + 40, 110, '#ffd400', 0.12, null);
    b.tr = [P.p('ADBE Position', [540, cy + 40], slideKf(540, cy + 90, cy + 40, 0.12 * 0)), P.p('ADBE Opacity', 100, fadeKf())];
    list.push({ id: 'builtin:dos', name: 'Dos líneas', v: 1, builtin: true, comp: { w: W, h: H }, upper: true, layers: [a, b] });

    var n1 = textLayer('Texto', 'Neón', 540, cy, 95, '#ffffff', 0, null);
    n1.tr = [P.p('ADBE Position', [540, cy]), P.p('ADBE Opacity', 100, fadeKf())];
    n1.fx = [P.g('ADBE Drop Shadow', [
      P.p('ADBE Drop Shadow-0001', [1, 0.83, 0, 1]), P.p('ADBE Drop Shadow-0002', 217), P.p('ADBE Drop Shadow-0004', 0), P.p('ADBE Drop Shadow-0005', 30)
    ], 'Brillo')];
    list.push({ id: 'builtin:neon', name: 'Neón suave', v: 1, builtin: true, comp: { w: W, h: H }, upper: true, layers: [n1] });
    return list;
  };

  // ---------- almacenamiento ----------
  // io = {readLS(), writeLS(str), readFile(), writeFile(str)}  (todas opcionales)
  function parseList(s) {
    var d;
    try { d = JSON.parse(s); } catch (e) { return null; }
    return d && d.list && d.list.length !== undefined ? d.list : null;
  }
  P.createStore = function (io) {
    io = io || {};
    var S = { list: [] };
    function persist() {
      var s = JSON.stringify({ v: 1, list: S.list });
      try { if (io.writeLS) { io.writeLS(s); } } catch (e) {}
      try { if (io.writeFile) { io.writeFile(s); } } catch (e2) {}
    }
    S.load = function () {
      var a = null, b = null;
      try { a = io.readLS ? parseList(io.readLS()) : null; } catch (e) {}
      try { b = io.readFile ? parseList(io.readFile()) : null; } catch (e2) {}
      S.list = a && a.length ? a : (b || []);
      if (!S.list.length && !(a || b)) { S.list = P.builtinPack(); persist(); }
      return S.list;
    };
    S.get = function (id) { var i; for (i = 0; i < S.list.length; i++) { if (S.list[i].id === id) { return S.list[i]; } } return null; };
    S.defs = function () { var m = {}, i; for (i = 0; i < S.list.length; i++) { m[S.list[i].id] = S.list[i]; } return m; };
    S.newId = function () { return 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); };
    S.add = function (def) {
      def.id = def.id && !S.get(def.id) ? def.id : S.newId();
      def.v = 1; def.builtin = false;
      S.list.push(def); persist(); return def;
    };
    S.update = function (id, patch) { var d = S.get(id), f; if (!d) { return false; } for (f in patch) { d[f] = patch[f]; } persist(); return true; };
    S.rename = function (id, name) { return S.update(id, { name: String(name || '').replace(/^\s+|\s+$/g, '') || 'Sin nombre' }); };
    S.remove = function (id) { var i; for (i = 0; i < S.list.length; i++) { if (S.list[i].id === id) { S.list.splice(i, 1); persist(); return true; } } return false; };
    S.duplicate = function (id) {
      var d = S.get(id); if (!d) { return null; }
      var c = JSON.parse(JSON.stringify(d)); c.id = null; c.name = d.name + ' (copia)'; c.fav = false;
      return S.add(c);
    };
    S.toggleFav = function (id) { var d = S.get(id); if (!d) { return false; } d.fav = !d.fav; persist(); return d.fav; };
    S.exportJSON = function (id) {
      var d = S.get(id); if (!d) { return ''; }
      return JSON.stringify({ escpres: 1, def: d }, null, 1);
    };
    S.importJSON = function (str) {
      var d;
      try { d = JSON.parse(str); } catch (e) { return { ok: false, error: 'Archivo no valido.' }; }
      var defs = d && d.escpres === 1 && d.def ? [d.def] : (d && d.escpres === 1 && d.defs ? d.defs : null);
      if (!defs) { return { ok: false, error: 'No es una plantilla de Laddersu.' }; }
      var i, n = 0;
      for (i = 0; i < defs.length; i++) {
        var err = P.validate(defs[i]);
        if (err) { return { ok: false, error: err }; }
        var c = JSON.parse(JSON.stringify(defs[i])); c.id = null; S.add(c); n++;
      }
      return { ok: true, count: n };
    };
    S.exportAll = function () { return JSON.stringify({ escpres: 1, defs: S.list.filter(function (x) { return !x.builtin; }) }, null, 1); };
    // restaura las incluidas que falten o fueron borradas; las existentes se reemplazan por la version original
    S.restorePack = function () {
      var pack = P.builtinPack(), i, n = 0;
      for (i = 0; i < pack.length; i++) {
        var cur = S.get(pack[i].id);
        if (cur) { var k = S.list.indexOf(cur); pack[i].fav = cur.fav; S.list[k] = pack[i]; } else { S.list.unshift(pack[i]); }
        n++;
      }
      persist(); return n;
    };
    return S;
  };

  return P;
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Pres;

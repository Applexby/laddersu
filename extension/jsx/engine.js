/*
 * Laddersu - motor de logica pura (ES3, sin dependencias, SOLO ASCII).
 * Se usa en tres sitios: panel CEP (Chromium), ExtendScript de AE ($.evalFile) y tests en Node.
 * No toca la API de After Effects: la medicion de texto se inyecta como funcion.
 * Importante: ExtendScript no tiene Array.indexOf/forEach/map ni JSON. Los acentos van como \uXXXX.
 */
var ES = (function () {
  var ES = {};
  ES.VERSION = '0.7.0';

  // ---------- Utilidades ----------
  function trim(s) { return String(s).replace(/^\s+|\s+$/g, ''); }
  function lower(s) { return String(s).toLowerCase(); }
  function stripPunct(s) {
    return lower(s).replace(/^[\s\u00bf\u00a1"'(\[]+|[\s?!.,;:"')\]\u2026]+$/g, '');
  }
  ES.stripPunct = stripPunct;

  // ---------- 1. Parser SRT ----------
  function tcToSec(h, m, s, ms) {
    return parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10) + parseInt(ms, 10) / 1000;
  }

  ES.parseSRT = function (text) {
    var out = [];
    text = String(text).replace(/^\ufeff/, '').replace(/\r\n?/g, '\n');
    var blocks = text.split(/\n\s*\n/);
    var re = /(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)/;
    for (var i = 0; i < blocks.length; i++) {
      var lines = blocks[i].split('\n');
      var ti = -1;
      for (var j = 0; j < lines.length; j++) { if (re.test(lines[j])) { ti = j; break; } }
      if (ti < 0) continue;
      var m = re.exec(lines[ti]);
      var body = trim(lines.slice(ti + 1).join(' '));
      if (!body) continue;
      out.push({
        start: tcToSec(m[1], m[2], m[3], m[4]),
        end: tcToSec(m[5], m[6], m[7], m[8]),
        text: body
      });
    }
    return out;
  };

  // ---------- 2. Palabras funcion / pesos ----------
  var FUNC = ('el la los las un una unos unas de del en y a o u que no se es si tu su por con sin para al lo ' +
              'e ni mi te me le les nos ya muy mas m\u00e1s pero como cuando donde este esta esto eso ese esa ' +
              'sus mis tus fue son ser va vas voy hay ha he ' +
              'the a an of to in on and or is it that this for with at by be are was').split(' ');
  var FUNC_MAP = {};
  (function () { for (var i = 0; i < FUNC.length; i++) FUNC_MAP[FUNC[i]] = true; })();

  ES.isFunctionWord = function (w) { return FUNC_MAP[stripPunct(w)] === true; };

  ES.visualWeight = function (w) {
    var len = stripPunct(w).length;
    // alineado con la skill: cortas (el, la, si, en, y, tu)=0.5 - normales (seria, todo, magia)=1 - largas (10+)=2
    if (len <= 3) return 0.5;
    if (len <= 9) return 1;
    return 2;
  };

  function endsSentence(t) { return /[?!.\u2026]["')\]]*$/.test(trim(t)); }

  // ---------- 3. Agrupar en secuencias ----------
  // entries: [{start,end,text}] (palabra por palabra o grupos pequenos de Premiere)
  // opts: {gap:0.4, maxWeight:4}
  ES.groupSequences = function (entries, opts) {
    opts = opts || {};
    var gap = opts.gap == null ? 0.4 : opts.gap;
    var maxW = opts.maxWeight == null ? 4 : opts.maxWeight;
    var seqs = [], cur = [], weight = 0, i;

    function flush() {
      if (cur.length) {
        seqs.push({ words: cur, start: cur[0].start, end: cur[cur.length - 1].end });
      }
      cur = []; weight = 0;
    }

    for (i = 0; i < entries.length; i++) {
      var e = entries[i];
      // un bloque de Premiere con varias palabras cuenta como una unidad de peso 2
      var multi = trim(e.text).split(/\s+/).length > 1;
      var w = multi ? 2 : ES.visualWeight(e.text);

      if (cur.length) {
        var prev = cur[cur.length - 1];
        var mustCut = endsSentence(prev.text) || (e.start - prev.end) > gap;
        var overLimit = (weight + w) > maxW;
        // nunca terminar una secuencia con palabra funcion separandola de su complemento
        // ("en | ingles", "sin | subtitulos"). Empezar con una ("si entendieras...") esta bien.
        // Tope duro: maxWeight + 2.
        var danglingFn = ES.isFunctionWord(prev.text);
        var hardLimit = (weight + w) > (maxW + 2);
        if (mustCut || hardLimit || (overLimit && !danglingFn)) flush();
      }
      cur.push({ text: trim(e.text), start: e.start, end: e.end });
      weight += w;
    }
    flush();
    return seqs;
  };

  // ---------- 3b. Frases cortas (estilos de una linea: "Una linea" y APPLEXBY) ----------
  // Pocas palabras por frase: corta al llegar a maxWords (por defecto 2) o a maxChars letras, en cada pausa
  // (punto, coma, silencio > gap) y nunca deja una palabra funcion colgando al final ("o | simplemente").
  // Devuelve [[elementos originales]] (no copia: sirve para reagrupar palabras del panel sin perder sus ajustes).
  ES.groupShort = function (items, opts) {
    opts = opts || {};
    var maxW = opts.maxWords || 2, gap = opts.gap == null ? 0.4 : opts.gap, maxC = opts.maxChars || 18;
    var out = [], cur = [], count = 0, chars = 0, i;
    function flush() { if (cur.length) { out.push(cur); } cur = []; count = 0; chars = 0; }
    for (i = 0; i < items.length; i++) {
      var e = items[i], t = trim(String(e.text)), n = t ? t.split(/\s+/).length : 1, len = stripPunct(t).length;
      if (cur.length) {
        var prev = cur[cur.length - 1], pt = trim(String(prev.text));
        var pause = endsSentence(pt) || /[,;:]["')\]]*$/.test(pt) || (e.start - prev.end) > gap;
        var full = (count + n) > maxW || (chars + 1 + len) > maxC;
        var dangling = ES.isFunctionWord(pt);
        var hard = (count + n) > (maxW + 2);
        // una palabra funcion que llenaria la frase se guarda para la siguiente, junto a su complemento
        var fnFills = maxW > 1 && !dangling && ES.isFunctionWord(t) && (count + n) >= maxW;
        if (pause || hard || fnFills || (full && !dangling)) { flush(); }
      }
      cur.push(e); count += n; chars += (cur.length > 1 ? 1 : 0) + len;
    }
    flush();
    return out;
  };
  ES.isLineStyle = function (style) { return style === 'line' || style === 'applexby'; };

  // ---------- 4. Clasificacion de tamanos ----------
  // devuelve para cada palabra {size:'S'|'M'|'L', brand:bool}
  ES.autoClassify = function (words) {
    var res = [], i, bestIdx = -1, bestLen = 0;
    for (i = 0; i < words.length; i++) {
      var clean = stripPunct(words[i].text);
      var cls = 'M';
      if (ES.isFunctionWord(clean)) cls = 'S';
      else if (clean.length >= 7) cls = 'L';
      res.push({ size: cls, brand: false });
      if (cls !== 'S' && clean.length > bestLen) { bestLen = clean.length; bestIdx = i; }
    }
    if (bestIdx >= 0) {
      // el nucleo de la secuencia siempre es grande y lleva color de marca
      res[bestIdx].size = 'L';
      res[bestIdx].brand = true;
    }
    return res;
  };

  // ---------- 5. Prompt / JSON para IA ----------
  ES.buildAIPrompt = function (seqs) {
    var lines = [], i;
    for (i = 0; i < seqs.length; i++) {
      var ws = [], j;
      for (j = 0; j < seqs[i].words.length; j++) ws.push(seqs[i].words[j].text);
      lines.push((i + 1) + ': ' + ws.join(' '));
    }
    return [
      'Eres editor de subtitulos animados para Reels. Te paso secuencias numeradas.',
      'Para cada palabra devuelve su tamano:',
      '  "S" = palabra funcion o de relleno (el, la, de, en, que, y...)',
      '  "M" = palabra normal',
      '  "L" = palabra de impacto semantico alto (concepto clave)',
      'Y marca con "brand": true la palabra MAS importante de cada secuencia (normalmente solo una, y suele ser L).',
      '',
      'Responde SOLO con JSON valido, sin texto extra ni bloques de codigo, con este formato:',
      '{"seqs":[{"n":1,"words":[{"w":"palabra","size":"M","brand":false}]}]}',
      'Manten las palabras exactamente en el mismo orden y cantidad.',
      '',
      'SECUENCIAS:',
      lines.join('\n')
    ].join('\n');
  };

  // Acepta la respuesta de la IA (con o sin ```json) y la valida contra las secuencias.
  // Devuelve {ok, classes:[[{size,brand}...]...], warnings:[...]}
  ES.parseAIResponse = function (raw, seqs, jsonParse) {
    var warnings = [], classes = [], i, j;
    var txt = String(raw).replace(/```json|```/g, '');
    var a = txt.indexOf('{'), b = txt.lastIndexOf('}');
    if (a < 0 || b < 0) return { ok: false, classes: [], warnings: ['No se encontro JSON en la respuesta.'] };
    var data;
    try { data = (jsonParse || JSON.parse)(txt.substring(a, b + 1)); }
    catch (err) { return { ok: false, classes: [], warnings: ['JSON invalido: ' + err] }; }
    if (!data || !data.seqs) return { ok: false, classes: [], warnings: ['Falta la clave "seqs".'] };

    var byN = {};
    for (i = 0; i < data.seqs.length; i++) byN[data.seqs[i].n] = data.seqs[i];

    for (i = 0; i < seqs.length; i++) {
      var src = seqs[i].words, got = byN[i + 1], cl = [];
      var auto = ES.autoClassify(src);
      if (!got || !got.words || got.words.length !== src.length) {
        warnings.push('Secuencia ' + (i + 1) + ': cantidad de palabras no coincide, uso reglas locales.');
        classes.push(auto);
        continue;
      }
      var anyBrand = false;
      for (j = 0; j < src.length; j++) {
        var sz = String(got.words[j].size || 'M').toUpperCase();
        if (sz !== 'S' && sz !== 'M' && sz !== 'L') sz = 'M';
        var br = got.words[j].brand === true;
        if (br) anyBrand = true;
        cl.push({ size: sz, brand: br });
      }
      if (!anyBrand) {
        for (j = 0; j < cl.length; j++) if (auto[j].brand) cl[j].brand = true;
      }
      classes.push(cl);
    }
    return { ok: true, classes: classes, warnings: warnings };
  };

  // ---------- 6. Clase por palabra (tamano + efectos) ----------
  ES.normalizeClass = function (c) {
    c = c || {};
    var caps = c.caps;
    if (caps !== 'upper' && caps !== 'lower' && caps !== 'none') caps = '';
    return {
      size: (c.size === 'S' || c.size === 'L') ? c.size : 'M',
      brand: c.brand === true,
      color: c.color || '',       // '' = heredar (texto o marca)
      font: c.font || '',         // nombre PostScript, '' = fuente global
      trans: c.trans || '',       // id de ES.TRANS, '' = animacion por defecto
      fmt: c.fmt || '',           // '' | 'box' | 'underline'
      boxColor: c.boxColor || '', // color de la caja o del subrayado
      sfx: c.sfx || '',           // id de sonido
      glow: c.glow === true,      // brillo de neon alrededor
      glowColor: c.glowColor || '',
      caps: caps,                 // '' hereda | 'upper' | 'lower' | 'none'
      br: c.br === true           // salto de linea antes de esta palabra
    };
  };

  // Texto que se muestra: respeta mayusculas globales o las de la palabra.
  ES.displayText = function (text, c, upperGlobal) {
    var mode = (c && c.caps) ? c.caps : (upperGlobal ? 'upper' : 'none');
    if (mode === 'upper') return String(text).toUpperCase();
    if (mode === 'lower') return String(text).toLowerCase();
    return String(text);
  };

  // Color final del texto. Si la palabra va en caja del mismo color que su texto automatico,
  // se usa tinta oscura para que se lea (p. ej. palabra clave amarilla dentro de caja amarilla).
  ES.textColor = function (c, baseHex, brandHex, boxHex) {
    var col = c.color || (c.brand ? brandHex : baseHex);
    if (c.fmt === 'box' && !c.color && String(c.boxColor || boxHex).toLowerCase() === String(col).toLowerCase()) col = '#141414';
    return col;
  };

  // ---------- 7. Layout tipografico (bloque con lineas) ----------
  // Patron de alineacion por frase. mode: 'auto' (variado) | 'center' | 'stair' | 'zigzag' | 'left' | 'right'
  ES.pickAlign = function (mode, idx, nLines) {
    if (mode && mode !== 'auto') return mode;
    if (nLines <= 1) return 'center';
    if (nLines === 2) return (idx % 2) ? 'zigzag' : 'center';
    var cyc = ['stair', 'zigzag', 'center'];
    return cyc[idx % 3];
  };

  /*
   * Corte de lineas por programacion dinamica (minimiza irregularidad, estilo Knuth-Plass simplificado).
   * items: [{w, S, L, br, glue, punct}]  W: ancho maximo de linea.
   * opt:   {gap, fill (0.62), maxContent (2), lineCost (6)}
   * Reglas: una palabra pequena (S) queda pegada a la siguiente; salto forzado (br) se respeta;
   * a lo sumo `maxContent` palabras de contenido por linea; no dos palabras grandes (L) juntas;
   * se prefiere cortar despues de coma/punto.
   * Devuelve un arreglo de lineas, cada una con los indices de sus palabras.
   */
  ES.breakLines = function (items, W, opt) {
    opt = opt || {};
    var n = items.length;
    if (!n) return [];
    var gap = opt.gap || 0;
    var fill = opt.fill == null ? 0.62 : opt.fill;
    var maxContent = opt.maxContent == null ? 2 : opt.maxContent;
    var lineCost = opt.lineCost == null ? 6 : opt.lineCost;
    var pairCost = opt.pairCost == null ? 0 : opt.pairCost;
    var noGlue = opt.noGlue === true;
    var INF = 1e12, best = [], from = [], i, j, k;
    for (i = 0; i <= n; i++) { best.push(INF); from.push(-1); }
    best[0] = 0;

    for (i = 1; i <= n; i++) {
      var w = 0, content = 0, ls = 0, cnt = 0;
      for (j = i - 1; j >= 0; j--) {
        var it = items[j];
        w += it.w + (cnt ? gap : 0);
        cnt++;
        if (!it.S) content++;
        if (it.L) ls++;
        if (cnt > 1 && w > W) break;
        var okStart = (j === 0) || it.br || noGlue || !items[j - 1].glue;
        if (okStart && best[j] < INF) {
          var dev = (w - W * fill) / W;
          var c = dev * dev * 100;
          if (i === n && w < W * fill) c *= 0.35;
          if (ls > 1) c += 60 * (ls - 1);
          if (content > maxContent) c += 40 * (content - maxContent);
          if (content === 2) c += pairCost;
          if (content === 0) c += 80;
          if (i < n && items[i - 1].punct) c -= 14;
          if (i === n && cnt === 1 && n > 1 && items[j].S) c += 40;
          c += lineCost;
          if (best[j] + c < best[i]) { best[i] = best[j] + c; from[i] = j; }
        }
        if (it.br && j > 0) break;
      }
    }

    if (best[n] >= INF) {
      if (!noGlue) {
        var o2 = {}; for (k in opt) { if (opt.hasOwnProperty(k)) o2[k] = opt[k]; }
        o2.noGlue = true;
        return ES.breakLines(items, W, o2);
      }
      var all = []; for (i = 0; i < n; i++) all.push(i);
      return [all];
    }

    var lines = [];
    i = n;
    while (i > 0) {
      j = from[i];
      var line = [];
      for (k = j; k < i; k++) line.push(k);
      lines.unshift(line);
      i = j;
    }
    return lines;
  };

  /*
   * Bloque tipografico dentro de la zona segura.
   * words:   [{text}]  (texto YA transformado: mayusculas, etc.)
   * classes: [{size, br}]
   * cfg: {sizes:{S,M,L}, gap, lineGap, capRatio (0.72), fill, maxContent, align, alignIndex, stairStep,
   *       smallAlign ('top'|'base'|'center'), safe:{x0,y0,x1,y1}, centerY, fit (true)}
   * measure(text, px, font) -> ancho en px
   * Devuelve {boxes:[{x,y,size,w,h,line}], lines:[[idx]], bbox:{x0,y0,x1,y1}, scale, align}
   *   (x,y) = esquina izquierda sobre la LINEA BASE de cada palabra.
   */
  ES.layoutLockup = function (words, classes, cfg, measure) {
    var n = words.length;
    var sizes = cfg.sizes || { S: 50, M: 65, L: 85 };
    var safe = cfg.safe;
    var W = safe.x1 - safe.x0, H = safe.y1 - safe.y0;
    var capRatio = cfg.capRatio || 0.72;
    var gap0 = cfg.gap == null ? Math.round(sizes.M * 0.26) : cfg.gap;
    var lineGap0 = cfg.lineGap == null ? Math.round(sizes.M * 0.12) : cfg.lineGap;
    var smallAlign = cfg.smallAlign || 'top';
    var cx = cfg.centerX == null ? (safe.x0 + safe.x1) / 2 : cfg.centerX;
    var cy = cfg.centerY == null ? (safe.y0 + safe.y1) / 2 : cfg.centerY;
    var fit = cfg.fit !== false;
    var padX = cfg.boxPad ? cfg.boxPad.x : 14, padY = cfg.boxPad ? cfg.boxPad.y : 8;
    var i, j;
    if (!n) return { boxes: [], lines: [], bbox: null, scale: 1, align: 'center' };

    // anchos base (a 100%) medidos una sola vez
    var px0 = [], w0 = [];
    for (i = 0; i < n; i++) {
      px0.push(sizes[classes[i].size] || sizes.M);
      w0.push(measure(words[i].text, px0[i], classes[i].font || ''));
    }

    function pass(k) {
      var items = [];
      for (i = 0; i < n; i++) {
        var txt = words[i].text, cl = classes[i];
        items.push({
          w: w0[i] * k + (cl.fmt === 'box' ? 2 * padX * k : 0), S: cl.size === 'S', L: cl.size === 'L', br: cl.br === true && i > 0,
          glue: cl.size === 'S' && i < n - 1 && classes[i + 1].size !== 'S',
          punct: /[,.;:?!\u2026]["')\]]*$/.test(trim(txt))
        });
      }
      var lines = ES.breakLines(items, W, { gap: gap0 * k, fill: cfg.fill == null ? 0.5 : cfg.fill, maxContent: cfg.maxContent,
        pairCost: cfg.pairCost == null ? 10 : cfg.pairCost, lineCost: cfg.lineCost == null ? 3 : cfg.lineCost });
      var nl = lines.length;
      var align = ES.pickAlign(cfg.align, cfg.alignIndex || 0, nl);

      var info = [], maxLineW = 0, line;
      for (var a = 0; a < nl; a++) {
        line = lines[a];
        var lw = 0, ms = 0, up = 0, dn = 0;
        for (j = 0; j < line.length; j++) {
          var cj = classes[line[j]], pj = px0[line[j]] * k;
          lw += items[line[j]].w + (j ? gap0 * k : 0);
          if (pj > ms) ms = pj;
          // la caja y el subrayado ocupan espacio: se reserva arriba/abajo de la linea
          if (cj.fmt === 'box') { if (padY * k > up) up = padY * k; if (padY * k > dn) dn = padY * k; }
          if (cj.fmt === 'underline' && pj * 0.24 > dn) dn = pj * 0.24;
        }
        info.push({ w: lw, max: ms, up: up, dn: dn });
        if (lw > maxLineW) maxLineW = lw;
      }

      var step = 0;
      if (align === 'stair' && nl > 1) {
        step = (cfg.stairStep != null ? cfg.stairStep : 0.09 * W) * k;
        var room = (W - maxLineW) / (nl - 1);
        if (room < step) step = room > 0 ? room : 0;
        if (step < 0.025 * W) { align = 'center'; step = 0; }
      }
      var blockW = align === 'stair' ? maxLineW + (nl - 1) * step : maxLineW;

      var xs = [];
      for (a = 0; a < nl; a++) {
        var lx;
        if (align === 'left') lx = 0;
        else if (align === 'right') lx = blockW - info[a].w;
        else if (align === 'stair') lx = a * step;
        else if (align === 'zigzag') lx = (a % 2 === 0) ? 0 : blockW - info[a].w;
        else lx = (blockW - info[a].w) / 2;
        xs.push(lx);
      }

      var bases = [], y = 0;
      for (a = 0; a < nl; a++) {
        y += info[a].up + capRatio * info[a].max + (a ? lineGap0 * k + info[a - 1].dn : 0);
        bases.push(y);
      }
      return { lines: lines, info: info, xs: xs, bases: bases, w: blockW, h: bases[nl - 1] + info[nl - 1].dn, align: align, k: k, gap: gap0 * k };
    }

    var k = 1, res = pass(1);
    if (fit) {
      var need = Math.min(1, W / res.w, H / res.h);
      if (need < 0.999) {
        k = Math.max(0.5, need);
        res = pass(k);
        var need2 = Math.min(1, W / res.w, H / res.h);
        if (need2 < 0.999) { k = Math.max(0.5, k * need2); res = pass(k); }
      }
    }

    // posicion global del bloque, dentro de la zona segura
    var left = cx - res.w / 2;
    if (left < safe.x0) left = safe.x0;
    if (left + res.w > safe.x1) left = Math.max(safe.x0, safe.x1 - res.w);
    var top = cy - res.h / 2;
    if (top < safe.y0) top = safe.y0;
    if (top + res.h > safe.y1) top = Math.max(safe.y0, safe.y1 - res.h);

    var boxes = new Array(n), a2, x;
    for (a2 = 0; a2 < res.lines.length; a2++) {
      var ln = res.lines[a2];
      x = left + res.xs[a2];
      for (j = 0; j < ln.length; j++) {
        var idx = ln[j];
        var size = px0[idx] * k, lineMax = res.info[a2].max, base;
        if (size >= lineMax - 0.001 || smallAlign === 'base') {
          base = top + res.bases[a2];                                              // sobre la linea base
        } else if (smallAlign === 'center') {
          base = top + res.bases[a2] - capRatio * (lineMax - size) / 2;
        } else {
          // 'top': el tope de las mayusculas de la palabra pequena coincide con el de la grande
          base = top + res.bases[a2] - capRatio * (lineMax - size);
        }
        var bp = classes[idx].fmt === 'box' ? padX * k : 0;
        boxes[idx] = { x: x + bp, y: base, size: size, w: w0[idx] * k, h: size, line: a2 };
        x += w0[idx] * k + 2 * bp + res.gap;
      }
    }
    return {
      boxes: boxes, lines: res.lines, scale: k, align: res.align,
      bbox: { x0: left, y0: top, x1: left + res.w, y1: top + res.h }
    };
  };


  // ---------- 7b. Estilo "Caja que recorre" (karaoke) ----------
  // Toda la frase visible en orden (lineas llenas, centradas, mismo tamano) y una caja que pasa de palabra en palabra.
  // cfg: igual que layoutLockup + {karaokeSize:'M'|'L'|'S', maxContent (4), boxPad:{x,y}}
  ES.layoutKaraoke = function (words, classes, cfg, measure) {
    var cls = [], i, c2 = {}, f;
    for (i = 0; i < classes.length; i++) {
      var c = ES.normalizeClass(classes[i]);
      for (f in cfg) c2[f] = cfg[f];
      cls.push({ size: cfg.karaokeSize || 'M', br: c.br, font: c.font, fmt: 'box', brand: c.brand });
    }
    c2.align = 'center'; c2.smallAlign = 'base'; c2.fill = cfg.fill == null ? 0.82 : cfg.fill;
    c2.maxContent = cfg.maxContent || 4; c2.pairCost = 0;
    return ES.layoutLockup(words, cls, c2, measure);
  };

  // Recorrido de la caja: devuelve claves [{t, cx, cy, w, h}] (centro y tamano del rectangulo).
  // La caja se queda en la palabra y se desliza a la siguiente en `move` segundos, llegando justo cuando empieza.
  ES.karaokeKeys = function (boxes, words, opt) {
    opt = opt || {};
    var cap = opt.capRatio || 0.72, px = opt.padX == null ? 14 : opt.padX, py = opt.padY == null ? 8 : opt.padY;
    var move = opt.move == null ? 0.12 : opt.move, keys = [], i, last = -1e9;
    for (i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      var r = { cx: b.x + b.w / 2, cy: b.y - b.size * cap / 2, w: b.w + 2 * px, h: b.size * cap + 2 * py };
      var t = words[i].start;
      if (i === 0) { keys.push({ t: t, cx: r.cx, cy: r.cy, w: r.w, h: r.h }); last = t; continue; }
      var prev = keys[keys.length - 1];
      var t0 = Math.max(t - move, last + 0.01);
      if (t <= t0) t = t0 + 0.01;
      keys.push({ t: t0, cx: prev.cx, cy: prev.cy, w: prev.w, h: prev.h, hold: true });
      keys.push({ t: t, cx: r.cx, cy: r.cy, w: r.w, h: r.h });
      last = t;
    }
    return keys;
  };

  // Valor interpolado de la caja en el tiempo t (para la vista previa del panel)
  ES.karaokeAt = function (keys, t) {
    if (!keys.length) return null;
    if (t <= keys[0].t) return keys[0];
    var i;
    for (i = 1; i < keys.length; i++) {
      if (t < keys[i].t) {
        var a = keys[i - 1], b = keys[i], p = (t - a.t) / Math.max(1e-6, b.t - a.t);
        p = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        return { cx: a.cx + (b.cx - a.cx) * p, cy: a.cy + (b.cy - a.cy) * p, w: a.w + (b.w - a.w) * p, h: a.h + (b.h - a.h) * p };
      }
    }
    return keys[keys.length - 1];
  };

  // Texto claro sobre caja clara -> tinta oscura
  ES.luma = function (hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return 1;
    var n = parseInt(m[1], 16);
    return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  };
  ES.inkOn = function (textHex, boxHex) {
    return (ES.luma(boxHex) > 0.55 && ES.luma(textHex) > 0.55) ? '#141414' : (ES.luma(boxHex) < 0.3 && ES.luma(textHex) < 0.3 ? '#ffffff' : textHex);
  };


  // ---------- 7c. Estilo APPLEXBY (T1): una linea centrada en el tercio inferior ----------
  // Todas las palabras del mismo tamano. Si no cabe en una linea se parte en dos lineas equilibradas
  // (nunca tres); si aun asi no cabe, se reduce. cfg: {size, gap, lineGap, safe:{x0,x1,y0,y1}, centerX, centerY,
  // capRatio, font, minScale}. measure(text, px, font) -> ancho.
  ES.layoutLine = function (words, classes, cfg, measure) {
    var n = words.length, i, size = cfg.size || 64, gap = cfg.gap == null ? size * 0.28 : cfg.gap;
    var cap = cfg.capRatio || 0.72, lineGap = cfg.lineGap == null ? size * 0.32 : cfg.lineGap;
    var W = cfg.safe.x1 - cfg.safe.x0, cx = cfg.centerX == null ? (cfg.safe.x0 + cfg.safe.x1) / 2 : cfg.centerX;
    var w0 = [];
    for (i = 0; i < n; i++) { w0.push(measure(words[i].text, size, (classes[i] && classes[i].font) || cfg.font)); }
    function width(a, b) { var t = 0, k; for (k = a; k < b; k++) { t += w0[k] + (k > a ? gap : 0); } return t; }
    var lines = [[0, n]], forced = -1;
    for (i = 1; i < n; i++) { if (classes[i] && classes[i].br) { forced = i; break; } }
    if (forced > 0) { lines = [[0, forced], [forced, n]]; }
    else if (width(0, n) > W && n > 1) {
      // 1) corte mas parejo (sin terminar linea en palabra funcion); 2) si hay una pausa (coma, punto...) cuyo corte
      //    no queda mucho mas desparejo ni se sale del ancho, se prefiere: asi se lee como se dice.
      var best = 1, bestMax = 1e18, j;
      for (i = 1; i < n; i++) {
        var mx = Math.max(width(0, i), width(i, n)) + (ES.isFunctionWord(String(words[i - 1].text)) ? size * 2 : 0);
        if (mx < bestMax) { bestMax = mx; best = i; }
      }
      var punct = -1, punctMax = 1e18;
      for (j = 1; j < n; j++) {
        if (!/[,.;:!?\u2026]$/.test(String(words[j - 1].text))) { continue; }
        var pm = Math.max(width(0, j), width(j, n));
        if (pm <= Math.max(W, bestMax * 1.3) && pm < punctMax) { punctMax = pm; punct = j; }
      }
      if (punct > 0) { best = punct; }
      lines = [[0, best], [best, n]];
    }
    var maxW = 0, L;
    for (L = 0; L < lines.length; L++) { maxW = Math.max(maxW, width(lines[L][0], lines[L][1])); }
    var k = 1;
    if (maxW > W) { k = Math.max(cfg.minScale || 0.5, W / maxW); }
    var px = size * k, lh = px * cap, total = lines.length * lh + (lines.length - 1) * lineGap * k;
    var top = cfg.centerY - total / 2;
    if (top < cfg.safe.y0) { top = cfg.safe.y0; }
    if (top + total > cfg.safe.y1) { top = cfg.safe.y1 - total; }
    var boxes = [], x0 = 1e9, x1 = -1e9;
    for (L = 0; L < lines.length; L++) {
      var lw = width(lines[L][0], lines[L][1]) * k, x = cx - lw / 2, base = top + lh + L * (lh + lineGap * k);
      for (i = lines[L][0]; i < lines[L][1]; i++) {
        boxes[i] = { x: x, y: base, size: px, w: w0[i] * k, h: px, line: L };
        x += w0[i] * k + gap * k;
      }
      if (cx - lw / 2 < x0) { x0 = cx - lw / 2; }
      if (cx + lw / 2 > x1) { x1 = cx + lw / 2; }
    }
    var ln = [];
    for (L = 0; L < lines.length; L++) { var arr = []; for (i = lines[L][0]; i < lines[L][1]; i++) { arr.push(i); } ln.push(arr); }
    return { boxes: boxes, lines: ln, scale: k, align: 'center', bbox: { x0: x0, x1: x1, y0: top, y1: top + total } };
  };

  // ---------- Ocultar subtitulos mientras hay un T2 en pantalla ----------
  // Une intervalos que se tocan y devuelve solo los que cruzan [t0, t1].
  ES.mergeIntervals = function (list) {
    var a = [], i;
    for (i = 0; i < (list || []).length; i++) { if (list[i] && list[i][1] > list[i][0]) { a.push([list[i][0], list[i][1]]); } }
    a.sort(function (x, y) { return x[0] - y[0]; });
    var out = [];
    for (i = 0; i < a.length; i++) {
      if (out.length && a[i][0] <= out[out.length - 1][1] + 0.001) { if (a[i][1] > out[out.length - 1][1]) { out[out.length - 1][1] = a[i][1]; } }
      else { out.push(a[i]); }
    }
    return out;
  };
  ES.hideFor = function (intervals, t0, t1) {
    var out = [], i;
    for (i = 0; i < (intervals || []).length; i++) { if (intervals[i][0] < t1 && intervals[i][1] > t0) { out.push(intervals[i]); } }
    return out;
  };
  // Expresion de Opacidad: multiplica el valor (con sus keyframes) por 0 dentro de cada intervalo, con fundido corto.
  ES.hideExpr = function (intervals, fade) {
    var f = fade == null ? 0.12 : fade, parts = [], i;
    for (i = 0; i < intervals.length; i++) { parts.push('[' + (Math.round(intervals[i][0] * 1000) / 1000) + ',' + (Math.round(intervals[i][1] * 1000) / 1000) + ']'); }
    return '// Laddersu: oculto mientras hay un texto T2 en pantalla\n' +
      'var H = [' + parts.join(',') + '], F = ' + f + ', k = 1;\n' +
      'for (var i = 0; i < H.length; i++) {\n' +
      '  var a = H[i][0], b = H[i][1], g = 1;\n' +
      '  if (time >= a && time <= b) g = 0;\n' +
      '  else if (time > a - F && time < a) g = (a - time) / F;\n' +
      '  else if (time > b && time < b + F) g = (time - b) / F;\n' +
      '  k = Math.min(k, g);\n' +
      '}\n' +
      'value * k;';
  };
  // valor de ocultamiento para la vista previa (0..1)
  ES.hideAt = function (intervals, t, fade) {
    var f = fade == null ? 0.12 : fade, k = 1, i;
    for (i = 0; i < (intervals || []).length; i++) {
      var a = intervals[i][0], b = intervals[i][1], g = 1;
      if (t >= a && t <= b) { g = 0; } else if (t > a - f && t < a) { g = (a - t) / f; } else if (t > b && t < b + f) { g = (t - b) / f; }
      if (g < k) { k = g; }
    }
    return k;
  };

  // Comprobacion de solapes (tests y red de seguridad)
  ES.countOverlaps = function (boxes, capRatio) {
    var cap = capRatio || 0.72, n = 0, i, j;
    for (i = 0; i < boxes.length; i++) {
      for (j = i + 1; j < boxes.length; j++) {
        var a = boxes[i], b = boxes[j];
        var ax1 = a.x, ax2 = a.x + a.w, ay1 = a.y - a.size * cap, ay2 = a.y;
        var bx1 = b.x, bx2 = b.x + b.w, by1 = b.y - b.size * cap, by2 = b.y;
        if (ax1 < bx2 - 0.5 && bx1 < ax2 - 0.5 && ay1 < by2 - 0.5 && by1 < ay2 - 0.5) n++;
      }
    }
    return n;
  };

  // ---------- 8. Tiempos ----------
  // Todas las palabras de una secuencia comparten el final de la ultima (regla de tu skill).
  // nextStart (opcional): la cola nunca invade la secuencia siguiente.
  ES.seqEnd = function (seq, tail, nextStart) {
    var base = 0, i;
    for (i = 0; i < seq.words.length; i++) { if (seq.words[i].end > base) base = seq.words[i].end; }
    var e = base + (tail || 0);
    if (nextStart != null && e > nextStart) e = nextStart;
    return e < base ? base : e;
  };

  ES.stairTimes = function (seq, tail, nextStart) {
    var end = ES.seqEnd(seq, tail, nextStart);
    var out = [], i;
    for (i = 0; i < seq.words.length; i++) out.push({ start: seq.words[i].start, end: end });
    return out;
  };

  // ---------- 9. Transiciones (presets compartidos por panel y host) ----------
  // dir: de donde entra - dist px - blur px - fade - scale {from, over} (porcentaje; over = rebote) - dur seg (opcional)
  ES.TRANS = {
    none:      { name: 'Sin animaci\u00f3n', dir: 'none', dist: 0,  blur: 0,  fade: false, scale: null, dur: 0.01 },
    slideUp:   { name: 'Sube',          dir: 'up',   dist: 40, blur: 20, fade: true,  scale: null },
    slideDown: { name: 'Baja',          dir: 'down', dist: 40, blur: 20, fade: true,  scale: null },
    slideLeft: { name: 'Desde la derecha',   dir: 'left',  dist: 60, blur: 20, fade: true, scale: null },
    slideRight:{ name: 'Desde la izquierda', dir: 'right', dist: 60, blur: 20, fade: true, scale: null },
    blur:      { name: 'Desenfoque',    dir: 'none', dist: 0,  blur: 40, fade: true,  scale: null },
    fade:      { name: 'Fundido',       dir: 'none', dist: 0,  blur: 0,  fade: true,  scale: null },
    pop:       { name: 'Pop (rebote)',  dir: 'none', dist: 0,  blur: 0,  fade: true,  scale: { from: 55, over: 112 }, dur: 0.24 },
    zoomOut:   { name: 'Zoom desde grande', dir: 'none', dist: 0, blur: 14, fade: true, scale: { from: 160, over: 0 }, dur: 0.26 },
    // entrada APPLEXBY: opacidad 0->100 y desenfoque 20->0 px en 0,30 s, sin desplazamiento, curva suave al final
    blurIn:    { name: 'Entrada por desenfoque', dir: 'none', dist: 0, blur: 20, fade: true, scale: null, dur: 0.3 }
  };
  ES.TRANS_ORDER = ['none', 'slideUp', 'slideDown', 'slideLeft', 'slideRight', 'blur', 'blurIn', 'fade', 'pop', 'zoomOut'];

  // Salida = la entrada invertida (termina en tEnd). Devuelve las claves {t, opacity, blur} para panel y host.
  ES.exitKeys = function (a, tEnd) {
    var d = a && a.dur ? a.dur : 0.3;
    return { t0: tEnd - d, t1: tEnd, blur: a && a.blur ? a.blur : 0, fade: !a || a.fade !== false };
  };

  // def = animacion por defecto del panel; id = preset elegido para la palabra ('' = usar def)
  ES.resolveAnim = function (def, id) {
    var p = id ? ES.TRANS[id] : null;
    if (!p) return { dir: def.dir, dist: def.dist, blur: def.blur, fade: def.fade, dur: def.dur, scale: def.scale || null };
    return {
      dir: p.dir, dist: p.dist, blur: p.blur, fade: p.fade, scale: p.scale,
      dur: p.dur != null ? p.dur : def.dur
    };
  };

  // ---------- 10. Sonido automatico ----------
  // rule: {sfx:'pop', on:'L'|'brand'|'first'|'all'}. Devuelve el id de sonido que corresponde a una palabra
  // (j = posicion en su frase) o '' si la regla no aplica o la palabra ya tiene uno propio.
  ES.autoSfxFor = function (c, j, rule) {
    if (!rule || !rule.sfx || c.sfx) return c.sfx || '';
    var hit = rule.on === 'all' || (rule.on === 'L' && c.size === 'L') ||
              (rule.on === 'brand' && c.brand) || (rule.on === 'first' && j === 0);
    return hit ? rule.sfx : '';
  };

  return ES;
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ES;

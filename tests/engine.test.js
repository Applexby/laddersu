var assert = require('assert');
var fs = require('fs'), path = require('path');
var ES = require('../extension/jsx/engine.js');

var pass = 0;
function t(name, fn) { try { fn(); pass++; console.log('ok   ' + name); } catch (e) { console.log('FAIL ' + name + '\n     ' + e.message); process.exitCode = 1; } }

// estimador de ancho: fuente condensada en mayusculas (solo para tests)
function measure(text, px) { return text.length * px * 0.58; }
var SAFE = { x0: 151, y0: 270, x1: 929, y1: 1500 };   // 1080x1920 con margenes 14% / 14% / 22%

var SRT = [
  '1', '00:00:00,066 --> 00:00:00,333', 'Como', '',
  '2', '00:00:00,333 --> 00:00:00,633', 'seria', '',
  '3', '00:00:00,633 --> 00:00:00,750', 'tu', '',
  '4', '00:00:00,750 --> 00:00:01,383', 'experiencia?', '',
  '5', '00:00:01,500 --> 00:00:01,700', 'si', '',
  '6', '00:00:01,700 --> 00:00:02,100', 'entendieras', '',
  '7', '00:00:02,100 --> 00:00:02,400', 'todo', '',
  '8', '00:00:02,400 --> 00:00:02,700', 'en', '',
  '9', '00:00:02,700 --> 00:00:03,200', 'ingles.', ''
].join('\r\n');

// ---------------- SRT, agrupacion, clasificacion, IA (sin cambios de comportamiento) ----------------
t('el codigo de jsx/ es ASCII puro (ExtendScript lee sin BOM)', function () {
  ['engine.js', 'host.jsx'].forEach(function (f) {
    var p = path.join(__dirname, '..', 'extension', 'jsx', f);
    if (!fs.existsSync(p)) return;
    var s = fs.readFileSync(p, 'utf8');
    for (var i = 0; i < s.length; i++) assert.ok(s.charCodeAt(i) < 128, f + ' tiene un caracter no ASCII en la posicion ' + i);
  });
});

t('parseSRT lee 9 entradas con tiempos en segundos', function () {
  var e = ES.parseSRT(SRT);
  assert.strictEqual(e.length, 9);
  assert.strictEqual(e[0].text, 'Como');
  assert.ok(Math.abs(e[0].start - 0.066) < 1e-9);
  assert.ok(Math.abs(e[3].end - 1.383) < 1e-9);
});

t('parseSRT tolera BOM, punto decimal y bloques multilinea', function () {
  var e = ES.parseSRT('﻿1\n00:00:01.000 --> 00:00:02.000\nhola\nmundo\n');
  assert.strictEqual(e.length, 1);
  assert.strictEqual(e[0].text, 'hola mundo');
});

t('groupSequences corta en ? y respeta la oracion', function () {
  var s = ES.groupSequences(ES.parseSRT(SRT));
  assert.strictEqual(s.length, 2);
  assert.strictEqual(s[0].words.map(function (w) { return w.text; }).join(' '), 'Como seria tu experiencia?');
  assert.strictEqual(s[1].words.map(function (w) { return w.text; }).join(' '), 'si entendieras todo en ingles.');
});

t('groupSequences corta por pausa > 400ms', function () {
  var e = [{ start: 0, end: 0.3, text: 'hola' }, { start: 1.0, end: 1.3, text: 'mundo' }];
  assert.strictEqual(ES.groupSequences(e).length, 2);
});

t('groupSequences no termina una frase en palabra funcion', function () {
  var e = [
    { start: 0.0, end: 0.2, text: 'conectes' }, { start: 0.2, end: 0.5, text: 'directamente' },
    { start: 0.5, end: 0.7, text: 'en' }, { start: 0.7, end: 1.0, text: 'ingles' }
  ];
  ES.groupSequences(e).forEach(function (q) {
    assert.ok(!ES.isFunctionWord(q.words[q.words.length - 1].text), 'termina en palabra funcion');
  });
});

t('autoClassify: funcion=S, larga=L, una sola marca', function () {
  var c = ES.autoClassify([{ text: 'el' }, { text: 'proposito' }, { text: 'es' }, { text: 'esto' }]);
  assert.deepStrictEqual(c.map(function (x) { return x.size; }), ['S', 'L', 'S', 'S']);
  assert.strictEqual(c.filter(function (x) { return x.brand; }).length, 1);
  assert.ok(c[1].brand);
});

t('prompt de IA numera las secuencias y parseAIResponse valida cantidades', function () {
  var s = ES.groupSequences(ES.parseSRT(SRT));
  assert.ok(ES.buildAIPrompt(s).indexOf('1: Como seria tu experiencia?') >= 0);
  var resp = '```json\n{"seqs":[{"n":1,"words":[{"w":"Como","size":"S"},{"w":"seria","size":"M"},{"w":"tu","size":"S"},{"w":"experiencia?","size":"L","brand":true}]},{"n":2,"words":[{"w":"si","size":"S"}]}]}\n```';
  var r = ES.parseAIResponse(resp, s);
  assert.ok(r.ok); assert.strictEqual(r.classes[0][3].size, 'L'); assert.ok(r.classes[0][3].brand);
  assert.strictEqual(r.classes[1].length, s[1].words.length); assert.strictEqual(r.warnings.length, 1);
  assert.strictEqual(ES.parseAIResponse('no json', []).ok, false);
});

// ---------------- clase por palabra ----------------
t('normalizeClass rellena campos nuevos y limpia valores raros', function () {
  var c = ES.normalizeClass({ size: 'X', color: '#f00', caps: 'raro' });
  assert.strictEqual(c.size, 'M'); assert.strictEqual(c.color, '#f00'); assert.strictEqual(c.caps, '');
  assert.strictEqual(c.br, false); assert.strictEqual(c.glow, false); assert.strictEqual(c.glowColor, '');
  assert.strictEqual(ES.normalizeClass(null).size, 'M');
  assert.strictEqual(ES.normalizeClass({ caps: 'upper', br: true, glow: true }).caps, 'upper');
});

t('displayText: global, por palabra y "tal cual"', function () {
  assert.strictEqual(ES.displayText('moto', null, true), 'MOTO');
  assert.strictEqual(ES.displayText('Moto', { caps: 'lower' }, true), 'moto');
  assert.strictEqual(ES.displayText('Moto', { caps: 'none' }, true), 'Moto');
  assert.strictEqual(ES.displayText('está', { caps: '' }, true), 'ESTÁ');
  assert.strictEqual(ES.displayText('Moto', null, false), 'Moto');
});

// ---------------- layout tipografico ----------------
function lockup(phrase, idx, over) {
  var words = phrase.split(' ').map(function (x) { return { text: x.toUpperCase() }; });
  var cls = ES.autoClassify(words).map(ES.normalizeClass);
  var cfg = { sizes: { S: 50, M: 65, L: 85 }, safe: SAFE, centerY: 1190, align: 'auto', alignIndex: idx || 0 };
  for (var k in (over || {})) cfg[k] = over[k];
  var r = ES.layoutLockup(words, cls, cfg, measure);
  r.words = words; r.cls = cls;
  r.text = r.lines.map(function (l) { return l.map(function (i) { return words[i].text; }).join(' '); }).join(' / ');
  return r;
}

t('lockup: reproduce los cortes de linea de las capturas de MotoFacil', function () {
  assert.strictEqual(lockup('se trata de estar presente,').text, 'SE TRATA / DE ESTAR / PRESENTE,');
  assert.strictEqual(lockup('pero lo más bravo fue aprender a usarla').text, 'PERO LO MÁS BRAVO / FUE APRENDER / A USARLA');
  assert.strictEqual(lockup('nunca frenes solo con el de adelante').text, 'NUNCA FRENES / SOLO CON EL / DE ADELANTE');
  assert.strictEqual(lockup('con los días aprendí a escuchar la moto,').text, 'CON LOS DÍAS / APRENDÍ / A ESCUCHAR / LA MOTO,');
  assert.strictEqual(lockup('ya sabes dónde encontrarme').text, 'YA SABES DÓNDE / ENCONTRARME');
});

t('lockup: una palabra pequena nunca queda sola al final de una linea', function () {
  ['pero lo más bravo fue aprender a usarla', 'nunca frenes solo con el de adelante', 'no están asegurados por essalud.',
   'con los días aprendí a escuchar la moto,', 'estás por comprarte tu primera moto,'].forEach(function (p) {
    var r = lockup(p);
    r.lines.forEach(function (l, i) {
      var last = l[l.length - 1];
      if (i < r.lines.length - 1) {
        var next = r.cls[l[l.length - 1] + 1];
        assert.ok(!(r.cls[last].size === 'S' && next && next.size !== 'S'), p + ': linea termina en S pegada a "' + r.words[last + 1].text + '"');
      }
    });
  });
});

t('lockup: nunca solapa y todo queda dentro de la zona segura', function () {
  ['con responsabilidad se disfruta más', 'ya sabes dónde encontrarme', 'no están asegurados por essalud.',
   'estás por comprarte tu primera moto,', 'una dos tres cuatro cinco seis siete ocho nueve diez'].forEach(function (p, i) {
    ['auto', 'center', 'stair', 'zigzag', 'left', 'right'].forEach(function (al) {
      var r = lockup(p, i, { align: al });
      assert.strictEqual(ES.countOverlaps(r.boxes), 0, p + ' [' + al + '] solapa');
      r.boxes.forEach(function (b) {
        assert.ok(b.x >= SAFE.x0 - 0.5 && b.x + b.w <= SAFE.x1 + 0.5, p + ' [' + al + '] se sale a los lados: ' + b.x.toFixed(0) + '..' + (b.x + b.w).toFixed(0));
        assert.ok(b.y - b.size * 0.72 >= SAFE.y0 - 0.5 && b.y <= SAFE.y1 + 0.5, p + ' [' + al + '] se sale arriba/abajo');
      });
    });
  });
});

t('lockup: escala todo el bloque cuando una palabra no cabe', function () {
  var r = lockup('anticonstitucionalmente');   // 23 letras en L: 23*85*0.58 = 1134 px > 778
  assert.ok(r.scale < 0.7 && r.scale >= 0.5, 'scale=' + r.scale);
  assert.ok(r.boxes[0].x >= SAFE.x0 - 0.5 && r.boxes[0].x + r.boxes[0].w <= SAFE.x1 + 0.5);
  assert.ok(r.boxes[0].size < 85);
});

t('lockup: las palabras pequenas se alinean por ARRIBA de la grande (como en las capturas)', function () {
  var r = lockup('de adelante');
  var small = r.boxes[0], big = r.boxes[1];
  assert.strictEqual(r.lines.length, 1);
  assert.ok(Math.abs((small.y - small.size * 0.72) - (big.y - big.size * 0.72)) < 0.01, 'los topes de mayuscula no coinciden');
  assert.ok(small.y < big.y, 'la pequena debe quedar mas arriba que la linea base de la grande');
  var b = lockup('de adelante', 0, { smallAlign: 'base' });
  assert.ok(Math.abs(b.boxes[0].y - b.boxes[1].y) < 0.01, 'base: misma linea base');
});

t('lockup: patrones de alineacion', function () {
  var base = 'se trata de estar presente,';
  var c = lockup(base, 0, { align: 'center' }), s = lockup(base, 0, { align: 'stair' });
  var z = lockup(base, 0, { align: 'zigzag' }), l = lockup(base, 0, { align: 'left' }), rr = lockup(base, 0, { align: 'right' });
  function lineX(r, li) { var i = r.lines[li][0]; return r.boxes[i].x; }
  function lineR(r, li) { var i = r.lines[li][r.lines[li].length - 1]; return r.boxes[i].x + r.boxes[i].w; }
  assert.strictEqual(l.lines.length, 3);
  assert.ok(Math.abs(lineX(l, 0) - lineX(l, 1)) < 0.01 && Math.abs(lineX(l, 1) - lineX(l, 2)) < 0.01, 'left: mismo borde izquierdo');
  assert.ok(Math.abs(lineR(rr, 0) - lineR(rr, 2)) < 0.01, 'right: mismo borde derecho');
  assert.ok(lineX(s, 1) > lineX(s, 0) && lineX(s, 2) > lineX(s, 1), 'stair: cada linea mas a la derecha');
  assert.ok(lineX(z, 1) > lineX(z, 0) && lineX(z, 2) < lineX(z, 1), 'zigzag: izquierda, derecha, izquierda');
  var mid = (lineX(c, 1) + lineR(c, 1)) / 2;
  assert.ok(Math.abs(mid - 540) < 1, 'center: centrada en el medio de la zona segura');
});

t('lockup: el bloque se centra en la altura pedida y respeta los limites verticales', function () {
  var r = lockup('se trata de estar presente,', 0, { centerY: 1190 });
  assert.ok(Math.abs((r.bbox.y0 + r.bbox.y1) / 2 - 1190) < 0.01);
  var low = lockup('se trata de estar presente,', 0, { centerY: 5000 });
  assert.ok(low.bbox.y1 <= SAFE.y1 + 0.01, 'no pasa del limite inferior');
  var high = lockup('se trata de estar presente,', 0, { centerY: -500 });
  assert.ok(high.bbox.y0 >= SAFE.y0 - 0.01, 'no pasa del limite superior');
});

t('lockup: salto de linea forzado (br) se respeta', function () {
  var words = 'uno dos tres'.split(' ').map(function (x) { return { text: x.toUpperCase() }; });
  var cls = [ES.normalizeClass({}), ES.normalizeClass({ br: true }), ES.normalizeClass({})];
  var r = ES.layoutLockup(words, cls, { sizes: { S: 50, M: 65, L: 85 }, safe: SAFE, centerY: 1000, align: 'center' }, measure);
  assert.strictEqual(r.lines[0].length, 1); assert.strictEqual(r.lines[1][0], 1);
});

t('lockup: una sola palabra, y lista vacia', function () {
  var r = lockup('hola');
  assert.strictEqual(r.lines.length, 1); assert.strictEqual(r.boxes.length, 1);
  var e = ES.layoutLockup([], [], { safe: SAFE }, measure);
  assert.strictEqual(e.boxes.length, 0); assert.strictEqual(e.bbox, null);
});

t('pickAlign: variado segun lineas e indice; fijo si se pide', function () {
  assert.strictEqual(ES.pickAlign('auto', 0, 1), 'center');
  assert.strictEqual(ES.pickAlign('auto', 3, 3), 'stair');
  assert.strictEqual(ES.pickAlign('auto', 4, 3), 'zigzag');
  assert.strictEqual(ES.pickAlign('auto', 5, 4), 'center');
  assert.strictEqual(ES.pickAlign('auto', 1, 2), 'zigzag');
  assert.strictEqual(ES.pickAlign('left', 7, 5), 'left');
});

// ---------------- tiempos y transiciones ----------------
t('stairTimes: todas comparten el final de la palabra que termina ultima', function () {
  var s = ES.groupSequences(ES.parseSRT(SRT))[0];
  var tm = ES.stairTimes(s, 0);
  assert.ok(tm.every(function (x) { return Math.abs(x.end - 1.383) < 1e-9; }));
  assert.ok(Math.abs(tm[0].start - 0.066) < 1e-9);
  var odd = { words: [{ text: 'a', start: 2, end: 3 }, { text: 'b', start: 1, end: 1.5 }] };   // palabra movida: orden no cronologico
  assert.ok(Math.abs(ES.seqEnd(odd, 0) - 3) < 1e-9, 'usa el final maximo, no el de la ultima del arreglo');
});

t('seqEnd: la cola no invade la secuencia siguiente', function () {
  var seq = { words: [{ text: 'a', start: 0, end: 1.0 }] };
  assert.ok(Math.abs(ES.seqEnd(seq, 0.15, null) - 1.15) < 1e-9);
  assert.ok(Math.abs(ES.seqEnd(seq, 0.15, 1.05) - 1.05) < 1e-9);
  assert.ok(Math.abs(ES.seqEnd(seq, 0.15, 0.9) - 1.0) < 1e-9);
});

t('resolveAnim y presets', function () {
  var def = { dir: 'up', dist: 40, blur: 20, fade: true, dur: 0.18 };
  assert.strictEqual(ES.resolveAnim(def, '').dir, 'up');
  var p = ES.resolveAnim(def, 'pop');
  assert.strictEqual(p.dir, 'none'); assert.ok(p.scale && p.scale.over === 112); assert.strictEqual(p.dur, 0.24);
  assert.strictEqual(ES.resolveAnim(def, 'slideLeft').dur, 0.18);
  assert.strictEqual(ES.resolveAnim(def, 'noExiste').dir, 'up');
  ES.TRANS_ORDER.forEach(function (id) { assert.ok(ES.TRANS[id] && ES.TRANS[id].name, id); });
});

t('autoSfxFor: regla, sonido propio gana, sin regla no hay sonido', function () {
  var L = ES.normalizeClass({ size: 'L' }), S = ES.normalizeClass({ size: 'S' }), own = ES.normalizeClass({ size: 'L', sfx: 'click' });
  assert.strictEqual(ES.autoSfxFor(L, 2, { sfx: 'pop', on: 'L' }), 'pop');
  assert.strictEqual(ES.autoSfxFor(S, 2, { sfx: 'pop', on: 'L' }), '');
  assert.strictEqual(ES.autoSfxFor(own, 2, { sfx: 'pop', on: 'L' }), 'click');
  assert.strictEqual(ES.autoSfxFor(S, 0, { sfx: 'pop', on: 'first' }), 'pop');
  assert.strictEqual(ES.autoSfxFor(S, 1, { sfx: 'pop', on: 'all' }), 'pop');
  assert.strictEqual(ES.autoSfxFor(L, 0, { sfx: '', on: 'all' }), '');
  assert.strictEqual(ES.autoSfxFor(L, 0, null), '');
});

t('lockup: caja y subrayado reservan espacio (no tapan la linea siguiente)', function () {
  var words = ['COMO', 'SERIA', 'TU', 'EXPERIENCIA'].map(function (x) { return { text: x }; });
  var base = [{ size: 'S' }, { size: 'M' }, { size: 'S' }, { size: 'L' }].map(ES.normalizeClass);
  var cfg = { sizes: { S: 50, M: 65, L: 85 }, safe: SAFE, centerY: 1170, align: 'center', boxPad: { x: 14, y: 8 } };
  var r0 = ES.layoutLockup(words, base, cfg, measure);
  var dec = base.map(function (c, i) { var d = ES.normalizeClass(c); if (i === 1) d.fmt = 'underline'; if (i === 2) d.fmt = 'box'; return d; });
  var r1 = ES.layoutLockup(words, dec, cfg, measure);
  assert.deepStrictEqual(r1.lines, r0.lines);
  var b = r1.boxes, ul = b[1], nextTop = Math.min.apply(null, r1.boxes.filter(function (x) { return x.line === ul.line + 1; }).map(function (x) { return x.y - x.size * 0.72; }));
  if (r1.lines.length > 1 && ul.line < r1.lines.length - 1) {
    assert(ul.y + ul.size * 0.16 + Math.max(4, ul.size * 0.09) / 2 <= nextTop + 0.5, 'el subrayado no invade la linea de abajo');
  }
  // la caja deja aire a los lados: la palabra se corre padX respecto a la version sin caja
  var same = r0.boxes[2].line === r1.boxes[2].line;
  if (same) { assert(r1.bbox.x1 - r1.bbox.x0 >= r0.bbox.x1 - r0.bbox.x0 - 0.5); }
  assert.strictEqual(ES.countOverlaps(r1.boxes), 0);
  assert(r1.bbox.y0 >= SAFE.y0 - 0.5 && r1.bbox.y1 <= SAFE.y1 + 0.5);
});

console.log('\n' + pass + ' pruebas de motor OK');

(function () {
  var words = [{ text: 'NO', start: 0, end: 0.2 }, { text: 'ES', start: 0.2, end: 0.4 }, { text: 'MAGIA', start: 0.4, end: 0.9 }, { text: 'ES', start: 0.9, end: 1.1 }, { text: 'METODO', start: 1.1, end: 1.6 }];
  var cls = [{ size: 'S' }, { size: 'S' }, { size: 'L', brand: true }, { size: 'S' }, { size: 'L' }].map(ES.normalizeClass);
  var cfg = { sizes: { S: 50, M: 65, L: 85 }, safe: SAFE, centerY: 1170, boxPad: { x: 14, y: 8 } };
  var r = ES.layoutKaraoke(words, cls, cfg, measure);
  t('karaoke: todas las palabras del mismo tamano, centradas, sin solapes, en zona segura', function () {
    r.boxes.forEach(function (b) { assert.strictEqual(Math.round(b.size), Math.round(65 * r.scale)); });
    assert.strictEqual(r.align, 'center');
    assert.strictEqual(ES.countOverlaps(r.boxes), 0);
    assert(r.bbox.y0 >= SAFE.y0 - 0.5 && r.bbox.y1 <= SAFE.y1 + 0.5);
    assert(r.lines.length <= 2, 'lineas llenas (' + r.lines.length + ')');
  });
  t('karaoke: la caja llega a cada palabra cuando empieza y se queda quieta mientras tanto', function () {
    var k = ES.karaokeKeys(r.boxes, words, { move: 0.12 });
    assert.strictEqual(k.length, 1 + 2 * (words.length - 1));
    for (var i = 1; i < k.length; i++) assert(k[i].t > k[i - 1].t);
    // llegada exacta al inicio de cada palabra
    [0, 2, 4, 6, 8].forEach(function (ki, wi) { assert(Math.abs(k[ki].t - words[wi].start) < 1e-9); });
    var mid = ES.karaokeAt(k, 0.5);   // en MAGIA (0.4-0.9) antes de moverse
    assert(Math.abs(mid.cx - (r.boxes[2].x + r.boxes[2].w / 2)) < 0.01);
    var moving = ES.karaokeAt(k, 0.84);   // entre MAGIA y ES
    assert(moving.cx !== mid.cx || moving.cy !== mid.cy);
  });
  t('inkOn: texto claro sobre caja clara pasa a tinta oscura', function () {
    assert.strictEqual(ES.inkOn('#ffffff', '#ffd400'), '#141414');
    assert.strictEqual(ES.inkOn('#ffffff', '#3b2bff'), '#ffffff');
  });
})();

// ---------- v0.6: blurIn, estilo APPLEXBY, ocultar durante T2 ----------
(function () {
  var SZ = { x0: 151, y0: 960, x1: 929, y1: 1420 };
  function W(list) { return list.map(function (x) { return { text: x }; }); }
  function C(n, extra) { var a = []; for (var i = 0; i < n; i++) { a.push(ES.normalizeClass(extra && extra[i] ? extra[i] : {})); } return a; }
  t('blurIn: entrada por desenfoque de 0,30 s sin desplazamiento', function () {
    var a = ES.resolveAnim({ dir: 'up', dist: 40, blur: 20, fade: true, dur: 0.5 }, 'blurIn');
    assert.strictEqual(a.dir, 'none'); assert.strictEqual(a.dist, 0); assert.strictEqual(a.blur, 20); assert.strictEqual(a.fade, true); assert.strictEqual(a.dur, 0.3);
    assert(ES.TRANS_ORDER.indexOf('blurIn') >= 0);
    var x = ES.exitKeys(a, 10); assert.strictEqual(x.t0, 9.7); assert.strictEqual(x.t1, 10); assert.strictEqual(x.blur, 20);
  });
  t('APPLEXBY: frase corta en una sola linea centrada', function () {
    var w = W(['El', 'tiempo', 'que', 'mides']);
    var r = ES.layoutLine(w, C(4), { size: 64, safe: SZ, centerY: 1340 }, measure);
    assert.strictEqual(r.lines.length, 1);
    assert(r.boxes.every(function (b) { return b.size === 64; }), 'mismo tamano');
    assert(Math.abs((r.bbox.x0 + r.bbox.x1) / 2 - 540) < 0.5, 'centrada');
    assert.strictEqual(ES.countOverlaps(r.boxes), 0);
  });
  t('APPLEXBY: frase larga en dos lineas equilibradas, nunca tres', function () {
    var w = W('el tiempo que mides no es el tiempo que vives cada dia de tu vida entera'.split(' '));
    var r = ES.layoutLine(w, C(w.length), { size: 64, safe: SZ, centerY: 1340 }, measure);
    assert.strictEqual(r.lines.length, 2);
    var a = r.lines[0].length, b = r.lines[1].length;
    assert(Math.abs(a - b) <= 3, 'equilibradas: ' + a + '/' + b);
    assert(r.bbox.x1 - r.bbox.x0 <= SZ.x1 - SZ.x0 + 0.5, 'cabe en la zona (reduce si hace falta)');
    assert(r.bbox.y1 <= SZ.y1 + 0.5 && r.bbox.y0 >= SZ.y0 - 0.5);
    assert.strictEqual(ES.countOverlaps(r.boxes), 0);
  });
  t('APPLEXBY: prefiere cortar despues de una coma y no despues de "de"', function () {
    var w = W(['Ya', 'habra', 'tiempo,', 'decimos', 'siempre', 'antes', 'de', 'perderlo', 'todo']);
    var r = ES.layoutLine(w, C(w.length), { size: 80, safe: SZ, centerY: 1340 }, measure);
    assert.strictEqual(r.lines.length, 2);
    assert.strictEqual(w[r.lines[0][r.lines[0].length - 1]].text, 'tiempo,');
  });
  t('APPLEXBY: salto de linea forzado por el usuario', function () {
    var w = W(['una', 'dos', 'tres']);
    var r = ES.layoutLine(w, C(3, [{}, {}, { br: true }]), { size: 64, safe: SZ, centerY: 1340 }, measure);
    assert.deepStrictEqual(r.lines, [[0, 1], [2]]);
  });
  t('ocultar durante T2: intervalos, expresion y valor en el tiempo', function () {
    var m = ES.mergeIntervals([[5, 7], [1, 2], [6.5, 8], [9, 9]]);
    assert.deepStrictEqual(m, [[1, 2], [5, 8]]);
    assert.deepStrictEqual(ES.hideFor(m, 0, 1.5), [[1, 2]]);
    assert.deepStrictEqual(ES.hideFor(m, 2.5, 4.9), []);
    var ex = ES.hideExpr(m);
    assert(/var H = \[\[1,2\],\[5,8\]\]/.test(ex) && /value \* k;$/.test(ex));
    // la expresion es JavaScript valido y hace lo mismo que hideAt
    var f = new Function('time', 'value', ex.replace(/value \* k;$/, 'return value * k;'));
    [0.5, 1.5, 2.06, 4.95, 6, 8.2].forEach(function (tt) { assert(Math.abs(f(tt, 100) - 100 * ES.hideAt(m, tt)) < 1e-9, 't=' + tt); });
    assert.strictEqual(ES.hideAt(m, 1.5), 0); assert.strictEqual(ES.hideAt(m, 3), 1);
  });
  t('frases cortas: 2 palabras, nunca termina en palabra funcion, corta en pausas', function () {
    function G(list, o) { var t0 = 0; var it = list.map(function (x) { var e = { text: x, start: t0, end: t0 + 0.3 }; t0 += 0.32; return e; });
      return ES.groupShort(it, o).map(function (g) { return g.map(function (e) { return e.text; }).join(' '); }); }
    assert.deepStrictEqual(G(['o', 'simplemente', 'pregunta', 'por', 'qué']), ['o simplemente', 'pregunta', 'por qué']);
    assert.deepStrictEqual(G(['nunca', 'frenes,', 'solo', 'sigue']), ['nunca frenes,', 'solo sigue']);
    assert.deepStrictEqual(G(['camina', 'hacia', 'el', 'norte']), ['camina hacia', 'el norte']);
    assert.deepStrictEqual(G(['de', 'la', 'casa', 'grande']), ['de la casa', 'grande']);
    assert.deepStrictEqual(G(['extraordinariamente', 'complicado']), ['extraordinariamente', 'complicado'], 'tope de letras');
    assert.deepStrictEqual(G(['uno', 'dos', 'tres'], { maxWords: 1 }), ['uno', 'dos', 'tres']);
    assert.deepStrictEqual(G(['uno', 'dos', 'tres'], { maxWords: 3 }), ['uno dos tres']);
    var it = [{ text: 'hola', start: 0, end: 0.3 }, { text: 'mundo', start: 1.2, end: 1.5 }];
    assert.strictEqual(ES.groupShort(it, {}).length, 2, 'silencio largo');
    assert.strictEqual(ES.groupShort(it, {})[0][0], it[0], 'devuelve los mismos objetos');
  });
})();
console.log(pass + ' pruebas de motor OK');

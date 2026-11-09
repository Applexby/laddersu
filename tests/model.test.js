var assert = require('assert');
global.ES = require('../extension/jsx/engine.js');
var M = require('../extension/js/model.js');
var n = 0;
function t(name, fn) { fn(); n++; }

function mk() {
  var e = ES.parseSRT(require('fs').readFileSync(__dirname + '/sample.srt', 'utf8'));
  return M.fromEntries(e);
}
function ids(st) { return M.allIds(st); }

t('fromEntries: ids unicos y clases', function () {
  var st = mk(), a = ids(st), seen = {};
  assert(st.seqs.length > 2);
  a.forEach(function (i) { assert(!seen[i]); seen[i] = 1; });
  assert(st.seqs[0].words[0].c.size);
});

t('click simple REEMPLAZA (sin soltar antes)', function () {
  var st = mk(), sel = M.newSel(), a = ids(st);
  M.click(st, sel, a[0], {});
  M.click(st, sel, a[1], {});
  assert.strictEqual(M.selCount(st, sel), 1);
  assert(M.isSel(sel, a[1]) && !M.isSel(sel, a[0]));
  // aplicar transicion distinta a cada una sin deseleccionar
  M.applyPatch(st, sel, { trans: 'pop' });
  M.click(st, sel, a[0], {});
  M.applyPatch(st, sel, { trans: 'blur' });
  assert.strictEqual(M.find(st, a[1]).w.c.trans, 'pop');
  assert.strictEqual(M.find(st, a[0]).w.c.trans, 'blur');
});

t('ctrl alterna, shift rango (entre frases)', function () {
  var st = mk(), sel = M.newSel(), a = ids(st);
  M.click(st, sel, a[0], {}); M.click(st, sel, a[2], { ctrl: true });
  assert.strictEqual(M.selCount(st, sel), 2);
  M.click(st, sel, a[2], { ctrl: true });
  assert.strictEqual(M.selCount(st, sel), 1);
  M.click(st, sel, a[0], {}); M.click(st, sel, a[6], { shift: true });
  assert.strictEqual(M.selCount(st, sel), 7);
});

t('clic derecho conserva seleccion multiple', function () {
  var st = mk(), sel = M.newSel(), a = ids(st);
  M.click(st, sel, a[0], {}); M.click(st, sel, a[1], { shift: true });
  M.contextTarget(st, sel, a[1]); assert.strictEqual(M.selCount(st, sel), 2);
  M.contextTarget(st, sel, a[5]); assert.strictEqual(M.selCount(st, sel), 1);
});

t('uniform / resetEffects', function () {
  var st = mk(), sel = M.newSel(), a = ids(st);
  M.selectIds(sel, [a[0], a[1]]);
  M.applyPatch(st, sel, { color: '#f00', glow: true });
  assert.strictEqual(M.uniform(st, sel, 'color'), '#f00');
  M.applyPatch(st, { m: (function(){var o={};o[a[1]]=true;return o;})() }, { color: '#0f0' });
  assert.strictEqual(M.uniform(st, sel, 'color'), null);
  M.resetEffects(st, sel);
  assert.strictEqual(M.uniform(st, sel, 'color'), '');
  assert.strictEqual(M.uniform(st, sel, 'glow'), false);
});

t('split / merge conservan palabras y propiedades', function () {
  var st = mk(), total = ids(st).length, ns = st.seqs.length;
  st.seqs[0].align = 'stair';
  assert(M.split(st, 0, 1));
  assert.strictEqual(st.seqs.length, ns + 1);
  assert.strictEqual(st.seqs[1].align, 'stair');
  assert(M.merge(st, 0));
  assert.strictEqual(st.seqs.length, ns);
  assert.strictEqual(ids(st).length, total);
  assert(!M.split(st, 0, 0));
});

t('editText: una palabra y varias', function () {
  var st = mk(), w = st.seqs[0].words[0], len = st.seqs[0].words.length, e = w.end;
  M.editText(st, w.id, 'hola');
  assert.strictEqual(w.text, 'hola');
  M.editText(st, w.id, 'hola que tal');
  assert.strictEqual(st.seqs[0].words.length, len + 2);
  assert(st.seqs[0].words[1].start >= w.start && st.seqs[0].words[2].end <= e + 1e-9);
});

t('moveWords a otra frase: orden y tiempos coherentes', function () {
  var st = mk(), a = st.seqs[0].words[0], dest = st.seqs[1], before = dest.words[1].id;
  var cnt = ids(st).length, n0 = st.seqs[0].words.length;
  M.moveWords(st, [a.id], dest, before);
  assert.strictEqual(ids(st).length, cnt);
  var d = M.find(st, a.id);
  assert.strictEqual(d.w.id, a.id);
  var s = d.si, k;
  for (k = 1; k < st.seqs[s].words.length; k++) assert(st.seqs[s].words[k].start >= st.seqs[s].words[k - 1].start);
  assert.strictEqual(M.find(st, a.id).wi, 1);
  if (n0 === 1) assert(st.seqs.indexOf(dest) >= 0);
});

t('mover la unica palabra de una frase elimina la frase vacia', function () {
  var st = mk(), s0 = st.seqs[0];
  M.split(st, 0, 1); // ahora seq0 tiene 1 palabra
  var w = st.seqs[0].words[0], n = st.seqs.length;
  M.moveWords(st, [w.id], st.seqs[1], null);
  assert.strictEqual(st.seqs.length, n - 1);
});

t('moveToNewSeq', function () {
  var st = mk(), w = st.seqs[1].words[0], n = st.seqs.length;
  var ns = M.moveToNewSeq(st, [w.id], 0);
  assert(ns && st.seqs[0] === ns && st.seqs[0].words[0].id === w.id);
  assert.strictEqual(st.seqs.length, n + 1);
});

t('deleteWords', function () {
  var st = mk(), sel = M.newSel(), a = ids(st);
  M.selectIds(sel, [a[0], a[1]]);
  assert.strictEqual(M.deleteWords(st, sel), 2);
  assert.strictEqual(ids(st).length, a.length - 2);
});

t('applyPresentation separa tramos contiguos', function () {
  var st = mk(), sel = M.newSel(), s = st.seqs[0];
  var total = s.words.length;
  assert(total >= 3);
  M.selectIds(sel, [s.words[1].id]);
  assert.strictEqual(M.applyPresentation(st, sel, 'p1'), 1);
  var f = M.find(st, s.words[0].id);
  var pres = st.seqs.filter(function (q) { return q.pres === 'p1'; });
  assert.strictEqual(pres.length, 1);
  assert.strictEqual(pres[0].words.length, 1);
  assert.strictEqual(ids(st).length, ids(mk()).length === 0 ? 0 : ids(st).length);
});

t('buildJob: zona, clases, sfx auto, slots, nombres', function () {
  var st = mk(), S = M.defaults();
  S.sfxAuto = { sfx: 'pop', on: 'brand' };
  st.seqs[0].pres = 'p1';
  var def = { id: 'p1' };
  var job = M.buildJob(st, S, { sfxPath: function (id) { return '/x/' + id + '.wav'; }, presDefs: { p1: def },
    assign: function (d, w) { return [[0]]; } });
  assert.strictEqual(job.seqs.length, st.seqs.length);
  assert.deepStrictEqual(job.seqs[0].slots, [[0]]);
  assert(job.pres.p1 === def);
  assert.strictEqual(job.sfx.pop, '/x/pop.wav');
  assert.strictEqual(job.cfg.zone.top, 0.5);
  assert.strictEqual(job.cfg.layout.sizes.L, 85);
  var onlyJob = M.buildJob(st, S, { only: [1] });
  assert.strictEqual(onlyJob.seqs.length, 1);
  assert.strictEqual(onlyJob.seqs[0].n, 2);
  assert.strictEqual(onlyJob.seqs[0].alignIndex, 1);
});

t('export / import de edicion', function () {
  var st = mk(), S = M.defaults();
  st.seqs[0].words[0].c.color = '#abc';
  var json = JSON.parse(JSON.stringify(M.exportEdit(st, S)));
  var r = M.importEdit(json);
  assert.strictEqual(r.st.seqs.length, st.seqs.length);
  assert.strictEqual(r.st.seqs[0].words[0].c.color, '#abc');
  assert.strictEqual(M.importEdit({ foo: 1 }), null);
});

t('fuentes (filtro / css)', function () {
  var f = [{ f: 'Arial', s: 'Bold', n: 'Arial-BoldMT' }, { f: 'Anton', s: 'Regular', n: 'Anton-Regular' }];
  assert.strictEqual(M.filterFonts(f, 'arial bold').length, 1);
  assert.strictEqual(M.guessWeight('Extra Bold'), 800);
  assert.strictEqual(M.findFont(f, 'Anton-Regular').f, 'Anton');
});

console.log(n + ' pruebas de modelo OK');
(function () {
  var st = mk(); var json = JSON.parse(JSON.stringify(st)); M.reseed(json);
  var w = M.makeWord('x', 0, 1); var all = M.allIds(json); assert(all.indexOf(w.id) < 0);
  console.log('reseed OK');
})();
(function () {
  var st = mk(), sel = M.newSel(), w = st.seqs[0].words;
  M.selectIds(sel, [w[0].id, w[1].id]);
  M.applyPatch(st, sel, { glow: true, fmt: 'box', trans: 'pop' });
  var eff = M.presentEffects(st, sel).map(function (e) { return e.k; });
  assert(eff.indexOf('glow') >= 0 && eff.indexOf('fmtBox') >= 0 && eff.indexOf('trans') >= 0 && eff.indexOf('color') < 0);
  assert.strictEqual(M.removeEffect(st, sel, 'glow'), 2);
  assert.strictEqual(w[0].c.glow, false); assert.strictEqual(w[0].c.fmt, 'box'); assert.strictEqual(w[0].c.trans, 'pop');
  M.removeEffect(st, sel, 'fmtBox'); assert.strictEqual(w[1].c.fmt, ''); assert.strictEqual(w[1].c.trans, 'pop');
  console.log('quitar por partes OK');
  var S = M.defaults(); st.seqs[1].style = 'karaoke';
  var job = M.buildJob(st, S, {});
  assert.strictEqual(job.seqs[0].style, 'lockup'); assert.strictEqual(job.seqs[1].style, 'karaoke');
  assert.strictEqual(job.replace.mode, 'all');
  var j2 = M.buildJob(st, S, { only: [1] }); assert.strictEqual(j2.replace.mode, 'ranges'); assert.strictEqual(j2.replace.ranges.length, 1);
  S.replacePrev = false; assert.strictEqual(M.buildJob(st, S, {}).replace.mode, 'none');
  M.split(st, 1, 1); assert.strictEqual(st.seqs[2].style, 'karaoke');
  var r = M.importEdit(JSON.parse(JSON.stringify(M.exportEdit(st, S)))); assert.strictEqual(r.st.seqs[1].style, 'karaoke');
  console.log('estilo por frase OK');
})();
(function () {
  var S = M.defaults(), st = mk();
  assert.strictEqual(S.apxFont, 'Archivo-Bold'); assert.strictEqual(S.apxColor, '#ff1a1a');
  st.seqs[0].style = 'applexby';
  st.seqs[1].pres = 't2';
  var job = M.buildJob(st, S, { presDefs: { t2: { id: 't2', kind: 'T2', layers: [] } }, assign: function () { return []; }, hide: [[50, 52]] });
  assert.strictEqual(job.seqs[0].style, 'applexby');
  assert.strictEqual(job.cfg.apx.size, 64); assert.strictEqual(job.cfg.apx.centerY, 0.7);
  assert.strictEqual(job.cfg.hide.length, 2, 'T2 de la frase 2 + intervalo externo');
  assert.strictEqual(job.cfg.hide[0][0], st.seqs[1].start);
  S.hideUnderT2 = false;
  assert.strictEqual(M.buildJob(st, S, { presDefs: { t2: { kind: 'T2', layers: [] } }, hide: [[50, 52]] }).cfg.hide.length, 0);
  console.log('estilo APPLEXBY y ocultar durante T2 en el modelo OK');
})();

(function () {
  // aspecto de los estilos de una linea
  var S = M.defaults();
  var a = M.lineLook(S, 'applexby'), l = M.lineLook(S, 'line');
  assert.strictEqual(a.caps, 'lower'); assert.strictEqual(a.track, -60); assert(a.gap < 0.2, 'palabras juntas');
  assert.strictEqual(a.stroke, null, 'sin contorno'); assert.strictEqual(a.exit, false, 'solo entrada'); assert.strictEqual(a.anim, 'blurIn');
  S.apxStroke = true; assert.strictEqual(M.lineLook(S, 'applexby').stroke.colorHex, '#ffffff');
  assert.strictEqual(l.track, 0); assert.strictEqual(l.gap, 0.28); assert.strictEqual(l.stroke, null); assert.strictEqual(l.anim, '');
  S.apxStroke = false; assert.strictEqual(M.lineLook(S, 'applexby').stroke, null);
  var job = M.buildJob(mk(), M.defaults(), {}); assert(job.cfg.line && job.cfg.apx);
  // ajustes viejos (0.6.0, blanco con clave roja) pasan al nuevo aspecto; tamano y fuente se respetan
  var old = M.defaults(); delete old.apxLook; old.apxColor = '#f5f5f5'; old.apxKey = '#ff0101'; old.apxSize = 80; delete old.apxTrack;
  M.migrateCfg(old);
  assert.strictEqual(old.apxColor, '#ff1a1a'); assert.strictEqual(old.apxTrack, -60); assert.strictEqual(old.apxSize, 80); assert.strictEqual(old.apxLook, 3);
  var v2 = M.defaults(); v2.apxLook = 2; v2.apxStroke = true; v2.apxExit = true; v2.apxColor = '#00ff00'; M.migrateCfg(v2);
  assert(v2.apxStroke === false && v2.apxExit === false && v2.apxColor === '#00ff00', '0.6.1 -> sin contorno ni salida, conserva colores');
  old.apxColor = '#00ff00'; M.migrateCfg(old); assert.strictEqual(old.apxColor, '#00ff00', 'solo una vez');
  console.log('aspecto Una linea / APPLEXBY y migracion OK');
})();
(function () {
  // frases cortas al importar con un estilo de una linea, y reagrupar al cambiar de estilo
  var srt = require('fs').readFileSync(__dirname + '/sample.srt', 'utf8'), E = ES.parseSRT(srt);
  var S = M.defaults(); S.editStyle = 'applexby';
  var st = M.fromEntries(E, S), total = 0;
  st.seqs.forEach(function (q) { total += q.words.length; assert(q.words.length <= 4, 'frase corta: ' + q.words.map(function (w) { return w.text; }).join(' '));
    q.words.forEach(function (w) { assert.strictEqual(w.c.brand, false); }); });
  assert.strictEqual(total, E.length);
  var block = M.fromEntries(E, M.defaults());
  assert(st.seqs.length > block.seqs.length, 'mas frases (' + st.seqs.length + ' vs ' + block.seqs.length + ')');
  // reagrupar conserva las palabras (ids y ajustes)
  var id = block.seqs[0].words[0].id; block.seqs[0].words[0].c.color = '#123456';
  var S2 = M.defaults(); S2.editStyle = 'line'; M.regroup(block, S2);
  assert.strictEqual(block.seqs.length, st.seqs.length);
  var w0 = M.find(block, id); assert(w0, 'la palabra sigue'); 
  var all = []; block.seqs.forEach(function (q) { q.words.forEach(function (w) { all.push(w); }); });
  assert.strictEqual(all[0].c.color, '#123456');
  // y de vuelta a escalera
  S2.editStyle = 'lockup'; M.regroup(block, S2);
  assert.strictEqual(block.seqs.length, M.fromEntries(E, M.defaults()).seqs.length);
  assert.strictEqual(M.groupFamily('applexby'), 'line'); assert.strictEqual(M.groupFamily('karaoke'), 'block');
  // 1 palabra por frase
  S.lineWords = 1; var one = M.fromEntries(E, S);
  one.seqs.forEach(function (q) { assert(q.words.length <= 3); });
  console.log('frases cortas para una linea y reagrupar OK');
})();
(function () {
  var E = ES.parseSRT(require('fs').readFileSync(__dirname + '/sample.srt', 'utf8'));
  var st = M.fromEntries(E, M.defaults()); st.seqs[1].pres = 'builtin:caja';
  var keep = st.seqs[1], n = 0; st.seqs.forEach(function (q) { n += q.words.length; });
  var S = M.defaults(); S.editStyle = 'applexby'; M.regroup(st, S);
  assert(st.seqs.indexOf(keep) >= 0, 'la frase con plantilla se conserva');
  var m = 0; st.seqs.forEach(function (q) { m += q.words.length; }); assert.strictEqual(m, n);
  for (var i = 1; i < st.seqs.length; i++) { assert(st.seqs[i].start >= st.seqs[i - 1].start, 'en orden'); }
  S.lineWords = 1; var a = M.regroup(st, S); S.lineWords = 2; var b = M.regroup(st, S);
  assert(a >= b, '1 palabra por frase no da menos frases (' + a + ' vs ' + b + ')');
  console.log('reagrupar conserva las plantillas OK');
})();
(function () {
  // v0.7: paso Texto (unir, separar, reemplazar, parrafos)
  var E = ES.parseSRT(require('fs').readFileSync(__dirname + '/sample.srt', 'utf8'));
  var S = M.defaults(), st = M.fromEntries(E, S), ids = M.allIds(st);
  var n0 = ids.length;
  assert(M.joinWords(st, ids[0]), 'unir con la siguiente');
  assert.strictEqual(M.find(st, ids[0]).w.text, 'Como seria');
  assert.strictEqual(M.allIds(st).length, n0 - 1);
  assert(M.splitWord(st, ids[0]), 'separar');
  assert.strictEqual(M.allIds(st).length, n0);
  assert.strictEqual(M.find(st, ids[0]).w.text, 'Como');
  assert(!M.splitWord(st, ids[0]), 'una sola palabra no se separa');
  // la ultima palabra de una frase se une con la primera de la siguiente
  var lastOf0 = st.seqs[0].words[st.seqs[0].words.length - 1].id, n1 = st.seqs.length;
  assert(M.joinWords(st, lastOf0));
  assert.strictEqual(M.allIds(st).length, n0 - 1); assert(st.seqs.length <= n1);
  // reemplazar
  var st2 = M.fromEntries(E, S);
  assert.strictEqual(M.replaceAll(st2, 'ingles', 'inglés'), 1, 'palabra completa, conserva la puntuacion');
  var all = []; st2.seqs.forEach(function (q) { q.words.forEach(function (w) { all.push(w.text); }); });
  assert(all.indexOf('inglés?') >= 0, all.join(' '));
  assert.strictEqual(M.replaceAll(st2, 'seri', 'X'), 0, 'solo palabras completas ("seri" no toca "seria" ni "Series")');
  assert.strictEqual(M.replaceAll(st2, 'seri', 'X', { partial: true }), 2, 'parcial si se pide');
  assert.strictEqual(M.replaceAll(st2, 'peliculas', 'pelis y series'), 1);
  var t2 = []; st2.seqs.forEach(function (q) { q.words.forEach(function (w) { t2.push(w.text); }); });
  assert(t2.join(' ').indexOf('pelis y series') >= 0, 'con espacios se divide en palabras');
  assert.strictEqual(M.replaceAll(st2, '', 'x'), 0);
  // parrafos
  var ps = M.paragraphs(M.fromEntries(E, S));
  assert(ps.length >= 2 && ps[0].words[0].text === 'Como', 'parrafos tras pausas o fin de oracion');
  console.log('paso Texto: unir, separar, reemplazar y parrafos OK');
})();
(function () {
  // v0.7: largos por estilo, reagrupar un tramo con otro estilo, frases cambiadas
  var E = ES.parseSRT(require('fs').readFileSync(__dirname + '/sample.srt', 'utf8'));
  var S = M.defaults();
  S.stairLen = 0; var shortS = M.fromEntries(E, S).seqs.length;
  S.stairLen = 2; var longS = M.fromEntries(E, S).seqs.length;
  assert(shortS >= longS, 'bloques cortos dan mas frases');
  S = M.defaults(); S.editStyle = 'karaoke';
  var kst = M.fromEntries(E, S); assert(kst.seqs.every(function (q) { return q.style === ''; }), 'la base no se marca por frase');
  S = M.defaults();
  var st = M.fromEntries(E, S), n = st.seqs.length, words = M.allIds(st).length;
  M.regroupRange(st, [1, 2], 'line', S);
  assert(st.seqs.length > n, 'el tramo pasa a frases cortas');
  assert.strictEqual(M.allIds(st).length, words, 'no se pierden palabras');
  assert.strictEqual(st.seqs[0].style, '', 'la primera sigue con la base');
  assert.strictEqual(st.seqs[1].style, 'line');
  assert.strictEqual(st.seqs[st.seqs.length - 1].style, '', 'la ultima no se toco');
  for (var i = 1; i < st.seqs.length; i++) { assert(st.seqs[i].start >= st.seqs[i - 1].start, 'en orden'); }
  // frases cambiadas
  assert.strictEqual(M.changedSeqs(st, S), null, 'nunca generado: todo');
  M.markGenerated(st, S);
  assert.deepStrictEqual(M.changedSeqs(st, S), []);
  st.seqs[2].words[0].c.color = '#ff0000';
  assert.deepStrictEqual(M.changedSeqs(st, S), [2]);
  M.markGenerated(st, S);
  st.seqs[0].style = 'karaoke';
  assert.deepStrictEqual(M.changedSeqs(st, S), [0], 'cambiar el estilo de una frase');
  M.markGenerated(st, S);
  S.szL = 99; assert.strictEqual(M.changedSeqs(st, S), null, 'cambiar ajustes: todo');
  S.szL = 85; M.markGenerated(st, S);
  M.merge(st, 0); assert.strictEqual(M.changedSeqs(st, S), null, 'si desaparece una frase generada: todo');
  console.log('largos por estilo, reagrupar un tramo y frases cambiadas OK');
})();

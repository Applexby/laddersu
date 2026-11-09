// Panel (modelo) -> host.jsx en After Effects simulado: SRT real de punta a punta
var assert = require('assert'), fs = require('fs');
global.ES = require('../extension/jsx/engine.js');
var M = require('../extension/js/model.js'), P = require('../extension/js/presentations.js'), F = require('./fakeae.js');
var n = 0; function t(nm, f) { f(); n++; }

function setup() {
  var h = F.load();
  var comp = h.A.newComp(1080, 1920, 60, 30); comp.name = 'Reel';
  h.A.app.project.activeItem = comp; h.A.items.push(comp);
  return { h: h, comp: comp };
}
function jobFor(st, S, o) { return JSON.stringify(M.buildJob(st, S, o)); }
function run(h, job) { var r = JSON.parse(h.call('ES_apply', job)); assert(r.ok, r.msg); return r; }
function textLayers(c) { return c.layerList.filter(function (l) { return l.kind === 'text'; }); }
function pos(l) { return l.property('ADBE Transform Group').property('ADBE Position').value; }

t('capas con el texto de la palabra (no ES s1 w1) y dentro de la zona segura', function () {
  var s = setup(), S = M.defaults(), st = M.fromEntries(ES.parseSRT(fs.readFileSync(__dirname + '/sample.srt', 'utf8')), S);
  var words = M.allIds(st).length;
  var r = run(s.h, jobFor(st, S, {}));
  var tl = textLayers(s.comp);
  assert.strictEqual(tl.length, words);
  tl.forEach(function (l) { assert(!/^ES s\d/.test(l.name)); assert.strictEqual(l.name, l.td.text); });
  assert(tl.some(function (l) { return l.name === l.name.toUpperCase() && /[A-Z]/.test(l.name); }));  // mayusculas globales
  var z = { x0: 1080 * 0.16, x1: 1080 * 0.84, y0: 1920 * 0.5, y1: 1920 * 0.74 };
  tl.forEach(function (l) { var p = pos(l); assert(p[0] > z.x0 - 40 && p[0] < z.x1 + 40, 'x ' + p[0]); assert(p[1] > z.y0 - 20 && p[1] < z.y1 + 20, 'y ' + p[1] + ' ' + l.name); });
  assert(/capas/.test(r.msg));
});

t('tiempos: todas las palabras de la frase terminan juntas; entrada = inicio de la palabra', function () {
  var s = setup(), S = M.defaults(), st = M.fromEntries(ES.parseSRT(fs.readFileSync(__dirname + '/sample.srt', 'utf8')), S);
  run(s.h, jobFor(st, S, { only: [0] }));
  var tl = textLayers(s.comp).reverse(), seq = st.seqs[0];
  tl.forEach(function (l, i) { assert(Math.abs(l.inPoint - seq.words[i].start) < 1e-6); assert(Math.abs(l.outPoint - tl[0].outPoint) < 1e-6); });
});

t('formato caja / subrayado / brillo / sonido por palabra', function () {
  var s = setup(), S = M.defaults(), st = M.fromEntries(ES.parseSRT(fs.readFileSync(__dirname + '/sample.srt', 'utf8')), S);
  var sel = M.newSel(), w = st.seqs[0].words;
  M.selectIds(sel, [w[0].id]); M.applyPatch(st, sel, { fmt: 'box', boxColor: '#00ff00', glow: true, glowColor: '#ff00ff', sfx: 'pop', trans: 'pop' });
  M.selectIds(sel, [w[1].id]); M.applyPatch(st, sel, { fmt: 'underline', trans: 'blur' });
  var r = run(s.h, jobFor(st, S, { only: [0], sfxPath: function (id) { return '/sfx/' + id + '.wav'; } }));
  var names = s.comp.layerList.map(function (l) { return l.name; });
  assert(names.some(function (x) { return / · caja$/.test(x); }));
  assert(names.some(function (x) { return / · subrayado$/.test(x); }));
  assert(names.some(function (x) { return /^sfx · /.test(x); }));
  var t0 = textLayers(s.comp).filter(function (l) { return l.td.text.toLowerCase() === w[0].text.toLowerCase(); })[0];
  var glow = t0.property('ADBE Effect Parade').property('ADBE Drop Shadow');
  assert(glow && glow.property('ADBE Drop Shadow-0004').value === 0);
  assert.strictEqual(JSON.stringify(glow.property('ADBE Drop Shadow-0001').value.slice(0, 3)), '[1,0,1]');
  assert(t0.property('ADBE Transform Group').property('ADBE Scale').numKeys >= 3);   // pop
});

t('guia de margenes seguros opcional', function () {
  var s = setup(), S = M.defaults(); S.guide = true;
  var st = M.fromEntries(ES.parseSRT(fs.readFileSync(__dirname + '/sample.srt', 'utf8')), S);
  run(s.h, jobFor(st, S, { only: [0] }));
  assert(s.comp.layerList.some(function (l) { return l.guideLayer && /seguros/.test(l.name); }));
});

t('presentacion incluida aplicada a palabras elegidas', function () {
  var s = setup(), S = M.defaults(), store = P.createStore({}); store.load();
  var st = M.fromEntries(ES.parseSRT(fs.readFileSync(__dirname + '/sample.srt', 'utf8')), S);
  var sel = M.newSel(), sq = st.seqs[1];
  M.selectIds(sel, [sq.words[0].id, sq.words[1].id]);
  assert.strictEqual(M.applyPresentation(st, sel, 'builtin:caja'), 1);
  var r = run(s.h, jobFor(st, S, { presDefs: store.defs(), assign: P.assignSlots }));
  var shapes = s.comp.layerList.filter(function (l) { return l.kind === 'shape'; });
  assert.strictEqual(shapes.length, 1);
  var rect = shapes[0].property('ADBE Root Vectors Group').property(1).property('ADBE Vectors Group');
  assert(rect.property('ADBE Vector Shape - Rect') && rect.property('ADBE Vector Graphic - Fill'));
  var fc = rect.property('ADBE Vector Graphic - Fill').property('ADBE Vector Fill Color').value; assert(fc[0] === 1 && Math.abs(fc[1] - P.rgbOf('#ffd400')[1]) < 1e-4);
  assert(shapes[0].property('ADBE Transform Group').property('ADBE Scale').numKeys === 3);
  var want = (sq.words[0].text + ' ' + sq.words[1].text).toUpperCase();
  var pres = textLayers(s.comp).filter(function (l) { return l.td.text === want; });
  assert.strictEqual(pres.length, 1);
  assert(pres[0].property('ADBE Transform Group').property('ADBE Opacity').numKeys === 2);
});

t('captura de capas seleccionadas y reconstruccion (ida y vuelta)', function () {
  var s = setup(), S = M.defaults(), store = P.createStore({}); store.load();
  var st = M.fromEntries(ES.parseSRT(fs.readFileSync(__dirname + '/sample.srt', 'utf8')), S);
  var sel = M.newSel(); M.selectIds(sel, [st.seqs[1].words[0].id]);
  M.applyPresentation(st, sel, 'builtin:neon');
  run(s.h, jobFor(st, S, { only: [1], presDefs: store.defs(), assign: P.assignSlots }));
  // el usuario selecciona lo creado y lo guarda
  s.comp.selectedLayers = s.comp.layerList.slice();
  var info = JSON.parse(s.h.call('ES_selInfo')); assert(info.text >= 1);
  var cap = JSON.parse(s.h.call('ES_capture'));
  assert(cap.ok, cap.msg);
  assert.strictEqual(P.validate(cap.def), '');
  var def = store.add({ name: 'Capturada', comp: cap.def.comp, upper: true, layers: cap.def.layers });
  assert(def.layers.some(function (l) { return l.fx.length; }));           // brillo capturado
  // proyecto distinto: otra composicion de distinto tamano
  var s2 = setup(); s2.comp.width = 720; s2.comp.height = 1280;
  var st2 = M.fromEntries(ES.parseSRT(fs.readFileSync(__dirname + '/sample.srt', 'utf8')), S);
  var sel2 = M.newSel(); M.selectIds(sel2, [st2.seqs[0].words[0].id]);
  M.applyPresentation(st2, sel2, def.id);
  run(s2.h, jobFor(st2, S, { only: [0], presDefs: store.defs(), assign: P.assignSlots }));
  var t2 = textLayers(s2.comp)[0];
  assert(t2.property('ADBE Effect Parade').property('ADBE Drop Shadow'));
  assert(Math.abs(t2.td.fontSize - def.layers.filter(function (l) { return l.k === 'text'; })[0].doc.size * 720 / 1080) < 0.01);  // escalado al nuevo tamano
});

t('error claro si falta composicion', function () {
  var h = F.load(); h.A.app.project.activeItem = null;
  var S = M.defaults(), st = M.fromEntries(ES.parseSRT(fs.readFileSync(__dirname + '/sample.srt', 'utf8')), S);
  var r = JSON.parse(h.call('ES_apply', jobFor(st, S, {})));
  assert(!r.ok && /composicion/i.test(r.msg));
});

console.log(n + ' pruebas de punta a punta OK');
(function () {
  // AE con un motor viejo cargado (v0.2) -> el host debe reemplazarlo
  var h = F.load({ noEngine: true });
  h.ctx.ES = { VERSION: '0.2.0' };
  var vm = require('vm');
  vm.runInContext('ES_loadEngine()', h.ctx);
  var st = JSON.parse(h.call('ES_status'));
  assert.strictEqual(st.ev, ES.VERSION);
  assert(vm.runInContext('typeof ES.displayText', h.ctx) === 'function');
  console.log('motor viejo reemplazado OK');
})();

// ---------- v0.5: generacion por pasos, detener, reemplazar, karaoke, biblioteca ----------
(function () {
  var S0 = M.defaults();
  function fresh() { return M.fromEntries(ES.parseSRT(fs.readFileSync(__dirname + '/sample.srt', 'utf8')), S0); }
  function head(job) { var last = job.seqs[job.seqs.length - 1]; return { cfg: job.cfg, sfx: job.sfx, pres: job.pres, replace: job.replace, need: last.end + 2 }; }
  function J(h, fn, arg) { return JSON.parse(h.call(fn, arg)); }

  t('pasos: begin/step/end crean lo mismo que de una vez y marcan cada capa', function () {
    var s = setup(), st = fresh(), job = M.buildJob(st, S0, {});
    var b = J(s.h, 'ES_begin', JSON.stringify(head(job)));
    assert(b.ok, b.msg);
    job.seqs.forEach(function (q) { var r = J(s.h, 'ES_step', JSON.stringify([q])); assert(r.ok, r.msg); });
    var e = J(s.h, 'ES_end'); assert(e.ok && /Listo/.test(e.msg));
    var tl = textLayers(s.comp);
    assert.strictEqual(tl.length, M.allIds(st).length);
    s.comp.layerList.forEach(function (L) { assert(L.comment.indexOf('Laddersu|' + b.run + '|') === 0, 'capa sin marca: ' + L.name); });
  });

  t('regenerar reemplaza lo generado antes (no duplica) y respeta capas del usuario', function () {
    var s = setup(), st = fresh(), job = M.buildJob(st, S0, {});
    var mine = s.comp.layers.addText('MI CAPA'); mine.name = 'MI CAPA';
    run(s.h, JSON.stringify(job));
    var n1 = s.comp.layerList.length;
    run(s.h, JSON.stringify(M.buildJob(st, S0, {})));
    assert.strictEqual(s.comp.layerList.length, n1);
    assert(s.comp.layerList.indexOf(mine) >= 0);
    // regenerar solo una frase reemplaza solo esa frase
    var only = M.buildJob(st, S0, { only: [1] });
    run(s.h, JSON.stringify(only));
    assert.strictEqual(s.comp.layerList.length, n1);
  });

  t('detener y quitar lo creado en esa tanda', function () {
    var s = setup(), st = fresh(), job = M.buildJob(st, S0, {});
    S0.replacePrev = true;
    var b = J(s.h, 'ES_begin', JSON.stringify(head(job)));
    J(s.h, 'ES_step', JSON.stringify([job.seqs[0]])); J(s.h, 'ES_step', JSON.stringify([job.seqs[1]]));
    assert(s.comp.layerList.length > 0);
    var r = J(s.h, 'ES_stop', b.run); // firma (runId, remove)
    void r;
    var r2 = JSON.parse(s.h.ctx.ES_stop ? require('vm').runInContext('ES_stop(' + JSON.stringify(b.run) + ', true)', s.h.ctx) : '{}');
    assert.strictEqual(s.comp.layerList.length, 0);
    assert(r2.removed > 0);
  });

  t('estilo Caja que recorre: frase completa + una sola caja animada detras', function () {
    var s = setup(), st = fresh(); st.seqs[0].style = 'karaoke';
    run(s.h, JSON.stringify(M.buildJob(st, S0, { only: [0] })));
    var shapes = s.comp.layerList.filter(function (l) { return l.kind === 'shape'; });
    assert.strictEqual(shapes.length, 1);
    var box = shapes[0], words = st.seqs[0].words;
    assert(/caja/.test(box.name));
    // la caja queda debajo de todas las palabras
    assert.strictEqual(s.comp.layerList.indexOf(box), s.comp.layerList.length - 1);
    var pos = box.property('ADBE Transform Group').property('ADBE Position');
    assert.strictEqual(pos.numKeys, 1 + 2 * (words.length - 1));
    var tl = textLayers(s.comp);
    assert.strictEqual(tl.length, words.length);
    tl.forEach(function (l) { assert(Math.abs(l.inPoint - st.seqs[0].start) < 1e-6, 'todas visibles desde el inicio'); });
    // tinta oscura mientras la caja esta debajo (texto blanco sobre caja amarilla)
    assert(tl.some(function (l) { return l.docProp.numKeys >= 1; }));
  });

  t('biblioteca: guardar la composicion activa con sus archivos y abrirla en otro proyecto', function () {
    var s = setup(), A = s.h.A, File = s.h.File;
    s.comp.name = 'Promo 2';
    // proyecto guardado con un archivo de imagen usado en la comp
    var img = s.h.tmp + '/logo.png'; fs.writeFileSync(img, 'PNG');
    var foot = A.app.project.importFile({ file: new File(img) }); foot.file = new File(img); foot.replace = function (f) { this.file = f; };
    s.comp.layers.add(foot); s.comp.layers.addText('HOLA');
    var other = A.app.project.items.addComp('Otra cosa', 100, 100, 1, 5, 30); A.app.project.activeItem = s.comp;
    var proj = new File(s.h.tmp + '/mi_proyecto.aep');
    var st0 = JSON.parse(s.h.call('ES_libState'));
    assert.strictEqual(st0.saved, false);
    var r0 = JSON.parse(s.h.call('ES_libSave', JSON.stringify({ name: 'Promo 2', mode: 'comp' })));
    assert(!r0.ok && r0.code === 'unsaved');
    A.app.project.save(proj);
    var r = JSON.parse(s.h.call('ES_libSave', JSON.stringify({ name: 'Promo 2', mode: 'comp' })));
    assert(r.ok, r.msg);
    assert.strictEqual(r.files, 1, 'la imagen se copia dentro del elemento');
    // volvio al proyecto original, intacto
    assert.strictEqual(A.app.project.file.path, proj.path);
    assert(A.items.indexOf(other) >= 0, 'el proyecto original no se reduce');
    var dir = s.h.tmp + '/Laddersu/biblioteca/' + r.id;
    assert(fs.existsSync(dir + '/elemento.aep') && fs.existsSync(dir + '/meta.json') && fs.existsSync(dir + '/thumb.png') && fs.existsSync(dir + '/archivos/logo.png'));
    var saved = JSON.parse(fs.readFileSync(dir + '/elemento.aep', 'utf8'));
    assert.strictEqual(saved.comps.length, 1, 'el elemento solo lleva la composicion y lo que usa');
    var list = JSON.parse(s.h.call('ES_libList'));
    assert(list.ok && list.items.length === 1 && list.items[0].name === 'Promo 2' && list.items[0].w === 1080);

    // "otro proyecto": insertar en la comp activa en el tiempo actual
    var s2 = setup(); s2.h.ctx.Folder.userData = new s2.h.ctx.Folder(s.h.tmp);
    s2.comp.time = 3.5;
    var ins = JSON.parse(s2.h.call('ES_libInsert', JSON.stringify({ id: r.id, mode: 'insert' })));
    assert(ins.ok, ins.msg);
    var pre = s2.comp.layerList[0];
    assert.strictEqual(pre.source.name, 'Promo 2'); assert.strictEqual(pre.startTime, 3.5);
    var op = JSON.parse(s2.h.call('ES_libInsert', JSON.stringify({ id: r.id, mode: 'open' })));
    assert(op.ok && s2.h.A.viewer && s2.h.A.viewer.name === 'Promo 2');
    // renombrar y borrar
    assert(JSON.parse(s.h.call('ES_libRename', JSON.stringify({ id: r.id, name: 'Promo final' }))).ok);
    assert.strictEqual(JSON.parse(s.h.call('ES_libList')).items[0].name, 'Promo final');
    assert(JSON.parse(s.h.call('ES_libDelete', r.id)).ok);
    assert.strictEqual(JSON.parse(s.h.call('ES_libList')).items.length, 0);
  });

  t('biblioteca: guardar capas seleccionadas las precompone primero', function () {
    var s = setup(), A = s.h.A, File = s.h.File;
    var a = s.comp.layers.addText('A'), b = s.comp.layers.addText('B'), c = s.comp.layers.addText('C');
    s.comp.selectedLayers = [a, b];
    A.app.project.save(new File(s.h.tmp + '/p.aep'));
    var r = JSON.parse(s.h.call('ES_libSave', JSON.stringify({ name: 'Titulo animado', mode: 'selection' })));
    assert(r.ok, r.msg);
    var pc = A.items.filter(function (x) { return x.name === 'Titulo animado'; })[0];
    assert(pc && pc.layerList.length === 2, 'precomp con las 2 capas');
    assert(s.comp.layerList.indexOf(c) >= 0 && s.comp.layerList.length === 2, 'en la comp queda la precomp + la otra capa');
  });
  console.log('pruebas v0.5 de punta a punta OK');
})();

// ---------- v0.6: estilo APPLEXBY y ocultar durante T2 ----------
(function () {
  var S0 = M.defaults();
  function fresh() { return M.fromEntries(ES.parseSRT(fs.readFileSync(__dirname + '/sample.srt', 'utf8')), S0); }
  t('APPLEXBY: una linea centrada en el tercio inferior, palabra por palabra con desenfoque, salida invertida', function () {
    var s = setup(), st = fresh(); st.seqs[0].style = 'applexby';
    st.seqs[0].words[1].c.brand = true;
    run(s.h, JSON.stringify(M.buildJob(st, S0, { only: [0] })));
    var tl = textLayers(s.comp), words = st.seqs[0].words;
    assert.strictEqual(tl.length, words.length);
    var ys = tl.map(function (l) { return Math.round(pos(l)[1]); });
    var uniq = ys.filter(function (y, i) { return ys.indexOf(y) === i; });
    assert(uniq.length <= 2, 'una o dos lineas');
    tl.forEach(function (l) { assert(pos(l)[1] > 1920 * 0.6 && pos(l)[1] < 1920 * 0.76, 'tercio inferior: ' + pos(l)[1]); });
    var byText = {}; tl.forEach(function (l) { byText[l.td.text] = l; });
    words.forEach(function (w) { var l = byText[w.text]; assert(l, 'capa ' + w.text); assert(Math.abs(l.inPoint - w.start) < 1e-6, 'entra con su palabra'); });
    var key = byText[words[1].text];
    assert.strictEqual(JSON.stringify(key.td.fillColor.map(function (x) { return Math.round(x * 255); })), JSON.stringify([255, 1, 1]), 'palabra clave en rojo');
    assert.strictEqual(key.td.fontSize, 64, 'mismo tamano que las demas');
    var any = tl[0], op = any.property('ADBE Transform Group').property('ADBE Opacity');
    assert(op.numKeys === 4 || op.numKeys === 2, 'entrada (y salida si cabe)');
    var blur = any.property('ADBE Effect Parade').property('ADBE Gaussian Blur 2');
    assert(blur && blur.property('ADBE Gaussian Blur 2-0001').keys[0].v === 20, 'desenfoque 20 -> 0');
    assert(any.property('ADBE Effect Parade').property('ADBE Drop Shadow'), 'sombra suave');
    assert(Math.abs(blur.property('ADBE Gaussian Blur 2-0001').keys[1].t - (any.inPoint + 0.3)) < 1e-6, 'dura 0,30 s');
  });
  t('ocultar durante T2: los subtitulos que coinciden con un T2 llevan la expresion; el T2 no', function () {
    var s = setup(), st = fresh(), store = P.createStore({}); store.load();
    var defs = store.defs();
    var t2 = JSON.parse(JSON.stringify(defs['builtin:caja'])); t2.id = 't2x'; t2.kind = 'T2'; defs.t2x = t2;
    st.seqs[1].pres = 't2x';
    var t2start = st.seqs[1].start;
    // un intervalo externo (como los textos de un paquete) que cae sobre la frase 3
    var ext = [[st.seqs[2].start + 0.05, st.seqs[2].start + 0.4]];
    run(s.h, JSON.stringify(M.buildJob(st, S0, { presDefs: defs, assign: P.assignSlots, hide: ext })));
    var hidden = s.comp.layerList.filter(function (l) { return /oculto mientras hay un texto T2/.test(l.property('ADBE Transform Group').property('ADBE Opacity').expression || ''); });
    assert(hidden.length >= st.seqs[2].words.length, 'frase 3 oculta durante el intervalo (' + hidden.length + ')');
    hidden.forEach(function (l) { assert(l.inPoint >= st.seqs[2].start - 1e-6 || l.inPoint < t2start, 'no oculta la propia plantilla T2'); });
  });
  console.log('pruebas v0.6 de punta a punta OK');
})();

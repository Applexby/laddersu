var assert = require('assert');
var P = require('../extension/js/presentations.js');
var n = 0; function t(nm, f) { f(); n++; }
function mem() { var ls = null, fl = null; return { readLS: function () { return ls; }, writeLS: function (s) { ls = s; }, readFile: function () { return fl; }, writeFile: function (s) { fl = s; }, kill: function () { ls = null; }, get ls() { return ls; } }; }

t('paquete incluido valido y con resumen', function () {
  var pk = P.builtinPack(); assert(pk.length >= 4);
  pk.forEach(function (d) { assert.strictEqual(P.validate(d), ''); assert(P.summary(d).indexOf('texto') >= 0); JSON.parse(JSON.stringify(d)); });
});
t('assignSlots: 1 texto recibe todas; 2 textos reparten; sobran textos', function () {
  var pk = P.builtinPack(), caja = pk[0], dos = pk[2];
  var w = [{}, {}, {}];
  var s = P.assignSlots(caja, w); assert.deepStrictEqual(s[0], [0, 1, 2]); assert.strictEqual(s[1], null);
  var s2 = P.assignSlots(dos, w);               // 2 textos, 3 palabras
  var total = (s2[0] || []).length + (s2[1] || []).length; assert.strictEqual(total, 3);
  var s3 = P.assignSlots(dos, [{}]);            // 1 palabra, 2 textos -> el segundo queda vacio
  assert.strictEqual((s3[0] || []).length + (s3[1] || []).length, 1);
  assert(s3[0].length === 0 || s3[1].length === 0);
});
t('assignSlots: orden por entrada y luego de arriba a abajo', function () {
  var d = P.builtinPack()[2]; var order = P.textLayerOrder(d);
  assert.strictEqual(d.layers[order[0]].name, 'Arriba');
});
t('previewItems', function () {
  var it = P.previewItems(P.builtinPack()[0]);
  assert(it.some(function (x) { return x.k === 'rect' && x.fill === '#ffd400'; }));
  assert(it.some(function (x) { return x.k === 'text'; }));
  it.forEach(function (x) { assert(x.x > 0 && x.x < 1 && x.y > 0 && x.y < 1); });
});
t('store: persistencia, respaldo en archivo, duplicar, favorito, borrar', function () {
  var io = mem(), s = P.createStore(io); s.load();
  assert(s.list.length >= 4);
  var c = s.duplicate('builtin:caja'); assert(c.name.indexOf('copia') > 0); assert(!c.builtin);
  assert(s.toggleFav(c.id)); s.rename(c.id, 'Mi promo');
  io.kill();                                         // se pierde localStorage -> recupera del archivo
  var s2 = P.createStore(io); s2.load();
  assert.strictEqual(s2.get(c.id).name, 'Mi promo');
  assert(s2.remove(c.id)); assert(!s2.get(c.id));
});
t('exportar / importar entre proyectos (ids nuevos)', function () {
  var a = P.createStore(mem()); a.load();
  var str = a.exportJSON('builtin:dos');
  var b = P.createStore(mem()); b.load();
  var before = b.list.length, r = b.importJSON(str);
  assert(r.ok && b.list.length === before + 1);
  assert(!b.importJSON('{"x":1}').ok); assert(!b.importJSON('no json').ok);
  var bad = JSON.stringify({ escpres: 1, def: { layers: [] } }); assert(!b.importJSON(bad).ok);
});
t('restaurar pack', function () {
  var s = P.createStore(mem()); s.load();
  s.remove('builtin:neon'); s.get('builtin:caja').name = 'roto';
  s.restorePack();
  assert(s.get('builtin:neon')); assert.strictEqual(s.get('builtin:caja').name, 'Caja destacada');
});
console.log(n + ' pruebas de presentaciones OK');

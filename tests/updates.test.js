// Actualizador: versiones, lectura de la version publicada, descarga con redireccion, huella e instalacion.
var assert = require('assert'), fs = require('fs'), path = require('path'), os = require('os'), http = require('http'), cp = require('child_process');
var U = require('../extension/js/updates.js');
var n = 0; function t(name, fn) { fn(); n++; }
var pending = [];
function ta(name, fn) { pending.push({ name: name, fn: fn }); }

t('comparar versiones', function () {
  assert.strictEqual(U.compare('0.6.0', '0.5.9'), 1);
  assert.strictEqual(U.compare('v0.6.0', '0.6.0'), 0);
  assert.strictEqual(U.compare('0.6.0', '0.10.0'), -1);
  assert.strictEqual(U.compare('0.6.0-beta.1', '0.6.0'), -1);
  assert.strictEqual(U.compare('1.0.0', '0.99.99'), 1);
  assert.strictEqual(U.parse('hola'), null);
});

var REL = {
  tag_name: 'v0.6.1', html_url: 'https://github.com/Applexby/laddersu/releases/tag/v0.6.1', published_at: '2026-11-10T00:00:00Z',
  body: '## Novedades\n- **Entrada por desenfoque**\n- Arreglos\n\n**Full Changelog**: x',
  assets: [
    { name: 'Laddersu-Setup.exe', browser_download_url: 'u/Laddersu-Setup.exe', size: 10 },
    { name: 'Laddersu-Setup-0.6.1.exe', browser_download_url: 'u/Laddersu-Setup-0.6.1.exe', size: 10 },
    { name: 'laddersu-panel-0.6.1.zip', browser_download_url: 'u/laddersu-panel-0.6.1.zip', size: 5 },
    { name: 'latest.json', browser_download_url: 'u/latest.json', size: 1 }
  ]
};
t('leer la version publicada', function () {
  var i = U.fromRelease(REL, { zip: { name: 'laddersu-panel-0.6.1.zip', sha256: 'abc' }, exe: { name: 'Laddersu-Setup-0.6.1.exe', sha256: 'def' } });
  assert.strictEqual(i.version, '0.6.1');
  assert.strictEqual(i.zip.sha256, 'abc');
  assert.strictEqual(i.exe.name, 'Laddersu-Setup-0.6.1.exe');
  assert.strictEqual(U.status('0.6.0', i).state, 'update');
  assert.strictEqual(U.status('0.6.1', i).state, 'current');
  assert.strictEqual(U.status('0.7.0', i).state, 'ahead');
  assert.strictEqual(U.fromRelease({}, null), null);
  var notes = U.plainNotes(REL.body);
  assert(notes.indexOf('• Entrada por desenfoque') >= 0 && notes.indexOf('Full Changelog') < 0);
});

t('copiar sin tocar los sonidos del usuario', function () {
  var a = fs.mkdtempSync(path.join(os.tmpdir(), 'lu-a-')), b = fs.mkdtempSync(path.join(os.tmpdir(), 'lu-b-'));
  fs.mkdirSync(path.join(a, 'js')); fs.writeFileSync(path.join(a, 'js', 'x.js'), 'nuevo');
  fs.mkdirSync(path.join(a, 'sounds', 'user'), { recursive: true }); fs.writeFileSync(path.join(a, 'sounds', 'user', 'library.json'), '[]');
  fs.mkdirSync(path.join(b, 'js')); fs.writeFileSync(path.join(b, 'js', 'x.js'), 'viejo'); fs.writeFileSync(path.join(b, 'js', 'mio.js'), 'mio');
  fs.mkdirSync(path.join(b, 'sounds', 'user'), { recursive: true }); fs.writeFileSync(path.join(b, 'sounds', 'user', 'library.json'), '[{"id":"mio"}]');
  var k = U.copyTree(a, b);
  assert.strictEqual(k, 1);
  assert.strictEqual(fs.readFileSync(path.join(b, 'js', 'x.js'), 'utf8'), 'nuevo');
  assert(fs.existsSync(path.join(b, 'js', 'mio.js')), 'no borra archivos que no vienen en la version');
  assert.strictEqual(fs.readFileSync(path.join(b, 'sounds', 'user', 'library.json'), 'utf8'), '[{"id":"mio"}]');
});

// zip de prueba con python (stdlib)
function makeZip(dir, out) {
  cp.execFileSync('python3', ['-I', '-c', 'import sys,zipfile,os\nz=zipfile.ZipFile(sys.argv[2],"w")\nfor r,d,f in os.walk(sys.argv[1]):\n  for x in f:\n    p=os.path.join(r,x); z.write(p, os.path.relpath(p, sys.argv[1]))\nz.close()', dir, out]);
}
function pyExtract(zipPath, outDir, cb) {
  try { cp.execFileSync('python3', ['-I', '-c', 'import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', zipPath, outDir]); cb(null); } catch (e) { cb(e); }
}

ta('instalar: descarga con redireccion, verifica huella y copia', function (done) {
  var src = fs.mkdtempSync(path.join(os.tmpdir(), 'lu-src-'));
  fs.mkdirSync(path.join(src, 'CSXS')); fs.writeFileSync(path.join(src, 'CSXS', 'manifest.xml'), '<m/>');
  fs.writeFileSync(path.join(src, 'version.json'), '{"version":"0.6.1"}');
  fs.mkdirSync(path.join(src, 'js')); fs.writeFileSync(path.join(src, 'js', 'main.js'), '// v0.6.1');
  var zip = path.join(os.tmpdir(), 'lu-' + Date.now() + '.zip'); makeZip(src, zip);
  var buf = fs.readFileSync(zip), sha = U.sha256(buf);
  var srv = http.createServer(function (q, r) {
    if (q.url === '/dl') { r.writeHead(302, { Location: 'http://127.0.0.1:' + srv.address().port + '/file' }); r.end(); return; }
    if (q.url === '/file') { r.writeHead(200, { 'Content-Length': buf.length }); r.end(buf); return; }
    r.writeHead(404); r.end();
  }).listen(0, function () {
    var ext = fs.mkdtempSync(path.join(os.tmpdir(), 'lu-ext-'));
    fs.mkdirSync(path.join(ext, 'js')); fs.writeFileSync(path.join(ext, 'js', 'main.js'), '// v0.6.0');
    var base = 'http://127.0.0.1:' + srv.address().port;
    var fases = [];
    var info = { version: '0.6.1', zip: { name: 'laddersu-panel-0.6.1.zip', url: base + '/dl', sha256: sha, size: buf.length } };
    U.install(info, { extDir: ext, extractor: pyExtract, onProgress: function (f) { if (fases.indexOf(f) < 0) { fases.push(f); } } }, function (err, res) {
      assert.ifError(err);
      assert.strictEqual(res.version, '0.6.1');
      assert.strictEqual(fs.readFileSync(path.join(ext, 'js', 'main.js'), 'utf8'), '// v0.6.1');
      assert.deepStrictEqual(fases, ['download', 'extract', 'copy']);
      // huella distinta -> no instala nada
      var ext2 = fs.mkdtempSync(path.join(os.tmpdir(), 'lu-ext2-'));
      var bad = { version: '0.6.1', zip: { name: 'p.zip', url: base + '/dl', sha256: 'ffff' } };
      U.install(bad, { extDir: ext2, extractor: pyExtract }, function (e2) {
        assert(e2 && /huella/.test(e2.message));
        assert.strictEqual(fs.readdirSync(ext2).length, 0);
        U.get(base + '/nada', null, function (e3) {
          assert(e3 && /404/.test(e3.message));
          srv.close(); done();
        });
      });
    });
  });
});

(function run(i) {
  if (i >= pending.length) { console.log(n + ' pruebas del actualizador OK'); return; }
  pending[i].fn(function () { n++; run(i + 1); });
})(0);

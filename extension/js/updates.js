/*
 * Laddersu - actualizaciones.
 * Comprueba la ultima version publicada en GitHub Releases (repo publico: no necesita claves),
 * descarga el paquete del panel, verifica su huella SHA-256 e instala los archivos encima de la
 * version actual. Funciona en el panel de CEP (Node activado) y en Node para las pruebas.
 *
 * Cada version publicada trae un "latest.json":
 *   { version, pub_date, notes, zip: { name, url, sha256, size }, exe: { name, url, sha256, size } }
 */
var LadderUpdates = (function () {
  var U = {};
  U.REPO = 'Applexby/laddersu';
  U.API_LATEST = 'https://api.github.com/repos/' + U.REPO + '/releases/latest';
  U.PAGE = 'https://github.com/' + U.REPO + '/releases/latest';
  // carpetas del panel que el actualizador nunca toca (datos del usuario)
  U.KEEP = ['sounds/user'];

  // ---------- versiones ----------
  U.parse = function (v) {
    var m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(String(v || '').trim());
    if (!m) { return null; }
    return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] || '' };
  };
  // -1 si a < b, 0 si iguales, 1 si a > b (una pre-version es menor que la final)
  U.compare = function (a, b) {
    var x = U.parse(a), y = U.parse(b), k;
    if (!x || !y) { return 0; }
    var keys = ['major', 'minor', 'patch'];
    for (k = 0; k < keys.length; k++) { if (x[keys[k]] !== y[keys[k]]) { return x[keys[k]] < y[keys[k]] ? -1 : 1; } }
    if (x.pre === y.pre) { return 0; }
    if (!x.pre) { return 1; }
    if (!y.pre) { return -1; }
    return x.pre < y.pre ? -1 : 1;
  };

  // De la respuesta de la API de GitHub saca lo necesario. latestJson es el contenido de latest.json (si se pudo leer).
  U.fromRelease = function (rel, latestJson) {
    if (!rel || !rel.tag_name) { return null; }
    var assets = rel.assets || [], i, zip = null, exe = null, meta = null;
    for (i = 0; i < assets.length; i++) {
      var a = assets[i], n = a.name || '';
      if (/^laddersu-panel-.*\.zip$/i.test(n)) { zip = { name: n, url: a.browser_download_url, size: a.size }; }
      else if (/^Laddersu-Setup.*\.exe$/i.test(n) && (!exe || /\d/.test(n))) { exe = { name: n, url: a.browser_download_url, size: a.size }; }
      else if (n === 'latest.json') { meta = { name: n, url: a.browser_download_url }; }
    }
    var info = {
      version: String(rel.tag_name).replace(/^v/, ''),
      notes: rel.body || '',
      date: rel.published_at || '',
      page: rel.html_url || U.PAGE,
      zip: zip, exe: exe, meta: meta
    };
    if (latestJson && latestJson.zip && zip && latestJson.zip.name === zip.name) { zip.sha256 = latestJson.zip.sha256; }
    if (latestJson && latestJson.exe && exe && latestJson.exe.name === exe.name) { exe.sha256 = latestJson.exe.sha256; }
    if (latestJson && latestJson.notes && !info.notes) { info.notes = latestJson.notes; }
    return info;
  };

  // Resultado de la comprobacion: {state:'update'|'current'|'ahead', current, latest, info}
  U.status = function (current, info) {
    if (!info) { return { state: 'error', current: current }; }
    var c = U.compare(info.version, current);
    return { state: c > 0 ? 'update' : (c === 0 ? 'current' : 'ahead'), current: current, latest: info.version, info: info };
  };

  // Notas de la version en texto simple (sin markdown pesado) para mostrar en el panel
  U.plainNotes = function (md, max) {
    var lines = String(md || '').split(/\r?\n/), out = [], i;
    for (i = 0; i < lines.length && out.length < (max || 12); i++) {
      var l = lines[i].replace(/^#+\s*/, '').replace(/\*\*/g, '').replace(/`/g, '').replace(/^\s*[-*]\s+/, '• ').trim();
      if (l && !/^Full Changelog/i.test(l)) { out.push(l); }
    }
    return out.join('\n');
  };

  // ---------- red y disco (solo con Node) ----------
  function req(name) { try { return typeof require === 'function' ? require(name) : null; } catch (e) { return null; } }

  // GET que sigue redirecciones (GitHub manda las descargas a otro dominio). Devuelve Buffer.
  U.get = function (url, onProgress, cb, depth) {
    var https = req('https'), http = req('http');
    if (!https) { cb(new Error('Sin acceso a red desde este panel')); return; }
    depth = depth || 0;
    if (depth > 6) { cb(new Error('Demasiadas redirecciones')); return; }
    var lib = /^http:/.test(url) ? http : https;
    var r = lib.get(url, { headers: { 'User-Agent': 'Laddersu-Updater', 'Accept': 'application/vnd.github+json, application/octet-stream, */*' } }, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume(); U.get(res.headers.location, onProgress, cb, depth + 1); return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        cb(new Error(res.statusCode === 403 ? 'GitHub limitó las consultas por ahora; prueba en unos minutos.' : 'Respuesta ' + res.statusCode + ' de ' + url.split('/')[2]));
        return;
      }
      var total = +(res.headers['content-length'] || 0), got = 0, chunks = [];
      res.on('data', function (d) { chunks.push(d); got += d.length; if (onProgress) { onProgress(got, total); } });
      res.on('end', function () { cb(null, Buffer.concat(chunks)); });
      res.on('error', cb);
    });
    r.on('error', function (e) { cb(new Error('Sin conexión: ' + e.message)); });
    r.setTimeout(30000, function () { r.destroy(new Error('Tiempo de espera agotado')); });
  };

  U.getJSON = function (url, cb) {
    U.get(url, null, function (err, buf) {
      if (err) { cb(err); return; }
      try { cb(null, JSON.parse(buf.toString('utf8'))); } catch (e) { cb(new Error('Respuesta no válida')); }
    });
  };

  // Comprueba la ultima version: cb(err, status)
  U.check = function (current, cb) {
    U.getJSON(U.API_LATEST, function (err, rel) {
      if (err) { cb(err); return; }
      var base = U.fromRelease(rel, null);
      if (!base) { cb(new Error('Todavía no hay versiones publicadas.')); return; }
      if (!base.meta) { cb(null, U.status(current, base)); return; }
      U.getJSON(base.meta.url, function (e2, meta) { cb(null, U.status(current, U.fromRelease(rel, e2 ? null : meta))); });
    });
  };

  U.sha256 = function (buf) {
    var crypto = req('crypto');
    return crypto ? crypto.createHash('sha256').update(buf).digest('hex') : '';
  };

  // Copia recursiva src -> dst sin borrar lo que ya existe; omite las rutas de U.KEEP. Devuelve n de archivos.
  U.copyTree = function (src, dst, rel) {
    var fs = req('fs'), path = req('path'), n = 0;
    rel = rel || '';
    if (!fs.existsSync(dst)) { fs.mkdirSync(dst, { recursive: true }); }
    fs.readdirSync(src).forEach(function (name) {
      var r = rel ? rel + '/' + name : name;
      if (U.KEEP.indexOf(r) >= 0) { return; }
      var s = path.join(src, name), d = path.join(dst, name);
      if (fs.statSync(s).isDirectory()) { n += U.copyTree(s, d, r); }
      else { fs.writeFileSync(d, fs.readFileSync(s)); n++; }
    });
    return n;
  };

  // Descomprime con PowerShell (Windows). En pruebas se inyecta otro extractor.
  U.extract = function (zipPath, outDir, cb) {
    var cp = req('child_process');
    if (!cp) { cb(new Error('No se puede descomprimir aquí')); return; }
    var ps = "$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath '" + zipPath.replace(/'/g, "''") + "' -DestinationPath '" + outDir.replace(/'/g, "''") + "' -Force";
    cp.execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps], { windowsHide: true }, function (err, so, se) {
      cb(err ? new Error('No se pudo descomprimir: ' + (se || err.message)) : null);
    });
  };

  // Instala el zip de la version en la carpeta de la extension.
  // opts: {extDir, tmpDir, onProgress(fase, got, total), extractor}
  U.install = function (info, opts, cb) {
    var fs = req('fs'), path = req('path'), os = req('os');
    if (!fs) { cb(new Error('Este panel no tiene acceso a archivos')); return; }
    if (!info || !info.zip) { cb(new Error('La versión publicada no trae el paquete del panel.')); return; }
    var tmp = opts.tmpDir || fs.mkdtempSync(path.join(os.tmpdir(), 'laddersu-'));
    var zipPath = path.join(tmp, info.zip.name), out = path.join(tmp, 'pkg');
    if (opts.onProgress) { opts.onProgress('download', 0, info.zip.size || 0); }
    U.get(info.zip.url, function (g, t) { if (opts.onProgress) { opts.onProgress('download', g, t || info.zip.size || 0); } }, function (err, buf) {
      if (err) { cb(err); return; }
      if (info.zip.sha256 && U.sha256(buf) !== info.zip.sha256) { cb(new Error('El archivo descargado no coincide con la versión publicada (huella distinta). No se instaló nada.')); return; }
      fs.writeFileSync(zipPath, buf);
      if (opts.onProgress) { opts.onProgress('extract', 0, 0); }
      (opts.extractor || U.extract)(zipPath, out, function (e2) {
        if (e2) { cb(e2); return; }
        // el zip trae los archivos del panel en la raiz (CSXS/, js/, ...)
        var root = out;
        if (!fs.existsSync(path.join(root, 'CSXS'))) {
          var subs = fs.readdirSync(out).filter(function (n) { return fs.existsSync(path.join(out, n, 'CSXS')); });
          if (subs.length) { root = path.join(out, subs[0]); } else { cb(new Error('El paquete no tiene la estructura esperada.')); return; }
        }
        var vf = path.join(root, 'version.json');
        var newVer = fs.existsSync(vf) ? JSON.parse(fs.readFileSync(vf, 'utf8')).version : info.version;
        if (opts.onProgress) { opts.onProgress('copy', 0, 0); }
        var n;
        try { n = U.copyTree(root, opts.extDir); } catch (e3) { cb(new Error('No se pudieron copiar los archivos: ' + e3.message)); return; }
        try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e4) {}
        cb(null, { version: newVer, files: n });
      });
    });
  };

  return U;
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = LadderUpdates; }

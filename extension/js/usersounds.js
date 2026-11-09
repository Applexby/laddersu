/*
 * Laddersu - sonidos propios del usuario (carpeta sounds/user).
 * Lee sounds/user/library.json (opcional) y suma cualquier .wav/.mp3 de la carpeta que no este listado.
 * Las actualizaciones nunca tocan esa carpeta.
 */
var LadderSounds = (function () {
  var L = {};
  L.AUDIO = /\.(wav|mp3|aif|aiff|m4a)$/i;
  function nice(file) {
    var n = file.replace(L.AUDIO, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    return n ? n.charAt(0).toUpperCase() + n.slice(1) : file;
  }
  // dir: ruta de sounds/user; io: {fs, path} (Node). Devuelve [{id, name, cat, file, path}]
  L.scan = function (dir, io) {
    var fs = io && io.fs, path = io && io.path, out = [], seen = {};
    if (!fs || !dir || !fs.existsSync(dir)) { return out; }
    var lib = [], lf = path.join(dir, 'library.json');
    if (fs.existsSync(lf)) {
      try { lib = JSON.parse(fs.readFileSync(lf, 'utf8')); } catch (e) { lib = []; }
      if (!(lib instanceof Array)) { lib = lib && lib.sounds instanceof Array ? lib.sounds : []; }
    }
    lib.forEach(function (s) {
      if (!s || !s.file) { return; }
      var p = path.join(dir, s.file);
      if (!fs.existsSync(p)) { return; }
      var id = 'u:' + (s.id || s.file);
      if (seen[id]) { return; }
      seen[id] = true; seen['f:' + s.file.toLowerCase()] = true;
      out.push({ id: id, name: s.name || nice(s.file), cat: s.cat || 'Mis sonidos', file: s.file, path: p });
    });
    fs.readdirSync(dir).forEach(function (f) {
      if (!L.AUDIO.test(f) || seen['f:' + f.toLowerCase()]) { return; }
      out.push({ id: 'u:' + f, name: nice(f), cat: 'Mis sonidos', file: f, path: path.join(dir, f) });
    });
    return out;
  };
  return L;
})();
if (typeof module !== 'undefined' && module.exports) { module.exports = LadderSounds; }

// Crea out/latest.json (version + huellas) y out/NOTES.md (notas de la version desde CHANGELOG.md)
var fs = require('fs'), path = require('path'), crypto = require('crypto');
var ver = process.argv[2], out = process.argv[3] || 'out', repo = process.env.GITHUB_REPOSITORY || 'Applexby/laddersu';
function asset(name) {
  var p = path.join(out, name), buf = fs.readFileSync(p);
  return { name: name, url: 'https://github.com/' + repo + '/releases/download/v' + ver + '/' + name, sha256: crypto.createHash('sha256').update(buf).digest('hex'), size: buf.length };
}
var notes = '';
var log = fs.existsSync('CHANGELOG.md') ? fs.readFileSync('CHANGELOG.md', 'utf8') : '';
var m = new RegExp('##\\s*\\[?v?' + ver.replace(/\./g, '\\.') + '\\]?[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s|$)').exec(log);
if (m) { notes = m[1].trim(); }
var latest = { version: ver, pub_date: new Date().toISOString(), notes: notes, zip: asset('laddersu-panel-' + ver + '.zip'), exe: asset('Laddersu-Setup-' + ver + '.exe') };
fs.writeFileSync(path.join(out, 'latest.json'), JSON.stringify(latest, null, 2));
fs.writeFileSync(path.join(out, 'NOTES.md'), (notes || 'Nueva versión de Laddersu.') + '\n\n**Instalar:** descarga `Laddersu-Setup.exe`. Si ya tienes Laddersu, abre *Ventana ▸ Extensiones ▸ Laddersu · Actualizaciones*.\n');
console.log('latest.json', latest.version, latest.zip.sha256.slice(0, 12), latest.exe.sha256.slice(0, 12));

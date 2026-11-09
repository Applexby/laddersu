// Verifica que la version sea la misma en version.json, manifest.xml y el panel (HOST_VER)
var fs = require('fs');
var v = JSON.parse(fs.readFileSync('extension/version.json', 'utf8')).version, bad = [];
var man = fs.readFileSync('extension/CSXS/manifest.xml', 'utf8');
if (man.indexOf('ExtensionBundleVersion="' + v + '"') < 0) { bad.push('manifest.xml (ExtensionBundleVersion)'); }
(man.match(/<Extension Id="[^"]+" Version="([^"]+)"/g) || []).forEach(function (x) { if (x.indexOf('Version="' + v + '"') < 0) { bad.push('manifest.xml: ' + x); } });
if (fs.existsSync('extension/js/model.js')) {
  var mm = /HOST_VER = '([^']+)'/.exec(fs.readFileSync('extension/js/model.js', 'utf8'));
  if (mm && mm[1] !== v) { bad.push('js/model.js HOST_VER=' + mm[1]); }
}
if (bad.length) { console.error('Versión ' + v + ' no coincide en: ' + bad.join(', ')); process.exit(1); }
console.log('Versión ' + v + ' coherente');

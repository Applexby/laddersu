/* Laddersu - panel de actualizaciones */
(function () {
  'use strict';
  var U = LadderUpdates, $ = function (id) { return document.getElementById(id); };
  var BUS = 'com.idealo.laddersu.updated';
  var st = { current: '', info: null, busy: false };

  function ls(k, d) { try { var v = localStorage.getItem('laddersu.upd.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem('laddersu.upd.' + k, JSON.stringify(v)); } catch (e) {} }
  function cep() { return typeof window.__adobe_cep__ !== 'undefined' ? window.__adobe_cep__ : null; }
  function extDir() {
    try {
      var p = decodeURIComponent(cep().getSystemPath('extension')).replace(/^file:\/{2,3}/, '');
      if (/^[A-Za-z]:/.test(p) === false && /^\/[A-Za-z]:/.test(p)) { p = p.substr(1); }
      return p;
    } catch (e) { return ''; }
  }
  function openURL(u) {
    try { if (window.cep && window.cep.util) { window.cep.util.openURLInDefaultBrowser(u); return; } } catch (e) {}
    window.open(u, '_blank');
  }
  function readVersion(cb) {
    var x = new XMLHttpRequest();
    x.onload = function () { try { cb(JSON.parse(x.responseText).version); } catch (e) { cb(''); } };
    x.onerror = function () { cb(''); };
    try { x.open('GET', '../version.json'); x.send(); } catch (e) { cb(''); }
  }
  function setState(text, cls) { var e = $('stateText'); e.textContent = text; e.className = 'state' + (cls ? ' ' + cls : ''); }
  function bar(p) {
    var b = $('bar'), f = $('barFill');
    if (p === null) { b.hidden = true; return; }
    b.hidden = false; b.classList.toggle('indef', p < 0); f.style.width = p < 0 ? '' : Math.round(p * 100) + '%';
  }
  function fmtDate(iso) { if (!iso) { return ''; } var d = new Date(iso); return d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }); }

  function render(s) {
    $('curVer').textContent = st.current || '—';
    $('btnUpdate').hidden = true; $('btnReload').hidden = true;
    if (!s) { return; }
    if (s.state === 'error') { setState('No se pudo comprobar.', 'err'); return; }
    st.info = s.info;
    $('newVer').textContent = s.latest;
    $('notesCard').hidden = !s.info.notes;
    $('notesTitle').textContent = 'Novedades de la ' + s.latest + (s.info.date ? ' · ' + fmtDate(s.info.date) : '');
    $('notes').textContent = U.plainNotes(s.info.notes, 14);
    if (s.state === 'update') {
      setState('Hay una versión nueva disponible.', 'new');
      $('btnUpdate').hidden = false; $('btnUpdate').textContent = 'Actualizar a ' + s.latest; $('btnUpdate').disabled = !s.info.zip;
      if (!s.info.zip) { setState('Hay una versión nueva, pero sin paquete del panel: usa el instalador (.exe).', 'new'); }
    } else if (s.state === 'current') { setState('Tienes la última versión.', 'ok'); }
    else { setState('Tu versión es más nueva que la publicada (versión de desarrollo).', 'ok'); }
  }

  function check(auto) {
    if (st.busy) { return; }
    setState('Buscando la última versión…'); bar(-1);
    U.check(st.current, function (err, s) {
      bar(null);
      lsSet('lastCheck', Date.now()); $('checked').textContent = 'Comprobado ' + new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
      if (err) { setState(err.message, 'err'); return; }
      render(s);
      notify(s);
      if (auto && s.state === 'update' && ls('auto', false) && s.info.zip) { install(); }
    });
  }

  // avisa al panel principal (banner de "nueva version")
  function notify(s) {
    lsSet('latest', s && s.latest ? s.latest : '');
    dispatch(BUS, JSON.stringify({ kind: 'status', state: s.state, latest: s.latest, current: st.current }));
  }
  function dispatch(type, data) {
    var c = cep(); if (!c) { return; }
    try { c.dispatchEvent({ type: type, scope: 'APPLICATION', appId: '', extensionId: '', data: data }); } catch (e) {}
  }

  function install() {
    if (st.busy || !st.info) { return; }
    var dir = extDir();
    if (!dir) { setState('Abre este panel dentro de After Effects para instalar.', 'err'); return; }
    st.busy = true; $('btnUpdate').disabled = true; $('btnCheck').disabled = true;
    U.install(st.info, {
      extDir: dir,
      onProgress: function (phase, got, total) {
        if (phase === 'download') { setState('Descargando… ' + (total ? Math.round(100 * got / total) + '%' : Math.round(got / 1024) + ' KB')); bar(total ? got / total : -1); }
        else if (phase === 'extract') { setState('Descomprimiendo…'); bar(-1); }
        else { setState('Copiando archivos…'); bar(-1); }
      }
    }, function (err, res) {
      st.busy = false; bar(null); $('btnCheck').disabled = false;
      if (err) { setState(err.message, 'err'); $('btnUpdate').disabled = false; return; }
      st.current = res.version; $('curVer').textContent = res.version;
      $('btnUpdate').hidden = true; $('btnReload').hidden = false;
      setState('Listo: Laddersu ' + res.version + ' instalada (' + res.files + ' archivos). Recarga los paneles para usarla.', 'ok');
      dispatch(BUS, JSON.stringify({ kind: 'installed', version: res.version }));
    });
  }

  function sw(id, key, def) {
    var b = $(id), paint = function () { b.setAttribute('aria-checked', ls(key, def) ? 'true' : 'false'); };
    b.addEventListener('click', function () { lsSet(key, !ls(key, def)); paint(); });
    paint();
  }

  $('btnCheck').addEventListener('click', function () { check(false); });
  $('btnUpdate').addEventListener('click', install);
  $('btnReload').addEventListener('click', function () { dispatch(BUS, JSON.stringify({ kind: 'reload' })); location.reload(); });
  $('lnkReleases').addEventListener('click', function () { openURL('https://github.com/' + U.REPO + '/releases'); });
  $('lnkExe').addEventListener('click', function () { openURL('https://github.com/' + U.REPO + '/releases/latest/download/Laddersu-Setup.exe'); });
  sw('optCheck', 'check', true); sw('optAuto', 'auto', false);

  readVersion(function (v) {
    st.current = v; $('curVer').textContent = v || '—';
    var params = (location.search || '') + (window.__params || '');
    if (ls('check', true) || /check/.test(params)) { check(true); } else { setState('Pulsa “Buscar ahora” para comprobar.'); }
  });
  window.__LU = { st: st, check: check, install: install };
})();

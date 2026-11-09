"""Interfaz del panel en Chromium con After Effects simulado (requiere playwright)."""
import json, os, sys
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SHOTS = os.environ.get('SHOTS', '/tmp/shots')
SRT = open(os.path.join(ROOT, 'tests', 'sample.srt'), encoding='utf-8').read()

MOCK = r"""
window.__calls = [];
window.__lib = []; window.__groups = [];
window.__stepDelay = 0;
window.__capture = {ok:true, skipped:1, def:{comp:{w:1080,h:1920}, upper:true, layers:[
  {k:'text',name:'Titulo',dt:0,dur:null,tr:[{t:'p',m:'ADBE Position',v:[540,1100]}],fx:[],an:[],doc:{font:'',size:90,color:'#ffffff',just:'C',tracking:0},ac:[0,0],sample:'Hola'},
  {k:'shape',name:'Caja',dt:0,dur:null,tr:[{t:'p',m:'ADBE Position',v:[540,1100]}],fx:[],ct:[{t:'g',m:'ADBE Vector Group',ch:[{t:'g',m:'ADBE Vectors Group',ch:[
     {t:'g',m:'ADBE Vector Shape - Rect',ch:[{t:'p',m:'ADBE Vector Rect Size',v:[500,120]}]},
     {t:'g',m:'ADBE Vector Graphic - Fill',ch:[{t:'p',m:'ADBE Vector Fill Color',v:[0.2,0.5,1,1]}]}]}]}]}]}};
function argOf(s){ var a=s.indexOf('('), b=s.lastIndexOf(')'); var x=s.substring(a+1,b); try { return JSON.parse(x); } catch(e){ return x; } }
window.__opened = []; window.__bus = {};
window.__adobe_cep__ = {
  requestOpenExtension: function (id) { window.__opened.push(id); },
  addEventListener: function (type, fn) { window.__bus[type] = fn; },
  dispatchEvent: function () {},
  getSystemPath: function(t){ return t==='extension' ? 'file:///C:/ext' : 'file:///C:/ud'; },
  evalScript: function(s, cb){
    var r = '', delay = 0;
    if (s.indexOf('ES_status')>=0) r = '{"engine":true,"fonts":true,"ver":"0.7.0","ev":"0.7.0","ae":"24.0"}';
    else if (s.indexOf('ES_compInfo')>=0) r = '{"ok":true,"name":"Reel","w":1080,"h":1920,"fps":30,"dur":60}';
    else if (s.indexOf('ES_listFonts')>=0) r = JSON.stringify({ok:true,fonts:[{n:'Arial-BoldMT',f:'Arial',s:'Bold'},{n:'Anton-Regular',f:'Anton',s:'Regular'},{n:'Montserrat-ExtraBold',f:'Montserrat',s:'ExtraBold'}]});
    else if (s.indexOf('ES_capture')>=0) r = JSON.stringify(window.__capture);
    else if (s.indexOf('ES_begin')>=0) { window.__calls.push(s); r = '{"ok":true,"run":"r1","removed":0,"comp":"Reel"}'; }
    else if (s.indexOf('ES_step')>=0) { window.__calls.push(s); window.__nstep = (window.__nstep||0)+1; r = (window.__failAt && window.__nstep === window.__failAt) ? '{"ok":false,"msg":"La fuente Anton-Regular no se encontró."}' : '{"ok":true,"layers":3,"sfx":0}'; delay = window.__stepDelay; }
    else if (s.indexOf('ES_end')>=0) { window.__calls.push(s); r = '{"ok":true,"layers":12,"msg":"Listo: 12 capas en \\"Reel\\"."}'; }
    else if (s.indexOf('ES_stop')>=0) { window.__calls.push(s); r = '{"ok":true,"removed":5,"seqs":1}'; }
    else if (s.indexOf('ES_libList')>=0) r = JSON.stringify({ok:true, root:'C:/ud/Laddersu/biblioteca', items: window.__lib, groups: window.__groups});
    else if (s.indexOf('ES_libState')>=0) r = JSON.stringify({ok:true, hasComp:true, comp:'Reel', sel:2, saved:true, dirty:true, project:'proyecto.aep'});
    else if (s.indexOf('ES_libSave')>=0) { var o = JSON.parse(argOf(s)); window.__calls.push(s); window.__lib.push({id:'c'+window.__lib.length, name:o.name, comp:o.name, w:1080, h:1920, dur:4, fps:30, files:2, created:Date.now(), thumb:'', group:o.group||''}); r = JSON.stringify({ok:true, id:'c1', name:o.name, files:2}); }
    else if (s.indexOf('ES_libInsert')>=0) { window.__calls.push(s); r = '{"ok":true,"msg":"Insertado en \\"Reel\\"."}'; }
    else if (s.indexOf('ES_libDelete')>=0) { var id = argOf(s); window.__lib = window.__lib.filter(function(x){return x.id!==id;}); r = '{"ok":true}'; }
    else if (s.indexOf('ES_libRename')>=0) { var o2 = JSON.parse(argOf(s)); window.__lib.forEach(function(x){ if (x.id===o2.id) x.name=o2.name; }); r = '{"ok":true}'; }
    else if (s.indexOf('ES_libReveal')>=0) r = '{"ok":true}';
    else if (s.indexOf('ES_libGroupsSave')>=0) { var og = JSON.parse(argOf(s)); window.__groups = og.groups; var keep = {}, mv = 0; og.groups.forEach(function(g){ keep[g.id]=1; }); window.__lib.forEach(function(x){ if (x.group && !keep[x.group]) { x.group=''; mv++; } }); r = JSON.stringify({ok:true, moved:mv}); }
    else if (s.indexOf('ES_libSetGroup')>=0) { var os = JSON.parse(argOf(s)); window.__lib.forEach(function(x){ if (os.ids.indexOf(x.id)>=0) x.group = os.group; }); r = '{"ok":true}'; }
    setTimeout(function(){ cb(r); }, delay);
  }
};
"""

fails = []
def check(cond, msg):
    print(('OK   ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

def chip(page, i):
    return page.locator('.chip').nth(i)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 440, 'height': 800})
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.add_init_script(MOCK)
    page.goto('file://' + os.path.join(ROOT, 'extension', 'index.html'))
    page.wait_for_timeout(300)

    def words():
        return page.evaluate('[].concat.apply([], window.__ES.st.seqs.map(function(q){return q.words.map(function(w){return w.text;});}))')
    def nseq():
        return page.evaluate('window.__ES.st.seqs.length')

    # ================= paso 1: Texto =================
    check(page.locator('#empty').is_visible(), 'paso Texto: estado vacio visible')
    check(page.locator('#stepper .stp[data-step=frases]').is_disabled() and page.locator('#btnNext').is_disabled(), 'sin SRT no se puede avanzar')
    check(not page.locator('#monitor').is_visible(), 'en Texto no hay vista previa')
    page.screenshot(path=SHOTS + '/01_texto_vacio.png')
    page.locator('#dropZone summary').click()
    page.fill('#srtPaste', SRT); page.click('#btnParse'); page.wait_for_timeout(150)
    check(page.locator('#textoView').is_visible() and not page.locator('#empty').is_visible(), 'texto importado')
    check(page.locator('#transcript .tw').count() == len(words()) == 15, 'el texto corrido muestra todas las palabras (%d)' % page.locator('#transcript .tw').count())
    check('15 palabras' in page.locator('#srcMeta').inner_text(), 'archivo con cantidad de palabras y duracion')
    check(page.locator('#transcript .para').count() >= 2, 'bloques tras pausas')
    check(page.locator('#seqs .chip').count() == 0 or not page.locator('#seqs').is_visible(), 'en Texto no hay burbujas ni estilos')
    page.locator('#transcript .tw', has_text='ingles?').click()
    check(page.locator('#wordPop').is_visible(), 'clic en una palabra abre sus acciones')
    page.fill('#wordPop input', 'inglés?'); page.keyboard.press('Enter'); page.wait_for_timeout(100)
    check('inglés?' in words(), 'corregir una palabra')
    page.locator('#transcript .tw', has_text='Como').click()
    page.locator('#wordPop .q', has_text='Unir con la siguiente').click(); page.wait_for_timeout(100)
    check('Como seria' in words() and len(words()) == 14, 'unir con la siguiente')
    page.screenshot(path=SHOTS + '/02_texto_unir.png')
    page.locator('#transcript .tw', has_text='Como seria').click()
    page.locator('#wordPop .q', has_text='Separar').click(); page.wait_for_timeout(100)
    check(words()[:2] == ['Como', 'seria'], 'separar la vuelve a dos palabras')
    page.locator('#transcript .tw', has_text='tu').first.click()
    page.locator('#wordPop .q', has_text='Quitar').click(); page.wait_for_timeout(100)
    check('tu' not in words(), 'quitar una palabra')
    page.keyboard.press('Control+z'); page.wait_for_timeout(100)
    check('tu' in words(), 'Ctrl+Z la devuelve')
    page.fill('#findIn', 'peliculas'); page.fill('#replIn', 'películas'); page.click('#btnReplace'); page.wait_for_timeout(100)
    check('películas' in words(), 'buscar y reemplazar')
    page.screenshot(path=SHOTS + '/03_texto.png')

    # ================= paso 2: Frases =================
    page.click('#btnNext'); page.wait_for_timeout(150)
    check(page.locator('#baseView').is_visible() and page.locator('.baseCard').count() == 3, 'Frases empieza preguntando la base (3 estilos)')
    check(not page.locator('#monitor').is_visible(), 'en Frases no hay vista previa')
    check(not page.locator('#btnNext').is_visible(), 'no se avanza sin agrupar')
    page.locator('.baseCard', has_text='Una línea').click()
    est_line = page.locator('.baseAct .est').inner_text()
    page.locator('.baseCard', has_text='Escalera').click()
    est_stair = page.locator('.baseAct .est').inner_text()
    check(est_line != est_stair, 'muestra cuantas frases quedarian (%s / %s)' % (est_stair, est_line))
    page.screenshot(path=SHOTS + '/04_frases_base.png')
    page.click('#btnGroup'); page.wait_for_timeout(150)
    n0 = nseq()
    check(page.locator('#frasesView').is_visible() and page.locator('.frRow').count() == n0, 'lista de frases agrupadas (%d)' % n0)
    check(page.evaluate('window.__ES.S.editStyle') == 'lockup' and page.evaluate('window.__ES.st.based') is True, 'base escalera')
    check(page.locator('#frBar i').count() == n0, 'barra del video por frase')
    page.locator('.frRow').nth(0).hover(); page.locator('.frRow').nth(0).locator('.cut').first.click(); page.wait_for_timeout(100)
    check(nseq() == n0 + 1, 'cortar entre dos palabras')
    page.keyboard.press('Control+z'); page.wait_for_timeout(100)
    check(nseq() == n0, 'deshacer el corte')
    page.locator('.frRow .cb').nth(1).click(); page.locator('.frRow .cb').nth(2).click()
    check(page.locator('#frSel').is_visible() and '2 frases' in page.locator('#frSel').inner_text(), 'elegir frases muestra sus acciones')
    page.screenshot(path=SHOTS + '/05_frases_elegidas.png')
    page.locator('#frSel .sb.ln').click(); page.wait_for_timeout(150)
    styles = page.evaluate('window.__ES.st.seqs.map(function(q){return q.style;})')
    check(nseq() > n0 and 'line' in styles and styles[0] == '' and styles[-1] == '', 'pasar un tramo a una linea lo reagrupa solo a el (%s)' % styles)
    check(page.locator('.frRow.ln').count() == styles.count('line') and page.locator('.frStats', has_text='una línea').count() == 1, 'etiquetas y resumen por estilo')
    page.screenshot(path=SHOTS + '/06_frases_mezcla.png')
    n1 = nseq()
    page.locator('.frRow .cb').nth(0).click(); page.locator('.frRow .cb').nth(1).click()
    page.locator('#frSel .sb', has_text='Unir').click(); page.wait_for_timeout(100)
    check(nseq() == n1 - 1, 'unir frases elegidas')
    page.locator('.frRow .cb').nth(0).click()
    page.locator('#frSel .sb.bx').click(); page.wait_for_timeout(100)
    check(page.evaluate('window.__ES.st.seqs[0].style') == 'karaoke', 'pasar una frase a caja que recorre')
    page.click('#btnBase'); page.wait_for_timeout(100)
    check(page.locator('#baseView').is_visible() and page.locator('#btnGroup').inner_text() == 'Volver a agrupar', 'cambiar la base')
    page.locator('.baseAct .pill.ghost', has_text='Cancelar').click()
    check(page.locator('#frasesView').is_visible(), 'cancelar vuelve a la lista sin tocarla')

    # ================= paso 3: Diseño =================
    page.click('#btnNext'); page.wait_for_timeout(200)
    check(page.locator('#monitor').is_visible(), 'en Diseño aparece la vista previa')
    si = page.evaluate("(function(){ var t = document.getElementById('monTitle').textContent; return parseInt(t.split(' ')[1], 10) - 1; })()")
    check(page.locator('#seqs .chip').count() == len(page.evaluate('window.__ES.st.seqs[%d].words' % si)), 'solo las palabras de la frase de la vista previa')
    check('Elige una palabra' in page.locator('#insp').inner_text(), 'el panel de ajustes explica que hacer')
    page.click('#monNext'); page.wait_for_timeout(100)
    check(page.locator('#monTitle').inner_text().startswith('Frase 2 de'), 'navegar frase por frase')
    check('Una línea' in page.locator('#monMeta').inner_text() or 'Escalera' in page.locator('#monMeta').inner_text(), 'muestra el estilo de la frase')
    page.click('#monPrev'); page.wait_for_timeout(100)
    chip(page, 1).click(); page.wait_for_timeout(100)
    wsel = page.evaluate('Object.keys(window.__ES.sel.m)[0]')
    def cw(field):
        return page.evaluate("(function(){ var id=%s, r=null; window.__ES.st.seqs.forEach(function(q){ q.words.forEach(function(w){ if (w.id===id) r=w.c['%s']; }); }); return r; })()" % (wsel, field))
    check(page.locator('#insp .inspTabs button').count() == 7, 'ajustes por pestañas: animación, estilo, color, fuente, sonido, plantilla, quitar')
    page.locator('#insp .inspBody .it', has_text='Pop').first.click(); page.wait_for_timeout(100)
    check(cw('trans') == 'pop', 'animacion desde el panel de ajustes')
    page.screenshot(path=SHOTS + '/07_diseno.png')
    page.keyboard.press('3'); page.keyboard.press('k')
    check(cw('size') == 'L' and cw('brand') is True, 'atajos 3 y K')
    page.locator('#insp .q[aria-label="Caja (B)"]').click()
    check(cw('fmt') == 'box', 'barra rapida: caja')
    page.locator('#insp .inspTabs button', has_text='Estilo').click()
    page.locator('#insp .seg button', has_text='Subrayado').click()
    check(cw('fmt') == 'underline', 'pestaña Estilo: subrayado')
    page.locator('#insp .inspTabs button', has_text='Color').click()
    page.locator('#insp .sw button').nth(3).click()
    check(cw('color') not in ('', None), 'pestaña Color')
    page.locator('#insp .inspTabs button', has_text='Fuente').click(); page.wait_for_timeout(100)
    page.locator('#insp .fpRow', has_text='Anton').click(); page.wait_for_timeout(100)
    check(cw('font') == 'Anton-Regular', 'pestaña Fuente')
    page.locator('#insp .inspTabs button', has_text='Quitar').click()
    labels = page.locator('#insp .inspBody .it').all_inner_texts()
    check(any('Color' in x for x in labels) and not any('Sonido' in x for x in labels), 'Quitar lista solo lo aplicado')
    page.keyboard.press('Control+z'); page.wait_for_timeout(50)
    page.locator('#insp .inspScope button', has_text='toda la frase').click()
    check(page.evaluate('Object.keys(window.__ES.sel.m).length') == page.locator('#seqs .chip').count(), 'elegir toda la frase')
    # menu en cascada sigue disponible con clic derecho
    def beside():
        r = page.locator('#ctx').bounding_box(); f = page.locator('#ctxFly').bounding_box()
        return (f['x'] >= r['x'] + r['width'] - 6) or (f['x'] + f['width'] <= r['x'] + 6)
    chip(page, 0).click(); chip(page, 0).click(button='right')
    check(page.locator('#ctx').is_visible(), 'clic derecho abre el menu')
    page.locator('#ctx .it[data-k=anim]').hover(); page.wait_for_timeout(250)
    check(page.locator('#ctxFly').is_visible() and beside(), 'el submenu se abre al lado')
    page.keyboard.press('Escape'); page.keyboard.press('Escape')
    chip(page, 0).click(button='right')
    page.locator('#ctx .it[data-k=seqstyle]').click()
    page.locator('#ctxFly .it', has_text='APPLEXBY').click()
    page.keyboard.press('Escape'); page.keyboard.press('Escape'); page.wait_for_timeout(100)
    check('APPLEXBY' in page.locator('#monMeta').inner_text(), 'estilo APPLEXBY desde el menu de la frase')
    page.locator('#monitor').screenshot(path=SHOTS + '/08_applexby.png')
    page.click('#monPlay'); page.wait_for_timeout(400); page.locator('#monitor').screenshot(path=SHOTS + '/09_play.png'); page.wait_for_timeout(1800)
    page.locator('#insp .lookLink').click() if page.locator('#insp .lookLink').count() else chip(page, 0).click()
    if not page.locator('#settings').is_visible():
        page.locator('#insp .lookLink').click()
    check(page.locator('#settings').is_visible() and page.locator('#lookCard .lookSeg button.on').inner_text() == 'APPLEXBY', 'Aspecto del estilo abre sus ajustes')
    page.click('#btnCloseSettings')
    # plantilla de texto desde el menu
    chip(page, 0).click(); chip(page, 0).click(button='right')
    page.locator('#ctx .it[data-k=pres]').click()
    page.locator('#ctxFly .it', has_text='Caja destacada').click(); page.wait_for_timeout(100)
    check(page.evaluate('window.__ES.st.seqs.some(function(q){return q.pres;})') and page.locator('#seqs .presTag').count() == 1, 'plantilla de texto aplicada')
    check('plantilla' in page.locator('#monMeta').inner_text(), 'la vista previa muestra la plantilla')

    # --- aviso de actualizacion ---
    page.evaluate("window.__ES.showUpdate('9.9.9')")
    check(page.locator('#updBar').is_visible() and '9.9.9' in page.locator('#updBar').inner_text(), 'aviso de version nueva en el panel')
    page.evaluate("window.__openedUrls = []; window.open = function (u) { window.__openedUrls.push(u); }; 0")
    page.locator('#updBar .pill', has_text='Actualizar').click()
    check('Laddersu-Setup.exe' in ''.join(page.evaluate('window.__openedUrls')), 'sin la app de escritorio, Actualizar descarga el instalador')
    page.locator('#updBar .iconBtn').click()
    check(not page.locator('#updBar').is_visible(), 'el aviso se puede ocultar')

    # ================= paso 4: Generar =================
    page.click('#btnNext'); page.wait_for_timeout(200)
    check(page.locator('#genView .genCard').is_visible() and 'Reel' in page.locator('#genView .genCard').inner_text(), 'Generar muestra a qué composición va')
    check(page.locator('#genView .stat').count() == 3 and str(nseq()) in page.locator('#genView .stat').first.inner_text(), 'resumen: frases, capas y sonidos')
    check(page.locator('#genView .chk').count() >= 1, 'revision antes de generar')
    check(page.locator('#f_genOnly').is_disabled(), 'la primera vez se genera todo')
    check(not page.locator('#btnLog').count() and not page.locator('#msgApply').count(), 'ya no hay Registro ni linea de estado')
    page.screenshot(path=SHOTS + '/10_generar.png')
    page.click('#btnGenAll'); page.wait_for_timeout(400)
    calls = page.evaluate('window.__calls')
    begins = [c for c in calls if c.startswith('ES_begin')]
    nsteps = len([c for c in calls if c.startswith('ES_step')])
    check(len(begins) == 1 and nsteps == nseq() and any(c.startswith('ES_end') for c in calls), 'generar todo: begin + un paso por frase + end (%d)' % nsteps)
    head = json.loads(json.loads(begins[0][len('ES_begin('):-1]))
    check(head['replace']['mode'] == 'all' and head['pres'], 'reemplaza lo anterior y lleva las plantillas')
    check('Listo' in page.locator('#genView .genResult').inner_text(), 'resultado: listo')
    page.screenshot(path=SHOTS + '/11_listo.png')
    # cambiar una frase y generar solo esa
    page.click('#stepper .stp[data-step=diseno]'); chip(page, 0).click(); page.keyboard.press('g'); page.wait_for_timeout(100)
    page.click('#stepper .stp[data-step=generar]'); page.wait_for_timeout(150)
    check(not page.locator('#f_genOnly').is_disabled() and page.locator('#btnGenAll').inner_text() == 'Generar 1 frase', 'solo las frases que cambiaron (1)')
    page.evaluate('window.__calls = []')
    page.click('#btnGenAll'); page.wait_for_timeout(300)
    calls = page.evaluate('window.__calls')
    head = json.loads(json.loads([c for c in calls if c.startswith('ES_begin')][0][len('ES_begin('):-1]))
    check(len([c for c in calls if c.startswith('ES_step')]) == 1 and head['replace']['mode'] == 'ranges', 'genera y reemplaza solo la frase cambiada')
    check(page.locator('#btnGenAll').inner_text() == 'Nada que generar', 'sin cambios no hay nada que generar')
    page.locator('#f_genOnly').click()
    check(page.locator('#btnGenAll').inner_text().startswith('Generar %d' % nseq()), 'apagar la opcion genera todo')
    # detener
    page.evaluate('window.__calls = []; window.__stepDelay = 400')
    page.click('#btnGenAll'); page.wait_for_timeout(150)
    check(page.locator('#btnStop').is_visible() and 'Creando la frase' in page.locator('#genView').inner_text(), 'progreso con Detener')
    page.screenshot(path=SHOTS + '/12_generando.png')
    page.click('#btnStop'); page.wait_for_timeout(900)
    calls = page.evaluate('window.__calls')
    check(any(c.startswith('ES_stop') for c in calls) and not any(c.startswith('ES_end') for c in calls), 'detener corta la generacion')
    check('Detenido' in page.locator('#genView .genResult').inner_text(), 'resultado: detenido')
    check(page.locator('#toast').is_visible() and 'Quitar' in page.locator('#toast').inner_text(), 'ofrece quitar lo ya creado')
    page.locator('#toast button', has_text='Quitar').click(); page.wait_for_timeout(100)
    page.evaluate('window.__stepDelay = 0')
    # error en una frase
    page.evaluate('window.__nstep = 0; window.__failAt = 2')
    page.click('#btnGenAll'); page.wait_for_timeout(400)
    res = page.locator('#genView .genResult').inner_text()
    check('No se pudo crear la frase 2' in res and 'Anton' in res, 'error: dice qué frase y por qué')
    page.screenshot(path=SHOTS + '/13_error.png')
    page.locator('#genView .genResult .pill', has_text='Ir a la frase').click(); page.wait_for_timeout(150)
    check(page.evaluate('window.__ES.ui.step') == 'diseno' and page.locator('#monTitle').inner_text().startswith('Frase 2 de'), 'Ir a la frase lleva a Diseño en esa frase')
    page.evaluate('window.__failAt = 0')
    # menu: atajos y empezar de nuevo
    page.click('#btnMore'); check(page.locator('#moreMenu').is_visible(), 'menu ⋯ con guardar, abrir y empezar de nuevo')
    page.click('#btnMore')

    # --- biblioteca de composiciones ---
    page.click('.tab[data-tab=library]'); page.wait_for_timeout(150)
    check(page.locator('#lib-comp').is_visible(), 'la biblioteca abre en Composiciones')
    check(page.locator('.libEmpty').is_visible(), 'estado vacio explica que hacer')
    page.click('#btnSaveComp'); page.wait_for_timeout(150)
    check(page.locator('#compSave').is_visible(), 'guardar composicion abre el formulario')
    check(page.locator('.choiceBtn.on', has_text='Capas seleccionadas').count() == 1, 'con capas seleccionadas propone precomponerlas')
    check('Se guardará tu proyecto' in page.locator('#compNote').inner_text(), 'avisa que se guardara el proyecto')
    page.locator('.choiceBtn', has_text='Composición activa').click()
    page.fill('#compName', 'Promo motos')
    page.screenshot(path=SHOTS + '/19_guardar_comp.png')
    page.click('#compSaveOk'); page.wait_for_timeout(300)
    save = [c for c in page.evaluate('window.__calls') if c.startswith('ES_libSave')][-1]
    check(json.loads(json.loads(save[len('ES_libSave('):-1]))['mode'] == 'comp', 'se guarda la composicion activa')
    check(page.locator('.ccard').count() == 1 and 'Promo motos' in page.locator('.ccard').inner_text(), 'aparece en la biblioteca')
    check('1080×1920' in page.locator('.ccard .cmeta').inner_text(), 'tarjeta con tamano y duracion')
    page.locator('.ccard .pill', has_text='Insertar').click(); page.wait_for_timeout(150)
    ins = [c for c in page.evaluate('window.__calls') if c.startswith('ES_libInsert')][-1]
    check('"insert"' in ins.replace('\\"', '"'), 'insertar en la composicion activa')
    page.locator('.ccard .pill', has_text='Abrir').click(); page.wait_for_timeout(150)
    ins = [c for c in page.evaluate('window.__calls') if c.startswith('ES_libInsert')][-1]
    check('"open"' in ins.replace('\\"', '"'), 'abrir para editar')
    page.screenshot(path=SHOTS + '/20_biblioteca_comp.png')
    # grupos
    page.locator('#grpBar .opt.add').click()
    page.fill('#grpBar .grpIn', 'Idealo'); page.keyboard.press('Enter'); page.wait_for_timeout(150)
    check(page.evaluate('window.__groups.length') == 1 and page.locator('#grpBar .opt.grp.on', has_text='Idealo').count() == 1, 'crear un grupo (queda seleccionado)')
    check(page.locator('.ccard').count() == 0 and 'vacío' in page.locator('#compGrid').inner_text(), 'grupo nuevo vacio con explicacion')
    page.locator('#grpBar .opt.grp', has_text='Todas').click()
    page.locator('.ccard .grpBtn').click(); page.wait_for_timeout(100)
    check(page.locator('#grpPop').is_visible(), 'menu mover a grupo')
    page.locator('#grpPop .it', has_text='Idealo').click(); page.wait_for_timeout(150)
    check(page.evaluate('window.__lib[0].group') == page.evaluate('window.__groups[0].id'), 'composicion movida al grupo')
    check(page.locator('.grpHead', has_text='Idealo').count() == 1, 'Todas muestra las composiciones por grupo')
    page.locator('#grpBar .opt.add').click()
    page.fill('#grpBar .grpIn', 'APPLEXBY'); page.keyboard.press('Enter'); page.wait_for_timeout(150)
    page.click('#btnSaveComp'); page.wait_for_timeout(150)
    check(page.locator('#compGroup').input_value() == page.evaluate('window.__groups[1].id'), 'guardar propone el grupo abierto')
    page.locator('.choiceBtn', has_text='Composición activa').click()
    page.fill('#compName', 'Intro APX'); page.click('#compSaveOk'); page.wait_for_timeout(300)
    check(page.evaluate("window.__lib.filter(function(x){return x.name==='Intro APX';})[0].group") == page.evaluate('window.__groups[1].id'), 'guardar directo en un grupo')
    check(page.locator('.ccard').count() == 1 and 'Intro APX' in page.locator('.ccard').inner_text(), 'el grupo muestra solo lo suyo')
    page.locator('#grpBar .opt.grp', has_text='Todas').click(); page.wait_for_timeout(100)
    page.screenshot(path=SHOTS + '/31_biblioteca_grupos.png')
    page.locator('#grpBar .opt.grp', has_text='Idealo').click()
    page.locator('#grpBar .grpTools button[title="Renombrar el grupo"]').click()
    page.fill('#grpBar .grpIn', 'Idealo Films'); page.keyboard.press('Enter'); page.wait_for_timeout(150)
    check(page.evaluate('window.__groups[0].name') == 'Idealo Films', 'renombrar grupo')
    page.locator('#grpBar .grpTools button[title="Borrar el grupo"]').click(); page.locator('#grpBar .grpTools .danger').click(); page.wait_for_timeout(150)
    check(page.evaluate('window.__groups.length') == 1 and page.evaluate("window.__lib.filter(function(x){return x.name==='Promo motos';})[0].group") == '', 'borrar grupo: sus composiciones pasan a Sin grupo')
    check(page.locator('#grpBar .opt.grp', has_text='Sin grupo').count() == 1, 'aparece Sin grupo')
    page.locator('#grpBar .opt.grp', has_text='Todas').click()
    while page.locator('.ccard').count():
        page.locator('.ccard button[title="Borrar"]').first.click(); page.locator('.ccard button[title="Pulsa otra vez para borrar"]').first.click(); page.wait_for_timeout(150)
    check(page.locator('.ccard').count() == 0, 'borrar de la biblioteca (doble clic)')

    # --- plantillas de texto ---
    page.click('.stab[data-lib=pres]')
    check(page.locator('.pcard').count() >= 4, 'biblioteca muestra el pack incluido')
    check(page.locator('.pcard .badge').count() >= 4, 'insignia de plantilla')
    page.click('#btnSavePres'); page.wait_for_timeout(100)
    check(page.locator('#presName').is_visible(), 'pide nombre tras leer capas de AE')
    page.fill('#presNameIn', 'Promo 2'); page.click('#presNameOk')
    check(any('Promo 2' in t for t in page.locator('.pcard .nm').all_inner_texts()), 'presentacion guardada en la biblioteca')
    check('2 textos' not in page.locator('.pcard', has_text='Promo 2').inner_text() and '1 texto' in page.locator('.pcard', has_text='Promo 2').inner_text(), 'resumen 1 texto - 1 forma')
    page.screenshot(path=SHOTS + '/11_biblioteca.png')
    # persiste tras recargar
    page.reload(); page.wait_for_timeout(300)
    page.click('.tab[data-tab=library]'); page.click('.stab[data-lib=pres]')
    check(any('Promo 2' in t for t in page.locator('.pcard .nm').all_inner_texts()), 'presentacion persiste al recargar el panel')
    page.locator('.pcard', has_text='Promo 2').locator('button[title="Borrar"]').click()
    page.locator('.pcard', has_text='Promo 2').locator('button[title="Pulsa otra vez para borrar"]').click()
    check(not any('Promo 2' in t for t in page.locator('.pcard .nm').all_inner_texts()), 'borrar presentacion (doble clic)')
    page.click('#btnPack')
    page.click('.stab[data-lib=snd]')
    check(page.locator('.snd').count() >= 13, 'biblioteca de sonidos')
    page.screenshot(path=SHOTS + '/12_sonidos.png')
    page.click('.tab[data-tab=editor]')

    # --- ajustes: aspecto de cada estilo ---
    page.click('#btnSettings'); page.wait_for_timeout(250)
    check(page.locator('#lookCard .lookSeg button').count() == 4 and page.locator('.styleBtn').count() == 0, 'ajustes: aspecto por estilo (la base se elige en Frases)')
    page.locator('#lookCard .lookSeg button', has_text='Caja').click()
    check(page.locator('#f_karBox').count() == 1, 'aspecto de la caja que recorre')
    page.locator('#lookCard .lookSeg button', has_text='APPLEXBY').click()
    check(page.locator('#f_apxFont').count() == 1 and page.locator('#f_apxTrack').count() == 1 and page.locator('#f_apxStroke').count() == 0, 'aspecto APPLEXBY (sin contorno)')
    check('No está instalada' in page.locator('.fontWarn').inner_text(), 'avisa si Archivo no esta instalada')
    page.locator('#lookCard .lookSeg button', has_text='Una línea').click()
    check(page.locator('#f_linSize').count() == 1, 'aspecto de una linea')
    page.locator('#lookCard .lookSeg button', has_text='Escalera').click()
    top0 = page.evaluate("document.querySelector('.phone .zone').style.top")
    page.evaluate("const r=document.getElementById('f_zoneTop'); r.value=40; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change'));")
    check(page.evaluate("document.querySelector('.phone .zone').style.top") == '40%' and top0 != '40%', 'el diagrama de margenes se mueve con el control')
    page.evaluate("const r=document.getElementById('f_zoneTop'); r.value=50; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change'));")
    page.locator('#settingsBody').evaluate('e => e.parentElement.scrollTop = 0')
    page.screenshot(path=SHOTS + '/25_ajustes.png')
    page.click('#btnCloseSettings')

    # --- ajustes ---
    page.click('#btnSettings')
    check(page.locator('#settings').is_visible() and page.locator('.fld').count() > 20, 'ajustes visibles')
    page.fill('#f_centerY', '58'); page.locator('#f_centerY').dispatch_event('change')
    page.screenshot(path=SHOTS + '/13_ajustes.png', full_page=False)
    page.click('#btnCloseSettings')
    check(page.evaluate('window.__ES.S.centerY') == 58, 'ajuste guardado')

    # --- atajos ---
    page.click('#btnMore'); page.click('#btnKeys'); page.wait_for_timeout(300)
    check(page.locator('#keys').is_visible() and page.locator('#keys kbd').count() > 20, 'panel de atajos desde el menu ⋯')
    page.screenshot(path=SHOTS + '/15_atajos.png')
    page.keyboard.press('Escape')
    check(not page.locator('#keys').is_visible(), 'Esc cierra atajos')

    # --- empezar de nuevo ---
    page.click('#btnMore'); page.click('#btnNew'); page.wait_for_timeout(150)
    check(page.locator('#empty').is_visible() and nseq() == 0, 'empezar de nuevo vuelve al paso Texto vacio')
    page.keyboard.press('Control+z'); page.wait_for_timeout(100)
    check(nseq() > 0, 'y se puede deshacer')

    # --- guardar / importar edicion ---
    exported = page.evaluate('JSON.stringify((function(){return window.__ES.st})())')
    check(len(exported) > 100, 'estado serializable')

    # sin errores de JS
    check(not errors, 'sin errores de JavaScript: %s' % errors)

    # --- vista reducida ---
    page.set_viewport_size({'width': 440, 'height': 800})
    page.click('.tab[data-tab=editor]')
    page.screenshot(path=SHOTS + '/14_final.png')
    b.close()

print('\n%d fallos' % len(fails))
sys.exit(1 if fails else 0)

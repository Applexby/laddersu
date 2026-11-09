"""Interfaz del panel en Chromium con After Effects simulado (requiere playwright)."""
import json, os, sys
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SHOTS = os.environ.get('SHOTS', '/tmp/shots')
SRT = open(os.path.join(ROOT, 'tests', 'sample.srt'), encoding='utf-8').read()

MOCK = r"""
window.__calls = [];
window.__lib = [];
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
    if (s.indexOf('ES_status')>=0) r = '{"engine":true,"fonts":true,"ver":"0.6.0","ev":"0.6.0","ae":"24.0"}';
    else if (s.indexOf('ES_compInfo')>=0) r = '{"ok":true,"name":"Reel","w":1080,"h":1920,"fps":30,"dur":60}';
    else if (s.indexOf('ES_listFonts')>=0) r = JSON.stringify({ok:true,fonts:[{n:'Arial-BoldMT',f:'Arial',s:'Bold'},{n:'Anton-Regular',f:'Anton',s:'Regular'},{n:'Montserrat-ExtraBold',f:'Montserrat',s:'ExtraBold'}]});
    else if (s.indexOf('ES_capture')>=0) r = JSON.stringify(window.__capture);
    else if (s.indexOf('ES_begin')>=0) { window.__calls.push(s); r = '{"ok":true,"run":"r1","removed":0,"comp":"Reel"}'; }
    else if (s.indexOf('ES_step')>=0) { window.__calls.push(s); r = '{"ok":true,"layers":3,"sfx":0}'; delay = window.__stepDelay; }
    else if (s.indexOf('ES_end')>=0) { window.__calls.push(s); r = '{"ok":true,"layers":12,"msg":"Listo: 12 capas en \\"Reel\\"."}'; }
    else if (s.indexOf('ES_stop')>=0) { window.__calls.push(s); r = '{"ok":true,"removed":5,"seqs":1}'; }
    else if (s.indexOf('ES_libList')>=0) r = JSON.stringify({ok:true, root:'C:/ud/Laddersu/biblioteca', items: window.__lib});
    else if (s.indexOf('ES_libState')>=0) r = JSON.stringify({ok:true, hasComp:true, comp:'Reel', sel:2, saved:true, dirty:true, project:'proyecto.aep'});
    else if (s.indexOf('ES_libSave')>=0) { var o = JSON.parse(argOf(s)); window.__calls.push(s); window.__lib.push({id:'c'+window.__lib.length, name:o.name, comp:o.name, w:1080, h:1920, dur:4, fps:30, files:2, created:Date.now(), thumb:''}); r = JSON.stringify({ok:true, id:'c1', name:o.name, files:2}); }
    else if (s.indexOf('ES_libInsert')>=0) { window.__calls.push(s); r = '{"ok":true,"msg":"Insertado en \\"Reel\\"."}'; }
    else if (s.indexOf('ES_libDelete')>=0) { var id = argOf(s); window.__lib = window.__lib.filter(function(x){return x.id!==id;}); r = '{"ok":true}'; }
    else if (s.indexOf('ES_libRename')>=0) { var o2 = JSON.parse(argOf(s)); window.__lib.forEach(function(x){ if (x.id===o2.id) x.name=o2.name; }); r = '{"ok":true}'; }
    else if (s.indexOf('ES_libReveal')>=0) r = '{"ok":true}';
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

    # --- vacio / importar ---
    check(page.locator('#empty').is_visible(), 'estado vacio visible')
    check(page.locator('#btnGenAll').is_disabled(), 'generar deshabilitado sin SRT')
    page.locator('summary').click()
    page.fill('#srtPaste', SRT); page.click('#btnParse')
    n = page.locator('.chip').count()
    check(n >= 10, 'chips renderizados (%d)' % n)
    check(not page.locator('#empty').is_visible(), 'estado vacio oculto')
    check(page.locator('.seq').count() >= 3, 'frases en filas')
    page.screenshot(path=SHOTS + '/01_editor.png')

    # --- seleccion: clic reemplaza; ctrl suma; shift rango ---
    chip(page, 0).click(); chip(page, 1).click()
    check(page.locator('.chip.sel').count() == 1, 'clic simple reemplaza (1 elegida)')
    chip(page, 3).click(modifiers=['Control'])
    check(page.locator('.chip.sel').count() == 2, 'Ctrl suma')
    chip(page, 3).click(modifiers=['Control'])
    check(page.locator('.chip.sel').count() == 1, 'Ctrl quita')
    chip(page, 0).click(); chip(page, 4).click(modifiers=['Shift'])
    check(page.locator('.chip.sel').count() == 5, 'Mayus elige rango de 5')
    check(page.locator('#selBar').inner_text().strip().startswith('5'), 'barra de seleccion cuenta')
    page.screenshot(path=SHOTS + '/02_seleccion.png')

    # --- menu en cascada: el submenu se abre AL LADO (no reemplaza el menu) ---
    def beside():
        r = page.locator('#ctx').bounding_box(); f = page.locator('#ctxFly').bounding_box()
        return (f['x'] >= r['x'] + r['width'] - 6) or (f['x'] + f['width'] <= r['x'] + 6)
    chip(page, 1).click()
    chip(page, 1).click(button='right')
    check(page.locator('#ctx').is_visible(), 'menu contextual abre')
    page.locator('#ctx .it[data-k=anim]').hover()
    page.wait_for_timeout(250)
    check(page.locator('#ctxFly').is_visible(), 'pasar el raton abre el submenu')
    check(page.locator('#ctx').is_visible(), 'el menu principal sigue abierto')
    check(beside(), 'el submenu queda al lado, sin taparlo')
    check(page.locator('#ctxFly .animPrev').is_visible(), 'vista previa de la animacion en el submenu')
    page.screenshot(path=SHOTS + '/03_menu_cascada.png')
    page.locator('#ctxFly .it', has_text='Pop').click()
    st = page.evaluate('window.__ES.st')
    check(st['seqs'][0]['words'][1]['c']['trans'] == 'pop', 'transicion Pop aplicada a palabra 2')
    check(page.locator('#toast').is_visible() and 'Deshacer' in page.locator('#toast').inner_text(), 'aviso con boton Deshacer')
    chip(page, 2).click()   # sin soltar la anterior
    chip(page, 2).click(button='right')
    page.locator('#ctx .it[data-k=anim]').click()
    page.locator('#ctxFly .it', has_text='Desenfoque').first.click()
    st = page.evaluate('window.__ES.st')
    check(st['seqs'][0]['words'][2]['c']['trans'] == 'blur', 'transicion distinta en la siguiente sin deseleccionar')
    check(st['seqs'][0]['words'][1]['c']['trans'] == 'pop', 'la anterior conserva la suya')

    # menu abierto cerca del borde derecho: se corre para que quepan los dos
    last_chip = page.locator('.chip').nth(3)
    bb = last_chip.bounding_box()
    page.mouse.click(430, bb['y'] + 5, button='right') if False else None
    last_chip.click(button='right', position={'x': bb['width'] - 3, 'y': 5})
    page.evaluate("""() => { const m = document.getElementById('ctx'); m.style.left = (window.innerWidth - m.offsetWidth - 6) + 'px'; }""")
    page.locator('#ctx .it[data-k=sound]').click()
    check(beside(), 'cerca del borde: el menu se corre y el submenu cabe al lado')
    fb = page.locator('#ctxFly').bounding_box()
    check(fb['x'] >= 0 and fb['x'] + fb['width'] <= 441, 'submenu dentro del panel')
    page.keyboard.press('Escape'); page.keyboard.press('Escape')

    # teclado dentro del menu
    chip(page, 0).click(); page.keyboard.press('Shift+F10')
    check(page.locator('#ctx').is_visible(), 'Mayus+F10 abre el menu')
    for _ in range(4): page.keyboard.press('ArrowDown')
    kb = page.locator('#ctx .it.kb').inner_text()
    page.keyboard.press('ArrowRight')
    check(page.locator('#ctxFly').is_visible(), 'flecha derecha abre el submenu (%s)' % kb.strip())
    page.keyboard.press('ArrowLeft')
    check(not page.locator('#ctxFly').is_visible() and page.locator('#ctx').is_visible(), 'flecha izquierda vuelve al menu')
    page.keyboard.press('Escape')

    # --- destacar / estilo / color ---
    chip(page, 0).click(); chip(page, 0).click(button='right')
    page.locator('#ctx .quick button', has_text='Destacar').click()
    c0 = page.evaluate('window.__ES.st.seqs[0].words[0].c')
    check(c0['size'] == 'L' and c0['brand'] and c0['glow'], 'Destacar = L + estrella + brillo')
    page.locator('#ctx .it[data-k=style]').hover(); page.wait_for_timeout(250)
    page.screenshot(path=SHOTS + '/04_estilo.png')
    page.locator('#ctxFly .seg button', has_text='Subrayado').click()
    check(page.evaluate('window.__ES.st.seqs[0].words[0].c.fmt') == 'underline', 'formato subrayado desde Estilo')
    check(page.locator('#ctxFly').is_visible(), 'el submenu de estilo sigue abierto para seguir ajustando')
    page.locator('#ctx .it[data-k=color]').hover(); page.wait_for_timeout(350)
    page.locator('#ctxFly .sw button').nth(3).click()
    check(page.evaluate('window.__ES.st.seqs[0].words[0].c.color') != '', 'color elegido desde paleta')
    page.locator('#ctxFly .tabsMini button', has_text='Brillo').click()
    page.locator('#ctxFly .sw button').nth(6).click()
    check(page.evaluate('window.__ES.st.seqs[0].words[0].c.glowColor') != '', 'color del brillo')
    page.screenshot(path=SHOTS + '/05_color.png')
    page.keyboard.press('Escape'); page.keyboard.press('Escape')
    check(not page.locator('#ctx').is_visible(), 'Esc cierra el menu')

    # --- fuente por palabra ---
    chip(page, 0).click(button='right')
    page.locator('#ctx .it[data-k=font]').click()
    page.wait_for_timeout(100)
    page.locator('#ctxFly .fpRow', has_text='Anton').click()
    check(page.evaluate('window.__ES.st.seqs[0].words[0].c.font') == 'Anton-Regular', 'fuente instalada elegida por palabra')

    # --- quitar por partes ---
    chip(page, 0).click()
    if page.evaluate('window.__ES.st.seqs[0].words[0].c.fmt') != 'box': page.keyboard.press('b')
    if not page.evaluate('window.__ES.st.seqs[0].words[0].c.glow'): page.keyboard.press('g')
    c0 = page.evaluate('window.__ES.st.seqs[0].words[0].c')
    check(c0['fmt'] == 'box' and c0['glow'], 'palabra con caja y brillo')
    chip(page, 0).click(button='right')
    page.locator('#ctx .it[data-k=remove]').hover(); page.wait_for_timeout(250)
    labels = page.locator('#ctxFly .it').all_inner_texts()
    check(any('Brillo' in x for x in labels) and any('Caja' in x for x in labels) and not any('Sonido' in x for x in labels), 'Quitar lista solo lo aplicado')
    page.screenshot(path=SHOTS + '/21_quitar.png')
    page.locator('#ctxFly .it', has_text='Brillo').click()
    c0 = page.evaluate('window.__ES.st.seqs[0].words[0].c')
    check(c0['glow'] is False and c0['fmt'] == 'box' and c0['font'] == 'Anton-Regular', 'quita solo el brillo (caja y fuente quedan)')
    check(page.locator('#ctxFly').is_visible() and not any('Brillo' in x for x in page.locator('#ctxFly .it').all_inner_texts()), 'el submenu sigue abierto y se actualiza')
    page.keyboard.press('Escape'); page.keyboard.press('Escape')

    # --- estilo de la frase: caja que recorre ---
    chip(page, 0).click(button='right')
    page.locator('#ctx .it[data-k=seqstyle]').click()
    page.locator('#ctxFly .it', has_text='Caja que recorre').click()
    check(page.evaluate('window.__ES.st.seqs[0].style') == 'karaoke', 'frase con estilo caja que recorre')
    page.keyboard.press('Escape'); page.keyboard.press('Escape')
    page.evaluate("document.getElementById('tab-editor').scrollTop = 0")
    chip(page, 1).click(); page.wait_for_timeout(100)
    check('Caja que recorre' in page.locator('#monMeta').inner_text(), 'la vista previa muestra el estilo')
    check(len(page.evaluate('window.__ES.hits')) == len(page.evaluate('window.__ES.st.seqs[0].words')), 'vista previa con todas las palabras')
    page.locator('#monitor').screenshot(path=SHOTS + '/22_karaoke_preview.png')
    page.click('#monPlay'); page.wait_for_timeout(700)
    page.locator('#monitor').screenshot(path=SHOTS + '/23_karaoke_play.png')
    page.wait_for_timeout(1500)

    # --- estilo APPLEXBY en una frase ---
    chip(page, 0).click(button='right')
    page.locator('#ctx .it[data-k=seqstyle]').click()
    page.locator('#ctxFly .it', has_text='APPLEXBY').click()
    check(page.evaluate('window.__ES.st.seqs[0].style') == 'applexby', 'frase con estilo APPLEXBY')
    page.keyboard.press('Escape'); page.keyboard.press('Escape')
    page.evaluate("document.getElementById('tab-editor').scrollTop = 0")
    chip(page, 1).click(); page.wait_for_timeout(100)
    check('APPLEXBY' in page.locator('#monMeta').inner_text(), 'la vista previa muestra el estilo APPLEXBY')
    check(len(page.evaluate('window.__ES.hits')) == len(page.evaluate('window.__ES.st.seqs[0].words')), 'vista previa APPLEXBY con todas las palabras')
    page.locator('#monitor').screenshot(path=SHOTS + '/28_applexby_preview.png')
    page.click('#monPlay'); page.wait_for_timeout(450)
    page.locator('#monitor').screenshot(path=SHOTS + '/29_applexby_play.png')
    page.wait_for_timeout(1800)
    chip(page, 0).click(button='right')
    page.locator('#ctx .it[data-k=seqstyle]').click()
    page.locator('#ctxFly .it', has_text='Usar el de la edición').click()
    page.keyboard.press('Escape'); page.keyboard.press('Escape')

    # --- aviso de actualizacion ---
    page.evaluate("window.__ES.showUpdate('9.9.9')")
    check(page.locator('#updBar').is_visible() and '9.9.9' in page.locator('#updBar').inner_text(), 'aviso de version nueva en el panel')
    page.screenshot(path=SHOTS + '/30_aviso_actualizacion.png')
    page.locator('#updBar .pill', has_text='Actualizar').click()
    check(page.evaluate('window.__opened') == ['com.idealo.laddersu.updater'], 'Actualizar abre el panel de actualizaciones')
    page.locator('#updBar .iconBtn').click()
    check(not page.locator('#updBar').is_visible(), 'el aviso se puede ocultar')
    page.evaluate("window.__ES.showUpdate('9.9.9')")
    check(not page.locator('#updBar').is_visible(), 'una version ocultada no vuelve a avisar')
    page.evaluate("window.__bus['com.idealo.laddersu.updated']({data: JSON.stringify({kind:'installed', version:'9.9.9'})})")
    check('instalada' in page.locator('#updBar').inner_text() and page.locator('#updBar .pill', has_text='Recargar').count() == 1, 'tras instalar ofrece recargar el panel')
    page.locator('#updBar .iconBtn').click()

    # --- editar texto ---
    chip(page, 1).dblclick()
    check(page.locator('#ctxFly input[type=text]').is_visible(), 'doble clic abre editar texto al lado')
    page.fill('#ctxFly input[type=text]', 'seríamos'); page.keyboard.press('Enter')
    check(page.evaluate('window.__ES.st.seqs[0].words[1].text') == 'seríamos', 'texto editado')

    # --- barra de seleccion y atajos ---
    chip(page, 2).click()
    page.keyboard.press('3')
    check(page.evaluate('window.__ES.st.seqs[0].words[2].c.size') == 'L', 'tecla 3 = tamano L')
    page.keyboard.press('k')
    check(page.evaluate('window.__ES.st.seqs[0].words[2].c.brand') is True, 'tecla K = palabra clave')
    page.locator('#selBar .q[aria-label="Caja (B)"]').click()
    check(page.evaluate('window.__ES.st.seqs[0].words[2].c.fmt') == 'box', 'barra de seleccion: caja')
    page.locator('#selBar .q[aria-label="Tamaño S (tecla 1)"]').click()
    check(page.evaluate('window.__ES.st.seqs[0].words[2].c.size') == 'S', 'barra de seleccion: tamano S')
    page.keyboard.press('Control+z')
    check(page.evaluate('window.__ES.st.seqs[0].words[2].c.size') == 'L', 'Ctrl+Z deshace')
    page.keyboard.press('Control+y')
    check(page.evaluate('window.__ES.st.seqs[0].words[2].c.size') == 'S', 'Ctrl+Y rehace')
    page.keyboard.press('ArrowRight')
    sel_ids = page.evaluate('Object.keys(window.__ES.sel.m)')
    w3 = page.evaluate('window.__ES.st.seqs[0].words[3].id')
    check(sel_ids == [str(w3)], 'flecha derecha pasa a la siguiente palabra')
    page.locator('#selBar .q[aria-label="Animación de entrada"]').click()
    check(page.locator('#ctxFly').is_visible() and page.locator('#ctxFly .animPrev').count() == 1, 'barra: boton de animacion abre su submenu')
    page.screenshot(path=SHOTS + '/06_barra_anim.png')
    page.keyboard.press('Escape'); page.keyboard.press('Escape')

    # --- vista previa ---
    check(page.locator('#monitor').is_visible(), 'vista previa visible')
    hits = page.evaluate('window.__ES.hits')
    check(len(hits) == len(page.evaluate('window.__ES.st.seqs[0].words')), 'vista previa dibuja todas las palabras de la frase')
    hb = page.locator('#monCanvas').bounding_box(); h0 = hits[0]
    page.mouse.click(hb['x'] + (h0['x0'] + h0['x1']) / 2, hb['y'] + (h0['y0'] + h0['y1']) / 2)
    check(page.evaluate('Object.keys(window.__ES.sel.m)') == [str(page.evaluate('window.__ES.st.seqs[0].words[0].id'))], 'clic en la vista previa elige la palabra')
    page.click('#monNext')
    check(page.locator('#monMeta').inner_text().startswith('2/'), 'navegar a la frase siguiente')
    page.click('#monPrev')
    page.click('#monPlay'); page.wait_for_timeout(300)
    page.screenshot(path=SHOTS + '/07_reproduciendo.png')
    page.wait_for_timeout(2500)
    page.screenshot(path=SHOTS + '/08_editor.png')

    # --- cortar / unir con barra ---
    nseq = page.locator('.seq').count()
    chip(page, 2).click(); page.click('#btnCut')
    check(page.locator('.seq').count() == nseq + 1, 'Cortar crea una frase')
    page.click('#btnJoin')
    check(page.locator('.seq').count() == nseq, 'Unir la vuelve a juntar')

    # --- deshacer ---
    page.keyboard.press('Control+z')
    check(page.locator('.seq').count() == nseq + 1, 'Ctrl+Z deshace la union')
    page.keyboard.press('Control+z')
    check(page.locator('.seq').count() == nseq, 'Ctrl+Z deshace el corte')

    # --- mover palabra a otra frase con arrastrar y soltar ---
    ids0 = page.evaluate('window.__ES.st.seqs.map(s=>s.words.map(w=>w.id))')
    moving = ids0[0][0]; before = len(ids0[1])
    src = page.locator('.chip[data-id="%d"]' % moving)
    dst = page.locator('.chip[data-id="%d"]' % ids0[1][1])
    src.drag_to(dst)
    after = page.evaluate('window.__ES.st.seqs.map(s=>s.words.map(w=>w.id))')
    found = [i for i, s in enumerate(after) if moving in s]
    check(len(found) == 1 and moving in after[found[0]] and found[0] != 0 or (len(ids0[0]) == 1 and found == [0]), 'arrastrar mueve la palabra a otra frase (%s)' % found)
    # a una frase nueva con el hueco entre filas
    ids1 = page.evaluate('window.__ES.st.seqs.map(s=>s.words.map(w=>w.id))')
    k = [i for i, q in enumerate(ids1) if len(q) >= 2][0]
    mv2 = ids1[k][-1]; ns = len(ids1)
    page.locator('.chip[data-id="%d"]' % mv2).drag_to(page.locator('.gap').nth(0), force=True)
    ns2 = page.evaluate('window.__ES.st.seqs.length')
    first_ids = page.evaluate('window.__ES.st.seqs[0].words.map(w=>w.id)')
    check(ns2 == ns + 1 and first_ids == [mv2], 'soltar en el hueco crea una frase nueva (%d->%d)' % (ns, ns2))
    page.keyboard.press('Control+z'); page.keyboard.press('Control+z')

    # --- recuadro de seleccion ---
    page.evaluate("document.getElementById('tab-editor').scrollTop = 0")
    first = page.locator('.chip').first.bounding_box(); lastb = page.locator('.chip').nth(3).bounding_box()
    page.mouse.move(first['x'] - 20, first['y'] - 6)
    page.mouse.down(); page.mouse.move(lastb['x'] + lastb['width'] + 4, lastb['y'] + lastb['height'] + 4, steps=6); page.mouse.up()
    check(page.locator('.chip.sel').count() >= 3, 'recuadro selecciona palabras (%d)' % page.locator('.chip.sel').count())

    # --- presentaciones: aplicar desde menu ---
    chip(page, 0).click(); chip(page, 1).click(modifiers=['Shift'])
    chip(page, 1).click(button='right')
    page.locator('#ctx .it[data-k=pres]').click()
    page.screenshot(path=SHOTS + '/09_presentaciones_menu.png')
    page.locator('#ctxFly .it', has_text='Caja destacada').click()
    check(page.locator('.seq.pres').count() == 1, 'frase con presentacion marcada')
    check('caja destacada' in page.locator('.presTag').first.inner_text().lower(), 'etiqueta de presentacion')
    page.screenshot(path=SHOTS + '/10_editor_pres.png')

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
    page.locator('.ccard button[title="Borrar"]').click(); page.locator('.ccard button[title="Pulsa otra vez para borrar"]').click(); page.wait_for_timeout(150)
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

    # --- ajustes rediseñados ---
    page.click('#btnSettings'); page.wait_for_timeout(250)
    check(page.locator('.styleBtn').count() == 3, 'ajustes: eleccion visual del estilo de edicion (3 estilos)')
    page.locator('.styleBtn', has_text='Caja que recorre').click()
    check(page.evaluate('window.__ES.S.editStyle') == 'karaoke' and page.locator('#f_karBox').count() == 1, 'estilo global caja + sus opciones')
    page.screenshot(path=SHOTS + '/24_ajustes_estilo.png')
    page.locator('.styleBtn', has_text='APPLEXBY').click()
    check(page.evaluate('window.__ES.S.editStyle') == 'applexby' and page.locator('#f_apxFont').count() == 1 and page.locator('#f_apxSize').count() == 1, 'estilo global APPLEXBY + sus opciones')
    check(page.locator('#f_apxFont').input_value() == 'Archivo-Bold', 'fuente por defecto Archivo Bold')
    check('No está instalada' in page.locator('.fontWarn').inner_text(), 'avisa si Archivo no esta instalada')
    page.screenshot(path=SHOTS + '/27_ajustes_applexby.png')
    page.locator('.styleBtn', has_text='Escalera').click()
    top0 = page.evaluate("document.querySelector('.phone .zone').style.top")
    page.evaluate("const r=document.getElementById('f_zoneTop'); r.value=40; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change'));")
    check(page.evaluate("document.querySelector('.phone .zone').style.top") == '40%' and top0 != '40%', 'el diagrama de margenes se mueve con el control')
    page.evaluate("const r=document.getElementById('f_zoneTop'); r.value=50; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change'));")
    page.locator('#settingsBody').evaluate('e => e.parentElement.scrollTop = 0')
    page.screenshot(path=SHOTS + '/25_ajustes.png')
    page.evaluate("document.getElementById('settings').scrollTop = 700"); page.wait_for_timeout(100)
    page.screenshot(path=SHOTS + '/26_ajustes2.png')
    page.click('#btnCloseSettings')

    # --- ajustes ---
    page.click('#btnSettings')
    check(page.locator('#settings').is_visible() and page.locator('.fld').count() > 20, 'ajustes visibles')
    page.fill('#f_centerY', '58'); page.locator('#f_centerY').dispatch_event('change')
    page.screenshot(path=SHOTS + '/13_ajustes.png', full_page=False)
    page.click('#btnCloseSettings')
    check(page.evaluate('window.__ES.S.centerY') == 58, 'ajuste guardado')

    # --- atajos ---
    page.keyboard.press('?'); page.wait_for_timeout(300)
    check(page.locator('#keys').is_visible() and page.locator('#keys kbd').count() > 20, 'panel de atajos con ?')
    page.screenshot(path=SHOTS + '/15_atajos.png')
    page.keyboard.press('Escape')
    check(not page.locator('#keys').is_visible(), 'Esc cierra atajos')

    # --- generar (por pasos) ---
    page.locator('.chip').first.click()
    page.click('#btnGenSel')
    page.wait_for_timeout(300)
    calls = page.evaluate('window.__calls')
    begins = [c for c in calls if c.startswith('ES_begin')]; steps = [c for c in calls if c.startswith('ES_step')]
    check(len(begins) == 1 and len(steps) == 1 and any(c.startswith('ES_end') for c in calls), 'generar seleccion: begin + 1 paso + end')
    head = json.loads(json.loads(begins[0][len('ES_begin('):-1]))
    check(head['cfg']['zone']['centerY'] == 0.58 and head['cfg']['zone']['top'] == 0.5, 'zona segura viaja en el trabajo')
    check(head['replace']['mode'] == 'ranges', 'generar seleccion reemplaza solo esas frases')
    seq0 = json.loads(json.loads(steps[0][len('ES_step('):-1]))[0]
    check('cls' in seq0 and 'words' in seq0 and seq0['style'] in ('lockup', 'karaoke'), 'cada paso lleva palabras, clases y estilo')
    page.evaluate('window.__calls = []')
    page.click('#btnGenAll'); page.wait_for_timeout(400)
    calls = page.evaluate('window.__calls')
    head2 = json.loads(json.loads([c for c in calls if c.startswith('ES_begin')][0][len('ES_begin('):-1]))
    check(head2['replace']['mode'] == 'all', 'generar todo reemplaza lo generado antes')
    check(head2['pres'], 'las plantillas viajan con el trabajo')
    nsteps = len([c for c in calls if c.startswith('ES_step')])
    check(nsteps == page.evaluate('window.__ES.st.seqs.length'), 'un paso por frase (%d)' % nsteps)
    check('Listo' in page.locator('#msgApply').inner_text(), 'mensaje de resultado')
    # detener a mitad
    page.evaluate('window.__calls = []; window.__stepDelay = 400')
    page.click('#btnGenAll'); page.wait_for_timeout(150)
    check('Detener' in page.locator('#btnGenAll').inner_text(), 'el boton cambia a Detener con progreso')
    page.screenshot(path=SHOTS + '/17_detener.png')
    page.click('#btnGenAll'); page.wait_for_timeout(900)
    calls = page.evaluate('window.__calls')
    check(any(c.startswith('ES_stop') for c in calls) and not any(c.startswith('ES_end') for c in calls), 'detener corta la generacion')
    nst = len([c for c in calls if c.startswith('ES_step')])
    check(nst < page.evaluate('window.__ES.st.seqs.length'), 'no se crean las frases restantes (%d pasos)' % nst)
    check('Detenido' in page.locator('#msgApply').inner_text(), 'mensaje de detenido')
    check(page.locator('#toast').is_visible() and 'Quitar' in page.locator('#toast').inner_text(), 'ofrece quitar lo ya creado')
    page.screenshot(path=SHOTS + '/18_detenido.png')
    page.locator('#toast button', has_text='Quitar').click(); page.wait_for_timeout(100)
    check(any('true' in c for c in page.evaluate('window.__calls') if c.startswith('ES_stop')), 'Quitar borra lo creado en esa tanda')
    check(page.locator('#btnGenAll').inner_text().strip() == 'Generar edición', 'el boton vuelve a Generar edición')
    page.evaluate('window.__stepDelay = 0')
    page.click('#btnLog'); check(page.locator('#logBox li').count() >= 3, 'registro con entradas')

    # --- guardar / importar edicion ---
    exported = page.evaluate('JSON.stringify((function(){return window.__ES.st})())')
    check(len(exported) > 100, 'estado serializable')

    # sin errores de JS
    check(not errors, 'sin errores de JavaScript: %s' % errors)

    # --- vista reducida ---
    page.set_viewport_size({'width': 440, 'height': 800})
    page.click('.tab[data-tab=editor]')
    page.locator('.chip').nth(2).click()
    page.screenshot(path=SHOTS + '/14_final.png')
    b.close()

print('\n%d fallos' % len(fails))
sys.exit(1 if fails else 0)

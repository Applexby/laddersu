// After Effects simulado (lo minimo para ejecutar jsx/host.jsx en Node)
var vm = require('vm'), fs = require('fs'), path = require('path');

function create() {
  var A = {};
  var PT = { PROPERTY: 6212, INDEXED_GROUP: 6213, NAMED_GROUP: 6214 };
  var PVT = { NO_VALUE: 1, ThreeD_SPATIAL: 2, ThreeD: 3, TwoD_SPATIAL: 4, TwoD: 5, OneD: 6, COLOR: 7, CUSTOM_VALUE: 8, MARKER: 9, LAYER_INDEX: 10, MASK_INDEX: 11, SHAPE: 12, TEXT_DOCUMENT: 13 };
  A.PropertyType = PT; A.PropertyValueType = PVT;
  A.KeyframeInterpolationType = { LINEAR: 6612, BEZIER: 6613, HOLD: 6614 };
  A.ParagraphJustification = { LEFT_JUSTIFY: 7413, CENTER_JUSTIFY: 7415, RIGHT_JUSTIFY: 7414 };
  A.KeyframeEase = function (s, i) { this.speed = s; this.influence = i; };
  A.Shape = function () { this.vertices = []; this.inTangents = []; this.outTangents = []; this.closed = true; };

  function clone(v) { return v instanceof Array ? v.slice() : v; }
  function Prop(m, vt, val) { this.matchName = m; this.name = m; this.propertyType = PT.PROPERTY; this.propertyValueType = vt; this.value = val; this.keys = []; this.isModified = false; this.expression = ''; this.expressionEnabled = false; }
  Prop.prototype.setValue = function (v) { this.value = clone(v); this.isModified = true; };
  Prop.prototype.setValueAtTime = function (t, v) { this.keys.push({ t: t, v: clone(v), it: 6613, ot: 6613, ei: new A.KeyframeEase(0, 33), eo: new A.KeyframeEase(0, 33) }); this.keys.sort(function (a, b) { return a.t - b.t; }); this.isModified = true; };
  Object.defineProperty(Prop.prototype, 'numKeys', { get: function () { return this.keys.length; } });
  Prop.prototype.keyTime = function (k) { return this.keys[k - 1].t; };
  Prop.prototype.keyValue = function (k) { return this.keys[k - 1].v; };
  Prop.prototype.keyInInterpolationType = function (k) { return this.keys[k - 1].it; };
  Prop.prototype.keyOutInterpolationType = function (k) { return this.keys[k - 1].ot; };
  Prop.prototype.keyInTemporalEase = function (k) { return [this.keys[k - 1].ei]; };
  Prop.prototype.keyOutTemporalEase = function (k) { return [this.keys[k - 1].eo]; };
  Prop.prototype.setInterpolationTypeAtKey = function (k, a, b) { this.keys[k - 1].it = a; this.keys[k - 1].ot = b; };
  Prop.prototype.setTemporalEaseAtKey = function (k, a, b) { this.keys[k - 1].ei = a[0]; this.keys[k - 1].eo = b[0]; };

  function Group(m, indexed, adds) { this.matchName = m; this.name = m; this.propertyType = indexed ? PT.INDEXED_GROUP : PT.NAMED_GROUP; this.kids = []; this.adds = adds || []; this.enabled = true; }
  Object.defineProperty(Group.prototype, 'numProperties', { get: function () { return this.kids.length; } });
  Group.prototype.property = function (x) {
    var i;
    if (typeof x === 'number') { return this.kids[x - 1] || null; }
    for (i = 0; i < this.kids.length; i++) { if (this.kids[i].matchName === x) { return this.kids[i]; } }
    return null;
  };
  Group.prototype.canAddProperty = function (m) { return this.adds.indexOf(m) >= 0; };
  Group.prototype.addProperty = function (m) {
    if (!this.canAddProperty(m)) { throw new Error('no se puede agregar ' + m + ' a ' + this.matchName); }
    var g = tmpl(m); g.parent = this;
    this.kids.unshift(g);                       // AE inserta arriba
    return g;
  };
  Prop.prototype.remove = Group.prototype.remove = function () { var p = this.parent; if (p) { p.kids.splice(p.kids.indexOf(this), 1); } };

  function P1(m, v) { return new Prop(m, PVT.OneD, v); }
  function P2(m, v) { return new Prop(m, PVT.TwoD, v); }
  function PC(m, v) { return new Prop(m, PVT.COLOR, v); }
  function G(m, kids, indexed, adds) { var g = new Group(m, indexed, adds); kids.forEach(function (k) { k.parent = g; g.kids.push(k); }); return g; }
  var VECS = ['ADBE Vector Group', 'ADBE Vector Shape - Rect', 'ADBE Vector Shape - Ellipse', 'ADBE Vector Shape - Group', 'ADBE Vector Graphic - Fill', 'ADBE Vector Graphic - Stroke'];

  function tmpl(m) {
    var g, sp;
    switch (m) {
      case 'ADBE Vector Group': return G(m, [G('ADBE Vectors Group', [], true, VECS), G('ADBE Vector Transform Group', [P2('ADBE Vector Anchor', [0, 0]), P2('ADBE Vector Position', [0, 0]), P2('ADBE Vector Scale', [100, 100]), P1('ADBE Vector Rotation', 0), P1('ADBE Vector Group Opacity', 100)])]);
      case 'ADBE Vector Shape - Rect': return G(m, [P2('ADBE Vector Rect Size', [100, 100]), P2('ADBE Vector Rect Position', [0, 0]), P1('ADBE Vector Rect Roundness', 0)]);
      case 'ADBE Vector Shape - Ellipse': return G(m, [P2('ADBE Vector Ellipse Size', [100, 100]), P2('ADBE Vector Ellipse Position', [0, 0])]);
      case 'ADBE Vector Graphic - Fill': return G(m, [PC('ADBE Vector Fill Color', [1, 0, 0, 1]), P1('ADBE Vector Fill Opacity', 100)]);
      case 'ADBE Vector Graphic - Stroke': return G(m, [PC('ADBE Vector Stroke Color', [1, 1, 1, 1]), P1('ADBE Vector Stroke Width', 2)]);
      case 'ADBE Drop Shadow': return G(m, [PC('ADBE Drop Shadow-0001', [0, 0, 0, 1]), P1('ADBE Drop Shadow-0002', 127), P1('ADBE Drop Shadow-0003', 135), P1('ADBE Drop Shadow-0004', 5), P1('ADBE Drop Shadow-0005', 0), P1('ADBE Drop Shadow-0006', 0)]);
      case 'ADBE Gaussian Blur 2': return G(m, [P1('ADBE Gaussian Blur 2-0001', 0), P1('ADBE Gaussian Blur 2-0002', 1)]);
      case 'ADBE Text Animator': return G(m, [G('ADBE Text Selectors', [G('ADBE Text Selector', [P1('ADBE Text Percent Start', 0)])], true, ['ADBE Text Selector']), G('ADBE Text Animator Properties', [], false, ['ADBE Text Opacity', 'ADBE Text Position 3D'])]);
      case 'ADBE Text Selector': return G(m, [P1('ADBE Text Percent Start', 0)]);
      case 'ADBE Text Opacity': return P1(m, 100);
      case 'ADBE Text Position 3D': return new Prop(m, PVT.ThreeD, [0, 0, 0]);
    }
    throw new Error('plantilla desconocida ' + m);
  }

  function Layer(kind, name, comp) {
    this.kind = kind; this.name = name; this.comp = comp; this.comment = ''; this.locked = false; this.inPoint = 0; this.outPoint = comp.duration; this.startTime = 0; this.guideLayer = false;
    var tr = G('ADBE Transform Group', [P2('ADBE Anchor Point', [0, 0]), new Prop('ADBE Position', PVT.TwoD_SPATIAL, [comp.width / 2, comp.height / 2]), P2('ADBE Scale', [100, 100]), P1('ADBE Rotate Z', 0), P1('ADBE Opacity', 100)]);
    this.root = [tr, G('ADBE Effect Parade', [], true, ['ADBE Drop Shadow', 'ADBE Gaussian Blur 2'])];
    if (kind === 'text') {
      var doc = new Prop('ADBE Text Document', PVT.TEXT_DOCUMENT, null);
      doc.setValue = function (v) { this.value = v; this.owner.td = v; };
      this.root.push(G('ADBE Text Properties', [doc, G('ADBE Text Animators', [], true, ['ADBE Text Animator'])]));
      this.td = null; this.docProp = doc; doc.owner = this;
    }
    if (kind === 'shape') { this.root.push(G('ADBE Root Vectors Group', [], true, VECS)); }
    if (kind === 'audio') { this.root.push(G('ADBE Audio Group', [P2('ADBE Audio Levels', [0, 0])])); }
  }
  Layer.prototype.property = function (m) { var i; for (i = 0; i < this.root.length; i++) { if (this.root[i].matchName === m) { return this.root[i]; } } return null; };
  Layer.prototype.sourceRectAtTime = function () {
    var td = this.td || { text: '', fontSize: 50 }, px = td.fontSize, w = td.text.length * px * 0.55;
    return { left: 0, top: -px * 0.8, width: w, height: px };
  };
  Layer.prototype.remove = function () { if (this.locked) { throw new Error('capa bloqueada'); } var l = this.comp.layerList; l.splice(l.indexOf(this), 1); };
  Layer.prototype.moveAfter = function (o) { var l = this.comp.layerList; l.splice(l.indexOf(this), 1); l.splice(l.indexOf(o) + 1, 0, this); };
  Object.defineProperty(Layer.prototype, 'index', { get: function () { return this.comp.layerList.indexOf(this) + 1; } });

  function TextLayer() {} function ShapeLayer() {} function CompItem() {} function FolderItem() {} function FootageItem() {}
  A.TextLayer = TextLayer; A.ShapeLayer = ShapeLayer; A.CompItem = CompItem; A.FolderItem = FolderItem; A.FootageItem = FootageItem;

  A.newComp = function (w, h, dur, fps) {
    var c = new CompItem(); c.width = w; c.height = h; c.duration = dur; c.frameRate = fps || 30; c.name = 'Comp'; c.layerList = []; c.selectedLayers = [];
    function mk(kind, name, proto) {
      var L = new Layer(kind, name, c); if (proto) { L.__proto__ = Object.create(Layer.prototype); L.__proto__.constructor = proto; }
      return L;
    }
    c.layers = {
      addText: function (t) { var L = mk('text', t, TextLayer); L.__proto__ = Object.create(Layer.prototype); Object.setPrototypeOf(L, mkProto(TextLayer)); L.td = { text: t, fontSize: 50, font: '', fillColor: [1, 1, 1], applyFill: true, applyStroke: false, justification: 7413, tracking: 0, resetCharStyle: function () {} }; L.docProp.value = L.td; c.layerList.unshift(L); return L; },
      addShape: function () { var L = mk('shape', 'Shape', ShapeLayer); Object.setPrototypeOf(L, mkProto(ShapeLayer)); c.layerList.unshift(L); return L; },
      add: function (item) { var L = mk('audio', item.name, FootageItem); Object.setPrototypeOf(L, mkProto(FootageItem)); c.layerList.unshift(L); return L; }
    };
    c.openInViewer = function () { A.viewer = c; };
    c.layer = function (i) { return c.layerList[i - 1]; };
    c.time = 0; c.workAreaStart = 0; c.workAreaDuration = dur;
    c.saveFrameToPng = function (t, f) { fs.writeFileSync(f.path, Buffer.from([137, 80, 78, 71])); };
    c.layers.precompose = function (idx, name) {
      var nc = A.newComp(c.width, c.height, c.duration, c.frameRate); nc.name = name; A.addItem(nc);
      var moving = idx.map(function (i) { return c.layerList[i - 1]; });
      moving.forEach(function (L) { c.layerList.splice(c.layerList.indexOf(L), 1); L.comp = nc; nc.layerList.push(L); });
      var pl = mk('precomp', name, FootageItem); Object.setPrototypeOf(pl, mkProto(FootageItem)); pl.source = nc;
      c.layerList.splice(Math.min.apply(null, idx) - 1, 0, pl);
      return nc;
    };
    var addRaw = c.layers.add;
    c.layers.add = function (item) { var L = addRaw(item); L.source = item; return L; };
    Object.defineProperty(c, 'numLayers', { get: function () { return c.layerList.length; } });
    return c;
  };
  var protos = {};
  function mkProto(ctor) { if (!protos[ctor.name]) { var p = Object.create(Layer.prototype); Object.defineProperty(p, 'constructor', { value: ctor }); protos[ctor.name] = Object.create(ctor.prototype); Object.setPrototypeOf(protos[ctor.name], Layer.prototype); } return protos[ctor.name]; }
  // instanceof: los prototipos de TextLayer/ShapeLayer heredan de Layer.prototype y de su ctor
  [TextLayer, ShapeLayer, FootageItem].forEach(function (ctor) { var p = mkProto(ctor); ctor.prototype = p; });

  A.items = []; var nextId = 1;
  var root = new FolderItem(); root.name = 'Raiz'; root.id = 0;
  A.addItem = function (it) { it.id = nextId++; if (!it.parentFolder) { it.parentFolder = root; } A.items.push(it); return it; };
  A.snapshots = {};
  A.app = { version: '24.0', fonts: { allFonts: [[{ postScriptName: 'Arial-BoldMT', familyName: 'Arial', styleName: 'Bold' }]] }, project: null, beginUndoGroup: function () {}, endUndoGroup: function () {} };
  var P = A.app.project = { activeItem: null, file: null, dirty: false, rootFolder: root,
    item: function (i) { return A.items[i - 1]; },
    itemByID: function (id) { return A.items.filter(function (x) { return x.id === id; })[0] || null; },
    items: { addFolder: function (n) { var f = new FolderItem(); f.name = n; return A.addItem(f); },
             addComp: function (n, w, h, pa, d, fps) { var c = A.newComp(w, h, d, fps); c.name = n; A.addItem(c); P.activeItem = c; return c; } },
    save: function (f) {
      if (f) { P.file = f; }
      if (!P.file) { throw new Error('sin archivo'); }
      A.snapshots[P.file.path] = { items: A.items.slice(), active: P.activeItem };
      var comps = A.items.filter(function (x) { return x instanceof CompItem; }).map(function (c) { return { name: c.name, w: c.width, h: c.height, dur: c.duration, fps: c.frameRate, n: c.layerList.length }; });
      var foot = A.items.filter(function (x) { return x instanceof FootageItem && x.file; }).map(function (x) { return x.file.path; });
      fs.writeFileSync(P.file.path, JSON.stringify({ comps: comps, footage: foot }));
      P.dirty = false;
    },
    reduceProject: function (keep) {
      var need = [];
      (function add(it) { if (need.indexOf(it) >= 0) { return; } need.push(it); if (it.layerList) { it.layerList.forEach(function (L) { if (L.source) { add(L.source); } }); } })(keep[0]);
      A.items = A.items.filter(function (x) { return need.indexOf(x) >= 0; });
      P.dirty = true;
    },
    open: function (f) { var sn = A.snapshots[f.path]; if (!sn) { throw new Error('no existe ' + f.path); } A.items = sn.items.slice(); P.file = f; P.activeItem = sn.active; P.dirty = false; A.opened = (A.opened || 0) + 1; },
    importFile: function (io) {
      if (/\.aep$/i.test(io.file.path)) {
        var data = JSON.parse(fs.readFileSync(io.file.path, 'utf8'));
        var folder = new FolderItem(); folder.name = path.basename(io.file.path); A.addItem(folder);
        data.comps.forEach(function (d) { var c = A.newComp(d.w, d.h, d.dur, d.fps); c.name = d.name; c.parentFolder = folder; A.addItem(c); });
        return folder;
      }
      var f = new FootageItem(); f.name = path.basename(io.file.path); return A.addItem(f);
    } };
  A.app.open = function (f) { P.open(f); return P; };
  Object.defineProperty(P, 'numItems', { get: function () { return A.items.length; } });
  return A;
}

function load(opts) {
  opts = opts || {};
  var A = create(), ctx = {};
  var k;
  for (k in A) { ctx[k] = A[k]; }
  var TMP = opts.tmp || fs.mkdtempSync(require('os').tmpdir() + '/esae-');
  function File(p) {
    if (!(this instanceof File)) { return new File(p); }
    this.path = String(p); this.fullName = this.path; this.fsName = this.path; this.name = path.basename(this.path);
    this.parent = new Folder(path.dirname(this.path)); this.encoding = 'UTF-8'; this._buf = '';
  }
  Object.defineProperty(File.prototype, 'exists', { get: function () { return /^\/sfx\//.test(this.path) || /host\.jsx$|engine\.js$/.test(this.path) && fs.existsSync(this.path) || fs.existsSync(this.path); } });
  File.prototype.open = function (m) { this._m = m; this._buf = m === 'r' ? fs.readFileSync(this.path, 'utf8') : ''; return true; };
  File.prototype.read = function () { return this._buf; };
  File.prototype.write = function (t) { this._buf += t; };
  File.prototype.close = function () { if (this._m === 'w') { fs.writeFileSync(this.path, this._buf); } };
  File.prototype.copy = function (dst) { fs.copyFileSync(this.path, dst.path || dst); return true; };
  File.prototype.remove = function () { fs.unlinkSync(this.path); return true; };
  function Folder(p) { if (!(this instanceof Folder)) { return new Folder(p); } this.path = String(p); this.fullName = this.path; this.fsName = this.path; this.name = path.basename(this.path); }
  Object.defineProperty(Folder.prototype, 'exists', { get: function () { return fs.existsSync(this.path); } });
  Folder.prototype.create = function () { fs.mkdirSync(this.path, { recursive: true }); return true; };
  Folder.prototype.getFiles = function () { var me = this; return fs.readdirSync(me.path).map(function (n) { var q = me.path + '/' + n; return fs.statSync(q).isDirectory() ? new Folder(q) : new File(q); }); };
  Folder.prototype.remove = function () { fs.rmdirSync(this.path); return true; };
  Folder.prototype.execute = function () { A.revealed = this.path; return true; };
  Folder.userData = new Folder(TMP);
  ctx.File = File; ctx.Folder = Folder; ctx.TMP = TMP;
  ctx.ImportOptions = function (f) { this.file = f; };
  ctx.$ = { fileName: path.resolve(__dirname, '../extension/jsx/host.jsx').replace(/\\/g, '/'), evalFile: function (f) { var src = fs.readFileSync(f.path, 'utf8'); vm.runInContext(src.replace(/if \(typeof module[\s\S]*$/, ''), ctx); } };
  ctx.Math = Math;
  vm.createContext(ctx);
  var engine = fs.readFileSync(path.resolve(__dirname, '../extension/jsx/engine.js'), 'utf8');
  if (!opts.noEngine) { vm.runInContext(engine.replace(/if \(typeof module[\s\S]*$/, '') + ';', ctx); }
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../extension/jsx/host.jsx'), 'utf8'), ctx);
  return { ctx: ctx, A: A, tmp: TMP, File: File, call: function (fn, arg) { return vm.runInContext(fn + '(' + (arg === undefined ? '' : JSON.stringify(arg)) + ')', ctx); } };
}
module.exports = { load: load };

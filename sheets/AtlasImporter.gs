/**
 * ATLAS importer — Google Apps Script bound to a spreadsheet (e.g. "Farmeos").
 *
 * Reads the JSON files the bookmarklets download into "Agentic Development/inbox", writes them into
 * sheets, and moves each processed file to "Agentic Development/data/<subsystem>/".
 * Every file carries its schema ("spymaster.reports.v1", …); HANDLERS maps a schema to the function
 * that writes it. Adding an exporter = adding one handler (see "Adding an exporter" in sheets/README.md).
 *
 * Runs as the person who installs it, with their Drive permissions. Menu: ATLAS → Import now.
 */

var CONFIG = {
  ROOT_FOLDER_NAME: 'Agentic Development', // or set script property ROOT_FOLDER_ID
  INBOX: 'inbox',
  DATA: 'data',
  TZ: 'Europe/Madrid',
};

// ---------- Handlers by schema ----------
var HANDLERS = {
  'spymaster.reports.v1': importSpymaster_,
};

// ---------- Menu and triggers ----------
function onOpen() {
  SpreadsheetApp.getUi().createMenu('ATLAS')
    .addItem('Import now', 'importInbox')
    .addItem('Import automatically every 15 min', 'installTrigger')
    .addItem('Stop automatic import', 'removeTrigger')
    .addToUi();
}

function installTrigger() {
  removeTrigger();
  ScriptApp.newTrigger('importInbox').timeBased().everyMinutes(15).create();
  toast_('Automatic import every 15 minutes is on.');
}

function removeTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'importInbox') ScriptApp.deleteTrigger(t); });
}

// ---------- Inbox loop ----------
function importInbox() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    var root = rootFolder_();
    var inbox = subfolder_(root, CONFIG.INBOX);
    var files = inbox.getFiles();
    var done = [], skipped = [];
    while (files.hasNext()) {
      var f = files.next();
      if (!/\.json$/i.test(f.getName())) continue;
      var env;
      try { env = JSON.parse(f.getBlob().getDataAsString()); } catch (e) { skipped.push(f.getName() + ' (not JSON)'); continue; }
      var handler = HANDLERS[env && env.schema];
      if (!handler) { skipped.push(f.getName() + ' (no handler for ' + (env && env.schema) + ')'); continue; }
      var summary = handler(env, f.getName());
      f.moveTo(subfolder_(subfolder_(root, CONFIG.DATA), env.schema.split('.')[0]));
      done.push(f.getName() + ': ' + summary);
    }
    if (done.length || skipped.length) toast_((done.concat(skipped.map(function (s) { return 'skipped ' + s; }))).join('\n'));
    else toast_('Inbox is empty.');
  } finally {
    lock.releaseLock();
  }
}

// ---------- Spymaster → "Hoja 1" (one row per target) + "Historial" (one row per report) ----------
var HISTORY_HEADER = ['ID informe', 'Fecha', 'Misión', 'Ubicación', 'Recurso Isla', 'Ciudad', 'Jugador', 'Alianza', 'Madera', 'Vino', 'Mármol', 'Cristal', 'Azufre',
  'Depósito', 'Seguro', 'Muralla', 'Inactivo', 'Saqueable', 'Barcos', 'Ejército', 'Espiado por', 'Archivo'];

function importSpymaster_(env, fileName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hist = ss.getSheetByName('Historial') || createHistory_(ss);
  var seen = {};
  if (hist.getLastRow() > 1) hist.getRange(2, 1, hist.getLastRow() - 1, 1).getValues().forEach(function (r) { seen[String(r[0])] = true; });
  var rows = historyRows_(env, fileName, seen);
  if (rows.length) {
    var r0 = hist.getLastRow() + 1;
    hist.getRange(r0, 1, rows.length, HISTORY_HEADER.length).setValues(rows);
    hist.getRange(r0, 2, rows.length, 1).setNumberFormat('dd/MM/yyyy HH:mm');
    hist.getRange(r0, 9, rows.length, 10).setNumberFormat('#,##0');
  }

  var sh = ss.getSheets()[0];
  var grid = sh.getDataRange().getValues();
  var plan = planTargets_(env, grid);
  plan.updates.forEach(function (u) {
    Object.keys(u.cells).forEach(function (c) { sh.getRange(u.row + 1, +c + 1).setValue(u.cells[c]); });
  });
  if (plan.appends.length) {
    var start = Math.max(sh.getLastRow(), plan.headerRow + 1) + 1;
    sh.getRange(start, 1, plan.appends.length, plan.width).setValues(plan.appends);
  }
  formatTargets_(sh, plan);
  return rows.length + ' new reports, ' + plan.updates.length + ' targets updated, ' + plan.appends.length + ' added';
}

function createHistory_(ss) {
  var h = ss.insertSheet('Historial');
  h.getRange(1, 1, 1, HISTORY_HEADER.length).setValues([HISTORY_HEADER]).setFontWeight('bold');
  h.setFrozenRows(1);
  return h;
}

function formatTargets_(sh, plan) {
  var last = sh.getLastRow();
  if (last <= plan.headerRow + 1) return;
  var n = last - plan.headerRow - 1, c = plan.cols;
  ['madera', 'vino', 'marmol', 'cristal', 'azufre', 'seguro'].forEach(function (k) {
    if (c[k] != null) sh.getRange(plan.headerRow + 2, c[k] + 1, n, 1).setNumberFormat('#,##0');
  });
  if (c['fecha intel'] != null) sh.getRange(plan.headerRow + 2, c['fecha intel'] + 1, n, 1).setNumberFormat('dd/MM');
}

// ---------- Pure functions (unit-tested in tests/importer.test.mjs) ----------
var LUX_ES = { wine: 'Vino', marble: 'Mármol', glass: 'Cristal', sulfur: 'Azufre' };

function norm_(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

function loot_(res, safe) {
  if (!res || safe == null) return null;
  return ['wood', 'wine', 'marble', 'glass', 'sulfur'].reduce(function (s, k) { return s + Math.max(0, (res[k] || 0) - safe); }, 0);
}

function unitsText_(units) {
  return Object.keys(units || {}).map(function (k) { return k + ' ' + units[k]; }).join(', ');
}

function historyRows_(env, fileName, seen) {
  var targets = env.payload.targets || {};
  var out = [];
  (env.payload.reports || []).forEach(function (r) {
    var key = r.id || [r.target.cityId, r.date, r.mission].join('-');
    if (seen[key]) return;
    seen[key] = true;
    var t = targets[r.target.cityId] || {};
    var res = r.resources || {};
    var lootable = loot_(r.resources, t.safe);
    out.push([key, r.date ? new Date(r.date) : (r.dateText || ''), r.mission, coords_(r.target), LUX_ES[t.tradegood] || '', r.target.city, r.target.player || '', t.alliance || '',
      r.resources ? res.wood || 0 : '', r.resources ? res.wine || 0 : '', r.resources ? res.marble || 0 : '', r.resources ? res.glass || 0 : '', r.resources ? res.sulfur || 0 : '',
      t.warehouseTotal != null ? t.warehouseTotal : '', t.safe != null ? t.safe : '', t.wall != null ? t.wall : '', t.inactive ? 'sí' : '',
      lootable != null ? lootable : '', lootable != null ? Math.ceil(lootable / 500) : '', unitsText_(r.units), r.spiedBy || env.player || '', fileName]);
  });
  return out;
}

function coords_(t) { return t.x != null && t.y != null ? '(' + t.x + ':' + t.y + ')' : ''; }

/**
 * Plan the writes to the targets sheet. grid = all values of the sheet (2-D array).
 * Columns are found by header name, so the layout can change. Never touches columns it does not own
 * (FECHA DE SAQUEO, Observaciones, and any column it does not know).
 */
function planTargets_(env, grid) {
  var headerRow = -1, cols = {};
  for (var i = 0; i < Math.min(grid.length, 10) && headerRow < 0; i++) {
    for (var j = 0; j < grid[i].length; j++) if (norm_(grid[i][j]) === 'ubicacion') { headerRow = i; break; }
  }
  if (headerRow < 0) throw new Error('No header row with "Ubicación" in the first sheet');
  grid[headerRow].forEach(function (h, j) { if (norm_(h)) cols[norm_(h)] = j; });
  var width = grid[headerRow].length;
  var keyOf = function (loc, city) { return norm_(loc) + '|' + norm_(city); };
  var existing = {};
  for (var r = headerRow + 1; r < grid.length; r++) {
    var loc = grid[r][cols['ubicacion']], city = grid[r][cols['ciudad']];
    if (norm_(loc) || norm_(city)) existing[keyOf(loc, city)] = r;
  }

  // latest warehouse and garrison report per target
  var byTarget = {};
  (env.payload.reports || []).forEach(function (rep) {
    var k = rep.target.cityId || keyOf(coords_(rep.target), rep.target.city);
    var b = byTarget[k] = byTarget[k] || { target: rep.target, cityId: rep.target.cityId };
    if (rep.mission === 'warehouse' && (!b.wh || String(rep.date) > String(b.wh.date))) b.wh = rep;
    if (rep.mission === 'garrison' && (!b.gar || String(rep.date) > String(b.gar.date))) b.gar = rep;
  });

  var updates = [], appends = [];
  Object.keys(byTarget).forEach(function (k) {
    var b = byTarget[k], t = (env.payload.targets || {})[b.cityId] || {};
    var cells = {};
    var set = function (name, v) { if (cols[name] != null && v != null && v !== '') cells[cols[name]] = v; };
    set('ubicacion', coords_(b.target)); set('ciudad', b.target.city); set('jugador', b.target.player);
    set('recurso isla', LUX_ES[t.tradegood]); set('alianza', t.alliance);
    set('deposito', t.warehouseTotal); set('seguro', t.safe); set('muralla', t.wall);
    var row = existing[keyOf(coords_(b.target), b.target.city)];
    var newer = function (rep) {
      if (!rep || !rep.date) return false;
      if (row == null || cols['fecha intel'] == null) return true;
      var cur = parseSheetDate_(grid[row][cols['fecha intel']], new Date(rep.date));
      return !cur || new Date(rep.date) > cur;
    };
    if (b.wh && newer(b.wh)) {
      set('madera', b.wh.resources.wood); set('vino', b.wh.resources.wine); set('marmol', b.wh.resources.marble);
      set('cristal', b.wh.resources.glass); set('azufre', b.wh.resources.sulfur);
      set('fecha intel', new Date(b.wh.date)); set('espiado por', b.wh.spiedBy || env.player);
    }
    if (b.gar) set('ejercito', unitsText_(b.gar.units) + (b.gar.date ? ' (' + fmtDay_(new Date(b.gar.date)) + ')' : ''));
    if (row != null) { if (Object.keys(cells).length) updates.push({ row: row, cells: cells }); }
    else {
      var line = []; for (var c = 0; c < width; c++) line.push(cells[c] != null ? cells[c] : '');
      appends.push(line);
    }
  });
  return { headerRow: headerRow, cols: cols, width: width, updates: updates, appends: appends };
}

function fmtDay_(d) { return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2); }

/** Sheet cell → Date. Accepts Date objects and "dd/MM" or "dd/MM/yyyy" text (year taken from `ref` when missing). */
function parseSheetDate_(v, ref) {
  if (v instanceof Date) return v;
  var m = String(v || '').match(/^\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*$/);
  if (!m) return null;
  var y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : (ref || new Date()).getFullYear();
  return new Date(y, +m[2] - 1, +m[1]); // start of day: a report from that same day counts as newer

}

// ---------- Drive helpers ----------
function rootFolder_() {
  var id = PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER_ID');
  if (id) return DriveApp.getFolderById(id);
  var it = DriveApp.getFoldersByName(CONFIG.ROOT_FOLDER_NAME);
  if (!it.hasNext()) throw new Error('Folder "' + CONFIG.ROOT_FOLDER_NAME + '" not found; set script property ROOT_FOLDER_ID');
  return it.next();
}

function subfolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function toast_(msg) {
  try { SpreadsheetApp.getActiveSpreadsheet().toast(msg, 'ATLAS', 10); } catch (e) { Logger.log(msg); }
}

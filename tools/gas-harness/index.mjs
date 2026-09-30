// A small fake of the Google Apps Script runtime, just enough to run apps-script/Code.gs in Node.
// Code.gs is loaded with node:vm, so the real script answers; only Google's services are faked.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const CODE_PATH = new URL('../../apps-script/Code.gs', import.meta.url);
const ID_COLUMNS = { Hotels: 'hotel_id', Visits: 'visit_id', Photos: 'photo_id', Wishlist: 'wish_id', Letters: 'letter_id', Settings: 'key' };
const isBlank = (v) => v === '' || v === null || v === undefined;
const isDate = (v) => Object.prototype.toString.call(v) === '[object Date]';
const norm = (h) => String(h ?? '').trim().toLowerCase();

// ---------------------------------------------------------------- Utilities

export function formatDate(date, timeZone, pattern) {
  const d = new Date(date.getTime());
  const tz = timeZone === 'GMT' ? 'UTC' : timeZone;
  const parts = {};
  for (const p of new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(d)) parts[p.type] = p.value;
  const wallMs = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offsetMin = Math.round((wallMs - Math.floor(d.getTime() / 1000) * 1000) / 60000);
  const sign = offsetMin < 0 ? '-' : '+';
  const abs = Math.abs(offsetMin);
  const tokens = {
    yyyy: parts.year.padStart(4, '0'), MM: parts.month, dd: parts.day, HH: parts.hour, mm: parts.minute,
    ss: parts.second, SSS: String(d.getUTCMilliseconds()).padStart(3, '0'),
    Z: `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}${String(abs % 60).padStart(2, '0')}`,
  };
  let out = '';
  for (let i = 0; i < pattern.length;) {
    const ch = pattern[i];
    if (ch === "'") {
      const end = pattern.indexOf("'", i + 1);
      out += pattern.slice(i + 1, end < 0 ? undefined : end);
      i = end < 0 ? pattern.length : end + 1;
      continue;
    }
    let j = i;
    while (j < pattern.length && pattern[j] === ch) j++;
    const run = pattern.slice(i, j);
    out += tokens[run] ?? run;
    i = j;
  }
  return out;
}

const toSigned = (buf) => Array.from(buf, (b) => (b > 127 ? b - 256 : b));
const toBuffer = (data) => (typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(Array.from(data, (b) => b & 255)));

function makeBlob(data, contentType = 'application/octet-stream', name = null) {
  let bytes = toBuffer(data ?? []);
  let type = contentType;
  let blobName = name;
  const blob = {
    getBytes: () => toSigned(bytes),
    getContentType: () => type,
    setContentType: (t) => { type = t; return blob; },
    getName: () => blobName,
    setName: (n) => { blobName = n; return blob; },
    getDataAsString: () => bytes.toString('utf8'),
    setBytes: (b) => { bytes = toBuffer(b); return blob; },
  };
  return blob;
}

function makeUtilities() {
  return {
    formatDate,
    base64Encode: (data) => toBuffer(data).toString('base64'),
    base64Decode: (s) => {
      if (!/^[A-Za-z0-9+/=_\-\s]*$/.test(s)) throw new Error('Could not decode string.');
      return toSigned(Buffer.from(s, 'base64'));
    },
    newBlob: (data, contentType, name) => makeBlob(data, contentType, name),
    getUuid: () => randomUUID(),
    sleep: () => {},
  };
}

// ---------------------------------------------------------------- Spreadsheet

class FakeRange {
  constructor(sheet, row, col, numRows, numCols) {
    Object.assign(this, { sheet, row, col, numRows, numCols });
  }
  getSheet() { return this.sheet; }
  getRow() { return this.row; }
  getColumn() { return this.col; }
  getNumRows() { return this.numRows; }
  getNumColumns() { return this.numCols; }
  getLastRow() { return this.row + this.numRows - 1; }
  getLastColumn() { return this.col + this.numCols - 1; }
  getValues() {
    const out = [];
    for (let r = 0; r < this.numRows; r++) {
      const line = [];
      for (let c = 0; c < this.numCols; c++) line.push(this.sheet._get(this.row + r, this.col + c));
      out.push(line);
    }
    return out;
  }
  getValue() { return this.sheet._get(this.row, this.col); }
  getFormulas() { return this.getValues().map((line) => line.map(() => '')); }
  getDisplayValues() { return this.getValues().map((line) => line.map((v) => (isBlank(v) ? '' : String(v)))); }
  setValues(values) {
    if (!Array.isArray(values) || values.length !== this.numRows) {
      throw new Error(`The number of rows in the data does not match the number of rows in the range. The data has ${values?.length} but the range has ${this.numRows}.`);
    }
    values.forEach((line, r) => {
      if (!Array.isArray(line) || line.length !== this.numCols) {
        throw new Error(`The number of columns in the data does not match the number of columns in the range. The data has ${line?.length} but the range has ${this.numCols}.`);
      }
      line.forEach((v, c) => this.sheet._set(this.row + r, this.col + c, v));
    });
    return this;
  }
  setValue(v) { this.sheet._set(this.row, this.col, v); return this; }
  setDataValidation(rule) { this.sheet._validations.push({ range: this._box(), rule }); return this; }
  setNumberFormat(format) { this.sheet._formats.push({ range: this._box(), format }); return this; }
  setFontWeight(weight) { this.sheet._fontWeights.push({ range: this._box(), weight }); return this; }
  _box() { return { row: this.row, col: this.col, numRows: this.numRows, numCols: this.numCols }; }
}

class FakeSheet {
  constructor(ss, name) {
    this._ss = ss;
    this._name = name;
    this._data = [];
    this._maxRows = 1000;
    this._maxCols = 26;
    this._frozen = 0;
    this._validations = [];
    this._formats = [];
    this._fontWeights = [];
  }
  getName() { return this._name; }
  setName(n) { this._name = n; return this; }
  getParent() { return this._ss; }
  getLastRow() {
    for (let r = this._data.length - 1; r >= 0; r--) if ((this._data[r] || []).some((v) => !isBlank(v))) return r + 1;
    return 0;
  }
  getLastColumn() {
    let max = 0;
    for (const line of this._data) {
      for (let c = (line || []).length - 1; c >= max; c--) if (!isBlank(line[c])) { max = c + 1; break; }
    }
    return max;
  }
  getMaxRows() { return this._maxRows; }
  getMaxColumns() { return this._maxCols; }
  getFrozenRows() { return this._frozen; }
  setFrozenRows(n) { this._frozen = n; return this; }
  getDataRange() { return this.getRange(1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); }
  getRange(row, col, numRows = 1, numCols = 1) {
    if (typeof row !== 'number') throw new Error('A1 notation is not supported by the fake');
    for (const [n, what] of [[row, 'row'], [col, 'column'], [numRows, 'number of rows'], [numCols, 'number of columns']]) {
      if (!Number.isInteger(n) || n < 1) throw new Error(`The ${what} of the range must be at least 1 (got ${n}).`);
    }
    if (row + numRows - 1 > this._maxRows) throw new Error('Those rows are out of bounds.');
    if (col + numCols - 1 > this._maxCols) throw new Error('Those columns are out of bounds.');
    return new FakeRange(this, row, col, numRows, numCols);
  }
  appendRow(values) {
    const r = this.getLastRow() + 1;
    if (r > this._maxRows) this._maxRows = r;
    if (values.length > this._maxCols) this._maxCols = values.length;
    values.forEach((v, c) => this._set(r, c + 1, v));
    return this;
  }
  insertRowsAfter(after, n) {
    if (after < this._data.length) this._data.splice(after, 0, ...Array.from({ length: n }, () => []));
    this._maxRows += n;
    return this;
  }
  insertRowAfter(after) { return this.insertRowsAfter(after, 1); }
  insertColumnsAfter(after, n) {
    for (const line of this._data) if (line && line.length > after) line.splice(after, 0, ...Array(n).fill(''));
    this._maxCols += n;
    return this;
  }
  insertColumnAfter(after) { return this.insertColumnsAfter(after, 1); }
  deleteRows(row, n) {
    if (row < 1 || row + n - 1 > this._maxRows) throw new Error('Those rows are out of bounds.');
    this._data.splice(row - 1, n);
    this._maxRows -= n;
    return this;
  }
  deleteRow(row) { return this.deleteRows(row, 1); }
  _get(r, c) { const v = this._data[r - 1]?.[c - 1]; return v === undefined || v === null ? '' : v; }
  _set(r, c, v) {
    if (v !== null && v !== undefined && typeof v === 'object' && !isDate(v)) {
      throw new Error(`Cannot write an object/array into a cell (${JSON.stringify(v)}).`);
    }
    while (this._data.length < r) this._data.push([]);
    const line = this._data[r - 1] || (this._data[r - 1] = []);
    while (line.length < c) line.push('');
    line[c - 1] = v === null || v === undefined ? '' : v;
  }
}

class FakeSpreadsheet {
  constructor(timeZone) {
    this._id = 'SS-' + randomUUID();
    this._tz = timeZone;
    this._sheets = [];
  }
  getId() { return this._id; }
  getName() { return 'Suite Nothings'; }
  getUrl() { return `https://docs.google.com/spreadsheets/d/${this._id}/edit`; }
  getSpreadsheetTimeZone() { return this._tz; }
  getSheets() { return [...this._sheets]; }
  getSheetByName(name) { return this._sheets.find((s) => s.getName() === name) || null; }
  insertSheet(name) {
    if (this.getSheetByName(name)) throw new Error(`A sheet with the name "${name}" already exists.`);
    const sheet = new FakeSheet(this, name);
    this._sheets.push(sheet);
    return sheet;
  }
}

function sheetHelper(env, name) {
  const fake = () => env.spreadsheet.getSheetByName(name);
  const colIndex = (column) => {
    const sheet = fake();
    const header = sheet ? sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0] : [];
    const idx = header.findIndex((h) => norm(h) === norm(column));
    if (idx < 0) throw new Error(`No column "${column}" in ${name}`);
    return idx + 1;
  };
  const coverage = (list, col) => [...list].reverse().find(({ range: b }) => b.row <= 2 && b.row + b.numRows - 1 >= 2 && b.col <= col && b.col + b.numCols - 1 >= col);
  const helper = {
    exists: () => !!fake(),
    fake,
    raw: () => {
      const sheet = fake();
      if (!sheet) return [];
      const rows = sheet.getLastRow(), cols = sheet.getLastColumn();
      return rows && cols ? sheet.getRange(1, 1, rows, cols).getValues() : [];
    },
    headers: () => (helper.raw()[0] || []).map((h) => String(h).trim()),
    rows: () => {
      const [header = [], ...body] = helper.raw();
      return body.filter((line) => line.some((v) => !isBlank(v))).map((line) => {
        const obj = {};
        header.forEach((h, i) => { const k = String(h).trim(); if (k && !(k in obj)) obj[k] = line[i]; });
        return obj;
      });
    },
    setRaw: (values) => {
      const sheet = fake() || env.spreadsheet.insertSheet(name);
      sheet._data = values.map((line) => [...line]);
      sheet._maxRows = Math.max(sheet._maxRows, values.length);
      sheet._maxCols = Math.max(sheet._maxCols, ...values.map((l) => l.length));
      return helper;
    },
    rowOf: (id, idColumn = ID_COLUMNS[name]) => {
      const raw = helper.raw();
      const idx = (raw[0] || []).findIndex((h) => norm(h) === norm(idColumn));
      const r = idx < 0 ? -1 : raw.findIndex((line, i) => i > 0 && String(line[idx]).trim() === String(id));
      return r < 0 ? null : r + 1;
    },
    cell: (row, column) => fake().getRange(row, colIndex(column)).getValue(),
    /** Types a value into a cell like a person would, then fires onEdit(e). */
    editCell: (row, column, value) => {
      const range = fake().getRange(row, colIndex(column));
      const oldValue = range.getValue();
      range.setValue(value);
      if (typeof env.context.onEdit === 'function') {
        env.context.onEdit({ range, source: env.spreadsheet, value, oldValue, user: { getEmail: () => 'owner@example.com' } });
      }
    },
    validation: (column) => {
      const hit = coverage(fake()._validations, colIndex(column));
      return hit ? { list: hit.rule.list, allowInvalid: hit.rule.allowInvalid, showDropdown: hit.rule.showDropdown } : null;
    },
    numberFormat: (column) => coverage(fake()._formats, colIndex(column))?.format ?? null,
    frozenRows: () => fake().getFrozenRows(),
    headerBold: () => fake()._fontWeights.some(({ range, weight }) => range.row === 1 && weight === 'bold'),
  };
  return helper;
}

// ---------------------------------------------------------------- Drive

function makeDrive() {
  const files = new Map();
  const folders = new Map();
  let n = 0;
  const iterator = (list) => { let i = 0; return { hasNext: () => i < list.length, next: () => list[i++] }; };
  const folderApi = (rec) => {
    const api = {
      getId: () => rec.id,
      getName: () => rec.name,
      isTrashed: () => rec.trashed,
      setTrashed: (t) => { rec.trashed = !!t; return api; },
      createFile: (blob) => fileApi(addFile({ name: blob.getName() || 'untitled', mime: blob.getContentType(), bytes: toBuffer(blob.getBytes()), folderId: rec.id })),
      getFiles: () => iterator([...files.values()].filter((f) => f.parents.includes(rec.id)).map(fileApi)),
    };
    return api;
  };
  const fileApi = (rec) => {
    const api = {
      getId: () => rec.id,
      getName: () => rec.name,
      getMimeType: () => rec.mime,
      getSize: () => rec.bytes.length,
      getBlob: () => makeBlob(rec.bytes, rec.mime, rec.name),
      getParents: () => iterator(rec.parents.filter((id) => folders.has(id)).map((id) => folderApi(folders.get(id)))),
      isTrashed: () => rec.trashed,
      setTrashed: (t) => { rec.trashed = !!t; return api; },
    };
    return api;
  };
  function addFile({ name, mime = 'application/octet-stream', data, bytes, folderId = null }) {
    const rec = { id: `FILE-${++n}-${randomUUID().slice(0, 8)}`, name, mime, bytes: bytes ?? toBuffer(data ?? ''), parents: folderId ? [folderId] : [], trashed: false };
    files.set(rec.id, rec);
    return rec;
  }
  const notFound = () => new Error('No item with the given ID could be found. Possibly because you have not edited this item or you do not have permission to access it.');
  const DriveApp = {
    createFolder: (name) => {
      const rec = { id: `FOLDER-${++n}-${randomUUID().slice(0, 8)}`, name, trashed: false };
      folders.set(rec.id, rec);
      return folderApi(rec);
    },
    getFolderById: (id) => { if (!folders.has(id)) throw notFound(); return folderApi(folders.get(id)); },
    getFileById: (id) => { if (!files.has(id)) throw notFound(); return fileApi(files.get(id)); },
  };
  return { DriveApp, files, folders, addFile: (opts) => addFile(opts).id };
}

// ---------------------------------------------------------------- Maps

const BURJ = {
  formatted_address: 'Burj Al Arab - Jumeirah St - Umm Suqeim 3 - Dubai - United Arab Emirates',
  geometry: { location: { lat: 25.141291, lng: 55.185348 } },
  address_components: [
    { long_name: 'Burj Al Arab', short_name: 'Burj Al Arab', types: ['establishment', 'point_of_interest', 'lodging'] },
    { long_name: 'Umm Suqeim 3', short_name: 'Umm Suqeim 3', types: ['sublocality', 'political'] },
    { long_name: 'Dubai', short_name: 'Dubai', types: ['locality', 'political'] },
    { long_name: 'Dubai', short_name: 'Dubai', types: ['administrative_area_level_1', 'political'] },
    { long_name: 'United Arab Emirates', short_name: 'AE', types: ['country', 'political'] },
  ],
};

function makeMaps(geocoder) {
  return {
    newGeocoder: () => {
      const g = {
        setBounds: (...b) => { geocoder.lastBounds = b; return g; },
        setRegion: (r) => { geocoder.lastRegion = r; return g; },
        setLanguage: () => g,
        geocode: (query) => {
          geocoder.queries.push(query);
          const key = Object.keys(geocoder.canned).find((k) => String(query).toLowerCase().includes(k.toLowerCase()));
          const results = key ? structuredClone(geocoder.canned[key]) : [];
          return { status: results.length ? 'OK' : 'ZERO_RESULTS', results };
        },
      };
      return g;
    },
  };
}

// ---------------------------------------------------------------- Environment

export function createGasEnv(options = {}) {
  const { appKey, timeZone = 'Asia/Dubai', bound = true, promptResponse = null, now, extraSources = [], codeSource } = options;
  const logs = [];
  const prompts = [];
  const alerts = [];
  const props = {};
  const lock = { acquisitions: 0, held: false, failNext: false };
  const geocoder = { canned: { 'burj al arab': [BURJ] }, queries: [], lastBounds: null, lastRegion: null };
  const spreadsheet = new FakeSpreadsheet(timeZone);
  const drive = makeDrive();
  if (appKey !== undefined) props.APP_KEY = appKey;
  if (!bound) props.SPREADSHEET_ID = spreadsheet.getId();

  const ui = {
    ButtonSet: { OK: 'OK', OK_CANCEL: 'OK_CANCEL', YES_NO: 'YES_NO', YES_NO_CANCEL: 'YES_NO_CANCEL' },
    Button: { OK: 'OK', CANCEL: 'CANCEL', YES: 'YES', NO: 'NO', CLOSE: 'CLOSE' },
    prompt: (title, message, buttons) => {
      prompts.push({ title, message, buttons });
      const r = typeof promptResponse === 'function' ? promptResponse(title, message) : promptResponse;
      return { getSelectedButton: () => r?.button ?? 'CANCEL', getResponseText: () => r?.text ?? '' };
    },
    alert: (title, message) => { alerts.push({ title, message }); return 'OK'; },
  };

  const scriptProps = {
    getProperty: (k) => (Object.prototype.hasOwnProperty.call(props, k) ? props[k] : null),
    setProperty: (k, v) => { props[k] = String(v); return scriptProps; },
    deleteProperty: (k) => { delete props[k]; return scriptProps; },
    getProperties: () => ({ ...props }),
    setProperties: (obj, deleteAllOthers = false) => {
      if (deleteAllOthers) for (const k of Object.keys(props)) delete props[k];
      for (const [k, v] of Object.entries(obj)) props[k] = String(v);
      return scriptProps;
    },
  };

  const scriptLock = {
    waitLock: () => {
      if (lock.failNext) { lock.failNext = false; throw new Error('Lock timeout: another process was holding the lock for too long.'); }
      if (lock.held) throw new Error('Fake lock: waitLock called while the lock is already held (not reentrant).');
      lock.held = true;
      lock.acquisitions++;
    },
    tryLock: () => { if (lock.held) return false; lock.held = true; lock.acquisitions++; return true; },
    releaseLock: () => { lock.held = false; },
    hasLock: () => lock.held,
  };

  const logLine = (...args) => { logs.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')); };
  const RealDate = Date;
  const GasDate = now
    ? class extends RealDate {
      constructor(...args) { if (args.length === 0) super(now().getTime()); else super(...args); }
      static now() { return now().getTime(); }
    }
    : RealDate;

  const sandbox = {
    Date: GasDate,
    console: { log: logLine, info: logLine, warn: logLine, error: logLine },
    Logger: { log: (...a) => { logLine(...a); return sandbox.Logger; } },
    Utilities: makeUtilities(),
    ContentService: {
      MimeType: { JSON: 'JSON', TEXT: 'TEXT', JAVASCRIPT: 'JAVASCRIPT' },
      createTextOutput: (text = '') => {
        let mime = 'TEXT';
        const out = { getContent: () => text, setContent: (t) => { text = t; return out; }, setMimeType: (m) => { mime = m; return out; }, getMimeType: () => mime };
        return out;
      },
    },
    PropertiesService: { getScriptProperties: () => scriptProps },
    LockService: { getScriptLock: () => scriptLock },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => (bound ? spreadsheet : null),
      openById: (id) => { if (id !== spreadsheet.getId()) throw new Error(`Spreadsheet ${id} not found`); return spreadsheet; },
      getUi: () => { if (!bound) throw new Error('Cannot call SpreadsheetApp.getUi() from this context.'); return ui; },
      flush: () => {},
      newDataValidation: () => {
        const rule = { list: null, showDropdown: true, allowInvalid: true, helpText: null };
        const b = {
          requireValueInList: (list, show = true) => { rule.list = [...list]; rule.showDropdown = show; return b; },
          setAllowInvalid: (x) => { rule.allowInvalid = x; return b; },
          setHelpText: (t) => { rule.helpText = t; return b; },
          build: () => ({ ...rule, getCriteriaValues: () => [rule.list, rule.showDropdown] }),
        };
        return b;
      },
    },
    DriveApp: drive.DriveApp,
    Maps: makeMaps(geocoder),
    Session: { getScriptTimeZone: () => timeZone, getActiveUser: () => ({ getEmail: () => 'owner@example.com' }), getEffectiveUser: () => ({ getEmail: () => 'owner@example.com' }) },
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(codeSource ?? readFileSync(CODE_PATH, 'utf8'), context, { filename: 'Code.gs' });
  extraSources.forEach((src, i) => {
    const { name, source } = typeof src === 'string' ? { name: `extra-${i}.gs`, source: src } : src;
    vm.runInContext(source, context, { filename: name });
  });

  const env = { context, spreadsheet, props, logs, prompts, alerts, lock, geocoder };
  const parse = (out) => JSON.parse(out.getContent());
  env.call = {
    get: (params = {}) => {
      const parameter = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
      const parameters = Object.fromEntries(Object.entries(parameter).map(([k, v]) => [k, [v]]));
      return parse(context.doGet({ parameter, parameters, queryString: new URLSearchParams(parameter).toString() }));
    },
    post: (body, params = {}) => {
      const contents = typeof body === 'string' ? body : JSON.stringify(body);
      return parse(context.doPost({ parameter: params, parameters: {}, postData: { contents, type: 'text/plain', length: contents.length, name: 'postData' } }));
    },
  };
  env.run = (name, ...args) => {
    if (typeof context[name] !== 'function') throw new Error(`No function ${name} in the script`);
    return context[name](...args);
  };
  env.ss = { id: spreadsheet.getId(), fake: spreadsheet, sheet: (name) => sheetHelper(env, name), sheetNames: () => spreadsheet.getSheets().map((s) => s.getName()) };
  env.drive = { files: drive.files, folders: drive.folders, addFile: drive.addFile };
  return env;
}

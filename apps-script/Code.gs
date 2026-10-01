/**
 * Suite Nothings: the small backend that lives inside our Google Sheet.
 *
 * What this file does, in plain words:
 *  - It answers the app on both phones (doGet / doPost). Every answer is JSON:
 *    { ok: true, data } or { ok: false, error: { code, message } }.
 *  - It keeps the Sheet tidy: one tab per kind of thing (Hotels, Visits, Photos, Wishlist,
 *    Letters, Settings, Log). Columns are found by their header name, so you can reorder
 *    columns, add your own columns, or leave blank rows and nothing breaks.
 *  - When two phones save the same thing, the newest save wins ("last write wins").
 *  - setup()    : run once from the editor. Creates tabs, dropdowns, the Drive photo folder
 *                 and asks for our passphrase. Safe to run again; it never deletes anything.
 *  - selfTest() : run from the editor to check everything works. Cleans up after itself.
 *  - onEdit(e)  : runs by itself when you edit the Sheet by hand, so the phones notice.
 *
 * The exact wire format is documented in apps-script/PROTOCOL.md.
 */

var VERSION = '1.0.0';
var SCHEMA_VERSION = '1';
var PHOTOS_FOLDER_NAME = 'Suite Nothings photos';

// ---------------------------------------------------------------------------------------------
// The shape of the Sheet
// ---------------------------------------------------------------------------------------------

/** Data tabs: name → id column, key used in API responses, and the known columns. */
var TABS = {
  Hotels: {
    id: 'hotel_id', key: 'hotels',
    columns: ['hotel_id', 'name', 'brand', 'address', 'area', 'city', 'region', 'country', 'country_code',
      'lat', 'lng', 'source', 'osm_id', 'wikidata_id', 'website', 'phone', 'stars', 'price_level',
      'description', 'description_source', 'amenities_json', 'cover_photo_id', 'enrichment_status',
      'enriched_at', 'created_at', 'updated_at', 'deleted', 'server_updated_at',
      'image_url', 'image_credit', 'enriched_fields_json'],
  },
  Visits: {
    id: 'visit_id', key: 'visits',
    columns: ['visit_id', 'hotel_id', 'date', 'check_in', 'check_out', 'nights', 'visit_type', 'booked_via',
      'note', 'favourite_moment', 'mood', 'rating_nirsh', 'rating_shady', 'picked_by', 'added_by',
      'photo_ids_json', 'created_at', 'updated_at', 'deleted', 'server_updated_at'],
  },
  Photos: {
    id: 'photo_id', key: 'photos',
    columns: ['photo_id', 'visit_id', 'thumb_file_id', 'full_file_id', 'width', 'height', 'taken_at',
      'caption', 'created_at', 'deleted', 'updated_at', 'server_updated_at'],
  },
  Wishlist: {
    id: 'wish_id', key: 'wishes',
    columns: ['wish_id', 'name', 'lat', 'lng', 'city', 'country', 'note', 'added_by', 'priority',
      'fulfilled_visit_id', 'created_at', 'updated_at', 'deleted', 'server_updated_at'],
  },
  Letters: {
    id: 'letter_id', key: 'letters',
    columns: ['letter_id', 'title', 'body_md', 'from', 'to', 'unlock_rule', 'written_at', 'read_at',
      'created_at', 'updated_at', 'server_updated_at'],
  },
};
var DATA_TABS = ['Hotels', 'Visits', 'Photos', 'Wishlist', 'Letters'];
var SETTINGS_TAB = 'Settings';
var SETTINGS_COLUMNS = ['key', 'value'];
var LOG_TAB = 'Log';
var LOG_COLUMNS = ['timestamp', 'actor', 'action', 'detail'];
var LOG_KEEP = 2000;     // rows kept after a trim
var LOG_TRIM_AT = 2200;  // trim once the Log grows past this many rows

var NUMBER_COLUMNS = toSet_(['lat', 'lng', 'stars', 'price_level', 'nights', 'rating_nirsh', 'rating_shady',
  'width', 'height', 'priority']);
var TIME_COLUMNS = toSet_(['check_in', 'check_out']);
var TIMESTAMP_COLUMNS = toSet_(['created_at', 'updated_at', 'enriched_at', 'taken_at', 'read_at', 'written_at',
  'server_updated_at']);
var JSON_COLUMNS = toSet_(['amenities_json', 'photo_ids_json']);
/** Long text we keep exactly as written (no trimming), so letters keep their line breaks. */
var EXACT_TEXT_COLUMNS = toSet_(['body_md']);

/** Dropdown lists for enum columns (setup() adds them as "warn but allow" validations). */
var ENUMS = {
  visit_type: ['Dayuse', 'Staycation', 'Overnight', 'Pool day', 'Spa', 'Brunch or dinner', 'Other'],
  booked_via: ['Dayuse', 'Direct', 'Booking.com', 'Other'],
  mood: ['blissful', 'cosy', 'romantic', 'giddy', 'lazy', 'adventurous', 'fancy', 'sleepy', 'giggly', 'fizzy'],
  picked_by: ['nirsh', 'shady', 'both'],
  added_by: ['nirsh', 'shady'],
  from: ['nirsh', 'shady'],
  to: ['nirsh', 'shady'],
  source: ['photon', 'manual', 'seed', 'wishlist'],
  enrichment_status: ['none', 'pending', 'done', 'failed', 'skipped'],
  price_level: ['1', '2', '3', '4'],
};

var DEFAULT_SETTINGS = {
  home_base: '{"city":"Dubai","country":"United Arab Emirates","countryCode":"AE","lat":25.2048,"lng":55.2708}',
  map_lighting: 'auto',
  units: 'km',
};

// Per-run state (Apps Script starts fresh for every request).
var cache_ = { ss: null, tz: null };
var lockDepth_ = 0;
var quiet_ = false; // selfTest() sets this so its test rows don't fill the Log

// ---------------------------------------------------------------------------------------------
// Web app entry points
// ---------------------------------------------------------------------------------------------

/** GET: ping, bootstrap, changes, photo. */
function doGet(e) {
  var params = (e && e.parameter) || {};
  var action = String(params.action || '').trim();
  return respond_(action, 'app', function () {
    if (action === 'ping') return pingResponse_();
    requireKey_(params.key);
    if (action === 'bootstrap') return ok_(apiBootstrap_());
    if (action === 'changes') return ok_(apiChanges_(params.since));
    if (action === 'photo') return ok_(apiPhoto_(params.id));
    throw apiError_('bad_request', action ? 'Unknown action "' + action + '".' : 'No action given.');
  });
}

/** POST: body is a JSON string { key, action, payload } sent as text/plain. */
function doPost(e) {
  var text = e && e.postData ? e.postData.contents : '';
  var body = null;
  var parseError = false;
  try {
    body = JSON.parse(text || '');
  } catch (err) {
    parseError = true;
  }
  var action = body && typeof body === 'object' ? String(body.action || '').trim() : '';
  var payload = body && typeof body === 'object' ? body.payload : null;
  return respond_(action || 'post', actorOf_(payload), function () {
    if (parseError || !body || typeof body !== 'object' || Array.isArray(body)) {
      throw apiError_('bad_request', 'The request body is not valid JSON.');
    }
    if (action === 'ping') return pingResponse_();
    requireKey_(body.key);
    var handler = POST_HANDLERS.hasOwnProperty(action) ? POST_HANDLERS[action] : null;
    if (!handler) throw apiError_('bad_request', action ? 'Unknown action "' + action + '".' : 'No action given.');
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw apiError_('bad_request', 'The request needs a payload object.');
    }
    var data = handler(payload);
    if (READ_ONLY_POSTS[action] !== true) log_(actorOf_(payload), action, describeWrite_(action, payload, data));
    return ok_(data);
  });
}

/** Write actions. Each takes the payload and returns the `data` part of the answer. */
var POST_HANDLERS = {
  upsertHotel: function (p) { return apiUpsert_('Hotels', p, ['hotel_id', 'updated_at']); },
  upsertVisit: function (p) { return apiUpsert_('Visits', p, ['visit_id', 'hotel_id', 'date', 'updated_at']); },
  deleteVisit: function (p) { return apiDeleteVisit_(p); },
  uploadPhoto: function (p) { return apiUploadPhoto_(p); },
  upsertWish: function (p) { return apiUpsert_('Wishlist', p, ['wish_id', 'updated_at']); },
  upsertLetter: function (p) { return apiUpsert_('Letters', p, ['letter_id', 'updated_at']); },
  markLetterRead: function (p) { return apiMarkLetterRead_(p); },
  updateSettings: function (p) { return apiUpdateSettings_(p); },
  geocode: function (p) { return apiGeocode_(p); },
  aiDescribe: function (p) { return apiAiDescribe_(p); },
  placesLookup: function (p) { return apiPlacesLookup_(p); },
};

/** POST actions that only read or compute; they don't go in the Log tab. */
var READ_ONLY_POSTS = { geocode: true, aiDescribe: true, placesLookup: true };

// ---------------------------------------------------------------------------------------------
// Answers, errors, passphrase
// ---------------------------------------------------------------------------------------------

function respond_(action, actor, fn) {
  var result;
  try {
    result = fn();
  } catch (err) {
    var code = err && err.apiCode ? err.apiCode : 'server';
    var message = err && err.apiCode ? err.message : 'The Sheet script hit an error: ' + (err && err.message ? err.message : String(err));
    log_(actor, 'error', (action || '?') + ': ' + code + ': ' + message);
    result = { ok: false, error: { code: code, message: message } };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function ok_(data) {
  return { ok: true, data: data };
}

function pingResponse_() {
  return { ok: true, version: VERSION, data: { version: VERSION, serverTime: nowIso_() } };
}

/** An error the app understands. code: unauthorized | bad_request | not_found | conflict | server. */
function apiError_(code, message) {
  var err = new Error(message);
  err.apiCode = code;
  return err;
}

function requireKey_(given) {
  var stored = PropertiesService.getScriptProperties().getProperty('APP_KEY');
  if (!stored) throw apiError_('unauthorized', "The passphrase isn't set yet. Run setup() in the Apps Script editor.");
  var typed = given === null || given === undefined ? '' : String(given).trim();
  if (!sameSecret_(typed, String(stored).trim())) {
    throw apiError_('unauthorized', "That passphrase doesn't match the one saved with the Sheet.");
  }
}

/** Compares two strings in constant time, so the answer time doesn't hint at the passphrase. */
function sameSecret_(a, b) {
  var diff = a.length ^ b.length;
  var n = Math.max(a.length, b.length);
  for (var i = 0; i < n; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

// ---------------------------------------------------------------------------------------------
// Locking: only one write at a time. Reentrant, so helpers can call each other safely.
// ---------------------------------------------------------------------------------------------

function withLock_(fn, tolerant) {
  if (lockDepth_ > 0) {
    lockDepth_++;
    try { return fn(); } finally { lockDepth_--; }
  }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    if (tolerant) return fn(); // onEdit: better to stamp without the lock than not at all
    throw apiError_('server', 'The Sheet is busy right now. Try again in a moment.');
  }
  lockDepth_ = 1;
  try {
    return fn();
  } finally {
    lockDepth_ = 0;
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------------------------

function apiBootstrap_() {
  return withLock_(function () {
    var serverTime = serverTime_();
    var out = {};
    DATA_TABS.forEach(function (name) {
      stampBlankRows_(name);
      out[TABS[name].key] = listRows_(name).map(function (row) { return publicRow_(name, row); });
    });
    out.settings = readSettings_().settings;
    out.serverTime = serverTime;
    return out;
  });
}

function apiChanges_(since) {
  var sinceText = since === null || since === undefined ? '' : String(since).trim();
  var sinceMs = Date.parse(sinceText);
  if (!sinceText || isNaN(sinceMs)) throw apiError_('bad_request', 'changes needs a valid "since" time (ISO 8601).');
  return withLock_(function () {
    var serverTime = serverTime_();
    var out = {};
    DATA_TABS.forEach(function (name) {
      stampBlankRows_(name);
      out[TABS[name].key] = listRows_(name).filter(function (row) {
        return tsMs_(row.server_updated_at) > sinceMs || tsMs_(publicRow_(name, row).updated_at) > sinceMs;
      }).map(function (row) { return publicRow_(name, row); });
    });
    var s = readSettings_();
    var changed = tsMs_(s.settings.updated_at) > sinceMs || tsMs_(s.serverUpdatedAt) > sinceMs;
    out.settings = changed ? s.settings : {};
    out.serverTime = serverTime;
    return out;
  });
}

/**
 * The time we hand back as the next "since". One millisecond behind the clock, so a write that
 * lands in the very same millisecond as this read is still picked up next time.
 */
function serverTime_() {
  return new Date(Date.now() - 1).toISOString();
}

/** All rows of a data tab that have an ID, as normalised objects. Duplicate IDs: newest wins. */
function listRows_(name) {
  var sheet = ss_().getSheetByName(name);
  if (!sheet) return [];
  var t = readTable_(sheet);
  var idIdx = t.index[TABS[name].id];
  if (idIdx === undefined) return [];
  var byId = {};
  var order = [];
  t.rows.forEach(function (r) {
    var id = toText_(r.values[idIdx]);
    if (!id) return; // blank rows are ignored
    var obj = rowObject_(name, t, r.values);
    var prev = byId[id];
    if (!prev) {
      order.push(id);
      byId[id] = obj;
    } else if (newer_(publicRow_(name, obj).updated_at, publicRow_(name, prev).updated_at)) {
      byId[id] = obj;
    }
  });
  return order.map(function (id) { return byId[id]; });
}

/** Rows typed in by hand may have an ID but no updated_at: stamp them so they sync. */
function stampBlankRows_(name) {
  var sheet = ss_().getSheetByName(name);
  if (!sheet) return 0;
  var t = readTable_(sheet);
  var idIdx = t.index[TABS[name].id];
  if (idIdx === undefined) return 0;
  var ua = t.index.updated_at;
  var needs = t.rows.filter(function (r) {
    return toText_(r.values[idIdx]) && (ua === undefined || isBlank_(r.values[ua]));
  });
  if (!needs.length) return 0;
  ensureColumns_(sheet, ['updated_at', 'server_updated_at']);
  t = readTable_(sheet);
  var now = nowIso_();
  needs.forEach(function (r) {
    sheet.getRange(r.rowNumber, t.index.updated_at + 1).setValue(now);
    sheet.getRange(r.rowNumber, t.index.server_updated_at + 1).setValue(now);
  });
  return needs.length;
}

/** A normalised row by ID, or null. Handy for other script files (e.g. Letter.gs). */
function getRowById_(sheetName, idField, id) {
  var sheet = ss_().getSheetByName(sheetName);
  if (!sheet) return null;
  var t = readTable_(sheet);
  var found = findRow_(t, idField || TABS[sheetName].id, toText_(id));
  return found ? publicRow_(sheetName, rowObject_(sheetName, t, found.values)) : null;
}

function apiPhoto_(id) {
  var fileId = toText_(id);
  if (!fileId) throw apiError_('bad_request', 'photo needs an id.');
  var folderId = PropertiesService.getScriptProperties().getProperty('PHOTOS_FOLDER_ID');
  var missing = apiError_('not_found', "That photo isn't in our Drive folder.");
  if (!folderId) throw missing;
  var file;
  try {
    file = DriveApp.getFileById(fileId);
  } catch (err) {
    throw missing;
  }
  // Only serve files from our photos folder, never any other file in this Drive.
  if (file.isTrashed() || !inFolder_(file, folderId)) throw missing;
  var blob = file.getBlob();
  return { mime: blob.getContentType(), base64: Utilities.base64Encode(blob.getBytes()) };
}

function inFolder_(file, folderId) {
  var parents = file.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === folderId) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------------------------

function apiUpsert_(sheetName, payload, required) {
  requireFields_(payload, required, TABS[sheetName].id.replace('_id', ''));
  var res = upsertRowById_(sheetName, TABS[sheetName].id, payload);
  return { row: res.row, applied: res.applied, serverTime: nowIso_() };
}

/**
 * Insert or update one row by its ID with last-write-wins on updated_at.
 * Newer updated_at replaces (fields not sent are kept); equal or older changes nothing.
 * Returns { row: what the Sheet now holds, applied }. Safe to call inside withLock_.
 */
function upsertRowById_(sheetName, idField, rowObject) {
  var spec = TABS[sheetName];
  if (!spec) throw new Error('Unknown tab ' + sheetName);
  idField = idField || spec.id;
  var id = toText_(rowObject[idField]);
  if (!id) throw apiError_('bad_request', 'The row needs a ' + idField + '.');
  return withLock_(function () {
    var t = table_(sheetName);
    var incoming = {};
    Object.keys(rowObject).forEach(function (k) {
      var col = normHeader_(k);
      if (spec.columns.indexOf(col) >= 0 && col !== 'server_updated_at') incoming[col] = normaliseCell_(col, rowObject[k]);
    });
    incoming[idField] = id;
    var found = findRow_(t, idField, id);
    var merged;
    if (found) {
      var stored = rowObject_(sheetName, t, found.values);
      if (!newer_(effectiveUpdatedAt_(sheetName, incoming), publicRow_(sheetName, stored).updated_at)) {
        return { row: publicRow_(sheetName, stored), applied: false };
      }
      merged = stored;
      Object.keys(incoming).forEach(function (k) { merged[k] = incoming[k]; });
    } else {
      merged = {};
      spec.columns.forEach(function (c) { merged[c] = incoming.hasOwnProperty(c) ? incoming[c] : normaliseCell_(c, ''); });
    }
    if (!merged.updated_at) merged.updated_at = effectiveUpdatedAt_(sheetName, merged) || nowIso_();
    merged.server_updated_at = nowIso_();
    writeRow_(t, found ? found.rowNumber : null, merged, found ? found.values : null);
    return { row: publicRow_(sheetName, merged), applied: true };
  });
}

/** Set some fields on an existing row without the LWW check (server-side bookkeeping). */
function patchRowById_(sheetName, idField, id, fields) {
  return withLock_(function () {
    var t = table_(sheetName);
    var found = findRow_(t, idField, id);
    if (!found) return null;
    var obj = rowObject_(sheetName, t, found.values);
    Object.keys(fields).forEach(function (k) { obj[k] = normaliseCell_(k, fields[k]); });
    obj.server_updated_at = nowIso_();
    writeRow_(t, found.rowNumber, obj, found.values);
    return publicRow_(sheetName, obj);
  });
}

function apiDeleteVisit_(p) {
  requireFields_(p, ['visit_id', 'updated_at'], 'deleteVisit');
  var deleted = p.deleted === undefined ? true : toBool_(p.deleted);
  return withLock_(function () {
    if (!getRowById_('Visits', 'visit_id', p.visit_id)) throw apiError_('not_found', "There's no stay with that id.");
    var res = upsertRowById_('Visits', 'visit_id', { visit_id: p.visit_id, deleted: deleted, updated_at: p.updated_at });
    return { row: res.row, applied: res.applied, serverTime: nowIso_() };
  });
}

function apiUploadPhoto_(p) {
  var photo = p.photo;
  if (!photo || typeof photo !== 'object') throw apiError_('bad_request', 'uploadPhoto needs a photo.');
  requireFields_(photo, ['photo_id'], 'photo');
  if (isBlank_(photo.updated_at) && isBlank_(photo.created_at)) throw apiError_('bad_request', 'photo needs updated_at.');
  var id = toText_(photo.photo_id);
  return withLock_(function () {
    var existing = getRowById_('Photos', 'photo_id', id);
    var thumbId = existing && existing.thumb_file_id;
    var fullId = existing && existing.full_file_id;
    var created = false;
    // Idempotent: a replay finds the file ids already on the row and uploads nothing new.
    if (!thumbId && p.thumb) { thumbId = savePhotoFile_(p.thumb, id + '-thumb.jpg'); created = created || !!thumbId; }
    if (!fullId && p.full) { fullId = savePhotoFile_(p.full, id + '-full.jpg'); created = created || !!fullId; }
    var row = {};
    Object.keys(photo).forEach(function (k) { row[k] = photo[k]; });
    row.photo_id = id;
    row.thumb_file_id = thumbId || null;
    row.full_file_id = fullId || null;
    var res = upsertRowById_('Photos', 'photo_id', row);
    var finalRow = res.row;
    if (!res.applied && created) {
      // The row was already newer, but it had no files yet: attach the ones we just saved.
      finalRow = patchRowById_('Photos', 'photo_id', id, { thumb_file_id: thumbId || '', full_file_id: fullId || '' });
    }
    return {
      row: finalRow, applied: res.applied, serverTime: nowIso_(),
      fileIds: { thumb_file_id: finalRow.thumb_file_id, full_file_id: finalRow.full_file_id },
    };
  });
}

function savePhotoFile_(part, name) {
  var b64 = String(part.base64 || '').replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
  if (!b64) return null;
  var bytes;
  try {
    bytes = Utilities.base64Decode(b64);
  } catch (err) {
    throw apiError_('bad_request', 'The photo data is not valid base64.');
  }
  var file = photosFolder_().createFile(Utilities.newBlob(bytes, String(part.mime || 'image/jpeg'), name));
  return file.getId();
}

/** The Drive folder for photos; recreated if it was deleted. */
function photosFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('PHOTOS_FOLDER_ID');
  if (id) {
    try {
      var folder = DriveApp.getFolderById(id);
      if (!folder.isTrashed()) return folder;
    } catch (err) {
      // fall through and create a new one
    }
  }
  var created = DriveApp.createFolder(PHOTOS_FOLDER_NAME);
  props.setProperty('PHOTOS_FOLDER_ID', created.getId());
  return created;
}

function apiMarkLetterRead_(p) {
  requireFields_(p, ['letter_id'], 'markLetterRead');
  var readAt = isBlank_(p.read_at) ? nowIso_() : toTimestamp_(p.read_at);
  if (isNaN(tsMs_(readAt))) throw apiError_('bad_request', 'read_at is not a valid time.');
  return withLock_(function () {
    var t = table_('Letters');
    var found = findRow_(t, 'letter_id', toText_(p.letter_id));
    if (!found) throw apiError_('not_found', "There's no letter with that id.");
    var stored = rowObject_('Letters', t, found.values);
    if (stored.read_at) return { row: publicRow_('Letters', stored), applied: false, serverTime: nowIso_() };
    var prev = tsMs_(publicRow_('Letters', stored).updated_at);
    stored.read_at = readAt;
    stored.updated_at = new Date(Math.max(Date.now(), isNaN(prev) ? 0 : prev + 1)).toISOString();
    stored.server_updated_at = nowIso_();
    writeRow_(t, found.rowNumber, stored, found.values);
    return { row: publicRow_('Letters', stored), applied: true, serverTime: nowIso_() };
  });
}

function apiUpdateSettings_(p) {
  requireFields_(p, ['updated_at'], 'updateSettings');
  var ts = toTimestamp_(p.updated_at);
  return withLock_(function () {
    var sheet = sheet_(SETTINGS_TAB, SETTINGS_COLUMNS);
    var current = readSettings_();
    var applied = newer_(ts, current.settings.updated_at);
    if (applied) {
      Object.keys(p).forEach(function (key) {
        var k = normHeader_(key);
        if (k === 'updated_at' || k === 'server_updated_at' || !/^[a-z0-9_]+$/.test(k)) return;
        writeSetting_(sheet, k, p[key]);
      });
      writeSetting_(sheet, 'updated_at', ts);
      writeSetting_(sheet, 'server_updated_at', nowIso_());
    }
    return { settings: readSettings_().settings, applied: applied, serverTime: nowIso_() };
  });
}

function apiGeocode_(p) {
  var query = toText_(p.query);
  if (!query) throw apiError_('bad_request', 'geocode needs a query.');
  var geocoder = Maps.newGeocoder();
  var near = p.near;
  if (near && isFinite(Number(near.lat)) && isFinite(Number(near.lng)) && near.lat !== null && near.lng !== null) {
    var lat = Number(near.lat), lng = Number(near.lng);
    geocoder.setBounds(Math.max(lat - 0.5, -90), lng - 0.5, Math.min(lat + 0.5, 90), lng + 0.5);
  }
  var response = geocoder.geocode(query) || {};
  if (response.status && response.status !== 'OK' && response.status !== 'ZERO_RESULTS') {
    throw apiError_('server', "Google's place search isn't answering right now (" + response.status + ').');
  }
  var results = (response.results || []).slice(0, 8).map(function (r) {
    var comps = r.address_components || [];
    var part = function (type, short) {
      for (var i = 0; i < comps.length; i++) {
        if ((comps[i].types || []).indexOf(type) >= 0) return short ? comps[i].short_name : comps[i].long_name;
      }
      return null;
    };
    var address = r.formatted_address || null;
    var name = part('establishment') || part('point_of_interest') || part('premise') ||
      (address ? String(address).split(',')[0].split(' - ')[0].trim() : query);
    var loc = (r.geometry && r.geometry.location) || {};
    return {
      name: name,
      address: address,
      lat: typeof loc.lat === 'number' ? loc.lat : null,
      lng: typeof loc.lng === 'number' ? loc.lng : null,
      city: part('locality') || part('postal_town') || part('administrative_area_level_2'),
      region: part('administrative_area_level_1'),
      country: part('country'),
      country_code: part('country', true) ? String(part('country', true)).toUpperCase() : null,
      postcode: part('postal_code'),
    };
  });
  return { results: results };
}

function requireFields_(obj, fields, what) {
  fields.forEach(function (f) {
    if (isBlank_(obj[f])) throw apiError_('bad_request', what + ' needs ' + f + '.');
  });
  if (fields.indexOf('updated_at') >= 0 && isNaN(tsMs_(toTimestamp_(obj.updated_at)))) {
    throw apiError_('bad_request', 'updated_at is not a valid time.');
  }
  if (fields.indexOf('date') >= 0 && !/^\d{4}-\d{2}-\d{2}$/.test(String(toDate_(obj.date)))) {
    throw apiError_('bad_request', 'date should look like 2026-06-19.');
  }
}

// ---------------------------------------------------------------------------------------------
// Sheet plumbing: tables read by header name
// ---------------------------------------------------------------------------------------------

function ss_() {
  if (cache_.ss) return cache_.ss;
  var ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (err) {
    ss = null;
  }
  if (!ss) {
    var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (id) ss = SpreadsheetApp.openById(id);
  }
  if (!ss) throw apiError_('server', "The script can't find its Sheet. Open the Sheet → Extensions → Apps Script and run setup().");
  cache_.ss = ss;
  return ss;
}

function tz_() {
  if (!cache_.tz) cache_.tz = ss_().getSpreadsheetTimeZone() || Session.getScriptTimeZone() || 'Etc/UTC';
  return cache_.tz;
}

/** The sheet with this name, created (with headers) when missing; missing columns appended. */
function sheet_(name, columns) {
  var sheet = ss_().getSheetByName(name);
  if (!sheet) sheet = ss_().insertSheet(name);
  ensureColumns_(sheet, columns);
  return sheet;
}

/** A data tab, ready to write to. */
function table_(name) {
  return readTable_(sheet_(name, TABS[name].columns));
}

/** Reads a whole tab: header index (trimmed, lower case) and the raw rows below it. */
function readTable_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var t = { sheet: sheet, index: {}, width: lastCol, rows: [] };
  if (lastRow < 1 || lastCol < 1) return t;
  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  values[0].forEach(function (h, i) {
    var name = normHeader_(h);
    if (name && t.index[name] === undefined) t.index[name] = i;
  });
  for (var r = 1; r < values.length; r++) t.rows.push({ rowNumber: r + 1, values: values[r] });
  return t;
}

/** Appends any missing known columns to the header row. Returns how many were added. */
function ensureColumns_(sheet, columns) {
  var lastCol = sheet.getLastColumn();
  var header = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  var have = {};
  header.forEach(function (h) { have[normHeader_(h)] = true; });
  var missing = columns.filter(function (c) { return !have[c]; });
  if (!missing.length) return 0;
  if (sheet.getMaxColumns() < lastCol + missing.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), lastCol + missing.length - sheet.getMaxColumns());
  }
  sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
  return missing.length;
}

function findRow_(t, idField, id) {
  var idx = t.index[idField];
  if (idx === undefined || !id) return null;
  for (var i = 0; i < t.rows.length; i++) {
    if (toText_(t.rows[i].values[idx]) === id) return t.rows[i];
  }
  return null;
}

/** Raw sheet values → a normalised object with every known column (incl. server_updated_at). */
function rowObject_(name, t, values) {
  var obj = {};
  TABS[name].columns.forEach(function (col) {
    var idx = t.index[col];
    obj[col] = normaliseCell_(col, idx === undefined ? '' : values[idx]);
  });
  return obj;
}

/** What the app gets: known columns without server_updated_at, with updated_at fallbacks. */
function publicRow_(name, obj) {
  var out = {};
  TABS[name].columns.forEach(function (col) {
    if (col !== 'server_updated_at') out[col] = obj[col] === undefined ? normaliseCell_(col, '') : obj[col];
  });
  out.updated_at = effectiveUpdatedAt_(name, out);
  return out;
}

/** updated_at, or for Letters read_at/created_at and for Photos created_at when it is blank. */
function effectiveUpdatedAt_(name, obj) {
  if (obj.updated_at) return obj.updated_at;
  if (name === 'Letters') return obj.read_at || obj.created_at || null;
  if (name === 'Photos') return obj.created_at || null;
  return null;
}

/**
 * Writes one row in a single call. Unknown columns keep their values (and formulas);
 * known columns are placed by header position. rowNumber null = append a new row.
 */
function writeRow_(t, rowNumber, obj, existing) {
  var sheet = t.sheet;
  var width = t.width;
  var cells = [];
  for (var i = 0; i < width; i++) cells.push(existing && i < existing.length ? existing[i] : '');
  if (rowNumber && existing) {
    var formulas = sheet.getRange(rowNumber, 1, 1, width).getFormulas()[0];
    for (var f = 0; f < width; f++) if (formulas[f]) cells[f] = formulas[f];
  }
  Object.keys(t.index).forEach(function (col) {
    if (obj.hasOwnProperty(col)) cells[t.index[col]] = toCell_(obj[col]);
  });
  if (!rowNumber) {
    rowNumber = Math.max(sheet.getLastRow(), 1) + 1;
    if (rowNumber > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), rowNumber - sheet.getMaxRows());
  }
  sheet.getRange(rowNumber, 1, 1, width).setValues([cells]);
}

function toCell_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean' || typeof v === 'number') return v;
  if (typeof v === 'object' && !isDate_(v)) return JSON.stringify(v);
  return v;
}

// ---------------------------------------------------------------------------------------------
// Settings tab (key / value)
// ---------------------------------------------------------------------------------------------

/** { settings, serverUpdatedAt }. JSON values (like home_base) are parsed. */
function readSettings_() {
  var sheet = ss_().getSheetByName(SETTINGS_TAB);
  var settings = {};
  var serverUpdatedAt = null;
  if (!sheet) return { settings: settings, serverUpdatedAt: null };
  var t = readTable_(sheet);
  var k = t.index.key, v = t.index.value;
  if (k === undefined || v === undefined) return { settings: settings, serverUpdatedAt: null };
  t.rows.forEach(function (r) {
    var key = normHeader_(r.values[k]);
    if (!key) return;
    if (key === 'server_updated_at') { serverUpdatedAt = serverUpdatedAt || toTimestamp_(r.values[v]); return; }
    if (settings.hasOwnProperty(key)) return; // first row wins
    settings[key] = key === 'updated_at' ? toTimestamp_(r.values[v]) : parseSettingValue_(r.values[v]);
  });
  return { settings: settings, serverUpdatedAt: serverUpdatedAt };
}

function parseSettingValue_(raw) {
  if (isDate_(raw)) return raw.toISOString();
  if (typeof raw !== 'string') return raw === '' ? null : raw;
  var s = raw.trim();
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch (err) {
    return s;
  }
}

function writeSetting_(sheet, key, value) {
  var t = readTable_(sheet);
  var cell = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : value;
  for (var i = 0; i < t.rows.length; i++) {
    if (normHeader_(t.rows[i].values[t.index.key]) === key) {
      sheet.getRange(t.rows[i].rowNumber, t.index.value + 1).setValue(cell);
      return;
    }
  }
  var obj = { key: key, value: cell };
  writeRow_(t, null, obj, null);
}

// ---------------------------------------------------------------------------------------------
// Log tab
// ---------------------------------------------------------------------------------------------

function log_(actor, action, detail) {
  if (quiet_) return;
  try {
    var sheet = sheet_(LOG_TAB, LOG_COLUMNS);
    sheet.appendRow([nowIso_(), String(actor || 'app'), String(action || ''), String(detail || '').slice(0, 500)]);
    var dataRows = sheet.getLastRow() - 1;
    if (dataRows > LOG_TRIM_AT) sheet.deleteRows(2, dataRows - LOG_KEEP);
  } catch (err) {
    Logger.log('Could not write to the Log tab: ' + err);
  }
}

function actorOf_(payload) {
  if (!payload || typeof payload !== 'object') return 'app';
  var who = payload.added_by || (payload.photo && payload.photo.added_by);
  return who ? String(who) : 'app';
}

/** A short, private-safe summary for the Log (ids only, never letter text). */
function describeWrite_(action, payload, data) {
  var id = payload.photo ? payload.photo.photo_id : null;
  if (!id) {
    for (var k in payload) {
      if (payload.hasOwnProperty(k) && /_id$/.test(k) && payload[k]) { id = payload[k]; break; }
    }
  }
  var applied = data && data.applied !== undefined ? (data.applied ? 'applied' : 'unchanged') : '';
  return [id || (action === 'updateSettings' ? 'settings' : ''), applied].join(' ').trim();
}

// ---------------------------------------------------------------------------------------------
// Normalising cell values (see PROTOCOL.md "Row normalisation")
// ---------------------------------------------------------------------------------------------

function normaliseCell_(col, value) {
  if (value === undefined || value === null) value = '';
  if (NUMBER_COLUMNS[col]) {
    var n = toNumber_(value);
    return n === null && col === 'nights' ? 0 : n;
  }
  if (col === 'deleted') return toBool_(value);
  if (col === 'date') return toDate_(value);
  if (TIME_COLUMNS[col]) return toTime_(value);
  if (TIMESTAMP_COLUMNS[col]) return toTimestamp_(value);
  if (JSON_COLUMNS[col] && typeof value === 'object' && !isDate_(value)) return JSON.stringify(value);
  if (EXACT_TEXT_COLUMNS[col] && typeof value === 'string') return value.trim() ? value : null;
  return toText_(value);
}

function toText_(v) {
  if (v === null || v === undefined) return null;
  if (isDate_(v)) return isNaN(v.getTime()) ? null : v.toISOString();
  var s = String(v).trim();
  return s ? s : null;
}

function toNumber_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (v === null || v === undefined || typeof v === 'boolean' || isDate_(v)) return null;
  var s = String(v).trim();
  if (!s) return null;
  var n = Number(s);
  return isFinite(n) ? n : null;
}

function toBool_(v) {
  if (v === true || v === 1) return true;
  if (typeof v !== 'string') return false;
  return /^(true|yes|y|1)$/i.test(v.trim());
}

var MONTHS_ = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/** → 'YYYY-MM-DD' (or the trimmed text when it can't be read as a date). */
function toDate_(v) {
  if (v === null || v === undefined || v === '') return null;
  if (isDate_(v)) return isNaN(v.getTime()) ? null : Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  if (typeof v === 'number') { // a Sheets serial day number
    return Utilities.formatDate(new Date(Math.round((v - 25569) * 86400000)), 'UTC', 'yyyy-MM-dd');
  }
  var s = String(v).trim();
  if (!s) return null;
  var m;
  if ((m = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/.exec(s))) return ymd_(m[1], m[2], m[3], s);
  if ((m = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/.exec(s))) return ymd_(m[3], m[2], m[1], s); // DD/MM/YYYY
  if ((m = /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,})\.?,?\s+(\d{4})$/.exec(s))) {
    return ymd_(m[3], MONTHS_[m[2].slice(0, 3).toLowerCase()], m[1], s);
  }
  if ((m = /^([A-Za-z]{3,})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/.exec(s))) {
    return ymd_(m[3], MONTHS_[m[1].slice(0, 3).toLowerCase()], m[2], s);
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(s) && !isNaN(Date.parse(s))) return Utilities.formatDate(new Date(s), tz_(), 'yyyy-MM-dd');
  return s;
}

function ymd_(y, mo, d, fallback) {
  mo = Number(mo); d = Number(d);
  if (!mo || mo > 12 || !d || d > 31) return fallback;
  return y + '-' + pad2_(mo) + '-' + pad2_(d);
}

/** → 'HH:mm' (or the trimmed text when it can't be read as a time). */
function toTime_(v) {
  if (v === null || v === undefined || v === '') return null;
  if (isDate_(v)) return isNaN(v.getTime()) ? null : Utilities.formatDate(v, tz_(), 'HH:mm');
  if (typeof v === 'number') return fromDayFraction_(v);
  var s = String(v).trim();
  if (!s) return null;
  var m = /^(\d{1,2})(?:[:h](\d{1,2}))?(?::\d{1,2}(?:\.\d+)?)?\s*([ap])?\.?\s*(?:m\.?)?$/i.exec(s);
  if (m) {
    var h = Number(m[1]), min = Number(m[2] || 0);
    if (m[3]) {
      if (h < 1 || h > 12) return s;
      h = (h % 12) + (m[3].toLowerCase() === 'p' ? 12 : 0);
    }
    return h < 24 && min < 60 ? pad2_(h) + ':' + pad2_(min) : s;
  }
  if (/^0?\.\d+$/.test(s)) return fromDayFraction_(Number(s));
  if (/^\d{4}-\d{2}-\d{2}T/.test(s) && !isNaN(Date.parse(s))) return Utilities.formatDate(new Date(s), tz_(), 'HH:mm');
  return s;
}

function fromDayFraction_(n) {
  if (!isFinite(n)) return null;
  var frac = n - Math.floor(n);
  var mins = Math.round(frac * 1440) % 1440;
  return pad2_(Math.floor(mins / 60)) + ':' + pad2_(mins % 60);
}

/** → ISO 8601 UTC string; a bare YYYY-MM-DD stays as is. */
function toTimestamp_(v) {
  if (v === null || v === undefined || v === '') return null;
  if (isDate_(v)) return isNaN(v.getTime()) ? null : v.toISOString();
  var s = String(v).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var ms = Date.parse(s);
  return isNaN(ms) ? s : new Date(ms).toISOString();
}

function tsMs_(v) {
  if (v === null || v === undefined || v === '') return NaN;
  if (isDate_(v)) return v.getTime();
  return Date.parse(String(v));
}

/** Is timestamp a strictly newer than b? A missing/invalid b counts as "very old". */
function newer_(a, b) {
  var am = tsMs_(a), bm = tsMs_(b);
  if (isNaN(am)) return false;
  return isNaN(bm) || am > bm;
}

function isDate_(v) {
  return Object.prototype.toString.call(v) === '[object Date]';
}

function isBlank_(v) {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

function normHeader_(h) {
  return h === null || h === undefined ? '' : String(h).trim().toLowerCase();
}

function pad2_(n) {
  return (n < 10 ? '0' : '') + n;
}

function nowIso_() {
  return new Date().toISOString();
}

function toSet_(list) {
  var set = {};
  list.forEach(function (x) { set[x] = true; });
  return set;
}

// ---------------------------------------------------------------------------------------------
// Hand edits: onEdit(e) runs by itself whenever someone edits the Sheet
// ---------------------------------------------------------------------------------------------

function onEdit(e) {
  if (!e || !e.range) return;
  try {
    if (e.source) cache_.ss = e.source;
    withLock_(function () { stampEdit_(e.range); }, true);
  } catch (err) {
    Logger.log('onEdit could not stamp the edited row: ' + err);
  }
}

function stampEdit_(range) {
  var sheet = range.getSheet();
  var name = sheet.getName();
  var firstRow = Math.max(range.getRow(), 2);
  var lastRow = Math.min(range.getRow() + range.getNumRows() - 1, sheet.getLastRow());
  if (lastRow < firstRow) return; // only the header row was touched
  var t = readTable_(sheet);
  var headerAt = function (col) {
    for (var h in t.index) if (t.index[h] === col - 1) return h;
    return '';
  };
  var stampOnly = true;
  for (var c = range.getColumn(); c < range.getColumn() + range.getNumColumns(); c++) {
    var h = headerAt(c);
    if (h !== 'updated_at' && h !== 'server_updated_at') { stampOnly = false; break; }
  }
  var now = Date.now();

  if (name === SETTINGS_TAB) {
    if (t.index.key === undefined) return;
    var touched = false;
    for (var r = firstRow; r <= lastRow; r++) {
      var key = normHeader_(t.rows[r - 2] ? t.rows[r - 2].values[t.index.key] : '');
      if (key && key !== 'updated_at' && key !== 'server_updated_at') touched = true;
    }
    if (!touched) return;
    var prev = tsMs_(readSettings_().settings.updated_at);
    writeSetting_(sheet, 'updated_at', new Date(Math.max(now, isNaN(prev) ? 0 : prev + 1)).toISOString());
    writeSetting_(sheet, 'server_updated_at', new Date(now).toISOString());
    return;
  }

  var spec = TABS[name];
  if (!spec || stampOnly) return; // not a data tab, or they typed updated_at themselves
  ensureColumns_(sheet, ['updated_at', 'server_updated_at']);
  t = readTable_(sheet);
  var idIdx = t.index[spec.id];
  if (idIdx === undefined) return;
  var ua = t.index.updated_at, sua = t.index.server_updated_at;
  var uaCol = [], suaCol = [];
  for (var row = firstRow; row <= lastRow; row++) {
    var values = t.rows[row - 2].values;
    if (!toText_(values[idIdx])) {
      uaCol.push([values[ua]]);
      suaCol.push([values[sua]]);
      continue;
    }
    var stored = tsMs_(toTimestamp_(values[ua]));
    uaCol.push([new Date(Math.max(now, isNaN(stored) ? 0 : stored + 1)).toISOString()]);
    suaCol.push([new Date(now).toISOString()]);
  }
  sheet.getRange(firstRow, ua + 1, uaCol.length, 1).setValues(uaCol);
  sheet.getRange(firstRow, sua + 1, suaCol.length, 1).setValues(suaCol);
}

// ---------------------------------------------------------------------------------------------
// setup(): run once from the editor (safe to re-run; never deletes anything)
// ---------------------------------------------------------------------------------------------

function setup() {
  var props = PropertiesService.getScriptProperties();
  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (err) { ss = null; }
  if (!ss && props.getProperty('SPREADSHEET_ID')) ss = SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
  if (!ss) throw new Error('Open our Google Sheet, choose Extensions → Apps Script, and run setup() from there.');
  cache_.ss = ss;
  props.setProperty('SPREADSHEET_ID', ss.getId());
  var summary = ['Suite Nothings ' + VERSION + ' setup'];

  DATA_TABS.forEach(function (name) {
    var existed = !!ss.getSheetByName(name);
    var sheet = sheet_(name, TABS[name].columns);
    formatTab_(sheet, TABS[name].columns);
    summary.push((existed ? 'Checked ' : 'Created ') + name + ' tab');
  });

  var settingsExisted = !!ss.getSheetByName(SETTINGS_TAB);
  var settings = sheet_(SETTINGS_TAB, SETTINGS_COLUMNS);
  formatTab_(settings, SETTINGS_COLUMNS);
  var current = readSettings_().settings;
  var added = 0;
  Object.keys(DEFAULT_SETTINGS).forEach(function (key) {
    if (!current.hasOwnProperty(key)) { writeSetting_(settings, key, DEFAULT_SETTINGS[key]); added++; }
  });
  if (!current.updated_at) writeSetting_(settings, 'updated_at', nowIso_());
  if (added) writeSetting_(settings, 'server_updated_at', nowIso_());
  summary.push((settingsExisted ? 'Checked ' : 'Created ') + 'Settings tab' + (added ? ' (added ' + added + ' defaults)' : ''));

  formatTab_(sheet_(LOG_TAB, LOG_COLUMNS), LOG_COLUMNS);
  summary.push('Log tab ready');

  var folderId = props.getProperty('PHOTOS_FOLDER_ID');
  var folder = photosFolder_();
  summary.push(folder.getId() === folderId ? 'Photo folder kept' : 'Created Drive folder "' + PHOTOS_FOLDER_NAME + '"');

  summary.push(askForPassphrase_(props));
  props.setProperty('SCHEMA_VERSION', SCHEMA_VERSION);

  if (typeof seedLetters_ === 'function') {
    seedLetters_();
    summary.push('Letters checked');
  }
  log_('editor', 'setup', 'version ' + VERSION);
  summary.push('setup finished');
  var text = summary.join('\n');
  Logger.log(text);
  return text;
}

/** Frozen bold header, plain-text format on text columns, dropdowns on enum columns. */
function formatTab_(sheet, columns) {
  sheet.setFrozenRows(1);
  var t = readTable_(sheet);
  sheet.getRange(1, 1, 1, Math.max(t.width, 1)).setFontWeight('bold');
  if (sheet.getMaxRows() < 2) sheet.insertRowsAfter(sheet.getMaxRows(), 1);
  var rows = sheet.getMaxRows() - 1;
  columns.forEach(function (col) {
    var c = t.index[col] + 1;
    if (!c) return;
    if (isTextColumn_(col)) {
      keepDatesAsText_(sheet, t, col);
      sheet.getRange(2, c, rows, 1).setNumberFormat('@');
    }
    if (ENUMS[col]) {
      var rule = SpreadsheetApp.newDataValidation().requireValueInList(ENUMS[col], true).setAllowInvalid(true).build();
      sheet.getRange(2, c, rows, 1).setDataValidation(rule);
    }
  });
}

/** Text columns get the "@" format so Sheets never turns ISO times or ids into dates/numbers. */
function isTextColumn_(col) {
  return !NUMBER_COLUMNS[col] && !TIME_COLUMNS[col] && col !== 'date' && col !== 'deleted';
}

/** Before switching a column to plain text, turn any date cells into ISO text (same moment). */
function keepDatesAsText_(sheet, t, col) {
  var idx = t.index[col];
  var hasDate = t.rows.some(function (r) { return isDate_(r.values[idx]); });
  if (!hasDate) return;
  var column = t.rows.map(function (r) {
    return [isDate_(r.values[idx]) ? r.values[idx].toISOString() : r.values[idx]];
  });
  sheet.getRange(2, idx + 1, column.length, 1).setValues(column);
}

function askForPassphrase_(props) {
  var existing = props.getProperty('APP_KEY');
  var ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch (err) { ui = null; }
  if (!ui) {
    if (existing) return 'Passphrase kept';
    Logger.log('No passphrase yet. To set it: open Project Settings (the gear icon on the left) → ' +
      'Script properties → Add script property → Property: APP_KEY, Value: our passphrase → ' +
      'Save script properties.');
    return 'Passphrase NOT set yet (see the steps in the log)';
  }
  var message = existing
    ? 'A passphrase is already saved. To keep it, leave this empty or press Cancel. To change it, type the new one (both phones will need it).'
    : 'Both phones will type this once. Use a few words only the two of you know.';
  var answer = ui.prompt('Choose our passphrase', message, ui.ButtonSet.OK_CANCEL);
  var text = String(answer.getResponseText() || '').trim();
  if (answer.getSelectedButton() === ui.Button.OK && text) {
    props.setProperty('APP_KEY', text);
    return existing ? 'Passphrase changed' : 'Passphrase saved';
  }
  return existing ? 'Passphrase kept' : 'Passphrase NOT set yet: run setup() again to choose one';
}

// ---------------------------------------------------------------------------------------------
// selfTest(): run from the editor to check the round trip. Throws if anything is off.
// ---------------------------------------------------------------------------------------------

function selfTest() {
  var id = 'SELFTEST-' + Utilities.getUuid();
  var base = Date.now();
  var t1 = new Date(base).toISOString();
  var t2 = new Date(base + 1).toISOString();
  var since = new Date(base - 1000).toISOString();
  var visit = {
    visit_id: id, hotel_id: 'SELFTEST-HOTEL', date: '2026-01-01', check_in: '14:00', nights: 0,
    visit_type: 'Dayuse', note: 'selfTest row, safe to delete', created_at: t1, updated_at: t1, deleted: false,
  };
  var check = function (ok, what) { if (!ok) throw new Error('selfTest failed: ' + what); };
  quiet_ = true;
  try {
    var ping = JSON.parse(doGet({ parameter: { action: 'ping' } }).getContent());
    check(ping.ok && ping.version === VERSION, 'ping');
    check(POST_HANDLERS.upsertVisit(visit).applied, 'saving a test stay');
    check(!POST_HANDLERS.upsertVisit(visit).applied, 'a replayed save should change nothing');
    var changes = apiChanges_(since);
    check(changes.visits.some(function (v) { return v.visit_id === id && v.check_in === '14:00'; }), 'reading it back via changes');
    var del = apiDeleteVisit_({ visit_id: id, deleted: true, updated_at: t2 });
    check(del.applied && del.row.deleted === true, 'soft delete');
    var replay = apiDeleteVisit_({ visit_id: id, deleted: true, updated_at: t2 });
    check(!replay.applied && replay.row.deleted === true, 'replayed delete');
    var older = POST_HANDLERS.upsertVisit(visit);
    check(!older.applied && older.row.deleted === true, 'an older save must not win');
    check(countRows_('Visits', 'visit_id', id) === 1, 'no duplicate rows');
  } finally {
    removeTestRows_('Visits', 'visit_id', 'SELFTEST');
    quiet_ = false;
  }
  check(countRows_('Visits', 'visit_id', id) === 0, 'cleaning up');
  log_('editor', 'selfTest', 'passed');
  Logger.log('selfTest passed');
  return 'selfTest passed';
}

function countRows_(sheetName, idField, id) {
  var t = readTable_(sheet_(sheetName, TABS[sheetName].columns));
  return t.rows.filter(function (r) { return toText_(r.values[t.index[idField]]) === id; }).length;
}

function removeTestRows_(sheetName, idField, prefix) {
  withLock_(function () {
    var t = table_(sheetName);
    var rows = t.rows.filter(function (r) {
      return String(toText_(r.values[t.index[idField]]) || '').indexOf(prefix) === 0;
    }).map(function (r) { return r.rowNumber; });
    rows.sort(function (a, b) { return b - a; }).forEach(function (n) { t.sheet.deleteRow(n); });
  });
}

// ---------------------------------------------------------------------------------------------
// Optional hotel-info helpers (SPEC §11.4–11.5, w2-enrich). Both are off until a key is set in
// Script Properties, and both answer { ok: false, code: 'not_configured' } until then.
// ---------------------------------------------------------------------------------------------

/**
 * Rewrites already-fetched facts into a short description with a hosted model. The app builds the
 * prompt from facts only. Script Properties: AI_API_KEY, AI_PROVIDER ('gemini' or 'claude'),
 * optional AI_MODEL.
 */
function apiAiDescribe_(p) {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('AI_API_KEY');
  var provider = String(props.getProperty('AI_PROVIDER') || 'gemini').toLowerCase();
  if (!key) return { ok: false, code: 'not_configured' };
  var prompt = toText_(p.prompt).slice(0, 4000);
  if (!prompt) throw apiError_('bad_request', 'aiDescribe needs a prompt.');
  var model = props.getProperty('AI_MODEL');
  var res;
  if (provider === 'claude') {
    res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify({ model: model || 'claude-haiku-4-5-20251001', max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) return { ok: false, code: 'ai_failed', status: res.getResponseCode() };
    var body = JSON.parse(res.getContentText());
    var text = (body.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('');
    return { ok: true, text: text };
  }
  res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model || 'gemini-2.0-flash') + ':generateContent', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': key },
    payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 400 } }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) return { ok: false, code: 'ai_failed', status: res.getResponseCode() };
  var g = JSON.parse(res.getContentText());
  var parts = (((g.candidates || [])[0] || {}).content || {}).parts || [];
  return { ok: true, text: parts.map(function (x) { return x.text || ''; }).join('') };
}

/**
 * Google Places (New) text search for one hotel near its pin. Needs PLACES_API_KEY with billing
 * enabled on its Google Cloud project — every call can cost money (see SETUP.md).
 */
function apiPlacesLookup_(p) {
  var key = PropertiesService.getScriptProperties().getProperty('PLACES_API_KEY');
  if (!key) return { ok: false, code: 'not_configured' };
  var name = toText_(p.name);
  var lat = Number(p.lat), lng = Number(p.lng);
  if (!name || !isFinite(lat) || !isFinite(lng)) throw apiError_('bad_request', 'placesLookup needs a name, lat and lng.');
  var res = UrlFetchApp.fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.formattedAddress,places.websiteUri,places.internationalPhoneNumber,places.priceLevel',
    },
    payload: JSON.stringify({ textQuery: name, maxResultCount: 1, locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 300 } } }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) return { ok: false, code: 'places_failed', status: res.getResponseCode() };
  var place = (JSON.parse(res.getContentText()).places || [])[0];
  if (!place) return { ok: true };
  return {
    ok: true,
    address: place.formattedAddress || null,
    website: place.websiteUri || null,
    phone: place.internationalPhoneNumber || null,
    price_level: place.priceLevel || null,
  };
}

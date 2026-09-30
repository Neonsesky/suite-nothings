// A local stand-in for a deployed Apps Script web app, for Playwright and unit tests.
// The real apps-script/Code.gs answers (through tools/gas-harness); this file only mimics
// Google's HTTP behaviour: 302 to /macros/echo, CORS "*" on the echo, no preflight support.
//
// Usage: node tools/mock-apps-script.mjs --port <n> [--key <passphrase>] [--verbose]
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createGasEnv } from './gas-harness/index.mjs';

const NOT_FOUND_HTML = '<!DOCTYPE html><html><head><title>Error</title></head><body>Sorry, unable to open the file at this time.</body></html>';
const LOGIN_HTML = '<!DOCTYPE html><html><head><title>Sign in – Google Accounts</title></head><body><h1>Sign in</h1><p>to continue to Google Drive</p></body></html>';
const CORS = { 'Access-Control-Allow-Origin': '*' };
const ADMIN_CORS = { ...CORS, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type' };

function entityId(action, payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (action === 'uploadPhoto') return payload.photo?.photo_id ?? null;
  if (action === 'updateSettings') return 'settings';
  const byAction = { upsertHotel: 'hotel_id', upsertVisit: 'visit_id', deleteVisit: 'visit_id', upsertWish: 'wish_id', upsertLetter: 'letter_id', markLetterRead: 'letter_id' };
  const key = byAction[action] ?? Object.keys(payload).find((k) => k.endsWith('_id') && payload[k]);
  return key ? String(payload[key]) : null;
}

export async function startMockServer({ port = Number(process.env.MOCK_PORT || 0), key = 'our-secret-suite', verbose = false, host = '127.0.0.1' } = {}) {
  let state;
  const fresh = () => {
    const env = createGasEnv({ appKey: key, bound: false });
    env.run('setup');
    state = { env, echoes: new Map(), active: new Set(['MOCK']), login: new Set(), delay: 0, down: false, stats: { posts: {}, gets: {}, writes: [] } };
  };
  fresh();

  const send = (res, status, headers, body = '') => { res.writeHead(status, headers); res.end(body); };
  const json = (res, status, data) => send(res, status, { ...ADMIN_CORS, 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify(data));
  const readBody = (req) => new Promise((ok, fail) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
    req.on('error', fail);
  });
  const origin = (req) => `http://${req.headers.host || `${host}:${port}`}`;

  async function admin(req, res, url) {
    if (req.method === 'OPTIONS') return send(res, 204, ADMIN_CORS);
    const body = req.method === 'POST' ? JSON.parse((await readBody(req)) || '{}') : {};
    const route = url.pathname.replace('/__admin/', '');
    const { env } = state;
    if (route === 'rows') return json(res, 200, env.ss.sheet(url.searchParams.get('sheet') || 'Visits').rows());
    if (route === 'stats') return json(res, 200, state.stats);
    if (route === 'reset') { fresh(); return json(res, 200, { ok: true }); }
    if (route === 'delay') { state.delay = Number(body.ms) || 0; return json(res, 200, { ok: true, ms: state.delay }); }
    if (route === 'down') { state.down = !!body.down; return json(res, 200, { ok: true, down: state.down }); }
    if (route === 'deployments') {
      if (Array.isArray(body.active)) state.active = new Set(body.active.map(String));
      if (Array.isArray(body.login)) state.login = new Set(body.login.map(String));
      return json(res, 200, { ok: true, active: [...state.active], login: [...state.login] });
    }
    if (route === 'edit') {
      const sheet = env.ss.sheet(String(body.sheet || ''));
      const row = sheet.exists() ? sheet.rowOf(String(body.id)) : null;
      if (!row) return json(res, 404, { ok: false, error: `No row ${body.id} in ${body.sheet}` });
      sheet.editCell(row, String(body.column), body.value);
      return json(res, 200, { ok: true, row: sheet.rows().find((r) => Object.values(r).some((v) => String(v) === String(body.id))) });
    }
    return json(res, 404, { ok: false, error: 'Unknown admin route' });
  }

  async function exec(req, res, url, deployment) {
    if (req.method === 'OPTIONS') return send(res, 405, { 'Content-Type': 'text/html; charset=utf-8' }, 'Method Not Allowed');
    if (state.login.has(deployment) || url.pathname.endsWith('/dev')) return send(res, 302, { Location: `${origin(req)}/login`, ...CORS });
    if (!state.active.has(deployment)) return send(res, 404, { ...CORS, 'Content-Type': 'text/html; charset=utf-8' }, NOT_FOUND_HTML);
    const params = Object.fromEntries(url.searchParams);
    let out;
    if (req.method === 'POST') {
      const text = await readBody(req);
      let parsed = null;
      try { parsed = JSON.parse(text); } catch { /* Code.gs answers bad_request */ }
      const action = parsed?.action ? String(parsed.action) : '(invalid)';
      state.stats.posts[action] = (state.stats.posts[action] || 0) + 1;
      state.stats.writes.push({ action, id: entityId(action, parsed?.payload) });
      out = state.env.call.post(text, params);
    } else {
      const action = params.action || '(none)';
      state.stats.gets[action] = (state.stats.gets[action] || 0) + 1;
      out = state.env.call.get(params);
    }
    const token = randomUUID().replace(/-/g, '');
    state.echoes.set(token, JSON.stringify(out));
    if (state.echoes.size > 500) state.echoes.delete(state.echoes.keys().next().value);
    // Google sends CORS "*" on the 302 too; browsers require it to follow a cross-origin redirect.
    return send(res, 302, { Location: `${origin(req)}/macros/echo?user_content_key=${token}`, ...CORS });
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    if (verbose) console.log(`${new Date().toISOString()} ${req.method} ${url.pathname}${url.search}`);
    try {
      if (url.pathname.startsWith('/__admin/')) return await admin(req, res, url);
      if (state.down) { req.socket.destroy(); return; }
      if (state.delay) await new Promise((r) => setTimeout(r, state.delay));
      const m = /^\/macros\/s\/([^/]+)\/(exec|dev)$/.exec(url.pathname);
      if (m) return await exec(req, res, url, m[1]);
      if (url.pathname === '/macros/echo' && req.method === 'GET') {
        const body = state.echoes.get(url.searchParams.get('user_content_key') || '');
        if (!body) return send(res, 404, { ...CORS, 'Content-Type': 'text/html; charset=utf-8' }, NOT_FOUND_HTML);
        return send(res, 200, { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }, body);
      }
      if (url.pathname === '/login') return send(res, 200, { ...CORS, 'Content-Type': 'text/html; charset=utf-8' }, LOGIN_HTML);
      if (req.method === 'OPTIONS') return send(res, 405, {}, '');
      return send(res, 404, { ...CORS, 'Content-Type': 'text/html; charset=utf-8' }, NOT_FOUND_HTML);
    } catch (err) {
      return json(res, 500, { ok: false, error: String(err && err.message ? err.message : err) });
    }
  });

  await new Promise((ok) => server.listen(port, host, ok));
  const actualPort = server.address().port;
  const url = `http://${host}:${actualPort}`;
  return {
    url,
    port: actualPort,
    execUrl: (id = 'MOCK') => `${url}/macros/s/${id}/exec`,
    env: () => state.env,
    close: () => new Promise((ok) => { server.closeAllConnections?.(); server.close(() => ok()); }),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const get = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const port = Number(get('--port') ?? process.env.MOCK_PORT ?? 8787);
  const server = await startMockServer({ port, key: get('--key') ?? 'our-secret-suite', verbose: args.includes('--verbose') });
  console.log(`Mock Apps Script ready: ${server.execUrl()}`);
}

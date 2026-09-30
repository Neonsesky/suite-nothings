// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startMockServer, type MockServer } from '../../tools/mock-apps-script.mjs';

const KEY = 'test-key';
let server: MockServer;
beforeAll(async () => { server = await startMockServer({ port: 0, key: KEY }); });
afterAll(async () => { await server.close(); });

const admin = (path: string, body?: unknown) =>
  fetch(`${server.url}/__admin/${path}`, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }).then((r) => r.json());
const post = (action: string, payload: unknown) =>
  fetch(server.execUrl(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ key: KEY, action, payload }), redirect: 'follow' });

describe('mock Apps Script server', () => {
  it('302s to the echo URL, which serves JSON with CORS', async () => {
    const raw = await fetch(`${server.execUrl()}?action=ping`, { redirect: 'manual' });
    expect(raw.status).toBe(302);
    expect(raw.headers.get('location')).toMatch(new RegExp(`^${server.url}/macros/echo\\?user_content_key=`));
    const res = await fetch(`${server.execUrl()}?action=ping`);
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(await res.json()).toMatchObject({ ok: true, version: '1.0.0' });
    const boot = await fetch(`${server.execUrl()}?action=bootstrap&key=${KEY}`).then((r) => r.json());
    expect(boot.data.settings.units).toBe('km');
  });

  it('POST upsertVisit goes through Code.gs and is counted', async () => {
    const visit = { visit_id: 'V1', hotel_id: 'H1', date: '2026-06-19', updated_at: '2026-06-19T10:00:00.000Z' };
    const body = await post('upsertVisit', visit).then((r) => r.json());
    expect(body.data).toMatchObject({ applied: true, row: { visit_id: 'V1' } });
    const stats = await admin('stats');
    expect(stats.posts.upsertVisit).toBe(1);
    expect(stats.writes).toEqual([{ action: 'upsertVisit', id: 'V1' }]);
    expect((await admin('rows?sheet=Visits'))[0].visit_id).toBe('V1');
  });

  it('admin edit fires onEdit and shows up in changes', async () => {
    const since = new Date(Date.now() - 1).toISOString();
    expect((await admin('edit', { sheet: 'Visits', id: 'V1', column: 'note', value: 'by hand' })).ok).toBe(true);
    const changes = await fetch(`${server.execUrl()}?action=changes&key=${KEY}&since=${encodeURIComponent(since)}`).then((r) => r.json());
    expect(changes.data.visits[0]).toMatchObject({ visit_id: 'V1', note: 'by hand' });
  });

  it('unknown or retired deployments answer 404 HTML; OPTIONS is 405 without CORS', async () => {
    const res = await fetch(`${server.url}/macros/s/OTHER/exec?action=ping`);
    expect(res.status).toBe(404);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(await res.text()).toContain('Sorry, unable to open the file at this time.');
    const pre = await fetch(server.execUrl(), { method: 'OPTIONS' });
    expect(pre.status).toBe(405);
    expect(pre.headers.get('access-control-allow-origin')).toBeNull();
    await admin('deployments', { active: ['NEW'], login: ['LOCKED'] });
    expect((await fetch(`${server.execUrl()}?action=ping`)).status).toBe(404);
    expect((await fetch(`${server.execUrl('NEW')}?action=ping`).then((r) => r.json())).ok).toBe(true);
    expect(await fetch(`${server.execUrl('LOCKED')}?action=ping`).then((r) => r.text())).toContain('Sign in – Google Accounts');
  });

  it('down drops the socket; reset gives a fresh env', async () => {
    await admin('down', { down: true });
    await expect(fetch(`${server.execUrl('NEW')}?action=ping`)).rejects.toThrow();
    await admin('reset');
    expect(await admin('rows?sheet=Visits')).toEqual([]);
    expect((await fetch(`${server.execUrl()}?action=ping`).then((r) => r.json())).ok).toBe(true);
  });
});

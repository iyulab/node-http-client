import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse as MswHttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { HttpClient } from '../src/HttpClient';
import { CancelToken } from '../src/CancelToken';
import { CanceledError } from '../src/CanceledError';

/**
 * 동사 메서드의 요청 단위 옵션 — 헤더와 표준 `AbortSignal`.
 *
 * 토큰(`CancelToken`)만 받던 자리라, 요청마다 헤더(예: `If-Match`)를 싣거나 `fetch` 표준 신호로
 * 취소하려면 소비자가 `send()` 로 요청 객체를 직접 조립해야 했다(URL 의 쿼리 원문 처리까지).
 */
const server = setupServer(
  http.patch('https://api.test.com/items/1', ({ request }) =>
    MswHttpResponse.json({ ifMatch: request.headers.get('If-Match') })),
  http.get('https://api.test.com/echo', ({ request }) =>
    MswHttpResponse.json({ ifMatch: request.headers.get('If-Match'), q: new URL(request.url).search })),
  http.get('https://api.test.com/slow', async () => {
    await new Promise((r) => setTimeout(r, 200));
    return MswHttpResponse.json({});
  }),
);
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('HttpClient — RequestOptions', () => {
  it('🔴per-request headers reach the request (PATCH with a body)', async () => {
    const client = new HttpClient({});
    const res = await client.patch('https://api.test.com/items/1', { a: 1 }, { headers: { 'If-Match': 'W/"7"' } });
    expect(await res.json()).toEqual({ ifMatch: 'W/"7"' });
  });

  it('keeps the raw query string when options are given', async () => {
    const client = new HttpClient({});
    const res = await client.get('https://api.test.com/echo?$filter=Name%20eq%20%27a%27', { headers: { 'If-Match': '*' } });
    expect(await res.json()).toEqual({ ifMatch: '*', q: '?$filter=Name%20eq%20%27a%27' });
  });

  it('🔴an AbortSignal cancels the request with CanceledError whose cause chain carries the reason', async () => {
    const client = new HttpClient({});
    const ac = new AbortController();
    const p = client.get('https://api.test.com/slow', { signal: ac.signal });
    ac.abort();
    await expect(p).rejects.toBeInstanceOf(CanceledError);
    expect(ac.signal.reason?.name).toBe('AbortError');
  });

  it('an already-aborted signal rejects without waiting for the server', async () => {
    const client = new HttpClient({});
    const ac = new AbortController();
    ac.abort();
    const started = Date.now();
    await expect(client.get('https://api.test.com/slow', { signal: ac.signal })).rejects.toBeInstanceOf(CanceledError);
    expect(Date.now() - started).toBeLessThan(150);
  });

  it('a CancelToken still works as the last argument, and inside options', async () => {
    const client = new HttpClient({});
    const t1 = new CancelToken();
    const p1 = client.get('https://api.test.com/slow', t1);
    t1.cancel();
    await expect(p1).rejects.toBeInstanceOf(CanceledError);
    const t2 = new CancelToken();
    const p2 = client.get('https://api.test.com/slow', { cancelToken: t2 });
    t2.cancel();
    await expect(p2).rejects.toBeInstanceOf(CanceledError);
  });
});

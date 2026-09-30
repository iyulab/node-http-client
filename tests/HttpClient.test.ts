import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse as MswHttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { HttpClient } from '../src/HttpClient';
import { HttpResponse } from '../src/HttpResponse';
import { CancelToken } from '../src/CancelToken';
import { CanceledError } from '../src/CanceledError';
import type { RequestConfig } from '../src/types/Interceptors';

// MSW 서버 설정
const server = setupServer(
  http.get('https://api.test.com/users', () => {
    return MswHttpResponse.json({ users: ['alice', 'bob'] });
  }),
  http.get('https://api.test.com/protected', ({ request }) => {
    const auth = request.headers.get('Authorization');
    if (auth === 'Bearer test-token') {
      return MswHttpResponse.json({ data: 'secret' });
    }
    return new MswHttpResponse(null, { status: 401, statusText: 'Unauthorized' });
  }),
  http.get('https://api.test.com/protected-with-body', () => {
    return MswHttpResponse.json({ message: 'Session expired' }, { status: 401 });
  }),
  http.get('https://api.test.com/echo-headers', ({ request }) => {
    return MswHttpResponse.json({
      apiKey: request.headers.get('X-API-Key'),
      trace: request.headers.get('X-Trace-Id'),
      contentType: request.headers.get('Content-Type'),
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('HttpClient requests', () => {

  it('a request with only a base URL works', async () => {
    const client = new HttpClient({
      baseUrl: 'https://api.test.com',
    });

    const res = await client.get('/users');
    expect(res.ok).toBe(true);
    const data = await res.json<{ users: string[] }>();
    expect(data.users).toEqual(['alice', 'bob']);
  });

  it('per-request headers accept a plain object (HeadersInit)', async () => {
    const client = new HttpClient({ baseUrl: 'https://api.test.com' });

    const res = await client.send({
      method: 'GET',
      path: '/echo-headers',
      headers: { 'X-API-Key': 'abc-123', 'X-Trace-Id': 'trace-1' },
    });
    expect(res.ok).toBe(true);
    const data = await res.json<{ apiKey: string; trace: string }>();
    expect(data.apiKey).toBe('abc-123');
    expect(data.trace).toBe('trace-1');
  });

  it('per-request headers accept a Headers instance', async () => {
    const client = new HttpClient({ baseUrl: 'https://api.test.com' });

    const headers = new Headers();
    headers.set('X-API-Key', 'from-headers-class');
    const res = await client.send({ method: 'GET', path: '/echo-headers', headers });
    expect(res.ok).toBe(true);
    const data = await res.json<{ apiKey: string }>();
    expect(data.apiKey).toBe('from-headers-class');
  });

  it('per-request headers override instance default headers for the same key', async () => {
    const client = new HttpClient({
      baseUrl: 'https://api.test.com',
      headers: { 'X-API-Key': 'instance-default' },
    });

    const res = await client.send({
      method: 'GET',
      path: '/echo-headers',
      headers: { 'X-API-Key': 'request-override' },
    });
    const data = await res.json<{ apiKey: string }>();
    expect(data.apiKey).toBe('request-override');
  });

});

describe('HttpClient interceptors', () => {

  it('request interceptor can modify headers', async () => {
    const client = new HttpClient({ baseUrl: 'https://api.test.com' });

    client.interceptors.request.use((req) => {
      req.headers.set('Authorization', 'Bearer test-token');
      return req;
    });

    const res = await client.get('/protected');
    expect(res.ok).toBe(true);
    const data = await res.json<{ data: string }>();
    expect(data.data).toBe('secret');
  });

  it('request interceptor can modify path/query before the URL is built', async () => {
    const client = new HttpClient({ baseUrl: 'https://api.test.com' });

    client.interceptors.request.use((req) => {
      req.path = '/echo-headers';
      return req;
    });

    const res = await client.get('/users');
    expect(res.ok).toBe(true);
    expect(res.url).toContain('/echo-headers');
  });

  it('multiple request interceptors run in registration order', async () => {
    const client = new HttpClient({ baseUrl: 'https://api.test.com' });
    const order: string[] = [];

    client.interceptors.request.use((req) => {
      order.push('first');
      return req;
    });
    client.interceptors.request.use((req) => {
      order.push('second');
      return req;
    });

    await client.get('/users');
    expect(order).toEqual(['first', 'second']);
  });

  it('ejected request interceptor no longer runs', async () => {
    const client = new HttpClient({ baseUrl: 'https://api.test.com' });
    const spy = vi.fn((req: RequestConfig) => req);

    const id = client.interceptors.request.use(spy);
    client.interceptors.request.eject(id);

    await client.get('/users');
    expect(spy).not.toHaveBeenCalled();
  });

  it('response interceptor can inspect/transform the resolved response', async () => {
    const client = new HttpClient({ baseUrl: 'https://api.test.com' });
    const seen: number[] = [];

    client.interceptors.response.use((res) => {
      seen.push(res.status);
      return res;
    });

    const res = await client.get('/users');
    expect(res.ok).toBe(true);
    expect(seen).toEqual([200]);
  });

  it('response interceptor resolved handler can retry on 401 using the provided config', async () => {
    const client = new HttpClient({ baseUrl: 'https://api.test.com' });
    let retried = false;

    client.interceptors.response.use(async (res, config) => {
      if (res.status === 401 && !retried) {
        retried = true;
        config.headers.set('Authorization', 'Bearer test-token');
        return client.send(config);
      }
      return res;
    });

    const res = await client.get('/protected');
    expect(res.ok).toBe(true);
    const data = await res.json<{ data: string }>();
    expect(data.data).toBe('secret');
  });

  it('response interceptor rejected handler can recover from a fetch failure', async () => {
    const client = new HttpClient({ baseUrl: 'https://api.test.com' });
    let attempts = 0;

    server.use(
      http.get('https://api.test.com/flaky', () => {
        attempts += 1;
        if (attempts === 1) {
          return MswHttpResponse.error();
        }
        return MswHttpResponse.json({ ok: true });
      }),
    );

    client.interceptors.response.use(undefined, async (_error, config) => {
      return client.send(config);
    });

    const res = await client.get('/flaky');
    expect(res.ok).toBe(true);
    expect(attempts).toBe(2);
  });

  it('response interceptor rejected handler receives a CanceledError for cancelled requests, distinguishable from other failures', async () => {
    const client = new HttpClient({ baseUrl: 'https://api.test.com' });
    const token = new CancelToken();
    let sawCanceledError = false;

    client.interceptors.response.use(undefined, async (error) => {
      sawCanceledError = error instanceof CanceledError;
      throw error;
    });

    const promise = client.get('/users', token);
    token.cancel();

    await expect(promise).rejects.toBeInstanceOf(CanceledError);
    expect(sawCanceledError).toBe(true);
  });

  it('response interceptor rejected handler can still choose to recover a cancelled request', async () => {
    const client = new HttpClient({ baseUrl: 'https://api.test.com' });
    const token = new CancelToken();

    client.interceptors.response.use(undefined, async () => {
      // 취소된 요청이지만 인터셉터가 명시적으로 복구를 선택하면 존중됨
      return new HttpResponse(new Response('{}', { status: 200 }));
    });

    const promise = client.get('/users', token);
    token.cancel();

    const res = await promise;
    expect(res.status).toBe(200);
  });

});

describe('HttpClient — query string in the URL is sent as given', () => {
  // A server-issued link (for example an OData `@odata.nextLink`) must be followed opaquely. The client
  // used to decode the query and re-encode it with form rules: `$` became `%24` and `+` meant a space.
  const echo = () => server.use(
    http.get('https://api.test.com/raw', ({ request }) => MswHttpResponse.json({ search: new URL(request.url).search })),
  );

  it('keeps $-prefixed names and an already-encoded value byte for byte', async () => {
    echo();
    const client = new HttpClient({ baseUrl: 'https://api.test.com' });
    const res = await client.get("/raw?$filter=Name%20eq%20%27a%27&$skiptoken=x+y");
    expect((await res.json<{ search: string }>()).search).toBe("?$filter=Name%20eq%20%27a%27&$skiptoken=x+y");
  });

  it('follows an absolute next link without rewriting it', async () => {
    echo();
    const client = new HttpClient({ baseUrl: 'https://api.test.com' });
    const res = await client.get('https://api.test.com/raw?$skiptoken=2&$top=50');
    expect((await res.json<{ search: string }>()).search).toBe('?$skiptoken=2&$top=50');
  });

  it('rebuilds the query when a request interceptor changes it', async () => {
    echo();
    const client = new HttpClient({ baseUrl: 'https://api.test.com' });
    client.interceptors.request.use((req) => {
      req.query = { ...req.query, tenant: 't1' };
      return req;
    });
    const res = await client.get('/raw?$top=5');
    const { search } = await res.json<{ search: string }>();
    expect(new URLSearchParams(search).get('$top')).toBe('5');
    expect(new URLSearchParams(search).get('tenant')).toBe('t1');
  });
});

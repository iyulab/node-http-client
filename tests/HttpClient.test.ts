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

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('HttpClient onRequest/onResponse hooks', () => {

  it('onRequest hook is called before each request and can modify headers', async () => {
    const client = new HttpClient({
      baseUrl: 'https://api.test.com',
      onRequest: (_req, headers) => {
        headers.set('Authorization', 'Bearer test-token');
      },
    });

    const res = await client.get('/protected');
    expect(res.ok).toBe(true);
    const data = await res.json<{ data: string }>();
    expect(data.data).toBe('secret');
  });

  it('onRequest supports async functions', async () => {
    const client = new HttpClient({
      baseUrl: 'https://api.test.com',
      onRequest: async (_req, headers) => {
        // 비동기 토큰 조회 시뮬레이션
        const token = await Promise.resolve('Bearer test-token');
        headers.set('Authorization', token);
      },
    });

    const res = await client.get('/protected');
    expect(res.ok).toBe(true);
    const data = await res.json<{ data: string }>();
    expect(data.data).toBe('secret');
  });

  it('when onRequest is not provided, requests work normally', async () => {
    const client = new HttpClient({
      baseUrl: 'https://api.test.com',
    });

    const res = await client.get('/users');
    expect(res.ok).toBe(true);
    const data = await res.json<{ users: string[] }>();
    expect(data.users).toEqual(['alice', 'bob']);
  });

  it('when onRequest throws, the request fails with that error', async () => {
    const client = new HttpClient({
      baseUrl: 'https://api.test.com',
      onRequest: () => {
        throw new Error('Token expired');
      },
    });

    await expect(client.get('/users')).rejects.toThrow('Token expired');
  });

  it('onResponse hook is called after each response', async () => {
    const onResponse = vi.fn();
    const client = new HttpClient({
      baseUrl: 'https://api.test.com',
      onResponse,
    });

    const res = await client.get('/users');
    expect(res.ok).toBe(true);

    expect(onResponse).toHaveBeenCalledOnce();
    expect(onResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        status: 200,
        statusText: expect.any(String),
        headers: expect.any(Headers),
        url: expect.stringContaining('/users'),
      }),
    );
  });

  it('onResponse can throw errors which propagate to caller', async () => {
    const client = new HttpClient({
      baseUrl: 'https://api.test.com',
      onResponse: (res) => {
        if (res.status === 401) {
          throw new Error('Unauthorized - please login');
        }
      },
    });

    // /protected without auth header => 401
    await expect(client.get('/protected')).rejects.toThrow('Unauthorized - please login');
  });

  it('onResponse can read the response body via response.response and throw a friendly error (short-circuit)', async () => {
    const client = new HttpClient({
      baseUrl: 'https://api.test.com',
      onResponse: async (res) => {
        if (res.status === 401) {
          const body = await res.response.json<{ message: string }>();
          throw new Error(`Unauthorized: ${body.message}`);
        }
      },
    });

    await expect(client.get('/protected-with-body')).rejects.toThrow('Unauthorized: Session expired');
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

  it('onRequest -> fetch -> onResponse execution order', async () => {
    const order: string[] = [];

    const client = new HttpClient({
      baseUrl: 'https://api.test.com',
      onRequest: () => {
        order.push('onRequest');
      },
      onResponse: () => {
        order.push('onResponse');
      },
    });

    await client.get('/users');
    expect(order).toEqual(['onRequest', 'onResponse']);
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

  it('legacy onRequest/onResponse hooks keep working unchanged alongside interceptors', async () => {
    const order: string[] = [];
    const client = new HttpClient({
      baseUrl: 'https://api.test.com',
      onRequest: () => {
        order.push('onRequest');
      },
      onResponse: () => {
        order.push('onResponse');
      },
    });

    client.interceptors.request.use((req) => {
      order.push('requestInterceptor');
      return req;
    });
    client.interceptors.response.use((res) => {
      order.push('responseInterceptor');
      return res;
    });

    const res = await client.get('/users');
    expect(res.ok).toBe(true);
    expect(order).toEqual(['requestInterceptor', 'onRequest', 'responseInterceptor', 'onResponse']);
  });
});

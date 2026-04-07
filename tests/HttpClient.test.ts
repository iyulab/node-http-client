import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse as MswHttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { HttpClient } from '../src/HttpClient';

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

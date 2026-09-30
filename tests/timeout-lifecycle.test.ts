import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { HttpClient } from '../src/HttpClient';
import { CancelToken } from '../src/CancelToken';
import { CanceledError } from '../src/CanceledError';

/**
 * `timeout` 은 응답 헤더까지가 아니라 본문을 다 읽을 때까지를 잰다. `idleTimeout` 은 멈춘 스트림만 끊는다.
 *
 * 종전에는 헤더를 받는 순간 타이머가 풀려, 본문·SSE 가 멈추면 요청이 영원히 끝나지 않았다
 * (로컬 서버 실측: `timeout: 500` 에 3초 상한까지 대기). 그리고 시간 초과가 호출자의 `CancelToken` 을
 * 취소해, 재사용하는 토큰이 다음 요청까지 죽었다.
 */
let server: http.Server;
let base = '';

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/stall-json') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': '100' });
      res.write('{"a":');
    } else if (req.url === '/stall-sse') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('data: one\n\n');
    } else if (req.url === '/slow-sse') {
      // 100ms 마다 한 이벤트, 모두 6개 — 전체 ~600ms
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      let n = 0;
      const t = setInterval(() => {
        res.write(`data: ${++n}\n\n`);
        if (n === 6) {
          clearInterval(t);
          res.end();
        }
      }, 100);
    } else if (req.url === '/fast') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
});

describe('timeout 은 본문까지 잰다', () => {
  it('헤더 뒤 본문이 멈추면 CanceledError 로 끝난다', async () => {
    const client = new HttpClient({ baseUrl: base, timeout: 300 });
    const res = await client.get('/stall-json');
    const started = Date.now();
    await expect(res.json()).rejects.toBeInstanceOf(CanceledError);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('SSE 가 멈추면 CanceledError 로 끝난다', async () => {
    const client = new HttpClient({ baseUrl: base, timeout: 300 });
    const res = await client.get('/stall-sse');
    const got: unknown[] = [];
    await expect((async () => {
      for await (const ev of res.stream({ format: 'sse' })) got.push(ev);
    })()).rejects.toBeInstanceOf(CanceledError);
    expect(got.length).toBe(1);
  });

  it('시간 초과는 호출자의 CancelToken 을 취소하지 않는다', async () => {
    const client = new HttpClient({ baseUrl: base, timeout: 200 });
    const token = new CancelToken();
    const res = await client.get('/stall-json', token);
    await expect(res.text()).rejects.toBeInstanceOf(CanceledError);
    expect(token.isCancelled).toBe(false);
    // 같은 토큰으로 다음 요청이 된다
    const next = await client.get('/fast', token);
    expect(await next.json()).toEqual({ ok: true });
  });

  it('제때 읽은 응답은 그대로 끝난다', async () => {
    const client = new HttpClient({ baseUrl: base, timeout: 300 });
    const res = await client.get('/fast');
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe('stream({ idleTimeout })', () => {
  it('계속 흐르는 스트림은 전체가 길어도 끊지 않는다', async () => {
    const client = new HttpClient({ baseUrl: base });
    const res = await client.get('/slow-sse');
    const got: unknown[] = [];
    for await (const ev of res.stream({ format: 'sse', idleTimeout: 300 })) got.push(ev);
    expect(got.length).toBe(6);
  });

  it('다음 조각이 제때 오지 않으면 끊고 CanceledError 를 던진다', async () => {
    const client = new HttpClient({ baseUrl: base });
    const res = await client.get('/stall-sse');
    const got: unknown[] = [];
    const started = Date.now();
    const run = (async () => {
      for await (const ev of res.stream({ format: 'sse', idleTimeout: 300 })) got.push(ev);
    })();
    await expect(run).rejects.toThrow(/idle/);
    expect(got.length).toBe(1);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

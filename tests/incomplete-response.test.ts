import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { HttpClient } from '../src/HttpClient';
import { CanceledError } from '../src/CanceledError';
import { IncompleteResponseError } from '../src/IncompleteResponseError';

/**
 * 헤더를 받은 뒤 본문 도중 연결이 끊기면 `IncompleteResponseError` 다. 런타임의 원래 오류
 * (Node `terminated` · Chromium `network error`/`Failed to fetch`)는 메시지가 제각각이고
 * Chromium 의 `text()` 는 연결 거부와 같은 메시지라, 소비자가 메시지로 가를 수 없다.
 * 취소·시간 초과는 계속 `CanceledError` 이고, 끊김이 아닌 오류(파싱·두 번 읽기)는 바꾸지 않는다.
 */
let server: http.Server;
let base = '';

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const cut = () => setTimeout(() => res.socket?.destroy(), 50);
    if (req.url === '/json-cut') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': '100' });
      res.write('{"a":');
      cut();
    } else if (req.url === '/sse-cut') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('data: one\n\n');
      cut();
    } else if (req.url === '/bad-json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"a":');
    } else if (req.url === '/bad-jsonl') {
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
      res.end('{"a":1}\n{broken\n');
    } else if (req.url === '/stall-sse') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('data: one\n\n');
    } else {
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

describe('IncompleteResponseError — 본문 도중 끊김', () => {
  const client = () => new HttpClient({ baseUrl: base });

  it('json() 도중 끊기면 IncompleteResponseError 이고 TypeError 이기도 하다', async () => {
    const res = await client().get('/json-cut');
    const error = await res.json<unknown>().then(() => undefined, (e: Error) => e);
    expect(error).toBeInstanceOf(IncompleteResponseError);
    expect(error).toBeInstanceOf(TypeError);
    expect(error?.name).toBe('IncompleteResponseError');
    expect(error?.cause).toBeInstanceOf(TypeError); // 런타임의 원래 오류
  });

  it('text() 도중 끊겨도 같다', async () => {
    const res = await client().get('/json-cut');
    await expect(res.text()).rejects.toBeInstanceOf(IncompleteResponseError);
  });

  it('SSE 스트림 도중 끊기면 받은 이벤트 뒤에 IncompleteResponseError', async () => {
    const res = await client().get('/sse-cut');
    const got: unknown[] = [];
    const error = await (async () => {
      for await (const ev of res.stream({ format: 'sse' })) got.push(ev);
    })().catch((e) => e);
    expect(got.length).toBe(1);
    expect(error).toBeInstanceOf(IncompleteResponseError);
  });

  it('완전히 받은 본문의 JSON 파싱 오류는 바꾸지 않는다(SyntaxError)', async () => {
    const res = await client().get('/bad-json');
    const error = await res.json<unknown>().then(() => undefined, (e: Error) => e);
    expect(error).toBeInstanceOf(SyntaxError);
    expect(error).not.toBeInstanceOf(IncompleteResponseError);
  });

  it('JSON 줄 스트림의 파싱 실패도 끊김으로 바꾸지 않는다', async () => {
    const res = await client().get('/bad-jsonl');
    const error = await (async () => {
      for await (const _ of res.stream({ format: 'json' })) { /* 읽기만 */ }
    })().catch((e) => e);
    expect(error).not.toBeInstanceOf(IncompleteResponseError);
  });

  it('두 번 읽기(사용 오류)는 바꾸지 않는다', async () => {
    const res = await client().get('/ok');
    await res.json();
    const error = await res.text().catch((e) => e);
    expect(error).toBeInstanceOf(TypeError);
    expect(error).not.toBeInstanceOf(IncompleteResponseError);
  });

  it('유휴 초과와 시간 초과는 계속 CanceledError 다', async () => {
    const idleRes = await client().get('/stall-sse');
    await expect((async () => {
      for await (const _ of idleRes.stream({ format: 'sse', idleTimeout: 150 })) { /* 읽기만 */ }
    })()).rejects.toBeInstanceOf(CanceledError);

    const timed = await new HttpClient({ baseUrl: base, timeout: 150 }).get('/stall-sse');
    await expect(timed.text()).rejects.toBeInstanceOf(CanceledError);
  });
});

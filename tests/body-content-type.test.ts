import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse as MswHttpResponse } from 'msw';
import { HttpClient } from '../src/HttpClient';

/**
 * 본문 종류가 `Content-Type` 과 직렬화를 정한다 — 헤더 값 하나가 본문을 망가뜨리지 않는다.
 *
 * 종전에는 인스턴스 기본 헤더에 `Content-Type: application/json` 을 두면(다른 클라이언트에서 옮겨 올 때의 흔한 습관):
 *   ⑴ `send()` 가 `FormData` 본문을 `JSON.stringify` 해 `"{}"` 로 보냈다 — 파일과 필드가 소리 없이 사라지고, 헤더도 JSON 이라 서버가 읽을 길이 없다.
 *   ⑵ `upload()` 가 그 헤더를 `xhr.setRequestHeader` 로 그대로 실어 multipart 가 JSON 으로 선언됐다(boundary 가 없다).
 * `FormData` 의 `Content-Type` 은 boundary 때문에 플랫폼만 정할 수 있다 — 호출자가 준 값은 어디서 왔든 버린다.
 */

interface Seen { contentType: string | null; text: string; fields: Record<string, string> }

const seen: Seen[] = [];
const server = setupServer(
  http.post('https://api.test.com/echo', async ({ request }) => {
    const contentType = request.headers.get('content-type');
    const clone = request.clone();
    const fields: Record<string, string> = {};
    if (contentType?.startsWith('multipart/form-data')) {
      const form = await clone.formData();
      form.forEach((v, k) => { fields[k] = typeof v === 'string' ? v : `file:${(v as File).name}`; });
    }
    seen.push({ contentType, text: contentType?.startsWith('multipart/form-data') ? '' : await request.text(), fields });
    return MswHttpResponse.json({ ok: true });
  }),
);
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => { server.resetHandlers(); seen.length = 0; vi.unstubAllGlobals(); });
afterAll(() => server.close());

function form(): FormData {
  const f = new FormData();
  f.append('name', 'report');
  f.append('attachment', new File(['hello'], 'a.txt', { type: 'text/plain' }));
  return f;
}

describe('send() — FormData body', () => {
  it('🔴an instance default Content-Type: application/json does not reach a FormData body', async () => {
    const client = new HttpClient({ headers: { 'Content-Type': 'application/json' } });
    await client.post('https://api.test.com/echo', form());
    expect(seen).toHaveLength(1);
    expect(seen[0].contentType, 'boundary 는 플랫폼이 붙인다').toMatch(/^multipart\/form-data; boundary=/);
    expect(seen[0].fields, '필드와 파일이 그대로 도착한다 («{}» 가 아니다)').toEqual({ name: 'report', attachment: 'file:a.txt' });
  });

  it('🔴a per-request Content-Type (even multipart/form-data without a boundary) is dropped too', async () => {
    const client = new HttpClient({});
    await client.post('https://api.test.com/echo', form(), { headers: { 'Content-Type': 'multipart/form-data' } });
    expect(seen[0].contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(seen[0].fields).toEqual({ name: 'report', attachment: 'file:a.txt' });
  });

  it('🔴a request interceptor that sets Content-Type on a FormData body is handled too', async () => {
    const client = new HttpClient({});
    client.interceptors.request.use((config) => { config.headers.set('Content-Type', 'application/json'); return config; });
    await client.post('https://api.test.com/echo', form());
    expect(seen[0].contentType).toMatch(/^multipart\/form-data; boundary=/);
  });

  it('NEGATIVE: other headers still go out with a FormData body', async () => {
    const client = new HttpClient({ headers: { 'Content-Type': 'application/json', 'X-Trace': 't-1' } });
    let trace: string | null = null;
    server.use(http.post('https://api.test.com/trace', ({ request }) => { trace = request.headers.get('x-trace'); return MswHttpResponse.json({}); }));
    await client.post('https://api.test.com/trace', form());
    expect(trace).toBe('t-1');
  });
});

describe('send() — JSON serialization follows the body kind', () => {
  it('NEGATIVE: a plain object with the JSON default is still serialized as JSON', async () => {
    const client = new HttpClient({ headers: { 'Content-Type': 'application/json' } });
    await client.post('https://api.test.com/echo', { a: 1, b: ['x'] });
    expect(seen[0].contentType).toBe('application/json');
    expect(JSON.parse(seen[0].text)).toEqual({ a: 1, b: ['x'] });
  });

  it('NEGATIVE: an object body without any header is still guessed as JSON', async () => {
    const client = new HttpClient({});
    await client.post('https://api.test.com/echo', { a: 1 });
    expect(seen[0].contentType).toBe('application/json;charset=UTF-8');
    expect(JSON.parse(seen[0].text)).toEqual({ a: 1 });
  });

  it('🔴a Blob body is sent as the Blob, not as "{}", even when the header says JSON', async () => {
    const client = new HttpClient({});
    await client.post('https://api.test.com/echo', new Blob(['{"raw":true}']), { headers: { 'Content-Type': 'application/json' } });
    expect(seen[0].text).toBe('{"raw":true}');
  });

  it('🔴URLSearchParams and typed arrays are sent as themselves, not as "{}", even when the header says JSON', async () => {
    const client = new HttpClient({ headers: { 'Content-Type': 'application/json' } });
    await client.post('https://api.test.com/echo', new URLSearchParams({ a: '1', b: '2' }));
    expect(seen[0].text).toBe('a=1&b=2');
    await client.post('https://api.test.com/echo', new TextEncoder().encode('bytes'));
    expect(seen[1].text).toBe('bytes');
  });
});

describe('upload() — the body is always multipart', () => {
  type Listener = () => void;
  function installFakeXhr(sent: Array<[string, string]>) {
    class FakeXhr {
      status = 0; statusText = ''; response: string | null = ''; timeout = 0; withCredentials = false;
      upload: { onprogress: ((ev: unknown) => void) | null } = { onprogress: null };
      onload: Listener | null = null; onerror: Listener | null = null; ontimeout: Listener | null = null; onabort: Listener | null = null;
      open() {}
      setRequestHeader(key: string, value: string) { sent.push([key.toLowerCase(), value]); }
      getAllResponseHeaders() { return ''; }
      abort() {}
      send() { queueMicrotask(() => { this.status = 200; this.response = '{}'; this.onload?.(); }); }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
  }
  async function drain(gen: AsyncGenerator<unknown>) { for await (const _ of gen) { /* drain */ } }

  it('🔴an instance default Content-Type: application/json is not set on the XHR', async () => {
    const sent: Array<[string, string]> = [];
    installFakeXhr(sent);
    const client = new HttpClient({ baseUrl: 'http://localhost', headers: { 'Content-Type': 'application/json' } });
    await drain(client.upload({ method: 'POST', path: '/up', body: form() }));
    expect(sent.map(([k]) => k), '브라우저가 boundary 와 함께 정하게 둔다').not.toContain('content-type');
  });

  it('🔴a per-request Content-Type is not set on the XHR either', async () => {
    const sent: Array<[string, string]> = [];
    installFakeXhr(sent);
    const client = new HttpClient({ baseUrl: 'http://localhost' });
    await drain(client.upload({ method: 'POST', path: '/up', body: new File(['x'], 'a.xlsx'), headers: { 'Content-Type': 'multipart/form-data' } }));
    expect(sent.map(([k]) => k)).not.toContain('content-type');
  });

  it('NEGATIVE: other headers are still set on the XHR', async () => {
    const sent: Array<[string, string]> = [];
    installFakeXhr(sent);
    const client = new HttpClient({ baseUrl: 'http://localhost', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' } });
    await drain(client.upload({ method: 'POST', path: '/up', body: form(), headers: { 'X-Trace': 't-1' } }));
    expect(sent).toEqual(expect.arrayContaining([['authorization', 'Bearer t'], ['x-trace', 't-1']]));
  });
});

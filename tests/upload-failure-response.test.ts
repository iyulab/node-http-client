import { describe, it, expect, afterEach, vi } from 'vitest';
import { HttpClient } from '../src/HttpClient';
import type { FileUploadResponse } from '../src/types/FileUploadResponse';

/**
 * `upload()` 가 2xx 가 아닌 응답에서도 서버가 보낸 본문과 헤더를 `failure` 이벤트에 싣는다.
 *
 * 종전에는 `failure` 가 상태 코드와 «Upload failed with status N» 뿐이라, 서버가 400 · 413 에 실어 보낸 사유(JSON 의 오류 문장)를
 * 화면이 읽을 수 없었다 — `get`/`post` 는 비2xx 에서도 본문을 읽게 두는데 `upload` 만 달랐다. 본문의 모양은 `success` 의
 * `body` 와 같다(이 클라이언트가 읽은 그대로).
 */

type Listener = () => void;

/** 응답을 정해 둔 가짜 `XMLHttpRequest` — 노드에는 없다. */
function installFakeXhr(reply: { status: number; response: string; headers: string }) {
  class FakeXhr {
    status = 0;
    statusText = '';
    response: string | null = '';
    timeout = 0;
    withCredentials = false;
    upload: { onprogress: ((ev: unknown) => void) | null } = { onprogress: null };
    onload: Listener | null = null;
    onerror: Listener | null = null;
    ontimeout: Listener | null = null;
    onabort: Listener | null = null;
    open() {}
    setRequestHeader() {}
    getAllResponseHeaders() { return reply.headers; }
    abort() {}
    send() {
      queueMicrotask(() => {
        this.status = reply.status;
        this.response = reply.response;
        this.onload?.();
      });
    }
  }
  vi.stubGlobal('XMLHttpRequest', FakeXhr);
}

afterEach(() => { vi.unstubAllGlobals(); });

async function lastEvent(client: HttpClient): Promise<FileUploadResponse> {
  const events: FileUploadResponse[] = [];
  for await (const ev of client.upload({ method: 'POST', path: '/up', body: new File(['x'], 'a.xlsx') })) {
    events.push(ev);
  }
  return events[events.length - 1];
}

describe('upload() — a non-2xx response keeps the server body and headers on the failure event', () => {
  it('🔴a 413 with a JSON reason: the failure carries status, body and headers', async () => {
    installFakeXhr({
      status: 413,
      response: '{"error":"엑셀 파일은 5MB 까지 올릴 수 있습니다."}',
      headers: 'content-type: application/json\r\nx-request-id: r-1\r\n',
    });
    const ev = await lastEvent(new HttpClient({ baseUrl: 'http://localhost' }));
    expect(ev.type).toBe('failure');
    if (ev.type !== 'failure') return;
    expect(ev.status).toBe(413);
    expect(ev.body, '서버가 보낸 사유를 화면이 읽을 수 있어야 한다').toBe('{"error":"엑셀 파일은 5MB 까지 올릴 수 있습니다."}');
    expect(ev.headers).toMatchObject({ 'content-type': 'application/json', 'x-request-id': 'r-1' });
    expect(ev.message, '상태 문구는 그대로 남는다').toBe('Upload failed with status 413');
  });

  it('with a response interceptor registered the failure carries the body too', async () => {
    installFakeXhr({ status: 400, response: '{"error":"not an excel file"}', headers: 'content-type: application/json\r\n' });
    const client = new HttpClient({ baseUrl: 'http://localhost' });
    client.interceptors.response.use((res) => res);
    const ev = await lastEvent(client);
    expect(ev.type).toBe('failure');
    if (ev.type !== 'failure') return;
    expect(ev.status).toBe(400);
    expect(ev.body).toBe('{"error":"not an excel file"}');
    expect(ev.headers).toMatchObject({ 'content-type': 'application/json' });
  });

  it('a 2xx is still a success with its body (unchanged)', async () => {
    installFakeXhr({ status: 200, response: '{"ok":true}', headers: 'content-type: application/json\r\n' });
    const ev = await lastEvent(new HttpClient({ baseUrl: 'http://localhost' }));
    expect(ev).toMatchObject({ type: 'success', status: 200, body: '{"ok":true}' });
  });
});

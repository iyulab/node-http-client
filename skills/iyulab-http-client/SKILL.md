---
name: iyulab-http-client
description: Browser HTTP client for REST calls, file upload/download, and streaming (SSE, JSON stream, text stream) with cancellation and timeout. Use when working with @iyulab/http-client package — making API requests, handling streaming responses, uploading files with progress, or canceling in-flight requests.
license: MIT
metadata:
  author: iyulab
  version: "0.8.0"
---

# @iyulab/http-client

Browser-focused HTTP client built on Fetch API and XMLHttpRequest.

## Install

```bash
npm install @iyulab/http-client
```

## Core Classes

| Export | Purpose |
|---|---|
| `HttpClient` | Main client — REST requests, upload, download |
| `HttpResponse` | Wraps `Response` — parse body, stream |
| `CancelToken` | Cancel / timeout control |
| `CanceledError` | Thrown on cancel or timeout |

## HttpClient Setup

```ts
import { HttpClient } from '@iyulab/http-client';

const client = new HttpClient({
  baseUrl: 'https://api.example.com',
  headers: { Authorization: 'Bearer <token>' },
  timeout: 10000,          // ms; throws CanceledError on exceeded
  credentials: 'include',  // optional
  onRequest: async (req, headers) => {
    const token = await getToken();
    headers.set('Authorization', `Bearer ${token}`);
  },
  onResponse: (res) => {
    // res.response gives body access (.json()/.text()); throwing here short-circuits
    // the pipeline (see references/api.md).
    if (res.status === 401) redirectToLogin();
  },
  onError: ({ error }) => {
    logger.error(error);
  },
});
```

Config options: `baseUrl`, `headers`, `credentials`, `mode`, `cache`, `timeout`, `keepalive`, `onRequest`, `onResponse`, `onError`.  
All options can also be overridden per-request via `client.send(request)`.

## REST Methods

```ts
const res = await client.get('/users');          // GET
await client.post('/items', { name: 'x' });      // POST — JSON auto-serialized
await client.put('/items/1', data);              // PUT
await client.patch('/items/1', partial);         // PATCH
await client.delete('/items/1');                 // DELETE
await client.head('/items/1');                   // HEAD
```

All methods accept an optional `CancelToken` as the last argument and return `Promise<HttpResponse>`.

### HttpResponse — body parsing

```ts
const data  = await res.json<MyType>();  // parse JSON
const text  = await res.text();
const blob  = await res.blob();
const buf   = await res.arrayBuffer();
const bytes = await res.bytes();         // Uint8Array

res.ok         // true if 2xx
res.status     // HTTP status code
res.headers    // Headers
```

## Streaming

Three typed stream methods + one unified method.  See [./references/stream.md](./references/stream.md) for full details.

```ts
const res = await client.get('/stream');

// Auto-detect format from Content-Type
for await (const item of res.stream({ format: 'auto' })) { /* item.type: 'sse'|'json'|'text' */ }

// SSE — item: { type, event, data, id?, retry? }
for await (const event of res.streamAsSse()) { }

// JSON Object stream — item: { type: 'json', data: string }
for await (const chunk of res.streamAsJson()) { }

// Text stream (newline-delimited) — item: { type: 'text', data: string }
for await (const line of res.streamAsText()) { }
```

## File Upload (with progress)

Uses XHR internally to emit progress events.  See [./references/upload.md](./references/upload.md).

```ts
for await (const r of client.upload({ method: 'POST', path: '/upload', body: file })) {
  if (r.type === 'progress')  console.log(r.progress + '%');  // 0-100
  if (r.type === 'success')   console.log(r.status, r.body);
  if (r.type === 'failure')   console.error(r.message);
}
```

`body` accepts: `File`, `File[]`, `FormData`, or `Blob`.  
`File` is sent as `FormData` field `file`; `File[]` as `files`.

## File Download

Triggers browser download via an `<a>` tag — no progress events.

```ts
client.download({ path: '/files/report.pdf' });
// optional: filename, headers, query
```

## Cancellation & Timeout

```ts
import { CancelToken, CanceledError } from '@iyulab/http-client';

const token = new CancelToken();
setTimeout(() => token.cancel('user cancelled'), 3000);

try {
  const res = await client.get('/slow', token);
} catch (e) {
  if (e instanceof CanceledError) { /* handle */ }
}
```

`token.register(cb)` — registers a callback fired on cancel.  
Instance-level `timeout` ms automatically calls `token.cancel()`.

## Low-level `send`

```ts
await client.send({
  method: 'POST',
  baseUrl: 'https://other.api.com',  // overrides instance baseUrl
  path: '/resource',
  query: { page: '1', tags: ['a', 'b'] },
  body: payload,
  headers: new Headers({ 'X-Custom': 'value' }),  // must be Headers instance
  timeout: 5000,
}, cancelToken);
```

Query values can be `string | string[]` — arrays produce repeated params (`?tags=a&tags=b`).

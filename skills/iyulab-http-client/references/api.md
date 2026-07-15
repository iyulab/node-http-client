# API Reference

## HttpClientConfig

All fields are optional. Used at construction and can be overridden per-request.

| Field | Type | Description |
|---|---|---|
| `baseUrl` | `string` | Prefix applied to all relative `path` values |
| `headers` | `HeadersInit` | Default headers merged with per-request headers (request wins) |
| `credentials` | `'include' \| 'omit' \| 'same-origin'` | Cookie/auth credential policy |
| `mode` | `'cors' \| 'same-origin' \| 'no-cors' \| 'navigate'` | CORS mode |
| `cache` | `RequestCache` | Browser cache policy (`'default'`, `'no-store'`, etc.) |
| `timeout` | `number` | Max request duration in ms; triggers `CanceledError` |
| `keepalive` | `boolean` | Keep request alive during page unload (not effective for `upload`) |
| `onRequest` | `(req: RequestHookInfo, headers: Headers) => void \| Promise<void>` | **Deprecated** — use `interceptors.request`. Called before each request; mutate `headers` to inject auth etc. |
| `onResponse` | `(res: ResponseHookInfo) => void \| Promise<void>` | **Deprecated** — use `interceptors.response`. Called after each response, before it's returned. `res.response` gives body access (`.json()`/`.text()`/...); throwing here short-circuits the pipeline — `send()` rejects with that error instead of returning a response, and `onError` still runs |
| `onError` | `(err: ErrorHookInfo) => void \| Promise<void>` | **Deprecated** — use `interceptors.response`'s rejected handler. Called when a network/fetch error occurs |

All three legacy hooks still work exactly as before — only new code should prefer `interceptors` (see below).

## HttpClient Methods

```ts
class HttpClient {
  constructor(config: HttpClientConfig)

  readonly interceptors: { request: RequestInterceptors; response: ResponseInterceptors }

  head(url: string, token?: CancelToken): Promise<HttpResponse>
  get(url: string, token?: CancelToken): Promise<HttpResponse>
  post(url: string, body: unknown, token?: CancelToken): Promise<HttpResponse>
  put(url: string, body: unknown, token?: CancelToken): Promise<HttpResponse>
  patch(url: string, body: unknown, token?: CancelToken): Promise<HttpResponse>
  delete(url: string, token?: CancelToken): Promise<HttpResponse>

  send(request: HttpRequest, token?: CancelToken): Promise<HttpResponse>
  upload(request: HttpUploadRequest, token?: CancelToken): AsyncGenerator<FileUploadResponse>
  download(request: HttpDownloadRequest): void
}
```

## Interceptors (`client.interceptors`)

`interceptors.request` applies to `send()` (and the `get`/`post`/`put`/`patch`/`delete`/`head` shorthands built on it) and to `upload()`. `interceptors.response` applies to `upload()` too — `onResolved` runs on `xhr.onload` (any status, mirroring why `fetch()` doesn't reject on 4xx/5xx) and `onRejected` runs on network-level failure (`onerror`/`ontimeout`/`onabort`, same as `send()`'s catch). The final response's status decides the stream's `success`/`failure` event either way. With no interceptors registered, `upload()` behaves exactly as before. Neither applies to `download()`.

```ts
interface RequestInterceptors {
  use(onResolved?: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>, onRejected?: (error: any) => any): number; // returns id
  eject(id: number): void;
}

interface ResponseInterceptors {
  use(
    onResolved?: (res: HttpResponse, config: RequestConfig) => HttpResponse | Promise<HttpResponse>,
    onRejected?: (error: any, config: RequestConfig) => HttpResponse | Promise<HttpResponse>,
  ): number; // returns id
  eject(id: number): void;
}
```

- **`interceptors.request.use(onResolved, onRejected?)`**
  Runs *before* the URL is built — mutating `config.path`/`config.query`/`config.baseUrl` is reflected in the final URL (unlike `onRequest`). `config.headers` is the already-merged `Headers` instance.

- **`interceptors.response.use(onResolved, onRejected?)`**
  `onResolved(res, config)` runs after a successful `fetch()` (any HTTP status, since fetch doesn't reject on 4xx/5xx). Use `config` to retry by status code, e.g. refresh a token on 401 then `return client.send(config)`.
  `onRejected(error, config)` — mirrors `onResolved`'s shape — runs on fetch-level failure (network error, timeout/abort). Returning a value recovers the pipeline (`send()` resolves with it); re-throwing propagates the failure. Failures caused by a `CancelToken` are normalized to `CanceledError` before reaching this handler, so `error instanceof CanceledError` reliably distinguishes "the caller cancelled this" from a genuine network failure — the handler decides what to do with that information (e.g. skip retrying), nothing is forced.

```ts
client.interceptors.request.use((req) => {
  req.headers.set('Authorization', `Bearer ${getToken()}`);
  return req;
});

client.interceptors.response.use(async (res, config) => {
  if (res.status === 401) {
    await refreshToken();
    config.headers.set('Authorization', `Bearer ${getToken()}`);
    return client.send(config);
  }
  return res;
});
```

### Body serialization in `send` / shorthand methods

| `body` value | Auto `Content-Type` |
|---|---|
| `string` | `text/plain;charset=UTF-8` |
| plain object / array | `application/json;charset=UTF-8` + JSON.stringify |
| `Blob` | `blob.type` or `application/octet-stream` |
| `ArrayBuffer` / TypedArray | `application/octet-stream` |
| `FormData`, `URLSearchParams`, `ReadableStream` | Browser-managed (not modified) |

Explicit `Content-Type` in headers always takes precedence.

## Lifecycle Hook Types (deprecated)

Parameter types for the deprecated `onRequest`/`onResponse`/`onError` hooks above. New code should use `RequestConfig`/`HttpResponse` via `interceptors` instead.

```ts
interface RequestHookInfo {
  method: HttpMethod;
  path?: string;
  query?: Record<string, string | string[]>;
  baseUrl?: string;
}

interface ResponseHookInfo {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Headers;
  url: string;
}

interface ErrorHookInfo {
  error: any;
}
```

## HttpResponse

```ts
class HttpResponse {
  ok: boolean          // true if status 200-299
  status: number
  statusText: string
  url: string
  headers: Headers
  redirected: boolean
  body: ReadableStream<Uint8Array> | null

  json<T>(): Promise<T>
  text(): Promise<string>
  blob(): Promise<Blob>
  arrayBuffer(): Promise<ArrayBuffer>
  bytes(): Promise<Uint8Array>
  formData(): Promise<FormData>

  stream(options: StreamOptions): AsyncGenerator<StreamResponse>
  streamAsSse(): AsyncGenerator<SseStreamResponse>
  streamAsJson(): AsyncGenerator<JsonStreamResponse>
  streamAsText(): AsyncGenerator<TextStreamResponse>
}
```

## CancelToken

```ts
class CancelToken {
  signal: AbortSignal      // compatible with fetch / EventSource
  isCancelled: boolean

  cancel(reason?: any): void          // cancel the request
  register(cb: (reason?) => void): void  // called when canceled
}
```

## CanceledError

Extends `Error`. `name` is always `"CanceledError"`.  
Thrown when:
- `token.cancel()` is called explicitly
- `timeout` on `HttpClient` / `HttpRequest` is exceeded

```ts
try {
  await client.get('/api', token);
} catch (e) {
  if (e instanceof CanceledError) { /* canceled or timed out */ }
}
```

## HttpRequest

Per-request override of `HttpClientConfig`, passed to `send()` (and built internally by the `get`/`post`/`put`/`patch`/`delete`/`head` shorthands).

```ts
interface HttpRequest extends HttpClientConfig {
  method: HttpMethod;
  path?: string;
  query?: Record<string, string | string[]>;
  body?: unknown;
}
```

Inherits `baseUrl`, `headers` (`HeadersInit` — plain object, `Headers` instance, or tuple array all accepted; request-level headers override instance defaults per key), `credentials`, `mode`, `cache`, `timeout`, `keepalive` from `HttpClientConfig`. `CancelToken` is a separate argument to `send()`/`get()`/etc., not a field on the request object.

## HttpDownloadRequest

Triggers a browser `<a>` download — no response object returned.

```ts
interface HttpDownloadRequest {
  baseUrl?: string;
  path?: string;
  query?: Record<string, string | string[]>;
}

client.download({ path: '/export/data.csv', query: { format: 'csv' } });
```

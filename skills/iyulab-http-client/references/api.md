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

## HttpClient Methods

```ts
class HttpClient {
  constructor(config: HttpClientConfig)

  head(url: string, token?: CancelToken): Promise<HttpResponse>
  get(url: string, token?: CancelToken): Promise<HttpResponse>
  post(url: string, body: any, token?: CancelToken): Promise<HttpResponse>
  put(url: string, body: any, token?: CancelToken): Promise<HttpResponse>
  patch(url: string, body: any, token?: CancelToken): Promise<HttpResponse>
  delete(url: string, token?: CancelToken): Promise<HttpResponse>

  send(request: HttpRequest, token?: CancelToken): Promise<HttpResponse>
  upload(request: HttpUploadRequest, token?: CancelToken): AsyncGenerator<FileUploadResponse>
  download(request: HttpDownloadRequest): void
}
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

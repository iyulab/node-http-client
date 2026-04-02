# File Upload Reference

`client.upload()` uses `XMLHttpRequest` internally to provide real-time progress events.  
Returns an `AsyncGenerator<FileUploadResponse>`.

## Signature

```ts
client.upload(request: HttpUploadRequest, cancelToken?: CancelToken): AsyncGenerator<FileUploadResponse>
```

`HttpUploadRequest` extends `HttpClientConfig` with:

| Field | Type | Notes |
|---|---|---|
| `method` | `HttpMethod` | Typically `'POST'` or `'PUT'` |
| `path` | `string?` | Relative to `baseUrl` |
| `query` | `Record<string, string \| string[]>?` | Query params |
| `body` | `File \| File[] \| FormData \| Blob` | Upload payload |

## Body Auto-Wrapping

| `body` type | Sent as |
|---|---|
| `File` | `FormData` with field `file` |
| `File[]` | `FormData` with field `files` (multiple) |
| `FormData` | Sent as-is |
| `Blob` | `FormData` with field `file` |

## Response Types

```ts
type FileUploadResponse =
  | { type: 'progress'; loaded: number; total: number; progress: number } // 0-100
  | { type: 'success'; status: number; headers?: Record<string,string>; body?: any }
  | { type: 'failure'; status?: number; message?: string };
```

## Examples

### Single file upload

```ts
const file = fileInput.files[0];
for await (const r of client.upload({ method: 'POST', path: '/upload', body: file })) {
  if (r.type === 'progress') updateProgressBar(r.progress);
  if (r.type === 'success')  onSuccess(r.body);
  if (r.type === 'failure')  onError(r.message);
}
```

### Multiple files

```ts
const files = Array.from(fileInput.files);
for await (const r of client.upload({ method: 'POST', path: '/upload/multi', body: files })) {
  // same handler pattern
}
```

### Custom FormData with extra fields

```ts
const form = new FormData();
form.append('file', file);
form.append('description', 'profile photo');

for await (const r of client.upload({ method: 'POST', path: '/upload', body: form })) { }
```

### Upload with cancellation

```ts
const token = new CancelToken();
abortBtn.onclick = () => token.cancel();

for await (const r of client.upload({ method: 'POST', path: '/upload', body: file }, token)) {
  if (r.type === 'progress') setProgress(r.progress);
}
```

## Notes

- `keepalive` has no effect on upload requests (XHR limitation).
- Timeout applies to the total upload duration.
- Per-request headers can be set via `HttpUploadRequest.headers`.

# Stream Reference

`HttpResponse` exposes four async-generator stream methods.

## Stream Types

### `response.stream(options)` — unified

```ts
for await (const item of response.stream({ format: 'auto' | 'sse' | 'json' | 'text' })) {
  item.type  // 'sse' | 'json' | 'text'
}
```

`format: 'auto'` detects format from the `Content-Type` response header:
- `text/event-stream` → SSE
- `application/json` or `application/x-ndjson` → JSON object stream
- anything else → text (newline-delimited)

### `response.streamAsSse()` — SSE

Parses [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) format.

```ts
for await (const event of response.streamAsSse()) {
  event.type   // always 'sse'
  event.event  // event name; default "message"
  event.data   // payload (multi-line joined with '\n')
  event.id     // optional last-event-id
  event.retry  // optional reconnect hint (ms)
}
```

**Common pattern — LLM streaming:**

```ts
const res = await client.post('/chat', { messages });
for await (const e of res.streamAsSse()) {
  if (e.event === 'delta') process.stdout.write(e.data);
  if (e.event === '[DONE]') break;
}
```

### `response.streamAsJson()` — JSON object stream

Each yielded item carries one JSON string (one object per line / chunk).

```ts
for await (const chunk of response.streamAsJson()) {
  chunk.type  // always 'json'
  chunk.data  // raw JSON string — call JSON.parse(chunk.data) to decode
}
```

### `response.streamAsText()` — text stream

Yields one line of text per item (splits on `\n`).

```ts
for await (const line of response.streamAsText()) {
  line.type  // always 'text'
  line.data  // string line (without the trailing newline)
}
```

## Canceling a Stream

Pass a `CancelToken` to the originating request:

```ts
const token = new CancelToken();
const res = await client.get('/stream', token);

for await (const item of res.streamAsSse()) {
  if (shouldStop) token.cancel();
}
```

## Timeouts on a Stream

`timeout` (client or request) covers the whole request, including reading the body, so it also ends a
long stream once the time is up. For a stream that may legitimately run long, set `idleTimeout`
instead: the stream ends with `CanceledError` only when no chunk arrives within that time.

```ts
const res = await client.get('/chat/stream');           // no overall timeout
for await (const ev of res.stream({ format: 'sse', idleTimeout: 30_000 })) {
  // ends with CanceledError if the server goes quiet for 30 s
}
```

## StreamResponse Types

```ts
type StreamResponse = TextStreamResponse | JsonStreamResponse | SseStreamResponse;

interface TextStreamResponse { type: 'text'; data: string; }
interface JsonStreamResponse { type: 'json'; data: string; }
interface SseStreamResponse  {
  type: 'sse';
  event: string;
  data: string;
  id?: string;
  retry?: number;
}
```

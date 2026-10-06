# @iyulab/http-client

An HTTP client library for browsers.  
Supports general requests, file upload/download, and multiple stream response formats using both Fetch API and XMLHttpRequest.

---

## 📦 Installation

```bash
npm install @iyulab/http-client
```

## Quick Start

A first page that calls a server and shows the result (Vite — `index.html` loads `src/main.ts` as a module). It asks
the page's own origin, so it runs as-is; point `baseUrl` at your API next.

```ts
// src/main.ts
import { HttpClient, CanceledError } from "@iyulab/http-client";

const client = new HttpClient({ baseUrl: window.location.origin, timeout: 10_000 });
const output = document.body.appendChild(document.createElement("pre"));

try {
  const res = await client.get("/?from=quick-start");
  const body = await res.text();
  output.textContent = `GET / → ${res.status} ${res.ok ? "OK" : res.statusText} (${body.length} chars)`;
} catch (error) {
  output.textContent = error instanceof CanceledError ? "Timed out or cancelled" : `Failed: ${String(error)}`;
}
```

Non-2xx responses resolve normally — check `res.ok` / `res.status`. Only network failures, timeouts and
cancellation reject.

## 🤖 Skills Usage

This package includes an [Agent Skill](https://agentskills.io/) that helps AI coding agents understand and use this library.

**Via GitHub (recommended):**

```bash
npx skills add iyulab/node-http-client
```

**Via local `node_modules`:**

```bash
npx skills add ./node_modules/@iyulab/http-client/skills/iyulab-http-client
```

---

## 🚀 Usage Examples

### Basic HTTP Requests
```typescript
import { HttpClient } from "@iyulab/http-client";

const client = new HttpClient({
  baseUrl: "https://api.example.com",
  headers: {
    "Authorization": "Bearer your-token",
  },
});

// GET request
const res = await client.get("/users");
const users = await res.json();
console.log(users);

// POST request
const postRes = await client.post("/messages", { text: "Hello" });
```

### File Upload
```typescript
const file = new File(["hello"], "hello.txt");
for await (const response of client.upload({
  method: "POST",
  path: "/upload",
  body: file,
})) {
  if (response.type === "progress") {
    console.log(`Progress: ${response.progress}%`);
  } else if (response.type === "success") {
    console.log("Upload success:", response.status);
  } else {
    console.error("Upload failed:", response.message);
  }
}
```

### File Download
```typescript
client.download({
  path: "/files/sample.pdf",
});
```

### Stream Response Handling
```typescript
const response = await client.get("/stream");

// Auto-detection (based on Content-Type header)
for await (const item of response.stream({ format: 'auto' })) {
  console.log(item.type, item.data);
}

// SSE stream
for await (const event of response.streamAsSse()) {
  console.log(`[${event.event}]`, event.data);
}

// JSON Object stream
for await (const json of response.streamAsJson()) {
  console.log(JSON.parse(json.data));
}

// Text stream
for await (const line of response.streamAsText()) {
  console.log(line.data);
}
```

### Request Cancellation and Timeout
```typescript
import { CancelToken, CanceledError } from "@iyulab/http-client";

const token = new CancelToken();

setTimeout(() => token.cancel("User cancelled"), 2000);

// Or a standard AbortSignal, together with per-request headers:
const ac = new AbortController();
await client.patch("/items/1", partial, { signal: ac.signal, headers: { "If-Match": etag } });

try {
  await client.get("/slow-endpoint", token);
} catch (error: any) {
  if (error instanceof CanceledError) {
    console.error("Request was cancelled:", error.message);
  } else {
    console.error("Error during request:", error);
  }
}
```

`timeout` runs until the body has been read, so a response whose body stalls also ends with
`CanceledError`. A long-running stream can use an idle limit instead of an overall one:

```typescript
const res = await client.get("/events");
for await (const ev of res.stream({ format: "sse", idleTimeout: 30_000 })) {
  // CanceledError if no event arrives for 30 s
}
```

If the connection closes after the headers but before the body is complete, reading ends with
`IncompleteResponseError` (a `TypeError`, with the runtime's own error as `cause`). Runtimes report this
with different messages — Chromium even uses the same `Failed to fetch` as a refused connection — so
check the class, not the message:

```typescript
import { IncompleteResponseError } from "@iyulab/http-client";

try {
  for await (const ev of res.stream({ format: "sse" })) render(ev);
} catch (e) {
  if (e instanceof IncompleteResponseError) showRetry(); // keep what arrived, offer to retry
  else throw e;
}
```

### Interceptors (`client.interceptors`)
```typescript
const client = new HttpClient({ baseUrl: "https://api.example.com" });

// Request interceptor: runs before the URL is built, so path/query/baseUrl
// mutations are honored, not just headers.
client.interceptors.request.use((req) => {
  req.headers.set("Authorization", `Bearer ${getToken()}`);
  return req;
});

// Response interceptor: resolved handler gets (response, config). fetch()
// doesn't reject on 4xx/5xx, so status-code-based retry belongs here.
client.interceptors.response.use(async (res, config) => {
  if (res.status === 401) {
    await refreshToken();
    config.headers.set("Authorization", `Bearer ${getToken()}`);
    return client.send(config); // retry
  }
  return res;
});

// The rejected handler recovers from fetch-level failures (network errors,
// timeouts). Returning a value resolves send() with it instead of throwing.
// Failures caused by a CancelToken are normalized to CanceledError before
// reaching here, so you can tell "the caller cancelled this" apart from
// "the network failed" and decide whether to retry.
client.interceptors.response.use(undefined, async (error, config) => {
  if (error instanceof CanceledError) {
    throw error; // don't retry a request the caller explicitly cancelled
  }
  if (isRetryable(error)) {
    return client.send(config);
  }
  throw error;
});

// use() returns an id you can pass to eject() to remove it at runtime.
const id = client.interceptors.request.use((req) => req);
client.interceptors.request.eject(id);
```

A query string written in the URL (`client.get("/items?$top=5")`, or a link the server returned such as an OData `@odata.nextLink`) is parsed into `config.query` so interceptors can read it, and is **sent exactly as written** unless an interceptor changes those parameters — then the query is rebuilt from `config.query`.

> ⚠️ Response bodies can only be consumed once (Fetch API constraint). If an interceptor reads `res.json()`/`res.text()`, the caller can't read it again from the value `send()`/`get()`/`post()` returns.

`interceptors.request` also runs before `upload()` (headers/`path`/`query`/`baseUrl`). `interceptors.response` applies to `upload()` too: the resolved handler runs on `xhr.onload` (any status, same reasoning as fetch not rejecting on 4xx/5xx) and the rejected handler runs on network-level failure (`onerror`/`ontimeout`/`onabort`, same semantics as `send()`'s catch) — `onabort` (which only fires from an explicit `cancelToken`-triggered abort) passes a `CanceledError` so the handler can tell it apart from a genuine network error. Either way, the final response's status code is what decides the stream's `success`/`failure` event. If no interceptors are registered, `upload()` behaves exactly as before (no synthetic `Response` is built). Neither applies to `download()`.

### Migrating from the removed hooks (0.13.0)

`onRequest`, `onResponse` and `onError` were removed in 0.13.0 (deprecated since 0.10, with a warning since 0.12.1).

| Removed hook | Use instead |
| ------------ | ----------- |
| `onRequest: (req, headers) => …` | `client.interceptors.request.use((config) => { config.headers.set(…); return config; })` — `config` also carries `path`, `query` and `baseUrl`, and runs before the URL is built |
| `onResponse: async (res) => …` | `client.interceptors.response.use((res, config) => …)` — return the response (or a retried one), or throw to fail the request |
| `onError: ({ error }) => …` | `client.interceptors.response.use(undefined, (error, config) => …)` — rethrow to keep it failed, or return a response to recover |

## 🔧 Configuration Options
You can configure the client through the `HttpClientConfig` interface:

| Option | Description |
| ------ | ----------- |
| `baseUrl` | Base URL to be applied to all requests. An absolute URL (`'https://api.example.com'`), or — in a browser — a relative one resolved against the page's origin: `'/api'`, or `''` / `'/'` for a same-origin API with no prefix |
| `headers` | Request headers (e.g. Authorization, Content-Type, etc.) |
| `credentials` | Whether to include credentials (include, omit, same-origin) |
| `mode` | Request mode (cors, same-origin, etc.) |
| `cache` | Cache policy settings |
| `timeout` | Request timeout in milliseconds — covers reading the body too, and never cancels a `CancelToken` you passed. For long streams use `stream({ idleTimeout })` |
| `keepalive` | Whether to keep requests alive during page unload |

## 📄 License
MIT © iyulab

---
# @iyulab/http-client

An HTTP client library for browsers.  
Supports general requests, file upload/download, and multiple stream response formats using both Fetch API and XMLHttpRequest.

---

## 📦 Installation

```bash
npm install @iyulab/http-client
```

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

> ⚠️ Response bodies can only be consumed once (Fetch API constraint). If an interceptor reads `res.json()`/`res.text()`, the caller can't read it again from the value `send()`/`get()`/`post()` returns.

`interceptors.request` also runs before `upload()` (headers/`path`/`query`/`baseUrl`). `interceptors.response` applies to `upload()` too: the resolved handler runs on `xhr.onload` (any status, same reasoning as fetch not rejecting on 4xx/5xx) and the rejected handler runs on network-level failure (`onerror`/`ontimeout`/`onabort`, same semantics as `send()`'s catch) — `onabort` (which only fires from an explicit `cancelToken`-triggered abort) passes a `CanceledError` so the handler can tell it apart from a genuine network error. Either way, the final response's status code is what decides the stream's `success`/`failure` event. If no interceptors are registered, `upload()` behaves exactly as before (no synthetic `Response` is built). Neither applies to `download()`.

### Legacy hooks (`onRequest` / `onResponse` / `onError`) — deprecated
```typescript
const client = new HttpClient({
  baseUrl: "https://api.example.com",
  onRequest: (_req, headers) => {
    headers.set("Authorization", `Bearer ${getToken()}`);
  },
  onResponse: async (res) => {
    if (res.status === 401) {
      const body = await res.response.json<{ message?: string }>().catch(() => null);
      throw new SessionExpiredError(body?.message);
    }
  },
  onError: ({ error }) => {
    console.error("Request failed:", error);
  },
});
```

These still work exactly as before, but new code should prefer `client.interceptors` above — it supports path/query mutation, runtime add/remove (`eject()`), and status-code-based retry, none of which the legacy hooks can express.

## 🔧 Configuration Options
You can configure the client through the `HttpClientConfig` interface:

| Option | Description |
| ------ | ----------- |
| `baseUrl` | Base URL to be applied to all requests |
| `headers` | Request headers (e.g. Authorization, Content-Type, etc.) |
| `credentials` | Whether to include credentials (include, omit, same-origin) |
| `mode` | Request mode (cors, same-origin, etc.) |
| `cache` | Cache policy settings |
| `timeout` | Request timeout (in milliseconds) |
| `keepalive` | Whether to keep requests alive during page unload |
| `onRequest` | **Deprecated** — use `interceptors.request`. Called before each request; can mutate `headers` |
| `onResponse` | **Deprecated** — use `interceptors.response`. Called after each response, before it's returned; `response.response` gives body access. Throwing here short-circuits the pipeline |
| `onError` | **Deprecated** — use `interceptors.response`'s rejected handler. Called when a request throws (network error, timeout, or a hook throwing) |

## 📄 License
MIT © iyulab

---
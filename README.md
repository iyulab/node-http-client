# @iyulab/http-client

An HTTP client library for browsers.  
Supports general requests, file upload/download, and server stream responses using both Fetch API and XMLHttpRequest.

## ✨ Features

- ✅ RESTful HTTP request support (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`)
- 📤 File upload support (with progress tracking)
- 📥 File download support (using `<a>` tag)
- 🔁 Server stream response support
- ❌ Request cancellation and timeout control (`CancelToken`)

---

## 📦 Installation

```bash
npm install @iyulab/http-client
```

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
for await (const event of client.upload({
  method: "POST",
  path: "/upload",
  body: file,
})) {
  if (event.type === "progress") {
    console.log(`Progress: ${event.progress}%`);
  } else if (event.type === "success") {
    console.log("Upload success:", event.status);
  } else {
    console.error("Upload failed:", event.message);
  }
}
```

### File Download
```typescript
client.download({
  path: "/files/sample.pdf",
});
```

### Streaming Response (Returns in Server-Sent Events format)
```typescript
const response = await client.get("/events");
for await (const event of response.stream()) {
  console.log(`[${event.event}]`, event.data));
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

## 📄 License
MIT © iyulab

---

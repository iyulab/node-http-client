# @iyulab/http-client

An HTTP client library for browsers.  
Supports general requests, file upload/download, and multiple stream response formats using both Fetch API and XMLHttpRequest.

## ✨ Features

- ✅ RESTful HTTP request support (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`)
- 📤 File upload support (with progress tracking)
- 📥 File download support (using `<a>` tag)
- 🔁 Stream response support (SSE, JSON Object, Text with auto-detection)
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
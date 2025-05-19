# @iyulab/http-client

브라우저에서 사용 가능한 HTTP 클라이언트 라이브러리입니다.  
Fetch API와 XMLHttpRequest를 모두 활용하여 일반 요청, 파일 업로드/다운로드, 서버 스트림 응답까지 지원합니다.

## ✨ Features

- ✅ RESTful HTTP 요청 지원 (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`)
- 📤 파일 업로드 지원 (진행률 추적 포함)
- 📥 파일 다운로드 지원 (`<a>` 태그 활용)
- 🔁 서버 스트림 응답 지원
- ❌ 요청 취소 및 타임아웃 제어 (`CancelToken`)

---

## 📦 설치

```bash
npm install @iyulab/http-client
```

## 🚀 사용 예제

### HTTP 일반 요청
```typescript
import { HttpClient } from "@iyulab/http-client";

const client = new HttpClient({
  baseUrl: "https://api.example.com",
  headers: {
    "Authorization": "Bearer your-token",
  },
});

// GET 요청
const res = await client.get("/users");
const users = await res.json();
console.log(users);

// POST 요청
const postRes = await client.post("/messages", { text: "Hello" });
```

### 파일 업로드
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

### 파일 다운로드
```typescript
client.download({
  path: "/files/sample.pdf",
});
```

### 스트리밍 응답(Server-Sent Events 규격으로 반환합니다)
```typescript
const response = await client.get("/events");
for await (const event of response.stream()) {
  console.log(`[${event.event}]`, event.data));
}
```

### 요청 취소 및 타임아웃
```typescript
import { CancelToken, CanceledError } from "@iyulab/http-client";

const token = new CancelToken();

setTimeout(() => token.cancel("User cancelled"), 2000);

try {
  await client.get("/slow-endpoint", token);
} catch (error: any) {
  if (error instanceof CanceledError) {
    console.error("요청이 취소되었습니다:", error.message);
  } else {
    console.error("요청 중 오류 발생:", error);
  }
}
```

## 🔧 설정 옵션
`HttpClientConfig` 인터페이스를 통해 클라이언트를 설정할 수 있습니다:

| 옵션 | 설명 |
| ------ | ----------- |
| `baseUrl` | 모든 요청에 적용될 기본 URL |
| `headers` | 요청 헤더 (e.g. Authorization, Content-Type 등) |
| `credentials` | 인증 정보 포함 여부 (include, omit, same-origin) |
| `mode` | 요청 모드 (cors, same-origin 등) |
| `cache` | 캐시 정책 설정 |
| `timeout` | 요청 타임아웃 (ms 단위) |
| `keepalive` | 페이지 언로드 중에도 요청 유지 여부 |

## 📄 라이선스
MIT © iyulab

---

# HttpClient HttpMiddleware 설계 및 구현

## 목표

기존 `onRequest`/`onResponse` 훅을 Koa 스타일의 미들웨어 체인으로 대체.

## 현재 문제

- `onRequest` 훅이 URL 빌드 이후에 호출되어 `path`, `query` 등 수정이 반영되지 않음
- `onResponse` 훅이 스냅샷 객체를 전달하여 실제 응답 가공 불가
- 요청/응답을 하나의 관심사로 묶을 수 없음 (예: 401 재시도, 요청 시간 측정)

## 사용 예시

```typescript
import { HttpClient, type HttpMiddleware } from '@iyulab/http-client';

// 인증 미들웨어
const auth: HttpMiddleware = async (ctx, next) => {
  ctx.request.headers!.set('Authorization', `Bearer ${getToken()}`);
  await next();
  if (ctx.response?.status === 401) {
    await refreshToken();
    ctx.request.headers!.set('Authorization', `Bearer ${getToken()}`);
    ctx.response = undefined;
    await next(); // 재시도
  }
};

// 로깅 미들웨어
const logger: HttpMiddleware = async (ctx, next) => {
  const start = performance.now();
  console.log(`→ ${ctx.request.method} ${ctx.request.path}`);
  await next();
  console.log(`← ${ctx.response?.status} (${(performance.now() - start).toFixed(0)}ms)`);
};

// 클라이언트 생성
const client = new HttpClient({
  baseUrl: 'https://api.example.com',
  use: [logger, auth],
});

const res = await client.get('/users/me');
const user = await res.json();
```

## 타입 설계

### HttpContext

```typescript
export interface HttpContext {
  /** 요청 정보 (next() 호출 전에 수정하면 실제 fetch에 반영) */
  request: HttpRequest;
  /** 응답 정보 (next() 호출 후 채워짐) */
  response?: HttpResponse;
}
```

- `request`는 기존 `HttpRequest` 타입을 재활용
- `send()` 내부에서 headers를 미리 병합한 `Headers` 인스턴스로 세팅하여 전달
- 미들웨어에서 `ctx.request.path`, `ctx.request.headers` 등을 직접 수정 가능

### HttpMiddleware

```typescript
export type HttpMiddleware = (
  ctx: HttpContext,
  next: () => Promise<void>,
) => void | Promise<void>;
```

## HttpClientConfig 변경

```diff
  export interface HttpClientConfig {
    baseUrl?: string;
    headers?: HeadersInit;
    timeout?: number;
    credentials?: RequestCredentials;
    mode?: RequestMode;
    cache?: RequestCache;
    keepalive?: boolean;
+   use?: HttpMiddleware[];
-   onRequest?: ...;
-   onResponse?: ...;
-   onError?: ...;
  }
```

## send() 내부 흐름

```
1. HttpContext 구성
   - headers 병합 (인스턴스 기본값 → 요청별)
   - body 가공 (Content-Type 자동 설정, JSON.stringify 등)

2. coreFetch 정의
   - ctx에서 URL 빌드 (buildUrl)
   - fetch 실행
   - ctx.response = new HttpResponse(res)

3. 미들웨어 체인 구성
   - use: [A, B, C] → A( B( C( coreFetch ) ) )
   - reduceRight로 양파 구조 구성

4. 체인 실행 → ctx.response 반환
```

### 실행 순서

```
use: [errorHandler, logger, auth]

→ errorHandler 진입
  → logger 진입
    → auth 진입 (헤더 세팅)
      ── coreFetch (URL 빌드 → fetch → ctx.response) ──
    ← auth 복귀 (401 체크/재시도)
  ← logger 복귀 (시간 측정)
← errorHandler 복귀 (에러 throw)
```

## 구현 순서

### Step 1: 타입 추가

- `src/types/HttpMiddleware.ts` 생성
  - `HttpContext` 인터페이스
  - `HttpMiddleware` 타입
- `src/index.ts`에 export 추가

### Step 2: HttpClientConfig 수정

- `src/types/HttpClientConfig.ts`
  - `RequestHookInfo`, `ResponseHookInfo`, `ErrorHookInfo` 제거
  - `onRequest`, `onResponse`, `onError` 제거
  - `use?: HttpMiddleware[]` 추가

### Step 3: HttpClient.send() 리팩터링

- `src/HttpClient.ts`
  - headers 병합 + body 가공을 컨텍스트 구성 단계로 분리
  - coreFetch 함수 정의 (ctx에서 URL 빌드 → fetch)
  - `reduceRight`로 미들웨어 체인 구성
  - 기존 onRequest/onResponse 호출 코드 제거

### Step 4: 테스트 수정

- `tests/HttpClient.test.ts`
  - 기존 onRequest/onResponse 테스트 제거
  - 미들웨어 테스트 추가
    - 헤더 수정
    - URL(path/query) 수정
    - 응답 가공
    - 재시도 패턴
    - 여러 미들웨어 체이닝 순서

### Step 5: 버전 업데이트

- `package.json` 버전 → `0.9.0` (breaking change)

## 범위 외

- `upload()`, `download()` 메서드에는 미들웨어를 적용하지 않음
- 런타임에 미들웨어 추가/제거 (`client.use()`)는 이번 범위에 포함하지 않음

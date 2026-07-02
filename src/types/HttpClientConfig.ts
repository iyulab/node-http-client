import type { HttpMethod } from './HttpRequest';
import type { HttpResponse } from '../HttpResponse';

/** onRequest 훅에 전달되는 요청 정보입니다. */
export interface RequestHookInfo {
  /** HTTP 메서드 */
  method: HttpMethod;
  /** 요청 경로 */
  path?: string;
  /** 쿼리 파라미터 */
  query?: Record<string, string | string[]>;
  /** 기본 URL */
  baseUrl?: string;
}

/** onResponse 훅에 전달되는 응답 정보입니다. */
export interface ResponseHookInfo {
  /** 응답 상태가 성공(2xx)인지 여부 */
  ok: boolean;
  /** HTTP 상태 코드 */
  status: number;
  /** HTTP 상태 텍스트 */
  statusText: string;
  /** 응답 헤더 */
  headers: Headers;
  /** 응답 URL */
  url: string;
  /**
   * 본문 접근용 응답 래퍼입니다. `response.json()`/`.text()` 등으로 에러 본문을 파싱해
   * 친화적인 메시지를 구성하는 데 사용할 수 있습니다.
   *
   * @warning 본문은 1회만 소비할 수 있습니다(Fetch API 제약). 훅에서 읽으면 `send()`가
   * 반환하는 동일 인스턴스에서는 다시 읽을 수 없습니다 — 훅에서 처리를 끝내고 throw하여
   * 파이프라인을 단락(short-circuit)시키는 시나리오(예: 401 감지 후 에러로 전환)에 적합합니다.
   */
  response: HttpResponse;
}

/** onError 훅에 전달되는 에러 정보입니다. */
export interface ErrorHookInfo {
  /** 에러 객체 */
  error: any;
}

/**
 * HTTP 클라이언트를 설정하기 위한 구성 옵션입니다.
 */
export interface HttpClientConfig {
  /**
   * 모든 HTTP 요청의 기준이 되는 기본 URL입니다.
   * 상대 경로 요청 시 이 URL이 자동으로 앞에 붙습니다.
   *
   * @example 'https://api.example.com'
   */
  baseUrl?: string;

  /**
   * 요청 시 포함할 HTTP 헤더 객체입니다.
   * fetch의 `headers` 옵션에 해당하며, JSON이나 인증 토큰 등을 명시할 수 있습니다.
   * 
   * @example { 'Content-Type': 'application/json', 'Authorization': 'Bearer token' }
   */
  headers?: HeadersInit;

  /**
   * 요청 시 자격 증명(쿠키, 인증 정보 등)을 포함할지 설정합니다.
   * fetch의 `credentials` 옵션과 동일합니다.
   * 
   * - `include`: 모든 요청에 자격 증명 포함
   * - `omit`: 자격 증명 포함하지 않음
   * - `same-origin`: 동일 출처 요청에만 자격 증명 포함
   */
  credentials?: RequestCredentials;

  /**
   * 요청 방식(CORS 정책 등)을 설정합니다.
   * fetch의 `mode` 옵션에 해당합니다.
   * 
   * - `same-origin`: 동일 출처 요청만 허용
   * - `cors`: 교차 출처 요청 허용
   * - `navigate`: 페이지 탐색 시 요청 허용
   * - `no-cors`: 제한된 교차 출처 요청
   */
  mode?: RequestMode;

  /**
   * 브라우저 캐시 처리 방식을 지정합니다.
   * fetch의 `cache` 옵션에 해당합니다.
   * 
   * - `default`: 기본 캐시 정책 사용
   * - `force-cache`: 캐시된 응답 강제 사용
   * - `no-cache`: 캐시된 응답 사용 안 함
   * - `no-store`: 캐시 사용 안 함
   * - `only-if-cached`: 캐시된 응답만 사용
   * - `reload`: 새로고침 시 캐시 사용
   */
  cache?: RequestCache;

  /**
   * 요청의 최대 지속 시간(`ms` 단위)입니다.
   * 설정 시간을 초과하면 요청이 취소됩니다.
   */
  timeout?: number;

  /**
   * 연결을 지속할지 여부를 설정합니다.
   * 페이지 언로드(unload) 중에도 백그라운드에서 요청을 유지하여 서버로 데이터를 전송할 수 있습니다.
   * fetch의 `keepalive` 옵션에 해당합니다.
   *
   * @warning `upload` 함수에서는 작동하지 않습니다.
   * @warning 일부 브라우저나 데이터가 큰 경우 정상적으로 동작하지 않을 수 있습니다.
   */
  keepalive?: boolean;

  /**
   * 요청 전에 호출되는 훅입니다.
   * 요청 정보를 확인하거나 헤더를 수정할 수 있습니다.
   * 비동기 함수를 지원합니다.
   *
   * @param request 요청 정보
   * @param headers 요청 헤더 (수정 가능)
   */
  onRequest?: (request: RequestHookInfo, headers: Headers) => void | Promise<void>;

  /**
   * 응답 후, 호출자에게 반환되기 전에 호출되는 훅입니다.
   * `response.response`로 본문을 읽어 에러 상태를 판정하거나 친화적 메시지를 구성할 수 있습니다.
   * 비동기 함수를 지원합니다.
   *
   * @param response 응답 정보(본문 접근 포함)
   *
   * @example
   * ```ts
   * onResponse: async (res) => {
   *   if (res.status === 401) {
   *     const body = await res.response.json().catch(() => null);
   *     throw new SessionExpiredError(body?.message);
   *   }
   * }
   * ```
   *
   * @remarks 훅 내부에서 throw하면 `send()`가 그 에러로 reject되어(응답을 정상 반환하지 않고)
   * 파이프라인이 단락됩니다 — `onError` 훅도 이어서 호출됩니다.
   */
  onResponse?: (response: ResponseHookInfo) => void | Promise<void>;

  /**
   * 요청 중 에러가 발생했을 때 호출되는 훅입니다.
   * 에러 정보를 확인하거나 추가 처리를 할 수 있습니다.
   * 비동기 함수를 지원합니다.
   *
   * @param error 에러 정보
   */
  onError?: (error: ErrorHookInfo) => void | Promise<void>;
}

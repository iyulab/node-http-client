import type { HttpMethod } from './HttpRequest';
import type { HttpResponse } from '../HttpResponse';

/** @deprecated `RequestConfig`(interceptors.request)를 사용하세요. onRequest 훅에 전달되는 요청 정보입니다. */
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

/** @deprecated `interceptors.response`를 사용하세요. onResponse 훅에 전달되는 응답 정보입니다. */
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

/** @deprecated `interceptors.response`의 실패 핸들러를 사용하세요. onError 훅에 전달되는 에러 정보입니다. */
export interface ErrorHookInfo {
  /** 에러 객체 */
  error: any;
}

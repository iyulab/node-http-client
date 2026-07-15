import type { HttpRequest } from './HttpRequest';
import { HttpResponse } from '../HttpResponse';

/**
 * 인터셉터가 다루는 요청 설정입니다.
 * `headers`는 인스턴스 기본값과 요청별 헤더가 이미 병합된 `Headers` 인스턴스이며,
 * 직접 `set`/`delete`하면 실제 요청에 반영됩니다. URL 빌드 전에 전달되므로
 * `path`/`query`/`baseUrl`을 바꾸면 최종 요청 URL에도 반영됩니다.
 */
export interface RequestConfig extends Omit<HttpRequest, 'headers'> {
  headers: Headers;
}

/** `client.interceptors.request`의 타입입니다. */
export interface RequestInterceptors {
  /**
   * 요청 인터셉터를 등록합니다. URL 빌드 전에 실행되어 `path`/`query`/`baseUrl` 수정도 반영됩니다.
   * @returns `eject()`에 사용할 id
   */
  use(
    onResolved?: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>,
    onRejected?: (error: any) => any,
  ): number;
  /** 등록된 인터셉터를 제거합니다. */
  eject(id: number): void;
}

/** `client.interceptors.response`의 타입입니다. */
export interface ResponseInterceptors {
  /**
   * 응답 인터셉터를 등록합니다.
   * - `onResolved(response, config)`: fetch 성공 시 실행(2xx가 아니어도 실행됨 — fetch는 4xx/5xx에서
   *   reject하지 않으므로 상태 코드 기반 재시도는 여기서 처리). `config`로 `client.send(config)` 재시도 가능.
   * - `onRejected(error, config)`: 네트워크 에러/타임아웃 등 fetch 자체 실패 시 실행. 값을 반환하면
   *   파이프라인이 복구되어 `send()`가 정상 반환하고, throw하면 실패가 그대로 전파됩니다.
   * @returns `eject()`에 사용할 id
   */
  use(
    onResolved?: (response: HttpResponse, config: RequestConfig) => HttpResponse | Promise<HttpResponse>,
    onRejected?: (error: any, config: RequestConfig) => HttpResponse | Promise<HttpResponse>,
  ): number;
  /** 등록된 인터셉터를 제거합니다. */
  eject(id: number): void;
}

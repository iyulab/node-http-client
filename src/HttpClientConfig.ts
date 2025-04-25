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
   * @example { 'Content-Type': 'application/json', 'Authorization': 'Bearer token' }
   */
  headers?: HeadersInit;

  /**
   * 요청 시 자격 증명(쿠키, 인증 정보 등)을 포함할지 설정합니다.
   * fetch의 `credentials` 옵션과 동일합니다.
   * - `include`: 모든 요청에 자격 증명 포함
   * - `omit`: 자격 증명 포함하지 않음
   * - `same-origin`: 동일 출처 요청에만 자격 증명 포함
   */
  credentials?: RequestCredentials;

  /**
   * 요청 방식(CORS 정책 등)을 설정합니다.
   * fetch의 `mode` 옵션에 해당합니다.
   * - `same-origin`: 동일 출처 요청만 허용
   * - `cors`: 교차 출처 요청 허용
   * - `navigate`: 페이지 탐색 시 요청 허용
   * - `no-cors`: 제한된 교차 출처 요청
   */
  mode?: RequestMode;

  /**
   * 브라우저 캐시 처리 방식을 지정합니다.
   * fetch의 `cache` 옵션에 해당합니다.
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
}

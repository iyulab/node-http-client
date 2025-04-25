import type { HttpClientConfig } from "./HttpClientConfig";
import type { HttpMethod } from "./HttpMethod";

/**
 * 일반적인 HTTP 요청을 표현합니다.
 */
export interface HttpRequest extends HttpClientConfig {
  /**
   * 요청에 사용할 HTTP 메서드입니다.
   */
  method: HttpMethod;

  /**
   * base URL을 기준으로 한 요청 경로입니다.
   * @example '/users/me'
   */
  path?: string;

  /**
   * 요청 URL에 포함할 쿼리 파라미터입니다.
   * 값이 배열일 경우 여러 개의 같은 이름의 파라미터로 처리됩니다.
   * @example { search: 'test', filter: ['a', 'b'] }
   */
  query?: Record<string, string | string[]>;

  /**
   * 요청 본문(body)에 포함될 데이터입니다.
   * 메서드가 'POST' 또는 'PUT'인 경우 주로 사용됩니다.
   */
  body?: any;
}

/**
 * 파일 업로드를 위한 HTTP 요청을 표현합니다.
 */
export interface HttpUploadRequest extends HttpClientConfig {
  /**
   * 요청에 사용할 HTTP 메서드입니다.
   * 일반적으로 'POST' 또는 'PUT'을 사용합니다.
   */
  method: HttpMethod;

  /**
   * base URL을 기준으로 한 요청 경로입니다.
   * @example '/files/upload'
   */
  path?: string;

  /**
   * 요청 URL에 포함할 쿼리 파라미터입니다.
   */
  query?: Record<string, string | string[]>;

  /**
   * 업로드할 파일 데이터입니다.
   * - `FormData`: 다중 파일 업로드나 추가 필드를 포함하는 경우
   * - `File`: 단일 파일 업로드, FormData에 `file` 필드로 추가됩니다.
   * - `File[]`: 여러 파일 업로드, FormData에 `files` 필드로 추가됩니다.
   */
  body: FormData | File | File[];
}

/**
 * 파일 다운로드 요청을 표현합니다.
 */
export interface HttpDownloadRequest {
  /**
   * 모든 HTTP 요청의 기준이 되는 기본 URL입니다.
   * 상대 경로 요청 시 이 URL이 자동으로 앞에 붙습니다.
   *
   * @example 'https://api.example.com'
   */
  baseUrl?: string;

  /**
   * base URL을 기준으로 한 요청 경로입니다.
   * @example '/files/download/report.pdf'
   */
  path?: string;

  /**
   * 요청 URL에 포함할 쿼리 파라미터입니다.
   */
  query?: Record<string, string | string[]>;
}

/**
 * 업로드 진행 상황, 성공, 실패 응답을 포함하는 타입입니다.
 */
export type FileUploadResponse =
  | FileUploadProgressResponse
  | FileUploadSuccessResponse
  | FileUploadFailureResponse;

/**
 * 파일 업로드 진행 중 발생하는 응답입니다.
 * 업로드된 바이트 수, 전체 크기, 진행률을 포함합니다.
 */
export interface FileUploadProgressResponse {
  type: 'progress';

  /**
   * 현재까지 업로드된 바이트 수입니다.
   */
  loaded: number;

  /**
   * 업로드 대상의 전체 바이트 수입니다.
   */
  total: number;

  /**
   * 업로드 진행률입니다. (0~100 사이의 정수(integer))
   * @example 42
   */
  progress: number;
}

/**
 * 파일 업로드가 성공적으로 완료되었을 때의 응답입니다.
 * 서버의 응답 상태 코드, 헤더, 본문 등을 포함할 수 있습니다.
 */
export interface FileUploadSuccessResponse {
  type: 'success';

  /**
   * HTTP 응답 상태 코드입니다.
   * @example 200
   */
  status: number;

  /**
   * 서버에서 반환한 응답 헤더입니다.
   * 키-값 쌍으로 구성되어 있으며 선택적입니다.
   */
  headers?: Record<string, string>;

  /**
   * 서버 응답 본문입니다.
   * JSON, Blob, 텍스트 등 다양한 형식일 수 있습니다.
   */
  body?: any;
}

/**
 * 파일 업로드가 실패했을 때의 응답입니다.
 * 상태 코드가 없을 수도 있으며, 메시지를 통해 원인을 전달합니다.
 */
export interface FileUploadFailureResponse {
  type: 'failure';

  /**
   * HTTP 응답 상태 코드입니다.
   * 네트워크 오류 등으로 응답이 없을 경우 생략될 수 있습니다.
   */
  status?: number;

  /**
   * 실패 원인을 설명하는 메시지입니다.
   */
  message?: string;
}
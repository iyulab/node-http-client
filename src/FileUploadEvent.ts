/**
 * 업로드 진행 상황, 성공, 실패 이벤트를 포함합니다.
 */
export type FileUploadEvent =
  | FileUploadProgressEvent
  | FileUploadSuccessEvent
  | FileUploadFailureEvent;

/**
 * 파일 업로드 진행 중 발생하는 이벤트.
 * 업로드된 데이터의 진행 상황을 나타냅니다.
 */
export interface FileUploadProgressEvent {
  type: 'progress';

  /** 
   * 현재까지 업로드된 바이트 수 
   */
  loaded: number;
  /** 
   * 업로드할 전체 바이트 수 
   */
  total: number;
  /** 
   * 업로드 진행률 (0~100 사이의 백분율) 
   */
  progress: number;
}

/**
 * 파일 업로드가 성공적으로 완료되었을 때 발생하는 이벤트.
 * 서버의 응답 상태, 헤더, 본문을 포함합니다.
 */
export interface FileUploadSuccessEvent {
  type: 'success';

  /** 
   * HTTP 응답 상태 코드 (예: 200, 201) 
   */
  status: number;
  /** 
   * 서버 응답 헤더 (키-값 쌍)
   */
  headers?: Record<string, string>;
  /** 
   * 서버 응답 본문. 바이너리 데이터(예: Blob), JSON 등 다양한 형식일 수 있음 
   */
  body?: any;
}

/**
 * 파일 업로드가 실패했을 때 발생하는 이벤트.
 * 실패 원인과 관련 정보를 제공합니다.
 */
export interface FileUploadFailureEvent {
  type: 'failure';
  
  /** 
   * HTTP 응답 상태 코드. 네트워크 오류 등 상태 코드가 없는 경우
   */
  status?: number;
  /** 
   * 실패 원인을 설명하는 메시지.
   */
  message?: string;
}
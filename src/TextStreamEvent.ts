/**
 * 텍스트 스트림 이벤트를 나타내는 인터페이스입니다.
 * Server-Sent Events(SSE) 형식을 기반으로 합니다.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events | MDN - Using Server-Sent Events}
 */
export interface TextStreamEvent {
  /** 
   * 이벤트 유형을 나타냅니다. 기본값은 "message"입니다.
   */
  event: string;
  
  /**
   * 이벤트와 함께 전송된 데이터 라인들의 배열입니다.
   */
  data: string[];
  
  /**
   * 이벤트의 고유 식별자입니다. 선택적 필드입니다.
   */
  id?: string;
  
  /**
   * 연결이 끊어졌을 때 재시도 시간(밀리초)입니다. 선택적 필드입니다.
   */
  retry?: number;
}

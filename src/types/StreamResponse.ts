/**
 * 모든 스트림 응답 타입의 유니온 타입입니다.
 */
export type StreamResponse = ( 
  TextStreamResponse |
  JsonStreamResponse |
  SseStreamResponse
)

/**
 * 텍스트 스트림 응답을 나타내는 인터페이스입니다.
 * 줄바꿈을 기준으로 분할되어 텍스트 데이터가 제공됩니다.
 */
export interface TextStreamResponse {
  type: 'text';

  /**
   * 텍스트 라인입니다.
   */
  data: string;
}

/**
 * JSON 스트림 응답을 나타내는 인터페이스입니다.
 * JSON 형태의 데이터가 문자열로 제공됩니다.
 */
export interface JsonStreamResponse {
  type: 'json';

  /**
   * JSON 문자열입니다.
   */
  data: string;
}

/**
 * SSE(Server-Sent Events) 스트림 응답을 나타내는 인터페이스입니다.
 * 이 인터페이스는 Server-Sent Events(SSE) 형식의 이벤트 구조를 기반으로 합니다.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#event_stream_format | MDN - Using Server-Sent Events}
 */
export interface SseStreamResponse {
  type: 'sse';

  /**
   * 이벤트 유형을 나타냅니다.
   * @default "message"
   */
  event: string;

  /**
   * 이벤트와 함께 전달된 데이터입니다.
   * 여러 줄 데이터가 있는 경우 하나의 문자열로 결합됩니다.
   * @example "line 1\nline 2\nline 3"
   */
  data: string;

  /**
   * 이벤트 고유 식별자입니다.
   * 이 값은 재연결 시 클라이언트가 마지막으로 수신한 이벤트를 기준으로 이어받기 위해 사용됩니다.
   */
  id?: string;

  /**
   * 서버가 클라이언트에 재연결을 시도하도록 지시하는 시간(ms)입니다.
   */
  retry?: number;
}
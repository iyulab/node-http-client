/**
 * 텍스트 스트림 이벤트를 나타내는 인터페이스입니다.
 * 이 인터페이스는 Server-Sent Events(SSE) 형식의 이벤트 구조를 기반으로 합니다.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#event_stream_format | MDN - Using Server-Sent Events}
 */
export interface TextStreamEvent {
  /**
   * 이벤트 유형을 나타냅니다.
   * @default "message"
   */
  event: string;

  /**
   * 이벤트와 함께 전달된 데이터 라인들의 배열입니다.
   * 여러 줄 데이터가 있는 경우 각각의 줄이 하나의 요소로 분리됩니다.
   * @example ["line 1", "line 2", "line 3"]
   */
  data: string[];

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

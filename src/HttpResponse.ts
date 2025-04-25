import type { TextStreamEvent } from "./TextStreamEvent";

/**
 * HTTP 응답을 나타내는 클래스입니다.
 * Fetch API의 Response 객체를 래핑하여 다양한 응답 처리 메서드를 제공합니다.
 */
export class HttpResponse {
  private readonly _response: Response;

  constructor(response: Response) {
    this._response = response;
  }

  /**
   * 응답 상태가 성공(`2xx`)인지 여부를 반환합니다.
   */
  public get ok(): boolean {
    return this._response.ok;
  }

  /**
   * HTTP 상태 코드를 반환합니다.
   * @example 200, 404, 500
   */
  public get status(): number {
    return this._response.status;
  }

  /**
   * HTTP 상태 텍스트를 반환합니다.
   * @example 'OK', 'Not Found'
   */
  public get statusText(): string {
    return this._response.statusText;
  }

  /**
   * 응답의 헤더 정보를 반환합니다.
   */
  public get headers(): Headers {
    return this._response.headers;
  }

  /**
   * 응답을 보낸 최종 URL을 반환합니다.
   */
  public get url(): string {
    return this._response.url;
  }

  /**
   * 요청이 리디렉션되었는지 여부를 반환합니다.
   */
  public get redirected(): boolean {
    return this._response.redirected;
  }

  /**
   * 응답 본문을 텍스트 형식으로 반환합니다.
   */
  public text(): Promise<string> {
    return this._response.text();
  }

  /**
   * 응답 본문을 JSON 형식으로 파싱하여 반환합니다.
   * @template T 반환할 객체의 타입
   */
  public json<T>(): Promise<T> {
    return this._response.json() as Promise<T>;
  }

  /**
   * 응답 본문을 ArrayBuffer 형식으로 반환합니다.
   */
  public arrayBuffer(): Promise<ArrayBuffer> {
    return this._response.arrayBuffer();
  }

  /**
   * 응답 본문을 Uint8Array로 변환하여 반환합니다.
   * 주로 바이너리 데이터를 다룰 때 유용합니다.
   */
  public async bytes(): Promise<Uint8Array> {
    const buffer = await this._response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  /**
   * 응답 본문을 Blob 형식으로 반환합니다.
   * 파일 다운로드 등에서 활용할 수 있습니다.
   */
  public blob(): Promise<Blob> {
    return this._response.blob();
  }

  /**
   * 응답 본문을 FormData 형식으로 반환합니다.
   * 응답 타입이 `multipart/form-data`인 경우 사용합니다.
   */
  public formData(): Promise<FormData> {
    return this._response.formData();
  }

  /**
   * 스트리밍 응답을 처리하는 비동기 제너레이터입니다.
   * 서버가 전송하는 텍스트 기반 이벤트 스트림을 순차적으로 파싱하여 반환합니다.
   *
   * @example
   * ```ts
   * for await (const event of response.stream()) {
   *   console.log(event.event, event.data);
   * }
   * ```
   * @yields TextStreamEvent 형식의 이벤트 객체
   * @throws 응답 본문 스트림을 사용할 수 없는 경우 오류가 발생합니다.
   */
  public async *stream(): AsyncGenerator<TextStreamEvent> {
    const reader = this._response.body?.getReader();
    const decoder = new TextDecoder("utf-8");
  
    if (!reader) {
      throw new Error("No response body available.");
    }
  
    try {
      let done = false;
      let buffer = ""; // 디코딩된 텍스트를 저장할 버퍼입니다.
      const delimiter = /\r?\n\r?\n/; // 이벤트 블록의 구분자입니다.
  
      while (!done) {
        const { value, done: isDone } = await reader.read();
        done = isDone;

        if (value) {
          buffer += decoder.decode(value, { stream: true });

          const blocks = buffer.split(delimiter);
          if (blocks.length > 1) {
            for (let i = 0; i < blocks.length - 1; i++) {
              const event = this.parse(blocks[i].trim());
              if (event) {
                yield event;
              }
            }
            buffer = blocks[blocks.length - 1]; // 마지막 블록은 버퍼에 남겨둡니다.
          }
        }
      }
  
      // 남아있는 누적된 텍스트를 반환
      if (buffer) {
        const event = this.parse(buffer.trim());
        if (event) {
          yield event;
        }
      }
    } finally {
      reader.releaseLock();
      this._response.body?.cancel(); // 스트림을 안전하게 취소
    }
  }

  /**
   * 단일 텍스트 블록을 TextStreamEvent로 파싱합니다.
   * @param data 이벤트 블록 텍스트
   * @returns 파싱된 TextStreamEvent 객체 또는 undefined
   */
  private parse(data: string): TextStreamEvent | undefined {
    if (!data) return undefined;
    const lines = data.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length === 0) return undefined;
    const event: TextStreamEvent = { event: "message", data: [] };

    for (const line of lines) {
      const divider = line.indexOf(":");
      if (divider === -1) continue;
      const key = line.slice(0, divider).trim();
      const value = line.slice(divider + 1).trim();
      if (key === "event") {
        event.event = value;
      } else if (key === "data") {
        event.data.push(value);
      } else if (key === "id") {
        event.id = value;
      } else if (key === "retry") {
        const retryMs = parseInt(value, 10);
        if (!isNaN(retryMs)) {
          event.retry = retryMs;
        }
      }
    }

    return event;
  }

}

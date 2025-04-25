import { TextStreamEvent } from "./TextStreamEvent";

/**
 * HTTP 응답을 나타내는 클래스입니다.
 * Fetch API의 Response 객체를 래핑하여 다양한 응답 처리 메서드를 제공합니다.
 */
export class HttpResponse {
  private readonly _response: Response;

  constructor(response: Response) {
    this._response = response;
  }

  public get ok(): boolean {
    return this._response.ok;
  }

  public get status(): number {
    return this._response.status;
  }

  public get statusText(): string {
    return this._response.statusText;
  }

  public get headers(): Headers {
    return this._response.headers;
  }

  public get url(): string {
    return this._response.url;
  }

  public get redirected(): boolean {
    return this._response.redirected;
  }

  public text(): Promise<string> {
    return this._response.text();
  }

  public json<T>(): Promise<T> {
    return this._response.json();
  }  

  public arrayBuffer(): Promise<ArrayBuffer> {
    return this._response.arrayBuffer();
  }

  public async bytes(): Promise<Uint8Array> {
    const buffer = await this._response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  public blob(): Promise<Blob> {
    return this._response.blob();
  }

  public formData(): Promise<FormData> {
    return this._response.formData();
  }

  /**
   * 스트리밍 응답을 처리하는 제너레이터 함수입니다.
   * 이 함수는 서버에서 전송된 텍스트를 읽어 이벤트로 변환합니다.
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

  // 한 이벤트 블록의 텍스트를 파싱하여 StreamEvent 객체로 변환합니다.
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

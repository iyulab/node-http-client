import { CanceledError } from "./CanceledError";
import { guessStreamFormat, createStreamParser } from "./internals";
import type { 
  SseStreamResponse, 
  JsonStreamResponse, 
  TextStreamResponse, 
  StreamResponse, 
  StreamOptions 
} from "./types";

/**
 * HTTP 응답을 나타내는 클래스입니다.
 * Fetch API의 Response 객체를 래핑하여 다양한 응답 처리 메서드를 제공합니다.
 */
export class HttpResponse {
  private readonly _response: Response;

  constructor(response: Response) {
    this._response = response;
  }

  /** 응답 상태가 성공(`2xx`)인지 여부를 반환합니다. */
  public get ok(): boolean {
    return this._response.ok;
  }

  /** 요청이 리디렉션되었는지 여부를 반환합니다. */
  public get redirected(): boolean {
    return this._response.redirected;
  }

  /** HTTP 상태 코드를 반환합니다. */
  public get status(): number {
    return this._response.status;
  }

  /** HTTP 상태 텍스트를 반환합니다. */
  public get statusText(): string {
    return this._response.statusText;
  }

  /** 응답을 보낸 최종 URL을 반환합니다. */
  public get url(): string {
    return this._response.url;
  }

  /** 응답의 헤더 정보를 반환합니다. */
  public get headers(): Headers {
    return this._response.headers;
  }

  /** 응답 본문의 ReadableStream을 반환합니다. */
  public get body(): ReadableStream<Uint8Array> | null {
    return this._response.body;
  }

  /** 응답 본문을 텍스트 형식으로 반환합니다. */
  public text(): Promise<string> {
    return this._response.text();
  }

  /** 응답 본문을 JSON 형식으로 파싱하여 반환합니다. */
  public json<T>(): Promise<T> {
    return this._response.json() as Promise<T>;
  }

  /** 응답 본문을 ArrayBuffer 형식으로 반환합니다. */
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
   * 다양한 형식의 스트림을 파싱하는 통합 메서드입니다.
   *
   * @example
   * ```ts
   * // 자동 감지
   * for await (const item of response.stream({ format: 'auto' })) {
   *   console.log(item);
   * }
   *
   * // 특정 형식 지정
   * for await (const item of response.stream({ format: 'json' })) {
   *   console.log(item.data);
   * }
   * ```
   */
  public async *stream(options?: StreamOptions): AsyncGenerator<StreamResponse> {
    try {
      const reader = this._response.body?.getReader();
      if (!reader) {
        throw new Error("Response body is not available for streaming.");
      }

      const decoder = options?.decoder || new TextDecoder("utf-8");
      const format = !options || options.format === 'auto'
        ? guessStreamFormat(this._response.headers)
        : options.format;
      const parser = createStreamParser({ format, decoder });
      
      yield* parser.parse(reader);
    } catch (error: any) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new CanceledError(error);
      } else {
        throw error;
      }
    }
  }

  /**
   * SSE(Server-Sent Events) 스트림을 파싱하는 비동기 제너레이터입니다.
   */
  public async *streamAsSse(decoder?: TextDecoder): AsyncGenerator<SseStreamResponse> {
    yield* this.stream({ format: 'sse', decoder }) as AsyncGenerator<SseStreamResponse>;
  }

  /**
   * JSON 스트림을 파싱하는 비동기 제너레이터입니다.
   * JSON Lines 형태의 스트림 데이터를 처리합니다.
   */
  public async *streamAsJson(decoder?: TextDecoder): AsyncGenerator<JsonStreamResponse> {
    yield* this.stream({ format: 'json', decoder }) as AsyncGenerator<JsonStreamResponse>;
  }

  /**
   * 텍스트 스트림을 파싱하는 비동기 제너레이터입니다.
   * 줄바꿈 기준으로 텍스트를 분할하여 스트림으로 제공합니다.
   */
  public async *streamAsText(decoder?: TextDecoder): AsyncGenerator<TextStreamResponse> {
    yield* this.stream({ format: 'text', decoder }) as AsyncGenerator<TextStreamResponse>;
  }

}
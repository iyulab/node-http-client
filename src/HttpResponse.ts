import { CanceledError } from "./CanceledError";
import { IncompleteResponseError } from "./IncompleteResponseError";
import { guessStreamFormat, createStreamParser } from "./internals/stream-helpers";
import type { StreamOptions } from "./types/StreamParser";
import type { StreamResponse, SseStreamResponse, JsonStreamResponse, TextStreamResponse } from "./types/StreamResponse";

/**
 * 요청 한 건의 수명 — `HttpClient.send()` 가 넘긴다. 본문을 다 읽으면 `settle()` 로 요청 시간 제한을 풀고,
 * 읽는 중 끊기면 `aborted()` 로 그것이 취소·시간 초과였는지 가른다.
 */
interface ResponseLifecycle {
  settle(): void;
  aborted(): boolean;
  abort(): void;
}

/**
 * HTTP 응답을 나타내는 클래스입니다.
 * Fetch API의 Response 객체를 래핑하여 다양한 응답 처리 메서드를 제공합니다.
 */
export class HttpResponse {
  private readonly _response: Response;
  private readonly _lifecycle?: ResponseLifecycle;

  constructor(response: Response, lifecycle?: ResponseLifecycle) {
    this._response = response;
    this._lifecycle = lifecycle;
  }

  /**
   * 본문 읽기가 끝나면(성공이든 실패든) 요청 수명을 정리하고, 취소·시간 초과로 끊긴 실패는
   * `CanceledError` 로 바꾼다 — 헤더까지는 `send()` 가 같은 규칙을 적용한다.
   *
   * 그 밖의 `TypeError` 는 «본문을 받다 연결이 끊겼다» 로 읽어 `IncompleteResponseError` 로 바꾼다.
   * 단 읽기 «전에» 본문이 이미 쓰였다면 그 `TypeError` 는 사용 오류(두 번 읽기)라 그대로 둔다.
   * `SyntaxError`(JSON 파싱) 같은 다른 오류도 그대로다.
   */
  private track<T>(read: () => Promise<T>): Promise<T> {
    const unused = !this._response.bodyUsed;
    return read().then(
      (value) => {
        this._lifecycle?.settle();
        return value;
      },
      (error) => {
        this._lifecycle?.settle();
        if (this._lifecycle?.aborted()) throw new CanceledError(error);
        if (unused && error instanceof TypeError) throw new IncompleteResponseError(error);
        throw error;
      },
    );
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
    return this.track(() => this._response.text());
  }

  /** 응답 본문을 JSON 형식으로 파싱하여 반환합니다. */
  public json<T>(): Promise<T> {
    return this.track(() => this._response.json() as Promise<T>);
  }

  /** 응답 본문을 ArrayBuffer 형식으로 반환합니다. */
  public arrayBuffer(): Promise<ArrayBuffer> {
    return this.track(() => this._response.arrayBuffer());
  }

  /**
   * 응답 본문을 Uint8Array로 변환하여 반환합니다.
   * 주로 바이너리 데이터를 다룰 때 유용합니다.
   */
  public async bytes(): Promise<Uint8Array> {
    const buffer = await this.track(() => this._response.arrayBuffer());
    return new Uint8Array(buffer);
  }

  /**
   * 응답 본문을 Blob 형식으로 반환합니다.
   * 파일 다운로드 등에서 활용할 수 있습니다.
   */
  public blob(): Promise<Blob> {
    return this.track(() => this._response.blob());
  }

  /**
   * 응답 본문을 FormData 형식으로 반환합니다.
   * 응답 타입이 `multipart/form-data`인 경우 사용합니다.
   */
  public formData(): Promise<FormData> {
    // formData() 의 TypeError 는 «형식이 아니다» 일 수도 있어(연결 끊김과 구별되지 않는다) 바꾸지 않는다.
    return this._response.formData().then(
      (value) => { this._lifecycle?.settle(); return value; },
      (error) => {
        this._lifecycle?.settle();
        throw this._lifecycle?.aborted() ? new CanceledError(error) : error;
      },
    );
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
    let idle = false;
    let readFailure: unknown = undefined;
    try {
      const source = this._response.body?.getReader();
      if (!source) {
        throw new Error("Response body is not available for streaming.");
      }
      const timed = options?.idleTimeout
        ? withIdleTimeout(source, options.idleTimeout, () => {
            idle = true;
            if (this._lifecycle) this._lifecycle.abort();
            else void source.cancel();
          })
        : source;
      // 읽기 자체의 실패만 표시한다 — 파서가 던진 오류(잘못된 JSON 줄 등)와 가르기 위해서다.
      const reader = watchReadFailure(timed, (error) => { readFailure = error; });

      const decoder = options?.decoder || new TextDecoder("utf-8");
      const format = !options || options.format === 'auto'
        ? guessStreamFormat(this._response.headers)
        : options.format;
      const parser = createStreamParser({ format, decoder });
      
      yield* parser.parse(reader);
      if (idle) throw new CanceledError(`Stream idle for more than ${options?.idleTimeout} ms`);
    } catch (error: any) {
      if (idle) throw new CanceledError(`Stream idle for more than ${options?.idleTimeout} ms`);
      if (this._lifecycle?.aborted()) throw new CanceledError(error);
      // 수명 정보가 없는 응답(직접 만든 HttpResponse) → error.name으로 판정
      if (error instanceof Error && (error.name === 'AbortError' || error.name === 'CanceledError')) {
        throw new CanceledError(error);
      }
      // 취소가 아닌 읽기 실패 = 본문을 받다 연결이 끊겼다.
      if (readFailure !== undefined && error === readFailure) throw new IncompleteResponseError(error);
      throw error;
    } finally {
      this._lifecycle?.settle();
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

/**
 * 다음 조각이 `ms` 안에 오지 않으면 `onIdle` 을 부르는 읽기 래퍼. `onIdle` 이 원본 스트림을 끊으면
 * 대기 중인 `read()` 가 거절되거나 끝나고, 호출자(`stream()`)가 그것을 «유휴 초과» 로 바꿔 던진다.
 */
function withIdleTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  ms: number,
  onIdle: () => void,
): ReadableStreamDefaultReader<Uint8Array> {
  return {
    get closed() {
      return reader.closed;
    },
    cancel: (reason?: unknown) => reader.cancel(reason),
    releaseLock: () => reader.releaseLock(),
    read: async () => {
      const timer = setTimeout(onIdle, ms);
      try {
        return await reader.read();
      } finally {
        clearTimeout(timer);
      }
    },
  } as ReadableStreamDefaultReader<Uint8Array>;
}

/** `read()` 가 거절되면 그 오류를 `onFailure` 에 알리고 그대로 다시 던지는 읽기 래퍼. */
function watchReadFailure(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onFailure: (error: unknown) => void,
): ReadableStreamDefaultReader<Uint8Array> {
  return {
    get closed() {
      return reader.closed;
    },
    cancel: (reason?: unknown) => reader.cancel(reason),
    releaseLock: () => reader.releaseLock(),
    read: async () => {
      try {
        return await reader.read();
      } catch (error) {
        onFailure(error);
        throw error;
      }
    },
  } as ReadableStreamDefaultReader<Uint8Array>;
}

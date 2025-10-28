/**
 * 요청이 취소되었음을 나타내는 오류입니다.
 */
export declare class CanceledError extends Error {
    constructor(error?: any);
}

/**
 * CancelToken 클래스는 작업 취소를 관리하기 위한 객체입니다.
 * 내부적으로 AbortController를 사용하며, 등록된 콜백과 함께 취소 신호를 전파합니다.
 */
export declare class CancelToken {
    private _isCancelled;
    private readonly controller;
    private readonly callbacks;
    /**
     * 작업 취소를 감지할 수 있는 AbortSignal 객체를 반환합니다.
     * fetch, EventSource 등의 API와 연동할 수 있습니다.
     */
    get signal(): AbortSignal;
    /**
     * 현재 작업이 취소된 상태인지 여부를 반환합니다.
     */
    get isCancelled(): boolean;
    /**
     * 작업 취소 시 실행할 콜백 함수를 등록합니다.
     *
     * @param callback 취소될 때 호출될 함수
     * @example
     * token.register(() => console.log("취소됨"));
     */
    register(callback: (reason?: any) => void): void;
    /**
     * 작업을 취소하고, 등록된 콜백 함수들을 실행합니다.
     * 내부적으로 AbortController.abort()도 호출됩니다.
     *
     * @param reason 취소 사유로 전달할 선택적 값
     */
    cancel(reason?: any): void;
    /**
     * 작업이 취소되었는지 확인하고, 취소된 경우 예외를 던집니다.
     * 장기 실행 함수 내에서 수시로 호출해 중단 처리를 할 수 있습니다.
     *
     * @throws 작업이 이미 취소된 경우 예외 발생
     */
    throwIfCancelled(): void;
}

/**
 * 파일 업로드가 실패했을 때의 응답입니다.
 * 상태 코드가 없을 수도 있으며, 메시지를 통해 원인을 전달합니다.
 */
export declare interface FileUploadFailureResponse {
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

/**
 * 파일 업로드 진행 중 발생하는 응답입니다.
 * 업로드된 바이트 수, 전체 크기, 진행률을 포함합니다.
 */
export declare interface FileUploadProgressResponse {
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
 * 업로드 진행 상황, 성공, 실패 응답을 포함하는 타입입니다.
 */
export declare type FileUploadResponse = FileUploadProgressResponse | FileUploadSuccessResponse | FileUploadFailureResponse;

/**
 * 파일 업로드가 성공적으로 완료되었을 때의 응답입니다.
 * 서버의 응답 상태 코드, 헤더, 본문 등을 포함할 수 있습니다.
 */
export declare interface FileUploadSuccessResponse {
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
 * HTTP 클라이언트를 나타내는 클래스입니다.
 *
 * - 일반 요청은 Fetch API를 통해 처리합니다.
 * - 파일 업로드는 XMLHttpRequest를 사용하여 진행되며 진행률 이벤트를 제공합니다.
 * - 단순 파일 다운로드는 `<a>` 태그를 통해 브라우저 다운로드를 유도합니다.
 *
 * @example
 * const client = new HttpClient({ baseUrl: 'https://api.example.com' });
 * const response = await client.send({ method: 'GET', path: '/users' });
 */
export declare class HttpClient {
    private readonly baseUrl?;
    private readonly headers?;
    private readonly timeout?;
    private readonly credentials?;
    private readonly mode?;
    private readonly cache?;
    private readonly keepalive?;
    constructor(config: HttpClientConfig);
    /**
     * HEAD 요청을 보내 리소스의 존재 여부나 메타데이터를 확인합니다.
     * 본문 없이 헤더만 반환됩니다.
     */
    head(url: string, cancelToken?: CancelToken): Promise<HttpResponse>;
    /**
     * GET 요청을 보내 데이터를 조회합니다.
     */
    get(url: string, cancelToken?: CancelToken): Promise<HttpResponse>;
    /**
     * POST 요청을 보내 서버에 리소스를 생성하거나 데이터를 전송합니다.
     */
    post(url: string, body: any, cancelToken?: CancelToken): Promise<HttpResponse>;
    /**
     * PUT 요청을 보내 서버 리소스를 전체 교체하거나 생성합니다.
     */
    put(url: string, body: any, cancelToken?: CancelToken): Promise<HttpResponse>;
    /**
     * PATCH 요청을 보내 서버 리소스의 일부를 수정합니다.
     */
    patch(url: string, body: any, cancelToken?: CancelToken): Promise<HttpResponse>;
    /**
     * DELETE 요청을 보내 서버 리소스를 삭제합니다.
     */
    delete(url: string, cancelToken?: CancelToken): Promise<HttpResponse>;
    /**
     * Fetch API를 이용하여 일반 HTTP 요청을 보냅니다.
     *
     * @param request 요청 객체
     * @param cancelToken 요청을 중단할 수 있는 토큰
     * @returns 서버로부터의 응답 객체
     */
    send(request: HttpRequest, cancelToken?: CancelToken): Promise<HttpResponse>;
    /**
     * XMLHttpRequest를 이용해 파일 업로드를 수행하며,
     * 업로드 진행 상황을 AsyncGenerator 형태로 스트리밍합니다.
     *
     * @param request 업로드 요청 객체
     * @param cancelToken 요청 취소 토큰
     * @returns 업로드 응답 스트림
     */
    upload(request: HttpUploadRequest, cancelToken?: CancelToken): AsyncGenerator<FileUploadResponse>;
    /**
     * 브라우저의 기본 다운로드 동작을 활용하여 파일을 다운로드합니다.
     * (a 태그를 임시로 생성 후 클릭)
     *
     * @param request 다운로드 요청 객체
     */
    download(request: HttpDownloadRequest): void;
}

/**
 * HTTP 클라이언트를 설정하기 위한 구성 옵션입니다.
 */
export declare interface HttpClientConfig {
    /**
     * 모든 HTTP 요청의 기준이 되는 기본 URL입니다.
     * 상대 경로 요청 시 이 URL이 자동으로 앞에 붙습니다.
     *
     * @example 'https://api.example.com'
     */
    baseUrl?: string;
    /**
     * 요청 시 포함할 HTTP 헤더 객체입니다.
     * fetch의 `headers` 옵션에 해당하며, JSON이나 인증 토큰 등을 명시할 수 있습니다.
     * @example { 'Content-Type': 'application/json', 'Authorization': 'Bearer token' }
     */
    headers?: HeadersInit;
    /**
     * 요청 시 자격 증명(쿠키, 인증 정보 등)을 포함할지 설정합니다.
     * fetch의 `credentials` 옵션과 동일합니다.
     * - `include`: 모든 요청에 자격 증명 포함
     * - `omit`: 자격 증명 포함하지 않음
     * - `same-origin`: 동일 출처 요청에만 자격 증명 포함
     */
    credentials?: RequestCredentials;
    /**
     * 요청 방식(CORS 정책 등)을 설정합니다.
     * fetch의 `mode` 옵션에 해당합니다.
     * - `same-origin`: 동일 출처 요청만 허용
     * - `cors`: 교차 출처 요청 허용
     * - `navigate`: 페이지 탐색 시 요청 허용
     * - `no-cors`: 제한된 교차 출처 요청
     */
    mode?: RequestMode;
    /**
     * 브라우저 캐시 처리 방식을 지정합니다.
     * fetch의 `cache` 옵션에 해당합니다.
     * - `default`: 기본 캐시 정책 사용
     * - `force-cache`: 캐시된 응답 강제 사용
     * - `no-cache`: 캐시된 응답 사용 안 함
     * - `no-store`: 캐시 사용 안 함
     * - `only-if-cached`: 캐시된 응답만 사용
     * - `reload`: 새로고침 시 캐시 사용
     */
    cache?: RequestCache;
    /**
     * 요청의 최대 지속 시간(`ms` 단위)입니다.
     * 설정 시간을 초과하면 요청이 취소됩니다.
     */
    timeout?: number;
    /**
     * 연결을 지속할지 여부를 설정합니다.
     * 페이지 언로드(unload) 중에도 백그라운드에서 요청을 유지하여 서버로 데이터를 전송할 수 있습니다.
     * fetch의 `keepalive` 옵션에 해당합니다.
     *
     * @warning `upload` 함수에서는 작동하지 않습니다.
     * @warning 일부 브라우저나 데이터가 큰 경우 정상적으로 동작하지 않을 수 있습니다.
     */
    keepalive?: boolean;
}

/**
 * 파일 다운로드 요청을 표현합니다.
 */
export declare interface HttpDownloadRequest {
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

/**
 * Http 요청에 사용되는 메서드 타입을 정의합니다.
 */
export declare type HttpMethod = 'GET' | 'HEAD' | 'OPTIONS' | 'TRACE' | 'PUT' | 'POST' | 'PATCH' | 'DELETE' | 'CONNECT';

/**
 * 일반적인 HTTP 요청을 표현합니다.
 */
export declare interface HttpRequest extends HttpClientConfig {
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
 * HTTP 응답을 나타내는 클래스입니다.
 * Fetch API의 Response 객체를 래핑하여 다양한 응답 처리 메서드를 제공합니다.
 */
export declare class HttpResponse {
    private readonly _response;
    constructor(response: Response);
    /** 응답 상태가 성공(`2xx`)인지 여부를 반환합니다. */
    get ok(): boolean;
    /** 요청이 리디렉션되었는지 여부를 반환합니다. */
    get redirected(): boolean;
    /** HTTP 상태 코드를 반환합니다. */
    get status(): number;
    /** HTTP 상태 텍스트를 반환합니다. */
    get statusText(): string;
    /** 응답을 보낸 최종 URL을 반환합니다. */
    get url(): string;
    /** 응답의 헤더 정보를 반환합니다. */
    get headers(): Headers;
    /** 응답 본문의 ReadableStream을 반환합니다. */
    get body(): ReadableStream<Uint8Array> | null;
    /** 응답 본문을 텍스트 형식으로 반환합니다. */
    text(): Promise<string>;
    /** 응답 본문을 JSON 형식으로 파싱하여 반환합니다. */
    json<T>(): Promise<T>;
    /** 응답 본문을 ArrayBuffer 형식으로 반환합니다. */
    arrayBuffer(): Promise<ArrayBuffer>;
    /**
     * 응답 본문을 Uint8Array로 변환하여 반환합니다.
     * 주로 바이너리 데이터를 다룰 때 유용합니다.
     */
    bytes(): Promise<Uint8Array>;
    /**
     * 응답 본문을 Blob 형식으로 반환합니다.
     * 파일 다운로드 등에서 활용할 수 있습니다.
     */
    blob(): Promise<Blob>;
    /**
     * 응답 본문을 FormData 형식으로 반환합니다.
     * 응답 타입이 `multipart/form-data`인 경우 사용합니다.
     */
    formData(): Promise<FormData>;
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
    stream(options?: StreamOptions): AsyncGenerator<StreamResponse>;
    /**
     * SSE(Server-Sent Events) 스트림을 파싱하는 비동기 제너레이터입니다.
     */
    streamAsSse(decoder?: TextDecoder): AsyncGenerator<SseStreamResponse>;
    /**
     * JSON 스트림을 파싱하는 비동기 제너레이터입니다.
     * JSON Lines 형태의 스트림 데이터를 처리합니다.
     */
    streamAsJson(decoder?: TextDecoder): AsyncGenerator<JsonStreamResponse>;
    /**
     * 텍스트 스트림을 파싱하는 비동기 제너레이터입니다.
     * 줄바꿈 기준으로 텍스트를 분할하여 스트림으로 제공합니다.
     */
    streamAsText(decoder?: TextDecoder): AsyncGenerator<TextStreamResponse>;
}

/**
 * 파일 업로드를 위한 HTTP 요청을 표현합니다.
 */
export declare interface HttpUploadRequest extends HttpClientConfig {
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
 * JSON 스트림 응답을 나타내는 인터페이스입니다.
 * JSON 형태의 데이터가 문자열로 제공됩니다.
 */
export declare interface JsonStreamResponse {
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
export declare interface SseStreamResponse {
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

/** 스트림 형식을 나타내는 타입입니다. */
export declare type StreamFormat = 'json' | 'text' | 'sse' | 'auto';

/** 스트림 파서 옵션을 나타내는 객체입니다. */
export declare interface StreamOptions {
    /**
     * 스트림 형식입니다. 'auto'로 설정하면 응답 헤더를 기반으로 형식을 감지합니다.
     */
    format: StreamFormat;
    /**
     * 텍스트 디코더입니다. 기본값은 UTF-8 디코더입니다.
     */
    decoder?: TextDecoder;
}

/** 스트림 파서를 나타내는 인터페이스입니다.*/
export declare interface StreamParser<T extends StreamResponse> {
    /**
     * 스트림을 파싱하는 비동기 제너레이터입니다.
     */
    parse(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncGenerator<T>;
}

/**
 * 모든 스트림 응답 타입의 유니온 타입입니다.
 */
export declare type StreamResponse = (TextStreamResponse | JsonStreamResponse | SseStreamResponse);

/**
 * 텍스트 스트림 응답을 나타내는 인터페이스입니다.
 * 줄바꿈을 기준으로 분할되어 텍스트 데이터가 제공됩니다.
 */
export declare interface TextStreamResponse {
    type: 'text';
    /**
     * 텍스트 라인입니다.
     */
    data: string;
}

export { }

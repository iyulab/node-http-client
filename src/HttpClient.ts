import type { HttpRequest, HttpUploadRequest, HttpDownloadRequest } from "./types/HttpRequest";
import type { FileUploadResponse } from "./types/FileUploadResponse";
import type { HttpClientConfig } from "./types/HttpClientConfig";
import type { ErrorHookInfo, RequestHookInfo, ResponseHookInfo } from "./types/Hooks";
import type { RequestConfig, RequestInterceptors, ResponseInterceptors } from "./types/Interceptors";
import { HttpResponse } from "./HttpResponse";
import { CancelToken } from "./CancelToken";
import { CanceledError } from "./CanceledError";
import { buildUrl, parseUrl } from "./internals/url-helpers";
import { guessMimeType } from "./internals/mime-helpers";
import { InterceptorChain } from "./internals/InterceptorChain";

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
export class HttpClient {
  private readonly baseUrl?: string;
  private readonly headers?: HeadersInit;
  private readonly timeout?: number;
  private readonly credentials?: RequestCredentials;
  private readonly mode?: RequestMode;
  private readonly cache?: RequestCache;
  private readonly keepalive?: boolean;
  /** @deprecated `interceptors.request`를 사용하세요. 기능은 계속 동작합니다. */
  private readonly onRequest?: (request: RequestHookInfo, headers: Headers) => void | Promise<void>;
  /** @deprecated `interceptors.response`를 사용하세요. 기능은 계속 동작합니다. */
  private readonly onResponse?: (response: ResponseHookInfo) => void | Promise<void>;
  /** @deprecated `interceptors.response`의 실패 핸들러를 사용하세요. 기능은 계속 동작합니다. */
  private readonly onError?: (error: ErrorHookInfo) => void | Promise<void>;

  private readonly reqChain = new InterceptorChain<
    (config: RequestConfig) => RequestConfig | Promise<RequestConfig>,
    (error: any) => any
  >();
  private readonly resChain = new InterceptorChain<
    (res: HttpResponse, config: RequestConfig) => HttpResponse | Promise<HttpResponse>,
    (error: any, config: RequestConfig) => HttpResponse | Promise<HttpResponse>
  >();

  /**
   * 요청/응답 파이프라인에 개입할 수 있는 인터셉터입니다.
   * `use()`로 등록하고 반환된 id로 `eject()`하여 런타임에 제거할 수 있습니다.
   *
   * @example
   * ```ts
   * const id = client.interceptors.request.use((req) => {
   *   req.headers.set('Authorization', `Bearer ${getToken()}`);
   *   return req;
   * });
   *
   * // 401 응답 감지 후 재시도 (fetch는 4xx/5xx에서 reject하지 않으므로 resolved에서 처리)
   * client.interceptors.response.use(async (res, config) => {
   *   if (res.status === 401) {
   *     await refreshToken();
   *     return client.send(config);
   *   }
   *   return res;
   * });
   *
   * // 네트워크 에러 등 fetch 자체 실패 시 복구. CancelToken으로 인한 실패는 미리 CanceledError로
   * // 정규화되어 전달되므로, 사용자가 명시적으로 취소한 요청은 재시도하지 않도록 구분할 수 있습니다.
   * client.interceptors.response.use(undefined, async (error, config) => {
   *   if (error instanceof CanceledError) {
   *     throw error; // 취소된 요청은 재시도하지 않음
   *   }
   *   if (isRetryable(error)) {
   *     return client.send(config);
   *   }
   *   throw error;
   * });
   * ```
   */
  public readonly interceptors: { request: RequestInterceptors; response: ResponseInterceptors } = {
    request: this.reqChain,
    response: this.resChain,
  };

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl;
    this.headers = config.headers;
    this.timeout = config.timeout;
    this.credentials = config.credentials;
    this.mode = config.mode;
    this.cache = config.cache;
    this.keepalive = config.keepalive;
    this.onRequest = config.onRequest;
    this.onResponse = config.onResponse;
    this.onError = config.onError;
  }

  /**
   * HEAD 요청을 보내 리소스의 존재 여부나 메타데이터를 확인합니다.
   * 본문 없이 헤더만 반환됩니다.
   */
  public async head(url: string, cancelToken?: CancelToken): Promise<HttpResponse> {
    const { baseUrl, path, query } = parseUrl(url, this.baseUrl);
    return this.send({ method: 'HEAD', baseUrl, path, query }, cancelToken);
  }

  /**
   * GET 요청을 보내 데이터를 조회합니다.
   */
  public async get(url: string, cancelToken?: CancelToken): Promise<HttpResponse> {
    const { baseUrl, path, query } = parseUrl(url, this.baseUrl);
    return this.send({ method: 'GET', baseUrl, path, query }, cancelToken);
  }

  /**
   * POST 요청을 보내 서버에 리소스를 생성하거나 데이터를 전송합니다.
   */
  public async post(url: string, body: unknown, cancelToken?: CancelToken): Promise<HttpResponse> {
    const { baseUrl, path, query } = parseUrl(url, this.baseUrl);
    return this.send({ method: 'POST', baseUrl, path, query, body }, cancelToken);
  }

  /**
   * PUT 요청을 보내 서버 리소스를 전체 교체하거나 생성합니다.
   */
  public async put(url: string, body: unknown, cancelToken?: CancelToken): Promise<HttpResponse> {
    const { baseUrl, path, query } = parseUrl(url, this.baseUrl);
    return this.send({ method: 'PUT', baseUrl, path, query, body }, cancelToken);
  }

  /**
   * PATCH 요청을 보내 서버 리소스의 일부를 수정합니다.
   */
  public async patch(url: string, body: unknown, cancelToken?: CancelToken): Promise<HttpResponse> {
    const { baseUrl, path, query } = parseUrl(url, this.baseUrl);
    return this.send({ method: 'PATCH', baseUrl, path, query, body }, cancelToken);
  }

  /**
   * DELETE 요청을 보내 서버 리소스를 삭제합니다.
   */
  public async delete(url: string, cancelToken?: CancelToken): Promise<HttpResponse> {
    const { baseUrl, path, query } = parseUrl(url, this.baseUrl);
    return this.send({ method: 'DELETE', baseUrl, path, query }, cancelToken);
  }

  /**
   * Fetch API를 이용하여 일반 HTTP 요청을 보냅니다.
   *
   * @param request 요청 객체
   * @param cancelToken 요청을 중단할 수 있는 토큰
   * @returns 서버로부터의 응답 객체
   */
  public async send(request: HttpRequest, cancelToken?: CancelToken): Promise<HttpResponse> {
    // 1. Headers 설정 (기본 헤더 → 요청별 헤더 순서로 병합)
    const headers = new Headers(this.headers);
    if (request.headers) {
      new Headers(request.headers).forEach((value, key) => {
        headers.set(key, value);
      });
    }
    // Content-Type이 명시되지 않은 경우, body의 타입을 분석하여 자동으로 설정
    if (!headers.has("Content-Type")) {
      const guessed = guessMimeType(request.body);
      if (guessed) headers.set("Content-Type", guessed);
    }

    // 2. Body 설정 (Content-Type에 따라 자동 직렬화)
    // guessMimeType이 이미 BodyInit 호환 타입(Blob/FormData/URLSearchParams/ReadableStream/문자열/객체)만
    // 통과시켰으므로, 여기서는 그 결과를 신뢰하고 BodyInit으로 좁힙니다.
    let body: BodyInit | undefined = request.body as BodyInit | undefined;
    if (headers.get("Content-Type")?.includes("application/json")
      && typeof body === "object" && body !== null) {
      body = JSON.stringify(body);
    }

    // 3. 요청 인터셉터 체인 실행 (URL 빌드 전이므로 path/query/baseUrl 수정이 반영됨)
    let config: RequestConfig = { ...request, headers, body };
    let reqPromise: Promise<RequestConfig> = Promise.resolve(config);
    this.reqChain.forEach(({ resolved, rejected }) => {
      reqPromise = reqPromise.then(resolved, rejected);
    });
    config = await reqPromise;

    // 4. URL 생성 (인터셉터가 수정한 path/query/baseUrl 반영)
    const url = buildUrl({
      baseUrl: config.baseUrl ?? this.baseUrl,
      path: config.path,
      query: config.query
    });

    // 5. onRequest 훅 호출 (@deprecated — interceptors.request 사용 권장)
    if (this.onRequest) {
      await this.onRequest(
        { method: config.method, path: config.path, query: config.query, baseUrl: config.baseUrl ?? this.baseUrl },
        config.headers,
      );
    }

    // 6. Abort 설정
    const token = cancelToken || new CancelToken();
    const timeout = config.timeout ?? this.timeout;
    const timer = timeout
      ? setTimeout(() => token.cancel(), timeout)
      : null;

    try {
      // 7. Fetch 요청 + 응답 인터셉터 체인
      // (실패 시 rejected 핸들러가 값을 반환하면 파이프라인이 복구됨 — 예: 재시도)
      let resPromise: Promise<HttpResponse> = fetch(url.toString(), {
        method: config.method,
        headers: config.headers,
        body: config.body as BodyInit | undefined,
        cache: config.cache ?? this.cache,
        credentials: config.credentials ?? this.credentials,
        mode: config.mode ?? this.mode,
        keepalive: config.keepalive ?? this.keepalive,
        signal: token.signal,
      })
        .then((res) => new HttpResponse(res))
        // CancelToken으로 인한 실패는 인터셉터가 받기 전에 CanceledError로 정규화합니다.
        // 그래야 rejected 핸들러 안에서 `error instanceof CanceledError`로 "취소로 인한 실패"와
        // "일반 네트워크 실패"를 구분해서 재시도 여부를 스스로 판단할 수 있습니다.
        .catch((error) => {
          throw token.isCancelled ? new CanceledError(error) : error;
        });

      this.resChain.forEach(({ resolved, rejected }) => {
        resPromise = resPromise.then(
          resolved ? (res) => resolved(res, config) : undefined,
          rejected ? (error: any) => rejected(error, config) : undefined,
        );
      });

      const httpResponse = await resPromise;

      // 8. onResponse 훅 호출 (@deprecated — interceptors.response 사용 권장)
      // 훅에서 throw 시 아래 catch로 이동해 파이프라인이 단락됨
      if (this.onResponse) {
        await this.onResponse({
          ok: httpResponse.ok,
          status: httpResponse.status,
          statusText: httpResponse.statusText,
          headers: httpResponse.headers,
          url: httpResponse.url,
          response: httpResponse,
        });
      }

      // 9. 응답 반환
      return httpResponse;
    } catch (error: any) {
      // 10. onError 훅 호출 (@deprecated — interceptors.response의 실패 핸들러 사용 권장)
      if (this.onError) {
        await this.onError({ error });
      }
      // CancelToken 상태를 1차 판정 기준으로 사용
      if (token.isCancelled) {
        throw new CanceledError(error);
      }
      throw error;
    } finally {
      // 11. 타이머를 정리합니다.
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  /**
   * XMLHttpRequest를 이용해 파일 업로드를 수행하며,
   * 업로드 진행 상황을 AsyncGenerator 형태로 스트리밍합니다.
   *
   * @param request 업로드 요청 객체
   * @param cancelToken 요청 취소 토큰
   * @returns 업로드 응답 스트림
   * 
   * @description
   * - request.body의 형식에 따라 FormData로 변환하여 전송합니다.
   * - File 데이터는 FormData로 감싸서 `file` 필드로 전송됩니다.
   * - File[] 배열은 FormData로 감싸서 `files` 필드로 전송됩니다.
   */
  public async *upload(request: HttpUploadRequest, cancelToken?: CancelToken): AsyncGenerator<FileUploadResponse> {
    // 1. Headers 설정 (인스턴스 기본값 → 요청별 헤더 순서로 병합)
    const uploadHeaders = new Headers();
    if (this.headers) {
      new Headers(this.headers).forEach((value, key) => {
        uploadHeaders.set(key, value);
      });
    }
    if (request.headers) {
      new Headers(request.headers).forEach((value, key) => {
        uploadHeaders.set(key, value);
      });
    }

    // 2. 요청 인터셉터 체인 실행 (URL 빌드 전이므로 path/query/baseUrl 수정이 반영됨)
    // 응답 인터셉터(resolved/rejected)는 xhr.onload/onerror/ontimeout/onabort 시점에 적용됩니다
    // (아래 10번 참고) — send()와 동일하게 상태 코드 기반 처리와 네트워크 레벨 복구를 모두 지원합니다.
    // onabort는 CanceledError를 시드로 넘겨 인터셉터가 취소로 인한 실패임을 식별할 수 있게 합니다.
    let config: RequestConfig = { ...request, headers: uploadHeaders };
    let reqPromise: Promise<RequestConfig> = Promise.resolve(config);
    this.reqChain.forEach(({ resolved, rejected }) => {
      reqPromise = reqPromise.then(resolved, rejected);
    });
    config = await reqPromise;

    // 3. URL 생성 (인터셉터가 수정한 path/query/baseUrl 반영)
    const url = buildUrl({
      baseUrl: config.baseUrl ?? this.baseUrl,
      path: config.path,
      query: config.query
    });

    // 4. XMLHttpRequest 객체 생성
    const xhr = new XMLHttpRequest();
    xhr.open(config.method, url, true);

    // 5. 타임 아웃 설정
    const timeout = config.timeout ?? this.timeout;
    if (timeout) {
      xhr.timeout = timeout;
    }

    // 6. 인증 설정 (include만 withCredentials = true, same-origin은 브라우저 기본 동작)
    const credentials = config.credentials ?? this.credentials;
    if (credentials) {
      xhr.withCredentials = credentials === 'include';
    }

    // 7. onRequest 훅 호출 (@deprecated — interceptors.request 사용 권장)
    if (this.onRequest) {
      await this.onRequest(
        { method: config.method, path: config.path, query: config.query, baseUrl: config.baseUrl ?? this.baseUrl },
        config.headers,
      );
    }

    config.headers.forEach((value, key) => {
      xhr.setRequestHeader(key, value);
    });

    // 8. Body 설정 (인터셉터가 대체했을 수 있으므로 config.body를 사용)
    const uploadBody = config.body as FormData | File | File[];
    let body: FormData;
    if (uploadBody instanceof FormData) {
      body = uploadBody;
    } else if (Array.isArray(uploadBody)) {
      const formData = new FormData();
      for (let i = 0; i < uploadBody.length; i++) {
        formData.append('files', uploadBody[i]);
      }
      body = formData;
    } else {
      const formData = new FormData();
      formData.append('file', uploadBody);
      body = formData;
    }
    
    // 9. 이벤트 버퍼와 Promise 기반 이벤트 처리
    // 이벤트가 먼저 도착하면 버퍼에 쌓이고, 소비자가 먼저 대기하면 resolver에 저장
    const buffer: FileUploadResponse[] = [];
    let resolver: ((res: FileUploadResponse) => void) | null = null;
    let aborted = false;

    // 이벤트를 발행
    const publish = (event: FileUploadResponse) => {
      if (resolver) {
        // 소비자가 대기 중이면 즉시 이벤트를 전달
        const resolve = resolver;
        resolver = null;
        resolve(event);
      } else {
        // 소비자가 대기 중이지 않으면 버퍼에 이벤트를 저장
        buffer.push(event);
      }
    };

    // 이벤트를 소비
    const consume = () => new Promise<FileUploadResponse>((resolve) => {
      if (buffer.length > 0) {
        // 버퍼에 이벤트가 있으면 즉시 반환
        resolve(buffer.shift()!);
      } else {
        // 버퍼에 이벤트가 없으면 resolver에서 대기
        resolver = resolve;
      }
    });

    // 10. 응답 인터셉터 지원 함수 (send()와 동일한 의미 — 상태 코드 기반 성공/실패 + 네트워크 레벨 실패 모두 포함)
    // resChain이 비어 있으면(인터셉터 미등록) 아무 작업도 하지 않고 그대로 통과합니다.
    const runResChain = (start: Promise<HttpResponse>): Promise<HttpResponse> => {
      let chain = start;
      this.resChain.forEach(({ resolved, rejected }) => {
        chain = chain.then(
          resolved ? (res) => resolved(res, config) : undefined,
          rejected ? (error: any) => rejected(error, config) : undefined,
        );
      });
      return chain;
    };

    // 상태 코드로 success/failure 이벤트를 판정해 publish (인터셉터 유무와 무관하게 공유되는 단일 판정 로직)
    const publishByStatus = (status: number, headers: Record<string, string>, body: any) => {
      if (status >= 200 && status < 300) {
        publish({ type: 'success', status, headers, body });
      } else {
        publish({ type: 'failure', status, message: `Upload failed with status ${status}` });
      }
    };

    // runResChain을 통과한 최종 HttpResponse를 이벤트로 publish
    const publishResponse = async (res: HttpResponse) => {
      const headers: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        headers[key] = value;
      });
      publishByStatus(res.status, headers, await res.text());
    };

    // xhr.getAllResponseHeaders()의 원본 텍스트를 Record로 파싱
    const readHeaders = (): Record<string, string> => {
      const headers: Record<string, string> = {};
      const lines = xhr.getAllResponseHeaders().split('\r\n');

      for (const line of lines) {
        const separatorIndex = line.indexOf(': ');
        if (separatorIndex !== -1) {
          const key = line.substring(0, separatorIndex).trim();
          const value = line.substring(separatorIndex + 2).trim();
          headers[key] = headers[key] ? `${headers[key]}, ${value}` : value;
        }
      }

      return headers;
    };

    // 11. 이벤트 핸들러 설정
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        const progress = Math.round((ev.loaded / ev.total) * 100);
        publish({
          type: 'progress',
          loaded: ev.loaded,
          total: ev.total,
          progress,
        });
      }
    };

    xhr.onload = () => {
      const headers = readHeaders();

      // 인터셉터가 없으면 기존과 완전히 동일하게 동작 (합성 Response 생성 비용 없음)
      if (this.resChain.isEmpty) {
        publishByStatus(xhr.status, headers, xhr.response);
        return;
      }

      // 빈 문자열을 그대로 넘기면 204/304 등 null body 상태 코드에서 Response 생성자가 던짐
      const rawBody = xhr.response === '' ? null : xhr.response;
      const raw = new HttpResponse(new Response(rawBody, { status: xhr.status, statusText: xhr.statusText, headers }));

      runResChain(Promise.resolve(raw))
        .then(publishResponse)
        .catch((error: any) => {
          publish({ type: 'failure', status: xhr.status, message: error?.message ?? `Upload failed with status ${xhr.status}` });
        });
    }

    xhr.onerror = () => {
      runResChain(Promise.reject(new Error('Network error occurred')))
        .then(publishResponse)
        .catch(() => {
          publish({ type: 'failure', message: 'Network error occurred' });
        });
    };

    xhr.ontimeout = () => {
      runResChain(Promise.reject(new Error('Request timed out')))
        .then(publishResponse)
        .catch(() => {
          publish({ type: 'failure', message: 'Request timed out' });
        });
    };

    xhr.onabort = () => {
      // onabort는 오직 cancelToken을 통한 명시적 xhr.abort() 호출로만 발생합니다(아래 취소 토큰 설정
      // 참고). CanceledError를 시드로 넘겨야 rejected 핸들러 안에서 `error instanceof CanceledError`로
      // "취소로 인한 실패"임을 식별하고 재시도 여부를 스스로 판단할 수 있습니다.
      runResChain(Promise.reject(new CanceledError('Request was cancelled')))
        .then(publishResponse)
        .catch(() => {
          // resolver가 대기 중이면 failure로 해제하여 generator가 종료되도록 함
          aborted = true;
          publish({ type: 'failure', message: 'Request was cancelled' });
        });
    };

    // 취소 토큰 설정
    if (cancelToken) {
      cancelToken.register(() => {
        xhr.abort();
      });
    }

    // 요청 전송
    xhr.send(body);

    while (true) {
      const event = await consume();

      // abort된 경우 CanceledError를 던져 generator를 종료
      if (aborted) {
        throw new CanceledError('Request was cancelled');
      }

      yield event;

      // 성공/에러 등 종료 이벤트면 반복 종료
      if (event.type === 'success' || event.type === 'failure') break;
    }
  }

  /**
   * 브라우저의 기본 다운로드 동작을 활용하여 파일을 다운로드합니다.
   * (a 태그를 임시로 생성 후 클릭)
   *
   * @param request 다운로드 요청 객체
   */
  public download(request: HttpDownloadRequest): void {
    const url = buildUrl({
      baseUrl: request.baseUrl ?? this.baseUrl,
      path: request.path, 
      query: request.query
    });

    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url.toString();
    a.download = '';

    document.body.appendChild(a);
    a.click();
    a.remove();
  }

}

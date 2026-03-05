import type { HttpRequest, HttpUploadRequest, HttpDownloadRequest } from "./types/HttpRequest";
import type { FileUploadResponse } from "./types/FileUploadResponse";
import type { HttpClientConfig } from "./types/HttpClientConfig";
import { HttpResponse } from "./HttpResponse";
import { CancelToken } from "./CancelToken";
import { CanceledError } from "./CanceledError";
import { buildUrl, parseUrl } from "./internals/url-helpers";

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

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl;
    this.headers = config.headers;
    this.timeout = config.timeout;
    this.credentials = config.credentials;
    this.mode = config.mode;
    this.cache = config.cache;
    this.keepalive = config.keepalive;
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
  public async post(url: string, body: any, cancelToken?: CancelToken): Promise<HttpResponse> {
    const { baseUrl, path, query } = parseUrl(url, this.baseUrl);
    return this.send({ method: 'POST', baseUrl, path, query, body }, cancelToken);
  }

  /**
   * PUT 요청을 보내 서버 리소스를 전체 교체하거나 생성합니다.
   */
  public async put(url: string, body: any, cancelToken?: CancelToken): Promise<HttpResponse> {
    const { baseUrl, path, query } = parseUrl(url, this.baseUrl);
    return this.send({ method: 'PUT', baseUrl, path, query, body }, cancelToken);
  }

  /**
   * PATCH 요청을 보내 서버 리소스의 일부를 수정합니다.
   */
  public async patch(url: string, body: any, cancelToken?: CancelToken): Promise<HttpResponse> {
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
    // 1. URL 생성
    const url = buildUrl({
      baseUrl: request.baseUrl ?? this.baseUrl, 
      path: request.path, 
      query: request.query
    });

    // 2. Headers 설정 (인스턴스 기본값 → 요청별 헤더 순서로 병합, 요청 헤더가 우선)
    const headers = new Headers();
    // 인스턴스 기본 헤더 먼저 설정
    if (this.headers) {
      new Headers(this.headers).forEach((value, key) => {
        headers.set(key, value);
      });
    }
    // 요청별 헤더로 덮어쓰기
    if (request.headers) {
      new Headers(request.headers).forEach((value, key) => {
        headers.set(key, value);
      });
    }

    // 3. Body 설정 (사용자가 Content-Type을 명시한 경우 유지)
    let body: BodyInit | undefined = request.body;
    const hasContentType = headers.has("Content-Type");
    if (typeof body === 'string') {
      if (!hasContentType) headers.set("Content-Type", "text/plain;charset=UTF-8");
    } else if (body != null && typeof body === 'object') {
      if (body instanceof Blob) {
        if (!hasContentType) headers.set("Content-Type", body.type || "application/octet-stream");
      } else if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
        if (!hasContentType) headers.set("Content-Type", "application/octet-stream");
      } else if (body instanceof FormData || body instanceof URLSearchParams || body instanceof ReadableStream) {
        // 브라우저가 자동으로 Content-Type을 설정하므로 건드리지 않음
      } else {
        if (!hasContentType) headers.set("Content-Type", "application/json;charset=UTF-8");
        body = JSON.stringify(body);
      }
    }

    // 4. Abort 설정
    const token = cancelToken || new CancelToken();
    const timeout = request.timeout ?? this.timeout;
    const timer = timeout
      ? setTimeout(() => token.cancel(), timeout)
      : null;

    try {
      // 5. Fetch 요청
      const res = await fetch(url.toString(), {
        method: request.method,
        headers: headers,
        body: body,
        cache: request.cache ?? this.cache,
        credentials: request.credentials ?? this.credentials,
        mode: request.mode ?? this.mode,
        keepalive: request.keepalive ?? this.keepalive,
        signal: token.signal,
      });

      // 6. 응답 처리
      return new HttpResponse(res);
    } catch (error: any) {
      // CancelToken 상태를 1차 판정 기준으로 사용
      if (token.isCancelled) {
        throw new CanceledError(error);
      }
      throw error;
    } finally {
      // 7. 타이머를 정리합니다.
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
    // 1. URL 생성
    const url = buildUrl({
      baseUrl: request.baseUrl ?? this.baseUrl,
      path: request.path, 
      query: request.query
    });
    
    // 2. XMLHttpRequest 객체 생성
    const xhr = new XMLHttpRequest();
    xhr.open(request.method, url, true);

    // 3. 타임 아웃 설정
    const timeout = request.timeout ?? this.timeout;
    if (timeout) {
      xhr.timeout = timeout;
    }

    // 4. 인증 설정 (include만 withCredentials = true, same-origin은 브라우저 기본 동작)
    const credentials = request.credentials ?? this.credentials;
    if (credentials) {
      xhr.withCredentials = credentials === 'include';
    }

    // 5. Headers 설정 (인스턴스 기본값 → 요청별 헤더 순서로 병합)
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
    uploadHeaders.forEach((value, key) => {
      xhr.setRequestHeader(key, value);
    });

    // 6. Body 설정
    let body: FormData;
    if (request.body instanceof FormData) {
      body = request.body;
    } else if (Array.isArray(request.body)) {
      const formData = new FormData();
      for (let i = 0; i < request.body.length; i++) {
        formData.append('files', request.body[i]);
      }
      body = formData;
    } else {
      const formData = new FormData();
      formData.append('file', request.body);
      body = formData;
    }
    
    // 7. 이벤트 버퍼와 Promise 기반 이벤트 처리
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

    // 8. 이벤트 핸들러 설정
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
      if (xhr.status >= 200 && xhr.status < 300) {
        const headers: Record<string, string> = {};
        const headersText = xhr.getAllResponseHeaders();
        const headersList = headersText.split('\r\n');

        for (const header of headersList) {
          const separatorIndex = header.indexOf(': ');
          if (separatorIndex !== -1) {
            const key = header.substring(0, separatorIndex).trim();
            const value = header.substring(separatorIndex + 2).trim();
            if (headers[key]) {
              headers[key] = `${headers[key]}, ${value}`;
            } else {
              headers[key] = value;
            }
          }
        }

        publish({
          type: 'success',
          status: xhr.status,
          headers: headers,
          body: xhr.response,
        });
      } else {
        publish({
          type: 'failure',
          status: xhr.status,
          message: `Upload failed with status ${xhr.status}`,
        });
      }
    }

    xhr.onerror = () => {
      publish({
        type: 'failure',
        message: 'Network error occurred',
      });
    };

    xhr.ontimeout = () => {
      publish({
        type: 'failure',
        message: 'Request timed out',
      });
    };

    xhr.onabort = () => {
      aborted = true;
      // resolver가 대기 중이면 failure로 해제하여 generator가 종료되도록 함
      publish({
        type: 'failure',
        message: 'Request was cancelled',
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

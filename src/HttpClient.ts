import {
  HttpClientConfig,
  HttpRequest,
  HttpUploadRequest,
  HttpDownloadRequest,
} from "./HttpRequest";
import { HttpResponse } from "./HttpResponse";
import { CancelToken } from "./CancelToken";
import { FileUploadEvent } from "./FileUploadEvent";

/**
 * HTTP 클라이언트를 나타내는 클래스입니다.
 * Fetch API를 사용하여 HTTP 요청을 보내고 응답을 처리합니다.
 * 파일 업로드는 XMLHttpRequest를 사용합니다.
 */
export class HttpClient {
  private readonly baseUrl: string;
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
   * HTTP 요청을 보내는 메서드
   * @param request HTTP 요청 객체
   * @param cancelToken 취소 토큰 (선택 사항)
   */
  public async send(request: HttpRequest, cancelToken?: CancelToken): Promise<HttpResponse> {
    // 1. URL 생성
    const url = this.buildUrl(request.path, request.query);

    // 2. Headers 설정
    const headers = new Headers(request.headers);
    if (this.headers) {
      Object.entries(this.headers).forEach(([key, value]) => {
        headers.append(key, value); // append to avoid overwriting
      });
    }

    // 3. Body 설정
    let body: BodyInit | undefined = request.body;
    if (typeof body === 'string') {
      headers.set("Content-Type", "text/plain;charset=UTF-8");
    } else if (typeof body === 'object') {
      if (body instanceof Blob) {
        headers.set("Content-Type", body.type || "application/octet-stream");
      } else if (body instanceof ArrayBuffer) {
        headers.set("Content-Type", "application/octet-stream");
      } else {
        headers.set("Content-Type", "application/json;charset=UTF-8");
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
    } catch (error) {
      // console.error("HTTP request failed:", error);
      throw error;
    } finally {
      // 7. 타이머를 정리합니다.
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  /**
   * XHR을 사용한 파일 업로드 메서드
   * @param request HTTP 파일 업로드 요청 객체
   * @param cancelToken 취소 토큰 (선택 사항)
   */
  public async *upload(request: HttpUploadRequest, cancelToken?: CancelToken): AsyncGenerator<FileUploadEvent> {
    // 1. URL 생성
    const url = this.buildUrl(request.path, request.query);
    
    // 2. XMLHttpRequest 객체 생성
    const xhr = new XMLHttpRequest();
    xhr.open(request.method, url, true);

    // 3. 타임 아웃 설정
    const timeout = request.timeout ?? this.timeout;
    if (timeout) {
      xhr.timeout = timeout;
    }

    // 4. 인증 설정
    const credentials = request.credentials ?? this.credentials;
    if (credentials) {
      xhr.withCredentials = credentials === 'include' || credentials === 'same-origin';
    }

    // 5. Headers 설정
    if (request.headers) {
      Object.entries(request.headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value); // append to avoid overwriting
      });
    }
    if (this.headers) {
      Object.entries(this.headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value); // append to avoid overwriting
      });
    }

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
    
    // 7. Promise를 사용하여 이벤트를 처리
    const events: ((res: FileUploadEvent) => void)[] = [];
    const awaitEvent = () => new Promise<FileUploadEvent>((resolve) => {
      events.push(resolve); // resolve 함수가 호출되면 현재 이벤트가 처리됨
    });

    // 8. 이벤트 핸들러 설정
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        const progress = Math.round((ev.loaded / ev.total) * 100);
        events.shift()?.({
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
              // 중복 키의 경우 값을 쉼표로 연결
              headers[key] = `${headers[key]}, ${value}`;
            } else {
              headers[key] = value;
            }
          }
        }

        events.shift()?.({
          type: 'success',
          status: xhr.status,
          headers: headers,
          body: xhr.response,
        });
      } else {
        events.shift()?.({
          type: 'failure',
          status: xhr.status,
          message: `Upload failed with status ${xhr.status}`,
        });
      }
    }
    
    xhr.onerror = () => {
      events.shift()?.({
        type: 'failure',
        message: 'Network error occurred',
      });
    };
    
    xhr.ontimeout = () => {
      events.shift()?.({
        type: 'failure',
        message: 'Request timed out',
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
      const event = await awaitEvent();
      yield event;
  
      // 성공/에러 등 종료 이벤트면 반복 종료
      if (event.type === 'success' || event.type === 'failure') break;
    }
  }

  /**
   * a 태그를 사용한 브라우저용 단순 파일 다운로드 메서드
   */
  public download(request: HttpDownloadRequest): void {
    const url = this.buildUrl(request.path, request.query);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = '';

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // 요청 URL을 생성하는 메서드
  private buildUrl(path: string, query?: Record<string, string | string[]>): string {
    // 1. URL 생성
    const url = new URL(this.baseUrl.endsWith('/') && path.startsWith('/')
    ? this.baseUrl + path.slice(1)
    : this.baseUrl + path);

    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== null || value !== undefined) {
          (Array.isArray(value) ? value : [value]).forEach(val =>
            url.searchParams.append(key, val)
          );
        }
      });
    }

    return url.toString();
  }
}

class CanceledError extends Error {
  constructor(error) {
    super();
    this.name = "CanceledError";
    if (error instanceof Error) {
      this.message = error.message;
      this.cause = error.cause;
      this.stack = error.stack;
    } else if (error instanceof ProgressEvent) {
      this.message = "Request was cancelled";
      this.cause = error;
    } else if (typeof error === "string") {
      this.message = error;
    } else {
      this.message = "Request was cancelled";
    }
  }
}
class CancelToken {
  constructor() {
    this._isCancelled = false;
    this.controller = new AbortController();
    this.callbacks = [];
  }
  /**
   * 작업 취소를 감지할 수 있는 AbortSignal 객체를 반환합니다.
   * fetch, EventSource 등의 API와 연동할 수 있습니다.
   */
  get signal() {
    return this.controller.signal;
  }
  /**
   * 현재 작업이 취소된 상태인지 여부를 반환합니다.
   */
  get isCancelled() {
    return this._isCancelled;
  }
  /**
   * 작업 취소 시 실행할 콜백 함수를 등록합니다.
   *
   * @param callback 취소될 때 호출될 함수
   * @example
   * token.register(() => console.log("취소됨"));
   */
  register(callback) {
    this.callbacks.push(callback);
  }
  /**
   * 작업을 취소하고, 등록된 콜백 함수들을 실행합니다.
   * 내부적으로 AbortController.abort()도 호출됩니다.
   *
   * @param reason 취소 사유로 전달할 선택적 값
   */
  cancel(reason) {
    if (!this._isCancelled) {
      this._isCancelled = true;
      this.controller.abort();
      for (const callback of this.callbacks) {
        try {
          callback(reason);
        } catch (error) {
          console.error("CancelToken callback error:", error);
        }
      }
    }
  }
  /**
   * 작업이 취소되었는지 확인하고, 취소된 경우 예외를 던집니다.
   * 장기 실행 함수 내에서 수시로 호출해 중단 처리를 할 수 있습니다.
   *
   * @throws 작업이 이미 취소된 경우 예외 발생
   */
  throwIfCancelled() {
    if (this._isCancelled) {
      throw new CanceledError("Operation has been cancelled");
    }
  }
}
function buildUrl({ baseUrl, path, query }) {
  if (!baseUrl) {
    throw new Error("Base URL is required for building the request URL.");
  }
  const url = !path ? new URL(baseUrl) : new URL(baseUrl.endsWith("/") && path.startsWith("/") ? baseUrl + path.slice(1) : baseUrl + path);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== null && value !== void 0) {
        (Array.isArray(value) ? value : [value]).forEach(
          (val) => url.searchParams.append(key, val)
        );
      }
    });
  }
  return url;
}
function parseUrl(url, defaultUrl) {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return { baseUrl: url };
  } else {
    if (!defaultUrl) {
      throw new Error("Base URL is required for relative URLs.");
    }
    const [path, queryString] = url.split("?", 2);
    const query = {};
    if (queryString) {
      new URLSearchParams(queryString).forEach((value, key) => {
        if (query[key]) {
          if (Array.isArray(query[key])) {
            query[key].push(value);
          } else {
            query[key] = [query[key], value];
          }
        } else {
          query[key] = value;
        }
      });
    }
    return { baseUrl: defaultUrl, path, query };
  }
}
class SseStreamParser {
  constructor(decoder = new TextDecoder("utf-8")) {
    this.DELEMITER = /\r?\n\r?\n/;
    this.decoder = decoder;
  }
  /**
   * SSE 스트림을 파싱하는 비동기 제너레이터입니다.
   */
  async *parse(reader) {
    let done = false;
    let buffer = "";
    while (!done) {
      const { value, done: isDone } = await reader.read();
      done = isDone;
      if (value) {
        buffer += this.decoder.decode(value, { stream: true });
        const blocks = buffer.split(this.DELEMITER);
        if (blocks.length > 1) {
          for (let i = 0; i < blocks.length - 1; i++) {
            const event = this.parseBlock(blocks[i].trim());
            if (event) {
              yield event;
            }
          }
          buffer = blocks[blocks.length - 1];
        }
      }
    }
    if (buffer) {
      const event = this.parseBlock(buffer.trim());
      if (event) {
        yield event;
      }
    }
  }
  /**
   * 단일 SSE 이벤트 블록을 파싱합니다.
   */
  parseBlock(data) {
    if (!data) return void 0;
    const lines = data.split(/\r?\n/).filter((line) => line.trim() !== "");
    if (lines.length === 0) return void 0;
    const event = {
      type: "sse",
      event: "message",
      data: ""
    };
    for (const line of lines) {
      const divider = line.indexOf(":");
      if (divider === -1) continue;
      const key = line.slice(0, divider).trim();
      const value = line.slice(divider + 1).trim();
      if (key === "event") {
        event.event = value;
      } else if (key === "data") {
        event.data = event.data ? `${event.data}
${value}` : value;
      } else if (key === "id") {
        event.id = value;
      } else if (key === "retry") {
        const retryMs = parseInt(value, 10);
        if (!isNaN(retryMs)) {
          event.retry = retryMs;
        }
      }
    }
    return event.data ? event : void 0;
  }
}
class JsonStreamParser {
  constructor(decoder = new TextDecoder("utf-8")) {
    this.decoder = decoder;
  }
  /**
   * JSON 스트림을 파싱하는 비동기 제너레이터입니다.
   */
  async *parse(reader) {
    let done = false;
    let buffer = "";
    while (!done) {
      const { value, done: isDone } = await reader.read();
      done = isDone;
      if (value) {
        buffer += this.decoder.decode(value, { stream: true });
        const { objects, remaining } = this.extractCompleteJsonObjects(buffer);
        buffer = remaining;
        for (const jsonStr of objects) {
          yield {
            type: "json",
            data: jsonStr.trim()
          };
        }
      }
    }
    if (buffer.trim()) {
      try {
        const jsonStr = buffer.trim();
        JSON.parse(jsonStr);
        yield {
          type: "json",
          data: jsonStr
        };
      } catch (error) {
        console.warn("Failed to parse remaining JSON:", buffer, error);
      }
    }
  }
  /**
   * 문자열에서 완전한 JSON 객체를 찾아 반환합니다.
   * @param text 파싱할 텍스트
   * @returns 완전한 JSON 객체들의 배열과 남은 텍스트
   */
  extractCompleteJsonObjects(text) {
    const objects = [];
    let current = "";
    let depth = 0;
    let inString = false;
    let escaped = false;
    let i = 0;
    while (i < text.length) {
      const char = text[i];
      current += char;
      if (escaped) {
        escaped = false;
        i++;
        continue;
      }
      if (char === "\\" && inString) {
        escaped = true;
        i++;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        i++;
        continue;
      }
      if (!inString) {
        if (char === "{") {
          depth++;
        } else if (char === "}") {
          depth--;
          if (depth === 0) {
            objects.push(current.trim());
            current = "";
          }
        }
      }
      i++;
    }
    return {
      objects,
      remaining: current
    };
  }
}
class TextStreamParser {
  constructor(decoder = new TextDecoder("utf-8")) {
    this.DELEMITER = /\r?\n/;
    this.decoder = decoder;
  }
  /**
   * 텍스트 스트림을 파싱하는 비동기 제너레이터입니다.
   */
  async *parse(reader) {
    let done = false;
    let buffer = "";
    while (!done) {
      const { value, done: isDone } = await reader.read();
      done = isDone;
      if (value) {
        buffer += this.decoder.decode(value, { stream: true });
        const lines = buffer.split(this.DELEMITER);
        buffer = lines.pop() || "";
        for (const line of lines) {
          yield {
            type: "text",
            data: line
          };
        }
      }
    }
    if (buffer) {
      yield {
        type: "text",
        data: buffer
      };
    }
  }
}
function guessStreamFormat(headers) {
  const contentType = headers.get("content-type")?.toLowerCase() || "";
  if (contentType.includes("text/event-stream")) {
    return "sse";
  } else if (contentType.includes("application/json") || contentType.includes("application/x-ndjson")) {
    return "json";
  } else if (contentType.includes("text/")) {
    return "text";
  } else {
    return "text";
  }
}
function createStreamParser({ format, decoder }) {
  switch (format) {
    case "sse":
      return new SseStreamParser(decoder);
    case "json":
      return new JsonStreamParser(decoder);
    case "text":
      return new TextStreamParser(decoder);
    default:
      throw new Error(`Unsupported stream format: ${format}`);
  }
}
class HttpResponse {
  constructor(response) {
    this._response = response;
  }
  /** 응답 상태가 성공(`2xx`)인지 여부를 반환합니다. */
  get ok() {
    return this._response.ok;
  }
  /** 요청이 리디렉션되었는지 여부를 반환합니다. */
  get redirected() {
    return this._response.redirected;
  }
  /** HTTP 상태 코드를 반환합니다. */
  get status() {
    return this._response.status;
  }
  /** HTTP 상태 텍스트를 반환합니다. */
  get statusText() {
    return this._response.statusText;
  }
  /** 응답을 보낸 최종 URL을 반환합니다. */
  get url() {
    return this._response.url;
  }
  /** 응답의 헤더 정보를 반환합니다. */
  get headers() {
    return this._response.headers;
  }
  /** 응답 본문의 ReadableStream을 반환합니다. */
  get body() {
    return this._response.body;
  }
  /** 응답 본문을 텍스트 형식으로 반환합니다. */
  text() {
    return this._response.text();
  }
  /** 응답 본문을 JSON 형식으로 파싱하여 반환합니다. */
  json() {
    return this._response.json();
  }
  /** 응답 본문을 ArrayBuffer 형식으로 반환합니다. */
  arrayBuffer() {
    return this._response.arrayBuffer();
  }
  /**
   * 응답 본문을 Uint8Array로 변환하여 반환합니다.
   * 주로 바이너리 데이터를 다룰 때 유용합니다.
   */
  async bytes() {
    const buffer = await this._response.arrayBuffer();
    return new Uint8Array(buffer);
  }
  /**
   * 응답 본문을 Blob 형식으로 반환합니다.
   * 파일 다운로드 등에서 활용할 수 있습니다.
   */
  blob() {
    return this._response.blob();
  }
  /**
   * 응답 본문을 FormData 형식으로 반환합니다.
   * 응답 타입이 `multipart/form-data`인 경우 사용합니다.
   */
  formData() {
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
  async *stream(options) {
    try {
      const reader = this._response.body?.getReader();
      if (!reader) {
        throw new Error("Response body is not available for streaming.");
      }
      const decoder = options?.decoder || new TextDecoder("utf-8");
      const format = !options || options.format === "auto" ? guessStreamFormat(this._response.headers) : options.format;
      const parser = createStreamParser({ format, decoder });
      yield* parser.parse(reader);
    } catch (error) {
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
  async *streamAsSse(decoder) {
    yield* this.stream({ format: "sse", decoder });
  }
  /**
   * JSON 스트림을 파싱하는 비동기 제너레이터입니다.
   * JSON Lines 형태의 스트림 데이터를 처리합니다.
   */
  async *streamAsJson(decoder) {
    yield* this.stream({ format: "json", decoder });
  }
  /**
   * 텍스트 스트림을 파싱하는 비동기 제너레이터입니다.
   * 줄바꿈 기준으로 텍스트를 분할하여 스트림으로 제공합니다.
   */
  async *streamAsText(decoder) {
    yield* this.stream({ format: "text", decoder });
  }
}
class HttpClient {
  constructor(config) {
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
  async head(url, cancelToken) {
    const { baseUrl, path, query } = parseUrl(url, this.baseUrl);
    return this.send({ method: "HEAD", baseUrl, path, query }, cancelToken);
  }
  /**
   * GET 요청을 보내 데이터를 조회합니다.
   */
  async get(url, cancelToken) {
    const { baseUrl, path, query } = parseUrl(url, this.baseUrl);
    return this.send({ method: "GET", baseUrl, path, query }, cancelToken);
  }
  /**
   * POST 요청을 보내 서버에 리소스를 생성하거나 데이터를 전송합니다.
   */
  async post(url, body, cancelToken) {
    const { baseUrl, path, query } = parseUrl(url, this.baseUrl);
    return this.send({ method: "POST", baseUrl, path, query, body }, cancelToken);
  }
  /**
   * PUT 요청을 보내 서버 리소스를 전체 교체하거나 생성합니다.
   */
  async put(url, body, cancelToken) {
    const { baseUrl, path, query } = parseUrl(url, this.baseUrl);
    return this.send({ method: "PUT", baseUrl, path, query, body }, cancelToken);
  }
  /**
   * PATCH 요청을 보내 서버 리소스의 일부를 수정합니다.
   */
  async patch(url, body, cancelToken) {
    const { baseUrl, path, query } = parseUrl(url, this.baseUrl);
    return this.send({ method: "PATCH", baseUrl, path, query, body }, cancelToken);
  }
  /**
   * DELETE 요청을 보내 서버 리소스를 삭제합니다.
   */
  async delete(url, cancelToken) {
    const { baseUrl, path, query } = parseUrl(url, this.baseUrl);
    return this.send({ method: "DELETE", baseUrl, path, query }, cancelToken);
  }
  /**
   * Fetch API를 이용하여 일반 HTTP 요청을 보냅니다.
   *
   * @param request 요청 객체
   * @param cancelToken 요청을 중단할 수 있는 토큰
   * @returns 서버로부터의 응답 객체
   */
  async send(request, cancelToken) {
    const url = buildUrl({
      baseUrl: request.baseUrl ?? this.baseUrl,
      path: request.path,
      query: request.query
    });
    const headers = new Headers(request.headers);
    if (this.headers) {
      Object.entries(this.headers).forEach(([key, value]) => {
        headers.append(key, value);
      });
    }
    let body = request.body;
    if (typeof body === "string") {
      headers.set("Content-Type", "text/plain;charset=UTF-8");
    } else if (typeof body === "object") {
      if (body instanceof Blob) {
        headers.set("Content-Type", body.type || "application/octet-stream");
      } else if (body instanceof ArrayBuffer) {
        headers.set("Content-Type", "application/octet-stream");
      } else {
        headers.set("Content-Type", "application/json;charset=UTF-8");
        body = JSON.stringify(body);
      }
    }
    const token = cancelToken || new CancelToken();
    const timeout = request.timeout ?? this.timeout;
    const timer = timeout ? setTimeout(() => token.cancel(), timeout) : null;
    try {
      const res = await fetch(url.toString(), {
        method: request.method,
        headers,
        body,
        cache: request.cache ?? this.cache,
        credentials: request.credentials ?? this.credentials,
        mode: request.mode ?? this.mode,
        keepalive: request.keepalive ?? this.keepalive,
        signal: token.signal
      });
      return new HttpResponse(res);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new CanceledError(error);
      } else {
        throw error;
      }
    } finally {
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
   */
  async *upload(request, cancelToken) {
    const url = buildUrl({
      baseUrl: request.baseUrl ?? this.baseUrl,
      path: request.path,
      query: request.query
    });
    const xhr = new XMLHttpRequest();
    xhr.open(request.method, url, true);
    const timeout = request.timeout ?? this.timeout;
    if (timeout) {
      xhr.timeout = timeout;
    }
    const credentials = request.credentials ?? this.credentials;
    if (credentials) {
      xhr.withCredentials = credentials === "include" || credentials === "same-origin";
    }
    if (request.headers) {
      Object.entries(request.headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });
    }
    if (this.headers) {
      Object.entries(this.headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });
    }
    let body;
    if (request.body instanceof FormData) {
      body = request.body;
    } else if (Array.isArray(request.body)) {
      const formData = new FormData();
      for (let i = 0; i < request.body.length; i++) {
        formData.append("files", request.body[i]);
      }
      body = formData;
    } else {
      const formData = new FormData();
      formData.append("file", request.body);
      body = formData;
    }
    const events = [];
    const awaitEvent = () => new Promise((resolve) => {
      events.push(resolve);
    });
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        const progress = Math.round(ev.loaded / ev.total * 100);
        events.shift()?.({
          type: "progress",
          loaded: ev.loaded,
          total: ev.total,
          progress
        });
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const headers = {};
        const headersText = xhr.getAllResponseHeaders();
        const headersList = headersText.split("\r\n");
        for (const header of headersList) {
          const separatorIndex = header.indexOf(": ");
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
        events.shift()?.({
          type: "success",
          status: xhr.status,
          headers,
          body: xhr.response
        });
      } else {
        events.shift()?.({
          type: "failure",
          status: xhr.status,
          message: `Upload failed with status ${xhr.status}`
        });
      }
    };
    xhr.onerror = () => {
      events.shift()?.({
        type: "failure",
        message: "Network error occurred"
      });
    };
    xhr.ontimeout = () => {
      events.shift()?.({
        type: "failure",
        message: "Request timed out"
      });
    };
    xhr.onabort = (ev) => {
      throw new CanceledError(ev);
    };
    if (cancelToken) {
      cancelToken.register(() => {
        xhr.abort();
      });
    }
    xhr.send(body);
    while (true) {
      const event = await awaitEvent();
      yield event;
      if (event.type === "success" || event.type === "failure") break;
    }
  }
  /**
   * 브라우저의 기본 다운로드 동작을 활용하여 파일을 다운로드합니다.
   * (a 태그를 임시로 생성 후 클릭)
   *
   * @param request 다운로드 요청 객체
   */
  download(request) {
    const url = buildUrl({
      baseUrl: request.baseUrl ?? this.baseUrl,
      path: request.path,
      query: request.query
    });
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url.toString();
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
export {
  CancelToken,
  CanceledError,
  HttpClient,
  HttpResponse
};

/**
 * 요청이 취소되었음을 나타내는 오류입니다.
 */
class CanceledError extends Error {
    constructor(error) {
        super(), this.name = "CanceledError", error instanceof Error ? (this.message = error.message, 
        this.cause = error.cause, this.stack = error.stack) : error instanceof ProgressEvent ? (this.message = "Request was cancelled", 
        this.cause = error) : this.message = "string" == typeof error ? error : "Request was cancelled";
    }
}

/**
 * CancelToken 클래스는 작업 취소를 관리하기 위한 객체입니다.
 * 내부적으로 AbortController를 사용하며, 등록된 콜백과 함께 취소 신호를 전파합니다.
 */ class CancelToken {
    constructor() {
        this._isCancelled = !1, this.controller = new AbortController, this.callbacks = [];
    }
    /**
     * 작업 취소를 감지할 수 있는 AbortSignal 객체를 반환합니다.
     * fetch, EventSource 등의 API와 연동할 수 있습니다.
     */    get signal() {
        return this.controller.signal;
    }
    /**
     * 현재 작업이 취소된 상태인지 여부를 반환합니다.
     */    get isCancelled() {
        return this._isCancelled;
    }
    /**
     * 작업 취소 시 실행할 콜백 함수를 등록합니다.
     *
     * @param callback 취소될 때 호출될 함수
     * @example
     * token.register(() => console.log("취소됨"));
     */    register(callback) {
        this.callbacks.push(callback);
    }
    /**
     * 작업을 취소하고, 등록된 콜백 함수들을 실행합니다.
     * 내부적으로 AbortController.abort()도 호출됩니다.
     *
     * @param reason 취소 사유로 전달할 선택적 값
     */    cancel(reason) {
        if (!this._isCancelled) {
            this._isCancelled = !0, this.controller.abort();
            // 등록된 모든 콜백 실행
            for (const callback of this.callbacks) try {
                callback(reason);
            } catch (error) {
                console.error("CancelToken callback error:", error);
            }
        }
    }
    /**
     * 작업이 취소되었는지 확인하고, 취소된 경우 예외를 던집니다.
     * 장기 실행 함수 내에서 수시로 호출해 중단 처리를 할 수 있습니다.
     *
     * @throws 작업이 이미 취소된 경우 예외 발생
     */    throwIfCancelled() {
        if (this._isCancelled) throw new CanceledError("Operation has been cancelled");
    }
}

/**
 * HTTP 응답을 나타내는 클래스입니다.
 * Fetch API의 Response 객체를 래핑하여 다양한 응답 처리 메서드를 제공합니다.
 */ class HttpResponse {
    constructor(response) {
        this._response = response;
    }
    /**
     * 응답 상태가 성공(`2xx`)인지 여부를 반환합니다.
     */    get ok() {
        return this._response.ok;
    }
    /**
     * HTTP 상태 코드를 반환합니다.
     * @example 200, 404, 500
     */    get status() {
        return this._response.status;
    }
    /**
     * HTTP 상태 텍스트를 반환합니다.
     * @example 'OK', 'Not Found'
     */    get statusText() {
        return this._response.statusText;
    }
    /**
     * 응답의 헤더 정보를 반환합니다.
     */    get headers() {
        return this._response.headers;
    }
    /**
     * 응답을 보낸 최종 URL을 반환합니다.
     */    get url() {
        return this._response.url;
    }
    /**
     * 요청이 리디렉션되었는지 여부를 반환합니다.
     */    get redirected() {
        return this._response.redirected;
    }
    /**
     * 응답 본문을 텍스트 형식으로 반환합니다.
     */    text() {
        return this._response.text();
    }
    /**
     * 응답 본문을 JSON 형식으로 파싱하여 반환합니다.
     * @template T 반환할 객체의 타입
     */    json() {
        return this._response.json();
    }
    /**
     * 응답 본문을 ArrayBuffer 형식으로 반환합니다.
     */    arrayBuffer() {
        return this._response.arrayBuffer();
    }
    /**
     * 응답 본문을 Uint8Array로 변환하여 반환합니다.
     * 주로 바이너리 데이터를 다룰 때 유용합니다.
     */    async bytes() {
        const buffer = await this._response.arrayBuffer();
        return new Uint8Array(buffer);
    }
    /**
     * 응답 본문을 Blob 형식으로 반환합니다.
     * 파일 다운로드 등에서 활용할 수 있습니다.
     */    blob() {
        return this._response.blob();
    }
    /**
     * 응답 본문을 FormData 형식으로 반환합니다.
     * 응답 타입이 `multipart/form-data`인 경우 사용합니다.
     */    formData() {
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
     */    async* stream() {
        try {
            const reader = this._response.body?.getReader(), decoder = new TextDecoder("utf-8");
            if (!reader) throw new Error("Response body is not available for streaming.");
            let done = !1, buffer = "";
            // 디코딩된 텍스트를 저장할 버퍼입니다.
            const delimiter = /\r?\n\r?\n/;
 // 이벤트 블록의 구분자입니다.
                        for (;!done; ) {
                const {value: value, done: isDone} = await reader.read();
                if (done = isDone, value) {
                    buffer += decoder.decode(value, {
                        stream: !0
                    });
                    const blocks = buffer.split(delimiter);
                    if (blocks.length > 1) {
                        for (let i = 0; i < blocks.length - 1; i++) {
                            const event = this.parse(blocks[i].trim());
                            event && (yield event);
                        }
                        buffer = blocks[blocks.length - 1];
                    }
                }
            }
            // 남아있는 누적된 텍스트를 반환
                        if (buffer) {
                const event = this.parse(buffer.trim());
                event && (yield event);
            }
        } catch (error) {
            throw error instanceof Error && "AbortError" === error.name ? new CanceledError(error) : error;
        }
    }
    /**
     * 단일 텍스트 블록을 TextStreamEvent로 파싱합니다.
     * @param data 이벤트 블록 텍스트
     * @returns 파싱된 TextStreamEvent 객체 또는 undefined
     */    parse(data) {
        if (!data) return;
        const lines = data.split(/\r?\n/).filter((line => "" !== line.trim()));
        if (0 === lines.length) return;
        const event = {
            event: "message",
            data: ""
        };
        for (const line of lines) {
            const divider = line.indexOf(":");
            if (-1 === divider) continue;
            const key = line.slice(0, divider).trim(), value = line.slice(divider + 1).trim();
            if ("event" === key) event.event = value; else if ("data" === key) 
            // data가 여러 줄인 경우, 이전 데이터와 'LF'로 연결합니다.
            event.data = event.data ? `${event.data}\n${value}` : value; else if ("id" === key) event.id = value; else if ("retry" === key) {
                const retryMs = parseInt(value, 10);
                isNaN(retryMs) || (event.retry = retryMs);
            }
        }
        return event.data ? event : void 0;
    }
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
 */ class HttpClient {
    constructor(config) {
        this.baseUrl = config.baseUrl, this.headers = config.headers, this.timeout = config.timeout, 
        this.credentials = config.credentials, this.mode = config.mode, this.cache = config.cache, 
        this.keepalive = config.keepalive;
    }
    /**
     * HEAD 요청을 보내 리소스의 존재 여부나 메타데이터를 확인합니다.
     * 본문 없이 헤더만 반환됩니다.
     */    async head(url, cancelToken) {
        const {baseUrl: baseUrl, path: path, query: query} = this.parseUrl(url);
        return this.send({
            method: "HEAD",
            baseUrl: baseUrl,
            path: path,
            query: query
        }, cancelToken);
    }
    /**
     * GET 요청을 보내 데이터를 조회합니다.
     */    async get(url, cancelToken) {
        const {baseUrl: baseUrl, path: path, query: query} = this.parseUrl(url);
        return this.send({
            method: "GET",
            baseUrl: baseUrl,
            path: path,
            query: query
        }, cancelToken);
    }
    /**
     * POST 요청을 보내 서버에 리소스를 생성하거나 데이터를 전송합니다.
     */    async post(url, body, cancelToken) {
        const {baseUrl: baseUrl, path: path, query: query} = this.parseUrl(url);
        return this.send({
            method: "POST",
            baseUrl: baseUrl,
            path: path,
            query: query,
            body: body
        }, cancelToken);
    }
    /**
     * PUT 요청을 보내 서버 리소스를 전체 교체하거나 생성합니다.
     */    async put(url, body, cancelToken) {
        const {baseUrl: baseUrl, path: path, query: query} = this.parseUrl(url);
        return this.send({
            method: "PUT",
            baseUrl: baseUrl,
            path: path,
            query: query,
            body: body
        }, cancelToken);
    }
    /**
     * PATCH 요청을 보내 서버 리소스의 일부를 수정합니다.
     */    async patch(url, body, cancelToken) {
        const {baseUrl: baseUrl, path: path, query: query} = this.parseUrl(url);
        return this.send({
            method: "PATCH",
            baseUrl: baseUrl,
            path: path,
            query: query,
            body: body
        }, cancelToken);
    }
    /**
     * DELETE 요청을 보내 서버 리소스를 삭제합니다.
     */    async delete(url, cancelToken) {
        const {baseUrl: baseUrl, path: path, query: query} = this.parseUrl(url);
        return this.send({
            method: "DELETE",
            baseUrl: baseUrl,
            path: path,
            query: query
        }, cancelToken);
    }
    /**
     * Fetch API를 이용하여 일반 HTTP 요청을 보냅니다.
     *
     * @param request 요청 객체
     * @param cancelToken 요청을 중단할 수 있는 토큰
     * @returns 서버로부터의 응답 객체
     */    async send(request, cancelToken) {
        // 1. URL 생성
        const url = this.buildUrl(request.baseUrl ?? this.baseUrl, request.path, request.query), headers = new Headers(request.headers);
        // 2. Headers 설정
                this.headers && Object.entries(this.headers).forEach((([key, value]) => {
            headers.append(key, value);
 // append to avoid overwriting
                }));
        // 3. Body 설정
                let body = request.body;
        "string" == typeof body ? headers.set("Content-Type", "text/plain;charset=UTF-8") : "object" == typeof body && (body instanceof Blob ? headers.set("Content-Type", body.type || "application/octet-stream") : body instanceof ArrayBuffer ? headers.set("Content-Type", "application/octet-stream") : (headers.set("Content-Type", "application/json;charset=UTF-8"), 
        body = JSON.stringify(body)));
        // 4. Abort 설정
                const token = cancelToken || new CancelToken, timeout = request.timeout ?? this.timeout, timer = timeout ? setTimeout((() => token.cancel()), timeout) : null;
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
                signal: token.signal
            });
            // 6. 응답 처리
                        return new HttpResponse(res);
        } catch (error) {
            throw error instanceof Error && "AbortError" === error.name ? new CanceledError(error) : error;
        } finally {
            // 7. 타이머를 정리합니다.
            timer && clearTimeout(timer);
        }
    }
    /**
     * XMLHttpRequest를 이용해 파일 업로드를 수행하며,
     * 업로드 진행 상황을 AsyncGenerator 형태로 스트리밍합니다.
     *
     * @param request 업로드 요청 객체
     * @param cancelToken 요청 취소 토큰
     * @returns 업로드 이벤트 스트림
     */    async* upload(request, cancelToken) {
        // 1. URL 생성
        const url = this.buildUrl(request.baseUrl ?? this.baseUrl, request.path, request.query), xhr = new XMLHttpRequest;
        // 2. XMLHttpRequest 객체 생성
                xhr.open(request.method, url, !0);
        // 3. 타임 아웃 설정
        const timeout = request.timeout ?? this.timeout;
        timeout && (xhr.timeout = timeout);
        // 4. 인증 설정
                const credentials = request.credentials ?? this.credentials;
        // 6. Body 설정
        let body;
        if (credentials && (xhr.withCredentials = "include" === credentials || "same-origin" === credentials), 
        // 5. Headers 설정
        request.headers && Object.entries(request.headers).forEach((([key, value]) => {
            xhr.setRequestHeader(key, value);
 // append to avoid overwriting
                })), this.headers && Object.entries(this.headers).forEach((([key, value]) => {
            xhr.setRequestHeader(key, value);
 // append to avoid overwriting
                })), request.body instanceof FormData) body = request.body; else if (Array.isArray(request.body)) {
            const formData = new FormData;
            for (let i = 0; i < request.body.length; i++) formData.append("files", request.body[i]);
            body = formData;
        } else {
            const formData = new FormData;
            formData.append("file", request.body), body = formData;
        }
        // 7. Promise를 사용하여 이벤트를 처리
                const events = [];
        for (
        // 8. 이벤트 핸들러 설정
        xhr.upload.onprogress = ev => {
            if (ev.lengthComputable) {
                const progress = Math.round(ev.loaded / ev.total * 100);
                events.shift()?.({
                    type: "progress",
                    loaded: ev.loaded,
                    total: ev.total,
                    progress: progress
                });
            }
        }, xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                const headers = {}, headersList = xhr.getAllResponseHeaders().split("\r\n");
                for (const header of headersList) {
                    const separatorIndex = header.indexOf(": ");
                    if (-1 !== separatorIndex) {
                        const key = header.substring(0, separatorIndex).trim(), value = header.substring(separatorIndex + 2).trim();
                        headers[key] ? 
                        // 중복 키의 경우 값을 쉼표로 연결
                        headers[key] = `${headers[key]}, ${value}` : headers[key] = value;
                    }
                }
                events.shift()?.({
                    type: "success",
                    status: xhr.status,
                    headers: headers,
                    body: xhr.response
                });
            } else events.shift()?.({
                type: "failure",
                status: xhr.status,
                message: `Upload failed with status ${xhr.status}`
            });
        }, xhr.onerror = () => {
            events.shift()?.({
                type: "failure",
                message: "Network error occurred"
            });
        }, xhr.ontimeout = () => {
            events.shift()?.({
                type: "failure",
                message: "Request timed out"
            });
        }, xhr.onabort = ev => {
            throw new CanceledError(ev);
        }, 
        // 취소 토큰 설정
        cancelToken && cancelToken.register((() => {
            xhr.abort();
        })), 
        // 요청 전송
        xhr.send(body); ;) {
            const event = await new Promise((resolve => {
                events.push(resolve);
 // resolve 함수가 호출되면 현재 이벤트가 처리됨
                        }));
            // 성공/에러 등 종료 이벤트면 반복 종료
            if (yield event, "success" === event.type || "failure" === event.type) break;
        }
    }
    /**
     * 브라우저의 기본 다운로드 동작을 활용하여 파일을 다운로드합니다.
     * (a 태그를 임시로 생성 후 클릭)
     *
     * @param request 다운로드 요청 객체
     */    download(request) {
        const url = this.buildUrl(request.baseUrl ?? this.baseUrl, request.path, request.query), a = document.createElement("a");
        a.style.display = "none", a.href = url.toString(), a.download = "", document.body.appendChild(a), 
        a.click(), document.body.removeChild(a);
    }
    /**
     * 요청에 사용할 최종 URL을 생성합니다.
     *
     * @param baseUrl 기본 URL
     * @param path 추가 경로
     * @param query 쿼리 파라미터
     * @returns 완성된 URL 객체
     */    buildUrl(baseUrl, path, query) {
        // 1. base URL이 없으면 오류를 발생시킵니다.
        if (!baseUrl) throw new Error("Base URL is required for building the request URL.");
        // 2. URL을 생성합니다.
                const url = path ? new URL(baseUrl.endsWith("/") && path.startsWith("/") ? baseUrl + path.slice(1) : baseUrl + path) : new URL(baseUrl);
        // 3. 쿼리 파라미터를 추가합니다.
                return query && Object.entries(query).forEach((([key, value]) => {
            null === value && void 0 === value || (Array.isArray(value) ? value : [ value ]).forEach((val => url.searchParams.append(key, val)));
        })), url;
    }
    /**
     * 주어진 URL 문자열을 baseUrl, path, query로 분해합니다.
     *
     * @param url 전체 URL 또는 상대 경로 URL
     * @returns URL 구성 요소
     */    parseUrl(url) {
        if (url.startsWith("http://") || url.startsWith("https://")) return {
            baseUrl: url
        };
        {
            if (!this.baseUrl) throw new Error("Base URL is required for relative URLs.");
            const [path, queryString] = url.split("?", 2), query = queryString ? Object.fromEntries(new URLSearchParams(queryString)) : void 0;
            return {
                baseUrl: this.baseUrl,
                path: path,
                query: query
            };
        }
    }
}

export { CancelToken, CanceledError, HttpClient, HttpResponse };

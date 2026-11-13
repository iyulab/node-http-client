/**
 * `fetch` 가 그대로 보내는 본문(BodyInit)인지 — `Blob` · 바이트 버퍼 · `URLSearchParams` · `FormData` · `ReadableStream`.
 * 이 본문들은 호출자가 준 헤더가 무엇이든 직렬화하지 않는다.
 */
function isNativeBody(body: object): boolean {
  return body instanceof Blob
    || body instanceof ArrayBuffer
    || ArrayBuffer.isView(body)
    || body instanceof URLSearchParams
    || body instanceof FormData
    || body instanceof ReadableStream;
}

/**
 * JSON 으로 직렬화할 본문인지 — 일반 객체와 배열만이다.
 *
 * 직렬화를 `Content-Type` 헤더 하나로 정하면 `FormData` · `Blob` 같은 본문이 `JSON.stringify` 를 거쳐 `"{}"` 가 된다
 * (인스턴스 기본 헤더에 JSON 을 둔 클라이언트에서 흔하다). 본문의 종류가 먼저다.
 */
export function isJsonBody(body: unknown): body is object {
  return typeof body === "object" && body !== null && !isNativeBody(body);
}

/**
 * Body 데이터를 분석하여 적절한 MIME 타입을 추측합니다.
 */
export function guessMimeType(body: unknown): string | undefined {
  if (body == null) return undefined;

  if (typeof body === "object") {
    if (body instanceof Blob)
      return body.type || "application/octet-stream";
    if (body instanceof ArrayBuffer || ArrayBuffer.isView(body))
      return "application/octet-stream";
    if (body instanceof URLSearchParams)
      return "application/x-www-form-urlencoded;charset=UTF-8";

    // FormData, ReadableStream은 브라우저 자동 설정에 맡김
    if (body instanceof FormData || body instanceof ReadableStream) return undefined;

    // 일반 객체는 JSON으로 직렬화하여 전송
    return "application/json;charset=UTF-8";
  }

  // 원시 타입 체크 (string, number, boolean 등)
  return "text/plain;charset=UTF-8";
}

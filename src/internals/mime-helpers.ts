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

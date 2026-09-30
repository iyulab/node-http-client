/**
 * 응답이 시작된 뒤(헤더를 받은 뒤) 본문을 다 받기 전에 연결이 끊겼음을 나타내는 오류입니다.
 *
 * 런타임은 이 상황을 서로 다른 `TypeError` 로 알린다 — Chromium 은 스트림 읽기에서 `network error`,
 * `text()`·`json()` 에서는 연결 거부와 같은 `Failed to fetch` 를, Node(undici)는 `terminated` 를 던진다.
 * 메시지로는 «응답 도중 끊김» 과 «연결 실패» 를 가를 수 없지만, 이 라이브러리는 어느 단계였는지 안다.
 *
 * `TypeError` 를 상속하므로 종전처럼 `instanceof TypeError` 로 잡던 코드는 그대로 동작한다.
 * 원래 오류는 `cause` 에 있다. 취소·`timeout`·`idleTimeout` 은 이 오류가 아니라 `CanceledError` 다.
 *
 * @example
 * ```ts
 * try {
 *   for await (const ev of res.stream({ format: 'sse' })) render(ev);
 * } catch (e) {
 *   if (e instanceof IncompleteResponseError) showRetry(); // 받은 데까지는 그려 두고 다시 시도
 *   else throw e;
 * }
 * ```
 */
export class IncompleteResponseError extends TypeError {
  constructor(cause: unknown) {
    super("The connection closed before the response body was complete", { cause });
    this.name = "IncompleteResponseError";
  }
}

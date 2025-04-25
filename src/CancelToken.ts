/**
 * CancelToken 클래스는 작업 취소를 관리하기 위한 객체입니다.
 * 내부적으로 AbortController를 사용하며, 등록된 콜백과 함께 취소 신호를 전파합니다.
 */
export class CancelToken {
  private _isCancelled = false;
  private readonly controller: AbortController = new AbortController();
  private readonly callbacks: Array<(reason?: any) => void> = [];

  /**
   * 작업 취소를 감지할 수 있는 AbortSignal 객체를 반환합니다.
   * fetch, EventSource 등의 API와 연동할 수 있습니다.
   */
  public get signal(): AbortSignal {
    return this.controller.signal;
  }

  /**
   * 현재 작업이 취소된 상태인지 여부를 반환합니다.
   */
  public get isCancelled(): boolean {
    return this._isCancelled;
  }

  /**
   * 작업 취소 시 실행할 콜백 함수를 등록합니다.
   *
   * @param callback 취소될 때 호출될 함수
   * @example
   * token.register(() => console.log("취소됨"));
   */
  public register(callback: (reason?: any) => void): void {
    this.callbacks.push(callback);
  }

  /**
   * 작업을 취소하고, 등록된 콜백 함수들을 실행합니다.
   * 내부적으로 AbortController.abort()도 호출됩니다.
   *
   * @param reason 취소 사유로 전달할 선택적 값
   */
  public cancel(reason?: any): void {
    if (!this._isCancelled) {
      this._isCancelled = true;
      this.controller.abort();

      // 등록된 모든 콜백 실행
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
  public throwIfCancelled(): void {
    if (this._isCancelled) {
      throw new Error("Operation has been cancelled");
    }
  }
}

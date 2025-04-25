/**
 * AbortToken 클래스는 작업 취소를 관리합니다.
 */
export class CancelToken {
  private readonly _controller: AbortController = new AbortController();
  private _isCancelled = false;
  private callbacks: Array<(reason?: any) => void> = [];

  /**
   * AbortSignal을 반환
   */
  public get signal(): AbortSignal {
    return this._controller.signal;
  }

  /**
   * 작업이 취소되었는지 여부
   */
  public get isCancelled(): boolean {
    return this._isCancelled;
  }

  /**
   * 취소 콜백을 등록하는 메서드
   * @param callback 취소 시 실행될 콜백 함수
   */
  public register(callback: (reason?: any) => void): void {
    this.callbacks.push(callback);
  }

  /**
   * 작업을 취소하고, 등록된 콜백을 실행하는 메서드
   */
  public cancel(reason?: any): void {
    if (!this._isCancelled) {
      this._isCancelled = true;
      this._controller.abort();
      
      // 모든 등록된 콜백 실행
      for (const callback of this.callbacks) {
        try {
          callback(reason);
        } catch (error) {
          console.error('CancelToken callback error:', error);
        }
      }
    }
  }

  /**
   * 취소되었는지 확인하고, 취소된 경우 예외를 던지는 메서드
   */
  public throwIfCancelled(): void {
    if (this._isCancelled) {
      throw new Error('Operation has been cancelled');
    }
  }

}

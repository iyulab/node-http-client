/**
 * 요청이 취소되었음을 나타내는 오류입니다.
 */
export class CanceledError extends Error {
  constructor(error?: any) {
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

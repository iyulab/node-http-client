/**
 * 특정 오류가 요청 취소로 인한 것인지 확인합니다.
 */
export function isCanceledError(error: any): boolean {
  return error instanceof Error && error.message === 'Request was aborted.';
}
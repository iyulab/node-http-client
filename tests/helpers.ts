/**
 * 문자열 청크 배열로부터 ReadableStreamDefaultReader를 생성합니다.
 * 파서 테스트에서 스트림 시뮬레이션에 사용합니다.
 */
export function createMockReader(chunks: string[]): ReadableStreamDefaultReader<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;

  return {
    read: async () => {
      if (index < chunks.length) {
        return { value: encoder.encode(chunks[index++]), done: false };
      }
      return { value: undefined, done: true };
    },
    releaseLock: () => {},
    cancel: async () => {},
    closed: Promise.resolve(undefined),
  } as unknown as ReadableStreamDefaultReader<Uint8Array>;
}

/**
 * AsyncGenerator의 모든 결과를 배열로 수집합니다.
 */
export async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const results: T[] = [];
  for await (const item of gen) {
    results.push(item);
  }
  return results;
}

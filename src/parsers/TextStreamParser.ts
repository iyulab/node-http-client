import type { TextStreamResponse, StreamParser } from '../types';

/**
 * 텍스트 스트림 파서 클래스입니다.
 * 줄바꿈 기준으로 텍스트를 분할하여 스트림으로 제공합니다.
 */
export class TextStreamParser implements StreamParser<TextStreamResponse> {
  private readonly DELEMITER = /\r?\n/;
  private readonly decoder: TextDecoder;

  constructor(decoder: TextDecoder = new TextDecoder('utf-8')) {
    this.decoder = decoder;
  }

  /**
   * 텍스트 스트림을 파싱하는 비동기 제너레이터입니다.
   */
  public async *parse(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncGenerator<TextStreamResponse> {
    let done = false;
    let buffer = '';

    while (!done) {
      const { value, done: isDone } = await reader.read();
      done = isDone;

      if (value) {
        buffer += this.decoder.decode(value, { stream: true });

        // 줄바꿈 기준으로 분할
        const lines = buffer.split(this.DELEMITER);
        
        // 마지막 줄은 불완전할 수 있으므로 버퍼에 보관
        buffer = lines.pop() || '';

        for (const line of lines) {
          yield {
            type: 'text',
            data: line
          };
        }
      }
    }

    // 남아있는 버퍼 처리
    if (buffer) {
      yield {
        type: 'text',
        data: buffer 
      };
    }
  }
}
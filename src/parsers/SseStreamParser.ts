import type { SseStreamResponse, StreamParser } from '../types';

/**
 * SSE(Server-Sent Events) 스트림 파서 클래스입니다.
 */
export class SseStreamParser implements StreamParser<SseStreamResponse> {
  private readonly DELEMITER = /\r?\n\r?\n/;
  private readonly decoder: TextDecoder;

  constructor(decoder: TextDecoder = new TextDecoder('utf-8')) {
    this.decoder = decoder;
  }

  /**
   * SSE 스트림을 파싱하는 비동기 제너레이터입니다.
   */
  public async *parse(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncGenerator<SseStreamResponse> {
    let done = false;
    let buffer = '';

    while (!done) {
      const { value, done: isDone } = await reader.read();
      done = isDone;

      if (value) {
        buffer += this.decoder.decode(value, { stream: true });

        // 빈 줄(\r\n\r\n) 기준으로 분할
        const blocks = buffer.split(this.DELEMITER);
        
        // 마지막 블록은 불완전할 수 있으므로 버퍼에 보관
        if (blocks.length > 1) {
          for (let i = 0; i < blocks.length - 1; i++) {
            const event = this.parseBlock(blocks[i].trim());
            if (event) {
              yield event;
            }
          }
          buffer = blocks[blocks.length - 1];
        }
      }
    }

    // 남아있는 버퍼 처리
    if (buffer) {
      const event = this.parseBlock(buffer.trim());
      if (event) {
        yield event;
      }
    }
  }

  /**
   * 단일 SSE 이벤트 블록을 파싱합니다.
   */
  private parseBlock(data: string): SseStreamResponse | undefined {
    if (!data) return undefined;
    
    const lines = data.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return undefined;
    
    const event: SseStreamResponse = { 
      type: 'sse',
      event: 'message', 
      data: '' 
    };

    for (const line of lines) {
      const divider = line.indexOf(':');
      if (divider === -1) continue;

      const key = line.slice(0, divider).trim();
      const value = line.slice(divider + 1).trim();

      if (key === 'event') {
        event.event = value;
      } else if (key === 'data') {
        event.data = event.data ? `${event.data}\n${value}` : value;
      } else if (key === 'id') {
        event.id = value;
      } else if (key === 'retry') {
        const retryMs = parseInt(value, 10);
        if (!isNaN(retryMs)) {
          event.retry = retryMs;
        }
      }
    }

    return event.data ? event : undefined;
  }
}
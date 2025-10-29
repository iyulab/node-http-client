import type { JsonStreamResponse, StreamParser } from '../types';

/**
 * JSON 스트림 파서 클래스입니다.
 * JSON 객체가 완전히 완성될때까지 버퍼링하여 파싱합니다.
 */
export class JsonStreamParser implements StreamParser<JsonStreamResponse> {
  private readonly decoder: TextDecoder;

  constructor(decoder: TextDecoder = new TextDecoder('utf-8')) {
    this.decoder = decoder;
  }

  /**
   * JSON 스트림을 파싱하는 비동기 제너레이터입니다.
   */
  public async *parse(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncGenerator<JsonStreamResponse> {
    let done = false;
    let buffer = '';

    while (!done) {
      const { value, done: isDone } = await reader.read();
      done = isDone;

      if (value) {
        buffer += this.decoder.decode(value, { stream: true });

        // 완전한 JSON 객체들을 추출
        const { objects, remaining } = this.extractJsonObjects(buffer);
        buffer = remaining;

        // 각 완전한 JSON 객체를 파싱하여 yield
        for (const jsonStr of objects) {
          yield {
            type: 'json',
            data: jsonStr
          };
        }
      }
    }

    // 남아있는 버퍼 처리 (스트림이 끝났지만 완전하지 않은 JSON이 있을 경우)
    if (buffer.trim()) {
      try {
        const jsonStr = buffer.trim();
        JSON.parse(jsonStr);
        yield {
          type: 'json',
          data: jsonStr
        };
      } catch(error) {
        console.warn('Failed to parse remaining JSON:', buffer, error);
      }
    }
  }

  /**
   * 문자열에서 완전한 JSON 객체를 찾아 반환합니다.
   * @param text 파싱할 텍스트
   * @returns 완전한 JSON 객체들의 배열과 남은 텍스트
   */
  private extractJsonObjects(text: string): { objects: string[], remaining: string } {
    const objects: string[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let escaped = false;
    let i = 0;

    while (i < text.length) {
      const char = text[i];

      // JSON 객체나 배열이 시작되지 않았다면 시작 문자를 찾을 때까지 스킵
      if (depth < 1) {
        // 시작 문자를 찾음
        if ((char === '{' || char === '[') && !inString) {
          current += char;
          depth = 1;
        }
        // 문자열 내부 상태 토글
        if (char === '"' && i > 0 && text[i - 1] !== '\\') {
          inString = !inString;
        }

        i++;
        continue;
      }

      // Json이 시작되었다면 문자를 추가
      current += char;

      if (escaped) {
        escaped = false;
        i++;
        continue;
      }

      if (char === '\\' && inString) {
        escaped = true;
        i++;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        i++;
        continue;
      }

      if (!inString) {
        if (char === '{' || char === '[') {
          depth++;
        } else if (char === '}' || char === ']') {
          depth--;
        }
      }

      // 완전한 JSON 객체/배열이 완성됨
      if (depth === 0) {
        const jsonStr = current.trim();
        // 유효한 JSON인지 검증 후 추가
        try {
          JSON.parse(jsonStr);
          objects.push(jsonStr);
        } catch(error) {
          console.warn("failed to parse jsonString in http stream parser", error);
        }
        current = '';
      }

      i++;
    }

    // 완성된 JsonStr 및 남은 텍스트 반환
    return {
      objects,
      remaining: current
    };
  }
}
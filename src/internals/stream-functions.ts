import { StreamFormat, StreamOptions } from "../types";
import { JsonStreamParser, SseStreamParser, TextStreamParser } from "../parsers";

/**
 * 응답 헤더를 기반으로 자동으로 형식을 감지합니다.
 */
export function guessStreamFormat(headers: Headers): StreamFormat {
  const contentType = headers.get('content-type')?.toLowerCase() || '';
  
  if (contentType.includes('text/event-stream')) {
    return 'sse';
  } else if (contentType.includes('application/json') || contentType.includes('application/x-ndjson')) {
    return 'json';
  } else if (contentType.includes('text/')) {
    return 'text';
  } else {
    return 'text';
  }
}

/**
 * 지정된 형식에 따라 파서를 생성합니다.
 */
export function createStreamParser({ format, decoder }: StreamOptions) {
  switch (format) {
    case 'sse':
      return new SseStreamParser(decoder);
    case 'json':
      return new JsonStreamParser(decoder);
    case 'text':
      return new TextStreamParser(decoder);
    default:
      throw new Error(`Unsupported stream format: ${format}`);
  }
}
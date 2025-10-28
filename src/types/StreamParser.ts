import { StreamResponse } from "./StreamResponse";

/** 스트림 형식을 나타내는 타입입니다. */
export type StreamFormat = 'json' | 'text' | 'sse' | 'auto';

/** 스트림 파서 옵션을 나타내는 객체입니다. */
export interface StreamOptions {
  /** 
   * 스트림 형식입니다. 'auto'로 설정하면 응답 헤더를 기반으로 형식을 감지합니다. 
   */
  format: StreamFormat;

  /**
   * 텍스트 디코더입니다. 기본값은 UTF-8 디코더입니다. 
   */
  decoder?: TextDecoder;
}

/** 스트림 파서를 나타내는 인터페이스입니다.*/
export interface StreamParser<T extends StreamResponse> {
  /**
   * 스트림을 파싱하는 비동기 제너레이터입니다.
   */
  parse(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncGenerator<T>;
}
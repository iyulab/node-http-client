import { describe, it, expect } from 'vitest';
import { SseStreamParser } from '../../src/parsers/SseStreamParser';
import { createMockReader, collect } from '../helpers';

describe('SseStreamParser', () => {
  const parser = new SseStreamParser();

  it('기본 SSE 이벤트를 파싱한다', async () => {
    const reader = createMockReader(['data: hello\n\n']);
    const results = await collect(parser.parse(reader));

    expect(results).toEqual([{
      type: 'sse',
      event: 'message',
      data: 'hello',
    }]);
  });

  it('named 이벤트를 파싱한다', async () => {
    const reader = createMockReader(['event: update\ndata: payload\n\n']);
    const results = await collect(parser.parse(reader));

    expect(results[0].event).toBe('update');
    expect(results[0].data).toBe('payload');
  });

  it('여러 이벤트를 순서대로 파싱한다', async () => {
    const reader = createMockReader([
      'data: first\n\ndata: second\n\n'
    ]);
    const results = await collect(parser.parse(reader));

    expect(results).toHaveLength(2);
    expect(results[0].data).toBe('first');
    expect(results[1].data).toBe('second');
  });

  it('여러 청크에 걸친 이벤트를 버퍼링한다', async () => {
    const reader = createMockReader([
      'data: hel',
      'lo\n\n',
    ]);
    const results = await collect(parser.parse(reader));

    expect(results).toHaveLength(1);
    expect(results[0].data).toBe('hello');
  });

  it('multi-line data를 \\n으로 결합한다', async () => {
    const reader = createMockReader([
      'data: line1\ndata: line2\ndata: line3\n\n'
    ]);
    const results = await collect(parser.parse(reader));

    expect(results[0].data).toBe('line1\nline2\nline3');
  });

  it('id 필드를 파싱한다', async () => {
    const reader = createMockReader(['id: 42\ndata: test\n\n']);
    const results = await collect(parser.parse(reader));

    expect(results[0].id).toBe('42');
  });

  it('retry 필드를 숫자로 파싱한다', async () => {
    const reader = createMockReader(['retry: 3000\ndata: test\n\n']);
    const results = await collect(parser.parse(reader));

    expect(results[0].retry).toBe(3000);
  });

  it('유효하지 않은 retry 값은 무시한다', async () => {
    const reader = createMockReader(['retry: abc\ndata: test\n\n']);
    const results = await collect(parser.parse(reader));

    expect(results[0].retry).toBeUndefined();
  });

  // SSE 스펙 준수 테스트
  it('주석 라인(: 시작)을 무시한다', async () => {
    const reader = createMockReader([
      ': this is a comment\ndata: actual\n\n'
    ]);
    const results = await collect(parser.parse(reader));

    expect(results).toHaveLength(1);
    expect(results[0].data).toBe('actual');
  });

  it('콜론 뒤 첫 공백만 제거한다 (스펙 준수)', async () => {
    const reader = createMockReader(['data:  two spaces\n\n']);
    const results = await collect(parser.parse(reader));

    // "data:" 뒤 " two spaces" → 첫 공백 제거 → "two spaces" (X)
    // 실제: "data:" 뒤 "  two spaces" → 첫 공백 제거 → " two spaces"
    expect(results[0].data).toBe(' two spaces');
  });

  it('콜론 뒤 공백이 없으면 값 그대로 사용한다', async () => {
    const reader = createMockReader(['data:nospace\n\n']);
    const results = await collect(parser.parse(reader));

    expect(results[0].data).toBe('nospace');
  });

  it('콜론 없는 라인은 빈 값의 필드로 처리한다', async () => {
    // "event" (콜론 없음) → key="event", value="" → event 필드가 빈 문자열로 설정
    // data가 있어야 이벤트가 출력되므로 data 필드도 함께 전송
    const reader = createMockReader(['event\ndata: test\n\n']);
    const results = await collect(parser.parse(reader));

    expect(results).toHaveLength(1);
    expect(results[0].event).toBe(''); // 콜론 없는 event → 빈 값
    expect(results[0].data).toBe('test');
  });

  it('data가 없는 이벤트도 출력한다 (heartbeat 등)', async () => {
    const reader = createMockReader(['event: ping\n\n']);
    const results = await collect(parser.parse(reader));

    expect(results).toHaveLength(1);
    expect(results[0].event).toBe('ping');
    expect(results[0].data).toBe(''); // 빈 data도 유효한 이벤트
  });

  it('\\r\\n 줄바꿈을 처리한다', async () => {
    const reader = createMockReader(['data: hello\r\n\r\n']);
    const results = await collect(parser.parse(reader));

    expect(results[0].data).toBe('hello');
  });

  it('스트림 끝의 불완전한 이벤트도 처리한다', async () => {
    const reader = createMockReader(['data: final']);
    const results = await collect(parser.parse(reader));

    expect(results).toHaveLength(1);
    expect(results[0].data).toBe('final');
  });
});

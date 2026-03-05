import { describe, it, expect } from 'vitest';
import { TextStreamParser } from '../../src/parsers/TextStreamParser';
import { createMockReader, collect } from '../helpers';

describe('TextStreamParser', () => {
  const parser = new TextStreamParser();

  it('단일 청크에서 여러 줄을 파싱한다', async () => {
    const reader = createMockReader(['line1\nline2\nline3\n']);
    const results = await collect(parser.parse(reader));

    expect(results).toEqual([
      { type: 'text', data: 'line1' },
      { type: 'text', data: 'line2' },
      { type: 'text', data: 'line3' },
    ]);
  });

  it('여러 청크에 걸친 줄을 올바르게 버퍼링한다', async () => {
    const reader = createMockReader(['hel', 'lo\nwor', 'ld\n']);
    const results = await collect(parser.parse(reader));

    expect(results).toEqual([
      { type: 'text', data: 'hello' },
      { type: 'text', data: 'world' },
    ]);
  });

  it('스트림 끝의 불완전한 줄도 출력한다', async () => {
    const reader = createMockReader(['line1\nincomplete']);
    const results = await collect(parser.parse(reader));

    expect(results).toEqual([
      { type: 'text', data: 'line1' },
      { type: 'text', data: 'incomplete' },
    ]);
  });

  it('\\r\\n 줄바꿈을 처리한다', async () => {
    const reader = createMockReader(['line1\r\nline2\r\n']);
    const results = await collect(parser.parse(reader));

    expect(results).toEqual([
      { type: 'text', data: 'line1' },
      { type: 'text', data: 'line2' },
    ]);
  });

  it('빈 스트림에서는 아무것도 출력하지 않는다', async () => {
    const reader = createMockReader([]);
    const results = await collect(parser.parse(reader));
    expect(results).toEqual([]);
  });

  it('빈 줄도 출력한다', async () => {
    const reader = createMockReader(['a\n\nb\n']);
    const results = await collect(parser.parse(reader));

    expect(results).toEqual([
      { type: 'text', data: 'a' },
      { type: 'text', data: '' },
      { type: 'text', data: 'b' },
    ]);
  });
});

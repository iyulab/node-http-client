import { describe, it, expect } from 'vitest';
import { JsonStreamParser } from '../../src/parsers/JsonStreamParser';
import { createMockReader, collect } from '../helpers';

describe('JsonStreamParser', () => {
  const parser = new JsonStreamParser();

  it('단일 JSON 객체를 파싱한다', async () => {
    const reader = createMockReader(['{"name":"test"}']);
    const results = await collect(parser.parse(reader));

    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('json');
    expect(JSON.parse(results[0].data)).toEqual({ name: 'test' });
  });

  it('JSON Lines (줄 구분) 형식을 파싱한다', async () => {
    const reader = createMockReader(['{"a":1}\n{"b":2}\n{"c":3}']);
    const results = await collect(parser.parse(reader));

    expect(results).toHaveLength(3);
    expect(JSON.parse(results[0].data)).toEqual({ a: 1 });
    expect(JSON.parse(results[1].data)).toEqual({ b: 2 });
    expect(JSON.parse(results[2].data)).toEqual({ c: 3 });
  });

  it('여러 청크에 걸친 JSON 객체를 올바르게 버퍼링한다', async () => {
    const reader = createMockReader([
      '{"na',
      'me":"te',
      'st"}',
    ]);
    const results = await collect(parser.parse(reader));

    expect(results).toHaveLength(1);
    expect(JSON.parse(results[0].data)).toEqual({ name: 'test' });
  });

  it('JSON 배열을 파싱한다', async () => {
    const reader = createMockReader(['[1,2,3]']);
    const results = await collect(parser.parse(reader));

    expect(results).toHaveLength(1);
    expect(JSON.parse(results[0].data)).toEqual([1, 2, 3]);
  });

  it('중첩된 JSON 객체를 올바르게 처리한다', async () => {
    const reader = createMockReader(['{"a":{"b":{"c":1}}}']);
    const results = await collect(parser.parse(reader));

    expect(results).toHaveLength(1);
    expect(JSON.parse(results[0].data)).toEqual({ a: { b: { c: 1 } } });
  });

  it('문자열 내부의 중괄호를 무시한다', async () => {
    const reader = createMockReader(['{"text":"hello { world }"}']);
    const results = await collect(parser.parse(reader));

    expect(results).toHaveLength(1);
    expect(JSON.parse(results[0].data)).toEqual({ text: 'hello { world }' });
  });

  it('이스케이프된 따옴표를 올바르게 처리한다', async () => {
    const reader = createMockReader(['{"text":"say \\"hello\\""}']);
    const results = await collect(parser.parse(reader));

    expect(results).toHaveLength(1);
    expect(JSON.parse(results[0].data)).toEqual({ text: 'say "hello"' });
  });

  it('이스케이프된 백슬래시를 올바르게 처리한다', async () => {
    const reader = createMockReader(['{"path":"c:\\\\data\\\\file"}']);
    const results = await collect(parser.parse(reader));

    expect(results).toHaveLength(1);
    expect(JSON.parse(results[0].data)).toEqual({ path: 'c:\\data\\file' });
  });

  it('연속된 JSON 객체 사이의 공백을 무시한다', async () => {
    const reader = createMockReader(['  {"a":1}  {"b":2}  ']);
    const results = await collect(parser.parse(reader));

    expect(results).toHaveLength(2);
    expect(JSON.parse(results[0].data)).toEqual({ a: 1 });
    expect(JSON.parse(results[1].data)).toEqual({ b: 2 });
  });

  it('빈 스트림에서는 아무것도 출력하지 않는다', async () => {
    const reader = createMockReader([]);
    const results = await collect(parser.parse(reader));
    expect(results).toHaveLength(0);
  });

  it('스트림 끝의 완전한 JSON을 처리한다', async () => {
    const reader = createMockReader(['{"a":1}{"b":']);
    const results = await collect(parser.parse(reader));

    // 첫 번째 객체는 완전하므로 파싱, 두 번째는 불완전하므로 경고
    expect(results).toHaveLength(1);
    expect(JSON.parse(results[0].data)).toEqual({ a: 1 });
  });

  it('배열과 객체가 혼합된 스트림을 처리한다', async () => {
    const reader = createMockReader(['{"a":1}[1,2]{"b":2}']);
    const results = await collect(parser.parse(reader));

    expect(results).toHaveLength(3);
    expect(JSON.parse(results[0].data)).toEqual({ a: 1 });
    expect(JSON.parse(results[1].data)).toEqual([1, 2]);
    expect(JSON.parse(results[2].data)).toEqual({ b: 2 });
  });

  it('문자열 내 이스케이프된 백슬래시+따옴표 조합을 처리한다', async () => {
    // {"v":"\\"} → 실제 값: \
    const reader = createMockReader(['{"v":"\\\\"}']);
    const results = await collect(parser.parse(reader));

    expect(results).toHaveLength(1);
    expect(JSON.parse(results[0].data)).toEqual({ v: '\\' });
  });
});

import { describe, it, expect } from 'vitest';
import { JsonStreamParser } from '../src/parsers/JsonStreamParser';

/**
 * JsonStreamParser 테스트
 * 
 * JSON 스트림을 파싱하여 완전한 JSON 객체를 추출하는 파서입니다.
 * - 단일/여러 JSON 객체 파싱
 * - 청크로 나뉜 JSON 처리
 * - 중첩 객체 및 배열 처리
 */

describe('JsonStreamParser', () => {
  // 테스트용 mock reader 생성 헬퍼
  const createReader = (chunks: Uint8Array[]) => {
    let index = 0;
    return {
      read: async () => {
        if (index < chunks.length) {
          return { value: chunks[index++], done: false };
        }
        return { value: undefined, done: true };
      },
    } as ReadableStreamDefaultReader<Uint8Array>;
  };

  // 텍스트를 Uint8Array로 변환
  const encode = (text: string) => new TextEncoder().encode(text);

  describe('기본 JSON 파싱', () => {
    it('단일 JSON 객체 파싱', async () => {
      const parser = new JsonStreamParser();
      const reader = createReader([
        encode('{"id": 1, "name": "Alice"}')
      ]);

      const results = [];
      for await (const item of parser.parse(reader)) {
        results.push(item);
      }

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('json');
      expect(JSON.parse(results[0].data)).toEqual({ 
        id: 1, 
        name: 'Alice' 
      });
    });

    it('여러 JSON 객체 연속 파싱', async () => {
      const parser = new JsonStreamParser();
      const reader = createReader([
        encode('{"id":1}{"id":2}{"id":3}')
      ]);

      const results = [];
      for await (const item of parser.parse(reader)) {
        results.push(item);
      }

      expect(results).toHaveLength(3);
      expect(JSON.parse(results[0].data).id).toBe(1);
      expect(JSON.parse(results[1].data).id).toBe(2);
      expect(JSON.parse(results[2].data).id).toBe(3);
    });

    it('JSON 배열 파싱', async () => {
      const parser = new JsonStreamParser();
      const reader = createReader([
        encode('[1, 2, 3, 4, 5]')
      ]);

      const results = [];
      for await (const item of parser.parse(reader)) {
        results.push(item);
      }

      expect(results).toHaveLength(1);
      expect(JSON.parse(results[0].data)).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('청크 처리', () => {
    it('여러 청크에 나뉜 JSON 파싱', async () => {
      const parser = new JsonStreamParser();
      const reader = createReader([
        encode('{"name"'),
        encode(':"Bob"'),
        encode(',"age":25}')
      ]);

      const results = [];
      for await (const item of parser.parse(reader)) {
        results.push(item);
      }

      expect(results).toHaveLength(1);
      expect(JSON.parse(results[0].data)).toEqual({ 
        name: 'Bob', 
        age: 25 
      });
    });

    it('청크마다 하나씩 JSON 객체', async () => {
      const parser = new JsonStreamParser();
      const reader = createReader([
        encode('{"id":1}'),
        encode('{"id":2}'),
        encode('{"id":3}')
      ]);

      const results = [];
      for await (const item of parser.parse(reader)) {
        results.push(item);
      }

      expect(results).toHaveLength(3);
    });
  });

  describe('복잡한 구조', () => {
    it('중첩된 객체 파싱', async () => {
      const parser = new JsonStreamParser();
      const reader = createReader([
        encode('{"user":{"id":1,"profile":{"name":"Charlie","age":30}}}')
      ]);

      const results = [];
      for await (const item of parser.parse(reader)) {
        results.push(item);
      }

      expect(results).toHaveLength(1);
      const parsed = JSON.parse(results[0].data);
      expect(parsed.user.profile.name).toBe('Charlie');
      expect(parsed.user.profile.age).toBe(30);
    });

    it('배열 안의 객체', async () => {
      const parser = new JsonStreamParser();
      const reader = createReader([
        encode('[{"id":1},{"id":2},{"id":3}]')
      ]);

      const results = [];
      for await (const item of parser.parse(reader)) {
        results.push(item);
      }

      expect(results).toHaveLength(1);
      const parsed = JSON.parse(results[0].data);
      expect(parsed).toHaveLength(3);
      expect(parsed[0].id).toBe(1);
    });

    it('문자열 내 특수문자 처리', async () => {
      const parser = new JsonStreamParser();
      const reader = createReader([
        encode('{"message":"Hello \\"World\\"","emoji":"😀"}')
      ]);

      const results = [];
      for await (const item of parser.parse(reader)) {
        results.push(item);
      }

      expect(results).toHaveLength(1);
      const parsed = JSON.parse(results[0].data);
      expect(parsed.message).toBe('Hello "World"');
      expect(parsed.emoji).toBe('😀');
    });
  });

  describe('실전 시나리오', () => {
    it('LLM 스트리밍 응답 시뮬레이션', async () => {
      const parser = new JsonStreamParser();
      const reader = createReader([
        encode('{"delta":"Hello"}'),
        encode('{"delta":" "}'),
        encode('{"delta":"World"}'),
        encode('{"done":true}')
      ]);

      const results = [];
      for await (const item of parser.parse(reader)) {
        results.push(item);
      }

      expect(results).toHaveLength(4);
      expect(JSON.parse(results[0].data).delta).toBe('Hello');
      expect(JSON.parse(results[1].data).delta).toBe(' ');
      expect(JSON.parse(results[2].data).delta).toBe('World');
      expect(JSON.parse(results[3].data).done).toBe(true);
    });
  });
});


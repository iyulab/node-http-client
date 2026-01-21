import { describe, it, expect } from 'vitest';
import { SseStreamParser } from '../src/parsers/SseStreamParser';

/**
 * SseStreamParser 테스트
 * 
 * SSE(Server-Sent Events) 프로토콜을 파싱합니다.
 * - 단일/다중 이벤트 파싱
 * - 이벤트 타입, ID, retry 필드
 * - 멀티라인 데이터
 * - 청크로 나뉜 스트림
 */

describe('SseStreamParser', () => {
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

  describe('기본 이벤트 파싱', () => {
    it('단순 데이터 이벤트', async () => {
      const parser = new SseStreamParser();
      const reader = createReader([
        encode('data: Hello World\n\n')
      ]);

      const results = [];
      for await (const item of parser.parse(reader)) {
        results.push(item);
      }

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('sse');
      expect(results[0].event).toBe('message');
      expect(results[0].data).toBe('Hello World');
    });

    it('여러 이벤트 연속 파싱', async () => {
      const parser = new SseStreamParser();
      const reader = createReader([
        encode('data: first\n\ndata: second\n\ndata: third\n\n')
      ]);

      const results = [];
      for await (const item of parser.parse(reader)) {
        results.push(item);
      }

      expect(results).toHaveLength(3);
      expect(results[0].data).toBe('first');
      expect(results[1].data).toBe('second');
      expect(results[2].data).toBe('third');
    });
  });

  describe('이벤트 필드', () => {
    it('커스텀 이벤트 타입', async () => {
      const parser = new SseStreamParser();
      const reader = createReader([
        encode('event: update\ndata: content updated\n\n')
      ]);

      const results = [];
      for await (const item of parser.parse(reader)) {
        results.push(item);
      }

      expect(results).toHaveLength(1);
      expect(results[0].event).toBe('update');
      expect(results[0].data).toBe('content updated');
    });

    it('이벤트 ID 포함', async () => {
      const parser = new SseStreamParser();
      const reader = createReader([
        encode('id: 12345\nevent: notification\ndata: New message\n\n')
      ]);

      const results = [];
      for await (const item of parser.parse(reader)) {
        results.push(item);
      }

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('12345');
      expect(results[0].event).toBe('notification');
      expect(results[0].data).toBe('New message');
    });

    it('retry 필드 파싱', async () => {
      const parser = new SseStreamParser();
      const reader = createReader([
        encode('retry: 5000\ndata: reconnect info\n\n')
      ]);

      const results = [];
      for await (const item of parser.parse(reader)) {
        results.push(item);
      }

      expect(results).toHaveLength(1);
      expect(results[0].retry).toBe(5000);
      expect(results[0].data).toBe('reconnect info');
    });

    it('모든 필드 조합', async () => {
      const parser = new SseStreamParser();
      const reader = createReader([
        encode('id: msg-001\nevent: chat\ndata: Hello!\nretry: 3000\n\n')
      ]);

      const results = [];
      for await (const item of parser.parse(reader)) {
        results.push(item);
      }

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('msg-001');
      expect(results[0].event).toBe('chat');
      expect(results[0].data).toBe('Hello!');
      expect(results[0].retry).toBe(3000);
    });
  });

  describe('멀티라인 데이터', () => {
    it('여러 줄 데이터 병합', async () => {
      const parser = new SseStreamParser();
      const reader = createReader([
        encode('data: Line 1\ndata: Line 2\ndata: Line 3\n\n')
      ]);

      const results = [];
      for await (const item of parser.parse(reader)) {
        results.push(item);
      }

      expect(results).toHaveLength(1);
      expect(results[0].data).toBe('Line 1\nLine 2\nLine 3');
    });

    it('JSON 데이터 여러 줄', async () => {
      const parser = new SseStreamParser();
      const reader = createReader([
        encode('data: {\n'),
        encode('data:   "name": "Alice",\n'),
        encode('data:   "age": 30\n'),
        encode('data: }\n\n')
      ]);

      const results = [];
      for await (const item of parser.parse(reader)) {
        results.push(item);
      }

      expect(results).toHaveLength(1);
      const jsonData = results[0].data;
      expect(jsonData).toContain('"name": "Alice"');
      expect(jsonData).toContain('"age": 30');
    });
  });

  describe('청크 처리', () => {
    it('이벤트가 여러 청크에 분산', async () => {
      const parser = new SseStreamParser();
      const reader = createReader([
        encode('data: Hel'),
        encode('lo Wor'),
        encode('ld\n\n')
      ]);

      const results = [];
      for await (const item of parser.parse(reader)) {
        results.push(item);
      }

      expect(results).toHaveLength(1);
      expect(results[0].data).toBe('Hello World');
    });

    it('청크마다 완전한 이벤트', async () => {
      const parser = new SseStreamParser();
      const reader = createReader([
        encode('data: first\n\n'),
        encode('data: second\n\n'),
        encode('data: third\n\n')
      ]);

      const results = [];
      for await (const item of parser.parse(reader)) {
        results.push(item);
      }

      expect(results).toHaveLength(3);
    });
  });

  describe('실전 시나리오', () => {
    it('채팅 메시지 스트리밍', async () => {
      const parser = new SseStreamParser();
      const reader = createReader([
        encode('id: 1\nevent: message\ndata: {"user":"Alice","text":"Hi!"}\n\n'),
        encode('id: 2\nevent: message\ndata: {"user":"Bob","text":"Hello!"}\n\n'),
        encode('id: 3\nevent: typing\ndata: {"user":"Alice"}\n\n')
      ]);

      const results = [];
      for await (const item of parser.parse(reader)) {
        results.push(item);
      }

      expect(results).toHaveLength(3);
      expect(results[0].event).toBe('message');
      expect(results[1].event).toBe('message');
      expect(results[2].event).toBe('typing');
    });

    it('진행률 업데이트 스트림', async () => {
      const parser = new SseStreamParser();
      const reader = createReader([
        encode('event: progress\ndata: 25\n\n'),
        encode('event: progress\ndata: 50\n\n'),
        encode('event: progress\ndata: 75\n\n'),
        encode('event: progress\ndata: 100\n\n'),
        encode('event: complete\ndata: success\n\n')
      ]);

      const results = [];
      for await (const item of parser.parse(reader)) {
        results.push(item);
      }

      expect(results).toHaveLength(5);
      expect(results[0].data).toBe('25');
      expect(results[3].data).toBe('100');
      expect(results[4].event).toBe('complete');
    });
  });
});


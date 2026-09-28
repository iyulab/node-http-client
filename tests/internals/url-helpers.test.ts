import { describe, it, expect } from 'vitest';
import { buildUrl, parseUrl } from '../../src/internals/url-helpers';

describe('buildUrl', () => {
  it('baseUrl만으로 URL을 생성한다', () => {
    const url = buildUrl({ baseUrl: 'https://api.example.com' });
    expect(url.toString()).toBe('https://api.example.com/');
  });

  it('baseUrl이 없으면 에러를 던진다', () => {
    expect(() => buildUrl({})).toThrow('Base URL is required');
  });

  // 슬래시 조합 테스트
  it('baseUrl(/) + path(/) 조합을 올바르게 처리한다', () => {
    const url = buildUrl({ baseUrl: 'https://api.com/', path: '/users' });
    expect(url.pathname).toBe('/users');
  });

  it('baseUrl(/) + path(no /) 조합을 올바르게 처리한다', () => {
    const url = buildUrl({ baseUrl: 'https://api.com/', path: 'users' });
    expect(url.pathname).toBe('/users');
  });

  it('baseUrl(no /) + path(/) 조합을 올바르게 처리한다', () => {
    const url = buildUrl({ baseUrl: 'https://api.com', path: '/users' });
    expect(url.pathname).toBe('/users');
  });

  it('baseUrl(no /) + path(no /) 조합을 올바르게 처리한다', () => {
    const url = buildUrl({ baseUrl: 'https://api.com', path: 'users' });
    expect(url.pathname).toBe('/users');
  });

  it('중첩 경로를 올바르게 처리한다', () => {
    const url = buildUrl({ baseUrl: 'https://api.com/v1', path: '/users/123' });
    expect(url.pathname).toBe('/v1/users/123');
  });

  // 쿼리 파라미터
  it('단일 쿼리 파라미터를 추가한다', () => {
    const url = buildUrl({
      baseUrl: 'https://api.com',
      query: { page: '1' }
    });
    expect(url.searchParams.get('page')).toBe('1');
  });

  it('배열 쿼리 파라미터를 추가한다', () => {
    const url = buildUrl({
      baseUrl: 'https://api.com',
      query: { tag: ['a', 'b'] }
    });
    expect(url.searchParams.getAll('tag')).toEqual(['a', 'b']);
  });

  it('null/undefined 쿼리 값은 무시한다', () => {
    const url = buildUrl({
      baseUrl: 'https://api.com',
      query: { a: '1', b: null as any, c: undefined as any }
    });
    expect(url.searchParams.has('a')).toBe(true);
    expect(url.searchParams.has('b')).toBe(false);
    expect(url.searchParams.has('c')).toBe(false);
  });

  // 상대 경로 baseUrl 테스트
  describe('상대 경로 baseUrl', () => {
    const mockOrigin = 'http://localhost:3000';

    function withLocation(origin: string, fn: () => void) {
      const original = globalThis.location;
      globalThis.location = { origin } as Location;
      try { fn(); } finally { globalThis.location = original; }
    }

    it('상대 경로 baseUrl로 URL을 생성한다', () => {
      withLocation(mockOrigin, () => {
        const url = buildUrl({ baseUrl: '/api' });
        expect(url.toString()).toBe('http://localhost:3000/api');
      });
    });

    it('상대 경로 baseUrl + path 조합을 처리한다', () => {
      withLocation(mockOrigin, () => {
        const url = buildUrl({ baseUrl: '/api', path: '/messages' });
        expect(url.toString()).toBe('http://localhost:3000/api/messages');
      });
    });

    it('상대 경로 baseUrl + path + query 조합을 처리한다', () => {
      withLocation(mockOrigin, () => {
        const url = buildUrl({ baseUrl: '/api', path: '/users', query: { page: '1' } });
        expect(url.toString()).toBe('http://localhost:3000/api/users?page=1');
      });
    });

    it('location이 없는 환경에서 상대 경로를 사용하면 에러를 던진다', () => {
      const original = globalThis.location;
      // @ts-ignore
      delete globalThis.location;
      try {
        expect(() => buildUrl({ baseUrl: '/api' })).toThrow('Relative base URL requires a browser environment');
      } finally {
        globalThis.location = original;
      }
    });
  });
});

describe('parseUrl', () => {
  // 절대 URL
  it('절대 URL을 origin과 path로 분리한다', () => {
    const result = parseUrl('https://api.example.com/users');
    expect(result.baseUrl).toBe('https://api.example.com');
    expect(result.path).toBe('/users');
    expect(result.query).toBeUndefined();
  });

  it('절대 URL에서 쿼리 파라미터를 분리한다', () => {
    const result = parseUrl('https://api.com/users?page=1&sort=name');
    expect(result.baseUrl).toBe('https://api.com');
    expect(result.path).toBe('/users');
    expect(result.query).toEqual({ page: '1', sort: 'name' });
  });

  it('절대 URL에서 중복 쿼리 파라미터를 배열로 처리한다', () => {
    const result = parseUrl('https://api.com/search?tag=a&tag=b&tag=c');
    expect(result.baseUrl).toBe('https://api.com');
    expect(result.path).toBe('/search');
    expect(result.query).toEqual({ tag: ['a', 'b', 'c'] });
  });

  it('절대 URL이 루트 경로(/)만 가진 경우', () => {
    const result = parseUrl('https://api.com/');
    expect(result.baseUrl).toBe('https://api.com');
    expect(result.path).toBeUndefined();
    expect(result.query).toBeUndefined();
  });

  it('절대 URL이 루트 경로 없이 origin만 있는 경우', () => {
    const result = parseUrl('https://api.com');
    expect(result.baseUrl).toBe('https://api.com');
    expect(result.path).toBeUndefined();
    expect(result.query).toBeUndefined();
  });

  // 상대 URL
  it('상대 경로를 defaultUrl과 함께 파싱한다', () => {
    const result = parseUrl('/users', 'https://api.com');
    expect(result.baseUrl).toBe('https://api.com');
    expect(result.path).toBe('/users');
  });

  it('상대 경로에서 쿼리 문자열을 분리한다', () => {
    const result = parseUrl('/users?page=1&limit=10', 'https://api.com');
    expect(result.baseUrl).toBe('https://api.com');
    expect(result.path).toBe('/users');
    expect(result.query).toEqual({ page: '1', limit: '10' });
  });

  it('상대 URL에 defaultUrl이 없으면 에러를 던진다', () => {
    expect(() => parseUrl('/users')).toThrow('Base URL is required');
  });

  it('상대 경로의 중복 쿼리 파라미터를 배열로 처리한다', () => {
    const result = parseUrl('/search?tag=a&tag=b', 'https://api.com');
    expect(result.query).toEqual({ tag: ['a', 'b'] });
  });
});

describe('쿼리 원문 보존', () => {
  it('parseUrl 은 원문을 rawQuery 로 함께 돌려준다 — 첫 ? 에서만 자른다', () => {
    const r = parseUrl('/items?next=a?b&$top=5', 'https://api.com');
    expect(r.rawQuery).toBe('next=a?b&$top=5');
    expect(r.query).toEqual({ next: 'a?b', $top: '5' });
  });

  it('buildUrl 은 query 가 원문과 같으면 원문을 그대로 쓴다', () => {
    const { baseUrl, path, query, rawQuery } = parseUrl('/items?$skiptoken=x+y&$filter=a%20b', 'https://api.com');
    expect(buildUrl({ baseUrl, path, query, rawQuery }).search).toBe('?$skiptoken=x+y&$filter=a%20b');
  });

  it('buildUrl 은 query 가 원문과 다르면 query 로 다시 만든다', () => {
    const { baseUrl, path, query, rawQuery } = parseUrl('/items?$top=5', 'https://api.com');
    const url = buildUrl({ baseUrl, path, query: { ...query, page: '2' }, rawQuery });
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('$top')).toBe('5');
  });

  it('이름 순서만 다른 query 는 같은 것으로 본다', () => {
    const url = buildUrl({ baseUrl: 'https://api.com', query: { b: '2', a: '1' }, rawQuery: 'a=1&b=2' });
    expect(url.search).toBe('?a=1&b=2');
  });
});

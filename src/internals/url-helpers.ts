/**
 * URL 요소들을 나타내는 인터페이스입니다.
 */
export interface UrlParts {
  baseUrl?: string;
  path?: string;
  query?: Record<string, string | string[]>;
}

/**
 * 요청에 사용할 최종 URL을 생성합니다.
 *
 * @param baseUrl 기본 URL
 * @param path 추가 경로
 * @param query 쿼리 파라미터
 * @returns 완성된 URL 객체
 */
export function buildUrl({ baseUrl, path, query }: UrlParts): URL {
  // 1. base URL이 없으면 오류를 발생시킵니다.
  if (!baseUrl) {
    throw new Error("Base URL is required for building the request URL.");
  }

  // 2. URL을 생성합니다.
  const fullPath = !path
    ? baseUrl
    : baseUrl.replace(/\/$/, '') + '/' + path.replace(/^\//, '');

  // 상대 경로인 경우 현재 origin을 기준으로 URL을 생성합니다.
  const isAbsolute = /^https?:\/\//.test(fullPath);
  if (!isAbsolute && !globalThis.location?.origin) {
    throw new Error(
      "Relative base URL requires a browser environment. " +
      "Use an absolute URL (e.g., 'http://localhost:3000/api') in SSR or Node.js."
    );
  }
  const url = isAbsolute
    ? new URL(fullPath)
    : new URL(fullPath, globalThis.location.origin);

  // 3. 쿼리 파라미터를 추가합니다.
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        (Array.isArray(value) ? value : [value]).forEach(val =>
          url.searchParams.append(key, val)
        );
      }
    });
  }

  return url;
}

/**
 * 주어진 URL 문자열을 baseUrl, path, query로 분해합니다.
 *
 * @param url 전체 URL 또는 상대 경로 URL
 * @param baseUrl 상대 경로일 때 사용할 기본 URL
 * @returns URL 구성 요소
 */
export function parseUrl(url: string, baseUrl?: string): UrlParts {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    // 절대 URL에서 origin, path, query 분리
    const parsed = new URL(url);
    const query: Record<string, string | string[]> = {};
    parsed.searchParams.forEach((value, key) => {
      if (query[key]) {
        if (Array.isArray(query[key])) {
          (query[key] as string[]).push(value);
        } else {
          query[key] = [query[key] as string, value];
        }
      } else {
        query[key] = value;
      }
    });
    
    const result: UrlParts = { baseUrl: parsed.origin };
    
    // pathname이 '/'가 아니면 path로 추가
    if (parsed.pathname && parsed.pathname !== '/') {
      result.path = parsed.pathname;
    }
    
    // query가 있으면 추가
    if (Object.keys(query).length > 0) {
      result.query = query;
    }
    
    return result;
  } else {
    if (!baseUrl) {
      throw new Error("Base URL is required for relative URLs.");
    }

    // 경로와 쿼리 문자열 분리
    const [path, queryString] = url.split("?", 2);
    const query: Record<string, string | string[]> = {};

    // 쿼리 문자열 파싱
    if (queryString) {
      new URLSearchParams(queryString).forEach((value, key) => {
        if (query[key]) {
          if (Array.isArray(query[key])) {
            (query[key] as string[]).push(value);
          } else {
            query[key] = [query[key] as string, value];
          }
        } else {
          query[key] = value;
        }
      });
    }

    return { baseUrl: baseUrl, path: path, query: query };
  }
}
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
  const url = !path 
    ? new URL(baseUrl)
    : new URL(baseUrl.endsWith('/') && path.startsWith('/')
      ? baseUrl + path.slice(1)
      : baseUrl + path);

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
 * @param defaultUrl 상대 경로일 때 사용할 기본 URL
 * @returns URL 구성 요소
 */
export function parseUrl(url: string, defaultUrl?: string): UrlParts {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return { baseUrl: url };
  } else {
    if (!defaultUrl) {
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

    return { baseUrl: defaultUrl, path: path, query: query };
  }
}
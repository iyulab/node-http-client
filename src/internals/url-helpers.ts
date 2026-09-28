/**
 * URL 요소들을 나타내는 인터페이스입니다.
 */
export interface UrlParts {
  baseUrl?: string;
  path?: string;
  query?: Record<string, string | string[]>;
  /**
   * 호출자가 URL 문자열에 담아 준 쿼리의 원문(`?` 제외). `parseUrl` 만 채운다.
   * `query` 와 같은 내용일 때 `buildUrl` 은 이것을 그대로 쓴다 — 서버가 준 링크(OData `nextLink` 등)를
   * 다시 인코딩하지 않기 위해서다.
   */
  rawQuery?: string;
}

/** 쿼리 문자열을 파싱한다 — 같은 이름이 여러 번 오면 배열로 모은다. */
function parseQueryString(queryString: string): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  new URLSearchParams(queryString).forEach((value, key) => {
    const prev = query[key];
    if (prev === undefined) query[key] = value;
    else if (Array.isArray(prev)) prev.push(value);
    else query[key] = [prev, value];
  });
  return query;
}

/** 두 쿼리가 같은 파라미터를 같은 값으로 갖는가(이름 순서는 무관, 같은 이름의 값 순서는 유관). */
function sameQuery(a: Record<string, string | string[]>, b: Record<string, string | string[]>): boolean {
  const norm = (q: Record<string, string | string[]>) =>
    Object.entries(q)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => [k, Array.isArray(v) ? v.map(String) : [String(v)]] as const)
      .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

/**
 * 요청에 사용할 최종 URL을 생성합니다.
 *
 * 쿼리는 두 가지로 들어온다: 호출자가 URL 문자열에 담아 준 원문(`rawQuery`)과 파라미터 객체(`query`).
 * `query` 가 원문을 파싱한 것과 **같으면** 원문을 그대로 쓴다(폼 인코딩으로 다시 쓰지 않는다 —
 * `$` → `%24`, 공백 → `+` 가 일어나지 않는다). 요청 인터셉터 등이 `query` 를 바꿨으면 원문은 더 이상
 * 요청을 대표하지 않으므로 `query` 로 다시 만든다.
 *
 * @param parts baseUrl · path · query · rawQuery
 * @returns 완성된 URL 객체
 */
export function buildUrl({ baseUrl, path, query, rawQuery }: UrlParts): URL {
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

  // 3. 쿼리 — 원문이 여전히 요청을 대표하면 원문 그대로(URL 이 필요한 최소 인코딩만 한다).
  if (rawQuery && sameQuery(parseQueryString(rawQuery), query ?? {})) {
    url.search = rawQuery;
    return url;
  }
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
 * 주어진 URL 문자열을 baseUrl, path, query로 분해합니다. 쿼리 원문은 `rawQuery` 로 함께 돌려준다.
 *
 * @param url 전체 URL 또는 상대 경로 URL
 * @param baseUrl 상대 경로일 때 사용할 기본 URL
 * @returns URL 구성 요소
 */
export function parseUrl(url: string, baseUrl?: string): UrlParts {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    // 절대 URL에서 origin, path, query 분리
    const parsed = new URL(url);
    const result: UrlParts = { baseUrl: parsed.origin };

    // pathname이 '/'가 아니면 path로 추가
    if (parsed.pathname && parsed.pathname !== '/') {
      result.path = parsed.pathname;
    }

    // query가 있으면 추가
    const rawQuery = parsed.search.slice(1);
    if (rawQuery) {
      result.query = parseQueryString(rawQuery);
      result.rawQuery = rawQuery;
    }

    return result;
  } else {
    if (!baseUrl) {
      throw new Error("Base URL is required for relative URLs.");
    }

    // 경로와 쿼리 문자열 분리 — 첫 `?` 에서만 자른다(쿼리 값 안의 `?` 는 쿼리의 일부다).
    const at = url.indexOf("?");
    const path = at < 0 ? url : url.slice(0, at);
    const rawQuery = at < 0 ? "" : url.slice(at + 1);

    const result: UrlParts = { baseUrl: baseUrl, path: path, query: rawQuery ? parseQueryString(rawQuery) : {} };
    if (rawQuery) result.rawQuery = rawQuery;
    return result;
  }
}

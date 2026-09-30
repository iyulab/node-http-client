# Changelog

## [Unreleased]

### Removed

- **Breaking: the `onRequest` / `onResponse` / `onError` options of `HttpClientConfig` are removed**, together
  with their info types `RequestHookInfo`, `ResponseHookInfo` and `ErrorHookInfo`. They were deprecated in
  0.10.0 and 0.12.1 named this release. Use `client.interceptors` — the README has a one-line mapping
  for each hook. A config that still passes them is now a type error; at run time the options are
  ignored.

## [0.12.1] - 2026-09-30

### Deprecated
- **`onRequest` / `onResponse` / `onError` will be removed in 0.13.0.** The deprecation warning used to say
  "a future major version"; below 1.0 a minor release is where breaking changes land, so it now names
  the release. Move to `client.interceptors` (see the README). The info types `RequestHookInfo`,
  `ResponseHookInfo`, and `ErrorHookInfo` go with them.

## [0.12.0] - 2026-09-30

### Added
- **`IncompleteResponseError`** — reading the body (`json()`, `text()`, `arrayBuffer()`, `bytes()`,
  `blob()`, `stream()`) ends with this error when the connection closes after the headers and before
  the body is complete. It extends `TypeError`, so code that caught the runtime's `TypeError` keeps
  working, and the original error is its `cause`. Runtimes report this case with different messages —
  Node says `terminated`, Chromium says `network error` for a stream and `Failed to fetch` for
  `text()`, the same message as a refused connection — so a caller could not tell a dropped response
  from a failed request. Cancellation and timeouts stay `CanceledError`; parse errors, reading a body
  twice and `formData()` failures are passed through unchanged.

## [0.11.0] - 2026-09-30

### Changed
- **`timeout` now covers reading the body, not only waiting for the response headers.** The timer
  stopped as soon as the headers arrived, so a response whose body or event stream stalled never
  ended. `json()`, `text()`, `blob()`, `arrayBuffer()`, `bytes()`, `formData()` and `stream()` now end
  with `CanceledError` when the time runs out. If you use `timeout` together with long-running streams,
  switch those requests to `idleTimeout` (below) or raise their `timeout`.

### Added
- **`stream({ idleTimeout })`** — ends the stream with `CanceledError` when no chunk arrives within the
  given milliseconds. A stream that keeps flowing is never cut, however long it runs.

### Fixed
- A timeout no longer cancels the `CancelToken` you passed. The token was cancelled on timeout, so
  reusing it for the next request failed immediately.

## [0.10.3] - 2026-09-28

### Fixed
- **A query string in the request URL is sent as written.** The client decoded the query and
  re-encoded it with form rules, so `get('/items?$filter=a%20b')` went out as
  `?%24filter=a+b`. A link the server issued — an OData `@odata.nextLink`, for example — is now followed
  byte for byte. The query is still parsed into `config.query` for request interceptors; if an
  interceptor changes those parameters, the query is rebuilt from them as before.

### Documentation
- The automatic `Content-Type` table now lists `number`/`boolean` bodies (`text/plain`) and
  `URLSearchParams` (`application/x-www-form-urlencoded`), which the client already set.

## [0.10.2] - 2026-09-02

### Fixed
- **`ResponseHookInfo`'s type reference (skill docs) was missing the `response` field.** The
  main `HttpClientConfig` table already correctly described `onResponse`'s `res.response` body
  access, but the separate "Lifecycle Hook Types" TypeScript snippet for the same interface had
  dropped that field — an internal inconsistency within the same doc. No code change.

## [0.10.1] - 2026-08-28

### Changed
- `onRequest` / `onResponse` / `onError` now log a one-time `console.warn` (per hook, per process) the first time they actually fire, pointing to the `interceptors` replacement. No behavior change — the hooks keep working exactly as before. This is usage telemetry ahead of a future removal, not a functional change.

## [0.10.0] - 2026-07-15

### Added
- `client.interceptors.request` / `client.interceptors.response` — Axios-style interceptor chains with `use()`/`eject()` for runtime add/remove.
  - Request interceptors run *before* the URL is built, so mutating `path`/`query`/`baseUrl` (not just `headers`) is reflected in the final request — fixes a limitation `onRequest` always had.
  - Response interceptors' resolved handler receives `(response, config)`, enabling status-code-based retry (e.g. refresh token on 401, then `client.send(config)`) — something `onResponse` couldn't express.
  - Response interceptors' rejected handler receives `(error, config)` for fetch-level failures (network errors, timeouts) — mirrors the resolved handler's `(response, config)` shape; returning a value recovers the pipeline instead of rejecting. Failures caused by a `CancelToken` are normalized to `CanceledError` *before* reaching the handler, so it can tell "the caller cancelled this" apart from a genuine network failure and decide whether to retry — the interceptor is trusted to make that call, nothing is forced.
  - `interceptors.request` also applies to `upload()` (headers/`path`/`query`/`baseUrl`), not just `send()`.
  - `interceptors.response` applies to `upload()` too: the resolved handler runs on `xhr.onload` (any status — same reasoning as `fetch()` not rejecting on 4xx/5xx), the rejected handler runs on network-level failure (`onerror`/`ontimeout`/`onabort`, same semantics as `send()`'s catch) — `onabort` seeds the chain with a `CanceledError` since it only ever fires from an explicit `cancelToken`-triggered abort. The final response's status decides the stream's `success`/`failure` event either way. With no interceptors registered, `upload()` behaves exactly as before (no synthetic `Response` is built — zero overhead). `download()` doesn't build a request at all, so neither interceptor applies there.
- `RequestConfig`, `RequestInterceptors`, `ResponseInterceptors` types exported from `types/Interceptors.ts`.

### Deprecated
- `onRequest` / `onResponse` / `onError` in `HttpClientConfig` are deprecated in favor of `client.interceptors`. They keep working exactly as before — no breaking change. Their info types (`RequestHookInfo`, `ResponseHookInfo`, `ErrorHookInfo`) moved to `types/Hooks.ts` (still re-exported from the package root, same import path for consumers).

### Changed
- `guessMimeType()` moved from a private `HttpClient` method to a standalone function in `internals/mime-helpers.ts`, alongside the existing `internals/url-helpers.ts` and `internals/stream-helpers.ts`; behavior is unchanged.

## [0.9.0] - 2026-07-02

### Added
- `ResponseHookInfo.response: HttpResponse` — `onResponse` now receives the wrapped response instance, giving hooks body access (`.json()`/`.text()`/...) to build friendly error messages (e.g. parsing a 401 body) before the caller sees the response.

### Changed
- `HttpRequest.body` and `post`/`put`/`patch` body parameters narrowed from `any` to `unknown` — forces explicit narrowing at call sites, no behavior change (non-breaking: callers passing any concrete value still work).
- Clarified `onResponse` JSDoc: throwing inside the hook short-circuits the pipeline — `send()` rejects with that error instead of returning a response, and `onError` still runs afterward. This behavior already existed since `onResponse` was introduced in 0.8.0; it just wasn't documented as an intentional contract.

## [0.8.1] - 2026-04-07

### Changed
- **Reverted breaking narrowing from 0.8.0:** `HttpRequest.headers` is now `HeadersInit` again (matching `HttpClientConfig.headers`). Plain objects, `Headers` instances, and `[string, string][]` tuples are all accepted, and the client normalizes internally. Restoring this resolves the inconsistency between instance-level (`HeadersInit`) and per-request (`Headers`) headers without sacrificing any safety — `new Headers(init)` already validates the input.

## [0.8.0] - 2026-04-03

### Added
- `onRequest` hook in `HttpClientConfig` — called before each request; receives request info and a mutable `Headers` object for inspection or modification; supports async functions
- `onResponse` hook in `HttpClientConfig` — called after each successful response with status, headers, and URL; supports async functions
- `onError` hook in `HttpClientConfig` — called when a network or fetch error occurs; supports async functions
- `RequestHookInfo`, `ResponseHookInfo`, `ErrorHookInfo` types exported for hook parameter typing

### Changed
- **Breaking:** `HttpRequest.headers` type narrowed from `HeadersInit` to `Headers` — per-request headers must now be passed as a `Headers` instance
- Auto Content-Type detection refactored into an internal `guessMimeType()` helper; behavior is unchanged

## [0.7.2] - 2026-04-02

### Fixed
- Added `skills/` and `CHANGELOG.md` to npm `files` field — both were missing from the published package, making `npx skills add ./node_modules/@iyulab/http-client` non-functional

## [0.7.1] - 2026-04-02

### Added
- Agent Skills definition (`skills/iyulab-http-client`) with full API reference, streaming guide, and upload guide

## [0.7.0] - 2026-03-05

### Added
- Relative base URL support in `buildUrl` (e.g., `new HttpClient({ baseUrl: '/api' })`)
- Support for `ArrayBuffer.isView` body types
- `ProgressEvent` existence check in `CanceledError` for non-browser environments

### Changed
- **Breaking:** Removed `isCanceledError` helper — cancel detection now uses `CancelToken.isCancelled` and `error.name`
- Improved upload event system with publish/consume buffer pattern for reliable event delivery
- Renamed `parseUrl` parameter `defaultUrl` → `baseUrl` for consistency
- Reorganized test files into `tests/parsers/` and `tests/internals/` directories

### Fixed
- Fixed header merging order: instance defaults → request headers; request headers now properly override instead of append
- Body `Content-Type` is no longer overwritten when explicitly set by the caller
- Auto `Content-Type` detection now skips `FormData`, `URLSearchParams`, and `ReadableStream` body types
- Upload abort now correctly throws `CanceledError` instead of throwing inside an event handler
- `withCredentials` now only set when `credentials: 'include'` (not `same-origin`)
- Fixed SSE parser to comply with HTML spec: comment lines ignored, single leading space stripped, empty data events valid
- Fixed JSON stream parser state tracking for depth < 1 and state reset after complete objects
- Fixed typo: `DELEMITER` → `DELIMITER` in SSE and Text parsers

## [0.6.1] - 2026-01-15

### Added
- `isCanceledError` helper function for convenient cancel detection

### Changed
- Refactored internal module structure

## [0.6.0] - 2025-11-12

### Changed
- Improved JSON object stream parsing with error handling

### Removed
- Dropped CommonJS build output — ESM only

## [0.5.0] - 2025-10-28

### Added
- Comprehensive stream parsing support: SSE, JSON object stream, and text stream with auto-detection
- Unified stream response interfaces with type discrimination

### Changed
- Refactored codebase into modular architecture (types, internals, parsers)
- Enhanced file upload with response-based event system
- Improved URL handling with separated utility functions

## [0.4.0] - 2025-10-27

### Changed
- Migrated build tooling from Rollup to Vite

## [0.3.0] - 2025-5-19

### Added
- `CanceledError` class for cancellation error handling

### Changed
- Removed code obfuscation from build output; preserved comments and applied formatting

## [0.2.0] - 2025-04-28

### Added
- UMD format build output via Rollup

### Changed
- `TextStreamEvent.data` property type changed from `string[]` to `string`

## [0.1.0] - 2025-04-25

### Added
- Initial release

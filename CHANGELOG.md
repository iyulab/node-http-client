# Changelog

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

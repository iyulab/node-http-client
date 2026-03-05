# Changelog

## 0.7.0 (March 5, 2026)
- **BREAKING**: Removed `isCanceledError` helper — cancel detection now uses `CancelToken.isCancelled` and `error.name`
- Added relative base URL support in `buildUrl` (e.g., `new HttpClient({ baseUrl: '/api' })`)
- Fixed header merging: instance defaults → request headers order, request headers now override instead of append
- Body `Content-Type` is no longer overwritten when explicitly set by the user
- Added support for `ArrayBuffer.isView` body types and skip auto Content-Type for `FormData`, `URLSearchParams`, `ReadableStream`
- Improved upload event system with publish/consume buffer pattern for reliable event delivery
- Upload abort now properly throws `CanceledError` instead of throwing inside event handler
- Upload `withCredentials` only set for `credentials: 'include'` (not `same-origin`)
- Fixed SSE parser to comply with HTML spec: comment lines ignored, single leading space removal, empty data events valid
- Fixed JSON stream parser state tracking for depth < 1 and reset state after complete objects
- Fixed typo: `DELEMITER` → `DELIMITER` in SSE and Text parsers
- Renamed `parseUrl` parameter `defaultUrl` → `baseUrl` for consistency
- Added `ProgressEvent` existence check in `CanceledError` for non-browser environments
- Reorganized test files into `tests/parsers/` and `tests/internals/` directories

## 0.6.1 (January 15, 2026)
- Refactored internal module structure
- Added `isCanceledError` helper function for better error handling

## 0.6.0 (November 12, 2025)
- Improved JSON Object stream parsing with error handling
- Removed commonjs build output, now only ESM is supported

## 0.5.0 (October 28, 2025)
- Added comprehensive stream parsing support (SSE, JSON, Text) with auto-detection
- Unified stream response interfaces with type discrimination
- Refactored code structure with modular architecture (types, internals, parsers)
- Enhanced file upload with response-based event system
- Improved URL handling with separated utility functions

## 0.4.0 (June 20, 2025)
- Change builder to Vite

## 0.3.0 (October 10, 2025)
- Added `CanceledError` error object for cancellation points
- Removed obfuscation from build files, maintained comments, and applied formatting

## 0.2.0 (April 28, 2025)
- Added Rollup UMD format build
- Changed `TextStreamEvent`'s `data` property type from `string[]` to `string`

## 0.1.0 (April 25, 2025)
- Initial library version release

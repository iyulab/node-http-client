# Changelog

## [Unreleased]
- Improved JSON Object stream parsing with error handling

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

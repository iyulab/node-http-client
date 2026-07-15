# TODO

## Next breaking version

- Remove the deprecated `onRequest`/`onResponse`/`onError` hooks from `HttpClientConfig` (and their
  `RequestHookInfo`/`ResponseHookInfo`/`ErrorHookInfo` types in `types/Hooks.ts`). Superseded by
  `client.interceptors` since v0.10.0 — see `CHANGELOG.md`.

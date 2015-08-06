## Sourcemap Polyfill for nodejs

This module add support for source map on error stack even with node > 0.11 where Error.prepareStackTrace is undefined.  For instance the module https://github.com/evanw/node-source-map-support doesn't work when Error.prepareStacktrace is undefined.

## Dependencies

- [node-stacktrace](https://github.com/dmail/node-stacktrace)

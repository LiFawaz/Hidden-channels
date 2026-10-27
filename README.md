# Hidden Channels for Valenced

A Valenced-oriented port scaffold for **Hidden Channels**, originally developed for Revenge/Vendetta.

## Credits

Original implementation: [Lioncat6/revenge-plugins](https://github.com/Lioncat6/revenge-plugins/tree/master/plugins/hidden-channels).

The upstream manifest credits **cloudburst**, **Training Dummy**, and **Lioncat6**. The upstream repository uses **CC0 1.0 Universal**.

## Status

**Not a working port yet.** The Valenced manifest and entrypoint scaffold are committed, but the Revenge-specific permission and navigation hooks have not been adapted or runtime-tested. The current entrypoint is intentionally a no-op; do not install this as a functional plugin yet.

The intended feature is to identify channels the current account cannot view, show a lock indicator, and optionally display channel metadata before navigation. It must not expose hidden messages or bypass Discord server permissions.

## Links

- Upstream source: https://github.com/Lioncat6/revenge-plugins/tree/master/plugins/hidden-channels
- Original plugin page: https://lioncat6.github.io/revenge-plugins/hidden-channels

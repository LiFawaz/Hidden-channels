# Hidden Channels — Valenced compatibility build

Upstream: https://github.com/Lioncat6/revenge-plugins/tree/master/plugins/hidden-channels

The latest downloadable ZIP is available from this repository's GitHub Code menu via **Download ZIP** only for source files; for a packaged plugin, use the release ZIP supplied separately in the conversation.

## Current features

- Configure screen with toggles for the lock indicator and metadata confirmation.
- Local channel metadata lookup by channel ID, where the client already has the channel object.
- Creation date from the channel snowflake, last-message-ID timestamp, topic, and last-pin timestamp when available.

## Not yet complete

The runtime-specific channel-row lock icon, automatic inaccessible-channel listing, navigation confirmation hook, and repository-browser install index are not yet implemented or verified on a live Valenced build. This package does not fetch restricted messages or bypass Discord permissions.

## Install

Use the packaged ZIP in the conversation with Valenced's local plugin-file installer. Direct repository-browser installation is not configured yet because Valenced's repository index format has not been verified.

## Credits

Original implementation credits: Lioncat6, cloudburst, and Training Dummy.

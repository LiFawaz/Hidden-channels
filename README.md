# Hidden Channels — Valenced

A Valenced adaptation of Lioncat6's Hidden Channels plugin.

## Features

- Scans channel metadata already present in Discord's local client stores.
- Lists channels for which the local permission checker returns no view access.
- Shows channel name, category, topic, creation time, last-message time, and last-pin time when cached.
- Includes persistent Configure settings for lock labels and navigation warnings.
- Blocks navigation and the normal message-fetch path for detected hidden channels.
- Replaces a hidden channel message view with a metadata-only notice when that view module is available.

## Permission and privacy behaviour

This plugin does not override Discord's `VIEW_CHANNEL` permission result, grant access, retrieve messages, or request hidden channel data from Discord's servers. It only displays metadata already present in local client stores. If Discord has not delivered a channel's metadata to the device, this plugin cannot discover it.

Hidden channel entries are shown inside the plugin's settings screen rather than being injected into Discord's channel list. Navigation and message-fetch guards are defense-in-depth protections; server-side permissions remain authoritative.

## Configure

Open the plugin's settings and use **Scan Cached Channels** to inspect the metadata currently available locally.

**Show Lock Icon** adds a `LOCKED` label to entries in the plugin list.

**Show Confirmation** displays a warning when navigation to a detected hidden channel is attempted.

Both settings are stored with Valenced's persistent JSON storage.

## Install

Add this repository in Valenced:

`https://raw.githubusercontent.com/LiFawaz/Hidden-channels/gh-pages/index.json`

Install **Hidden Channels**, open its settings, then enable it.

## Development

```sh
bun install
bun run build
```

# Hidden Channels — Valenced

A Valenced port of Lioncat6's Hidden Channels interface, adapted to Valenced's plugin APIs.

## What it does

- Displays hidden cached channel names in Discord's channel list with a lock indicator.
- Uses the client's real permission result to identify hidden channels.
- Blocks navigation into hidden entries and blocks the channel message-fetch path.
- Shows a metadata-only notice when a hidden channel is selected.
- Includes the original-style **Configure** section with persistent lock-icon and confirmation settings.
- Imports administrator-provided JSON metadata for additional details.
- Displays topic, channel creation time, last-message time, last-pin time, and imported permission notes when available.

## Display-only behaviour

The plugin changes the client's `VIEW_CHANNEL` result for hidden guild-channel objects so Discord can render their sidebar rows. It does **not** grant server-side access. The navigation handler blocks opening those channels, the message-fetch guard blocks the normal fetch path, and the message-view component is replaced with metadata-only content when that module is available.

This is a client-side UI modification, not a Discord permission grant. It does not make private messages readable and cannot retrieve data that Discord has not delivered to the local client. A channel may not appear if its metadata is not present in the local channel store.

## Configure

**Show Lock Icon** displays a lock beside hidden channel names in the sidebar and plugin list.

**Show Popup on Hidden Channels** shows a notice when a hidden sidebar entry is selected. Turning it off does not enable navigation; hidden entries remain display-only.

Both options are stored with Valenced's persistent JSON storage.

## Import format

The import accepts either an array of channel objects or an object with a `channels` array:

```json
{
  "channels": [
    {
      "id": "123456789012345678",
      "name": "staff-room",
      "category": "Staff",
      "type": "text",
      "topic": "Internal coordination",
      "createdAt": "2026-01-01T12:00:00Z",
      "lastMessageAt": "2026-10-25T09:30:00Z",
      "lastPinAt": "2026-10-20T14:00:00Z",
      "requiredRoles": ["Moderator"],
      "requiredUsers": [],
      "permissionSummary": "View Channel denied for @everyone; allowed for Moderator"
    }
  ]
}
```

The only required fields are `id` and `name`. Duplicate IDs collapse to one record, with the last occurrence taking precedence. Imports are limited to 500,000 characters and 1,000 channel records; individual fields and role/user lists are also capped.

## Install

Add this repository in Valenced:

`https://raw.githubusercontent.com/LiFawaz/Hidden-channels/gh-pages/index.json`

Install **Hidden Channels**, open its settings, then enable it.

## Development

```sh
bun install
bun run build
```

The build workflow packages the compiled script with the manifest and publishes the repository index to GitHub Pages.

# Hidden Channels — Valenced

A Valenced port of Lioncat6's Hidden Channels metadata interface, adapted to Valenced's plugin API and file structure.

## What it does

- Scans channel objects already present in Discord's local client cache.
- Uses Discord's normal permission checker to identify cached channels the current account cannot view.
- Displays metadata such as channel name, category, type, topic, creation time, last-message time, and last-pin time when those values are present in the local cache.
- Includes the original-style **Configure** section with persistent lock-icon and confirmation settings.
- Imports administrator-provided JSON metadata for additional details.
- Keeps channel details in a metadata-only panel.

## Important limitations

This port does **not** override `PermissionStore.can()`, patch Discord navigation, grant access, or request hidden channel data from Discord. The scan is read-only and only examines channel objects already present in the local client cache. Discord may not send private channel records to the client at all; in that case the plugin cannot discover them.

Opening an entry only opens its metadata panel. It does not navigate into the channel or load messages. Imported permission notes are administrator-supplied text and are not verified against live Discord permissions.

## Configure

**Show Lock Icon** displays a lock beside records in the plugin's channel list.

**Show Popup on Hidden Channels** asks for confirmation before opening the metadata panel.

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

Install **Hidden Channels**, open its settings, then choose **Scan Cached Channel Records**.

## Development

```sh
bun install
bun run build
```

The build workflow packages the compiled script with the manifest and publishes the repository index to GitHub Pages.

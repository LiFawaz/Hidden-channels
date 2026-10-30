# Hidden Channels — Valenced

A details-only viewer for channel metadata provided in a JSON export by a server administrator.

## What it does

- Imports channel metadata from an administrator-provided JSON file.
- Displays channel name, category, type, topic, timestamps, and permission notes when those fields are included in the export.
- Offers a searchable list, optional lock icon, and optional confirmation before opening a metadata card.
- Saves settings and imported metadata with Valenced's persistent plugin storage.

## Important limitation

This plugin does **not** override Discord's permission checks, make private channels visible, or retrieve metadata that Discord has not sent to the client. It cannot load or display messages from channels the current account cannot access. Imported metadata is not verified against live Discord permissions and may become outdated.

## Accepted JSON format

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

The only required fields are `id` and `name`. Optional metadata is displayed only when present in the imported file.

## Install

Add this repository in Valenced:

`https://raw.githubusercontent.com/LiFawaz/Hidden-channels/gh-pages/index.json`

Install **Hidden Channels** and open its settings.

## Development

```sh
bun install
bun run build
```

The build workflow packages the compiled script together with the manifest at the ZIP root and publishes the repository index to GitHub Pages.

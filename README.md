# Hidden Channels

A details-only browser for channel metadata. It groups imported channel records by category, sorts them by category and position, supports search, and opens a panel with topic, creation time, last-message time, last-pin time, and any provided role/user access notes. It never displays channel messages.

## Important limitation

Discord does not reliably provide metadata for channels a user is not authorized to view. This plugin does not bypass permissions or secretly fetch private channel data. To list inaccessible channels, use a JSON metadata export supplied by a server administrator.

## Install

Add this repository in Valenced:

`https://raw.githubusercontent.com/LiFawaz/Hidden-channels/gh-pages/index.json`

Install **Hidden Channels** and open its settings.

## Use

1. Obtain a channel metadata export from a server administrator.
2. Paste the JSON into the plugin's export field and tap **Load channel metadata**.
3. Search by channel or category; records are grouped by category and sorted by position.
4. Tap a channel to open the details-only panel. **View anyways** does not load messages; **Cancel** closes the panel.

Accepted format:

```json
{
  "channels": [
    {
      "id": "123456789012345678",
      "name": "staff-room",
      "category": "Staff",
      "categoryId": "123456789012345670",
      "position": 2,
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

Fields other than `id` and `name` are optional. Discord snowflake IDs are accepted for `createdAt`, `lastMessageAt`, and `lastPinAt`; ISO timestamps also work. The plugin only displays the metadata provided in the export and does not validate whether permission notes are current.

## Development

Source: `plugins/hidden-channels/js/index.ts`

```sh
bun install
bun run build
```

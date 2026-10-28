# Hidden Channels

A small metadata inspector for Valenced. It looks up a channel object that is already cached by your client and displays the metadata available on that object.

It does **not** override Discord permissions, reveal channels that were never sent to your client, or fetch messages from channels you cannot access.

## Install

After the build workflow has completed, add this repository in Valenced:

`https://raw.githubusercontent.com/LiFawaz/Hidden-channels/gh-pages/index.json`

Then install **Hidden Channels** and open its settings.

If the repository index is not available yet, open the latest successful build under **Actions** and check that the package and `dist/index.json` were generated.

## Use

1. Open the plugin settings.
2. Enter a Discord channel ID.
3. Tap **Inspect cached metadata**.
4. The plugin displays fields available from the local channel cache, such as name, ID, type, topic, creation time, last-message timestamp, and last-pin timestamp.

A channel ID lookup may return nothing if that channel object is not cached on your device. The plugin does not make a network request to retrieve missing channel metadata.

## Development

The plugin source lives at `plugins/hidden-channels/js/index.ts`.

Build it locally with:

```sh
bun install
bun run build
```

The GitHub Actions workflow builds the plugin, packages the manifest and generated JavaScript into a versioned ZIP, creates the repository index, and publishes the generated files to GitHub Pages.

## Credits

Original implementation credits: Lioncat6, cloudburst, and Training Dummy.

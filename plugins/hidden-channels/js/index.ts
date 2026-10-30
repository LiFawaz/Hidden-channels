import { getStore } from "@valenced/discord/flux";
import { getModules } from "@valenced/modules/finders";
import { withName, withProps } from "@valenced/modules/finders/filters";
import { instead } from "@valenced/patcher";
import { Alert } from "react-native";
import HiddenChannel from "./HiddenChannel";
import { DEFAULT_SETTINGS, SettingsComponent } from "./settings";
import type { ChannelMetadataRecord, HiddenChannelsStorage } from "./settings";

type PluginOptions = { jsonStorage: HiddenChannelsStorage };

interface Channel {
  id: string;
  name: string;
  type: number;
  guild_id?: string | null;
  parent_id?: string | null;
}

interface ChannelStore {
  getChannel(id: string): Channel | undefined;
}

interface PermissionStore {
  can(permission: bigint | number, channel: Channel): boolean;
  getChannelPermissions?: (...args: unknown[]) => unknown;
}

type Cleanup = (dispose: () => void) => void;

const VIEW_CHANNEL = 1024n;
const SKIPPED_CHANNEL_TYPES = new Set([1, 3, 4]);

let channelStore: ChannelStore | undefined;
const disposers = new Set<() => void>();

function own(cleanup: Cleanup, unpatch: () => unknown): void {
  let active = true;

  const dispose = () => {
    if (!active) return;
    active = false;
    disposers.delete(dispose);

    try {
      unpatch();
    } catch (error) {
      console.warn("[HiddenChannels] Failed to remove a patch.", error);
    }
  };

  disposers.add(dispose);
  cleanup(dispose);
}

function disposeAll(): void {
  for (const dispose of Array.from(disposers)) dispose();
  disposers.clear();
}

function isChannel(value: unknown): value is Channel {
  if (typeof value !== "object" || value === null) return false;
  const channel = value as Partial<Channel>;
  return typeof channel.id === "string" &&
    typeof channel.name === "string" &&
    typeof channel.type === "number";
}

function resolveChannel(value: unknown): Channel | undefined {
  if (typeof value === "string") {
    try {
      return channelStore?.getChannel?.(value);
    } catch {
      return undefined;
    }
  }

  return isChannel(value) ? value : undefined;
}

function isGuildChannel(channel: Channel): boolean {
  return !SKIPPED_CHANNEL_TYPES.has(channel.type) &&
    Boolean(channel.guild_id);
}

/**
 * Uses the original permission result. The display hook below only changes
 * what the channel-list renderer sees; this check always reads the real result.
 */
function isHidden(value: unknown, permissions: PermissionStore): Channel | undefined {
  const channel = resolveChannel(value);
  if (!channel || !isGuildChannel(channel)) return undefined;

  try {
    return permissions.can(VIEW_CHANNEL, channel) === false ? channel : undefined;
  } catch {
    return undefined;
  }
}

function getShowConfirmation(storage: { cache?: HiddenChannelsStorage }): boolean {
  return storage.cache?.showConfirmation ?? DEFAULT_SETTINGS.showConfirmation;
}

function showBlockedNotice(
  channel: Channel,
  storage: { cache?: HiddenChannelsStorage },
): void {
  if (!getShowConfirmation(storage)) return;

  Alert.alert(
    "Hidden channel",
    `#${channel.name}\n\nThis entry is display-only. Tapping it will not open the channel or load messages.`,
    [{ text: "OK" }],
  );
}

function findChannelId(value: unknown, depth = 0): string | undefined {
  if (depth > 3 || value == null) return undefined;

  if (typeof value === "string") {
    const suffix = value.match(/(\d{15,22})\/?$/);
    if (suffix?.[1]) return suffix[1];

    return /^\d{15,22}$/.test(value) ? value : undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findChannelId(item, depth + 1);
      if (found) return found;
    }
    return undefined;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["channelId", "channel_id", "id"]) {
      const id = record[key];
      if (typeof id === "string" && /^\d{15,22}$/.test(id)) return id;
    }

    for (const key of ["channel", "location", "path", "args"]) {
      const found = findChannelId(record[key], depth + 1);
      if (found) return found;
    }
  }

  return undefined;
}

function toMetadata(channel: Channel): ChannelMetadataRecord {
  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    source: "cache",
  };
}

export default plugin<PluginOptions>({
  jsonStorage: {
    load: true,
    default: DEFAULT_SETTINGS,
  },

  start({ cleanup, jsonStorage, plugin }) {
    if (plugin.startedLate) {
      plugin.requireReload();
      return;
    }

    let permissionModule: PermissionStore | undefined;
    let transitionModule: Record<string, unknown> | undefined;
    let fetcher: Record<string, unknown> | undefined;
    let channelMessages: Record<string, unknown> | undefined;
    let activated = false;
    let channelMessagesPatched = false;

    const patchChannelMessages = () => {
      if (
        !activated ||
        !permissionModule ||
        !channelMessages ||
        channelMessagesPatched ||
        typeof channelMessages.default !== "function"
      ) {
        return;
      }

      channelMessagesPatched = true;
      own(
        cleanup,
        instead(channelMessages, "default", function (args, original) {
          const props = args[0] as { channel?: unknown } | undefined;
          const channel = props?.channel
            ? isHidden(props.channel, permissionModule!)
            : undefined;

          if (channel) {
            return createElement(HiddenChannel, {
              channel: toMetadata(channel),
              onClose: () => undefined,
            });
          }

          return Reflect.apply(original, this, args);
        }),
      );
    };

    const activateWhenReady = () => {
      if (
        activated ||
        !channelStore ||
        !permissionModule ||
        typeof permissionModule.can !== "function" ||
        !transitionModule ||
        !fetcher ||
        typeof fetcher.fetchMessages !== "function"
      ) {
        return;
      }

      const permissions = permissionModule;
      const navigation = transitionModule;
      const messageFetcher = fetcher;
      activated = true;

      let navigationPatches = 0;

      // Block navigation before allowing hidden entries into the channel list.
      for (const [key, candidate] of Object.entries(navigation)) {
        if (typeof candidate !== "function") continue;

        own(
          cleanup,
          instead(navigation, key, function (args, original) {
            const channelId = findChannelId(args);
            const channel = channelId ? isHidden(channelId, permissions) : undefined;

            if (channel) {
              showBlockedNotice(channel, jsonStorage);
              return undefined;
            }

            return Reflect.apply(original, this, args);
          }),
        );
        navigationPatches += 1;
      }

      if (navigationPatches === 0) {
        activated = false;
        console.warn("[HiddenChannels] Navigation methods were not found; display-only mode was not enabled.");
        return;
      }

      own(
        cleanup,
        instead(messageFetcher, "fetchMessages", function (args, original) {
          const channelId = findChannelId(args);
          const channel = channelId ? isHidden(channelId, permissions) : undefined;

          if (channel) {
            showBlockedNotice(channel, jsonStorage);
            return undefined;
          }

          return Reflect.apply(original, this, args);
        }),
      );

      // Defense in depth: if a hidden channel view is rendered by another path,
      // replace it with metadata only.
      patchChannelMessages();

      // No permission result is modified. Hidden channel metadata is shown only
      // in this plugin's own settings view; Discord's channel list stays unchanged.
      console.info("[HiddenChannels] Metadata-only mode is active; Discord permissions are unchanged.");
    };

    // Wait for Discord to initialize these modules itself. A one-shot lookup
    // with initialize:true can force-load browser-only modules on Android.
    own(
      cleanup,
      getStore("ChannelStore", (store) => {
        channelStore = store as unknown as ChannelStore;
        activateWhenReady();
      }),
    );

    own(
      cleanup,
      getStore("PermissionStore", (store) => {
        permissionModule = store as PermissionStore;
        activateWhenReady();
      }),
    );

    own(
      cleanup,
      getModules(
        withProps<Record<string, unknown>>("transitionToGuild"),
        (module) => {
          transitionModule = module;
          activateWhenReady();
        },
      ),
    );

    own(
      cleanup,
      getModules(
        withProps<Record<string, unknown>>("fetchMessages"),
        (module) => {
          if (typeof module.fetchMessages === "function") {
            fetcher = module;
            activateWhenReady();
          }
        },
      ),
    );

    own(
      cleanup,
      getModules(withName("ChannelMessages"), (module) => {
        channelMessages = module as Record<string, unknown>;
        patchChannelMessages();
      }),
    );
  },
  stop() {
    disposeAll();
    channelStore = undefined;
  },

  SettingsComponent,
});

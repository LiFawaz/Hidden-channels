import { Stores } from "@valenced/discord/flux";
import { getModules, lookupModule } from "@valenced/modules/finders";
import { withName, withProps } from "@valenced/modules/finders/filters";
import { after, instead } from "@valenced/patcher";
import { createElement, isValidElement } from "react";
import { Alert } from "react-native";
import type { FC, MemoExoticComponent, ReactElement, ReactNode } from "react";
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
  topic?: string | null;
  lastMessageId?: string | null;
  last_message_id?: string | null;
  lastPinTimestamp?: number | string | null;
  last_pin_timestamp?: number | string | null;
}

interface ChannelStore {
  getChannel(id: string): Channel | undefined;
}

interface PermissionStore {
  can(permission: bigint | number, channel: Channel): boolean;
  getChannelPermissions?: (...args: unknown[]) => unknown;
}

interface RowProps {
  channel?: Channel | null;
  isSuggestedSection?: boolean;
  [key: string]: unknown;
}

interface ChannelListModule {
  renderChannelListItem(...args: unknown[]): ReactNode;
}

type TextChannel = MemoExoticComponent<FC<RowProps>> & {
  type: FC<RowProps>;
};

type Cleanup = (dispose: () => void) => void;

const VIEW_CHANNEL = 1024n;
const SKIPPED_CHANNEL_TYPES = new Set([1, 3, 4]);

const channelStore = Stores.ChannelStore as unknown as ChannelStore;
const realPermissionChecks = new WeakSet<object>();
const disposers = new Set<() => void>();
let patchedListModules = new WeakSet<object>();
let patchedRowTypes = new WeakSet<object>();

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
  patchedListModules = new WeakSet<object>();
  patchedRowTypes = new WeakSet<object>();
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

  realPermissionChecks.add(channel);
  try {
    return permissions.can(VIEW_CHANNEL, channel) === false ? channel : undefined;
  } catch {
    return undefined;
  } finally {
    realPermissionChecks.delete(channel);
  }
}

function getShowLockIcon(storage: { cache?: HiddenChannelsStorage }): boolean {
  return storage.cache?.showLockIcon ?? DEFAULT_SETTINGS.showLockIcon;
}

function getShowConfirmation(storage: { cache?: HiddenChannelsStorage }): boolean {
  return storage.cache?.showConfirmation ?? DEFAULT_SETTINGS.showConfirmation;
}

function formatSnowflakeDate(value: string | undefined): string | undefined {
  if (!value || !/^\d{15,22}$/.test(value)) return undefined;

  try {
    const timestamp = Number((BigInt(value) >> 22n) + 1_420_070_400_000n);
    const date = new Date(timestamp);
    return Number.isFinite(date.getTime()) ? date.toLocaleString() : undefined;
  } catch {
    return undefined;
  }
}

function showBlockedNotice(
  channel: Channel,
  storage: { cache?: HiddenChannelsStorage },
): void {
  if (!getShowConfirmation(storage)) return;

  const details = [
    channel.topic ? `Topic: ${channel.topic}` : undefined,
    formatSnowflakeDate(channel.id)
      ? `Created: ${formatSnowflakeDate(channel.id)}`
      : undefined,
    formatSnowflakeDate(channel.lastMessageId ?? channel.last_message_id ?? undefined)
      ? `Last message: ${formatSnowflakeDate(channel.lastMessageId ?? channel.last_message_id ?? undefined)}`
      : undefined,
  ].filter((line): line is string => Boolean(line));

  Alert.alert(
    "Hidden channel",
    [
      `#${channel.name}`,
      ...details,
      "",
      "This entry is display-only. Tapping it will not open the channel or load messages.",
    ].join("\n"),
    [{ text: "OK" }],
  );
}

function findRow(node: ReactNode): ReactElement<RowProps> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const row = findRow(child);
      if (row) return row;
    }
    return undefined;
  }

  if (!isValidElement<RowProps & { children?: ReactNode }>(node)) {
    return undefined;
  }

  const rowType = node.type as { type?: unknown };
  if (
    "isSuggestedSection" in node.props &&
    node.props.channel != null &&
    typeof rowType?.type === "function"
  ) {
    return node as ReactElement<RowProps>;
  }

  return findRow(node.props.children);
}

function withLockIcon(channel: Channel): Channel {
  if (channel.name.startsWith("🔒 ")) return channel;

  return Object.create(channel, {
    name: {
      configurable: true,
      enumerable: true,
      value: `🔒 ${channel.name}`,
      writable: false,
    },
  }) as Channel;
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
    topic: channel.topic ?? undefined,
    createdAt: formatSnowflakeDate(channel.id),
    lastMessageAt: formatSnowflakeDate(
      channel.lastMessageId ?? channel.last_message_id ?? undefined,
    ),
    lastPinAt:
      typeof channel.lastPinTimestamp === "number" ||
      typeof channel.lastPinTimestamp === "string"
        ? String(channel.lastPinTimestamp)
        : typeof channel.last_pin_timestamp === "number" ||
            typeof channel.last_pin_timestamp === "string"
          ? String(channel.last_pin_timestamp)
          : undefined,
    source: "cache",
  };
}

function patchChannelList(
  cleanup: Cleanup,
  module: ChannelListModule,
  permissions: PermissionStore,
  storage: { cache?: HiddenChannelsStorage },
): void {
  if (patchedListModules.has(module)) return;
  patchedListModules.add(module);

  own(
    cleanup,
    after(module, "renderChannelListItem", (tree) => {
      const row = findRow(tree);
      if (!row || typeof row.type !== "object") return tree;

      const rowType = row.type as TextChannel;
      if (
        !rowType ||
        typeof rowType.type !== "function" ||
        patchedRowTypes.has(rowType)
      ) {
        return tree;
      }

      patchedRowTypes.add(rowType);
      own(
        cleanup,
        instead(rowType, "type", function (args, original) {
          const props = args[0] as RowProps | undefined;
          const channel = props?.channel;
          if (!channel || !isHidden(channel, permissions)) {
            return Reflect.apply(original, this, args);
          }

          const nextProps = getShowLockIcon(storage)
            ? { ...props, channel: withLockIcon(channel) }
            : props;

          return Reflect.apply(original, this, [nextProps, ...args.slice(1)]);
        }),
      );

      return tree;
    }),
  );
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

    const permissionModule = (
      lookupModule(
        withProps<PermissionStore>("can", "getChannelPermissions"),
        { initialize: false },
      )[0] ??
      lookupModule(
        withProps<PermissionStore>("can"),
        { initialize: false },
      )[0]
    ) as PermissionStore | undefined;

    const transitionModule = lookupModule(
      withProps<Record<string, unknown>>("transitionToGuild"),
      { initialize: false },
    )[0] as Record<string, unknown> | undefined;

    const fetcher = (
      lookupModule(
        withProps<Record<string, unknown>>("stores", "fetchMessages"),
        { initialize: false },
      )[0] ??
      lookupModule(
        withProps<Record<string, unknown>>("fetchMessages"),
        { initialize: false },
      )[0]
    ) as Record<string, unknown> | undefined;

    if (!permissionModule || typeof permissionModule.can !== "function") {
      console.warn("[HiddenChannels] PermissionStore was not found; display-only mode was not enabled.");
      return;
    }

    if (!transitionModule) {
      console.warn("[HiddenChannels] Navigation module was not found; display-only mode was not enabled.");
      return;
    }

    if (!fetcher || typeof fetcher.fetchMessages !== "function") {
      console.warn("[HiddenChannels] Message-fetch module was not found; display-only mode was not enabled.");
      return;
    }

    let navigationPatches = 0;

    // Install the blockers before allowing the channel list to display hidden rows.
    for (const [key, candidate] of Object.entries(transitionModule)) {
      if (typeof candidate !== "function") continue;

      own(
        cleanup,
        instead(transitionModule, key, function (args, original) {
          const channelId = findChannelId(args[0]);
          const channel = channelId ? isHidden(channelId, permissionModule) : undefined;

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
      disposeAll();
      console.warn("[HiddenChannels] No navigation handlers were patchable; display-only mode was not enabled.");
      return;
    }

    own(
      cleanup,
      instead(fetcher, "fetchMessages", function (args, original) {
        const channelId = findChannelId(args);
        const channel = channelId ? isHidden(channelId, permissionModule) : undefined;

        if (channel) {
          showBlockedNotice(channel, jsonStorage);
          return undefined;
        }

        return Reflect.apply(original, this, args);
      }),
    );

    const channelMessages = lookupModule(withName("ChannelMessages"), { initialize: false })[0] as
      | Record<string, unknown>
      | undefined;

    if (channelMessages && typeof channelMessages.default === "function") {
      own(
        cleanup,
        instead(channelMessages, "default", function (args, original) {
          const props = args[0] as { channel?: unknown } | undefined;
          const channel = props?.channel
            ? isHidden(props.channel, permissionModule)
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
    }

    // Only after navigation and message-fetch blockers are installed do we
    // adjust the client's VIEW_CHANNEL result so its sidebar can render rows.
    own(
      cleanup,
      after(permissionModule, "can", (args, result) => {
        const [permission, channel] = args as [bigint | number, unknown];

        if (
          permission === VIEW_CHANNEL &&
          result === false &&
          isChannel(channel) &&
          isGuildChannel(channel) &&
          !realPermissionChecks.has(channel)
        ) {
          return true;
        }

        return result;
      }),
    );

    own(
      cleanup,
      getModules(
        withProps<ChannelListModule>("renderChannelListItem"),
        (module) => patchChannelList(cleanup, module, permissionModule, jsonStorage),
      ),
    );

    console.info("[HiddenChannels] Display-only sidebar mode is active; navigation and message fetching are blocked.");
  },

  stop() {
    disposeAll();
  },

  SettingsComponent,
});

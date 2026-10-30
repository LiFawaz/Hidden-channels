import { lookupModule } from "@valenced/modules/finders";
import { withProps } from "@valenced/modules/finders/filters";
import type { ChannelMetadataRecord } from "./settings";

type UnknownRecord = Record<string, unknown>;

interface ChannelStore {
  getChannels?: () => unknown;
  getChannel?: (id: string) => unknown;
  getMutableGuildChannelsForGuild?: (guildId: string) => unknown;
  getGuildChannelsForGuild?: (guildId: string) => unknown;
  getChannelsForGuild?: (guildId: string) => unknown;
}

interface GuildStore {
  getGuildIds?: () => unknown;
}

interface PermissionStore {
  can?: (permission: bigint | number, context: unknown) => unknown;
}

export interface ChannelScanResult {
  channels: ChannelMetadataRecord[];
  scanned: number;
  skipped: number;
  error?: string;
}

const VIEW_CHANNEL = 1024n;
const MAX_CHANNELS_TO_SCAN = 5_000;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeCall<T>(callback: (() => T) | undefined): T | undefined {
  if (typeof callback !== "function") return undefined;
  try {
    return callback();
  } catch {
    return undefined;
  }
}

function collectChannelObjects(
  value: unknown,
  output: UnknownRecord[],
  visited: WeakSet<object>,
  depth = 0
): void {
  if (!value || typeof value !== "object" || depth > 5) return;
  if (visited.has(value)) return;
  visited.add(value);

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (output.length >= MAX_CHANNELS_TO_SCAN) return;
      collectChannelObjects(entry, output, visited, depth + 1);
    }
    return;
  }

  if (value instanceof Map) {
    for (const entry of value.values()) {
      if (output.length >= MAX_CHANNELS_TO_SCAN) return;
      collectChannelObjects(entry, output, visited, depth + 1);
    }
    return;
  }

  const record = value as UnknownRecord;
  if (
    (typeof record.id === "string" || typeof record.id === "number") &&
    typeof record.name === "string"
  ) {
    output.push(record);
    return;
  }

  for (const entry of Object.values(record)) {
    if (output.length >= MAX_CHANNELS_TO_SCAN) return;
    collectChannelObjects(entry, output, visited, depth + 1);
  }
}

function toId(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isSafeInteger(value)) return String(value);
  return undefined;
}

function snowflakeDate(value: unknown): string | undefined {
  const id = toId(value);
  if (!id || !/^\d{15,22}$/.test(id)) return undefined;

  try {
    const milliseconds = Number((BigInt(id) >> 22n) + 1_420_070_400_000n);
    const date = new Date(milliseconds);
    return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
  } catch {
    return undefined;
  }
}

function timestampDate(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
  }

  if (typeof value === "string" && value.trim()) {
    const text = value.trim();
    const numeric = /^\d{13}$/.test(text) ? Number(text) : undefined;
    if (numeric !== undefined) {
      const date = new Date(numeric);
      return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
    }

    const date = new Date(text);
    if (Number.isFinite(date.getTime())) return date.toISOString();
  }

  return undefined;
}

function channelType(record: UnknownRecord): string | number | undefined {
  const value = record.type;
  return typeof value === "string" || (typeof value === "number" && Number.isFinite(value))
    ? value
    : undefined;
}

function isExcludedChannel(record: UnknownRecord): boolean {
  const type = record.type;
  return type === 1 || type === 3 || type === 4 ||
    type === "DM" || type === "GROUP_DM" || type === "GUILD_CATEGORY";
}

function getGuildIds(store: GuildStore | undefined): string[] {
  const value = safeCall(() => store?.getGuildIds?.());
  if (Array.isArray(value)) return value.map(toId).filter((id): id is string => Boolean(id));
  if (value instanceof Set) return Array.from(value).map(toId).filter((id): id is string => Boolean(id));
  return [];
}

/**
 * Reads channel objects that Discord has already placed in local client stores.
 * Permission checks are observational only: this function never changes their result,
 * patches Discord, opens a channel, or requests data from Discord's servers.
 */
export function scanCachedHiddenChannels(): ChannelScanResult {
  try {
    const channelStore = (
      lookupModule(withProps<ChannelStore>("getChannel", "getMutableGuildChannelsForGuild"))[0] ??
      lookupModule(withProps<ChannelStore>("getChannel", "getChannels"))[0] ??
      lookupModule(withProps<ChannelStore>("getChannels"))[0]
    ) as unknown as ChannelStore | null;

    const permissionStore = (
      lookupModule(withProps<PermissionStore>("can", "computePermissions"))[0] ??
      lookupModule(withProps<PermissionStore>("can"))[0]
    ) as unknown as PermissionStore | null;

    const guildStore = lookupModule(
      withProps<GuildStore>("getGuildIds", "getGuild")
    )[0] as unknown as GuildStore | null;

    if (!channelStore) {
      return {
        channels: [],
        scanned: 0,
        skipped: 0,
        error: "Discord's local channel store was not found.",
      };
    }

    if (typeof permissionStore?.can !== "function") {
      return {
        channels: [],
        scanned: 0,
        skipped: 0,
        error: "Discord's permission checker was not found. No cached channels were listed.",
      };
    }

    const candidates: UnknownRecord[] = [];
    const visited = new WeakSet<object>();

    collectChannelObjects(
      safeCall(() => channelStore.getChannels?.()),
      candidates,
      visited
    );

    const guildIds = getGuildIds(guildStore);
    for (const guildId of guildIds) {
      const sources = [
        safeCall(() => channelStore.getMutableGuildChannelsForGuild?.(guildId)),
        safeCall(() => channelStore.getGuildChannelsForGuild?.(guildId)),
        safeCall(() => channelStore.getChannelsForGuild?.(guildId)),
      ];

      for (const source of sources) {
        collectChannelObjects(source, candidates, visited);
      }

      if (candidates.length >= MAX_CHANNELS_TO_SCAN) break;
    }

    const unique = new Map<string, UnknownRecord>();
    for (const channel of candidates) {
      const id = toId(channel.id);
      const name = typeof channel.name === "string" ? channel.name.trim() : "";
      if (id && name) unique.set(id, channel);
    }

    const categoryNames = new Map<string, string>();
    for (const [id, channel] of unique) {
      if (channel.type === 4 || channel.type === "GUILD_CATEGORY") {
        if (typeof channel.name === "string") categoryNames.set(id, channel.name);
      }
    }

    const hidden: ChannelMetadataRecord[] = [];
    let skipped = 0;

    for (const [id, channel] of unique) {
      if (isExcludedChannel(channel)) continue;

      let canView: unknown;

      try {
        canView = permissionStore.can(VIEW_CHANNEL, channel);
      } catch {
        try {
          canView = permissionStore.can(1024, channel);
        } catch {
          skipped += 1;
          continue;
        }
      }

      if (typeof canView !== "boolean") {
        try {
          canView = permissionStore.can(1024, channel);
        } catch {
          skipped += 1;
          continue;
        }
      }

      if (typeof canView !== "boolean") {
        skipped += 1;
        continue;
      }

      if (canView) continue;

      const parentId = toId(channel.parent_id ?? channel.parentId);
      const lastMessageId = channel.lastMessageId ?? channel.last_message_id;
      const category = parentId ? categoryNames.get(parentId) : undefined;

      hidden.push({
        id,
        name: (channel.name as string).slice(0, 100),
        category,
        type: channelType(channel),
        topic: typeof channel.topic === "string" ? channel.topic.slice(0, 1_024) : undefined,
        createdAt: snowflakeDate(id),
        lastMessageAt: snowflakeDate(lastMessageId),
        lastPinAt: timestampDate(channel.lastPinTimestamp ?? channel.last_pin_timestamp),
        source: "cache",
      });

      if (hidden.length >= MAX_CHANNELS_TO_SCAN) break;
    }

    return {
      channels: hidden,
      scanned: unique.size,
      skipped,
    };
  } catch (cause) {
    return {
      channels: [],
      scanned: 0,
      skipped: 0,
      error: cause instanceof Error ? cause.message : "The local channel scan failed.",
    };
  }
}

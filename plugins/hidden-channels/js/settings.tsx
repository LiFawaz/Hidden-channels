import { React, ReactNative as RN } from "@valenced/react";
import type { PluginApi } from "@valenced/plugins/types";
import HiddenChannel from "./HiddenChannel";
import { scanCachedHiddenChannels } from "./channel-scan";

export interface ChannelMetadataRecord {
  id: string;
  name: string;
  category?: string;
  type?: string | number;
  topic?: string;
  createdAt?: string;
  lastMessageAt?: string;
  lastPinAt?: string;
  requiredRoles?: string[];
  requiredUsers?: string[];
  permissionSummary?: string;
  source?: "cache" | "import";
}

export interface HiddenChannelsStorage {
  showLockIcon: boolean;
  showConfirmation: boolean;
  channels: ChannelMetadataRecord[];
}

export const DEFAULT_SETTINGS: HiddenChannelsStorage = {
  showLockIcon: true,
  showConfirmation: true,
  channels: [],
};

type PluginOptions = { jsonStorage: HiddenChannelsStorage };
type SettingsProps = { api: PluginApi<PluginOptions> };
type JsonRecord = Record<string, unknown>;

const MAX_IMPORT_CHARACTERS = 500_000;
const MAX_CHANNELS = 1_000;
const MAX_LIST_ITEMS = 50;
const MAX_LIST_ITEM_LENGTH = 100;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;

  const cleaned = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength)
    .trim();

  return cleaned.length ? cleaned : undefined;
}

function readStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const result: string[] = [];
  for (const item of value.slice(0, MAX_LIST_ITEMS)) {
    const cleaned = readText(item, MAX_LIST_ITEM_LENGTH);
    if (cleaned) result.push(cleaned);
  }

  return result.length ? result : undefined;
}

function normalizeChannel(
  value: unknown,
  preserveSource = false
): ChannelMetadataRecord | null {
  if (!isRecord(value)) return null;

  const id = readText(value.id, 32);
  const name = readText(value.name, 100);
  if (!id || !name) return null;

  const type =
    typeof value.type === "string"
      ? readText(value.type, 40)
      : typeof value.type === "number" && Number.isFinite(value.type)
        ? value.type
        : undefined;

  return {
    id,
    name,
    category: readText(value.category, 100),
    type,
    topic: readText(value.topic, 1_024),
    createdAt: readText(value.createdAt, 80),
    lastMessageAt: readText(value.lastMessageAt, 80),
    lastPinAt: readText(value.lastPinAt, 80),
    requiredRoles: readStringList(value.requiredRoles),
    requiredUsers: readStringList(value.requiredUsers),
    permissionSummary: readText(value.permissionSummary, 1_000),
    source: preserveSource && value.source === "cache" ? "cache" : "import",
  };
}

function normalizeChannels(
  rows: unknown[],
  preserveSource = false
): ChannelMetadataRecord[] {
  const unique = new Map<string, ChannelMetadataRecord>();

  for (const row of rows.slice(0, MAX_CHANNELS * 5)) {
    const channel = normalizeChannel(row, preserveSource);
    if (channel) unique.set(channel.id, channel);
    if (unique.size >= MAX_CHANNELS) break;
  }

  return Array.from(unique.values());
}

function parseMetadata(input: string): ChannelMetadataRecord[] {
  if (!input.trim()) {
    throw new Error("Paste a JSON export before importing.");
  }

  if (input.length > MAX_IMPORT_CHARACTERS) {
    throw new Error("The JSON export is too large. The limit is 500,000 characters.");
  }

  const parsed: unknown = JSON.parse(input);
  let rows: unknown[];

  if (Array.isArray(parsed)) {
    rows = parsed;
  } else if (isRecord(parsed) && Array.isArray(parsed.channels)) {
    rows = parsed.channels;
  } else {
    throw new Error('Expected an array or an object with a "channels" array.');
  }

  if (rows.length > MAX_CHANNELS) {
    throw new Error("The export contains too many entries. The limit is 1,000 channels.");
  }

  const channels = normalizeChannels(rows);
  if (rows.length > 0 && channels.length === 0) {
    throw new Error('No valid channel records were found. Each record needs an "id" and "name".');
  }

  return channels;
}

function normalizeSettings(value: unknown): HiddenChannelsStorage {
  const saved = isRecord(value) ? value : {};
  const channels = Array.isArray(saved.channels)
    ? normalizeChannels(saved.channels, true)
    : DEFAULT_SETTINGS.channels;

  return {
    showLockIcon:
      typeof saved.showLockIcon === "boolean"
        ? saved.showLockIcon
        : DEFAULT_SETTINGS.showLockIcon,
    showConfirmation:
      typeof saved.showConfirmation === "boolean"
        ? saved.showConfirmation
        : DEFAULT_SETTINGS.showConfirmation,
    channels,
  };
}

interface NativeAlert {
  alert?: (
    title: string,
    message: string,
    buttons: Array<{
      text: string;
      style?: "cancel" | "destructive";
      onPress?: () => void;
    }>
  ) => void;
}

export function SettingsComponent({ api }: SettingsProps) {
  const settings = normalizeSettings(api.jsonStorage.use());
  const [search, setSearch] = React.useState("");
  const [importText, setImportText] = React.useState("");
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [scanning, setScanning] = React.useState(false);
  const [selectedChannel, setSelectedChannel] =
    React.useState<ChannelMetadataRecord | null>(null);

  const term = search.trim().toLowerCase();
  const filteredChannels = settings.channels.filter((channel) => {
    if (!term) return true;

    return (
      channel.name.toLowerCase().includes(term) ||
      (channel.category ?? "").toLowerCase().includes(term) ||
      channel.id.includes(term)
    );
  });
  const visibleChannels = filteredChannels.slice(0, 200);
  const cachedCount = settings.channels.filter((channel) => channel.source === "cache").length;
  const importedCount = settings.channels.length - cachedCount;

  async function saveSettings(
    update: Partial<HiddenChannelsStorage>,
    failureMessage: string
  ): Promise<boolean> {
    try {
      await api.jsonStorage.set(update);
      setError("");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : failureMessage);
      setNotice("");
      return false;
    }
  }

  function toggle(
    key: "showLockIcon" | "showConfirmation",
    value: boolean
  ): void {
    const update =
      key === "showLockIcon"
        ? { showLockIcon: value }
        : { showConfirmation: value };

    void saveSettings(update, "Could not save this setting.");
  }

  async function scanLocalCache(): Promise<void> {
    if (scanning || saving) return;

    setScanning(true);
    setError("");
    setNotice("");

    try {
      const result = scanCachedHiddenChannels();

      if (result.error) {
        setError(result.error);
        return;
      }

      const merged = new Map<string, ChannelMetadataRecord>();
      for (const channel of settings.channels) {
        if (channel.source !== "cache") merged.set(channel.id, channel);
      }

      for (const channel of result.channels) {
        const previous = merged.get(channel.id);
        merged.set(channel.id, {
          ...previous,
          ...channel,
          requiredRoles: previous?.requiredRoles,
          requiredUsers: previous?.requiredUsers,
          permissionSummary: previous?.permissionSummary,
        });
      }

      const channels = Array.from(merged.values()).slice(0, MAX_CHANNELS);
      await api.jsonStorage.set({ channels });
      setSelectedChannel(null);
      setNotice(
        result.channels.length
          ? `Found ${result.channels.length} hidden channel record(s) in local cache. Checked ${result.scanned} cached channel(s).`
          : `No hidden channel records were found in the local cache. Checked ${result.scanned} channel(s).`
      );

      if (result.skipped > 0) {
        setNotice((current) => `${current} Skipped ${result.skipped} channel(s) because permission checks failed.`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The local channel scan failed.");
    } finally {
      setScanning(false);
    }
  }

  async function importChannels(): Promise<void> {
    if (saving || scanning) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const imported = parseMetadata(importText);
      const merged = new Map<string, ChannelMetadataRecord>();

      for (const channel of settings.channels) {
        if (channel.source === "cache") merged.set(channel.id, channel);
      }
      for (const channel of imported) {
        merged.set(channel.id, channel);
      }

      const channels = Array.from(merged.values()).slice(0, MAX_CHANNELS);
      await api.jsonStorage.set({ channels });
      setImportText("");
      setSelectedChannel(null);
      setNotice(`Imported ${imported.length} channel metadata record(s). Existing cached records were kept.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not import metadata.");
    } finally {
      setSaving(false);
    }
  }

  async function clearMetadata(): Promise<void> {
    if (saving || scanning) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await api.jsonStorage.set({ channels: [] });
      setSelectedChannel(null);
      setNotice("All imported and cached metadata records were cleared.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not clear metadata.");
    } finally {
      setSaving(false);
    }
  }

  function openChannel(channel: ChannelMetadataRecord): void {
    if (settings.showConfirmation) {
      const alertModule = (RN as unknown as { Alert?: NativeAlert }).Alert;

      if (typeof alertModule?.alert === "function") {
        try {
          alertModule.alert(
            "Hidden Channel",
            "This opens a metadata-only view. Discord permissions remain unchanged and no channel messages will be requested.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "View metadata",
                onPress: () => setSelectedChannel(channel),
              },
            ]
          );
          return;
        } catch {
          // Use the in-settings details panel when the native dialog is unavailable.
        }
      }
    }

    setSelectedChannel(channel);
  }

  return (
    <RN.ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
      <RN.Text style={{ color: "#f2f3f5", fontSize: 20, fontWeight: "700" }}>
        Hidden Channels
      </RN.Text>
      <RN.Text style={{ color: "#b9bbbe", fontSize: 13, lineHeight: 19 }}>
        View channel details from Discord's local cache or import a JSON export from a
        server administrator. The plugin never overrides permissions or fetches hidden
        channel messages.
      </RN.Text>

      <RN.View style={{ gap: 10 }}>
        <RN.Text style={{ color: "#f2f3f5", fontSize: 16, fontWeight: "700" }}>
          Configure
        </RN.Text>

        <RN.View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <RN.View style={{ flex: 1, gap: 3 }}>
            <RN.Text style={{ color: "#dcddde", fontWeight: "600" }}>
              Show Lock Icon
            </RN.Text>
            <RN.Text style={{ color: "#b9bbbe", fontSize: 12 }}>
              Show a lock beside hidden channel names in this list.
            </RN.Text>
          </RN.View>
          <RN.Switch
            value={settings.showLockIcon}
            onValueChange={(value) => toggle("showLockIcon", value)}
          />
        </RN.View>

        <RN.View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <RN.View style={{ flex: 1, gap: 3 }}>
            <RN.Text style={{ color: "#dcddde", fontWeight: "600" }}>
              Show Popup on Hidden Channels
            </RN.Text>
            <RN.Text style={{ color: "#b9bbbe", fontSize: 12 }}>
              Ask before opening a metadata details panel.
            </RN.Text>
          </RN.View>
          <RN.Switch
            value={settings.showConfirmation}
            onValueChange={(value) => toggle("showConfirmation", value)}
          />
        </RN.View>
      </RN.View>

      <RN.Pressable
        disabled={scanning || saving}
        onPress={() => void scanLocalCache()}
        style={{
          backgroundColor: scanning || saving ? "#4e535c" : "#5865f2",
          padding: 12,
          borderRadius: 8,
          alignItems: "center",
          opacity: scanning || saving ? 0.7 : 1,
        }}
      >
        <RN.Text style={{ color: "#ffffff", fontWeight: "600" }}>
          {scanning ? "Scanning local cache..." : "Scan Cached Channel Records"}
        </RN.Text>
      </RN.Pressable>
      <RN.Text style={{ color: "#b9bbbe", fontSize: 12 }}>
        This scan only reads channel objects already present in Discord's local stores.
        It does not make network requests or change permission results.
      </RN.Text>

      <RN.View style={{ gap: 8 }}>
        <RN.Text style={{ color: "#f2f3f5", fontSize: 16, fontWeight: "700" }}>
          Import Administrator Metadata (JSON)
        </RN.Text>
        <RN.TextInput
          value={importText}
          onChangeText={setImportText}
          multiline
          textAlignVertical="top"
          placeholder={'Paste {"channels":[{"id":"...","name":"..."}]} here'}
          placeholderTextColor="#72767d"
          style={{
            color: "#f2f3f5",
            backgroundColor: "#2b2d31",
            borderRadius: 8,
            minHeight: 120,
            padding: 12,
            textAlignVertical: "top",
          }}
        />
        <RN.Pressable
          disabled={saving || scanning}
          onPress={() => void importChannels()}
          style={{
            backgroundColor: saving || scanning ? "#4e535c" : "#3f4147",
            padding: 12,
            borderRadius: 8,
            alignItems: "center",
            opacity: saving || scanning ? 0.7 : 1,
          }}
        >
          <RN.Text style={{ color: "#ffffff", fontWeight: "600" }}>
            {saving ? "Saving..." : "Import metadata"}
          </RN.Text>
        </RN.Pressable>
      </RN.View>

      {error ? <RN.Text style={{ color: "#ed4245" }}>{error}</RN.Text> : null}
      {notice ? <RN.Text style={{ color: "#57f287", lineHeight: 19 }}>{notice}</RN.Text> : null}

      <RN.View style={{ gap: 3 }}>
        <RN.Text style={{ color: "#f2f3f5", fontSize: 16, fontWeight: "700" }}>
          Channels ({settings.channels.length})
        </RN.Text>
        <RN.Text style={{ color: "#b9bbbe", fontSize: 12 }}>
          {cachedCount} from local cache · {importedCount} imported
        </RN.Text>
      </RN.View>

      <RN.TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search by channel, category, or ID"
        placeholderTextColor="#72767d"
        style={{
          color: "#f2f3f5",
          backgroundColor: "#2b2d31",
          borderRadius: 8,
          padding: 12,
        }}
      />

      {visibleChannels.length ? (
        visibleChannels.map((channel) => (
          <RN.Pressable
            key={channel.id}
            onPress={() => openChannel(channel)}
            style={{
              padding: 12,
              borderRadius: 8,
              backgroundColor: "#2b2d31",
            }}
          >
            <RN.Text style={{ color: "#f2f3f5", fontWeight: "600" }}>
              {settings.showLockIcon ? "🔒 " : ""}
              {channel.name}
            </RN.Text>
            <RN.Text style={{ color: "#b9bbbe", fontSize: 12 }}>
              {channel.category ?? "No category"} · {String(channel.type ?? "Unknown type")} · {channel.source === "cache" ? "Cached" : "Imported"}
            </RN.Text>
          </RN.Pressable>
        ))
      ) : (
        <RN.Text style={{ color: "#b9bbbe" }}>
          {settings.channels.length ? "No matching channels." : "No channel records yet. Scan the local cache or import a JSON export."}
        </RN.Text>
      )}

      {filteredChannels.length > visibleChannels.length ? (
        <RN.Text style={{ color: "#b9bbbe", fontSize: 12 }}>
          Showing the first 200 matches. Refine your search to narrow the results.
        </RN.Text>
      ) : null}

      {selectedChannel ? (
        <HiddenChannel
          channel={selectedChannel}
          onClose={() => setSelectedChannel(null)}
        />
      ) : null}

      {settings.channels.length ? (
        <RN.Pressable
          disabled={saving || scanning}
          onPress={() => void clearMetadata()}
          style={{
            padding: 12,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: "#ed4245",
            alignItems: "center",
            opacity: saving || scanning ? 0.5 : 1,
          }}
        >
          <RN.Text style={{ color: "#ed4245" }}>Clear all metadata</RN.Text>
        </RN.Pressable>
      ) : null}
    </RN.ScrollView>
  );
}

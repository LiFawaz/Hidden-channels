import { useState } from "react";
import type { ComponentProps } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import type { PluginSettingsComponent } from "@valenced/plugins/types";
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
type Props = ComponentProps<PluginSettingsComponent<PluginOptions>>;
type Storage = Props["api"]["jsonStorage"];
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

export function SettingsComponent({ api: { jsonStorage: storage } }: Props) {
  const settings = normalizeSettings(storage.use());
  const [search, setSearch] = useState("");
  const [importText, setImportText] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [selectedChannel, setSelectedChannel] =
    useState<ChannelMetadataRecord | null>(null);

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
      await storage.set(update);
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
      await storage.set({ channels });
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
      await storage.set({ channels });
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
      await storage.set({ channels: [] });
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
      try {
          Alert.alert(
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

    setSelectedChannel(channel);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Text style={{ color: "#f2f3f5", fontSize: 20, fontWeight: "700" }}>
        Hidden Channels
      </Text>
      <Text style={{ color: "#b9bbbe", fontSize: 13, lineHeight: 19 }}>
        View channel details from Discord's local cache or import a JSON export from a
        server administrator. The plugin never overrides permissions or fetches hidden
        channel messages.
      </Text>

      <View style={{ gap: 10 }}>
        <Text style={{ color: "#f2f3f5", fontSize: 16, fontWeight: "700" }}>
          Configure
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: "#dcddde", fontWeight: "600" }}>
              Show Lock Icon
            </Text>
            <Text style={{ color: "#b9bbbe", fontSize: 12 }}>
              Show a lock beside hidden channel names in this list.
            </Text>
          </View>
          <Switch
            value={settings.showLockIcon}
            onValueChange={(value) => toggle("showLockIcon", value)}
          />
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: "#dcddde", fontWeight: "600" }}>
              Show Popup on Hidden Channels
            </Text>
            <Text style={{ color: "#b9bbbe", fontSize: 12 }}>
              Ask before opening a metadata details panel.
            </Text>
          </View>
          <Switch
            value={settings.showConfirmation}
            onValueChange={(value) => toggle("showConfirmation", value)}
          />
        </View>
      </View>

      <Pressable
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
        <Text style={{ color: "#ffffff", fontWeight: "600" }}>
          {scanning ? "Scanning local cache..." : "Scan Cached Channel Records"}
        </Text>
      </Pressable>
      <Text style={{ color: "#b9bbbe", fontSize: 12 }}>
        This scan only reads channel objects already present in Discord's local stores.
        It does not make network requests or change permission results.
      </Text>

      <View style={{ gap: 8 }}>
        <Text style={{ color: "#f2f3f5", fontSize: 16, fontWeight: "700" }}>
          Import Administrator Metadata (JSON)
        </Text>
        <TextInput
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
        <Pressable
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
          <Text style={{ color: "#ffffff", fontWeight: "600" }}>
            {saving ? "Saving..." : "Import metadata"}
          </Text>
        </Pressable>
      </View>

      {error ? <Text style={{ color: "#ed4245" }}>{error}</Text> : null}
      {notice ? <Text style={{ color: "#57f287", lineHeight: 19 }}>{notice}</Text> : null}

      <View style={{ gap: 3 }}>
        <Text style={{ color: "#f2f3f5", fontSize: 16, fontWeight: "700" }}>
          Channels ({settings.channels.length})
        </Text>
        <Text style={{ color: "#b9bbbe", fontSize: 12 }}>
          {cachedCount} from local cache · {importedCount} imported
        </Text>
      </View>

      <TextInput
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
          <Pressable
            key={channel.id}
            onPress={() => openChannel(channel)}
            style={{
              padding: 12,
              borderRadius: 8,
              backgroundColor: "#2b2d31",
            }}
          >
            <Text style={{ color: "#f2f3f5", fontWeight: "600" }}>
              {settings.showLockIcon ? "🔒 " : ""}
              {channel.name}
            </Text>
            <Text style={{ color: "#b9bbbe", fontSize: 12 }}>
              {channel.category ?? "No category"} · {String(channel.type ?? "Unknown type")} · {channel.source === "cache" ? "Cached" : "Imported"}
            </Text>
          </Pressable>
        ))
      ) : (
        <Text style={{ color: "#b9bbbe" }}>
          {settings.channels.length ? "No matching channels." : "No channel records yet. Scan the local cache or import a JSON export."}
        </Text>
      )}

      {filteredChannels.length > visibleChannels.length ? (
        <Text style={{ color: "#b9bbbe", fontSize: 12 }}>
          Showing the first 200 matches. Refine your search to narrow the results.
        </Text>
      ) : null}

      {selectedChannel ? (
        <HiddenChannel
          channel={selectedChannel}
          onClose={() => setSelectedChannel(null)}
        />
      ) : null}

      {settings.channels.length ? (
        <Pressable
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
          <Text style={{ color: "#ed4245" }}>Clear all metadata</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

import { React, ReactNative as RN } from "@valenced/react";
import type { PluginApi } from "@valenced/plugins/types";

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

function readText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseMetadata(input: string): ChannelMetadataRecord[] {
  const parsed: unknown = JSON.parse(input);
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as any).channels)
      ? (parsed as any).channels
      : null;

  if (!rows) {
    throw new Error('Expected an array or an object with a "channels" array.');
  }

  const channels: ChannelMetadataRecord[] = [];
  for (const row of rows.slice(0, 1000)) {
    if (!row || typeof row !== "object") continue;

    const id = readText((row as any).id);
    const name = readText((row as any).name);
    if (!id || !name) continue;

    const type = (row as any).type;
    channels.push({
      id: id.slice(0, 32),
      name: name.slice(0, 100),
      category: readText((row as any).category)?.slice(0, 100),
      type: typeof type === "string" || typeof type === "number" ? type : undefined,
      topic: readText((row as any).topic)?.slice(0, 1024),
      createdAt: readText((row as any).createdAt)?.slice(0, 80),
      lastMessageAt: readText((row as any).lastMessageAt)?.slice(0, 80),
      lastPinAt: readText((row as any).lastPinAt)?.slice(0, 80),
      requiredRoles: Array.isArray((row as any).requiredRoles)
        ? (row as any).requiredRoles.filter((v: unknown) => typeof v === "string").slice(0, 50)
        : undefined,
      requiredUsers: Array.isArray((row as any).requiredUsers)
        ? (row as any).requiredUsers.filter((v: unknown) => typeof v === "string").slice(0, 50)
        : undefined,
      permissionSummary: readText((row as any).permissionSummary)?.slice(0, 1000),
    });
  }

  return channels;
}

function showChannelDetails(channel: ChannelMetadataRecord): void {
  const lines = [
    `Name: ${channel.name}`,
    channel.category ? `Category: ${channel.category}` : undefined,
    channel.type !== undefined ? `Type: ${String(channel.type)}` : undefined,
    channel.topic ? `Topic: ${channel.topic}` : undefined,
    channel.createdAt ? `Created: ${channel.createdAt}` : undefined,
    channel.lastMessageAt ? `Last message: ${channel.lastMessageAt}` : undefined,
    channel.lastPinAt ? `Last pin: ${channel.lastPinAt}` : undefined,
    channel.requiredRoles?.length ? `Roles: ${channel.requiredRoles.join(", ")}` : undefined,
    channel.requiredUsers?.length ? `Users: ${channel.requiredUsers.join(", ")}` : undefined,
    channel.permissionSummary ? `Permissions: ${channel.permissionSummary}` : undefined,
    `ID: ${channel.id}`,
    "",
    "This is imported metadata only. Discord does not provide this plugin with hidden-channel messages.",
  ].filter(Boolean);

  const alert = (RN as any).Alert?.alert;
  if (typeof alert === "function") {
    alert("Channel metadata", lines.join("\n"), [{ text: "Close" }]);
  }
}

export function SettingsComponent({ api }: SettingsProps) {
  const saved = api.jsonStorage.use();
  const settings = saved ?? DEFAULT_SETTINGS;
  const [search, setSearch] = React.useState("");
  const [importText, setImportText] = React.useState("");
  const [error, setError] = React.useState("");

  const filteredChannels = settings.channels.filter((channel) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      channel.name.toLowerCase().includes(term) ||
      (channel.category ?? "").toLowerCase().includes(term) ||
      channel.id.includes(term)
    );
  });

  function toggle(key: "showLockIcon" | "showConfirmation", value: boolean) {
    void api.jsonStorage.set({ [key]: value } as Partial<HiddenChannelsStorage>);
  }

  function importChannels() {
    try {
      const channels = parseMetadata(importText);
      void api.jsonStorage.set({ channels }).then(() => {
        setError("");
        setImportText("");
      }).catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Could not save metadata.");
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid metadata JSON.");
    }
  }

  function openChannel(channel: ChannelMetadataRecord) {
    const alert = (RN as any).Alert?.alert;
    if (settings.showConfirmation && typeof alert === "function") {
      alert(
        "Hidden Channel Metadata",
        "This entry contains metadata supplied to the plugin. It does not grant channel access, and no messages will load.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "View metadata", onPress: () => showChannelDetails(channel) },
        ],
      );
      return;
    }
    showChannelDetails(channel);
  }

  return (
    <RN.ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
      <RN.Text style={{ color: "#f2f3f5", fontSize: 18, fontWeight: "700" }}>
        Hidden Channels
      </RN.Text>
      <RN.Text style={{ color: "#b9bbbe", fontSize: 13, lineHeight: 19 }}>
        Browse channel metadata from a JSON export supplied by a server administrator.
        This plugin does not override Discord permissions, retrieve hidden channel data,
        or load messages.
      </RN.Text>

      <RN.View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <RN.Text style={{ color: "#dcddde", flex: 1 }}>Show lock icon</RN.Text>
        <RN.Switch value={settings.showLockIcon} onValueChange={(value) => toggle("showLockIcon", value)} />
      </RN.View>

      <RN.View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <RN.Text style={{ color: "#dcddde", flex: 1 }}>Show confirmation before viewing metadata</RN.Text>
        <RN.Switch value={settings.showConfirmation} onValueChange={(value) => toggle("showConfirmation", value)} />
      </RN.View>

      <RN.Text style={{ color: "#f2f3f5", fontWeight: "600" }}>Import administrator metadata (JSON)</RN.Text>
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
        onPress={importChannels}
        style={{ backgroundColor: "#5865f2", padding: 12, borderRadius: 8, alignItems: "center" }}
      >
        <RN.Text style={{ color: "#ffffff", fontWeight: "600" }}>Import metadata</RN.Text>
      </RN.Pressable>
      {error ? <RN.Text style={{ color: "#ed4245" }}>{error}</RN.Text> : null}

      <RN.Text style={{ color: "#f2f3f5", fontWeight: "600" }}>
        Imported channels ({settings.channels.length})
      </RN.Text>
      <RN.TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search by channel, category, or ID"
        placeholderTextColor="#72767d"
        style={{ color: "#f2f3f5", backgroundColor: "#2b2d31", borderRadius: 8, padding: 12 }}
      />

      {filteredChannels.length ? filteredChannels.map((channel) => (
        <RN.Pressable
          key={channel.id}
          onPress={() => openChannel(channel)}
          style={{ padding: 12, borderRadius: 8, backgroundColor: "#2b2d31" }}
        >
          <RN.Text style={{ color: "#f2f3f5", fontWeight: "600" }}>
            {settings.showLockIcon ? "🔒 " : ""}{channel.name}
          </RN.Text>
          <RN.Text style={{ color: "#b9bbbe", fontSize: 12 }}>
            {channel.category ?? "No category"} · {String(channel.type ?? "Unknown type")}
          </RN.Text>
        </RN.Pressable>
      )) : (
        <RN.Text style={{ color: "#b9bbbe" }}>
          {settings.channels.length ? "No matching channels." : "No metadata imported yet."}
        </RN.Text>
      )}

      {settings.channels.length ? (
        <RN.Pressable
          onPress={() => {
            void api.jsonStorage.set({ channels: [] }).catch(() => {
              setError("Could not clear imported metadata.");
            });
          }}
          style={{ padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#ed4245", alignItems: "center" }}
        >
          <RN.Text style={{ color: "#ed4245" }}>Clear imported metadata</RN.Text>
        </RN.Pressable>
      ) : null}
    </RN.ScrollView>
  );
}

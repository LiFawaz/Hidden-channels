/// <reference types="@valenced/types" />

import { lookupModule } from "@valenced/modules/finders";
import { withProps } from "@valenced/modules/finders/filters";
import React from "react";
import { Pressable, Text, TextInput, View } from "react-native";

type ChannelMetadata = {
  id?: string;
  name?: string;
  type?: number | string;
  topic?: string | null;
  parent_id?: string | null;
  parentId?: string | null;
  position?: number;
  lastMessageId?: string | null;
  lastPinTimestamp?: string | null;
  permissionOverwrites?: Record<string, { id?: string; type?: number; allow?: unknown; deny?: unknown }>;
};

const snowflakeTimestamp = (id: unknown): number | null => {
  if (typeof id !== "string" || !/^\d{15,22}$/.test(id)) return null;
  try {
    const timestamp = Number((BigInt(id) >> 22n) + 1420070400000n);
    return Number.isFinite(timestamp) ? timestamp : null;
  } catch {
    return null;
  }
};

function dateLabel(value: unknown): string {
  let timestamp: number | null = null;
  if (typeof value === "string" && /^\d{15,22}$/.test(value)) timestamp = snowflakeTimestamp(value);
  else if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value).getTime();
    if (Number.isFinite(parsed)) timestamp = parsed;
  }
  return timestamp === null ? "Unavailable" : new Date(timestamp).toLocaleString();
}

function relativeLabel(value: unknown): string {
  let timestamp: number | null = null;
  if (typeof value === "string" && /^\d{15,22}$/.test(value)) timestamp = snowflakeTimestamp(value);
  else if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value).getTime();
    if (Number.isFinite(parsed)) timestamp = parsed;
  }
  if (timestamp === null) return "Unavailable";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minute(s) ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hour(s) ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)} day(s) ago`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)} month(s) ago`;
  return `${Math.floor(seconds / 31536000)} year(s) ago`;
}

function readable(value: unknown): string {
  if (value === undefined || value === null || value === "") return "Unavailable";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return "Available";
}

function actionButton(label: string, onPress: () => void, primary = false) {
  return React.createElement(
    Pressable,
    {
      onPress,
      style: {
        alignItems: "center",
        padding: 12,
        borderRadius: 8,
        backgroundColor: primary ? "#5865F2" : "transparent",
        borderWidth: primary ? 0 : 1,
        borderColor: "#777",
      },
    },
    React.createElement(Text, { style: { color: primary ? "#fff" : undefined, fontWeight: "600" } }, label)
  );
}

export default plugin(function () {
  function SettingsPanel() {
    const [channelId, setChannelId] = React.useState("");
    const [status, setStatus] = React.useState("Enter a channel ID to inspect metadata already cached on this device.");
    const [channel, setChannel] = React.useState<ChannelMetadata | null>(null);
    const [showDetails, setShowDetails] = React.useState(false);

    function inspectChannel() {
      const id = channelId.trim();
      setChannel(null);
      setShowDetails(false);

      if (!/^\d{15,22}$/.test(id)) {
        setStatus("Enter a valid Discord channel ID.");
        return;
      }

      try {
        const found = lookupModule(withProps("getChannel"));
        const store = found.length ? (found[0] as { getChannel?: (channelId: string) => ChannelMetadata | undefined }) : undefined;
        const result = store?.getChannel?.(id);

        if (!result) {
          setStatus("No metadata for that ID exists in the local client cache. The plugin cannot discover channel data the client has not received.");
          return;
        }

        setChannel(result);
        setStatus("Cached channel metadata found. Select View anyways to open the details-only panel.");
      } catch (error) {
        console.warn("[HiddenChannels] Local metadata lookup failed:", error);
        setStatus("The local channel store could not be queried on this Valenced build.");
      }
    }

    function cancelDetails() {
      setShowDetails(false);
      setChannel(null);
      setStatus("Closed. No changes were made.");
    }

    const parentId = channel?.parent_id ?? channel?.parentId;
    const overwriteEntries = channel?.permissionOverwrites ? Object.values(channel.permissionOverwrites) : [];

    if (showDetails && channel) {
      return React.createElement(
        View,
        { style: { padding: 16, gap: 12 } },
        React.createElement(Text, { style: { fontSize: 20, fontWeight: "700" } }, "This channel is hidden."),
        React.createElement(Text, { style: { fontSize: 16, fontWeight: "600" } }, `#${readable(channel.name)}`),
        React.createElement(Text, null, `Topic: ${readable(channel.topic)}`),
        React.createElement(Text, null, `Category ID: ${readable(parentId)}`),
        React.createElement(Text, null, `Channel order: ${readable(channel.position)}`),
        React.createElement(Text, null, `Creation date: ${dateLabel(channel.id)}`),
        React.createElement(Text, null, `Last message: ${channel.lastMessageId ? relativeLabel(channel.lastMessageId) + " (" + dateLabel(channel.lastMessageId) + ")" : "Unavailable"}`),
        React.createElement(Text, null, `Last pin: ${channel.lastPinTimestamp ? relativeLabel(channel.lastPinTimestamp) + " (" + dateLabel(channel.lastPinTimestamp) + ")" : "Unavailable"}`),
        React.createElement(Text, { style: { fontWeight: "600", marginTop: 4 } }, "Permission diagnostics"),
        React.createElement(
          Text,
          { style: { opacity: 0.85 } },
          overwriteEntries.length
            ? "Permission overwrite entries cached by the client (IDs only; role/user names may not be available):"
            : "No permission overwrite metadata is available in the cached channel object."
        ),
        ...overwriteEntries.slice(0, 30).map((entry, index) =>
          React.createElement(
            Text,
            { key: `overwrite-${index}`, style: { fontSize: 13 } },
            `• ${entry.type === 0 ? "Role" : entry.type === 1 ? "User" : "Target"} ID: ${readable(entry.id)} | allow: ${readable(entry.allow)} | deny: ${readable(entry.deny)}`
          )
        ),
        React.createElement(Text, { style: { opacity: 0.75, marginTop: 4 } }, "This screen only displays metadata already present in the client cache. It does not load messages or bypass channel permissions. Missing fields cannot be inferred."),
        actionButton("Cancel", cancelDetails)
      );
    }

    return React.createElement(
      View,
      { style: { padding: 16, gap: 12 } },
      React.createElement(Text, { style: { fontSize: 20, fontWeight: "700" } }, "Hidden Channels"),
      React.createElement(Text, { style: { opacity: 0.8 } }, "Details-only channel metadata preview. Channels not present in the local cache cannot be discovered by this screen."),
      React.createElement(TextInput, {
        value: channelId,
        onChangeText: setChannelId,
        placeholder: "Discord channel ID",
        keyboardType: "number-pad",
        autoCapitalize: "none",
        autoCorrect: false,
        style: { borderWidth: 1, borderColor: "#777", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
      }),
      actionButton("Inspect cached metadata", inspectChannel, true),
      React.createElement(Text, { style: { opacity: 0.9 } }, status),
      channel
        ? React.createElement(
            View,
            { style: { borderWidth: 1, borderColor: "#777", borderRadius: 8, padding: 12, gap: 8 } },
            React.createElement(Text, { style: { fontSize: 16, fontWeight: "600" } }, `#${readable(channel.name)}`),
            React.createElement(Text, { style: { opacity: 0.8 } }, `Category ID: ${readable(channel.parent_id ?? channel.parentId)} · Position: ${readable(channel.position)}`),
            actionButton("View anyways", () => setShowDetails(true), true),
            actionButton("Cancel", cancelDetails)
          )
        : null
    );
  }

  return { settingsComponent: SettingsPanel };
});

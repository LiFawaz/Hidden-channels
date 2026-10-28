/// <reference types="@valenced/types" />

import { lookupModule } from "@valenced/modules/finders";
import { withProps } from "@valenced/modules/finders/filters";
import React from "react";
import { Pressable, Text, TextInput, View } from "react-native";

function snowflakeDate(id: unknown): string {
  if (typeof id !== "string" || !/^\d{15,22}$/.test(id)) return "Unavailable";

  try {
    const timestamp = Number((BigInt(id) >> 22n) + 1420070400000n);
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString();
  } catch {
    return "Unavailable";
  }
}

function readable(value: unknown): string {
  if (value === undefined || value === null || value === "") return "Unavailable";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "Available";
}

export default plugin(function () {
  function SettingsPanel() {
    const [channelId, setChannelId] = React.useState("");
    const [status, setStatus] = React.useState(
      "Enter a channel ID to inspect metadata already cached on this device."
    );
    const [details, setDetails] = React.useState<string[]>([]);

    function inspectChannel() {
      const id = channelId.trim();
      setDetails([]);

      if (!/^\d{15,22}$/.test(id)) {
        setStatus("Enter a valid Discord channel ID.");
        return;
      }

      try {
        const found = lookupModule(withProps("getChannel"));
        const channelStore = found.length
          ? (found[0] as { getChannel?: (channelId: string) => any })
          : undefined;
        const channel = channelStore?.getChannel?.(id);

        if (!channel) {
          setStatus(
            "No channel metadata for that ID was found in the local cache. This plugin does not fetch restricted channel data."
          );
          return;
        }

        const created = snowflakeDate(String(channel.id ?? id));
        const lastMessage = channel.lastMessageId
          ? snowflakeDate(String(channel.lastMessageId))
          : "Unavailable";

        setDetails([
          `Name: ${readable(channel.name)}`,
          `Channel ID: ${readable(channel.id ?? id)}`,
          `Type: ${readable(channel.type)}`,
          `Topic: ${readable(channel.topic)}`,
          `Created: ${created}`,
          `Last message timestamp: ${lastMessage}`,
          `Last pin timestamp: ${readable(channel.lastPinTimestamp)}`,
        ]);
        setStatus("Showing metadata that is already available in the local client cache.");
      } catch (error) {
        console.warn("[HiddenChannels] Local metadata lookup failed:", error);
        setStatus("The local channel store could not be queried on this Valenced build.");
      }
    }

    return React.createElement(
      View,
      { style: { padding: 16, gap: 12 } },
      React.createElement(
        Text,
        { style: { fontSize: 18, fontWeight: "600" } },
        "Local channel metadata"
      ),
      React.createElement(
        Text,
        { style: { opacity: 0.8 } },
        "Look up a channel object already cached by the client. This does not override permissions, list inaccessible channels, or load restricted messages."
      ),
      React.createElement(TextInput, {
        value: channelId,
        onChangeText: setChannelId,
        placeholder: "Discord channel ID",
        keyboardType: "number-pad",
        autoCapitalize: "none",
        autoCorrect: false,
        style: {
          borderWidth: 1,
          borderColor: "#777",
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
        },
      }),
      React.createElement(
        Pressable,
        {
          onPress: inspectChannel,
          style: {
            alignItems: "center",
            padding: 12,
            borderRadius: 8,
            backgroundColor: "#5865F2",
          },
        },
        React.createElement(
          Text,
          { style: { color: "#fff", fontWeight: "600" } },
          "Inspect cached metadata"
        )
      ),
      React.createElement(Text, { style: { opacity: 0.9 } }, status),
      ...details.map((line, index) =>
        React.createElement(
          Text,
          { key: `metadata-${index}`, style: { fontSize: 14 } },
          line
        )
      )
    );
  }

  return {
    settingsComponent: SettingsPanel,
  };
});

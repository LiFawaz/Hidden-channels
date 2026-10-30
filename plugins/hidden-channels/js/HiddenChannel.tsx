import { React, ReactNative as RN } from "@valenced/react";
import type { ChannelMetadataRecord } from "./settings";
import AlertContent from "./AlertContent";

interface HiddenChannelProps {
  channel: ChannelMetadataRecord;
  onClose: () => void;
}

export default function HiddenChannel({ channel, onClose }: HiddenChannelProps) {
  const origin = channel.source === "cache"
    ? "This entry was read from Discord's local client cache."
    : "This entry was imported as administrator-provided metadata.";

  return (
    <RN.View
      style={{
        padding: 16,
        borderRadius: 10,
        backgroundColor: "#2b2d31",
        borderWidth: 1,
        borderColor: "#45474e",
        gap: 12,
      }}
    >
      <RN.View style={{ gap: 4 }}>
        <RN.Text style={{ color: "#f2f3f5", fontSize: 20, fontWeight: "700" }}>
          This channel is hidden.
        </RN.Text>
        <RN.Text style={{ color: "#b9bbbe", fontSize: 13, lineHeight: 19 }}>
          {origin} Discord permissions remain unchanged. This view cannot open the channel
          or retrieve its messages.
        </RN.Text>
      </RN.View>

      <RN.Text style={{ color: "#f2f3f5", fontSize: 16, fontWeight: "600" }}>
        #{channel.name}
      </RN.Text>
      {channel.category ? (
        <RN.Text style={{ color: "#b9bbbe", fontSize: 12 }}>
          {channel.category}
        </RN.Text>
      ) : null}

      <RN.View style={{ height: 1, backgroundColor: "#45474e" }} />
      <AlertContent channel={channel} />

      <RN.Pressable
        onPress={onClose}
        style={{
          padding: 11,
          borderRadius: 8,
          backgroundColor: "#3f4147",
          alignItems: "center",
        }}
      >
        <RN.Text style={{ color: "#ffffff", fontWeight: "600" }}>Close</RN.Text>
      </RN.Pressable>
    </RN.View>
  );
}

import { Pressable, Text, View } from "react-native";
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
    <View
      style={{
        padding: 16,
        borderRadius: 10,
        backgroundColor: "#2b2d31",
        borderWidth: 1,
        borderColor: "#45474e",
        gap: 12,
      }}
    >
      <View style={{ gap: 4 }}>
        <Text style={{ color: "#f2f3f5", fontSize: 20, fontWeight: "700" }}>
          This channel is hidden.
        </Text>
        <Text style={{ color: "#b9bbbe", fontSize: 13, lineHeight: 19 }}>
          {origin} This view cannot open the channel or retrieve its messages. Server-side permissions
          remain unchanged. Server-side permissions are unchanged.
        </Text>
      </View>

      <Text style={{ color: "#f2f3f5", fontSize: 16, fontWeight: "600" }}>
        #{channel.name}
      </Text>
      {channel.category ? (
        <Text style={{ color: "#b9bbbe", fontSize: 12 }}>
          {channel.category}
        </Text>
      ) : null}

      <View style={{ height: 1, backgroundColor: "#45474e" }} />
      <AlertContent channel={channel} />

      <Pressable
        onPress={onClose}
        style={{
          padding: 11,
          borderRadius: 8,
          backgroundColor: "#3f4147",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#ffffff", fontWeight: "600" }}>Close</Text>
      </Pressable>
    </View>
  );
}

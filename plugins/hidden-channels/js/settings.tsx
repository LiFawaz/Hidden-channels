import { useState, type ComponentProps } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { scanCachedHiddenChannels, type ChannelScanResult } from "./channel-scan";
import type { PluginSettingsComponent } from "@valenced/plugins/types";

export interface ChannelMetadataRecord {
  id: string;
  name: string;
  type?: number;
  source?: "cache";
  category?: string;
  topic?: string;
  createdAt?: string;
  lastMessageAt?: string;
  lastPinAt?: string;
}

export interface HiddenChannelsStorage {
  showLockIcon: boolean;
  showConfirmation: boolean;
}

export const DEFAULT_SETTINGS: HiddenChannelsStorage = {
  showLockIcon: true,
  showConfirmation: true,
};

type PluginOptions = { jsonStorage: HiddenChannelsStorage };
type Props = ComponentProps<PluginSettingsComponent<PluginOptions>>;

function formatDate(value?: string): string {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Not available";
}

export function SettingsComponent({ api: { jsonStorage: storage } }: Props) {
  const saved = storage.use();
  const showLockIcon = saved.showLockIcon ?? DEFAULT_SETTINGS.showLockIcon;
  const showConfirmation = saved.showConfirmation ?? DEFAULT_SETTINGS.showConfirmation;
  const [scan, setScan] = useState<ChannelScanResult | null>(null);

  const runScan = () => setScan(scanCachedHiddenChannels());

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={{ color: "#f2f3f5", fontSize: 20, fontWeight: "700" }}>
        Hidden Channels
      </Text>
      <Text style={{ color: "#b9bbbe", fontSize: 13, lineHeight: 19 }}>
        Scan channel metadata already cached on this device. This does not grant
        access, open channels, or retrieve messages. Discord's real permissions
        remain unchanged.
      </Text>

      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: "#dcddde", fontWeight: "600" }}>Show Lock Icon</Text>
            <Text style={{ color: "#b9bbbe", fontSize: 12 }}>
              Mark hidden entries with a lock label in this list.
            </Text>
          </View>
          <Switch
            value={showLockIcon}
            onValueChange={(value) => void storage.set({ showLockIcon: value })}
          />
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: "#dcddde", fontWeight: "600" }}>Show Confirmation</Text>
            <Text style={{ color: "#b9bbbe", fontSize: 12 }}>
              Show a warning if a hidden channel navigation is attempted.
            </Text>
          </View>
          <Switch
            value={showConfirmation}
            onValueChange={(value) => void storage.set({ showConfirmation: value })}
          />
        </View>
      </View>

      <Pressable
        onPress={runScan}
        style={{ padding: 12, borderRadius: 8, backgroundColor: "#5865f2", alignItems: "center" }}
      >
        <Text style={{ color: "#ffffff", fontWeight: "700" }}>Scan Cached Channels</Text>
      </Pressable>

      {scan ? (
        <View style={{ gap: 10 }}>
          <Text style={{ color: "#f2f3f5", fontWeight: "700" }}>
            Found {scan.channels.length} hidden channel(s) · scanned {scan.scanned}
          </Text>
          {scan.error ? (
            <Text style={{ color: "#ed4245" }}>{scan.error}</Text>
          ) : null}
          {scan.channels.map((channel) => (
            <View key={channel.id} style={{ padding: 12, borderRadius: 8, backgroundColor: "#2b2d31", gap: 5 }}>
              <Text style={{ color: "#f2f3f5", fontWeight: "700" }}>
                {showLockIcon ? "LOCKED · " : ""}#{channel.name}
              </Text>
              {channel.category ? <Text style={{ color: "#b9bbbe" }}>Category: {channel.category}</Text> : null}
              {channel.topic ? <Text style={{ color: "#b9bbbe" }}>Topic: {channel.topic}</Text> : null}
              <Text style={{ color: "#b9bbbe", fontSize: 12 }}>Created: {formatDate(channel.createdAt)}</Text>
              <Text style={{ color: "#b9bbbe", fontSize: 12 }}>Last message: {formatDate(channel.lastMessageAt)}</Text>
              <Text style={{ color: "#b9bbbe", fontSize: 12 }}>Last pin: {formatDate(channel.lastPinAt)}</Text>
              <Text selectable style={{ color: "#72767d", fontSize: 11 }}>ID: {channel.id}</Text>
            </View>
          ))}
          {!scan.error && scan.channels.length === 0 ? (
            <Text style={{ color: "#b9bbbe" }}>No hidden cached channels were found.</Text>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

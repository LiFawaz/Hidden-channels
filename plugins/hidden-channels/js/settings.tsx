import type { ComponentProps } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import type { PluginSettingsComponent } from "@valenced/plugins/types";

export interface ChannelMetadataRecord {
  id: string;
  name: string;
  category?: string;
  type?: string | number;
  topic?: string;
  createdAt?: string;
  lastMessageAt?: string;
  lastPinAt?: string;
  source?: "cache";
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

export function SettingsComponent({ api: { jsonStorage: storage } }: Props) {
  const saved = storage.use();
  const showLockIcon = saved.showLockIcon ?? DEFAULT_SETTINGS.showLockIcon;
  const showConfirmation = saved.showConfirmation ?? DEFAULT_SETTINGS.showConfirmation;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={{ color: "#f2f3f5", fontSize: 20, fontWeight: "700" }}>
        Hidden Channels
      </Text>
      <Text style={{ color: "#b9bbbe", fontSize: 13, lineHeight: 19 }}>
        Hidden channels are detected automatically from Discord's local channel
        data. No channel IDs, JSON imports, or manual scans are required.
        Channels remain inaccessible: navigation and message fetching are blocked.
      </Text>

      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: "#dcddde", fontWeight: "600" }}>Show Lock Icon</Text>
            <Text style={{ color: "#b9bbbe", fontSize: 12 }}>
              Show a lock beside hidden channel names.
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
              Show a warning when a hidden channel is selected.
            </Text>
          </View>
          <Switch
            value={showConfirmation}
            onValueChange={(value) => void storage.set({ showConfirmation: value })}
          />
        </View>
      </View>
    </ScrollView>
  );
}

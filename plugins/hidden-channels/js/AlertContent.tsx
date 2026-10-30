import { Text, View } from "react-native";
import type { ChannelMetadataRecord } from "./settings";

interface AlertContentProps {
  channel: ChannelMetadataRecord;
}

function asDate(value: string | undefined): Date | null {
  if (!value) return null;

  if (/^\d{15,22}$/.test(value)) {
    try {
      const date = new Date(Number((BigInt(value) >> 22n) + 1_420_070_400_000n));
      return Number.isFinite(date.getTime()) ? date : null;
    } catch {
      return null;
    }
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function formatDate(value: string | undefined): string {
  const date = asDate(value);
  if (!date) return value ? "Unknown date" : "Not available";

  try {
    return date.toLocaleString();
  } catch {
    return date.toISOString();
  }
}

interface DetailRowProps {
  label: string;
  value: string;
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <View style={{ gap: 3, paddingVertical: 5 }}>
      <Text style={{ color: "#b9bbbe", fontSize: 12, fontWeight: "600" }}>
        {label}
      </Text>
      <Text selectable style={{ color: "#f2f3f5", fontSize: 14, lineHeight: 20 }}>
        {value}
      </Text>
    </View>
  );
}

export default function AlertContent({ channel }: AlertContentProps) {
  return (
    <View style={{ gap: 4 }}>
      <DetailRow label="Topic" value={channel.topic || "No topic."} />
      <DetailRow label="Creation date" value={formatDate(channel.createdAt)} />
      <DetailRow label="Last message" value={formatDate(channel.lastMessageAt)} />
      <DetailRow label="Last pin" value={formatDate(channel.lastPinAt)} />
      {channel.requiredRoles?.length ? (
        <DetailRow label="Required roles (imported note)" value={channel.requiredRoles.join(", ")} />
      ) : null}
      {channel.requiredUsers?.length ? (
        <DetailRow label="Required users (imported note)" value={channel.requiredUsers.join(", ")} />
      ) : null}
      {channel.permissionSummary ? (
        <DetailRow label="Permission summary (imported note)" value={channel.permissionSummary} />
      ) : null}
      <DetailRow label="Channel ID" value={channel.id} />
    </View>
  );
}

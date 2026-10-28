/// <reference types="@valenced/types" />

import React from "react";
import { Pressable, Text, TextInput, View, ScrollView } from "react-native";

type ChannelRecord = {
  id: string;
  name: string;
  category?: string;
  categoryId?: string;
  position?: number;
  topic?: string;
  createdAt?: string | number;
  lastMessageAt?: string | number;
  lastPinAt?: string | number;
  requiredRoles?: string[];
  requiredUsers?: string[];
  permissionSummary?: string;
};

function timestamp(value: unknown): number | null {
  if (typeof value === "string" && /^\d{15,22}$/.test(value)) {
    try { return Number((BigInt(value) >> 22n) + 1420070400000n); } catch { return null; }
  }
  if (typeof value === "string" || typeof value === "number") {
    const n = new Date(value).getTime();
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function dateLabel(value: unknown): string {
  const n = timestamp(value);
  return n === null ? "Unavailable" : new Date(n).toLocaleString();
}

function relativeLabel(value: unknown): string {
  const n = timestamp(value);
  if (n === null) return "Unavailable";
  const s = Math.max(0, Math.floor((Date.now() - n) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " minute(s) ago";
  if (s < 86400) return Math.floor(s / 3600) + " hour(s) ago";
  if (s < 2592000) return Math.floor(s / 86400) + " day(s) ago";
  if (s < 31536000) return Math.floor(s / 2592000) + " month(s) ago";
  return Math.floor(s / 31536000) + " year(s) ago";
}

function textValue(value: unknown): string {
  return value === undefined || value === null || value === "" ? "Unavailable" : String(value);
}

function button(label: string, onPress: () => void, primary = false) {
  return React.createElement(Pressable, {
    onPress,
    style: {
      alignItems: "center",
      padding: 12,
      borderRadius: 8,
      backgroundColor: primary ? "#5865F2" : "transparent",
      borderWidth: primary ? 0 : 1,
      borderColor: "#777",
    },
  }, React.createElement(Text, {
    style: { color: primary ? "#fff" : undefined, fontWeight: "600" },
  }, label));
}

function parseExport(raw: string): ChannelRecord[] {
  const parsed = JSON.parse(raw);
  const rows = Array.isArray(parsed) ? parsed : parsed.channels;
  if (!Array.isArray(rows)) throw new Error('Expected an array of channels or an object with a "channels" array.');
  return rows.map((row: any, i: number) => {
    if (!row || typeof row !== "object" || typeof row.id !== "string" || typeof row.name !== "string") {
      throw new Error(`Channel entry ${i + 1} needs string fields "id" and "name".`);
    }
    return {
      id: row.id,
      name: row.name,
      category: typeof row.category === "string" ? row.category : undefined,
      categoryId: typeof row.categoryId === "string" ? row.categoryId : undefined,
      position: typeof row.position === "number" ? row.position : undefined,
      topic: typeof row.topic === "string" ? row.topic : undefined,
      createdAt: row.createdAt ?? row.created_at ?? row.id,
      lastMessageAt: row.lastMessageAt ?? row.last_message_at ?? row.lastMessageId ?? row.last_message_id,
      lastPinAt: row.lastPinAt ?? row.last_pin_at ?? row.lastPinTimestamp ?? row.last_pin_timestamp,
      requiredRoles: Array.isArray(row.requiredRoles) ? row.requiredRoles.map(String) : Array.isArray(row.required_roles) ? row.required_roles.map(String) : undefined,
      requiredUsers: Array.isArray(row.requiredUsers) ? row.requiredUsers.map(String) : Array.isArray(row.required_users) ? row.required_users.map(String) : undefined,
      permissionSummary: typeof row.permissionSummary === "string" ? row.permissionSummary : typeof row.permission_summary === "string" ? row.permission_summary : undefined,
    } as ChannelRecord;
  }).sort((a: ChannelRecord, b: ChannelRecord) =>
    (a.category ?? "").localeCompare(b.category ?? "") ||
    (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) ||
    a.name.localeCompare(b.name)
  );
}

export default plugin(function () {
  function SettingsPanel() {
    const [rawExport, setRawExport] = React.useState("");
    const [channels, setChannels] = React.useState<ChannelRecord[]>([]);
    const [selected, setSelected] = React.useState<ChannelRecord | null>(null);
    const [status, setStatus] = React.useState("Import a channel metadata export provided by a server administrator to browse channels and their details.");
    const [filter, setFilter] = React.useState("");

    function loadExport() {
      try {
        const rows = parseExport(rawExport);
        setChannels(rows);
        setSelected(null);
        setStatus(`Loaded ${rows.length} channel metadata record(s). No messages were imported or displayed.`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not parse the metadata export.");
      }
    }

    function cancel() {
      setSelected(null);
    }

    const visible = channels.filter((c) =>
      (c.name + " " + (c.category ?? "") + " " + c.id).toLowerCase().includes(filter.toLowerCase())
    );
    const groups = visible.reduce<Record<string, ChannelRecord[]>>((acc, c) => {
      const key = c.category || "Uncategorized";
      (acc[key] ||= []).push(c);
      return acc;
    }, {});

    if (selected) {
      return React.createElement(ScrollView, { contentContainerStyle: { padding: 16, gap: 12 } },
        React.createElement(Text, { style: { fontSize: 20, fontWeight: "700" } }, "This channel is hidden."),
        React.createElement(Text, { style: { fontSize: 17, fontWeight: "600" } }, "#" + selected.name),
        React.createElement(Text, null, "Category: " + textValue(selected.category)),
        React.createElement(Text, null, "Category ID: " + textValue(selected.categoryId)),
        React.createElement(Text, null, "Channel order: " + textValue(selected.position)),
        React.createElement(Text, null, "Topic: " + textValue(selected.topic)),
        React.createElement(Text, null, "Creation date: " + dateLabel(selected.createdAt)),
        React.createElement(Text, null, "Last message: " + relativeLabel(selected.lastMessageAt)),
        React.createElement(Text, null, "Last pin: " + relativeLabel(selected.lastPinAt)),
        React.createElement(Text, { style: { fontWeight: "700", marginTop: 4 } }, "Access requirements"),
        React.createElement(Text, null, "Required roles: " + (selected.requiredRoles?.join(", ") || "Unavailable")),
        React.createElement(Text, null, "Required users: " + (selected.requiredUsers?.join(", ") || "Unavailable")),
        React.createElement(Text, null, "Permission notes: " + textValue(selected.permissionSummary)),
        React.createElement(Text, { style: { opacity: 0.75 } }, "Details come only from the imported metadata export. This screen never fetches or displays channel messages. Cancel closes this panel without changing the list."),
        button("View anyways", () => setStatus("Details-only mode: message content remains unavailable."), true),
        button("Cancel", cancel)
      );
    }

    return React.createElement(ScrollView, { contentContainerStyle: { padding: 16, gap: 12 } },
      React.createElement(Text, { style: { fontSize: 20, fontWeight: "700" } }, "Hidden Channels"),
      React.createElement(Text, { style: { opacity: 0.8 } }, "Browse channel metadata in category and position order. To include channels your client cannot see, import a metadata export supplied by an administrator; this plugin will not bypass Discord permissions."),
      React.createElement(TextInput, {
        value: rawExport,
        onChangeText: setRawExport,
        placeholder: 'Paste authorized JSON export: {"channels":[{"id":"...","name":"...","category":"...","position":0,"topic":"..."}]}',
        multiline: true,
        autoCapitalize: "none",
        autoCorrect: false,
        textAlignVertical: "top",
        style: { minHeight: 130, borderWidth: 1, borderColor: "#777", borderRadius: 8, padding: 12 },
      }),
      button("Load channel metadata", loadExport, true),
      React.createElement(Text, { style: { opacity: 0.9 } }, status),
      channels.length ? React.createElement(TextInput, {
        value: filter,
        onChangeText: setFilter,
        placeholder: "Search channel or category",
        autoCapitalize: "none",
        style: { borderWidth: 1, borderColor: "#777", borderRadius: 8, padding: 10 },
      }) : null,
      ...Object.keys(groups).map((category) => React.createElement(View, { key: category, style: { gap: 8, marginTop: 8 } },
        React.createElement(Text, { style: { fontSize: 16, fontWeight: "700" } }, category),
        ...groups[category].map((c) => React.createElement(Pressable, {
          key: c.id,
          onPress: () => setSelected(c),
          style: { padding: 12, borderWidth: 1, borderColor: "#777", borderRadius: 8, gap: 3 },
        },
          React.createElement(Text, { style: { fontWeight: "600" } }, "#" + c.name),
          React.createElement(Text, { style: { opacity: 0.75, fontSize: 12 } }, "Position " + textValue(c.position) + " · " + c.id),
          React.createElement(Text, { style: { opacity: 0.75, fontSize: 12 } }, "Tap to view details only")
        ))
      ))
    );
  }

  return { settingsComponent: SettingsPanel };
});

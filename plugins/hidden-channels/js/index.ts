/// <reference types="@valenced/types" />

import React from "react";
import { Pressable, Text, TextInput, View, ScrollView } from "react-native";

declare const bunny: any;

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

function discoverClientChannels(): { channels: ChannelRecord[]; source: string } {
  // Read-only discovery from Discord's existing client cache. Never alters permissions
  // or asks Discord for data the current account is not allowed to receive.
  try {
    const metro = typeof bunny !== "undefined" ? bunny?.metro : undefined;
    if (!metro || typeof metro.findByProps !== "function") {
      return { channels: [], source: "Valenced module access is unavailable in this runtime." };
    }

    const store = metro.findByProps("getChannels");
    if (!store || typeof store.getChannels !== "function") {
      return { channels: [], source: "Discord's channel cache could not be located." };
    }

    const root = store.getChannels();
    const found = new Map<string, any>();
    const seen = new WeakSet<object>();
    let visited = 0;
    const walk = (value: any, depth: number) => {
      if (!value || typeof value !== "object" || depth > 9 || visited > 50000) return;
      if (seen.has(value)) return;
      seen.add(value);
      visited++;
      if (!Array.isArray(value) && typeof value.id === "string" &&
          (/^\d{15,22}$/.test(value.id)) &&
          (typeof value.type === "number" || typeof value.type === "string") &&
          (value.name == null || typeof value.name === "string") &&
          (typeof value.guild_id === "string" || typeof value.guildId === "string" ||
           typeof value.parent_id === "string" || typeof value.parentId === "string" ||
           typeof value.name === "string")) {
        found.set(value.id, value);
      }
      if (value instanceof Map) {
        for (const [key, child] of value.entries()) { walk(child, depth + 1); if (visited > 50000) break; }
      } else if (Array.isArray(value)) {
        for (const child of value) { walk(child, depth + 1); if (visited > 50000) break; }
      } else {
        for (const key of Object.keys(value)) {
          let child: any;
          try { child = value[key]; } catch { continue; }
          walk(child, depth + 1);
          if (visited > 50000) break;
        }
      }
    };
    walk(root, 0);

    const channels = Array.from(found.values()).map((channel: any) => {
      const parentId = channel.parent_id ?? channel.parentId;
      const parent = parentId ? found.get(String(parentId)) : undefined;
      const guildId = channel.guild_id ?? channel.guildId;
      const isWithheld = typeof channel.name !== "string" ||
        /^(no access|unknown channel|private channel)$/i.test(channel.name.trim());
      return {
        id: String(channel.id),
        name: isWithheld ? "No Access" : channel.name,
        category: parent?.name ?? (typeof channel.category === "string" ? channel.category : undefined),
        categoryId: parentId ? String(parentId) : undefined,
        position: typeof channel.position === "number" ? channel.position : undefined,
        topic: typeof channel.topic === "string" ? channel.topic : undefined,
        createdAt: channel.id,
        lastMessageAt: channel.lastMessageId ?? channel.last_message_id,
        lastPinAt: channel.lastPinTimestamp ?? channel.last_pin_timestamp,
        permissionSummary: isWithheld
          ? "Discord supplied a placeholder; the real name and withheld fields are unavailable."
          : (guildId ? "Found in the current client cache. Visibility and metadata depend on Discord's response." : undefined),
      } as ChannelRecord;
    }).sort((a, b) =>
      (a.category ?? "").localeCompare(b.category ?? "") ||
      (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) ||
      a.name.localeCompare(b.name)
    );
    return { channels, source: `Scanned the existing client cache and found ${channels.length} channel record(s).` };
  } catch (error) {
    return {
      channels: [],
      source: error instanceof Error ? `Channel cache scan failed: ${error.message}` : "Channel cache scan failed.",
    };
  }
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
  const parsed: unknown = JSON.parse(raw);
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && "channels" in parsed
      ? (parsed as { channels?: unknown }).channels
      : undefined;
  if (!Array.isArray(rows)) throw new Error('Expected a JSON array or an object with a "channels" array.');
  const seenIds = new Set<string>();
  const normalized = rows.map((row: any, i: number) => {
    if (!row || typeof row !== "object" || Array.isArray(row) || typeof row.id !== "string" || !row.id.trim() || typeof row.name !== "string" || !row.name.trim()) {
      throw new Error(`Channel entry ${i + 1} needs non-empty string fields "id" and "name".`);
    }
    if (seenIds.has(row.id)) throw new Error(`Duplicate channel ID "${row.id}" in the metadata export.`);
    seenIds.add(row.id);
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
  });
  return normalized.sort((a: ChannelRecord, b: ChannelRecord) =>
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
    const [detailOnly, setDetailOnly] = React.useState(false);
    const [status, setStatus] = React.useState("Scanning Discord's existing client channel cache…");
    const [filter, setFilter] = React.useState("");

    function scanClientCache() {
      const result = discoverClientChannels();
      setChannels(result.channels);
      setSelected(null);
      setDetailOnly(false);
      setStatus(result.source + (result.channels.some((c) => c.name === "No Access")
        ? " Some entries are placeholders; this scan cannot recover names Discord withheld."
        : "") + " Only data already present in the client cache is listed.");
    }

    React.useEffect(() => {
      scanClientCache();
    }, []);

    function loadExport() {
      try {
        const rows = parseExport(rawExport);
        setChannels(rows);
        setSelected(null);
        const withheld = rows.filter((channel) => channel.name.trim().toLowerCase() === "no access").length;
        setStatus(
          `Loaded ${rows.length} metadata record(s). No messages were imported or displayed.` +
          (withheld ? ` ${withheld} record(s) are named "No Access": Discord did not provide their real names in this export, so this plugin cannot recover those names from the placeholder.` : "")
        );
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not parse the metadata export.");
      }
    }

    function cancel() {
      setSelected(null);
      setDetailOnly(false);
    }

    function loadExample() {
      setRawExport(JSON.stringify({ channels: [{ id: "123456789012345678", name: "example-hidden-channel", category: "Example category", categoryId: "123456789012345670", position: 0, topic: "Example topic supplied by an administrator", createdAt: "2024-01-01T12:00:00Z", lastMessageAt: "2024-01-02T12:00:00Z", lastPinAt: null, requiredRoles: ["Example role"], requiredUsers: [], permissionSummary: "Example only; replace with authorized metadata." }] }, null, 2));
      setStatus("Example data loaded. Press Load channel metadata to preview the details screen.");
    }

    function clearData() {
      setRawExport("");
      setChannels([]);
      setSelected(null);
      setDetailOnly(false);
      setFilter("");
      setStatus("Cleared imported metadata.");
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
        React.createElement(Text, { style: { fontSize: 20, fontWeight: "700" } }, selected.name.trim().toLowerCase() === "no access" ? "Discord withheld this channel's metadata." : "Channel details"),
        React.createElement(Text, { style: { fontSize: 17, fontWeight: "600" } }, "#" + selected.name),
        selected.name.trim().toLowerCase() === "no access"
          ? React.createElement(Text, { style: { opacity: 0.85 } }, "This is a placeholder, not the channel's real name. The actual name and details were not present in the imported data.")
          : null,
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
        detailOnly ? React.createElement(Text, { style: { padding: 10, borderRadius: 8, backgroundColor: "rgba(88,101,242,0.15)" } }, "Details-only view is active. No channel navigation or message request was made.") : null,
        button("View anyways", () => setDetailOnly(true), true),
        button("Cancel", cancel)
      );
    }

    return React.createElement(ScrollView, { contentContainerStyle: { padding: 16, gap: 12 } },
      React.createElement(Text, { style: { fontSize: 20, fontWeight: "700" } }, "Hidden Channels"),
      React.createElement(Text, { style: { opacity: 0.8 } }, "Automatically scans the channel records Discord has already supplied to this client, including placeholder records when present. It cannot recover names or metadata Discord withheld and does not bypass permissions."),
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
      button("Scan client channel cache", scanClientCache, true),
      button("Load channel metadata", loadExport),
      button("Load example data", loadExample),
      channels.length ? button("Clear imported data", clearData) : null,
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

  return { SettingsComponent: SettingsPanel };
});

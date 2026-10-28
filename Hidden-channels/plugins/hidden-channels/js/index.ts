/// <reference types="@valenced/types" />

import { after, before } from "@valenced/patcher";
import { lookupByProps, lookupByName } from "@valenced/modules/finders";
import React from "react";

// ─── Permission bit for VIEW_CHANNEL ─────────────────────────────────────────
// Discord uses BigInt for permission flags on mobile
const VIEW_CHANNEL = 1024n;

// ─── Runtime state ────────────────────────────────────────────────────────────
// Channels the client received metadata for but the user can't actually enter.
// Populated by the after-hook on PermissionStore.can.
const hiddenChannelIds = new Set<string>();

export function isHiddenChannel(channelId: string): boolean {
  return hiddenChannelIds.has(channelId);
}

// ─── Settings defaults ────────────────────────────────────────────────────────
interface HiddenChannelSettings {
  showLockIcon: boolean;
  showConfirmation: boolean;
}

const DEFAULT_SETTINGS: HiddenChannelSettings = {
  showLockIcon: true,
  showConfirmation: true,
};

// ─── Plugin ───────────────────────────────────────────────────────────────────
export default plugin(function ({ storage }) {
  // Persistent settings — survives Valenced restarts
  const settings = storage.createProxy<HiddenChannelSettings>(DEFAULT_SETTINGS);

  // ── 1. Hook PermissionStore.can ─────────────────────────────────────────────
  // Discord calls PermissionStore.can(permissionBit, context) for every
  // channel visibility check. We intercept the return value so VIEW_CHANNEL
  // always comes back true, then record which channel IDs were actually denied.
  const PermissionStore = lookupByProps(["can", "computePermissions"]);

  if (!PermissionStore) {
    console.warn("[HiddenChannels] PermissionStore not found — aborting hook.");
    return {};
  }

  const unpatchPermission = after(
    PermissionStore,
    "can",
    ([permission, context], originalResult: boolean) => {
      // Only intercept VIEW_CHANNEL checks.
      // `permission` arrives as either a BigInt flag or the numeric 1024.
      const isBigInt = typeof permission === "bigint";
      const isViewChannel = isBigInt
        ? (permission & VIEW_CHANNEL) !== 0n
        : permission === 1024;

      if (!isViewChannel) return; // let every other permission through untouched

      const channelId: string | undefined =
        context?.channel?.id ?? context?.channelId;

      if (channelId) {
        if (!originalResult) {
          // User genuinely lacks VIEW_CHANNEL — track it
          hiddenChannelIds.add(channelId);
        } else {
          // User gained access (e.g., role change) — remove stale record
          hiddenChannelIds.delete(channelId);
        }
      }

      // Always return true so the channel row renders
      return true;
    }
  );

  // ── 2. Hook channel row rendering — lock icon ─────────────────────────────
  // Find the ChannelItem component Discord renders per channel row.
  // We wrap its render to inject a lock icon when the channel is hidden.
  let unpatchChannelItem: (() => void) | null = null;

  if (settings.showLockIcon) {
    const ChannelItem =
      lookupByName("ChannelItem") ??
      lookupByProps(["ChannelItem"])?.ChannelItem;

    if (ChannelItem) {
      unpatchChannelItem = after(
        ChannelItem.prototype ?? ChannelItem,
        "render",
        function (_args: unknown[], result: React.ReactElement | null) {
          if (!result) return;

          // Pull channelId off props
          const channelId: string | undefined =
            // @ts-ignore — props shape not fully typed in community types yet
            this?.props?.channel?.id;

          if (!channelId || !hiddenChannelIds.has(channelId)) return;

          // Inject a small lock emoji before the channel name.
          return React.cloneElement(result, {
            ...result.props,
            style: [result.props?.style, { opacity: 0.65 }],
            children: [
              React.createElement(
                "Text",
                {
                  key: "hc-lock",
                  style: { fontSize: 12, marginRight: 3, color: "#72767d" },
                  accessible: false,
                  "aria-hidden": true,
                },
                "🔒"
              ),
              ...(Array.isArray(result.props?.children)
                ? result.props.children
                : [result.props?.children]),
            ],
          });
        }
      );
    } else {
      console.warn(
        "[HiddenChannels] ChannelItem component not found — lock icon disabled."
      );
    }
  }

  // ── 3. Hook channel navigation — confirmation dialog ──────────────────────
  // Before the router transitions into a channel, check if it is hidden
  // and optionally prompt the user.
  let unpatchRouter: (() => void) | null = null;

  if (settings.showConfirmation) {
    const Router =
      lookupByProps(["transitionToChannel", "transitionTo"]) ??
      lookupByProps(["transitionToChannel"]);

    if (Router) {
      unpatchRouter = before(
        Router,
        "transitionToChannel",
        ([channelId]: [string, ...unknown[]]) => {
          if (!hiddenChannelIds.has(channelId)) return;

          (globalThis as any).Alert?.alert?.(
            "Hidden Channel",
            "You don't have permission to view this channel. " +
              "Only metadata Discord already sent to your client is visible — " +
              "no messages will load.",
            [
              { text: "Go back", style: "cancel", onPress: () => {} },
              { text: "Continue anyway", style: "destructive" },
            ]
          );
        }
      );
    } else {
      console.warn(
        "[HiddenChannels] Router not found — confirmation dialog disabled."
      );
    }
  }

  // ── Settings screen ───────────────────────────────────────────────────────
  // Valenced reads `settingsComponent` off the plugin export and renders it
  // in the plugin detail sheet automatically.
  function SettingsPanel() {
    const [lockIcon, setLockIcon] = React.useState(settings.showLockIcon);
    const [confirm, setConfirm] = React.useState(settings.showConfirmation);

    const { View, Text, Switch } = (globalThis as any).ReactNative ?? {
      View: "View",
      Text: "Text",
      Switch: "input",
    };

    function toggle(
      key: keyof HiddenChannelSettings,
      setter: (v: boolean) => void
    ) {
      return (val: boolean) => {
        (settings as any)[key] = val;
        setter(val);
      };
    }

    return React.createElement(
      View,
      { style: { padding: 16, gap: 12 } },

      React.createElement(
        View,
        {
          style: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          },
        },
        React.createElement(
          Text,
          { style: { color: "#dcddde", fontSize: 15 } },
          "Show lock icon on hidden channels"
        ),
        React.createElement(Switch, {
          value: lockIcon,
          onValueChange: toggle("showLockIcon", setLockIcon),
        })
      ),

      React.createElement(
        View,
        {
          style: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          },
        },
        React.createElement(
          Text,
          { style: { color: "#dcddde", fontSize: 15 } },
          "Show confirmation before entering hidden channel"
        ),
        React.createElement(Switch, {
          value: confirm,
          onValueChange: toggle("showConfirmation", setConfirm),
        })
      )
    );
  }

  // ── Teardown ──────────────────────────────────────────────────────────────
  return {
    settingsComponent: SettingsPanel,

    stop() {
      unpatchPermission?.();
      unpatchChannelItem?.();
      unpatchRouter?.();
      hiddenChannelIds.clear();
    },
  };
});

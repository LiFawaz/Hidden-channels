import { lookupModule } from "@valenced/modules";
import { after, instead } from "@valenced/patcher";
import { getAssetByName } from "@valenced/assets";
import { showConfirmationAlert } from "@valenced/discord/actions";
import { React, ReactNative as RN } from "@valenced/react";
import { storage } from "valenced";
import { Settings } from "./settings";

// --- Module lookups (Valenced style) ---
const [Permissions] = lookupModule(
  (m) => m?.getChannelPermissions && m?.can
);
const [ChannelTypesModule] = lookupModule((m) => m?.ChannelTypes);
const [ChannelStore] = lookupModule((m) => m?.getChannel);

const ChannelTypes = ChannelTypesModule?.ChannelTypes;
const getChannel = ChannelStore?.getChannel;

const skipChannels = [
  ChannelTypes?.DM,
  ChannelTypes?.GROUP_DM,
  ChannelTypes?.GUILD_CATEGORY,
].filter(Boolean);

// --- Helper: is this channel hidden for the current user? ---
function isHidden(channel: any): boolean {
  if (!channel || !Permissions?.can) return false;
  if (typeof channel === "string") channel = getChannel?.(channel);
  if (!channel || skipChannels.includes(channel.type)) return false;

  const hadRealCheck = Object.prototype.hasOwnProperty.call(channel, "realCheck");
  const prev = channel.realCheck;

  try {
    channel.realCheck = true;
    return !Permissions.can(
      constants.Permissions.VIEW_CHANNEL,
      channel
    );
  } finally {
    if (hadRealCheck) channel.realCheck = prev;
    else delete channel.realCheck;
  }
}

// --- Helper: extract channel ID from a navigation path ---
function getChannelId(target: unknown): string | undefined {
  if (typeof target !== "string") return undefined;
  const match = target.match(/(\d{15,22})$/);
  return match?.[1];
}

const unpatches: (() => void)[] = [];

export default {
  onLoad() {
    storage.showIcon ??= true;
    storage.showPopup ??= true;

    // 1) Make hidden channels visible in the sidebar
    if (Permissions) {
      unpatches.push(
        after("can", Permissions, ([permID, channel], res) => {
          if (!channel?.realCheck && permID === constants.Permissions.VIEW_CHANNEL)
            return true;
          return res;
        })
      );
    } else {
      console.warn("[Hidden Channels] Permissions module not found.");
    }

    // 2) Lock icon next to hidden channel names
    const [ChannelMessages] = lookupModule((m) => m?.ChannelMessages);

    if (ChannelMessages) {
      unpatches.push(
        after("default", ChannelMessages, ([props], ret) => {
          const channel = props?.channel;
          if (!storage.showIcon || !channel || !isHidden(channel)) return ret;

          const lock = getAssetByName("ic_lock");
          if (!lock) return ret;

          return React.createElement(
            React.Fragment,
            null,
            React.createElement(RN.Image, {
              source: lock.id ?? lock,
              style: { width: 20, height: 20, marginRight: 4 },
            }),
            ret
          );
        })
      );
    } else {
      console.warn("[Hidden Channels] ChannelMessages module not found.");
    }

    // 3) Confirmation popup before opening a hidden channel
    const [TransitionModule] = lookupModule((m) => m?.transitionToGuild);

    if (TransitionModule) {
      for (const key of Object.keys(TransitionModule)) {
        if (typeof TransitionModule[key] !== "function") continue;

        unpatches.push(
          instead(key, TransitionModule, (args, orig) => {
            if (!storage.showPopup) return orig(...args);

            const channelId = getChannelId(args[0]);
            if (!channelId || !isHidden(channelId)) return orig(...args);

            showConfirmationAlert({
              title: "Hidden Channel",
              content: "This channel is hidden. Open anyway?",
              confirmText: "Open",
              cancelText: "Cancel",
              onConfirm: () => orig(...args),
            });

            return undefined; // navigation deferred until confirm
          })
        );
      }
    } else {
      console.warn("[Hidden Channels] transitionToGuild module not found.");
    }
  },

  onUnload() {
    for (const u of unpatches.splice(0)) {
      try {
        u();
      } catch (e) {
        console.error("[Hidden Channels] Unpatch failed:", e);
      }
    }
  },

  settings: Settings,
};

// Local constant for Permissions.VIEW_CHANNEL
const constants = {
  Permissions: {
    VIEW_CHANNEL: 1024n, // Discord's VIEW_CHANNEL bit
  },
};

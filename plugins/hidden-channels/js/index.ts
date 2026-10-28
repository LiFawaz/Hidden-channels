import { findByProps, findByName } from "@valenced/metro";
import { constants, React, ReactNative as RN } from "@valenced/metro/common";
import { getAssetByName } from "@valenced/ui/assets";
import { after, instead } from "@valenced/patcher";
import { showConfirmationAlert } from "@valenced/ui/alerts";
import { storage } from "valenced";
import { Settings } from "./settings";

const Permissions = findByProps("getChannelPermissions", "can");
const { ChannelTypes } = findByProps("ChannelTypes") ?? {};
const { getChannel } =
  findByProps("getChannel") || findByName("getChannel", false) || {};

const skipChannels = [
  ChannelTypes?.DM,
  ChannelTypes?.GROUP_DM,
  ChannelTypes?.GUILD_CATEGORY,
].filter((t) => t !== undefined);

function isHidden(channel: any): boolean {
  if (!channel || !Permissions?.can) return false;
  if (typeof channel === "string") channel = getChannel?.(channel);
  if (!channel || skipChannels.includes(channel.type)) return false;

  const hadRealCheck = Object.prototype.hasOwnProperty.call(channel, "realCheck");
  const prevRealCheck = channel.realCheck;

  try {
    channel.realCheck = true;
    return !Permissions.can(constants.Permissions.VIEW_CHANNEL, channel);
  } catch (e) {
    console.error("[Hidden Channels] Permission check failed:", e);
    return false;
  } finally {
    if (hadRealCheck) channel.realCheck = prevRealCheck;
    else delete channel.realCheck;
  }
}

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

    if (Permissions) {
      unpatches.push(
        after("can", Permissions, ([permID, channel]: any[], res: any) => {
          if (!channel?.realCheck && permID === constants.Permissions.VIEW_CHANNEL)
            return true;
          return res;
        })
      );
    } else {
      console.warn("[Hidden Channels] Permissions module not found.");
    }

    const ChannelMessages =
      findByProps("ChannelMessages") || findByName("ChannelMessages", false);

    if (ChannelMessages) {
      unpatches.push(
        after("default", ChannelMessages, ([props]: any[], ret: any) => {
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

    const transitionToGuild = findByProps("transitionToGuild");

    if (transitionToGuild) {
      for (const key of Object.keys(transitionToGuild)) {
        if (typeof (transitionToGuild as any)[key] !== "function") continue;

        unpatches.push(
          instead(key, transitionToGuild as any, (args: any[], orig: any) => {
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

            return undefined;
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

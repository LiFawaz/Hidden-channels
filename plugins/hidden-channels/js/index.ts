import { DEFAULT_SETTINGS, SettingsComponent } from "./settings";
import type { HiddenChannelsStorage } from "./settings";

type HiddenChannelsPluginOptions = {
  jsonStorage: HiddenChannelsStorage;
};

/**
 * Hidden Channels is a metadata viewer.
 *
 * It only displays records explicitly imported by the user from a
 * server-administrator export. It does not patch Discord's permission
 * checks or attempt to retrieve channels the server has withheld.
 */
export default plugin<HiddenChannelsPluginOptions>({
  jsonStorage: {
    load: true,
    default: DEFAULT_SETTINGS,
  },

  start({ jsonStorage }) {
    const count = jsonStorage.cache?.channels?.length ?? 0;
    console.info(`[HiddenChannels] Started with ${count} imported metadata record(s).`);
  },

  stop() {
    // No Discord hooks, subscriptions, or timers are installed.
    // There is therefore nothing to unpatch or retain after stop.
  },

  SettingsComponent,
});

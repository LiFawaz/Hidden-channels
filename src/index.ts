/**
 * Hidden Channels — Valenced port scaffold
 *
 * Upstream project: https://github.com/Lioncat6/revenge-plugins
 * Original authors credited upstream: cloudburst, Training Dummy, Lioncat6.
 *
 * This scaffold deliberately does not patch Discord permission checks or navigation.
 * The Revenge implementation uses Vendetta-specific Metro/patcher APIs, and those
 * hooks must be ported against the exact Valenced runtime before enabling behavior.
 */
plugin({
  manifest: {
    format: 1,
    id: "lifawaz-hidden-channels",
    name: "Hidden Channels",
    author: "LiFawaz (Valenced port)",
    contributors: [
      "Lioncat6 (upstream implementation) (https://github.com/Lioncat6/revenge-plugins \"Original source\")",
      "cloudburst (original concept)",
      "Training Dummy (upstream contributor)"
    ],
    description: "Valenced port scaffold for Hidden Channels. Not runtime-verified yet.",
    version: { nums: [0, 1, 0], label: "port-scaffold" }
  },
  start({ unscoped, cleanup }) {
    // Safe no-op until the Valenced-specific channel and navigation hooks are confirmed.
    unscoped.discord.common.logger?.log?.("Hidden Channels port scaffold loaded; hooks are not enabled.");
    cleanup(() => {});
  }
});

// server/launchdarkly.ts
// LaunchDarkly server-side SDK — singleton client
// Set LAUNCHDARKLY_SDK_KEY in your environment to enable.
// Without the key the client is null and all variation() calls return the default value.

import { init, type LDClient } from "@launchdarkly/node-server-sdk";

let ldClient: LDClient | null = null;

export async function initLaunchDarkly(): Promise<void> {
  const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY;
  if (!sdkKey) {
    console.warn(
      "[LaunchDarkly] LAUNCHDARKLY_SDK_KEY not set — feature flags disabled"
    );
    return;
  }

  ldClient = init(sdkKey);

  try {
    await ldClient.waitForInitialization({ timeout: 5 });
    console.log("[LaunchDarkly] SDK initialised ✓");
  } catch (err) {
    console.error("[LaunchDarkly] SDK failed to initialise:", err);
    ldClient = null;
  }
}

/**
 * Evaluate a feature flag server-side.
 *
 * @param flagKey     The flag key in LaunchDarkly (e.g. "new-event-page")
 * @param userId      The current user's id (or an anonymous key)
 * @param defaultValue Returned when the SDK is not initialised or the flag is off
 *
 * @example
 *   const showNewUI = await getFlag("new-event-page", req.user.id, false);
 */
export async function getFlag(
  flagKey: string,
  userId: string,
  defaultValue: boolean = false
): Promise<boolean> {
  if (!ldClient) return defaultValue;

  const context = {
    kind: "user" as const,
    key: userId,
  };

  return ldClient.variation(flagKey, context, defaultValue);
}

/** Raw LDClient for advanced usage (targeting rules, track events, etc.) */
export function getLDClient(): LDClient | null {
  return ldClient;
}

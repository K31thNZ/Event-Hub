// client/src/hooks/useLDFlag.ts
// Thin wrapper around the LaunchDarkly React SDK's useFlags hook.
// Falls back gracefully when the LDProvider is not present (i.e. when
// VITE_LAUNCHDARKLY_CLIENT_SIDE_ID is not set in the environment).

import { useFlags } from "launchdarkly-react-client-sdk";

/**
 * Read a single boolean feature flag by key.
 *
 * @param flagKey      The flag key in LaunchDarkly (camelCase, e.g. "newEventPage")
 * @param defaultValue Returned when LD is not initialised or the flag doesn't exist
 *
 * @example
 *   const showNewUI = useLDFlag("newEventPage", false);
 */
export function useLDFlag(flagKey: string, defaultValue: boolean = false): boolean {
  try {
    // useFlags() throws outside an LDProvider context
    const flags = useFlags();
    return flagKey in flags ? Boolean(flags[flagKey]) : defaultValue;
  } catch {
    return defaultValue;
  }
}

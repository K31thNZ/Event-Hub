// server/notify-profile.ts
// Fire-and-forget helper — call this after any user profile save
// (interests or availability) so meh-auth re-runs the availability matcher.
// Failures are logged but never throw.

export async function notifyProfileUpdated(): Promise<void> {
  const authUrl = process.env.AUTH_SERVICE_URL ?? "https://auth.expatevents.org";
  const secret  = process.env.SERVICE_SECRET;

  try {
    await fetch(`${authUrl}/api/notify/profile-updated`, {
      method:  "POST",
      headers: {
        "Content-Type":     "application/json",
        ...(secret ? { "x-service-secret": secret } : {}),
      },
      body: JSON.stringify({}),
    });
  } catch (err: any) {
    // meh-auth may be sleeping (Render free tier) — safe to ignore
    console.warn("[notify-profile] Could not reach meh-auth:", err.message);
  }
}

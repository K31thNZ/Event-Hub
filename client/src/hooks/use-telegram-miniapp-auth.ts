import { useEffect, useState } from "react";

/**
 * Returns true if we're running inside Telegram's Mini App environment.
 */
export function isTelegramMiniApp(): boolean {
  return typeof window !== "undefined" && !!(window as any).Telegram?.WebApp?.initData;
}

/**
 * Authenticates the user using Telegram's initData.
 * Returns a promise that resolves when authentication is complete.
 */
export async function authenticateTelegramMiniApp(): Promise<boolean> {
  const tg = (window as any).Telegram?.WebApp;
  if (!tg?.initData) return false;

  try {
    const res = await fetch("/api/auth/telegram-miniapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: tg.initData }),
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Hook that performs Mini App authentication once on mount,
 * and provides loading state.
 */
export function useTelegramMiniAppAuth() {
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only run in Mini App
    if (!isTelegramMiniApp()) {
      setIsAuthenticating(false);
      return;
    }

    const authenticate = async () => {
      try {
        const ok = await authenticateTelegramMiniApp();
        if (!ok) setError("Failed to sign in with Telegram");
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsAuthenticating(false);
      }
    };

    authenticate();
  }, []);

  return { isAuthenticating, error };
}

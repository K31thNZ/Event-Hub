// src/hooks/use-telegram-miniapp-auth.ts
import { useEffect, useState } from "react";

const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "https://auth.expatevents.org";

export function isTelegramMiniApp(): boolean {
  return typeof window !== "undefined" && !!(window as any).Telegram?.WebApp?.initData;
}

export async function authenticateTelegramMiniApp(): Promise<boolean> {
  const tg = (window as any).Telegram?.WebApp;
  if (!tg?.initData) return false;

  try {
    const res = await fetch(`${AUTH_URL}/api/auth/telegram-miniapp`, {
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

export function useTelegramMiniAppAuth() {
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

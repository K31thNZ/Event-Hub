import { useEffect, useState } from "react";

export function useTelegramMiniAppAuth() {
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg?.initData) {
      // Not in Mini App, skip
      setIsAuthenticating(false);
      return;
    }

    const authenticate = async () => {
      try {
        const res = await fetch("/api/auth/telegram-miniapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: tg.initData }),
          credentials: "include",
        });
        if (!res.ok) throw new Error("Authentication failed");
        // User is now logged in, app state will update via existing /api/user mechanism
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

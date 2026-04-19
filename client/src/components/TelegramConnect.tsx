import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";

interface Props {
  connected: boolean;
  onUnlinked?: () => void;
}

export function TelegramConnect({ connected, onUnlinked }: Props) {
  const [isLinking, setIsLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [botConfigured, setBotConfigured] = useState<boolean | null>(null);

  // Check if the bot is configured on the backend
  useEffect(() => {
    fetch("/api/telegram/status", { credentials: "include" })
      .then(res => res.json())
      .then(data => setBotConfigured(data.configured))
      .catch(() => setBotConfigured(false));
  }, []);

  const handleLink = async () => {
    setError(null);
    setIsLinking(true);
    try {
      const res = await fetch("/api/telegram/link", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to start linking");
      // Open the bot's deep link in a new tab
      window.open(data.url, "_blank");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async () => {
    setError(null);
    setIsLinking(true);
    try {
      const res = await fetch("/api/telegram/unlink", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to unlink");
      }
      if (onUnlinked) onUnlinked();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLinking(false);
    }
  };

  // If bot is not configured, show a warning instead of the buttons
  if (botConfigured === false) {
    return (
      <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <span className="text-sm">
          Telegram notifications are currently unavailable. Please contact the site administrator.
        </span>
      </div>
    );
  }

  if (botConfigured === null) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Checking Telegram status…</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {connected ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Connected to Telegram</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleUnlink}
            disabled={isLinking}
            className="self-start"
          >
            {isLinking ? "Disconnecting…" : "Disconnect Telegram"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Connect your Telegram account to receive event notifications.
          </p>
          <Button
            onClick={handleLink}
            disabled={isLinking}
            className="self-start"
          >
            {isLinking ? "Creating link…" : "Connect Telegram"}
          </Button>
        </div>
      )}
    </div>
  );
}

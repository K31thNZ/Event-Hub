// client/src/components/auth/PremiumRoute.tsx
// Wraps a page component so it is only accessible to premium (or admin) users
// when the "sparks-premium-only" LaunchDarkly flag is ON.
//
// Behaviour matrix:
//   Flag OFF  → render the page for all authenticated users
//   Flag ON + role premium/admin → render the page
//   Flag ON + role free/member   → render the PremiumUpsell screen
//   Not authenticated            → redirect to login (same as ProtectedRoute)

import { Zap, Lock, Star } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLDFlag } from "@/hooks/useLDFlag";
import { Button } from "@/components/ui/button";

const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "";

function PremiumUpsell() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center gap-6">
      <div className="rounded-full bg-primary/10 p-5">
        <Lock className="h-10 w-10 text-primary" />
      </div>

      <div className="space-y-2 max-w-sm">
        <h1 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
          <Zap className="h-6 w-6 text-primary" />
          Sparks is Premium
        </h1>
        <p className="text-muted-foreground">
          Sparks lets you create spontaneous, time-sensitive meetups with people
          nearby. Upgrade to Premium to unlock instant connections.
        </p>
      </div>

      <ul className="text-sm text-muted-foreground space-y-1 text-left">
        {[
          "Create & respond to Sparks",
          "Real-time live map access",
          "Priority event notifications",
          "Ad-free experience",
        ].map((perk) => (
          <li key={perk} className="flex items-center gap-2">
            <Star className="h-4 w-4 text-primary shrink-0" />
            {perk}
          </li>
        ))}
      </ul>

      <Button
        size="lg"
        className="mt-2"
        onClick={() => (window.location.href = "/premium")}
      >
        Upgrade to Premium
      </Button>
    </div>
  );
}

interface PremiumRouteProps {
  component: React.ComponentType;
}

export function PremiumRoute({ component: Component }: PremiumRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();

  // "sparksPremiumOnly" — React SDK camelCases "sparks-premium-only"
  const premiumOnly = useLDFlag("sparksPremiumOnly", false);

  if (isLoading) return null;

  if (!isAuthenticated) {
    window.location.href = `${AUTH_URL}/login?returnTo=${encodeURIComponent(window.location.href)}`;
    return null;
  }

  const isPremium = user?.role === "premium" || user?.role === "admin";

  if (premiumOnly && !isPremium) {
    return <PremiumUpsell />;
  }

  return <Component />;
}

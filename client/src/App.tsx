// client/src/App.tsx
import Spark from "@/pages/Spark";
import LiveMap from "@/pages/LiveMap";
import AdminEventReview from "@/pages/AdminEventReview";
import { Switch, Route, useLocation } from "wouter";
import Guides from "./pages/Guides";
import GuideArticle from "./pages/GuideArticle";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Groups from "@/pages/Groups";
import GroupProfile from "@/pages/GroupProfile";
import CreateGroup from "@/pages/CreateGroup";
import GroupManage from "@/pages/GroupManage";
import { Navbar } from "@/components/layout/Navbar";
import Home from "@/pages/Home";
import EventDetails from "@/pages/EventDetails";
import Dashboard from "@/pages/Dashboard";
import CreateEvent from "@/pages/CreateEvent";
import OrderView from "@/pages/OrderView";
import Profile from "@/pages/Profile";
import { useAuth } from "@/hooks/use-auth";
import Picks from "@/pages/Picks";
import PitchDeck from "./pages/PitchDeck";
import DeepTalk from "@/pages/DeepTalk";
import { useTelegramMiniAppAuth } from "@/hooks/use-telegram-miniapp-auth";
import LanguageExchange from "@/pages/LanguageExchange";
import PublicProfile from "@/pages/PublicProfile";

const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "https://auth.expatevents.org";

const FullPageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
  </div>
);

import { PremiumRoute } from "@/components/auth/PremiumRoute";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <FullPageLoader />;
  if (!isAuthenticated) {
    window.location.href = `${AUTH_URL}/login?returnTo=${encodeURIComponent(window.location.href)}`;
    return null;
  }
  return <Component />;
}

function Router() {
  const [location, setLocation] = useLocation();

  // Handle Telegram mini-app startapp deep-link: ?startapp=event_ID
  // Telegram passes startapp as a hash or search param depending on client version.
  // We normalise both and redirect to the correct event page.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const startapp = params.get("startapp") ?? hashParams.get("startapp") ?? 
                     (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param;
    if (startapp) {
      const m = String(startapp).match(/^event_(\d+)$/);
      if (m) {
        const rsvp = params.get("rsvp") ?? hashParams.get("rsvp");
        const path = `/events/${m[1]}${rsvp ? `?rsvp=${rsvp}` : ""}`;
        if (!location.startsWith(`/events/${m[1]}`)) {
          setLocation(path);
        }
      }
    }
  }, []);

  if (location === "/pitch") {
    return <PitchDeck />;
  }

  if (location === "/deeptalk") {
    return <DeepTalk />;
  }
  // Admin routes — full-screen, no Navbar
  if (location.startsWith("/admin")) {
    return (
      <Switch>
        <Route path="/admin/events">
          <ProtectedRoute component={AdminEventReview} />
        </Route>
        <Route component={NotFound} />
      </Switch>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans">
      <Navbar />
      <main className="flex-1 flex flex-col">
        <Switch>
          {/* General */}
          <Route path="/" component={Home} />
          <Route path="/picks" component={Picks} />
          <Route path="/language-exchange" component={LanguageExchange} />
          <Route path="/live-map" component={LiveMap} />
          <Route path="/profile">
            <ProtectedRoute component={Profile} />
          </Route>
          <Route path="/profile/:userId" component={PublicProfile} />

          {/* Events */}
          <Route path="/create-event">
            <ProtectedRoute component={CreateEvent} />
          </Route>
          <Route path="/events/:id" component={EventDetails} />
          <Route path="/guides/:slug" component={GuideArticle} />
          <Route path="/guides" component={Guides} />

          {/* Orders */}
          <Route path="/orders/:id">
            <ProtectedRoute component={OrderView} />
          </Route>

          {/* Dashboard */}
          <Route path="/dashboard">
            <ProtectedRoute component={Dashboard} />
          </Route>

          {/* Groups */}
          <Route path="/groups" component={Groups} />
          <Route path="/groups/create">
            <ProtectedRoute component={CreateGroup} />
          </Route>
          <Route path="/groups/:slug/create-event">
            {(params) => (
              <ProtectedRoute component={() => <CreateEvent groupSlug={params.slug} />} />
            )}
          </Route>
          <Route path="/groups/:slug/manage">
            <ProtectedRoute component={GroupManage} />
          </Route>
          <Route path="/groups/:slug" component={GroupProfile} />

          {/* Spark */}
          <Route path="/sparks">
            <PremiumRoute component={Spark} />
          </Route>

          {/* Fallback */}
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticating: isMiniAppAuth } = useTelegramMiniAppAuth();
  const { isLoading: isAuthLoading } = useAuth();

  if (isMiniAppAuth || isAuthLoading) {
    return <FullPageLoader />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthGate>
          <Router />
        </AuthGate>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

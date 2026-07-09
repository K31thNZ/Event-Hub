// client/src/App.tsx
import { lazy, Suspense } from "react";
import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/hooks/use-auth";
import { useTelegramMiniAppAuth } from "@/hooks/use-telegram-miniapp-auth";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { PremiumRoute } from "@/components/auth/PremiumRoute";

// ── Lazy-loaded pages ─────────────────────────────────────────────────────
// Every page is split into its own chunk and only downloaded when visited.
// This is especially critical for:
//   • AdminEventReview → MapLibreLocationPicker → maplibre-gl (1.1 MB)
//   • LiveMap (also uses Yandex + heavy map logic)
// Neither chunk is fetched on the homepage any more.
const Home             = lazy(() => import("@/pages/Home"));
const Picks            = lazy(() => import("@/pages/Picks"));
const LanguageExchange = lazy(() => import("@/pages/LanguageExchange"));
const LiveMap          = lazy(() => import("@/pages/LiveMap"));
const Profile          = lazy(() => import("@/pages/Profile"));
const PublicProfile    = lazy(() => import("@/pages/PublicProfile"));
const CreateEvent      = lazy(() => import("@/pages/CreateEvent"));
const EventDetails     = lazy(() => import("@/pages/EventDetails"));
const GuideSubmit      = lazy(() => import("@/pages/GuideSubmit"));
const GuideArticle     = lazy(() => import("@/pages/GuideArticle"));
const Guides           = lazy(() => import("@/pages/Guides"));
const OrderView        = lazy(() => import("@/pages/OrderView"));
const Dashboard        = lazy(() => import("@/pages/Dashboard"));
const Groups           = lazy(() => import("@/pages/Groups"));
const CreateGroup      = lazy(() => import("@/pages/CreateGroup"));
const GroupProfile     = lazy(() => import("@/pages/GroupProfile"));
const GroupManage      = lazy(() => import("@/pages/GroupManage"));
const Spark            = lazy(() => import("@/pages/Spark"));
const PitchDeck        = lazy(() => import("@/pages/PitchDeck"));
const DeepTalk         = lazy(() => import("@/pages/DeepTalk"));
const AdminEventReview = lazy(() => import("@/pages/AdminEventReview"));
const NotFound         = lazy(() => import("@/pages/not-found"));

const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "https://auth.expatevents.org";

const FullPageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
  </div>
);

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
    return (
      <Suspense fallback={<FullPageLoader />}>
        <PitchDeck />
      </Suspense>
    );
  }

  if (location === "/deeptalk") {
    return (
      <Suspense fallback={<FullPageLoader />}>
        <DeepTalk />
      </Suspense>
    );
  }

  // Admin routes — full-screen, no Navbar
  if (location.startsWith("/admin")) {
    return (
      <Suspense fallback={<FullPageLoader />}>
        <Switch>
          <Route path="/admin/events">
            <ProtectedRoute component={AdminEventReview} />
          </Route>
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    );
  }

  return (
    <ErrorBoundary label="this page">
      <div className="min-h-screen flex flex-col bg-background font-sans">
        <Navbar />
        <main className="flex-1 flex flex-col">
          <Suspense fallback={<FullPageLoader />}>
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
              <Route path="/guides/submit" component={GuideSubmit} />
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
          </Suspense>
        </main>
      </div>
    </ErrorBoundary>
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
    <ErrorBoundary label="the app">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <AuthGate>
            <Router />
          </AuthGate>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

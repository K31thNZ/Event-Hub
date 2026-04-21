// App.tsx
import { Switch, Route, useLocation } from "wouter";
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
import { useTelegramMiniAppAuth } from "@/hooks/use-telegram-miniapp-auth";

// Loading spinner component (you may already have one)
const FullPageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
  </div>
);

// ── Protected Route Wrapper ───────────────────────────────────────────────
function ProtectedRoute({ component: Component }: { component: any }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <FullPageLoader />;
  if (!isAuthenticated) {
    window.location.href = "/api/login";
    return null;
  }
  return <Component />;
}

// ── Router ────────────────────────────────────────────────────────────────
function Router() {
  const [location] = useLocation();

  // Pitch deck renders without navbar/layout
  if (location === "/pitch") {
    return <PitchDeck />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans">
      <Navbar />
      <main className="flex-1 flex flex-col">
        <Switch>
          {/* ... all your existing routes ... */}
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

// ── Authentication Gate ───────────────────────────────────────────────────
// Waits for Mini App auth (if applicable) and user session to be ready.
function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticating: isMiniAppAuth, error: miniAppError } = useTelegramMiniAppAuth();
  const { isLoading: isAuthLoading } = useAuth();

  // Show loader while either Mini App auth is in progress or the main auth is loading
  if (isMiniAppAuth || isAuthLoading) {
    return <FullPageLoader />;
  }

  // If Mini App auth failed, you might want to show an error, but typically
  // we just proceed and let the protected routes redirect to login.
  // We can ignore miniAppError for now.

  return <>{children}</>;
}

// ── App ───────────────────────────────────────────────────────────────────
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

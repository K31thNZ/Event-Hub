import { Switch, Route, useLocation } from "wouter"; // add useLocation
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
import PitchDeck from './pages/PitchDeck'; // your component

// Protected Route Wrapper (unchanged)
function ProtectedRoute({ component: Component }: { component: any }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  
  if (!isAuthenticated) {
    window.location.href = "/api/login";
    return null;
  }

  return <Component />;
}

function Router() {
  const [location] = useLocation(); // get current path

  // If the user is viewing the pitch deck, render it without any layout
  if (location === '/pitch') {
    return <PitchDeck />;
  }

  // Otherwise, render the normal layout with navbar
  return (
    <div className="min-h-screen flex flex-col bg-background font-sans">
      <Navbar />
      <main className="flex-1 flex flex-col">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/events/:id" component={EventDetails} />
          <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
          <Route path="/create-event"><ProtectedRoute component={CreateEvent} /></Route>
          <Route path="/orders/:id"><ProtectedRoute component={OrderView} /></Route>
          <Route path="/profile"><ProtectedRoute component={Profile} /></Route>
          <Route path="/picks" component={Picks} />
          <Route path="/groups" component={Groups} />
          <Route path="/groups/create" component={CreateGroup} />
          <Route path="/groups/:slug/manage" component={GroupManage} />
          <Route path="/groups/:slug" component={GroupProfile} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

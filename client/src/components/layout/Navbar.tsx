import { Link } from "wouter";
import { Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Ticket, CalendarPlus, LogOut, User, Menu, Settings, Sparkles, ShieldCheck, Languages } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  premium:  { label: "Premium",  className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200" },
  host:     { label: "Host",     className: "bg-teal-100   text-teal-800   dark:bg-teal-900/40   dark:text-teal-200"   },
  curator:  { label: "Curator",  className: "bg-amber-100  text-amber-800  dark:bg-amber-900/40  dark:text-amber-200"  },
  admin:    { label: "Admin",    className: "bg-red-100    text-red-800    dark:bg-red-900/40    dark:text-red-200"    },
};

export function Navbar() {
  const { user, isAuthenticated, login, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getInitials = (name: string) => name?.substring(0, 2).toUpperCase() || "U";
  const roleBadge = user?.role ? ROLE_BADGE[user.role] : undefined;

  // 👇 Condition: show Language Exchange only if the user has selected that interest
  const showLanguageExchange = user?.interests?.includes("language_exchange");

  const handleLogin = () => login();
  const handleLogout = () => logout();

  return (
    <header className="sticky top-0 z-50 w-full glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
            <Ticket className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-2xl tracking-tight text-foreground">
            Expat<span className="text-primary">Events</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8 font-medium">
          <Link href="/picks" className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors">
            <Sparkles className="w-4 h-4" />
            Recommended
          </Link>
          <Link href="/groups" className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors">
            <Users className="w-4 h-4" />
            Groups
          </Link>

          {/* Language Exchange – only shown if user has the interest */}
          {showLanguageExchange && (
            <Link href="/language-exchange" className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors">
              <Languages className="w-4 h-4" />
              Language Exchange
            </Link>
          )}

          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              <Link href="/create-event">
                <Button variant="outline" className="rounded-full border-primary/20 hover:bg-primary/5 hover:text-primary gap-2">
                  <CalendarPlus className="w-4 h-4" />
                  Host Event
                </Button>
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 border-2 border-transparent hover:border-primary/50 transition-colors">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user?.avatarUrl || ""} alt={user?.displayName || "User"} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(user?.displayName || "Ex")}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-white dark:bg-zinc-900" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1.5">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium leading-none">{user?.displayName || user?.username}</p>
                        {roleBadge && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${roleBadge.className}`}>
                            {roleBadge.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/dashboard" className="w-full flex items-center">
                      <User className="mr-2 h-4 w-4" />
                      <span>My Dashboard</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/profile" className="w-full flex items-center">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  {(user?.role === "curator" || user?.role === "admin") && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link href="/dashboard?tab=curator" className="w-full flex items-center">
                          <Sparkles className="mr-2 h-4 w-4 text-amber-500" />
                          <span>Curator Dashboard</span>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  {user?.role === "admin" && (
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href="/dashboard?tab=admin" className="w-full flex items-center">
                        <ShieldCheck className="mr-2 h-4 w-4 text-red-500" />
                        <span>Admin Panel</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer text-destructive focus:bg-destructive/10"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <Button
              onClick={handleLogin}
              className="rounded-full px-6 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all hover:-translate-y-0.5"
            >
              Sign In
            </Button>
          )}
        </nav>

        {/* Mobile Nav */}
        <div className="md:hidden">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon"><Menu className="w-6 h-6" /></Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex flex-col gap-6 pt-12">
              <Link href="/picks" onClick={() => setMobileMenuOpen(false)} className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" /> Recommended
              </Link>
              <Link href="/groups" onClick={() => setMobileMenuOpen(false)} className="text-lg font-semibold flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" /> Groups
              </Link>

              {showLanguageExchange && (
                <Link href="/language-exchange" onClick={() => setMobileMenuOpen(false)} className="text-lg font-semibold flex items-center gap-2">
                  <Languages className="w-5 h-5 text-primary" /> Language Exchange
                </Link>
              )}

              <Link href="/" onClick={() => setMobileMenuOpen(false)} className="text-lg font-semibold">All Events</Link>
              {isAuthenticated ? (
                <>
                  <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="text-lg font-semibold">My Dashboard</Link>
                  <Link href="/profile" onClick={() => setMobileMenuOpen(false)} className="text-lg font-semibold">Profile & Interests</Link>
                  {(user?.role === "curator" || user?.role === "admin") && (
                    <Link href="/dashboard?tab=curator" onClick={() => setMobileMenuOpen(false)} className="text-lg font-semibold text-amber-600">Curator Dashboard</Link>
                  )}
                  <Link href="/create-event" onClick={() => setMobileMenuOpen(false)} className="text-lg font-semibold text-primary">Host an Event</Link>
                  <div className="mt-auto border-t pt-6">
                    <Button
                      variant="outline"
                      className="w-full justify-start text-destructive"
                      onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                    >
                      <LogOut className="w-4 h-4 mr-2" /> Log Out
                    </Button>
                  </div>
                </>
              ) : (
                <Button
                  className="w-full mt-4 rounded-xl"
                  onClick={() => { handleLogin(); setMobileMenuOpen(false); }}
                >
                  Sign In
                </Button>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

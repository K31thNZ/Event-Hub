import { useQuery, useQueryClient } from "@tanstack/react-query";

const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "https://meh-auth.onrender.com";

export interface User {
  id: number;
  username: string;
  role: string;
  displayName?: string;
  avatarUrl?: string;
  email?: string;
  interests?: string[];
  telegramId?: string | number | null;
  isExpatMember: boolean;
  isGamesMember: boolean;
  dice: number;
  hasPassword?: boolean; // added by meh-auth sanitize()
  // OAuth provider IDs — present when user signed up via OAuth
  googleId?: string | null;
  yandexId?: string | null;
  // Convenience flag — true when user has the admin role
  isAdmin?: boolean;
  // Profile city — used for timezone display
  city?: string | null;
}

async function fetchUser(): Promise<User | null> {
  const response = await fetch(`${AUTH_URL}/api/user`, {
    credentials: "include",
  });
  if (!response.ok) return null;
  const data = await response.json();
  if (data === null) return null;
  return data as User;
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["auth-user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const isAuthenticated = !!user;

  function login() {
    const returnTo = encodeURIComponent(window.location.href);
    window.location.href = `${AUTH_URL}/login?returnTo=${returnTo}`;
  }

  async function logout() {
    try {
      // Wait for the session to be cleared on the server before navigating away.
      // Without await, the browser may redirect before the cookie is invalidated,
      // leaving the user appearing logged in on the next page load.
      await fetch(`${AUTH_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Network error — proceed with local cleanup anyway
    }
    queryClient.clear();
    window.location.href = "/";
  }

  return { user, isLoading, isAuthenticated, login, logout };
}

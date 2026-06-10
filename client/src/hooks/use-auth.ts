import { useQuery, useQueryClient } from "@tanstack/react-query";

const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "https://meh-auth.onrender.com";

export interface User {
  id: number;
  username: string;
  /** "free" | "premium" | "admin" */
  role: string;
  displayName?: string;
  avatarUrl?: string;
  email?: string;
  interests?: string[];
  telegramId?: string | number | null;
  isExpatMember: boolean;
  isGamesMember: boolean;
  dice: number;
  hasPassword?: boolean;
  // OAuth provider IDs
  googleId?: string | null;
  yandexId?: string | null;
  // Convenience flag
  isAdmin?: boolean;
  // Profile fields
  city?: string | null;
  bio?: string | null;
  // Language exchange / match profile
  meetingTypes?: string[];
  nativeLanguage?: string | null;
  learningLanguages?: { code: string; proficiency: string }[];
  myAgeGroup?: string | null;
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

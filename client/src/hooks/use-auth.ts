import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
}

async function fetchUser(): Promise<User | null> {
  const response = await fetch(`${AUTH_URL}/api/user`, {
    credentials: "include",
  });
  if (response.status === 401 || response.ok && (await response.clone().json()) === null) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }
  return response.json();
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

  function logout() {
    fetch(`${AUTH_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).then(() => {
      queryClient.setQueryData(["auth-user"], null);
      window.location.href = "/";
    });
  }

  return { user, isLoading, isAuthenticated, login, logout };
}

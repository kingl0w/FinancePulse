"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { login as apiLogin, register as apiRegister } from "@/lib/api";
import type { User } from "@/types";

interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

export function useAuth(): UseAuthReturn {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") ?? "/";
  const {
    user,
    isAuthenticated,
    setAuth,
    logout: storeLogout,
  } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      try {
        const response = await apiLogin(email, password);
        setAuth(response.user, response.access_token, response.refresh_token);
        router.push(returnUrl);
      } finally {
        setIsLoading(false);
      }
    },
    [setAuth, router, returnUrl],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      try {
        const response = await apiRegister(email, password);
        setAuth(response.user, response.access_token, response.refresh_token);
        toast.success("Account created successfully!");
        router.push(returnUrl);
      } finally {
        setIsLoading(false);
      }
    },
    [setAuth, router, returnUrl],
  );

  const logout = useCallback(() => {
    storeLogout();
    router.push("/login");
  }, [storeLogout, router]);

  return { user, isAuthenticated, login, register, logout, isLoading };
}

import axios from "axios";
import { QueryClient } from "@tanstack/react-query";
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 15_000, refetchOnWindowFocus: true },
    mutations: { retry: false },
  },
});
export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 30_000,
});
let csrf: string | null = null;
export async function refreshCsrf() {
  csrf = (await api.get<{ token: string }>("/auth/csrf")).data.token;
}
api.interceptors.request.use(async (config) => {
  if (
    config.method &&
    !["get", "head", "options"].includes(config.method.toLowerCase())
  ) {
    if (!csrf) await refreshCsrf();
    config.headers.set("X-CSRF-TOKEN", csrf);
  }
  return config;
});
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !["/auth/me", "/auth/login"].includes(error.config?.url ?? "")
    ) {
      queryClient.removeQueries({
        predicate: (q) => q.queryKey[0] !== "session",
      });
      queryClient.setQueryData(["session"], null);
    }
    return Promise.reject(error);
  },
);
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 403)
      return (
        error.response.data?.title || "Your account cannot perform this action."
      );
    if (error.response?.data?.errors)
      return Object.values(error.response.data.errors).flat().join(" ");
    return (
      error.response?.data?.title ||
      (error.response?.status === 401
        ? "Your session has ended. Sign in again."
        : "Could not reach the shop server. Check the connection and retry.")
    );
  }
  return error instanceof Error
    ? error.message
    : "The operation could not be completed.";
}
export async function get<T>(path: string): Promise<T> {
  return (await api.get<T>(path)).data;
}
export async function invalidate() {
  await queryClient.invalidateQueries();
}

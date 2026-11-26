import axios from "axios";

axios.defaults.withCredentials = true;

const API = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    (import.meta.env.PROD
      ? "https://shopease-backend-hashim.onrender.com/api"
      : "http://localhost:3000/api"),
  withCredentials: true,
  validateStatus: (status) => status < 500,
});

let refreshRequest;

async function refreshSession() {
  async function refreshIfNeeded() {
    // Another tab may already have refreshed the shared cookies while this
    // request was waiting for the browser-wide lock.
    try {
      const sessionResponse = await API.get("/auth/me", {
        _skipAuthRefresh: true,
      });
      if (sessionResponse.status >= 200 && sessionResponse.status < 300) {
        return true;
      }
    } catch {
      // The access token may still be expired; try the refresh cookie next.
    }

    const response = await API.post(
      "/auth/refresh",
      {},
      { _skipAuthRefresh: true },
    );
    return response.status >= 200 && response.status < 300;
  }

  // Web Locks coordinate refreshes across tabs, not just requests in this tab.
  if (globalThis.navigator?.locks?.request) {
    return globalThis.navigator.locks.request(
      "shopease-auth-refresh",
      refreshIfNeeded,
    );
  }

  // Keep the existing same-tab coordination for browsers without Web Locks.
  refreshRequest ||= refreshIfNeeded().finally(() => {
    refreshRequest = null;
  });
  return refreshRequest;
}

API.interceptors.response.use(async (response) => {
  if (response.status !== 401) return response;

  const config = response.config;
  const requestPath = new URL(config.url, config.baseURL).pathname;
  const isAuthRequest =
    /\/auth\/(login|google|refresh|logout|signup|verify-email|resend-verification|forgot-password|reset-password)$/.test(
      requestPath,
    );
  if (config._retriedAfterRefresh || config._skipAuthRefresh || isAuthRequest) {
    return response;
  }

  config._retriedAfterRefresh = true;
  try {
    if (!(await refreshSession())) return response;
    return API(config);
  } catch {
    return response;
  }
});

export function isSuccess(response) {
  return response.status >= 200 && response.status < 300;
}

export default API;

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

API.interceptors.response.use(async (response) => {
  if (response.status !== 401) return response;

  const config = response.config;
  const requestPath = new URL(config.url, config.baseURL).pathname;
  const isAuthRequest = /\/auth\/(login|google|refresh|logout|signup|verify-email|resend-verification|forgot-password|reset-password)$/.test(requestPath);
  if (config._retriedAfterRefresh || isAuthRequest) return response;

  config._retriedAfterRefresh = true;
  try {
    refreshRequest ||= API.post("/auth/refresh").finally(() => {
      refreshRequest = null;
    });
    const refreshResponse = await refreshRequest;
    if (refreshResponse.status < 200 || refreshResponse.status >= 300) return response;
    return API(config);
  } catch {
    return response;
  }
});

export function isSuccess(response) {
  return response.status >= 200 && response.status < 300;
}

export default API;

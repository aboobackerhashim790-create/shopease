import axios from "axios";

axios.defaults.withCredentials = true;

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api",
  validateStatus: (status) => status < 500,
});

export function isSuccess(response) {
  return response.status >= 200 && response.status < 300;
}

export default API;

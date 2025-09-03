import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const t = localStorage.getItem("token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

export default api;

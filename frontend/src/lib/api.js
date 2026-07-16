import axios from "axios";

console.log("ENV:", process.env.REACT_APP_BACKEND_URL);

const BACKEND =
  process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000";

console.log("BACKEND:", BACKEND);

export const API_BASE = `${BACKEND}/api`;

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});
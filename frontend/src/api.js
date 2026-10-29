const TOKEN_KEY = "liveface_admin_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    setToken("");
    throw new Error(data.detail || "Admin login required");
  }
  if (!res.ok) {
    const detail = data.detail || data.message || res.statusText;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data;
}

export const api = {
  login: (username, password) =>
    request("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  me: () => request("/api/auth/me"),
  people: () => request("/api/people"),
  enroll: (body) => request("/api/enroll", { method: "POST", body: JSON.stringify(body) }),
  analyze: (body) => request("/api/analyze", { method: "POST", body: JSON.stringify(body) }),
  remove: (id) => request(`/api/people/${id}`, { method: "DELETE" }),
  events: () => request("/api/events"),
  stats: () => request("/api/stats"),
};

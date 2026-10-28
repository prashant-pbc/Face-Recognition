async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.detail || data.message || res.statusText;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data;
}

export const api = {
  people: () => request("/api/people"),
  enroll: (body) => request("/api/enroll", { method: "POST", body: JSON.stringify(body) }),
  analyze: (body) => request("/api/analyze", { method: "POST", body: JSON.stringify(body) }),
  remove: (id) => request(`/api/people/${id}`, { method: "DELETE" }),
  events: () => request("/api/events"),
};

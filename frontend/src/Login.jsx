import { useState } from "react";
import { api, setToken } from "./api";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api.login(username.trim(), password);
      setToken(data.token);
      onLogin(data.username);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="mark">AG</div>
        <h1>AEGIS Admin</h1>
        <p className="hint">Sign in to enroll people into the live identity gate. Recognition stays public.</p>
        <div className="form">
          <label>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error && <div className="toast">{error}</div>}
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? "Signing in..." : "Enter control room"}
          </button>
        </div>
      </form>
    </div>
  );
}

import { useEffect, useState } from "react";
import Admin from "./Admin.jsx";
import Login from "./Login.jsx";
import Recognize from "./Recognize.jsx";
import { api, getToken, setToken } from "./api";

export default function App() {
  const [page, setPage] = useState("recognize");
  const [admin, setAdmin] = useState("");
  const [checking, setChecking] = useState(Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) {
      setChecking(false);
      return;
    }
    api
      .me()
      .then((d) => setAdmin(d.username))
      .catch(() => setToken(""))
      .finally(() => setChecking(false));
  }, []);

  function logout() {
    setToken("");
    setAdmin("");
    setPage("recognize");
  }

  if (checking) {
    return (
      <div className="login-wrap">
        <p className="muted">Restoring session...</p>
      </div>
    );
  }

  if (page === "admin" && !admin) {
    return (
      <Login
        onLogin={(name) => {
          setAdmin(name);
          setPage("admin");
        }}
        onBack={() => setPage("recognize")}
      />
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="mark">LF</div>
          <div>
            <h1>LiveFace Gate</h1>
            <p>Real person only · photo and video blocked</p>
          </div>
        </div>
        <nav className="nav">
          <button className={page === "recognize" ? "active" : ""} type="button" onClick={() => setPage("recognize")}>
            Recognition
          </button>
          <button className={page === "admin" ? "active" : ""} type="button" onClick={() => setPage("admin")}>
            Admin
          </button>
          {admin ? (
            <button className="btn ghost" type="button" onClick={logout}>
              Sign out {admin}
            </button>
          ) : null}
        </nav>
      </header>
      {page === "admin" ? <Admin /> : <Recognize />}
    </div>
  );
}

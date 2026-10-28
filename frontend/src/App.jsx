import { useState } from "react";
import Admin from "./Admin.jsx";
import Recognize from "./Recognize.jsx";

export default function App() {
  const [page, setPage] = useState("recognize");
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
        </nav>
      </header>
      {page === "admin" ? <Admin /> : <Recognize />}
    </div>
  );
}

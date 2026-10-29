import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import CameraView from "./CameraView.jsx";
import { challengeHint, challengeMet, pickChallenge } from "./liveness";
import { useCamera } from "./useCamera";

export default function Admin() {
  const cam = useCamera();
  const [name, setName] = useState("");
  const [personId, setPersonId] = useState("");
  const [notes, setNotes] = useState("");
  const [people, setPeople] = useState([]);
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [challenge, setChallenge] = useState(() => pickChallenge());
  const [phase, setPhase] = useState("idle");
  const [frames, setFrames] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const advancedRef = useRef(false);
  const formRef = useRef({ name: "", personId: "", notes: "" });
  formRef.current = { name, personId, notes };

  async function refresh() {
    const [p, s, e] = await Promise.all([api.people(), api.stats(), api.events()]);
    setPeople(p);
    setStats(s);
    setEvents(e);
  }

  useEffect(() => {
    refresh().catch((err) => setMessage(err.message));
  }, []);

  const met = useMemo(() => challengeMet(challenge.id, cam.live), [challenge.id, cam.live]);
  const hint = useMemo(() => challengeHint(challenge.id, cam.live), [challenge.id, cam.live]);

  async function savePerson(images) {
    const form = formRef.current;
    setBusy(true);
    setMessage("Saving to sqlite3.db...");
    setPhase("saving");
    try {
      await api.enroll({
        name: form.name.trim(),
        person_id: form.personId.trim(),
        notes: form.notes,
        images,
        challenge: challenge.id,
        signals: cam.signals(),
      });
      setName("");
      setPersonId("");
      setNotes("");
      setFrames([]);
      setPhase("idle");
      setMessage("");
      await refresh();
    } catch (err) {
      setMessage(err.message);
      setFrames(images);
      setPhase("angles");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (phase !== "challenge") {
      advancedRef.current = false;
      return;
    }
    if (advancedRef.current) return;
    if (cam.live.faceCount !== 1) return;
    if (!met) return;
    advancedRef.current = true;
    const first = cam.snapshot();
    window.setTimeout(() => {
      savePerson([first, cam.snapshot()]);
    }, 400);
  }, [phase, met, cam.live.faceCount]);

  function startEnroll() {
    setMessage("");
    if (!name.trim() || !personId.trim()) {
      setMessage("Name and ID are required");
      return;
    }
    advancedRef.current = false;
    cam.resetStats();
    setFrames([]);
    setChallenge(pickChallenge());
    setPhase("challenge");
  }

  return (
    <div className="page">
      <div className="stats">
        <div className="stat"><span className="muted">Enrolled</span><b>{stats?.people ?? "—"}</b></div>
        <div className="stat"><span className="muted">Live matches</span><b>{stats?.matches ?? "—"}</b></div>
        <div className="stat"><span className="muted">Spoof rejects</span><b>{stats?.rejects ?? "—"}</b></div>
        <div className="stat"><span className="muted">Database</span><b>sqlite3.db</b></div>
      </div>

      <div className="grid-2">
        <section className="panel">
          <h2>Live enrollment</h2>
          <p className="hint">Look at the camera and blink once. Only a real person in front of this lens is stored.</p>
          <div className="steps">
            <span className={phase !== "idle" ? "done" : "now"} />
            <span className={phase === "challenge" ? "now" : phase === "saving" || phase === "angles" ? "done" : ""} />
            <span className={phase === "saving" ? "now" : ""} />
          </div>
          <CameraView
            videoRef={cam.videoRef}
            canvasRef={cam.canvasRef}
            live={cam.live}
            ready={cam.ready}
            error={cam.error}
            challenge={phase === "idle" ? "fill details, then start" : challenge.label}
          />
          {phase === "challenge" && (
            <div style={{ marginTop: 14 }}>
              <p className="challenge">{challenge.label}</p>
              <p className="muted">{met ? "Blink seen. Saving..." : hint}</p>
            </div>
          )}
          {phase === "saving" && <p className="muted" style={{ marginTop: 14 }}>Writing face vector to sqlite3.db...</p>}
          {phase === "angles" && (
            <div className="row" style={{ marginTop: 14 }}>
              <button className="btn primary" type="button" onClick={() => savePerson(frames)} disabled={busy}>
                {busy ? "Saving..." : "Retry save"}
              </button>
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Identity record</h2>
          <div className="form">
            <label>Full name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aisha Khan" /></label>
            <label>Person ID<input value={personId} onChange={(e) => setPersonId(e.target.value)} placeholder="STU-1042" /></label>
            <label>Notes<textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></label>
            {phase === "idle" ? (
              <button className="btn primary" type="button" onClick={startEnroll}>Start live capture</button>
            ) : (
              <button className="btn ghost" type="button" onClick={() => { setPhase("idle"); setMessage(""); }}>Cancel</button>
            )}
            {message && <div className="toast">{message}</div>}
          </div>

          <h3 style={{ marginTop: 24 }}>Registry</h3>
          <div className="people">
            {people.length === 0 && <p className="muted">No identities in sqlite3.db yet.</p>}
            {people.map((p) => (
              <article className="person-card" key={p.id}>
                {p.thumbnail_url ? <img src={p.thumbnail_url} alt="" /> : <div className="avatar" />}
                <div>
                  <b>{p.name}</b>
                  <span>{p.person_id}</span>
                </div>
                <button className="btn ghost" type="button" onClick={async () => { await api.remove(p.id); await refresh(); }}>
                  Remove
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="panel">
        <h3>Scan log</h3>
        <div className="event-list">
          {events.length === 0 && <p className="muted">No scans yet.</p>}
          {events.map((e) => (
            <div className="event" key={e.id}>
              <span>{e.result} · {e.reason}</span>
              <span className="muted">{e.person?.name || "—"}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

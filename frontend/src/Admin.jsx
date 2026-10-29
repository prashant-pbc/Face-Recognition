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
  const [challenge, setChallenge] = useState(() => pickChallenge());
  const [phase, setPhase] = useState("idle");
  const [frames, setFrames] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const advancedRef = useRef(false);
  const formRef = useRef({ name: "", personId: "", notes: "" });

  formRef.current = { name, personId, notes };

  async function refresh() {
    setPeople(await api.people());
  }

  useEffect(() => {
    refresh().catch((e) => setMessage(e.message));
  }, []);

  const met = useMemo(() => challengeMet(challenge.id, cam.live), [challenge.id, cam.live]);
  const hint = useMemo(() => challengeHint(challenge.id, cam.live), [challenge.id, cam.live]);

  async function savePerson(images) {
    const form = formRef.current;
    setBusy(true);
    setMessage("Saving...");
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
      const second = cam.snapshot();
      const images = [first, second];
      setFrames(images);
      savePerson(images);
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

  function grabAngle() {
    if (cam.live.faceCount !== 1) {
      setMessage("Keep one face in frame");
      return;
    }
    setFrames((prev) => [...prev, cam.snapshot()].slice(0, 3));
  }

  return (
    <div className="page grid-2">
      <section className="panel">
        <h2>Live enrollment</h2>
        <p className="hint">
          Fill name and ID, then look at the camera and blink once. Photos and phone screens are rejected.
        </p>
        <div className="steps">
          <span className={phase !== "idle" ? "done" : "now"} />
          <span className={phase === "challenge" ? "now" : phase === "saving" || phase === "angles" || frames.length ? "done" : ""} />
          <span className={phase === "saving" ? "now" : frames.length >= 2 ? "done" : ""} />
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
        {phase === "saving" && (
          <p className="muted" style={{ marginTop: 14 }}>
            Saving person...
          </p>
        )}
        {phase === "angles" && (
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn" onClick={grabAngle} type="button">
              Extra photo ({frames.length}/3)
            </button>
            <button
              className="btn primary"
              onClick={() => savePerson(frames)}
              type="button"
              disabled={busy || frames.length < 2}
            >
              {busy ? "Saving..." : "Save person"}
            </button>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Person details</h2>
        <div className="form">
          <label>
            Full name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aisha Khan" />
          </label>
          <label>
            Person ID
            <input value={personId} onChange={(e) => setPersonId(e.target.value)} placeholder="STU-1042" />
          </label>
          <label>
            Notes
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </label>
          {phase === "idle" && (
            <button className="btn primary" type="button" onClick={startEnroll}>
              Start live capture
            </button>
          )}
          {phase !== "idle" && (
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                setPhase("idle");
                setFrames([]);
                setMessage("");
              }}
            >
              Cancel
            </button>
          )}
          {message && <div className="toast">{message}</div>}
        </div>

        <h3 style={{ marginTop: 28 }}>Enrolled ({people.length})</h3>
        <div className="people">
          {people.length === 0 && <p className="muted">No people yet.</p>}
          {people.map((p) => (
            <article className="person-card" key={p.id}>
              {p.thumbnail_url ? <img src={p.thumbnail_url} alt="" /> : <div className="avatar" />}
              <div>
                <b>{p.name}</b>
                <span>{p.person_id}</span>
              </div>
              <button
                className="btn ghost"
                type="button"
                onClick={async () => {
                  await api.remove(p.id);
                  await refresh();
                }}
              >
                Remove
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

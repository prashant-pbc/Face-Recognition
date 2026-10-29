import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import CameraView from "./CameraView.jsx";
import { challengeHint, challengeMet, pickChallenge } from "./liveness";
import { useCamera } from "./useCamera";

const REASONS = {
  no_face: "No face in view",
  multiple_faces: "Only one person at a time",
  face_too_small: "Move closer",
  too_blurry: "Hold still",
  face_near_edge: "Center your face",
  blink_not_detected: "Blink was not a real blink",
  turn_left_not_detected: "Turn your head more",
  turn_right_not_detected: "Turn your head more",
  spoof_detected: "Photo, screen, or video — not a live person",
  screen_like_texture: "Looks like a screen, not a real face",
  flat_image: "Flat image detected",
  no_natural_motion: "A still photo cannot pass",
  too_few_frames: "Stay in frame a bit longer",
  look_at_camera: "Look at the camera",
  unknown_person: "Live face, but not in sqlite3.db",
};

export default function Recognize() {
  const cam = useCamera();
  const [challenge, setChallenge] = useState(() => pickChallenge());
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(true);

  const met = useMemo(() => challengeMet(challenge.id, cam.live), [challenge.id, cam.live]);
  const hint = useMemo(() => challengeHint(challenge.id, cam.live), [challenge.id, cam.live]);

  async function scan() {
    if (busy || !cam.ready) return;
    if (cam.live.faceCount !== 1) return;
    setBusy(true);
    try {
      const data = await api.analyze({
        image: cam.snapshot(),
        challenge: challenge.id,
        signals: cam.signals(),
        mode: "recognize",
      });
      setResult(data);
      cam.resetStats();
      setChallenge(pickChallenge());
    } catch (err) {
      setResult({ ok: false, status: "reject", reason: err.message, person: null });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!auto || !met || busy) return;
    if (cam.live.faceCount !== 1) return;
    const t = setTimeout(scan, 700);
    return () => clearTimeout(t);
  }, [auto, met, busy, cam.live.faceCount]);

  const status = result?.status;
  return (
    <div className="page grid-2">
      <section className="panel">
        <h2>Live recognition</h2>
        <p className="hint">
          <span className="pulse" />
          Details appear only for a real person in front of this camera who is already in sqlite3.db.
        </p>
        <CameraView
          videoRef={cam.videoRef}
          canvasRef={cam.canvasRef}
          live={cam.live}
          ready={cam.ready}
          error={cam.error}
          challenge={challenge.label}
        />
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn primary" type="button" onClick={scan} disabled={busy}>
            {busy ? "Checking..." : "Scan now"}
          </button>
          <button className="btn ghost" type="button" onClick={() => setAuto((v) => !v)}>
            Auto {auto ? "on" : "off"}
          </button>
        </div>
      </section>

      <section className="panel result">
        {!result && (
          <div>
            <div className="kicker">Waiting</div>
            <p className="challenge">{challenge.label}</p>
            <p className="muted">{met ? "Challenge complete. Checking liveness..." : hint}</p>
          </div>
        )}
        {status === "match" && result.person && (
          <div>
            <div className="kicker status-live">Live match</div>
            {result.person.thumbnail_url ? <img src={result.person.thumbnail_url} alt="" /> : <div className="avatar" />}
            <h2>{result.person.name}</h2>
            <p>{result.person.person_id}</p>
            <p className="muted">{result.person.notes || "No notes"}</p>
          </div>
        )}
        {status === "unknown" && (
          <div>
            <div className="kicker status-unknown">Unknown live face</div>
            <h2>Not in sqlite3.db</h2>
            <p className="muted">This looks like a real person, but they have not been enrolled.</p>
          </div>
        )}
        {status === "reject" && (
          <div>
            <div className="kicker status-spoof">Rejected</div>
            <h2>Not a live person</h2>
            <p className="muted">{REASONS[result.reason] || result.reason}</p>
          </div>
        )}
      </section>
    </div>
  );
}

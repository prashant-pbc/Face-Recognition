export default function CameraView({ videoRef, canvasRef, live, challenge, ready, error }) {
  const faceOk = live.faceCount === 1;
  let status = "no face";
  if (error) status = error;
  else if (!ready) status = "starting camera";
  else if (live.faceCount > 1) status = "too many faces";
  else if (faceOk && !live.ready) status = "look at the camera";
  else if (faceOk) status = "1 live face";

  return (
    <div className="camera-wrap">
      <video ref={videoRef} playsInline muted autoPlay />
      <canvas ref={canvasRef} className="overlay" />
      <div className="hud">
        <div className={`chip ${faceOk && live.ready ? "ok" : faceOk ? "warn" : "bad"}`}>{status}</div>
        <div className="chip">{challenge}</div>
        <div className={`chip ${live.blinkCount ? "ok" : live.eyesClosed ? "warn" : ""}`}>
          {live.eyesClosed ? "blink…" : `blinks ${live.blinkCount}`}
        </div>
      </div>
    </div>
  );
}

export default function CameraView({ videoRef, canvasRef, live, challenge, ready, error }) {
  const faceOk = live.faceCount === 1;
  return (
    <div className="camera-wrap">
      <video ref={videoRef} playsInline muted autoPlay />
      <canvas ref={canvasRef} className="overlay" />
      <div className="hud">
        <div className={`chip ${faceOk ? "ok" : "bad"}`}>
          {error ? error : !ready ? "starting camera" : faceOk ? "1 live face" : live.faceCount > 1 ? "too many faces" : "no face"}
        </div>
        <div className="chip">{challenge}</div>
        <div className="chip">blinks {live.blinkCount} · turn {Math.round(live.yaw || 0)}</div>
      </div>
    </div>
  );
}

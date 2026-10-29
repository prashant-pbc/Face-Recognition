import { useEffect, useRef, useState } from "react";
import { analyzeLandmarks, createLandmarker } from "./liveness";

export function captureFrame(video) {
  const canvas = document.createElement("canvas");
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.86);
}

export function useCamera() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);
  const prevRef = useRef(null);
  const statsRef = useRef({
    blinkCount: 0,
    frames: 0,
    motion: 0,
    yaw: 0,
    minYaw: 0,
    maxYaw: 0,
    pitch: 0,
    ear: 1,
    depthVar: 0,
    screenHint: 0,
    faceCount: 0,
  });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [live, setLive] = useState(statsRef.current);

  useEffect(() => {
    let stream;
    let raf;
    let cancelled = false;

    async function start() {
      try {
        landmarkerRef.current = await createLandmarker();
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
          audio: false,
        });
        if (cancelled) return;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        setReady(true);
        const loop = () => {
          if (cancelled) return;
          const videoEl = videoRef.current;
          const overlay = canvasRef.current;
          const landmarker = landmarkerRef.current;
          if (videoEl && overlay && landmarker && videoEl.readyState >= 2) {
            overlay.width = videoEl.videoWidth;
            overlay.height = videoEl.videoHeight;
            const ts = performance.now();
            const result = landmarker.detectForVideo(videoEl, ts);
            const sample = analyzeLandmarks(result, prevRef.current);
            prevRef.current = sample;
            const stats = statsRef.current;
            stats.frames += 1;
            stats.yaw = sample.yaw;
            stats.minYaw = Math.min(stats.minYaw, sample.yaw);
            stats.maxYaw = Math.max(stats.maxYaw, sample.yaw);
            stats.pitch = sample.pitch;
            stats.ear = sample.ear;
            stats.depthVar = sample.depthVar;
            stats.screenHint = sample.screenHint;
            stats.faceCount = sample.faceCount;
            stats.motion = stats.motion * 0.85 + sample.motion * 0.15;
            if (sample.blink) stats.blinkCount += 1;
            if (stats.frames % 4 === 0) setLive({ ...stats });
            const ctx = overlay.getContext("2d");
            ctx.clearRect(0, 0, overlay.width, overlay.height);
            if (sample.landmarks) {
              ctx.save();
              ctx.strokeStyle = sample.faceCount === 1 ? "#7dffc3" : "#ff6b6b";
              ctx.lineWidth = 3;
              const xs = sample.landmarks.map((p) => p.x * overlay.width);
              const ys = sample.landmarks.map((p) => p.y * overlay.height);
              const x1 = Math.min(...xs);
              const y1 = Math.min(...ys);
              const x2 = Math.max(...xs);
              const y2 = Math.max(...ys);
              ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
              ctx.restore();
            }
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch (err) {
        setError(err.message || "Camera permission denied");
      }
    }

    start();
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      landmarkerRef.current?.close?.();
    };
  }, []);

  function resetStats() {
    statsRef.current = {
      blinkCount: 0,
      frames: 0,
      motion: 0,
      yaw: 0,
      minYaw: 0,
      maxYaw: 0,
      pitch: 0,
      ear: 1,
      depthVar: 0,
      screenHint: 0,
      faceCount: 0,
    };
    prevRef.current = null;
    setLive({ ...statsRef.current });
  }

  function snapshot() {
    return captureFrame(videoRef.current);
  }

  function signals() {
    const s = statsRef.current;
    return {
      blinkCount: s.blinkCount,
      frames: s.frames,
      motion: Number(s.motion.toFixed(3)),
      yaw: Number(s.yaw.toFixed(2)),
      minYaw: Number(s.minYaw.toFixed(2)),
      maxYaw: Number(s.maxYaw.toFixed(2)),
      pitch: Number(s.pitch.toFixed(2)),
      ear: Number(s.ear.toFixed(3)),
      depthVar: Number(s.depthVar.toFixed(4)),
      screenHint: Number(s.screenHint.toFixed(3)),
    };
  }

  return { videoRef, canvasRef, ready, error, live, resetStats, snapshot, signals };
}

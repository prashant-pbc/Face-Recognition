import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

const LEFT = [33, 160, 158, 133, 153, 144];
const RIGHT = [362, 385, 387, 263, 373, 380];

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z || 0) - (b.z || 0);
  return Math.hypot(dx, dy, dz);
}

function ear(lm, idx) {
  const [p1, p2, p3, p4, p5, p6] = idx.map((i) => lm[i]);
  return (dist(p2, p6) + dist(p3, p5)) / (2 * dist(p1, p4) + 1e-6);
}

function yawPitch(lm) {
  const l = lm[33];
  const r = lm[263];
  const nose = lm[1];
  const midX = (l.x + r.x) / 2;
  const yaw = (nose.x - midX) * 220;
  const brow = lm[10];
  const chin = lm[152];
  const midY = (brow.y + chin.y) / 2;
  const pitch = (nose.y - midY) * 220;
  return { yaw, pitch };
}

function screenHint(lm) {
  const zs = lm.map((p) => p.z || 0);
  const mean = zs.reduce((a, b) => a + b, 0) / zs.length;
  const variance = zs.reduce((a, b) => a + (b - mean) ** 2, 0) / zs.length;
  const depthVar = Math.sqrt(variance);
  const flat = depthVar < 0.012 ? 0.85 : depthVar < 0.02 ? 0.45 : 0.12;
  return { depthVar, screenHint: flat };
}

export async function createLandmarker() {
  const files = await FilesetResolver.forVisionTasks(WASM);
  return FaceLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: MODEL, delegate: "CPU" },
    runningMode: "VIDEO",
    numFaces: 2,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

export function analyzeLandmarks(result, prev) {
  const faces = result?.faceLandmarks || [];
  if (!faces.length) {
    return {
      faceCount: 0,
      ear: 1,
      blink: false,
      yaw: 0,
      pitch: 0,
      motion: 0,
      depthVar: 0,
      screenHint: 0,
    };
  }
  const lm = faces[0];
  const left = ear(lm, LEFT);
  const right = ear(lm, RIGHT);
  const earAvg = (left + right) / 2;
  const { yaw, pitch } = yawPitch(lm);
  const { depthVar, screenHint: hint } = screenHint(lm);
  const blink = earAvg < 0.19 && (prev?.ear || 1) > 0.21;
  const motion = prev
    ? Math.min(3, Math.abs(yaw - prev.yaw) + Math.abs(pitch - prev.pitch) + Math.abs(earAvg - prev.ear) * 8)
    : 0;
  return {
    faceCount: faces.length,
    ear: earAvg,
    blink,
    yaw,
    pitch,
    motion,
    depthVar,
    screenHint: hint,
    landmarks: lm,
  };
}

export const CHALLENGES = [
  { id: "blink", label: "Blink twice, slowly" },
  { id: "turn_left", label: "Turn your head LEFT" },
  { id: "turn_right", label: "Turn your head RIGHT" },
];

export function pickChallenge() {
  return CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
}

export function challengeMet(id, sample) {
  if (id === "blink") return sample.blinkCount >= 2;
  if (id === "turn_left") return sample.yaw <= -16;
  if (id === "turn_right") return sample.yaw >= 16;
  return false;
}

import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

function dist2d(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function eyeOpen(lm) {
  const left = dist2d(lm[159], lm[145]) / (dist2d(lm[33], lm[133]) + 1e-6);
  const right = dist2d(lm[386], lm[374]) / (dist2d(lm[362], lm[263]) + 1e-6);
  return (left + right) / 2;
}

function blendBlink(result) {
  const cats = result?.faceBlendshapes?.[0]?.categories || [];
  let left = 0;
  let right = 0;
  let found = false;
  for (const c of cats) {
    if (c.categoryName === "eyeBlinkLeft") {
      left = c.score;
      found = true;
    }
    if (c.categoryName === "eyeBlinkRight") {
      right = c.score;
      found = true;
    }
  }
  return found ? (left + right) / 2 : 0;
}

function yawPitch(lm) {
  const l = lm[33];
  const r = lm[263];
  const nose = lm[1];
  const midX = (l.x + r.x) / 2;
  const yaw = (nose.x - midX) * 400;
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
  const flat = depthVar < 0.008 ? 0.7 : 0.1;
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
    outputFaceBlendshapes: true,
  });
}

export function analyzeLandmarks(result, prev, base) {
  const faces = result?.faceLandmarks || [];
  if (!faces.length) {
    return {
      faceCount: 0,
      ear: base?.ear || 0.25,
      blinkScore: 0,
      eyesClosed: false,
      closedFrames: 0,
      blink: false,
      yaw: 0,
      relYaw: 0,
      pitch: 0,
      motion: 0,
      depthVar: 0,
      screenHint: 0,
    };
  }

  const lm = faces[0];
  const earAvg = eyeOpen(lm);
  const blinkScore = blendBlink(result);
  const { yaw, pitch } = yawPitch(lm);
  const { depthVar, screenHint: hint } = screenHint(lm);
  const relYaw = yaw - (base?.yaw || 0);

  const ready = Boolean(base?.ready);
  const baseEar = base?.ear || 0.25;
  const baseBlink = base?.blinkScore || 0;
  const earDrop = earAvg < baseEar * 0.62 && earAvg < 0.19;
  const blendClose = blinkScore >= Math.max(0.58, baseBlink + 0.3);
  const closed = ready && (blendClose || earDrop);
  const closedFrames = closed ? (prev?.closedFrames || 0) + 1 : 0;
  const blink = ready && !closed && (prev?.closedFrames || 0) >= 1;

  const motion = prev
    ? Math.min(4, Math.abs(yaw - prev.yaw) + Math.abs(pitch - prev.pitch) + Math.abs(earAvg - prev.ear) * 10)
    : 0;

  return {
    faceCount: faces.length,
    ear: earAvg,
    blinkScore,
    eyesClosed: closed,
    closedFrames,
    blink,
    yaw,
    relYaw,
    pitch,
    motion,
    depthVar,
    screenHint: hint,
    landmarks: lm,
  };
}

export const CHALLENGES = [
  { id: "blink", label: "Blink once" },
  { id: "turn_head", label: "Turn your head to the side, then face the camera" },
];

export function pickChallenge() {
  return CHALLENGES[0];
}

const TURN_NEED = 9;

export function challengeMet(id, sample) {
  if (!sample?.ready) return false;
  if (id === "blink") return (sample.blinkCount || 0) >= 1;
  if (id === "turn_head" || id === "turn_left" || id === "turn_right") {
    return (sample.yawRange || 0) >= TURN_NEED;
  }
  return false;
}

export function challengeHint(id, sample) {
  if (!sample?.ready) return "Look at the camera…";
  if (id === "blink") {
    if (sample.eyesClosed) return "Good — now open your eyes";
    if ((sample.blinkCount || 0) >= 1) return "Blink seen";
    return "Blink once, then open your eyes";
  }
  const pct = Math.min(100, Math.round(((sample.yawRange || 0) / TURN_NEED) * 100));
  if (pct >= 100) return "Head turn seen";
  return `Turn your head left or right (${pct}%)`;
}

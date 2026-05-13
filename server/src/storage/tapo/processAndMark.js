// server/src/storage/tapo/processAndMark.js
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DateTime } from "luxon";
import { pool } from "../../utils/mysqlPool.js";

import "@tensorflow/tfjs-node";
import * as faceapi from "@vladmandic/face-api";
import canvas from "canvas";

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const TZ = "America/Guayaquil";

// ====== Config por ENV ======
const DETECTOR = String(process.env.TAPO_DETECTOR || "ssd").toLowerCase();
const FACE_THRESHOLD = Number(process.env.TAPO_FACE_THRESHOLD || 0.50);
const MAX_RESULTS = Number(process.env.TAPO_MAX_RESULTS || 120);
const SSD_MIN_CONF = Number(process.env.TAPO_MIN_CONFIDENCE || 0.18);
const SSD_INPUT_SIZE = Number(process.env.TAPO_SSD_INPUT_SIZE || 512);
const TINY_INPUT_SIZE = Number(process.env.TAPO_TINY_INPUT_SIZE || 512);
const TINY_SCORE_THRESHOLD = Number(process.env.TAPO_TINY_SCORE_THRESHOLD || 0.12);
const DEBUG = String(process.env.TAPO_DEBUG_PROCESS || "1") === "1";

const UPSCALE_1 = Number(process.env.TAPO_UPSCALE_1 || 1.0);
const UPSCALE_2 = Number(process.env.TAPO_UPSCALE_2 || 1.5);
const UPSCALE_3 = Number(process.env.TAPO_UPSCALE_3 || 2.0);

const ENHANCE = String(process.env.TAPO_ENHANCE || "1") === "1";
const CONTRAST = Number(process.env.TAPO_CONTRAST || 1.10);
const SHARPEN = Number(process.env.TAPO_SHARPEN || 0);
const MIN_FACE_PX = Number(process.env.TAPO_MIN_FACE_PX || 20);
const CROP_MARGIN = Number(process.env.TAPO_CROP_MARGIN || 0.22);

let FACEAPI_LOADED = false;

// ====== Helpers ======
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function distToPercent(distance) {
  return Math.round(clamp((1 - distance) * 100, 0, 100));
}

function resolveModelsPath() {
  return path.resolve(process.cwd(), "models");
}

async function ensureFaceApiLoaded() {
  if (FACEAPI_LOADED) return;

  const modelPath = resolveModelsPath();
  if (!fs.existsSync(modelPath)) {
    throw new Error(`No existe la carpeta de modelos de face-api: ${modelPath}`);
  }

  await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
  await faceapi.nets.tinyFaceDetector.loadFromDisk(modelPath);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);

  FACEAPI_LOADED = true;
}

function normalizeDescriptors(faceDescriptorValue) {
  if (!faceDescriptorValue) return [];

  let raw = faceDescriptorValue;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }

  if (Array.isArray(raw) && raw.length === 128 && typeof raw[0] === "number") {
    return [raw];
  }

  if (Array.isArray(raw) && Array.isArray(raw[0])) {
    return raw;
  }

  return [];
}

function createBaseCanvasFromImage(img) {
  const c = canvas.createCanvas(img.width, img.height);
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0, img.width, img.height);
  return c;
}

function applyImageEnhancement(srcCanvas) {
  const w = srcCanvas.width;
  const h = srcCanvas.height;

  const out = canvas.createCanvas(w, h);
  const ctx = out.getContext("2d");

  ctx.filter = `contrast(${CONTRAST})`;
  ctx.drawImage(srcCanvas, 0, 0, w, h);

  if (SHARPEN > 0) {
    const imageData = ctx.getImageData(0, 0, w, h);
    const src = imageData.data;
    const dst = new Uint8ClampedArray(src.length);

    const kernel = [
      0, -1, 0,
      -1, 5, -1,
      0, -1, 0,
    ];

    const idx = (x, y, cch) => ((y * w + x) * 4 + cch);

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        for (let cch = 0; cch < 3; cch++) {
          let sum = 0;
          let ki = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              sum += src[idx(x + kx, y + ky, cch)] * kernel[ki++];
            }
          }
          dst[idx(x, y, cch)] = clamp(sum * SHARPEN + src[idx(x, y, cch)] * (1 - SHARPEN), 0, 255);
        }
        dst[idx(x, y, 3)] = src[idx(x, y, 3)];
      }
    }

    ctx.putImageData(new ImageData(dst, w, h), 0, 0);
  }

  return out;
}

function upscaleCanvas(srcCanvas, scale = 1) {
  if (!scale || scale === 1) return srcCanvas;

  const w = Math.round(srcCanvas.width * scale);
  const h = Math.round(srcCanvas.height * scale);

  const out = canvas.createCanvas(w, h);
  const ctx = out.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(srcCanvas, 0, 0, w, h);
  return out;
}

function getBoxArea(box) {
  return Math.max(0, box.width) * Math.max(0, box.height);
}

function iou(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);

  const interW = Math.max(0, x2 - x1);
  const interH = Math.max(0, y2 - y1);
  const interArea = interW * interH;

  const union = getBoxArea(a) + getBoxArea(b) - interArea;
  if (union <= 0) return 0;
  return interArea / union;
}

function expandBox(box, baseW, baseH, margin = 0.22) {
  const mx = box.width * margin;
  const my = box.height * margin;

  const x = clamp(Math.floor(box.x - mx), 0, baseW - 1);
  const y = clamp(Math.floor(box.y - my), 0, baseH - 1);
  const maxW = baseW - x;
  const maxH = baseH - y;
  const width = clamp(Math.floor(box.width + mx * 2), 1, maxW);
  const height = clamp(Math.floor(box.height + my * 2), 1, maxH);

  return { x, y, width, height };
}

function cropCanvas(srcCanvas, box) {
  const out = canvas.createCanvas(box.width, box.height);
  const ctx = out.getContext("2d");
  ctx.drawImage(
    srcCanvas,
    box.x,
    box.y,
    box.width,
    box.height,
    0,
    0,
    box.width,
    box.height
  );
  return out;
}

function toPlainBox(rawBox, scale = 1) {
  return {
    x: rawBox.x / scale,
    y: rawBox.y / scale,
    width: rawBox.width / scale,
    height: rawBox.height / scale,
  };
}

function dedupeBoxes(boxes) {
  const ordered = [...boxes].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const result = [];

  for (const candidate of ordered) {
    const duplicated = result.some((r) => iou(candidate.box, r.box) >= 0.60);
    if (!duplicated) result.push(candidate);
  }

  return result;
}

async function detectBoxesWithSSD(sourceCanvas, scale) {
  const options = new faceapi.SsdMobilenetv1Options({
    minConfidence: SSD_MIN_CONF,
    maxResults: MAX_RESULTS,
  });

  const detections = await faceapi.detectAllFaces(sourceCanvas, options);

  return detections
    .map((det) => ({
      detector: "ssd",
      score: det.score,
      box: toPlainBox(det.box, scale),
    }))
    .filter((d) => d.box.width >= MIN_FACE_PX && d.box.height >= MIN_FACE_PX);
}

async function detectBoxesWithTiny(sourceCanvas, scale) {
  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: TINY_INPUT_SIZE,
    scoreThreshold: TINY_SCORE_THRESHOLD,
  });

  const detections = await faceapi.detectAllFaces(sourceCanvas, options);

  return detections
    .map((det) => ({
      detector: "tiny",
      score: det.score,
      box: toPlainBox(det.box, scale),
    }))
    .filter((d) => d.box.width >= MIN_FACE_PX && d.box.height >= MIN_FACE_PX);
}

async function detectCandidateBoxes(baseCanvas) {
  const scales = [UPSCALE_1, UPSCALE_2, UPSCALE_3].filter((v, i, arr) => v > 0 && arr.indexOf(v) === i);
  const all = [];

  for (const scale of scales) {
    const scaled = upscaleCanvas(baseCanvas, scale);

    const ssdBoxes = await detectBoxesWithSSD(scaled, scale);
    all.push(...ssdBoxes);

    const tinyBoxes = await detectBoxesWithTiny(scaled, scale);
    all.push(...tinyBoxes);
  }

  return dedupeBoxes(all);
}

async function extractDescriptorFromCrop(workingCanvas, box, baseW, baseH) {
  const cropBox = expandBox(box, baseW, baseH, CROP_MARGIN);
  const cropped = cropCanvas(workingCanvas, cropBox);

  const trySSD = await faceapi
    .detectSingleFace(
      cropped,
      new faceapi.SsdMobilenetv1Options({
        minConfidence: Math.max(0.10, SSD_MIN_CONF - 0.06),
      })
    )
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (trySSD?.descriptor) {
    return { descriptor: trySSD.descriptor, cropBox, method: "ssd-crop" };
  }

  const tryTiny = await faceapi
    .detectSingleFace(
      cropped,
      new faceapi.TinyFaceDetectorOptions({
        inputSize: TINY_INPUT_SIZE,
        scoreThreshold: Math.max(0.08, TINY_SCORE_THRESHOLD - 0.03),
      })
    )
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (tryTiny?.descriptor) {
    return { descriptor: tryTiny.descriptor, cropBox, method: "tiny-crop" };
  }

  return null;
}

// ====== DB ======
async function getEvidenceById(evidenceId) {
  const [rows] = await pool.query(
    `SELECT
      id,
      subject_id AS subjectId,
      session_id AS sessionId,
      shot_type AS shotType,
      taken_at AS takenAt,
      file_name AS fileName,
      file_path AS filePath
     FROM attendance_evidence
     WHERE id=? LIMIT 1`,
    [evidenceId]
  );
  return rows[0] || null;
}

async function getSubjectSettings(subjectId) {
  const [rows] = await pool.query(
    `SELECT grace_minutes AS graceMinutes
     FROM settings
     WHERE subject_id=? LIMIT 1`,
    [String(subjectId)]
  );
  const graceMinutes = rows.length ? Number(rows[0].graceMinutes ?? 10) : 10;
  return { graceMinutes };
}

async function getScheduleBySessionKey(sessionKey) {
  const scheduleId = String(sessionKey || "").split("_")[0] || "";
  if (!scheduleId) return null;

  const [rows] = await pool.query(
    `SELECT id, subject_id AS subjectId, start_time AS startTime
     FROM schedules
     WHERE id=? LIMIT 1`,
    [scheduleId]
  );
  return rows[0] || null;
}

async function isStudentEnrolled({ subjectId, studentId }) {
  const [rows] = await pool.query(
    `SELECT 1
     FROM enrollments
     WHERE subject_id=? AND student_id=?
     LIMIT 1`,
    [String(subjectId), String(studentId)]
  );
  return rows.length > 0;
}

async function getUsersMapWithDescriptors() {
  const [rows] = await pool.query(
    `SELECT id, name, role, face_descriptor AS faceDescriptor
     FROM users
     WHERE face_descriptor IS NOT NULL`
  );

  const labeled = [];
  const userMap = new Map();

  for (const u of rows) {
    if (u.role && String(u.role).toLowerCase() !== "student") continue;

    const list = normalizeDescriptors(u.faceDescriptor);
    if (!list.length) continue;

    const descs = list.map((d) => new Float32Array(d));
    labeled.push(new faceapi.LabeledFaceDescriptors(String(u.id), descs));
    userMap.set(String(u.id), String(u.name || ""));
  }

  return { labeled, userMap };
}

async function alreadyMarked({ subjectId, studentId, sessionKey }) {
  const [rows] = await pool.query(
    `SELECT 1
     FROM attendance
     WHERE subject_id=? AND student_id=? AND session_key=? AND method='TAPO'
     LIMIT 1`,
    [String(subjectId), String(studentId), String(sessionKey)]
  );
  return rows.length > 0;
}

async function insertAttendance({ subjectId, studentId, timestamp, sessionKey, status }) {
  const st = String(status).toLowerCase();
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

  await pool.query(
    `INSERT INTO attendance
     (id, subject_id, student_id, timestamp, method, status, approval_status, session_key, created_at)
     VALUES (?, ?, ?, ?, 'TAPO', ?, 'approved', ?, ?)`,
    [
      id,
      String(subjectId),
      String(studentId),
      timestamp,
      st,
      String(sessionKey),
      DateTime.now().setZone(TZ).toSQL({ includeOffset: false }),
    ]
  );
}

function mysqlDateTimeToEcuadorDateTime(value) {
  if (!value) return DateTime.now().setZone(TZ);

  if (value instanceof Date) {
    // MySQL DATETIME llega como Date en UTC, pero el valor real ya representa hora Ecuador.
    // Por eso tomamos la parte YYYY-MM-DDTHH:mm:ss sin convertirla nuevamente.
    const localLike = value.toISOString().slice(0, 19);
    const parsed = DateTime.fromISO(localLike, { zone: TZ });
    return parsed.isValid ? parsed : DateTime.fromJSDate(value).setZone(TZ);
  }

  const text = String(value).trim().replace(" ", "T").slice(0, 19);
  const parsed = DateTime.fromISO(text, { zone: TZ });

  return parsed.isValid
    ? parsed
    : DateTime.fromJSDate(new Date(value)).setZone(TZ);
}

function computeStatusByGrace({ takenAt, startsAt, graceMinutes }) {
  const graceEnd = startsAt.plus({ minutes: Number(graceMinutes ?? 10) });
  return takenAt <= graceEnd ? "present" : "late";
}

// ====== MAIN ======
export async function processEvidenceAndMark({
  evidenceId,
  threshold = FACE_THRESHOLD,
}) {
  await ensureFaceApiLoaded();

  const ev = await getEvidenceById(evidenceId);
  if (!ev) throw new Error("Evidence no existe en MySQL");

  const abs = path.resolve(ev.filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Archivo no existe en disco: ${abs}`);
  }

  const img = await canvas.loadImage(abs);
  const baseW = img.width;
  const baseH = img.height;

  const baseCanvas = createBaseCanvasFromImage(img);
  const workingCanvas = ENHANCE ? applyImageEnhancement(baseCanvas) : baseCanvas;

  const { labeled, userMap } = await getUsersMapWithDescriptors();
  if (!labeled.length) {
    return {
      ok: true,
      facesDetected: 0,
      unknownCount: 0,
      recognized: [],
      marked: [],
      debugFaces: [],
      summary: {
        evidenceId: ev.id,
        subjectId: String(ev.subjectId),
        sessionKey: String(ev.sessionId),
        detected: 0,
        recognized: 0,
        marked: 0,
        unknown: 0,
      },
      message: "No hay descriptores en users.face_descriptor",
      used: { detector: DETECTOR, threshold, baseW, baseH },
    };
  }

  const matcher = new faceapi.FaceMatcher(labeled, threshold);

  const takenAt = mysqlDateTimeToEcuadorDateTime(ev.takenAt);
  const sessionKey = String(ev.sessionId);

  const schedule = await getScheduleBySessionKey(sessionKey);
  const { graceMinutes } = await getSubjectSettings(ev.subjectId);

  let startsAt = null;
  if (schedule?.startTime) {
    const startTime = String(schedule.startTime).slice(0, 8);
    startsAt = DateTime.fromISO(`${takenAt.toISODate()}T${startTime}`, { zone: TZ });
  }

  const marked = [];
  const recognized = [];
  const debugFaces = [];
  let unknownCount = 0;

  const seenStudents = new Set();

  const candidateBoxes = await detectCandidateBoxes(workingCanvas);

  for (const candidate of candidateBoxes) {
    const box = candidate.box;

    if (box.width < MIN_FACE_PX || box.height < MIN_FACE_PX) {
      if (DEBUG) {
        debugFaces.push({
          label: "ignored",
          fullName: "Muy pequeño",
          distance: null,
          percent: null,
          enrolled: false,
          alreadyMarked: false,
          marked: false,
          detector: candidate.detector,
          reason: `Caja muy pequeña (${Math.round(box.width)}x${Math.round(box.height)})`,
        });
      }
      continue;
    }

    const extracted = await extractDescriptorFromCrop(workingCanvas, box, baseW, baseH);

    if (!extracted?.descriptor) {
      unknownCount++;
      if (DEBUG) {
        debugFaces.push({
          label: "unknown",
          fullName: "Desconocido",
          distance: null,
          percent: null,
          enrolled: false,
          alreadyMarked: false,
          marked: false,
          detector: candidate.detector,
          reason: "Se detectó el rostro, pero no se pudo extraer descriptor",
        });
      }
      continue;
    }

    const best = matcher.findBestMatch(extracted.descriptor);
    const distance = best.distance;
    const percent = distToPercent(distance);

    if (best.label === "unknown") {
      unknownCount++;
      if (DEBUG) {
        debugFaces.push({
          label: "unknown",
          fullName: "Desconocido",
          distance,
          percent,
          enrolled: false,
          alreadyMarked: false,
          marked: false,
          detector: candidate.detector,
          extraction: extracted.method,
          reason: "No coincide con ningún descriptor",
        });
      }
      continue;
    }

    const studentId = String(best.label);
    const fullName = userMap.get(studentId) || "";

    if (seenStudents.has(studentId)) {
      if (DEBUG) {
        debugFaces.push({
          label: studentId,
          fullName,
          distance,
          percent,
          enrolled: null,
          alreadyMarked: null,
          marked: false,
          detector: candidate.detector,
          extraction: extracted.method,
          reason: "Misma persona repetida en la foto",
        });
      }
      continue;
    }
    seenStudents.add(studentId);

    const enrolled = await isStudentEnrolled({ subjectId: ev.subjectId, studentId });
    if (!enrolled) {
      recognized.push({ studentId, fullName, distance, percent, enrolled: false });
      if (DEBUG) {
        debugFaces.push({
          label: studentId,
          fullName,
          distance,
          percent,
          enrolled: false,
          alreadyMarked: false,
          marked: false,
          detector: candidate.detector,
          extraction: extracted.method,
          reason: "Reconocido, pero no está matriculado",
        });
      }
      continue;
    }

    const dup = await alreadyMarked({ subjectId: ev.subjectId, studentId, sessionKey });
    if (dup) {
      recognized.push({ studentId, fullName, distance, percent, enrolled: true });
      if (DEBUG) {
        debugFaces.push({
          label: studentId,
          fullName,
          distance,
          percent,
          enrolled: true,
          alreadyMarked: true,
          marked: false,
          detector: candidate.detector,
          extraction: extracted.method,
          reason: "Ya estaba marcado antes",
        });
      }
      continue;
    }

    const status = startsAt
      ? computeStatusByGrace({ takenAt, startsAt, graceMinutes })
      : "present";

    const ts = takenAt.toSQL({ includeOffset: false });

    await insertAttendance({
      subjectId: ev.subjectId,
      studentId,
      timestamp: ts,
      sessionKey,
      status,
    });

    marked.push({
      studentId,
      fullName,
      subjectId: String(ev.subjectId),
      sessionKey,
      evidenceId: ev.id,
      distance,
      percent,
      status,
    });

    recognized.push({
      studentId,
      fullName,
      distance,
      percent,
      enrolled: true,
    });

    if (DEBUG) {
      debugFaces.push({
        label: studentId,
        fullName,
        distance,
        percent,
        enrolled: true,
        alreadyMarked: false,
        marked: true,
        detector: candidate.detector,
        extraction: extracted.method,
        reason: `Asistencia registrada (${status})`,
      });
    }
  }

  return {
    ok: true,
    facesDetected: candidateBoxes.length,
    unknownCount,
    recognized,
    marked,
    debugFaces,
    summary: {
      evidenceId: ev.id,
      subjectId: String(ev.subjectId),
      sessionKey,
      detected: candidateBoxes.length,
      recognized: recognized.length,
      marked: marked.length,
      unknown: unknownCount,
    },
    message: `Detectadas ${candidateBoxes.length} caras. Reconocidos ${recognized.length}. Marcados ${marked.length}. Unknown ${unknownCount}.`,
    used: {
      detector: "ssd+tiny+multipass",
      threshold,
      maxResults: MAX_RESULTS,
      ssdMinConfidence: SSD_MIN_CONF,
      ssdInputSize: SSD_INPUT_SIZE,
      tinyInputSize: TINY_INPUT_SIZE,
      tinyScoreThreshold: TINY_SCORE_THRESHOLD,
      scales: [UPSCALE_1, UPSCALE_2, UPSCALE_3],
      minFacePx: MIN_FACE_PX,
      cropMargin: CROP_MARGIN,
      enhance: ENHANCE,
      contrast: CONTRAST,
      baseW,
      baseH,
    },
  };
}
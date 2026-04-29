import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { api } from "../api/client.js";

export default function FaceAttendanceScanner({ subjectId, enrolledStudents, onMarked }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const lastMarkedRef = useRef(new Map()); // faceId -> timestamp (ms)


  const [modelsReady, setModelsReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Listo.");

  const MATCH_THRESHOLD = 0.48;
  const INTERVAL_MS = 800;

  function stopCamera() {
    try {
      const s = streamRef.current;
      if (s) s.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    } catch (_e) {}
  }

  async function loadModels() {
    await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
    await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
    await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
    setModelsReady(true);
  }

  async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });
    streamRef.current = stream;
    videoRef.current.srcObject = stream;
    await videoRef.current.play();
  }

  function buildKnownList() {
  return (enrolledStudents || [])
    .map(s => {
      let fd = s?.faceDescriptor;

      // si viene string JSON desde MySQL → parse
      if (typeof fd === "string") {
        try { fd = JSON.parse(fd); } catch (_e) { fd = null; }
      }

      return { ...s, faceDescriptor: fd };
    })
    .filter(s => s?.faceId && Array.isArray(s.faceDescriptor) && s.faceDescriptor.length === 128)
    .map(s => ({
      student: s,
      descriptor: new Float32Array(s.faceDescriptor)
    }));
}


  async function markByFaceId(faceId) {
  return api(`/api/prof/subjects/${subjectId}/attendance/scan`, {
    method: "POST",
    auth: true,
    body: { faceId, timestamp: new Date().toISOString() }
  });
}


  useEffect(() => {
    loadModels().catch(() => setStatus("❌ No se pudieron cargar los modelos (/public/models)."));
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (!running) return;

    let interval = null;
    let cancelled = false;

    (async () => {
      try {
        if (!modelsReady) {
          setStatus("Cargando modelos...");
          return;
        }

        const known = buildKnownList();
        if (known.length === 0) {
          setStatus("⚠️ No hay estudiantes matriculados con rostro registrado (descriptor).");
          setRunning(false);
          return;
        }

        setStatus("Abriendo cámara...");
        await startCamera();
        setStatus("Escaneando... (pasa el estudiante frente a la cámara)");

        interval = setInterval(async () => {
          if (cancelled) return;
          const video = videoRef.current;
          if (!video || video.readyState < 2) return;

          const detections = await faceapi
  .detectAllFaces(
    video,
    new faceapi.TinyFaceDetectorOptions({ inputSize: 608, scoreThreshold: 0.3 })
  )
  .withFaceLandmarks()
  .withFaceDescriptors();

if (!detections || detections.length === 0) return;

// ✅ cooldown para no repetir marcaciones del mismo rostro
const now = Date.now();
const COOLDOWN_MS = 30_000; // 30s por estudiante

for (const det of detections) {
  let best = { dist: Infinity, student: null };

  for (const k of known) {
    const dist = faceapi.euclideanDistance(det.descriptor, k.descriptor);
    if (dist < best.dist) best = { dist, student: k.student };
  }

  if (!best.student) continue;
  if (best.dist > MATCH_THRESHOLD) continue;

  const fid = best.student.faceId;

  // si ya lo marcó hace poco, saltar
  const last = lastMarkedRef.current.get(fid) || 0;
  if (now - last < COOLDOWN_MS) continue;

  lastMarkedRef.current.set(fid, now);

  setStatus(`✅ Reconocido: ${best.student.name} (${fid}). Registrando...`);

  try {
    const r = await markByFaceId(fid);

    if (r?.stored?.status) {
      setStatus(`✅ Asistencia marcada (${r.stored.status}) para ${best.student.name}`);
      if (onMarked) await onMarked();
    } else if (r?.alreadyMarked) {
      setStatus(`ℹ️ Ya estaba registrado: ${best.student.name}`);
      if (onMarked) await onMarked();
    } else {
      setStatus("✅ Evento enviado.");
      if (onMarked) await onMarked();
    }
  } catch (e) {
    setStatus(`⚠️ Reconocido, pero no se pudo marcar: ${e.message}`);
  }
}


        }, INTERVAL_MS);
      } catch (_e) {
        setStatus("❌ No se pudo iniciar la cámara. Revisa permisos del navegador.");
        setRunning(false);
        stopCamera();
      }
    })();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      stopCamera();
    };
  }, [running, modelsReady]); // eslint-disable-line

  return (
    <div style={{ marginTop: 12 }}>
      <div className="muted" style={{ marginBottom: 8 }}>{status}</div>

      {running && (
        <video
          ref={videoRef}
          playsInline
          style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)" }}
        />
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        {!running ? (
          <button className="btn" type="button" disabled={!modelsReady} onClick={() => setRunning(true)}>
            Iniciar escaneo
          </button>
        ) : (
          <button className="btn danger" type="button" onClick={() => setRunning(false)}>
            Detener
          </button>
        )}
      </div>
    </div>
  );
}

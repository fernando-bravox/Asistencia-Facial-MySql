// client/src/components/TapoAttendanceScanner.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { api, getToken } from "../api/client.js";

export default function TapoAttendanceScanner({ subjectId, enrolledStudents, onMarked }) {
  const imgRef = useRef(null);
  const canvasRef = useRef(null);

  // ✅ ESTADOS (esto evita el "running is not defined")
  const [modelsReady, setModelsReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Listo.");

  const MATCH_THRESHOLD = 0.48;
  const INTERVAL_MS = 900;

  // ✅ URL del stream con token por query (porque <img> NO puede mandar Authorization header)
  const streamUrl = useMemo(() => {
    const t = getToken();
    const qs = new URLSearchParams();
    if (t) qs.set("token", t);
    qs.set("_", String(Date.now())); // cache-buster
    return `/api/prof/subjects/${subjectId}/camera/stream?${qs.toString()}`;
  }, [subjectId]);

  async function loadModels() {
    await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
    await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
    await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
    setModelsReady(true);
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
      body: { faceId, timestamp: new Date().toISOString() },
    });
  }

  useEffect(() => {
    loadModels().catch(() => setStatus("❌ No se pudieron cargar los modelos (/public/models)."));
  }, []);

  const known = useMemo(() => buildKnownList(), [enrolledStudents]);

  useEffect(() => {
    if (!running) return;

    if (!modelsReady) {
      setStatus("Cargando modelos...");
      return;
    }

    if (!known.length) {
      setStatus("⚠️ No hay estudiantes matriculados con rostro registrado (descriptor).");
      setRunning(false);
      return;
    }

    setStatus("Conectando cámara Tapo...");

    let interval = null;
    let busy = false;

    interval = setInterval(async () => {
      if (busy) return;
      busy = true;

      try {
        const img = imgRef.current;
        const canvas = canvasRef.current;
        if (!img || !canvas) return;

        // Si aún no cargó dimensiones, no proceses
        const w = img.naturalWidth || 0;
        const h = img.naturalHeight || 0;
        if (!w || !h) return;

        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);

        const det = await faceapi
          .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!det) return;

        let best = { dist: Infinity, student: null };
        for (const k of known) {
          const dist = faceapi.euclideanDistance(det.descriptor, k.descriptor);
          if (dist < best.dist) best = { dist, student: k.student };
        }

        if (!best.student) return;
        if (best.dist > MATCH_THRESHOLD) return;

        const fid = best.student.faceId;
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
      } catch (e) {
        setStatus(`⚠️ Error procesando stream: ${e.message}`);
      } finally {
        busy = false;
      }
    }, INTERVAL_MS);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [running, modelsReady, known, subjectId]);

  return (
    <div style={{ marginTop: 12 }}>
      <div className="muted" style={{ marginBottom: 8 }}>
        {status}
      </div>

      {/* stream MJPEG */}
      {running && (
        <div style={{ width: "100%" }}>
          <img
            ref={imgRef}
            alt="Tapo Stream"
            src={streamUrl}
            onError={() => setStatus("❌ No se pudo cargar el stream. (¿token/RTSP/FFmpeg?)")}
            style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)" }}
          />
          {/* canvas oculto donde face-api analiza */}
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>
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

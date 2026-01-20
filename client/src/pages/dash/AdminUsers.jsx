import * as faceapi from "face-api.js";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { api, getToken } from "../../api/client.js";
import Toast from "../../components/Toast.jsx";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [msg, setMsg] = useState({ type: "ok", text: "" });

  // ✅ Mostrar / Ocultar formulario crear usuario
  const [showCreate, setShowCreate] = useState(false);
  const createRef = useRef(null);
const tapoImgRef = useRef(null);
const [camMode, setCamMode] = useState(null); // "device" | "tapo" | null


  // Formulario creación
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "student",
    studentCode: "",
    faceId: "",
    faceDescriptor: null
  });

  // UI cámara (captura simple)
  const [camOpen, setCamOpen] = useState(false);
  const [capturedDataUrl, setCapturedDataUrl] = useState("");
  const [isSendingFace, setIsSendingFace] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
const [faceLocked, setFaceLocked] = useState(false); // 🔒 si el rostro ya existe, bloquea
const [matchedUser, setMatchedUser] = useState(null); // usuario con el que coincide
// ✅ EDITAR USUARIO
const [editingId, setEditingId] = useState(null);
const [editForm, setEditForm] = useState({
  name: "",
  role: "student",
  studentCode: ""
});
const [isSavingEdit, setIsSavingEdit] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const isStudent = useMemo(() => form.role === "student", [form.role]);

const tapoStreamUrl = useMemo(() => {
  const t = getToken();
  const qs = new URLSearchParams();
  if (t) qs.set("token", t);
  qs.set("_", String(Date.now())); // evita caché
  return `/api/admin/camera/stream?${qs.toString()}`;
}, [camOpen]); // se refresca cuando abres
async function openTapoCamera() {
  setMsg({ type: "ok", text: "" });

  if (!isStudent) {
    setMsg({ type: "err", text: "La captura de rostro es solo para estudiantes (role=student)." });
    return;
  }
  if (!modelsReady) {
    setMsg({ type: "err", text: "Modelos no cargados. Revisa la carpeta /public/models/." });
    return;
  }

  // apaga device camera por si acaso
  stopCamera();

  // ✅ primero modo, luego abrir panel
  setCamMode("tapo");
  setCamOpen(true);
}



  async function load() {
    try {
      const data = await api("/api/admin/users");
      setUsers(data.users);
    } catch (err) {
      setMsg({ type: "err", text: err.message });
    }
  }

  async function loadFaceModels() {
    await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
    await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
    await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
    setModelsReady(true);
  }

  useEffect(() => {
    load();
    loadFaceModels().catch(() => {
      setModelsReady(false);
      setMsg({
        type: "err",
        text:
          "No se pudieron cargar los modelos de reconocimiento facial. Revisa que existan en client/public/models/."
      });
    });

    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopCamera() {
    try {
      const s = streamRef.current;
      if (s) s.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    } catch (_e) {}
      setCamMode(null); // ✅ agregado

  }

  function clearCapture() {
  setCapturedDataUrl("");
  setForm(f => ({ ...f, faceDescriptor: null }));
  setFaceLocked(false);  // ✅
  setMatchedUser(null);  // ✅
}


  function resetCreateForm() {
    setForm({
      name: "",
      email: "",
      password: "",
      role: "student",
      studentCode: "",
      faceId: "",
      faceDescriptor: null
    });
    setCapturedDataUrl("");
    setCamOpen(false);
    stopCamera();
    setFaceLocked(false);  // ✅
setMatchedUser(null);  // ✅

  }

  async function openDeviceCamera() {
    setMsg({ type: "ok", text: "" });

    if (!isStudent) {
      setMsg({ type: "err", text: "La captura de rostro es solo para estudiantes (role=student)." });
      return;
    }
    if (!modelsReady) {
      setMsg({ type: "err", text: "Modelos no cargados. Revisa la carpeta /public/models/." });
      return;
    }

    try {
      setCamMode("device");

      setCamOpen(true);
      

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (_err) {
      setCamOpen(false);
      stopCamera();
      setMsg({ type: "err", text: "No se pudo acceder a la cámara. Revisa permisos del navegador." });
    }
  }

  async function descriptorFromDataUrl(dataUrl) {
    const img = await faceapi.fetchImage(dataUrl);
    const detection = await faceapi
      .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) return null;
    return Array.from(detection.descriptor);
  }
function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function findDuplicateByDescriptor(desc) {
  const THRESHOLD = 0.45; // recomendado: 0.40 - 0.60 (0.45 suele ir bien)
  for (const u of users) {
    if (!u?.faceDescriptor || !Array.isArray(u.faceDescriptor)) continue;

    const dist = euclideanDistance(desc, u.faceDescriptor);
    if (dist <= THRESHOLD) return { user: u, distance: dist };
  }
  return null;
}

  async function captureFrame() {
  setMsg({ type: "ok", text: "" });

  const canvas = canvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let w = 640;
  let h = 480;

  // ✅ 1) Captura desde cámara del dispositivo
  if (camMode === "device") {
    const video = videoRef.current;
    if (!video) return;

    w = video.videoWidth || 640;
    h = video.videoHeight || 480;

    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);
  }

  // ✅ 2) Captura desde TP-LINK (stream en <img>)
  if (camMode === "tapo") {
    const img = tapoImgRef.current;
    if (!img) return;

    w = img.naturalWidth || img.width || 640;
    h = img.naturalHeight || img.height || 480;

    if (!w || !h) {
      setMsg({ type: "err", text: "La cámara TP-LINK aún no carga imagen. Espera 1-2 segundos e intenta." });
      return;
    }

    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);
  }

  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  setCapturedDataUrl(dataUrl);

  if (!form.faceId) {
    try {
      const r = await api("/api/admin/faceid", { method: "POST" });
      setForm((f) => ({ ...f, faceId: r.faceId }));
    } catch (_e) {
      setMsg({ type: "err", text: "No se pudo generar faceId. Intenta nuevamente." });
    }
  }

  try {
    const desc = await descriptorFromDataUrl(dataUrl);
    if (!desc) {
      setMsg({
        type: "err",
        text: "No se detectó un rostro claro en la captura. Intenta con más luz y el rostro centrado."
      });
      setForm((f) => ({ ...f, faceDescriptor: null }));
    } else {
  setForm((f) => ({ ...f, faceDescriptor: desc }));

  const dup = findDuplicateByDescriptor(desc);

  if (dup) {
    setFaceLocked(true);
    setMatchedUser(dup.user);
    setMsg({
      type: "err",
      text: `⚠️ Este rostro ya fue registrado (${dup.user.name || dup.user.email || dup.user.id}). No se puede registrar nuevamente.`
    });
  } else {
    setFaceLocked(false);
    setMatchedUser(null);
    setMsg({ type: "ok", text: "Rostro capturado y procesado ✅" });
  }
}
  } catch (_e) {
    setMsg({ type: "err", text: "Error procesando el rostro. Reintenta la captura." });
    setForm((f) => ({ ...f, faceDescriptor: null }));
  }

  // ✅ cerrar cámara (device o tapo)
  stopCamera();
  setCamOpen(false);
}


  async function createUser(e) {
  e.preventDefault();
  setMsg({ type: "ok", text: "" });

  try {
    // ✅ campos básicos obligatorios
    if (!form.name || !form.email || !form.password || !form.role) {
      setMsg({ type: "err", text: "Completa nombre, email, contraseña y rol." });
      return;
    }

    // ✅ email básico
    if (!String(form.email).includes("@")) {
      setMsg({ type: "err", text: "Email inválido. Debe contener '@'." });
      return;
    }

    // ✅ contraseña mínimo 12 caracteres
    if (String(form.password).length < 12) {
      setMsg({ type: "err", text: "La contraseña debe tener mínimo 12 caracteres." });
      return;
    }

    // ✅ validaciones solo para estudiantes
    if (isStudent) {
      const code = String(form.studentCode || "").trim();

      if (!code) {
        setMsg({ type: "err", text: "El código del estudiante es obligatorio." });
        return;
      }

      // solo números
      if (!/^\d+$/.test(code)) {
        setMsg({ type: "err", text: "El código del estudiante solo debe contener números." });
        return;
      }

      // debe existir captura + descriptor
      if (!capturedDataUrl || !form.faceDescriptor) {
        setMsg({ type: "err", text: "Debes capturar el rostro antes de crear al estudiante." });
        return;
      }

      // faceId debe estar generado por el escaneo
      if (!form.faceId) {
        setMsg({ type: "err", text: "No se generó FaceId. Vuelve a capturar el rostro." });
        return;
      }
    }

    // (tu validación anterior, ya no es necesaria porque arriba lo controlamos,
    //  pero la dejo por seguridad si quieres)
    if (form.role === "student" && capturedDataUrl && !form.faceDescriptor) {
      setMsg({ type: "err", text: "Capturaste imagen pero no se detectó rostro. Repite la captura." });
      return;
    }

    // ✅ bloqueo por rostro duplicado
    if (faceLocked) {
      setMsg({ type: "err", text: "Este rostro ya fue registrado. No se puede registrar nuevamente." });
      return;
    }

    const created = await api("/api/admin/users", {
      method: "POST",
      body: {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        studentCode: isStudent ? (form.studentCode || "") : "",
        // ✅ solo enviar faceId/descriptor si es student
        faceId: isStudent ? (form.faceId || null) : null,
        faceDescriptor: isStudent ? (form.faceDescriptor || null) : null
      }
    });

    const faceIdToSave = created?.user?.faceId || form.faceId;

    if (capturedDataUrl && faceIdToSave) {
      setIsSendingFace(true);
      await api("/api/admin/faces", {
        method: "POST",
        body: { faceId: faceIdToSave, imageDataUrl: capturedDataUrl }
      });
    }

    await load();

    setMsg({
      type: "ok",
      text: faceIdToSave ? `Usuario creado. FaceId: ${faceIdToSave}` : "Usuario creado"
    });

    resetCreateForm();
    setShowCreate(false);

  } catch (err) {
    setMsg({ type: "err", text: err.message });
  } finally {
    setIsSendingFace(false);
  }
}



  async function removeUser(id) {
    if (!confirm("¿Eliminar usuario?")) return;
    try {
      await api(`/api/admin/users/${id}`, { method: "DELETE" });
      await load();
      setMsg({ type: "ok", text: "Usuario eliminado" });
    } catch (err) {
      setMsg({ type: "err", text: err.message });
    }
  }
function startEdit(u) {
  setMsg({ type: "ok", text: "" });
  setEditingId(u.id);
  setEditForm({
    name: u.name || "",
    role: u.role || "student",
    studentCode: u.studentCode ? String(u.studentCode) : ""
  });
}

function cancelEdit() {
  setEditingId(null);
  setEditForm({ name: "", role: "student", studentCode: "" });
}

async function saveEdit() {
  setMsg({ type: "ok", text: "" });

  try {
    if (!editingId) return;

    // ✅ validación mínima
    if (!editForm.name.trim()) {
      setMsg({ type: "err", text: "El nombre no puede estar vacío." });
      return;
    }

    // ✅ si es student: 4 números exactos
    if (editForm.role === "student") {
      const code = String(editForm.studentCode || "").trim();
      if (!/^\d{4}$/.test(code)) {
        setMsg({ type: "err", text: "El código del estudiante debe ser exactamente 4 números." });
        return;
      }
    }

    setIsSavingEdit(true);

    await api(`/api/admin/users/${editingId}`, {
      method: "PUT",
      body: {
        name: editForm.name.trim(),
        role: editForm.role,
        studentCode: editForm.role === "student" ? String(editForm.studentCode || "").trim() : ""
      }
    });

    await load();
    setMsg({ type: "ok", text: "Usuario actualizado ✅" });
    cancelEdit();
  } catch (err) {
    setMsg({ type: "err", text: err.message });
  } finally {
    setIsSavingEdit(false);
  }
}

  function toggleCreate() {
    // Si vas a cerrar, cierro cámara y limpio preview (para que no quede prendida)
    if (showCreate) {
      resetCreateForm();
      setShowCreate(false);
      return;
    }

    // Si vas a abrir
    setShowCreate(true);
    setTimeout(() => {
      createRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 space-y-6">

      {/* ✅ CARD: HEADER + BOTÓN */}
      <section className="card w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="h2">CREAR USUARIO</h2>
            <p className="muted mt-1">Crea Profesores/Estudiantes y asigna roles.</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="muted text-sm">
              Modelos de rostro: <b>{modelsReady ? "OK " : "NO cargados ❌"}</b>
            </div>

            {/* ✅ Botón principal (AZUL) */}
            <button
              type="button"
              className="btn"
              onClick={toggleCreate}
              aria-expanded={showCreate}
            >
              {showCreate ? "Ocultar formulario" : "Crear usuario"}
            </button>
          </div>
        </div>

        <div className="cardDivider" />

        <Toast type={msg.type} message={msg.text} />

        {/* ✅ FORM (OCULTO/SHOW) */}
        <div
          ref={createRef}
          className={[
            "overflow-hidden transition-all duration-300",
            showCreate ? "max-h-[2000px] opacity-100 mt-4" : "max-h-0 opacity-0"
          ].join(" ")}
        >
          <div className="card w-full !shadow-none !border !border-[var(--border)]">
            <h2 className="title">FORMULARIO USUARIO</h2>

            <form onSubmit={createUser} className="space-y-3">
              <div>
                <label className="form-label">Nombre</label>
                <input
                  className="input w-full"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">Email</label>
                <input
                  className="input w-full"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">Contraseña</label>
                <input
  className="input w-full"
  type="password"
  value={form.password}
  minLength={12}
  required
  onChange={e => setForm({ ...form, password: e.target.value })}
/>

              </div>

              <div>
                <label className="form-label">Rol</label>
                <select
                  className="input w-full"
                  value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value })}
                >
                  <option value="student">student</option>
                  <option value="professor">professor</option>
                  <option value="admin">admin</option>
                </select>
              </div>

              {isStudent && (
                <div>
                  <label className="form-label">Código del estudiante</label>
                  <input
  className="input w-full"
  value={form.studentCode}
  inputMode="numeric"
  pattern="[0-9]*"
  maxLength={4}
  onChange={(e) => {
    const onlyNums4 = e.target.value.replace(/\D/g, "").slice(0, 4);
    setForm({ ...form, studentCode: onlyNums4 });
  }}
  placeholder="Ej: 1234"
/>


                </div>
              )}

              {/*<div>
                <label className="form-label">FaceId (opcional)</label>
                <input
                  className="input w-full"
                  value={form.faceId}
                  onChange={e => setForm({ ...form, faceId: e.target.value })}
                  placeholder="face-001"
                />
              </div>*/}

              {/* ✅ BOTONES */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-wrap pt-2">
                <button
                  type="button"
                  className="btn secondary"
                   onClick={openTapoCamera}
                   disabled={!isStudent || !modelsReady}
                 
                  title={
    !isStudent
      ? "Solo disponible cuando el rol es student"
      : !modelsReady
      ? "Modelos no cargados"
      : "Abrir cámara TP-LINK"
  }
                >
                  Cámara TP-LINK
                </button>

                <button
                  type="button"
                  className="btn"
                  onClick={openDeviceCamera}
                  disabled={!isStudent || !modelsReady}
                  title={
                    !isStudent
                      ? "Solo disponible cuando el rol es student"
                      : !modelsReady
                      ? "Modelos no cargados"
                      : "Abrir cámara"
                  }
                >
                  Usar cámara de dispositivo
                </button>

                {capturedDataUrl && (
                  <button type="button" className="btn danger" onClick={clearCapture}>
                    Quitar captura
                  </button>
                )}
              </div>

              {/* ✅ PANEL CÁMARA */}
              {camOpen && (
                <div className="mt-3">
                  <div className="muted mb-2">
                    Coloca el rostro centrado y presiona <b>Capturar</b>.
                  </div>

                  {camMode === "device" && (
  <video
    ref={videoRef}
    playsInline
    className="w-full rounded-xl border border-[var(--border)]"
  />
)}

{camMode === "tapo" && (
  <img
    ref={tapoImgRef}
    src={tapoStreamUrl}
    alt="TP-LINK Stream"
    className="w-full rounded-xl border border-[var(--border)]"
    onError={() =>
      setMsg({ type: "err", text: "No se pudo cargar stream TP-LINK. Revisa /api/admin/camera/stream." })
    }
  />
)}

<canvas ref={canvasRef} className="hidden" />


                  <div className="flex flex-col sm:flex-row gap-2 mt-3">
                    <button type="button" className="btn" onClick={captureFrame}>
                      Capturar y guardar
                    </button>
                    <button
                      type="button"
                      className="btn danger"
                      onClick={() => {
                        stopCamera();
                        setCamOpen(false);
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* ✅ PREVIEW */}
              {capturedDataUrl && (
                <div className="mt-3">
                  <div className="muted mb-2">
                    Captura lista. Rostro:{" "}
                    <b>{form.faceDescriptor ? "OK ✅" : "NO detectado ❌"}</b>. Se guardará al presionar{" "}
                    <b>Crear</b>.
                  </div>

                  <img
                    src={capturedDataUrl}
                    alt="captura"
                    className="w-full rounded-xl border border-[var(--border)]"
                  />
                  {/* 🚫 AVISO DE ROSTRO DUPLICADO */}
    {faceLocked && matchedUser && (
      <div className="mt-2 p-3 rounded-xl border border-[var(--border)]">
        <b style={{ color: "crimson" }}>Rostro ya registrado</b>
        <div className="muted text-sm">
          Coincide con:{" "}
          <b>{matchedUser.name || matchedUser.email || matchedUser.id}</b>
        </div>
      </div>
    )}
  </div>
)}

              <div className="pt-3 flex flex-col sm:flex-row gap-2">
<button
  className="btn w-full sm:w-auto"
  type="submit"
  disabled={isSendingFace || faceLocked}
  title={faceLocked ? "Rostro ya registrado. Quita la captura para continuar." : ""}
>
                  {isSendingFace ? "Guardando..." : "Crear"}
                </button>

                <button
                  type="button"
                  className="btn secondary w-full sm:w-auto"
                  onClick={() => {
                    resetCreateForm();
                    setShowCreate(false);
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* ✅ CARD: TABLA USUARIOS */}
      <section className="card w-full">
        {/* ✅ TABLA RESPONSIVE */}
        <div className="mt-2 w-full overflow-x-auto rounded-xl border border-[var(--border)] max-h-[60vh] overflow-y-auto">
          <table className="min-w-[900px] w-full text-sm table">
            <thead>
              <tr className="text-left">
                <th className="px-3 py-3 whitespace-nowrap">Nombre</th>
                <th className="px-3 py-3 whitespace-nowrap">Email</th>
                <th className="px-3 py-3 whitespace-nowrap">Rol</th>
                <th className="px-3 py-3 whitespace-nowrap hidden md:table-cell">Código</th>
                <th className="px-3 py-3 whitespace-nowrap hidden lg:table-cell">FaceId</th>
                <th className="px-3 py-3 whitespace-nowrap"></th>
              </tr>
            </thead>

            <tbody>
  {users.map(u => (
    <tr key={u.id}>
      {/* NOMBRE */}
      <td className="px-3 py-3 whitespace-nowrap">
        {editingId === u.id ? (
          <input
            className="input w-full"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
          />
        ) : (
          u.name
        )}
      </td>

      {/* EMAIL (NO se edita) */}
      <td className="px-3 py-3 max-w-[240px] truncate">{u.email}</td>

      {/* ROL */}
      <td className="px-3 py-3 whitespace-nowrap">
        {editingId === u.id ? (
          <select
            className="input w-full"
            value={editForm.role}
            onChange={(e) => {
              const newRole = e.target.value;
              setEditForm((p) => ({
                ...p,
                role: newRole,
                studentCode: newRole === "student" ? p.studentCode : ""
              }));
            }}
          >
            <option value="student">student</option>
            <option value="professor">professor</option>
            <option value="admin">admin</option>
          </select>
        ) : (
          <span className="badge">{u.role}</span>
        )}
      </td>

      {/* CÓDIGO (solo student, 4 números) */}
      <td className="px-3 py-3 whitespace-nowrap hidden md:table-cell">
        {editingId === u.id ? (
          editForm.role === "student" ? (
            <input
              className="input w-full"
              value={editForm.studentCode}
              inputMode="numeric"
              maxLength={4}
              onChange={(e) => {
                const onlyNums4 = e.target.value.replace(/\D/g, "").slice(0, 4);
                setEditForm({ ...editForm, studentCode: onlyNums4 });
              }}
              placeholder="0000"
            />
          ) : (
            <span className="muted">-</span>
          )
        ) : (
          u.studentCode || "-"
        )}
      </td>

      {/* FACEID (solo mostrar) */}
      <td className="px-3 py-3 whitespace-nowrap hidden lg:table-cell">
        {u.faceId || "-"}
      </td>

      {/* ACCIONES */}
      <td className="px-3 py-3 whitespace-nowrap">
        {editingId === u.id ? (
          <div className="flex gap-2">
            <button
              type="button"
              className="btn"
              onClick={saveEdit}
              disabled={isSavingEdit}
            >
              {isSavingEdit ? "Guardando..." : "Guardar"}
            </button>

            <button
              type="button"
              className="btn secondary"
              onClick={cancelEdit}
              disabled={isSavingEdit}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              className="btn secondary"
              onClick={() => startEdit(u)}
            >
              Editar
            </button>

            <button className="btn danger" onClick={() => removeUser(u.id)}>
              Eliminar
            </button>
          </div>
        )}
      </td>
    </tr>
  ))}

  {users.length === 0 && (
    <tr>
      <td colSpan="6" className="px-3 py-4 muted">
        No hay usuarios
      </td>
    </tr>
  )}
</tbody>

          </table>
        </div>

        <div className="mt-2 text-xs muted md:hidden">
          Desliza horizontalmente para ver todas las columnas.
        </div>
      </section>
    </div>
  );
}

import * as faceapi from "face-api.js";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { api, getToken } from "../../api/client.js";
import { FaEdit, FaTrash, FaSearch } from "react-icons/fa";
import { showAlert } from "../../utils/swalHelper.js";

import Swal from 'sweetalert2';


export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all"); // 'all', 'student', 'professor', 'admin'
  

  // ✅ Mostrar / Ocultar formulario crear usuario
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState("list");
  const createRef = useRef(null);
const tapoImgRef = useRef(null);
const [camMode, setCamMode] = useState(null); // "device" | "tapo" | null


  // Formulario creación
  const [form, setForm] = useState({
  name: "",
  lastname: "",  // Agrega apellido aquí
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
  lastname: "",
  role: "student",
  studentCode: ""
});
const [isSavingEdit, setIsSavingEdit] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const isStudent = useMemo(() => form.role === "student", [form.role]);

  const filteredUsers = useMemo(() => {
    let result = users;

    // 1. Filtrar por rol
    if (roleFilter !== "all") {
      result = result.filter(u => u.role === roleFilter);
    }

    // 2. Filtrar por búsqueda de texto
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter(u => {
        const fullName = `${u.name || ""} ${u.lastname || ""}`.toLowerCase();
        const email = (u.email || "").toLowerCase();
        const code = (u.studentCode || "").toLowerCase();
        return fullName.includes(q) || email.includes(q) || code.includes(q);
      });
    }

    return result;
  }, [users, searchQuery, roleFilter]);

const tapoStreamUrl = useMemo(() => {
  const t = getToken();
  const qs = new URLSearchParams();
  if (t) qs.set("token", t);
  qs.set("_", String(Date.now())); // evita caché
  return `/api/admin/camera/stream?${qs.toString()}`;
}, [camOpen]); // se refresca cuando abres




  async function load() {
    try {
      const data = await api("/api/admin/users");
      setUsers(data.users);
    } catch (err) {
      showAlert("error", "¡Error!", err.message);
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
      showAlert("error", "¡Error!", "No se pudieron cargar los modelos de reconocimiento facial. Revisa que existan en client/public/models.");
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
    setCamMode(null);
    setCamOpen(false); // ✅ Cierra el modal de captura
  }

  function clearCapture() {
  setCapturedDataUrl("");
  setForm(f => ({ ...f, faceDescriptor: null }));
  setFaceLocked(false);  // ✅
  setMatchedUser(null);  // ✅
}

async function processCapturedImage(dataUrl) {
  if (!modelsReady) {
    showAlert("error", "¡Error!", "Los modelos no están listos. Revisa la carpeta /public/models/.");
    return;
  }

  try {
    const desc = await descriptorFromDataUrl(dataUrl);
    if (!desc) {
      showAlert("error", "¡Error!", "No se detectó un rostro claro en la imagen. Intenta con más luz y el rostro centrado.");
      setForm(f => ({ ...f, faceDescriptor: null }));
    } else {
      setForm(f => ({ ...f, faceDescriptor: desc }));
      const dup = findDuplicateByDescriptor(desc);

      if (dup) {
        setFaceLocked(true);
        setMatchedUser(dup.user);
        showAlert("warning", "¡Atención!", `⚠️ Este rostro ya fue registrado (${dup.user.name || dup.user.email || dup.user.id}). No se puede registrar nuevamente.`);
      } else {
        setFaceLocked(false);
        setMatchedUser(null);
        showAlert("success", "¡Éxito!", "Rostro detectado y procesado ✅");
      }
    }
  } catch (err) {
    console.error("Error processing face:", err);
    showAlert("error", "¡Error!", "Ocurrió un error al procesar el rostro. Reintenta con otra imagen.");
    setForm(f => ({ ...f, faceDescriptor: null }));
  }
}

function handleImageUpload(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      setCapturedDataUrl(dataUrl); // Actualiza el estado con la imagen cargada
      processCapturedImage(dataUrl); // Procesa la imagen como si fuera una captura de cámara
    };
    reader.readAsDataURL(file);
  }
}

  function resetCreateForm() {
    setForm({
  name: "",
  lastname: "", // Reiniciar apellido también
  email: "",
  password: "",
  role: "student",
  studentCode: "",
  faceId: "",
  faceDescriptor: null
});
    setCapturedDataUrl("");
    stopCamera();
    setFaceLocked(false);  // ✅
setMatchedUser(null);  // ✅

  }

  async function openDeviceCamera() {
    Swal.fire({
  icon: 'success',
  title: '¡Éxito!',
  text: 'Cámara abierta correctamente.',
});

    if (!isStudent) {
      showAlert("error", "¡Error!", "La captura de rostro es solo para estudiantes (role=student).");
      return;
    }
    if (!modelsReady) {
      showAlert("error", "¡Error!", "Modelos no cargados. Revisa la carpeta /public/models/.");
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
      stopCamera();
      showAlert("error", "¡Error!", "No se pudo acceder a la cámara. Revisa permisos del navegador.");
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
  const canvas = canvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let w = 640;
  let h = 480;

  // 1) Captura desde cámara del dispositivo
  if (camMode === "device") {
    const video = videoRef.current;
    if (!video) return;

    w = video.videoWidth || 640;
    h = video.videoHeight || 480;

    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);
  }

  // 2) Captura de imagen cargada
  if (!camMode) {
    // Cuando no hay un modo de cámara activo, tratamos la imagen cargada.
    const dataUrl = capturedDataUrl; // Usa la imagen cargada
    canvas.width = w;
    canvas.height = h;
    const img = await faceapi.fetchImage(dataUrl);
    ctx.drawImage(img, 0, 0, w, h);
  }

  // Procesar la imagen capturada
  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  setCapturedDataUrl(dataUrl);

  await processCapturedImage(dataUrl);

  stopCamera();
}


  async function createUser(e) {
  e.preventDefault();

try {
  // Validación de nombre
  if (!form.name) {
    showAlert("warning", "Atención", "Completa el nombre.");
    return;
  }

  // Validación de apellido
  if (!form.lastname) {
    showAlert("warning", "Atención", "Completa el apellido.");
    return;
  }

  // Validación de correo electrónico
  if (!form.email) {
    showAlert("warning", "Atención", "Completa el correo institucional.");
    return;
  }

  // Validación de contraseña
  if (!form.password) {
    showAlert("warning", "Atención", "Completa la contraseña.");
    return;
  }

  // Validación de rol
  if (!form.role) {
    showAlert("warning", "Atención", "Selecciona un rol.");
      return;
    }

    // Validación de email
    if (!String(form.email).includes("@")) {
      showAlert("warning", "Atención", 'Email inválido. Debe contener "@".');
      return;
    }

    // Validación de contraseña
    if (String(form.password).length < 10) {
      showAlert("warning", "Atención", "La contraseña debe tener mínimo 10 caracteres.");
      return;
    }

    const created = await api("/api/admin/users", {
      method: "POST",
      body: {
        name: form.name,
        lastname: form.lastname,  // Aquí agregamos el apellido
        email: form.email,
        password: form.password,
        role: form.role,
        studentCode: form.role === "student" ? form.studentCode : "",
        faceId: form.faceId,
        faceDescriptor: form.faceDescriptor
      }
    });
    setUsers([...users, created.user]);
    showAlert("success", "¡Éxito!", "Usuario creado exitosamente");

    // Reiniciar formulario y cargar usuarios
    resetCreateForm();
    setActiveTab("list");
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: '¡Error!',
      text: err.message,
    });
  }
}



  async function removeUser(id) {
    const result = await Swal.fire({
      title: "¿Eliminar usuario?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar"
    });

    if (!result.isConfirmed) return;

    try {
      await api(`/api/admin/users/${id}`, { method: "DELETE" });
      await load();
      showAlert("success", "Eliminado", "Usuario eliminado correctamente.");
    } catch (err) {
      showAlert("error", "Error", err.message);
    }
  }
function startEdit(u) {
  setEditingId(u.id);
  setEditForm({
    name: u.name || "",
    lastname: u.lastname || "",
    role: u.role || "student",
    studentCode: u.studentCode ? String(u.studentCode) : ""
  });
}

function cancelEdit() {
  setEditingId(null);
  setEditForm({ name: "", lastname: "", role: "student", studentCode: "" });
}

async function saveEdit() {
  try {
    if (!editingId) return;

    // ✅ validación mínima
    if (!editForm.name.trim() || !editForm.lastname.trim()) {
      showAlert("warning", "Atención", "El nombre y el apellido no pueden estar vacíos.");
      return;
    }

    // ✅ si es student: 4 números exactos
    if (editForm.role === "student") {
      const code = String(editForm.studentCode || "").trim();
      if (!/^\d{4}$/.test(code)) {
        showAlert("warning", "Atención", "El código del estudiante debe ser exactamente 4 números.");
        return;
      }
    }

    setIsSavingEdit(true);

    const payload = {
      name: editForm.name.trim(),
      lastname: editForm.lastname.trim(),
      role: editForm.role
    };

    if (editForm.role === "student") {
      payload.studentCode = String(editForm.studentCode || "").trim();
    }

    await api(`/api/admin/users/${editingId}`, {
      method: "PUT",
      body: payload
    });

    setUsers(users.map(u => u.id === editingId ? { 
      ...u, 
      name: editForm.name.trim(), 
      lastname: editForm.lastname.trim(),
      role: editForm.role, 
      studentCode: editForm.role === "student" ? editForm.studentCode : "" 
    } : u));
    showAlert("success", "Éxito", "Usuario actualizado ✅");
    cancelEdit();
  } catch (err) {
    showAlert("error", "Error", err.message);
  } finally {
    setIsSavingEdit(false);
  }
}

  function toggleCreate() {
  if (activeTab === "create") {
    resetCreateForm();
    setActiveTab("list");
    return;
  }

  setActiveTab("create");
  setTimeout(() => {
    createRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 80);
}
const getRolLabel = (role) => {
  switch (role) {
    case "student":
      return "Estudiante";
    case "professor":
      return "Profesor";
    case "admin":
      return "Administrador";
    default:
      return role;
  }
};

  return (
    <div className="w-full">
      <section className="bg-white rounded-[2rem] shadow-2xl overflow-visible">
        
        {/* TABS NAVIGATION */}
        <div className="bg-brand-light p-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveTab("list")}
              className={`flex-1 sm:flex-none px-8 py-3.5 rounded-2xl text-xs font-black tracking-widest transition-all duration-300 ${
                activeTab === "list"
                  ? "bg-brand-primary text-black shadow-lg shadow-brand-primary/20"
                  : "bg-white text-brand-dark hover:bg-brand-primary hover:text-white shadow-sm"
              }`}
            >
              LISTADO
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("create")}
              className={`flex-1 sm:flex-none px-8 py-3.5 rounded-2xl text-xs font-black tracking-widest transition-all duration-300 ${
                activeTab === "create"
                  ? "bg-brand-primary text-black shadow-lg shadow-brand-primary/20"
                  : "bg-white text-brand-dark hover:bg-brand-primary hover:text-white shadow-sm"
              }`}
            >
              NUEVO USUARIO
            </button>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="p-6 sm:p-10">

          {/* LIST VIEW */}
          {activeTab === "list" && (
            <div className="animate-in fade-in duration-500">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
                <div>
                  <h1 className="text-3xl font-black text-brand-dark tracking-tighter">Usuarios del Sistema</h1>
                  <p className="text-sm font-bold text-brand-gray mt-1 uppercase tracking-widest opacity-60">
                    Gestión de perfiles académicos
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <select
                    className="input !py-3 !px-4 !w-full sm:!w-48 text-sm font-bold bg-gray-100 border-2 border-gray-200"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                  >
                    <option value="all">Todos los Roles</option>
                    <option value="student">Estudiantes</option>
                    <option value="professor">Docentes</option>
                    <option value="admin">Administradores</option>
                  </select>

                  <div className="relative w-full sm:w-80 group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-brand-primary">
                      <FaSearch className="text-brand-gray/50 group-focus-within:text-brand-primary" size={14} />
                    </div>
                    <input
                      type="text"
                      placeholder="Buscar por nombre..."
                      className="w-full pl-11 pr-4 py-3 bg-gray-100 border-2 border-gray-200 focus:border-brand-primary/20 focus:bg-white rounded-2xl text-sm font-bold text-brand-dark transition-all outline-none shadow-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="table-wrap max-h-[60vh] overflow-y-auto overflow-x-auto scrollbar-elegant bg-white rounded-[2rem] shadow-2xl border border-gray-100 p-6">
                <table className="w-full border-separate border-spacing-y-4">
                  <thead className="sticky top-0 z-20 bg-white">
                    <tr>
                      <th className="px-6 py-4 text-left text-[11px] font-black text-brand-gray uppercase tracking-widest bg-brand-light/50 rounded-l-2xl">Usuario</th>
                      <th className="px-6 py-4 text-left text-[11px] font-black text-brand-gray uppercase tracking-widest bg-brand-light/50">Rol</th>
                      <th className="px-6 py-4 text-left text-[11px] font-black text-brand-gray uppercase tracking-widest bg-brand-light/50">Código</th>
                      <th className="px-6 py-4 text-left text-[11px] font-black text-brand-gray uppercase tracking-widest bg-brand-light/50 rounded-r-2xl">Acciones</th>
                    </tr>
                  </thead>

                  <tbody className="before:block before:h-2">
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="group transition-all hover:translate-x-1">
                        <td className="px-6 py-5 bg-brand-light/30 rounded-l-2xl border-y border-l border-transparent group-hover:border-brand-primary/20 group-hover:bg-white group-hover:shadow-md transition-all">
                          {editingId === u.id ? (
                            <div className="flex flex-col gap-2">
                              <input
                                className="input text-xs"
                                value={editForm.name}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                placeholder="Nombres"
                              />
                              <input
                                className="input text-xs"
                                value={editForm.lastname}
                                onChange={(e) => setEditForm({ ...editForm, lastname: e.target.value })}
                                placeholder="Apellidos"
                              />
                            </div>
                          ) : (
                            <div className="flex flex-col"> 
                                <span className="font-bold text-brand-dark text-sm sm:text-base">
                                  {u.name} {u.lastname || ""}
                                </span> 
                                <span className="text-xs text-brand-gray truncate max-w-[150px] sm:max-w-none">{u.email}</span> 
                              </div> 
                            )} 
                          </td>

                        <td className="px-6 py-5 bg-brand-light/30 border-y border-transparent group-hover:border-brand-primary/20 group-hover:bg-white group-hover:shadow-md transition-all">
                          {editingId === u.id ? (
                            <select
                              className="input text-xs"
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
                              <option value="student">Estudiante</option>
                              <option value="professor">Docente</option>
                              <option value="admin">Administrador</option>
                            </select>
                          ) : (
                            <span className={`badge ${u.role === 'admin' ? 'badge-red' : u.role === 'professor' ? 'badge-blue' : ''}`}>
                              {getRolLabel(u.role)}
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-5 bg-brand-light/30 border-y border-transparent group-hover:border-brand-primary/20 group-hover:bg-white group-hover:shadow-md transition-all">
                          {editingId === u.id ? (
                            editForm.role === "student" ? (
                              <input
                                className="input text-xs"
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
                              <span className="text-brand-gray/40">-</span>
                            )
                          ) : (
                            <span className="font-mono text-xs font-bold text-brand-dark">{u.studentCode || "-"}</span>
                          )}
                        </td>

                        <td className="px-6 py-5 bg-brand-light/30 rounded-r-2xl border-y border-r border-transparent group-hover:border-brand-primary/20 group-hover:bg-white group-hover:shadow-md transition-all">
                          {editingId === u.id ? (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="btn btn-primary !py-2 !px-3 !text-[10px]"
                                onClick={saveEdit}
                                disabled={isSavingEdit}
                              >
                                {isSavingEdit ? "..." : "✓"}
                              </button>

                              <button
                                type="button"
                                className="btn btn-secondary !py-2 !px-3 !text-[10px]"
                                onClick={cancelEdit}
                                disabled={isSavingEdit}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => startEdit(u)}
                                className="p-2 text-brand-gray hover:text-brand-primary hover:bg-brand-primary/10 rounded-xl transition-all"
                                title="Editar"
                              >
                                <FaEdit size={16} />
                              </button>
                              <button
                                onClick={() => removeUser(u.id)}
                                className="p-2 text-brand-gray hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                title="Eliminar"
                              >
                                <FaTrash size={16} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan="4" className="px-6 py-12 text-center text-brand-gray/50 italic bg-brand-light/20 rounded-2xl border-2 border-dashed border-brand-light">
                          {searchQuery ? "No se encontraron usuarios que coincidan con la búsqueda." : "No se encontraron usuarios registrados."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CREATE VIEW */}
          {activeTab === "create" && (
            <div ref={createRef} className="animate-in slide-in-from-right-4 duration-500">
              <div className="mb-8">
                <h1 className="text-2xl font-black text-brand-dark tracking-tight">Nuevo Usuario</h1>
                <p className="text-sm font-medium text-brand-gray mt-1">
                  Registra un nuevo perfil en la plataforma institucional.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <form onSubmit={createUser} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Nombres</label>
                      <input
                        className="input"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        placeholder="Ej: Juan Carlos"
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Apellidos</label>
                      <input
                        className="input"
                        value={form.lastname}
                        onChange={e => setForm({ ...form, lastname: e.target.value })}
                        placeholder="Ej: Pérez Rodríguez"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">Correo Institucional</label>
                    <input
                      className="input"
                      type="email"
                      value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      placeholder="ejemplo@espoch.edu.ec"
                      required
                    />
                  </div>

                  <div>
                    <label className="label">Contraseña</label>
                    <input
                      className="input"
                      type="password"
                      value={form.password}
                      minLength={10}
                      maxLength={10}
                      onChange={e => setForm({ ...form, password: e.target.value })}
                      placeholder="Cédula del estudiante sin guion (10 caracteres)"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Rol del Usuario</label>
                      <select
                        className="input"
                        value={form.role}
                        onChange={e => setForm({ ...form, role: e.target.value })}
                      >
                        <option value="student">Estudiante</option>
                        <option value="professor">Docente</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>

                    {isStudent && (
                      <div className="animate-in zoom-in duration-300">
                        <label className="label">Código Estudiantil</label>
                        <input
                          className="input font-mono"
                          value={form.studentCode}
                          inputMode="numeric"
                          maxLength={4}
                          onChange={(e) => {
                            const onlyNums4 = e.target.value.replace(/\D/g, "").slice(0, 4);
                            setForm({ ...form, studentCode: onlyNums4 });
                          }}
                          placeholder="Ej: 1234"
                          required
                        />
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-brand-border flex flex-wrap gap-3">
                    <button type="submit" className="btn btn-primary flex-1 !py-3" disabled={isSendingFace || faceLocked}>
                      {isSendingFace ? "PROCESANDO..." : "REGISTRAR USUARIO"}
                    </button>
                    <button type="button" onClick={resetCreateForm} className="btn btn-secondary !py-3">
                      LIMPIAR
                    </button>
                  </div>
                </form>

                <div className="space-y-6">
                  <div className="card !bg-brand-light !p-6 border-dashed border-2">
                    <h3 className="text-sm font-black text-brand-dark uppercase tracking-widest mb-4 flex items-center gap-2">
                      <div className="h-2 w-2 bg-brand-primary rounded-full"></div>
                      Identidad Facial
                    </h3>

                    <div className="aspect-video bg-white rounded-2xl border border-brand-border overflow-hidden relative flex items-center justify-center shadow-inner">
                      {capturedDataUrl ? (
                        <img src={capturedDataUrl} className="w-full h-full object-cover" alt="Captura" />
                      ) : (
                        <div className="text-center p-6">
                          <div className="mx-auto w-12 h-12 bg-brand-primary/10 rounded-full flex items-center justify-center mb-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                          <p className="text-xs font-bold text-brand-gray uppercase tracking-tighter">Sin captura facial</p>
                        </div>
                      )}
                      
                      {capturedDataUrl && (
                        <button type="button" onClick={clearCapture} className="absolute top-2 right-2 bg-brand-dark/80 text-white p-1.5 rounded-lg hover:bg-brand-primary">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>

                    <div className="mt-6 flex flex-col gap-2">
                      <button type="button" className="btn btn-secondary !w-full" onClick={() => document.getElementById('fileInput').click()}>
                        SUBIR FOTO
                      </button>
                      <input id="fileInput" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                      <button type="button" className="btn btn-secondary !w-full" onClick={openDeviceCamera} disabled={!isStudent || !modelsReady}>
                        USAR CÁMARA
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* MODAL CÁMARA */}
      {camOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-dark/80 backdrop-blur-sm" onClick={stopCamera}></div>
          <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="bg-brand-primary p-4 text-center">
              <h3 className="text-white font-black uppercase tracking-widest text-sm">Captura Biométrica</h3>
            </div>
            <div className="p-6">
              <div className="aspect-video bg-black rounded-2xl overflow-hidden relative border-4 border-brand-light">
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
                  <div className="w-full h-full border-2 border-dashed border-white/50 rounded-[10%]"></div>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button onClick={captureFrame} className="btn btn-primary flex-1 !py-4 shadow-xl shadow-brand-primary/20">CAPTURAR ROSTRO</button>
                <button onClick={stopCamera} className="btn btn-secondary !px-6">CANCELAR</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

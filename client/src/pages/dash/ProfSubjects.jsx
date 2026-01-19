import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client.js";
import { Link } from "react-router-dom";
import Toast from "../../components/Toast.jsx";

const ROOMS = Array.from({ length: 8 }, (_, i) => `TI PAO ${i + 1}`);

export default function ProfSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [msg, setMsg] = useState({ type: "ok", text: "" });

  const [form, setForm] = useState({ name: "", room: ROOMS[0] });

  // Toggle form nueva materia
  const [openNew, setOpenNew] = useState(false);

  // Modal editar
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", room: ROOMS[0] });

  const total = useMemo(() => subjects?.length || 0, [subjects]);

  async function load() {
    setMsg({ type: "ok", text: "" });
    try {
      const data = await api("/api/prof/subjects");
      setSubjects(data.subjects || []);
    } catch (err) {
      setMsg({ type: "err", text: err.message || "Error cargando materias" });
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e) {
    e.preventDefault();
    setMsg({ type: "ok", text: "" });

    try {
      // ✅ Ya NO enviamos code
      await api("/api/prof/subjects", { method: "POST", body: form });
      setForm({ name: "", room: ROOMS[0] });
      await load();
      setMsg({ type: "ok", text: "Materia creada" });
      setOpenNew(false);
    } catch (err) {
      setMsg({ type: "err", text: err.message || "Error creando materia" });
    }
  }

  function openEditModal(s) {
    setEditItem(s);
    setEditForm({
      name: s?.name || "",
      room: s?.room && ROOMS.includes(String(s.room).toUpperCase())
        ? String(s.room).toUpperCase()
        : ROOMS[0]
    });
    setEditOpen(true);
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editItem?.id) return;

    setMsg({ type: "ok", text: "" });
    try {
      await api(`/api/prof/subjects/${editItem.id}`, {
        method: "PUT",
        body: { name: editForm.name, room: editForm.room }
      });

      setEditOpen(false);
      setEditItem(null);
      await load();
      setMsg({ type: "ok", text: "Materia actualizada" });
    } catch (err) {
      setMsg({ type: "err", text: err.message || "Error actualizando materia" });
    }
  }

  async function removeSubject(subjectId) {
    if (!confirm("¿Eliminar esta materia? También se borrarán horarios/matrículas/asistencias relacionadas.")) return;

    setMsg({ type: "ok", text: "" });
    try {
      await api(`/api/prof/subjects/${subjectId}`, { method: "DELETE" });
      await load();
      setMsg({ type: "ok", text: "Materia eliminada" });
    } catch (err) {
      setMsg({ type: "err", text: err.message || "Error eliminando materia" });
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* HEADER / ACCIONES */}
      <div className="bg-white/70 backdrop-blur border border-slate-200 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">Materias</h2>
            <p className="text-slate-500 text-sm">Administra tus materias y abre detalles.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="text-sm text-slate-500">
              Total: <b className="text-slate-900">{total}</b>
            </div>

            <button
              type="button"
              className={`px-4 py-2 rounded-xl font-semibold border transition ${
                openNew
                  ? "bg-slate-100 text-slate-900 border-slate-200"
                  : "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
              }`}
              onClick={() => setOpenNew(v => !v)}
            >
              {openNew ? "Cerrar nueva materia" : "Nueva materia"}
            </button>
          </div>
        </div>

        <div className="mt-3">
          <Toast type={msg.type} message={msg.text} />
        </div>
      </div>

      {/* FORM NUEVA MATERIA (OCULTO / DESPLEGABLE) */}
      {openNew && (
        <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Nueva materia</h3>
              <p className="text-slate-500 text-sm">
                El <b>código</b> se genera automáticamente y se guarda en Firebase.
              </p>
            </div>

            <button
              type="button"
              className="px-3 py-2 rounded-xl font-semibold border border-slate-200 bg-slate-100 hover:bg-slate-200 transition"
              onClick={() => setOpenNew(false)}
            >
              Cerrar
            </button>
          </div>

          <div className="my-4 border-t border-slate-200" />

          <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre</label>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Sistemas de Información Geográfica"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Aula</label>
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.room}
                onChange={e => setForm({ ...form, room: e.target.value })}
              >
                {ROOMS.map(r => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between pt-1">
              <p className="text-slate-500 text-sm">
                Luego podrás agregar el horario y matricular estudiantes.
              </p>

              <button
                className="px-4 py-2 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 transition w-full sm:w-auto"
                type="submit"
              >
                Crear
              </button>
            </div>
          </form>
        </section>
      )}

      {/* LISTA DE MATERIAS */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Mis materias</h3>
            <p className="text-slate-500 text-sm">
              Abre una materia para ver horarios, matrícula y asistencias.
            </p>
          </div>
        </div>

        {/* ✅ Scroll: vertical si hay muchas / horizontal si no cabe */}
        <div className="mt-4 overflow-x-auto max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200">
          <table className="min-w-[860px] w-full text-sm">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr className="text-slate-600">
                <th className="text-left font-bold px-4 py-3">Materia</th>
                <th className="text-left font-bold px-4 py-3">Código</th>
                <th className="text-left font-bold px-4 py-3">Aula</th>
                <th className="text-right font-bold px-4 py-3">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {subjects.map(s => (
                <tr key={s.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">{s.name}</td>
                  <td className="px-4 py-3 text-slate-500">{s.code}</td>
                  <td className="px-4 py-3 text-slate-500">{s.room || "-"}</td>

                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2 flex-wrap">
                      <Link
                        className="px-3 py-2 rounded-xl font-semibold border border-slate-200 bg-slate-100 hover:bg-slate-200 transition"
                        to={`/app/prof/subjects/${s.id}`}
                      >
                        Abrir
                      </Link>

                      <button
                        type="button"
                        className="px-3 py-2 rounded-xl font-semibold border border-slate-200 bg-white hover:bg-slate-100 transition"
                        onClick={() => openEditModal(s)}
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        className="px-3 py-2 rounded-xl font-semibold border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition"
                        onClick={() => removeSubject(s.id)}
                      >
                        Borrar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {subjects.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-4 py-6 text-slate-500">
                    Aún no tienes materias. Pulsa <b>Nueva materia</b> para crear la primera.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-2 text-xs text-slate-500 md:hidden">
          Desliza horizontalmente para ver todas las columnas.
        </div>
      </section>

      {/* MODAL EDITAR */}
      {editOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Editar materia</h3>
                <p className="text-slate-500 text-sm">
                  Código: <b>{editItem?.code || "-"}</b> (no se edita)
                </p>
              </div>

              <button
                type="button"
                className="px-3 py-2 rounded-xl font-semibold border border-slate-200 bg-slate-100 hover:bg-slate-200 transition"
                onClick={() => { setEditOpen(false); setEditItem(null); }}
              >
                Cerrar
              </button>
            </div>

            <div className="my-4 border-t border-slate-200" />

            <form onSubmit={saveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre</label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Aula</label>
                <select
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editForm.room}
                  onChange={e => setEditForm({ ...editForm, room: e.target.value })}
                >
                  {ROOMS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl font-semibold border border-slate-200 bg-slate-100 hover:bg-slate-200 transition"
                  onClick={() => { setEditOpen(false); setEditItem(null); }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 transition"
                >
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

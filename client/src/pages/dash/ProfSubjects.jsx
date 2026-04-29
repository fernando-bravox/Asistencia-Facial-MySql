//ProfSubjects.jsx

import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client.js";
import { Link } from "react-router-dom";
import { showAlert } from "../../utils/swalHelper.js";
import Swal from "sweetalert2";

const ROOMS = Array.from({ length: 9 }, (_, i) => `TI PAO ${i + 1}`);


export default function ProfSubjects() {
  const [subjects, setSubjects] = useState([]);

  const [form, setForm] = useState({ name: "", room: ROOMS[0] });

  // Toggle form nueva materia
  const [openNew, setOpenNew] = useState(false);

  // Modal editar
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", room: ROOMS[0] });

  const total = useMemo(() => subjects?.length || 0, [subjects]);

  async function load() {
    try {
      const data = await api("/api/prof/subjects");
      setSubjects(data.subjects || []);
    } catch (err) {
      showAlert("error", "Error", err.message || "Error cargando materias");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e) {
    e.preventDefault();

    try {
      // ✅ Ya NO enviamos code
      await api("/api/prof/subjects", { method: "POST", body: form });
      setForm({ name: "", room: ROOMS[0] });
      await load();
      showAlert("success", "Éxito", "Materia creada correctamente.");
      setOpenNew(false);
    } catch (err) {
      showAlert("error", "Error", err.message || "Error creando materia");
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

    try {
      await api(`/api/prof/subjects/${editItem.id}`, {
        method: "PUT",
        body: { name: editForm.name, room: editForm.room }
      });

      setEditOpen(false);
      setEditItem(null);
      await load();
      showAlert("success", "Éxito", "Materia actualizada correctamente.");
    } catch (err) {
      showAlert("error", "Error", err.message || "Error actualizando materia");
    }
  }

  async function removeSubject(subjectId) {
    const result = await Swal.fire({
      title: "¿Eliminar esta materia?",
      text: "También se borrarán horarios, matrículas y asistencias relacionadas.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar"
    });

    if (!result.isConfirmed) return;

    try {
      await api(`/api/prof/subjects/${subjectId}`, { method: "DELETE" });
      await load();
      showAlert("success", "Eliminado", "Materia eliminada correctamente.");
    } catch (err) {
      showAlert("error", "Error", err.message || "Error eliminando materia");
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* HEADER / ACCIONES */}
      <div className="card !p-0 overflow-hidden border-none shadow-md">
        <div className="bg-brand-dark p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h2 className="text-3xl font-black text-white tracking-tight">Mis Asignaturas</h2>
              <p className="text-brand-primary text-xs font-bold uppercase tracking-[0.3em] mt-1">Gestión Académica</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Total Materias</p>
                <p className="text-2xl font-black text-white leading-none">{total}</p>
              </div>
              <button
                type="button"
                className={`btn ${openNew ? 'btn-secondary' : 'btn-primary'} !py-3 !px-6 shadow-xl shadow-brand-primary/20`}
                onClick={() => setOpenNew(v => !v)}
              >
                {openNew ? "CANCELAR" : "NUEVA MATERIA"}
              </button>
            </div>
          </div>
        </div>
        
      </div>

      {/* FORM NUEVA MATERIA */}
      {openNew && (
        <section className="card animate-in slide-in-from-top-4 duration-500 !p-8 border-2 border-brand-primary/20">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black text-brand-dark tracking-tight">Configurar Nueva Asignatura</h3>
            <div className="h-1 w-12 bg-brand-primary rounded-full"></div>
          </div>

          <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <label className="label">Nombre de la Materia</label>
              <input
                className="input"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Análisis y Diseño de Sistemas"
                required
              />
            </div>

            <div>
              <label className="label">Aula / Laboratorio</label>
              <select
                className="input"
                value={form.room}
                onChange={e => setForm({ ...form, room: e.target.value })}
              >
                {ROOMS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3 flex items-center justify-between pt-4 border-t border-brand-border">
              <p className="text-xs font-medium text-brand-gray italic">
                * El código de la asignatura se generará automáticamente.
              </p>
              <button className="btn btn-primary !px-10" type="submit">
                CREAR ASIGNATURA
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {subjects.map(s => (
          <div key={s.id} className="card group hover:border-brand-primary/50 transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-brand-light p-3 rounded-2xl border border-brand-border group-hover:bg-brand-primary/10 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEditModal(s)} className="p-2 text-brand-gray hover:text-brand-primary rounded-lg hover:bg-red-50 transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button onClick={() => removeSubject(s.id)} className="p-2 text-brand-gray hover:text-red-600 rounded-lg hover:bg-red-50 transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            <h3 className="text-lg font-black text-brand-dark leading-tight mb-1 group-hover:text-brand-primary transition-colors">
              {s.name}
            </h3>
            <p className="text-xs font-bold text-brand-gray uppercase tracking-widest mb-4">
              Aula: <span className="text-brand-dark">{s.room}</span>
            </p>

            <Link
              to={`/app/prof/subjects/${s.id}`}
              className="btn btn-secondary w-full !py-3 group-hover:bg-brand-dark group-hover:text-white transition-all duration-300"
            >
              GESTIONAR ASISTENCIA
            </Link>
          </div>
        ))}
      </div>

      {subjects.length === 0 && (
        <div className="card text-center py-20 border-dashed border-2">
          <div className="mx-auto w-16 h-16 bg-brand-light rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-brand-gray/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-brand-dark">No hay materias registradas</h3>
          <p className="text-brand-gray text-sm mt-1">Comienza creando tu primera asignatura para gestionar asistencias.</p>
        </div>
      )}

      {/* MODAL EDITAR */}
      {editOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-dark/80 backdrop-blur-sm" onClick={() => setEditOpen(false)}></div>
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="bg-brand-primary p-6 text-center">
              <h3 className="text-white font-black uppercase tracking-widest">Editar Asignatura</h3>
            </div>
            <form onSubmit={saveEdit} className="p-8 space-y-6">
              <div>
                <label className="label">Nombre de la Materia</label>
                <input
                  className="input"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Aula / Laboratorio</label>
                <select
                  className="input"
                  value={editForm.room}
                  onChange={e => setEditForm({ ...editForm, room: e.target.value })}
                >
                  {ROOMS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" className="btn btn-primary flex-1">GUARDAR CAMBIOS</button>
                <button type="button" onClick={() => setEditOpen(false)} className="btn btn-secondary">CANCELAR</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

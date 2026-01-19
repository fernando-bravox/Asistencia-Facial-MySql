import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../api/client.js";
import Toast from "../../components/Toast.jsx";

export default function StudentSubjectDetail() {
  const { id } = useParams();
  const [items, setItems] = useState([]);
  const [subjectInfo, setSubjectInfo] = useState(null);
  const [msg, setMsg] = useState({ type: "ok", text: "" });

  async function load() {
    try {
      const [att, subs] = await Promise.all([
        api(`/api/student/subjects/${id}/attendance`),
        api(`/api/student/subjects`) // ✅ ya existe porque ahí sí te sale el nombre
      ]);

      setItems(att.attendance || []);

      const found = (subs.subjects || []).find(s => s.id === id);
      setSubjectInfo(found || null);
    } catch (err) {
      setMsg({ type: "err", text: err.message });
    }
  }

  useEffect(() => { load(); }, [id]);

  return (
    <div>
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Mis Registros</h3>

            {/* ✅ aquí ya NO mostramos el id */}
            <div className="muted">
              Materia: {subjectInfo ? `${subjectInfo.name} ` : id}
            </div>
          </div>

          <Link className="btn secondary" to="/app/student/subjects">Volver</Link>
        </div>

        <div className="mt-3">
          <Toast type={msg.type} message={msg.text} />
        </div>
      </div>

      <div className="card mt-4">
        <div className="overflow-x-auto">
          <table className="table min-w-[700px] w-full">
            <thead>
              <tr>
                <th>Fecha/Hora</th>
                <th>Estado</th>
                <th>Método</th>
                <th>Aprobación</th>
              </tr>
            </thead>
            <tbody>
              {items.map(a => (
                <tr key={a.id}>
                  <td className="muted">{new Date(a.timestamp).toLocaleString()}</td>
                  <td>
                    <span className={`badge ${a.status === "present" ? "ok" : "warn"}`}>{a.status}</span>
                  </td>
                  <td className="muted">{a.method}</td>
                  <td>
                    <span className={`badge ${a.approvalStatus === "approved" ? "ok" : "pending"}`}>{a.approvalStatus}</span>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan="4" className="muted">Sin registros aún</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

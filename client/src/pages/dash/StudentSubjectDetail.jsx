import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../api/client.js";
import { showAlert } from "../../utils/swalHelper.js";

export default function StudentSubjectDetail() {
  const { id } = useParams();
  const [items, setItems] = useState([]);
  const [subjectInfo, setSubjectInfo] = useState(null);

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
      showAlert("error", "Error", err.message);
    }
  }

  useEffect(() => { load(); }, [id]);

  const getStatusLabel = (status) => {
    switch (status?.toLowerCase()) {
      case "present": return "PRESENTE";
      case "late": return "ATRASADO";
      case "absent": return "FALTA";
      default: return status?.toUpperCase() || "N/A";
    }
  };

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
      </div>

      <div className="card mt-4">
        <div className="overflow-x-auto">
          <table className="table min-w-[500px] w-full">
            <thead>
              <tr>
                <th>Fecha/Hora</th>
                <th>Estado</th>
                <th>Método</th>
              </tr>
            </thead>
            <tbody>
              {items.map(a => (
                <tr key={a.id}>
                  <td className="muted">{new Date(a.timestamp).toLocaleString()}</td>
                  <td>
                    <span className={`badge ${a.status === "present" ? "ok" : a.status === "late" ? "warn" : "err"}`}>
                      {getStatusLabel(a.status)}
                    </span>
                  </td>
                  <td className="muted">{a.method}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan="3" className="muted">Sin registros aún</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

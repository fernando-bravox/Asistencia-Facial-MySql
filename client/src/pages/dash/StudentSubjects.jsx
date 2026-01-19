import React, { useEffect, useState } from "react";
import { api } from "../../api/client.js";
import { Link } from "react-router-dom";
import Toast from "../../components/Toast.jsx";

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function StudentSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [msg, setMsg] = useState({ type: "ok", text: "" });

  async function load() {
    try {
      const data = await api("/api/student/subjects");
      setSubjects(data.subjects);
    } catch (err) {
      setMsg({ type: "err", text: err.message });
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="card space-y-3">
      <h3 className="text-lg font-bold text-slate-900">Mis Materias</h3>

      <Toast type={msg.type} message={msg.text} />

      {/* Scroll horizontal solo cuando haga falta */}
      <div className="overflow-x-auto">
        <table className="table min-w-[720px] w-full">
          <thead>
            <tr>
              <th>Materia</th>
              <th>Horario</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {subjects.map((s) => (
              <tr key={s.id}>
                <td className="min-w-[200px]">
                  <div className="font-bold">{s.name}</div>
                  <div className="muted">{s.code}</div>
                </td>

                <td className="muted min-w-[220px]">
                  {(s.schedules || []).map((sc) => (
                    <div key={sc.id} className="whitespace-nowrap">
                      {DAYS[Number(sc.dayOfWeek)]} {sc.startTime}-{sc.endTime}
                    </div>
                  ))}
                  {(s.schedules || []).length === 0 && "-"}
                </td>

                <td className="min-w-[160px]">
                  <Link
                    className="btn secondary w-full sm:w-auto text-center"
                    to={`/app/student/subjects/${s.id}`}
                  >
                    Ver asistencia
                  </Link>
                </td>
              </tr>
            ))}

            {subjects.length === 0 && (
              <tr>
                <td colSpan="3" className="muted">
                  Aún no estás matriculado en ninguna materia
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

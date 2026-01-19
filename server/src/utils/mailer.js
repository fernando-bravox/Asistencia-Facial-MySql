// server/src/utils/mailer.js
import nodemailer from "nodemailer";

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_SECURE,
  } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error(
      "Faltan variables SMTP_* en .env (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)."
    );
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: String(SMTP_SECURE || "false") === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return transporter;
}

export async function sendAttendanceEmail({
  to,
  studentName,
  subjectName,
  status,
  timestampISO,
}) {
  if (!to) return;

  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;

  const fecha = new Date(
    timestampISO || new Date().toISOString()
  ).toLocaleString("es-EC", {
    timeZone: "America/Guayaquil",
  });

  // ✅ CONVERSIÓN SOLO VISUAL (NO AFECTA LO INTERNO)
  const statusEs =
    (status || "").toLowerCase() === "late"
      ? "Tarde"
      : (status || "").toLowerCase() === "present"
      ? "Presente"
      : status || "N/D";

  const subject = "Asistencia registrada correctamente";

  const text = `Hola ${studentName || "estudiante"},

Tu registro de asistencia fue realizado correctamente.

Materia: ${subjectName || "N/D"}
Estado: ${statusEs}
Fecha y hora: ${fecha}

Este es un mensaje automático.`;

  // ✅ SOLO DISEÑO + TEXTO EN ESPAÑOL
  const html = `
  <div style="background:#f4f6f9;padding:20px;font-family:Arial,sans-serif">
    <div style="max-width:520px;margin:auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e0e0e0">

      <div style="background:#1a73e8;color:#ffffff;padding:14px 18px">
        <h2 style="margin:0;font-size:18px;font-weight:600">
          Asistencia registrada correctamente
        </h2>
      </div>

      <div style="padding:18px;color:#202124">
        <p style="margin-top:0">
          Hola <b>${studentName || "estudiante"}</b>,
        </p>

        <p>
          Tu registro de asistencia fue realizado correctamente. A continuación se detallan los datos:
        </p>

        <table style="width:100%;border-collapse:collapse;margin-top:12px">
          <tr>
            <td style="padding:8px;border-bottom:1px solid #e0e0e0"><b>Materia</b></td>
            <td style="padding:8px;border-bottom:1px solid #e0e0e0">${subjectName || "N/D"}</td>
          </tr>
          <tr>
            <td style="padding:8px;border-bottom:1px solid #e0e0e0"><b>Estado</b></td>
            <td style="padding:8px;border-bottom:1px solid #e0e0e0">${statusEs}</td>
          </tr>
          <tr>
            <td style="padding:8px"><b>Fecha y hora</b></td>
            <td style="padding:8px">${fecha}</td>
          </tr>
        </table>
      </div>

      <div style="padding:12px 18px;background:#f9fafb;color:#5f6368;font-size:12px">
        Este es un mensaje automático, por favor no respondas a este correo.
      </div>

    </div>
  </div>`;

  const t = getTransporter();

  await t.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}

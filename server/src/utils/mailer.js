// server/src/utils/mailer.js
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

let transporter = null;

function createTransporter() {
  if (transporter) return transporter;

  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = String(process.env.SMTP_PASS || "").replace(/\s/g, "");
  const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
  const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
  const SMTP_SECURE = String(process.env.SMTP_SECURE || "true") === "true";

  if (!SMTP_USER || !SMTP_PASS) {
    console.log("⚠️ No se detectó SMTP_USER o SMTP_PASS en el .env.");
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  return transporter;
}

function getFrom() {
  return `"Asistencia Facial ESPOCH" <${process.env.SMTP_USER}>`;
}

function formatDateEcuador(timestampISO) {
  return new Date(timestampISO || new Date().toISOString()).toLocaleString(
    "es-EC",
    {
      timeZone: "America/Guayaquil",
    }
  );
}

function getStatusLabel(status) {
  const value = String(status || "").toLowerCase();

  if (value === "present") return "PRESENTE";
  if (value === "late") return "ATRASO";
  if (value === "absent") return "FALTA";

  return status || "N/D";
}

function getStatusColor(status) {
  const value = String(status || "").toLowerCase();

  if (value === "present") return "#2e7d32";
  if (value === "late") return "#b7791f";
  if (value === "absent") return "#c62828";

  return "#2D3748";
}

// ✅ Correo de asistencia
export async function sendAttendanceEmail({
  to,
  studentName,
  subjectName,
  status,
  timestampISO,
}) {
  console.log(
    `\n📧 [ASISTENCIA] Notificación para ${studentName || "estudiante"} (${to}): ${status} en ${subjectName || "N/D"}\n`
  );

  if (!to) {
    console.log("⚠️ No se envió correo de asistencia porque no hay destinatario.");
    return { messageId: "no-recipient" };
  }

  const t = createTransporter();

  if (!t) {
    console.log("⚠️ No se detectó configuración SMTP. Notificación de asistencia solo logueada.");
    return { messageId: "logged-only" };
  }

  const date = formatDateEcuador(timestampISO);
  const statusLabel = getStatusLabel(status);
  const statusColor = getStatusColor(status);

  try {
    const info = await t.sendMail({
      from: getFrom(),
      to,
      subject: `Registro de asistencia: ${subjectName || "Materia"}`,
      text: `Hola ${studentName || "estudiante"},

Se ha registrado tu asistencia.

Materia: ${subjectName || "N/D"}
Fecha y hora: ${date}
Estado: ${statusLabel}

Sistema de Asistencia Facial - ESPOCH`,
      html: `
        <div style="background:#f4f6f9;padding:20px;font-family:Arial,sans-serif">
          <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e0e0e0">

            <div style="background:#1a73e8;color:#ffffff;padding:14px 18px">
              <h2 style="margin:0;font-size:18px;font-weight:600">
                Registro de asistencia
              </h2>
            </div>

            <div style="padding:20px;color:#202124">
              <p style="margin-top:0">
                Hola <b>${studentName || "estudiante"}</b>,
              </p>

              <p>
                Se ha registrado tu asistencia para la materia:
                <b>${subjectName || "N/D"}</b>.
              </p>

              <div style="background:#f8fafc;padding:15px;border-radius:8px;margin:20px 0">
                <p style="margin:5px 0"><b>Fecha y hora:</b> ${date}</p>
                <p style="margin:5px 0">
                  <b>Estado:</b>
                  <span style="color:${statusColor};font-weight:bold">
                    ${statusLabel}
                  </span>
                </p>
              </div>

              <p style="font-size:13px;color:#5f6368">
                Este es un mensaje automático, por favor no respondas a este correo.
              </p>
            </div>

            <div style="padding:12px 18px;background:#f9fafb;color:#5f6368;font-size:12px;text-align:center">
              Sistema de Asistencia Facial - ESPOCH
            </div>

          </div>
        </div>
      `,
    });

    console.log("✅ [ASISTENCIA] Correo enviado:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ [ASISTENCIA] Error enviando correo:", error.message);
    throw error;
  }
}

// ✅ Correo de recuperación de contraseña
export async function sendResetCode(email, code) {
  console.log(`\n🔑 [RECUPERACIÓN] Código para ${email}: ${code}\n`);

  if (!email) {
    console.log("⚠️ No se envió código porque no hay correo destinatario.");
    return { messageId: "no-recipient" };
  }

  const t = createTransporter();

  if (!t) {
    console.log("⚠️ No se detectó configuración SMTP. El código se mostró arriba en consola.");
    return { messageId: "logged-only" };
  }

  try {
    const info = await t.sendMail({
      from: getFrom(),
      to: email,
      subject: "Código de recuperación de contraseña",
      text: `Hola,

Has solicitado restablecer tu contraseña en el Sistema de Asistencia Facial ESPOCH.

Tu código de recuperación es: ${code}

Este código expirará en 15 minutos.

Si no solicitaste este cambio, puedes ignorar este correo.`,
      html: `
        <div style="background:#f4f6f9;padding:20px;font-family:Arial,sans-serif">
          <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e0e0e0">

            <div style="background:#1a73e8;color:#ffffff;padding:14px 18px">
              <h2 style="margin:0;font-size:18px;font-weight:600">
                Recuperación de contraseña
              </h2>
            </div>

            <div style="padding:20px;color:#202124">
              <p style="margin-top:0">
                Has solicitado restablecer tu contraseña en el
                <b>Sistema de Asistencia Facial ESPOCH</b>.
              </p>

              <p>
                Usa el siguiente código para continuar con el proceso:
              </p>

              <div style="background:#f1f3f4;padding:20px;text-align:center;font-size:32px;font-weight:bold;letter-spacing:6px;border-radius:8px;margin:20px 0;color:#1a73e8">
                ${code}
              </div>

              <p style="font-size:14px;color:#5f6368">
                Este código expirará en 15 minutos.
              </p>

              <p style="font-size:14px;color:#5f6368">
                Si no solicitaste este cambio, puedes ignorar este correo.
              </p>
            </div>

            <div style="padding:12px 18px;background:#f9fafb;color:#5f6368;font-size:12px;text-align:center">
              Sistema de Asistencia Facial - ESPOCH
            </div>

          </div>
        </div>
      `,
    });

    console.log("✅ [RECUPERACIÓN] Correo enviado:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ [RECUPERACIÓN] Error enviando correo:", error.message);
    throw error;
  }
}
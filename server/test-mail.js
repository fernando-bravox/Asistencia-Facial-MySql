import "dotenv/config";
import nodemailer from "nodemailer";

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = String(process.env.SMTP_PASS || "").replace(/\s/g, "");
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE = String(process.env.SMTP_SECURE || "true") === "true";

console.log("SMTP_USER:", SMTP_USER);
console.log("SMTP_HOST:", SMTP_HOST);
console.log("SMTP_PORT:", SMTP_PORT);
console.log("SMTP_SECURE:", SMTP_SECURE);
console.log("SMTP_PASS_LENGTH:", SMTP_PASS.length);

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

try {
  await transporter.verify();
  console.log("✅ SMTP conectado correctamente");

  const info = await transporter.sendMail({
    from: `"Asistencia Facial ESPOCH" <${SMTP_USER}>`,
    to: SMTP_USER,
    subject: "Prueba de correo SMTP",
    text: "Si recibes este correo, SMTP está funcionando correctamente.",
    html: `
      <h2>Prueba de correo SMTP</h2>
      <p>Si recibes este correo, la configuración funciona.</p>
    `,
  });

  console.log("✅ Correo enviado:", info.messageId);
} catch (error) {
  console.error("❌ Error SMTP:", error);
}
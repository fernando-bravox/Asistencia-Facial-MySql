import "dotenv/config";
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";


function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);
  // Tus backups vienen como objeto { docId: {...} }
  // Convertimos a array de { id, ...fields }
  return Object.entries(data).map(([id, obj]) => ({ id, ...obj }));
}

function toMySQLDate(iso) {
  if (!iso) return null;
  // "2026-01-16T20:55:56.191Z" -> "2026-01-16 20:55:56"
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

async function main() {
  const dataDir = path.resolve("migrations", "data");

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME,
  });

  console.log("✅ Conectado. Iniciando migración...");

  // Cargar datos
  const users = loadJson(path.join(dataDir, "backup_users.json"));
  const subjects = loadJson(path.join(dataDir, "backup_subjects.json"));
  const schedules = loadJson(path.join(dataDir, "backup_schedules.json"));
  const settings = loadJson(path.join(dataDir, "backup_settings.json"));
  const enrollments = loadJson(path.join(dataDir, "backup_enrollments.json"));
  const attendance = loadJson(path.join(dataDir, "backup_attendance.json"));

  // Para evitar errores por FK mientras insertamos
  await conn.query("SET FOREIGN_KEY_CHECKS=0");

  // 1) USERS
  {
    const seenEmails = new Set();
    let inserted = 0, skipped = 0;

    const sql = `
      INSERT INTO users
        (id, created_at, role, student_code, name, email, password_hash, face_id, face_descriptor)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        created_at=VALUES(created_at),
        role=VALUES(role),
        student_code=VALUES(student_code),
        name=VALUES(name),
        password_hash=VALUES(password_hash),
        face_id=VALUES(face_id),
        face_descriptor=VALUES(face_descriptor)
    `;

    for (const u of users) {
      const email = (u.email || "").trim().toLowerCase();

      // Si hay emails duplicados en el backup, salta el repetido para no romper UNIQUE(email)
      if (email && seenEmails.has(email)) {
        skipped++;
        continue;
      }
      if (email) seenEmails.add(email);

      const params = [
        u.id,
        toMySQLDate(u.createdAt),
        u.role,
        u.studentCode ?? null,
        u.name ?? "",
        email,
        u.passwordHash ?? "",
        u.faceId ?? null,
        u.faceDescriptor ? JSON.stringify(u.faceDescriptor) : null,
      ];

      await conn.execute(sql, params);
      inserted++;
    }
    console.log(`👤 users: insert/update=${inserted}, skipped(duplicate email)=${skipped}`);
  }

  // 2) SUBJECTS
  {
    const sql = `
      INSERT INTO subjects
        (id, name, code, room, professor_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name=VALUES(name),
        code=VALUES(code),
        room=VALUES(room),
        professor_id=VALUES(professor_id),
        created_at=VALUES(created_at)
    `;

    for (const s of subjects) {
      await conn.execute(sql, [
        s.id,
        s.name ?? "",
        s.code ?? null,
        s.room ?? null,
        s.professorId,
        toMySQLDate(s.createdAt),
      ]);
    }
    console.log(`📚 subjects: insert/update=${subjects.length}`);
  }

  // 3) SCHEDULES
  {
    const sql = `
      INSERT INTO schedules
        (id, subject_id, day_of_week, start_time, end_time, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        subject_id=VALUES(subject_id),
        day_of_week=VALUES(day_of_week),
        start_time=VALUES(start_time),
        end_time=VALUES(end_time),
        created_at=VALUES(created_at)
    `;

    for (const sch of schedules) {
      await conn.execute(sql, [
        sch.id,
        sch.subjectId,
        sch.dayOfWeek,
        sch.startTime,
        sch.endTime,
        toMySQLDate(sch.createdAt),
      ]);
    }
    console.log(`🕒 schedules: insert/update=${schedules.length}`);
  }

  // 4) SETTINGS (1:1 con subject)
  {
    const sql = `
      INSERT INTO settings
        (subject_id, grace_minutes, updated_at)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        grace_minutes=VALUES(grace_minutes),
        updated_at=VALUES(updated_at)
    `;

    for (const st of settings) {
      await conn.execute(sql, [
        st.subjectId,
        Number(st.graceMinutes ?? 10),
        toMySQLDate(st.updatedAt ?? st.createdAt),
      ]);
    }
    console.log(`⚙️ settings: insert/update=${settings.length}`);
  }

  // 5) ENROLLMENTS
  {
    const sql = `
      INSERT INTO enrollments
        (id, subject_id, student_id, created_at)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        subject_id=VALUES(subject_id),
        student_id=VALUES(student_id),
        created_at=VALUES(created_at)
    `;

    for (const e of enrollments) {
      await conn.execute(sql, [
        e.id,
        e.subjectId,
        e.studentId,
        toMySQLDate(e.createdAt),
      ]);
    }
    console.log(`🧾 enrollments: insert/update=${enrollments.length}`);
  }

  // 6) ATTENDANCE
  {
    const sql = `
      INSERT INTO attendance
        (id, subject_id, student_id, timestamp, method, status, approval_status, session_key, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        subject_id=VALUES(subject_id),
        student_id=VALUES(student_id),
        timestamp=VALUES(timestamp),
        method=VALUES(method),
        status=VALUES(status),
        approval_status=VALUES(approval_status),
        session_key=VALUES(session_key),
        created_at=VALUES(created_at)
    `;

    for (const a of attendance) {
      await conn.execute(sql, [
        a.id,
        a.subjectId,
        a.studentId,
        toMySQLDate(a.timestamp),
        a.method ?? null,
        a.status ?? null,
        a.approvalStatus ?? null,
        a.sessionKey ?? null,
        toMySQLDate(a.createdAt),
      ]);
    }
    console.log(`🧠 attendance: insert/update=${attendance.length}`);
  }

  await conn.query("SET FOREIGN_KEY_CHECKS=1");
  await conn.end();

  console.log("✅ Migración terminada.");
}

main().catch((e) => {
  console.error("❌ Error migrando:", e);
  process.exit(1);
});

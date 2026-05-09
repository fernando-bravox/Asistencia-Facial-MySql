// server/src/storage/tapo/scheduler.js
import cron from "node-cron";
import fs from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { v4 as uuidv4 } from "uuid";
import { captureRtspSnapshot } from "./captureSnapshot.js";
import { pool } from "../../utils/mysqlPool.js";
import { processEvidenceAndMark } from "./processAndMark.js";

const TZ = "America/Guayaquil";
const TAPO_RTSP_URL = process.env.TAPO_RTSP_URL;
const STORAGE_DIR = process.env.TAPO_STORAGE_DIR || path.resolve("storage/tapo");

const TEST_EARLY_MINUTES = Number(process.env.TAPO_TEST_EARLY_MINUTES || 0);
const FORCE_SHOT_NOW = String(process.env.TAPO_FORCE_SHOT_NOW || "0") === "1";
const FIRE_WINDOW_SECONDS = Number(process.env.TAPO_FIRE_WINDOW_SECONDS || 120);

function ensureStorageDir() {
  if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

function normalizeTime(value) {
  if (!value) return null;
  const s = String(value).trim();
  return s.length >= 5 ? s : null;
}

// DB: 0=Dom,1=Lun,...,6=Sab  -> Luxon: 7=Dom,1=Lun,...,6=Sab
function dbDowToLuxon(dayDb) {
  const n = Number(dayDb);
  if (Number.isNaN(n)) return null;
  return n === 0 ? 7 : n;
}

function dowToSpanishLuxon(weekdayLuxon) {
  // Luxon: 1=Lun ... 7=Dom
  const map = {
    1: "Lunes",
    2: "Martes",
    3: "Miércoles",
    4: "Jueves",
    5: "Viernes",
    6: "Sábado",
    7: "Domingo",
  };
  return map[weekdayLuxon] || `Día(${weekdayLuxon})`;
}

function shotTypeToSpanish(type) {
  switch (type) {
    case "EARLY_5": return "Foto 1 (minuto 5 / test)";
    case "GRACE_END": return "Foto 2 (fin de gracia)";
    case "MID_30": return "Foto 3 (minuto 30 / test)";
    default: return type;
  }
}

function buildShotTimes(startsAt, graceMinutes) {
  // EARLY: 5 min o test
  const early = TEST_EARLY_MINUTES > 0 ? TEST_EARLY_MINUTES : 5;

  // TEST extra (opcional)
  const testMid = Number(process.env.TAPO_TEST_MID_MINUTES || 0);
  const midMinutes = testMid > 0 ? testMid : 30;

  const testGrace = Number(process.env.TAPO_TEST_GRACE_MINUTES || 0);
  const grace = testGrace > 0 ? testGrace : Number(graceMinutes ?? 10);

  const tEarly = startsAt.plus({ minutes: early });
  const tGraceEnd = startsAt.plus({ minutes: grace });
  const tMid = startsAt.plus({ minutes: midMinutes });

  return [
    { shotType: "EARLY_5", at: tEarly },
    { shotType: "GRACE_END", at: tGraceEnd },
    { shotType: "MID_30", at: tMid },
  ];
}

function shouldFireShot(now, shotAt) {
  const diffSec = now.diff(shotAt, "seconds").seconds;
  return diffSec >= 0 && diffSec <= FIRE_WINDOW_SECONDS;
}

function scheduleToTodaySession(sch, now, graceMinutes, subjectName) {
  const subjectId = sch.subjectId ? String(sch.subjectId) : "";
  const scheduleId = sch.id ? String(sch.id) : "";

  const startTime = normalizeTime(sch.startTime);
  const endTime = normalizeTime(sch.endTime);
  const dayLuxon = dbDowToLuxon(sch.dayOfWeek);

  if (!subjectId || !scheduleId) {
    return { ok: false, reason: "IDs vacíos (subjectId/scheduleId)" };
  }
  if (!startTime) return { ok: false, reason: "start_time inválido/vacío" };
  if (!endTime) return { ok: false, reason: "end_time inválido/vacío" };
  if (!dayLuxon) return { ok: false, reason: "day_of_week inválido" };

  if (now.weekday !== dayLuxon) {
    return { ok: false, reason: `hoy=${dowToSpanishLuxon(now.weekday)} no coincide con horario (${dowToSpanishLuxon(dayLuxon)})` };
  }

  const startsAt = DateTime.fromISO(`${now.toISODate()}T${startTime}`, { zone: TZ });
  const endsAt = DateTime.fromISO(`${now.toISODate()}T${endTime}`, { zone: TZ });

  if (!startsAt.isValid) return { ok: false, reason: `startsAt inválido (${now.toISODate()}T${startTime})` };
  if (!endsAt.isValid) return { ok: false, reason: `endsAt inválido (${now.toISODate()}T${endTime})` };
  if (endsAt <= startsAt) return { ok: false, reason: "end_time debe ser mayor que start_time" };

  const sessionKey = `${scheduleId}_${now.toFormat("yyyyLLdd")}`;

  return {
    ok: true,
    session: {
      sessionKey,
      scheduleId,
      subjectId,
      subjectName: subjectName || `Materia(${subjectId})`,
      startsAt,
      endsAt,
      graceMinutes: Number(graceMinutes ?? 10),
    },
  };
}

async function alreadyCaptured({ subjectId, sessionKey, shotType }) {
  const [rows] = await pool.query(
    `SELECT 1 FROM attendance_evidence
     WHERE subject_id=? AND session_id=? AND shot_type=?
     LIMIT 1`,
    [String(subjectId), String(sessionKey), String(shotType)]
  );
  return rows.length > 0;
}

async function takeAndStore({ subjectId, sessionKey, shotType, takenAt }) {
  if (!subjectId || !sessionKey) {
    throw new Error(`IDs inválidos subjectId=${subjectId} sessionKey=${sessionKey}`);
  }
  if (!TAPO_RTSP_URL) throw new Error("Falta TAPO_RTSP_URL en .env");

  ensureStorageDir();

  const ts = takenAt.toFormat("yyyyLLdd_HHmmss");
  const unique = uuidv4();
  const fileName = `sub${subjectId}_ses${sessionKey}_${shotType}_${ts}_${unique}.jpg`;

  const outPath = await captureRtspSnapshot({
    rtspUrl: TAPO_RTSP_URL,
    outDir: STORAGE_DIR,
    fileName,
  });

  // Expiración: test (minutos) o normal (7 días)
  const testExpireMin = Number(process.env.TAPO_TEST_EXPIRE_MINUTES || 0);
  const expiresAt = testExpireMin > 0
    ? takenAt.plus({ minutes: testExpireMin })
    : takenAt.plus({ days: 7 });

  const [result] = await pool.query(
    `INSERT INTO attendance_evidence
     (subject_id, session_id, shot_type, taken_at, file_name, file_path, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      String(subjectId),
      String(sessionKey),
      String(shotType),
      takenAt.setZone(TZ).toSQL({ includeOffset: false }), // ✅ Asegurar zona horaria
      fileName,
      outPath,
      expiresAt.setZone(TZ).toSQL({ includeOffset: false }), // ✅ Asegurar zona horaria
      DateTime.now().setZone(TZ).toSQL({ includeOffset: false }),
    ]
  );

  return { evidenceId: result?.insertId, fileName, outPath, expiresAt };
}

async function runSchedulerTick() {
  const now = DateTime.now().setZone(TZ);

  console.log(
    `\n⏱ [TAPO] Tick: ${now.toFormat("yyyy-LL-dd HH:mm:ss")} (${dowToSpanishLuxon(now.weekday)}) | Ventana disparo=${FIRE_WINDOW_SECONDS}s`
  );

  const [schedules] = await pool.query(`
    SELECT
      id,
      subject_id AS subjectId,
      day_of_week AS dayOfWeek,
      start_time AS startTime,
      end_time AS endTime
    FROM schedules
  `);

  const [settings] = await pool.query(`
    SELECT subject_id AS subjectId, grace_minutes AS graceMinutes
    FROM settings
  `);

  // ⚠️ Ajusta si tu tabla subjects tiene otra columna distinta a "name"
  const [subjects] = await pool.query(`
    SELECT id, name
    FROM subjects
  `);

  const subjectNameById = new Map(subjects.map(s => [String(s.id), String(s.name || "").trim()]));
  const graceBySubject = new Map(settings.map(s => [String(s.subjectId), Number(s.graceMinutes ?? 10)]));

  console.log(`📚 Horarios cargados: ${schedules.length} | Settings: ${settings.length} | Materias: ${subjects.length}`);

  if (FORCE_SHOT_NOW) {
    console.log("⚠️ [TAPO] FORCE_SHOT_NOW=1 -> capturando una foto YA MISMO (esto ignora horarios).");
    const [rows] = await pool.query(`
      SELECT id AS scheduleId, subject_id AS subjectId
      FROM schedules
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (!rows.length) {
      console.log("❌ [TAPO] No hay horarios en schedules.");
      return;
    }

    const subjectId = String(rows[0].subjectId || "");
    const scheduleId = String(rows[0].scheduleId || "");
    const sessionKey = `${scheduleId}_${now.toFormat("yyyyLLdd")}`;

    try {
      const out = await takeAndStore({
        subjectId,
        sessionKey,
        shotType: "EARLY_5",
        takenAt: now,
      });
      console.log(`✅ [TAPO] Foto forzada OK | evidenceId=${out.evidenceId} | expira=${out.expiresAt.toFormat("HH:mm:ss")}`);
      console.log(`🖼 Archivo: ${out.outPath}`);
    } catch (e) {
      console.error("❌ [TAPO] Foto forzada FAIL:", e.message);
    }
    return;
  }

  for (const sch of schedules) {
    const subjectId = String(sch.subjectId || "");
    const subjectName = subjectNameById.get(subjectId) || `Materia(${subjectId})`;
    const grace = graceBySubject.get(subjectId) ?? 10;

    const r = scheduleToTodaySession(sch, now, grace, subjectName);

    if (!r.ok) {
      // Log corto de skip
      console.log(`⏭️  Skip | ${subjectName} | Motivo: ${r.reason}`);
      continue;
    }

    const session = r.session;
    const isActive = now >= session.startsAt && now <= session.endsAt;

    console.log(
      `\n🎓 Materia: ${session.subjectName}\n` +
      `   🗓️  Horario: ${session.startsAt.toFormat("HH:mm")} - ${session.endsAt.toFormat("HH:mm")} | Gracia=${session.graceMinutes}min | Activa=${isActive ? "SÍ" : "NO"}\n` +
      `   🔑 sessionKey: ${session.sessionKey}`
    );

    if (!isActive) continue;

    const shots = buildShotTimes(session.startsAt, session.graceMinutes);

    for (const sh of shots) {
      // si cae fuera del rango de clase, no disparar
      if (sh.at < session.startsAt || sh.at > session.endsAt) {
        console.log(`   ⛔ ${shotTypeToSpanish(sh.shotType)} | ${sh.at.toFormat("HH:mm:ss")} fuera de clase -> skip`);
        continue;
      }

      const fire = shouldFireShot(now, sh.at);
      console.log(`   📸 ${shotTypeToSpanish(sh.shotType)} | objetivo=${sh.at.toFormat("HH:mm:ss")} | ¿disparar ahora? ${fire ? "SÍ" : "NO"}`);

      if (!fire) continue;

      const dup = await alreadyCaptured({
        subjectId: session.subjectId,
        sessionKey: session.sessionKey,
        shotType: sh.shotType,
      });

      if (dup) {
        console.log(`   🟨 Ya existe (duplicado) -> no se repite: ${sh.shotType}`);
        continue;
      }

      try {
        const out = await takeAndStore({
          subjectId: session.subjectId,
          sessionKey: session.sessionKey,
          shotType: sh.shotType,
          takenAt: sh.at,
        });

        console.log(`   ✅ Captura OK | evidenceId=${out.evidenceId} | expira=${out.expiresAt.toFormat("HH:mm:ss")}`);
        console.log(`   🖼 Archivo: ${out.outPath}`);

        if (out.evidenceId) {
          try {
            const mark = await processEvidenceAndMark({
              evidenceId: out.evidenceId,
              subjectId: session.subjectId,
              sessionId: session.sessionKey,
            });
            console.log(`   🧠 Reconocimiento OK | rostros=${mark.facesDetected} | marcados=${mark.marked?.length ?? 0}`);
          } catch (e) {
            console.error(`   ❌ Reconocimiento FAIL (evidenceId=${out.evidenceId}): ${e.message}`);
          }
        }
      } catch (e) {
        console.error(`   ❌ Captura FAIL (${sh.shotType}): ${e.message}`);
      }
    }
  }
}

export function startTapoScheduler() {
  console.log("🚀 [TAPO] Scheduler iniciado (tick cada 15s).");
  cron.schedule("*/15 * * * * *", async () => {
    try {
      await runSchedulerTick();
    } catch (e) {
      console.error("❌ [TAPO] Error en tick:", e.message);
    }
  });
}
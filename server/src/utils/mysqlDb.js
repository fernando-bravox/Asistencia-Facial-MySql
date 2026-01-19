import { pool } from "./mysqlPool.js";

const TABLES = new Set([
  "users",
  "subjects",
  "schedules",
  "enrollments",
  "attendance",
  "settings",
]);

function assertTable(table) {
  if (!TABLES.has(table)) throw new Error(`Tabla no permitida: ${table}`);
}

function opToSql(op) {
  if (op === "==") return "=";
  if (["!=", ">", ">=", "<", "<="].includes(op)) return op;
  throw new Error("Operador no soportado: " + op);
}
function selectSql(table) {
  if (table === "users") {
    return `
      SELECT
        id,
        created_at AS createdAt,
        role,
        student_code AS studentCode,
        name,
        email,
        password_hash AS passwordHash,
        face_id AS faceId,
        face_descriptor AS faceDescriptor
      FROM users
    `;
  }

  if (table === "subjects") {
    return `
      SELECT
        id,
        name,
        code,
        room,
        professor_id AS professorId,
        created_at AS createdAt
      FROM subjects
    `;
  }

  if (table === "schedules") {
    return `
      SELECT
        id,
        subject_id AS subjectId,
        day_of_week AS dayOfWeek,
        start_time AS startTime,
        end_time AS endTime,
        created_at AS createdAt
      FROM schedules
    `;
  }

  if (table === "enrollments") {
    return `
      SELECT
        id,
        subject_id AS subjectId,
        student_id AS studentId,
        created_at AS createdAt
      FROM enrollments
    `;
  }

  if (table === "settings") {
    return `
      SELECT
        subject_id AS subjectId,
        grace_minutes AS graceMinutes,
        updated_at AS updatedAt
      FROM settings
    `;
  }

  if (table === "attendance") {
    return `
      SELECT
        id,
        subject_id AS subjectId,
        student_id AS studentId,
        timestamp,
        method,
        status,
        approval_status AS approvalStatus,
        session_key AS sessionKey,
        created_at AS createdAt
      FROM attendance
    `;
  }

  return `SELECT * FROM \`${table}\``;
}


export async function getById(table, id) {
  assertTable(table);

  // OJO: en settings no existe columna id, la PK es subject_id
  if (table === "settings") {
    const [rows] = await pool.query(
      `${selectSql(table)} WHERE subject_id=? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  }

  const [rows] = await pool.query(
    `${selectSql(table)} WHERE id=? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}


export async function findOne(table, field, value) {
  assertTable(table);

  const fieldMap = {
    createdAt: "created_at",
    studentCode: "student_code",
    passwordHash: "password_hash",
    faceId: "face_id",
    faceDescriptor: "face_descriptor",
    professorId: "professor_id",
    subjectId: "subject_id",
    studentId: "student_id",
    approvalStatus: "approval_status",
    sessionKey: "session_key",
    graceMinutes: "grace_minutes",
    updatedAt: "updated_at",
  };

  const dbField = fieldMap[field] || field;

  const [rows] = await pool.query(
    `${selectSql(table)} WHERE \`${dbField}\`=? LIMIT 1`,
    [value]
  );
  return rows[0] || null;
}


export async function listAll(table) {
  assertTable(table);
  const [rows] = await pool.query(selectSql(table));
  return rows;
}


export async function queryWhere(table, field, op, value) {
  assertTable(table);
  const sqlOp = opToSql(op);

  // Mapeo mínimo: si el código te manda camelCase, lo convertimos
  const fieldMap = {
    // comunes
    createdAt: "created_at",

    // users
    studentCode: "student_code",
    passwordHash: "password_hash",
    faceId: "face_id",
    faceDescriptor: "face_descriptor",

    // subjects
    professorId: "professor_id",

    // schedules
    subjectId: "subject_id",
    dayOfWeek: "day_of_week",
    startTime: "start_time",
    endTime: "end_time",

    // enrollments
    studentId: "student_id",

    // attendance
    approvalStatus: "approval_status",
    sessionKey: "session_key",

    // settings
    graceMinutes: "grace_minutes",
    updatedAt: "updated_at",
  };

  const dbField = fieldMap[field] || field;

  const [rows] = await pool.query(
    `${selectSql(table)} WHERE \`${dbField}\` ${sqlOp} ?`,
    [value]
  );
  return rows;
}


export async function remove(table, id) {
  assertTable(table);
  await pool.query(`DELETE FROM \`${table}\` WHERE id=?`, [id]);
}

export async function upsert(table, id, data) {
  assertTable(table);

  const cols = Object.keys(data);
  const values = cols.map((c) => data[c]);

  const colSql = cols.map((c) => `\`${c}\``).join(",");
  const ph = cols.map(() => "?").join(",");
  const upd = cols.map((c) => `\`${c}\`=VALUES(\`${c}\`)`).join(",");

  await pool.query(
    `INSERT INTO \`${table}\` (id, ${colSql}) VALUES (?, ${ph})
     ON DUPLICATE KEY UPDATE ${upd}`,
    [id, ...values]
  );

  return { id, ...data };
}

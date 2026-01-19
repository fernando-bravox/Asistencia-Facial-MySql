import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "..", "..", "data", "db.json");
const adapter = new JSONFile(dbPath);

export const db = new Low(adapter, {
  users: [],
  subjects: [],
  schedules: [],
  enrollments: [],
  attendance: [],
  attendanceEvents: [],
  settings: []
});

export async function loadDb() {
  await db.read();
  db.data ||= {
    users: [],
    subjects: [],
    schedules: [],
    enrollments: [],
    attendance: [],
    attendanceEvents: [],
    settings: []
  };
  await db.write();
}

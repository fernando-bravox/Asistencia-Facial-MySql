// test-mysql.js
import mysql from "mysql2/promise";

const conn = await mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "asistencia"
});

console.log("✅ MySQL conectado");
await conn.end();

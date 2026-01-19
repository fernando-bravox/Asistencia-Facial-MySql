# Sistema de Asistencia (App informativa) + API (Servidor)
Esta solución está hecha 100% en JavaScript e incluye:
- **Servidor (Node + Express)**: autenticación, roles, materias, horarios, matrícula, asistencias, exportación a Excel y endpoint para eventos de cámara.
- **Cliente (React)**: interfaz para Admin / Profesor / Estudiante.

> La app **no maneja cámara**. La cámara/servidor externo solo **envía eventos** al API (`/api/camera/event`).

## Requisitos
- Node.js 18+ (recomendado 20+)
- NPM

## 1) Ejecutar el servidor
```bash
cd server
npm install
cp .env.example .env
npm run seed   # crea el admin por defecto
npm run dev
```
Servidor en: http://localhost:4000

### Credenciales admin por defecto (seed)
- Email: admin@demo.com
- Password: Admin123*

## 2) Ejecutar el cliente
En otra terminal:
```bash
cd client
npm install
npm run dev
```
Cliente en: http://localhost:5173

## 3) Enviar eventos desde el servidor de cámara (ejemplo)
Configura en `server/.env` el `CAMERA_API_KEY`.
Ejemplo con curl:
```bash
curl -X POST http://localhost:4000/api/camera/event \
  -H "Content-Type: application/json" \
  -H "x-api-key: TU_API_KEY" \
  -d '{
    "faceId": "face-001",
    "timestamp": "2025-12-16T13:05:10-05:00"
  }'
```

## Estructura del proyecto
- `server/` API + base JSON (lowdb)
- `client/` React UI

## Notas importantes
- Base de datos: `server/data/db.json`
- Para producción, cambia `JWT_SECRET` y activa HTTPS / CORS restringido.

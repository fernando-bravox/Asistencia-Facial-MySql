# Abrir en Visual Studio / VS Code
1) Descomprime el proyecto.
2) Abre la carpeta principal `asistencia-facial-app` (o abre el archivo `asistencia-facial-app.code-workspace`).
3) Abre 2 terminales:
   - Terminal 1:
     ```bash
     cd server
     npm install
     cp .env.example .env
     npm run seed
     npm run dev
     ```
   - Terminal 2:
     ```bash
     cd client
     npm install
     cp .env.example .env
     npm run dev
     ```
4) Navega a: http://localhost:5173

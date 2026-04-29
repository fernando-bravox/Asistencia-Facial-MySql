// tapo/captureSnapshot.js
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

export async function captureRtspSnapshot({ rtspUrl, outDir, fileName }) {
  await fs.promises.mkdir(outDir, { recursive: true });

  const outPath = path.join(outDir, fileName);

  return new Promise((resolve, reject) => {
    const ffmpegBin = process.env.FFMPEG_PATH || "ffmpeg";

    const args = [
      "-rtsp_transport", "tcp",
      "-i", rtspUrl,
      "-frames:v", "1",
      "-q:v", "2",
      "-y",
      outPath
    ];

    const ff = spawn(ffmpegBin, args, { stdio: ["ignore", "ignore", "pipe"] });

    let err = "";

    ff.stderr.on("data", (d) => (err += d.toString()));

    ff.on("close", (code) => {
      if (code === 0) return resolve(outPath);

      reject(new Error(`FFmpeg falló (code ${code}): ${err.slice(-400)}`));
    });
  });
}
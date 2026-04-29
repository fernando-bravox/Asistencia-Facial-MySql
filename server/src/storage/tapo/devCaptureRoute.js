// tapo/devCaptureRoute.js
import express from "express";
import path from "node:path";
import { DateTime } from "luxon";
import { v4 as uuidv4 } from "uuid";

import { db, loadDb } from "../../utils/db.js";
import { captureRtspSnapshot } from "./captureSnapshot.js";

const TZ = "America/Guayaquil";
const STORAGE_DIR = process.env.TAPO_STORAGE_DIR || path.resolve("storage/tapo");
const TAPO_RTSP_URL = process.env.TAPO_RTSP_URL;

export const tapoDevRouter = express.Router();

// GET /api/dev/tapo/capture?subjectId=1
tapoDevRouter.get("/dev/tapo/capture", async (req, res) => {
  try {
    await loadDb();
    if (!TAPO_RTSP_URL) return res.status(400).json({ ok:false, message:"Falta TAPO_RTSP_URL en .env" });

    const subjectId = Number(req.query.subjectId || 0);
    const takenAt = DateTime.now().setZone(TZ);

    const fileName = `sub${subjectId}_MANUAL_${takenAt.toFormat("yyyyLLdd_HHmmss")}_${uuidv4()}.jpg`;

    const outPath = await captureRtspSnapshot({
      rtspUrl: TAPO_RTSP_URL,
      outDir: STORAGE_DIR,
      fileName,
    });

    const expiresAt = takenAt.plus({ days: 7 });

    // guarda en LowDB
    db.data.attendanceEvidence ||= [];
    const evidence = {
      id: uuidv4(),
      subjectId,
      scheduleId: null,
      shotType: "MANUAL",
      takenAt: takenAt.toISO(),
      fileName,
      filePath: outPath,
      expiresAt: expiresAt.toISO(),
    };
    db.data.attendanceEvidence.push(evidence);
    await db.write();

    res.json({ ok:true, evidence });
  } catch (e) {
    res.status(500).json({ ok:false, message: e.message });
  }
});
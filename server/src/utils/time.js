const WEEKDAY_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function parseHHMM(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return (h * 60) + (m || 0);
}

function getNowInTZParts(timestampISO, tz) {
  const d = new Date(timestampISO);

  const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(d);
  const dayOfWeek = WEEKDAY_MAP[wd];

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(d);

  const hh = Number(parts.find(p => p.type === "hour")?.value || 0);
  const mm = Number(parts.find(p => p.type === "minute")?.value || 0);

  return { dayOfWeek, minutes: hh * 60 + mm };
}

export function matchSchedule({ schedule, timestampISO, graceMinutes = 10, tz = "America/Guayaquil" }) {
  const now = getNowInTZParts(timestampISO, tz);

  const scDay = Number(schedule.dayOfWeek);
  const startMin = parseHHMM(schedule.startTime);
  const endMin = parseHHMM(schedule.endTime);

  if (now.dayOfWeek !== scDay) return { match: false };
  if (now.minutes < startMin || now.minutes > endMin) return { match: false };

  const lateAfter = startMin + Number(graceMinutes || 0);
  const status = now.minutes <= lateAfter ? "present" : "late";

  return { match: true, status };
}

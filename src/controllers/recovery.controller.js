const {
  getRecoveryForDate,
  upsertRecoveryForDate
} = require("../models/recovery.model");

function toISODate(d) {
  return new Date(d).toISOString().slice(0, 10);
}

async function showRecovery(req, res) {
  const userId = req.session.user.id;
  const today = toISODate(new Date());

  const existing = await getRecoveryForDate(userId, today);

  res.render("recovery", {
    title: "Recovery check-in",
    nav: { isAuthed: true },
    error: null,
    today,
    existing
  });
}

async function saveRecovery(req, res) {
  const userId = req.session.user.id;
  const today = toISODate(new Date());

  const sleepHoursRaw = req.body.sleepHours;
  const recoveryScoreRaw = req.body.recoveryScore;
  const notesRaw = (req.body.notes || "").trim();

  const sleepHours = sleepHoursRaw === "" ? null : Number(sleepHoursRaw);
  const recoveryScore = recoveryScoreRaw === "" ? null : Number(recoveryScoreRaw);
  const notes = notesRaw.length ? notesRaw.slice(0, 255) : null;

  // Minimal validation
  if (sleepHours !== null && (Number.isNaN(sleepHours) || sleepHours < 0 || sleepHours > 16)) {
    return res.status(400).render("recovery", {
      title: "Recovery check-in",
      nav: { isAuthed: true },
      error: "Sleep hours must be between 0 and 16.",
      today,
      existing: { SleepHours: sleepHoursRaw, RecoveryScore: recoveryScoreRaw, Notes: notesRaw }
    });
  }

  if (recoveryScore !== null && (Number.isNaN(recoveryScore) || recoveryScore < 1 || recoveryScore > 5)) {
    return res.status(400).render("recovery", {
      title: "Recovery check-in",
      nav: { isAuthed: true },
      error: "Recovery score must be between 1 and 5.",
      today,
      existing: { SleepHours: sleepHoursRaw, RecoveryScore: recoveryScoreRaw, Notes: notesRaw }
    });
  }

  await upsertRecoveryForDate(userId, today, sleepHours, recoveryScore, notes);

  return res.redirect("/dashboard");
}

module.exports = {
  showRecovery,
  saveRecovery
};

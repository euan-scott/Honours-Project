const {
  getTrainingSessionsByUser,
  createTrainingSession,
  getTrainingSessionById,
  updateTrainingSession,
  deleteTrainingSession
} = require("../models/training.model");

//Show Data
async function listTraining(req, res) {
  const userId = req.session.user.id;
  const sessions = await getTrainingSessionsByUser(userId);
  res.render("training/index", { user: req.session.user, sessions });
}

//Get Add Training Page
function showNewTraining(req, res) {
  res.render("training/new", { user: req.session.user });
}

// Add Session
async function addTraining(req, res) {
  const userId = req.session.user.id;

  await createTrainingSession(userId, {
    date: req.body.date,
    type: req.body.type,
    durationMin: req.body.durationMin,
    rpe: req.body.rpe,
    notes: req.body.notes
  });

  res.redirect("/training");
}


// Show Edit Page
async function showEditTraining(req, res) {
  const userId = req.session.user.id;
  const sessionId = Number(req.params.id);

  if (!Number.isInteger(sessionId)) {
    return res.status(400).send("Invalid session ID.");
  }

  const session = await getTrainingSessionById(userId, sessionId);
  if (!session) {
    return res.status(404).send("Session not found.");
  }

  return res.render("training/training-edit", {
    title: "Edit training session",
    nav: { isAuthed: true },
    error: null,
    session
  });
}


// Edit Session
async function handleEditTraining(req, res) {
  const userId = req.session.user.id;
  const sessionId = Number(req.params.id);

  const sessionDate = req.body.sessionDate;
  const type = (req.body.type || "").trim();
  const durationMin = Number(req.body.durationMin);
  const rpe = Number(req.body.rpe);
  
  const notesRaw = (req.body.notes || "").trim();
  const notes = notesRaw.length ? notesRaw.slice(0, 255) : null;

  const existing = await getTrainingSessionById(userId, sessionId);
  if (!existing) return res.status(404).send("Session not found.");

  const fail = (msg) =>
    res.status(400).render("training/training-edit", {   // ✅ match your showEditTraining path
      title: "Edit training session",
      nav: { isAuthed: true },
      error: msg,
      session: {
        ...existing,
        SessionDate: sessionDate || existing.SessionDate,
        SessionType: type,
        DurationMin: req.body.durationMin,
        RPE: req.body.rpe,
        // SessionLoad is derived, so don't bind from req.body
        Notes: notesRaw
      }
    });

  if (!sessionDate) return fail("Please choose a date.");
  if (!type) return fail("Please enter a session type (e.g., Run, Legs).");

  if (!Number.isFinite(durationMin) || durationMin < 0) return fail("Duration must be 0 or above.");
  if (!Number.isFinite(rpe) || rpe < 1 || rpe > 10) return fail("RPE must be between 1 and 10.");

  const sessionLoad = Math.round(durationMin * rpe);

  await updateTrainingSession(userId, sessionId, {
    sessionDate,
    type,
    durationMin: Math.round(durationMin),
    rpe: Math.round(rpe),
    sessionLoad, // calculated, not editable
    notes
  });

  return res.redirect("/training");
}


//Delete Session
async function deleteTraining(req, res) {
  const userId = req.session.user.id;
  const sessionId = Number(req.params.id);

  if (!Number.isInteger(sessionId)) {
    return res.status(400).send("Invalid session ID.");
  }

  try {
    await deleteTrainingSession(userId, sessionId);
    return res.redirect("/training");
  } catch (err) {
    console.error(err);
    return res.status(500).send("Something went wrong.");
  }
}



// CSV Export
async function exportTrainingCSV(req, res) {
  const userId = req.session.user.id;

  const sessions = await getTrainingSessionsByUser(userId);

  const header = "Date,Session Load,Duration (min)\n";

  const rows = sessions.map(s => {
    const d = new Date(s.SessionDate).toISOString().slice(0, 10);
    const load = s.SessionLoad ?? 0;
    const mins = s.DurationMin ?? 0;
    return `${d},${load},${mins}`;
  }).join("\n");

  const csv = header + rows + "\n";

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=training-history.csv");
  res.send(csv);
}

// Export
module.exports = { listTraining, showNewTraining, addTraining, exportTrainingCSV, showEditTraining,handleEditTraining, deleteTraining };

const { updateUserProfile } = require("../models/user.model");
const { createTrainingSession } = require("../models/training.model");
const { upsertNutrition } = require("../models/nutrition.model");

// STEP 1: Profile (required)
function showProfileSetup(req, res) {
  res.render("setup/profile", { user: req.session.user });
}

async function saveProfileSetup(req, res) {
  await updateUserProfile(req.session.user.id, {
    sex: req.body.sex,
    age: req.body.age,
    heightCm: req.body.heightCm,
    weightKg: req.body.weightKg
  });

  res.redirect("/setup/today");
}

// STEP 2: Ask what they want to log today (optional)
function showTodaySetup(req, res) {
  res.render("setup/today", { user: req.session.user });
}

function saveTodaySetup(req, res) {
  const logTraining = req.body.logTraining === "yes";
  const logNutrition = req.body.logNutrition === "yes";

  // store onboarding path in session (temporary, only for this flow)
  req.session.setup = { logTraining, logNutrition };

  if (logTraining) return res.redirect("/setup/training-today");
  if (logNutrition) return res.redirect("/setup/nutrition-today");
  return res.redirect("/dashboard");
}

// STEP 3A: Training today
function showTrainingToday(req, res) {
  res.render("setup/training-today", { user: req.session.user });
}

async function saveTrainingToday(req, res) {
  // allow skipping
  if (req.body.skip === "yes") {
    if (req.session.setup?.logNutrition) return res.redirect("/setup/nutrition-today");
    return res.redirect("/dashboard");
  }

  await createTrainingSession(req.session.user.id, {
    date: req.body.date,
    type: req.body.type,
    durationMin: req.body.durationMin,
    rpe: req.body.rpe,
    notes: req.body.notes
  });

  if (req.session.setup?.logNutrition) return res.redirect("/setup/nutrition-today");
  return res.redirect("/dashboard");
}

// STEP 3B: Nutrition today
function showNutritionToday(req, res) {
  res.render("setup/nutrition-today", { user: req.session.user });
}

async function saveNutritionToday(req, res) {
  if (req.body.skip === "yes") return res.redirect("/dashboard");

  await upsertNutrition(req.session.user.id, {
    date: req.body.date,
    calories: req.body.calories,
    protein: req.body.protein,
    carbs: req.body.carbs,
    fat: req.body.fat,
    notes: req.body.notes
  });

  return res.redirect("/dashboard");
}

module.exports = {
  showProfileSetup,
  saveProfileSetup,
  showTodaySetup,
  saveTodaySetup,
  showTrainingToday,
  saveTrainingToday,
  showNutritionToday,
  saveNutritionToday
};

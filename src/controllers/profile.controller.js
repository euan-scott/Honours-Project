const { getUserById, updateUserProfile } = require("../models/user.model");
const { getNutritionTargets, upsertNutritionTargets } = require("../services/nutrition.service");

async function showProfile(req, res) {
  const userId = req.session.user.id;
  const user = await getUserById(userId);
  const nutritionTargets = await getNutritionTargets(userId);
  const updated = req.session.profileUpdated || false; // Updated profile message
  delete req.session.profileUpdated; 

  res.render("profile", { user, nutritionTargets, updated });
}

async function saveProfile(req, res) {
  const userId = req.session.user.id;

  await updateUserProfile(userId, {
    sex: req.body.sex,
    age: req.body.age,
    heightCm: req.body.heightCm,
    weightKg: req.body.weightKg
  });

  await upsertNutritionTargets(userId, {
    calories: req.body.caloriesTarget,
    protein: req.body.proteinTarget,
    carbs: req.body.carbsTarget,
    fat: req.body.fatTarget
  });

  req.session.profileUpdated = true;
  // stay on profile so they see the saved goals immediately
  res.redirect("/profile");
}

module.exports = { showProfile, saveProfile };

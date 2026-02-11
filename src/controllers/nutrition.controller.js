const {
  getNutritionByUser,
  upsertNutrition
} = require("../models/nutrition.model");


// Show Data
async function listNutrition(req, res) {
  const userId = req.session.user.id;
  const logs = await getNutritionByUser(userId);
  res.render("nutrition/index", { user: req.session.user, logs });
}


// Form for adding food
function showNutritionForm(req, res) {
  res.render("nutrition/new", { user: req.session.user });
}


// Save/Add Data
async function saveNutrition(req, res) {
  const userId = req.session.user.id;

  await upsertNutrition(userId, {
    date: req.body.date,
    calories: req.body.calories,
    protein: req.body.protein,
    carbs: req.body.carbs,
    fat: req.body.fat,
    notes: req.body.notes
  });

  res.redirect("/nutrition");
}


// Nutrtion Log
const { getNutritionLogHistory, getNutritionTargets, getDiaryItemById, updateDiaryFoodItem } = require("../services/nutrition.service");

async function showNutritionLogs(req, res) {
  const userId = req.session.user.id;

  const [logs, targets] = await Promise.all([
    getNutritionLogHistory(userId, 90),
    getNutritionTargets(userId)
  ]);

  res.render("nutrition/logs", {
    user: req.session.user,
    logs,
    targets
  });
}

//Edit Item
async function showEditDiaryItem(req, res) {
  const userId = req.session.user.id;
  const diaryItemId = Number(req.params.id);

  try {
    const item = await getDiaryItemById(userId, diaryItemId);
    if (!item) {
      return res.status(404).render("nutrition/diary-item-edit", { item: null, error: "Diary item not found." });
    }

    if (!item.foodId) {
      return res.status(400).render("nutrition/diary-item-edit", { item, error: "This diary item cannot be edited." });
    }

    return res.render("nutrition/diary-item-edit", { item, error: null });
  } catch (err) {
    return res.status(500).render("nutrition/diary-item-edit", { item: null, error: "Something went wrong. Please try again." });
  }
}

async function handleEditDiaryItem(req, res) {
  const userId = req.session.user.id;
  const diaryItemId = Number(req.params.id);

  try {
    const { mealType, grams, notes } = req.body;

    const logDate = await updateDiaryFoodItem(userId, diaryItemId, {
      mealType,
      grams,
      notes: (notes && String(notes).trim()) ? String(notes).trim() : null
    });

    if (!logDate) {
      return res.status(404).render("nutrition/diary-item-edit", { item: null, error: "Diary item not found." });
    }

    return res.redirect(`/nutrition/diary?date=${encodeURIComponent(String(logDate).slice(0, 10))}`);
  } catch (err) {
    const item = await getDiaryItemById(userId, diaryItemId);
    return res.status(400).render("nutrition/diary-item-edit", {
      item: item || null,
      error: err.message || "Invalid input."
    });
  }
}


// CSV Export
const { getAllNutritionLogsForExport } = require("../services/nutrition.service");
const { handleEditTraining } = require("./training.controller");

async function exportNutritionCSV(req, res) {
  const userId = req.session.user.id;

  const logs = await getAllNutritionLogsForExport(userId);

  const header = "Date,Calories,Protein (g),Carbs (g),Fat (g)\n";

  const rows = logs.map(l => {
    const d = new Date(l.LogDate).toISOString().slice(0,10);
    return `${d},${l.Calories},${l.ProteinG},${l.CarbsG},${l.FatG}`;
  }).join("\n");

  const csv = header + rows;

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=nutrition-history.csv");
  res.send(csv);
}



// Export
module.exports = { listNutrition, showNutritionForm, saveNutrition, showNutritionLogs, exportNutritionCSV, showEditDiaryItem, handleEditDiaryItem };


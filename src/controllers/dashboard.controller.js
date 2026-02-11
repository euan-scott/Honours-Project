const { getTrainingLoads } = require("../services/metrics.service");
const { getUserById } = require("../models/user.model");
const { getNutritionSummaryForDate } = require("../services/nutrition.service");
const { getTodayEnergyBalance } = require("../services/energy.service");
const { getDiaryStreak, getTrainingStreak } = require("../services/streaks.service");
const { getWeeklySummary } = require("../services/weeklySummary.service");
const { getRecoveryForDate, getRecoverySummaryLast7Days} = require("../models/recovery.model");


async function showDashboard(req, res) {
  const userId = req.session.user.id;

  // Pull DB-backed user record (for preferences + profile fields)
  const fullUser = await getUserById(userId);

  const today = new Date().toISOString().slice(0, 10);

  const nutritionSummary = await getNutritionSummaryForDate(userId, today);


  const [loads, energy, diaryStreak, trainingStreak, weeklySummary,recoveryToday, recoverySummary] = await Promise.all([
  getTrainingLoads(userId),
  getTodayEnergyBalance(userId),
  getDiaryStreak(userId),
  getTrainingStreak(userId),
  getWeeklySummary(userId),
  getRecoveryForDate(userId,today),
  getRecoverySummaryLast7Days(userId, today)
  ]);

  let acwrStatus = "Insufficient data";
  if (loads.acwr) {
    const acwrNum = Number(loads.acwr);
    if (acwrNum < 0.8) acwrStatus = "Undertraining";
    else if (acwrNum <= 1.3) acwrStatus = "Optimal";
    else if (acwrNum <= 1.5) acwrStatus = "Caution";
    else acwrStatus = "High risk";
  }

  res.render("dashboard", {
    user: req.session.user,   // session lightweight user (email)
    fullUser,                 // DB user (prefs + profile)
    loads,
    nutritionSummary,
    energy,
    acwrStatus,
    trainingStreak,
    diaryStreak,
    weeklySummary,
    recoverySummary,
    recoveryToday
  });
}

module.exports = { showDashboard };

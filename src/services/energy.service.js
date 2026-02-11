// src/services/energy.service.js
const { sql, getPool } = require("../db/sql");
const { getUserById } = require("../models/user.model");

function mifflinStJeor({ sex, age, heightCm, weightKg }) {
  if (!sex || !age || !heightCm || !weightKg) return null;

  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;

  const s = String(sex).toLowerCase();
  if (s === "male" || s === "m") return Math.round(base + 5);
  if (s === "female" || s === "f") return Math.round(base - 161);

  return null;
}

async function getEnergyBalanceForDate(userId, dateStr) {
  const pool = await getPool();

  const user = await getUserById(userId);

  const bmr = mifflinStJeor({
    sex: user?.Sex,
    age: user?.Age ? Number(user.Age) : null,
    heightCm: user?.HeightCm ? Number(user.HeightCm) : null,
    weightKg: user?.WeightKg ? Number(user.WeightKg) : null
  });

  const estimatedExpenditure = bmr ? Math.round(bmr * 1.2) : 2400; // light factor

  const date = dateStr || new Date().toISOString().slice(0, 10);

  // IMPORTANT: match your real table name (NutritionLog vs NutritionLogs)
  const nutrition = await pool.request()
    .input("userId", sql.Int, userId)
    .input("logDate", sql.Date, date)
    .query(`
      SELECT Calories
      FROM dbo.NutritionLogs
      WHERE UserId = @userId
        AND LogDate = @logDate;
    `);

  const calories = nutrition.recordset[0]?.Calories ?? 0;

  return {
    date,
    calories,
    bmr,
    estimatedExpenditure,
    // Surplus/deficit: positive means eating above expenditure
    balance: calories - estimatedExpenditure
  };
}

async function getTodayEnergyBalance(userId) {
  const today = new Date().toISOString().slice(0, 10);
  return getEnergyBalanceForDate(userId, today);
}

module.exports = { getTodayEnergyBalance, getEnergyBalanceForDate };

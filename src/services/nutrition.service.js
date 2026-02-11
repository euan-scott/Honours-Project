const { sql, getPool } = require("../db/sql");

function computeFromPer100g(grams, per100g) {
  return Number(((grams * per100g) / 100).toFixed(1));
}

const round1 = (n) => Number(Number(n || 0).toFixed(1));

// Normalise incoming form/body values
const toNumberOrNull = (v) => {
  if (v === undefined || v === null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Optional targets per user (kcal + grams)
 */
async function getNutritionTargets(userId) {
  const pool = await getPool();
  const res = await pool.request()
    .input("userId", sql.Int, userId)
    .query(`
      SELECT CaloriesTarget, ProteinTarget, CarbsTarget, FatTarget
      FROM dbo.NutritionTargets
      WHERE UserId = @userId;
    `);

  const t = res.recordset[0];
  if (!t) return null;

  return {
    calories: t.CaloriesTarget == null ? null : Number(t.CaloriesTarget),
    protein:  t.ProteinTarget  == null ? null : Number(t.ProteinTarget),
    carbs:    t.CarbsTarget    == null ? null : Number(t.CarbsTarget),
    fat:      t.FatTarget      == null ? null : Number(t.FatTarget)
  };
}

async function upsertNutritionTargets(userId, { calories, protein, carbs, fat }) {
  const pool = await getPool();

  const calVal = toNumberOrNull(calories);
  const pVal   = toNumberOrNull(protein);
  const cVal   = toNumberOrNull(carbs);
  const fVal   = toNumberOrNull(fat);

  await pool.request()
    .input("userId", sql.Int, userId)
    .input("cal", sql.Int, calVal)
    .input("p", sql.Decimal(10, 1), pVal)
    .input("c", sql.Decimal(10, 1), cVal)
    .input("f", sql.Decimal(10, 1), fVal)
    .query(`
      MERGE dbo.NutritionTargets AS tgt
      USING (SELECT @userId AS UserId) AS src
      ON (tgt.UserId = src.UserId)
      WHEN MATCHED THEN
        UPDATE SET
          CaloriesTarget = @cal,
          ProteinTarget  = @p,
          CarbsTarget    = @c,
          FatTarget      = @f,
          UpdatedAt      = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (UserId, CaloriesTarget, ProteinTarget, CarbsTarget, FatTarget, UpdatedAt)
        VALUES (@userId, @cal, @p, @c, @f, SYSUTCDATETIME());
    `);

  return true;
}

async function getNutritionSummaryForDate(userId, date) {
  const diary = await getDiaryForDate(userId, date);
  return {
    totals: diary.totals,
    targets: diary.targets,
    remaining: diary.remaining || null
  };
}

async function getOrCreateDiaryDayId(userId, logDate) {
  const pool = await getPool();

  const existing = await pool.request()
    .input("userId", sql.Int, userId)
    .input("logDate", sql.Date, logDate)
    .query(`
      SELECT DiaryDayId
      FROM dbo.DiaryDays
      WHERE UserId = @userId AND LogDate = @logDate;
    `);

  if (existing.recordset.length) return existing.recordset[0].DiaryDayId;

  const inserted = await pool.request()
    .input("userId", sql.Int, userId)
    .input("logDate", sql.Date, logDate)
    .query(`
      INSERT INTO dbo.DiaryDays (UserId, LogDate)
      OUTPUT INSERTED.DiaryDayId
      VALUES (@userId, @logDate);
    `);

  return inserted.recordset[0].DiaryDayId;
}

/**
 * Writes/updates the daily totals table (dbo.NutritionLogs) from diary totals.
 * Keeps "View logs" + dashboard energy balance fast and user-specific.
 */
async function upsertNutritionLogFromDiary(userId, date) {
  const pool = await getPool();
  const diary = await getDiaryForDate(userId, date);
  const t = diary.totals;

  const calories = Math.round(Number(t.calories || 0));
  const proteinG = round1(t.protein);
  const carbsG   = round1(t.carbs);
  const fatG     = round1(t.fat);

  const hasAnything = calories > 0 || proteinG > 0 || carbsG > 0 || fatG > 0;

  // If nothing logged, remove the summary row for that date
  if (!hasAnything) {
    await pool.request()
      .input("userId", sql.Int, userId)
      .input("logDate", sql.Date, date)
      .query(`
        DELETE FROM dbo.NutritionLogs
        WHERE UserId = @userId AND LogDate = @logDate;
      `);

    return { deleted: true };
  }

  await pool.request()
    .input("userId", sql.Int, userId)
    .input("logDate", sql.Date, date)
    .input("cal", sql.Int, calories)
    .input("p", sql.Decimal(10, 1), proteinG)
    .input("c", sql.Decimal(10, 1), carbsG)
    .input("f", sql.Decimal(10, 1), fatG)
    .query(`
      MERGE dbo.NutritionLogs AS tgt
      USING (SELECT @userId AS UserId, @logDate AS LogDate) AS src
      ON (tgt.UserId = src.UserId AND tgt.LogDate = src.LogDate)
      WHEN MATCHED THEN
        UPDATE SET
          Calories = @cal,
          ProteinG = @p,
          CarbsG   = @c,
          FatG     = @f,
          UpdatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (UserId, LogDate, Calories, ProteinG, CarbsG, FatG, CreatedAt, UpdatedAt)
        VALUES (@userId, @logDate, @cal, @p, @c, @f, SYSUTCDATETIME(), SYSUTCDATETIME());
    `);

  return { upserted: true };
}

async function addDiaryFoodItem(userId, { date, mealType, foodId, grams, notes = null }) {
  const pool = await getPool();
  const diaryDayId = await getOrCreateDiaryDayId(userId, date);

  const gramsVal = toNumberOrNull(grams);
  if (gramsVal == null || gramsVal <= 0) {
    throw new Error("Grams must be a positive number.");
  }

  const foodCheck = await pool.request()
    .input("userId", sql.Int, userId)
    .input("foodId", sql.Int, foodId)
    .query(`
      SELECT FoodId
      FROM dbo.Foods
      WHERE FoodId = @foodId
        AND (CreatedByUserId IS NULL OR CreatedByUserId = @userId);
    `);

  if (!foodCheck.recordset.length) {
    throw new Error("Food not found or not accessible.");
  }

  const res = await pool.request()
    .input("diaryDayId", sql.Int, diaryDayId)
    .input("mealType", sql.TinyInt, mealType)
    .input("foodId", sql.Int, foodId)
    .input("grams", sql.Decimal(10, 2), gramsVal)
    .input("notes", sql.NVarChar(250), notes)
    .query(`
      INSERT INTO dbo.DiaryItems (DiaryDayId, MealType, FoodId, Grams, Notes)
      OUTPUT INSERTED.DiaryItemId
      VALUES (@diaryDayId, @mealType, @foodId, @grams, @notes);
    `);

  await upsertNutritionLogFromDiary(userId, date);

  return { diaryItemId: res.recordset[0].DiaryItemId };
}

/* async function addDiaryQuickItem(userId, { date, mealType, calories, protein = null, carbs = null, fat = null, notes = null }) {
  const pool = await getPool();
  const diaryDayId = await getOrCreateDiaryDayId(userId, date);

  const calVal = toNumberOrNull(calories);
  if (calVal == null || calVal < 0) {
    throw new Error("Calories must be a number (0 or more).");
  }

  const pVal = toNumberOrNull(protein);
  const cVal = toNumberOrNull(carbs);
  const fVal = toNumberOrNull(fat);

  const res = await pool.request()
    .input("diaryDayId", sql.Int, diaryDayId)
    .input("mealType", sql.TinyInt, mealType)
    .input("cal", sql.Decimal(10, 2), calVal)
    .input("p", sql.Decimal(10, 2), pVal)
    .input("c", sql.Decimal(10, 2), cVal)
    .input("f", sql.Decimal(10, 2), fVal)
    .input("notes", sql.NVarChar(250), notes)
    .query(`
      INSERT INTO dbo.DiaryItems (DiaryDayId, MealType, QuickCalories, QuickProtein, QuickCarbs, QuickFat, Notes)
      OUTPUT INSERTED.DiaryItemId
      VALUES (@diaryDayId, @mealType, @cal, @p, @c, @f, @notes);
    `);

  await upsertNutritionLogFromDiary(userId, date);

  return { diaryItemId: res.recordset[0].DiaryItemId };
} */

/**
 * Get diary for a day (grouped meals + totals + targets)
 */
async function getDiaryForDate(userId, date) {
  const pool = await getPool();

  const dayRes = await pool.request()
    .input("userId", sql.Int, userId)
    .input("logDate", sql.Date, date)
    .query(`
      SELECT DiaryDayId
      FROM dbo.DiaryDays
      WHERE UserId = @userId AND LogDate = @logDate;
    `);

  const diaryDayId = dayRes.recordset[0]?.DiaryDayId;
  const items = [];

  if (diaryDayId) {
    const itemsRes = await pool.request()
      .input("diaryDayId", sql.Int, diaryDayId)
      .query(`
        SELECT
          di.DiaryItemId,
          di.MealType,
          di.Grams,
          di.QuickCalories, di.QuickProtein, di.QuickCarbs, di.QuickFat,
          di.Notes,
          f.FoodId,
          f.Name AS FoodName,
          f.IsVerified,
          f.Brand,
          f.CaloriesPer100g, f.ProteinPer100g, f.CarbsPer100g, f.FatPer100g
        FROM dbo.DiaryItems di
        LEFT JOIN dbo.Foods f ON di.FoodId = f.FoodId
        WHERE di.DiaryDayId = @diaryDayId
        ORDER BY di.MealType ASC, di.CreatedAt ASC;
      `);

    for (const row of itemsRes.recordset) {
      if (row.FoodId && row.Grams != null) {
        const grams = Number(row.Grams);
        const isVerified = (row.IsVerified === true || row.IsVerified === 1);

        items.push({
          diaryItemId: row.DiaryItemId,
          mealType: row.MealType,
          type: "food",
          foodId: row.FoodId,
          name: row.FoodName,
          brand: row.Brand,
          grams,
          calories: computeFromPer100g(grams, Number(row.CaloriesPer100g)),
          protein: computeFromPer100g(grams, Number(row.ProteinPer100g)),
          carbs: computeFromPer100g(grams, Number(row.CarbsPer100g)),
          fat: computeFromPer100g(grams, Number(row.FatPer100g)),
          notes: row.Notes,
          isVerified
        });
      } else {
        items.push({
          diaryItemId: row.DiaryItemId,
          mealType: row.MealType,
          type: "quick",
          calories: Number(row.QuickCalories),
          protein: row.QuickProtein == null ? null : Number(row.QuickProtein),
          carbs: row.QuickCarbs == null ? null : Number(row.QuickCarbs),
          fat: row.QuickFat == null ? null : Number(row.QuickFat),
          notes: row.Notes,
          isVerified: false
        });
      }
    }
  }

  const targets = await getNutritionTargets(userId);

  const meals = {
    1: { name: "Breakfast", items: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } },
    2: { name: "Lunch",     items: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } },
    3: { name: "Dinner",    items: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } },
    4: { name: "Snacks",    items: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } }
  };

  for (const it of items) {
    const m = meals[it.mealType];
    if (!m) continue;

    m.items.push(it);
    m.totals.calories += it.calories ?? 0;
    m.totals.protein  += it.protein ?? 0;
    m.totals.carbs    += it.carbs ?? 0;
    m.totals.fat      += it.fat ?? 0;
  }

  const dayTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const key of Object.keys(meals)) {
    dayTotals.calories += meals[key].totals.calories;
    dayTotals.protein  += meals[key].totals.protein;
    dayTotals.carbs    += meals[key].totals.carbs;
    dayTotals.fat      += meals[key].totals.fat;
  }

  for (const key of Object.keys(meals)) {
    meals[key].totals = {
      calories: Math.round(meals[key].totals.calories),
      protein: round1(meals[key].totals.protein),
      carbs:   round1(meals[key].totals.carbs),
      fat:     round1(meals[key].totals.fat)
    };
  }

  const response = {
    date,
    meals,
    totals: {
      calories: Math.round(dayTotals.calories),
      protein: round1(dayTotals.protein),
      carbs:   round1(dayTotals.carbs),
      fat:     round1(dayTotals.fat)
    },
    targets
  };

  if (targets) {
    response.remaining = {
      calories: targets.calories == null ? null : Math.round(targets.calories - response.totals.calories),
      protein:  targets.protein  == null ? null : round1(targets.protein - response.totals.protein),
      carbs:    targets.carbs    == null ? null : round1(targets.carbs - response.totals.carbs),
      fat:      targets.fat      == null ? null : round1(targets.fat - response.totals.fat)
    };
  }

  return response;
}

async function deleteDiaryItem(userId, diaryItemId) {
  const pool = await getPool();

  // Find the date first (and enforce ownership)
  const findRes = await pool.request()
    .input("userId", sql.Int, userId)
    .input("diaryItemId", sql.Int, diaryItemId)
    .query(`
      SELECT dd.LogDate
      FROM dbo.DiaryItems di
      INNER JOIN dbo.DiaryDays dd ON dd.DiaryDayId = di.DiaryDayId
      WHERE di.DiaryItemId = @diaryItemId
        AND dd.UserId = @userId;
    `);

  const logDate = findRes.recordset[0]?.LogDate;
  if (!logDate) return 0;

  // Delete (ownership enforced again)
  const result = await pool.request()
    .input("userId", sql.Int, userId)
    .input("diaryItemId", sql.Int, diaryItemId)
    .query(`
      DELETE di
      FROM dbo.DiaryItems di
      INNER JOIN dbo.DiaryDays dd ON dd.DiaryDayId = di.DiaryDayId
      WHERE di.DiaryItemId = @diaryItemId
        AND dd.UserId = @userId;
    `);

  const rows = (result.rowsAffected && result.rowsAffected[0]) ? result.rowsAffected[0] : 0;

  // Sync totals after delete
  if (rows > 0) {
    await upsertNutritionLogFromDiary(userId, logDate);
  }

  return rows;
}


// Food Diary Logs
async function getNutritionLogHistory(userId, limit = 90) {
  const pool = await getPool();

  const result = await pool.request()
    .input("userId", sql.Int, userId)
    .input("limit", sql.Int, limit)
    .query(`
      SELECT TOP (@limit)
        nl.LogDate,
        nl.Calories  AS calories,
        nl.ProteinG  AS protein,
        nl.CarbsG    AS carbs,
        nl.FatG      AS fat
      FROM dbo.NutritionLogs nl
      WHERE nl.UserId = @userId
        AND (ISNULL(nl.Calories, 0) > 0
          OR ISNULL(nl.ProteinG, 0) > 0
          OR ISNULL(nl.CarbsG, 0) > 0
          OR ISNULL(nl.FatG, 0) > 0)
      ORDER BY nl.LogDate DESC;
    `);

  return result.recordset;
}


// Get Diary Item for Edit
async function getDiaryItemById(userId, diaryItemId) {
  const pool = await getPool();

  const res = await pool.request()
    .input("userId", sql.Int, userId)
    .input("diaryItemId", sql.Int, diaryItemId)
    .query(`
      SELECT
        di.DiaryItemId,
        di.MealType,
        di.Grams,
        di.Notes,
        di.FoodId,
        dd.LogDate,
        f.Name  AS FoodName,
        f.Brand AS Brand
      FROM dbo.DiaryItems di
      INNER JOIN dbo.DiaryDays dd ON dd.DiaryDayId = di.DiaryDayId
      LEFT JOIN dbo.Foods f ON f.FoodId = di.FoodId
      WHERE di.DiaryItemId = @diaryItemId
        AND dd.UserId = @userId;
    `);

  const row = res.recordset[0];
  if (!row) return null;

  return {
    diaryItemId: row.DiaryItemId,
    mealType: row.MealType,
    grams: row.Grams == null ? null : Number(row.Grams),
    notes: row.Notes || "",
    foodId: row.FoodId || null,
    foodName: row.FoodName || null,
    brand: row.Brand || null,
    logDate: row.LogDate
  };
}


// Edit Diary Item
async function updateDiaryFoodItem(userId, diaryItemId, { mealType, grams, notes = null }) {
  const pool = await getPool();

  const existing = await getDiaryItemById(userId, diaryItemId);
  if (!existing) return null;

  // Only food items 
  if (!existing.foodId) {
    throw new Error("This diary item cannot be edited.");
  }

  const mealVal = toNumberOrNull(mealType);
  if (![1, 2, 3, 4].includes(mealVal)) {
    throw new Error("Invalid meal type.");
  }

  const gramsVal = toNumberOrNull(grams);
  if (gramsVal == null || gramsVal <= 0) {
    throw new Error("Grams must be a positive number.");
  }

  await pool.request()
    .input("userId", sql.Int, userId)
    .input("diaryItemId", sql.Int, diaryItemId)
    .input("mealType", sql.TinyInt, mealVal)
    .input("grams", sql.Decimal(10, 2), gramsVal)
    .input("notes", sql.NVarChar(250), notes)
    .query(`
      UPDATE di
      SET
        MealType = @mealType,
        Grams = @grams,
        Notes = @notes
      FROM dbo.DiaryItems di
      INNER JOIN dbo.DiaryDays dd ON dd.DiaryDayId = di.DiaryDayId
      WHERE di.DiaryItemId = @diaryItemId
        AND dd.UserId = @userId;
    `);

  await upsertNutritionLogFromDiary(userId, existing.logDate);

  return existing.logDate;
}


// Export to csv
async function getAllNutritionLogsForExport(userId) {
  const pool = await getPool();

  const result = await pool.request()
    .input("userId", sql.Int, userId)
    .query(`
      SELECT
        LogDate,
        Calories,
        ProteinG,
        CarbsG,
        FatG
      FROM dbo.NutritionLogs
      WHERE UserId = @userId
      ORDER BY LogDate ASC;
    `);

  return result.recordset;
}

module.exports = {
  searchFoods: require("./foods.service").searchFoods,
  addDiaryFoodItem,
  getDiaryForDate,
  getNutritionSummaryForDate,
  deleteDiaryItem,
  getNutritionTargets,
  upsertNutritionTargets,
  upsertNutritionLogFromDiary,
  getNutritionLogHistory,
  getAllNutritionLogsForExport,
  getDiaryItemById,
  updateDiaryFoodItem
};

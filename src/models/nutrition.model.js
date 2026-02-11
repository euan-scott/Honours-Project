const { getPool } = require("./db");

async function getNutritionByUser(userId) {
  const pool = await getPool();
  const result = await pool.request()
    .input("UserId", userId)
    .query(`
      SELECT LogDate, Calories, ProteinG, CarbsG, FatG, Notes
      FROM dbo.NutritionLogs
      WHERE UserId = @UserId
      ORDER BY LogDate DESC
    `);

  return result.recordset;
}

async function upsertNutrition(userId, log) {
  const pool = await getPool();

  await pool.request()
    .input("UserId", userId)
    .input("LogDate", log.date)
    .input("Calories", Number(log.calories))
    .input("ProteinG", Number(log.protein))
    .input("CarbsG", Number(log.carbs))
    .input("FatG", Number(log.fat))
    .input("Notes", log.notes || null)
    .query(`
      MERGE dbo.NutritionLogs AS target
      USING (SELECT @UserId AS UserId, @LogDate AS LogDate) AS source
      ON target.UserId = source.UserId AND target.LogDate = source.LogDate
      WHEN MATCHED THEN
        UPDATE SET Calories=@Calories, ProteinG=@ProteinG, CarbsG=@CarbsG, FatG=@FatG, Notes=@Notes
      WHEN NOT MATCHED THEN
        INSERT (UserId, LogDate, Calories, ProteinG, CarbsG, FatG, Notes)
        VALUES (@UserId, @LogDate, @Calories, @ProteinG, @CarbsG, @FatG, @Notes);
    `);
}

module.exports = { getNutritionByUser, upsertNutrition };

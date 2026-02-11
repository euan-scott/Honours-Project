// services/foods.service.js
const { sql, getPool } = require("../db/sql");

/**
 * Search foods.
 * - Includes global foods (CreatedByUserId IS NULL)
 * - Includes user foods (CreatedByUserId = @userId)
 */
async function searchFoods(userId, query, limit = 20) {
  const pool = await getPool();

  const q = (query || "").trim();
  if (!q) return [];

  const result = await pool.request()
    .input("userId", sql.Int, userId)
    .input("q", sql.NVarChar(150), `%${q}%`)
    .input("limit", sql.Int, limit)
    .query(`
      SELECT TOP (@limit)
        FoodId, Name, Brand,
        CaloriesPer100g, ProteinPer100g, CarbsPer100g, FatPer100g,
        CreatedByUserId, IsVerified
      FROM dbo.Foods
      WHERE (CreatedByUserId IS NULL OR CreatedByUserId = @userId)
        AND (Name LIKE @q OR Brand LIKE @q)
      ORDER BY
        CASE WHEN IsVerified = 1 THEN 0 ELSE 1 END,
        Name ASC;
    `);

  return result.recordset;
}

async function createFood(userId, { name, brand = null, caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g }) {
  const pool = await getPool();

  const result = await pool.request()
    .input("name", sql.NVarChar(150), name.trim())
    .input("brand", sql.NVarChar(100), brand ? brand.trim() : null)
    .input("cal", sql.Decimal(10, 2), caloriesPer100g)
    .input("p", sql.Decimal(10, 2), proteinPer100g)
    .input("c", sql.Decimal(10, 2), carbsPer100g)
    .input("f", sql.Decimal(10, 2), fatPer100g)
    .input("userId", sql.Int, userId)
    .query(`-
      INSERT INTO dbo.Foods
        (Name, Brand, CaloriesPer100g, ProteinPer100g, CarbsPer100g, FatPer100g, CreatedByUserId, IsVerified)
      OUTPUT INSERTED.FoodId, INSERTED.Name, INSERTED.Brand,
             INSERTED.CaloriesPer100g, INSERTED.ProteinPer100g, INSERTED.CarbsPer100g, INSERTED.FatPer100g,
             INSERTED.CreatedByUserId, INSERTED.IsVerified
      VALUES
        (@name, @brand, @cal, @p, @c, @f, @userId, 0);
    `);

  return result.recordset[0];
}

module.exports = {
  searchFoods,
  createFood
};


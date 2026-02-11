const { sql, getPool } = require("../db/sql");

const round1 = (n) => Number(Number(n || 0).toFixed(1));

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function getWeekRange(endDate = new Date()) {
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  const start = new Date(end);
  start.setDate(start.getDate() - 6); // last 7 days inclusive
  start.setHours(0, 0, 0, 0);

  return { start, end };
}

async function getWeeklyNutritionSummary(userId, endDate = new Date()) {
  const pool = await getPool();
  const { start, end } = getWeekRange(endDate);

  const res = await pool.request()
    .input("userId", sql.Int, userId)
    .input("startDate", sql.Date, start)
    .input("endDate", sql.Date, end)
    .query(`
      SELECT
        COUNT(*) AS daysLogged,
        AVG(CAST(Calories AS float)) AS avgCalories,
        AVG(CAST(ProteinG AS float)) AS avgProtein,
        AVG(CAST(CarbsG   AS float)) AS avgCarbs,
        AVG(CAST(FatG     AS float)) AS avgFat
      FROM dbo.NutritionLogs
      WHERE UserId = @userId
        AND LogDate BETWEEN @startDate AND @endDate;
    `);

  const row = res.recordset[0] || {};
  return {
    range: { start: toISODate(start), end: toISODate(end) },
    daysLogged: Number(row.daysLogged || 0),
    avgCalories: row.avgCalories == null ? 0 : Math.round(Number(row.avgCalories)),
    avgProtein:  row.avgProtein  == null ? 0 : round1(row.avgProtein),
    avgCarbs:    row.avgCarbs    == null ? 0 : round1(row.avgCarbs),
    avgFat:      row.avgFat      == null ? 0 : round1(row.avgFat)
  };
}

async function getWeeklyTrainingSummary(userId, endDate = new Date()) {
  const pool = await getPool();
  const { start, end } = getWeekRange(endDate);

  // ⚠️ IMPORTANT: update this query to match YOUR training table/column names.
  // Common setup: dbo.TrainingSessions(UserId, SessionDate, ...)
  const res = await pool.request()
    .input("userId", sql.Int, userId)
    .input("startDate", sql.Date, start)
    .input("endDate", sql.Date, end)
    .query(`
      SELECT
        COUNT(*) AS sessions,
        COUNT(DISTINCT ts.SessionDate) AS daysTrained,
        SUM(ISNULL(ts.SessionLoad, 0)) AS totalLoad,
        SUM(ISNULL(ts.DurationMin, 0)) AS totalMinutes
      FROM dbo.TrainingSessions AS ts
      WHERE ts.UserId = @userId
        AND ts.SessionDate BETWEEN @startDate AND @endDate;
    `);

    const row = res.recordset[0] || {};
    return {
        range: { start: toISODate(start), end: toISODate(end) },
        sessions: Number(row.sessions || 0),
        daysTrained: Number(row.daysTrained || 0),
        totalLoad: Number(row.totalLoad || 0),
        totalMinutes: Number(row.totalMinutes || 0)
    };

}

async function getWeeklySummary(userId, endDate = new Date()) {
  const [nutrition, training] = await Promise.all([
    getWeeklyNutritionSummary(userId, endDate),
    getWeeklyTrainingSummary(userId, endDate)
  ]);

  return { nutrition, training };
}

module.exports = {
  getWeeklyNutritionSummary,
  getWeeklyTrainingSummary,
  getWeeklySummary
};

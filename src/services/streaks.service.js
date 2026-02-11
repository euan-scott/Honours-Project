// src/services/streaks.service.js
const { sql, getPool } = require("../db/sql");


// Streaks
function computeConsecutiveStreak(loggedDatesDesc, endDate) {
  if (!loggedDatesDesc || loggedDatesDesc.length === 0) return 0;

  // Normalise to yyyy-mm-dd strings for safe comparisons.
  const loggedSet = new Set(loggedDatesDesc.map(d => d.toISOString().slice(0, 10)));
  let streak = 0;

  // Walk backwards from endDate until a gap is found.
  const cursor = new Date(endDate);
  cursor.setHours(0, 0, 0, 0);

  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!loggedSet.has(key)) break;

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

// Food diary streak: day counts if there is at least one DiaryItem on that date.
async function getDiaryStreak(userId, endDate = new Date(), lookbackDays = 365) {
  const pool = await getPool();

  const start = new Date(endDate);
  start.setDate(start.getDate() - lookbackDays);
  start.setHours(0, 0, 0, 0);

  const result = await pool.request()
    .input("userId", sql.Int, userId)
    .input("startDate", sql.Date, start)
    .input("endDate", sql.Date, endDate)
    .query(`
      SELECT DISTINCT dd.LogDate AS LogDate
      FROM dbo.DiaryDays dd
      WHERE dd.UserId = @userId
        AND dd.LogDate BETWEEN @startDate AND @endDate
        AND EXISTS (
          SELECT 1
          FROM dbo.DiaryItems di
          WHERE di.DiaryDayId = dd.DiaryDayId
        )
      ORDER BY dd.LogDate DESC;
    `);

  const dates = result.recordset.map(r => new Date(r.LogDate));
  return computeConsecutiveStreak(dates, endDate);
}

// Training streak: day counts if there is at least one training session on that date. 
async function getTrainingStreak(userId, endDate = new Date(), lookbackDays = 365) {
  const pool = await getPool();

  const start = new Date(endDate);
  start.setDate(start.getDate() - lookbackDays);
  start.setHours(0, 0, 0, 0);

  const result = await pool.request()
    .input("userId", sql.Int, userId)
    .input("startDate", sql.Date, start)
    .input("endDate", sql.Date, endDate)
    .query(`
      SELECT DISTINCT ts.SessionDate AS LogDate
      FROM dbo.TrainingSessions ts
      WHERE ts.UserId = @userId
        AND ts.SessionDate BETWEEN @startDate AND @endDate
      ORDER BY ts.SessionDate DESC;
    `);

  const dates = result.recordset.map(r => new Date(r.LogDate));
  return computeConsecutiveStreak(dates, endDate);
}

module.exports = {
  getDiaryStreak,
  getTrainingStreak
};

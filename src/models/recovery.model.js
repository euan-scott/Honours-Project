const { sql, getPool } = require("../db/sql");

async function getRecoveryForDate(userId, logDate) {
  const pool = await getPool();
  const result = await pool.request()
    .input("userId", sql.Int, userId)
    .input("logDate", sql.Date, logDate)
    .query(`
      SELECT TOP 1 RecoveryCheckInId, UserId, LogDate, SleepHours, RecoveryScore, Notes
      FROM dbo.RecoveryCheckIns
      WHERE UserId = @userId AND LogDate = @logDate;
    `);

  return result.recordset[0] || null;
}

async function upsertRecoveryForDate(userId, logDate, sleepHours, recoveryScore, notes) {
  const pool = await getPool();

  await pool.request()
    .input("userId", sql.Int, userId)
    .input("logDate", sql.Date, logDate)
    .input("sleepHours", sql.Decimal(4, 1), sleepHours)
    .input("recoveryScore", sql.TinyInt, recoveryScore)
    .input("notes", sql.NVarChar(255), notes)
    .query(`
      MERGE dbo.RecoveryCheckIns AS target
      USING (SELECT @userId AS UserId, @logDate AS LogDate) AS source
      ON (target.UserId = source.UserId AND target.LogDate = source.LogDate)
      WHEN MATCHED THEN
        UPDATE SET
          SleepHours = @sleepHours,
          RecoveryScore = @recoveryScore,
          Notes = @notes,
          UpdatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (UserId, LogDate, SleepHours, RecoveryScore, Notes)
        VALUES (@userId, @logDate, @sleepHours, @recoveryScore, @notes);
    `);
}

async function getRecoverySummaryLast7Days(userId, endDate) {
  const pool = await getPool();

  const result = await pool.request()
    .input("userId", sql.Int, userId)
    .input("endDate", sql.Date, endDate)
    .query(`
      SELECT
        COUNT(*) AS DaysCheckedIn,
        AVG(CAST(SleepHours AS FLOAT)) AS AvgSleepHours,
        AVG(CAST(RecoveryScore AS FLOAT)) AS AvgRecoveryScore
      FROM dbo.RecoveryCheckIns
      WHERE UserId = @userId
        AND LogDate >= DATEADD(day, -6, @endDate)
        AND LogDate <= @endDate;
    `);

  const row = result.recordset[0] || {
    DaysCheckedIn: 0, AvgSleepHours: null, AvgRecoveryScore: null
  };

  return {
    daysCheckedIn: row.DaysCheckedIn || 0,
    avgSleepHours: row.AvgSleepHours === null ? null : Number(row.AvgSleepHours.toFixed(1)),
    avgRecoveryScore: row.AvgRecoveryScore === null ? null : Number(row.AvgRecoveryScore.toFixed(1))
  };
}

module.exports = {
  getRecoveryForDate,
  upsertRecoveryForDate,
  getRecoverySummaryLast7Days
};

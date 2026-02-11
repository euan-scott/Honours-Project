const { getPool } = require("../models/db");

async function getTrainingLoads(userId) {
  const pool = await getPool();

  const acute = await pool.request()
    .input("UserId", userId)
    .query(`
      SELECT SUM(SessionLoad) AS Load
      FROM dbo.TrainingSessions
      WHERE UserId = @UserId
        AND SessionDate >= DATEADD(day, -7, CAST(GETUTCDATE() AS date))
    `);

  const chronic = await pool.request()
    .input("UserId", userId)
    .query(`
      SELECT SUM(SessionLoad) AS Load
      FROM dbo.TrainingSessions
      WHERE UserId = @UserId
        AND SessionDate >= DATEADD(day, -28, CAST(GETUTCDATE() AS date))
    `);

  const acuteLoad = acute.recordset[0].Load || 0;
  const chronicLoad = chronic.recordset[0].Load || 0;

  const acwr =
    chronicLoad > 0 ? (acuteLoad / (chronicLoad / 4)).toFixed(2) : null;

  return { acuteLoad, chronicLoad, acwr };
}

module.exports = { getTrainingLoads };

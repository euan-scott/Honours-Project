const { sql, getPool } = require("../db/sql");


// Get Data 
async function getTrainingSessionsByUser(userId) {
  const pool = await getPool();
  const result = await pool.request()
    .input("UserId", userId)
    .query(`
      SELECT SessionId, SessionDate, Type, DurationMin, RPE, SessionLoad, Notes
      FROM dbo.TrainingSessions
      WHERE UserId = @UserId
      ORDER BY SessionDate DESC, SessionId DESC
    `);

  return result.recordset;
}


//Add Data
async function createTrainingSession(userId, session) {
  const sessionLoad = Number(session.durationMin) * Number(session.rpe);

  const pool = await getPool();
  await pool.request()
    .input("UserId", userId)
    .input("SessionDate", session.date)
    .input("Type", session.type)
    .input("DurationMin", Number(session.durationMin))
    .input("RPE", Number(session.rpe))
    .input("SessionLoad", sessionLoad)
    .input("Notes", session.notes || null)
    .query(`
      INSERT INTO dbo.TrainingSessions
        (UserId, SessionDate, Type, DurationMin, RPE, SessionLoad, Notes)
      VALUES
        (@UserId, @SessionDate, @Type, @DurationMin, @RPE, @SessionLoad, @Notes)
    `);
}
1

//Get Data for Edit
async function getTrainingSessionById(userId, sessionId) {
  const pool = await getPool();

  const result = await pool.request()
    .input("userId", sql.Int, userId)
    .input("sessionId", sql.Int, sessionId)
    .query(`
      SELECT TOP 1
        SessionId,
        SessionDate,
        Type,
        DurationMin,
        RPE,
        SessionLoad,
        Notes
      FROM dbo.TrainingSessions
      WHERE UserId = @userId AND SessionId = @sessionId;
    `);

  return result.recordset[0] || null;
}


//Update Session
async function updateTrainingSession(userId, sessionId, data) {
  const pool = await getPool();

  await pool.request()
    .input("userId", sql.Int, userId)
    .input("sessionId", sql.Int, sessionId)
    .input("sessionDate", sql.Date, data.sessionDate)
    .input("type", sql.NVarChar(50), data.type)
    .input("durationMin", sql.Int, data.durationMin)
    .input("rpe", sql.Int, data.rpe)
    .input("sessionLoad", sql.Int, data.sessionLoad)
    .input("notes", sql.NVarChar(255), data.notes)
    .query(`
      UPDATE dbo.TrainingSessions
      SET
        SessionDate = @sessionDate,
        Type = @type,
        DurationMin = @durationMin,
        RPE = @rpe,
        SessionLoad = @sessionLoad,
        Notes = @notes
      WHERE UserId = @userId AND SessionId = @sessionId;
    `);
}


//Delete Session
async function deleteTrainingSession(userId, sessionId) {
  const pool = await getPool();

  await pool.request()
    .input("userId", sql.Int, userId)
    .input("sessionId", sql.Int, sessionId)
    .query(`
      DELETE FROM dbo.TrainingSessions
      WHERE UserId = @userId AND SessionId = @sessionId;
    `);
}


module.exports = { getTrainingSessionsByUser, createTrainingSession, getTrainingSessionById, updateTrainingSession, deleteTrainingSession };

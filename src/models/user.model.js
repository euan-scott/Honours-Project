const { sql, getPool } = require("../db/sql");
const bcrypt = require("bcrypt");

// CREATE USER 
async function createUser(email, password) {
  const passwordHash = await bcrypt.hash(password, 10);

  const pool = await getPool();
  await pool.request()
    .input("Email", email)
    .input("PasswordHash", passwordHash)
    .query(`
      INSERT INTO dbo.Users (Email, PasswordHash)
      VALUES (@Email, @PasswordHash)
    `);
}

// CHECK USER EXISTS
async function findUserByEmail(email) {
  const pool = await getPool();
  const result = await pool.request()
    .input("Email", email)
    .query(`
      SELECT *
      FROM dbo.Users
      WHERE Email = @Email
    `);

  return result.recordset[0];
}


// GET USER DATA
async function getUserById(userId) {
  const pool = await getPool();
  const result = await pool.request()
    .input("UserId", userId)
    .query(`
      SELECT UserId, Email, Sex, Age, HeightCm, WeightKg
      FROM dbo.Users
      WHERE UserId = @UserId
    `);

  return result.recordset[0];
}

// UPDATE USER 
async function updateUserProfile(userId, profile) {
  const pool = await getPool();

  await pool.request()
    .input("UserId", userId)
    .input("Sex", profile.sex || null)
    .input("Age", profile.age ? Number(profile.age) : null)
    .input("HeightCm", profile.heightCm ? Number(profile.heightCm) : null)
    .input("WeightKg", profile.weightKg ? Number(profile.weightKg) : null)
    .query(`
      UPDATE dbo.Users
      SET Sex=@Sex,
          Age=@Age,
          HeightCm=@HeightCm,
          WeightKg=@WeightKg,
          UpdatedAt=SYSUTCDATETIME()
      WHERE UserId=@UserId
    `);
}

// ONBOARDING
async function updateTrackingPrefs(userId, prefs) {
  const pool = await getPool();
  await pool.request()
    .input("UserId", userId)
    .input("WantsTrainingTracking", prefs.wantsTraining ? 1 : 0)
    .input("WantsNutritionTracking", prefs.wantsNutrition ? 1 : 0)
    .query(`
      UPDATE dbo.Users
      SET WantsTrainingTracking=@WantsTrainingTracking,
          WantsNutritionTracking=@WantsNutritionTracking,
          UpdatedAt=SYSUTCDATETIME()
      WHERE UserId=@UserId
    `);
}

async function updateUserPasswordHash(userId, passwordHash) {
  const pool = await getPool();

  await pool.request()
    .input("userId", sql.Int, userId)
    .input("passwordHash", sql.VarChar, passwordHash)
    .query(`
      UPDATE dbo.Users
      SET PasswordHash = @passwordHash
      WHERE UserId = @userId;
    `);
}



module.exports = {
  createUser,
  findUserByEmail,
  getUserById,
  updateUserProfile,
  updateTrackingPrefs,
  updateUserPasswordHash
};

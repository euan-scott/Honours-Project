const path = require("path");
require("dotenv").config({ path: path.resolve(process.cwd(), ".env") });

const express = require("express");
const app = express();
const session = require("express-session");
const { getUserById } = require("./src/models/user.model");

app.get("/", (req, res) => {
  if (req.session?.user) return res.redirect("/dashboard");
  return res.redirect("/login");
});

app.use(session({
  secret: "change-this-to-a-long-random-string",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true
  }
}));

// body parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// static files
app.use(express.static(path.join(__dirname, "public")));

// views
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src", "views"));

/*
// test route
app.get("/", (req, res) => {
  res.send("Honours Fitness App running ✅");
});
*/

// db
app.get("/db-test", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .query("SELECT DB_NAME() AS db, GETUTCDATE() AS nowUtc;");
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


//login and register 
const authController = require("./src/controllers/auth.controller");

app.get("/register", authController.showRegister);
app.post("/register", authController.register);

app.get("/login", authController.showLogin);
app.post("/login", authController.login);

app.get("/forgot-password", authController.showForgotPassword);
app.post("/forgot-password", authController.handleForgotPassword);

app.get("/reset-password", authController.showResetPassword);
app.post("/reset-password", authController.handleResetPassword);



//succesful login
const dashboardController = require("./src/controllers/dashboard.controller");

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

async function requireProfileComplete(req, res, next) {
  const user = await getUserById(req.session.user.id);

  const profileComplete =
    user.Sex && user.Age && user.HeightCm && user.WeightKg;

  if (!profileComplete) return res.redirect("/setup/profile");
  next();
}

app.get("/dashboard", requireAuth, requireProfileComplete, dashboardController.showDashboard);
app.get("/logout", authController.logout);


// training
//console.log("Training export route registered: /training/export");
const trainingController = require("./src/controllers/training.controller");

app.get("/training", requireAuth, trainingController.listTraining); // Show Data
app.get("/training/new", requireAuth, trainingController.showNewTraining); //Get Create Page
app.post("/training", requireAuth, trainingController.addTraining); //Add
app.get("/training/export", requireAuth, trainingController.exportTrainingCSV); //CSV Export


// nutrition
const nutritionController = require("./src/controllers/nutrition.controller");

  // Nutrition now uses the diary
app.get("/nutrition", requireAuth, (req, res) => res.redirect("/nutrition/diary"));

  // Kill the old “add nutrition” page
app.get("/nutrition/new", requireAuth, (req, res) => res.redirect("/nutrition/diary"));
app.post("/nutrition", requireAuth, (req, res) => res.status(410).send("Nutrition add form deprecated. Use diary."));

//app.get("/nutrition", requireAuth, nutritionController.listNutrition);
//app.get("/nutrition/new", requireAuth, nutritionController.showNutritionForm);
//app.post("/nutrition", requireAuth, nutritionController.saveNutrition);


// profile
const profileController = require("./src/controllers/profile.controller");

app.get("/profile", requireAuth, profileController.showProfile);
app.post("/profile", requireAuth, profileController.saveProfile);


// setup
const setupController = require("./src/controllers/setup.controller");

app.get("/setup/profile", requireAuth, setupController.showProfileSetup);
app.post("/setup/profile", requireAuth, setupController.saveProfileSetup);

app.get("/setup/today", requireAuth, setupController.showTodaySetup);
app.post("/setup/today", requireAuth, setupController.saveTodaySetup);

app.get("/setup/training-today", requireAuth, setupController.showTrainingToday);
app.post("/setup/training-today", requireAuth, setupController.saveTrainingToday);

app.get("/setup/nutrition-today", requireAuth, setupController.showNutritionToday);
app.post("/setup/nutrition-today", requireAuth, setupController.saveNutritionToday);


// nutrition
const nutritionRoutes = require("./src/routes/nutrition.routes");
app.use("/api/nutrition", nutritionRoutes);

const nutritionPageRoutes = require("./src/routes/nutrition.page.routes");
app.use("/", nutritionPageRoutes);


//recovery 
const recoveryController = require("./src/controllers/recovery.controller");

app.get("/recovery", requireAuth, recoveryController.showRecovery);
app.post("/recovery", requireAuth, recoveryController.saveRecovery);


// training update
app.get("/training/:id/edit", requireAuth, trainingController.showEditTraining);
app.post("/training/:id/edit", requireAuth, trainingController.handleEditTraining);

//training delete
app.post("/training/:id/delete", requireAuth, trainingController.deleteTraining);


//terminal stuff for app beginning to run
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running: http://localhost:${PORT}`);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Rejection:", reason);
});

const path = require("path");
require("dotenv").config({ path: path.resolve(process.cwd(), ".env") });

const express = require("express");
const session = require("express-session");

const app = express();

const { getUserById } = require("./src/models/user.model");


app.set("trust proxy", 1);

// body parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());


const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET && process.env.NODE_ENV === "production") {
  console.warn("⚠️  SESSION_SECRET is NOT set in production. Sessions will be insecure and may behave unpredictably.");
}

app.use(
  session({
    name: "honours.sid",
    secret: SESSION_SECRET || "dev-insecure-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // true on Cloud Run
      sameSite: "lax", // correct for same-origin EJS + API
      // maxAge: 1000 * 60 * 60 * 24 * 7, // optional: 7 days
    },
  })
);

// static files
app.use(express.static(path.join(__dirname, "public")));

// views
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src", "views"));

// Home
app.get("/", (req, res) => {
  if (req.session?.user) return res.redirect("/dashboard");
  return res.redirect("/login");
});


function requireAuth(req, res, next) {
  if (req.session?.user?.id) return next();


  if (req.originalUrl.startsWith("/api/")) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  return res.redirect("/login");
}


async function requireProfileComplete(req, res, next) {
  const user = await getUserById(req.session.user.id);

  const profileComplete = user.Sex && user.Age && user.HeightCm && user.WeightKg;
  if (!profileComplete) return res.redirect("/setup/profile");

  next();
}

/* -----------------------------
   DB test (make sure getPool is imported where defined)
------------------------------ */
app.get("/db-test", async (req, res) => {
  try {
    const { getPool } = require("./src/db");
    const pool = await getPool();
    const result = await pool.request().query("SELECT DB_NAME() AS db, GETUTCDATE() AS nowUtc;");
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------------
   Auth routes
------------------------------ */
const authController = require("./src/controllers/auth.controller");

app.get("/register", authController.showRegister);
app.post("/register", authController.register);

app.get("/login", authController.showLogin);
app.post("/login", authController.login);

app.get("/forgot-password", authController.showForgotPassword);
app.post("/forgot-password", authController.handleForgotPassword);

app.get("/reset-password", authController.showResetPassword);
app.post("/reset-password", authController.handleResetPassword);

app.get("/logout", authController.logout);

/* -----------------------------
   Dashboard
------------------------------ */
const dashboardController = require("./src/controllers/dashboard.controller");
app.get("/dashboard", requireAuth, requireProfileComplete, dashboardController.showDashboard);

/* -----------------------------
   Training
------------------------------ */
const trainingController = require("./src/controllers/training.controller");

app.get("/training", requireAuth, trainingController.listTraining);
app.get("/training/new", requireAuth, trainingController.showNewTraining);
app.post("/training", requireAuth, trainingController.addTraining);
app.get("/training/export", requireAuth, trainingController.exportTrainingCSV);

app.get("/training/:id/edit", requireAuth, trainingController.showEditTraining);
app.post("/training/:id/edit", requireAuth, trainingController.handleEditTraining);
app.post("/training/:id/delete", requireAuth, trainingController.deleteTraining);

/* -----------------------------
   Nutrition
------------------------------ */
app.get("/nutrition", requireAuth, (req, res) => res.redirect("/nutrition/diary"));
app.get("/nutrition/new", requireAuth, (req, res) => res.redirect("/nutrition/diary"));
app.post("/nutrition", requireAuth, (req, res) =>
  res.status(410).send("Nutrition add form deprecated. Use diary.")
);

// API routes
const nutritionRoutes = require("./src/routes/nutrition.routes");
app.use("/api/nutrition", nutritionRoutes);

// Page routes
const nutritionPageRoutes = require("./src/routes/nutrition.page.routes");
app.use("/", nutritionPageRoutes);

/* -----------------------------
   Profile
------------------------------ */
const profileController = require("./src/controllers/profile.controller");
app.get("/profile", requireAuth, profileController.showProfile);
app.post("/profile", requireAuth, profileController.saveProfile);

/* -----------------------------
   Setup
------------------------------ */
const setupController = require("./src/controllers/setup.controller");

app.get("/setup/profile", requireAuth, setupController.showProfileSetup);
app.post("/setup/profile", requireAuth, setupController.saveProfileSetup);

app.get("/setup/today", requireAuth, setupController.showTodaySetup);
app.post("/setup/today", requireAuth, setupController.saveTodaySetup);

app.get("/setup/training-today", requireAuth, setupController.showTrainingToday);
app.post("/setup/training-today", requireAuth, setupController.saveTrainingToday);

app.get("/setup/nutrition-today", requireAuth, setupController.showNutritionToday);
app.post("/setup/nutrition-today", requireAuth, setupController.saveNutritionToday);

/* -----------------------------
   Recovery
------------------------------ */
const recoveryController = require("./src/controllers/recovery.controller");
app.get("/recovery", requireAuth, recoveryController.showRecovery);
app.post("/recovery", requireAuth, recoveryController.saveRecovery);

/* -----------------------------
   Start server
------------------------------ */
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Rejection:", reason);
});
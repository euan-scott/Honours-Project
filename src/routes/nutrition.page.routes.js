const express = require("express");
const router = express.Router();
const { showNutritionLogs, exportNutritionCSV, showEditDiaryItem, handleEditDiaryItem } = require("../controllers/nutrition.controller");

//console.log("showNutritionLogs:", typeof showNutritionLogs, "exportNutritionCSV:", typeof exportNutritionCSV);

function requireAuth(req, res, next) {
  if (!req.session?.user?.id) return res.redirect("/login");
  next();
}

router.get("/nutrition/diary", requireAuth, (req, res) => {
  // console.log("✅ /nutrition/diary hit");
  res.render("nutrition/diary", {
    user: req.session.user,
    selectedDate: new Date().toISOString().slice(0, 10)
  });

});

router.get("/nutrition/logs", requireAuth, showNutritionLogs); //Food Logs
router.get("/nutrition/export", requireAuth, exportNutritionCSV); // Export CSV


//Edit
router.get("/nutrition/diary/item/:id/edit", requireAuth, showEditDiaryItem);
router.post("/nutrition/diary/item/:id/edit", requireAuth, handleEditDiaryItem);


module.exports = router;

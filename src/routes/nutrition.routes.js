const express = require("express");
const router = express.Router();

const { searchFoods, createFood } = require("../services/foods.service");
const { addDiaryFoodItem, addDiaryQuickItem, getDiaryForDate, deleteDiaryItem } = require("../services/nutrition.service");

// Simple auth guard (match your existing session approach)
function requireAuth(req, res, next) {
  if (!req.session?.user?.id) return res.status(401).json({ error: "Not authenticated" });
  next();
}

router.get("/foods", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const q = req.query.query || "";
    const foods = await searchFoods(userId, q, 30);
    res.json({ foods });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/foods", async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = req.session.user.id;
    const {
      name,
      brand,
      caloriesPer100g,
      proteinPer100g,
      carbsPer100g,
      fatPer100g
    } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: "Food name is required." });
    }

    const cal = Number(caloriesPer100g);
    const p   = Number(proteinPer100g);
    const c   = Number(carbsPer100g);
    const f   = Number(fatPer100g);

    if (![cal, p, c, f].every(n => Number.isFinite(n) && n >= 0)) {
      return res.status(400).json({ error: "Macros per 100g must be numbers ≥ 0." });
    }

    const created = await createFood(userId, {
      name,
      brand: brand || null,
      caloriesPer100g: cal,
      proteinPer100g: p,
      carbsPer100g: c,
      fatPer100g: f
    });

    res.status(201).json({ food: created });
  } catch (err) {
    console.error("Create food error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/diary", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const date = req.query.date || new Date().toISOString().slice(0, 10);

    const diary = await getDiaryForDate(userId, date);
    res.json({ ...diary, selectedDate: date });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.post("/diary/items", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { date, mealType, foodId, grams, notes } = req.body;

    if (!date || !mealType || !foodId || grams == null) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const created = await addDiaryFoodItem(userId, {
      date,
      mealType: Number(mealType),
      foodId: Number(foodId),
      grams: Number(grams),
      notes: notes || null
    });

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/*
router.post("/diary/quick-add", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { date, mealType, calories, protein, carbs, fat, notes } = req.body;

    if (!date || !mealType || calories == null) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const created = await addDiaryQuickItem(userId, {
      date,
      mealType: Number(mealType),
      calories: Number(calories),
      protein: protein == null ? null : Number(protein),
      carbs: carbs == null ? null : Number(carbs),
      fat: fat == null ? null : Number(fat),
      notes: notes || null
    });

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
*/

router.delete("/diary/items/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid id" });

    await deleteDiaryItem(userId, id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// console.log("Nutrition routes loaded: /, /logs, /diary, /foods");
module.exports = router;


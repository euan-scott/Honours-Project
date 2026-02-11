const bcrypt = require("bcrypt");
const {
  createUser,
  findUserByEmail,
  updateUserPasswordHash
} = require("../models/user.model");

// REGISTER
async function showRegister(req, res) {
  res.render("register", { error: null });
}


// Register
async function register(req, res) {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password || "";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Empty fields
    if (!email || !password) {
      return res.status(400).render("register", {
        error: "Please enter an email and password."
      });
    }

    // Email format
    if (!emailRegex.test(email)) {
      return res.status(400).render("register", {
        error: "Please enter a valid email address."
      });
    }

    // Password strength (minimal but sensible)
    if (password.length < 8) {
      return res.status(400).render("register", {
        error: "Password must be at least 8 characters."
      });
    }

    // Duplicate check
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).render("register", {
        error: "An account with that email already exists. Please log in."
      });
    }

    // Create account
    await createUser(email, password);

    const user = await findUserByEmail(email);

    req.session.user = { id: user.UserId, email: user.Email };
    req.session.onboarding = { profile: false, training: false, nutrition: false };

    return res.redirect("/setup/profile");

  } catch (err) {
    console.error(err);

    return res.status(500).render("register", {
      error: "Something went wrong. Please try again."
    });
  }
}



// Login
async function showLogin(req, res) {
  const message = req.query.reset ? "Password updated. Please log in." : null;
  res.render("login", { error: null, message });
}

async function login(req, res) {
  const email = (req.body.email || "").trim();
  const password = req.body.password || "";

  const genericError = "Invalid email or password";

  if (!email || !password) {
    return res
      .status(400)
      .render("login", { error: "Please enter your email and password.", message: null });
  }

  try {
    const user = await findUserByEmail(email);

    // Don’t reveal whether the user exists
    if (!user) {
      return res.status(401).render("login", { error: genericError, message: null });
    }

    const valid = await bcrypt.compare(password, user.PasswordHash);

    if (!valid) {
      return res.status(401).render("login", { error: genericError, message: null });
    }

    req.session.user = { id: user.UserId, email: user.Email };
    return res.redirect("/dashboard");
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .render("login", { error: "Something went wrong. Please try again.", message: null });
  }
}

// Log Out
function logout(req, res) {
  req.session.destroy(() => {
    res.redirect("/login");
  });
}

// Forgot Password
async function showForgotPassword(req, res) {
  res.render("forgot-password", { error: null });
}

async function handleForgotPassword(req, res) {
  const email = (req.body.email || "").trim();

  if (!email) {
    return res.status(400).render("forgot-password", {
      error: "Please enter your email."
    });
  }

  try {
    const user = await findUserByEmail(email);

    // If user exists, set a short-lived session flag
    if (user) {
      req.session.pwReset = {
        userId: user.UserId,
        createdAt: Date.now()
      };
    }

    // Always redirect the same way (avoid leaking whether email exists)
    return res.redirect("/reset-password?sent=1");
  } catch (err) {
    console.error(err);
    return res.status(500).render("forgot-password", {
      error: "Something went wrong. Please try again."
    });
  }
}

function showResetPassword(req, res) {
  const reset = req.session.pwReset;

  // Expire after 15 minutes
  const maxAgeMs = 15 * 60 * 1000;
  const expired = !reset || (Date.now() - reset.createdAt > maxAgeMs);

  if (expired) {
    return res.redirect("/forgot-password");
  }

  const message = req.query.sent ? "Enter a new password below." : null;
  res.render("reset-password", { error: null, message });
}

async function handleResetPassword(req, res) {
  const reset = req.session.pwReset;

  const maxAgeMs = 15 * 60 * 1000;
  const expired = !reset || (Date.now() - reset.createdAt > maxAgeMs);

  if (expired) {
    return res.redirect("/forgot-password");
  }

  const password = req.body.password || "";
  const confirm = req.body.confirm || "";

  if (!password || password.length < 8) {
    return res.status(400).render("reset-password", {
      error: "Password must be at least 8 characters.",
      message: null
    });
  }

  if (password !== confirm) {
    return res.status(400).render("reset-password", {
      error: "Passwords do not match.",
      message: null
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    await updateUserPasswordHash(reset.userId, passwordHash);

    // Clear reset session flag
    req.session.pwReset = null;

    return res.redirect("/login?reset=1");
  } catch (err) {
    console.error(err);
    return res.status(500).render("reset-password", {
      error: "Something went wrong. Please try again.",
      message: null
    });
  }
}

module.exports = {
  showRegister,
  register,
  showLogin,
  login,
  logout,
  showForgotPassword,
  handleForgotPassword,
  showResetPassword,
  handleResetPassword
};

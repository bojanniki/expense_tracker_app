// This MUST be the very first line to load environment variables
require("dotenv").config();

// All other required modules
const express = require("express");
const path = require("path");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcrypt");
const { Pool } = require("pg");

// 1. Database Connection Pool
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
});

// 2. Session Store Configuration
const sessionStore = new pgSession({
  pool: pool,
  tableName: "session",
});

// 3. Express App Initialization
const app = express();
const port = process.env.PORT || 3000;

// Correct Middleware Order
// 1. Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// 2. Parse JSON bodies of incoming requests
app.use(express.json());

// 3. Configure and use express-session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 },
  })
);

// ALL API routes must be defined after the middleware above

// Route for user registration
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  const saltRounds = 10;
  try {
    const userCheck = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );
    if (userCheck.rows.length > 0) {
      return res.status(409).send("Username already exists");
    }
    const passwordHash = await bcrypt.hash(password, saltRounds);
    await pool.query(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2)",
      [username, passwordHash]
    );
    res.status(201).send("User registered successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

//user login route
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await pool.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);
    if (user.rows.length === 0) {
      return res.status(401).send("Invalid credentials");
    }
    const storedUser = user.rows[0];
    const isMatch = await bcrypt.compare(password, storedUser.password_hash);
    if (!isMatch) {
      return res.status(401).send("Invalid credentials");
    }
    req.session.userId = storedUser.id;
    res
      .status(200)
      .json({ message: "Login succesful!", userId: storedUser.id });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

//Protected route to get the user's profile
app.get("/api/profile", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send("Unauthorized");
  }
  try {
    const user = await pool.query("SELECT username FROM users WHERE id = $1", [
      req.session.userId,
    ]);
    if (user.rows.length === 0) {
      return res.status(404).send("User not found");
    }
    res.status(200).json({
      username: user.rows[0].username,
      message: "You are logged in!",
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

//route for user logout
app.post("/api/logout", (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).send("Could not log out");
      }
      res.status(200).send("Logged out successfully");
    });
  } else {
    res.status(200).send("No session to destroy");
  }
});

// Account API routes
app.get("/api/accounts", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send("Unauthorized");
  }
  try {
    const accountsResult = await pool.query(
      "SELECT * FROM accounts WHERE user_id = $1 ORDER BY account_name ASC",
      [req.session.userId]
    );
    const accounts = accountsResult.rows.map((account) => ({
      ...account,
      balance: parseFloat(account.balance),
    }));
    res.status(200).json(accounts);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

//POST route to create a new account
app.post("/api/accounts", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send("Unauthorized");
  }
  const { account_name, balance } = req.body;
  if (!account_name) {
    return res.status(400).send("Account name is required.");
  }
  const numericBalance = parseFloat(balance);
  if (isNaN(numericBalance)) {
    return res.status(400).send("Initial balance must be a valid number.");
  }
  try {
    await pool.query(
      "INSERT INTO accounts (user_id, account_name, balance) VALUES ($1, $2, $3)",
      [req.session.userId, account_name, numericBalance]
    );
    res.status(201).send("Account created successfully!");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// --- Category API routes --- //
app.post("/api/categories", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send("Unauthorized");
  }
  const { name } = req.body;
  if (!name) {
    return res.status(400).send("Category name is required");
  }
  try {
    const newCategory = await pool.query(
      "INSERT INTO categories (user_id, name) VALUES ($1, $2) ON CONFLICT (user_id, name) DO NOTHING RETURNING *",
      [req.session.userId, name]
    );
    if (newCategory.rows.length === 0) {
      return res.status(409).send("Category already exists.");
    }
    res.status(201).json(newCategory.rows[0]);
  } catch (err) {
    console.error("Error creating category:", err);
    res.status(500).send("Server error");
  }
});

app.get("/api/categories", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send("Unauthorized");
  }
  try {
    const categories = await pool.query(
      "SELECT * FROM categories WHERE user_id = $1 ORDER BY name ASC",
      [req.session.userId]
    );
    res.status(200).json(categories.rows);
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).send("Server error");
  }
});

// --- Expense API routes --- //
app.get("/api/expenses", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send("Unauthorized");
  }
  try {
    const { category, month } = req.query;
    let query = `
      SELECT
        id, user_id, account_id, category_id, description, amount, date, transaction_type, created_at
      FROM expenses
      WHERE user_id = $1
    `;
    const queryParams = [req.session.userId];
    if (category) {
      query += " AND category_id = $2";
      queryParams.push(category);
    }
    if (month) {
      query += ` AND TO_CHAR(date, 'YYYY-MM') = $${queryParams.length + 1}`;
      queryParams.push(month);
    }
    query += " ORDER BY date DESC";
    const expenseResult = await pool.query(query, queryParams);
    const expenses = expenseResult.rows.map((expense) => ({
      ...expense,
      amount: parseFloat(expense.amount),
    }));
    res.status(200).json(expenses);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

app.post("/api/expenses", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send("Unauthorized");
  }
  const { description, amount, date, account_id, type, category_id } = req.body;
  if (
    !description ||
    !amount ||
    !date ||
    !account_id ||
    !type ||
    !category_id
  ) {
    return res.status(400).send("All transaction fields are required");
  }
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount)) {
    return res.status(400).send("Amount must be a valid number");
  }
  const sign = type === "income" ? 1 : -1;
  const finalAmount = numericAmount * sign;
  try {
    await pool.query("BEGIN");
    const newExpense = await pool.query(
      "INSERT INTO expenses (user_id, account_id, category_id, description, amount, date, transaction_type) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [
        req.session.userId,
        account_id,
        category_id,
        description,
        numericAmount,
        date,
        type,
      ]
    );
    await pool.query(
      "UPDATE accounts SET balance = balance + $1 WHERE id = $2 AND user_id = $3",
      [finalAmount, account_id, req.session.userId]
    );
    await pool.query("COMMIT");
    res.status(201).json(newExpense.rows[0]);
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Error creating transaction:", err);
    res.status(500).send("Server error");
  }
});

app.delete("/api/expenses/:id", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send("Unauthorized");
  }
  const expenseId = req.params.id;
  try {
    await pool.query("BEGIN");
    const expenseToDelete = await pool.query(
      "SELECT amount, account_id, transaction_type FROM expenses WHERE id = $1 AND user_id = $2",
      [expenseId, req.session.userId]
    );
    if (expenseToDelete.rows.length === 0) {
      await pool.query("ROLLBACK");
      return res.status(404).send("Transaction not found or unauthorized");
    }
    const { amount, account_id, transaction_type } = expenseToDelete.rows[0];
    const sign = transaction_type === "income" ? -1 : 1;
    const finalAmount = amount * sign;
    await pool.query("DELETE FROM expenses WHERE id=$1", [expenseId]);
    await pool.query(
      "UPDATE accounts SET balance = balance + $1 WHERE id = $2",
      [finalAmount, account_id]
    );
    await pool.query("COMMIT");
    res
      .status(200)
      .send("Transaction deleted and account balance updated successfully");
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error(err);
    res.status(500).send("Server error");
  }
});

app.put("/api/expenses/:id", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send("Unauthorized");
  }
  const expenseId = req.params.id;
  const { account_id, description, amount, date, type } = req.body;
  if (!account_id || !description || !amount || !date || !type) {
    return res.status(400).send("All transaction fields are required");
  }
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount)) {
    return res.status(400).send("Amount must be a valid number.");
  }
  try {
    await pool.query("BEGIN");
    const oldExpense = await pool.query(
      "SELECT amount, account_id, transaction_type FROM expenses WHERE id = $1 AND user_id = $2",
      [expenseId, req.session.userId]
    );
    if (oldExpense.rows.length === 0) {
      await pool.query("ROLLBACK");
      return res.status(404).send("Transaction not found or unauthorized");
    }
    const {
      amount: oldAmount,
      account_id: oldAccountId,
      transaction_type: oldType,
    } = oldExpense.rows[0];
    const oldSign = oldType === "income" ? -1 : 1;
    const oldFinalAmount = oldAmount * oldSign;
    await pool.query(
      "UPDATE accounts SET balance = balance + $1 WHERE id = $2",
      [oldFinalAmount, oldAccountId]
    );
    const result = await pool.query(
      "UPDATE expenses SET account_id = $1, description = $2, amount = $3, date = $4, transaction_type = $5 WHERE id = $6 AND user_id=$7 RETURNING*",
      [
        account_id,
        description,
        numericAmount,
        date,
        type,
        expenseId,
        req.session.userId,
      ]
    );
    const newSign = type === "income" ? 1 : -1;
    const newFinalAmount = numericAmount * newSign;
    await pool.query(
      "UPDATE accounts SET balance = balance + $1 WHERE id = $2",
      [newFinalAmount, account_id]
    );
    await pool.query("COMMIT");
    if (result.rows.length === 0) {
      await pool.query("ROLLBACK");
      return res.status(404).send("Transaction not found or unauthorized");
    }
    res.status(200).send("Transaction updated and account balance adjusted");
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error(err);
    res.status(500).send("Server error");
  }
});

// The catch-all route MUST be last
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

//Server Start
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log("Press Ctrl+C to stop");
});

const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);

//Load enviroment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// PostgreSQL Pool setup
const pool = new Pool({
  user: process.env.DB_USER || "your_db_app_user", // IMPORTANT: Create a dedicated app user for security!
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "expense_tracker_app", // Use the dynamically created database name
  password: process.env.DB_PASSWORD || "your_db_app_password",
  port: process.env.DB_PORT || 5432,
});

//create a session store using connect-pg-simple
const sessionStore = new pgSession({
  pool: pool,
  tableName: "session",
});

// Test DB connection (optional, good for initial setup)
pool.connect((err, client, release) => {
  if (err) {
    return console.error("Error acquiring client", err.stack);
  }
  client.query("SELECT NOW()", (err, result) => {
    release();
    if (err) {
      return console.error("Error executing query", err.stack);
    }
    console.log("Database connected:", result.rows[0].now);
  });
});

//Middleware setup

//Middleware to parse JSON bodies
app.use(express.json());

//configure and use express-session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET, // A secret key for signing the session ID cookie
    store: sessionStore, //use the postgresql session store
    resave: false, //don't save session if unmodified
    saveUninitialized: false, //don't create session until something is stored
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }, //30 days
  })
);

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

//API routes

// Route for user registration
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  const saltRounds = 10; //cost factor for hashing
  try {
    //check if the user name already exists
    const userCheck = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );
    if (userCheck.rows.length > 0) {
      return res.status(409).send("Username already exists");
    }
    //password hashing
    const passwordHash = await bcrypt.hash(password, saltRounds);

    //inserting new user into the database
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
    //find the user by username
    const user = await pool.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);

    //check if user exists
    if (user.rows.length === 0) {
      return res.status(401).send("Invalid credentials");
    }
    const storedUser = user.rows[0];

    //compare the provided password with the stored hash
    const isMatch = await bcrypt.compare(password, storedUser.password_hash);

    if (!isMatch) {
      return res.status(401).send("Invalid credentials");
    }
    //login successful. Save the user's ID in the session
    req.session.userId = storedUser.id;
    res
      .status(200)
      .json({ message: "Login succesful!", userId: storedUser.id });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

//Protected route to het the user's profile
app.get("/api/profile", async (req, res) => {
  //check if the user is authenticated (if a userId exists in the session)
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
  //check if the session exists and destroy it
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

//GET route to fetch all accounts for the logged-in user

app.get("/api/accounts", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send("Unauthorized");
  }

  try {
    const accountsResult = await pool.query(
      "SELECT * FROM accounts WHERE user_id = $1 ORDER BY account_name ASC",
      [req.session.userId]
    );

    // Convert balance from string to a number for frontend consumption
    const accounts = accountsResult.rows.map((account) => {
      return {
        ...account,
        balance: parseFloat(account.balance),
      };
    });

    res.status(200).json(accounts);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// --- Expense API routes --- //

//GET route to fetch all expenses for the logged-in user

app.get("/api/expenses", async (req, res) => {
  //check if the user is authenticated
  if (!req.session.userId) {
    return res.status(401).send("Unauthorized");
  }
  try {
    //query to get all expenses from the user, ordered by date
    const expensesResult = await pool.query(
      "SELECT * FROM expenses WHERE user_id = $1 ORDER BY date DESC",
      [req.session.userId]
    );
    //convert amount from string to a number for frontend
    const expenses = expensesResult.rows.map((expense) => {
      return {
        ...expense,
        amount: parseFloat(expense.amount),
      };
    });
    res.status(200).json(expenses);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// POST route to create a new expense
app.post("/api/expenses", async (req, res) => {
  // Check if the user is authenticated
  if (!req.session.userId) {
    return res.status(401).send("Unauthorized");
  }

  const { description, amount, date, account_id } = req.body; // Validate input

  if (!description || !amount || !date || !account_id) {
    return res.status(400).send("All expense fields are required.");
  }

  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount)) {
    return res.status(400).send("Amount must be a valid number.");
  }

  try {
    // Start a transaction
    await pool.query("BEGIN"); // Insert the new expense

    const newExpense = await pool.query(
      "INSERT INTO expenses (user_id, account_id, description, amount, date) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [req.session.userId, account_id, description, numericAmount, date]
    ); // Update the account balance by subtracting the expense amount

    await pool.query(
      "UPDATE accounts SET balance = balance - $1 WHERE id = $2 AND user_id = $3",
      [numericAmount, account_id, req.session.userId]
    ); // End the transaction

    await pool.query("COMMIT");

    res.status(201).json(newExpense.rows[0]);
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Error creating expense:", err);
    res.status(500).send("Server error");
  }
});

// POST route to create a new account
app.post("/api/accounts", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send("Unauthorized");
  }
  const { account_name, balance } = req.body;

  // Validate the inputs
  if (!account_name) {
    return res.status(400).send("Account name is required.");
  }

  // This is the crucial fix: Ensure balance is a valid number
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

//DELETE route to delete a specific expense
app.delete("/api/expenses/:id", async (req, res) => {
  //check if the user is authenticated
  if (!req.session.userId) {
    return res.status(401).send("Unauthorized");
  }

  const expenseId = req.params.id;
  try {
    //first, get the expense, update the account balance
    const expenseToDelete = await pool.query(
      "SELECT amount, account_id FROM expenses WHERE id = $1 AND user_id = $2",
      [expenseId, req.session.userId]
    );
    if (expenseToDelete.rows.length === 0) {
      return res.status(404).send("Expense not found or unauthorized");
    }
    const { amount, account_id } = expenseToDelete.rows[0];
    await pool.query("DELETE FROM EXPENSES WHERE id=$1", [expenseId]);
    //add the amount back to the account balance
    await pool.query(
      "UPDATE accounts SET balance = balance + $1 WHERE id = $2",
      [amount, account_id]
    );
    res
      .status(200)
      .send("Expense deleted and account balance updated successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

//PUT route to update a specific expense
app.put("/api/expenses/:id", async (req, res) => {
  //Check if the user is authenticated
  if (!req.session.userId) {
    return res.status(401).send("Unauthorized");
  }
  const expenseId = req.params.id;
  const { account_id, description, amount, date } = req.body;

  //basic validation
  if (!account_id || !description || !amount || !date) {
    return res.status(400).send("All expense fields are required");
  }
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount)) {
    return res.status(400).send("Amount must be a valid number.");
  }
  try {
    //1. get the old expense data to adjust the balance correctly
    const oldExpense = await pool.query(
      "SELECT amount, account_id FROM expenses WHERE id= $1 AND user_id = $2",
      [expenseId, req.session.userId]
    );
    if (oldExpense.rows.length === 0) {
      return res.status(404).send("Expense not found or unauthorized");
    }
    const { amount: oldAmount, account_id: oldAccountId } = oldExpense.rows[0];
    //2. Adjust the balance of the old account by adding the old amount back.
    await pool.query(
      "UPDATE accounts SET balance = balance + $1 WHERE id = $2",
      [oldAmount, oldAccountId]
    );
    //3. Update the expense with the new data.
    const result = await pool.query(
      "UPDATE expenses SET account_id = $1, description = $2, amount = $3, date = $4 WHERE id = $5 AND user_id=$6 RETURNING *",
      [
        account_id,
        description,
        numericAmount,
        date,
        expenseId,
        req.session.userId,
      ]
    );
    //4. Subtract the new ammount from the new account's balance.
    await pool.query(
      "UPDATE accounts SET balance = balance - $1 WHERE id = $2",
      [numericAmount, account_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).send("Expense not found or unauthorized.");
    }
    res.status(200).send("Expense updated and account balance adjusted!");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Catch-all to serve index.html for any other routes (SPA-like behavior)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

//Server Start
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log("Press Ctrl+C to stop");
});

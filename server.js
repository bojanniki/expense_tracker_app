const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config(); // Load environment variables from .env file
const bcrypt = require("bcrypt");

//Middleware to parse JSON bodies
app.use(express.json());

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

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// Catch-all to serve index.html for any other routes (SPA-like behavior)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

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

app.post("api/login", async (req, res) => {
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
    //login successful
    res.status(200).send("Login successful!");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log("Press Ctrl+C to stop");
});

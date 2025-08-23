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

// Catch-all to serve index.html for any other routes (SPA-like behavior)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

//Server Start
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log("Press Ctrl+C to stop");
});

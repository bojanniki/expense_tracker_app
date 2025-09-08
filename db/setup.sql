-- db/setup.sql

-- users table setup
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
);  -- FIX 1: Add a semicolon

CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id),
    account_name VARCHAR(255) NOT NULL,
    balance DECIMAL(10, 2) DEFAULT 0.00
);

-- expenses table setup
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- FIX 2: Change "account id" to "account_id" to remove the space
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);  -- FIX 1: Add a semicolon

-- For express-session with connect-pg-simple
CREATE TABLE "session" (
    "sid" varchar NOT NULL COLLATE "default",
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);  -- FIX 1: Add a semicolon (it was missing in your original code)
ALTER TABLE "session" ADD CONSTRAINT "session_ok" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE; -- FIX 1: Add a semicolon
CREATE INDEX "IDX_session_expire" ON "session" ("expire"); -- FIX 1: Add a semicolon
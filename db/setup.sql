-- db/setup.sql

-- users table setup
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
);  -- FIX 1: Add a semicolon

-- accounts table setup
CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name TEXT not null
);  -- FIX 1: Add a semicolon

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
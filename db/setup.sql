-- db/setup.sql
-- This script will create a sample table in your PostgreSQL database.
-- It is designed to be run against the database 'expense_tracker_app'.

CREATE TABLE IF NOT EXISTS sample_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Optional: Insert some sample data
-- INSERT INTO sample_items (name, description) VALUES ('First Item', 'This is the description for the first item.');
-- INSERT INTO sample_items (name, description) VALUES ('Second Item', 'Another sample item.');

const express = require('express');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config(); // Load environment variables from .env file

const app = express();
const port = process.env.PORT || 3000;

// PostgreSQL Pool setup
const pool = new Pool({
    user: process.env.DB_USER || 'your_db_app_user', // IMPORTANT: Create a dedicated app user for security!
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'expense_tracker_app', // Use the dynamically created database name
    password: process.env.DB_PASSWORD || 'your_db_app_password',
    port: process.env.DB_PORT || 5432,
});

// Test DB connection (optional, good for initial setup)
pool.connect((err, client, release) => {
    if (err) {
        return console.error('Error acquiring client', err.stack);
    }
    client.query('SELECT NOW()', (err, result) => {
        release();
        if (err) {
            return console.error('Error executing query', err.stack);
        }
        console.log('Database connected:', result.rows[0].now);
    });
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Basic API route example
app.get('/api/data', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM sample_items LIMIT 10'); // Example query
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).send('Server Error');
    }
});

// Catch-all to serve index.html for any other routes (SPA-like behavior)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log('Press Ctrl+C to stop');
});
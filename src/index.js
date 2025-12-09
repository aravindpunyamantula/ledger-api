require('dotenv').config();
const app = require('./app');
const db = require('./db');

const PORT = process.env.PORT || 3000;

async function waitForDB(maxRetries = 20, delay = 2000) {
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      const conn = await db.getConnection();
      await conn.ping();
      conn.release();
      console.log("Connected to MYSQL DB");
      return;
    } catch (err) {
      attempts++;
      console.log(`DB not ready... retrying (${attempts}/${maxRetries})`);
      await new Promise(res => setTimeout(res, delay));
    }
  }

  throw new Error("Database failed to connect after multiple attempts");
}

async function start() {
  try {
    await waitForDB(); 

    app.listen(PORT, () => {
      console.log("Server running on port", PORT);
    });

  } catch (e) {
    console.error("Failed to start server. DB Connection Error:", e.message);
    process.exit(1);
  }
}

start();
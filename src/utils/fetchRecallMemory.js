const { pool } = require("../db");

async function fetchRecallMemory(userId) {
  try {
    const query =
      "SELECT * FROM Messages WHERE user_id = $1 ORDER BY time DESC LIMIT 10";
    const result = await pool.query(query, [userId]);

    // Structure the data in JSON format
    const messages = result.rows.map((row) => ({
      message: {
        role: row.role,
        content: row.content,
      },
      time: row.time,
    }));

    return messages;
  } catch (error) {
    console.error("Error fetching messages:", error);
    throw error;
  }
}

module.exports = fetchRecallMemory;

const { pool } = require("./db");

// Function to process and store the data
async function processAndStoreData(jsonData) {
  for (let item of jsonData) {
    if (
      item.message &&
      item.message.role &&
      item.message.content &&
      item.message.role !== "tool" &&
      !item.message.tool_calls &&
      item.time
    ) {
      // Insert the data into the database
      await insertIntoDatabase(item);
    }
  }
}

// Function to insert data into the database
async function insertIntoDatabase(item) {
  try {
    const queryText =
      "INSERT INTO messages(user_id, role, content, time) VALUES($1, $2, $3, $4)";
    const values = [userId, item.message.role, item.message.content, item.time];
    await pool.query(queryText, values);
  } catch (err) {
    console.error("Error executing query", err.stack);
  }
}

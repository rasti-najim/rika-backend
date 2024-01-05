const fs = require("fs").promises;
const { pool } = require("../db");

async function loadMessages(userId) {
  try {
    const result = await pool.query(
      "SELECT * FROM messages WHERE user_id = $1 ORDER BY time DESC LIMIT 10",
      [userId]
    );
    console.log("messages from the database", result.rows);

    // Transform each row to the new format
    const transformedMessages = result.rows.map((row) => {
      return {
        role: row.role, // Set the appropriate value for 'role'
        content: row.content, // Assuming 'content' is a field in your table
      };
    });

    return transformedMessages;
  } catch (error) {
    console.error("Error loading messages:", error);
    return []; // Return an empty array in case of an error
  }
}

// async function loadMessages(filePath) {
//   try {
//     // Read the file asynchronously
//     const data = await fs.readFile(filePath, "utf8");

//     // If the file is empty, return an empty array
//     if (!data.trim()) {
//       return [];
//     }

//     // Parse the JSON data and return it as an array
//     return JSON.parse(data);
//   } catch (err) {
//     console.error("Error reading file:", err);
//     return []; // Return an empty array in case of an error
//   }
// }

module.exports = loadMessages;

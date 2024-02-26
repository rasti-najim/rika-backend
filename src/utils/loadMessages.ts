import { pool } from "../db";
const debug = require("debug")("app:load_messages");

type DatabaseMessage = {
  message_id: string;
  user_id: string;
  role: string;
  content: string;
  time: Date;
};

type TransformedMessage = {
  role: string;
  content: string;
};

/**
 * Load messages from the database
 * @param {string} userId - The user ID
 * @returns {Promise<TransformedMessage[]>} - The messages
 */
async function loadMessages(userId: string): Promise<TransformedMessage[]> {
  debug("loading messages for user", userId);
  try {
    const result = await pool.query(
      "SELECT * FROM messages WHERE user_id = $1 ORDER BY time DESC LIMIT 10",
      [userId]
    );
    debug("messages from the database", result.rows);

    // Transform each row to the new format
    const transformedMessages: TransformedMessage[] = result.rows.map(
      (row: DatabaseMessage) => {
        return {
          role: row.role, // Set the appropriate value for 'role'
          content: row.content, // Assuming 'content' is a field in your table
        };
      }
    );

    return Promise.resolve(transformedMessages);
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

export default loadMessages;

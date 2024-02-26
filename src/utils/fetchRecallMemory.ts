import { pool } from "../db";

type DatabaseMessage = {
  message_id: string;
  user_id: string;
  role: string;
  content: string;
  time: Date;
};

type RecallMessages = {
  message: {
    role: string;
    content: string;
  };
  time: Date;
};

/**
 *
 * @param {string} userId - The user ID
 * @returns {Promise<RecallMessages[]>} - The messages
 */
async function fetchRecallMemory(userId: string): Promise<RecallMessages[]> {
  try {
    const query =
      "SELECT * FROM Messages WHERE user_id = $1 ORDER BY time DESC LIMIT 10";
    const result = await pool.query(query, [userId]);

    // Structure the data in JSON format
    const messages = result.rows.map((row: DatabaseMessage) => ({
      message: {
        role: row.role,
        content: row.content,
      },
      time: row.time,
    }));

    return Promise.resolve(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    throw error;
  }
}

export default fetchRecallMemory;

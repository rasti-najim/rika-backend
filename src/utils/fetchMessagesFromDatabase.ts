import { pool } from "../db";

async function fetchMessagesFromDatabase(
  page: number,
  limit: number,
  userId: string
) {
  // Calculate the starting point
  const startIndex = (page - 1) * limit;

  const query = {
    text: "SELECT * FROM messages WHERE user_id = $1 ORDER BY time DESC LIMIT $2 OFFSET $3",
    values: [userId, limit, startIndex],
  };

  try {
    const res = await pool.query(query);
    return res.rows;
  } catch (err) {
    console.error("Error fetching messages:", err);
    throw err;
  }
}

export default fetchMessagesFromDatabase;

import { pool, prisma } from "../db";

async function fetchMessagesFromDatabase(
  page: number,
  limit: number,
  userId: string
) {
  // Calculate the starting point
  const startIndex = (page - 1) * limit;

  // const query = {
  //   text: "SELECT * FROM messages WHERE user_id = $1 ORDER BY time DESC LIMIT $2 OFFSET $3",
  //   values: [userId, limit, startIndex],
  // };

  try {
    // const res = await pool.query(query);
    const messages = await prisma.messages.findMany({
      where: {
        user_id: userId,
      },
      orderBy: {
        created_at: "desc",
      },
      take: limit,
      skip: startIndex,
    });
    // return res.rows;
    return messages;
  } catch (err) {
    console.error("Error fetching messages:", err);
    throw err;
  }
}

export default fetchMessagesFromDatabase;

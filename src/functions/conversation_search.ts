const debug = require("debug")("bot-express:core-memory");
import { pool, prisma } from "../db";

type DatabaseMessage = {
  id: string;
  user_id: string;
  role: string;
  message: string;
  created_at: Date;
};

/**
 * Performs a text search in message logs.
 *
 * @param {string} userId - The user ID to search for.
 * @param {string} queryString - The query string to search for.
 * @param {number|null} [count=null] - The number of results to return.
 * @param {number|null} [start=null] - The starting index for paging through results.
 * @returns {Promise<[DatabaseMessage[], number]>} - The results of the search along with the total number of results.
 */
async function textSearch(
  userId: string,
  queryString: string,
  count: number | null = null,
  start: number | null = null
): Promise<[DatabaseMessage[], number]> {
  // Assuming _messageLogs is an array of message log objects.
  // const _messageLogs = JSON.parse(fs.readFileSync(messagesFile, "utf8")); // Replace with actual message logs.
  // const _messageLogs = await loadMessages(userId);
  // debug(_messageLogs);
  // const result = await pool.query("SELECT * FROM messages WHERE user_id = $1", [
  //   userId,
  // ]);

  const _messageLogs = await prisma.messages.findMany({
    where: {
      user_id: userId,
    },
  });

  // const _messageLogs: DatabaseMessage[] = result.rows;
  debug(_messageLogs);

  // Filter out messages with roles "system" and "function".
  // const messagePool = _messageLogs.filter(
  //   (d) => d.message.role !== "system" && d.message.role !== "tool"
  // );

  console.log(
    `textSearch: searching for ${queryString} (c=${count}, s=${start}) in ${_messageLogs.length} total messages`
  );

  // Perform case-insensitive search.
  const matches = _messageLogs.filter(
    (d) =>
      d.message && d.message.toLowerCase().includes(queryString.toLowerCase())
  );

  console.log(
    `textSearch - matches:`,
    start !== null && count !== null
      ? matches.slice(start, start + count)
      : start === null && count !== null
      ? matches.slice(0, count)
      : start !== null && count === null
      ? matches.slice(start)
      : matches
  );

  // Support for paging through results.
  let pagedResults;
  if (start !== null && count !== null) {
    pagedResults = matches.slice(start, start + count);
  } else if (start === null && count !== null) {
    pagedResults = matches.slice(0, count);
  } else if (start !== null && count === null) {
    pagedResults = matches.slice(start);
  } else {
    pagedResults = matches;
  }

  return Promise.resolve([pagedResults, matches.length]);
}

/**
 * Search prior conversation history using case-insensitive string matching.
 *
 * @param {string} userId - The user ID to search for.
 * @param {string} query - String to search for.
 * @param {number} [page=0] - Allows you to page through results. Only use on a follow-up query.
 * @returns {Promise<string>} - The result of the query as a string.
 */
async function conversationSearch(
  userId: string,
  query: string,
  page: number = 0
): Promise<string> {
  const RETRIEVAL_QUERY_DEFAULT_PAGE_SIZE = 5; // Adjust the page size as needed
  const count = RETRIEVAL_QUERY_DEFAULT_PAGE_SIZE;

  // Assuming textSearch is a previously defined function
  // Replace this with the actual method to perform the text search in your conversation history.
  const [results, total] = await textSearch(userId, query, count, page * count);
  const numPages = Math.ceil(total / count) - 1; // 0 index

  let resultsStr = "";
  if (results.length === 0) {
    resultsStr = "No results found.";
  } else {
    const resultsPref = `Showing ${results.length} of ${total} results (page ${page}/${numPages}):`;
    const resultsFormatted = results.map(
      (d) => `timestamp: ${d.created_at}, ${d.role} - ${d.message}`
    );
    resultsStr = `${resultsPref} ${JSON.stringify(resultsFormatted)}`;
  }

  console.log("result string", resultsStr);

  return Promise.resolve(resultsStr);
}

export default conversationSearch;

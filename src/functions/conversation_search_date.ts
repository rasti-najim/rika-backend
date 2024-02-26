import { pool } from "../db";
const debug = require("debug")("app:conversation_search_date");

type DatabaseMessage = {
  message_id: string;
  user_id: string;
  role: string;
  content: string;
  time: Date;
};

/**
 * Validate the given date string in the format 'YYYY-MM-DD'
 * @param {string} dateStr - The date string to validate.
 * @returns {boolean} - Whether the date string is valid.
 */
function _validateDateFormat(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateStr.match(regex)) {
    return false;
  }

  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date.getTime());
}

// Extracts and returns the date from the given timestamp
/**
 *
 * @param {string} timestamp - The timestamp to extract the date from.
 * @returns {string|null} - The date extracted from the timestamp, or null if the timestamp is invalid.
 */
function _extractDateFromTimestamp(timestamp: Date): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(timestamp.toString());
  return match ? match[1] : null;
}

// Search for messages within a date range
/**
 *
 * @param {string} userId - The user ID.
 * @param {string} startDate - The start of the date range in 'YYYY-MM-DD' format.
 * @param {string} endDate - The end of the date range in 'YYYY-MM-DD' format.
 * @param {number|null} [count=null] - The number of results to return.
 * @param {number} [start=0] - The starting index for paging through results.
 * @returns {Promise<[DatabaseMessage[], number]>} - The results of the search along with the total number of results.
 */
async function dateSearch(
  userId: string,
  startDate: string,
  endDate: string,
  count: number | null = null,
  start = 0
): Promise<[DatabaseMessage[], number]> {
  // const _messageLogs = await loadMessages(messagesFile);
  // const messagePool = _messageLogs.filter(
  //   (d) => d.message.role !== "system" && d.message.role !== "tool"
  // );

  const result = await pool.query("SELECT * FROM messages WHERE user_id = $1", [
    userId,
  ]);

  const _messageLogs: DatabaseMessage[] = result.rows;
  debug(_messageLogs);

  // Validate the start_date and end_date format
  if (!_validateDateFormat(startDate) || !_validateDateFormat(endDate)) {
    throw new Error("Invalid date format. Expected format: YYYY-MM-DD");
  }

  const startDateDt = new Date(startDate);
  const endDateDt = new Date(endDate);

  // Match items inside messageLogs
  const matches = _messageLogs.filter((d) => {
    const extractedDate = _extractDateFromTimestamp(d.time);
    const date = extractedDate ? new Date(extractedDate) : null;
    return date && date >= startDateDt && date <= endDateDt;
  });

  // Support for paging through results
  const pagedResults = matches.slice(start, count ? start + count : undefined);
  return [pagedResults, matches.length];
}

/**
 * Search conversation history using a date range.
 *
 * @param {string} userId - The user ID.
 * @param {string} startDate - The start of the date range in 'YYYY-MM-DD' format.
 * @param {string} endDate - The end of the date range in 'YYYY-MM-DD' format.
 * @param {number} [page=0] - The page number for paging through results. Defaults to 0.
 * @returns {string} - Query result string.
 */
async function conversationSearchDate(
  userId: string,
  startDate: string,
  endDate: string,
  page = 0
) {
  const RETRIEVAL_QUERY_DEFAULT_PAGE_SIZE = 5;
  const count = RETRIEVAL_QUERY_DEFAULT_PAGE_SIZE;
  const [results, total] = await dateSearch(
    userId,
    startDate,
    endDate,
    count,
    page * count
  );
  const numPages = Math.ceil(total / count) - 1; // 0 index
  let resultsStr;

  if (results.length === 0) {
    resultsStr = "No results found.";
  } else {
    const resultsPref = `Showing ${results.length} of ${total} results (page ${page}/${numPages}):`;
    const resultsFormatted = results.map(
      (d) => `timestamp: ${d.time}, ${d.role} - ${d.content}`
    );
    resultsStr = `${resultsPref} ${JSON.stringify(resultsFormatted)}`;
  }

  return resultsStr;
}

export default conversationSearchDate;

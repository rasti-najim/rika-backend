var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const path = require("path");
const loadMessages = require("../utils/load_messages");
const { pool } = require("../db");
// Validate the given date string in the format 'YYYY-MM-DD'
function _validateDateFormat(dateStr) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateStr.match(regex)) {
        return false;
    }
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date);
}
// Extracts and returns the date from the given timestamp
function _extractDateFromTimestamp(timestamp) {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(timestamp);
    return match ? match[1] : null;
}
// Search for messages within a date range
function dateSearch(usrId, startDate, endDate, count = null, start = 0) {
    return __awaiter(this, void 0, void 0, function* () {
        // const _messageLogs = await loadMessages(messagesFile);
        // const messagePool = _messageLogs.filter(
        //   (d) => d.message.role !== "system" && d.message.role !== "tool"
        // );
        const result = yield pool.query("SELECT * FROM messages WHERE user_id = $1", [
            userId,
        ]);
        const _messageLogs = result.rows;
        debug(_messageLogs);
        // Validate the start_date and end_date format
        if (!_validateDateFormat(startDate) || !_validateDateFormat(endDate)) {
            throw new Error("Invalid date format. Expected format: YYYY-MM-DD");
        }
        const startDateDt = new Date(startDate);
        const endDateDt = new Date(endDate);
        // Match items inside messageLogs
        const matches = _messageLogs.filter((d) => {
            const date = new Date(_extractDateFromTimestamp(d.time));
            return date >= startDateDt && date <= endDateDt;
        });
        // Support for paging through results
        const pagedResults = matches.slice(start, count ? start + count : undefined);
        return [pagedResults, matches.length];
    });
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
function conversationSearchDate(userId, startDate, endDate, page = 0) {
    return __awaiter(this, void 0, void 0, function* () {
        const RETRIEVAL_QUERY_DEFAULT_PAGE_SIZE = 5;
        const count = RETRIEVAL_QUERY_DEFAULT_PAGE_SIZE;
        const [results, total] = yield dateSearch(userId, startDate, endDate, count, page * count);
        const numPages = Math.ceil(total / count) - 1; // 0 index
        let resultsStr;
        if (results.length === 0) {
            resultsStr = "No results found.";
        }
        else {
            const resultsPref = `Showing ${results.length} of ${total} results (page ${page}/${numPages}):`;
            const resultsFormatted = results.map((d) => `timestamp: ${d.time}, ${d.role} - ${d.content}`);
            resultsStr = `${resultsPref} ${JSON.stringify(resultsFormatted)}`;
        }
        return resultsStr;
    });
}
module.exports = conversationSearchDate;

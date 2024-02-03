var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const { client } = require("../db");
const openai = require("../utils/openaiClient");
/**
 * Searches archival memory and returns the results along with the total number of results.
 *
 * @param {string} queryString - The query string for the search.
 * @param {number|null} [count=null] - The number of results to return. If null, returns all results.
 * @param {number|null} [start=null] - The offset to start returning results from. If null, starts from 0.
 * @returns {[Array, number]} - A tuple where the first element is a list of results and the second is the total number of results.
 */
function search(userId, queryString, count = null, start = null) {
    return __awaiter(this, void 0, void 0, function* () {
        const collection = yield client.getOrCreateCollection({
            name: "archival_memory",
            // embeddingFunction: embedder,
        });
        const collectionCount = yield collection.count();
        console.log(collectionCount);
        const embedding = yield openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: queryString,
        });
        const embeddings = embedding.data[0].embedding;
        const results = yield collection.query({
            queryEmbeddings: [embeddings],
            where: { userId: userId },
            include: ["documents", "metadatas"],
            // queryTexts: ["AI"],
        });
        console.log(results);
        console.log(results.documents[0]);
        console.log(results.documents[0][0]);
        console.log(results.metadatas[0]);
        const metadatas = results.metadatas[0];
        const totalResults = results.documents[0].length; // Replace with the actual total number of results
        const queryResults = count
            ? results.documents[0].slice(start || 0, (start || 0) + count)
            : results.documents[0];
        return [queryResults, totalResults, metadatas];
    });
}
/**
 * Performs a semantic search in archival memory.
 *
 * @param {string} userId - The user ID of the user who is performing the search.
 * @param {string} query - The string to search for.
 * @param {number} [page=0] - The page number for paging through results, defaults to 0 for first page.
 * @returns {string} - The result of the query as a string.
 */
function archivalMemorySearch(userId, query, page = 0) {
    return __awaiter(this, void 0, void 0, function* () {
        // Implementation of the semantic search goes here.
        // This would typically involve calling an API or searching a database.
        // For example, if you had an API endpoint for the search, you might do something like this:
        // const response = await fetch(`https://api.example.com/search?query=${encodeURIComponent(query)}&page=${page}`);
        // const data = await response.json();
        // return data.result;
        const RETRIEVAL_QUERY_DEFAULT_PAGE_SIZE = 5;
        const count = RETRIEVAL_QUERY_DEFAULT_PAGE_SIZE;
        // Mock function call to search in archival memory.
        // In actual implementation, it would involve calling the search function of the persistence manager.
        const [results, total, metadatas] = yield search(userId, query, count, page * count);
        const numPages = Math.ceil(total / count) - 1; // 0 index
        let resultsStr = "";
        console.log(results);
        if (results.length === 0) {
            resultsStr = "No results found.";
        }
        else {
            const resultsPref = `Showing ${results.length} of ${total} results (page ${page}/${numPages}):`;
            const resultsFormatted = results.map((content, index) => {
                const timestamp = metadatas[index].timestamp;
                return `timestamp: ${timestamp}, memory: ${content}`;
            });
            resultsStr = `${resultsPref} ${JSON.stringify(resultsFormatted)}`;
        }
        console.log(resultsStr);
        return resultsStr;
    });
}
module.exports = archivalMemorySearch;

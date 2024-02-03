var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const fs = require("fs");
const path = require("path");
const debug = require("debug")("app:core_memory");
const { redisClient } = require("../db");
const { CHAT } = require("../constants/constants");
const fetchPersona = require("../utils/fetchPersona");
function createSystemMessage(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const ttl = 3600; // 1 hour TTL
        try {
            // Retrieve all items in the AI list
            let aiListItems = yield redisClient.lRange(`personas_ai_${userId}`, 0, -1);
            debug("AI List Items:", aiListItems);
            // Check if aiListItems is an array and not empty
            if (!Array.isArray(aiListItems) || aiListItems.length === 0) {
                aiListItems = yield fetchPersona(userId, "ai");
                debug("Fetched AI List Items:", aiListItems);
                if (aiListItems.length > 0) {
                    // Store the data in Redis and set a TTL
                    yield redisClient.del(`personas_ai_${userId}`); // Delete existing list
                    yield redisClient.rPush(`personas_ai_${userId}`, ...aiListItems); // Push new items
                    yield redisClient.expire(`personas_ai_${userId}`, ttl); // Set TTL
                }
            }
            let aiData = "";
            // Join the list into a string only if it's a non-empty array
            if (Array.isArray(aiListItems) && aiListItems.length > 0) {
                aiData = aiListItems.join("\n");
                debug("AI Data:", aiData);
            }
            const formattedAiData = '<persona characters="317/2000">' + aiData + "\n</persona>";
            // Retrieve all items in the human list
            let humanListItems = yield redisClient.lRange(`personas_human_${userId}`, 0, -1);
            debug("Human List Items:", humanListItems);
            // Check if humanListItems is an array and not empty
            if (!Array.isArray(humanListItems) || humanListItems.length === 0) {
                humanListItems = yield fetchPersona(userId, "human");
                debug("Fetched Human List Items:", humanListItems);
                if (humanListItems.length > 0) {
                    // Store the data in Redis and set a TTL
                    yield redisClient.del(`personas_human_${userId}`); // Delete existing list
                    yield redisClient.rPush(`personas_human_${userId}`, ...humanListItems); // Push new items
                    yield redisClient.expire(`personas_human_${userId}`, ttl); // Set TTL
                }
            }
            let humanData = "";
            // Join the list into a string only if it's a non-empty array
            if (Array.isArray(humanListItems) && humanListItems.length > 0) {
                humanData = humanListItems.join("\n");
                debug("Human Data:", humanData);
            }
            const formattedHumanData = '\n<human characters="17/2000">' + humanData + "</human>";
            // Header to be added
            const header = "\nCore memory shown below (limited in size, additional information stored in archival / recall memory):\n";
            // Combine all the data into a single string
            const systemMessage = CHAT + "\n" + header + formattedAiData + formattedHumanData;
            // Fetch the updated system message from Redis
            yield redisClient.set(`system_message_${userId}`, systemMessage, {
                EX: ttl,
            });
        }
        catch (err) {
            console.error("Error occurred while appending data:", err);
            return "Error appending data";
        }
    });
}
function updateSystemMessage(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        let aiData = yield redisClient
            .lRange(`personas_ai_${userId}`, 0, -1)
            .then((items) => items.join("\n"));
        let humanData = yield redisClient
            .lRange(`personas_human_${userId}`, 0, -1)
            .then((items) => items.join("\n"));
        const formattedAiData = '<persona characters="317/2000">' + aiData + "\n</persona>";
        const formattedHumanData = '\n<human characters="17/2000">' + humanData + "</human>";
        const header = "\nCore memory shown below (limited in size, additional information stored in archival / recall memory):\n";
        const systemMessage = CHAT + "\n" + header + formattedAiData + formattedHumanData;
        // Update the system message in Redis
        const ttl = 3600; // For example, 1 hour
        yield redisClient.set(`system_message_${userId}`, systemMessage, { EX: ttl });
    });
}
function appendFilesToFile(file1, file2, targetFile, newFile) {
    // Read content of the target file
    fs.readFile(targetFile, "utf8", (err, targetData) => {
        if (err) {
            console.error("Error reading target file:", err);
            return;
        }
        // Read content of the first file
        fs.readFile(file1, "utf8", (err, data1) => {
            if (err) {
                console.error("Error reading file 1:", err);
                return;
            }
            // Format the content of the first file
            data1 = '<persona characters="317/2000">' + data1 + "\n</persona>";
            // Read content of the second file
            fs.readFile(file2, "utf8", (err, data2) => {
                if (err) {
                    console.error("Error reading file 2:", err);
                    return;
                }
                // Format the content of the second file
                data2 = '\n<human characters="17/2000">' + data2 + "</human>";
                // Header to be added
                const header = "\nCore memory shown below (limited in size, additional information stored in archival / recall memory):\n";
                // Write the target file content and the formatted contents of file1 and file2 to the new file
                fs.writeFile(newFile, targetData + "\n" + header + data1 + data2, (err) => {
                    if (err) {
                        console.error("Error writing to new file:", err);
                        return;
                    }
                    // console.log("Content successfully written to the new file.");
                    // Optionally, read and print the content of the new file
                    fs.readFile(newFile, "utf8", (err, newData) => {
                        if (err) {
                            console.error("Error reading the new file:", err);
                            return;
                        }
                        // console.log("Content of the new file:\n", newData);
                    });
                });
            });
        });
    });
}
function readFileContentsSync(filePath) {
    try {
        const data = fs.readFileSync(filePath, "utf8");
        return data;
    }
    catch (err) {
        console.error("Error reading file:", err);
        return null;
    }
}
function readFileContentsAsync(filePath, callback) {
    fs.readFile(filePath, "utf8", (err, data) => {
        if (err) {
            console.error("Error reading file:", err);
            callback(null);
        }
        else {
            callback(data);
        }
    });
}
module.exports = {
    appendFilesToFile,
    readFileContentsAsync,
    readFileContentsSync,
    createSystemMessage,
    updateSystemMessage,
};

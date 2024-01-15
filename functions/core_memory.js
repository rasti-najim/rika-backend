const fs = require("fs");
const path = require("path");
const debug = require("debug")("app:core_memory");
const { redisClient } = require("../db");
const { CHAT } = require("../constants/constants");
const fetchPersona = require("../utils/fetchPersona");

async function createSystemMessage(userId) {
  try {
    // Retrieve all items in the AI list
    let aiListItems = await redisClient.lRange(`personas_ai_${userId}`, 0, -1);
    debug("AI List Items:", aiListItems);

    // Check if aiListItems is an array and not empty
    if (!Array.isArray(aiListItems) || aiListItems.length === 0) {
      aiListItems = await fetchPersona(userId, "ai");
      debug("Fetched AI List Items:", aiListItems);
    }

    let aiData = "";
    // Join the list into a string only if it's a non-empty array
    if (Array.isArray(aiListItems) && aiListItems.length > 0) {
      aiData = aiListItems.join("\n");
      debug("AI Data:", aiData);
    }

    const formattedAiData =
      '<persona characters="317/2000">' + aiData + "\n</persona>";

    // Retrieve all items in the human list
    let humanListItems = await redisClient.lRange(
      `personas_human_${userId}`,
      0,
      -1
    );
    debug("Human List Items:", humanListItems);

    // Check if humanListItems is an array and not empty
    if (!Array.isArray(humanListItems) || humanListItems.length === 0) {
      humanListItems = await fetchPersona(userId, "human");
      debug("Fetched Human List Items:", humanListItems);
    }

    let humanData = "";
    // Join the list into a string only if it's a non-empty array
    if (Array.isArray(humanListItems) && humanListItems.length > 0) {
      humanData = humanListItems.join("\n");
      debug("Human Data:", humanData);
    }

    const formattedHumanData =
      '\n<human characters="17/2000">' + humanData + "</human>";

    // Header to be added
    const header =
      "\nCore memory shown below (limited in size, additional information stored in archival / recall memory):\n";

    // Combine all the data into a single string
    const systemMessage =
      CHAT + "\n" + header + formattedAiData + formattedHumanData;

    return systemMessage;
  } catch (err) {
    console.error("Error occurred while appending data:", err);
    return "Error appending data";
  }
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
        const header =
          "\nCore memory shown below (limited in size, additional information stored in archival / recall memory):\n";

        // Write the target file content and the formatted contents of file1 and file2 to the new file
        fs.writeFile(
          newFile,
          targetData + "\n" + header + data1 + data2,
          (err) => {
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
          }
        );
      });
    });
  });
}

function readFileContentsSync(filePath) {
  try {
    const data = fs.readFileSync(filePath, "utf8");
    return data;
  } catch (err) {
    console.error("Error reading file:", err);
    return null;
  }
}

function readFileContentsAsync(filePath, callback) {
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      callback(null);
    } else {
      callback(data);
    }
  });
}

module.exports = {
  appendFilesToFile,
  readFileContentsAsync,
  readFileContentsSync,
  createSystemMessage,
};

const express = require("express");
const OpenAI = require("openai");
const path = require("path");
const axios = require("axios");
const fs = require("fs");
const { encoding_for_model } = require("tiktoken");
if (process.env.NODE_ENV === "production") {
  require("dotenv").config({ path: "/etc/app.env" });
} else {
  require("dotenv").config();
}

const tools = require("../function_calls/functions");
const coreMemoryAppend = require("../functions/core_memory_append");
const coreMemoryReplace = require("../functions/core_memory_replace");
const conversationSearch = require("../functions/conversation_search");
const conversationSearchDate = require("../functions/conversation_search_date");
const archivalMemoryInsert = require("../functions/archival_memory_insert");
const archivalMemorySearch = require("../functions/archival_memory_search");
const client = require("../db");
const {
  appendFilesToFile,
  readFileContentsAsync,
  readFileContentsSync,
} = require("../functions/core_memory");
const saveMessages = require("../utils/saveMessages");
const loadMessages = require("../utils/loadMessages");

const humanFile = path.join(__dirname, "../personas/human.txt");
const aiFile = path.join(__dirname, "../personas/ai.txt");
const chatFile = path.join(__dirname, "../system/chat.txt");
const systemFile = path.join(__dirname, "../system/system.txt");
const messagesFile = path.join(__dirname, "../utils/messages.json");

const router = express.Router();

const openai = new OpenAI(process.env.OPENAI_API_KEY);

router.post("/", async (req, res) => {
  try {
    console.log(req.body);
    var systemMessage = "";
    appendFilesToFile(aiFile, humanFile, chatFile, systemFile);
    // readFileContentsAsync(systemFile, (fileContents) => {
    //   if (fileContents) {
    //     console.log(fileContents);
    //     systemMessage = fileContents;
    //   } else {
    //     console.log("No data read from file.");
    //   }
    // });
    const fileContents = readFileContentsSync(systemFile);
    // console.log(fileContents);
    systemMessage = fileContents;
    const { message, time } = req.body;
    var messages = [
      {
        role: "system",
        content: systemMessage,
        // "You are my AI friend. Your responses shouldn't be generic but rather casual, exactly like a friend would talk.",
      },
      // {
      //   role: "user",
      //   content: message,
      // },
    ];
    // if (response) {
    //   for (const element of response) {
    //     messages.push(element);
    //   }
    // }
    messages.push(message);

    // console.log(messages);

    // const tools = [
    //   {
    //     type: "function",
    //     function: {
    //       name: "functionCalling",
    //       description:
    //         "this function prints hello with the user's name whenever the user memtions his or her name",
    //       parameters: {
    //         type: "object",
    //         properties: {
    //           name: {
    //             type: "string",
    //             description: "The name of a person to append to hello",
    //           },
    //         },
    //         required: ["name"],
    //       },
    //     },
    //   },
    //   {
    //     type: "function",
    //     function: {
    //       name: "getTimeOfDay",
    //       description: "this function gets the time of day and returns it",
    //     },
    //   },
    // ];

    // const prevMessages = await loadMessages(messagesFile);
    // console.log("previous messages" + prevMessages); // Do something with the array
    let prevMessages = (await loadMessages(messagesFile)).map(
      ({ message }) => message
    );
    // console.log("prev messages", prevMessages);
    prevMessages = prevMessages;
    messages = [messages[0], ...prevMessages, messages[1]];
    // console.log(messages);

    const completion = await openai.chat.completions.create({
      messages: messages,
      tools: tools,
      tool_choice: "auto",
      model: "gpt-4",
    });

    console.log(completion.choices[0]);

    messages.push(completion.choices[0].message);

    let date = new Date();
    let dateString = date.toISOString().replace("T", " ").substring(0, 19);
    const newMessages = [
      { message: message, time: time },
      { message: completion.choices[0].message, time: dateString },
    ];

    await saveMessages(newMessages, messagesFile);

    const useTools = completion.choices[0].finish_reason === "tool_calls";
    if (useTools) {
      const toolMessage = await handleToolCalls(completion, messages);
      res.send(toolMessage);
    } else {
      res.send(completion);
    }
    // if (useTools) {
    //   if (
    //     completion.choices[0].message.tool_calls[0].function.name ===
    //     "core_memory_append"
    //   ) {
    //     const arguments = JSON.parse(
    //       completion.choices[0].message.tool_calls[0].function.arguments
    //     );
    //     const tool_call_id = completion.choices[0].message.tool_calls[0].id;
    //     coreMemoryAppend(arguments.name, arguments.content);
    //     const toolMessage = {
    //       role: "tool",
    //       content: null,
    //       tool_call_id: tool_call_id,
    //     };
    //     const response = await axios.post("http://localhost:8080/chat", {
    //       message: toolMessage,
    //     });
    //     res.send(response);
    //   }
    //   if (
    //     completion.choices[0].message.tool_calls[0].function.name ===
    //     "core_memory_replace"
    //   ) {
    //     const arguments = JSON.parse(
    //       completion.choices[0].message.tool_calls[0].function.arguments
    //     );
    //     const tool_call_id = completion.choices[0].message.tool_calls[0].id;
    //     coreMemoryReplace(
    //       arguments.name,
    //       arguments.old_content,
    //       arguments.new_content
    //     );
    //     const toolMessage = {
    //       role: "tool",
    //       content: null,
    //       tool_call_id: tool_call_id,
    //     };
    //     const response = await axios.post("http://localhost:8080/chat", {
    //       message: toolMessage,
    //     });
    //     res.send(response);
    //   }
    // }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal Server Error");
  }
});

async function handleToolCalls(completion, messages) {
  console.log("calling handleToolCalls");
  const toolCallArguments = JSON.parse(
    completion.choices[0].message.tool_calls[0].function.arguments
  );
  const tool_call_id = completion.choices[0].message.tool_calls[0].id;
  const toolMessage = {
    role: "tool",
    content: "memory updated successfully",
    tool_call_id: tool_call_id,
  };
  // messages.push(toolMessage);

  if (
    completion.choices[0].message.tool_calls[0].function.name ===
    "core_memory_append"
  ) {
    const memoryStatus = coreMemoryAppend(arguments.name, arguments.content);
    console.log("calling core_memory_append");
    toolMessage.content = memoryStatus;
  } else if (
    completion.choices[0].message.tool_calls[0].function.name ===
    "core_memory_replace"
  ) {
    coreMemoryReplace(
      arguments.name,
      arguments.old_content,
      arguments.new_content
    );
  } else if (
    completion.choices[0].message.tool_calls[0].function.name ===
    "conversation_search"
  ) {
    console.log("calling conversation_search", arguments.query);
    const searchResult = await conversationSearch(arguments.query);
    console.log(searchResult);
    toolMessage.content = searchResult;
  } else if (
    completion.choices[0].message.tool_calls[0].function.name ===
    "conversation_search_date"
  ) {
    console.log(
      "calling conversation_search_date",
      arguments.start_date,
      arguments.end_date
    );
    const searchResult = await conversationSearchDate(
      arguments.start_date,
      arguments.end_date
    );
    console.log(searchResult);
    toolMessage.content = searchResult;
  } else if (
    completion.choices[0].message.tool_calls[0].function.name ===
    "archival_memory_insert"
  ) {
    console.log("calling archival_memory_insert", arguments.content);
    await archivalMemoryInsert(arguments.content, openai);
  } else if (
    completion.choices[0].message.tool_calls[0].function.name ===
    "archival_memory_search"
  ) {
    console.log("calling archival_memory_search", arguments.query);
    await archivalMemorySearch(arguments.query, openai);
  } else if (
    completion.choices[0].message.tool_calls[0].function.name ===
    "archival_memory_delete"
  ) {
    await client.deleteCollection({ name: "archival_memory" });
  }

  return toolMessage;

  // try {
  //   // const response = await fetch("http://localhost:8080/chat", {
  //   //   method: "POST",
  //   //   headers: {
  //   //     "Content-Type": "application/json",
  //   //   },
  //   //   body: JSON.stringify({
  //   //     message: toolMessage,
  //   //   }),
  //   // });

  //   // const data = await response.json();

  //   console.log(messages.slice(-20));

  //   const completion = await openai.chat.completions.create({
  //     messages: messages.slice(-20),
  //     tools: tools,
  //     tool_choice: "auto",
  //     model: "gpt-4",
  //   });

  //   console.log(completion.choices[0]);

  //   messages.push(completion.choices[0].message);
  //   await saveMessages(messages.slice(-2), messagesFile);

  //   console.log(completion.choices[0]);
  //   res.send(completion);
  // } catch (error) {
  //   console.error("Error:", error);
  // }
}

module.exports = router;

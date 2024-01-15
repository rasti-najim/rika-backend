const express = require("express");
const OpenAI = require("openai");
const path = require("path");
const axios = require("axios");
const fs = require("fs");
const { encoding_for_model } = require("tiktoken");
const debug = require("debug")("app:chat");
require("dotenv").config();

const tools = require("../function_calls/functions");
const coreMemoryAppend = require("../functions/core_memory_append");
const coreMemoryReplace = require("../functions/core_memory_replace");
const conversationSearch = require("../functions/conversation_search");
const conversationSearchDate = require("../functions/conversation_search_date");
const archivalMemoryInsert = require("../functions/archival_memory_insert");
const archivalMemorySearch = require("../functions/archival_memory_search");
const { client } = require("../db");
const { redisClient } = require("../db");
const openai = require("./openaiClient");
const {
  appendFilesToFile,
  readFileContentsAsync,
  readFileContentsSync,
  appendListsToString,
  createSystemMessage,
} = require("../functions/core_memory");
const saveMessages = require("../utils/save_messages");
const loadMessages = require("../utils/load_messages");
const isPaired = require("../utils/isPaired");
const validateMessages = "../utils/validateMessages";

const humanFile = path.join(__dirname, "../personas/human.txt");
const aiFile = path.join(__dirname, "../personas/ai.txt");
const chatFile = path.join(__dirname, "../system/chat.txt");
const systemFile = path.join(__dirname, "../system/system.txt");
const messagesFile = path.join(__dirname, "../utils/messages.json");

const router = express.Router();

async function chat(data) {
  const { userId, systemMessage, message, time } = data;
  console.log(userId);
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

  messages.push(message);

  let rawPrevMessages = await redisClient.lRange(`messages_${userId}`, -10, -1);
  console.log("Raw Previous Messages from Redis:", rawPrevMessages);
  let prevMessages = rawPrevMessages.map((item) => JSON.parse(item));
  // Store the original length of prevMessages
  let originalLength = prevMessages.length;
  debug(prevMessages);
  // prevMessages = prevMessages.map(({ message }) => message);
  // debug(prevMessages);

  // If prevMessages is empty, load messages from PostgreSQL
  if (prevMessages.length === 0) {
    prevMessages = await loadMessages(userId);
    debug(prevMessages);

    if (prevMessages.length > 0) {
      for (const prevMessage of prevMessages) {
        const messageString = JSON.stringify(prevMessage);
        debug(messageString);

        await redisClient.rPush(`messages_${userId}`, messageString);

        // prevMessages = rawPrevMessages.map(({ message }) => message);
        // debug(prevMessages);
      }
    }
  }

  if (prevMessages.length > 0) {
    debug("previous messages", prevMessages);
    messages = [messages[0], ...prevMessages, messages[1]];
    originalLength = messages.slice(1).length;
    messages = validateMessages(messages.slice(1)); // Assume this function cleans the messages

    // Check if messages were modified
    if (messages.length !== originalLength) {
      // Update Redis list only if modifications were made

      // Delete the old list in Redis
      await redisClient.del(`messages_${userId}`);

      // Repopulate Redis with the cleaned messages
      for (const msg of messages) {
        // Use 'messages' here instead of 'prevMessages'
        const messageString = JSON.stringify(msg);
        await redisClient.rPush(`messages_${userId}`, messageString);
      }
    }
  } else {
    messages = [messages[0], messages[1]];
  }

  debug(messages);

  const completion = await openai.chat.completions.create({
    messages: messages,
    tools: tools,
    tool_choice: "auto",
    model: "gpt-4-1106-preview",
  });

  console.log(completion.choices[0]);

  messages.push(completion.choices[0].message);

  let date = new Date();
  let dateString = date.toISOString().replace("T", " ").substring(0, 19);

  // Check the number of messages in the Redis list
  const listLength = await redisClient.lLen(`messages_${userId}`);

  // If the list has 10 or more messages, remove the oldest one
  if (listLength >= 10) {
    let oldestMessage = JSON.parse(
      await redisClient.lIndex(`messages_${userId}`, 0)
    );

    // Check if removing the oldest message breaks a pair
    if (oldestMessage.role === "assistant") {
      let secondOldestMessage = JSON.parse(
        await redisClient.lIndex(`messages_${userId}`, 1)
      );
      if (
        secondOldestMessage.role === "tool" &&
        oldestMessage.tool_calls[0].id === secondOldestMessage.tool_call_id
      ) {
        // Remove the pair
        await redisClient.lPop(`messages_${userId}`);
      }
    }

    // Remove the oldest message
    await redisClient.lPop(`messages_${userId}`);
  }

  const newMessages = [
    { message: message, time: time },
    { message: completion.choices[0].message, time: dateString },
  ];

  for (const newMessage of newMessages) {
    const messageString = JSON.stringify(newMessage.message);
    console.log(messageString);

    await redisClient.rPush(`messages_${userId}`, messageString);
  }
  // Optionally, if you want to ensure that the list never exceeds 10 messages,
  // you can use LTRIM here as a safety measure
  await redisClient.lTrim(`messages_${userId}`, -10, -1);

  await saveMessages(userId, newMessages);

  // await saveMessages(newMessages, messagesFile);

  const useTools = completion.choices[0].finish_reason === "tool_calls";
  if (useTools) {
    const toolMessage = await handleToolCalls(userId, completion);
    //   res.send(toolMessage);
    return toolMessage;
  }

  return completion;
}

async function handleToolCalls(userId, completion) {
  console.log("calling handleToolCalls");
  const arguments = JSON.parse(
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
    const memoryStatus = await coreMemoryAppend(
      userId,
      arguments.name,
      arguments.content
    );
    console.log("calling core_memory_append");
    toolMessage.content = memoryStatus;
    console.log(memoryStatus);
  } else if (
    completion.choices[0].message.tool_calls[0].function.name ===
    "core_memory_replace"
  ) {
    await coreMemoryReplace(
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
    await archivalMemoryInsert(userId, arguments.content);
  } else if (
    completion.choices[0].message.tool_calls[0].function.name ===
    "archival_memory_search"
  ) {
    console.log("calling archival_memory_search", arguments.query);
    await archivalMemorySearch(userId, arguments.query);
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

module.exports = chat;

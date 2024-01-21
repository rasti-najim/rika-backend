const express = require("express");
const OpenAI = require("openai");
const path = require("path");
const axios = require("axios");
const fs = require("fs");
const { encoding_for_model } = require("tiktoken");
const debug = require("debug")("app:chat");
require("dotenv").config();

const tools = require("../function_calls/functions");
const { client } = require("../db");
const { redisClient } = require("../db");
const openai = require("./openaiClient");
const {
  updateSystemMessage,
  createSystemMessage,
} = require("../functions/core_memory");
const saveMessages = require("../utils/save_messages");
const loadMessages = require("../utils/load_messages");
const isPaired = require("../utils/isPaired");
const validateMessages = require("./validateMessages");
const handleToolCalls = require("./handleToolCalls");

async function chat(data) {
  const { userId, message, time } = data;
  let systemMessage;
  systemMessage = await redisClient.get(`system_message_${userId}`);
  if (!systemMessage) {
    systemMessage = await createSystemMessage(userId);
    await redisClient.set(`system_message_${userId}`, systemMessage, {
      EX: 3600,
    });
  }
  console.log("User ID", userId);
  console.log("System Message", systemMessage);
  let messages = [
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

  // Check if Redis list exists and set TTL if it's being created
  const listKey = `messages_${userId}`;
  const ttl = 3600; // TTL in seconds, for example, 1 hour
  let listExists = await redisClient.exists(listKey);
  let prevMessages = [];
  let originalLength = 0;

  if (!listExists) {
    prevMessages = await loadMessages(userId);
    debug("Previous messages from the databse", prevMessages);

    if (prevMessages.length > 0) {
      const messageStrings = prevMessages.map((msg) => JSON.stringify(msg));
      await redisClient.rPush(`messages_${userId}`, ...messageStrings);

      // Set TTL for the list if it's being created
      if (!listExists) {
        await redisClient.expire(listKey, ttl);
      }
    }
  } else {
    prevMessages = await redisClient.lRange(`messages_${userId}`, -10, -1);
    debug("Previous messages from Redis", prevMessages);
    prevMessages = prevMessages.map((item) => JSON.parse(item));
  }

  if (prevMessages.length > 0) {
    debug("previous messages", prevMessages);
    messages = [messages[0], ...prevMessages, messages[1]];
    originalLength = messages.length;
    validateMessages(messages); // Assume this function cleans the messages

    // Check if messages were modified
    if (messages.length !== originalLength) {
      // Update Redis list only if modifications were made

      // Delete the old list in Redis
      await redisClient.del(`messages_${userId}`);

      // Repopulate Redis with the cleaned messages
      const messageStrings = messages.map((msg) => JSON.stringify(msg));
      await redisClient.rPush(`messages_${userId}`, ...messageStrings);

      // Set TTL for the list if it's being created
      if (!listExists) {
        await redisClient.expire(listKey, ttl);
      }
    }
  } else {
    messages = [messages[0], messages[1]];
  }

  debug("Messages", messages);

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
  // const listLength = await redisClient.lLen(`messages_${userId}`);

  // // If the list has 10 or more messages, remove the oldest one
  // if (listLength >= 10) {
  //   let oldestMessage = JSON.parse(
  //     await redisClient.lIndex(`messages_${userId}`, 0)
  //   );

  //   // Check if removing the oldest message breaks a pair
  //   if (oldestMessage.role === "assistant") {
  //     let secondOldestMessage = JSON.parse(
  //       await redisClient.lIndex(`messages_${userId}`, 1)
  //     );
  //     if (
  //       secondOldestMessage.role === "tool" &&
  //       oldestMessage.tool_calls[0].id === secondOldestMessage.tool_call_id
  //     ) {
  //       // Remove the pair
  //       await redisClient.lPop(`messages_${userId}`);
  //     }
  //   }

  //   // Remove the oldest message
  //   await redisClient.lPop(`messages_${userId}`);
  // }

  const newMessages = [
    { message: message, time: time },
    { message: completion.choices[0].message, time: dateString },
  ];

  // Simplify the loop for pushing new messages to Redis
  listExists = await redisClient.exists(`messages_${userId}`);
  const messageStrings = newMessages.map((msg) => JSON.stringify(msg.message));
  await redisClient.rPush(`messages_${userId}`, ...messageStrings);

  // Optionally, if you want to ensure that the list never exceeds 10 messages,
  // you can use LTRIM here as a safety measure
  // await redisClient.lTrim(`messages_${userId}`, -10, -1);

  // Set TTL for the list if it's being created
  if (!listExists) {
    await redisClient.expire(listKey, ttl);
  }

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

module.exports = chat;

import express from "express";
import OpenAI from "openai";
import path from "path";
import axios from "axios";
import fs from "fs";
import { encoding_for_model } from "tiktoken";
const debug = require("debug")("app:chat");
require("dotenv").config();

import tools from "../function_calls/functions";
import { client } from "../db";
import { redisClient } from "../db";
import openai from "./openaiClient";
import {
  updateSystemMessage,
  createSystemMessage,
} from "../functions/core_memory";
import saveMessages from "./saveMessages";
import loadMessages from "./loadMessages";
import isPaired from "../utils/isPaired";
import validateMessages from "./validateMessages";
import handleToolCalls, { ToolCall } from "./handleToolCalls";

interface ChatData {
  userId: string;
  message: OpenAI.Chat.ChatCompletionMessageParam;
  time: string;
}

type Message = {
  message: OpenAI.Chat.ChatCompletionMessageParam;
  time: string;
};

export async function chat(
  userId: string,
  message: OpenAI.Chat.ChatCompletionMessageParam,
  time: string
): Promise<
  | OpenAI.Chat.ChatCompletion
  | OpenAI.Chat.ChatCompletionToolMessageParam
  | undefined
> {
  // const { userId, message, time } = data;
  const listKey = `messages_${userId}`;
  const ttl = 3600; // TTL in seconds, for example, 1 hour

  let systemMessage: string | null = null;
  systemMessage = await redisClient.get(`system_message_${userId}`);
  if (!systemMessage) {
    systemMessage = await createSystemMessage(userId);
    await redisClient.set(`system_message_${userId}`, systemMessage, {
      EX: ttl,
    });
  }
  debug("User ID", userId);
  debug("System Message", systemMessage);

  // Load previous messages
  let prevMessages = await loadAndPreparePreviousMessages(userId, listKey, ttl);

  // Prepare new messages array
  let messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemMessage },
  ];
  if (prevMessages.length) messages = [...messages, ...prevMessages];
  messages.push(message);

  // let prevMessages = [];
  // let originalLength = 0;

  // if (!listExists) {
  //   prevMessages = await loadMessages(userId);
  //   debug("Previous messages from the databse", prevMessages);

  //   if (prevMessages.length > 0) {
  //     const messageStrings = prevMessages.map((msg) => JSON.stringify(msg));
  //     await redisClient.rPush(`messages_${userId}`, ...messageStrings);

  //     // Set TTL for the list if it's being created
  //     if (!listExists) {
  //       await redisClient.expire(listKey, ttl);
  //     }
  //   }
  // } else {
  //   prevMessages = (
  //     await redisClient.lRange(`messages_${userId}`, -10, -1)
  //   ).reverse();
  //   debug("Previous messages from Redis", prevMessages);
  //   prevMessages = prevMessages.map((item) => JSON.parse(item));
  // }

  // if (prevMessages.length > 0) {
  //   debug("previous messages", prevMessages);
  //   messages = [messages[0], ...prevMessages, messages[1]];
  //   originalLength = messages.length;
  //   validateMessages(messages); // Assume this function cleans the messages

  //   // Check if messages were modified
  //   if (messages.length !== originalLength) {
  //     // Update Redis list only if modifications were made

  //     // Delete the old list in Redis
  //     await redisClient.del(`messages_${userId}`);

  //     // Repopulate Redis with the cleaned messages
  //     const messageStrings = messages
  //       .slice(1)
  //       .map((msg) => JSON.stringify(msg));
  //     await redisClient.rPush(`messages_${userId}`, ...messageStrings);

  //     // Set TTL for the list if it's being created
  //     if (!listExists) {
  //       await redisClient.expire(listKey, ttl);
  //     }
  //   }
  // } else {
  //   messages = [messages[0], messages[1]];
  // }

  // Validate and possibly update messages in Redis
  const params: OpenAI.Chat.ChatCompletionCreateParams = {
    messages: messages,
    tools: tools,
    tool_choice: "auto",
    model: "gpt-4-0125-preview",
  };
  debug("messages", messages);
  const completion: OpenAI.Chat.ChatCompletion =
    await openai.chat.completions.create(params);

  console.log(completion.choices[0]);

  messages.push({
    role: "assistant",
    content: completion.choices[0].message.content || "",
  });

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

  const newMessages: Message[] = [
    { message: message, time: time },
    { message: completion.choices[0].message, time: dateString },
  ];

  await saveNewMessages(userId, newMessages, listKey, ttl);

  // Simplify the loop for pushing new messages to Redis
  // listExists = await redisClient.exists(`messages_${userId}`);
  // const messageStrings = newMessages.map((msg) => JSON.stringify(msg.message));
  // debug("Message Strings", messageStrings);
  // await redisClient.rPush(`messages_${userId}`, ...messageStrings);

  // Optionally, if you want to ensure that the list never exceeds 10 messages,
  // you can use LTRIM here as a safety measure
  // await redisClient.lTrim(`messages_${userId}`, -10, -1);

  // Set TTL for the list if it's being created
  // if (!listExists) {
  //   await redisClient.expire(listKey, ttl);
  // }

  // await saveMessages(userId, newMessages);

  // await saveMessages(newMessages, messagesFile);

  if (!completion.choices[0].message.tool_calls) {
    return completion;
  }

  const useTools = completion.choices[0].finish_reason === "tool_calls";
  const toolCallArguments = JSON.parse(
    completion.choices[0].message?.tool_calls[0].function.arguments
  );
  const toolCall: ToolCall = {
    id: completion.choices[0].message.tool_calls[0].id,
    function: {
      name: completion.choices[0].message.tool_calls[0].function.name,
      arguments: toolCallArguments,
    },
  };
  if (useTools) {
    const toolMessage = await handleToolCalls(userId, toolCall);
    //   res.send(toolMessage);
    return toolMessage;
  }

  return completion;
}

export async function* chatStream(
  userId: string,
  message: OpenAI.Chat.ChatCompletionMessageParam,
  time: string
) {
  // const { userId, message, time } = data;
  const listKey = `messages_${userId}`;
  const ttl = 3600; // TTL in seconds, for example, 1 hour

  let systemMessage: string | null = null;
  systemMessage = await redisClient.get(`system_message_${userId}`);
  if (!systemMessage) {
    systemMessage = await createSystemMessage(userId);
    await redisClient.set(`system_message_${userId}`, systemMessage, {
      EX: ttl,
    });
  }
  debug("User ID", userId);
  debug("System Message", systemMessage);

  // Load previous messages
  let prevMessages = await loadAndPreparePreviousMessages(userId, listKey, ttl);

  // Prepare new messages array
  let messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemMessage },
  ];
  if (prevMessages.length) messages = [...messages, ...prevMessages];
  messages.push(message);

  // Validate and possibly update messages in Redis
  const params: OpenAI.Chat.ChatCompletionCreateParams = {
    messages: messages,
    tools: tools,
    tool_choice: "auto",
    model: "gpt-4-0125-preview",
    stream: true,
  };
  debug("messages", messages);
  const stream = await openai.chat.completions.create(params);

  for await (const chunk of stream) {
    if (chunk.choices[0].finish_reason === "tool_calls") {
      yield "tool_calls";
      break;
    }
    yield chunk.choices[0]?.delta?.content;
  }
}

// export async function consumeChatStream(
//   userId: string,
//   message: OpenAI.Chat.ChatCompletionMessageParam,
//   time: string
// ) {
//   let finalResult = [];
//   let toolCallsDetected = false;

//   for await (const content of chatStream(userId, message, time)) {
//     if (content === "tool_calls") {
//       toolCallsDetected = true;
//       break;
//     }
//     finalResult.push(content);
//   }

//   if (toolCallsDetected) {
//     messages.push({
//       role: "assistant",
//       content: completion.choices[0].message.content || "",
//     });

//     let date = new Date();
//     let dateString = date.toISOString().replace("T", " ").substring(0, 19);

//     const newMessages: Message[] = [
//       { message: message, time: time },
//       { message: completion.choices[0].message, time: dateString },
//     ];

//     await saveNewMessages(userId, newMessages, listKey, ttl);

//     const useTools = completion.choices[0].finish_reason === "tool_calls";
//     if (useTools) {
//       const toolMessage = await handleToolCalls(userId, completion);
//       //   res.send(toolMessage);
//       return toolMessage;
//     }

//     return completion;
//   } else {
//     // Process the normal flow
//     return finalResult;
//   }
// }

async function loadAndPreparePreviousMessages(
  userId: string,
  listKey: string,
  ttl: number
) {
  const listExists = await redisClient.exists(listKey);
  let prevMessages = [];
  let originalLength = 0;

  if (!listExists) {
    prevMessages = await loadMessages(userId);
    debug("Previous messages from the databse", prevMessages);

    if (prevMessages.length) {
      const messageStrings = prevMessages.map((msg: any) =>
        JSON.stringify(msg)
      );
      for (let message of messageStrings) {
        await redisClient.rPush(`messages_${userId}`, message);
      }
      // Set TTL for the list if it's being created
      await redisClient.expire(listKey, ttl);
    }
  } else {
    prevMessages = (await redisClient.lRange(`messages_${userId}`, -10, -1))
      .reverse()
      .map((item) => JSON.parse(item));
    debug("Previous messages from Redis", prevMessages);
  }

  return prevMessages;
}

async function validateAndUpdateMessages(
  messages: any[],
  listKey: string,
  ttl: number
) {
  const originalLength = messages.length;
  validateMessages(messages); // Assuming this function modifies 'messages' array
  if (messages.length !== originalLength) {
    await redisClient.del(listKey);
    const messageStrings = messages
      .slice(1, -1)
      .map((msg) => JSON.stringify(msg));
    for (let message of messageStrings) {
      await redisClient.rPush(listKey, message);
    }
    await redisClient.expire(listKey, ttl);
  }
}

async function saveNewMessages(
  userId: string,
  newMessages: Message[],
  listKey: string,
  ttl: number
) {
  const listExists = await redisClient.exists(listKey);
  const messageStrings = newMessages.map((msg) => JSON.stringify(msg.message));
  debug("Message Strings", messageStrings);
  for (let message of messageStrings) {
    await redisClient.rPush(listKey, message);
  }
  if (!listExists) {
    await redisClient.expire(listKey, ttl);
  }
  await saveMessages(userId, newMessages);
}

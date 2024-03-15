import coreMemoryAppend from "../functions/core_memory_append";
import coreMemoryReplace from "../functions/core_memory_replace";
import conversationSearch from "../functions/conversation_search";
import conversationSearchDate from "../functions/conversation_search_date";
import archivalMemoryInsert from "../functions/archival_memory_insert";
import archivalMemorySearch from "../functions/archival_memory_search";
import OpenAI from "openai";
const debug = require("debug")("app:handleToolCalls");
import { FunctionCall } from "./llmClient";

export type ToolCall = {
  id: string;
  function: {
    name: string;
    arguments: any;
  };
};

async function handleToolCalls(
  userId: string,
  toolCall: ToolCall
): Promise<OpenAI.Chat.ChatCompletionToolMessageParam | undefined> {
  debug("calling handleToolCalls");
  const toolMessage: OpenAI.Chat.ChatCompletionToolMessageParam = {
    role: "tool",
    content: "memory updated successfully",
    tool_call_id: toolCall.id,
  };
  // messages.push(toolMessage);

  if (toolCall.function.name === "core_memory_append") {
    debug("calling core_memory_append");
    const memoryStatus = await coreMemoryAppend(
      userId,
      toolCall.function.arguments.name,
      toolCall.function.arguments.content
    );
    toolMessage.content = memoryStatus; // Assign an empty string if memoryStatus is null
    console.log(memoryStatus);
  } else if (toolCall.function.name === "core_memory_replace") {
    debug("calling core_memory_replace");
    await coreMemoryReplace(
      userId,
      toolCall.function.arguments.name,
      toolCall.function.arguments.old_content,
      toolCall.function.arguments.new_content
    );
  } else if (toolCall.function.name === "conversation_search") {
    debug("calling conversation_search", toolCall.function.arguments.query);
    const searchResult = await conversationSearch(
      userId,
      toolCall.function.arguments.query
    );
    debug(searchResult);
    toolMessage.content = searchResult;
    // } else if (
    //   completion.choices[0].message.tool_calls[0].function.name ===
    //   "conversation_search_date"
    // ) {
    //   console.log(
    //     "calling conversation_search_date",
    //     toolCallArguments.start_date,
    //     toolCallArguments.end_date
    //   );
    //   const searchResult = await conversationSearchDate(
    //     toolCallArguments.start_date,
    //     toolCallArguments.end_date
    //   );
    //   console.log(searchResult);
    //   toolMessage.content = searchResult;
  } else if (toolCall.function.name === "archival_memory_insert") {
    debug(
      "calling archival_memory_insert",
      toolCall.function.arguments.content
    );
    await archivalMemoryInsert(userId, toolCall.function.arguments.content);
  } else if (toolCall.function.name === "archival_memory_search") {
    debug("calling archival_memory_search", toolCall.function.arguments.query);
    await archivalMemorySearch(userId, toolCall.function.arguments.query);
  } else if (toolCall.function.name === "send_message") {
    debug("calling send_message", toolCall.function.arguments.message);
    toolMessage.content = toolCall.function.arguments.message;
  }

  return Promise.resolve(toolMessage);

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

export default handleToolCalls;

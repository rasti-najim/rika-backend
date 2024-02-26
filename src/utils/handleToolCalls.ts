import coreMemoryAppend from "../functions/core_memory_append";
import coreMemoryReplace from "../functions/core_memory_replace";
import conversationSearch from "../functions/conversation_search";
import conversationSearchDate from "../functions/conversation_search_date";
import archivalMemoryInsert from "../functions/archival_memory_insert";
import archivalMemorySearch from "../functions/archival_memory_search";
import OpenAI from "openai";

async function handleToolCalls(
  userId: string,
  completion: OpenAI.Chat.ChatCompletion
) {
  console.log("calling handleToolCalls");
  if (!completion.choices[0].message.tool_calls) {
    return;
  }
  const toolCallArguments = JSON.parse(
    completion.choices[0].message?.tool_calls[0].function.arguments
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
      toolCallArguments.name,
      toolCallArguments.content
    );
    console.log("calling core_memory_append");
    toolMessage.content = memoryStatus; // Assign an empty string if memoryStatus is null
    console.log(memoryStatus);
  } else if (
    completion.choices[0].message.tool_calls[0].function.name ===
    "core_memory_replace"
  ) {
    await coreMemoryReplace(
      userId,
      toolCallArguments.name,
      toolCallArguments.old_content,
      toolCallArguments.new_content
    );
  } else if (
    completion.choices[0].message.tool_calls[0].function.name ===
    "conversation_search"
  ) {
    console.log("calling conversation_search", toolCallArguments.query);
    const searchResult = await conversationSearch(
      userId,
      toolCallArguments.query
    );
    console.log(searchResult);
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
  } else if (
    completion.choices[0].message.tool_calls[0].function.name ===
    "archival_memory_insert"
  ) {
    console.log("calling archival_memory_insert", toolCallArguments.content);
    await archivalMemoryInsert(userId, toolCallArguments.content);
  } else if (
    completion.choices[0].message.tool_calls[0].function.name ===
    "archival_memory_search"
  ) {
    console.log("calling archival_memory_search", toolCallArguments.query);
    await archivalMemorySearch(userId, toolCallArguments.query);
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

export default handleToolCalls;

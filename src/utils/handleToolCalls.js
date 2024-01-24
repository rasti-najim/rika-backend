const coreMemoryAppend = require("../functions/core_memory_append");
const coreMemoryReplace = require("../functions/core_memory_replace");
const conversationSearch = require("../functions/conversation_search");
const conversationSearchDate = require("../functions/conversation_search_date");
const archivalMemoryInsert = require("../functions/archival_memory_insert");
const archivalMemorySearch = require("../functions/archival_memory_search");

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
      userId,
      arguments.name,
      arguments.old_content,
      arguments.new_content
    );
  } else if (
    completion.choices[0].message.tool_calls[0].function.name ===
    "conversation_search"
  ) {
    console.log("calling conversation_search", arguments.query);
    const searchResult = await conversationSearch(userId, arguments.query);
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

module.exports = handleToolCalls;

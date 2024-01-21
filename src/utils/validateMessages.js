function validateMessages(messages) {
  for (let i = 0; i < messages.length; ) {
    const current = messages[i];
    const next = messages[i + 1];
    const prev = i > 0 ? messages[i - 1] : null;

    let removeCurrent = false;

    if (
      current.role === "assistant" &&
      current.tool_calls &&
      current.tool_calls.length > 0
    ) {
      // Check if the next message is not in the correct format
      if (
        !next ||
        next.role !== "tool" ||
        next.tool_call_id !== current.tool_calls[0].id
      ) {
        removeCurrent = true;
      }
    } else if (current.role === "tool") {
      // Check if the previous message is not in the correct format
      if (
        !prev ||
        prev.role !== "assistant" ||
        !prev.tool_calls ||
        prev.tool_calls.length === 0 ||
        prev.tool_calls[0].id !== current.tool_call_id
      ) {
        removeCurrent = true;
      }
    }

    if (removeCurrent) {
      messages.splice(i, 1); // Remove the current message
    } else {
      i++; // Move to the next message
    }
  }
}

module.exports = validateMessages;

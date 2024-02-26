/**
 * Function to check if an assistant message is followed by its tool pair
 * @param {any} messages - The messages to check
 * @param {number} index - The index of the assistant message
 * @returns {boolean} - Whether the assistant message is paired with its tool
 */
function isPaired(messages: any, index: number): boolean {
  if (index < 0 || index >= messages.length - 1) return false;
  return (
    messages[index].role === "assistant" &&
    messages[index + 1].role === "tool" &&
    messages[index].tool_calls[0].id === messages[index + 1].tool_call_id
  );
}

export default isPaired;

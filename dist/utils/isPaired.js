// Function to check if an assistant message is followed by its tool pair
function isPaired(messages, index) {
    if (index < 0 || index >= messages.length - 1)
        return false;
    return (messages[index].role === "assistant" &&
        messages[index + 1].role === "tool" &&
        messages[index].tool_calls[0].id === messages[index + 1].tool_call_id);
}
module.exports = isPaired;

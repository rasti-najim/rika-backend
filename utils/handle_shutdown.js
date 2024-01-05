async function handleShutdown(signal, server) {
  console.log(`Received ${signal}. Shutting down gracefully.`);
  // Insert your cleanup code here. For example:
  // - Close database connections
  // - Finalize ongoing requests
  // - Close file streams

  const response = await fetch("http://localhost:8080/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        role: "user",
        content:
          "Warning: the conversation history will soon reach its maximum length and be trimmed. Make sure to save any important information from the conversation to your memory before it is removed.",
      },
    }),
  });

  const data = await response.json();

  console.log(data);

  server.close(() => {
    console.log("Server closed");
    // Ensure that the process exits after server closure
    process.exit(0);
  });
}

module.exports = handleShutdown;

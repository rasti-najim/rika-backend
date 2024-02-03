var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function handleShutdown(signal, server) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`Received ${signal}. Shutting down gracefully.`);
        // Insert your cleanup code here. For example:
        // - Close database connections
        // - Finalize ongoing requests
        // - Close file streams
        const response = yield fetch("http://localhost:8080/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message: {
                    role: "user",
                    content: "Warning: the conversation history will soon reach its maximum length and be trimmed. Make sure to save any important information from the conversation to your memory before it is removed.",
                },
            }),
        });
        const data = yield response.json();
        console.log(data);
        server.close(() => {
            console.log("Server closed");
            // Ensure that the process exits after server closure
            process.exit(0);
        });
    });
}
module.exports = handleShutdown;

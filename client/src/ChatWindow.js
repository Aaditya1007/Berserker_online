import React, { useState } from "react";

export default function ChatWindow({ messages, onSend }) {
  const [text, setText] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText("");
  }

  return (
    <div className="chat-window">
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i}>
            <strong>{m.author}:</strong> {m.text}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit}>
        <input
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}

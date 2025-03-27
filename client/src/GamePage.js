import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import BerserkerGame from "./BerserkerGame";
import ChatWindow from "./ChatWindow";

export default function GamePage({ gameId }) {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const s = io("http://localhost:3001");
    setSocket(s);

    s.emit("joinGame", gameId);

    s.on("updateGame", (newState) => {
      setGameState({ ...newState });
    });

    s.on("chatMessage", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      s.disconnect();
    };
  }, [gameId]);

  if (!socket || !gameState) {
    return <div>Loading game...</div>;
  }

  function handleCellClick(row, col) {
    // Make a move
    socket.emit("makeMove", { gameId, row, col });
  }

  function handleSendMessage(text) {
    // Send chat
    socket.emit("chatMessage", { gameId, author: gameState.currentPlayer, text });
  }

  return (
    <div style={{ textAlign: "center" }}>
      <h2>Current Player: {gameState.currentPlayer}</h2>
      <BerserkerGame gameState={gameState} onCellClick={handleCellClick} />
      {gameState.winner && <h3 style={{ color: "red" }}>{gameState.winner} WINS!</h3>}

      <div>
        <p>Red stash: {gameState.stash.red}</p>
        <p>White stash: {gameState.stash.white}</p>
      </div>

      <button onClick={() => setChatOpen(!chatOpen)}>
        {chatOpen ? "Close Chat" : "Open Chat"}
      </button>
      {chatOpen && (
        <ChatWindow messages={messages} onSend={handleSendMessage} />
      )}
    </div>
  );
}

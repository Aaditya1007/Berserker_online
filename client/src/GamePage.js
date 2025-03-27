import React, { useEffect, useState } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import BerserkerGame from "./BerserkerGame";
import ChatWindow from "./ChatWindow";

export default function GamePage() {
  const { gameId } = useParams();            // from /game/:gameId
  const [searchParams] = useSearchParams(); // to get ?name=...
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const name = searchParams.get("name") || "Player";
    const s = io("http://localhost:3001");
    setSocket(s);

    // Join the game room with the player's chosen name
    s.emit("joinGame", { gameId, name });

    // Listen for updates
    s.on("updateGame", (newState) => {
      setGameState({ ...newState });
    });

    s.on("chatMessage", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      s.disconnect();
    };
  }, [gameId, searchParams]);

  // If gameState is null, we haven't received data from the server yet
  if (!socket || !gameState) {
    return <div className="container">Loading game...</div>;
  }

  // Host check: compare your socket.id with gameState.players.host.socketId
  const isHost = gameState.players?.host?.socketId === socket.id;

  function handleCellClick(row, col) {
    socket.emit("makeMove", { gameId, row, col });
  }

  function handleReset() {
    // Only host can do this, but we hide the button for others
    socket.emit("startNewGame", gameId);
  }

  function handleSendChat(text) {
    // Let's label the author based on your color or name
    let author = "Unknown";
    if (socket.id === gameState.players.host.socketId) {
      author = gameState.players.host.name;
    } else if (socket.id === gameState.players.guest.socketId) {
      author = gameState.players.guest.name;
    }
    socket.emit("chatMessage", { gameId, author, text });
  }

  // convenience for labeling
  const hostName = gameState.players.host.name || "Host";
  const guestName = gameState.players.guest.name || "Guest";

  return (
    <div className="container">
      <h2>Berserker Online - Game ID: {gameId}</h2>

      <p>
        <strong>Red: </strong>
        {hostName} {gameState.players.host.socketId === socket.id ? "(You)" : ""}
      </p>
      <p>
        <strong>White: </strong>
        {guestName} {gameState.players.guest.socketId === socket.id ? "(You)" : ""}
      </p>

      <p>Current Player: {gameState.currentPlayer}</p>
      {gameState.winner && <h3 style={{ color: "red" }}>{gameState.winner.toUpperCase()} WINS!</h3>}

      <BerserkerGame
        board={gameState.board}
        onCellClick={handleCellClick}
      />

      <p>Red Stash: {gameState.stash.red} | White Stash: {gameState.stash.white}</p>

      {/* If host, show Reset Game button always */}
      {isHost && !gameState.winner && (
        <button onClick={handleReset}>Reset Game</button>
      )}

      {/* If there's a winner, host can also Start New Round */}
      {isHost && gameState.winner && (
        <button onClick={handleReset}>Start New Round</button>
      )}

      <div>
        <button onClick={() => setChatOpen(!chatOpen)}>
          {chatOpen ? "Close Chat" : "Open Chat"}
        </button>
      </div>
      {chatOpen && (
        <ChatWindow messages={messages} onSend={handleSendChat} />
      )}
    </div>
  );
}

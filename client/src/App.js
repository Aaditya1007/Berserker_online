import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import GamePage from "./GamePage";

/**
 * If there's a :gameId param, we show the GamePage.
 * Otherwise, we show a home screen with an input for the player's name
 * and a "Create Game" button that calls our server to get a new gameId.
 */
export default function App() {
  const navigate = useNavigate();
  const { gameId } = useParams(); // e.g. /game/:gameId
  const [name, setName] = useState("");

  async function handleCreateGame() {
    // Call the server to create a new game
    const res = await fetch("http://localhost:3001/create-game");
    const data = await res.json();
    // Navigate to /game/:gameId with the name included as a query param
    navigate(`/game/${data.gameId}?name=${encodeURIComponent(name)}`);
  }

  if (gameId) {
    // We are in the game route => show the game page
    return <GamePage />;
  }

  // Otherwise, home screen
  return (
    <div className="container">
      <h1>Berserker Online</h1>
      <p>Enter your name to create a new game:</p>
      <input
        placeholder="Your Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <br />
      <button onClick={handleCreateGame}>Create Game</button>
    </div>
  );
}

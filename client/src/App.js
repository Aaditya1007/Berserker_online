import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import GamePage from "./GamePage";

export default function App() {
  const navigate = useNavigate();
  const { gameId } = useParams(); // e.g. "/game/:gameId"

  async function handleCreateGame() {
    const res = await fetch("http://localhost:3001/create-game");
    const data = await res.json();
    navigate(`/game/${data.gameId}`);
  }

  if (gameId) {
    // We’re in a game route
    return <GamePage gameId={gameId} />;
  }

  // Home screen
  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>Welcome to Berserker!</h1>
      <button onClick={handleCreateGame}>Create New Game</button>
    </div>
  );
}

import React from "react";
import "./index.css"; // or your CSS

const BOARD_SIZE = 6;

export default function BerserkerGame({ gameState, onCellClick }) {
  const board = gameState.board;
  
  return (
    <div className="berserker-board">
      {board.map((rowArr, r) =>
        rowArr.map((cell, c) => {
          return (
            <div
              key={`${r}-${c}`}
              className="berserker-cell"
              onClick={() => onCellClick(r, c)}
            >
              {cell === "red" && <img className="pawn-sprite" src="/red-pawn.gif" alt="Red" />}
              {cell === "white" && <img className="pawn-sprite" src="/white-pawn.gif" alt="White" />}
            </div>
          );
        })
      )}
    </div>
  );
}

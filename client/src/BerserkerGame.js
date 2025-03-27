import React from "react";

/**
 * Simple presentational component that renders the 6x6 board.
 * If a cell is "red" or "white", display the corresponding .gif
 * onCellClick => calls the parent to do makeMove via socket
 */
export default function BerserkerGame({ board, onCellClick }) {
  if (!board) return null;

  return (
    <div className="berserker-board">
      {board.map((rowArr, rowIndex) =>
        rowArr.map((cell, colIndex) => (
          <div
            key={`${rowIndex}-${colIndex}`}
            className="berserker-cell"
            onClick={() => onCellClick(rowIndex, colIndex)}
          >
            {cell === "red" && (
              <img
                src="/red-pawn.gif"
                alt="Red"
                className="pawn-sprite"
              />
            )}
            {cell === "white" && (
              <img
                src="/white-pawn.gif"
                alt="White"
                className="pawn-sprite"
              />
            )}
          </div>
        ))
      )}
    </div>
  );
}

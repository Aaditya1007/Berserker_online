/********************************************************************
 * Run this server with:
 *    npm install express socket.io cors
 *    node server.js
 * Then it listens on port 3001 by default.
 ********************************************************************/
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors()); // so the React client (on port 3000) can connect

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// We'll store all games in memory: { [gameId]: gameState }
const gameStates = {};

// Basic constants for a 6x6 board
const BOARD_SIZE = 6;
function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

// Initial stash of 8 pawns for each color
const INITIAL_STASH = 8;

function createNewGameState() {
  return {
    board: createEmptyBoard(),
    stash: { red: INITIAL_STASH, white: INITIAL_STASH },
    currentPlayer: "red",
    winner: null,
  };
}

// Helper checks
function isValid(r, c) {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

// Single occupant push logic
function canPushOne(r, c, dr, dc, brd) {
  if (!isValid(r, c) || brd[r][c] === null) return null;
  const nr = r + dr;
  const nc = c + dc;
  // Off-board => occupant falls off
  if (!isValid(nr, nc)) {
    return { type: "offBoard", fromR: r, fromC: c };
  }
  // If next cell is empty => occupant moves there
  if (brd[nr][nc] === null) {
    return { type: "move", fromR: r, fromC: c, toR: nr, toC: nc };
  }
  // Otherwise blocked
  return null;
}

const directions = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [-1, 1], [1, -1], [1, 1],
];

function checkWin(brd) {
  function checkLine(r, c, dr, dc, color) {
    for (let i = 0; i < 3; i++) {
      const rr = r + dr * i;
      const cc = c + dc * i;
      if (!isValid(rr, cc) || brd[rr][cc] !== color) return false;
    }
    return true;
  }

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const color = brd[r][c];
      if (color) {
        if (
          checkLine(r, c, 1, 0, color) ||
          checkLine(r, c, 0, 1, color) ||
          checkLine(r, c, 1, 1, color) ||
          checkLine(r, c, 1, -1, color)
        ) {
          return color;
        }
      }
    }
  }
  return null;
}

/**
 * Applies a move: place currentPlayer's pawn at (row,col)
 * if that cell is empty and stash is > 0. Then do single push checks.
 * If a piece is pushed off, increment that color's stash.
 * Then check for winner, switch player if no immediate winner.
 */
function applyMove(gameState, row, col) {
  if (gameState.winner) return; // ignore moves if we already have a winner

  const { board, stash, currentPlayer } = gameState;

  if (!isValid(row, col)) return;
  if (board[row][col] !== null) return;
  if (stash[currentPlayer] <= 0) return;

  // Place new pawn
  board[row][col] = currentPlayer;
  stash[currentPlayer]--;

  // Attempt to push adjacent occupants
  directions.forEach(([dr, dc]) => {
    const adjR = row + dr;
    const adjC = col + dc;
    if (isValid(adjR, adjC) && board[adjR][adjC]) {
      const action = canPushOne(adjR, adjC, dr, dc, board);
      if (action) {
        if (action.type === "offBoard") {
          const pushedColor = board[action.fromR][action.fromC];
          board[action.fromR][action.fromC] = null;
          // Return that piece to stash
          stash[pushedColor]++;
        } else if (action.type === "move") {
          const occupant = board[action.fromR][action.fromC];
          board[action.toR][action.toC] = occupant;
          board[action.fromR][action.fromC] = null;
        }
      }
    }
  });

  // Check winner
  const maybeWinner = checkWin(board);
  if (maybeWinner) {
    gameState.winner = maybeWinner;
  } else {
    // Switch player
    gameState.currentPlayer = currentPlayer === "red" ? "white" : "red";
  }
}

// API endpoint to create a new game (returns gameId)
app.get("/create-game", (req, res) => {
  const gameId = uuidv4();
  const newGame = createNewGameState();
  gameStates[gameId] = newGame;
  res.json({ gameId });
});

io.on("connection", (socket) => {
  // Player joins a game room
  socket.on("joinGame", (gameId) => {
    socket.join(gameId);

    // If game doesn't exist, create it
    if (!gameStates[gameId]) {
      gameStates[gameId] = createNewGameState();
    }

    // Send the latest state to just this socket
    socket.emit("updateGame", gameStates[gameId]);
  });

  // Player attempts a move
  // { gameId, row, col }
  socket.on("makeMove", ({ gameId, row, col }) => {
    const game = gameStates[gameId];
    if (!game) return;

    applyMove(game, row, col);

    // Broadcast updated state to all in that room
    io.to(gameId).emit("updateGame", game);
  });

  // Player sends chat message
  // { gameId, author, text }
  socket.on("chatMessage", ({ gameId, author, text }) => {
    io.to(gameId).emit("chatMessage", { author, text });
  });
});

server.listen(3001, () => {
  console.log("Server listening on http://localhost:3001");
});

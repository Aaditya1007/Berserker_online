/**********************************************************************
 * server.js
 *
 * Node + Socket.IO server for Berserker Online.
 * 1) Creates and stores game states in-memory.
 * 2) Each game has host + guest players with names.
 * 3) Pushing logic and stash-based winning condition.
 * 4) Chat messaging.
 **********************************************************************/
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// In-memory store of all game states
const gameStates = {};

const BOARD_SIZE = 6;
const INITIAL_STASH = 8;

// Helper: create empty board
function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array(BOARD_SIZE).fill(null)
  );
}

// Initialize a new game state
function createNewGameState() {
  return {
    board: createEmptyBoard(),
    stash: { red: INITIAL_STASH, white: INITIAL_STASH },
    currentPlayer: "red",
    winner: null,
    players: {
      host: { socketId: "", name: "", color: "red" },
      guest: { socketId: "", name: "", color: "white" },
    },
  };
}

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

// Check for 3 in a row
function check3InRow(brd) {
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
 * The main "place a pawn" logic. If stash[currentPlayer]>0 and cell is empty,
 * place a piece, do single-occupant pushes, check winner.
 */
function applyMove(gameState, row, col) {
  if (gameState.winner) return; // ignore if there's already a winner

  const { board, stash, currentPlayer } = gameState;
  if (!isValid(row, col)) return;
  if (board[row][col] !== null) return;
  if (stash[currentPlayer] <= 0) return; // no more pawns to place

  // Place the pawn
  board[row][col] = currentPlayer;
  stash[currentPlayer]--;

  // Attempt pushing
  directions.forEach(([dr, dc]) => {
    const adjR = row + dr;
    const adjC = col + dc;
    if (isValid(adjR, adjC) && board[adjR][adjC]) {
      const action = canPushOne(adjR, adjC, dr, dc, board);
      if (action) {
        if (action.type === "offBoard") {
          const pushedColor = board[action.fromR][action.fromC];
          board[action.fromR][action.fromC] = null;
          stash[pushedColor]++; // occupant returns to stash
        } else if (action.type === "move") {
          const occupant = board[action.fromR][action.fromC];
          board[action.toR][action.toC] = occupant;
          board[action.fromR][action.fromC] = null;
        }
      }
    }
  });

  // Check extra win condition: if stash[currentPlayer] == 0 => placed all 8
  if (stash[currentPlayer] === 0) {
    gameState.winner = currentPlayer;
    return;
  }

  // Also check 3 in a row
  const maybeWin3 = check3InRow(board);
  if (maybeWin3) {
    gameState.winner = maybeWin3;
    return;
  }

  // No winner => switch player
  gameState.currentPlayer = (currentPlayer === "red") ? "white" : "red";
}

// Create a new game (GET request)
app.get("/create-game", (req, res) => {
  const gameId = uuidv4();
  gameStates[gameId] = createNewGameState();
  res.json({ gameId });
});

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Player joining a game, providing their name
  socket.on("joinGame", ({ gameId, name }) => {
    socket.join(gameId);

    if (!gameStates[gameId]) {
      // If there's no game with that ID, we could create or just ignore
      gameStates[gameId] = createNewGameState();
    }

    const g = gameStates[gameId];

    // If host is not set, or host socketId is empty => this user is host
    if (!g.players.host.socketId) {
      g.players.host.socketId = socket.id;
      g.players.host.name = name;
    } 
    // Else if guest isn't set => this user is guest
    else if (!g.players.guest.socketId) {
      g.players.guest.socketId = socket.id;
      g.players.guest.name = name;
    } 
    // else possibly a 3rd user (spectator?), up to you

    io.to(gameId).emit("updateGame", g);
  });

  // Player attempts to place a pawn at (row,col)
  socket.on("makeMove", ({ gameId, row, col }) => {
    const g = gameStates[gameId];
    if (!g) return;

    applyMove(g, row, col);
    io.to(gameId).emit("updateGame", g);
  });

  // Host only: start a new round with same players
  socket.on("startNewGame", (gameId) => {
    const g = gameStates[gameId];
    if (!g) return;

    // only allow host
    if (g.players.host.socketId !== socket.id) {
      return; // ignore if non-host tries
    }

    // Re-init the board, stash, winner, but keep the same players
    const oldPlayers = g.players;
    const newGame = createNewGameState();
    newGame.players = oldPlayers;
    gameStates[gameId] = newGame;

    io.to(gameId).emit("updateGame", newGame);
  });

  // Chat
  socket.on("chatMessage", ({ gameId, author, text }) => {
    io.to(gameId).emit("chatMessage", { author, text });
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  });
});

server.listen(3001, () => {
  console.log("Server listening on http://localhost:3001");
});

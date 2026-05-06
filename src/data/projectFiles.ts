// All project file contents for the Telegram Bot
export interface TreeNode {
  name: string;
  type: 'file' | 'folder';
  path?: string;
  children?: TreeNode[];
}

export interface ProjectFile {
  path: string;
  language: string;
  description: string;
  content: string;
}

export const projectFiles: ProjectFile[] = [
  {
    path: "package.json",
    language: "json",
    description: "Project dependencies and scripts",
    content: `{
  "name": "telegram-multiplayer-game-bot",
  "version": "1.0.0",
  "description": "Advanced AI-powered multiplayer Telegram game bot",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "echo \\"No tests configured\\" && exit 0"
  },
  "dependencies": {
    "telegraf": "^4.16.3",
    "express": "^4.18.2",
    "ws": "^8.16.0",
    "mongoose": "^8.2.0",
    "axios": "^1.6.7",
    "dotenv": "^16.4.4",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "author": "Your Name",
  "license": "MIT"
}`
  },
  {
    path: ".env.example",
    language: "bash",
    description: "Environment variables template",
    content: `# =============================================
# TELEGRAM BOT CONFIGURATION
# =============================================
BOT_TOKEN=8392101543:AAF_vP6_Y-5lSTJ3O8ZvFFT0pI_2_wTgebE

# =============================================
# MONGODB CONNECTION
# =============================================
MONGODB_URI=mongodb://localhost:27017/telegram_game_bot

# =============================================
# OPENROUTER AI API
# =============================================
OPENROUTER_API_KEY=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

# =============================================
# SERVER CONFIGURATION
# =============================================
PORT=3000
NODE_ENV=production`
  },
  {
    path: "server.js",
    language: "javascript",
    description: "Main entry point — Express + WebSocket + Bot launcher",
    content: `/**
 * server.js — Main Entry Point
 * Starts Express HTTP server, WebSocket server, and Telegram bot
 */

// Load environment variables from .env file (fallback to defaults if missing)
require('dotenv').config();

const express = require('express');
const { createServer } = require('http');
const WebSocket = require('ws');
const { connectDatabase } = require('./src/database/connection');
const bot = require('./src/bot/bot');

// ─── Configuration with fallbacks ────────────────────────────────────────────
const CONFIG = {
  BOT_TOKEN: process.env.BOT_TOKEN || '8392101543:AAF_vP6_Y-5lSTJ3O8ZvFFT0pI_2_wTgebE',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/telegram_game_bot',
  PORT: parseInt(process.env.PORT || '3000'),
  NODE_ENV: process.env.NODE_ENV || 'development',
};

// Export config so other modules can use it
global.CONFIG = CONFIG;

// ─── Express App Setup ────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    bot: 'running',
  });
});

// Status endpoint
app.get('/status', (req, res) => {
  res.json({
    message: 'Telegram Multiplayer Game Bot is running!',
    version: '1.0.0',
    features: ['Tic Tac Toe', 'Quiz Battle', 'Coin System', 'Leaderboard', 'AI Opponent'],
  });
});

// ─── HTTP Server ──────────────────────────────────────────────────────────────
const httpServer = createServer(app);

// ─── WebSocket Server ─────────────────────────────────────────────────────────
const wss = new WebSocket.Server({ server: httpServer });

// Store connected clients mapped by userId
const wsClients = new Map();
global.wsClients = wsClients;

wss.on('connection', (ws, req) => {
  console.log('🔌 New WebSocket connection established');

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      // Register client with userId for targeted messaging
      if (message.type === 'register' && message.userId) {
        wsClients.set(message.userId.toString(), ws);
        ws.userId = message.userId.toString();
        ws.send(JSON.stringify({ type: 'registered', userId: message.userId }));
        console.log(\`✅ WebSocket client registered: userId=\${message.userId}\`);
      }
    } catch (err) {
      console.error('WebSocket message parse error:', err.message);
    }
  });

  ws.on('close', () => {
    // Clean up when client disconnects
    if (ws.userId) {
      wsClients.delete(ws.userId);
      console.log(\`❌ WebSocket client disconnected: userId=\${ws.userId}\`);
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });

  // Send welcome message
  ws.send(JSON.stringify({ type: 'welcome', message: 'Connected to Game Server' }));
});

/**
 * Broadcast a message to a specific user via WebSocket
 * @param {string} userId - Telegram user ID
 * @param {object} data - Data to send
 */
function broadcastToUser(userId, data) {
  const client = wsClients.get(userId.toString());
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(data));
  }
}

global.broadcastToUser = broadcastToUser;

// ─── Startup Sequence ─────────────────────────────────────────────────────────
async function startServer() {
  try {
    // 1. Connect to MongoDB
    console.log('📦 Connecting to MongoDB...');
    await connectDatabase(CONFIG.MONGODB_URI);
    console.log('✅ MongoDB connected successfully');

    // 2. Start HTTP + WebSocket server
    httpServer.listen(CONFIG.PORT, () => {
      console.log(\`🚀 Server running on port \${CONFIG.PORT}\`);
      console.log(\`🌐 Health check: http://localhost:\${CONFIG.PORT}/health\`);
    });

    // 3. Launch Telegram Bot
    console.log('🤖 Launching Telegram Bot...');
    await bot.launch({ allowedUpdates: ['message', 'callback_query'] });
    console.log('✅ Telegram Bot is online and listening!');

    // Graceful shutdown handlers
    process.once('SIGINT', () => {
      console.log('\\n🛑 SIGINT received — shutting down gracefully...');
      bot.stop('SIGINT');
      httpServer.close();
      process.exit(0);
    });

    process.once('SIGTERM', () => {
      console.log('\\n🛑 SIGTERM received — shutting down gracefully...');
      bot.stop('SIGTERM');
      httpServer.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Fatal startup error:', error.message);
    process.exit(1);
  }
}

startServer();`
  },
  {
    path: "src/bot/bot.js",
    language: "javascript",
    description: "Telegraf bot instance + middleware + command registration",
    content: `/**
 * src/bot/bot.js — Telegraf Bot Core
 * Initializes the bot with all middleware and registers all command handlers
 */

const { Telegraf, session } = require('telegraf');
const { getOrCreateUser } = require('../database/userModel');
const { antiSpam } = require('../utils/antiSpam');

// ─── Initialize Bot ───────────────────────────────────────────────────────────
const BOT_TOKEN = (global.CONFIG && global.CONFIG.BOT_TOKEN) ||
  process.env.BOT_TOKEN ||
  '8392101543:AAF_vP6_Y-5lSTJ3O8ZvFFT0pI_2_wTgebE';

const bot = new Telegraf(BOT_TOKEN);

// ─── Session Middleware ───────────────────────────────────────────────────────
// Stores temporary in-memory session data per chat
bot.use(session());

// ─── User Auto-Registration Middleware ───────────────────────────────────────
bot.use(async (ctx, next) => {
  try {
    if (ctx.from) {
      // Ensure user exists in database on every interaction
      await getOrCreateUser({
        telegramId: ctx.from.id,
        username: ctx.from.username || 'Anonymous',
        firstName: ctx.from.first_name || 'Player',
      });
    }
    return next();
  } catch (err) {
    console.error('User middleware error:', err.message);
    return next();
  }
});

// ─── Anti-Spam Middleware ─────────────────────────────────────────────────────
bot.use(async (ctx, next) => {
  if (ctx.from && antiSpam(ctx.from.id)) {
    return ctx.reply('⏳ Please slow down! You are sending messages too quickly.');
  }
  return next();
});

// ─── Import Command Handlers ──────────────────────────────────────────────────
const startCommand = require('./commands/start');
const playCommand = require('./commands/play');
const balanceCommand = require('./commands/balance');
const leaderboardCommand = require('./commands/leaderboard');
const tictactoeCommand = require('./commands/tictactoe');
const quizCommand = require('./commands/quiz');
const betCommand = require('./commands/bet');
const aiChatCommand = require('./commands/aiChat');

// ─── Register Commands ────────────────────────────────────────────────────────
bot.command('start', startCommand);
bot.command('play', playCommand);
bot.command('balance', balanceCommand);
bot.command('leaderboard', leaderboardCommand);
bot.command('tictactoe', tictactoeCommand);
bot.command('quiz', quizCommand);
bot.command('bet', betCommand);
bot.command('ai', aiChatCommand);
bot.command('help', (ctx) => {
  ctx.reply(\`🎮 *Game Bot Commands*

*🎯 Games:*
/tictactoe — Play Tic Tac Toe (vs AI or Player)
/quiz — Start a Quiz Battle
/play — Quick play menu

*💰 Economy:*
/balance — Check your coins
/bet [amount] — Bet coins in next game

*🏆 Rankings:*
/leaderboard — View top players

*🤖 AI:*
/ai [message] — Chat with AI assistant

*ℹ️ Info:*
/start — Welcome message
/help — This help menu\`, { parse_mode: 'Markdown' });
});

// ─── Callback Query Handler ───────────────────────────────────────────────────
// Routes all inline keyboard button presses to appropriate handlers
const { handleTicTacToeCallback } = require('./games/tictactoe/tictactoeGame');
const { handleQuizCallback } = require('./games/quiz/quizGame');

bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;

  try {
    // Route based on callback data prefix
    if (data.startsWith('ttt_')) {
      await handleTicTacToeCallback(ctx);
    } else if (data.startsWith('quiz_')) {
      await handleQuizCallback(ctx);
    } else if (data.startsWith('play_')) {
      // Handle play menu selections
      if (data === 'play_ttt_ai') {
        await tictactoeCommand(ctx, 'ai');
      } else if (data === 'play_ttt_pvp') {
        await tictactoeCommand(ctx, 'pvp');
      } else if (data === 'play_quiz') {
        await quizCommand(ctx);
      }
    } else {
      await ctx.answerCbQuery('Unknown action');
    }
  } catch (err) {
    console.error('Callback query error:', err.message);
    try {
      await ctx.answerCbQuery('An error occurred. Please try again.');
    } catch (e) {
      // Ignore if already answered
    }
  }
});

// ─── Error Handler ────────────────────────────────────────────────────────────
bot.catch((err, ctx) => {
  console.error(\`Bot error for \${ctx.updateType}:\`, err.message);
  ctx.reply('❌ An unexpected error occurred. Please try again later.').catch(() => {});
});

module.exports = bot;`
  },
  {
    path: "src/bot/commands/start.js",
    language: "javascript",
    description: "/start command handler",
    content: `/**
 * src/bot/commands/start.js — /start Command
 * Welcomes new users and shows the main menu
 */

const { getUserByTelegramId } = require('../../database/userModel');
const { Markup } = require('telegraf');

module.exports = async (ctx) => {
  const userId = ctx.from.id;

  // Get user data from database
  const user = await getUserByTelegramId(userId);
  const firstName = ctx.from.first_name || 'Player';

  const welcomeMessage = \`🎮 *Welcome to the Multiplayer Game Bot, \${firstName}!*

You have *\${user ? user.coins : 100} coins* 💰

Choose what you want to do:\`;

  // Create inline keyboard for main menu
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('🎮 Play Games', 'play_menu'),
      Markup.button.callback('💰 Balance', 'balance_menu'),
    ],
    [
      Markup.button.callback('🏆 Leaderboard', 'leaderboard_menu'),
      Markup.button.callback('❓ Help', 'help_menu'),
    ],
    [
      Markup.button.callback('🤖 Chat with AI', 'ai_menu'),
    ],
  ]);

  await ctx.reply(welcomeMessage, {
    parse_mode: 'Markdown',
    ...keyboard,
  });
};`
  },
  {
    path: "src/bot/commands/play.js",
    language: "javascript",
    description: "/play command — game selection menu",
    content: `/**
 * src/bot/commands/play.js — /play Command
 * Shows the game selection menu with inline keyboard
 */

const { Markup } = require('telegraf');

module.exports = async (ctx) => {
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('🎮 Tic Tac Toe vs AI', 'play_ttt_ai'),
      Markup.button.callback('👥 Tic Tac Toe PvP', 'play_ttt_pvp'),
    ],
    [
      Markup.button.callback('🧠 Quiz Battle', 'play_quiz'),
    ],
  ]);

  await ctx.reply(
    \`🕹️ *Choose Your Game*

🎮 *Tic Tac Toe vs AI* — Challenge our OpenRouter-powered AI
👥 *Tic Tac Toe PvP* — Challenge another player
🧠 *Quiz Battle* — Test your knowledge in real-time

*Entry fee:* 10 coins per game 💰\`,
    {
      parse_mode: 'Markdown',
      ...keyboard,
    }
  );
};`
  },
  {
    path: "src/bot/commands/balance.js",
    language: "javascript",
    description: "/balance command handler",
    content: `/**
 * src/bot/commands/balance.js — /balance Command
 * Shows the user's current coin balance and stats
 */

const { getUserByTelegramId } = require('../../database/userModel');

module.exports = async (ctx) => {
  const userId = ctx.from.id;

  const user = await getUserByTelegramId(userId);

  if (!user) {
    return ctx.reply('❌ User not found. Please send /start first.');
  }

  const winRate = user.totalGames > 0
    ? ((user.wins / user.totalGames) * 100).toFixed(1)
    : '0.0';

  await ctx.reply(
    \`💰 *Your Balance & Stats*

👤 *Player:* \${user.firstName || user.username}
💰 *Coins:* \${user.coins.toLocaleString()}
🏆 *Wins:* \${user.wins}
💔 *Losses:* \${user.losses}
🤝 *Draws:* \${user.draws}
🎮 *Total Games:* \${user.totalGames}
📈 *Win Rate:* \${winRate}%
🧠 *Quiz Score:* \${user.quizScore} points

_Daily bonus: Come back tomorrow for +50 coins!_\`,
    { parse_mode: 'Markdown' }
  );
};`
  },
  {
    path: "src/bot/commands/leaderboard.js",
    language: "javascript",
    description: "/leaderboard command handler",
    content: `/**
 * src/bot/commands/leaderboard.js — /leaderboard Command
 * Shows top 10 players by coins and wins
 */

const { getLeaderboard } = require('../../database/userModel');
const { Markup } = require('telegraf');

module.exports = async (ctx) => {
  // Fetch top 10 players sorted by coins
  const topByCoins = await getLeaderboard('coins', 10);
  const topByWins = await getLeaderboard('wins', 10);

  // Format coins leaderboard
  const coinsBoard = topByCoins.map((user, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : \`\${i + 1}.\`;
    const name = user.firstName || user.username || 'Anonymous';
    return \`\${medal} \${name} — \${user.coins.toLocaleString()} 💰\`;
  }).join('\\n');

  // Format wins leaderboard
  const winsBoard = topByWins.map((user, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : \`\${i + 1}.\`;
    const name = user.firstName || user.username || 'Anonymous';
    return \`\${medal} \${name} — \${user.wins} wins\`;
  }).join('\\n');

  await ctx.reply(
    \`🏆 *LEADERBOARD*

💰 *Top Players by Coins:*
\${coinsBoard || 'No players yet'}

🏆 *Top Players by Wins:*
\${winsBoard || 'No players yet'}

_Play more games to climb the ranks!_\`,
    { parse_mode: 'Markdown' }
  );
};`
  },
  {
    path: "src/bot/commands/tictactoe.js",
    language: "javascript",
    description: "/tictactoe command — starts Tic Tac Toe game",
    content: `/**
 * src/bot/commands/tictactoe.js — /tictactoe Command
 * Starts a Tic Tac Toe game (AI or PvP mode)
 */

const { Markup } = require('telegraf');
const { startTicTacToeGame } = require('../games/tictactoe/tictactoeGame');
const { getUserByTelegramId, deductCoins } = require('../../database/userModel');

const ENTRY_FEE = 10; // Coins required to start a game

module.exports = async (ctx, mode = null) => {
  const userId = ctx.from.id;
  const user = await getUserByTelegramId(userId);

  if (!user) {
    return ctx.reply('❌ Please send /start first to register.');
  }

  // Check if user has enough coins
  if (user.coins < ENTRY_FEE) {
    return ctx.reply(
      \`❌ *Not enough coins!*

You need *\${ENTRY_FEE} coins* to play.
You have: *\${user.coins} coins*

_Come back tomorrow for your daily bonus!_\`,
      { parse_mode: 'Markdown' }
    );
  }

  // If mode not specified, show selection menu
  if (!mode) {
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('🤖 vs AI', 'play_ttt_ai'),
        Markup.button.callback('👥 vs Player (PvP)', 'play_ttt_pvp'),
      ],
      [Markup.button.callback('❌ Cancel', 'cancel_game')],
    ]);

    return ctx.reply(
      \`🎮 *Tic Tac Toe*

Choose your game mode:
🤖 *vs AI* — Play against OpenRouter-powered AI
👥 *vs Player* — Challenge another player

*Entry fee:* \${ENTRY_FEE} coins 💰
*Your balance:* \${user.coins} coins\`,
      { parse_mode: 'Markdown', ...keyboard }
    );
  }

  // Deduct entry fee
  await deductCoins(userId, ENTRY_FEE);

  // Start the game based on mode
  await startTicTacToeGame(ctx, mode);
};`
  },
  {
    path: "src/bot/commands/quiz.js",
    language: "javascript",
    description: "/quiz command — starts Quiz Battle",
    content: `/**
 * src/bot/commands/quiz.js — /quiz Command
 * Starts a Quiz Battle session
 */

const { startQuizGame } = require('../games/quiz/quizGame');
const { getUserByTelegramId, deductCoins } = require('../../database/userModel');

const ENTRY_FEE = 10;

module.exports = async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUserByTelegramId(userId);

  if (!user) {
    return ctx.reply('❌ Please send /start first to register.');
  }

  if (user.coins < ENTRY_FEE) {
    return ctx.reply(
      \`❌ *Not enough coins!*
You need \${ENTRY_FEE} coins to enter a quiz.
Your balance: \${user.coins} coins\`,
      { parse_mode: 'Markdown' }
    );
  }

  // Deduct entry fee
  await deductCoins(userId, ENTRY_FEE);

  // Start quiz session
  await startQuizGame(ctx);
};`
  },
  {
    path: "src/bot/commands/bet.js",
    language: "javascript",
    description: "/bet command — betting system",
    content: `/**
 * src/bot/commands/bet.js — /bet Command
 * Allows users to set a bet for their next game
 */

const { getUserByTelegramId, updateUserBet } = require('../../database/userModel');

module.exports = async (ctx) => {
  const userId = ctx.from.id;
  const args = ctx.message.text.split(' ');

  if (args.length < 2 || isNaN(parseInt(args[1]))) {
    return ctx.reply(
      \`💰 *Betting System*

Usage: \`/bet [amount]\`
Example: \`/bet 50\`

Your bet will be added to the prize pool for your next game.
*Winner takes all!*\`,
      { parse_mode: 'Markdown' }
    );
  }

  const betAmount = parseInt(args[1]);

  if (betAmount < 10) {
    return ctx.reply('❌ Minimum bet is 10 coins.');
  }

  if (betAmount > 1000) {
    return ctx.reply('❌ Maximum bet is 1000 coins per game.');
  }

  const user = await getUserByTelegramId(userId);

  if (!user) return ctx.reply('❌ Please /start first.');

  if (user.coins < betAmount) {
    return ctx.reply(
      \`❌ Not enough coins!
Bet: \${betAmount} 💰
Your balance: \${user.coins} 💰\`
    );
  }

  // Save pending bet to user profile
  await updateUserBet(userId, betAmount);

  await ctx.reply(
    \`✅ *Bet set successfully!*

💰 *Your bet:* \${betAmount} coins
🎮 Start a game with /tictactoe or /quiz

_Your bet will be deducted when the game starts. Winner earns double!_\`,
    { parse_mode: 'Markdown' }
  );
};`
  },
  {
    path: "src/bot/commands/aiChat.js",
    language: "javascript",
    description: "/ai command — chat with OpenRouter AI",
    content: `/**
 * src/bot/commands/aiChat.js — /ai Command
 * Lets users chat directly with the OpenRouter AI
 */

const { askAI } = require('../../ai/openrouter');

module.exports = async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1).join(' ');

  if (!args.trim()) {
    return ctx.reply(
      \`🤖 *AI Chat Mode*

Usage: \`/ai [your message]\`
Example: \`/ai Tell me a fun fact about space\`

I'm powered by OpenRouter AI (GPT model)!\`,
      { parse_mode: 'Markdown' }
    );
  }

  // Show "typing..." indicator
  await ctx.sendChatAction('typing');

  try {
    const response = await askAI([
      {
        role: 'system',
        content: 'You are a helpful, friendly assistant inside a Telegram game bot. Keep responses concise and fun.',
      },
      {
        role: 'user',
        content: args,
      },
    ]);

    await ctx.reply(\`🤖 *AI Response:*\\n\\n\${response}\`, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('AI Chat error:', err.message);
    await ctx.reply('❌ AI is unavailable right now. Please try again later.');
  }
};`
  },
  {
    path: "src/bot/games/tictactoe/tictactoeGame.js",
    language: "javascript",
    description: "Tic Tac Toe game logic — PvP and AI modes",
    content: `/**
 * src/bot/games/tictactoe/tictactoeGame.js — Tic Tac Toe Core
 * Handles game state, move validation, win detection, and AI mode
 */

const { Markup } = require('telegraf');
const { getAITicTacToeMove } = require('../../../ai/openrouter');
const { updateUserStats, addCoins } = require('../../../database/userModel');
const { saveMatchHistory } = require('../../../database/matchHistory');
const { v4: uuidv4 } = require('uuid');

// ─── In-Memory Game Store ─────────────────────────────────────────────────────
// Maps gameId → game state (stored in memory for speed)
const activeGames = new Map();

// Maps userId → gameId (to prevent duplicate sessions)
const userToGame = new Map();

// ─── Board Symbols ────────────────────────────────────────────────────────────
const SYMBOLS = { X: '❌', O: '⭕', EMPTY: '⬜' };
const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6],             // diagonals
];

// ─── Create Empty Board ───────────────────────────────────────────────────────
function createEmptyBoard() {
  return Array(9).fill(null); // null = empty cell
}

// ─── Check Winner ─────────────────────────────────────────────────────────────
function checkWinner(board) {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]; // Returns 'X' or 'O'
    }
  }
  return null;
}

// ─── Check Draw ───────────────────────────────────────────────────────────────
function isDraw(board) {
  return board.every((cell) => cell !== null) && !checkWinner(board);
}

// ─── Build Inline Keyboard from Board ────────────────────────────────────────
function buildBoardKeyboard(gameId, board) {
  const rows = [];
  for (let row = 0; row < 3; row++) {
    const buttons = [];
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col;
      const cell = board[idx];
      const label = cell ? (cell === 'X' ? SYMBOLS.X : SYMBOLS.O) : SYMBOLS.EMPTY;
      // Callback: ttt_{gameId}_{cellIndex}
      buttons.push(Markup.button.callback(label, \`ttt_\${gameId}_\${idx}\`));
    }
    rows.push(buttons);
  }
  return Markup.inlineKeyboard(rows);
}

// ─── Start New Game ───────────────────────────────────────────────────────────
async function startTicTacToeGame(ctx, mode) {
  const userId = ctx.from.id;
  const userName = ctx.from.first_name || ctx.from.username || 'Player';

  // Prevent duplicate sessions
  if (userToGame.has(userId.toString())) {
    const existingGameId = userToGame.get(userId.toString());
    if (activeGames.has(existingGameId)) {
      return ctx.reply('⚠️ You already have an active game! Finish it first or wait for it to expire.');
    }
  }

  const gameId = uuidv4().substring(0, 8); // Short unique game ID
  const board = createEmptyBoard();

  const game = {
    id: gameId,
    mode, // 'ai' or 'pvp'
    board,
    players: {
      X: { id: userId.toString(), name: userName },
      O: mode === 'ai' ? { id: 'AI', name: '🤖 AI' } : null,
    },
    currentTurn: 'X', // X always goes first
    status: mode === 'pvp' ? 'waiting' : 'active',
    chatId: ctx.chat.id,
    messageId: null,
    createdAt: Date.now(),
    bet: 0,
  };

  activeGames.set(gameId, game);
  userToGame.set(userId.toString(), gameId);

  const keyboard = buildBoardKeyboard(gameId, board);
  const statusText = mode === 'ai'
    ? \`🤖 You are ❌ | AI is ⭕\\n\\nYour turn!\`
    : \`👥 *PvP Mode* — Waiting for opponent...\\nShare this game ID: \\\`\${gameId}\\\`\\n\\nYou are ❌ | Opponent will be ⭕\`;

  const sentMsg = await ctx.reply(
    \`🎮 *Tic Tac Toe Started!*\\n\\n\${statusText}\`,
    { parse_mode: 'Markdown', ...keyboard }
  );

  // Store message ID so we can edit it later
  game.messageId = sentMsg.message_id;
}

// ─── Handle Callback (Button Press) ──────────────────────────────────────────
async function handleTicTacToeCallback(ctx) {
  const data = ctx.callbackQuery.data; // e.g. "ttt_abc123_4"
  const parts = data.split('_');
  const gameId = parts[1];
  const cellIndex = parseInt(parts[2]);

  await ctx.answerCbQuery(); // Dismiss loading indicator

  const game = activeGames.get(gameId);

  if (!game) {
    return ctx.editMessageText('⚠️ This game has expired. Start a new one with /tictactoe');
  }

  const userId = ctx.from.id.toString();
  const currentPlayer = game.players[game.currentTurn];

  // ── Validate it's this player's turn ──
  if (currentPlayer.id !== userId) {
    if (game.mode === 'pvp' && game.status === 'waiting') {
      // Second player joining PvP game
      if (!game.players.O) {
        game.players.O = { id: userId, name: ctx.from.first_name || 'Player 2' };
        game.status = 'active';
        userToGame.set(userId, gameId);
      } else if (game.players.O.id !== userId) {
        return ctx.answerCbQuery('❌ This game is for 2 players only.');
      }
    } else {
      return ctx.answerCbQuery('⏳ It\\'s not your turn!');
    }
  }

  // ── Validate cell is empty ──
  if (game.board[cellIndex] !== null) {
    return ctx.answerCbQuery('❌ That cell is already taken!');
  }

  if (game.status !== 'active') {
    return ctx.answerCbQuery('⚠️ Game is not active yet.');
  }

  // ── Make the move ──
  game.board[cellIndex] = game.currentTurn;

  // ── Check game result ──
  const winner = checkWinner(game.board);
  const draw = isDraw(game.board);

  if (winner || draw) {
    await endGame(ctx, game, winner, draw);
    return;
  }

  // ── Switch turns ──
  game.currentTurn = game.currentTurn === 'X' ? 'O' : 'X';

  const nextPlayer = game.players[game.currentTurn];
  const keyboard = buildBoardKeyboard(gameId, game.board);

  await ctx.editMessageText(
    \`🎮 *Tic Tac Toe*\\n\\n\${game.currentTurn === 'X' ? SYMBOLS.X : SYMBOLS.O} \${nextPlayer.name}'s turn!\`,
    { parse_mode: 'Markdown', ...keyboard }
  );

  // ── AI Move ──
  if (game.mode === 'ai' && game.currentTurn === 'O') {
    setTimeout(async () => {
      await makeAIMove(ctx, game);
    }, 800); // Small delay for realism
  }
}

// ─── AI Makes a Move ──────────────────────────────────────────────────────────
async function makeAIMove(ctx, game) {
  if (!activeGames.has(game.id)) return; // Game may have ended

  // Get AI move from OpenRouter
  const aiCellIndex = await getAITicTacToeMove(game.board);

  game.board[aiCellIndex] = 'O';

  const winner = checkWinner(game.board);
  const draw = isDraw(game.board);

  if (winner || draw) {
    await endGame(ctx, game, winner, draw);
    return;
  }

  // Switch back to player X
  game.currentTurn = 'X';
  const keyboard = buildBoardKeyboard(game.id, game.board);

  try {
    await ctx.telegram.editMessageText(
      game.chatId,
      game.messageId,
      null,
      \`🎮 *Tic Tac Toe*\\n\\n❌ Your turn! (AI has moved)\`,
      { parse_mode: 'Markdown', ...keyboard }
    );
  } catch (err) {
    // Message might have been deleted
    console.error('Edit message error:', err.message);
  }
}

// ─── End Game + Rewards ───────────────────────────────────────────────────────
async function endGame(ctx, game, winner, draw) {
  const keyboard = buildBoardKeyboard(game.id, game.board);

  let resultText = '';
  let winnerUserId = null;
  let loserUserId = null;

  if (draw) {
    resultText = '🤝 *It\\'s a DRAW!*';
    // Refund entry fee on draw
    await addCoins(game.players.X.id, 10);
    if (game.players.O && game.players.O.id !== 'AI') {
      await addCoins(game.players.O.id, 10);
    }
    await updateUserStats(game.players.X.id, 'draw');
    if (game.players.O && game.players.O.id !== 'AI') {
      await updateUserStats(game.players.O.id, 'draw');
    }
  } else {
    const winnerPlayer = game.players[winner];
    resultText = \`🏆 *\${winnerPlayer.name} WINS!* (\${winner === 'X' ? SYMBOLS.X : SYMBOLS.O})\`;

    if (winnerPlayer.id !== 'AI') {
      winnerUserId = winnerPlayer.id;
      const reward = game.mode === 'ai' ? 25 : 50;
      await addCoins(winnerPlayer.id, reward);
      await updateUserStats(winnerPlayer.id, 'win');
      resultText += \`\\n💰 +\${reward} coins earned!\`;
    }

    // Update loser stats
    const loserSymbol = winner === 'X' ? 'O' : 'X';
    const loserPlayer = game.players[loserSymbol];
    if (loserPlayer && loserPlayer.id !== 'AI') {
      loserUserId = loserPlayer.id;
      await updateUserStats(loserPlayer.id, 'loss');
    }
  }

  // Add rematch button
  const rematchKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🔄 Rematch vs AI', 'play_ttt_ai')],
    [Markup.button.callback('🎮 Play Again', 'play_menu')],
  ]);

  // Save match history
  await saveMatchHistory({
    gameType: 'tictactoe',
    players: [game.players.X.id, game.players.O?.id || 'AI'],
    winner: winnerUserId,
    loser: loserUserId,
    draw,
    board: game.board,
  });

  // Clean up game from memory
  activeGames.delete(game.id);
  userToGame.delete(game.players.X.id);
  if (game.players.O && game.players.O.id !== 'AI') {
    userToGame.delete(game.players.O.id);
  }

  try {
    await ctx.telegram.editMessageText(
      game.chatId,
      game.messageId,
      null,
      \`🎮 *Tic Tac Toe — Game Over!*\\n\\n\${resultText}\\n\\nPlay again?\`,
      { parse_mode: 'Markdown', ...rematchKeyboard }
    );
  } catch (err) {
    await ctx.reply(\`\${resultText}\\n\\nPlay again? /tictactoe\`, { parse_mode: 'Markdown' });
  }
}

module.exports = { startTicTacToeGame, handleTicTacToeCallback };`
  },
  {
    path: "src/bot/games/quiz/quizGame.js",
    language: "javascript",
    description: "Quiz Battle game — AI-generated questions, timers, scoring",
    content: `/**
 * src/bot/games/quiz/quizGame.js — Quiz Battle Core
 * Handles AI-generated quiz questions, timers, and scoring
 */

const { Markup } = require('telegraf');
const { generateQuizQuestions } = require('../../../ai/openrouter');
const { updateUserStats, addCoins, updateQuizScore } = require('../../../database/userModel');
const { saveMatchHistory } = require('../../../database/matchHistory');

// ─── Active Quiz Sessions ─────────────────────────────────────────────────────
const activeQuizSessions = new Map();

// Quiz configuration
const QUIZ_CONFIG = {
  QUESTIONS_COUNT: 5,
  TIME_PER_QUESTION: 15, // seconds
  REWARD_PER_CORRECT: 20, // coins
  BONUS_WINNER: 50,       // extra coins for quiz winner
};

// ─── Start Quiz Game ──────────────────────────────────────────────────────────
async function startQuizGame(ctx) {
  const userId = ctx.from.id.toString();
  const userName = ctx.from.first_name || ctx.from.username || 'Player';

  // Check for existing session
  if (activeQuizSessions.has(userId)) {
    return ctx.reply('⚠️ You already have an active quiz! Answer the current question first.');
  }

  await ctx.reply('🧠 *Generating quiz questions using AI...*', { parse_mode: 'Markdown' });
  await ctx.sendChatAction('typing');

  try {
    // Fetch AI-generated questions
    const questions = await generateQuizQuestions(QUIZ_CONFIG.QUESTIONS_COUNT);

    const session = {
      userId,
      userName,
      chatId: ctx.chat.id,
      questions,
      currentQuestion: 0,
      score: 0,
      startTime: Date.now(),
      timer: null,
      messageId: null,
    };

    activeQuizSessions.set(userId, session);

    // Start first question
    await sendQuestion(ctx, session);

  } catch (err) {
    console.error('Quiz start error:', err.message);
    // Refund coins if quiz fails to start
    await ctx.reply('❌ Failed to generate quiz. Your coins have been refunded.');
    const { addCoins } = require('../../../database/userModel');
    await addCoins(userId, 10);
  }
}

// ─── Send a Question ──────────────────────────────────────────────────────────
async function sendQuestion(ctx, session) {
  const q = session.questions[session.currentQuestion];
  const questionNum = session.currentQuestion + 1;
  const total = session.questions.length;

  // Shuffle answer options
  const options = [...q.options];
  const shuffled = options.sort(() => Math.random() - 0.5);

  // Build answer buttons (labeled A, B, C, D)
  const labels = ['🅰️', '🅱️', '🅲️', '🅳️'];
  const buttons = shuffled.map((option, i) =>
    Markup.button.callback(
      \`\${labels[i]} \${option}\`,
      \`quiz_answer_\${session.userId}_\${session.currentQuestion}_\${option}\`
    )
  );

  const keyboard = Markup.inlineKeyboard(buttons.map((b) => [b]));

  const questionText = \`🧠 *Quiz Battle — Question \${questionNum}/\${total}*

❓ \${q.question}

⏱️ You have \${QUIZ_CONFIG.TIME_PER_QUESTION} seconds!
💰 Score: \${session.score} points\`;

  const sentMsg = await ctx.telegram.sendMessage(session.chatId, questionText, {
    parse_mode: 'Markdown',
    ...keyboard,
  });

  session.messageId = sentMsg.message_id;

  // ── Start Countdown Timer ──
  session.timer = setTimeout(async () => {
    if (!activeQuizSessions.has(session.userId)) return;

    const current = activeQuizSessions.get(session.userId);
    if (current.currentQuestion !== session.currentQuestion) return;

    // Time's up!
    try {
      await ctx.telegram.editMessageText(
        session.chatId,
        session.messageId,
        null,
        \`⏰ *Time's up!*\\n\\n❓ \${q.question}\\n✅ Answer: *\${q.correct}*\`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) { /* ignore */ }

    // Move to next question or end
    await advanceQuiz(ctx, session, false);

  }, QUIZ_CONFIG.TIME_PER_QUESTION * 1000);
}

// ─── Handle Quiz Answer Callback ──────────────────────────────────────────────
async function handleQuizCallback(ctx) {
  const data = ctx.callbackQuery.data;
  // Format: quiz_answer_{userId}_{questionIndex}_{selectedOption}
  const parts = data.split('_');
  const targetUserId = parts[2];
  const questionIndex = parseInt(parts[3]);
  const selectedAnswer = parts.slice(4).join('_'); // Handle answers with underscores

  await ctx.answerCbQuery();

  const userId = ctx.from.id.toString();

  if (userId !== targetUserId) {
    return ctx.answerCbQuery('❌ This is not your quiz!');
  }

  const session = activeQuizSessions.get(userId);
  if (!session) {
    return ctx.answerCbQuery('❌ No active quiz session found.');
  }

  if (session.currentQuestion !== questionIndex) {
    return ctx.answerCbQuery('❌ This question has already been answered.');
  }

  // Clear timeout timer
  if (session.timer) {
    clearTimeout(session.timer);
    session.timer = null;
  }

  const q = session.questions[session.currentQuestion];
  const isCorrect = selectedAnswer === q.correct;

  if (isCorrect) {
    session.score += QUIZ_CONFIG.REWARD_PER_CORRECT;
  }

  // Show result of this answer
  try {
    await ctx.telegram.editMessageText(
      session.chatId,
      session.messageId,
      null,
      isCorrect
        ? \`✅ *Correct!* +\${QUIZ_CONFIG.REWARD_PER_CORRECT} points\\n\\n❓ \${q.question}\\n✅ *\${q.correct}*\`
        : \`❌ *Wrong!* No points\\n\\n❓ \${q.question}\\n✅ Correct answer: *\${q.correct}*\\nYou chose: *\${selectedAnswer}*\`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) { /* ignore */ }

  // Wait briefly before showing next question
  setTimeout(async () => {
    await advanceQuiz(ctx, session, isCorrect);
  }, 1500);
}

// ─── Move to Next Question or End Quiz ────────────────────────────────────────
async function advanceQuiz(ctx, session, wasCorrect) {
  session.currentQuestion++;

  if (session.currentQuestion < session.questions.length) {
    // Send next question
    await sendQuestion(ctx, session);
  } else {
    // Quiz complete!
    await endQuiz(ctx, session);
  }
}

// ─── End Quiz + Rewards ───────────────────────────────────────────────────────
async function endQuiz(ctx, session) {
  activeQuizSessions.delete(session.userId);

  const totalPossible = session.questions.length * QUIZ_CONFIG.REWARD_PER_CORRECT;
  const percentage = ((session.score / totalPossible) * 100).toFixed(0);

  // Determine reward based on score
  let bonus = 0;
  let resultEmoji = '📊';
  if (parseInt(percentage) >= 80) {
    bonus = QUIZ_CONFIG.BONUS_WINNER;
    resultEmoji = '🏆';
  } else if (parseInt(percentage) >= 60) {
    bonus = 20;
    resultEmoji = '🥈';
  } else if (parseInt(percentage) >= 40) {
    bonus = 10;
    resultEmoji = '🥉';
  }

  const totalEarned = session.score + bonus;

  // Update database
  await addCoins(session.userId, totalEarned);
  await updateQuizScore(session.userId, session.score);

  if (parseInt(percentage) >= 60) {
    await updateUserStats(session.userId, 'win');
  } else {
    await updateUserStats(session.userId, 'loss');
  }

  // Save match history
  await saveMatchHistory({
    gameType: 'quiz',
    players: [session.userId],
    winner: parseInt(percentage) >= 60 ? session.userId : null,
    quizScore: session.score,
  });

  const rematchKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🔄 Play Again', 'play_quiz')],
    [Markup.button.callback('🏆 Leaderboard', 'leaderboard_menu')],
  ]);

  await ctx.telegram.sendMessage(
    session.chatId,
    \`\${resultEmoji} *Quiz Complete!*

👤 Player: \${session.userName}
📊 Score: \${session.score}/\${totalPossible} (\${percentage}%)
💰 Base Reward: \${session.score} coins
🎁 Bonus: +\${bonus} coins
💎 *Total Earned: \${totalEarned} coins*

\${parseInt(percentage) >= 80 ? '🔥 Outstanding performance!' : parseInt(percentage) >= 60 ? '👍 Good job!' : '💪 Keep practicing!'}\`,
    { parse_mode: 'Markdown', ...rematchKeyboard }
  );
}

module.exports = { startQuizGame, handleQuizCallback };`
  },
  {
    path: "src/ai/openrouter.js",
    language: "javascript",
    description: "OpenRouter API integration — AI moves + quiz generation",
    content: `/**
 * src/ai/openrouter.js — OpenRouter AI Integration
 * Handles all AI features: Tic Tac Toe moves, Quiz generation, Chat
 */

const axios = require('axios');

// ─── Configuration ────────────────────────────────────────────────────────────
const OPENROUTER_CONFIG = {
  BASE_URL: 'https://openrouter.ai/api/v1/chat/completions',
  MODEL: 'openai/gpt-4o-mini', // Reliable free-tier model
  API_KEY: process.env.OPENROUTER_API_KEY || 'YOUR_OPENROUTER_KEY_HERE',
  HEADERS: {
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://t.me/your_bot',
    'X-Title': 'Telegram Game Bot',
  },
};

// ─── Core API Call Function ───────────────────────────────────────────────────
async function callOpenRouter(messages, maxTokens = 500) {
  try {
    const response = await axios.post(
      OPENROUTER_CONFIG.BASE_URL,
      {
        model: OPENROUTER_CONFIG.MODEL,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
      },
      {
        headers: {
          ...OPENROUTER_CONFIG.HEADERS,
          Authorization: \`Bearer \${OPENROUTER_CONFIG.API_KEY}\`,
        },
        timeout: 30000, // 30 second timeout
      }
    );

    return response.data.choices[0].message.content;
  } catch (err) {
    if (err.response) {
      console.error('OpenRouter API error:', err.response.status, err.response.data);
    } else {
      console.error('OpenRouter network error:', err.message);
    }
    throw new Error('AI service unavailable');
  }
}

// ─── General AI Chat ──────────────────────────────────────────────────────────
async function askAI(messages) {
  return await callOpenRouter(messages, 600);
}

// ─── Tic Tac Toe AI Move ──────────────────────────────────────────────────────
/**
 * Gets the best move for AI in Tic Tac Toe
 * @param {Array} board - 9-element array (null = empty, 'X' = player, 'O' = AI)
 * @returns {number} - Cell index (0-8) for AI's move
 */
async function getAITicTacToeMove(board) {
  // First try minimax for perfect play (no API needed for performance)
  const minimaxMove = minimaxBestMove(board, 'O');
  if (minimaxMove !== -1) {
    return minimaxMove;
  }

  // Fallback: ask OpenRouter AI
  try {
    const boardDisplay = board.map((cell, i) => {
      if (cell === 'X') return 'X';
      if (cell === 'O') return 'O';
      return i.toString();
    });

    const prompt = \`You are playing Tic Tac Toe as 'O'. The board is a 3x3 grid with positions 0-8.
    
Current board:
\${boardDisplay[0]} | \${boardDisplay[1]} | \${boardDisplay[2]}
---------
\${boardDisplay[3]} | \${boardDisplay[4]} | \${boardDisplay[5]}
---------
\${boardDisplay[6]} | \${boardDisplay[7]} | \${boardDisplay[8]}

Available moves: \${board.map((c, i) => c === null ? i : '').filter(x => x !== '').join(', ')}

Respond with ONLY the number of your chosen position. Choose the best strategic move.\`;

    const response = await callOpenRouter([
      { role: 'system', content: 'You are a Tic Tac Toe AI. Only respond with a single number.' },
      { role: 'user', content: prompt },
    ], 10);

    const move = parseInt(response.trim());
    if (!isNaN(move) && move >= 0 && move <= 8 && board[move] === null) {
      return move;
    }
  } catch (err) {
    console.error('AI move error, using fallback:', err.message);
  }

  // Last resort: pick first available cell
  return board.findIndex((cell) => cell === null);
}

// ─── Minimax Algorithm (Perfect Tic Tac Toe AI) ───────────────────────────────
function minimax(board, depth, isMaximizing) {
  const winner = checkWinner(board);
  if (winner === 'O') return 10 - depth;
  if (winner === 'X') return depth - 10;
  if (board.every((c) => c !== null)) return 0; // Draw

  if (isMaximizing) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = 'O';
        best = Math.max(best, minimax(board, depth + 1, false));
        board[i] = null;
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = 'X';
        best = Math.min(best, minimax(board, depth + 1, true));
        board[i] = null;
      }
    }
    return best;
  }
}

function checkWinner(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

function minimaxBestMove(board, player) {
  let bestScore = -Infinity;
  let bestMove = -1;
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      board[i] = player;
      const score = minimax(board, 0, false);
      board[i] = null;
      if (score > bestScore) {
        bestScore = score;
        bestMove = i;
      }
    }
  }
  return bestMove;
}

// ─── AI-Generated Quiz Questions ─────────────────────────────────────────────
/**
 * Generates quiz questions using OpenRouter AI
 * @param {number} count - Number of questions to generate
 * @returns {Array} - Array of question objects
 */
async function generateQuizQuestions(count = 5) {
  const prompt = \`Generate \${count} multiple-choice trivia questions. Return ONLY a valid JSON array.

Each question must follow this exact format:
[
  {
    "question": "What is the capital of France?",
    "options": ["London", "Paris", "Berlin", "Madrid"],
    "correct": "Paris"
  }
]

Rules:
- Make questions interesting and varied (science, history, geography, pop culture)
- Each question must have exactly 4 options
- The "correct" value must exactly match one of the "options"
- Return ONLY the JSON array, no other text\`;

  try {
    const response = await callOpenRouter([
      { role: 'system', content: 'You are a quiz generator. Always return valid JSON only.' },
      { role: 'user', content: prompt },
    ], 1000);

    // Extract JSON from response
    const jsonMatch = response.match(/\\[.*\\]/s);
    if (!jsonMatch) throw new Error('No JSON found in AI response');

    const questions = JSON.parse(jsonMatch[0]);

    // Validate questions structure
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('Invalid questions format');
    }

    return questions.slice(0, count);
  } catch (err) {
    console.error('Quiz generation error:', err.message, '— using fallback questions');
    // Return hardcoded fallback questions if AI fails
    return getFallbackQuestions(count);
  }
}

// ─── Fallback Quiz Questions (if AI unavailable) ──────────────────────────────
function getFallbackQuestions(count) {
  const questions = [
    {
      question: 'What is the capital of France?',
      options: ['London', 'Paris', 'Berlin', 'Madrid'],
      correct: 'Paris',
    },
    {
      question: 'How many sides does a hexagon have?',
      options: ['5', '6', '7', '8'],
      correct: '6',
    },
    {
      question: 'Which planet is known as the Red Planet?',
      options: ['Venus', 'Jupiter', 'Mars', 'Saturn'],
      correct: 'Mars',
    },
    {
      question: 'What is the largest ocean on Earth?',
      options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'],
      correct: 'Pacific',
    },
    {
      question: 'Who painted the Mona Lisa?',
      options: ['Michelangelo', 'Leonardo da Vinci', 'Raphael', 'Picasso'],
      correct: 'Leonardo da Vinci',
    },
    {
      question: 'What is the chemical symbol for gold?',
      options: ['Go', 'Gd', 'Au', 'Ag'],
      correct: 'Au',
    },
    {
      question: 'How many continents are on Earth?',
      options: ['5', '6', '7', '8'],
      correct: '7',
    },
  ];
  return questions.slice(0, count);
}

module.exports = { askAI, getAITicTacToeMove, generateQuizQuestions };`
  },
  {
    path: "src/database/connection.js",
    language: "javascript",
    description: "MongoDB connection manager",
    content: `/**
 * src/database/connection.js — MongoDB Connection
 * Manages the database connection using Mongoose
 */

const mongoose = require('mongoose');

/**
 * Connect to MongoDB
 * @param {string} uri - MongoDB connection string
 */
async function connectDatabase(uri) {
  const mongoUri = uri ||
    process.env.MONGODB_URI ||
    'mongodb://localhost:27017/telegram_game_bot';

  // Mongoose connection options
  const options = {
    serverSelectionTimeoutMS: 10000, // Timeout after 10 seconds
    socketTimeoutMS: 45000,
  };

  try {
    await mongoose.connect(mongoUri, options);
    console.log('✅ MongoDB connection established');

    // Connection event listeners
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB error:', err.message);
    });

  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    throw err;
  }
}

module.exports = { connectDatabase };`
  },
  {
    path: "src/database/userModel.js",
    language: "javascript",
    description: "User MongoDB model + CRUD operations",
    content: `/**
 * src/database/userModel.js — User Model
 * Mongoose schema and all database operations for users
 */

const mongoose = require('mongoose');

// ─── User Schema ──────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    telegramId: {
      type: String,
      required: true,
      unique: true,
      index: true, // Fast lookup by Telegram ID
    },
    username: { type: String, default: 'Anonymous' },
    firstName: { type: String, default: 'Player' },

    // Economy
    coins: { type: Number, default: 100 }, // Starting coins
    pendingBet: { type: Number, default: 0 },

    // Game Statistics
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    totalGames: { type: Number, default: 0 },
    quizScore: { type: Number, default: 0 },

    // Anti-cheat
    activeGame: { type: String, default: null }, // Active game ID
    lastActivity: { type: Date, default: Date.now },

    // Daily bonus tracking
    lastDailyBonus: { type: Date, default: null },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

const User = mongoose.model('User', userSchema);

// ─── Database Operations ──────────────────────────────────────────────────────

/**
 * Get or create a user (used in middleware on every message)
 */
async function getOrCreateUser({ telegramId, username, firstName }) {
  return await User.findOneAndUpdate(
    { telegramId: telegramId.toString() },
    {
      $setOnInsert: { // Only set these on NEW document creation
        telegramId: telegramId.toString(),
        username,
        firstName,
        coins: 100,
      },
      $set: { // Always update these
        lastActivity: new Date(),
        username, // Update username in case it changed
        firstName,
      },
    },
    {
      upsert: true,   // Create if doesn't exist
      new: true,      // Return the updated document
    }
  );
}

/**
 * Get user by Telegram ID
 */
async function getUserByTelegramId(telegramId) {
  return await User.findOne({ telegramId: telegramId.toString() });
}

/**
 * Add coins to user balance
 */
async function addCoins(telegramId, amount) {
  return await User.findOneAndUpdate(
    { telegramId: telegramId.toString() },
    { $inc: { coins: amount } },
    { new: true }
  );
}

/**
 * Deduct coins from user balance
 */
async function deductCoins(telegramId, amount) {
  return await User.findOneAndUpdate(
    { telegramId: telegramId.toString() },
    { $inc: { coins: -amount } },
    { new: true }
  );
}

/**
 * Update win/loss/draw statistics
 * @param {string} telegramId
 * @param {'win'|'loss'|'draw'} result
 */
async function updateUserStats(telegramId, result) {
  const update = { $inc: { totalGames: 1 } };
  if (result === 'win') update.$inc.wins = 1;
  else if (result === 'loss') update.$inc.losses = 1;
  else if (result === 'draw') update.$inc.draws = 1;

  return await User.findOneAndUpdate(
    { telegramId: telegramId.toString() },
    update,
    { new: true }
  );
}

/**
 * Update quiz score (accumulate)
 */
async function updateQuizScore(telegramId, score) {
  return await User.findOneAndUpdate(
    { telegramId: telegramId.toString() },
    { $inc: { quizScore: score } },
    { new: true }
  );
}

/**
 * Set pending bet amount
 */
async function updateUserBet(telegramId, amount) {
  return await User.findOneAndUpdate(
    { telegramId: telegramId.toString() },
    { $set: { pendingBet: amount } },
    { new: true }
  );
}

/**
 * Get top N players sorted by a field
 * @param {'coins'|'wins'|'quizScore'} field
 * @param {number} limit
 */
async function getLeaderboard(field, limit = 10) {
  const sortQuery = {};
  sortQuery[field] = -1; // Descending order

  return await User.find({})
    .sort(sortQuery)
    .limit(limit)
    .select('telegramId username firstName coins wins losses quizScore totalGames');
}

module.exports = {
  User,
  getOrCreateUser,
  getUserByTelegramId,
  addCoins,
  deductCoins,
  updateUserStats,
  updateQuizScore,
  updateUserBet,
  getLeaderboard,
};`
  },
  {
    path: "src/database/matchHistory.js",
    language: "javascript",
    description: "Match history MongoDB model",
    content: `/**
 * src/database/matchHistory.js — Match History Model
 * Stores completed game records for history tracking
 */

const mongoose = require('mongoose');

// ─── Match History Schema ─────────────────────────────────────────────────────
const matchHistorySchema = new mongoose.Schema(
  {
    gameType: {
      type: String,
      enum: ['tictactoe', 'quiz'],
      required: true,
    },
    players: [{ type: String }], // Array of Telegram IDs
    winner: { type: String, default: null }, // Telegram ID of winner (null = draw)
    loser: { type: String, default: null },
    draw: { type: Boolean, default: false },

    // Tic Tac Toe specific
    board: [{ type: String }], // Final board state

    // Quiz specific
    quizScore: { type: Number, default: 0 },

    playedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const MatchHistory = mongoose.model('MatchHistory', matchHistorySchema);

/**
 * Save a completed match to history
 */
async function saveMatchHistory(data) {
  try {
    const match = new MatchHistory(data);
    await match.save();
    return match;
  } catch (err) {
    console.error('Failed to save match history:', err.message);
    return null;
  }
}

/**
 * Get recent matches for a user
 */
async function getUserMatchHistory(telegramId, limit = 10) {
  return await MatchHistory.find({
    players: telegramId.toString(),
  })
    .sort({ playedAt: -1 })
    .limit(limit);
}

module.exports = { MatchHistory, saveMatchHistory, getUserMatchHistory };`
  },
  {
    path: "src/utils/antiSpam.js",
    language: "javascript",
    description: "Anti-spam rate limiter utility",
    content: `/**
 * src/utils/antiSpam.js — Anti-Spam Protection
 * Prevents users from sending too many messages in a short time
 */

// Store: userId → array of timestamps
const messageLog = new Map();

const SPAM_CONFIG = {
  MAX_MESSAGES: 5,       // Max messages allowed in the window
  TIME_WINDOW: 5000,     // 5 seconds window
  CLEANUP_INTERVAL: 60000, // Clean old entries every 60 seconds
};

/**
 * Check if a user is spamming
 * @param {number} userId - Telegram user ID
 * @returns {boolean} - true if user is spamming (should be blocked)
 */
function antiSpam(userId) {
  const key = userId.toString();
  const now = Date.now();

  // Get existing timestamps for this user
  const timestamps = messageLog.get(key) || [];

  // Filter out timestamps older than the time window
  const recentMessages = timestamps.filter(
    (ts) => now - ts < SPAM_CONFIG.TIME_WINDOW
  );

  // Add current timestamp
  recentMessages.push(now);
  messageLog.set(key, recentMessages);

  // Check if over the limit
  return recentMessages.length > SPAM_CONFIG.MAX_MESSAGES;
}

// Periodic cleanup to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of messageLog.entries()) {
    const recent = timestamps.filter((ts) => now - ts < SPAM_CONFIG.TIME_WINDOW);
    if (recent.length === 0) {
      messageLog.delete(key); // Remove idle users
    } else {
      messageLog.set(key, recent);
    }
  }
}, SPAM_CONFIG.CLEANUP_INTERVAL);

module.exports = { antiSpam };`
  },
  {
    path: "src/utils/helpers.js",
    language: "javascript",
    description: "Utility helper functions",
    content: `/**
 * src/utils/helpers.js — Utility Helper Functions
 * Common utility functions used across the project
 */

/**
 * Format a number with commas (e.g., 1000 → "1,000")
 */
function formatNumber(num) {
  return num.toLocaleString('en-US');
}

/**
 * Generate a random integer between min and max (inclusive)
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sleep for a given number of milliseconds
 * @param {number} ms - milliseconds to wait
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safely escape Markdown special characters for Telegram
 */
function escapeMarkdown(text) {
  return text.replace(/[_*[\]()~\`>#+=|{}.!-]/g, '\\\\$&');
}

/**
 * Generate a random game ID (short readable format)
 */
function generateGameId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(randomInt(0, chars.length - 1));
  }
  return id;
}

/**
 * Check if a date is today (for daily bonus check)
 */
function isToday(date) {
  if (!date) return false;
  const today = new Date();
  const check = new Date(date);
  return (
    check.getDate() === today.getDate() &&
    check.getMonth() === today.getMonth() &&
    check.getFullYear() === today.getFullYear()
  );
}

module.exports = {
  formatNumber,
  randomInt,
  sleep,
  escapeMarkdown,
  generateGameId,
  isToday,
};`
  },
  {
    path: "README.md",
    language: "markdown",
    description: "Project documentation and setup guide",
    content: `# 🎮 Telegram Multiplayer Game Bot

An advanced AI-powered multiplayer Telegram game bot featuring Tic Tac Toe, Quiz Battle, Coin System, and Leaderboard.

## 📋 Features

- 🎮 **Tic Tac Toe** — PvP and vs AI (OpenRouter-powered)
- 🧠 **Quiz Battle** — AI-generated questions with timer
- 💰 **Coin System** — Earn and bet coins
- 🏆 **Leaderboard** — Top players by coins and wins
- 🤖 **AI Chat** — Chat with the AI assistant
- ⚡ **WebSocket** — Real-time game state
- 🛡️ **Anti-Spam** — Rate limiting protection

## 🛠️ Setup (Termux / Linux)

### 1. Install Prerequisites (Termux)
\`\`\`bash
pkg update && pkg upgrade -y
pkg install nodejs mongodb git -y
\`\`\`

### 2. Clone / Setup Project
\`\`\`bash
mkdir telegram-bot && cd telegram-bot
# Copy all project files here
\`\`\`

### 3. Install Dependencies
\`\`\`bash
npm install
\`\`\`

### 4. Configure Environment
\`\`\`bash
cp .env.example .env
nano .env
\`\`\`

Edit these values:
\`\`\`env
BOT_TOKEN=8392101543:AAF_vP6_Y-5lSTJ3O8ZvFFT0pI_2_wTgebE
MONGODB_URI=mongodb://localhost:27017/telegram_game_bot
OPENROUTER_API_KEY=your_key_from_openrouter.ai
PORT=3000
\`\`\`

### 5. Start MongoDB (Termux)
\`\`\`bash
mongod --dbpath /data/db &
\`\`\`

### 6. Run the Bot
\`\`\`bash
# Development (auto-restart)
npm run dev

# Production
npm start
\`\`\`

## 📡 Bot Commands

| Command | Description |
|---------|-------------|
| /start | Welcome message + menu |
| /play | Game selection menu |
| /tictactoe | Start Tic Tac Toe |
| /quiz | Start Quiz Battle |
| /balance | Check coins & stats |
| /leaderboard | Top 10 players |
| /bet [amount] | Set game bet |
| /ai [message] | Chat with AI |
| /help | Command list |

## 🏗️ Project Structure

\`\`\`
/
├── server.js              # Main entry point
├── package.json           # Dependencies
├── .env                   # Configuration
└── src/
    ├── bot/
    │   ├── bot.js         # Telegraf bot instance
    │   ├── commands/      # Command handlers
    │   └── games/
    │       ├── tictactoe/ # Tic Tac Toe logic
    │       └── quiz/      # Quiz Battle logic
    ├── ai/
    │   └── openrouter.js  # OpenRouter AI integration
    ├── database/
    │   ├── connection.js  # MongoDB connection
    │   ├── userModel.js   # User schema & operations
    │   └── matchHistory.js # Match history schema
    └── utils/
        ├── antiSpam.js    # Rate limiting
        └── helpers.js     # Utility functions
\`\`\`

## 🔑 Getting OpenRouter API Key

1. Visit [openrouter.ai](https://openrouter.ai)
2. Sign up for a free account
3. Go to "Keys" section
4. Create a new API key
5. Add it to your .env file

## 🚀 Deployment

### Keep Running with PM2
\`\`\`bash
npm install -g pm2
pm2 start server.js --name "telegram-bot"
pm2 save
pm2 startup
\`\`\`

## 💡 Notes

- Default starting coins: **100 per user**
- Game entry fee: **10 coins**
- Win reward (vs AI): **+25 coins**
- Win reward (PvP): **+50 coins**
- Quiz perfect score bonus: **+50 coins**`
  }
];

export const fileTree: TreeNode[] = [
  {
    name: "project-root/",
    type: "folder" as const,
    children: [
      { name: "server.js", type: "file", path: "server.js" },
      { name: "package.json", type: "file", path: "package.json" },
      { name: ".env.example", type: "file", path: ".env.example" },
      { name: "README.md", type: "file", path: "README.md" },
      {
        name: "src/",
        type: "folder",
        children: [
          {
            name: "bot/",
            type: "folder",
            children: [
              { name: "bot.js", type: "file", path: "src/bot/bot.js" },
              {
                name: "commands/",
                type: "folder",
                children: [
                  { name: "start.js", type: "file", path: "src/bot/commands/start.js" },
                  { name: "play.js", type: "file", path: "src/bot/commands/play.js" },
                  { name: "tictactoe.js", type: "file", path: "src/bot/commands/tictactoe.js" },
                  { name: "quiz.js", type: "file", path: "src/bot/commands/quiz.js" },
                  { name: "balance.js", type: "file", path: "src/bot/commands/balance.js" },
                  { name: "leaderboard.js", type: "file", path: "src/bot/commands/leaderboard.js" },
                  { name: "bet.js", type: "file", path: "src/bot/commands/bet.js" },
                  { name: "aiChat.js", type: "file", path: "src/bot/commands/aiChat.js" },
                ]
              },
              {
                name: "games/",
                type: "folder",
                children: [
                  {
                    name: "tictactoe/",
                    type: "folder",
                    children: [
                      { name: "tictactoeGame.js", type: "file", path: "src/bot/games/tictactoe/tictactoeGame.js" },
                    ]
                  },
                  {
                    name: "quiz/",
                    type: "folder",
                    children: [
                      { name: "quizGame.js", type: "file", path: "src/bot/games/quiz/quizGame.js" },
                    ]
                  }
                ]
              }
            ]
          },
          {
            name: "ai/",
            type: "folder",
            children: [
              { name: "openrouter.js", type: "file", path: "src/ai/openrouter.js" },
            ]
          },
          {
            name: "database/",
            type: "folder",
            children: [
              { name: "connection.js", type: "file", path: "src/database/connection.js" },
              { name: "userModel.js", type: "file", path: "src/database/userModel.js" },
              { name: "matchHistory.js", type: "file", path: "src/database/matchHistory.js" },
            ]
          },
          {
            name: "utils/",
            type: "folder",
            children: [
              { name: "antiSpam.js", type: "file", path: "src/utils/antiSpam.js" },
              { name: "helpers.js", type: "file", path: "src/utils/helpers.js" },
            ]
          }
        ]
      }
    ]
  }
];

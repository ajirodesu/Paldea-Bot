/**
 * Wordle Game Command
 * Uses onChat to handle game state without blocking the main process.
 */
export const meta = {
  name: "wordle",
  aliases: ["word"],
  version: "1.1.0",
  description: "Play a game of Wordle.",
  author: "AjiroDesu",
  prefix: "both",
  category: "fun",
  type: "anyone",
  cooldown: 5,
  guide: ["start"]
};

// --- Game Data ---
const words = [
  "apple","beach","chair","dance","eagle","flame","grape","house","ivory","jelly",
  "knife","lemon","mango","novel","ocean","pizza","queen","river","sugar","tiger",
  "uncle","voice","water","xray","yacht","zebra","brick","cloud","drain","earth",
  "forest","glass","horse","index","joker","koala","light","mouse","noise","orbit",
  "paper","quick","smile","table","unity","vivid","whale","yield","arrow","brave",
  "coral","diary","elite","frost","gamer","heart","layer","magic","noble","omega",
  "pearl","quest","steam","train","urban","valve","width","alpha","blaze","delta",
  "focus","glide","hunch","icing","karma","lunar","maple","nerve","pulse","ridge"
];

// Local state to track active games per chat
const activeGames = new Map();

// --- Helpers ---

/**
 * Evaluates a guess against the target word.
 * Returns emojis and boolean correctness.
 */
function evalGuess(guess, target) {
  const result = Array(5).fill("⬜");
  const targetChars = target.split("");
  const guessChars = guess.split("");

  // 1. Check Greens (Correct Position)
  for (let i = 0; i < 5; i++) {
    if (guessChars[i] === targetChars[i]) {
      result[i] = "🟩";
      targetChars[i] = null; // Mark as used
    }
  }

  // 2. Check Yellows (Wrong Position)
  for (let i = 0; i < 5; i++) {
    if (result[i] === "⬜") {
      const targetIndex = targetChars.indexOf(guessChars[i]);
      if (targetIndex !== -1) {
        result[i] = "🟨";
        targetChars[targetIndex] = null; // Mark as used
      }
    }
  }

  return { 
    emoji: result.join(" "), 
    isWin: result.join("") === "🟩🟩🟩🟩🟩" 
  };
}

/**
 * Ends the game and cleans up state.
 */
function endGame(chatId) {
  activeGames.delete(chatId);
}

// --- Command Handlers ---

export async function onStart({ msg, args, response }) {
  const chatId = msg.chat.id;

  // 1. Check for existing game
  if (activeGames.has(chatId)) {
    return response.reply("❌ **Game in Progress**\nA game is already running! Guess the word or type `end` to stop.");
  }

  // 2. Check arguments
  if (!args[0] || args[0].toLowerCase() !== "start") {
    return response.reply(
      "🎮 **How to play Wordle:**\n\n" +
      "1. Type `/wordle start` to begin.\n" +
      "2. Guess a 5-letter word.\n" +
      "3. 🟩 Correct letter & position\n" +
      "4. 🟨 Correct letter, wrong position\n" +
      "5. ⬜ Letter not in word\n\n" +
      "Type `end` to give up."
    );
  }

  // 3. Initialize Game
  const targetWord = words[Math.floor(Math.random() * words.length)];

  activeGames.set(chatId, {
    word: targetWord,
    attempts: 0,
    maxAttempts: 6
  });

  await response.reply("🎯 **Wordle Started!**\n\nGuess the **5-letter** word.\nYou have **6** tries.\n\n_Type your guess below..._");
}

export async function onChat({ msg, response }) {
  const chatId = msg.chat.id;

  // 1. Validation: Is a game active in this chat?
  if (!activeGames.has(chatId)) {
    return true; // Not playing, let other commands run
  }

  const game = activeGames.get(chatId);
  const guess = (msg.text || "").toLowerCase().trim();

  // 2. Handle "end" or "stop"
  if (guess === "end" || guess === "stop") {
    endGame(chatId);
    await response.reply(`🛑 **Game Ended**\nThe word was: **${game.word.toUpperCase()}**`);
    return false; // Stop processing
  }

  // 3. Validation: Length and Characters
  if (guess.length !== 5) {
    await response.reply("⚠️ Guess must be exactly **5 letters**.");
    return false; 
  }

  if (!/^[a-z]+$/.test(guess)) {
    await response.reply("⚠️ Only **A-Z** letters allowed.");
    return false;
  }

  // 4. Game Logic
  game.attempts++;
  const { emoji, isWin } = evalGuess(guess, game.word);

  // 5. Build Response
  const header = `📝 **Attempt ${game.attempts}/${game.maxAttempts}:** ${guess.toUpperCase()}`;

  if (isWin) {
    endGame(chatId);
    await response.reply(
      `🎉 **Correct!**\n\n${emoji}\n\nThe word was **${game.word.toUpperCase()}**!`
    );
  } else if (game.attempts >= game.maxAttempts) {
    endGame(chatId);
    await response.reply(
      `😔 **Game Over!**\n\n${emoji}\n\nThe word was **${game.word.toUpperCase()}**.`
    );
  } else {
    // Continue game
    await response.reply(`${header}\n${emoji}`);
  }

  // Return false to stop this message from triggering other commands
  return false;
}
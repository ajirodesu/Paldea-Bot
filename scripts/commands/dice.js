/**
 * Dice Roller
 * Classic RNG dice rolling with support for custom sides and counts.
 * Features a visual Easter egg for standard 1d6 rolls.
 */

export const meta = {
  name: "dice",
  version: "1.1.0",
  aliases: ["roll", "dnd", "r"],
  description: "Roll the dice and test your luck!",
  author: "Replit AI", // Author preserved
  prefix: "both",
  category: "fun",
  type: "anyone",
  cooldown: 3,
  guide: ["[count] [sides] (Default: 1 6)"]
};

// Map numbers to word strings for the image API
const NUM_WORDS = {
  1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six"
};

export async function onStart({ args, response }) {
  // Parse Arguments (Default to 1 die, 6 sides)
  const numDice = parseInt(args[0]) || 1;
  const numSides = parseInt(args[1]) || 6;

  // --- VALIDATION ---
  if (numDice <= 0 || numDice > 100) {
    return response.reply("⚠️ **Limit Exceeded**\nPlease choose between **1** and **100** dice.");
  }

  if (numSides <= 1 || numSides > 1000) {
    return response.reply("⚠️ **Invalid Sides**\nPlease choose between **2** and **1000** sides.");
  }

  // --- LOGIC ---
  const rolls = [];
  for (let i = 0; i < numDice; i++) {
    rolls.push(Math.floor(Math.random() * numSides) + 1);
  }

  const total = rolls.reduce((acc, curr) => acc + curr, 0);

  // Format the list of rolls (truncate if too long)
  let rollsStr = rolls.join(", ");
  if (rollsStr.length > 3000) {
    rollsStr = rolls.slice(0, 50).join(", ") + ` ...and ${rolls.length - 50} more`;
  }

  const resultMsg = `🎲 **Dice Roll**\n` +
                    `Settings: **${numDice}**d**${numSides}**\n\n` +
                    `>>> **${rollsStr}**\n\n` +
                    `📊 **Total:** ${total}`;

  // --- EASTER EGG (1d6 Visual) ---
  if (numDice === 1 && numSides === 6) {
    const val = rolls[0];
    const word = NUM_WORDS[val];

    // Using the legacy image source style
    const imageUrl = `https://www.clker.com/cliparts/M/k/N/Z/2/p/rolling-dice-${word}-md.png`;

    try {
      // Send as photo with caption
      return await response.upload('photo', imageUrl, { caption: resultMsg });
    } catch (e) {
      // Fallback to text if image fails
      return response.reply(resultMsg);
    }
  }

  // --- STANDARD OUTPUT ---
  return response.reply(resultMsg);
}
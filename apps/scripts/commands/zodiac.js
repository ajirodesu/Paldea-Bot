/**
 * Zodiac Compatibility Command
 * Analyzes the compatibility between two zodiac signs.
 */
export const meta = {
  name: "zodiac",
  aliases: ["compatibility", "astro", "zodiacmatch"],
  version: "1.1.0",
  description: "Check zodiac compatibility between two signs.",
  author: "JohnDev19",
  prefix: "both",
  category: "fun",
  type: "anyone",
  cooldown: 5,
  guide: ["<Sign1> <Sign2>"]
};

// --- Data ---
const zodiacSigns = {
  Aries: { dates: "Mar 21 - Apr 19", element: "Fire", symbol: "♈", planet: "Mars", traits: ["Courageous", "Energetic", "Confident"] },
  Taurus: { dates: "Apr 20 - May 20", element: "Earth", symbol: "♉", planet: "Venus", traits: ["Reliable", "Patient", "Devoted"] },
  Gemini: { dates: "May 21 - Jun 20", element: "Air", symbol: "♊", planet: "Mercury", traits: ["Adaptable", "Witty", "Intellectual"] },
  Cancer: { dates: "Jun 21 - Jul 22", element: "Water", symbol: "♋", planet: "Moon", traits: ["Emotional", "Intuitive", "Protective"] },
  Leo: { dates: "Jul 23 - Aug 22", element: "Fire", symbol: "♌", planet: "Sun", traits: ["Charismatic", "Generous", "Creative"] },
  Virgo: { dates: "Aug 23 - Sep 22", element: "Earth", symbol: "♍", planet: "Mercury", traits: ["Analytical", "Practical", "Modest"] },
  Libra: { dates: "Sep 23 - Oct 22", element: "Air", symbol: "♎", planet: "Venus", traits: ["Charming", "Diplomatic", "Social"] },
  Scorpio: { dates: "Oct 23 - Nov 21", element: "Water", symbol: "♏", planet: "Pluto", traits: ["Passionate", "Resourceful", "Intense"] },
  Sagittarius: { dates: "Nov 22 - Dec 21", element: "Fire", symbol: "♐", planet: "Jupiter", traits: ["Optimistic", "Adventurous", "Independent"] },
  Capricorn: { dates: "Dec 22 - Jan 19", element: "Earth", symbol: "♑", planet: "Saturn", traits: ["Disciplined", "Ambitious", "Practical"] },
  Aquarius: { dates: "Jan 20 - Feb 18", element: "Air", symbol: "♒", planet: "Uranus", traits: ["Innovative", "Humanitarian", "Eccentric"] },
  Pisces: { dates: "Feb 19 - Mar 20", element: "Water", symbol: "♓", planet: "Neptune", traits: ["Compassionate", "Artistic", "Gentle"] }
};

// Simplified matrix for demonstration; logic handles defaults
const compatibilityMatrix = {
  Aries: { Leo: { score: 95, desc: "Perfect Match! Passionate and dynamic." } },
  Taurus: { Virgo: { score: 90, desc: "Stable and supportive partnership." } },
  Gemini: { Libra: { score: 92, desc: "Harmonious and balanced relationship." } },
  Cancer: { Scorpio: { score: 94, desc: "Deep and intense emotional connection." } }
};

// --- Helpers ---
const normalizeSign = (sign) => sign.charAt(0).toUpperCase() + sign.slice(1).toLowerCase();

const getTip = () => {
  const tips = [
    "Communication is key to understanding each other.",
    "Respect differences and grow together.",
    "Practice patience and empathy.",
    "Embrace complementary strengths.",
    "Be honest about your feelings.",
    "Celebrate each other's uniqueness."
  ];
  return tips[Math.floor(Math.random() * tips.length)];
};

// --- Command ---
export async function onStart({ args, response, usage }) {
  if (args.length !== 2) return usage();

  const sign1 = normalizeSign(args[0]);
  const sign2 = normalizeSign(args[1]);

  if (!zodiacSigns[sign1] || !zodiacSigns[sign2]) {
    const list = Object.keys(zodiacSigns).join(", ");
    return response.reply(`❌ **Invalid Sign**\nAvailable: ${list}`);
  }

  const loading = await response.reply("🔮 **Reading the stars...**");

  try {
    const s1Data = zodiacSigns[sign1];
    const s2Data = zodiacSigns[sign2];

    // Calculate Score
    let base = compatibilityMatrix[sign1]?.[sign2] || compatibilityMatrix[sign2]?.[sign1];

    // Default logic if not in specific matrix
    if (!base) {
      base = {
        score: 60, 
        desc: "Balanced relationship with potential for growth."
      };

      // Element Logic
      const elements = { Fire: ["Air"], Earth: ["Water"], Air: ["Fire"], Water: ["Earth"] };
      if (elements[s1Data.element]?.includes(s2Data.element)) base.score += 20;
      if (s1Data.element === s2Data.element) base.score += 15;
    }

    const finalScore = Math.min(base.score, 100);
    const heart = finalScore > 80 ? "❤️" : (finalScore > 50 ? "💛" : "🖤");

    const msg = 
      `🌟 **Zodiac Compatibility** 🌟\n\n` +
      `${s1Data.symbol} **${sign1}** × **${sign2}** ${s2Data.symbol}\n\n` +

      `📊 **Score:** ${finalScore}% ${heart}\n` +
      `📝 ${base.desc}\n\n` +

      `🌈 **${sign1} Details:**\n` +
      `• Element: ${s1Data.element} | Planet: ${s1Data.planet}\n` +
      `• Traits: _${s1Data.traits.join(", ")}_\n\n` +

      `🌈 **${sign2} Details:**\n` +
      `• Element: ${s2Data.element} | Planet: ${s2Data.planet}\n` +
      `• Traits: _${s2Data.traits.join(", ")}_\n\n` +

      `💡 **Tip:** ${getTip()}`;

    await response.edit('text', loading, msg);

  } catch (err) {
    await response.edit('text', loading, `⚠️ **Error:** ${err.message}`);
  }
}
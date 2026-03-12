export const meta = {
  name: "venice",
  aliases: ["veniceai", "ven", "ai"],
  version: "1.0.0",
  author: "ShawnDesu",
  description: "Chat with Venice AI (free API by Danzz)",
  prefix: "both",
  guide: ["<your question>"],
  cooldown: 6,
  type: "anyone",
  category: "ai"
};

export async function onStart({ bot, response, chatId, msg, args }) {
  const prompt = args.join(" ").trim();

  // ==================== LOADING MESSAGE ====================
  const loading = await response.reply("⏳ Thinking");

  if (!prompt) {
    return await response.edit(
      "text",
      loading,
      "❌ Please ask something!\n\nExample: `venice Who are you?`"
    );
  }

  try {
    const apiUrl = `${global.paldea.api.danzy}/api/ai/venice?message=${encodeURIComponent(prompt)}&system=assistant`;
    const res = await fetch(apiUrl);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    if (!data.status || !data.result) {
      throw new Error("Invalid API response");
    }

    const aiReply = data.result.trim();

    // Edit loading message into clean AI response (single message, clean chat)
    await response.edit("text", loading, aiReply);

  } catch (error) {
    console.error("Venice AI error:", error);
    await response.edit(
      "text",
      loading,
      "❌ Venice AI is not responding right now.\n\nPlease try again in a few seconds!"
    );
  }
}
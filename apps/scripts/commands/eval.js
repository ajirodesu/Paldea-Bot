/**
 * Eval Command
 * Executes arbitrary JavaScript code for debugging and testing.
 */
export const meta = {
  name: "eval",
  version: "1.0.0",
  aliases: ["e", "run"],
  description: "Evaluate JavaScript code (Developer Only)",
  author: "AjiroDesu",
  prefix: "both",
  category: "developer",
  type: "developer",
  cooldown: 0,
  guide: ["<code to evaluate>"],
};

export async function onStart({ args, response, usage }) {
  if (!args.length) return usage();

  const code = args.join(" ");
  const loading = await response.reply('⚙️ **Compiling...**');

  // Helper: Convert Map to Object for cleaner JSON output
  const mapToObj = (m) => Array.from(m).reduce((obj, [key, value]) => {
    obj[key] = value;
    return obj;
  }, {});

  // Helper: Format Output
  const formatOutput = async (result) => {
    if (result instanceof Promise) result = await result;

    if (typeof result === "object" && result !== null) {
      if (result instanceof Map) result = mapToObj(result);
      try {
        // Handle circular references or complex objects
        return JSON.stringify(result, null, 2);
      } catch {
        return result.toString();
      }
    }
    return String(result);
  };

  try {
    // Wrap in async IIFE to allow top-level await in the input
    const result = await eval(`(async () => { return ${code} })()`);
    const output = await formatOutput(result);

    // Truncate if too long (Telegram limit ~4096)
    if (output.length > 4000) {
      const buffer = Buffer.from(output, 'utf8');
      await response.delete(loading);
      return response.upload('document', buffer, { filename: 'eval-output.json', caption: '✅ Output too long.' });
    }

    await response.edit('text', loading, `\`\`\`json\n${output}\n\`\`\``);

  } catch (err) {
    console.error('Eval Error:', err);
    await response.edit('text', loading, `❌ **Runtime Error:**\n\`${err.message}\``);
  }
}
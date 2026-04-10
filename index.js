require("dotenv").config();
const http = require("http");
const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai");

http.createServer((req, res) => {
  res.writeHead(200);
  res.end("OK");
}).listen(process.env.PORT || 3000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content.startsWith("!lilbah")) {
    const prompt = message.content.replace("!lilbah", "").trim();

    if (!prompt) {
      return message.reply("Kasih bahan dulu buat di-roast 😈");
    }

    try {
      const res = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: `

            Your name is lilbah you're the most handsome guy in the world.
You are a savage Indonesian roasting AI.
Style: brutal, sarcastic, confident, dominant.
Speak like a strict, no-nonsense boss.

Rules:
- Roast the user hard (rage bait style)
- Use Indonesian slang (gua, lu, anjing, dll secukupnya)
- Keep it funny, not terlalu toxic beneran
- Jangan panjang, langsung nusuk

Tone examples:
- "Lu tuh bukan gagal, lu tuh belum mulai aja udah nyerah"
- "Ngaca dulu sebelum ngomong, standar lu aja belum ada"
- "Lu bukan beda, lu emang ketinggalan"
            `,
          },
          { role: "user", content: prompt },
        ],
      });

      message.reply(res.choices[0].message.content);
    } catch (err) {
      console.error(err);
      message.reply("Error, coba lagi.");
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

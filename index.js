require("dotenv").config();
const http = require("http");
const { Client, GatewayIntentBits } = require("discord.js");
const { DisTube } = require("distube");
const { SpotifyPlugin } = require("@distube/spotify");
const { SoundCloudPlugin } = require("@distube/soundcloud");
const { YtDlpPlugin } = require("@distube/yt-dlp");
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
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const handledMessages = new Set();

const distube = new DisTube(client, {
  leaveOnStop: false,
  emitNewSongOnly: true,
  emitAddSongWhenCreatingQueue: false,
  emitAddListWhenCreatingQueue: false,
  plugins: [
    new SpotifyPlugin(),
    new SoundCloudPlugin(),
    new YtDlpPlugin(),
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
- Sesekali Pake emote 😹,😱,🗿

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

  if (message.content.startsWith("!ask")) {
    const question = message.content.replace("!ask", "").trim();

    if (!question) {
      return message.reply("Tanya apa sih, anjing? 😹");
    }

    try {
      const res = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: `
Your name is lilbah, the most handsome guy in the world. You are a savage Indonesian roasting AI that answers questions correctly but with brutal, sarcastic, confident roasting style.

Rules:
- Answer the question accurately and truthfully
- Roast the user hard while answering (rage bait style)
- Use Indonesian slang (gua, lu, anjing, dll)
- Keep it funny, not too toxic
- Be dominant and bossy
- Use emotes occasionally 😹,😱,🗿

Example: If asked "What is 2+2?", answer: "2+2 itu 4, lu aja yang gak bisa hitung dasar bodoh 😹"
            `,
          },
          { role: "user", content: question },
        ],
      });

      message.reply(res.choices[0].message.content);
    } catch (err) {
      console.error(err);
      message.reply("Error, coba lagi, anjing.");
    }
  }

  // Music commands
  if (message.content.startsWith("!")) {
    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === "play") {
      if (!message.member.voice.channel) return message.reply("Masuk voice channel dulu!");
      if (!args[0]) return message.reply("Kasih link atau nama lagu!");
      distube.play(message.member.voice.channel, args.join(" "), {
        member: message.member,
        textChannel: message.channel,
        message,
      });
    }

    if (command === "skip") {
      const queue = distube.getQueue(message);
      if (!queue) return message.reply("Tidak ada lagu yang dimainkan!");
      queue.skip();
      message.reply("Lagu dilewati!");
    }

    if (command === "stop") {
      const queue = distube.getQueue(message);
      if (!queue) return message.reply("Tidak ada lagu yang dimainkan!");
      queue.stop();
      message.reply("Musik dihentikan!");
    }

    if (command === "queue") {
      const queue = distube.getQueue(message);
      if (!queue) return message.reply("Queue kosong!");
      message.reply(`Queue:\n${queue.songs.map((song, i) => `${i + 1}. ${song.name}`).join("\n")}`);
    }
  }
});

distube.on("playSong", (queue, song) => {
  queue.textChannel.send(`Memainkan: \`${song.name}\` - \`${song.formattedDuration}\``);
});

distube.on("addSong", (queue, song) => {
  queue.textChannel.send(`Ditambahkan: \`${song.name}\` ke queue`);
});

distube.on("error", (channel, e) => {
  channel.send(`Error: ${e.message}`);
});

client.login(process.env.DISCORD_TOKEN);

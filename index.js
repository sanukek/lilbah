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

function isQuestion(text) {
  const lower = text.toLowerCase().trim();
  if (!lower) return false;
  if (lower.endsWith("?")) return true;
  const questionWords = [
    "apa",
    "kenapa",
    "kapan",
    "siapa",
    "di mana",
    "dimana",
    "bagaimana",
    "mau",
    "pakah",
  ];
  return questionWords.some((word) => lower.startsWith(word + " ") || lower.startsWith(word + "?") || lower.includes(" " + word + " "));
}

async function getLocationCoordinates(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=id&format=json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.results || data.results.length === 0) return null;
  const { latitude, longitude, name, country, admin1 } = data.results[0];
  return { latitude, longitude, name, country, admin1 };
}

async function getWeatherReport(latitude, longitude) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data.current_weather || null;
}

function weatherCodeToDescription(code) {
  const map = {
    0: "cerah",
    1: "cemerlang",
    2: "berawan",
    3: "berawan tebal",
    45: "kabut",
    48: "kabut berbekas es",
    51: "hujan gerimis ringan",
    53: "hujan gerimis sedang",
    55: "hujan gerimis lebat",
    56: "hujan gerimis es ringan",
    57: "hujan gerimis es lebat",
    61: "hujan ringan",
    63: "hujan sedang",
    65: "hujan lebat",
    66: "hujan es ringan",
    67: "hujan es lebat",
    71: "salju ringan",
    73: "salju sedang",
    75: "salju lebat",
    77: "butiran es",
    80: "hujan lokal ringan",
    81: "hujan lokal sedang",
    82: "hujan lokal lebat",
    85: "salju lokal ringan",
    86: "salju lokal lebat",
    95: "badai petir",
    96: "badai petir dengan hujan es ringan",
    99: "badai petir dengan hujan es lebat",
  };
  return map[code] || "cuaca nggak jelas";
}

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Auto reply if bot is mentioned or replied to
  const isReplyToBot = message.reference && (await message.channel.messages.fetch(message.reference.messageId)).author.id === client.user.id;
  const isMentioned = message.mentions.has(client.user);

  if (isReplyToBot || isMentioned) {
    const prompt = message.content.replace(`<@${client.user.id}>`, "").replace(`<@!${client.user.id}>`, "").trim();
    const questionMode = isQuestion(prompt);
    const userPrompt = questionMode ? `answer the question correctly and roast the user: ${prompt}` : prompt;

    if (!prompt) {
      return message.reply("Apa? Ngomong yang jelas dong 😹");
    }

    try {
      // Fetch message history
      const messages = await message.channel.messages.fetch({ limit: 6 });
      const sortedMessages = Array.from(messages.values()).reverse();
      
      let chatHistory = "Chat history:\n";
      sortedMessages.forEach((msg, idx) => {
        if (idx < sortedMessages.length - 1) {
          chatHistory += `${msg.author.username}: ${msg.content}\n`;
        }
      });

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
- Baca chat history untuk konteks
- Pake Lowercase semua, kalo user typingnya pake uppercase lu katain dia ngetik huruf depannya gede pasti pake android awkwoaokao

${chatHistory}
Tone examples:
- "lu tuh bukan gagal, lu tuh belum mulai aja udah nyerah"
- "ngaca dulu sebelum ngomong, standar lu aja belum ada"
- "lu bukan beda, lu emang ketinggalan"
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

  if (message.content.startsWith("!lilbah")) {
    const prompt = message.content.replace("!lilbah", "").trim();

    if (!prompt) {
      return message.reply("Kasih bahan dulu buat di-roast 😈");
    }

    try {
      // Fetch message history (last 5 messages for context)
      const messages = await message.channel.messages.fetch({ limit: 6 });
      const sortedMessages = Array.from(messages.values()).reverse();
      
      let chatHistory = "Chat history:\n";
      sortedMessages.forEach((msg, idx) => {
        if (idx < sortedMessages.length - 1) {
          chatHistory += `${msg.author.username}: ${msg.content}\n`;
        }
      });

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
- Baca chat history untuk konteks
- Pake Lowercase semua, kalo user typingnya pake uppercase lu katain dia ngetik ko huruf depannya gede pasti pake android awkwoaokao

${chatHistory}
Tone examples:
- "lu tuh bukan gagal, lu tuh belum mulai aja udah nyerah"
- "ngaca dulu sebelum ngomong, standar lu aja belum ada"
- "lu bukan beda, lu emang ketinggalan"
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
      // Fetch message history
      const messages = await message.channel.messages.fetch({ limit: 6 });
      const sortedMessages = Array.from(messages.values()).reverse();
      
      let chatHistory = "Chat history:\n";
      sortedMessages.forEach((msg, idx) => {
        if (idx < sortedMessages.length - 1) {
          chatHistory += `${msg.author.username}: ${msg.content}\n`;
        }
      });

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
- Baca chat history untuk konteks lebih baik
- Pake Lowercase semua, kalo user typingnya pake uppercase lu katain dia ngetik huruf depannya gede pasti pake android awkwoaokao

${chatHistory}

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

    if (command === "weather" || command === "cuaca") {
      const locationQuery = args.join(" ").trim();
      if (!locationQuery) {
        return message.reply("Tulis lokasi dulu dong. Contoh: !cuaca jakarta");
      }

      try {
        const location = await getLocationCoordinates(locationQuery);
        if (!location) {
          return message.reply(`Lokasi ${locationQuery} nggak ketemu, coba sebutkan kota lain.`);
        }

        const weather = await getWeatherReport(location.latitude, location.longitude);
        if (!weather) {
          return message.reply("Gagal ngambil data cuaca, cobain lagi nanti.");
        }

        const description = weatherCodeToDescription(weather.weathercode);
        message.reply(`cuaca di ${location.name}, ${location.admin1 || location.country}: ${description}, suhu ${weather.temperature}°c, kecepatan angin ${weather.windspeed} km/jam.`);
      } catch (err) {
        console.error(err);
        message.reply("Error pas cek cuaca, coba lagi nanti.");
      }
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

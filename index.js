const { Client, Events, IntentsBitField } = require("discord.js");
const { Configuration, OpenAIApi } = require("openai");
require("dotenv/config");

let allowedChannels = ["1095313352596668428"];

const testingAllowedChannels = ["1095307902413189141"];
allowedChannels = testingAllowedChannels;
const discordClient = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
});

const openApiClientConfig = new Configuration({
  apiKey: process.env.OPEN_API_KEY,
});

const openAiClient = new OpenAIApi(openApiClientConfig);

discordClient.on("messageCreate", async (msg) => {
  try {
    if (allowedChannels.indexOf(msg.channelId) == -1) return;
    if (msg.author.bot) return;
    if (msg.content.startsWith("!")) return;

    const conversationLog = [
      {
        role: "system",
        content: "You are a friendly chatbot.",
      },
    ];

    await msg.channel.sendTyping();

    const channelMessageHistory = await msg.channel.messages.fetch({
      limit: 50,
    });
    channelMessageHistory.reverse();

    for (const messageHistoryItem of channelMessageHistory) {
      const historicalMessage = messageHistoryItem[1];

      if (
        !historicalMessage.content ||
        historicalMessage.content.startsWith("!") ||
        (historicalMessage.author.bot &&
          historicalMessage.author.id != discordClient.user.id)
      ) {
        continue;
      }

      if (historicalMessage.author.id === msg.author.id) {
        conversationLog.push({
          role: "user",
          content: historicalMessage.content,
        });
      } else if (historicalMessage.author.id === discordClient.user.id) {
        if (historicalMessage.content.startsWith("ERROR:")) continue;
        //if message was sent by gpt-bot, check that the message it was replying to is from the same user as current message
        if (historicalMessage.reference) {
          const originalMessage = await historicalMessage.fetchReference();
          if (originalMessage.author.id === msg.author.id) {
            conversationLog.push({
              role: "assistant",
              content: historicalMessage.content,
            });
          }
        }
      }
    }

    try {
      const result = await openAiClient.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: conversationLog,
      });
      msg.reply(result.data.choices[0].message);
    } catch (err) {
      msg.reply({
        content: "ERROR: " + error.message,
      });
    }
  } catch (error) {
    msg.reply("ERROR: " + JSON.stringify(error));
    console.log(error);
  }
});

discordClient.once(Events.ClientReady, (c) => {
  console.log("Gpt-Bot intialised");
});
discordClient.login(process.env.TOKEN);

const { Client, Events, IntentsBitField } = require("discord.js");
const { Configuration, OpenAIApi } = require("openai");
require("dotenv/config");
const config = require("./config.json");

const testing = false;

//allowedChannels = testingAllowedChannels;
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
    if (
      !msg.guild.members.me.permissionsIn(msg.channel).has("SendMessages") ||
      !msg.guild.members.me.permissionsIn(msg.channel).has("ReadMessageHistory")
    )
      return;
    if (msg.author.bot) return;
    if (msg.content.startsWith("!")) return;

    let conversationLog = [
      {
        role: "system",
        content:
          config.initialPrompt[msg.channelId] || config.defaultInitialPrompt,
      },
    ];

    const channelMessageHistory = await msg.channel.messages.fetch({
      limit: config.discordMessageFetchLimit,
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
        if (
          historicalMessage.content.toLowerCase().startsWith("clear history")
        ) {
          conversationLog = [conversationLog[0]];
          continue;
        } else {
          conversationLog.push({
            role: "user",
            content: historicalMessage.content,
          });
        }
      } else if (historicalMessage.author.id === discordClient.user.id) {
        if (historicalMessage.content.startsWith("ERROR:")) continue;
        //if message was sent by gpt-bot, check that the message it was replying to is from the same user as current message
        if (historicalMessage.reference) {
          try {
            const originalMessage = await historicalMessage.fetchReference();
            if (originalMessage.author.id === msg.author.id) {
              conversationLog.push({
                role: "assistant",
                content: historicalMessage.content,
              });
            }
          } catch (err) {}
        }
      }
    }

    if (msg.content.toLowerCase().startsWith("clear history")) {
      return;
    }
    await msg.channel.sendTyping();
    try {
      const result = await openAiClient.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: conversationLog,
      });
      const splitMessage = splitter(
        result.data.choices[0].message.content,
        1900
      );
      for (let msgStr of splitMessage) {
        msg.reply(msgStr);
      }
    } catch (err) {
      console.log(err);
      try {
        msg.reply({
          content: "ERROR: " + error.message,
        });
      } catch (e) {}
    }
  } catch (error) {
    console.log(error);
  }
});

discordClient.once(Events.ClientReady, (c) => {
  console.log("Gpt-Bot intialised");
});
discordClient.login(process.env.TOKEN);

function splitter(str, l) {
  var strs = [];
  while (str.length > l) {
    var pos = str.substring(0, l).lastIndexOf(" ");
    pos = pos <= 0 ? l : pos;
    strs.push(str.substring(0, pos));
    var i = str.indexOf(" ", pos) + 1;
    if (i < pos || i > pos + l) i = pos;
    str = str.substring(i);
  }
  strs.push(str);
  return strs;
}

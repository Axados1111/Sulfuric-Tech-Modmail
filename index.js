require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  ChannelType,
  PermissionsBitField
} = require('discord.js');

// crash logs
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// store active tickets
const threads = new Map();

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// MESSAGE HANDLER
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  console.log("📨 Message:", message.content);
  console.log("📍 DM?", !message.guild);

  // ======================
  // USER DM → CREATE THREAD
  // ======================
  if (!message.guild) {
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) return console.log("❌ Guild not found");

    let channel = threads.get(message.author.id);

    // create new channel if none
    if (!channel) {
      const category = guild.channels.cache.get(process.env.CATEGORY_ID);
      if (!category) return console.log("❌ Category not found");

      channel = await guild.channels.create({
        name: `modmail-${message.author.username}`,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: process.env.STAFF_ROLE_ID,
            allow: [PermissionsBitField.Flags.ViewChannel]
          }
        ]
      });

      threads.set(message.author.id, channel);

      channel.send(`📩 New modmail from **${message.author.tag}**`);
    }

    channel.send(`**User:** ${message.content}`);
  }

  // ======================
  // STAFF REPLY
  // ======================
  if (message.guild && message.channel.name.startsWith('modmail-')) {
    if (!message.member.roles.cache.has(process.env.STAFF_ROLE_ID)) return;

    const entry = [...threads.entries()].find(([_, ch]) => ch.id === message.channel.id);
    if (!entry) return;

    const user = await client.users.fetch(entry[0]);
    if (!user) return;

    user.send(`📨 **Staff:** ${message.content}`);
  }

  // ======================
  // CLOSE COMMAND
  // ======================
  if (
    message.guild &&
    message.channel.name.startsWith('modmail-') &&
    message.content === '!close'
  ) {
    if (!message.member.roles.cache.has(process.env.STAFF_ROLE_ID)) return;

    const entry = [...threads.entries()].find(([_, ch]) => ch.id === message.channel.id);

    if (entry) {
      const user = await client.users.fetch(entry[0]);
      user.send("❌ Your modmail has been closed.");
      threads.delete(entry[0]);
    }

    message.channel.delete();
  }
});

client.login(process.env.TOKEN);

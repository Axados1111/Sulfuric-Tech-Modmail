require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
    Partials,
    ChannelType,
    PermissionsBitField
} = require('discord.js');

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

const activeThreads = new Map();

client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

// 📩 Handle Messages
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // =====================
    // USER → DM BOT
    // =====================
    if (message.channel.type === ChannelType.DM) {
        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        if (!guild) return console.log("❌ Guild not found");

        let channel = activeThreads.get(message.author.id);

        // Create new modmail channel
        if (!channel) {
            const category = guild.channels.cache.get(process.env.CATEGORY_ID);

            if (!category) {
                console.log("❌ Category not found");
                return;
            }

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

            activeThreads.set(message.author.id, channel);

            channel.send(`📩 **New Modmail from ${message.author.tag}**`);
        }

        channel.send(`**${message.author.tag}:** ${message.content}`);
    }

    // =====================
    // STAFF → REPLY
    // =====================
    if (message.guild && message.channel.name.startsWith('modmail-')) {
        if (!message.member.roles.cache.has(process.env.STAFF_ROLE_ID)) return;

        const entry = [...activeThreads.entries()]
            .find(([_, ch]) => ch.id === message.channel.id);

        if (!entry) return;

        const userId = entry[0];
        const user = await client.users.fetch(userId);

        if (!user) return;

        user.send(`📨 **Staff:** ${message.content}`);
    }

    // =====================
    // CLOSE COMMAND
    // =====================
    if (
        message.guild &&
        message.channel.name.startsWith('modmail-') &&
        message.content === '!close'
    ) {
        if (!message.member.roles.cache.has(process.env.STAFF_ROLE_ID)) return;

        const entry = [...activeThreads.entries()]
            .find(([_, ch]) => ch.id === message.channel.id);

        if (entry) {
            const user = await client.users.fetch(entry[0]);
            user.send("❌ Your modmail has been closed.");
            activeThreads.delete(entry[0]);
        }

        message.channel.delete();
    }
});

client.login(process.env.TOKEN);

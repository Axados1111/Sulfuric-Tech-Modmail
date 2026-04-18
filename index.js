const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    ChannelType, 
    PermissionsBitField 
} = require('discord.js');

const config = require('./config.json');

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
    console.log(`Logged in as ${client.user.tag}`);
});

// 📩 User DMs bot
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // USER DM
    if (message.channel.type === ChannelType.DM) {
        const guild = client.guilds.cache.get(config.guildId);
        if (!guild) return;

        let channel = activeThreads.get(message.author.id);

        // Create new thread
        if (!channel) {
            const category = guild.channels.cache.get(config.categoryId);

            channel = await guild.channels.create({
                name: `modmail-${message.author.username}`,
                type: ChannelType.GuildText,
                parent: category,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone,
                        deny: [PermissionsBitField.Flags.ViewChannel]
                    },
                    {
                        id: config.staffRoleId,
                        allow: [PermissionsBitField.Flags.ViewChannel]
                    }
                ]
            });

            activeThreads.set(message.author.id, channel);

            channel.send(`📩 **New Modmail from ${message.author.tag}**`);
        }

        channel.send(`**${message.author.tag}:** ${message.content}`);
    }

    // STAFF REPLY
    if (message.guild && message.channel.name.startsWith('modmail-')) {
        if (!message.member.roles.cache.has(config.staffRoleId)) return;

        const userId = [...activeThreads.entries()]
            .find(([_, ch]) => ch.id === message.channel.id)?.[0];

        if (!userId) return;

        const user = await client.users.fetch(userId);
        if (!user) return;

        user.send(`📨 **Staff:** ${message.content}`);
    }
});

// ❌ Close command
client.on('messageCreate', async (message) => {
    if (!message.guild) return;
    if (!message.channel.name.startsWith('modmail-')) return;

    if (message.content === '!close') {
        if (!message.member.roles.cache.has(config.staffRoleId)) return;

        const userId = [...activeThreads.entries()]
            .find(([_, ch]) => ch.id === message.channel.id)?.[0];

        if (userId) {
            const user = await client.users.fetch(userId);
            user.send("❌ Your modmail has been closed.");
            activeThreads.delete(userId);
        }

        message.channel.delete();
    }
});

client.login(config.token);

const Discord = require("discord.js");
const mysql = require("promise-mysql");
const fs = require("fs");
const DBL = require("dblapi.js");

const client = new Discord.Client();
const logger = require('./logger')("kmq");
const config = require("./config.json");
const GuildPreference = require("./models/guild_preference");
const guessSong = require("./helpers/guess_song");
const validate = require("./helpers/validate");
const options = require("./commands/options");
const { clearPartiallyCachedSongs } = require("./helpers/utils");

let db;
let commands = {};
let gameSessions = {};
let guildPreferences = {};

const dbl = config.topGGToken ? new DBL(config.topGGToken, client) : null;

if (dbl) {
    dbl.on('posted', () => {
        logger.info('Server count posted!');
    });
    dbl.on('error', (e) => {
        logger.error(`Server count post failed! ${e}`);
    });
}
else {
    logger.info("No top.gg token passed (check your config.json)! Ignoring posting top.gg server count.");
}

client.on("ready", () => {
    logger.info(`Logged in as ${client.user.tag}!`);
});

client.on("message", (message) => {
    if (message.author.equals(client.user) || message.author.bot) return;
    let guildPreference = getGuildPreference(guildPreferences, message.guild.id);
    let botPrefix = guildPreference.getBotPrefix();
    let parsedMessage = parseMessage(message.content, botPrefix) || null;

    if (message.mentions.has(client.user) && message.content.split(" ").length == 1) {
        // Any message that mentions the bot sends the current options
        options.call({message, guildPreference});
    }

    if (parsedMessage && commands[parsedMessage.action]) {
        let command = commands[parsedMessage.action];
        if (validate(message, parsedMessage, command.validations, botPrefix)) {
            command.call({
                client,
                gameSessions,
                guildPreference,
                message,
                db,
                parsedMessage,
                botPrefix
            });
        }
    }
    else {
        if (gameSessions[message.guild.id]) {
            guessSong({ client, message, gameSessions, guildPreference, db });
        }
    }
});

client.on("voiceStateUpdate", (oldState, newState) => {
    let oldUserChannel = oldState.channel;
    let newUserChannel = newState.channel;
    if (!newUserChannel) {
        let guildID = oldUserChannel.guild.id;
        let gameSession = gameSessions[guildID];
        // User left voice channel, check if bot is only one left
        if (oldUserChannel.members.size === 1) {
            let voiceConnection = client.voice.connections.get(guildID);
            if (voiceConnection) {
                voiceConnection.disconnect();
                if (gameSession) {
                    gameSession.endRound();
                }
                return;
            }
        }
        // Bot was disconnected by another user
        if (!oldUserChannel.members.has(client)) {
            if (gameSession) {
                gameSession.endRound();
            }
        }
    }
});

const getGuildPreference = (guildPreferences, guildID) => {
    if (!guildPreferences[guildID]) {
        guildPreferences[guildID] = new GuildPreference(guildID);
        let guildPreferencesInsert = `INSERT INTO kmq.guild_preferences VALUES(?, ?)`;
        db.query(guildPreferencesInsert, [guildID, JSON.stringify(guildPreferences[guildID])]);
    }
    return guildPreferences[guildID];
}

const parseMessage = (message, botPrefix) => {
    if (message.charAt(0) !== botPrefix) return null;
    let components = message.split(" ");
    let action = components.shift().substring(1);
    let argument = components.join(" ");
    return {
        action,
        argument,
        message,
        components
    }
}

(async () => {
    db = await mysql.createPool({
        connectionLimit: 10,
        host: "localhost",
        user: config.dbUser,
        password: config.dbPassword
    });
    if (!config.botToken || config.botToken === "YOUR BOT TOKEN HERE") {
        logger.error("No bot token set. Please update config.json!")
        process.exit(1);
    }
    let guildPreferencesTableCreation = `CREATE TABLE IF NOT EXISTS kmq.guild_preferences(
        guild_id TEXT NOT NULL,
        guild_preference JSON NOT NULL
    );`;

    await db.query(guildPreferencesTableCreation);

    let fields = await db.query(`SELECT * FROM kmq.guild_preferences`);

    fields.forEach((field) => {
        guildPreferences[field.guild_id] = new GuildPreference(field.guild_id, JSON.parse(field.guild_preference));
    });
    client.login(config.botToken);

    fs.readdir("./commands/", (err, files) => {
        if (err) return console.error(err);
        files.forEach(file => {
            if (!file.endsWith(".js")) return;
            let command = require(`./commands/${file}`);
            let commandName = file.split(".")[0];
            commands[commandName] = command;
        });
    });

    clearPartiallyCachedSongs();
})();

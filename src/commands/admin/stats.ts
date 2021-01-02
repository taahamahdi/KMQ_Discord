import Eris from "eris";
import os from "os";
import BaseCommand, { CommandArgs } from "../base_command";
import {
    sendEmbed, getDebugLogHeader,
} from "../../helpers/discord_utils";
import dbContext from "../../database_context";
import { bold } from "../../helpers/utils";
import _logger from "../../logger";

const logger = _logger("stats");

export default class SkipCommand implements BaseCommand {
    help = {
        name: "stats",
        description: "Various usage/system statistics.",
        usage: "!stats",
        examples: [],
        priority: 1,
    };

    async call({ gameSessions, message }: CommandArgs) {
        const activeGameSessions = Object.keys(gameSessions).length;
        const activeUsers = Object.values(gameSessions).reduce((total, curr) => total + curr.participants.size, 0);
        const dateThreshold = new Date();
        dateThreshold.setHours(dateThreshold.getHours() - 24);
        const recentGameSessions = (await dbContext.kmq("game_sessions")
            .where("start_date", ">", dateThreshold)
            .count("* as count"))[0].count;

        const recentGameRounds = (await dbContext.kmq("game_sessions")
            .where("start_date", ">", dateThreshold)
            .sum("rounds_played as total"))[0].total;

        const recentPlayers = (await dbContext.kmq("player_stats")
            .where("last_active", ">", dateThreshold)
            .count("* as count"))[0].count;

        const fields: Array<Eris.EmbedField> = [{
            name: "Active Game Sessions",
            value: activeGameSessions.toString(),
            inline: true,
        },
        {
            name: "Active Players",
            value: activeUsers.toString(),
            inline: true,
        },
        {
            name: "Recent Game Sessions",
            value: recentGameSessions.toString(),
            inline: true,
        },
        {
            name: "Recent Rounds Played",
            value: recentGameRounds.toString(),
            inline: true,
        },
        {
            name: "Recent Active Players",
            value: recentPlayers,
            inline: true,
        },
        {
            name: "System Load Average",
            value: os.loadavg().map((x) => x.toFixed(2)).toString(),
            inline: true,
        },
        {
            name: "Process Memory Usage",
            value: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
            inline: true,
        },
        {
            name: "API Latency",
            value: `${message.channel.guild.shard.latency} ms`,
            inline: true,
        },
        {
            name: "Process Uptime",
            value: `${(process.uptime() / (60 * 60)).toFixed(2)} hours`,
            inline: true,
        }];

        logger.info(`${getDebugLogHeader(message)} | Stats retrieved`);
        sendEmbed(message.channel, {
            title: bold("Bot Stats"),
            fields,
            footer: {
                text: "'Recent' statistics represent data from last 24 hours.",
            },
            timestamp: new Date(),
        });
    }
}

/* eslint-disable @typescript-eslint/dot-notation */
import Eris from "eris";
import dbContext from "../../database_context";
import { getDebugLogHeader, getMessageContext, getUserTag, sendEmbed, sendInfoMessage } from "../../helpers/discord_utils";
import BaseCommand, { CommandArgs } from "../base_command";
import _logger from "../../logger";
import { bold, friendlyFormattedDate } from "../../helpers/utils";

const logger = _logger("profile");

export default class ProfileCommand implements BaseCommand {
    help = {
        name: "profile",
        description: "Shows your game stats.",
        usage: "!profile",
        examples: [],
        priority: 50,
    };

    async call({ message }: CommandArgs) {
        const authorId = message.author.id;
        const playerStats = await dbContext.kmq("player_stats")
            .select("songs_guessed", "games_played", "first_play", "last_active")
            .where("player_id", "=", authorId)
            .first();
        logger.info(`${getDebugLogHeader(message)} | Profile retrieved`);

        if (!playerStats) {
            sendInfoMessage(getMessageContext(message), "No profile found", "Play your first game to begin tracking your stats!");
            return;
        }

        const fields: Array<Eris.EmbedField> = [{
            name: "Songs Guessed",
            value: playerStats["songs_guessed"],
        },
        {
            name: "Games Played",
            value: playerStats["games_played"],
        },
        {
            name: "First Played",
            value: friendlyFormattedDate(new Date(playerStats["first_play"])),
        },
        {
            name: "Last Active",
            value: friendlyFormattedDate(new Date(playerStats["last_active"])),
        }];

        sendEmbed(message.channel, {
            title: bold(`${getUserTag(message.author)}`),
            fields,
            timestamp: new Date(),
        });
    }
}

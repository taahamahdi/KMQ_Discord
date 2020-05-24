import BaseCommand, { CommandArgs } from "./base_command";
import { sendOptionsMessage, getDebugContext } from "../helpers/discord_utils";
import { GameOptions } from "../helpers/game_utils";
import _logger from "../logger";
const logger = _logger("seek");
const SEEK_TYPES: { [seekType: string]: string } = { BEGINNING: "beginning", RANDOM: "random" }

class SeekCommand implements BaseCommand {
    async call({ guildPreference, message, parsedMessage, db }: CommandArgs) {
        let seekType = parsedMessage.components[0];
        guildPreference.setSeekType(seekType, db);
        await sendOptionsMessage(message, guildPreference, db, GameOptions.SEEK_TYPE);
        logger.info(`${getDebugContext(message)} | Seek type set to ${seekType}`);
    }
    validations = {
        minArgCount: 1,
        maxArgCount: 1,
        arguments: [
            {
                name: "seekType",
                type: "enum" as const,
                enums: Object.values(SEEK_TYPES)
            }
        ]
    }

    help = {
        name: "seek",
        description: "Choose whether each song is played from the beginning, or at a random point.",
        usage: "!seek [seekType]",
        arguments: [
            {
                name: "seek",
                description: "Valid values are \`beginning\` or \`random\`"
            }
        ]
    }
}
export default SeekCommand;
export {
    SEEK_TYPES
}
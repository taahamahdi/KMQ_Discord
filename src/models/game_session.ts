import Eris from "eris";
import fs from "fs";
import { CommandArgs } from "../commands/base_command";
import { SEEK_TYPE } from "../commands/seek";
import { db } from "../databases";
import { isDebugMode, skipSongPlay } from "../helpers/debug_utils";
import { getDebugContext, getUserIdentifier, getVoiceChannel, sendEndGameMessage, sendErrorMessage, sendSongMessage } from "../helpers/discord_utils";
import { ensureVoiceConnection, getGuildPreference, selectRandomSong } from "../helpers/game_utils";
import { delay, getAudioDurationInSeconds } from "../helpers/utils";
import { state } from "../kmq";
import _logger from "../logger";
import { QueriedSong } from "../types";
import GameRound from "./game_round";
import GuildPreference from "./guild_preference";
import Scoreboard from "./scoreboard";
import path from "path";
import { deleteGameSession } from "../helpers/management_utils";

const logger = _logger("game_session");

export default class GameSession {
    private readonly startedAt: number;

    public sessionInitialized: boolean;
    public scoreboard: Scoreboard;
    public connection: Eris.VoiceConnection;
    public finished: boolean;
    public lastActive: number;
    public textChannel: Eris.TextChannel;
    public voiceChannel: Eris.VoiceChannel;
    public gameRound: GameRound;
    public roundsPlayed: number;
    public participants: Set<string>;
    public guessTimeoutVal: number;

    private guessTimes: Array<number>;
    private songAliasList: { [songId: string]: Array<string> };
    private guessTimeoutFunc: NodeJS.Timer;


    constructor(textChannel: Eris.TextChannel, voiceChannel: Eris.VoiceChannel) {
        this.scoreboard = new Scoreboard();
        this.lastActive = Date.now();
        this.sessionInitialized = false;
        this.startedAt = Date.now();
        this.participants = new Set();
        this.roundsPlayed = 0;
        this.guessTimes = [];
        this.connection = null;
        this.finished = false;
        this.voiceChannel = voiceChannel;
        this.textChannel = textChannel;
        this.gameRound = null;
        this.guessTimeoutVal = null;
        const songAliasesFilePath = path.resolve(__dirname, "../data/song_aliases.json");
        this.songAliasList = JSON.parse(fs.readFileSync(songAliasesFilePath).toString());
    }

    createRound(song: string, artist: string, videoID: string) {
        this.gameRound = new GameRound(song, artist, videoID, this.songAliasList[videoID] || []);
        this.sessionInitialized = true;
        this.roundsPlayed++;
    }

    endRound(guessed: boolean) {
        if (guessed) {
            this.guessTimes.push(Date.now() - this.gameRound.startedAt);
        }
        if (this.gameRound) {
            this.gameRound.finished = true;
        }
        if (this.connection) {
            this.connection.removeAllListeners();
        }
        this.stopGuessTimeout();
        this.sessionInitialized = false;
    }

    endSession = async (): Promise<void> => {
        const guildId = this.textChannel.guild.id;
        this.finished = true;
        this.endRound(false);
        const voiceConnection = state.client.voiceConnections.get(guildId);
        if (voiceConnection && voiceConnection.channelID) {
            voiceConnection.stopPlaying();
            const voiceChannel = state.client.getChannel(voiceConnection.channelID) as Eris.VoiceChannel;
            if (voiceChannel) {
                voiceChannel.leave();
            }
        }
        await db.kmq("guild_preferences")
            .where("guild_id", guildId)
            .increment("games_played", 1);

        const sessionLength = (Date.now() - this.startedAt) / (1000 * 60);
        const averageGuessTime = this.guessTimes.length > 0 ? this.guessTimes.reduce((a, b) => a + b, 0) / (this.guessTimes.length * 1000) : -1;

        logger.info(`gid: ${guildId} | Game session ended. rounds_played = ${this.roundsPlayed}. session_length = ${sessionLength}`);
        deleteGameSession(guildId);

        await db.kmq("game_sessions")
            .insert({
                start_date: new Date(this.startedAt).toISOString().slice(0, 19).replace('T', ' '),
                guild_id: this.textChannel.guild.id,
                num_participants: this.participants.size,
                avg_guess_time: averageGuessTime,
                session_length: sessionLength,
                rounds_played: this.roundsPlayed
            })

        await db.kmq("guild_preferences")
            .where("guild_id", guildId)
            .increment("games_played", 1);
    }


    checkGuess(message: Eris.Message, modeType: string): boolean {
        if (!this.gameRound) return;
        this.participants.add(message.author.id);
        return this.gameRound.checkGuess(message, modeType);
    }

    async lastActiveNow(): Promise<void> {
        this.lastActive = Date.now();
        await db.kmq("guild_preferences")
            .where({ guild_id: this.textChannel.guild.id })
            .update({ last_active: new Date() });
    }


    async guessSong({ message }: CommandArgs) {
        const guildPreference = await getGuildPreference(message.guildID);
        const voiceChannel = getVoiceChannel(message);
        if (!this.gameRound || this.gameRound.finished) return;

        //if user isn't in the same voice channel
        if (!voiceChannel || !voiceChannel.voiceMembers.has(message.author.id)) {
            return;
        }

        //if message isn't in the active game session's text channel
        if (message.channel.id !== this.textChannel.id) {
            return;
        }

        if (this.checkGuess(message, guildPreference.getModeType())) {
            logger.info(`${getDebugContext(message)} | Song correctly guessed. song = ${this.gameRound.song}`)
            const gameSession = state.gameSessions[message.guildID];
            gameSession.lastActiveNow();
            const userTag = getUserIdentifier(message.author);
            this.scoreboard.updateScoreboard(userTag, message.author.id, message.author.avatarURL);
            this.stopGuessTimeout();
            this.endRound(true);
            await sendSongMessage(message, this, false, userTag);
            await db.kmq("guild_preferences")
                .where("guild_id", message.guildID)
                .increment("songs_guessed", 1);
            if (!guildPreference.isGoalSet() || this.scoreboard.getWinners()[0].getScore() < guildPreference.getGoal()) {
                this.startRound(guildPreference, message);
            }
            else {
                logger.info(`${getDebugContext(message)} | Game session ended (goal of ${guildPreference.getGoal()} reached)`);
                await sendEndGameMessage({ channel: message.channel, authorId: message.author.id }, this);
                await this.endSession();
            }
        }
    }

    async startRound(guildPreference: GuildPreference, message: Eris.Message<Eris.GuildTextableChannel>) {
        if (this.finished) {
            return;
        }

        if (this.sessionInitialized) {
            await sendErrorMessage(message, `Game already in session`, null);
            return;
        }
        this.sessionInitialized = true;
        let randomSong: QueriedSong;
        try {
            randomSong = await selectRandomSong(guildPreference);
            if (randomSong === null) {
                this.sessionInitialized = false;
                sendErrorMessage(message, "Song Query Error", "Failed to find songs matching this criteria. Try to broaden your search.");
                return;
            }
        }
        catch (err) {
            this.sessionInitialized = false;
            await sendErrorMessage(message, "Error selecting song", err.toString());
            logger.error(`${getDebugContext(message)} | Error querying song: ${err.toString()}. guildPreference = ${JSON.stringify(guildPreference)}`);
            return;
        }
        this.createRound(randomSong.name, randomSong.artist, randomSong.youtubeLink);

        try {
            await ensureVoiceConnection(this, state.client);
        }
        catch (err) {
            await this.endSession();
            this.sessionInitialized = false;
            logger.error(`${getDebugContext(message)} | Error obtaining voice connection. err = ${err.toString()}`);
            await sendErrorMessage(message, "Missing voice permissions", "The bot is unable to join the voice channel you are in.");
            return;
        }
        this.playSong(guildPreference, message);
    }

    async playSong(guildPreference: GuildPreference, message: Eris.Message<Eris.GuildTextableChannel>) {
        const gameRound = this.gameRound;
        if (isDebugMode() && skipSongPlay()) {
            logger.debug(`${getDebugContext(message)} | Not playing song in voice connection. song = ${this.getDebugSongDetails()}`);
            return;
        }
        const songLocation = `${process.env.SONG_DOWNLOAD_DIR}/${gameRound.videoID}.mp3`;

        let seekLocation: number;
        if (guildPreference.getSeekType() === SEEK_TYPE.RANDOM) {
            try {
                const songDuration = await getAudioDurationInSeconds(songLocation);
                seekLocation = songDuration * (0.6 * Math.random());
            }
            catch (e) {
                logger.error(`Failed to get mp3 length: ${songLocation}. err = ${e}`);
                seekLocation = 0;
            }
        }
        else {
            seekLocation = 0;
        }


        const stream = fs.createReadStream(songLocation);
        await delay(3000);
        //check if ,end was called during the delay
        if (this.finished || this.gameRound.finished) {
            logger.debug(`${getDebugContext(message)} | startGame called with ${this.finished}, ${gameRound.finished}`);
            return;
        }

        logger.info(`${getDebugContext(message)} | Playing song in voice connection. seek = ${guildPreference.getSeekType()}. song = ${this.getDebugSongDetails()}. mode = ${guildPreference.getModeType()}`);
        this.connection.stopPlaying();
        this.connection.play(stream, {
            inputArgs: ["-ss", seekLocation.toString()],
            encoderArgs: ["-filter:a", `volume=0.1`]
        });
        this.startGuessTimeout(message);
        this.connection.once("end", async () => {
            logger.info(`${getDebugContext(message)} | Song finished without being guessed.`);
            this.stopGuessTimeout();
            await sendSongMessage(message, this, true);
            this.endRound(false);
            this.startRound(guildPreference, message);
        })

        this.connection.once("error", async (err) => {
            if (!this.connection.channelID) {
                logger.info(`gid: ${this.textChannel.guild.id} | Bot was kicked from voice channel`);
                this.stopGuessTimeout();
                await sendEndGameMessage({ channel: message.channel }, this);
                await this.endSession();
                return;
            }

            logger.error(`${getDebugContext(message)} | Unknown error with stream dispatcher. song = ${this.getDebugSongDetails()}. err = ${err}`);
            // Attempt to restart game with different song
            await sendErrorMessage(message, "Error playing song", "Starting new round in 2 seconds...");
            this.endRound(false);
            this.startRound(guildPreference, message);
        });
    }

    getDebugSongDetails(): string {
        if (!this.gameRound) return;
        return `${this.gameRound.song}:${this.gameRound.artist}:${this.gameRound.videoID}`;
    }

    async startGuessTimeout(message: Eris.Message<Eris.GuildTextableChannel>) {
        let guildPreference = await getGuildPreference(message.guildID);
        let time = guildPreference.getGuessTimeout();
        if (!time) return;
        this.guessTimeoutFunc = setTimeout(async () => {
            if (this.finished) return;
            logger.info(`${getDebugContext(message)} | Song finished without being guessed, timer of: ${time} seconds.`);
            await sendSongMessage(message, this, true);
            this.endRound(false);
            this.startRound(guildPreference, message);
        }, time * 1000)
    }

    stopGuessTimeout() {
        clearTimeout(this.guessTimeoutFunc);
    }
};

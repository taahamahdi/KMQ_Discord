import Scoreboard, { SuccessfulGuessResult } from "./scoreboard";
import EliminationPlayer from "./elimination_player";
import _logger from "../logger";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const logger = _logger("elimination_scoreboard");

export default class EliminationScoreboard extends Scoreboard {
    /** Mapping of Discord user ID to EliminationPlayer */
    protected players: { [userID: string]: EliminationPlayer };

    /** The amount of lives each player starts with */
    private readonly startingLives: number;

    constructor(lives: number) {
        super();
        this.startingLives = lives;
    }

    /**
     * Begins tracking a player on the game's scoreboard
     * @param userID - The player's Discord user ID
     * @param tag - The player's Discord tag
     * @param avatarUrl - The player's Discord avatar URL
     */
    addPlayer(userID: string, tag: string, avatarUrl: string, lives?: number): EliminationPlayer {
        this.players[userID] = new EliminationPlayer(tag, userID, avatarUrl, 0, lives === undefined || lives === null ? this.startingLives : lives);
        return this.players[userID];
    }

    /** @returns An array of DiscordEmbed fields representing each participant's lives */
    getScoreboardEmbedFields(): Array<{ name: string, value: string, inline: boolean }> {
        return Object.values(this.players)
            .sort((a, b) => b.getLives() - a.getLives())
            .map((x) => {
                const lives = !x.isEliminated() ? `❤️ x ${x.getLives()}` : "☠️";
                return {
                    name: x.getName(),
                    value: lives,
                    inline: true,
                };
            });
    }

    /**
     * Updates the scoreboard with information about correct guessers
     * @param guessResults - Objects containing the user ID, points earned, and EXP gain
     */
    updateScoreboard(guessResults: Array<SuccessfulGuessResult>) {
        // give everybody EXP
        for (const guessResult of guessResults) {
            const correctGuesser = this.players[guessResult.userID];
            correctGuesser.incrementExp(guessResult.expGain);
        }

        const guesserIDs = guessResults.map((x) => x.userID);
        let maxLives = -1;
        for (const player of Object.values(this.players)) {
            // guessers don't have lives decremented
            if (!guesserIDs.includes(player.id)) {
                player.decrementLives();
            }
            if (player.getLives() === maxLives) {
                this.firstPlace.push(player);
            } else if (player.getLives() > maxLives) {
                this.firstPlace = [player];
                maxLives = player.getLives();
            }
        }
    }

    /**
     * @param userID - The Discord user ID of the participant to check
     * @returns whether or not the player has ran out of lives
     */
    isPlayerEliminated(userID: string): boolean {
        return this.players[userID].isEliminated();
    }

    /** Decrements the lives of all current players */
    decrementAllLives() {
        for (const player of Object.values(this.players)) {
            player.decrementLives();
        }
    }

    /**
     * Checks whether the game has finished depending on whether
     * it is a solo or multiplayer game
     */
    gameFinished(): boolean {
        // Game ends if
        // (1) all players are eliminated that round or
        const allEliminated = Object.values(this.players).every((player) => player.isEliminated());
        // (2) there is one player left in a game that started with multiple players
        const oneLeft = Object.values(this.players).length > 1
            && Object.values(this.players).filter((player) => !player.isEliminated()).length === 1;

        return allEliminated || oneLeft;
    }

    /**
     * @param userID - The Discord user ID to check
     * @returns the number of lives the player has remaining
     */
    getPlayerLives(userID: string): number {
        return this.players[userID].getLives();
    }

    /** @returns the number of lives of the player with the least amount of lives (who isn't dead) */
    getLivesOfWeakestPlayer(): number {
        const minimumLives = Object.values(this.players)
            .filter((x) => x.getLives() > 0)
            .reduce((prev, curr) => (prev.getLives() < curr.getLives() ? prev : curr))
            .getLives();

        return minimumLives;
    }
}

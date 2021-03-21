import assert from "assert";
import GuildPreference from "../../structures/guild_preference";
import Scoreboard from "../../structures/scoreboard";

let scoreboard: Scoreboard;
beforeEach(() => {
    scoreboard = new Scoreboard();
});

let guildPreference: GuildPreference;

describe("score/xp updating", () => {
    describe("single player scoreboard", () => {
        const userID = "12345";
        describe("user guesses correctly multiple times", () => {
            it("should increment the user's score/xp", () => {
                for (let i = 0; i < 20; i++) {
                    scoreboard.updateScoreboard("wonyoung#4785", userID, "someurl", 1, 50);
                    assert.strictEqual(scoreboard.getPlayerScore(userID), i + 1);
                    assert.strictEqual(scoreboard.getPlayerExpGain(userID), 50 * (i + 1));
                }
            });
        });
        describe("user has not guessed yet", () => {
            it("should not increment the user's score/xp", () => {
                assert.strictEqual(scoreboard.getPlayerScore(userID), 0);
                assert.strictEqual(scoreboard.getPlayerExpGain(userID), 0);
            });
        });
    });

    describe("multi player scoreboard", () => {
        const userIDs = ["12345", "23456"];
        describe("both users guess correctly multiple times", () => {
            it("should increment each user's score", () => {
                for (let i = 0; i < 20; i++) {
                    scoreboard.updateScoreboard("wonyoung#4785", userIDs[0], "someurl", 1, 50);
                    if (i % 2 === 0) {
                        scoreboard.updateScoreboard("yena#1234", userIDs[1], "someurl", 1, 50);
                    }
                }
                assert.strictEqual(scoreboard.getPlayerScore(userIDs[0]), 20);
                assert.strictEqual(scoreboard.getPlayerExpGain(userIDs[0]), 1000);
                assert.strictEqual(scoreboard.getPlayerScore(userIDs[1]), 10);
                assert.strictEqual(scoreboard.getPlayerExpGain(userIDs[1]), 500);
            });
        });
        describe("both users have not guessed yet", () => {
            it("should not increment each user's score", () => {
                assert.strictEqual(scoreboard.getPlayerScore(userIDs[0]), 0);
                assert.strictEqual(scoreboard.getPlayerExpGain(userIDs[0]), 0);
                assert.strictEqual(scoreboard.getPlayerScore(userIDs[1]), 0);
                assert.strictEqual(scoreboard.getPlayerExpGain(userIDs[1]), 0);
            });
        });
    });
});

describe("winner detection", () => {
    describe("nobody has a score yet", () => {
        it("should return an empty array", () => {
            assert.deepStrictEqual(scoreboard.getWinners(), []);
        });
    });
    describe("single player, has score", () => {
        const userID = "12345";
        it("should return the single player", () => {
            scoreboard.updateScoreboard("minju#7489", userID, "someurl", 10, 0);
            assert.strictEqual(scoreboard.getWinners().length, 1);
            assert.strictEqual(scoreboard.getWinners()[0].getID(), userID);
        });
    });

    describe("multiple players, has different scores", () => {
        const userIDs = ["12345", "23456"];
        it("should return the player with most points", () => {
            scoreboard.updateScoreboard("minju#7489", userIDs[0], "someurl", 10, 0);
            scoreboard.updateScoreboard("sakura#5478", userIDs[1], "someurl", 15, 0);
            assert.strictEqual(scoreboard.getWinners().length, 1);
            assert.strictEqual(scoreboard.getWinners()[0].getID(), userIDs[1]);
        });
    });

    describe("multiple players, tied score", () => {
        const userIDs = ["12345", "23456", "34567"];
        it("should return the two tied players", () => {
            scoreboard.updateScoreboard("minju#7489", userIDs[0], "someurl", 5, 0);
            scoreboard.updateScoreboard("sakura#5478", userIDs[1], "someurl", 7, 0);
            scoreboard.updateScoreboard("yuri#4444", userIDs[2], "someurl", 7, 0);
            assert.strictEqual(scoreboard.getWinners().length, 2);
            assert.deepStrictEqual(scoreboard.getWinners().map((x) => x.getID()), [userIDs[1], userIDs[2]]);
        });
    });
});

describe("game finished", () => {
    beforeEach(() => {
        guildPreference = new GuildPreference("1234");
        guildPreference.setGoal(5);
    });

    describe("goal is not set", () => {
        it("should return false", () => {
            guildPreference.resetGoal();
            assert.strictEqual(scoreboard.gameFinished(guildPreference), false);
        });
    });

    describe("goal is set", () => {
        const userIDs = ["12345", "23456", "34567"];
        describe("no one has a score yet", () => {
            it("should return false", () => {
                assert.strictEqual(scoreboard.gameFinished(guildPreference), false);
            });
        });
        describe("first place is not equal/above the goal", () => {
            it("should return false", () => {
                scoreboard.updateScoreboard("sakura#5478", userIDs[0], "someurl", 2, 0);
                scoreboard.updateScoreboard("eunbi#4741", userIDs[1], "someurl", 4, 0);
                assert.strictEqual(scoreboard.gameFinished(guildPreference), false);
            });
        });
        describe("first place is equal/above the goal", () => {
            it("should return true", () => {
                scoreboard.updateScoreboard("sakura#5478", userIDs[0], "someurl", 5, 0);
                scoreboard.updateScoreboard("eunbi#4741", userIDs[1], "someurl", 4, 0);
                assert.strictEqual(scoreboard.gameFinished(guildPreference), true);
            });
        });
    });
});

const sendSongMessage = require("../utils.js").sendSongMessage
const disconnectVoiceConnection = require("../utils.js").disconnectVoiceConnection
const sendScoreboard = require("../utils.js").sendScoreboard

module.exports = (client, gameSession, command, message) => {
    if (!gameSession.scoreboard.isEmpty()) {
        if (gameSession.gameInSession()) sendSongMessage(message, gameSession, true);
        disconnectVoiceConnection(client, message);
        message.channel.send(gameSession.scoreboard.getWinnerMessage());
        sendScoreboard(message, gameSession);
        gameSession.endGame();
    }
}
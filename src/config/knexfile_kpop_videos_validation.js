const resolve = require("path").resolve;
require('dotenv').config({path: resolve(__dirname, "../../.env")});

module.exports = {
  client: 'mysql',
  connection: {
    user: process.env.DB_USER, password: process.env.DB_PASS, database: "kpop_videos_validation", host: process.env.DB_HOST, charset: "utf8mb4", port: parseInt(process.env.DB_PORT), multipleStatements: true
  },
  pool: {
    min: 0,
    max: 1
  }
}

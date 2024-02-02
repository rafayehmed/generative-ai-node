import { noop } from "lodash";
import dotenv from "dotenv";
const sequelizeLogger = require("sequelize-log-syntax-colors");

/**
 * load environment variables from .env
 */
dotenv.config();

const options = {
    dialect: "postgres",
    host: process.env.DB_HOST || "127.0.0.1",
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    sync: {
        force: !!process.env.DB_SYNC,
    },
};
if (process.env.DB_LOGGING === "false") {
    options.logging = noop();
} else {
    options.logging = (text, benchmark) => {
        if (!benchmark) {
            // eslint-disable-next-line
            console.log(sequelizeLogger(text));
        } else {
            // eslint-disable-next-line
            console.log(sequelizeLogger(text), `Elapsed time: ${benchmark} ms`);
        }
    };
    options.benchmark = true;
    options.logQueryParameters = true;
}

module.exports = options;

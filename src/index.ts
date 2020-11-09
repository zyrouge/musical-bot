import { Client, CommandConstructor } from "./Core";
import fs, { promises as fsp } from "fs";
import dotenv from "dotenv";

dotenv.config({ path: __dirname + "/../.env" });
if (!process.env.DISCORD_TOKEN) throw new Error("No 'DISCORD_TOKEN' was found");

const config: { PREFIX: string } = JSON.parse(
    fs.readFileSync(`${__dirname}/../config.json`).toString()
);

const TOKEN = process.env.DISCORD_TOKEN;
const client = new Client({
    prefix: config.PREFIX
});

const init = async () => {
    for (const command of await fsp.readdir(`${__dirname}/commands`)) {
        const cmdC: CommandConstructor = require(`${__dirname}/commands/${command}`)
            .default;
        const cmd = new cmdC();
        client.commander.labels.set(cmd.name, cmd);
        cmd.aliases?.forEach((alias) =>
            client.commander.aliases.set(alias, cmd.name)
        );
        console.log(`Loaded command ${cmd.name} from ${command}`);
    }
};

client.on("ready", () => {
    console.log(`Logged in as ${client.user?.tag || "Unknown"}`);
});
client.on("warn", console.warn);
client.on("error", console.error);

client.on("message", async (message) => {
    if (message.author.bot || !message.guild) return;
    if (message.content.indexOf(client.prefix) !== 0) return;

    const args = message.content.slice(client.prefix.length).trim().split(" ");
    const cmd = args.shift()?.toLowerCase();
    if (!cmd) return;

    let command = client.commander.resolve(cmd);
    if (!command) return;

    try {
        command.action(client, message, args);
    } catch (e) {
        console.error(e);
        message.channel.send(
            `Something went wrong while executing command "**${command}**"!`
        );
    }
});

init().then(() => client.login(TOKEN));

import { Client, CommandConstructor } from "./Core";
import fs, { promises as fsp } from "fs";
import dotenv from "dotenv";
import { Emojis } from "./Utils";
import { Collection } from "discord.js";
import Server from "./Server";

dotenv.config({ path: __dirname + "/../.env" });
if (!process.env.DISCORD_TOKEN) throw new Error("No 'DISCORD_TOKEN' was found");

const config: { PREFIX: string; PORT: number; COOLDOWN?: number } = JSON.parse(
    fs.readFileSync(`${__dirname}/../config.json`).toString()
);

const TOKEN = process.env.DISCORD_TOKEN;
const client = new Client({
    prefix: config.PREFIX
});

const init = async () => {
    for (const command of await fsp.readdir(`${__dirname}/Commands`)) {
        const cmdC: CommandConstructor = require(`${__dirname}/Commands/${command}`)
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
    client.user?.setPresence({
        activity: {
            name: "Music",
            type: "LISTENING"
        },
        status: "dnd"
    });
});

client.on("warn", console.warn);
client.on("error", console.error);

const GlobalCooldown: Collection<
    string,
    Collection<string, number>
> = new Collection();
const CooldownTime = config.COOLDOWN || 3000;

client.on("message", async (message) => {
    if (message.author.bot || !message.guild) return;
    if (message.content.indexOf(client.prefix) !== 0) return;

    const args = message.content.slice(client.prefix.length).trim().split(" ");
    const cmd = args.shift()?.toLowerCase();
    if (!cmd) return;

    let command = client.commander.resolve(cmd);
    if (!command) return;

    const guildID = message.guild.id;
    const userID = message.author.id;
    const CooledUsers = GlobalCooldown.get(guildID) || new Collection();
    const UserCooldown = CooledUsers.get(userID);
    if (UserCooldown)
        return message.channel
            .send(
                `${Emojis.sad} Try using commands after \`${Math.floor(
                    (UserCooldown - Date.now()) / 1000
                )}s\``
            )
            .then((msg) =>
                msg.deletable ? msg.delete({ timeout: 2000 }) : null
            );

    CooledUsers.set(userID, Date.now() + CooldownTime);
    GlobalCooldown.set(guildID, CooledUsers);
    const removeCooldown = () => {
        const newCooledUsers = GlobalCooldown.get(guildID) || new Collection();
        newCooledUsers.delete(userID);
        GlobalCooldown.set(guildID, newCooledUsers);
    };

    try {
        command.action(client, message, args);
        setTimeout(removeCooldown, CooldownTime);
    } catch (e) {
        removeCooldown();
        console.error(e);
        message.channel.send(
            `Something went wrong while executing command "**${command}**"!`
        );
    }
});

client.on("voiceStateUpdate", (oldState, newState) => {
    if (
        oldState.member &&
        newState.member &&
        oldState.member.id === newState.member.id
    ) {
        const queue = client.music.get(oldState.guild.id);

        if (queue) {
            const isEmpty = () =>
                queue.voiceChannel.members.size === 1 &&
                queue.voiceChannel.members.first()?.id === client.user?.id;

            if (
                oldState.channel &&
                newState.channel &&
                oldState.member &&
                newState.member &&
                client.user &&
                oldState.member.id === client.user.id &&
                newState.member.id === client.user.id &&
                oldState.channel.id !== newState.channel.id
            ) {
                queue.voiceChannel = newState.channel;
                queue.textChannel.send(
                    `${Emojis.music2} Voice channel has been changed to \`#${queue.voiceChannel.name}\``
                );
            }

            if (isEmpty()) {
                setTimeout(() => {
                    if (isEmpty()) {
                        queue.cleanup();
                        queue.textChannel.send(
                            `${Emojis.info} Left \`#${queue.voiceChannel.name}\` due to lack of listerners.`
                        );
                        queue.voiceChannel.leave();
                        client.music.delete(oldState.guild.id);
                    }
                }, 15 * 1000);
            }
        }
    }
});

init().then(() => {
    client.login(TOKEN);
    Server(client, config.PORT);
});

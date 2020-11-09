import { Message } from "discord.js";
import { Client, Command } from "../Core";
import { Emojis, isGuildTextChannel } from "../Utils";

export default class implements Command {
    name = "previous";
    aliases = ["pr", "back"];
    description = "Go back to the previous song";

    constructor() {}

    action(client: Client, message: Message, args: string[]) {
        if (
            !message.guild ||
            !message.member ||
            !isGuildTextChannel(message.channel)
        )
            return;

        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel)
            return message.channel.send(
                `${Emojis.err} You must be in a Voice Channel to use \`${this.name}\` command.`
            );

        let queue = client.music.get(message.guild.id);
        if (!queue)
            return message.channel.send(
                `${Emojis.err} Nothing is being played to use \`${this.name}\` command.`
            );

        if (queue.voiceChannel.id !== voiceChannel.id)
            return message.channel.send(
                `${Emojis.err} You must be in the same voice channel to use \`${this.name}\` command.`
            );

        try {
            queue.previous();
        } catch (err) {
            message.channel.send(`${Emojis.err} ${err}`);
        }
    }
}

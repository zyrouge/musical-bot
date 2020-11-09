import { Message } from "discord.js";
import { Client, Command } from "../Core";
import { Emojis, isGuildTextChannel } from "../Utils";

export default class implements Command {
    name = "loop";
    description = "Loop the music";

    constructor() {}

    action(client: Client, message: Message, args: string[]) {
        if (
            !message.guild ||
            !message.member ||
            !isGuildTextChannel(message.channel)
        )
            return;

        const userVoiceChannel = message.member.voice.channel;
        if (!userVoiceChannel)
            return message.channel.send(
                `You must be in a Voice Channel to use \`${this.name}\` command.`
            );

        const queue = client.music.get(message.guild.id);
        if (!queue)
            return message.channel.send(
                `${Emojis.err} Nothing is playing to use \`${this.name}\` command.`
            );

        if (queue.voiceChannel.id !== userVoiceChannel.id)
            return message.channel.send(
                `${Emojis.err} You must be in the same voice channel to use \`${this.name}\` command.`
            );

        if (!args[0])
            return message.channel.send(
                `${Emojis.info} Currently Looping **${queue.loop}**.`
            );

        switch (args[0]) {
            case "track":
            case "song":
            case "this":
                queue.setLoop("track");
                message.channel.send(
                    `${Emojis.repeat.song} Currently Looping **${queue.loop}**.`
                );
                break;
            case "all":
            case "queue":
            case "list":
                queue.setLoop("queue");
                message.channel.send(
                    `${Emojis.repeat.queue} Currently Looping **${queue.loop}**.`
                );
                break;
            case "none":
            case "disable":
            case "off":
                queue.setLoop("none");
                message.channel.send(
                    `${Emojis.music} Currently Looping **${queue.loop}**.`
                );
                break;
            default:
                message.channel.send(
                    `${Emojis.info} Currently Looping **${queue.loop}**.`
                );
        }
    }
}

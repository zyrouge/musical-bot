import { Message, MessageEmbed } from "discord.js";
import { Client, Command } from "../Core";
import { Emojis, isGuildTextChannel } from "../Utils";

export default class implements Command {
    name = "queue";
    aliases = ["q", "list"];
    description = "View the queue";

    constructor() {}

    async action(client: Client, message: Message, args: string[]) {
        if (
            !message.guild ||
            !message.member ||
            !isGuildTextChannel(message.channel)
        )
            return;

        let queue = client.music.get(message.guild.id);
        if (!queue)
            return message.channel.send(
                `${Emojis.info} Nothing is being played to use \`${this.name}\` command.`
            );

        let page = 0;
        if (args[0]) {
            const parsed = parseInt(args[0]);
            if (isNaN(parsed))
                return message.channel.send(
                    `${Emojis.err} Invalid page index.`
                );
            page = parsed - 1;
        }

        try {
            const songs = queue.songs;
            const np = queue.index !== null ? queue.songs[queue.index] : null;
            const desc: string[] = [];
            for (let i = 0; i < songs.length; i++) {
                const song = songs[i];
                desc.push(
                    `${i + 1}. **[${song.title}](${song.url})** ${
                        song.durationHuman() || ""
                    }`
                );
            }
            message.channel.send({
                embed: {
                    title: "Queue",
                    description: desc.join("\n"),
                    fields: [
                        {
                            name: "Now Playing",
                            value: np
                                ? `${np.title} [${queue.dispatcher?.streamTime}/]`
                                : "None"
                        }
                    ]
                }
            });
        } catch (err) {
            message.channel.send(`${Emojis.err} ${err}`);
        }
    }
}

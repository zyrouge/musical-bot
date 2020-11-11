import { Message } from "discord.js";
import { Client, Command } from "../Core";
import genius from "genius-lyrics";
import { Colors, Emojis } from "../Utils";

const Genius = new genius.Client();
export default class implements Command {
    name = "lyrics";
    aliases = ["ly"];
    description = "Search lyrics for a song";

    constructor() {}

    async action(client: Client, message: Message, args: string[]) {
        if (!args.length)
            return message.channel.send(
                `${Emojis.info} Provide a song name/url to search lyrics.`
            );

        try {
            message.react(Emojis.clock).catch(() => {});
            const result = await Genius.songs.search(args.join(" "));
            const song = result[0];
            const lyrics = await song.lyrics();
            const lines = lyrics.split("\n");
            const parts: string[] = [];
            let index = 0;
            for (const line of lines) {
                let part = parts[index];
                if (!part) part = "";
                if (part.length + line.length < 1400)
                    parts[index] = part += `\n${line}`;
                else parts[index + 1] = line;
            }
            parts.forEach((part, i) => {
                setTimeout(() => {
                    message.channel.send({
                        embed: {
                            title: `${Emojis.music} ${song.title}`,
                            author: {
                                name: song.artist?.name,
                                url: song.artist?.url,
                                icon_url: song.artist?.image
                            },
                            url: song.url,
                            color: Colors.def,
                            description: part,
                            thumbnail: {
                                url: song.thumbnail
                            },
                            footer: {
                                text: `Page ${i + 1}/${
                                    parts.length
                                } | Source: Genius.com`
                            }
                        }
                    });
                }, 100);
            });
        } catch (err) {
            return message.channel.send(
                `${Emojis.info} No lyrics was found for \`${args.join(" ")}\``
            );
        }
    }
}

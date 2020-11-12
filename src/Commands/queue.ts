import { Message } from "discord.js";
import { Client, Command } from "../Core";
import {
    Colors,
    Emojis,
    getLocaleFromDuration,
    isGuildTextChannel
} from "../Utils";
import dayjs from "dayjs";
import _ from "lodash";
import dayjsduration from "dayjs/plugin/duration";

dayjs.extend(dayjsduration);

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
            const np =
                queue.index !== null ? queue.songs[queue.index] : undefined;

            const parts = _.chunk(songs, 5);
            const pagesongs = parts[page];
            if (!pagesongs)
                return message.channel.send(
                    `${Emojis.sad} Seems like this page of queue is empty.`
                );

            const desc: string[] = [];
            const iAdd = page * 5;
            for (let i = 0; i < pagesongs.length; i++) {
                const song = pagesongs[i];
                const fields: string[] = [
                    song.url === np?.url ? Emojis.speaker : `${i + 1 + iAdd}.`,
                    `**[${song.title}](${song.url})**`
                ];
                const dur = song.duration
                    ? getLocaleFromDuration(dayjs.duration(song.duration))
                    : undefined;
                if (dur) fields.push(`(${dur})`);
                desc.push(fields.join(" "));
            }
            if (!desc.length) desc.push(`Empty as always`);
            message.channel.send({
                embed: {
                    title: `${Emojis.music} Queue`,
                    description: desc.join("\n"),
                    color: Colors.def,
                    footer: { text: `Page ${page + 1}/${parts.length}` }
                }
            });
        } catch (err) {
            message.channel.send(`${Emojis.err} ${err}`);
        }
    }
}

import { Message } from "discord.js";
import { Client, Command } from "../Core";
import {
    Colors,
    Emojis,
    getLocaleFromDuration,
    isGuildTextChannel
} from "../Utils";
import dayjs from "dayjs";
import dayjsduration from "dayjs/plugin/duration";

dayjs.extend(dayjsduration);

export default class implements Command {
    name = "nowplaying";
    aliases = ["np", "current"];
    description = "Skip a song";

    constructor() {}

    async action(client: Client, message: Message, args: string[]) {
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

        try {
            const {
                title,
                url,
                published,
                duration,
                channel,
                thumbnail,
                requester
            } = queue.nowPlaying();
            let footerText: string | undefined;
            const streamTime = queue.streamTime();
            if (duration) {
                const passed = streamTime;
                const emote = "🔘";
                const barele = "─".repeat(19).split("");
                const index = Math.floor((passed / duration) * 20);
                const bar = barele.splice(index, 0, emote);
                const current = getLocaleFromDuration(dayjs.duration(passed));
                const total = getLocaleFromDuration(dayjs.duration(duration));
                footerText = `${current}/${total} ${bar}`;
            } else {
                footerText = `${getLocaleFromDuration(
                    dayjs.duration(streamTime)
                )}/Unknown`;
            }
            message.channel.send({
                embed: {
                    title: `${Emojis.music2} Now playing: ${title}`,
                    url: url,
                    color: Colors.def,
                    description: [
                        `Position: **${(queue.index || 0) + 1}/${
                            queue.songs.length
                        }**`,
                        `Requested by: <@${requester}>`,
                        `Channel: **[${channel.title}](${channel.url})**`,
                        `Published: **${published || "Unknown"}**`
                    ].join("\n"),
                    thumbnail: {
                        url: thumbnail
                    },
                    footer: {
                        text: footerText
                    }
                }
            });
        } catch (err) {
            message.channel.send(`${Emojis.err} ${err}`);
        }
    }
}

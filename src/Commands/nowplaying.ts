import { Message } from "discord.js";
import { Client, Command } from "../Core";
import { Emojis, getLocaleFromDuration, isGuildTextChannel } from "../Utils";
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
                durationHuman,
                requester,
                update
            } = queue.nowPlaying();
            await update();
            const passed = queue.dispatcher?.streamTime || 0;
            const emote = "🔘";
            const barele = "─".repeat(19).split("");
            const index = Math.floor((passed / (duration || 0)) * 20);
            const bar = barele.splice(index, 0, emote);
            const current = getLocaleFromDuration(dayjs.duration(passed));
            message.channel.send({
                embed: {
                    title: `Now playing: ${title}`,
                    url: url,
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
                        text: `${current}/${
                            durationHuman() || "Unknown"
                        } ${bar}`
                    }
                }
            });
        } catch (err) {
            message.channel.send(`${Emojis.err} ${err}`);
        }
    }
}

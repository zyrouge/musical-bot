import { Message } from "discord.js";
import { Client, Command, GuildAudioManager, Track } from "../Core";
import {
    isGuildTextChannel,
    getTrackParamsFromYtsr,
    Emojis,
    Colors
} from "../Utils";
import ytsr, { Video as ytVideo } from "youtube-sr";

export default class implements Command {
    name = "search";
    aliases = ["s"];
    description = "Search and play song";

    constructor() {}

    async action(client: Client, message: Message, args: string[]) {
        if (
            !message.guild ||
            !message.member ||
            !isGuildTextChannel(message.channel)
        )
            return;

        if (!args.length)
            return message.channel.send(
                `${Emojis.info} Provide a song name/url to play.`
            );

        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel)
            return message.channel.send(
                `${Emojis.err} You must be in a Voice Channel to use \`${this.name}\` command.`
            );

        let queue = client.music.get(message.guild.id);
        if (!queue) {
            queue = new GuildAudioManager(message.channel, voiceChannel);
            client.music.set(message.guild.id, queue);
        }

        if (queue.voiceChannel.id !== voiceChannel.id)
            return message.channel.send(
                `${Emojis.err} You must be in the same voice channel to use \`${this.name}\` command.`
            );

        const search = args.join(" ");
        const msg = await message.channel.send(
            `${Emojis.info} Loading results for \`${search}\`...`
        );

        try {
            const searches = await ytsr.search(search, {
                limit: 10
            });
            const videos = searches.filter(
                (t) => t instanceof ytVideo
            ) as ytVideo[];
            if (!videos.length)
                return msg.edit(
                    `${Emojis.sad} No result found for \`${search}\`.`
                );

            const tracks = videos.map((x) => getTrackParamsFromYtsr(x));
            await msg.edit({
                content: "",
                embed: {
                    title: `${Emojis.search} Results for ${search}`,
                    description: tracks
                        .map((x, i) => `${i + 1}. **[${x.title}](${x.url})**`)
                        .join("\n"),
                    color: Colors.def,
                    footer: {
                        text: "React to select"
                    }
                }
            });
            const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "❌"];
            try {
                emojis.forEach((e) => msg.react(e));
            } catch (err) {
                return msg.edit(
                    `${Emojis.sad} Missing permission: \`ADD_REACTIONS\`.`
                );
            }
            const [reactMsg] = (
                await msg.awaitReactions(
                    (reaction, user) =>
                        emojis.includes(reaction.emoji.name) &&
                        user.id === message.author.id,
                    {
                        time: 15 * 1000,
                        max: 1
                    }
                )
            ).array();
            msg.reactions.removeAll().catch(() => {});
            if (!reactMsg || reactMsg.emoji.name === emojis[5])
                return msg.edit({
                    content: `${Emojis.info} Song selection aborted.`,
                    embed: null
                });

            const songIndex: number = emojis.findIndex(
                (x) => reactMsg.emoji.name === x
            );
            const song = getTrackParamsFromYtsr(videos[songIndex]);
            const track = new Track(song, message.author.id);
            queue.addTrack(track);
            msg.edit({
                content: `${Emojis.music} Added **${track.title}** to queue!`,
                embed: null
            });
            try {
                if (!queue.playing) await queue.start();
            } catch (err) {
                msg.edit(`${Emojis.err} ${err}`);
            }
        } catch (err) {
            return msg.edit(`${Emojis.sad} No results for \`${search}\`.`);
        }
    }
}

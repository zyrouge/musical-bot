import { Message } from "discord.js";
import {
    Client,
    Command,
    GuildAudioManager,
    Track,
    TrackOptions
} from "../Core";
import {
    isGuildTextChannel,
    getTrackParamsFromYtdl,
    getTrackParamsFromYtsr,
    Emojis
} from "../Utils";
import ytsr from "ytsr";
import ytdl from "ytdl-core";

export default class implements Command {
    name = "play";
    aliases = ["p", "pl"];
    description = "Play a song";

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
            `${Emojis.info} Searching results for \`${search}\``
        );
        let trackopts: TrackOptions;
        try {
            const video = await ytdl.getBasicInfo(args[0]);
            trackopts = getTrackParamsFromYtdl(video);
        } catch (e) {
            const searches = await ytsr(search, {
                limit: 5
            });
            const videos = searches.items.filter((t) => t.type === "video");
            if (!videos.length || !videos[0])
                return msg.edit(
                    `${Emojis.sad} No result found for \`\`${search}\`\`.`
                );
            const video = videos[0] as ytsr.Video;
            const yttrack = await ytdl.getBasicInfo(video.link);
            trackopts = yttrack
                ? getTrackParamsFromYtdl(yttrack)
                : getTrackParamsFromYtsr(video);
        }

        const track = new Track(trackopts, message.author.id);
        try {
            queue.addTrack(track);
            msg.edit(`${Emojis.music} Added **${track.title}** to queue`);
            if (!queue.playing) await queue.start();
        } catch (err) {
            msg.edit(`${Emojis.err} ${err}`);
        }
    }
}

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
    Emojis,
    RegExps,
    getTrackParamsFromYtplResult,
    getSpotifyPlaylist,
    getSpotifyTrack
} from "../Utils";
import URLParser from "url";
import ytsr, { Video as ytVideo } from "youtube-sr";
import ytpl from "ytpl";
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
            `${Emojis.info} Searching results for \`${search}\`...`
        );

        let trackopts: TrackOptions | TrackOptions[];
        if (RegExps.youtube.playlist.test(search)) {
            try {
                const videos = await ytpl(search);
                msg.edit(
                    `${Emojis.music} Adding **${videos.items.length} songs** to queue...`
                );
                const songs = getTrackParamsFromYtplResult(videos);
                trackopts = songs;
            } catch (err) {
                return msg.edit(
                    `${Emojis.sad} Could not resolve playlist \`${search}\`.`
                );
            }
        } else if (RegExps.youtube.song.test(search)) {
            try {
                const video = await ytdl.getBasicInfo(args[0]);
                trackopts = getTrackParamsFromYtdl(video);
            } catch (err) {
                return msg.edit(
                    `${Emojis.sad} Could not resolve video \`${search}\`.`
                );
            }
        } else if (RegExps.spotify.song.test(search)) {
            try {
                const video = await getSpotifyTrack(args[0]);
                trackopts = video;
            } catch (err) {
                return msg.edit(
                    `${Emojis.sad} Could not resolve video \`${search}\`.`
                );
            }
        } else if (RegExps.spotify.playlist.test(search)) {
            try {
                const videos = await getSpotifyPlaylist(search);
                msg.edit(
                    `${Emojis.music} Adding **${videos.length} songs** to queue...`
                );
                trackopts = videos;
            } catch (err) {
                return msg.edit(
                    `${Emojis.sad} Could not resolve playlist \`${search}\`.`
                );
            }
        } else if (RegExps.link.test(search)) {
            const url = URLParser.parse(args[0]);
            const base = url.hostname || url.host || "Unknown";
            trackopts = {
                title: `${base} - Stream`,
                url: url.href,
                channelName: "Unknown",
                channelURL: base,
                type: "href-stream"
            };
        } else {
            try {
                const video = await ytsr.searchOne(search);
                if (!video || !(video instanceof ytVideo))
                    return msg.edit(
                        `${Emojis.sad} No result found for \`${search}\`.`
                    );
                trackopts = getTrackParamsFromYtsr(video);
            } catch (err) {
                console.error(err);
                return msg.edit(`${Emojis.sad} No results for \`${search}\`.`);
            }
        }

        if (Array.isArray(trackopts)) {
            let duplicates = 0;
            for (const tr of trackopts) {
                const track = new Track(tr, message.author.id);
                try {
                    queue.addTrack(track);
                } catch (err) {
                    duplicates += 1;
                }
            }
            msg.edit(
                `${Emojis.music} Added **${
                    trackopts.length - duplicates
                } songs** to queue! (${duplicates} duplicates were removed)`
            );
        } else {
            const track = new Track(trackopts, message.author.id);
            try {
                queue.addTrack(track);
            } catch (err) {
                return msg.edit(`${Emojis.err} ${err}`);
            }
            msg.edit(`${Emojis.music} Added **${track.title}** to queue!`);
        }

        try {
            if (!queue.playing) await queue.start();
        } catch (err) {
            msg.edit(`${Emojis.err} ${err}`);
        }
    }
}

import { DMChannel, NewsChannel, TextChannel } from "discord.js";
import ytsr from "ytsr";
import ytpl from "ytpl";
import ytdl from "ytdl-core";
import dayjs from "dayjs";
import dayjsduration from "dayjs/plugin/duration";
import { TrackOptions } from "./Core";

dayjs.extend(dayjsduration);

export function isGuildTextChannel(
    channel: TextChannel | DMChannel | NewsChannel
): channel is TextChannel {
    if (!("guild" in channel)) return false;
    return true;
}

export function getLocaleFromDuration({
    days,
    hours,
    minutes,
    seconds
}: dayjsduration.Duration) {
    const daysN = days();
    const hoursN = hours();
    const minuteN = minutes();
    const secondN = seconds();
    const day = daysN ? `${daysN}d` : "";
    const hour = hoursN ? `${hoursN}h` : "";
    const minute = minuteN ? `${minuteN}m` : "";
    const second = secondN ? `${secondN}s` : "";
    return [day, hour, minute, second].map((x) => !!x.length).join(":");
}

export function getTrackParamsFromYtdl({
    videoDetails: video
}: ytdl.videoInfo) {
    const track: TrackOptions = {
        url: video.video_url,
        thumbnail: video.thumbnail.thumbnails[0].url,
        channelName: video.author.name,
        channelURL: video.author.channel_url,
        title: video.title,
        uploadedAt: video.uploadDate,
        duration: parseInt(video.lengthSeconds) * 1000
    };
    return track;
}

export function getTrackParamsFromYtsr(video: ytsr.Video) {
    const track: TrackOptions = {
        url: video.link,
        thumbnail: video.thumbnail,
        channelName: video.author.name,
        channelURL: video.author.ref,
        title: video.title
    };
    if (video.uploaded_at) track.uploadedAt = video.uploaded_at;
    if (video.duration) {
        const dura = dayjs.duration(video.duration);
        track.duration = dura.asMilliseconds();
    }
    return track;
}

export function getTrackParamsFromYtplResult(videos: ytpl.result) {
    const tracks: TrackOptions[] = videos.items.map((video) => {
        const track: TrackOptions = {
            url: video.url_simple,
            thumbnail: video.thumbnail,
            channelName: video.author?.name || "Unknown",
            channelURL: video.author?.ref || "Unknown",
            title: video.title
        };
        if (video.duration) {
            const dura = dayjs.duration(video.duration);
            track.duration = dura.asMilliseconds();
        }
        return track;
    });
    return tracks;
}

export const Emojis = {
    music: "🎵",
    music2: "🎶",
    bye: "👋",
    dvd: "📀",
    tick: "✔️",
    cross: "❌",
    success: "👌",
    err: "⛔",
    sad: "🙁",
    info: "ℹ️",
    repeat: {
        queue: "🔁",
        song: "🔂"
    },
    shuffle: "🔀",
    search: "🔍",
    clock: "🕐",
    speaker: "🔊"
};

export const Colors = {
    def: 0xe642f5
};

// https://github.com/Androz2091/discord-player/blob/5e3075dad1b4617a21d99379438f221582a0c130/src/Player.js#L35
export const SongFilters = {
    bassboost: "bass=g=20,dynaudnorm=g=101",
    "8D": "apulsator=hz=0.08",
    vaporwave: "aresample=48000,asetrate=48000*0.8",
    nightcore: "aresample=48000,asetrate=48000*1.25",
    phaser: "aphaser=in_gain=0.4",
    tremolo: "tremolo",
    vibrato: "vibrato=f=6.5",
    reverse: "areverse",
    treble: "treble=g=5",
    normalizer: "dynaudnorm=f=200",
    surrounding: "surround",
    pulsator: "apulsator=hz=1",
    subboost: "asubboost",
    karaoke: "stereotools=mlev=0.03",
    flanger: "flanger",
    gate: "agate",
    haas: "haas",
    mcompand: "mcompand"
};

export const RegExps = {
    youtubeURL: /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|v\/)?)([\w\-]+)(\S+)?$/,
    playlist: /^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/
};

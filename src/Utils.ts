import { DMChannel, NewsChannel, TextChannel } from "discord.js";
import { Video as ytVideo } from "youtube-sr";
import ytpl from "ytpl";
import ytdl from "ytdl-core";
import dayjs from "dayjs";
import dayjsduration from "dayjs/plugin/duration";
import { TrackOptions } from "./Core";

const sptfi = require("spotify-url-info");
dayjs.extend(dayjsduration);

export function isGuildTextChannel(
    channel: TextChannel | DMChannel | NewsChannel
): channel is TextChannel {
    if (!("guild" in channel)) return false;
    return true;
}

export function getLocaleFromDuration(dura: dayjsduration.Duration) {
    const daysN = dura.days();
    const hoursN = dura.hours();
    const minuteN = dura.minutes();
    const secondN = dura.seconds();
    const day = daysN ? `${daysN}d` : "";
    const hour = hoursN ? `${hoursN}h` : "";
    const minute = minuteN ? `${minuteN}m` : "";
    const second = secondN ? `${secondN}s` : "";
    return [day, hour, minute, second].filter((x) => !!x.length).join(":");
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
        duration: parseInt(video.lengthSeconds) * 1000,
        type: "youtube"
    };
    return track;
}

export function getTrackParamsFromYtsr(video: ytVideo) {
    if (!video.url) throw new Error("Invalid video");
    const track: TrackOptions = {
        url: video.url,
        thumbnail: video.thumbnail.displayThumbnailURL("maxresdefault"),
        channelName: video.channel.name || "Unknown",
        channelURL: video.channel.url || "Unknown",
        title: video.title || "Unknown",
        type: "youtube"
    };
    if (video.uploadedAt) track.uploadedAt = video.uploadedAt;
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
            title: video.title,
            type: "youtube"
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
    speaker: "🔊",
    pause: "⏸️",
    play: "▶️"
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
    link: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/i,
    youtube: {
        song: /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|v\/)?)([\w\-]+)(\S+)?$/,
        playlist: /^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/
    },
    soundcloud: /^https?:\/\/(soundcloud\.com|snd\.sc)\/(.*)$/,
    spotify: {
        song: /^https?:\/\/(?:open|play)\.spotify\.com\/track\/[\w\d]+$/i,
        playlist: /https?:\/\/open.spotify.com\/((track|user|artist|album)\/)?[a-zA-Z0-9]+(\/playlist\/[a-zA-Z0-9]+|)/i
    }
};

export interface SpotifyTrack {
    title: string;
    type: string;
    track: string;
    artist: string;
    image: string;
    audio: string;
    link: string;
    embed: string;
    date: string;
    description: string;
}

export type SpotifyPlaylist = {
    artists: [
        {
            external_urls: {
                spotify: string;
            };
            href: string;
            id: string;
            name: string;
            type: string;
            uri: string;
        }
    ];
    duration_ms: number;
    episode: boolean;
    explicit: boolean;
    external_urls: {
        spotify: string;
    };
    href: string;
    id: string;
    name: string;
    popularity: number;
    preview_url: string;
    type: string;
    uri: string;
}[];

export async function getSpotifyTrack(url: string) {
    const rt: SpotifyTrack = await sptfi.getPreview(url);
    const track: TrackOptions = {
        url: rt.link,
        thumbnail: rt.image,
        channelName: rt.artist || "Unknown",
        channelURL: "Unknown",
        title: rt.title || "Unknown",
        uploadedAt: rt.date,
        type: "spotify"
    };
    return track;
}

export async function getSpotifyPlaylist(url: string) {
    const playlist: SpotifyPlaylist = await sptfi.getTracks(url);
    const tracks: TrackOptions[] = playlist.map((video) => {
        const track: TrackOptions = {
            url:
                video.external_urls.spotify ||
                `https://open.spotify.com/track/${video.id}`,
            channelName: video.artists[0]?.name || "Unknown",
            channelURL: "Unknown",
            title: video.name,
            duration: video.duration_ms,
            type: "spotify"
        };
        return track;
    });
    return tracks;
}

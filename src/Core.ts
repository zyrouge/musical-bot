import {
    Client as DiscordClient,
    ClientOptions as DiscordClientOptions,
    Collection,
    Message,
    StreamDispatcher,
    TextChannel,
    VoiceChannel,
    VoiceConnection
} from "discord.js";
import ytdl from "ytdl-core";
import { StreamDownloader as sc } from "soundcloud-scraper";
import ffmpeg from "fluent-ffmpeg";
import { PassThrough } from "stream";
import _, { isUndefined } from "lodash";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Emojis, SongFilters } from "./Utils";
import { Readable } from "stream";

dayjs.extend(duration);

export interface Command {
    name: string;
    description: string;
    aliases?: string[];
    action(client: Client, message: Message, args: string[]): void;
}

export interface CommandConstructor {
    new (): Command;
}

export interface ClientOptions extends DiscordClientOptions {
    prefix: string;
}

class CommandsManager {
    labels: Collection<string, Command>;
    aliases: Collection<string, string>;

    constructor() {
        this.labels = new Collection();
        this.aliases = new Collection();
    }

    resolve(name: string) {
        const byName = this.labels.get(name);
        if (byName) return byName;
        const byAlias = this.aliases.get(name);
        if (byAlias) return this.labels.get(byAlias);
        return undefined;
    }
}

export class Client extends DiscordClient {
    prefix: string;
    music: Collection<string, GuildAudioManager>;
    commander: CommandsManager;

    constructor(config: ClientOptions) {
        super(config);
        this.prefix = config.prefix;
        this.music = new Collection();
        this.commander = new CommandsManager();
    }
}

export type sources = "soundcloud" | "youtube";
export interface TrackOptions {
    url: string;
    thumbnail: string;
    channelName: string;
    channelURL: string;
    title: string;
    uploadedAt?: string | number;
    duration?: number;
    type: sources;
}

export class Track {
    title: string;
    url: string;
    duration?: number;
    thumbnail: string;
    channel: {
        title: string;
        url: string;
    };
    published?: string | number;
    requester: string;
    type: sources;

    constructor(video: TrackOptions, userID: string) {
        this.url = video.url;
        this.thumbnail = video.thumbnail;
        this.channel = {
            title: video.channelName,
            url: video.channelURL
        };
        this.title = video.title
            .replace(/\\(\*|_|`|~|\\)/g, "$1")
            .replace(/(\*|_|`|~|\\)/g, "\\$1");
        this.requester = userID;
        this.type = video.type;
        this._duration(video);
    }

    private _duration(video: {
        uploadedAt?: string | number;
        duration?: number;
    }) {
        if (video.uploadedAt) this.published = video.uploadedAt;
        if (video.duration) {
            this.duration = video.duration;
        }
    }

    async getStream(): Promise<Readable> {
        if (this.type === "soundcloud") return await sc.downloadHLS(this.url);
        if (this.type === "youtube")
            return ytdl(this.url, {
                quality: "highestaudio",
                highWaterMark: 1 << 25
            });
        throw new Error("Invalid track type");
    }
}

export type loop = "queue" | "none" | "track";
export type filter = keyof typeof SongFilters;

export class GuildAudioManager {
    private _songs: Track[];
    index: number | null;
    loop: loop;
    textChannel: TextChannel;
    voiceChannel: VoiceChannel;
    connection?: VoiceConnection;
    dispatcher?: StreamDispatcher;
    filters: Set<filter>;
    volume: number;
    private _dontChangeIndex?: boolean;
    private _seekMs?: number;
    private lastMessage?: Message;

    constructor(textChannel: TextChannel, voiceChannel: VoiceChannel) {
        this._songs = [];
        this.loop = "none";
        this.index = null;
        this.textChannel = textChannel;
        this.voiceChannel = voiceChannel;
        this.filters = new Set();
        this.volume = 150;
    }

    get songs() {
        return [...this._songs];
    }

    get playing() {
        return this.index !== null;
    }

    get paused() {
        return !!(this.dispatcher && this.dispatcher.paused);
    }

    addTrack(track: Track) {
        const exist = this._songs.findIndex((t) => t.url === track.url) >= 0;
        if (exist) throw new Error("Already in queue");
        this._songs.push(track);
    }

    removeTrack(position: number) {
        if (!this._songs[position]) throw new Error("Invalid song index");
        this._songs = this._songs.splice(position, 1);
    }

    clearQueue() {
        this._songs = [];
        this.index = null;
    }

    setLoop(state: loop) {
        this.loop = state;
    }

    nowPlaying() {
        if (this.index === null) throw new Error("Nothing is being played");
        return this._songs[this.index];
    }

    streamTime() {
        if (!this.dispatcher) throw new Error("Nothing is being played");
        return this.dispatcher.streamTime + (this._seekMs || 0);
    }

    pause() {
        if (!this.dispatcher) throw new Error("Nothing is being played");
        if (this.dispatcher.paused) throw new Error("Music is already paused");
        this.dispatcher.pause();
    }

    resume() {
        if (!this.dispatcher) throw new Error("Nothing is being played");
        if (!this.dispatcher.paused) throw new Error("Music is not paused");
        this.dispatcher.resume();
    }

    stop() {
        if (!this.connection || !this.dispatcher)
            throw new Error("Nothing is being played");
        this.cleanup();
        this.textChannel.send(`${Emojis.bye} Music has been ended.`);
    }

    skip() {
        if (!this.dispatcher) throw new Error("Nothing is being played");
        this.incrementIndex(true);
        this._dontChangeIndex = true;
        this.dispatcher.end();
    }

    previous() {
        if (!this.dispatcher) throw new Error("Nothing is being played");
        this.decrementIndex(true);
        this._dontChangeIndex = true;
        this.dispatcher.end();
    }

    setVolume(volume: number) {
        if (!this.dispatcher) throw new Error("Nothing is being played");
        if (volume < 0 || volume > 200)
            throw new Error("Volume must be between 0-200");
        this.volume = volume;
        this.dispatcher.setVolumeLogarithmic(this.volume / 200);
    }

    shuffle() {
        const shuff = (arr: Track[]) => arr.sort((a, b) => Math.random() - 0.5);
        const currentSongURL = this.nowPlaying().url;
        this._songs = shuff(this._songs);
        this._songs = shuff(this._songs);
        this.index = this._songs.findIndex((t) => t.url === currentSongURL);
    }

    jump(position: number) {
        if (!this.dispatcher) throw new Error("Nothing is being played");
        if (position < 0 || position > this._songs.length)
            throw new Error("Invalid song index");
        this.index = position;
        this._dontChangeIndex = true;
        this.dispatcher.end();
        return true;
    }

    addFilters(filters: filter[]) {
        filters.forEach((f) => this.filters.add(f));
    }

    removeFilters(filters: filter[]) {
        filters.forEach((f) => this.filters.delete(f));
    }

    allFilters() {
        return [...this.filters.values()];
    }

    getFilters() {
        return this.allFilters().map((f) => SongFilters[f]);
    }

    start() {
        if (this.index === null) this.index = 0;
        return this.play(this._songs[this.index]);
    }

    async play(song: Track) {
        try {
            if (!song) {
                this.cleanup();
                this.textChannel.send(
                    `${Emojis.bye} No more songs are on queue, goodbye!`
                );
                return;
            }

            if (!this.connection) {
                if (!this.voiceChannel.joinable)
                    throw new Error("Voice channel is not joinable");
                this.connection = await this.voiceChannel.join();
                this.connection.on("disconnect", () => this.cleanup());
                this.connection.on("error", console.error);
            }

            try {
                const seek = !isUndefined(this._seekMs)
                    ? this._seekMs / 1000
                    : 0;

                const stream = await this.createStream(song);
                this.dispatcher = this.connection.play(stream, {
                    seek: seek,
                    bitrate: "auto",
                    volume: this.volume / 200
                });
                delete this._seekMs;

                this.dispatcher.on("start", async () => {
                    this.lastMessage = await this.textChannel.send(
                        `${Emojis.dvd} Playing **${song.title}**.`
                    );
                });

                this.dispatcher.on("finish", async () => {
                    this.lastMessage?.delete().catch(() => {});
                    if (!this._dontChangeIndex) this.incrementIndex();
                    delete this._dontChangeIndex;
                    await this.handleEnd();
                });

                this.dispatcher.on("error", console.error);
            } catch (err) {
                this.incrementIndex(true);
                await this.handleEnd();
                this.textChannel.send(
                    `${Emojis.sad} Could not play **${song.title}**`
                );
            }
        } catch (err) {
            console.error(err);
            this.cleanup();
            this.textChannel.send(`Something went wrong\n\`\`\`${err}\`\`\``);
        }
    }

    async refreshStream() {
        if (!this.connection || !this.dispatcher || !this.playing)
            throw new Error("Nothing is being played");
        this._seekMs = this.dispatcher.streamTime;
        this._dontChangeIndex = true;
        this.dispatcher.end();
    }

    async createStream(song: Track) {
        const baseStream = await song.getStream();
        const outputStream = new PassThrough();
        const command = ffmpeg(baseStream)
            .audioCodec("libmp3lame")
            .noVideo()
            .audioBitrate(128)
            .format("mp3");
        const filters = this.getFilters();
        if (filters.length) command.outputOption(`-af ${filters.join(",")}`);
        command.pipe(outputStream, { end: true });

        outputStream.on("close", () => {
            if (!baseStream.destroyed) baseStream.destroy();
            if (!outputStream.destroyed) outputStream.destroy();
            command.kill("SIGSTOP");
        });

        return outputStream;
    }

    handleEnd() {
        if (this.index === null) throw new Error("Nothing is being played");
        return this.play(this._songs[this.index]);
    }

    incrementIndex(force: boolean = false) {
        if (this.index === null) throw new Error("Nothing is being played");
        if (!force && this.loop === "track") return;
        this.index = this.index + 1;
        if (this.loop === "queue" && !this._songs[this.index]) this.index = 0;
    }

    decrementIndex(force: boolean = false) {
        if (this.index === null) throw new Error("Nothing is being played");
        if (!force && this.loop === "track") return;
        this.index = this.index - 1;
        if (this.loop === "queue" && !this._songs[this.index])
            this.index = this._songs.length - 1;
    }

    cleanup() {
        try {
            this.dispatcher?.destroy();
        } catch (e) {}
        delete this.connection;
        delete this.dispatcher;
        this.clearQueue();
    }
}

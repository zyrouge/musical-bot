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
import _ from "lodash";
import dayjs, { Dayjs } from "dayjs";
import duration from "dayjs/plugin/duration";
import { Emojis } from "./Utils";

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

export interface TrackOptions {
    url: string;
    thumbnail: string;
    channelName: string;
    channelURL: string;
    title: string;
    uploadedAt?: string;
    duration?: number;
}

export class Track {
    title: string;
    url: string;
    duration?: number;
    private durationObj?: duration.Duration;
    thumbnail: string;
    channel: {
        title: string;
        url: string;
    };
    published?: string;
    requester: string;

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
        if (video.uploadedAt) this.published = video.uploadedAt;
        if (video.duration) {
            this.duration = video.duration;
            this.durationObj = dayjs.duration(video.duration);
        }
    }

    durationHuman() {
        if (!this.durationObj) return undefined;
        const { days, hours, minutes, seconds } = this.durationObj;
        const str = (n: any) => (n ? `${n}` : "");
        return [days, hours, minutes, seconds]
            .map(str)
            .filter((s) => !!s)
            .join(":");
    }

    getStream() {
        return ytdl(this.url, {
            filter: "audioonly",
            quality: "lowestaudio"
        });
    }
}

export type loop = "queue" | "none" | "track";

export class GuildAudioManager {
    private _songs: Track[];
    index: number | null;
    loop: loop;
    textChannel: TextChannel;
    voiceChannel: VoiceChannel;
    connection?: VoiceConnection;
    dispatcher?: StreamDispatcher;

    constructor(textChannel: TextChannel, voiceChannel: VoiceChannel) {
        this._songs = [];
        this.loop = "none";
        this.index = null;
        this.textChannel = textChannel;
        this.voiceChannel = voiceChannel;
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
        this._songs.push(track);
    }

    removeTrack(position: number) {
        if (!this._songs[position]) throw new Error("Invalid song index");
        this._songs.splice(position, 1);
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

    pause() {
        if (!this.dispatcher) throw new Error("Nothing is being played");
        if (this.playing === false) throw new Error("Music is already paused");
        this.dispatcher.pause();
    }

    resume() {
        if (!this.dispatcher) throw new Error("Nothing is being played");
        if (this.playing === true) throw new Error("Music is not paused");
        this.dispatcher.resume();
    }

    stop() {
        if (!this.connection || !this.dispatcher)
            throw new Error("Nothing is being played");
        this.clearQueue();
        this.dispatcher.end();
        this.connection.disconnect();
        return true;
    }

    skip() {
        if (!this.dispatcher) throw new Error("Nothing is being played");
        this.incrementIndex(true);
        this.dispatcher.end(false);
    }

    previous() {
        if (!this.dispatcher) throw new Error("Nothing is being played");
        this.decrementIndex(true);
        this.dispatcher.end(false);
    }

    setVolume(volume: number) {
        if (!this.dispatcher) throw new Error("Nothing is being played");
        this.dispatcher.setVolume(volume / 100);
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
        if (position > this._songs.length)
            throw new Error("Invalid song index");
        this.index = position;
        this.dispatcher.end(false);
        return true;
    }

    start() {
        if (this.index === null) this.index = 0;
        return this.play(this._songs[this.index]);
    }

    async play(song: Track) {
        if (!song) {
            this.cleanup();
            this.textChannel.send(`${Emojis.bye} Music has been Ended.`);
            return;
        }

        if (!this.connection) {
            if (!this.voiceChannel.joinable)
                throw new Error("Voice channel is not joinable");
            this.connection = await this.voiceChannel.join();
            this.connection.on("disconnect", () => this.cleanup());
            this.connection.on("error", console.error);
        }

        this.dispatcher = this.connection.play(song.getStream());
        this.dispatcher.on("start", () => {
            this.textChannel.send(`${Emojis.dvd} Playing **${song.title}**.`);
        });
        this.dispatcher.on("finish", async (inc: boolean = true) =>
            this.handleEnd(inc)
        );
    }

    handleEnd(inc: boolean = true) {
        if (this.index === null) throw new Error("Nothing is being played");
        if (inc) this.incrementIndex();
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
        delete this.connection;
        delete this.dispatcher;
        this.index = null;
        this.clearQueue();
    }
}

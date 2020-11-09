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
import Youtube from "ytsr";
import ytdl from "ytdl-core";
import _ from "lodash";
import dayjs, { Dayjs } from "dayjs";
import duration from "dayjs/plugin/duration";

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

class Track {
    title: string;
    url: string;
    duration?: string;
    durationTime?: duration.Duration;
    thumbnail: string;
    channel: {
        title: string;
        url: string;
    };
    published?: string;
    requester: string;

    constructor(video: Youtube.Video, userID: string) {
        this.url = video.link;
        this.thumbnail = video.thumbnail;
        this.channel = {
            title: video.author.name,
            url: video.author.ref
        };
        this.title = video.title
            .replace(/\\(\*|_|`|~|\\)/g, "$1")
            .replace(/(\*|_|`|~|\\)/g, "\\$1");
        this.requester = userID;
        if (video.uploaded_at) this.published = video.uploaded_at;
        if (video.duration) {
            this.duration = video.duration;
            this.durationTime = dayjs.duration(video.duration);
        }
    }

    getStream() {
        return ytdl(this.url, {
            filter: "audioonly",
            quality: "highestaudio"
        });
    }
}

type loop = "queue" | "none" | "track";

class GuildAudioManager {
    private _songs: Track[];
    index: number;
    loop: loop;
    playing: boolean;
    connection?: VoiceConnection;
    dispatcher?: StreamDispatcher;
    textChannel: TextChannel;
    voiceChannel: VoiceChannel;

    constructor(textChannel: TextChannel, voiceChannel: VoiceChannel) {
        this._songs = [];
        this.loop = "none";
        this.index = 0;
        this.playing = false;
        this.textChannel = textChannel;
        this.voiceChannel = voiceChannel;
    }

    get songs() {
        return [...this._songs];
    }

    // removeTrack(position: number) {
    //     try {
    //         // let track = this._songs[position];
    //         // this._songs.splice(track, 1);
    //         return true;
    //     } catch (e) {
    //         return false;
    //     }
    // }

    clearQueue() {
        this._songs = [];
        this.index = 0;
    }

    setLoop(state: loop) {
        this.loop = state;
    }

    nowPlaying() {
        return this._songs[this.index];
    }

    pause() {
        if (!this.dispatcher) throw new Error("Nothing is being played");
        if (this.playing === false) throw new Error("Music is already paused");
        this.playing = false;
        this.dispatcher.pause();
    }

    resume() {
        if (!this.dispatcher) throw new Error("Nothing is being played");
        if (this.playing === true) throw new Error("Music is not paused");
        this.playing = true;
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
        this.incrementIndex();
        this.dispatcher.end();
    }

    // previous() {
    //     const queue = this._queue.get(guild.id);
    //     let revertLoopToTrack = false;
    //     if (queue.loop == 2) {
    //         queue.loop = 0;
    //         revertLoopToTrack = true;
    //     }
    //     queue.songs = this._previousQueueProcess(queue.songs);
    //     queue.connection.stopPlaying();
    //     setTimeout(() => {
    //         if (revertLoopToTrack && this._queue.get(guild.id)) queue.loop = 2;
    //     }, 1000);
    //     return true;
    // }

    // _previousQueueProcess(array) {
    //     let songs = [];
    //     array.forEach((song) => songs.push(song));
    //     const song = songs.pop();
    //     songs.splice(1, 0, song);
    //     return songs;
    // }

    setVolume(volume: number) {
        if (!this.dispatcher) throw new Error("Nothing is being played");
        this.dispatcher.setVolume(volume / 100);
    }

    shuffle() {
        this._songs = this._songs.sort((a, b) => Math.random() - 0.5);
    }

    jump(position: number) {
        if (!this.dispatcher) throw new Error("Nothing is being played");
        if (position > this._songs.length)
            throw new Error("Invalid song index");
        this.index = position;
        this.dispatcher.end();
        return true;
    }

    async play(song: Track) {
        if (!song) {
            this.voiceChannel?.leave();
            this.textChannel?.send(`Music has been Ended.`);
            return;
        }

        if (!this.connection) {
            if (!this.voiceChannel.joinable)
                throw new Error("Voice channel is not joinable");
            this.connection = await this.voiceChannel.join();
        }

        this.dispatcher = this.connection.play(song.getStream());
        this.textChannel.send(`${"kek"} | Playing **${song.title}**.`);
        this.connection.once("end", this.handleEnd);
        this.connection.on("error", (err) => console.error(err));
    }

    handleEnd() {
        this.incrementIndex();
        return this.play(this._songs[this.index]);
    }

    incrementIndex() {
        if (this.loop === "track") return;
        if (this.loop === "queue" && !this._songs[this.index]) this.index = 0;
    }
}

import { Message } from "discord.js";
import { Client, Command, filter } from "../Core";
import { isGuildTextChannel, Emojis, SongFilters, Colors } from "../Utils";
import DiscordJS from "discord.js";
import { capitalize } from "lodash";

const allFilters = Object.keys(SongFilters) as filter[];

export default class implements Command {
    name = "filter";
    aliases = ["filters", "fl"];
    description = "Modify song filters";

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
                `${Emojis.err} Nothing is playing to use \`${this.name}\` command.`
            );

        if (queue.voiceChannel.id !== voiceChannel.id)
            return message.channel.send(
                `${Emojis.err} You must be in the same voice channel to use \`${this.name}\` command.`
            );

        let [doWhat, ...rfilters] = args as [string?, ...filter[]];
        if (doWhat) doWhat = doWhat.toLowerCase();
        if (rfilters && rfilters.length)
            rfilters = rfilters.map((m) => m.toLowerCase() as filter);

        const types = [
            ["enable", "on", "add"],
            ["disable", "off", "remove", "rm"],
            ["clear"]
        ];
        const allTypes: string[] = [];
        types.forEach((t) => allTypes.push(...t));

        const filters = rfilters.filter((f) => allFilters.includes(f));
        if (
            !doWhat ||
            !allTypes.includes(doWhat) ||
            !rfilters ||
            !filters.length
        )
            return message.channel.send({
                embed: getFiltersEmbed(queue.allFilters())
            });

        if (types[0].includes(doWhat)) {
            queue.addFilters(filters);
        } else if (types[1].includes(doWhat)) {
            queue.removeFilters(filters);
        } else if (types[2].includes(doWhat)) {
            queue.filters = new Set();
        } else
            return message.channel.send({
                embed: getFiltersEmbed(queue.allFilters())
            });

        try {
            if (queue.playing) queue.refreshStream();
            message.channel.send({
                embed: getFiltersEmbed(queue.allFilters())
            });
        } catch (err) {
            message.channel.send(`${Emojis.err} ${err}`);
        }
    }
}

function getFiltersEmbed(filters: filter[]) {
    return {
        title: `${Emojis.music} Filters`,
        description: allFilters
            .map(
                (f) =>
                    `\`${
                        filters.includes(f) ? Emojis.tick : Emojis.cross
                    }\` **${capitalize(f)}**`
            )
            .join("\n"),
        color: Colors.def
    } as DiscordJS.MessageEmbedOptions;
}

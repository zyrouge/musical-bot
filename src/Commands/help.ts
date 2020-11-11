import { Message } from "discord.js";
import { Client, Command } from "../Core";
import { Colors, Emojis } from "../Utils";

export default class implements Command {
    name = "help";
    description = "Help command";

    constructor() {}

    action(client: Client, message: Message, args: string[]) {
        const commands = [...client.commander.labels.values()];
        message.channel.send({
            embed: {
                title: `${Emojis.info} All commands`,
                description: commands
                    .map((c) => `\`${c.name}\` - ${c.description}`)
                    .join("\n"),
                color: Colors.def
            }
        });
    }
}

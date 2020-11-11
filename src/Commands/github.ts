import { Message } from "discord.js";
import { Client, Command } from "../Core";
import { Emojis } from "../Utils";

export default class implements Command {
    name = "github";
    aliases = ["credits", "source", "code", "support"];
    description = "Source code of the bot";

    constructor() {}

    action(client: Client, message: Message, args: string[]) {
        const repo = "zyrouge/musical-bot";
        const url = "https://github.com/" + repo;
        message.channel.send({
            embed: {
                title: `${Emojis.music2} ${repo}`,
                url: url,
                fields: [
                    {
                        name: "Cloning",
                        value: `\`\`\`git clone ${url}.git\`\`\``
                    },
                    {
                        name: "Instructions",
                        value: `[README](${url}/blob/main/README.md)`
                    }
                ]
            }
        });
    }
}

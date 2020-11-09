import { Message } from "discord.js";
import { Client, Command } from "../Core";
import util from "util";
import { Emojis } from "../Utils";

export default class implements Command {
    name = "eval";
    aliases = ["ev"];
    description = "Evaluate nodejs code";

    constructor() {}

    action(client: Client, message: Message, args: string[]) {
        if (message.author.id !== process.env.OWNER_ID)
            return message.channel.send(
                `${Emojis.err} You are\'nt the Bot Owner!`
            );

        try {
            let code = args.join(" ");
            let evaled = eval(code);
            if (typeof evaled !== "string") evaled = util.inspect(evaled);
            message.channel.send(
                `${Emojis.success} Success\n\`\`\`${clean(evaled).slice(
                    0,
                    1700
                )}\`\`\``
            );
        } catch (err) {
            message.channel.send(
                `${Emojis.err} Error\n\`\`\`${clean(err).slice(0, 1700)}\`\`\``
            );
        }
    }
}

function clean(text: any) {
    if (typeof text === "string")
        return text
            .replace(/`/g, "`" + String.fromCharCode(8203))
            .replace(/@/g, "@" + String.fromCharCode(8203));
    else return `${text}`;
}

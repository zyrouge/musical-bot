import { Message } from "discord.js";
import { Client, Command } from "../Core";

export default class implements Command {
    name = "ping";
    description = "Ping pong!";

    constructor() {}

    action(client: Client, message: Message, args: string[]) {
        message.channel.send(
            `Pong! \`${Date.now() - message.createdTimestamp}ms\``
        );
    }
}

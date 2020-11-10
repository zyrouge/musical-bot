import { Client } from "./Core";
import http from "http";
import URL from "url";

export default function Server(client: Client, port?: number) {
    port = port || 8080;

    return http
        .createServer((req, res) => {
            res.writeHead(200, { "Content-Type": "application/json" });
            const { pathname } = URL.parse(req.url || "/");
            switch (pathname) {
                case "/":
                case "/ping":
                    res.write(JSON.stringify({ ok: true }));
                    break;

                default:
                    res.write(
                        JSON.stringify({
                            ok: false,
                            result: `Invalid path ${pathname}`
                        })
                    );
                    break;
            }
            res.end();
        })
        .listen(port);
}

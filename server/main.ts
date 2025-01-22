import { GeoPulse } from 'npm:geopulse@0.0.24'
import { parseArgs } from 'jsr:@std/cli/parse-args'

const flags = parseArgs(Deno.args, {
  string: ["key", "port"],
  default: { port: 8090 },
});

let geopulseAPIKey = flags.key as string;
const port = Number(flags.port as string);

// Try to read from .geopulse if no key provided
if (!geopulseAPIKey) {
  try {
    geopulseAPIKey = await Deno.readTextFile(".geopulse").then((text) =>
      text.trim()
    );
  } catch {
    console.error(
      "Please provide the API key using --key flag or create a .geopulse file",
    );
    console.error("Example: GeoPulse --key YOUR_API_KEY --port 8090");
    Deno.exit(1);
  }
}

const geopulse = new GeoPulse(geopulseAPIKey, { autoUpdate: true });

Deno.serve({ port }, async (request) => {
  const url = new URL(request.url);

  const match = url.pathname.match(/^\/ip\/([\d.]+)$/);
  if (match) {
    const ip = match[1];
    console.time('info')
    const info = await geopulse.lookup(ip);
    console.timeEnd('info')
    console.log("ip info ->", ip, info);
    return new Response(JSON.stringify(info), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log("request ->", request.url);
  return new Response(
    JSON.stringify({
      error: "Invalid endpoint. Use /ip/<IP_ADDRESS>",
    }),
    {
      status: 400,
      headers: { "Content-Type": "application/json" },
    },
  );
});

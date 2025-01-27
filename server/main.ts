import { GeoPulse } from 'npm:geopulse@0.0.31'
import { parseArgs } from 'jsr:@std/cli/parse-args'

const flags = parseArgs(Deno.args, {
    string: ['key', 'port', 'downloadURL'],
    boolean: ['server'],
    default: { port: 8090 },
})

let geopulseAPIKey = flags.key as string
const port = Number(flags.port as string)

// Try to read from .geopulse if no key provided
if (!geopulseAPIKey) {
    try {
        geopulseAPIKey = await Deno.readTextFile('.geopulse').then((text) => text.trim())
    } catch {
        console.error(
            'Please provide the API key using --key flag or create a .geopulse file',
        )
        console.error('Example: GeoPulse --key YOUR_API_KEY --port 8090')
        Deno.exit(1)
    }
}

const geopulse = new GeoPulse(geopulseAPIKey, { autoUpdate: true, downloadHostURL: flags.downloadURL })
geopulse.init().then()

Deno.serve({ port }, async (request) => {
    const url = new URL(request.url)

    if (flags.server) {
        const requestKey = request.headers.get('x-api-key') ?? url.searchParams.get('key')

        if (!requestKey) {
            return new Response(
                JSON.stringify({
                    'message': 'No API key provided. Please consult de documentation for further information.',
                }),
                {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' },
                },
            )
        }
    }

    const match = url.pathname.match(/^\/ip\/([\d.]+)$/)
    if (match) {
        const ip = match[1]

        console.time('info')
        const info = await geopulse.lookup(ip)
        console.timeEnd('info')

        console.log('ip info ->', ip, info)

        return new Response(JSON.stringify(info), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    console.log('request ->', request.url)
    return new Response(
        JSON.stringify({
            error: 'Invalid endpoint. Use /ip/<IP_ADDRESS>',
        }),
        {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        },
    )
})

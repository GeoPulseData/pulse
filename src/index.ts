import type { IPGeoPulse, IPRecord } from './types.js'
import { findIPData, loadData, readData } from './utils.js'
import fs from 'node:fs/promises'
import { Readable } from 'stream'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'

export let ipRanges: IPRecord[] | undefined

export class GeoPulse {
    constructor(APIKey: string, private readonly loader: () => void = () => {}) {
        this.loader = this.loader ?? (() => cloudLoader(APIKey))
    }

    async lookup(ip: string): Promise<IPGeoPulse | undefined> {
        if (!ipRanges) {
            ipRanges = await readData('ip-ranges.json')
        }

        if (!ipRanges) {
            await loadData(this.loader)

            ipRanges = await readData('ip-ranges.json')
        }

        if (!ipRanges) {
            return
        }

        if (ipRanges.length > 0) {
            return findIPData(ip, ipRanges)
        }

        // If IP isn't in the RIPE or APNIC range, check ARIN
        // const whoisData = await fetchARINWHOIS(ip)
        // console.log('whois ->', whoisData)
        // if (whoisData && !Array.isArray(whoisData)) {
        //     return whoisData;
        // }

        return
    }

}

export function localLoader() {
    return fs.cp('../ip-ranges.json', './ip-ranges.json')
}

export async function cloudLoader(key: string): Promise<void> {
    try {
        const downloadUrlResponse = await fetch(`https://wl540c5jbf.execute-api.eu-central-1.amazonaws.com/ip-data-download-url?key=${encodeURIComponent(key)}`)

        if (!downloadUrlResponse.ok) {
            throw new Error(`Failed to get download URL: ${downloadUrlResponse.statusText} - ${JSON.stringify(await downloadUrlResponse.json())}`)
        }

        if (downloadUrlResponse.body === null) {
            throw new Error('Download URL: Response body is null')
        }

        const {downloadURL} = await downloadUrlResponse.json()
        const fileResponse = await fetch(downloadURL)

        if (!fileResponse.ok) {
            throw new Error(`Failed to download file: ${fileResponse.statusText} - ${JSON.stringify(await fileResponse.json())}`)
        }

        // Ensure fileResponse.body is not null
        if (fileResponse.body === null) {
            throw new Error('Response body is null')
        }

        // Convert the ReadableStream to a Node.js Readable stream
        const readableStream = new Readable()
        readableStream._read = () => {} // _read is required but you can noop it

        // @ts-ignore: TypeScript doesn't recognize the pipeTo method
        await fileResponse.body.pipeTo(new WritableStream({
            write(chunk) {
                readableStream.push(chunk)
            },
            close() {
                readableStream.push(null)
            }
        }))

        const outputPath = './ip-ranges.json'
        const fileStream = createWriteStream(outputPath)

        // Use the pipeline function to handle the streaming
        await pipeline(readableStream, fileStream)

        console.log(`File downloaded successfully to ${outputPath}`)
    } catch (error) {
        console.error('Error downloading file:', error)
        throw error
    }
}

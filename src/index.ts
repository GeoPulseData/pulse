import type { IPGeoPulse, IPRecord } from './types.js'
import { findIPData, readData } from './utils.js'
import fs, { writeFile } from 'node:fs/promises'
import { Readable } from 'stream'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { join } from 'node:path'

export let ipRanges: IPRecord[] | undefined

interface Config {
    baseDirectory?: string
    dataFilename?: string
    metaDataFilename?: string
    loader?: () => void
}

export class GeoPulse {
    readonly loader: () => void | Promise<void>

    constructor(APIKey: string, public config: Config = {
        baseDirectory: '.',
        dataFilename: 'ip-ranges.json',
        metaDataFilename: 'ip-ranges.meta.json',
    }) {
        this.loader = config.loader ?? (() => cloudLoader(APIKey, this.dataFilenamePath))
    }

    get baseDirectory() {
        return this.config.baseDirectory ?? './'
    }

    get dataFilename() {
        return this.config.dataFilename ?? 'ip-ranges.json'
    }

    get metaDataFilename() {
        return this.config.dataFilename ?? 'ip-ranges.meta.json'
    }

    get dataFilenamePath() {
        return join(this.baseDirectory, this.dataFilename)
    }

    get metaDataFilenamePath() {
        return join(this.baseDirectory, this.metaDataFilename)
    }

    async lookup(ip: string): Promise<IPGeoPulse | undefined> {
        if (!ipRanges) {
            ipRanges = await readData(this.dataFilenamePath)
        }

        await this.checkDataFreshness()
        if (!ipRanges) {

            ipRanges = await readData(this.dataFilenamePath)
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

    async autoUpdate(
        periodInMinutes?: number
    ) {
        const checkTime = async () => {
            await this.checkDataFreshness(periodInMinutes)

            setTimeout(checkTime, 60 * 1000) // Schedule the next check after 1 minute
        }

        // Start the time checking process
        await checkTime()
    }

    private async checkDataFreshness(periodInMinutes = 60 * 24) {
        const meta = await readData(this.metaDataFilenamePath)
        const lastRun = meta?.lastRun
        const targetDate = isNaN(new Date(lastRun).getTime()) ? new Date(0) : new Date(lastRun)
        const periodInMs = periodInMinutes * 60 * 1000 // Convert minutes to milliseconds
        const now = new Date()

        const dataExists = await readData(this.dataFilenamePath)

        if (!dataExists || now.getTime() - targetDate.getTime() >= periodInMs) {
            await this.loader()

            await writeFile(this.metaDataFilenamePath, JSON.stringify({
                ...meta,
                lastRun: new Date,
            }, null, 2), 'utf8')
        }
    }
}

export function localLoader(fromFilePath: string, toFilePath: string) {
    return fs.cp(fromFilePath, toFilePath)
}

export async function cloudLoader(key: string, filePath: string): Promise<void> {
    try {
        const downloadUrlResponse = await fetch(`https://wl540c5jbf.execute-api.eu-central-1.amazonaws.com/ip-data-download-url?key=${encodeURIComponent(key)}`)

        if (!downloadUrlResponse.ok) {
            throw new Error(`Failed to get download URL: ${downloadUrlResponse.statusText} - ${await downloadUrlResponse.text()}`)
        }

        if (downloadUrlResponse.body === null) {
            throw new Error('Download URL: Response body is null')
        }

        const {downloadURL} = await downloadUrlResponse.json()
        const fileResponse = await fetch(downloadURL)

        if (!fileResponse.ok) {
            throw new Error(`Failed to download file: ${fileResponse.statusText} - ${await fileResponse.text()}`)
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

        const fileStream = createWriteStream(filePath)

        // Use the pipeline function to handle the streaming
        await pipeline(readableStream, fileStream)

        console.log(`File downloaded successfully to ${filePath}`)
    } catch (error) {
        console.error('Error downloading file:', error)
        throw error
    }
}

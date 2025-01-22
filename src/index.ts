import xml from 'simple-xml-to-json'
import type { IPGeoPulse, IPRecord, IPv4Record, IPv6Record } from './types.js'
import { countriesMap, findIPData, optimizeRecords, readData } from './utils.js'
import fs, { stat, writeFile } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { join } from 'node:path'

interface Config {
    baseDirectory?: string
    dataFilename?: string
    metaDataFilename?: string
    loader?: () => void
    autoUpdate?: boolean
}

type AutoUpdateIsOn = {autoUpdate: true, autoUpdateMinutes?: number}
type AutoUpdateIsOff = {autoUpdate?: false, autoUpdateMinutes?: never}

export class GeoPulse {
    metadata?: {lastRun: string}
    ipRanges?: {v4: IPv4Record[], v6: IPv6Record[]}
    currencyRates?: Record<string, number>

    readonly loader: () => void | Promise<void>

    constructor(APIKey: string, public config: Config & (AutoUpdateIsOn | AutoUpdateIsOff) = {
        baseDirectory: '.',
    }) {
        this.loader = config.loader ?? (() => cloudLoader(APIKey, this.ipRangesFilePath, this.currencyRatesFilePath))
    }

    async init() {
        if (this.config.autoUpdate) {
            if (this.config.autoUpdateMinutes && this.config.autoUpdateMinutes < 1) {
                throw new Error('Cannot update data more than once every minute')
            }

            const checkTime = async () => {
                await this.checkDataFreshness(this.config.autoUpdateMinutes)

                setTimeout(checkTime, 60 * 1000) // Schedule the next check after 1 minute
            }
            await checkTime().then()
        } else {
            await this.checkDataFreshness(0)
        }
    }

    get baseDirectory() {
        return this.config.baseDirectory ?? './'
    }

    get currencyRatesFilePath() {
        return join(this.baseDirectory, this.config.dataFilename ?? 'currency-rates.json')
    }

    get ipRangesFilePath() {
        return join(this.baseDirectory, this.config.dataFilename ?? 'ip-ranges.json')
    }

    get metaDataFilenamePath() {
        return join(this.baseDirectory, this.config.metaDataFilename ?? 'ip-ranges.meta.json')
    }

    private async loadData() {
        if (this.ipRanges && this.currencyRates) {
            return
        }

        if(!this.metadata){
            await this.checkDataFreshness(0)
        }

        await Promise.all([
            stat(this.ipRangesFilePath),
            stat(this.currencyRatesFilePath)
        ]).catch(() => this.checkDataFreshness(0))

        this.ipRanges = optimizeRecords(await readData<IPRecord[]>(this.ipRangesFilePath) ?? [])
        this.currencyRates = await readData<Record<string, number>>(this.currencyRatesFilePath) ?? {}
    }

    async lookup(ip: string, baseCurrency = 'USD'): Promise<IPGeoPulse | undefined> {
        await this.loadData()

        if (!this.ipRanges) {
            return
        }

        const ipData = findIPData(ip, this.ipRanges)
        if (!ipData) {
            return undefined
        }

        const countryCurrency = ipData.country.currency.code
        const currencyRate = this.currencyRates?.[baseCurrency]
        const countryCurrencyRate = this.currencyRates?.[countryCurrency]

        const currencyExchangeDecimalPlaces = 1_000_00

        return {
            ...ipData,
            exchangeRateBaseCurrency: baseCurrency,
            exchangeRate: currencyRate && countryCurrencyRate ?
                Math.round((countryCurrencyRate / currencyRate + Number.EPSILON) * currencyExchangeDecimalPlaces) / currencyExchangeDecimalPlaces
                : 1,
        }

        // If IP isn't in the RIPE or APNIC range, check ARIN
        // const whoisData = await fetchARINWHOIS(ip)
        // console.log('whois ->', whoisData)
        // if (whoisData && !Array.isArray(whoisData)) {
        //     return whoisData;
        // }
    }

    async exchangeRates(baseCurrency = 'USD') {
        await this.loadData()

        if (!this.currencyRates) {
            return {}
        }

        // EUR is the default currency rate based on the service we use
        const baseCurrencyRate = (this.currencyRates.EUR as number) / (this.currencyRates[baseCurrency] as number)

        const exchangeRatesBasedOnBaseCurrency: Record<string, number> = {}
        Object.keys(this.currencyRates).forEach(currencyCode => {
            exchangeRatesBasedOnBaseCurrency[currencyCode] = (this.currencyRates?.[currencyCode] as number) * baseCurrencyRate
        })

        return exchangeRatesBasedOnBaseCurrency
    }

    countries(){
        return Array.from(countriesMap.values())
    }

    country(code: string){
        return countriesMap.get(code)
    }

    countriesMappedByCode(){
        return countriesMap
    }

    private async checkDataFreshness(periodInMinutes = 60 * 24) {
        const meta = this.metadata ?? (this.metadata = await readData<{lastRun: string}>(this.metaDataFilenamePath))
        const lastRun = meta?.lastRun
        const targetDate = lastRun && !isNaN(new Date(lastRun).getTime())
            ? new Date(lastRun)
            : new Date(0)

        const periodInMs = periodInMinutes * 60 * 1000 // Convert minutes to milliseconds
        const now = new Date()
        console.log('diff ->', targetDate, now,now.getTime() - targetDate.getTime())

        const dataExists = await stat(this.ipRangesFilePath).catch(() => false).then(() => true)

        // console.log('checking for data freshness ->', periodInMinutes, dataExists, now.getTime(), targetDate.getTime(), now.getTime() - targetDate.getTime(), periodInMs)
        if (!dataExists || now.getTime() - targetDate.getTime() >= periodInMs) {
            await this.loader()

            await writeFile(this.metaDataFilenamePath, JSON.stringify({
                ...meta,
                lastRun: new Date,
            }, null, 2), 'utf8')

            //reload the metadata after we update it
            this.metadata = await readData<{lastRun: string}>(this.metaDataFilenamePath)
        }
    }
}

export function localLoader(fromFilePath: string, toFilePath: string) {
    return fs.cp(fromFilePath, toFilePath)
}

export async function loadIPBlocks(key: string, filePath: string) {
    try {
        const downloadUrlResponse = await fetch(`https://wl540c5jbf.execute-api.eu-central-1.amazonaws.com/ip-data-download-url?key=${encodeURIComponent(key)}`, {cache: 'no-cache'})

        if (!downloadUrlResponse.ok) {
            throw new Error(`Failed to get download URL: ${downloadUrlResponse.statusText} - ${await downloadUrlResponse.text()}`)
        }

        if (downloadUrlResponse.body === null) {
            throw new Error('Download URL: Response body is null')
        }

        const {downloadURL} = await downloadUrlResponse.json()
        const fileResponse = await fetch(downloadURL, {cache: 'no-cache'})

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

export async function loadCurrencyExchangeRates(key: string, filePath: string) {
    // TODO, maybe use S3 for this just as IPBlocks
    const url = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'

    try {
        // Fetch XML data from ECB
        const response = await fetch(url)
        if (!response.ok) throw new Error(`Failed to fetch data: ${response.statusText}`)
        const xmlData = await response.text()

        const jsonData = xml.convertXML(xmlData)

        const rates: Record<string, number> = {EUR: 1}
        jsonData['gesmes:Envelope'].children[2].Cube.children[0].Cube.children.forEach((item: any) => {
            rates[item.Cube.currency] = parseFloat(item.Cube.rate)
        })

        // await makeSureDirectoriesExist(filePath);
        await fs.writeFile(filePath, JSON.stringify(rates, null, 2), 'utf8')

        console.log(`Exchange rates saved to ${filePath}`)
    } catch (error) {
        console.error('Error fetching or saving ECB rates:', error)
    }
}

export async function cloudLoader(key: string, ipRangesFilePage: string, currencyRatesFilePath: string): Promise<void> {
    await Promise.all([
        loadIPBlocks(key, ipRangesFilePage),
        loadCurrencyExchangeRates(key, currencyRatesFilePath),
    ])
}

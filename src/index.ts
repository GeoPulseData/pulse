import type { IPGeoPulse, IPRecord, IPv4Record, IPv6Record } from './types.js'
import { countriesMap, findIPData, optimizeRecords, readData } from './utils.js'
import fs, { stat, writeFile } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { join } from 'node:path'
import packageJSON from '../package.json' with { type: 'json' }

interface Config {
    baseDirectory?: string
    dataFilename?: string
    metaDataFilename?: string
    loader?: () => void
    autoUpdate?: boolean
    downloadHostURL?: string
}

type AutoUpdateIsOn = {autoUpdate: true, autoUpdateMinutes?: number}
type AutoUpdateIsOff = {autoUpdate?: false, autoUpdateMinutes?: never}

export class GeoPulse {
    metadata?: {lastRun: string}
    ipRanges?: {v4: IPv4Record[], v6: IPv6Record[]}
    exchangesRates?: Record<string, number>

    readonly loader: (onlyMissingFiles: boolean) => void | Promise<void>

    constructor(APIKey: string, public config: Config & (AutoUpdateIsOn | AutoUpdateIsOff) = {
        baseDirectory: '.',
    }) {
        this.loader = config.loader ?? ((onlyMissingFiles: boolean) => cloudLoader(APIKey, this.ipRangesFilePath, this.exchangeRatesFilePath, {
            downloadHostURL: this.config.downloadHostURL,
            onlyMissingFiles
        }))
    }

    version() {
        return packageJSON.version
    }

    async init() {
        if (this.config.autoUpdateMinutes && this.config.autoUpdateMinutes < 1) {
            throw new Error('Cannot update data more than once every minute')
        }

        const ipRangesExist = await stat(this.ipRangesFilePath).then(() => true).catch(() => false)
        const exchangeRatesExist = await stat(this.exchangeRatesFilePath).then(() => true).catch(() => false)

        if (!ipRangesExist || !exchangeRatesExist) {
            await this.checkDataFreshness(0, ipRangesExist)
        }

        if (this.config.autoUpdate) {
            const checkTime = async () => {
                setTimeout(checkTime, 60 * 1000) // Schedule the next check after 1 minute

                await this.checkDataFreshness(this.config.autoUpdateMinutes, false)
            }
            await checkTime().then()
        }
    }

    get baseDirectory() {
        return this.config.baseDirectory ?? './'
    }

    get exchangeRatesFilePath() {
        return join(this.baseDirectory, this.config.dataFilename ?? 'exchange-rates.json')
    }

    get ipRangesFilePath() {
        return join(this.baseDirectory, this.config.dataFilename ?? 'ip-ranges.json')
    }

    get metaDataFilenamePath() {
        return join(this.baseDirectory, this.config.metaDataFilename ?? 'ip-ranges.meta.json')
    }

    private async loadData() {
        if (this.ipRanges) {
            return
        }

        if (!this.metadata) {
            await this.checkDataFreshness(0, false)
        }

        this.ipRanges = optimizeRecords(await readData<IPRecord[]>(this.ipRangesFilePath) ?? [])
        this.exchangesRates = await readData<Record<string, number>>(this.exchangeRatesFilePath) ?? {}
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

        let exchangeRate: Pick<IPGeoPulse, 'exchangeRate' | 'exchangeRateBaseCurrency'> | undefined = undefined
        const countryCurrency = ipData.country.currency?.code
        if (this.exchangesRates && countryCurrency) {
            const currencyRate = this.exchangesRates?.[baseCurrency]
            const countryCurrencyRate = this.exchangesRates?.[countryCurrency]


            if (currencyRate && countryCurrencyRate) {
                const currencyExchangeDecimalPlaces = 1_000_00
                ipData.exchangeRateBaseCurrency = baseCurrency
                ipData.exchangeRate = Math.round(
                    (countryCurrencyRate / currencyRate + Number.EPSILON) * currencyExchangeDecimalPlaces
                ) / currencyExchangeDecimalPlaces
            }
        }

        return ipData

        // If IP isn't in the RIPE or APNIC range, check ARIN
        // const whoisData = await fetchARINWHOIS(ip)
        // console.log('whois ->', whoisData)
        // if (whoisData && !Array.isArray(whoisData)) {
        //     return whoisData;
        // }
    }

    async exchangeRates(baseCurrency = 'USD') {
        await this.loadData()

        if (!this.exchangesRates) {
            return {}
        }

        // EUR is the default currency rate based on the service we use
        const baseCurrencyRate = (this.exchangesRates.EUR as number) / (this.exchangesRates[baseCurrency] as number)

        const exchangeRatesBasedOnBaseCurrency: Record<string, number> = {}
        Object.keys(this.exchangesRates).forEach(currencyCode => {
            exchangeRatesBasedOnBaseCurrency[currencyCode] = (this.exchangesRates?.[currencyCode] as number) * baseCurrencyRate
        })

        return exchangeRatesBasedOnBaseCurrency
    }

    countries() {
        return Array.from(countriesMap.values())
    }

    country(code: string) {
        return countriesMap.get(code)
    }

    countriesMappedByCode() {
        return countriesMap
    }

    private async checkDataFreshness(periodInMinutes = 60 * 24, onlyMissingFiles: boolean) {
        const meta = this.metadata ?? (this.metadata = await readData<{lastRun: string}>(this.metaDataFilenamePath))
        const lastRun = meta?.lastRun
        const targetDate = lastRun && !isNaN(new Date(lastRun).getTime())
            ? new Date(lastRun)
            : new Date(0)

        const periodInMs = periodInMinutes * 60 * 1000 // Convert minutes to milliseconds
        const now = new Date()
        // console.log('diff ->', targetDate, now,now.getTime() - targetDate.getTime())

        const dataExists = await stat(this.ipRangesFilePath).catch(() => false).then(() => true)

        // console.log('checking for data freshness ->', periodInMinutes, dataExists, now.getTime(), targetDate.getTime(), now.getTime() - targetDate.getTime(), periodInMs)
        if (!dataExists || now.getTime() - targetDate.getTime() >= periodInMs) {
            await this.loader(onlyMissingFiles)

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

export async function cloudLoader(
    key: string,
    ipRangesFilePath: string,
    exchangeRatesFilePath: string,
    {downloadHostURL, onlyMissingFiles}: {downloadHostURL?: string, onlyMissingFiles?: boolean}
) {
    console.log(`Checking database integrity`)
    downloadHostURL = downloadHostURL ?? 'https://wl540c5jbf.execute-api.eu-central-1.amazonaws.com/production'

    try {
        const url = `${downloadHostURL}/ip-data-download-url?key=${encodeURIComponent(key)}`

        const downloadUrlResponse = await fetch(url, {cache: 'no-cache'})

        if (!downloadUrlResponse.ok) {
            throw new Error(`Failed to get download URL: ${downloadUrlResponse.statusText} - ${await downloadUrlResponse.text()}`)
        }

        if (downloadUrlResponse.body === null) {
            throw new Error('Download URL: Response body is null')
        }

        const {databases} = await downloadUrlResponse.json()


        const downloadIpDatabaseToo = !onlyMissingFiles

        if (downloadIpDatabaseToo || databases['exchange-rates']) {
            console.log(`Updating the database. It may take a few seconds...`)
        }

        const [ipResponse, exchangeRatesResponse] = await Promise.all([
            downloadIpDatabaseToo ? fetch(databases.ip, {cache: 'no-cache'}) : undefined,
            databases['exchange-rates'] ? fetch(databases['exchange-rates'], {cache: 'no-cache'}) : undefined,
        ])

        if (ipResponse && !ipResponse?.ok) {
            throw new Error(`Failed to download the IP Database file: ${ipResponse.statusText} - ${await ipResponse.text()}`)
        }

        if (databases['exchange-rates'] && !exchangeRatesResponse?.ok) {
            throw new Error(`Failed to download the Exchange Database file: ${exchangeRatesResponse?.statusText} - ${await exchangeRatesResponse?.text()}`)
        }

        if (databases['exchange-rates'] && exchangeRatesResponse?.body === null) {
            throw new Error('Exchange Rates Database is empty')
        }

        await Promise.all([
            downloadIpDatabaseToo && ipResponse ? saveFile(ipResponse, ipRangesFilePath) : undefined,
            databases['exchange-rates'] ? saveFile(exchangeRatesResponse as Response, exchangeRatesFilePath) : undefined,
        ])

        if (downloadIpDatabaseToo || databases['exchange-rates']) {
            console.log(`✅ Database updated successfully. Feel free to use the service.`)
        } else {
            console.log(`✅ Database is up to date. Feel free to use the service.`)
        }
    } catch (error) {
        console.error('Error downloading file:', error)
        throw error
    }
}

async function saveFile(response: Response, filePath: string) {
    const readableStream = new Readable()
    readableStream._read = () => {} // _read is required but you can noop it

    // @ts-ignore: TypeScript doesn't recognize the pipeTo method
    await response.body.pipeTo(new WritableStream({
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
}

import fs from 'node:fs/promises'
import type { IPGeoPulse, IPRecord } from './types.js'
import currencies from './country-data.json' assert { type: 'json' }

export async function readData(filePath: string): Promise<any | undefined> {
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8')
        return JSON.parse(fileContent)
    } catch (error) {
        return undefined
    }
}

export async function loadData(loader: () => void) {
    await loader()
    //
    // return readData(filePath)
}

function findCurrency(country: string) {
    return currencies.find(currency => currency.countryCode === country)
}

//////////////////////////////////////////////////////////////
export function ipToNumber(ip: string): number {
    return ip.split('.').reduce((int, octet) => (int << 8) + parseInt(octet, 10), 0) >>> 0
}

export function findIPData(ip: string, records: IPRecord[]): IPGeoPulse | undefined {
    const ipRecord = records.find(record => isIPInRange(ip, record.start, record.end))

    if (!ipRecord) {
        return undefined
    }

    const ipGeoPulse: IPGeoPulse = {
        ip,
    }

    const countryData = findCurrency(ipRecord.country)

    if (countryData) {
        ipGeoPulse.country = {
            code: countryData.countryCode,
            name: countryData.countryName,
            capital: countryData.capital,
            continentName: countryData.continentName,
        }

        ipGeoPulse.currency = {
            code: countryData.currencyCode,
            name: 'coming soon',
            symbol: 'coming soon'
        }
    }

    return ipGeoPulse
}

// Check if an IP belongs to a range
export function isIPInRange(ip: string, rangeStart: string, rangeEnd: string): boolean {
    const ipNum = ipToNumber(ip)
    const startNum = ipToNumber(rangeStart)
    const endNum = ipToNumber(rangeEnd)
    return ipNum >= startNum && ipNum <= endNum
}

import fs from 'node:fs/promises'
import type { IPGeoPulse, IPRecord } from './types.js'
import currencies from './countries.json' assert { type: 'json' }

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
    let ipRecord = records.find(record => {
        if (ip.includes(':') && record.start.includes(':')) {
            return isIPv6InRange(ip, record.start, record.end)
        }

        if (ip.includes('.') && record.start.includes('.')) {
            return isIPv4InRange(ip, record.start, record.end)
        }
    })

    if (!ipRecord) {
        return undefined
    }

    const ipGeoPulse: IPGeoPulse = {
        ip,
    }

    const countryData = findCurrency(ipRecord.country)

    if (!countryData) {
        return undefined
    }

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

export function isIPv4InRange(ip: string, rangeStart: string, rangeEnd: string): boolean {
    const ipNum = ipToNumber(ip)
    const startNum = ipToNumber(rangeStart)
    const endNum = ipToNumber(rangeEnd)
    return ipNum >= startNum && ipNum <= endNum
}

export function isIPv6InRange(ip: string, rangeStart: string, rangeEnd: string): boolean {
    const ipBigInt = ipv6ToBigInt(ip)
    const startBigInt = ipv6ToBigInt(rangeStart)
    const endBigInt = ipv6ToBigInt(rangeEnd)
    return ipBigInt >= startBigInt && ipBigInt <= endBigInt
}

function ipv6ToBigInt(ipv6: string): bigint {
    const segments = ipv6.split(':')
    let fullSegments: string[] = []

    // Handle "::" abbreviation in IPv6 by filling missing segments with '0000'
    let foundEmpty = false
    for(let i = 0; i < segments.length; i++) {
        const item = segments[i]
        if (item === '' && !foundEmpty) {
            const missingSegmentsCount = 8 - (segments.length - 1)
            fullSegments = [...fullSegments, ...new Array(missingSegmentsCount).fill('0000')]
            foundEmpty = true
        } else if (item) {
            fullSegments.push(item.padStart(4, '0'))
        }
    }

    // If no "::" is found and segments are less than 8, add missing zeroes at the end
    if (!foundEmpty && fullSegments.length < 8) {
        const missingSegmentsCount = 8 - fullSegments.length
        fullSegments = [...fullSegments, ...new Array(missingSegmentsCount).fill('0000')]
    }

    const ipv6HexString = fullSegments.join('')
    return BigInt(`0x${ipv6HexString}`)
}

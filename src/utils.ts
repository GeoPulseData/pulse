import fs from 'node:fs/promises'
import type { IPGeoPulse, IPRecord, IPv4Record, IPv6Record } from './types.js'
import currencies from './countries.json' with { type: 'json' }

const currencyMap = new Map(currencies.map(c => [c.countryCode, c]))

export async function readData<T>(filePath: string): Promise<T | undefined> {
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8')
        return JSON.parse(fileContent)
    } catch (error) {
        return undefined
    }
}

//////////////////////////////////////////////////////////////
export function ipToNumber(ip: string): number {
    return ip.split('.').reduce((int, octet) => (int << 8) + parseInt(octet, 10), 0) >>> 0
}

export function optimizeRecords(records: IPRecord[]) {
    const v4Records: IPv4Record[] = []
    const v6Records: IPv6Record[] = []

    for(const record of records) {
        if (record.start.includes('.')) {
            v4Records.push({
                ...record,
                startNum: ipToNumber(record.start),
                endNum: ipToNumber(record.end)
            })
        } else if (record.start.includes(':')) {
            v6Records.push({
                ...record,
                startNum: ipv6ToBigInt(record.start),
                endNum: ipv6ToBigInt(record.end)
            })
        }
    }

    // Sort records by start range
    return {
        v4: v4Records.sort((a, b) => a.startNum - b.startNum),
        v6: v6Records.sort((a, b) => (a.startNum < b.startNum ? -1 : a.startNum > b.startNum ? 1 : 0)),
    }
}

export function findIPData(ip: string, records: {v4: IPv4Record[], v6: IPv6Record[]}): IPGeoPulse | undefined {
    let ipRecord: IPRecord | undefined

    if (ip.includes('.')) {
        const ipNum = ipToNumber(ip)
        ipRecord = findIPv4Record(ipNum, records.v4)
    } else if (ip.includes(':')) {
        const ipNum = ipv6ToBigInt(ip)
        ipRecord = findIPv6Record(ipNum, records.v6)
    }

    if (!ipRecord) {
        return undefined
    }

    const countryData = currencyMap.get(ipRecord.country)
    if (!countryData) {
        return undefined
    }

    return {
        ip,
        country: {
            code: countryData.countryCode,
            name: countryData.countryName,
            capital: countryData.capital,
            continentName: countryData.continentName,
        },
        currency: {
            code: countryData.currencyCode,
            name: 'coming soon',
            symbol: 'coming soon'
        }
    }
}

function findIPv4Record(ipNum: number, records: IPv4Record[]): IPRecord | undefined {
    let left = 0
    let right = records.length - 1

    while (left <= right) {
        const mid = Math.floor((left + right) / 2)
        const record = records[mid] as IPv4Record

        if (ipNum >= record.startNum && ipNum <= record.endNum) {
            return record
        }

        if (ipNum < record.startNum) {
            right = mid - 1
        } else {
            left = mid + 1
        }
    }

    return undefined
}

function findIPv6Record(ipNum: bigint, records: IPv6Record[]): IPRecord | undefined {
    let left = 0
    let right = records.length - 1

    while (left <= right) {
        const mid = Math.floor((left + right) / 2)
        const record = records[mid] as IPv6Record

        if (ipNum >= record.startNum && ipNum <= record.endNum) {
            return record
        }

        if (ipNum < record.startNum) {
            right = mid - 1
        } else {
            left = mid + 1
        }
    }

    return undefined
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

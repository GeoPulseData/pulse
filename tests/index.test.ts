import { describe, expect, test } from 'vitest'
import { findIPData, ipToNumber, optimizeRecords, readData } from '../src/utils.js'
import { access, cp, rm } from 'node:fs/promises'
import { constants } from 'node:fs'
import { GeoPulse } from '../src/index.js'
import type { IPRecord } from '../src/types.js'

const ipRangesPath = './tests/demo-ip-ranges.json'

describe('reads ip data', () => {
    test('tries to read the data and returns undefined if it does not exist', async () => {
        expect(await readData('./test-ranges.json')).toBe(undefined)
    })

    test('loads a fresh set of data', async () => {
        const loader = () => cp(ipRangesPath, './tests/ip-ranges.json')

        const geoPulse = new GeoPulse('TEST API KEY', {
            baseDirectory: './tests',
            loader
        })
        await new Promise(resolve => setTimeout(resolve, 500)) // waiting for files to be written

        expect(
            await access('./tests/ip-ranges.json', constants.F_OK)
                .then(() => true)
                .catch(() => false)
        ).toBe(true)

        expect(
            await access('./tests/ip-ranges.meta.json', constants.F_OK)
                .then(() => true)
                .catch(() => false)
        ).toBe(true)

        const ipRanges = optimizeRecords(await readData<IPRecord[]>('./tests/ip-ranges.json') ?? [])
        expect(ipRanges.v4).toBeInstanceOf(Array)
        expect(ipRanges.v6).toBeInstanceOf(Array)
        expect(ipRanges.v4).toHaveLength(1)
        expect(ipRanges.v4[0]).toEqual({
            country: 'RO',
            start: '80.65.220.0',
            end: '80.65.223.255',
            startNum: ipToNumber('80.65.220.0'),
            endNum: ipToNumber('80.65.223.255'),
        })

        await rm(geoPulse.dataFilenamePath, {force: true})
        await rm(geoPulse.metaDataFilenamePath, {force: true})
    })

    test('find the ip data', async () => {
        const ipRanges = optimizeRecords(await readData<IPRecord[]>(ipRangesPath) ?? [])
        const ip = '80.65.220.23'
        console.time('t')
        const ipData = findIPData(ip, ipRanges)
        console.timeEnd('t')
        expect(ipData).toEqual({
            ip,
            "city": "coming soon",
            'country': {
                'capital': 'Bucharest',
                'code': 'RO',
                "callingCode": "coming soon",
                'flag': {
                    'emoji': 'coming soon',
                    'svg': 'coming soon',
                },
                'is_eu_member': 'coming soon',
                'name': 'Romania',
            },
            'continent': {
                "code": "coming soon",
                name: 'Europe'
            },
            'currency': {
                'code': 'RON',
                'name': 'coming soon',
                "exchangeRate": "coming soon",
                'symbol': 'coming soon',
            },
            'isMobile': 'coming soon',
            'language': {
                'code': 'coming soon',
                'name': 'coming soon',
            },
            'latitude': 'coming soon',
            'longitude': 'coming soon',
            'state': 'coming soon',
            'timeZone': {
                'localTime': 'coming soon',
                'localTimeUnix': 'coming soon',
                'name': 'coming soon',
            },
            'zip': 'coming soon',
        })
    })

    // test('ip data info', async () => {
    //     const loader = () => cp('../ip-ranges.json', 'ip-ranges.json')
    //     const geoPulse = new GeoPulse('762eddc3-445c-45e0-8ebb-84a68ce8e760', {loader})
    //     // await geoPulse.schedule()
    //     // const ip = '80.65.220.23'
    //     const ip = '84.232.193.5'
    //     // const ip = '193.231.40.5'
    //     // const ip = '2a02:2f0d:2000:e800:2c6b:d2e3:23be:94f2'
    //     const info = await geoPulse.lookup(ip)
    //     console.log('info ->', info)
    // }, {timeout: 60000000})

})

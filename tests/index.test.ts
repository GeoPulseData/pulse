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
            'country': {
                'capital': 'Bucharest',
                'code': 'RO',
                'continentName': 'Europe',
                'name': 'Romania',
            },
            'currency': {
                'code': 'RON',
                'name': 'coming soon',
                'symbol': 'coming soon',
            },
        })
    })

    // test('ip data info', async () => {
    //     const localLoader = () => cp(ipRangesPath, './tests/new-demo-ip-ranges.json')
    //     const geoPulse = new GeoPulse('762eddc3-445c-45e0-8ebb-84a68ce8e760', localLoader)
    //     // await geoPulse.schedule()
    //     const ip = '80.65.220.23'
    //     // const ip = '2a02:2f0d:2000:e800:2c6b:d2e3:23be:94f2'
    //     const info = await geoPulse.lookup(ip)
    //     console.log('info ->', info)
    // }, {timeout: 60000000})

})

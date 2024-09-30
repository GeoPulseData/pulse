import { expect, test } from 'vitest'
import { findIPData, loadData, readData } from '../src/utils.js'
import fs, { access, unlink } from 'node:fs/promises'
import { constants } from 'node:fs'

const ipRangesPath = './tests/test-ip-ranges.json'

test('tries to read the data and returns undefined if it does not exist', async () => {
    expect(await readData('./test-ranges.json')).toBe(undefined)
})

test('loads a fresh set of data', async () => {
    const localLoader = () => fs.cp(ipRangesPath, './tests/new-test-ip-ranges.json')
    await loadData(localLoader)

    expect(
        await access('./tests/new-test-ip-ranges.json', constants.F_OK)
            .then(() => true)
            .catch(() => false)
    ).toBe(true)

    const ipRanges = await readData('./tests/new-test-ip-ranges.json')
    expect(ipRanges).toBeInstanceOf(Array)
    expect(ipRanges).toHaveLength(1)
    expect(ipRanges[0]).toEqual({
        country: 'RO',
        start: '80.65.220.0',
        end: '80.65.223.255'
    })

    await unlink('./tests/new-test-ip-ranges.json')
})

test('find the ip data', async () => {
    const ipRanges = await readData(ipRangesPath)
    const ip = '80.65.220.23'
    expect(findIPData(ip, ipRanges)).toEqual({
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

import { afterAll, beforeEach, describe, expect, test } from 'vitest'
import { ipToNumber, optimizeRecords, readData } from '../src/utils.js'
import { access, cp, rm } from 'node:fs/promises'
import { constants } from 'node:fs'
import { GeoPulse } from '../src/index.js'
import type { IPRecord } from '../src/types.js'
import countries from '../src/countries.json' with { type: 'json' }

const ipRangesPath = './tests/data/ip-ranges.json'
const currenciesPath = './tests/data/currency-rates.json'

describe('reads ip data', () => {
    test('tries to read the data and returns undefined if it does not exist', async () => {
        expect(await readData('./test-ranges.json')).toBe(undefined)
    })

    test('loads a fresh set of data', async () => {
        const loader = async () => {
            await cp(ipRangesPath, './tests/ip-ranges.json')
            await cp(currenciesPath, './tests/currency-rates.json')
        }

        const geoPulse = new GeoPulse('TEST API KEY', {
            baseDirectory: './tests',
            loader
        })
        await geoPulse.init()

        expect(
            await access('./tests/ip-ranges.json', constants.F_OK)
                .then(() => true)
                .catch(() => false)
        ).toBe(true)
        expect(
            await access('./tests/currency-rates.json', constants.F_OK)
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

        const currencyRates = await readData<Record<string, number>>('./tests/currency-rates.json') ?? []
        expect(currencyRates).toHaveProperty('EUR')
        expect(currencyRates).toHaveProperty('USD')
        expect(currencyRates).toHaveProperty('RON')

        await rm(geoPulse.ipRangesFilePath, {force: true})
        await rm(geoPulse.currencyRatesFilePath, {force: true})
        await rm(geoPulse.metaDataFilenamePath, {force: true})
    })

    test('find the ip data', async () => {
        const loader = () => {
            cp(ipRangesPath, './tests/ip-ranges.json')
            cp(currenciesPath, './tests/currency-rates.json')
        }

        const geoPulse = new GeoPulse('TEST API KEY', {
            baseDirectory: './tests',
            loader
        })
        await geoPulse.init()

        // const ipRanges = optimizeRecords(await readData<IPRecord[]>(ipRangesPath) ?? [])
        const ip = '80.65.220.23'
        console.time('t')
        const ipData = await geoPulse.lookup(ip)
        console.timeEnd('t')
        expect(ipData).toEqual({
            ip,
            latitude: 'coming soon',
            longitude: 'coming soon',
            isMobile: 'coming soon',
            city: 'coming soon',
            state: 'coming soon',
            zip: 'coming soon',
            exchangeRateBaseCurrency: 'USD',
            exchangeRate: 4.83249,
            country: {
                name: 'Romania',
                code: 'RO',
                capital: 'Bucharest',
                callingCode: '+40',
                isEUMember: true,
                currency: {
                    code: 'RON',
                    name: 'Romanian leu',
                    symbol: 'lei'
                },
                flag: {
                    png: 'https://flagcdn.com/w320/ro.png',
                    svg: 'https://flagcdn.com/ro.svg',
                    emoji: '🇷🇴'
                },
                continent: {
                    name: 'Europe',
                    code: ''
                },
                language: {
                    name: 'Romanian',
                    code: 'ron'
                }
            },
            timeZone: {
                localTime: 'coming soon',
                localTimeUnix: 'coming soon',
                name: 'coming soon',
            },
        })

        await rm(geoPulse.ipRangesFilePath, {force: true})
        await rm(geoPulse.currencyRatesFilePath, {force: true})
        await rm(geoPulse.metaDataFilenamePath, {force: true})
    })

    // test('ip data info', async () => {
    //     const geoPulse = new GeoPulse('45bcf6ed-457f-4002-b474-f730a18f803c')
    //     await geoPulse.init()
    //     // await geoPulse.schedule()
    //     // const ip = '80.65.220.23'
    //     const ip = '84.232.193.5'
    //     // const ip = '193.231.40.5'
    //     // const ip = '2a02:2f0d:2000:e800:2c6b:d2e3:23be:94f2'
    //     const info = await geoPulse.lookup(ip)
    //     console.log('info ->', info)
    // }, {timeout: 60000000})
})

describe('exchange rate', () => {
    let geoPulse: GeoPulse
    let allExchangeRates: Record<string, number>
    beforeEach(async () => {
        const loader = () => {
            cp(ipRangesPath, './tests/ip-ranges.json')
            cp(currenciesPath, './tests/currency-rates.json')
        }

        geoPulse = new GeoPulse('TEST API KEY', {
            baseDirectory: './tests',
            loader
        })
        await geoPulse.init()
        allExchangeRates = (await readData('./tests/currency-rates.json')) as Record<string, number>
    })

    test('shows all exchange rates in EUR', async () => {
        const exchangeRates = await geoPulse.exchangeRates('EUR')

        expect(exchangeRates).toEqual(allExchangeRates)
    })

    test('shows all exchange rates in default base currency: USD', async () => {
        const baseCurrencyRate = (allExchangeRates.EUR as number) / (allExchangeRates.USD as number)
        const exchangeRates = await geoPulse.exchangeRates()

        const USDBasedExchangeRates: Record<string, number> = {}
        Object.keys(allExchangeRates).forEach(currencyCode => {
            USDBasedExchangeRates[currencyCode] = (allExchangeRates[currencyCode] as number) * baseCurrencyRate
        })
        expect(exchangeRates).toEqual(USDBasedExchangeRates)
    })

    test('shows all exchange rates in some random currency: RON', async () => {
        const baseCurrencyRate = (allExchangeRates.EUR as number) / (allExchangeRates.RON as number)
        const exchangeRates = await geoPulse.exchangeRates('RON')

        const USDBasedExchangeRates: Record<string, number> = {}
        Object.keys(allExchangeRates).forEach(currencyCode => {
            USDBasedExchangeRates[currencyCode] = (allExchangeRates[currencyCode] as number) * baseCurrencyRate
        })
        expect(exchangeRates).toEqual(USDBasedExchangeRates)
    })
})

describe('countries', () => {
    let geoPulse = new GeoPulse('')
    let allCountries = countries

    test('shows all countries', async () => {
        const countries = geoPulse.countries()

        expect(countries).toEqual(allCountries)
    })

    test('shows all countries mapped by country code', async () => {
        const countries = geoPulse.countriesMappedByCode()

        expect(countries).toEqual(new Map(allCountries.map(c => [c.code, c])))
    })

    test('returns info about one country', async () => {
        const unitedStates = geoPulse.country('US')

        expect(unitedStates).toEqual(allCountries.find(country => country.code === 'US'))
    })

    afterAll(async () => {

        await rm(geoPulse.ipRangesFilePath, {force: true})
        await rm(geoPulse.currencyRatesFilePath, {force: true})
        await rm(geoPulse.metaDataFilenamePath, {force: true})
    })
})

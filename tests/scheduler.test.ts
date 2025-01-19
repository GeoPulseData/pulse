import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { GeoPulse, localLoader } from '../src/index.js'

const ipRangesPath = './tests/data/ip-ranges.json'
// Helper function to mock file existence with content
const mockFile = async (path: string, content: any) => {
    await writeFile(path, JSON.stringify(content), 'utf-8')
}

async function getGeoPulseInstance(autoUpdateMinutes?: number) {
    const loader = vi.fn(() => {
        console.log('loading data ->',)
        return localLoader(ipRangesPath, `./tests/ip-ranges.json`)
    })

    const instance =  new GeoPulse('TEST API KEY', {
        baseDirectory: './tests',
        ...autoUpdateMinutes ? {autoUpdate: true, autoUpdateMinutes: autoUpdateMinutes as number} : {autoUpdate: false},
        loader
    })
    await instance.init()
    return instance
}

describe('GeoPulse autoUpdate', async () => {

    const geoPulse = await getGeoPulseInstance()

    beforeAll(async () => {
        await rm(geoPulse.ipRangesFilePath, {force: true})
        await rm(geoPulse.currencyRatesFilePath, {force: true})
        await rm(geoPulse.metaDataFilenamePath, {force: true})
    })

    afterEach(async () => {
        await rm(geoPulse.ipRangesFilePath, {force: true})
        await rm(geoPulse.currencyRatesFilePath, {force: true})
        await rm(geoPulse.metaDataFilenamePath, {force: true})
    })

    it('should run the task immediately if the target date is in the past and the difference is larger than the period', async () => {
        const periodInMinutes = 60 * 24 // 24 hours
        const geoPulse = await getGeoPulseInstance(periodInMinutes)

        await new Promise(resolve => setTimeout(resolve, 500))

        expect(geoPulse.loader).toHaveBeenCalled() // Task should run immediately
        const metaData = JSON.parse(await readFile(geoPulse.metaDataFilenamePath, 'utf8'))
        expect(new Date(metaData.lastRun)).toBeInstanceOf(Date)
    })

    it('should run the task immediately if the target date is in the past and the difference is smaller than the period AND the data file does NOT exists', async () => {
        const periodInMinutes = 60 // 1 hour

        const geoPulse = await getGeoPulseInstance(periodInMinutes)
        await mockFile(geoPulse.metaDataFilenamePath, {lastRun: new Date(Date.now() - 10 * 60 * 1000).toISOString()}) // 10 minutes ago

        expect(geoPulse.loader).toHaveBeenCalled() // Task should not run immediately
    })

    it('should NOT run the task immediately if the target date is in the past and the difference is smaller than the period AND the data file EXISTS', async () => {
        const dummyGeoPulse = await getGeoPulseInstance()
        // Create a demo instance just so it creates the metadata file.
        // This file will be read by the geoPulse instance belo
        await mockFile(dummyGeoPulse.ipRangesFilePath, [])
        await mockFile(dummyGeoPulse.metaDataFilenamePath, {lastRun: new Date(Date.now() - 10 * 60 * 1000).toISOString()}) // 10 minutes ago

        const periodInMinutes = 60 // 1 hour
        const geoPulse = await getGeoPulseInstance(periodInMinutes)

        await new Promise(resolve => setTimeout(resolve, 500))
        expect(geoPulse.loader).not.toHaveBeenCalled() // Task should not run immediately
    })

    it('should schedule the task to run after the initial delay and then repeat every period', async () => {
        vi.useFakeTimers({shouldAdvanceTime: true}) // Use fake timers to simulate the passage of time

        const periodInMinutes = 1
        const geoPulse = await getGeoPulseInstance(periodInMinutes)

        await new Promise(resolve => setTimeout(resolve, 500))


        expect(geoPulse.loader).toHaveBeenCalled() // Task should run after 10 minutes

        vi.advanceTimersByTime(periodInMinutes * 60 * 2000) // Simulate time passing
        // vi.useRealTimers() // Restore real timers
        await new Promise(resolve => setTimeout(resolve, 500))

        expect(geoPulse.loader).toHaveBeenCalledTimes(2) // Task should run again after 1 minute

    })
})

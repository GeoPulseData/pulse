import { afterEach, describe, expect, it, vi,beforeAll } from 'vitest'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { GeoPulse, localLoader } from '../src/index.js'

// Helper function to mock file existence with content
const mockFile = async (path: string, content: any) => {
    await writeFile(path, JSON.stringify(content), 'utf-8')
}

function getGeoPulseInstance() {
    const loader = vi.fn(() => {
        console.log('loading data ->', )
        return localLoader('./tests/demo-ip-ranges.json', `./tests/ip-ranges.json`)
    })

    return new GeoPulse('TEST API KEY', {
        baseDirectory: './tests',
        loader
    })
}

describe('GeoPulse autoUpdate', () => {

    const geoPulse = getGeoPulseInstance()

    beforeAll(async () => {
        // Mock initial test setup (ensure the test directory and files exist)
        // await mockFile(geoPulse.dataFilenamePath, [{ range: '192.168.0.1/24', country: 'US' }])
        // await mockFile(geoPulse.metaDataFilenamePath, { lastRun: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() }) // 2 days ago
        await rm(geoPulse.dataFilenamePath, {force: true})
        await rm(geoPulse.metaDataFilenamePath, {force: true})
    })

    afterEach(async () => {
        // Cleanup any test data after each test
        await rm(geoPulse.dataFilenamePath, {force: true})
        await rm(geoPulse.metaDataFilenamePath, {force: true})
    })

    it('should run the task immediately if the target date is in the past and the difference is larger than the period', async () => {

        const geoPulse = getGeoPulseInstance()

        const periodInMinutes = 60 * 24 // 24 hours

        await geoPulse.autoUpdate(periodInMinutes)

        expect(geoPulse.loader).toHaveBeenCalled() // Task should run immediately
        const metaData = JSON.parse(await readFile(geoPulse.metaDataFilenamePath, 'utf8'))
        expect(new Date(metaData.lastRun)).toBeInstanceOf(Date) // Ensure lastRun is updated
    })

    it('should run the task immediately if the target date is in the past and the difference is smaller than the period AND the data file does NOT exists', async () => {
        const geoPulse = getGeoPulseInstance()
        await mockFile(geoPulse.metaDataFilenamePath, {lastRun: new Date(Date.now() - 10 * 60 * 1000).toISOString()}) // 10 minutes ago
        const periodInMinutes = 60 // 1 hour

        await geoPulse.autoUpdate(periodInMinutes)

        expect(geoPulse.loader).toHaveBeenCalled() // Task should not run immediately
    })

    it('should NOT run the task immediately if the target date is in the past and the difference is smaller than the period AND the data file EXISTS', async () => {
        const geoPulse = getGeoPulseInstance()
        await mockFile(geoPulse.dataFilenamePath, [])
        await mockFile(geoPulse.metaDataFilenamePath, {lastRun: new Date(Date.now() - 10 * 60 * 1000).toISOString()}) // 10 minutes ago
        const periodInMinutes = 60 // 1 hour

        await geoPulse.autoUpdate(periodInMinutes)

        expect(geoPulse.loader).not.toHaveBeenCalled() // Task should not run immediately
    })

    it('should schedule the task to run after the initial delay and then repeat every period', async () => {
        const geoPulse = getGeoPulseInstance()
        const periodInMinutes = 1.2

        vi.useFakeTimers({shouldAdvanceTime: true}) // Use fake timers to simulate the passage of time

        await geoPulse.autoUpdate(periodInMinutes)
        expect(geoPulse.loader).toHaveBeenCalled() // Task should run after 10 minutes

        vi.advanceTimersByTime(periodInMinutes * 60 * 1000) // Simulate time passing

        await new Promise(resolve => setTimeout(resolve, 500))

        expect(geoPulse.loader).toHaveBeenCalledTimes(2) // Task should run again after 1 minute

        vi.useRealTimers() // Restore real timers
    })

    it('should handle the case where the target date is exactly at the present moment', async () => {
        const geoPulse = getGeoPulseInstance()
        await mockFile(geoPulse.dataFilenamePath, [])
        await mockFile(geoPulse.metaDataFilenamePath, {lastRun: new Date().toISOString()}) // Now
        const periodInMinutes = 60 // 1 hour

        await geoPulse.autoUpdate(periodInMinutes)

        expect(geoPulse.loader).not.toHaveBeenCalled() // Task should not run immediately if exactly now
    })
})

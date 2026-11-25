import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getInput, setFailed } from '@actions/core'
import { vol } from 'memfs'
import { Build } from '../lib/build'
import { magentoReindex } from '../lib/magento'
import { run } from './main'

vi.mock('node:fs')
vi.mock('node:fs/promises')
vi.mock('node:process', () => ({
    cwd: vi.fn().mockReturnValue('/tmp'),
    env: {},
}))

vi.mock('@actions/core', () => ({
    getInput: vi.fn(),
    setFailed: vi.fn(),
    group: vi.fn(async (_name: string, fn: () => Promise<any>) => fn()),
}))

vi.mock('../lib/magento', () => ({
    magentoReindex: vi.fn(),
}))

beforeEach(() => {
    vol.reset()
    vol.mkdirSync('/tmp', { recursive: true })
})

afterEach(() => {
    vi.clearAllMocks()
})

describe('build-reindex', () => {
    it('loads build config and reindexes magento', async () => {
        const build = new Build({
            dockerCompose: {
                phpVersion: '8.4',
                mariaDbVersion: '11.8',
                composerAuth: '{}',
            },
            name: '2.4.9',
        })
        const configFile = await build.save()
        vi.mocked(getInput).mockReturnValue(configFile)

        await run()

        expect(setFailed).not.toHaveBeenCalled()
        expect(magentoReindex).toHaveBeenCalledWith(build.docker)
    })

    it('sets failed when config file is invalid', async () => {
        vi.mocked(getInput).mockReturnValue('invalid')

        await run()

        expect(setFailed).toHaveBeenCalledWith('Build configuration file is invalid')
    })
})

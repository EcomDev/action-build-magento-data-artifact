import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getInput, setFailed } from '@actions/core'
import { vol } from 'memfs'
import { Build } from '../lib/build'
import { magentoSetupInstall } from '../lib/magento'
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

vi.mock('../lib/magento', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../lib/magento')>()
    return {
        ...actual,
        magentoSetupInstall: vi.fn(),
    }
})

beforeEach(() => {
    vol.reset()
    vol.mkdirSync('/tmp', { recursive: true })
})

afterEach(() => {
    vi.clearAllMocks()
})

describe('build-install', () => {
    it('loads build config and executes magentoSetupInstall', async () => {
        const build = new Build({
            dockerCompose: {
                phpVersion: '8.4',
                mariaDbVersion: '11.8',
                composerAuth: '{}',
            },
            name: '2.4.9',
        })
        const configFile = await build.save()

        const inputs: Record<string, string> = {
            'config-file': configFile,
            'magento-version': '2.4.9',
            settings: '{"catalog/price/scope":"1"}',
            'install-arguments': '{"currency":"EUR"}',
        }
        vi.mocked(getInput).mockImplementation((name) => inputs[name] ?? '')

        await run()

        expect(setFailed).not.toHaveBeenCalled()
        expect(magentoSetupInstall).toHaveBeenCalledWith(build.docker, {
            version: '2.4.9',
            settings: { 'catalog/price/scope': '1' },
            installArguments: { currency: 'EUR' },
        })
    })

    it('sets failed when settings JSON is malformed', async () => {
        const build = new Build({
            dockerCompose: {
                phpVersion: '8.4',
                mariaDbVersion: '11.8',
                composerAuth: '{}',
            },
            name: '2.4.9',
        })
        const configFile = await build.save()

        const inputs: Record<string, string> = {
            'config-file': configFile,
            'magento-version': '2.4.9',
            settings: 'invalid-json',
        }
        vi.mocked(getInput).mockImplementation((name) => inputs[name] ?? '')

        await run()

        expect(setFailed).toHaveBeenCalledWith('Value for settings is invalid JSON')
    })
})

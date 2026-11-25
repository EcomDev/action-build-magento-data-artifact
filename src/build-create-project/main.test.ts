import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getBooleanInput, getInput, setFailed } from '@actions/core'
import { vol } from 'memfs'
import { Build } from '../lib/build'
import { createComposerProject } from '../lib/magento'
import { BuildCache, ComposerCache } from '../lib/cache'
import { run } from './main'

vi.mock('node:fs')
vi.mock('node:fs/promises')
vi.mock('node:process', () => ({
    cwd: vi.fn().mockReturnValue('/tmp'),
    env: {},
}))

vi.mock('@actions/core', () => ({
    getInput: vi.fn(),
    getBooleanInput: vi.fn(),
    setFailed: vi.fn(),
    info: vi.fn(),
    group: vi.fn(async (_name: string, fn: () => Promise<any>) => fn()),
}))

vi.mock('../lib/magento', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../lib/magento')>()
    return {
        ...actual,
        createComposerProject: vi.fn(),
    }
})

beforeEach(() => {
    vol.reset()
    vol.mkdirSync('/tmp', { recursive: true })
    vi.spyOn(BuildCache.prototype, 'execute').mockImplementation(async (cb) => cb())
    vi.spyOn(ComposerCache.prototype, 'execute').mockImplementation(async (cb) => cb())
})

afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
})

describe('build-create-project', () => {
    it('loads build config and creates composer project with caches', async () => {
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
            'meta-package': '',
            repository: '',
            stability: 'stable',
            'additional-packages': '{"vendor/pkg":"1.0.0"}',
        }
        const boolInputs: Record<string, boolean> = {
            'sample-data': true,
            'no-dev': true,
        }
        vi.mocked(getInput).mockImplementation((name) => inputs[name] ?? '')
        vi.mocked(getBooleanInput).mockImplementation((name) => boolInputs[name] ?? false)

        await run()

        expect(setFailed).not.toHaveBeenCalled()
        expect(createComposerProject).toHaveBeenCalledWith(build.docker, {
            version: '2.4.9',
            metaPackage: 'magento/project-community-edition',
            repository: 'https://mirror.mage-os.org/',
            sampleData: true,
            stability: 'stable',
            extraPackages: { 'vendor/pkg': '1.0.0' },
            noDev: true,
        })
    })

    it('sets failed when config file is invalid', async () => {
        vi.mocked(getInput).mockReturnValue('missing-file')

        await run()

        expect(setFailed).toHaveBeenCalledWith('Build configuration file is invalid')
    })
})

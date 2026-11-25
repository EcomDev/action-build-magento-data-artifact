import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getInput, getMultilineInput, setFailed } from '@actions/core'
import { vol } from 'memfs'
import { DockerCompose } from '../lib/docker'
import { Build } from '../lib/build'
import { run } from './main'

vi.mock('node:fs')
vi.mock('node:fs/promises')
vi.mock('node:process', () => ({
    cwd: vi.fn().mockReturnValue('/tmp'),
    env: {},
}))

vi.mock('@actions/core', () => ({
    getInput: vi.fn(),
    getMultilineInput: vi.fn(() => []),
    setFailed: vi.fn(),
    group: vi.fn(async (_name: string, fn: () => Promise<any>) => fn()),
}))

const execSpy = vi.spyOn(DockerCompose.prototype, 'exec')

beforeEach(() => {
    vol.reset()
    vol.mkdirSync('/tmp', { recursive: true })
    execSpy.mockResolvedValue(true)
})

afterEach(() => {
    vi.clearAllMocks()
})

describe('build-exec', () => {
    it('executes command in default magento container and filters empty arguments', async () => {
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
            command: 'bin/magento',
        }
        vi.mocked(getInput).mockImplementation((name) => inputs[name] ?? '')
        vi.mocked(getMultilineInput).mockReturnValue(['cache:clean', '', 'config'])

        await run()

        expect(setFailed).not.toHaveBeenCalled()
        expect(execSpy).toHaveBeenCalledWith('magento', 'bin/magento', ['cache:clean', 'config'], undefined)
    })

    it('supports custom container and user inputs', async () => {
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
            command: 'chown',
            container: 'magento',
            user: 'root',
        }
        vi.mocked(getInput).mockImplementation((name) => inputs[name] ?? '')
        vi.mocked(getMultilineInput).mockReturnValue(['-R', 'www-data:www-data', '/var/www/html'])

        await run()

        expect(setFailed).not.toHaveBeenCalled()
        expect(execSpy).toHaveBeenCalledWith('magento', 'chown', ['-R', 'www-data:www-data', '/var/www/html'], {
            user: 'root',
        })
    })

    it('sets failed when command execution fails', async () => {
        const build = new Build({
            dockerCompose: {
                phpVersion: '8.4',
                mariaDbVersion: '11.8',
                composerAuth: '{}',
            },
            name: '2.4.9',
        })
        const configFile = await build.save()

        vi.mocked(getInput).mockImplementation((name) => (name === 'config-file' ? configFile : 'bin/magento'))
        execSpy.mockRejectedValueOnce(new Error('Command failed'))

        await run()

        expect(setFailed).toHaveBeenCalledWith('Command failed')
    })
})

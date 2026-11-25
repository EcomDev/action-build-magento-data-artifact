import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getInput, getMultilineInput, getState, group, saveState, setFailed, setOutput } from '@actions/core'
import { vol } from 'memfs'
import { DockerCompose } from '../lib/docker'
import { Build } from '../lib/build'
import { run as runMain } from './main'
import { run as runPost } from './post'

vi.mock('node:fs')
vi.mock('node:fs/promises')
vi.mock('node:process', () => ({
    cwd: vi.fn().mockReturnValue('/tmp'),
    env: {},
}))

vi.mock('@actions/core', () => ({
    getInput: vi.fn(),
    getMultilineInput: vi.fn(() => []),
    getState: vi.fn(() => ''),
    saveState: vi.fn(),
    setOutput: vi.fn(),
    setFailed: vi.fn(),
    setSecret: vi.fn(),
    info: vi.fn(),
    group: vi.fn(async (_name: string, fn: () => Promise<any>) => fn()),
}))

const upSpy = vi.spyOn(DockerCompose.prototype, 'up')
const downSpy = vi.spyOn(DockerCompose.prototype, 'down')

beforeEach(() => {
    vol.reset()
    vol.mkdirSync('/tmp', { recursive: true })
    upSpy.mockResolvedValue()
    downSpy.mockResolvedValue()
})

afterEach(() => {
    vi.clearAllMocks()
})

describe('build-init main', () => {
    it('saves build config, sets outputs/state, and starts docker environment', async () => {
        const inputs: Record<string, string> = {
            'mariadb-version': '11.8',
            'php-version': '8.4',
            'opensearch-version': '3.0',
            name: '2.4.9',
            auth: '{}',
            token: 'ghp_token',
        }
        vi.mocked(getInput).mockImplementation((name) => inputs[name] ?? '')
        vi.mocked(getMultilineInput).mockReturnValue(['docker/redis.yml', ''])

        await runMain()

        expect(setFailed).not.toHaveBeenCalled()
        expect(setOutput).toHaveBeenCalledWith('config-file', expect.stringMatching(/^build-[0-9a-f-]{36}$/))
        const savedFile = vi.mocked(setOutput).mock.calls[0][1] as string
        expect(saveState).toHaveBeenCalledWith('config-file', savedFile)
        expect(upSpy).toHaveBeenCalledOnce()

        const loaded = await Build.load(savedFile)
        expect(loaded.name).toBe('2.4.9')
        expect(loaded.docker.config.opensearchVersion).toBe('3.0')
        expect(loaded.docker.config.extraConfigFiles).toEqual(['docker/redis.yml'])
    })

    it('allows omitting optional opensearch-version', async () => {
        const inputs: Record<string, string> = {
            'mariadb-version': '11.8',
            'php-version': '8.4',
            name: '2.4.9-no-search',
        }
        vi.mocked(getInput).mockImplementation((name, options) => {
            if (options?.required && !inputs[name]) {
                throw new Error(`Input required and not supplied: ${name}`)
            }
            return inputs[name] ?? ''
        })
        vi.mocked(getMultilineInput).mockReturnValue([])

        await runMain()

        expect(setFailed).not.toHaveBeenCalled()
        const savedFile = vi.mocked(setOutput).mock.calls[0][1] as string
        const loaded = await Build.load(savedFile)
        expect(loaded.docker.config.opensearchVersion).toBeUndefined()
    })

    it('marks action failed when required input is missing', async () => {
        vi.mocked(getInput).mockImplementation((name, options) => {
            if (options?.required) {
                throw new Error(`Input required and not supplied: ${name}`)
            }
            return ''
        })

        await runMain()

        expect(setFailed).toHaveBeenCalledWith('Input required and not supplied: mariadb-version')
    })
})

describe('build-init post', () => {
    it('does nothing if config-file state is empty', async () => {
        vi.mocked(getState).mockReturnValue('')

        await runPost()

        expect(downSpy).not.toHaveBeenCalled()
        expect(setFailed).not.toHaveBeenCalled()
    })

    it('stops docker containers and removes config file', async () => {
        const build = new Build({
            dockerCompose: {
                phpVersion: '8.4',
                mariaDbVersion: '11.8',
                composerAuth: '{"secret":"value"}',
            },
            name: '2.4.9',
        })
        const configFile = await build.save()
        vi.mocked(getState).mockReturnValue(configFile)

        await runPost()

        expect(group).toHaveBeenCalledWith('Cleaning Docker Containers', expect.any(Function))
        expect(downSpy).toHaveBeenCalledOnce()
        expect(vol.existsSync(`/tmp/${configFile}`)).toBe(false)
        expect(setFailed).not.toHaveBeenCalled()
    })

    it('still removes config file and sets failed if docker down throws', async () => {
        const build = new Build({
            dockerCompose: {
                phpVersion: '8.4',
                mariaDbVersion: '11.8',
                composerAuth: '{}',
            },
            name: '2.4.9',
        })
        const configFile = await build.save()
        vi.mocked(getState).mockReturnValue(configFile)
        downSpy.mockRejectedValueOnce(new Error('docker down failed'))

        await runPost()

        expect(vol.existsSync(`/tmp/${configFile}`)).toBe(false)
        expect(setFailed).toHaveBeenCalledWith('docker down failed')
    })
})

describe('build-init index entrypoint', () => {
    it('runs main and saves build-init=true state on initial execution, then runs post on post execution', async () => {
        vi.resetModules()
        const runMainMock = vi.fn()
        const runPostMock = vi.fn()
        vi.doMock('./main', () => ({ run: runMainMock }))
        vi.doMock('./post', () => ({ run: runPostMock }))

        vi.mocked(getState).mockReturnValueOnce('')
        await import('./index')

        expect(saveState).toHaveBeenCalledWith('build-init', 'true')
        expect(runMainMock).toHaveBeenCalledOnce()
        expect(runPostMock).not.toHaveBeenCalled()

        vi.resetModules()
        vi.mocked(saveState).mockClear()
        runMainMock.mockClear()
        vi.mocked(getState).mockReturnValueOnce('true')
        await import('./index')

        expect(runPostMock).toHaveBeenCalledOnce()
        expect(runMainMock).not.toHaveBeenCalled()
    })
})

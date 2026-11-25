import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getInput, info, setFailed, setOutput } from '@actions/core'
import { vol } from 'memfs'
import { Build } from '../lib/build'
import { Artifact } from '../lib/artifact'
import { run } from './main'

vi.mock('node:fs')
vi.mock('node:fs/promises')
vi.mock('node:process', () => ({
    cwd: vi.fn().mockReturnValue('/tmp'),
    env: {},
}))

vi.mock('@actions/core', () => ({
    getInput: vi.fn(),
    info: vi.fn(),
    setFailed: vi.fn(),
    setOutput: vi.fn(),
    group: vi.fn(async (_name: string, fn: () => Promise<any>) => fn()),
}))

beforeEach(() => {
    vol.reset()
    vol.mkdirSync('/tmp', { recursive: true })
})

afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
})

describe('build-artifact', () => {
    it('uploads artifact using build name by default and sets outputs', async () => {
        const build = new Build({
            dockerCompose: {
                phpVersion: '8.4',
                mariaDbVersion: '11.8',
                composerAuth: '{}',
            },
            name: '2.4.9',
        })
        const configFile = await build.save()

        vi.mocked(getInput).mockImplementation((name) => (name === 'config-file' ? configFile : ''))
        const uploadSpy = vi.spyOn(Artifact.prototype, 'upload').mockResolvedValue({
            id: 42,
            size: 1024 * 1024 * 5,
            digest: 'sha256:abcdef',
        })

        await run()

        expect(uploadSpy).toHaveBeenCalledWith('2.4.9', expect.anything())
        expect(setOutput).toHaveBeenCalledWith('artifact-id', 42)
        expect(setOutput).toHaveBeenCalledWith('artifact-digest', 'sha256:abcdef')
        expect(info).toHaveBeenCalledWith('Uploaded artifact 2.4.9 with ID 42 and total size 5 MB')
        expect(setFailed).not.toHaveBeenCalled()
    })

    it('uses custom artifact name when provided', async () => {
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
            name: 'custom-artifact-name',
        }
        vi.mocked(getInput).mockImplementation((name) => inputs[name] ?? '')
        const uploadSpy = vi.spyOn(Artifact.prototype, 'upload').mockResolvedValue({
            id: 99,
            digest: 'sha256:123456',
        })

        await run()

        expect(uploadSpy).toHaveBeenCalledWith('custom-artifact-name', expect.anything())
        expect(setOutput).toHaveBeenCalledWith('artifact-id', 99)
        expect(setFailed).not.toHaveBeenCalled()
    })

    it('sets failed when upload returns no artifact id', async () => {
        const build = new Build({
            dockerCompose: {
                phpVersion: '8.4',
                mariaDbVersion: '11.8',
                composerAuth: '{}',
            },
            name: '2.4.9',
        })
        const configFile = await build.save()

        vi.mocked(getInput).mockImplementation((name) => (name === 'config-file' ? configFile : ''))
        vi.spyOn(Artifact.prototype, 'upload').mockResolvedValue({})

        await run()

        expect(setFailed).toHaveBeenCalledWith('Failed to upload artifact 2.4.9')
    })
})

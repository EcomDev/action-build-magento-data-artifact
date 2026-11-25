import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getInput, setFailed, setOutput } from '@actions/core'
import { env } from 'node:process'
import { vol } from 'memfs'
import { Build } from '../lib/build'
import { Artifact } from '../lib/artifact'
import { run } from './main'

vi.mock('node:fs')
vi.mock('node:fs/promises')
vi.mock('node:process', () => ({
    cwd: vi.fn().mockReturnValue('/tmp'),
    env: {
        GITHUB_ARTIFACTS: undefined,
    },
}))

vi.mock('@actions/core', () => ({
    getInput: vi.fn(),
    setFailed: vi.fn(),
    setOutput: vi.fn(),
    group: vi.fn(async (_name: string, fn: () => Promise<any>) => fn()),
}))

beforeEach(() => {
    vol.reset()
    vol.mkdirSync('/tmp', { recursive: true })
    env.GITHUB_ARTIFACTS = undefined
    vi.spyOn(Artifact.prototype, 'exportDatabase').mockResolvedValue()
    vi.spyOn(Artifact.prototype, 'exportOpenSearch').mockResolvedValue()
    vi.spyOn(Artifact.prototype, 'exportMedia').mockResolvedValue()
    vi.spyOn(Artifact.prototype, 'artifactFiles').mockResolvedValue([
        '/tmp/build-2.4.9/artifact-output/db.sql.gz',
        '/tmp/build-2.4.9/artifact-output/media.tgz',
        '/tmp/build-2.4.9/artifact-output/search.tgz',
    ])
})

afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
})

describe('build-dump', () => {
    it('exports db, opensearch, and media and sets outputs', async () => {
        const build = new Build({
            dockerCompose: {
                phpVersion: '8.4',
                mariaDbVersion: '11.8',
                opensearchVersion: '3.0',
                composerAuth: '{}',
            },
            name: '2.4.9',
        })
        const configFile = await build.save()

        const inputs: Record<string, string> = {
            'config-file': configFile,
        }
        vi.mocked(getInput).mockImplementation((name) => inputs[name] ?? '')

        await run()

        expect(setFailed).not.toHaveBeenCalled()
        expect(Artifact.prototype.exportDatabase).toHaveBeenCalledOnce()
        expect(Artifact.prototype.exportOpenSearch).toHaveBeenCalledWith('magento2')
        expect(Artifact.prototype.exportMedia).toHaveBeenCalledOnce()
        expect(setOutput).toHaveBeenCalledWith('output-directory', '/tmp/build-2.4.9/artifact-output')
        expect(setOutput).toHaveBeenCalledWith(
            'files',
            [
                '/tmp/build-2.4.9/artifact-output/db.sql.gz',
                '/tmp/build-2.4.9/artifact-output/media.tgz',
                '/tmp/build-2.4.9/artifact-output/search.tgz',
            ].join('\n'),
        )
    })

    it('uses custom opensearch-index-prefix and writes newline-delimited paths to GITHUB_ARTIFACTS', async () => {
        const build = new Build({
            dockerCompose: {
                phpVersion: '8.4',
                mariaDbVersion: '11.8',
                opensearchVersion: '3.0',
                composerAuth: '{}',
            },
            name: '2.4.9',
        })
        const configFile = await build.save()
        env.GITHUB_ARTIFACTS = '/tmp/artifacts.list'

        const inputs: Record<string, string> = {
            'config-file': configFile,
            'opensearch-index-prefix': 'custom_prefix',
        }
        vi.mocked(getInput).mockImplementation((name) => inputs[name] ?? '')

        await run()

        expect(setFailed).not.toHaveBeenCalled()
        expect(Artifact.prototype.exportOpenSearch).toHaveBeenCalledWith('custom_prefix')
        expect(vol.readFileSync('/tmp/artifacts.list', 'utf-8')).toBe(
            '/tmp/build-2.4.9/artifact-output/db.sql.gz\n' +
                '/tmp/build-2.4.9/artifact-output/media.tgz\n' +
                '/tmp/build-2.4.9/artifact-output/search.tgz\n',
        )
    })

    it('sets failed when export throws', async () => {
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
        vi.mocked(Artifact.prototype.exportDatabase).mockRejectedValueOnce(new Error('DB dump failed'))

        await run()

        expect(setFailed).toHaveBeenCalledWith('DB dump failed')
    })
})

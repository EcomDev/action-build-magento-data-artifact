import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest'
import { DockerCompose } from './docker'
import { vol } from 'memfs'
import { exec } from '@actions/exec'
import { Artifact } from './artifact'
import dumpDatabase from './database'
import { prepareForExport } from './opensearch'
import { DefaultArtifactClient } from '@actions/artifact'

vi.mock('node:fs')
vi.mock('node:fs/promises')
vi.mock('node:process', () => ({
    cwd: vi.fn(() => '/tmp'),
    env: {},
}))

vi.mock('./database', () => ({
    default: vi.fn(),
}))

vi.mock('./opensearch', () => ({
    prepareForExport: vi.fn(),
}))

vi.mock('@actions/io')
vi.mock('@actions/exec', () => ({
    exec: vi.fn(() => Promise.resolve(0)),
}))
vi.mock('@actions/core', () => ({
    info: vi.fn(),
}))

afterEach(() => {
    vol.reset()
    vi.resetAllMocks()
})

let docker: DockerCompose

beforeEach(() => {
    docker = vi.mockObject(
        new DockerCompose(
            {
                phpVersion: '8.1',
                mariaDbVersion: '11.8',
                composerAuth: '{}',
            },
            '2.4.9',
        ),
    )
})

describe(Artifact, () => {
    let artifact: Artifact
    let artifactClient: DefaultArtifactClient
    beforeEach(() => {
        artifactClient = vi.mockObject(new DefaultArtifactClient())
        artifact = new Artifact(docker)
    })

    it('should create output directory on db export', async () => {
        await artifact.exportDatabase()
        expect(vol.existsSync('/tmp/build-2.4.9/artifact-output')).toBe(true)
    })

    it('should create output directory on search export', async () => {
        await artifact.exportOpenSearch()
        expect(vol.existsSync('/tmp/build-2.4.9/artifact-output')).toBe(true)
    })

    it('should create output directory on media export', async () => {
        await artifact.exportMedia()
        expect(vol.existsSync('/tmp/build-2.4.9/artifact-output')).toBe(true)
    })

    it('should export database dump in output directory', async () => {
        await artifact.exportDatabase()
        expect(dumpDatabase).toHaveBeenCalledWith(docker, '/tmp/build-2.4.9/artifact-output/db.sql.gz')
    })

    it('should export opensearch data in output directory', async () => {
        vi.mocked(docker.config).opensearchVersion = '3.0.0'
        await artifact.exportOpenSearch()
        expect(prepareForExport).toHaveBeenCalledWith(docker, 'magento2', '/tmp/build-2.4.9/artifact-output')
    })

    it('allows export of opensearch data with custom index prefix', async () => {
        vi.mocked(docker.config).opensearchVersion = '3.0.0'
        await artifact.exportOpenSearch('custom-prefix')
        expect(prepareForExport).toHaveBeenCalledWith(docker, 'custom-prefix', '/tmp/build-2.4.9/artifact-output')
    })

    it('does not export opensearch when not configured', async () => {
        await artifact.exportOpenSearch()
        expect(prepareForExport).not.toHaveBeenCalled()
    })

    it('copies media files on export from container', async () => {
        await artifact.exportMedia()

        expect(docker.copyFrom).toHaveBeenCalledWith(
            'magento',
            '/var/www/html/pub/media',
            '/tmp/build-2.4.9/artifact-output/media',
        )
    })

    it('compresses media files into media.tgz', async () => {
        await artifact.exportMedia()

        expect(exec).toHaveBeenCalledWith('tar', ['-czf', './media.tgz', './media'], {
            cwd: '/tmp/build-2.4.9/artifact-output',
        })
    })

    it('deletes media folder after compressing into media.tgz', async () => {
        vol.mkdirSync('/tmp/build-2.4.9/artifact-output/media', { recursive: true })
        await artifact.exportMedia()
        expect(vol.existsSync('/tmp/build-2.4.9/artifact-output/media')).toBe(false)
    })

    it('should throw if archive generation fails', async () => {
        vi.mocked(exec).mockResolvedValue(1)

        await expect(artifact.exportMedia()).rejects.toThrow('Failed to compress media files')
    })

    it('should upload all files with gz and tgz ending to artifact storage', async () => {
        vol.mkdirSync('/tmp/build-2.4.9/artifact-output', { recursive: true })
        vol.writeFileSync('/tmp/build-2.4.9/artifact-output/db.sql.gz', '')
        vol.writeFileSync('/tmp/build-2.4.9/artifact-output/media.tgz', '')
        vol.writeFileSync('/tmp/build-2.4.9/artifact-output/data.tgz', '')
        vol.writeFileSync('/tmp/build-2.4.9/artifact-output/search.tgz', '')
        vol.writeFileSync('/tmp/build-2.4.9/artifact-output/ignored.text', '')

        await artifact.upload('2.4.9', artifactClient)

        expect(artifactClient.uploadArtifact).toHaveBeenCalledExactlyOnceWith(
            '2.4.9',
            expect.arrayContaining([
                '/tmp/build-2.4.9/artifact-output/db.sql.gz',
                '/tmp/build-2.4.9/artifact-output/media.tgz',
                '/tmp/build-2.4.9/artifact-output/data.tgz',
                '/tmp/build-2.4.9/artifact-output/search.tgz',
            ]),
            '/tmp/build-2.4.9/artifact-output',
            {
                compressionLevel: 0,
            },
        )

        expect((artifactClient.uploadArtifact as Mock).mock.calls[0][1]).toHaveLength(4)
    })

    it('should upload all files with gz and tgz ending to artifact storage', async () => {
        vol.mkdirSync('/tmp/build-2.4.9/artifact-output', { recursive: true })

        vi.mocked(artifactClient.uploadArtifact).mockResolvedValue({
            id: 123,
        })

        await expect(artifact.upload('2.4.9', artifactClient)).resolves.toEqual({
            id: 123,
        })
    })
})

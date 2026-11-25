import { DockerCompose } from './docker'
import { join } from 'node:path'
import dumpDatabase from './database'
import { mkdirP, rmRF } from '@actions/io'
import { prepareForExport } from './opensearch'
import { exec } from '@actions/exec'
import { readdir } from 'node:fs/promises'
import { ArtifactClient, UploadArtifactResponse } from '@actions/artifact'

export class Artifact {
    public readonly outputDirectory: string

    constructor(private readonly docker: DockerCompose) {
        this.outputDirectory = join(this.docker.path, 'artifact-output')
    }

    async exportDatabase() {
        await this.createOutputDirectory()
        await dumpDatabase(this.docker, join(this.outputDirectory, 'db.sql.gz'))
    }

    async exportOpenSearch(indexPrefix?: string) {
        await this.createOutputDirectory()
        if (this.docker.config.opensearchVersion) {
            await prepareForExport(this.docker, indexPrefix ?? 'magento2', this.outputDirectory)
        }
    }

    async exportMedia() {
        await this.createOutputDirectory()
        const mediaPath = join(this.outputDirectory, 'media')
        await this.docker.copyFrom('magento', '/var/www/html/pub/media', mediaPath)
        const result = await exec('tar', ['-czf', './media.tgz', './media'], {
            cwd: this.outputDirectory,
        })

        if (result !== 0) {
            throw new Error('Failed to compress media files')
        }

        await rmRF(mediaPath)
    }

    private async createOutputDirectory() {
        await mkdirP(this.outputDirectory)
    }

    async artifactFiles(): Promise<string[]> {
        const files = await readdir(this.outputDirectory)
        return files
            .filter((file) => file.endsWith('.tgz') || file.endsWith('.gz'))
            .map((file) => join(this.outputDirectory, file))
    }

    async upload(name: string, artifactClient: ArtifactClient): Promise<UploadArtifactResponse> {
        return await artifactClient.uploadArtifact(name, await this.artifactFiles(), this.outputDirectory, {
            compressionLevel: 0,
        })
    }
}

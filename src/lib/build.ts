import { DockerCompose, DockerComposeConfig } from './docker'
import { randomUUID } from 'node:crypto'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { workspacePath } from './utils'

export interface BuildConfig {
    dockerCompose: DockerComposeConfig
    name: string
}

export class Build {
    public readonly docker: DockerCompose
    public readonly name: string

    constructor(config: BuildConfig) {
        this.docker = new DockerCompose(config.dockerCompose, config.name)
        this.name = config.name
    }

    async save(): Promise<string> {
        const fileName = `build-${randomUUID()}`
        const buildConfig: BuildConfig = {
            dockerCompose: this.docker.config,
            name: this.name,
        }

        await writeFile(workspacePath(fileName), JSON.stringify(buildConfig))

        return fileName
    }

    static async load(path: string): Promise<Build> {
        try {
            const config = JSON.parse(await readFile(workspacePath(path), 'utf-8'))
            if (
                typeof config !== 'object' ||
                config === null ||
                typeof config.dockerCompose !== 'object' ||
                config.dockerCompose === null ||
                typeof config.name !== 'string' ||
                !config.name
            ) {
                throw new Error()
            }

            return new Build(config)
        } catch {
            throw new Error('Build configuration file is invalid')
        }
    }

    static async remove(path: string): Promise<void> {
        await rm(workspacePath(path), { force: true })
    }
}

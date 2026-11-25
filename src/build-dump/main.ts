import { getInput, group, setFailed, setOutput } from '@actions/core'
import { open } from 'node:fs/promises'
import { env } from 'node:process'

import { Build } from '../lib/build'
import { Artifact } from '../lib/artifact'

export async function run(): Promise<void> {
    try {
        const build = await Build.load(getInput('config-file', { trimWhitespace: true, required: true }))
        const indexPrefix = getInput('opensearch-index-prefix', { trimWhitespace: true }) || 'magento2'

        const artifact = new Artifact(build.docker)

        await group('Dump Magento Database', () => artifact.exportDatabase())
        await group('Dump Opensearch Data', () => artifact.exportOpenSearch(indexPrefix))
        await group('Dump Media', () => artifact.exportMedia())

        const files = await artifact.artifactFiles()
        setOutput('output-directory', artifact.outputDirectory)
        setOutput('files', files.join('\n'))

        if (env.GITHUB_ARTIFACTS) {
            const file = await open(env.GITHUB_ARTIFACTS, 'a')
            try {
                for (const artifactFile of files) {
                    await file.appendFile(`${artifactFile}\n`, 'utf-8')
                }
            } finally {
                await file.close()
            }
        }
    } catch (error) {
        setFailed(error.message)
    }
}

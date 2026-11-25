import { createComposerAuth } from '../lib/composer-auth'
import { getInput, getMultilineInput, group, saveState, setFailed, setOutput } from '@actions/core'
import { createConfig } from '../lib/docker'
import { Build } from '../lib/build'

export async function run(): Promise<void> {
    try {
        const composerAuth = createComposerAuth(
            getInput('auth', { trimWhitespace: true }) || '{}',
            getInput('token', { trimWhitespace: true }),
        )

        const dockerOptions = createConfig(
            getInput('mariadb-version', { required: true, trimWhitespace: true }),
            getInput('php-version', { required: true, trimWhitespace: true }),
            composerAuth,
            getInput('opensearch-version', { trimWhitespace: true }),
            getInput('magento-image', { trimWhitespace: true }),
            getMultilineInput('compose-files', { trimWhitespace: true }).filter((file) => file.length > 0),
        )

        const buildName = getInput('name', { required: true, trimWhitespace: true })

        const build = new Build({
            dockerCompose: dockerOptions,
            name: buildName,
        })

        const fileName = await build.save()
        setOutput('config-file', fileName)
        saveState('config-file', fileName)
        await group('Setup Docker Environment', () => build.docker.up())
    } catch (error) {
        setFailed(error.message)
    }
}

import { getBooleanInput, getInput, group, info, setFailed, setOutput } from '@actions/core'
import { createConfig, DockerCompose } from './lib/docker'
import {
    createComposerProject,
    createInstallOptions,
    createProjectOptions,
    magentoReindex,
    magentoSetupInstall,
} from './lib/magento'
import { DefaultArtifactClient, UploadArtifactResponse } from '@actions/artifact'
import { createComposerAuth } from './lib/composer-auth'
import { BuildCache, ComposerCache } from './lib/cache'
import { Artifact } from './lib/artifact'

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
            [],
        )

        const buildName = getInput('name', { required: true, trimWhitespace: true })

        const projectOptions = createProjectOptions(
            getInput('magento-version', { required: true, trimWhitespace: true }),
            getInput('meta-package', { trimWhitespace: true }) || 'magento/project-community-edition',
            getInput('repository', { trimWhitespace: true }) || 'https://mirror.mage-os.org/',
            getBooleanInput('sample-data', { trimWhitespace: true }),
            getInput('stability', { trimWhitespace: true }),
            getInput('additional-packages', { trimWhitespace: true }),
            getBooleanInput('no-dev', { trimWhitespace: true }),
        )

        const installOptions = createInstallOptions(
            getInput('magento-version', { required: true, trimWhitespace: true }),
            getInput('settings', { trimWhitespace: true }),
            getInput('install-arguments', { trimWhitespace: true }),
        )

        const artifact = await group('Building Magento', async (): Promise<UploadArtifactResponse> => {
            const docker = new DockerCompose(dockerOptions, buildName)
            await group('Setup Environment', () => docker.up())
            try {
                await group('Create Magento Project', () =>
                    new BuildCache(docker, projectOptions).execute(async () => {
                        await new ComposerCache(docker, projectOptions).execute(() =>
                            createComposerProject(docker, projectOptions),
                        )
                    }),
                )
                await group('Installing Magento', () => magentoSetupInstall(docker, installOptions))
                await group('Re-Index Magento', () => magentoReindex(docker))
                return await group('Generating Artifact', async () => {
                    const artifact = new Artifact(docker)
                    await artifact.exportOpenSearch()
                    await artifact.exportDatabase()
                    await artifact.exportMedia()
                    return await artifact.upload(buildName, new DefaultArtifactClient())
                })
            } finally {
                await group('Removing Environment', () => docker.down())
            }
        })

        if (artifact.id) {
            setOutput('artifact-id', artifact.id)
            setOutput('artifact-digest', artifact.digest)
            info(
                `Uploaded artifact ${buildName} with ID ${artifact.id} and total size ${(artifact.size ?? 0) / (1024 * 1024)} MB`,
            )
        } else {
            setFailed(`Failed to upload artifact ${buildName}`)
            return
        }
    } catch (error) {
        setFailed(error.message)
    }
}

import { getBooleanInput, getInput, group, setFailed } from '@actions/core'
import { Build } from '../lib/build'
import { createComposerProject, createProjectOptions } from '../lib/magento'
import { BuildCache, ComposerCache } from '../lib/cache'

export async function run(): Promise<void> {
    try {
        const build = await Build.load(getInput('config-file', { trimWhitespace: true, required: true }))
        const projectOptions = createProjectOptions(
            getInput('magento-version', { required: true, trimWhitespace: true }),
            getInput('meta-package', { trimWhitespace: true }) || 'magento/project-community-edition',
            getInput('repository', { trimWhitespace: true }) || 'https://mirror.mage-os.org/',
            getBooleanInput('sample-data', { trimWhitespace: true }),
            getInput('stability', { trimWhitespace: true }),
            getInput('additional-packages', { trimWhitespace: true }),
            getBooleanInput('no-dev', { trimWhitespace: true }),
        )

        await group('Create Magento Project', () =>
            new BuildCache(build.docker, projectOptions).execute(async () => {
                await new ComposerCache(build.docker, projectOptions).execute(() =>
                    createComposerProject(build.docker, projectOptions),
                )
            }),
        )
    } catch (error) {
        setFailed(error.message)
    }
}

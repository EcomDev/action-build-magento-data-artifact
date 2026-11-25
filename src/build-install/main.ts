import { getInput, group, setFailed } from '@actions/core'
import { Build } from '../lib/build'
import { createInstallOptions, magentoSetupInstall } from '../lib/magento'

export async function run(): Promise<void> {
    try {
        const build = await Build.load(getInput('config-file', { trimWhitespace: true, required: true }))

        const installOptions = createInstallOptions(
            getInput('magento-version', { required: true, trimWhitespace: true }),
            getInput('settings', { trimWhitespace: true }),
            getInput('install-arguments', { trimWhitespace: true }),
        )

        await group('Install Magento', () => magentoSetupInstall(build.docker, installOptions))
    } catch (error) {
        setFailed(error.message)
    }
}

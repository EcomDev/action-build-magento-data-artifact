import { getInput, getMultilineInput, group, setFailed } from '@actions/core'
import { Build } from '../lib/build'

export async function run(): Promise<void> {
    try {
        const build = await Build.load(getInput('config-file', { trimWhitespace: true, required: true }))
        const command = getInput('command', { trimWhitespace: true, required: true })
        const container = getInput('container', { trimWhitespace: true }) || 'magento'
        const user = getInput('user', { trimWhitespace: true })
        const commandArguments = getMultilineInput('command-arguments', { trimWhitespace: true }).filter(
            (argument) => argument.length > 0,
        )
        await group('Run command', () =>
            build.docker.exec(container, command, commandArguments, user ? { user } : undefined),
        )
    } catch (error) {
        setFailed(error.message)
    }
}

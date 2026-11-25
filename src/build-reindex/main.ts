import { getInput, group, setFailed } from '@actions/core'
import { Build } from '../lib/build'
import { magentoReindex } from '../lib/magento'

export async function run(): Promise<void> {
    try {
        const build = await Build.load(getInput('config-file', { trimWhitespace: true, required: true }))
        await group('Reindex Magento Indexes', () => magentoReindex(build.docker))
    } catch (error) {
        setFailed(error.message)
    }
}

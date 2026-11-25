import { getState, group, setFailed } from '@actions/core'
import { Build } from '../lib/build'

export async function run(): Promise<void> {
    try {
        const configFile = getState('config-file')
        if (!configFile) {
            return
        }

        const config = await Build.load(configFile)

        await group('Cleaning Docker Containers', async () => {
            try {
                await config.docker.down()
            } finally {
                await Build.remove(configFile)
            }
        })
    } catch (error) {
        setFailed(error.message)
    }
}

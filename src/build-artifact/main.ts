import { getInput, group, info, setFailed, setOutput } from '@actions/core'
import { Build } from '../lib/build'
import { Artifact } from '../lib/artifact'
import { DefaultArtifactClient } from '@actions/artifact'

export async function run(): Promise<void> {
    try {
        const build = await Build.load(getInput('config-file', { trimWhitespace: true, required: true }))
        const name = getInput('name', { trimWhitespace: true }) || build.name
        const artifact = new Artifact(build.docker)
        const uploadedArtifact = await group('Upload Artifact', () =>
            artifact.upload(name, new DefaultArtifactClient()),
        )

        if (uploadedArtifact.id) {
            setOutput('artifact-id', uploadedArtifact.id)
            setOutput('artifact-digest', uploadedArtifact.digest)
            info(
                `Uploaded artifact ${name} with ID ${uploadedArtifact.id} and total size ${(uploadedArtifact.size ?? 0) / (1024 * 1024)} MB`,
            )
        } else {
            setFailed(`Failed to upload artifact ${name}`)
        }
    } catch (error) {
        setFailed(error.message)
    }
}

import { DockerCompose } from './docker'
import semver from 'semver'
import { extractSampleDataFromSuggestOutput } from './sample-data'
import { buildArguments, CommandArguments } from './command-arguments'

export interface MagentoInstallOptions {
    version: string
    settings?: {
        [settingName: string]: string
    }
    installArguments?: CommandArguments
}

export interface CreateProjectOptions {
    version: string
    metaPackage: string
    repository: string
    sampleData?: boolean
    stability?: string
    extraPackages?: {
        [packageName: string]: string
    }
    noDev?: boolean
}

export function createProjectOptions(
    version: string,
    metaPackage: string,
    repository: string,
    sampleData: boolean,
    stability: string,
    extraPackages: string,
    noDev: boolean,
): CreateProjectOptions {
    try {
        return {
            version,
            metaPackage,
            repository,
            sampleData,
            stability: stability || 'stable',
            extraPackages: extraPackages ? validateConfig(JSON.parse(extraPackages)) : undefined,
            noDev,
        }
    } catch {
        throw new Error('Value for extraPackages is malformed')
    }
}

export async function createComposerProject(docker: DockerCompose, options: CreateProjectOptions) {
    await docker.exec('magento', 'composer', [
        'create-project',
        '--stability',
        options.stability ?? 'stable',
        '--prefer-dist',
        ...(options.noDev ? ['--no-dev'] : []),
        '--no-progress',
        '--repository-url',
        options.repository,
        `${options.metaPackage}:${options.version}`,
        '/var/www/html/',
    ])

    let extraPackages = options.extraPackages

    if (options.sampleData === true) {
        const suggestions = await docker.execLines('magento', 'composer', ['suggest', '--all', '--no-dev'])

        if (!Array.isArray(suggestions)) {
            throw new Error('Failed to retrieve composer suggestions')
        }

        const sampleDataPackages = extractSampleDataFromSuggestOutput(suggestions, options.version)

        if (Object.keys(sampleDataPackages).length > 0) {
            extraPackages = Object.assign(extraPackages ?? {}, sampleDataPackages)
        }
    }

    if (extraPackages) {
        await docker.exec('magento', 'composer', [
            'require',
            ...(options.noDev ? ['--update-no-dev'] : []),
            '--prefer-dist',
            ...Object.entries(extraPackages).map(([name, version]) => `${name}:${version}`),
        ])
    }
}

export function createInstallOptions(
    version: string,
    settings: string,
    installArguments: string,
): MagentoInstallOptions {
    const options: MagentoInstallOptions = {
        version,
    }

    try {
        options.settings = settings ? validateConfig(JSON.parse(settings)) : undefined
    } catch (error) {
        throw new Error('Value for settings is invalid JSON')
    }

    try {
        options.installArguments = installArguments ? validateConfig(JSON.parse(installArguments)) : undefined
    } catch (error) {
        throw new Error('Value for install arguments is invalid JSON')
    }

    return options
}

function validateConfig(config: { [key: string]: any }): { [key: string]: string } {
    for (const value of Object.values(config ?? {})) {
        if (typeof value !== 'string') {
            throw new Error('Configuration has non string values')
        }
    }

    return config
}

export async function magentoSetupInstall(docker: DockerCompose, options: MagentoInstallOptions) {
    await docker.exec('magento', 'bin/magento', [
        'setup:install',
        ...buildArguments(installArguments(options.version, options.installArguments)),
    ])

    if (options.settings) {
        for (const [key, value] of Object.entries(options.settings)) {
            await docker.exec('magento', 'bin/magento', ['config:set', key, value])
        }
    }
}

export async function magentoReindex(docker: DockerCompose) {
    await docker.exec('magento', 'bin/magento', ['indexer:set-mode', 'schedule'])
    await docker.exec('magento', 'bin/magento', ['indexer:reindex'])
}

export function installArguments(version: string, installArguments?: CommandArguments): CommandArguments {
    return {
        'backend-frontname': 'backend',
        'db-host': 'db',
        'db-name': 'magento',
        'db-user': 'magento',
        'db-password': 'magento',
        ...opensearchParams(version, installArguments),
        ...(installArguments ?? {}),
    }
}

function opensearchParams(version: string, installArguments?: CommandArguments): CommandArguments {
    if (installArguments && installArguments['search-engine'] && installArguments['search-engine'] !== 'opensearch') {
        return {}
    }

    if (semver.satisfies(semver.coerce(version)!, '<2.4.6')) {
        return {
            'search-engine': 'elasticsearch7',
            'elasticsearch-host': 'opensearch',
            'elasticsearch-port': '9200',
            'elasticsearch-index-prefix': 'magento2',
            'elasticsearch-enable-auth': '0',
            'elasticsearch-timeout': '15',
        }
    }

    return {
        'search-engine': 'opensearch',
        'opensearch-host': 'opensearch',
        'opensearch-port': '9200',
        'opensearch-index-prefix': 'magento2',
        'opensearch-enable-auth': '0',
        'opensearch-timeout': '15',
    }
}

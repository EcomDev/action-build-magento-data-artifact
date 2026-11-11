import {DockerCompose} from "./docker.js";
import semver from "semver";
import {extractSampleDataFromSuggestOutput} from "./sample-data.js";

export interface MagentoOptions {
    version: string;
    metaPackage: string;
    repository: string;
    sampleData?: boolean;
    stability?: string;
    extraPackages?: {
        [packageName: string]: string;
    };
    settings?: {
        [settingName: string]: string;
    };
}

export async function installMagento(
    docker: DockerCompose,
    options: MagentoOptions
) {
    await docker.exec(
        'magento',
        'composer',
        [
            'create-project',
            '--stability',
            options.stability ?? 'stable',
            '--prefer-dist',
            '--no-progress',
            '--repository-url',
            options.repository,
            `${options.metaPackage}:${options.version}`,
            "/var/www/html/",
        ]
    )

    let extraPackages = options.extraPackages;

    if (options.sampleData === true) {
        const suggestions = await docker.execLines(
            'magento',
            'composer',
            [
                'suggest',
                '--all',
                '--no-dev'
            ]
        )

        if (!Array.isArray(suggestions)) {
            throw new Error('Failed to retrieve composer suggestions');
        }

        const sampleDataPackages = extractSampleDataFromSuggestOutput(suggestions, options.version);

        if (Object.keys(sampleDataPackages).length > 0) {
            extraPackages = Object.assign(
                extraPackages ?? {},
                sampleDataPackages,
            )
        }
    }

    if (extraPackages) {
        await docker.exec(
            'magento',
            'composer',
            [
                'require',
                '--prefer-dist',
                ...Object.entries(extraPackages).map(([name, version]) => `${name}:${version}`)
            ]
        )
    }

    await docker.exec(
        'magento',
        'bin/magento',
        [
            'setup:install',
            ...installCommandArguments(options)
        ]
    )

    if (options.settings) {
        for (const [key, value] of Object.entries(options.settings)) {
            await docker.exec(
                'magento',
                'bin/magento',
                ['config:set', key, value]
            )
        }
    }

    await docker.exec(
        'magento',
        'bin/magento',
        ['indexer:set-mode', 'schedule']
    )

    await docker.exec(
        'magento',
        'bin/magento',
        ['indexer:reindex']
    )

    return true;
}

function installCommandArguments(options: MagentoOptions): string[] {
    const isElasticSearchParams = semver.satisfies(
        semver.coerce(options.version)!,
        '<2.4.6'
    );

    const engineName = isElasticSearchParams ? 'elasticsearch7' : 'opensearch';
    const paramPrefix = isElasticSearchParams ? 'elasticsearch' : 'opensearch';

    return [
        '--backend-frontname',
        'backend',
        '--db-host',
        'db',
        '--db-name',
        'magento',
        '--db-password',
        'magento',
        '--search-engine',
        engineName,
        `--${paramPrefix}-host`,
        'opensearch',
        `--${paramPrefix}-port`,
        '9200',
        `--${paramPrefix}-index-prefix`,
        'magento2',
        `--${paramPrefix}-enable-auth`,
        '0',
        `--${paramPrefix}-timeout`,
        '15',
    ]
}
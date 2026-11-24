import { beforeEach, describe, expect, it, MockedObject, vi } from 'vitest'
import { DockerCompose } from './docker'
import {
    createComposerProject,
    createInstallOptions,
    createProjectOptions,
    installArguments,
    magentoReindex,
    magentoSetupInstall,
} from './magento'
import { ExecOptions } from '@actions/exec'

const calls: { container: string; command: string; args: string[] }[] = []

function dockerCompose(lines?: string): MockedObject<DockerCompose> {
    const mock = vi.mockObject(
        new DockerCompose(
            {
                phpVersion: '8.2',
                composerAuth: '{}',
                opensearchVersion: '2.2',
                mariaDbVersion: '10.11',
            },
            '',
        ),
    )
    mock.exec.mockImplementation(
        async (container: string, command: string, args: string[], options?: ExecOptions): Promise<boolean> => {
            calls.push({ container, command, args })
            return true
        },
    )
    if (lines) {
        mock.execLines.mockImplementation(() => Promise.resolve(lines.split('\n')))
    }
    return mock
}

beforeEach(() => {
    calls.length = 0
})

describe(createComposerProject, () => {
    it('uses provided repo and metapackage', async () => {
        await createComposerProject(dockerCompose(), {
            metaPackage: 'magento/project-community-edition',
            version: '2.4.9',
            repository: 'https://repo.magento.com/',
        })

        expect(calls).toContainEqual({
            container: 'magento',
            command: 'composer',
            args: [
                'create-project',
                '--stability',
                'stable',
                '--prefer-dist',
                '--no-progress',
                '--repository-url',
                'https://repo.magento.com/',
                'magento/project-community-edition:2.4.9',
                '/var/www/html/',
            ],
        })
    })

    it('allows no dev options for composer project creation', async () => {
        await createComposerProject(dockerCompose(), {
            metaPackage: 'magento/project-community-edition',
            version: '2.4.9',
            repository: 'https://repo.magento.com/',
            noDev: true,
        })

        expect(calls).toContainEqual({
            container: 'magento',
            command: 'composer',
            args: expect.arrayContaining(['--no-dev']),
        })
    })

    it('does not execute extra commands when no sample data and no custom packages', async () => {
        await createComposerProject(dockerCompose(), {
            metaPackage: 'magento/project-community-edition',
            version: '2.4.9',
            repository: 'https://repo.magento.com/',
        })

        expect(calls).toHaveLength(1)
    })

    it('executes install of extra packages before setup:install', async () => {
        await createComposerProject(dockerCompose(), {
            metaPackage: 'magento/project-community-edition',
            version: '2.4.9',
            repository: 'https://repo.magento.com/',
            extraPackages: {
                'ecomdev/magento2-module-rum-beacon': '*',
                'ecomdev/magento2-product-data-preloader': '1.1.0',
            },
        })

        expect(calls[1]).toEqual({
            container: 'magento',
            command: 'composer',
            args: [
                'require',
                '--prefer-dist',
                'ecomdev/magento2-module-rum-beacon:*',
                'ecomdev/magento2-product-data-preloader:1.1.0',
            ],
        })
    })

    it('does not run sample data discovery when not requested', async () => {
        const composer = dockerCompose()
        await createComposerProject(composer, {
            metaPackage: 'magento/project-community-edition',
            version: '2.4.9',
            repository: 'https://repo.magento.com/',
            extraPackages: {
                'ecomdev/magento2-module-rum-beacon': '*',
                'ecomdev/magento2-product-data-preloader': '1.1.0',
            },
        })

        expect(composer.execLines).not.toHaveBeenCalled()
    })

    it('installs extra packages with no-dev when provided', async () => {
        const composer = dockerCompose()
        await createComposerProject(composer, {
            metaPackage: 'magento/project-community-edition',
            version: '2.4.9',
            repository: 'https://repo.magento.com/',
            noDev: true,
            extraPackages: {
                'ecomdev/magento2-module-rum-beacon': '*',
                'ecomdev/magento2-product-data-preloader': '1.1.0',
            },
        })

        expect(calls[1]).toEqual({
            container: 'magento',
            command: 'composer',
            args: [
                'require',
                '--update-no-dev',
                '--prefer-dist',
                'ecomdev/magento2-module-rum-beacon:*',
                'ecomdev/magento2-product-data-preloader:1.1.0',
            ],
        })
    })

    it('adds sample data packages from discovered ones', async () => {
        const composer = dockerCompose(`
magento/module-offline-shipping suggests:
 - magento/module-offline-shipping-sample-data: Sample Data version: 100.4.*

magento/module-review suggests:
 - magento/module-review-sample-data: Sample Data version: 100.4.*

magento/module-sales suggests:
 - magento/module-sales-sample-data: Sample Data version: 100.4.*
`)

        await createComposerProject(composer, {
            metaPackage: 'magento/project-community-edition',
            version: '2.4.9',
            repository: 'https://repo.magento.com/',
            sampleData: true,
        })

        expect(calls[1]).toEqual({
            container: 'magento',
            command: 'composer',
            args: [
                'require',
                '--prefer-dist',
                'magento/module-offline-shipping-sample-data:100.4.5',
                'magento/module-review-sample-data:100.4.5',
                'magento/module-sales-sample-data:100.4.5',
            ],
        })
    })

    it('installs sample data together with custom packages', async () => {
        const composer = dockerCompose(`
magento/module-offline-shipping suggests:
 - magento/module-offline-shipping-sample-data: Sample Data version: 100.4.*

magento/module-review suggests:
 - magento/module-review-sample-data: Sample Data version: 100.4.*

magento/module-sales suggests:
 - magento/module-sales-sample-data: Sample Data version: 100.4.*
`)

        await createComposerProject(composer, {
            metaPackage: 'magento/project-community-edition',
            version: '2.4.9',
            repository: 'https://repo.magento.com/',
            sampleData: true,
            extraPackages: {
                'ecomdev/magento2-module-rum-beacon': '*',
                'ecomdev/magento2-product-data-preloader': '1.1.0',
            },
        })

        expect(calls[1]).toEqual({
            container: 'magento',
            command: 'composer',
            args: [
                'require',
                '--prefer-dist',
                'ecomdev/magento2-module-rum-beacon:*',
                'ecomdev/magento2-product-data-preloader:1.1.0',
                'magento/module-offline-shipping-sample-data:100.4.5',
                'magento/module-review-sample-data:100.4.5',
                'magento/module-sales-sample-data:100.4.5',
            ],
        })
    })
})

describe(magentoSetupInstall, () => {
    it('runs setup:install command', async () => {
        await magentoSetupInstall(dockerCompose(), {
            version: '2.4.9',
        })

        expect(calls).toContainEqual({
            container: 'magento',
            command: 'bin/magento',
            args: [
                'setup:install',
                '--backend-frontname',
                'backend',
                '--db-host',
                'db',
                '--db-name',
                'magento',
                '--db-user',
                'magento',
                '--db-password',
                'magento',
                '--search-engine',
                'opensearch',
                `--opensearch-host`,
                'opensearch',
                `--opensearch-port`,
                '9200',
                `--opensearch-index-prefix`,
                'magento2',
                `--opensearch-enable-auth`,
                '0',
                `--opensearch-timeout`,
                '15',
            ],
        })
    })

    it('runs setup:install command with Elasticsearch parameters for older Magento version', async () => {
        await magentoSetupInstall(dockerCompose(), {
            version: '2.4.5',
        })

        expect(calls).toContainEqual({
            container: 'magento',
            command: 'bin/magento',
            args: [
                'setup:install',
                '--backend-frontname',
                'backend',
                '--db-host',
                'db',
                '--db-name',
                'magento',
                '--db-user',
                'magento',
                '--db-password',
                'magento',
                '--search-engine',
                'elasticsearch7',
                `--elasticsearch-host`,
                'opensearch',
                `--elasticsearch-port`,
                '9200',
                `--elasticsearch-index-prefix`,
                'magento2',
                `--elasticsearch-enable-auth`,
                '0',
                `--elasticsearch-timeout`,
                '15',
            ],
        })
    })

    it('runs setup:install with overridden search engine', async () => {
        await magentoSetupInstall(dockerCompose(), {
            version: '2.4.9',
            installArguments: {
                'search-engine': 'custom',
            },
        })

        expect(calls).toContainEqual({
            container: 'magento',
            command: 'bin/magento',
            args: [
                'setup:install',
                '--backend-frontname',
                'backend',
                '--db-host',
                'db',
                '--db-name',
                'magento',
                '--db-user',
                'magento',
                '--db-password',
                'magento',
                '--search-engine',
                'custom',
            ],
        })
    })

    it('executes bin/magento config:set for each passed configuration option', async () => {
        const composer = dockerCompose()
        await magentoSetupInstall(composer, {
            version: '2.4.9',
            settings: {
                'system/full_page_cache/caching_application': '2',
                'system/full_page_cache/ttl': '3600',
            },
        })

        expect(calls).toContainEqual({
            container: 'magento',
            command: 'bin/magento',
            args: ['config:set', 'system/full_page_cache/caching_application', '2'],
        })

        expect(calls).toContainEqual({
            container: 'magento',
            command: 'bin/magento',
            args: ['config:set', 'system/full_page_cache/ttl', '3600'],
        })
    })
})

describe(magentoReindex, () => {
    it('sets indexers into scheduled mode and runs full reindex', async () => {
        const composer = dockerCompose()
        await magentoReindex(composer)

        expect(calls).toContainEqual({
            container: 'magento',
            command: 'bin/magento',
            args: ['indexer:set-mode', 'schedule'],
        })

        expect(calls).toContainEqual({
            container: 'magento',
            command: 'bin/magento',
            args: ['indexer:reindex'],
        })
    })
})

describe(installArguments, () => {
    it('uses by default open search arguments', () => {
        expect(installArguments('2.4.9')).toEqual({
            'backend-frontname': 'backend',
            'db-host': 'db',
            'db-user': 'magento',
            'db-password': 'magento',
            'db-name': 'magento',
            'search-engine': 'opensearch',
            'opensearch-host': 'opensearch',
            'opensearch-port': '9200',
            'opensearch-index-prefix': 'magento2',
            'opensearch-enable-auth': '0',
            'opensearch-timeout': '15',
        })
    })

    it('uses by default elasticsearch for versions before official opensearch support', () => {
        expect(installArguments('2.4.5-p10')).toEqual({
            'backend-frontname': 'backend',
            'db-host': 'db',
            'db-user': 'magento',
            'db-password': 'magento',
            'db-name': 'magento',
            'search-engine': 'elasticsearch7',
            'elasticsearch-host': 'opensearch',
            'elasticsearch-port': '9200',
            'elasticsearch-index-prefix': 'magento2',
            'elasticsearch-enable-auth': '0',
            'elasticsearch-timeout': '15',
        })
    })

    it('skips OpenSearch params if different search engine is used', () => {
        expect(installArguments('2.4.9', { 'search-engine': 'custom' })).toEqual({
            'backend-frontname': 'backend',
            'db-host': 'db',
            'db-user': 'magento',
            'db-password': 'magento',
            'db-name': 'magento',
            'search-engine': 'custom',
        })
    })
})

describe(createProjectOptions, () => {
    it('creates default options', () => {
        expect(
            createProjectOptions(
                '2.4.9',
                'magento/project-community-edition',
                'https://repo.magento.com/',
                false,
                '',
                '',
                true,
            ),
        ).toEqual({
            version: '2.4.9',
            metaPackage: 'magento/project-community-edition',
            repository: 'https://repo.magento.com/',
            sampleData: false,
            stability: 'stable',
            noDev: true,
        })
    })

    it('uses custom stability options', () => {
        expect(
            createProjectOptions(
                '2.4.9',
                'magento/project-community-edition',
                'https://repo.magento.com/',
                false,
                'alpha',
                '',
                true,
            ),
        ).toEqual({
            version: '2.4.9',
            metaPackage: 'magento/project-community-edition',
            repository: 'https://repo.magento.com/',
            sampleData: false,
            stability: 'alpha',
            noDev: true,
        })
    })

    it('parses custom packages', () => {
        expect(
            createProjectOptions(
                '2.4.9',
                'magento/project-community-edition',
                'https://repo.magento.com/',
                false,
                '',
                '{"ecomdev/package":"1.0.0"}',
                true,
            ),
        ).toEqual({
            version: '2.4.9',
            metaPackage: 'magento/project-community-edition',
            repository: 'https://repo.magento.com/',
            sampleData: false,
            stability: 'stable',
            extraPackages: {
                'ecomdev/package': '1.0.0',
            },
            noDev: true,
        })
    })

    it('should error out on malformed custom packages JSON', () => {
        expect(() => createProjectOptions('2.4.9', '', '', false, '', 'malformed', true)).toThrow(
            'Value for extraPackages is malformed',
        )
    })

    it('should error out on non string package version in extra packages', () => {
        expect(() => createProjectOptions('2.4.9', '', '', false, '', '{"ecomdev/package":1}', true)).toThrow(
            'Value for extraPackages is malformed',
        )
    })
})

describe(createInstallOptions, () => {
    it('by default returns an object with version', () => {
        expect(createInstallOptions('2.4.9', '', '')).toEqual({
            version: '2.4.9',
        })
    })
    it('parses settings', () => {
        expect(createInstallOptions('2.4.9', '{"some/config/option":"1"}', '')).toEqual({
            version: '2.4.9',
            settings: {
                'some/config/option': '1',
            },
        })
    })
    it('should error on malformed settings JSON', () => {
        expect(() => createInstallOptions('2.4.9', 'malformed', '')).toThrow('Value for settings is invalid JSON')
    })

    it('should error on invalid settings JSON', () => {
        expect(() => createInstallOptions('2.4.9', '{"key": []}', '')).toThrow('Value for settings is invalid JSON')
    })
    it('parses install arguments', () => {
        expect(createInstallOptions('2.4.9', '', '{"arg":"value"}')).toEqual({
            version: '2.4.9',
            installArguments: {
                arg: 'value',
            },
        })
    })
})

import {beforeEach, expect, it, MockedObject, vi} from "vitest";
import {DockerCompose} from "./docker.js";
import {installMagento} from "./magento.js";
import {ExecOptions} from "@actions/exec";

const calls: { container: string, command: string, args: string[] }[] = [];

function dockerCompose(lines?: string): MockedObject<DockerCompose> {
    const mock = vi.mockObject(
        new DockerCompose(
            {
                phpVersion: '8.2',
                composerAuth: '{}',
                opensearchVersion: '2.2',
                mariaDbVersion: '10.11'
            },
            ''
        ));
    mock.exec.mockImplementation(
        async (container: string, command: string, args: string[], options?: ExecOptions): Promise<boolean> => {
            calls.push({container, command, args});
            return true;
        }
    );
    if (lines) {
        mock.execLines.mockImplementation(() => Promise.resolve(lines.split('\n')));
    }
    return mock;
}

beforeEach(() => {
    calls.length = 0;
});

it('creates Magento as a composer project', async () => {
    await installMagento(dockerCompose(), {
        metaPackage: 'magento/project-community-edition',
        version: '2.4.9',
        repository: 'https://repo.magento.com/',
    });

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
            "/var/www/html/",
        ]
    })
});

it('runs setup:install command', async () => {
    await installMagento(dockerCompose(), {
        metaPackage: 'magento/project-community-edition',
        version: '2.4.9',
        repository: 'https://repo.magento.com/',
    });

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
        ]
    })
});

it('runs setup:install command with Elasticsearch parameters for older Magento version', async () => {
    await installMagento(dockerCompose(), {
        metaPackage: 'magento/project-community-edition',
        version: '2.4.5',
        repository: 'https://repo.magento.com/',
    });

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
        ]
    })
});

it('does not execute extra commands when no sample data and no custom packages', async () => {
    await installMagento(dockerCompose(), {
        metaPackage: 'magento/project-community-edition',
        version: '2.4.9',
        repository: 'https://repo.magento.com/',
    });

    expect(calls).toHaveLength(4)
});

it('executes install of extra packages before setup:install', async () => {
    await installMagento(dockerCompose(), {
        metaPackage: 'magento/project-community-edition',
        version: '2.4.9',
        repository: 'https://repo.magento.com/',
        extraPackages: {
            "ecomdev/magento2-module-rum-beacon": "*",
            "ecomdev/magento2-product-data-preloader": "1.1.0",
        },
    });

    expect(calls[1]).toEqual({
        container: 'magento',
        command: 'composer',
        args: [
            'require',
            '--prefer-dist',
            'ecomdev/magento2-module-rum-beacon:*',
            'ecomdev/magento2-product-data-preloader:1.1.0'
        ]
    })
});


it('executes install of extra packages before setup:install', async () => {
    await installMagento(dockerCompose(), {
        metaPackage: 'magento/project-community-edition',
        version: '2.4.9',
        repository: 'https://repo.magento.com/',
        extraPackages: {
            "ecomdev/magento2-module-rum-beacon": "*",
            "ecomdev/magento2-product-data-preloader": "1.1.0",
        },
    });

    expect(calls[1]).toEqual({
        container: 'magento',
        command: 'composer',
        args: [
            'require',
            '--prefer-dist',
            'ecomdev/magento2-module-rum-beacon:*',
            'ecomdev/magento2-product-data-preloader:1.1.0'
        ]
    })
});

it('does not run sample data discovery when not requested', async () => {
    const composer = dockerCompose();
    await installMagento(composer, {
        metaPackage: 'magento/project-community-edition',
        version: '2.4.9',
        repository: 'https://repo.magento.com/',
        extraPackages: {
            "ecomdev/magento2-module-rum-beacon": "*",
            "ecomdev/magento2-product-data-preloader": "1.1.0",
        },
    });

    expect(composer.execLines).not.toHaveBeenCalled();
});

it('adds sample data packages before setup:install', async () => {
    const composer = dockerCompose(`
magento/module-offline-shipping suggests:
 - magento/module-offline-shipping-sample-data: Sample Data version: 100.4.*

magento/module-review suggests:
 - magento/module-review-sample-data: Sample Data version: 100.4.*

magento/module-sales suggests:
 - magento/module-sales-sample-data: Sample Data version: 100.4.*
`);

    await installMagento(composer, {
        metaPackage: 'magento/project-community-edition',
        version: '2.4.9',
        repository: 'https://repo.magento.com/',
        sampleData: true,
    });

    expect(calls[1]).toEqual({
        container: 'magento',
        command: 'composer',
        args: [
            'require',
            '--prefer-dist',
            'magento/module-offline-shipping-sample-data:100.4.5',
            'magento/module-review-sample-data:100.4.5',
            'magento/module-sales-sample-data:100.4.5',
        ]
    });
});


it('does not run sample data discovery when not requested', async () => {
    const composer = dockerCompose();
    await installMagento(composer, {
        metaPackage: 'magento/project-community-edition',
        version: '2.4.9',
        repository: 'https://repo.magento.com/',
        extraPackages: {
            "ecomdev/magento2-module-rum-beacon": "*",
            "ecomdev/magento2-product-data-preloader": "1.1.0",
        },
    });

    expect(composer.execLines).not.toHaveBeenCalled();
});

it('installs sample data together with custom packages', async () => {
    const composer = dockerCompose(`
magento/module-offline-shipping suggests:
 - magento/module-offline-shipping-sample-data: Sample Data version: 100.4.*

magento/module-review suggests:
 - magento/module-review-sample-data: Sample Data version: 100.4.*

magento/module-sales suggests:
 - magento/module-sales-sample-data: Sample Data version: 100.4.*
`);

    await installMagento(composer, {
        metaPackage: 'magento/project-community-edition',
        version: '2.4.9',
        repository: 'https://repo.magento.com/',
        sampleData: true,
        extraPackages: {
            "ecomdev/magento2-module-rum-beacon": "*",
            "ecomdev/magento2-product-data-preloader": "1.1.0",
        },
    });

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
        ]
    });
});

it('sets indexers into scheduled mode and runs full reindex', async () => {
    const composer = dockerCompose();
    await installMagento(composer, {
        metaPackage: 'magento/project-community-edition',
        version: '2.4.9',
        repository: 'https://repo.magento.com/'
    });

    expect(calls).toContainEqual({
        container: 'magento',
        command: 'bin/magento',
        args: ['indexer:set-mode', 'schedule']
    });

    expect(calls).toContainEqual({
        container: 'magento',
        command: 'bin/magento',
        args: ['indexer:reindex']
    });
});

it('executes bin/magento config:set for each passed configuration option', async () => {
    const composer = dockerCompose();
    await installMagento(composer, {
        metaPackage: 'magento/project-community-edition',
        version: '2.4.9',
        repository: 'https://repo.magento.com/',
        settings: {
            'system/full_page_cache/caching_application': '2',
            'system/full_page_cache/ttl': '3600'
        }
    });

    expect(calls).toContainEqual({
        container: 'magento',
        command: 'bin/magento',
        args: ['config:set', 'system/full_page_cache/caching_application', '2']
    });

    expect(calls).toContainEqual({
        container: 'magento',
        command: 'bin/magento',
        args: ['config:set', 'system/full_page_cache/ttl', '3600']
    });
});
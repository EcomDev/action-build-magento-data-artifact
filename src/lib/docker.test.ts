import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { vol } from 'memfs'
import { info } from '@actions/core'
import { exec, ExecOptions } from '@actions/exec'
import { DockerCompose } from './docker'

vi.mock('node:fs')
vi.mock('node:fs/promises')
vi.mock('node:process', () => ({
    cwd: vi.fn(() => '/tmp'),
    env: {},
}))

vi.mock('@actions/io')
vi.mock('@actions/core', () => ({
    info: vi.fn(),
    warn: vi.fn(),
    spy: true,
}))

vi.mock('@actions/exec', () => ({
    exec: vi.fn(async (command: string, args: string[], options?: ExecOptions) => Promise.resolve(0)),
    which: vi.fn(async (bin: string) => Promise.resolve(`/usr/bin/${bin}`)),
    spy: true,
}))

beforeEach(() => {
    // reset the state of in-memory fs
    vol.reset()
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('Default Configuration', () => {
    const compose = new DockerCompose(
        {
            mariaDbVersion: '11.4',
            phpVersion: '8.4',
            opensearchVersion: '3',
            composerAuth: '{}',
        },
        'magento-action',
    )

    it('should create docker-compose.yml in target directory on up', async () => {
        await compose.up()
        expect(vol.existsSync('/tmp/build-magento-action/docker-compose.yml')).toBe(true)
    })

    it('should write a message that docker compose is up', async () => {
        await compose.up()
        expect(info).toHaveBeenCalledWith('Started Docker Compose in /tmp/build-magento-action directory')
    })

    it('should execute docker compose up with wait for start', async () => {
        await compose.up()

        expect(exec).toHaveBeenCalledWith('/usr/bin/docker', ['compose', 'up', '-d', '--wait'], {
            cwd: 'build-magento-action',
        })
    })

    it('should write a message that docker compose is stopped', async () => {
        await compose.down()
        expect(info).toHaveBeenCalledWith(
            'Stopped Docker Compose in /tmp/build-magento-action directory and cleaned up data',
        )
    })

    it('should delete all data in target directory after stopped', async () => {
        await compose.up()
        await compose.down()
        expect(vol.existsSync('/tmp/build-magento-action')).toBe(false)
    })

    it('should execute down with all removed volumes', async () => {
        await compose.down()
        expect(exec).toHaveBeenCalledWith('/usr/bin/docker', ['compose', 'down', '-v'], { cwd: 'build-magento-action' })
    })

    it('should delete all files in its directory', async () => {
        await compose.down()
        expect(vol.existsSync('/tmp/build-magento-action')).toBe(false)
    })

    it('should allow to execute command in a specific container', async () => {
        await compose.exec('opensearch', 'bash', ['--some-option'])

        expect(exec).toHaveBeenCalledWith(
            '/usr/bin/docker',
            ['compose', 'exec', 'opensearch', 'bash', '--some-option'],
            {
                cwd: 'build-magento-action',
            },
        )
    })

    it('passes output options down to command executor', async () => {
        const writeStream = vol.createWriteStream('test')
        await compose.exec('db', 'bash', ['--some-option'], {
            outStream: writeStream,
        })

        expect(exec).toHaveBeenCalledWith('/usr/bin/docker', ['compose', 'exec', 'db', 'bash', '--some-option'], {
            cwd: 'build-magento-action',
            outStream: writeStream,
        })
    })

    it('allows to specify a user for exec command', async () => {
        await compose.exec('db', 'bash', ['--some-option'], { user: 'root' })

        expect(exec).toHaveBeenCalledWith(
            '/usr/bin/docker',
            ['compose', 'exec', '-u', 'root', 'db', 'bash', '--some-option'],
            {
                cwd: 'build-magento-action',
            },
        )
    })

    it('returns output lines in stdout', async () => {
        vi.mocked(exec).mockImplementationOnce(
            async (command: string, args?: string[], options?: ExecOptions): Promise<number> => {
                if (options?.listeners?.stdline) {
                    options.listeners.stdline('line1')
                    options.listeners.stdline('line2')
                    options.listeners.stdline('line3')
                    options.listeners.stdline('line4')
                }
                return Promise.resolve(0)
            },
        )

        expect(await compose.execLines('db', 'mysqldump', ['--some-option'])).toEqual([
            'line1',
            'line2',
            'line3',
            'line4',
        ])

        expect(exec).toHaveBeenCalledWith(
            '/usr/bin/docker',
            ['compose', 'exec', 'db', 'mysqldump', '--some-option'],
            expect.objectContaining({ cwd: 'build-magento-action' }),
        )
    })

    it('should allow to get binding port for a container', async () => {
        vi.mocked(exec).mockImplementationOnce(
            async (command: string, args?: string[], options?: ExecOptions): Promise<number> => {
                if (options?.listeners?.stdline) {
                    options.listeners.stdline('0.0.0.0:3316')
                }
                return Promise.resolve(0)
            },
        )

        expect(await compose.binding('db', 3316)).toBe('0.0.0.0:3316')

        expect(exec).toHaveBeenCalledWith(
            '/usr/bin/docker',
            ['compose', 'port', 'db', '3316'],
            expect.objectContaining({ cwd: 'build-magento-action' }),
        )
    })

    it('copying files from container in absolute path', async () => {
        await compose.copyFrom('db', '/var/db', '/tmp/directory')

        expect(exec).toHaveBeenCalledWith('/usr/bin/docker', ['compose', 'cp', 'db:/var/db', '../directory'], {
            cwd: 'build-magento-action',
        })
    })

    it('copying files from container in relative path', async () => {
        await compose.copyFrom('db', '/var/db', './directory')

        expect(exec).toHaveBeenCalledWith('/usr/bin/docker', ['compose', 'cp', 'db:/var/db', '../directory'], {
            cwd: 'build-magento-action',
        })
    })

    it('copying files to container', async () => {
        await compose.copyTo('db', 'directory', '/var/db')

        expect(exec).toHaveBeenCalledWith('/usr/bin/docker', ['compose', 'cp', '../directory', 'db:/var/db'], {
            cwd: 'build-magento-action',
        })
    })

    it('should output message that files are getting copied from container', async () => {
        await compose.copyFrom('db', '/var/db', 'directory')

        expect(info).toHaveBeenCalledWith('Copying /var/db from db container into ../directory')
    })

    it('should output message that files are getting copied to container', async () => {
        await compose.copyTo('db', 'directory', '/var/db')

        expect(info).toHaveBeenCalledWith('Copying ../directory into db container /var/db')
    })

    it('should stop container ', async () => {
        await compose.stop('opensearch')

        expect(exec).toHaveBeenCalledWith('/usr/bin/docker', ['compose', 'stop', 'opensearch'], {
            cwd: 'build-magento-action',
        })
    })

    it('should return default compose config', async () => {
        expect(compose.composeConfig()).toEqual({
            services: {
                db: {
                    command: [
                        'mariadbd',
                        '--max_allowed_packet=1024M',
                        '--explicit_defaults_for_timestamp=on',
                        '--character_set_server=utf8mb4',
                        '--collation-server=utf8mb4_unicode_520_ci',
                    ],
                    environment: {
                        MYSQL_DATABASE: 'magento',
                        MYSQL_PASSWORD: 'magento',
                        MYSQL_ROOT_PASSWORD: 'magento',
                        MYSQL_USER: 'magento',
                    },
                    healthcheck: {
                        test: ['CMD', 'healthcheck.sh', '--connect', '--innodb_initialized'],
                        interval: '10s',
                        timeout: '5s',
                        retries: '5',
                    },
                    image: 'ghcr.io/wardenenv/mariadb:11.4',
                },
                magento: {
                    image: 'ghcr.io/wardenenv/php-fpm:8.4-magento2',
                    depends_on: {
                        db: {
                            condition: 'service_started',
                            required: true,
                        },
                    },
                    environment: {
                        COMPOSER_AUTH: '{}',
                        COMPOSER_MEMORY_LIMIT: '-1',
                        COMPOSER_NO_AUDIT: '1',
                        COMPOSER_NO_SECURITY_BLOCKING: '1',
                        COMPOSER_VERSION: '2',
                        MAGE_DEBUG_SHOW_ARGS: '1',
                        NODE_VERSION: '24',
                        TRAEFIK_DOMAIN: 'magento.test',
                        TRAEFIK_SUBDOMAIN: '',
                    },
                },
                opensearch: {
                    environment: {
                        DISABLE_SECURITY_PLUGIN: 'true',
                        OPENSEARCH_JAVA_OPTS: '-Xms64m -Xmx512m',
                        'discovery.type': 'single-node',
                    },
                    image: 'ghcr.io/wardenenv/opensearch:3',
                    ports: ['9200'],
                    volumes: ['opensearch:/usr/share/opensearch/data'],
                },
            },
            volumes: {
                opensearch: {},
            },
        })
    })
})

describe('Missing OpenSearch version', () => {
    const compose = new DockerCompose(
        {
            mariaDbVersion: '11.4',
            phpVersion: '8.4',
            composerAuth: '{}',
        },
        'magento-action',
    )

    it('should not have opensearch service when', () => {
        const config = compose.composeConfig()
        expect(config.services.opensearch).toBeUndefined()
    })

    it('should return compose config without opensearch container', () => {
        const config = compose.composeConfig()
        expect(config.volumes).toBeUndefined()
    })
})

describe('Extra configuration files', () => {
    const compose = new DockerCompose(
        {
            mariaDbVersion: '11.4',
            phpVersion: '8.4',
            composerAuth: '{}',
            extraConfigFiles: ['/action/magento-action/php.yml', '/action/magento-action/db.yml'],
        },
        'action',
    )

    vol.mkdirSync('/action/magento-action', {
        recursive: true,
    })
    vol.writeFileSync('/action/magento-action/php.yml', '')
    vol.writeFileSync('/action/magento-action/db.yml', '')

    it('passes extra files to file docker compose command', async () => {
        await compose.up()

        expect(exec).toHaveBeenCalledWith(
            '/usr/bin/docker',
            [
                'compose',
                '-f',
                './docker-compose.yml',
                '-f',
                '../../action/magento-action/php.yml',
                '-f',
                '../../action/magento-action/db.yml',
                'up',
                '-d',
                '--wait',
            ],
            {
                cwd: 'build-action',
            },
        )

        await compose.exec('opensearch', 'ls', [])

        expect(exec).toHaveBeenCalledWith(
            '/usr/bin/docker',
            [
                'compose',
                '-f',
                './docker-compose.yml',
                '-f',
                '../../action/magento-action/php.yml',
                '-f',
                '../../action/magento-action/db.yml',
                'exec',
                'opensearch',
                'ls',
            ],
            {
                cwd: 'build-action',
            },
        )

        await compose.stop('opensearch')

        expect(exec).toHaveBeenCalledWith(
            '/usr/bin/docker',
            [
                'compose',
                '-f',
                './docker-compose.yml',
                '-f',
                '../../action/magento-action/php.yml',
                '-f',
                '../../action/magento-action/db.yml',
                'stop',
                'opensearch',
            ],
            {
                cwd: 'build-action',
            },
        )
    })
})

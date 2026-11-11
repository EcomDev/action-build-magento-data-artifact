import {afterEach, beforeEach, expect, it, Mock, vi} from 'vitest'
import {vol} from 'memfs'
import {info} from '@actions/core'
import {exec, ExecOptions} from '@actions/exec'
import {DockerCompose} from './docker.js'
import {cwd} from 'node:process';

vi.mock('node:process');
vi.mock('node:fs')
vi.mock('node:fs/promises');
vi.mock('@actions/io');
vi.mock('@actions/core', () => ({
    info: vi.fn(),
    warn: vi.fn(),
    spy: true
}));

vi.mock('@actions/exec', () => ({
    exec: vi.fn(async (command: string, args: string[], options?: ExecOptions) => Promise.resolve(0)),
    which: vi.fn(async (bin: string) => Promise.resolve(`/usr/bin/${bin}`)),
    spy: true
}));

beforeEach(() => {
    // reset the state of in-memory fs
    vol.reset()
    process.cwd = vi.fn(() => '/tmp');
})

const compose = new DockerCompose(
    {
        mariaDbVersion: '11.4',
        phpVersion: '8.4',
        opensearchVersion: '3',
        composerAuth: '{}'
    },
    '/tmp/magento-action'
);


it('should create docker-compose.yml in target directory on up', async () => {
    await compose.up();
    expect(vol.existsSync('/tmp/magento-action/docker-compose.yml')).toBe(true);
});

it('should write a message that docker compose is up', async () => {
    await compose.up();
    expect(info).toHaveBeenCalledWith('Started Docker Compose in /tmp/magento-action directory');
});

it('should execute docker compose up with wait for start', async () => {
    await compose.up();

    expect(exec).toHaveBeenCalledWith(
        '/usr/bin/docker',
        ['compose', 'up', '-d', '--wait'],
        {cwd: 'magento-action'}
    );
});

it('should write a message that docker compose is stopped', async () => {
    await compose.down();
    expect(info).toHaveBeenCalledWith('Stopped Docker Compose in /tmp/magento-action directory and cleaned up data');
});

it('should delete all data in target directory after stopped', async () => {
    await compose.up();
    await compose.down();
    expect(vol.existsSync('/tmp/magento-action')).toBe(false);
});

it('should execute down with all removed volumes', async () => {
    await compose.down();
    expect(exec).toHaveBeenCalledWith(
        '/usr/bin/docker',
        ['compose', 'down', '-v'],
        {cwd: 'magento-action'}
    );
});

it('should delete all files in its directory', async () => {
    await compose.down();
    expect(vol.existsSync('/tmp/magento-action')).toBe(false);
});

it('should allow to execute command in a specific container', async () => {
    await compose.exec('opensearch', 'bash', ['--some-option']);

    expect(exec).toHaveBeenCalledWith(
        '/usr/bin/docker',
        ['compose', 'exec', 'opensearch', 'bash', '--some-option'],
        {cwd: 'magento-action'}
    );
})

it('passes output options down to command executor', async () => {
    const writeStream = vol.createWriteStream('test');
    await compose.exec('db', 'bash', ['--some-option'], {
        outStream: writeStream,
    });

    expect(exec).toHaveBeenCalledWith(
        '/usr/bin/docker',
        ['compose', 'exec', 'db', 'bash', '--some-option'],
        {cwd: 'magento-action', outStream: writeStream}
    );
})

it('returns output lines in stdout', async () => {
    vi.mocked(exec).mockImplementationOnce(
        async (command: string, args?: string[], options?: ExecOptions): Promise<number> => {
            if (options?.listeners?.stdline) {
                options.listeners.stdline('line1');
                options.listeners.stdline('line2');
                options.listeners.stdline('line3');
                options.listeners.stdline('line4');
            }
            return Promise.resolve(0)
        }
    );

    expect(await compose.execLines('db', 'mysqldump', ['--some-option']))
        .toEqual(['line1', 'line2', 'line3', 'line4']);

    expect(exec).toHaveBeenCalledWith(
        '/usr/bin/docker',
        ['compose', 'exec', 'db', 'mysqldump', '--some-option'],
        expect.objectContaining({cwd: 'magento-action'})
    );
})

it('should allow to get binding port for a container', async () => {
    (exec as Mock).mockImplementationOnce(
        async (command: string, args: string[], options?: ExecOptions): Promise<number> => {
            if (options?.listeners?.stdline) {
                options.listeners.stdline('0.0.0.0:3316');
            }
            return Promise.resolve(0)
        }
    );

    expect(await compose.binding('db', 3316)).toBe('0.0.0.0:3316');

    expect(exec).toHaveBeenCalledWith(
        '/usr/bin/docker',
        ['compose', 'port', 'db', '3316'],
        expect.objectContaining({cwd: 'magento-action'})
    );
})

it('copying files from container in absolute path', async () => {
    await compose.copyFrom('db', '/var/db', '/tmp/directory');

    expect(exec).toHaveBeenCalledWith(
        '/usr/bin/docker',
        ['compose', 'cp', 'db:/var/db', '../directory'],
        {cwd: 'magento-action'}
    );
})

it('copying files from container in relative path', async () => {
    await compose.copyFrom('db', '/var/db', './directory');

    expect(exec).toHaveBeenCalledWith(
        '/usr/bin/docker',
        ['compose', 'cp', 'db:/var/db', '../directory'],
        {cwd: 'magento-action'}
    );
});

it('should output message that files are getting copied from container', async () => {
    await compose.copyFrom('db', '/var/db', 'directory');

    expect(info).toHaveBeenCalledWith('Copying /var/db from db container into ../directory');
})

it('should stop container ', async () => {
    await compose.stop('opensearch');

    expect(exec).toHaveBeenCalledWith(
        '/usr/bin/docker',
        ['compose', 'stop', 'opensearch'],
        {cwd: 'magento-action'}
    );
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Build } from './build'
import { vol } from 'memfs'
import { DockerCompose } from './docker'
import { join } from 'node:path'

vi.mock('node:fs')
vi.mock('node:fs/promises')
vi.mock('node:process', () => ({
    cwd: vi.fn().mockReturnValue('/tmp'),
    env: {},
}))

beforeEach(() => {
    vol.reset()
    vol.mkdirSync('/tmp')
})

describe(Build, () => {
    const build = new Build({
        dockerCompose: {
            phpVersion: '8.1',
            mariaDbVersion: '11.8',
            composerAuth: '{}',
        },
        name: '2.4.9',
    })

    it('should create docker composer from passed config', () => {
        expect(build.docker).toEqual(
            new DockerCompose(
                {
                    phpVersion: '8.1',
                    mariaDbVersion: '11.8',
                    composerAuth: '{}',
                },
                '2.4.9',
            ),
        )
    })

    it('should generate unique filename', async () => {
        const output = await build.save()
        expect(output).toMatch(/^build-[0-9a-f-]{36}$/)
    })

    it('should save config file', async () => {
        const output = await build.save()
        expect(vol.existsSync(join('/tmp', output))).toBe(true)
        expect(vol.readFileSync(join('/tmp', output), 'utf-8')).toEqual(
            JSON.stringify({
                dockerCompose: {
                    phpVersion: '8.1',
                    mariaDbVersion: '11.8',
                    composerAuth: '{}',
                },
                name: '2.4.9',
            }),
        )
    })

    it('should create a build with configuration from file', async () => {
        await vol.promises.writeFile(
            '/tmp/build-config.json',
            JSON.stringify({
                dockerCompose: {
                    phpVersion: '8.2',
                    mariaDbVersion: '11.4',
                    composerAuth: '{}',
                },
                name: '2.4.8-p4',
            }),
        )

        const build = await Build.load('build-config.json')

        expect(build).toEqual(
            new Build({
                dockerCompose: {
                    phpVersion: '8.2',
                    mariaDbVersion: '11.4',
                    composerAuth: '{}',
                },
                name: '2.4.8-p4',
            }),
        )
    })

    it('should error on malformed configuration file', async () => {
        await vol.promises.writeFile('/tmp/build-config.json', 'invalid json')
        await expect(Build.load('build-config.json')).rejects.toThrow('Build configuration file is invalid')
    })

    it('should error on JSON without required properties', async () => {
        await vol.promises.writeFile('/tmp/build-config.json', '{"other": "value", "name":"test"}')
        await expect(Build.load('build-config.json')).rejects.toThrow('Build configuration file is invalid')
    })

    it('should error on JSON with non-object dockerCompose or empty name', async () => {
        await vol.promises.writeFile('/tmp/build-config.json', '{"dockerCompose": "invalid", "name":"test"}')
        await expect(Build.load('build-config.json')).rejects.toThrow('Build configuration file is invalid')

        await vol.promises.writeFile('/tmp/build-config.json', '{"dockerCompose": {}, "name":""}')
        await expect(Build.load('build-config.json')).rejects.toThrow('Build configuration file is invalid')
    })

    it('should remove saved configuration file', async () => {
        const output = await build.save()
        expect(vol.existsSync(join('/tmp', output))).toBe(true)

        await Build.remove(output)
        expect(vol.existsSync(join('/tmp', output))).toBe(false)
    })
})

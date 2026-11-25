import { afterEach, beforeEach, describe, expect, it, MockedObject, vi } from 'vitest'
import { BuildCache, ComposerCache } from './cache'
import { DockerCompose } from './docker'
import { vol } from 'memfs'
import { isFeatureAvailable, restoreCache, saveCache } from '@actions/cache'
import { info } from '@actions/core'

vi.mock('node:fs')
vi.mock('node:fs/promises')
vi.mock('node:process', () => ({
    cwd: vi.fn(() => '/tmp'),
    env: {},
}))

vi.mock('@actions/io')
vi.mock('@actions/core', () => ({
    info: vi.fn(),
}))

vi.mock('@actions/cache', () => ({
    saveCache: vi.fn(),
    restoreCache: vi.fn((dirs, key) => Promise.resolve(key)),
    isFeatureAvailable: vi.fn(() => true),
}))

afterEach(() => {
    vol.reset()
    vi.resetAllMocks()
})

let docker: DockerCompose

beforeEach(() => {
    docker = vi.mockObject(
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

describe(ComposerCache, () => {
    let cache: ComposerCache

    beforeEach(() => {
        vi.mocked(docker.execLines).mockReturnValue(Promise.resolve(['/home/www-data/.cache/composer']))
        cache = new ComposerCache(docker, 'https://repo.magento.com/')
    })

    describe('disabled cache', () => {
        it('does not load cache when feature is not available', async () => {
            vi.mocked(isFeatureAvailable).mockReturnValue(false)
            await cache.load()
            expect(restoreCache).not.toHaveBeenCalled()
            expect(vol.existsSync('/tmp/cache')).toBe(false)
        })

        it('does not save cache when feature is not available', async () => {
            vi.mocked(isFeatureAvailable).mockReturnValue(false)
            await cache.save()
            expect(saveCache).not.toHaveBeenCalled()
        })
    })

    describe('load cache enabled', () => {
        it('creates cache path on on first call', async () => {
            await cache.load()
            expect(vol.existsSync('/tmp/build-2.4.9/composer-cache')).toBe(true)
        })

        it('creates composer cache at docker container', async () => {
            await cache.load()
            expect(docker.exec).toHaveBeenCalledWith('magento', 'mkdir', ['-p', '/home/www-data/.cache/composer'])
        })

        it('loads cache from a cache key related with composer repository', async () => {
            await cache.load()
            expect(restoreCache).toHaveBeenCalledWith(
                ['/tmp/build-2.4.9/composer-cache/*'],
                'composer-cache-8.1-a3326e4921b816a2da6a6df2d4c3e3a3eac724db',
                ['composer-cache-8.1-', 'composer-cache-'],
            )
        })

        it('should copy restored cache to magento container', async () => {
            await cache.load()
            expect(docker.copyTo).toHaveBeenCalledWith(
                'magento',
                '/tmp/build-2.4.9/composer-cache',
                '/home/www-data/.cache/composer',
            )
        })

        it('should restore permissions in container', async () => {
            await cache.load()

            expect(docker.exec).toHaveBeenCalledWith(
                'magento',
                'chown',
                ['-R', 'www-data:www-data', '/home/www-data/.cache/composer'],
                { user: 'root' },
            )
        })

        it('should not restore cache when if no match found', async () => {
            vi.mocked(restoreCache).mockResolvedValue(undefined)
            await cache.load()

            expect(docker.exec).not.toHaveBeenCalledWith('magento', 'mkdir', ['-p', '/home/www-data/.cache/composer'])
            expect(docker.copyTo).not.toHaveBeenCalled()
        })

        it('should report on full key match', async () => {
            await cache.load()

            expect(info).toHaveBeenCalledWith(
                'A full composer cache is restored: composer-cache-8.1-a3326e4921b816a2da6a6df2d4c3e3a3eac724db',
            )
        })

        it('should report on partial key match', async () => {
            vi.mocked(restoreCache).mockResolvedValue('composer-cache-8.1-')

            await cache.load()

            expect(info).toHaveBeenCalledWith('A partial composer cache is restored: composer-cache-8.1-')
        })
    })

    describe('save cache enabled', () => {
        it('should copy cacheable data from magento container', async () => {
            await cache.save()
            expect(docker.copyFrom).toHaveBeenCalledWith(
                'magento',
                '/home/www-data/.cache/composer',
                '/tmp/build-2.4.9/composer-cache',
            )
        })

        it('caches to remote', async () => {
            await cache.save()
            expect(saveCache).toHaveBeenCalledWith(
                ['/tmp/build-2.4.9/composer-cache/*'],
                'composer-cache-8.1-a3326e4921b816a2da6a6df2d4c3e3a3eac724db',
            )
        })

        it('should report on saved cache', async () => {
            vi.mocked(saveCache).mockResolvedValue(123)

            await cache.save()
            expect(info).toHaveBeenCalledWith('Composer cache cache is saved with id: 123')
        })
    })

    describe('cached execute', () => {
        const callback = vi.fn(async () => {})
        let mockedCache: MockedObject<ComposerCache>
        beforeEach(() => {
            mockedCache = vi.mockObject(cache, {
                spy: true,
            })
            vi.mocked(cache.load).mockResolvedValue(false)
        })

        it('should execute action between load and save', async () => {
            await mockedCache.execute(callback)
            expect(mockedCache.load).toHaveBeenCalled()
            expect(callback).toHaveBeenCalledAfter(mockedCache.load)
            expect(mockedCache.save).toHaveBeenCalledAfter(callback)
        })

        it('should not execute save if load returns true', async () => {
            vi.mocked(cache.load).mockResolvedValue(true)
            await mockedCache.execute(callback)

            expect(callback).toHaveBeenCalledAfter(mockedCache.load)
            expect(mockedCache.save).not.toHaveBeenCalled()
        })
    })
})

describe(BuildCache, () => {
    let cache: BuildCache

    beforeEach(() => {
        cache = new BuildCache(docker, '{some input data}')
    })

    describe('disabled cache', () => {
        it('does not load cache when feature is not available', async () => {
            vi.mocked(isFeatureAvailable).mockReturnValue(false)
            await cache.load()
            expect(restoreCache).not.toHaveBeenCalled()
            expect(vol.existsSync('/tmp/build-cache')).toBe(false)
        })

        it('does not save cache when feature is not available', async () => {
            vi.mocked(isFeatureAvailable).mockReturnValue(false)
            await cache.save()
            expect(saveCache).not.toHaveBeenCalled()
        })

        it('should return false when feature is not available', async () => {
            vi.mocked(isFeatureAvailable).mockReturnValue(false)
            expect(await cache.load()).toBe(false)
        })
    })

    describe('load cache enabled', () => {
        it('creates cached path on on first call', async () => {
            await cache.load()
            expect(vol.existsSync('/tmp/build-2.4.9/cache')).toBe(true)
        })

        it('loads cache from a cache key related to build name', async () => {
            await cache.load()
            expect(restoreCache).toHaveBeenCalledWith(
                ['/tmp/build-2.4.9/cache/*', '/tmp/build-2.4.9/cache/.*'],
                'build-cache-build-2.4.9-007e1536d77d8b42208e4e8ee83360b689ca8862',
            )
        })

        it('should copy restored cache to magento container', async () => {
            vol.mkdirSync('/tmp/build-2.4.9/cache/app', { recursive: true })
            vol.mkdirSync('/tmp/build-2.4.9/cache/vendor', { recursive: true })
            vol.mkdirSync('/tmp/build-2.4.9/cache/dev', { recursive: true })
            vol.writeFileSync('/tmp/build-2.4.9/cache/.gitignore', '')

            await cache.load()

            expect(docker.copyTo).toHaveBeenCalledWith('magento', '/tmp/build-2.4.9/cache/app', '/var/www/html')
            expect(docker.copyTo).toHaveBeenCalledWith('magento', '/tmp/build-2.4.9/cache/vendor', '/var/www/html')
            expect(docker.copyTo).toHaveBeenCalledWith('magento', '/tmp/build-2.4.9/cache/dev', '/var/www/html')
            expect(docker.copyTo).toHaveBeenCalledWith('magento', '/tmp/build-2.4.9/cache/.gitignore', '/var/www/html')
        })

        it('should restore permissions in container', async () => {
            await cache.load()

            expect(docker.exec).toHaveBeenCalledWith('magento', 'chown', ['-R', 'www-data:www-data', '/var/www/html'], {
                user: 'root',
            })
        })

        it('should return true when cache is restored', async () => {
            expect(await cache.load()).toBe(true)
        })

        it('should not restore cache when if no match found', async () => {
            vi.mocked(restoreCache).mockResolvedValue(undefined)
            await cache.load()

            expect(docker.exec).not.toHaveBeenCalledWith('magento', 'mkdir', ['-p', '/tmp/build-2.4.9/cache'])
            expect(docker.copyTo).not.toHaveBeenCalled()
        })

        it('should report on data loaded from cache', async () => {
            await cache.load()

            expect(info).toHaveBeenCalledWith(
                'A build cache restored from: build-cache-build-2.4.9-007e1536d77d8b42208e4e8ee83360b689ca8862',
            )
        })
    })

    describe('save cache enabled', () => {
        it('should copy cacheable data from magento container', async () => {
            await cache.save()
            expect(docker.copyFrom).toHaveBeenCalledWith('magento', '/var/www/html', '/tmp/build-2.4.9/cache')
        })

        it('caches to remote', async () => {
            await cache.save()
            expect(saveCache).toHaveBeenCalledWith(
                ['/tmp/build-2.4.9/cache/*', '/tmp/build-2.4.9/cache/.*'],
                'build-cache-build-2.4.9-007e1536d77d8b42208e4e8ee83360b689ca8862',
            )
        })

        it('should report on saved cache', async () => {
            await cache.save()
            expect(info).toHaveBeenCalledWith(
                'A build cache saved to: build-cache-build-2.4.9-007e1536d77d8b42208e4e8ee83360b689ca8862',
            )
        })
    })

    describe('cached execute', () => {
        let mockedCache: MockedObject<BuildCache>
        const callback = vi.fn(async () => {})

        beforeEach(() => {
            mockedCache = vi.mockObject(cache, {
                spy: true,
            })
        })

        it('should not trigger callback when cache is loaded', async () => {
            vi.mocked(mockedCache.load).mockResolvedValue(true)

            await mockedCache.execute(callback)

            expect(mockedCache.load).toHaveBeenCalled()
            expect(callback).not.toHaveBeenCalled()
            expect(mockedCache.save).not.toHaveBeenCalled()
        })

        it('should trigger callback and save after cache is not loaded', async () => {
            vi.mocked(mockedCache.load).mockResolvedValue(false)

            await mockedCache.execute(callback)

            expect(mockedCache.load).toHaveBeenCalled()
            expect(callback).toHaveBeenCalledAfter(mockedCache.load)
            expect(mockedCache.save).toHaveBeenCalledAfter(callback)
        })
    })
})

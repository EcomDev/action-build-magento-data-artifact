import { DockerCompose } from './docker'
import * as actionCache from '@actions/cache'
import { mkdirP, rmRF } from '@actions/io'
import { join, basename } from 'node:path'
import { info } from '@actions/core'
import { createHash } from 'node:crypto'
import { readdir } from 'node:fs/promises'

function isCacheAvailable(): boolean {
    return !actionCache.isFeatureAvailable || actionCache.isFeatureAvailable()
}

export class ComposerCache {
    private readonly cacheDir: string
    private readonly cacheKey: string
    private readonly cacheKeys: string[]

    constructor(
        private readonly docker: DockerCompose,
        input: any,
    ) {
        this.cacheDir = join(docker.path, 'composer-cache')
        this.cacheKey = `composer-cache-${this.docker.config.phpVersion}-${hashValue(input)}`
        this.cacheKeys = [`composer-cache-${this.docker.config.phpVersion}-`, 'composer-cache-']
    }

    async load(): Promise<boolean> {
        if (!isCacheAvailable()) {
            return false
        }

        await mkdirP(this.cacheDir)
        const [composerCacheDir] = await this.docker.execLines('magento', 'composer', [
            'config',
            '--absolute',
            '--global',
            'cache-dir',
        ])

        const cacheId = await actionCache.restoreCache([join(this.cacheDir, '*')], this.cacheKey, this.cacheKeys)

        if (!cacheId) {
            return false
        }

        await prepareDstCachedDir(this.docker, composerCacheDir)
        await this.docker.copyTo('magento', this.cacheDir, composerCacheDir)
        await fixPermissions(this.docker, composerCacheDir)
        if (cacheId === this.cacheKey) {
            info(`A full composer cache is restored: ${cacheId}`)
            return true
        }

        info(`A partial composer cache is restored: ${cacheId}`)
        return false
    }

    async save() {
        if (!isCacheAvailable()) {
            return
        }

        await rmRF(this.cacheDir)

        const [composerCacheDir] = await this.docker.execLines('magento', 'composer', [
            'config',
            '--absolute',
            '--global',
            'cache-dir',
        ])

        await this.docker.copyFrom('magento', composerCacheDir, this.cacheDir)

        const cacheId = await actionCache.saveCache([join(this.cacheDir, '*')], this.cacheKey)

        info(`Composer cache cache is saved with id: ${cacheId}`)
    }

    async execute(callback: () => Promise<void>) {
        const cacheLoaded = await this.load()
        await callback()
        if (!cacheLoaded) {
            await this.save()
        }
    }
}

export class BuildCache {
    private readonly cacheDir: string
    private readonly cacheKey: string

    constructor(
        private readonly docker: DockerCompose,
        input: any,
    ) {
        this.cacheDir = join(this.docker.path, 'cache')
        this.cacheKey = `build-cache-${basename(this.docker.path)}-${hashValue(input)}`
    }

    async load(): Promise<boolean> {
        if (!isCacheAvailable()) {
            return false
        }

        await mkdirP(this.cacheDir)

        const cacheKey = await actionCache.restoreCache(
            [join(this.cacheDir, '*'), join(this.cacheDir, '.*')],
            this.cacheKey,
        )

        if (!cacheKey) {
            return false
        }

        for (const path of await readdir(this.cacheDir)) {
            await this.docker.copyTo('magento', join(this.cacheDir, path), '/var/www/html')
        }

        await fixPermissions(this.docker, '/var/www/html')

        info(`A build cache restored from: ${cacheKey}`)
        return true
    }

    async save() {
        if (!isCacheAvailable()) {
            return
        }

        await rmRF(this.cacheDir)
        await this.docker.copyFrom('magento', '/var/www/html', this.cacheDir)
        await actionCache.saveCache([join(this.cacheDir, '*'), join(this.cacheDir, '.*')], this.cacheKey)

        info(`A build cache saved to: ${this.cacheKey}`)
    }

    async execute(callback: () => Promise<void>) {
        if (await this.load()) {
            return
        }

        await callback()
        await this.save()
    }
}

function hashValue(input: any): string {
    const hash = createHash('sha1')
    hash.update(JSON.stringify(input))
    return hash.digest('hex')
}

async function prepareDstCachedDir(docker: DockerCompose, targetDir: string) {
    // Make sure full path to folder exists
    await docker.exec('magento', 'mkdir', ['-p', targetDir])
    // Make sure dest dir does not exist, so copy command does not copy inside of it
    await docker.exec('magento', 'rm', ['-rf', targetDir])
}

async function fixPermissions(docker: DockerCompose, targetDir: string) {
    await docker.exec('magento', 'chown', ['-R', 'www-data:www-data', targetDir], { user: 'root' })
}

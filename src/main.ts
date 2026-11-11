import {getBooleanInput, getInput, group, info, setFailed, setOutput, setSecret} from "@actions/core";
import {DockerCompose, DockerComposeConfig} from "./docker.js";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {installMagento, MagentoOptions} from "./magento.js";
import {mkdirP, rmRF} from "@actions/io";
import {prepareForExport} from "./opensearch.js";
import {exec} from "@actions/exec";
import {restoreCache, saveCache} from "@actions/cache";
import {DefaultArtifactClient} from "@actions/artifact";
import {dumpDatabase} from "./database.js";
import {chai} from "vitest";

function getWorkspaceDir() {
    return path.resolve(process.cwd(), process.env.GITHUB_WORKSPACE || '.');
}

export async function run(): Promise<void> {
    try {
        const composerAuthJson = JSON.parse(getInput("auth", {trimWhitespace: true}) || '{}');
        const defaultGithubToken = getInput('token');

        if (defaultGithubToken) {
            // Filter any potential secrets leaking
            setSecret(defaultGithubToken)
        }

        if (!composerAuthJson['github-oauth'] && defaultGithubToken) {
            // If composer auth does not contain a github-oauth key, add it with the default token
            composerAuthJson['github-oauth'] = {
                'github.com': defaultGithubToken
            };
        }

        const composerAuth = JSON.stringify(composerAuthJson);
        // Make sure any composer auth keys are secret in output
        setSecret(composerAuth);

        const dockerOptions: DockerComposeConfig = {
            phpVersion: getInput("php-version", {required: true, trimWhitespace: true}),
            mariaDbVersion: getInput("mariadb-version", {required: true, trimWhitespace: true}),
            opensearchVersion: getInput("opensearch-version", {required: true, trimWhitespace: true}),
            composerAuth,
        };

        const magentoImage = getInput("magento-image", {trimWhitespace: true});

        if (magentoImage) {
            dockerOptions.magentoImage = magentoImage;
        }

        const buildName = getInput("name", {trimWhitespace: true});

        const magentoOptions: MagentoOptions = {
            version: getInput("magento-version", {required: true, trimWhitespace: true}),
            metaPackage: getInput("meta-package", {trimWhitespace: true}) || 'magento/project-community-edition',
            repository: getInput("repository", {trimWhitespace: true}) || 'https://mirror.mage-os.org/',
            sampleData: getBooleanInput("sample-data", {trimWhitespace: true}),
        }

        const extraPackages = getInput("additional-packages", {trimWhitespace: true});
        if (extraPackages) {
            magentoOptions.extraPackages = JSON.parse(extraPackages);
        }

        const settings = getInput("settings", {trimWhitespace: true});
        if (settings) {
            magentoOptions.settings = JSON.parse(settings);
        }

        const outputDir = localPath('output');
        await mkdirP(outputDir);
        const cacheKey = `cache-magento-build-${buildName}`

        if (!await restoreArtifactsFromCache(outputDir, cacheKey)) {
            await group('Building Magento', () => buildMagento(dockerOptions, magentoOptions, outputDir));
            await group('Storing Cache', () => storeArtifactsInCache(outputDir, cacheKey));
        }

        const artifactClient = new DefaultArtifactClient()

        const artifact = await artifactClient.uploadArtifact(buildName, [
            path.join(outputDir, 'db.sql.gz'),
            path.join(outputDir, 'media.tgz'),
            path.join(outputDir, 'search.tgz')
        ], outputDir, {
            compressionLevel: 0
        });

        await rmRF(outputDir);

        if (artifact.id) {
            setOutput("artifact-id", artifact.id);
            setOutput("artifact-digest", artifact.digest);
            info(`Uploaded artifact ${buildName} with ID ${artifact.id} and total size ${artifact.size ?? 0 / 1024} MB`);
        } else {
            setFailed(`Failed to upload artifact ${buildName}`);
            return;
        }
    } catch (error) {
        setFailed(error.message);
    }
}

function localPath(target: string) {
    const workSpaceDir = getWorkspaceDir();
    const fullPath = path.join(workSpaceDir, target);
    return path.relative(process.cwd(), fullPath);
}

async function buildMagento(dockerOptions: DockerComposeConfig, magentoOptions: MagentoOptions, outputDir: string): Promise<void> {
    const composeDirectory = localPath(`build-${randomUUID()}`);
    const composerCache = localPath('composer-cache');
    await mkdirP(composerCache);
    const docker = new DockerCompose(dockerOptions, composeDirectory);
    await group('Setup Environment', () => docker.up());
    try {
        await restoreComposerCache(composerCache, dockerOptions.phpVersion, magentoOptions, docker);
        await group('Installing Magento', () => installMagento(docker, magentoOptions));
        await group('Copying Build Data', () => buildArtifacts(docker, outputDir));
        await storeComposerCache(composerCache, dockerOptions.phpVersion, magentoOptions, docker);
    } finally {
        await group('Removing Environment', () => docker.down());
    }
}

async function buildArtifacts(docker: DockerCompose, outputDir: string): Promise<void> {
    await group('Exporting Opensearch Data', () => prepareForExport(docker, 'magento2', outputDir));
    await group('Dumping Database', () => dumpDatabase(docker, path.join(outputDir, 'db.sql.gz')));
    await group('Dumping Media', () => dumpMedia(docker, outputDir));
}

async function restoreComposerCache(cacheDir: string, phpVersion: string, magentoOptions: MagentoOptions, docker: DockerCompose): Promise<void> {
    cacheDir = path.resolve(process.cwd(), cacheDir);
    const cacheKey = `composer-${phpVersion}-${magentoOptions.metaPackage}-${magentoOptions.version}`;

    const cacheId = await restoreCache(
        [path.join(cacheDir, '**','*')],
        cacheKey,
        [
            `composer-${phpVersion}-${magentoOptions.metaPackage}-`,
            `composer-${phpVersion}-`
        ]
    );

    if (!cacheId) {
        return;
    }

    await docker.copyTo('magento', cacheDir, '/home/www-data/.composer/cache');

    if (cacheId === cacheKey) {
        info(`A full composer cache is restored: ${cacheKey}`);
    } else {
        info(`A partial composer cache is restored: ${cacheId}`);
    }
}

async function storeComposerCache(cacheDir: string, phpVersion: string, magentoOptions: MagentoOptions, docker: DockerCompose): Promise<void> {
    cacheDir = path.resolve(process.cwd(), cacheDir);
    await rmRF(cacheDir);
    await docker.copyFrom('magento', '/home/www-data/.composer/cache', cacheDir);

    const cacheKey = `composer-${phpVersion}-${magentoOptions.metaPackage}-${magentoOptions.version}`;
    const cacheId = await saveCache([path.join(cacheDir, '**','*')], cacheKey);
    info(`Saved composer cache cache with id: ${cacheId}`);
}

async function restoreArtifactsFromCache(cacheDir: string, cacheKey: string): Promise<boolean> {
    cacheDir = path.resolve(process.cwd(), cacheDir);
    const cacheId = await restoreCache([
        path.join(cacheDir, '*.sql.gz'),
        path.join(cacheDir, '*.tgz'),
    ], cacheKey, []);
    if (cacheId === cacheKey) {
        info(`Artifact restored from cache: ${cacheKey}`);
        return true
    }

    return false
}

async function storeArtifactsInCache(cacheDir: string, cacheKey: string): Promise<void> {
    cacheDir = path.resolve(process.cwd(), cacheDir);
    const cacheId = await saveCache([
        path.join(cacheDir, '*.sql.gz'),
        path.join(cacheDir, '*.tgz'),
    ], cacheKey);
    info(`Saved cache with id: ${cacheId}`);
}

async function dumpMedia(docker: DockerCompose, outputDir: string): Promise<void> {
    await docker.copyFrom('magento', '/var/www/html/pub/media', path.join(outputDir, 'media'));
    const result = await exec('tar', ['-czf', './media.tgz', './media'], {
        cwd: outputDir
    });

    if (result !== 0) {
        throw new Error('Failed to compress media');
    }

    await rmRF(path.join(outputDir, 'media'));
}

run();
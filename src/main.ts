import {getBooleanInput, getInput, group, info, setFailed, setOutput, setSecret} from "@actions/core";
import {DockerCompose, DockerComposeConfig} from "./docker.js";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {installMagento, MagentoOptions} from "./magento.js";
import {mkdirP, rmRF} from "@actions/io";
import {prepareForExport} from "./opensearch.js";
import {open} from 'node:fs/promises';
import * as zlib from "node:zlib";
import {exec} from "@actions/exec";
import {isFeatureAvailable, restoreCache, saveCache} from "@actions/cache";
import {DefaultArtifactClient} from "@actions/artifact";

function getWorkspaceDir() {
    return process.env.GITHUB_WORKSPACE || process.cwd();
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

        const outputDir = path.join(getWorkspaceDir(), 'output');
        await mkdirP(outputDir);
        const cacheKey = `cache-magento-build-${buildName}`
        const cacheDir = path.relative(getWorkspaceDir(), outputDir);

        if (!await restoreArtifactsFromCache(cacheDir, cacheKey)) {
            await group('Building Magento', () => buildMagento(dockerOptions, magentoOptions, outputDir));
            await group('Storing Cache', () => storeArtifactsInCache(cacheDir, cacheKey));
        }

        const artifactClient = new DefaultArtifactClient()

        const artifact = await artifactClient.uploadArtifact(buildName, [
            'db.sql.gz',
            'media.tgz',
            'search.tgz'
        ], outputDir, {
            compressionLevel: 0
        });

        rmRF(outputDir);

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

async function buildMagento(dockerOptions: DockerComposeConfig, magentoOptions: MagentoOptions, outputDir: string): Promise<void> {
    const composeDirectory = path.join(getWorkspaceDir(), `build-${randomUUID()}`);
    const docker = new DockerCompose(dockerOptions, composeDirectory);
    await group('Setup Environment', () => docker.up());
    try {
        await group('Installing Magento', () => installMagento(docker, magentoOptions));
        await group('Copying Build Data', () => buildArtifacts(docker, outputDir));
    } finally {
        await group('Removing Environment', () => docker.down());
    }
}

async function buildArtifacts(docker: DockerCompose, outputDir: string): Promise<void> {
    await group('Exporting Opensearch Data', () => prepareForExport(docker, 'magento2', outputDir));
    await group('Dumping Database', () => dumpDatabase(docker, outputDir));
    await group('Dumping Media', () => dumpMedia(docker, outputDir));
}

async function restoreArtifactsFromCache(cacheDir: string, cacheKey: string): Promise<boolean> {
    if (isFeatureAvailable()) {
        return await group("Loading Magento Build Cache", async () => {
            const cacheId = await restoreCache([cacheDir], cacheKey, []);

            if (cacheId === cacheKey) {
                info(`Artifact restored from cache: ${cacheKey}`);
                return true;
            }
            return false;
        });
    }

    return false;
}

async function storeArtifactsInCache(cacheDir: string, cacheKey: string): Promise<void> {
    if (isFeatureAvailable()) {
        await group("Saving Magento Build Cache", async () => {
            const cacheId = await saveCache([cacheDir], cacheKey);
            info(`Saved cache with id: ${cacheId}`);
        });
    }
}

async function dumpDatabase(docker: DockerCompose, outputDir: string): Promise<void> {
    const outFile = await open(path.join(outputDir, 'db.sql.gz'));
    const gzip = zlib.createGzip();
    await docker.exec('db', 'mariadb-dump', ['-u', 'magento', '-pmagento', 'magento'], {
        outStream: gzip.pipe(outFile.createWriteStream())
    });
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
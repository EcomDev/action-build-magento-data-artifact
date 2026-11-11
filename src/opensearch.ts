import {DockerCompose} from "./docker.js";
import path from "node:path";
import {access, glob, stat, unlink} from "node:fs/promises";
import {exec} from "@actions/exec";
import constants from "node:constants";
import {rmRF} from "@actions/io";

export async function prepareForExport(
    docker: DockerCompose,
    indexPrefix: string,
    artifactDirectory: string
): Promise<boolean> {
    const endpoint = await docker.binding('opensearch', 9200);

    if (!endpoint) {
        return false;
    }

    const baseUrl = new URL(`http://${endpoint}/`);
    const indexPattern = `${indexPrefix}*`;
    if (!await disableIndexReplication(baseUrl, indexPattern)) {
        return false;
    }
    if (!await mergeIndexShards(baseUrl, indexPattern)) {
        return false;
    }

    await docker.stop('opensearch');
    let exportDirectory = path.join(artifactDirectory, 'search');
    await docker.copyFrom('opensearch', '/usr/share/opensearch/data',
        exportDirectory
    );

    try {
        await access(exportDirectory, constants.R_OK | constants.W_OK);
        const directoryInfo = await stat(exportDirectory);
        if (!directoryInfo.isDirectory()) {
            return false;
        }

        for await (const file of glob(`${exportDirectory}/**/*.lock`)) {
            await unlink(file);
        }

        const result = await exec('tar', ['-czf', './search.tgz', './search'], {
            cwd: artifactDirectory
        });

        if (result > 0) {
            return false;
        }

        await rmRF(exportDirectory);
    } catch {
        return false;
    }

    return true;
}

async function disableIndexReplication(baseUrl: URL, indexPattern: string) {
    const url = new URL(`${indexPattern}/_settings`, baseUrl);

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            index: {
                number_of_replicas: '0'
            }
        })
    });

    if (response.status >= 200 && response.status < 300) {
        return true;
    }

    return false;
}

async function mergeIndexShards(baseUrl: URL, indexPattern: string) {
    const url = new URL(`${indexPattern}/_forcemerge?max_num_segments=1`, baseUrl);
    const response = await fetch(url, {method: 'POST'});

    if (response.status >= 200 && response.status < 300) {
        return true;
    }

    return false;
}
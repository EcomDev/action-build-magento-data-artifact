import {DockerCompose} from "./docker.js";
import {open} from "node:fs/promises";
import zlib from "node:zlib";

export async function dumpDatabase(docker: DockerCompose, outputFile: string): Promise<void> {
    const outFile = await open(outputFile, 'w');
    const gzip = zlib.createGzip();
    const outStream = gzip.pipe(outFile.createWriteStream({encoding: "binary"}), {
        end: true
    });

    await docker.exec('db', 'mariadb-dump', ['-u', 'magento', '-pmagento', 'magento'], {
        outStream: gzip,
        silent: false
    });

    await makePromise((resolve) => gzip.end(() => resolve(undefined)));
    await makePromise((resolve) => outStream.on('finish', () => resolve(undefined)));
    await outFile.close();
}

function makePromise<T>(callback: (resolve: (value: T) => void) => void): Promise<T> {
    return new Promise(callback);
}
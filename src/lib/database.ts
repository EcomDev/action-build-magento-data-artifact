import { DockerCompose } from './docker'
import { open } from 'node:fs/promises'
import zlib from 'node:zlib'

async function dumpDatabase(docker: DockerCompose, outputFile: string): Promise<void> {
    const outFile = await open(outputFile, 'w')
    const gzip = zlib.createGzip()
    const outStream = gzip.pipe(outFile.createWriteStream({ encoding: 'binary' }), {
        end: true,
    })

    const originalWrite = gzip.write.bind(gzip)
    let isFirstWrite = true

    gzip.write = function (chunk: any, encoding?: BufferEncoding | Function, callback?: Function): boolean {
        if (isFirstWrite) {
            isFirstWrite = false
            if (typeof encoding === 'function') {
                encoding()
            } else if (typeof callback === 'function') {
                callback()
            }
            return true
        }

        // Pass the arguments back to the original strict signature
        return originalWrite(chunk, encoding as any, callback as any)
    }

    await docker.exec('db', 'mariadb-dump', ['-u', 'magento', '-pmagento', 'magento'], {
        outStream: gzip,
        silent: false,
    })

    await makePromise((resolve) => gzip.end(() => resolve(undefined)))
    await makePromise((resolve) => outStream.on('finish', () => resolve(undefined)))
    await outFile.close()
}

export default dumpDatabase

function makePromise<T>(callback: (resolve: (value: T) => void) => void): Promise<T> {
    return new Promise(callback)
}

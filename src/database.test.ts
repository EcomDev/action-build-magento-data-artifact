import { dumpDatabase } from './database.js';
import {beforeEach, expect, it, MockedObject, vi} from 'vitest';
import {DockerCompose} from "./docker.js";
import {ExecOptions} from "@actions/exec";
import {gunzipSync} from 'node:zlib';
import {vol} from 'memfs'

vi.mock('node:fs');
vi.mock('node:fs/promises');

function dockerCompose(lines: string): MockedObject<DockerCompose> {
    const mock = vi.mockObject(
        new DockerCompose(
            {
                phpVersion: '8.2',
                composerAuth: '{}',
                opensearchVersion: '2.2',
                mariaDbVersion: '10.11'
            },
            ''
        ));

    mock.exec.mockImplementation(
        async (container: string, command: string, args: string[], options?: ExecOptions): Promise<boolean> => {
            if (options?.outStream) {
                const stream = options?.outStream;
                while (!stream.write(lines)) {
                    await (new Promise((resolve) => stream.once('drain', resolve)));
                }
            }
            return true;
        }
    );

    return mock;
}

beforeEach(() => {
    vol.reset();
    vol.mkdirSync('/output');
});


it('should pipe database dump into gzip', async () => {
    const compose = dockerCompose('line1\nline2\nline3\nline4\n');

    await dumpDatabase(compose, '/output/db.sql.gz');

    expect(gunzipSync(vol.readFileSync('/output/db.sql.gz')).toString())
        .toBe('line1\nline2\nline3\nline4\n');
});

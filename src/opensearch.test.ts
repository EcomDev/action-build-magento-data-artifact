import {setupServer} from 'msw/node'
import {http, HttpResponse, StrictRequest} from 'msw/http'
import {prepareForExport} from './opensearch.js'

import {afterAll, afterEach, beforeAll, beforeEach, expect, it, MockedObject, vi} from 'vitest'
import {DockerCompose} from "./docker.js";
import {exec, ExecOptions} from "@actions/exec";
import {vol} from 'memfs'

vi.mock('node:fs');
vi.mock('node:fs/promises');
vi.mock('@actions/io');

vi.mock('@actions/exec', () => ({
    exec: vi.fn(async (command: string, args: string[], options?: ExecOptions) => Promise.resolve(0)),
    which: vi.fn(async (bin: string) => Promise.resolve(`/usr/bin/${bin}`)),
    spy: true
}));

vi.mock('@actions/io');

interface ActionParam {
    key: string;
    value: string;
}

interface Action {
    method: string;
    index: string;
    action: string;
    params: ActionParam[];
    body?: any;
}

const performedActions: Action[] = [];

const server = setupServer(
    http.all<{ index: string, action: string }>(
        'http://opensearch-success:9200/:index/:action',
        async ({request, params: {index, action}}: {
            request: StrictRequest<any>,
            params: { index: string, action: string }
        }) => {
            const url = new URL(request.url);
            const performedAction: Action = {method: request.method, index, action, params: []}
            url.searchParams.forEach((value, key) => performedAction.params.push({key, value}));

            if (request.headers.get('Content-Type') === 'application/json') {
                performedAction.body = await request.json();
            }

            performedActions.push(performedAction);

            return HttpResponse.json({acknowledged: true});
        }
    ),
    http.all<{ index: string, action: string }>(
        'http://opensearch-error:9200/:index/:action',
        async () => HttpResponse.json({error: 'error'}, {status: 400})
    )
);


beforeAll(() => server.listen({onUnhandledFrame: 'error'}))
afterAll(() => server.close())

beforeEach(() => {
    vol.reset();
    vol.mkdirSync('build/artifact/search', {recursive: true});
})

afterEach(() => {
    server.resetHandlers()
    performedActions.length = 0;
})

function dockerCompose(host): MockedObject<DockerCompose> {
    const mock = vi.mockObject(new DockerCompose(
        {
            phpVersion: '8.2',
            composerAuth: '{}',
            opensearchVersion: '2.2',
            mariaDbVersion: '10.11'
        }, `/tmp/${host}`
    ));

    mock.binding = vi.fn(async (container, port) => `${container}-${host}:${port}`);
    return mock;
}

it('updates indexer to use no replicas', async () => {
    await prepareForExport(dockerCompose('success'), 'magento2', 'build/artifact');

    expect(performedActions).toContainEqual({
        method: 'PUT',
        index: 'magento2*',
        action: '_settings',
        params: [],
        body: {
            index: {
                number_of_replicas: '0'
            }
        }
    })
})

it('forces merge on indexer', async () => {
    await prepareForExport(dockerCompose('success'), 'magento2', 'build/artifact');

    expect(performedActions).toContainEqual({
        method: 'POST',
        index: 'magento2*',
        action: '_forcemerge',
        params: [
            {key: 'max_num_segments', value: '1'}
        ]
    })
})

it('returns true when successful operation finishes', async () => {
    expect(await prepareForExport(dockerCompose('success'), 'magento2', 'build/artifact')).toEqual(true);
})

it('returns false when operation failed', async () => {
    expect(await prepareForExport(dockerCompose('error'), 'magento2', 'build/artifact')).toEqual(false);
})

it('executes docker compose stop', async () => {
    const docker = dockerCompose('success');
    await prepareForExport(docker, 'magento2', 'build/artifact');

    expect(docker.stop).toHaveBeenCalled();
})

it('copies search directory to artifact directory', async () => {
    const docker = dockerCompose('success');
    await prepareForExport(docker, 'magento2', 'build/artifact');

    expect(docker.copyFrom).toHaveBeenCalledWith(
        'opensearch',
        '/usr/share/opensearch/data',
        'build/artifact/search'
    );
})

it('creates archive from downloaded search directory', async () => {
    const docker = dockerCompose('success');
    expect(await prepareForExport(docker, 'magento2', 'build/artifact')).toEqual(true);
    expect(exec).toHaveBeenCalledWith('tar', ['-czf', './search.tgz', './search'], {
        cwd: 'build/artifact'
    });
    expect(exec).toHaveBeenCalledAfter(docker.copyFrom);
})

it('fails if copy does not create search directory', async () => {
    const docker = dockerCompose('success');
    vol.rmdirSync('build', {recursive: true});

    expect(await prepareForExport(docker, 'magento2', 'build/artifact')).toEqual(false);

    expect(exec).not.toHaveBeenCalled();
})

it('cleans up search directory after archive creation', async () => {
    const docker = dockerCompose('success');
    await prepareForExport(docker, 'magento2', 'build/artifact');
    expect(vol.existsSync('build/artifact/search')).toEqual(false);
})


it('does not cleans up search if archive creation failed', async () => {
    const docker = dockerCompose('success');
    vi.mocked(exec).mockImplementationOnce(() => Promise.resolve(1));
    await prepareForExport(docker, 'magento2', 'build/artifact');
    expect(exec).toHaveBeenCalledWith('tar', ['-czf', './search.tgz', './search'], {cwd: 'build/artifact'});
    expect(vol.existsSync('build/artifact/search')).toEqual(true);
})

it('removes lock files from search directory', async () => {
    const docker = dockerCompose('success');
    vol.mkdirSync('build/artifact/search/index1');
    vol.mkdirSync('build/artifact/search/index2');
    vol.mkdirSync('build/artifact/search/index4/some/dir', {recursive: true});
    vol.writeFileSync('build/artifact/search/index1/index.lock', '');
    vol.writeFileSync('build/artifact/search/index4/some/dir/index.lock', '');
    vi.mocked(exec).mockImplementationOnce(() => Promise.resolve(1));

    await prepareForExport(docker, 'magento2', '/build/artifact');

    expect(vol.existsSync('build/artifact/search/index1')).toEqual(true)
    expect(vol.existsSync('build/artifact/search/index2')).toEqual(true)
    expect(vol.existsSync('build/artifact/search/index4/some/dir')).toEqual(true)
    expect(vol.existsSync('build/artifact/search/index1/index.lock')).toEqual(false)
    expect(vol.existsSync('build/artifact/search/index4/some/dir/index.lock')).toEqual(false)
})
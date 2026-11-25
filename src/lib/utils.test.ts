import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildDirectory, relativePath, workspaceDirectory, workspacePath } from './utils'
import { cwd, env } from 'node:process'

vi.mock('node:process', () => {
    return {
        cwd: vi.fn().mockReturnValue('/current-directory/'),
        env: {
            GITHUB_WORKSPACE: undefined,
        },
    }
})

afterEach(() => {
    vi.restoreAllMocks()
    env.GITHUB_WORKSPACE = undefined
})

describe(buildDirectory, () => {
    it('should use current workspace directory', () => {
        expect(buildDirectory('directory')).toBe('/current-directory/build-directory')
        env.GITHUB_WORKSPACE = '/workspace-directory/'
        expect(buildDirectory('two-directory')).toBe('/workspace-directory/build-two-directory')
    })

    it('should sanitize build name', () => {
        env.GITHUB_WORKSPACE = '/'

        expect(buildDirectory('two-directory')).toBe('/build-two-directory')
        expect(buildDirectory('two-directory/')).toBe('/build-two-directory-')
        expect(buildDirectory('two-directory/with/slashes')).toBe('/build-two-directory-with-slashes')
        expect(buildDirectory('two-directory:with"$chars')).toBe('/build-two-directory-with--chars')
        expect(buildDirectory('../two.directory')).toBe('/build--two.directory')
    })
})

describe(workspaceDirectory, () => {
    it('should return path to cwd', () => {
        expect(workspaceDirectory()).toBe('/current-directory')
    })
    it('should return directory path to GITHUB_WORKSPACE if it is set', () => {
        env.GITHUB_WORKSPACE = '/workspace-directory/'
        expect(workspaceDirectory()).toBe('/workspace-directory')
    })
    it('should resolve directory path to GITHUB_WORKSPACE relative to cwd', () => {
        env.GITHUB_WORKSPACE = '../workspace-directory/'
        expect(workspaceDirectory()).toBe('/workspace-directory')
    })
})

describe(relativePath, () => {
    it('should use current cwd by default', () => {
        vi.mocked(cwd).mockReturnValue('/some/working/other')
        expect(relativePath('/some/value')).toBe('../../value')
    })
    it('should allow custom cwd location as second argument', () => {
        vi.mocked(cwd).mockReturnValue('/some/working/other')
        expect(relativePath('/some/value', '/some/third/other/subdir')).toBe('../../../value')
    })

    it('should allow relative file paths', () => {
        vi.mocked(cwd).mockReturnValue('/some/working/other')
        expect(relativePath('value')).toBe('value')
    })
})

describe(workspacePath, () => {
    it('should return path in current workspace directory', () => {
        env.GITHUB_WORKSPACE = '/some/working/directory'
        expect(workspacePath('path')).toBe('/some/working/directory/path')
    })
    it('should not use workspace directory if path is absolute', () => {
        env.GITHUB_WORKSPACE = '/some/working/directory'
        vi.mocked(cwd).mockReturnValue('/some/working/other')
        expect(workspacePath('/absolute/path')).toBe('/absolute/path')
    })
})

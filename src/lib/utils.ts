import path from 'node:path'
import { cwd, env } from 'node:process'

const reservedChars = /([\/?<>\\:|"'$]|\.\.\/|\.\/)/g

export function sanitize(value: string): string {
    return value.replaceAll(reservedChars, '-')
}

export function buildDirectory(buildName: string): string {
    return path.join(workspaceDirectory(), `build-${sanitize(buildName)}`)
}

export function workspaceDirectory(): string {
    return path.resolve(cwd(), env.GITHUB_WORKSPACE || '.')
}

export function relativePath(value: string, currentDir?: string): string {
    if (!path.isAbsolute(value)) {
        return value
    }

    return path.relative(currentDir ?? cwd(), value)
}

export function workspacePath(value: string): string {
    return path.isAbsolute(value) ? value : path.join(workspaceDirectory(), value)
}

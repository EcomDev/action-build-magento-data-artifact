import { setSecret } from '@actions/core'

export function createComposerAuth(composerAuth: string, token: string): string {
    if (composerAuth.length === 0 && token.length === 0) {
        return '{}'
    }

    if (composerAuth.length > 0) {
        setSecret(composerAuth)
    }

    if (token.length > 0) {
        setSecret(token)
    }

    try {
        const auth = JSON.parse(composerAuth.length > 0 ? composerAuth : '{}')
        if (token) {
            auth['github-oauth'] ??= {}
            auth['github-oauth']['github.com'] ??= token
        }

        setSecret(JSON.stringify(auth))
        return JSON.stringify(auth)
    } catch (error) {
        throw new Error('Invalid JSON supplied for composer auth')
    }
}

import { expect, it, vi } from 'vitest'
import { createComposerAuth } from './composer-auth'
import { setSecret } from '@actions/core'

vi.mock('@actions/core', () => ({
    setSecret: vi.fn(),
}))

it('should return empty auth when input is not present', () => {
    expect(createComposerAuth('', '')).toEqual('{}')
})

it('adds github auth entry when token is provided', () => {
    expect(createComposerAuth('', 'some-token-value')).toEqual('{"github-oauth":{"github.com":"some-token-value"}}')
})

it('appends github token to existing auth json', () => {
    expect(createComposerAuth('{"repo": "somevalue"}', 'some-token-value')).toEqual(
        '{"repo":"somevalue","github-oauth":{"github.com":"some-token-value"}}',
    )
})

it('keeps original auth token if provided', () => {
    expect(createComposerAuth('{"github-oauth":{"github.com":"original-token-value"}}', 'some-token-value')).toEqual(
        '{"github-oauth":{"github.com":"original-token-value"}}',
    )
})

it('validates that auth is a valid JSON', () => {
    expect(() => createComposerAuth('invalid-json', 'some-token-value')).toThrow(
        'Invalid JSON supplied for composer auth',
    )
})

it('hides secret composer auth', () => {
    createComposerAuth('{"github-oauth":{"github.com":"original-token-value"}}', 'some-token-value')
    expect(setSecret).toHaveBeenCalledWith('{"github-oauth":{"github.com":"original-token-value"}}')
    expect(setSecret).toHaveBeenCalledWith('some-token-value')
})

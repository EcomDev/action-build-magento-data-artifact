import { expect, it } from 'vitest'
import { buildArguments } from './command-arguments'

it('builds empty list when object empty', () => {
    expect(buildArguments({})).toEqual([])
})

it('builds string values in arguments', () => {
    expect(buildArguments({ foo: 'bar', test: 'value' })).toEqual(['--foo', 'bar', '--test', 'value'])
})

it('converts boolean value as a flag', () => {
    expect(buildArguments({ foo: true, test: false, text: 'value' })).toEqual(['--foo', '--text', 'value'])
})

it('converts number value to string', () => {
    expect(buildArguments({ 'some-option': 1.01 })).toEqual(['--some-option', '1.01'])
})

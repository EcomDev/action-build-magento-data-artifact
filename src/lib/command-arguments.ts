export interface CommandArguments {
    [name: string]: string | boolean | number
}

export function buildArguments(args: CommandArguments): string[] {
    const result: string[] = []
    for (const [name, value] of Object.entries(args)) {
        if (value === true) {
            result.push(`--${name}`)
            continue
        }

        if (value === false) {
            // Skip false or overridden value
            continue
        }

        result.push(`--${name}`, value.toString())
    }
    return result
}

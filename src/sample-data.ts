import semver from 'semver';

const defaultVersions: { [magentoVersion: string]: string } = {
    "2.4.5": "100.4.1",
    "2.4.6": "100.4.2",
    "2.4.7": "100.4.3",
    "2.4.8": "100.4.4",
    "2.4.9": "100.4.5",
    "2.4.10": "100.4.5",
}

const SAMPLE_DATA_REGEX = /(?<module>\S+): Sample Data version: (?<version>\S+)/

interface SampleDataPackages {
    [packageName: string]: string;
}

export function sampleDataVersion(magentoVersion: string, suggestedVersion: string): string {
    magentoVersion = semver.coerce(magentoVersion)!.toString();

    if (magentoVersion in defaultVersions && semver.satisfies(defaultVersions[magentoVersion], suggestedVersion)) {
        return defaultVersions[magentoVersion];
    }

    return suggestedVersion;
}

export function extractSampleDataFromSuggestOutput(suggestOutput: string[], magentoVersion: string): SampleDataPackages {
    const versions = {}

    for (const line of suggestOutput) {
        const match = line.match(SAMPLE_DATA_REGEX);
        if (match?.groups) {
            const moduleName = match.groups!.module;
            versions[moduleName] = moduleName != "magento/sample-data-media"
                ? sampleDataVersion(magentoVersion, match.groups!.version)
                : match.groups!.version;
        }
    }

    return versions;
}
# Create Magento Application (`build-create-project`)

Creates the Magento (or Mage-OS / Adobe Commerce) codebase inside `/var/www/html/` of the `magento` container using `composer create-project`, optionally installs sample data and additional Composer packages, and caches both Composer downloads and the assembled project tree in GitHub Actions cache.

## How Caching Works

1. **Build Cache (`build-cache-build-<name>-<hash>`)**: Caches `/var/www/html` keyed by the build name and project options (`magento-version`, `meta-package`, `repository`, `sample-data`, `stability`, `additional-packages`, `no-dev`). On a cache hit, `composer create-project` is skipped completely and files are restored directly into the container with `www-data:www-data` ownership.
2. **Composer Cache (`composer-cache-<php-version>-<hash>`)**: When the build cache misses, restores global Composer archive cache before running Composer and saves updated cache entries afterward.

## Usage

### Magento Open Source with Sample Data

```yaml
      - name: Create Magento Project
        uses: ecomdev/action-build-magento-data-artifact/build-create-project@v2.0.0
        with:
          config-file: ${{ steps.init.outputs.config-file }}
          magento-version: '2.4.9'
          sample-data: 'true'
```

### Mage-OS or Custom Repository with Extra Packages

```yaml
      - name: Create Mage-OS Project
        uses: ecomdev/action-build-magento-data-artifact/build-create-project@v2.0.0
        with:
          config-file: ${{ steps.init.outputs.config-file }}
          meta-package: mage-os/project-community-edition
          repository: https://repo.mage-os.org/
          magento-version: '3.6.0'
          no-dev: 'false'
          additional-packages: |
            {
              "vendor/custom-module": "^2.0.0"
            }
```

## Inputs

| Input | Required | Default | Description |
| --- | :---: | --- | --- |
| `config-file` | **Yes** | — | Path to the build configuration file exported by `build-init` (`steps.<init-id>.outputs.config-file`). |
| `magento-version` | **Yes** | — | Version of the meta-package to install (e.g., `2.4.9`, `2.4.8-p5`, `3.6.0`). |
| `no-dev` | No | `'true'` | Omit development dependencies (`--no-dev` for `create-project` and `--update-no-dev` for `composer require`). |
| `sample-data` | No | `'false'` | Automatically discover sample data packages via `composer suggest` and require matching versions (`true` / `false`). |
| `meta-package` | No | `magento/project-community-edition` | Composer meta-package used in `composer create-project`. |
| `repository` | No | `https://mirror.mage-os.org/` | Composer repository URL passed via `--repository-url`. |
| `additional-packages` | No | `'{}'` | JSON object mapping Composer package names to version constraints (string values) to require after `create-project`. |
| `stability` | No | `stable` | Preferred Composer stability (`stable`, `beta`, `alpha`, `RC`, `dev`). |

## Outputs

This action does not produce outputs.

## Related Actions

- Previous step: [`build-init`](../build-init/README.md)
- Next step: [`build-install`](../build-install/README.md)
- Overview: [Root README](../README.md)

# Build Magento Data Artifact

A GitHub Action that installs a specified version of Magento (or Mage-OS / Adobe Commerce) inside an isolated Docker Compose environment and exports ready-to-use data artifacts for testing, CI/CD pipelines, or local development environments.

## Overview

During execution, this action:

1. Checks GitHub Actions cache (`cache-magento-build-<name>`) for an existing build matching the artifact `name`.
2. If not cached:
   - Starts a temporary Docker Compose stack (`db`, `magento`, `opensearch`) using [Warden](https://warden.dev/) container images.
   - Restores Composer cache (`composer-<php-version>-<meta-package>-<magento-version>`) when available.
   - Creates the Magento project via Composer (`composer create-project`).
   - Optionally discovers and installs matching Magento sample data packages (`sample-data: true`) and/or `additional-packages`.
   - Runs `bin/magento setup:install`, applies any custom `settings` via `bin/magento config:set`, sets indexers to `schedule` mode, and runs `bin/magento indexer:reindex`.
   - Optimizes OpenSearch indices (sets replicas to `0` and force-merges segments), stops the OpenSearch container, and archives its data directory.
   - Dumps and compresses the MariaDB database and `pub/media` directory.
   - Saves Composer cache and build artifacts to GitHub Actions cache.
3. Uploads the generated files as a GitHub Actions workflow artifact named `<name>`.

## Generated Artifact Contents

The uploaded GitHub Actions artifact contains three archives:

| File | Description |
| --- | --- |
| `db.sql.gz` | Gzip-compressed MariaDB SQL dump of the installed `magento` database. |
| `media.tgz` | Tarball (`tar -czf`) of `/var/www/html/pub/media` (`./media`). |
| `search.tgz` | Tarball (`tar -czf`) of OpenSearch data (`/usr/share/opensearch/data` as `./search`) with `.lock` files removed and shards force-merged. |

## Usage

### Basic Example

```yaml
name: Build Magento Data

on:
  workflow_dispatch:
  push:
    branches: [main]

jobs:
  build-data:
    runs-on: ubuntu-latest
    steps:
      - name: Build Magento 2.4.9 Data Artifact
        id: build
        uses: ecomdev/action-build-magento-data-artifact@v1
        with:
          name: magento-2.4.9-sampledata
          magento-version: '2.4.9'
          php-version: '8.4'
          mariadb-version: '11.8'
          opensearch-version: '3.0'
          sample-data: 'true'

      - name: Download Built Artifact
        uses: actions/download-artifact@v8
        with:
          artifact-ids: ${{ steps.build.outputs.artifact-id }}
          path: ./magento-data
```

### Matrix Build Example

```yaml
jobs:
  build-magento:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        sample-data: ['true', 'false']
        magento-version: ['2.4.9', '2.4.8-p5', '2.4.7-p10']
        include:
          - magento-version: '2.4.9'
            php-version: '8.5'
            mariadb-version: '11.8'
            opensearch-version: '3.0'
          - magento-version: '2.4.8-p5'
            php-version: '8.3'
            mariadb-version: '11.4'
            opensearch-version: '3.0'
          - magento-version: '2.4.7-p10'
            php-version: '8.2'
            mariadb-version: '10.11'
            opensearch-version: '2.19'
    steps:
      - name: Build Magento Artifact
        id: build
        uses: ecomdev/action-build-magento-data-artifact@v1
        with:
          magento-version: ${{ matrix.magento-version }}
          php-version: ${{ matrix.php-version }}
          mariadb-version: ${{ matrix.mariadb-version }}
          opensearch-version: ${{ matrix.opensearch-version }}
          sample-data: ${{ matrix.sample-data }}
          name: ${{ case(fromJSON(matrix.sample-data), format('{0}-sampledata', matrix.magento-version), matrix.magento-version) }}
```

### Custom Repository, Packages, and Magento Settings

By default, the action uses the public Mage-OS mirror (`https://mirror.mage-os.org/`), which requires no authentication for Magento Open Source releases. To use `https://repo.magento.com/`, a private Satis/Packagist repository, extra Composer packages, or custom `bin/magento config:set` values:

```yaml
      - name: Build Custom Magento Artifact
        uses: ecomdev/action-build-magento-data-artifact@v1
        with:
          name: magento-2.4.8-custom
          magento-version: '2.4.8-p5'
          php-version: '8.3'
          mariadb-version: '11.4'
          opensearch-version: '3.0'
          repository: https://repo.magento.com/
          auth: ${{ secrets.COMPOSER_AUTH }}
          additional-packages: |
            {
              "vendor/custom-module": "^1.2.0"
            }
          settings: |
            {
              "catalog/price/scope": "1",
              "catalog/search/engine": "opensearch"
            }
```

## Inputs

| Input | Required | Default | Description |
| --- | :---: | --- | --- |
| `name` | **Yes** | — | Name of the artifact to produce (also used in the build cache key `cache-magento-build-<name>`). |
| `magento-version` | **Yes** | — | Version of Magento to install (e.g., `2.4.9`, `2.4.8-p5`, `2.4.7-p10`). |
| `php-version` | **Yes** | — | Version of the PHP container (e.g., `8.2`, `8.3`, `8.4`, `8.5`). |
| `mariadb-version` | **Yes** | — | Version tag of the `docker.io/wardenenv/mariadb` container (e.g., `10.11`, `11.4`, `11.8`). |
| `opensearch-version` | **Yes** | — | Version tag of the `docker.io/wardenenv/opensearch` container (e.g., `2.19`, `3.0`). |
| `sample-data` | No | `'false'` | Whether to automatically discover and install Magento sample data packages (`true` / `false`). |
| `settings` | No | `''` | JSON object of key-value pairs to configure via `bin/magento config:set <key> <value>` after installation (e.g., `{"catalog/price/scope":"1"}`). |
| `additional-packages` | No | `'{}'` | JSON object of additional Composer packages and version constraints to install before `setup:install` (e.g., `{"vendor/package":"1.0.0"}`). |
| `meta-package` | No | `magento/project-community-edition` | Composer meta-package for installation. |
| `repository` | No | `https://mirror.mage-os.org/` | Composer repository URL used for `composer create-project`. |
| `stability` | No | `stable` | Preferred stability for Composer packages. |
| `magento-image` | No | `docker.io/wardenenv/php-fpm:%PHP_VERSION%-magento2` | Custom PHP-FPM Docker image to use. `%PHP_VERSION%` is replaced with the `php-version` input. |
| `auth` | No | `'{}'` | JSON string for `COMPOSER_AUTH` (e.g., `{"http-basic":{"repo.magento.com":{"username":"...","password":"..."}}}`). |
| `token` | No | `${{ github.token }}` | GitHub token automatically injected into `COMPOSER_AUTH` under `github-oauth.github.com` when not already specified in `auth`. |

## Outputs

| Output | Description |
| --- | --- |
| `artifact-id` | ID of the uploaded GitHub Actions data artifact. |
| `artifact-digest` | SHA-256 digest of the uploaded GitHub Actions data artifact. |

## Requirements

- **Runner Environment**: Linux GitHub Actions runner (such as `ubuntu-latest`) with Docker and Docker Compose v2 (`docker compose`) installed and running.
- **Node.js Runtime**: Executed via GitHub Actions `node24` runtime.

## Development

### Install Dependencies

```bash
npm clean-install
```

### Run Unit Tests

```bash
npm test
```

### Bundle Action (`dist/`)

Whenever files under `src/` are modified, rebuild the bundled distribution and license files:

```bash
npm run build
```

### Run Action Locally

You can test the action locally using `@github/local-action`:

1. Copy `.env.example` to `.env` and adjust the input variables and local paths (`LOCAL_ACTION_WORKSPACE`, `LOCAL_ACTION_ARTIFACT_PATH`, `LOCAL_ACTION_CACHE_PATH`).
2. Run:

```bash
npx @github/local-action . src/main.ts .env
```

## License

Licensed under the [Apache License, Version 2.0](./LICENSE). Copyright © EcomDev B.V.

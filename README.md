# Build Magento Data Artifact

A GitHub Action (and suite of composable multi-stage sub-actions) that installs a specified version of Magento Open Source, Mage-OS, or Adobe Commerce inside an isolated Docker Compose environment and exports ready-to-use data artifacts for testing, CI/CD pipelines, or local development environments.

## Overview

You can use this repository in two ways:

1. **Single-Step Action (`ecomdev/action-build-magento-data-artifact@v2.0.0`)** — Runs the entire build lifecycle (Docker setup, `composer create-project`, `setup:install`, reindexing, data export, artifact upload, and container cleanup) in one step.
2. **Multi-Stage Sub-Actions (`ecomdev/action-build-magento-data-artifact/build-*@v2.0.0`)** — Breaks the build into composable steps so you can attach custom Docker Compose services, run custom CLI/database commands, import fixtures, or export extra archives before uploading the final artifact.

During a full build, the workflow:

1. Starts an isolated Docker Compose stack (`db`, `magento`, and optionally `opensearch`) using [Warden](https://warden.dev/) container images (`ghcr.io/wardenenv/*`).
2. Checks GitHub Actions cache (`build-cache-build-<name>-<hash>`) for a cached project directory matching the build `name` and Composer options, or restores Composer cache (`composer-cache-<php-version>-<hash>`) and runs `composer create-project`.
3. Optionally discovers and installs matching Magento sample data packages (`sample-data: true`) and/or `additional-packages`.
4. Runs `bin/magento setup:install` and applies any custom `settings` via `bin/magento config:set`.
5. Sets indexers to `schedule` mode and runs `bin/magento indexer:reindex`.
6. Optimizes OpenSearch indices (sets replicas to `0` and force-merges segments), stops the OpenSearch container, and archives its data directory (when `opensearch-version` is configured).
7. Dumps and compresses the MariaDB database and `pub/media` directory.
8. Uploads the generated archives as a GitHub Actions workflow artifact and cleans up the Docker environment.

## Generated Artifact Contents

The uploaded GitHub Actions artifact contains up to three archives (plus any custom `.tgz`/`.gz` files placed in the output directory during a multi-stage build):

| File | Description |
| --- | --- |
| `db.sql.gz` | Gzip-compressed MariaDB SQL dump of the installed `magento` database. |
| `media.tgz` | Tarball (`tar -czf`) of `/var/www/html/pub/media` (`./media`). |
| `search.tgz` | Tarball (`tar -czf`) of OpenSearch data (`/usr/share/opensearch/data` as `./search`) with `.lock` files removed and shards force-merged (included when `opensearch-version` is provided). |

## Multi-Stage Build Actions

When you need fine-grained control between installation, customization, indexing, and export, compose the individual sub-actions:

| Action | Description | Documentation |
| --- | --- | --- |
| `build-init` | Initializes the Docker Compose environment (`db`, `magento`, optional `opensearch`, and custom `compose-files`) and registers automatic post-job cleanup. | [build-init/README.md](./build-init/README.md) |
| `build-create-project` | Creates the Magento project via Composer (`composer create-project`), installs sample data / extra packages, and manages build & Composer caches. | [build-create-project/README.md](./build-create-project/README.md) |
| `build-install` | Runs `bin/magento setup:install` and applies post-install `bin/magento config:set` settings. | [build-install/README.md](./build-install/README.md) |
| `build-exec` | Executes arbitrary commands inside any container in the build environment (e.g., `bin/magento`, `composer`, custom scripts). | [build-exec/README.md](./build-exec/README.md) |
| `build-reindex` | Switches Magento indexers to `schedule` mode and runs `bin/magento indexer:reindex`. | [build-reindex/README.md](./build-reindex/README.md) |
| `build-dump` | Exports `db.sql.gz`, `search.tgz`, and `media.tgz` into the build's artifact output directory. | [build-dump/README.md](./build-dump/README.md) |
| `build-artifact` | Uploads all `.tgz` and `.gz` archives from the build's output directory as a GitHub Actions artifact. | [build-artifact/README.md](./build-artifact/README.md) |

### Multi-Stage Workflow Example

```yaml
jobs:
  build-custom-artifact:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      - name: Initialize Build Environment
        id: init
        uses: ecomdev/action-build-magento-data-artifact/build-init@v2.0.0
        with:
          name: magento-2.4.9-custom
          php-version: '8.4'
          mariadb-version: '11.8'
          opensearch-version: '3.0'

      - name: Create Magento Project
        uses: ecomdev/action-build-magento-data-artifact/build-create-project@v2.0.0
        with:
          config-file: ${{ steps.init.outputs.config-file }}
          magento-version: '2.4.9'
          sample-data: 'true'

      - name: Install Magento
        uses: ecomdev/action-build-magento-data-artifact/build-install@v2.0.0
        with:
          config-file: ${{ steps.init.outputs.config-file }}
          magento-version: '2.4.9'

      - name: Run Custom Magento Commands
        uses: ecomdev/action-build-magento-data-artifact/build-exec@v2.0.0
        with:
          config-file: ${{ steps.init.outputs.config-file }}
          command: bin/magento
          command-arguments: |
            deploy:mode:set
            production
            --skip-compilation

      - name: Reindex Magento
        uses: ecomdev/action-build-magento-data-artifact/build-reindex@v2.0.0
        with:
          config-file: ${{ steps.init.outputs.config-file }}

      - name: Dump Magento Data
        uses: ecomdev/action-build-magento-data-artifact/build-dump@v2.0.0
        with:
          config-file: ${{ steps.init.outputs.config-file }}

      - name: Upload Artifact
        id: artifact
        uses: ecomdev/action-build-magento-data-artifact/build-artifact@v2.0.0
        with:
          config-file: ${{ steps.init.outputs.config-file }}
```

## Single-Step Usage

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
        uses: ecomdev/action-build-magento-data-artifact@v2.0.0
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
        uses: ecomdev/action-build-magento-data-artifact@v2.0.0
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
        uses: ecomdev/action-build-magento-data-artifact@v2.0.0
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

## Inputs (Single-Step Action)

| Input | Required | Default | Description |
| --- | :---: | --- | --- |
| `name` | **Yes** | — | Name of the artifact to produce (also used to scope the build directory and cache key). |
| `magento-version` | **Yes** | — | Version of Magento to install (e.g., `2.4.9`, `2.4.8-p5`, `2.4.7-p10`). |
| `php-version` | **Yes** | — | Version of the PHP container (e.g., `8.2`, `8.3`, `8.4`, `8.5`). |
| `mariadb-version` | **Yes** | — | Version tag of the `ghcr.io/wardenenv/mariadb` container (e.g., `10.11`, `11.4`, `11.8`). |
| `opensearch-version` | No | `''` | Version tag of the `ghcr.io/wardenenv/opensearch` container (e.g., `2.19`, `3.0`). If omitted, OpenSearch container startup and `search.tgz` export are skipped. |
| `no-dev` | No | `'true'` | Whether to omit Composer development dependencies (`--no-dev` / `--update-no-dev`). |
| `sample-data` | No | `'false'` | Whether to automatically discover and install Magento sample data packages (`true` / `false`). |
| `install-arguments` | No | `''` | JSON object of extra CLI options (with string values) passed to `bin/magento setup:install` (e.g., `{"currency":"EUR","language":"de_DE"}`). |
| `settings` | No | `''` | JSON object of key-value pairs to configure via `bin/magento config:set <key> <value>` after installation (e.g., `{"catalog/price/scope":"1"}`). |
| `meta-package` | No | `magento/project-community-edition` | Composer meta-package for installation. |
| `repository` | No | `https://mirror.mage-os.org/` | Composer repository URL used for `composer create-project`. |
| `additional-packages` | No | `'{}'` | JSON object of additional Composer packages and version constraints to install before `setup:install` (e.g., `{"vendor/package":"1.0.0"}`). |
| `stability` | No | `stable` | Preferred stability for Composer packages. |
| `magento-image` | No | `ghcr.io/wardenenv/php-fpm:%PHP_VERSION%-magento2` | Custom PHP-FPM Docker image to use. `%PHP_VERSION%` is replaced with the `php-version` input. |
| `auth` | No | `'{}'` | JSON string for `COMPOSER_AUTH` (e.g., `{"http-basic":{"repo.magento.com":{"username":"...","password":"..."}}}`). |
| `token` | No | `${{ github.token }}` | GitHub token automatically injected into `COMPOSER_AUTH` under `github-oauth.github.com` when not already specified in `auth`. |

## Outputs (Single-Step Action)

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

### Bundle Actions (`dist/`)

Whenever files under `src/` are modified, rebuild all action bundles and license files:

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

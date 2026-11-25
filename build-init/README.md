# Initialize Magento Build Environment (`build-init`)

Starts an isolated Docker Compose environment for building a Magento data artifact in a multi-stage workflow and exports a `config-file` path consumed by subsequent `build-*` actions.

At the end of the job, `build-init` automatically runs a `post` cleanup step that stops all Docker Compose containers, removes Docker volumes and temporary build files, and deletes the generated configuration file.

## Containers Started

| Service | Image | Description |
| --- | --- | --- |
| `db` | `ghcr.io/wardenenv/mariadb:<mariadb-version>` | MariaDB server initialized with database/user/password `magento`. |
| `magento` | `ghcr.io/wardenenv/php-fpm:<php-version>-magento2` (or custom `magento-image`) | PHP-FPM + Composer 2 + Node 24 container configured with `COMPOSER_AUTH`. |
| `opensearch` | `ghcr.io/wardenenv/opensearch:<opensearch-version>` | Single-node OpenSearch instance with security plugin disabled (started only when `opensearch-version` is provided). |

## Usage

### Basic Example

```yaml
      - uses: actions/checkout@v7

      - name: Initialize Magento Build Environment
        id: init
        uses: ecomdev/action-build-magento-data-artifact/build-init@v2.0.0
        with:
          name: magento-2.4.9
          php-version: '8.4'
          mariadb-version: '11.8'
          opensearch-version: '3.0'
```

> **Important:** If your job uses `actions/checkout`, run it **before** `build-init`. `build-init` writes its temporary Docker Compose directory and state configuration file into `GITHUB_WORKSPACE`, which a later `actions/checkout` step would clean up.

### Extending the Environment with Extra Compose Files

Use `compose-files` (one path per line, relative to `GITHUB_WORKSPACE` or absolute) to add extra services (such as Redis/Valkey) or override container settings:

```yaml
      - name: Initialize Build Environment with Redis
        id: init
        uses: ecomdev/action-build-magento-data-artifact/build-init@v2.0.0
        with:
          name: magento-2.4.9-redis
          php-version: '8.4'
          mariadb-version: '11.8'
          opensearch-version: '3.0'
          auth: ${{ secrets.COMPOSER_AUTH }}
          compose-files: |
            .github/compose/redis.yml
            .github/compose/php-overrides.yml
```

## Inputs

| Input | Required | Default | Description |
| --- | :---: | --- | --- |
| `name` | **Yes** | — | Build name (also used as the default artifact name in `build-artifact` and to scope the `build-<name>` working directory). |
| `mariadb-version` | **Yes** | — | Version tag of the `ghcr.io/wardenenv/mariadb` container (e.g., `10.11`, `11.4`, `11.8`). |
| `php-version` | **Yes** | — | Version of the PHP container (e.g., `8.2`, `8.3`, `8.4`, `8.5`). |
| `opensearch-version` | No | `''` | Version tag of the `ghcr.io/wardenenv/opensearch` container (e.g., `2.19`, `3.0`). If omitted, the `opensearch` service is not started and OpenSearch export is skipped in `build-dump` (if installing Magento 2.4+ without OpenSearch, override `search-engine` via `install-arguments` in `build-install` or provide your own search container via `compose-files`). |
| `magento-image` | No | `ghcr.io/wardenenv/php-fpm:%PHP_VERSION%-magento2` | Custom PHP-FPM Docker image. `%PHP_VERSION%` is replaced with `php-version`. |
| `auth` | No | `'{}'` | JSON string for `COMPOSER_AUTH` (automatically masked in logs). |
| `token` | No | `${{ github.token }}` | GitHub token automatically injected into `COMPOSER_AUTH` under `github-oauth.github.com` when not already set in `auth`. |
| `compose-files` | No | `''` | Newline-separated list of additional Docker Compose files merged on top of the generated `docker-compose.yml`. |

## Outputs

| Output | Description |
| --- | --- |
| `config-file` | Path to the generated build configuration file to pass to `build-create-project`, `build-install`, `build-exec`, `build-reindex`, `build-dump`, and `build-artifact`. |

## Related Actions

- Next step: [`build-create-project`](../build-create-project/README.md)
- Overview: [Root README](../README.md)

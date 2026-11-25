# Install Magento Application (`build-install`)

Runs `bin/magento setup:install` inside the `magento` container against an already created Magento codebase (such as one created by `build-create-project` or copied/mounted into `/var/www/html`) and optionally applies post-installation configuration values via `bin/magento config:set`.

## Default `setup:install` Parameters

By default, `build-install` configures connection parameters matching the `build-init` Docker Compose services:

- Database: `--db-host db --db-name magento --db-user magento --db-password magento`
- Admin path: `--backend-frontname backend`
- Search engine:
  - **Magento `>= 2.4.6`**: `--search-engine opensearch --opensearch-host opensearch --opensearch-port 9200 --opensearch-index-prefix magento2 --opensearch-enable-auth 0 --opensearch-timeout 15`
  - **Magento `< 2.4.6`**: `--search-engine elasticsearch7 --elasticsearch-host opensearch --elasticsearch-port 9200 --elasticsearch-index-prefix magento2 --elasticsearch-enable-auth 0 --elasticsearch-timeout 15`

Any keys supplied in `install-arguments` override these defaults. If `install-arguments` sets `"search-engine"` to a value other than `"opensearch"`, the default OpenSearch/Elasticsearch host parameters are omitted automatically.

## Usage

### Standard Installation

```yaml
      - name: Install Magento
        uses: ecomdev/action-build-magento-data-artifact/build-install@v2.0.0
        with:
          config-file: ${{ steps.init.outputs.config-file }}
          magento-version: '2.4.9'
```

### Custom Install Arguments and Post-Install Settings

Both `install-arguments` and `settings` accept JSON objects with **string** values:

```yaml
      - name: Install Magento with Custom Locale and Settings
        uses: ecomdev/action-build-magento-data-artifact/build-install@v2.0.0
        with:
          config-file: ${{ steps.init.outputs.config-file }}
          magento-version: '2.4.9'
          install-arguments: |
            {
              "base-url": "http://magento.test/",
              "language": "de_DE",
              "currency": "EUR",
              "timezone": "Europe/Amsterdam",
              "use-rewrites": "1"
            }
          settings: |
            {
              "catalog/price/scope": "1",
              "web/seo/use_rewrites": "1"
            }
```

> **Note:** If you change `"opensearch-index-prefix"` in `install-arguments`, pass the same value to `opensearch-index-prefix` in [`build-dump`](../build-dump/README.md).

## Inputs

| Input | Required | Default | Description |
| --- | :---: | --- | --- |
| `config-file` | **Yes** | — | Path to the build configuration file exported by `build-init` (`steps.<init-id>.outputs.config-file`). |
| `magento-version` | **Yes** | — | Version of Magento being installed (used to select OpenSearch vs Elasticsearch CLI flags for `< 2.4.6`). |
| `install-arguments` | No | `''` | JSON object of string key-value pairs passed as `--<key> <value>` flags to `bin/magento setup:install`. |
| `settings` | No | `''` | JSON object of string key-value pairs applied after installation via `bin/magento config:set <key> <value>`. |

## Outputs

This action does not produce outputs.

## Related Actions

- Previous step: [`build-create-project`](../build-create-project/README.md)
- Next steps: [`build-exec`](../build-exec/README.md), [`build-reindex`](../build-reindex/README.md)
- Overview: [Root README](../README.md)

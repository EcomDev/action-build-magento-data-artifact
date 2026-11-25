# Dump Magento Data (`build-dump`)

Exports the Magento database, OpenSearch indices (when configured), and `pub/media` files into compressed archives inside the build's artifact output directory (`<workspace>/build-<name>/artifact-output`).

## Exported Archives

1. **`db.sql.gz`**: Streams `mariadb-dump -u magento -pmagento magento` from the `db` container through gzip compression.
2. **`search.tgz`** *(when `opensearch-version` was set in `build-init`)*: Sets `index.number_of_replicas` to `0` and force-merges indices matching `<opensearch-index-prefix>*` to a single segment (`max_num_segments=1`), stops the `opensearch` container, copies `/usr/share/opensearch/data`, removes `*.lock` files, and archives `./search` into `search.tgz`.
3. **`media.tgz`**: Copies `/var/www/html/pub/media` from the `magento` container and archives `./media` into `media.tgz`.

> **Important:** Because `build-dump` stops the `opensearch` container to snapshot index files cleanly, run all steps that interact with OpenSearch (such as `build-reindex` or catalog `build-exec` commands) **before** `build-dump`.

If the `GITHUB_ARTIFACTS` environment variable is set to a file path, `build-dump` also appends each generated archive path (one per line) to that file.

## Usage

### Standard Dump

```yaml
      - name: Dump Magento Data
        id: dump
        uses: ecomdev/action-build-magento-data-artifact/build-dump@v2.0.0
        with:
          config-file: ${{ steps.init.outputs.config-file }}
```

### Adding Custom Archives Before `build-artifact`

`build-artifact` uploads every `.tgz` and `.gz` file found in `output-directory`, so you can place additional archives alongside `db.sql.gz`, `media.tgz`, and `search.tgz`:

```yaml
      - name: Dump Magento Data
        id: dump
        uses: ecomdev/action-build-magento-data-artifact/build-dump@v2.0.0
        with:
          config-file: ${{ steps.init.outputs.config-file }}
          opensearch-index-prefix: custom_prefix

      - name: Export Custom Config Archive
        run: tar -czf "${{ steps.dump.outputs.output-directory }}/env-config.tgz" -C ./fixtures env.php
```

## Inputs

| Input | Required | Default | Description |
| --- | :---: | --- | --- |
| `config-file` | **Yes** | — | Path to the build configuration file exported by `build-init` (`steps.<init-id>.outputs.config-file`). |
| `opensearch-index-prefix` | No | `magento2` | OpenSearch index prefix configured during `setup:install` (matches `<prefix>*` when optimizing shards). |

## Outputs

| Output | Description |
| --- | --- |
| `output-directory` | Path to the directory containing the exported `.tgz` / `.gz` archive files. |
| `files` | Newline-separated list of exported archive file paths. |

## Related Actions

- Previous step: [`build-reindex`](../build-reindex/README.md)
- Next step: [`build-artifact`](../build-artifact/README.md)
- Overview: [Root README](../README.md)

# Reindex Magento (`build-reindex`)

Configures all Magento indexers to `schedule` ("Update by Schedule") mode and runs a full reindex inside the `magento` container:

1. `bin/magento indexer:set-mode schedule`
2. `bin/magento indexer:reindex`

Run this step after `build-install` and any custom data/fixture steps (`build-exec`), and before `build-dump`, so that both MariaDB index tables and OpenSearch indices are up to date in the exported data artifact.

## Usage

```yaml
      - name: Reindex Magento
        uses: ecomdev/action-build-magento-data-artifact/build-reindex@v2.0.0
        with:
          config-file: ${{ steps.init.outputs.config-file }}
```

## Inputs

| Input | Required | Default | Description |
| --- | :---: | --- | --- |
| `config-file` | **Yes** | — | Path to the build configuration file exported by `build-init` (`steps.<init-id>.outputs.config-file`). |

## Outputs

This action does not produce outputs.

## Related Actions

- Previous steps: [`build-install`](../build-install/README.md), [`build-exec`](../build-exec/README.md)
- Next step: [`build-dump`](../build-dump/README.md)
- Overview: [Root README](../README.md)

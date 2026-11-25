# Execute Command (`build-exec`)

Executes an arbitrary command inside a container of the Magento build environment initialized by `build-init`.

This step can be used multiple times at any point in a multi-stage workflow—for example, to configure Composer plugins before `build-create-project`, enable/disable modules, generate static content, import custom fixtures after `build-install`, or run SQL scripts inside the `db` container.

## Usage

### Run a `bin/magento` Command

Pass each CLI argument on its own line in `command-arguments`:

```yaml
      - name: Enable Modules and Upgrade Setup
        uses: ecomdev/action-build-magento-data-artifact/build-exec@v2.0.0
        with:
          config-file: ${{ steps.init.outputs.config-file }}
          command: bin/magento
          command-arguments: |
            setup:upgrade
            --keep-generated
```

### Run a Command as `root` or in Another Container

```yaml
      - name: Fix Custom Directory Ownership
        uses: ecomdev/action-build-magento-data-artifact/build-exec@v2.0.0
        with:
          config-file: ${{ steps.init.outputs.config-file }}
          container: magento
          user: root
          command: chown
          command-arguments: |
            -R
            www-data:www-data
            /var/www/html/pub/media

      - name: Run Custom SQL in MariaDB
        uses: ecomdev/action-build-magento-data-artifact/build-exec@v2.0.0
        with:
          config-file: ${{ steps.init.outputs.config-file }}
          container: db
          command: mariadb
          command-arguments: |
            -umagento
            -pmagento
            magento
            -e
            UPDATE core_config_data SET value = '1' WHERE path = 'catalog/frontend/flat_catalog_category';
```

## Inputs

| Input | Required | Default | Description |
| --- | :---: | --- | --- |
| `config-file` | **Yes** | — | Path to the build configuration file exported by `build-init` (`steps.<init-id>.outputs.config-file`). |
| `command` | **Yes** | — | Executable or script to run inside the target container (e.g., `bin/magento`, `composer`, `php`, `bash`). |
| `command-arguments` | No | `''` | Arguments passed to `command`, specified one argument per line (empty lines are ignored). |
| `container` | No | `magento` | Docker Compose service name to run the command in (`magento`, `db`, `opensearch`, or any service defined via `compose-files`). |
| `user` | No | `''` | Optional container user to run the command as (`docker compose exec -u <user>`, e.g., `root`). Defaults to the container image's default user (`www-data` in `magento`). |

## Outputs

This action does not produce outputs.

## Related Actions

- Previous steps: [`build-init`](../build-init/README.md), [`build-install`](../build-install/README.md)
- Next step: [`build-reindex`](../build-reindex/README.md)
- Overview: [Root README](../README.md)

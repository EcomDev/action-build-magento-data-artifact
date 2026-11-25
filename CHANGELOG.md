# Changelog

## [2.0.0](https://github.com/EcomDev/action-build-magento-data-artifact/compare/v1.4.0...v2.0.0) (2026-11-25)


### ⚠ BREAKING CHANGES

* Project with `--no-dev` flag by default
* Removed Artifact Caching

### Features

* Add no-dev configuration option to reduce size of the code build ([d3f8cc4](https://github.com/EcomDev/action-build-magento-data-artifact/commit/d3f8cc414fb92471d0d3f4ffedee3539e9f8fe18))
* Added cache to composer install action ([ac2bfb0](https://github.com/EcomDev/action-build-magento-data-artifact/commit/ac2bfb04f202ea241af1f04244e8b789e48faaa9))
* Composable multi-stage build actions ([d4c8a73](https://github.com/EcomDev/action-build-magento-data-artifact/commit/d4c8a73d8615772d96ee1c842155ed7593de6b23))
* Decoupled cache and artifacts ([ac2bfb0](https://github.com/EcomDev/action-build-magento-data-artifact/commit/ac2bfb04f202ea241af1f04244e8b789e48faaa9))
* MariaDB built-in health check ([740774b](https://github.com/EcomDev/action-build-magento-data-artifact/commit/740774b21b0eb02ac649f231279f193f097f7eb8))
* Project with `--no-dev` flag by default ([d3f8cc4](https://github.com/EcomDev/action-build-magento-data-artifact/commit/d3f8cc414fb92471d0d3f4ffedee3539e9f8fe18))
* Removed Artifact Caching ([ac2bfb0](https://github.com/EcomDev/action-build-magento-data-artifact/commit/ac2bfb04f202ea241af1f04244e8b789e48faaa9))
* Specify user for exec command in container ([d3f8cc4](https://github.com/EcomDev/action-build-magento-data-artifact/commit/d3f8cc414fb92471d0d3f4ffedee3539e9f8fe18))


### Bug Fixes

* clean install dist update ([5b33120](https://github.com/EcomDev/action-build-magento-data-artifact/commit/5b331209743a1bb494c1f486b7142c33ec488b31))
* Composer cache not working ([ac2bfb0](https://github.com/EcomDev/action-build-magento-data-artifact/commit/ac2bfb04f202ea241af1f04244e8b789e48faaa9))
* Permissions on restoring data from cache ([d3f8cc4](https://github.com/EcomDev/action-build-magento-data-artifact/commit/d3f8cc414fb92471d0d3f4ffedee3539e9f8fe18))

## [1.4.0](https://github.com/EcomDev/action-build-magento-data-artifact/compare/v1.3.0...v1.4.0) (2026-11-18)


### Features

* make build output cache optional ([f1cfc5c](https://github.com/EcomDev/action-build-magento-data-artifact/commit/f1cfc5cf411c21ba2049f58941813170e5c7ce02))


### Bug Fixes

* remove command name output from sql dump ([b0b76de](https://github.com/EcomDev/action-build-magento-data-artifact/commit/b0b76de42cc5161260ce924c7c2655474cdd1642))

## [1.3.0](https://github.com/EcomDev/action-build-magento-data-artifact/compare/v1.2.1...v1.3.0) (2026-11-17)


### Features

* migrate build images to ghcr.io ([f211a25](https://github.com/EcomDev/action-build-magento-data-artifact/commit/f211a2542673a3d6b806019cc3458efc04b9da4e))
* migrate build images to ghcr.io ([#14](https://github.com/EcomDev/action-build-magento-data-artifact/issues/14)) ([92c4061](https://github.com/EcomDev/action-build-magento-data-artifact/commit/92c4061d82f435362a5a55d5399e5a27a4c0fadc))

## [1.2.1](https://github.com/EcomDev/action-build-magento-data-artifact/compare/v1.2.0...v1.2.1) (2026-11-17)


### Bug Fixes

* stability was not passed to install command ([c87e26e](https://github.com/EcomDev/action-build-magento-data-artifact/commit/c87e26e1dad6240cb5f7c6892652b09ecf8ff3b1))

## [1.2.0](https://github.com/EcomDev/action-build-magento-data-artifact/compare/v1.1.1...v1.2.0) (2026-11-16)


### Features

* Mage-OS support ([c51f453](https://github.com/EcomDev/action-build-magento-data-artifact/commit/c51f45393794995c213db5b0e96edff14479ba80))
* Mage-OS support ([#10](https://github.com/EcomDev/action-build-magento-data-artifact/issues/10)) ([740c65c](https://github.com/EcomDev/action-build-magento-data-artifact/commit/740c65cd6cbd578c6fe0059711089792c0a06ada))

## [1.1.1](https://github.com/EcomDev/action-build-magento-data-artifact/compare/v1.1.0...v1.1.1) (2026-11-12)


### Bug Fixes

* make sure that proper release action action is used ([e62dac9](https://github.com/EcomDev/action-build-magento-data-artifact/commit/e62dac92876176c27e0b8e7f76eb2d146dcc3383))

## [1.1.0](https://github.com/EcomDev/action-build-magento-data-artifact/compare/v1.0.0...v1.1.0) (2026-11-12)


### Features

* add Magento install routine ([0b2653a](https://github.com/EcomDev/action-build-magento-data-artifact/commit/0b2653a3e69cb30c273b4c14aff31df261193037))
* add sample data helper ([c0ab657](https://github.com/EcomDev/action-build-magento-data-artifact/commit/c0ab65730b653fbb472b033ca73cefb2540cf0b9))
* base action scaffolding ([a4342be](https://github.com/EcomDev/action-build-magento-data-artifact/commit/a4342be0008dd1a3610f0bc7529664bd86d58271))
* composer cache directory auto detection ([68457be](https://github.com/EcomDev/action-build-magento-data-artifact/commit/68457bed9b68a2e17d4260eb9d421bd5d3789180))
* docker compose helper for action ([b579304](https://github.com/EcomDev/action-build-magento-data-artifact/commit/b5793048ad3f8ca939bedd16c1ad10c5fda6d117))
* initial setup of action scaffolding ([8f161e1](https://github.com/EcomDev/action-build-magento-data-artifact/commit/8f161e1877dcdf8c546f1332e742438d60c950c4))
* opensearch export features ([e65c4ab](https://github.com/EcomDev/action-build-magento-data-artifact/commit/e65c4aba4529a13484a7aab3c84784533c79c6b1))
* working action with ci testing ([9a1eccf](https://github.com/EcomDev/action-build-magento-data-artifact/commit/9a1eccfc7791980a25fa1a55456454344bc7dcf6))


### Bug Fixes

* action implementation to use proper file paths. ([83fe7c4](https://github.com/EcomDev/action-build-magento-data-artifact/commit/83fe7c49fcc1e59f8e0c214f43a6d89077d9429d))
* move composer cache from bind into copy from container ([cbe1864](https://github.com/EcomDev/action-build-magento-data-artifact/commit/cbe18644bf5b1f8a53be0be13592198f7470a0ca))
* name of the dist out for action ([69662d0](https://github.com/EcomDev/action-build-magento-data-artifact/commit/69662d08131526476dedd6ef1937985a81143612))
* tag name prefix contains package name ([17297df](https://github.com/EcomDev/action-build-magento-data-artifact/commit/17297df877bb782cf04a0303bdf9987ad0e1e2d0))
* tag name prefix contains package name ([#7](https://github.com/EcomDev/action-build-magento-data-artifact/issues/7)) ([cbcf181](https://github.com/EcomDev/action-build-magento-data-artifact/commit/cbcf181890b6e6c0e2bc87a03844824e1a7b83c0))

## 1.0.0 (2026-11-12)


### Features

* add Magento install routine ([0b2653a](https://github.com/EcomDev/action-build-magento-data-artifact/commit/0b2653a3e69cb30c273b4c14aff31df261193037))
* add sample data helper ([c0ab657](https://github.com/EcomDev/action-build-magento-data-artifact/commit/c0ab65730b653fbb472b033ca73cefb2540cf0b9))
* base action scaffolding ([a4342be](https://github.com/EcomDev/action-build-magento-data-artifact/commit/a4342be0008dd1a3610f0bc7529664bd86d58271))
* composer cache directory auto detection ([68457be](https://github.com/EcomDev/action-build-magento-data-artifact/commit/68457bed9b68a2e17d4260eb9d421bd5d3789180))
* docker compose helper for action ([b579304](https://github.com/EcomDev/action-build-magento-data-artifact/commit/b5793048ad3f8ca939bedd16c1ad10c5fda6d117))
* initial setup of action scaffolding ([8f161e1](https://github.com/EcomDev/action-build-magento-data-artifact/commit/8f161e1877dcdf8c546f1332e742438d60c950c4))
* opensearch export features ([e65c4ab](https://github.com/EcomDev/action-build-magento-data-artifact/commit/e65c4aba4529a13484a7aab3c84784533c79c6b1))
* working action with ci testing ([9a1eccf](https://github.com/EcomDev/action-build-magento-data-artifact/commit/9a1eccfc7791980a25fa1a55456454344bc7dcf6))


### Bug Fixes

* action implementation to use proper file paths. ([83fe7c4](https://github.com/EcomDev/action-build-magento-data-artifact/commit/83fe7c49fcc1e59f8e0c214f43a6d89077d9429d))
* move composer cache from bind into copy from container ([cbe1864](https://github.com/EcomDev/action-build-magento-data-artifact/commit/cbe18644bf5b1f8a53be0be13592198f7470a0ca))
* name of the dist out for action ([69662d0](https://github.com/EcomDev/action-build-magento-data-artifact/commit/69662d08131526476dedd6ef1937985a81143612))

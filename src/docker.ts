import {mkdirP, rmRF, which} from "@actions/io";
import {writeFile} from 'node:fs/promises';
import path, {join} from 'node:path';
import {info} from "@actions/core";
import {exec, ExecOptions} from "@actions/exec";

export type DockerComposeConfig = {
    mariaDbVersion: string,
    phpVersion: string,
    opensearchVersion: string,
    composerAuth: string,
    magentoImage?: string
}

export class DockerCompose {
    private dockerPath?: string;

    constructor(
        private config: DockerComposeConfig,
        private path: string,
        private cachePath?: string
    ) {
    }

    async up(): Promise<void> {
        await mkdirP(this.path);
        await this.generateComposeConfig();
        const result = await this.dockerComposeCommand('up', ['-d', '--wait']);
        if (result !== 0) {
            throw new Error(`Failed to start Docker Compose in ${this.path} directory`);
        }
        info(`Started Docker Compose in ${this.path} directory`);
    }

    async stop(container: string): Promise<void> {
        await this.dockerComposeCommand('stop', [container]);
    }

    async down(): Promise<void> {
        await this.dockerComposeCommand('down', ['-v']);
        await rmRF(this.path);
        info(`Stopped Docker Compose in ${this.path} directory and cleaned up data`);
    }

    async exec(container: string, command: string, args: string[], options?: ExecOptions) {
        const result = await this.dockerComposeCommand('exec', [container, command, ...args], options);

        if (result > 0) {
            throw new Error(`Failed to execute command ${command} in container ${container}`);
        }

        return true;
    }

    async execLines(container: string, command: string, args: string[]): Promise<string[]> {
        const lines: string[] = [];

        await this.exec(container, command, args, {listeners: {stdline: (line) => lines.push(line)}});

        return lines;
    }

    async binding(container: string, port: number): Promise<string | boolean> {
        let binding = '';
        const exitCode = await this.dockerComposeCommand('port', [container, port.toString()], {
            listeners: {
                stdline: (line) => binding = line
            }
        });

        if (exitCode === 0) {
            return binding;
        }
        return false;
    }

    async copyFrom(container: string, containerDirectory: string, localDirectory: string) {
        if (!path.isAbsolute(localDirectory)) {
            localDirectory = path.resolve(process.cwd(), localDirectory);
        }

        const relativeLocalDirectory = path.relative(this.path, localDirectory);

        info(`Copying ${containerDirectory} from ${container} container into ${relativeLocalDirectory}`);

        const exitCode = await this.dockerComposeCommand(
            'cp', [`${container}:${containerDirectory}`, relativeLocalDirectory]
        );

        return exitCode === 0;
    }

    private async generateComposeConfig(): Promise<void> {
        const magentoImage = (this.config.magentoImage ?? `docker.io/wardenenv/php-fpm:%PHP_VERSION%-magento2`)
            .replace('%PHP_VERSION%', this.config.phpVersion);

        await writeFile(
            join(this.path, 'docker-compose.yml'),
            `services:
  db:
    command:
      - mariadbd
      - --max_allowed_packet=1024M
      - --explicit_defaults_for_timestamp=on
      - --character_set_server=utf8mb4
      - --collation-server=utf8mb4_unicode_520_ci
    environment:
      MYSQL_DATABASE: magento
      MYSQL_PASSWORD: magento
      MYSQL_ROOT_PASSWORD: magento
      MYSQL_USER: magento
    image: docker.io/wardenenv/mariadb:${this.config.mariaDbVersion}
    healthcheck:
      timeout: 120s
      test: mariadb -umagento -pmagento magento -e 'select 1'
  magento:
    depends_on:
      db:
        condition: service_started
        required: true
    environment:
      COMPOSER_MEMORY_LIMIT: "-1"
      COMPOSER_NO_SECURITY_BLOCKING: 1 # Disable security blocking for Composer as we might install older Magento versions
      COMPOSER_NO_AUDIT: 1 # Disable security audit for Composer as we might install older Magento versions
      COMPOSER_VERSION: "2"
      COMPOSER_AUTH: ${JSON.stringify(this.config.composerAuth)}
      MAGE_DEBUG_SHOW_ARGS: "1"
      TRAEFIK_DOMAIN: "magento.test"
      TRAEFIK_SUBDOMAIN: ""
      NODE_VERSION: "24"
    image: ${magentoImage}
    volumes:
      - ${this.cachePath ?? './composer-cache/'}:/home/www-data/.composer/cache
    healthcheck:
      test: bash -c "[ -f /usr/bin/composer ]"
  opensearch:
    environment:
      DISABLE_SECURITY_PLUGIN: "true"
      OPENSEARCH_JAVA_OPTS: -Xms64m -Xmx512m
      discovery.type: single-node
    ports:
      - 9200
    image: docker.io/wardenenv/opensearch:${this.config.opensearchVersion}
    volumes:
      - opensearch:/usr/share/opensearch/data
volumes:
  opensearch:
`
        );
    }

    private async dockerCommand(args: string[], execOptions?: ExecOptions): Promise<number> {
        if (!this.dockerPath) {
            this.dockerPath = await which('docker');
        }

        return await exec(this.dockerPath, args, Object.assign(execOptions || {}, {
            cwd: path.relative(process.cwd(), this.path)
        }));
    }

    private async dockerComposeCommand(command: string, args: string[], execOptions?: ExecOptions): Promise<number> {
        return this.dockerCommand(['compose', command, ...args], execOptions);
    }
}
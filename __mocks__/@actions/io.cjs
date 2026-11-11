const {fs} = require("memfs");

module.exports = {
    mkdirP: async (path) => {
        await fs.promises.mkdir(path, {recursive: true});
    },
    rmRF: async (path) => {
        await fs.promises.rm(path, {recursive: true, force: true});
    },
    which: async (bin) => Promise.resolve(`/usr/bin/${bin}`),
}
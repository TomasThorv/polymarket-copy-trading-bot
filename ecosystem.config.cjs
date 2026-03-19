module.exports = {
    apps: [
        {
            name: 'polymarket-bot',
            script: 'dist/index.js',
            cwd: __dirname,
            instances: 1,
            autorestart: true,
            watch: false,
            max_restarts: 10,
            restart_delay: 5000,
            time: true,
            env: {
                NODE_ENV: 'production',
            },
        },
    ],
};
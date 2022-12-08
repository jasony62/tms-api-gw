module.exports = {
  apps: [
    {
      name: 'tms-api-gw-jh',
      script: './app.js',
      instances: 1,
      autorestart: true,
      watch: true,
      ignore_watch: ['node_modules', 'tests', 'example'],
      max_memory_restart: '1G'
    }
  ]
}

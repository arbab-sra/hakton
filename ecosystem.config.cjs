module.exports = {
  apps: [
    {
      name: "codemri-web",
      script: "pnpm",
      args: "run start",
      cwd: "./apps/web",
      interpreter: "none",
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    },
    {
      name: "codemri-worker",
      script: "pnpm",
      args: "run start",
      cwd: "./apps/worker",
      interpreter: "none",
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};

#!/usr/bin/env tsx

/**
 * Monitoring Setup Script for IxStats v1.42
 * Configures monitoring, alerting, and logging infrastructure
 */

import { exit } from "process";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

/**
 * Print colored output
 */
function print(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Print section header
 */
function printHeader(title: string) {
  console.log("\n" + "=".repeat(60));
  print(`  ${title}`, "cyan");
  console.log("=".repeat(60) + "\n");
}

/**
 * Send Discord webhook notification
 */
async function sendDiscordNotification(
  webhookUrl: string,
  title: string,
  message: string,
  level: "info" | "success" | "warning" | "error" = "info"
): Promise<boolean> {
  const colors = {
    info: 3447003, // Blue
    success: 3066993, // Green
    warning: 16776960, // Yellow
    error: 15158332, // Red
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        embeds: [
          {
            title,
            description: message,
            color: colors[level],
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });

    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Test Discord webhook
 */
async function testDiscordWebhook(): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const webhookEnabled = process.env.DISCORD_WEBHOOK_ENABLED;

  if (!webhookUrl || webhookEnabled !== "true") {
    print("⚠️  Discord webhook not configured", "yellow");
    return false;
  }

  print("Testing Discord webhook...", "blue");

  const success = await sendDiscordNotification(
    webhookUrl,
    "🔧 Monitoring Setup Test",
    `IxStats monitoring system is being configured.\nTimestamp: ${new Date().toLocaleString()}\nEnvironment: ${process.env.NODE_ENV || "development"}`,
    "info"
  );

  if (success) {
    print("✅ Discord webhook test successful", "green");
    return true;
  } else {
    print("❌ Discord webhook test failed", "red");
    return false;
  }
}

/**
 * Create monitoring dashboard configuration
 */
function createDashboardConfig(): string {
  const config = {
    name: "IxStats Production Monitoring",
    version: "1.42",
    created: new Date().toISOString(),
    metrics: {
      system: {
        enabled: true,
        interval: 60000, // 1 minute
        metrics: ["cpu_usage", "memory_usage", "disk_usage", "network_io"],
      },
      application: {
        enabled: true,
        interval: 30000, // 30 seconds
        metrics: ["request_rate", "response_time", "error_rate", "active_connections"],
      },
      database: {
        enabled: true,
        interval: 60000, // 1 minute
        metrics: ["query_time", "connection_pool", "slow_queries", "database_size"],
      },
    },
    alerts: {
      error_rate: {
        threshold: 5, // 5% error rate
        window: 300000, // 5 minutes
        severity: "high",
        notification: ["discord", "log"],
      },
      response_time: {
        threshold: 3000, // 3 seconds
        window: 300000, // 5 minutes
        severity: "medium",
        notification: ["discord"],
      },
      cpu_usage: {
        threshold: 80, // 80%
        window: 300000, // 5 minutes
        severity: "medium",
        notification: ["discord", "log"],
      },
      memory_usage: {
        threshold: 85, // 85%
        window: 300000, // 5 minutes
        severity: "high",
        notification: ["discord", "log"],
      },
      disk_usage: {
        threshold: 90, // 90%
        window: 3600000, // 1 hour
        severity: "high",
        notification: ["discord", "log"],
      },
      database_errors: {
        threshold: 1, // Any database error
        window: 60000, // 1 minute
        severity: "critical",
        notification: ["discord", "log"],
      },
    },
    logging: {
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
      format: "json",
      rotation: {
        enabled: true,
        maxSize: "100M",
        maxFiles: 10,
        compress: true,
      },
      destinations: [
        {
          type: "file",
          path: "./logs/application.log",
          level: "info",
        },
        {
          type: "file",
          path: "./logs/error.log",
          level: "error",
        },
        {
          type: "console",
          level: process.env.NODE_ENV === "production" ? "warn" : "debug",
        },
      ],
    },
  };

  return JSON.stringify(config, null, 2);
}

/**
 * Create rate limiting monitoring rules
 */
function createRateLimitingMonitor(): string {
  const config = {
    name: "Rate Limiting Monitoring",
    version: "1.42",
    endpoints: [
      {
        path: "/api/trpc/*",
        limits: {
          perMinute: 100,
          perHour: 1000,
          perDay: 10000,
        },
        alertThreshold: 0.9, // Alert at 90% of limit
      },
      {
        path: "/api/auth/*",
        limits: {
          perMinute: 20,
          perHour: 100,
          perDay: 500,
        },
        alertThreshold: 0.8, // Alert at 80% of limit
      },
    ],
    alerts: {
      limitApproaching: {
        enabled: true,
        notification: ["discord"],
        message: "Rate limit approaching for {endpoint}: {percentage}% of limit reached",
      },
      limitExceeded: {
        enabled: true,
        notification: ["discord", "log"],
        message: "Rate limit exceeded for {endpoint}: {count} requests blocked",
      },
    },
  };

  return JSON.stringify(config, null, 2);
}

/**
 * Create error tracking configuration
 */
function createErrorTrackingConfig(): string {
  const config = {
    name: "Error Tracking Configuration",
    version: "1.42",
    categories: {
      authentication: {
        severity: "high",
        notify: true,
        keywords: ["auth", "clerk", "session", "login"],
      },
      database: {
        severity: "critical",
        notify: true,
        keywords: ["prisma", "database", "query", "connection"],
      },
      api: {
        severity: "medium",
        notify: true,
        keywords: ["trpc", "api", "endpoint", "request"],
      },
      ui: {
        severity: "low",
        notify: false,
        keywords: ["react", "component", "render"],
      },
    },
    reporting: {
      interval: 3600000, // 1 hour
      summary: true,
      grouping: "by-category",
      notifications: {
        discord: {
          enabled: true,
          threshold: 5, // Alert after 5 errors in category
        },
      },
    },
  };

  return JSON.stringify(config, null, 2);
}

/**
 * Create performance monitoring configuration
 */
function createPerformanceConfig(): string {
  const config = {
    name: "Performance Monitoring Configuration",
    version: "1.42",
    metrics: {
      coreWebVitals: {
        enabled: true,
        targets: {
          LCP: 2500, // Largest Contentful Paint (ms)
          FID: 100, // First Input Delay (ms)
          CLS: 0.1, // Cumulative Layout Shift
        },
        monitoring: {
          interval: 300000, // 5 minutes
          sampleRate: 0.1, // Sample 10% of requests
        },
      },
      api: {
        enabled: true,
        targets: {
          p50: 500, // 50th percentile (ms)
          p95: 2000, // 95th percentile (ms)
          p99: 5000, // 99th percentile (ms)
        },
        slowQueryThreshold: 1000, // Log queries over 1s
      },
      database: {
        enabled: true,
        targets: {
          queryTime: 100, // Average query time (ms)
          slowQueryThreshold: 500, // Slow query threshold (ms)
        },
        monitoring: {
          logSlowQueries: true,
          analyzeQueryPlans: false, // Enable in dev only
        },
      },
    },
    alerts: {
      degradedPerformance: {
        enabled: true,
        threshold: 1.5, // Alert if metrics are 50% worse than target
        notification: ["discord"],
      },
    },
  };

  return JSON.stringify(config, null, 2);
}

/**
 * Create log rotation configuration
 */
function createLogRotationConfig(): string {
  const config = `# Logrotate configuration for IxStats
# Place this file in /etc/logrotate.d/ (requires root)

/ixwiki/public/projects/ixstats/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    missingok
    create 0644 www-data www-data
    sharedscripts
    postrotate
        # Reload application to reopen log files if needed
        # kill -USR1 $(cat /ixwiki/public/projects/ixstats/.production.pid) 2>/dev/null || true
    endscript
}

/ixwiki/public/projects/ixstats/deployment-logs/*.log {
    weekly
    rotate 12
    compress
    delaycompress
    notifempty
    missingok
    create 0644 www-data www-data
}
`;

  return config;
}

/**
 * Create monitoring cron jobs
 */
function createCronJobs(): string {
  const config = `# IxStats Monitoring Cron Jobs
# Add these to your crontab: crontab -e

# Check application health every 5 minutes
*/5 * * * * curl -f http://localhost:3550/projects/ixstats/api/health > /dev/null 2>&1 || echo "Health check failed at $(date)" >> /ixwiki/public/projects/ixstats/logs/health-check.log

# Check disk space every hour
0 * * * * df -h /ixwiki/public/projects/ixstats | tail -1 | awk '{if ($5+0 > 90) print "Disk usage warning: " $5 " at " strftime("%Y-%m-%d %H:%M:%S")}' >> /ixwiki/public/projects/ixstats/logs/disk-space.log

# Database backup daily at 2 AM
0 2 * * * cd /ixwiki/public/projects/ixstats && npm run db:backup >> /ixwiki/public/projects/ixstats/logs/backup.log 2>&1

# Clean old logs weekly (Sunday at 3 AM)
0 3 * * 0 find /ixwiki/public/projects/ixstats/logs -name "*.log" -mtime +30 -delete

# Check process running every 10 minutes
*/10 * * * * ps aux | grep "node.*ixstats" > /dev/null || echo "IxStats process not running at $(date)" >> /ixwiki/public/projects/ixstats/logs/process-monitor.log
`;

  return config;
}

/**
 * Create systemd service file
 */
function createSystemdService(): string {
  const config = `[Unit]
Description=IxStats Economic Simulation Platform
After=network.target postgresql.service redis.service
Wants=postgresql.service redis.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/ixwiki/public/projects/ixstats
Environment=NODE_ENV=production
Environment=PORT=3550
EnvironmentFile=/ixwiki/public/projects/ixstats/.env.production
ExecStart=/usr/bin/npm run start:prod
Restart=on-failure
RestartSec=10
StandardOutput=append:/ixwiki/public/projects/ixstats/logs/systemd-stdout.log
StandardError=append:/ixwiki/public/projects/ixstats/logs/systemd-stderr.log

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/ixwiki/public/projects/ixstats
ReadOnlyPaths=/ixwiki/public/projects/ixstats/prisma

# Resource limits
LimitNOFILE=65536
MemoryMax=2G
CPUQuota=200%

[Install]
WantedBy=multi-user.target
`;

  return config;
}

/**
 * Main setup function
 */
async function main() {
  console.clear();

  print("╔═══════════════════════════════════════════════════════╗", "cyan");
  print("║                                                       ║", "cyan");
  print("║     IxStats v1.42 - Monitoring Setup Script           ║", "cyan");
  print("║                                                       ║", "cyan");
  print("╚═══════════════════════════════════════════════════════╝", "cyan");

  const projectRoot = process.cwd();
  const configDir = join(projectRoot, "monitoring-config");
  const logsDir = join(projectRoot, "logs");

  // Create directories
  printHeader("Creating Directories");

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
    print(`✅ Created: ${configDir}`, "green");
  } else {
    print(`✓ Directory exists: ${configDir}`, "blue");
  }

  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
    print(`✅ Created: ${logsDir}`, "green");
  } else {
    print(`✓ Directory exists: ${logsDir}`, "blue");
  }

  // Create configuration files
  printHeader("Creating Configuration Files");

  const configs = [
    {
      name: "dashboard-config.json",
      content: createDashboardConfig(),
      description: "Main monitoring dashboard configuration",
    },
    {
      name: "rate-limiting-monitor.json",
      content: createRateLimitingMonitor(),
      description: "Rate limiting monitoring rules",
    },
    {
      name: "error-tracking.json",
      content: createErrorTrackingConfig(),
      description: "Error tracking and categorization",
    },
    {
      name: "performance-config.json",
      content: createPerformanceConfig(),
      description: "Performance monitoring targets",
    },
    {
      name: "logrotate.conf",
      content: createLogRotationConfig(),
      description: "Log rotation configuration",
    },
    {
      name: "cron-jobs.txt",
      content: createCronJobs(),
      description: "Monitoring cron jobs",
    },
    {
      name: "ixstats.service",
      content: createSystemdService(),
      description: "Systemd service file",
    },
  ];

  for (const config of configs) {
    const filePath = join(configDir, config.name);
    writeFileSync(filePath, config.content);
    print(`✅ Created: ${config.name}`, "green");
    print(`   ${config.description}`, "blue");
  }

  // Test Discord webhook
  printHeader("Testing Integrations");

  const webhookSuccess = await testDiscordWebhook();

  // Create README
  printHeader("Creating Documentation");

  const readme = `# IxStats Monitoring Configuration

This directory contains monitoring and alerting configuration for IxStats v1.42.

## Configuration Files

- **dashboard-config.json**: Main monitoring dashboard configuration
- **rate-limiting-monitor.json**: Rate limiting monitoring rules
- **error-tracking.json**: Error tracking and categorization
- **performance-config.json**: Performance monitoring targets and alerts
- **logrotate.conf**: Log rotation configuration
- **cron-jobs.txt**: Monitoring cron jobs
- **ixstats.service**: Systemd service file

## Setup Instructions

### 1. Discord Webhook Setup
${webhookSuccess ? "✅ Discord webhook is already configured and working" : "⚠️  Configure Discord webhook in .env.production"}

### 2. Log Rotation Setup
\`\`\`bash
sudo cp logrotate.conf /etc/logrotate.d/ixstats
sudo chown root:root /etc/logrotate.d/ixstats
sudo chmod 644 /etc/logrotate.d/ixstats
\`\`\`

### 3. Cron Jobs Setup
\`\`\`bash
# View cron jobs
cat cron-jobs.txt

# Add to crontab
crontab -e
# Then paste the contents of cron-jobs.txt
\`\`\`

### 4. Systemd Service Setup (Optional)
\`\`\`bash
sudo cp ixstats.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ixstats
sudo systemctl start ixstats
sudo systemctl status ixstats
\`\`\`

## Monitoring Checklist

- [ ] Discord webhook configured and tested
- [ ] Log rotation configured
- [ ] Cron jobs added to crontab
- [ ] Systemd service installed (optional)
- [ ] Health checks running
- [ ] Database backups scheduled
- [ ] Disk space monitoring active
- [ ] Process monitoring active

## Alert Thresholds

### Critical
- Database errors (any)
- Memory usage > 85%
- Disk usage > 90%

### High
- Error rate > 5%
- CPU usage > 80%

### Medium
- Response time > 3s
- Rate limit approaching (90%)

## Log Files

All logs are stored in: \`${logsDir}\`

- **application.log**: General application logs
- **error.log**: Error logs only
- **health-check.log**: Health check results
- **backup.log**: Database backup logs
- **disk-space.log**: Disk space warnings
- **process-monitor.log**: Process monitoring logs

## Dashboard URLs

- Health Check: http://localhost:3550/projects/ixstats/api/health
- Production URL: https://ixwiki.com/projects/ixstats

## Troubleshooting

### Discord Notifications Not Working
1. Check DISCORD_WEBHOOK_URL in .env.production
2. Verify DISCORD_WEBHOOK_ENABLED=true
3. Test webhook manually: \`npm run test:webhook\`

### Logs Not Rotating
1. Check logrotate configuration: \`sudo cat /etc/logrotate.d/ixstats\`
2. Test manually: \`sudo logrotate -f /etc/logrotate.d/ixstats\`

### Cron Jobs Not Running
1. Check crontab: \`crontab -l\`
2. Check cron logs: \`grep CRON /var/log/syslog\`

### High Resource Usage
1. Check active processes: \`ps aux | grep node\`
2. Check memory usage: \`free -h\`
3. Check disk usage: \`df -h\`

## Maintenance

- Review monitoring configs monthly
- Update alert thresholds based on actual usage
- Archive old logs quarterly
- Test disaster recovery procedures quarterly

**Created**: ${new Date().toLocaleDateString()}
**Version**: 1.42
`;

  writeFileSync(join(configDir, "README.md"), readme);
  print("✅ Created: README.md", "green");

  // Summary
  printHeader("Setup Summary");

  print("✅ Monitoring configuration created successfully", "green");
  print(`   Location: ${configDir}`, "blue");
  print("", "reset");

  print("📋 Configuration Files:", "cyan");
  for (const config of configs) {
    print(`   • ${config.name}`, "blue");
  }

  print("", "reset");
  print("📖 Next Steps:", "yellow");
  print("   1. Review configuration files in monitoring-config/", "reset");
  print(
    "   2. Set up log rotation (requires root): sudo cp monitoring-config/logrotate.conf /etc/logrotate.d/ixstats",
    "reset"
  );
  print("   3. Add cron jobs: crontab -e (copy from monitoring-config/cron-jobs.txt)", "reset");
  print(
    "   4. (Optional) Install systemd service: sudo cp monitoring-config/ixstats.service /etc/systemd/system/",
    "reset"
  );
  print(
    webhookSuccess
      ? "   5. ✅ Discord webhook is working"
      : "   5. Configure Discord webhook in .env.production",
    "reset"
  );
  print("   6. Test monitoring: npm run test:monitoring", "reset");

  print("", "reset");
  print("📚 Documentation: monitoring-config/README.md", "cyan");

  if (webhookSuccess) {
    print("\n✅ All monitoring systems configured and tested successfully", "green");
    exit(0);
  } else {
    print("\n⚠️  Monitoring configured but Discord webhook needs setup", "yellow");
    exit(0);
  }
}

// Run setup
main().catch((error) => {
  print(`\n❌ Monitoring setup failed: ${error}`, "red");
  exit(1);
});

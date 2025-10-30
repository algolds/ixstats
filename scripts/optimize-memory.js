#!/usr/bin/env node

/**
 * Memory Optimization Script
 * Fixes memory issues and implements production optimizations
 */

import { spawn, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function optimizeMemory() {
  console.log('🧠 Starting memory optimization...\n');

  // Set memory limits
  process.env.NODE_OPTIONS = '--max-old-space-size=4096 --expose-gc --optimize-for-size';
  
  console.log('📊 Memory configuration:');
  console.log(`   Max Old Space: 4GB`);
  console.log(`   GC Exposed: Yes`);
  console.log(`   Optimize for Size: Yes\n`);

  // Clean up temporary files
  console.log('🧹 Cleaning up temporary files...');
  
  const tempDirs = [
    '.next/cache',
    'node_modules/.cache',
    '.turbo',
    'dist',
    'build'
  ];

  for (const dir of tempDirs) {
    const dirPath = path.join(process.cwd(), dir);
    if (fs.existsSync(dirPath)) {
      try {
        fs.rmSync(dirPath, { recursive: true, force: true });
        console.log(`   ✅ Cleaned: ${dir}`);
      } catch (error) {
        console.warn(`   ⚠️  Failed to clean ${dir}: ${error.message}`);
      }
    }
  }

  // Optimize package.json scripts
  console.log('\n📝 Optimizing package.json scripts...');
  
  const packagePath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  // Add memory-optimized scripts
  packageJson.scripts = {
    ...packageJson.scripts,
    'build:memory': 'NODE_OPTIONS=--max-old-space-size=6144 next build',
    'lint:memory': 'NODE_OPTIONS=--max-old-space-size=2048 next lint',
    'typecheck:memory': 'NODE_OPTIONS=--max-old-space-size=2048 tsc --noEmit',
    'check:memory': 'npm run lint:memory && npm run typecheck:memory',
    'start:memory': 'NODE_OPTIONS=--max-old-space-size=4096 --expose-gc next start',
    'dev:memory': 'NODE_OPTIONS=--max-old-space-size=2048 next dev'
  };

  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
  console.log('   ✅ Added memory-optimized scripts');

  // Create .npmrc for better caching
  console.log('\n📦 Optimizing npm configuration...');
  
  const npmrcContent = `
# Optimize npm for better performance
cache-min=3600
prefer-offline=true
audit=false
fund=false
progress=false
`.trim();

  fs.writeFileSync(path.join(process.cwd(), '.npmrc'), npmrcContent);
  console.log('   ✅ Created optimized .npmrc');

  // Create memory monitoring script
  console.log('\n📊 Creating memory monitoring script...');
  
  const monitorScript = `#!/usr/bin/env node

/**
 * Memory Monitor
 * Monitors memory usage and triggers GC when needed
 */

import { performance } from 'perf_hooks';

class MemoryMonitor {
  constructor() {
    this.threshold = 0.8; // 80% memory usage
    this.interval = 30000; // 30 seconds
    this.start();
  }

  start() {
    setInterval(() => {
      this.checkMemory();
    }, this.interval);
  }

  checkMemory() {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
    const usagePercent = heapUsedMB / heapTotalMB;

    console.log(\`[MemoryMonitor] Heap: \${heapUsedMB.toFixed(2)}MB / \${heapTotalMB.toFixed(2)}MB (\${(usagePercent * 100).toFixed(1)}%)\`);

    if (usagePercent > this.threshold) {
      console.warn(\`[MemoryMonitor] High memory usage detected: \${(usagePercent * 100).toFixed(1)}%\`);
      
      if (global.gc) {
        const startTime = performance.now();
        global.gc();
        const duration = performance.now() - startTime;
        console.log(\`[MemoryMonitor] Garbage collection triggered (\${duration.toFixed(2)}ms)\`);
      } else {
        console.warn('[MemoryMonitor] Garbage collection not available');
      }
    }
  }
}

// Start monitoring
new MemoryMonitor();

console.log('[MemoryMonitor] Started memory monitoring...');
`;

  fs.writeFileSync(path.join(process.cwd(), 'scripts/monitor-memory.js'), monitorScript);
  fs.chmodSync(path.join(process.cwd(), 'scripts/monitor-memory.js'), '755');
  console.log('   ✅ Created memory monitoring script');

  // Create production environment file
  console.log('\n🌍 Creating production environment configuration...');
  
  const envProdContent = `
# Production Environment Configuration
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1

# Memory optimization
NODE_OPTIONS=--max-old-space-size=4096 --expose-gc --optimize-for-size

# Performance optimizations
NEXT_PRIVATE_STANDALONE=true
NEXT_PRIVATE_SKIP_VALIDATION=true

# Database optimizations
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ixstats"

# Cache configuration
CACHE_TTL=300
REDIS_URL=""

# Security
NEXTAUTH_SECRET="production-secret-change-me"
NEXTAUTH_URL="https://your-domain.com"

# External services
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
CLERK_SECRET_KEY=""
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
`.trim();

  fs.writeFileSync(path.join(process.cwd(), '.env.production'), envProdContent);
  console.log('   ✅ Created production environment file');

  // Create memory-optimized Next.js config
  console.log('\n⚙️  Creating memory-optimized Next.js configuration...');
  
  const nextConfigMemory = `/** @type {import('next').NextConfig} */
const nextConfig = {
  // Memory optimizations
  experimental: {
    optimizeCss: true,
    optimizePackageImports: [
      '@radix-ui/react-icons',
      'lucide-react',
      '@chakra-ui/react',
      '@emotion/react',
      '@prisma/client'
    ],
  },

  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Webpack optimizations
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      // Memory optimizations
      config.optimization.moduleIds = 'deterministic';
      config.optimization.chunkIds = 'deterministic';
      
      // Split chunks for better memory usage
      config.optimization.splitChunks = {
        chunks: 'all',
        maxInitialRequests: 30,
        maxAsyncRequests: 30,
        cacheGroups: {
          vendor: {
            test: /[\\\\/]node_modules[\\\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
            maxSize: 244000,
          },
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 5,
            reuseExistingChunk: true,
            maxSize: 244000,
          },
        },
      };
    }

    return config;
  },

  // Output configuration
  output: 'standalone',
  
  // Enable compression
  compress: true,
  
  // Disable source maps in production
  productionBrowserSourceMaps: false,
};

module.exports = nextConfig;
`;

  fs.writeFileSync(path.join(process.cwd(), 'next.config.memory.js'), nextConfigMemory);
  console.log('   ✅ Created memory-optimized Next.js config');

  // Update package.json with memory-optimized scripts
  console.log('\n📝 Updating package.json with memory optimizations...');
  
  packageJson.scripts = {
    ...packageJson.scripts,
    'build:memory': 'NODE_OPTIONS=--max-old-space-size=6144 next build --config next.config.memory.js',
    'start:memory': 'NODE_OPTIONS=--max-old-space-size=4096 --expose-gc next start',
    'monitor:memory': 'node scripts/monitor-memory.js'
  };

  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
  console.log('   ✅ Updated package.json scripts');

  console.log('\n🎉 Memory optimization completed!');
  console.log('\n📋 Next steps:');
  console.log('   1. Run: npm run build:memory');
  console.log('   2. Run: npm run start:memory');
  console.log('   3. Monitor: npm run monitor:memory');
  console.log('\n💡 Tips:');
  console.log('   - Use --max-old-space-size=6144 for builds');
  console.log('   - Use --max-old-space-size=4096 for production');
  console.log('   - Enable garbage collection with --expose-gc');
  console.log('   - Monitor memory usage regularly');
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run optimization
optimizeMemory().catch((error) => {
  console.error('❌ Memory optimization failed:', error);
  process.exit(1);
});

// GracefulStartupManager.js - 优雅启动管理器
// 解决复杂依赖链和阻塞问题

class GracefulStartupManager {
  constructor() {
    this.startupPhases = [];
    this.currentPhase = 0;
    this.startupTimeout = 60000; // 60秒总超时
    this.phaseTimeout = 15000; // 每个阶段15秒超时
    this.criticalServices = new Set();
    this.optionalServices = new Set();
  }

  /**
   * 定义启动阶段
   */
  defineStartupPhases() {
    this.startupPhases = [
      {
        name: 'core_initialization',
        description: '核心组件初始化',
        critical: true,
        timeout: 10000,
        services: ['database', 'express_app']
      },
      {
        name: 'essential_services',
        description: '基本服务启动',
        critical: true,
        timeout: 15000,
        services: ['api_routes', 'static_files', 'basic_middleware']
      },
      {
        name: 'server_listening',
        description: '服务器端口监听',
        critical: true,
        timeout: 5000,
        services: ['port_binding']
      },
      {
        name: 'monitoring_systems',
        description: '监控系统初始化',
        critical: false,
        timeout: 20000,
        services: ['health_monitor', 'performance_monitor']
      },
      {
        name: 'data_migrations',
        description: '数据库迁移',
        critical: false,
        timeout: 30000,
        services: ['unified_monitoring_migration', 'price_fields_migration']
      },
      {
        name: 'cache_systems',
        description: '缓存系统初始化',
        critical: false,
        timeout: 15000,
        services: ['cache_manager', 'data_consistency_manager']
      },
      {
        name: 'background_services',
        description: '后台服务启动',
        critical: false,
        timeout: 20000,
        services: ['periodic_analysis', 'data_warmup', 'cleanup_tasks']
      }
    ];
  }

  /**
   * 执行分阶段启动
   */
  async executeGracefulStartup(server) {
    console.log('🚀 开始优雅启动流程...');

    this.defineStartupPhases();

    const startTime = Date.now();

    try {
      // 执行每个启动阶段
      for (let i = 0; i < this.startupPhases.length; i++) {
        const phase = this.startupPhases[i];
        this.currentPhase = i;

        console.log(`\n📋 阶段 ${i + 1}/${this.startupPhases.length}: ${phase.description}`);

        try {
          await this.executePhase(server, phase);
          console.log(`✅ 阶段 ${i + 1} 完成: ${phase.description}`);

          // 关键阶段完成后立即检查服务器是否可用
          if (phase.name === 'server_listening') {
            const isListening = await this.verifyServerListening(server.port);
            if (isListening) {
              console.log('🎉 服务器已可用，继续后台初始化...');
              // 后续非关键阶段可以在后台执行
              this.executeBackgroundPhases(server, i + 1);
              return true;
            }
          }

        } catch (error) {
          if (phase.critical) {
            console.error(`❌ 关键阶段 ${i + 1} 失败: ${phase.description}`, error);
            throw error;
          } else {
            console.warn(`⚠️ 可选阶段 ${i + 1} 失败，继续启动: ${phase.description}`, error.message);
          }
        }
      }

      const duration = Date.now() - startTime;
      console.log(`\n✅ 优雅启动完成，耗时: ${duration}ms`);
      return true;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ 启动失败，耗时: ${duration}ms`, error);
      throw error;
    }
  }

  /**
   * 执行单个启动阶段
   */
  async executePhase(server, phase) {
    const phaseStart = Date.now();

    // 设置阶段超时
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`阶段超时: ${phase.description} (${phase.timeout}ms)`));
      }, phase.timeout);
    });

    const phasePromise = this.runPhaseServices(server, phase);

    try {
      await Promise.race([phasePromise, timeoutPromise]);
      const duration = Date.now() - phaseStart;
      console.log(`  ⏱️ 阶段耗时: ${duration}ms`);
    } catch (error) {
      if (error.message.includes('阶段超时')) {
        console.warn(`⚠️ ${phase.description} 超时，但继续启动`);
        if (phase.critical) {
          throw error;
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * 运行阶段服务
   */
  async runPhaseServices(server, phase) {
    switch (phase.name) {
      case 'core_initialization':
        return this.initializeCoreComponents(server);

      case 'essential_services':
        return this.initializeEssentialServices(server);

      case 'server_listening':
        return this.startServerListening(server);

      case 'monitoring_systems':
        return this.initializeMonitoringSystems(server);

      case 'data_migrations':
        return this.executeDataMigrations(server);

      case 'cache_systems':
        return this.initializeCacheSystems(server);

      case 'background_services':
        return this.startBackgroundServices(server);

      default:
        console.log(`⚠️ 未知阶段: ${phase.name}`);
    }
  }

  /**
   * 初始化核心组件
   */
  async initializeCoreComponents(server) {
    console.log('  🗄️ 初始化数据库...');
    await server.initializeDatabase();

    console.log('  🌐 配置Express应用...');
    server.setupBasicMiddleware();
  }

  /**
   * 初始化基本服务
   */
  async initializeEssentialServices(server) {
    console.log('  🛠️ 设置基本API路由...');
    await server.setupBasicAPIRoutes();

    console.log('  📁 配置静态文件服务...');
    server.setupStaticFiles();
  }

  /**
   * 启动服务器监听
   */
  async startServerListening(server) {
    console.log('  🎯 启动端口监听...');

    return new Promise((resolve, reject) => {
      const serverInstance = server.app.listen(server.port, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`  ✅ 服务器监听端口 ${server.port}`);
          server.serverInstance = serverInstance;
          resolve();
        }
      });
    });
  }

  /**
   * 初始化监控系统（非阻塞）
   */
  async initializeMonitoringSystems(server) {
    console.log('  📊 初始化监控系统...');

    // 使用Promise.allSettled避免单个监控系统失败影响整体
    const monitoringTasks = [
      this.safeInitialize(() => server.initializeHealthMonitor(), '健康监控器'),
      this.safeInitialize(() => server.initializePerformanceMonitor(), '性能监控器')
    ];

    const results = await Promise.allSettled(monitoringTasks);
    this.logSettledResults('监控系统', results);
  }

  /**
   * 执行数据迁移（非阻塞）
   */
  async executeDataMigrations(server) {
    console.log('  🔄 执行数据迁移...');

    const migrationTasks = [
      this.safeInitialize(() => server.executeUnifiedMonitoringMigration(), '统一监控迁移'),
      this.safeInitialize(() => server.executePriceFieldsMigration(), '价格字段迁移')
    ];

    const results = await Promise.allSettled(migrationTasks);
    this.logSettledResults('数据迁移', results);
  }

  /**
   * 初始化缓存系统（非阻塞）
   */
  async initializeCacheSystems(server) {
    console.log('  💾 初始化缓存系统...');

    const cacheTasks = [
      this.safeInitialize(() => server.initializeCacheManager(), '缓存管理器'),
      this.safeInitialize(() => server.initializeDataConsistency(), '数据一致性管理器', false) // 禁用自动启动
    ];

    const results = await Promise.allSettled(cacheTasks);
    this.logSettledResults('缓存系统', results);
  }

  /**
   * 启动后台服务（非阻塞）
   */
  async startBackgroundServices(server) {
    console.log('  🔄 启动后台服务...');

    const backgroundTasks = [
      this.safeInitialize(() => server.startPeriodicAnalysis(), '定期分析'),
      this.safeInitialize(() => server.startDataWarmup(), '数据预热'),
      this.safeInitialize(() => server.startCleanupTasks(), '清理任务')
    ];

    const results = await Promise.allSettled(backgroundTasks);
    this.logSettledResults('后台服务', results);
  }

  /**
   * 安全初始化包装器
   */
  async safeInitialize(initFunction, serviceName, enabled = true) {
    if (!enabled) {
      console.log(`  ⏭️ 跳过: ${serviceName}`);
      return { status: 'skipped', service: serviceName };
    }

    try {
      await initFunction();
      console.log(`  ✅ ${serviceName} 初始化成功`);
      return { status: 'success', service: serviceName };
    } catch (error) {
      console.warn(`  ⚠️ ${serviceName} 初始化失败: ${error.message}`);
      return { status: 'failed', service: serviceName, error: error.message };
    }
  }

  /**
   * 记录Promise.allSettled结果
   */
  logSettledResults(category, results) {
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    console.log(`  📊 ${category}: ${successful} 成功, ${failed} 失败`);
  }

  /**
   * 在后台执行剩余阶段
   */
  executeBackgroundPhases(server, startPhase) {
    console.log('🔄 在后台继续执行非关键阶段...');

    // 异步执行剩余阶段，不阻塞主启动流程
    setTimeout(async () => {
      for (let i = startPhase; i < this.startupPhases.length; i++) {
        const phase = this.startupPhases[i];
        try {
          console.log(`\n🔄 后台阶段 ${i + 1}: ${phase.description}`);
          await this.executePhase(server, phase);
          console.log(`✅ 后台阶段 ${i + 1} 完成`);
        } catch (error) {
          console.warn(`⚠️ 后台阶段 ${i + 1} 失败: ${error.message}`);
        }
      }
      console.log('🎉 所有后台阶段执行完成');
    }, 1000);
  }

  /**
   * 验证服务器是否正在监听
   */
  async verifyServerListening(port) {
    return new Promise((resolve) => {
      const net = require('net');
      const client = new net.Socket();

      client.setTimeout(2000);

      client.on('connect', () => {
        client.destroy();
        resolve(true);
      });

      client.on('timeout', () => {
        client.destroy();
        resolve(false);
      });

      client.on('error', () => {
        resolve(false);
      });

      client.connect(port, 'localhost');
    });
  }

  /**
   * 获取启动状态
   */
  getStartupStatus() {
    return {
      currentPhase: this.currentPhase,
      totalPhases: this.startupPhases.length,
      phaseName: this.startupPhases[this.currentPhase]?.name || 'completed',
      phaseDescription: this.startupPhases[this.currentPhase]?.description || 'All phases completed'
    };
  }
}

module.exports = GracefulStartupManager;

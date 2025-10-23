  /**
   * 直接从数据库获取回测数据
   * @private
   */
  async fetchDataFromDatabase(symbol, timeframe, startDate, endDate) {
    const sql = \`
      SELECT 
        UNIX_TIMESTAMP(open_time) * 1000 as timestamp,
        open_price, high_price, low_price, close_price,
        volume, quote_volume, trades_count,
        taker_buy_volume, taker_buy_quote_volume
      FROM backtest_market_data
      WHERE symbol = ? AND timeframe = ?
        AND open_time >= ? AND open_time <= ?
      ORDER BY open_time ASC
    \`;

    try {
      const results = await this.databaseAdapter.db.query(sql, [
        symbol,
        timeframe,
        startDate,
        endDate
      ]);

      return results;
    } catch (error) {
      logger.error(\`[数据管理器] 数据库查询失败\`, error);
      throw error;
    }
  }

  /**
   * 获取市场数据
   * @param {string} timeframe - 时间框架
   * @param {string} startDate - 开始日期
   * @param {string} endDate - 结束日期
   * @param {string} symbol - 交易对
   * @returns {Array} 市场数据
   */
  async getMarketData(timeframe, startDate, endDate, symbol = 'BTCUSDT') {
    const cacheKey = \`\${symbol}-\${timeframe}-\${startDate}-\${endDate}\`;

    if (this.cache.has(cacheKey)) {
      logger.info(\`[数据管理器] 从缓存获取数据: \${cacheKey}\`);
      return this.cache.get(cacheKey);
    }

    try {
      logger.info(\`[数据管理器] 从数据库获取数据: \${symbol}-\${timeframe} (\${startDate} ~ \${endDate})\`);

      // 直接从数据库获取回测数据
      const dbResults = await this.fetchDataFromDatabase(symbol, timeframe, startDate, endDate);

      if (!dbResults || dbResults.length === 0) {
        logger.warn(\`[数据管理器] 数据库中未找到数据: \${symbol}-\${timeframe}\`);
        return [];
      }

      // 转换为回测引擎需要的格式
      const data = dbResults.map(row => ({
        timestamp: new Date(parseInt(row.timestamp)),
        open: parseFloat(row.open_price),
        high: parseFloat(row.high_price),
        low: parseFloat(row.low_price),
        close: parseFloat(row.close_price),
        volume: parseFloat(row.volume),
        currentPrice: parseFloat(row.close_price),
        symbol: symbol
      }));

      this.cache.set(cacheKey, data);
      logger.info(\`[数据管理器] 成功获取 \${data.length} 条数据\`);

      return data;
    } catch (error) {
      logger.error(\`[数据管理器] 获取数据失败: \${symbol}-\${timeframe}\`, error);
      return [];
    }
  }

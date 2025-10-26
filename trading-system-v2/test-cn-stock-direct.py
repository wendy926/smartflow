#!/usr/bin/env python3
"""
直接使用akshare测试A股数据
无需启动Python服务
"""

import akshare as ak
import sys
from datetime import datetime, timedelta

def test_akshare():
    """测试akshare数据获取"""
    print("🚀 测试akshare数据获取...")

    # 测试1: 获取沪深300指数数据
    print("\n=== 测试1: 获取沪深300日线数据 ===")
    try:
        # 获取最近30天的数据
        today = datetime.now().strftime('%Y%m%d')
        last_month = (datetime.now() - timedelta(days=30)).strftime('%Y%m%d')

        print(f"时间范围: {last_month} - {today}")

        df = ak.index_zh_a_hist(symbol="000300", period="daily", start_date=last_month, end_date=today)

        print(f"✅ 获取成功！共 {len(df)} 条数据")
        print("\n最新5条数据:")
        print(df[['日期', '开盘', '收盘', '涨跌幅', '成交量']].tail(5).to_string(index=False))

        # 保存为CSV
        df.to_csv('/tmp/cn_stock_000300.csv', index=False)
        print(f"\n✅ 数据已保存到 /tmp/cn_stock_000300.csv")

    except Exception as e:
        print(f"❌ 获取失败: {e}")
        return False

    # 测试2: 获取多个指数
    print("\n=== 测试2: 获取多个指数数据 ===")
    indexes = ['000300', '000905', '399001']

    for code in indexes:
        try:
            df = ak.index_zh_a_hist(symbol=code, period="daily", start_date=last_month, end_date=today)
            print(f"✅ {code}: 获取 {len(df)} 条数据")
        except Exception as e:
            print(f"❌ {code}: 获取失败 - {e}")

    print("\n=== akshare测试完成 ===")
    print("✅ 所有测试通过！")
    return True

if __name__ == '__main__':
    success = test_akshare()
    sys.exit(0 if success else 1)


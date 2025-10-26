#!/usr/bin/env python3
"""
A股数据服务
使用akshare获取A股指数数据，提供REST API接口
"""

from flask import Flask, jsonify, request
import akshare as ak
from datetime import datetime, timedelta
import logging
import os

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def format_date(date_str):
    """格式化日期"""
    try:
        if isinstance(date_str, str):
            # YYYYMMDD -> YYYY-MM-DD
            return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
        return date_str
    except:
        return date_str


@app.route('/health', methods=['GET'])
def health():
    """健康检查"""
    return jsonify({
        'status': 'ok',
        'service': 'CN Stock Data Service',
        'timestamp': datetime.now().isoformat()
    })


@app.route('/api/v1/indexes', methods=['GET'])
def get_indexes():
    """获取支持的指数列表"""
    indexes = [
        {'code': '000300', 'name': '沪深300', 'market': 'SH'},
        {'code': '000905', 'name': '中证500', 'market': 'SH'},
        {'code': '000852', 'name': '中证1000', 'market': 'SH'},
        {'code': '399001', 'name': '深证成指', 'market': 'SZ'},
        {'code': '399006', 'name': '创业板指', 'market': 'SZ'},
        {'code': '399005', 'name': '中小板指', 'market': 'SZ'},
        {'code': '000016', 'name': '上证50', 'market': 'SH'},
        {'code': '000688', 'name': '科创50', 'market': 'SH'}
    ]
    return jsonify({'data': indexes})


@app.route('/api/v1/index/<code>/daily', methods=['GET'])
def get_index_daily(code):
    """获取指数日线数据
    
    Args:
        code: 指数代码，如 '000300' 或 '399001'
    
    Query参数:
        start_date: 开始日期 'YYYYMMDD'
        end_date: 结束日期 'YYYYMMDD'
        limit: 数据条数（默认100）
    """
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        limit = int(request.args.get('limit', 100))
        
        logger.info(f"获取指数日线数据: {code}, start={start_date}, end={end_date}")
        
        # 如果没有指定日期，默认获取最近3个月
        if not start_date or not end_date:
            end_date = datetime.now().strftime('%Y%m%d')
            start_date_obj = datetime.now() - timedelta(days=90)
            start_date = start_date_obj.strftime('%Y%m%d')
        
        # 获取数据
        df = ak.index_zh_a_hist(
            symbol=code,
            period="daily",
            start_date=start_date,
            end_date=end_date
        )
        
        if df.empty:
            return jsonify({'error': 'No data available'}), 404
        
        # 转换为标准格式
        result = []
        for _, row in df.iterrows():
            result.append({
                'date': format_date(row['日期']),
                'open': float(row['开盘']),
                'high': float(row['最高']),
                'low': float(row['最低']),
                'close': float(row['收盘']),
                'volume': float(row['成交量']),
                'change_pct': float(row['涨跌幅'])
            })
        
        # 限制返回条数
        result = result[-limit:]
        
        logger.info(f"返回 {len(result)} 条数据")
        
        return jsonify({
            'code': code,
            'period': 'daily',
            'count': len(result),
            'data': result
        })
        
    except Exception as e:
        logger.error(f"获取日线数据失败: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/index/<code>/info', methods=['GET'])
def get_index_info(code):
    """获取指数基本信息"""
    try:
        logger.info(f"获取指数信息: {code}")
        
        # akshare暂时没有直接的指数信息接口
        # 返回基本信息
        index_info = {
            'code': code,
            'name': 'Index',
            'market': 'SH' if code.startswith('000') else 'SZ',
            'description': f'Index {code}'
        }
        
        return jsonify({'data': index_info})
        
    except Exception as e:
        logger.error(f"获取指数信息失败: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/index/<code>/realtime', methods=['GET'])
def get_index_realtime(code):
    """获取指数实时行情"""
    try:
        logger.info(f"获取实时行情: {code}")
        
        # 获取最近的日线数据作为实时行情
        today = datetime.now().strftime('%Y%m%d')
        df = ak.index_zh_a_hist(
            symbol=code,
            period="daily",
            start_date=today,
            end_date=today
        )
        
        if df.empty:
            # 如果没有今日数据，获取最近一天的
            df = ak.index_zh_a_hist(
                symbol=code,
                period="daily",
                start_date=(datetime.now() - timedelta(days=30)).strftime('%Y%m%d'),
                end_date=datetime.now().strftime('%Y%m%d')
            ).tail(1)
        
        if df.empty:
            return jsonify({'error': 'No data available'}), 404
        
        row = df.iloc[0]
        
        return jsonify({
            'code': code,
            'price': float(row['收盘']),
            'open': float(row['开盘']),
            'high': float(row['最高']),
            'low': float(row['最低']),
            'change': float(row['涨跌幅']),
            'volume': float(row['成交量']),
            'timestamp': row['日期']
        })
        
    except Exception as e:
        logger.error(f"获取实时行情失败: {e}")
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5001))
    logger.info(f"启动A股数据服务，端口: {port}")
    app.run(host='0.0.0.0', port=port, debug=False)


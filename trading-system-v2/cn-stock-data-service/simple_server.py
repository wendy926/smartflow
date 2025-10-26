#!/usr/bin/env python3
"""
简化的A股数据服务
直接返回准备好的数据，不依赖网络请求
"""

import json
from flask import Flask, jsonify

app = Flask(__name__)

# 模拟数据（可以替换为真实数据）
MOCK_DATA = {
    '000300': {
        'name': '沪深300',
        'data': [
            {'date': '2025-10-24', 'open': 4622.79, 'high': 4680.12, 'low': 4600.45, 'close': 4660.68, 'volume': 208814483000, 'change_pct': 1.18},
            {'date': '2025-10-23', 'open': 4578.70, 'high': 4615.23, 'low': 4560.12, 'close': 4606.34, 'volume': 200463917000, 'change_pct': 0.30},
            {'date': '2025-10-22', 'open': 4576.03, 'high': 4620.15, 'low': 4550.89, 'close': 4592.57, 'volume': 185333960000, 'change_pct': -0.33},
            {'date': '2025-10-21', 'open': 4556.12, 'high': 4635.45, 'low': 4550.12, 'close': 4607.87, 'volume': 215711175000, 'change_pct': 1.53},
            {'date': '2025-10-20', 'open': 4558.24, 'high': 4565.78, 'low': 4520.12, 'close': 4538.22, 'volume': 218420405000, 'change_pct': 0.53},
        ]
    },
    '000905': {
        'name': '中证500',
        'data': [
            {'date': '2025-10-24', 'open': 5235.67, 'high': 5289.12, 'low': 5220.45, 'close': 5278.91, 'volume': 156789123000, 'change_pct': 1.25},
            {'date': '2025-10-23', 'open': 5189.34, 'high': 5245.67, 'low': 5170.12, 'close': 5215.33, 'volume': 148567890000, 'change_pct': 0.48},
            {'date': '2025-10-22', 'open': 5190.12, 'high': 5205.89, 'low': 5140.34, 'close': 5190.45, 'volume': 132456789000, 'change_pct': -0.25},
            {'date': '2025-10-21', 'open': 5120.67, 'high': 5234.56, 'low': 5110.23, 'close': 5203.89, 'volume': 168901234000, 'change_pct': 1.62},
            {'date': '2025-10-20', 'open': 5145.89, 'high': 5156.78, 'low': 5080.12, 'close': 5119.45, 'volume': 175234567000, 'change_pct': 0.67},
        ]
    }
}

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'CN Stock Data Service (Simple)'})

@app.route('/api/v1/indexes', methods=['GET'])
def get_indexes():
    indexes = [
        {'code': '000300', 'name': '沪深300', 'market': 'SH'},
        {'code': '000905', 'name': '中证500', 'market': 'SH'},
        {'code': '000852', 'name': '中证1000', 'market': 'SH'},
        {'code': '399001', 'name': '深证成指', 'market': 'SZ'},
        {'code': '399006', 'name': '创业板指', 'market': 'SZ'},
    ]
    return jsonify({'data': indexes})

@app.route('/api/v1/index/<code>/daily', methods=['GET'])
def get_index_daily(code):
    """获取指数日线数据"""
    from flask import request
    limit = int(request.args.get('limit', 100))
    
    if code in MOCK_DATA:
        data = MOCK_DATA[code]['data'][:limit]
        return jsonify({
            'code': code,
            'period': 'daily',
            'count': len(data),
            'data': data
        })
    else:
        return jsonify({'error': f'Index {code} not found'}), 404

@app.route('/api/v1/index/<code>/realtime', methods=['GET'])
def get_index_realtime(code):
    """获取实时行情"""
    if code in MOCK_DATA:
        data = MOCK_DATA[code]['data'][0]  # 最新数据
        return jsonify({
            'code': code,
            'price': data['close'],
            'open': data['open'],
            'high': data['high'],
            'low': data['low'],
            'change': data['change_pct'],
            'volume': data['volume'],
            'timestamp': data['date']
        })
    else:
        return jsonify({'error': f'Index {code} not found'}), 404

if __name__ == '__main__':
    port = 5001
    print(f"启动简化的A股数据服务，端口: {port}")
    app.run(host='0.0.0.0', port=port, debug=False)


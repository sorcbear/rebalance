const express = require('express');
const fetch = require('node-fetch');
require('dotenv').config();
const app = express();

// 允许所有来源
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// 代理 Tiingo API 请求
app.get('/api/tiingo/:symbol', async (req, res) => {
  const symbol = req.params.symbol;
  const apiKey = process.env.TIINGO_API_KEY || '6f0a09083c75be7a575ba5c55ff97e0bca32a6b0';
  
  // 手动构造日期（YYYY-MM-DD 格式）
  const endDate = new Date('2025-05-16'); // 当前日期
  const startDate = new Date(endDate);
  startDate.setMonth(startDate.getMonth() - 8); // 调整为 8 个月前，确保足够交易日
  
  const pad = (num) => String(num).padStart(2, '0');
  const startDateStr = `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`;
  const endDateStr = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}`;
  
  const tiingoUrl = `https://api.tiingo.com/tiingo/daily/${symbol}/prices?token=${apiKey}&startDate=${startDateStr}&endDate=${endDateStr}&sort=-date`;

  try {
    console.log(`Sending request to Tiingo API: ${tiingoUrl}`);
    const response = await fetch(tiingoUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://sorcbear-rebalance.hf.space',
        'Origin': 'https://sorcbear-rebalance.hf.space'
      }
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "无法读取错误详情");
      throw new Error(`Tiingo API error: ${response.status} ${response.statusText}. Details: ${errorText}`);
    }

    const data = await response.json();
    console.log(`Tiingo API response: ${JSON.stringify(data)}`);
    
    if (!data || !Array.isArray(data) || data.length < 152) {
      throw new Error(`获取 ${symbol} 的历史数据不足 152 个交易日，无法计算 SMA`);
    }

    // 提取最近 152 个交易日的收盘价
    const closePrices = data.slice(0, 152).map(entry => entry.close);
    
    // 计算 152 日 SMA
    const sma = closePrices.reduce((sum, price) => sum + price, 0) / 152;
    
    // 返回 SMA 值
    res.json({ symbol, sma: sma.toFixed(2) });
  } catch (error) {
    res.status(500).json({ error: `代理请求失败: ${error.message}` });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

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

  // 首先获取最新的数据，确定最新的交易日
  const latestUrl = `https://api.tiingo.com/tiingo/daily/${symbol}/prices?token=${apiKey}&sort=-date`;

  try {
    console.log(`Sending request to get latest date from Tiingo API: ${latestUrl}`);
    const latestResponse = await fetch(latestUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://sorcbear-rebalance.hf.space',
        'Origin': 'https://sorcbear-rebalance.hf.space'
      }
    });

    if (!latestResponse.ok) {
      const errorText = await latestResponse.text().catch(() => "无法读取错误详情");
      throw new Error(`Tiingo API error (fetching latest date): ${latestResponse.status} ${latestResponse.statusText}. Details: ${errorText}`);
    }

    const latestData = await latestResponse.json();
    console.log(`Tiingo API latest response: ${JSON.stringify(latestData)}`);

    if (!latestData || !Array.isArray(latestData) || latestData.length === 0) {
      throw new Error(`无法获取 ${symbol} 的最新数据`);
    }

    // 获取最新交易日的日期
    const endDate = new Date(latestData[0].date.split('T')[0]);
    const startDate = new Date(endDate);
    startDate.setMonth(startDate.getMonth() - 8);

    const pad = (num) => String(num).padStart(2, '0');
    const startDateStr = `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`;
    const endDateStr = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}`;

    // 获取 152 个交易日的数据
    const tiingoUrl = `https://api.tiingo.com/tiingo/daily/${symbol}/prices?token=${apiKey}&startDate=${startDateStr}&endDate=${endDateStr}&sort=-date`;

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

    // 手动调整复权数据
    let cumulativeDividends = 0;
    const adjustedPrices = data.slice(0, 152).map(entry => {
      if (entry.divCash > 0) {
        cumulativeDividends += entry.divCash;
      }
      // 计算复权调整后的收盘价：close - 累计分红
      return entry.close - cumulativeDividends;
    });

    // 计算 152 日 SMA
    const sma = adjustedPrices.reduce((sum, price) => sum + price, 0) / 152;
    
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

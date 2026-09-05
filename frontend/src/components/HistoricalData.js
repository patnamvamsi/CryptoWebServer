import React, { useState, useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import useWebSocket from '../hooks/useWebSocket';

const HistoricalData = () => {
  const [formData, setFormData] = useState({
    exchange: 'binance',
    symbol: 'BTCUSDT',
    timeframe: '1h',
    limit: 100,
    start_date: '',
    end_date: ''
  });

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [symbols, setSymbols] = useState([]);
  const [availableExchanges, setAvailableExchanges] = useState([]);
  const [viewMode, setViewMode] = useState('both');
  const [chartError, setChartError] = useState(null);
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);

  // Chart settings
  const [chartType, setChartType] = useState('candlestick'); // candlestick, line, area, bars
  const [showVolume, setShowVolume] = useState(true);
  const [showMA20, setShowMA20] = useState(true);
  const [showMA50, setShowMA50] = useState(true);
  const [showMA200, setShowMA200] = useState(false);
  const [showBB, setShowBB] = useState(false);
  const [showRSI, setShowRSI] = useState(false);
  const [showMACD, setShowMACD] = useState(false);
  const [showSR, setShowSR] = useState(false);
  const [showPivots, setShowPivots] = useState(false);
  const [showTrendlines, setShowTrendlines] = useState(false);
  const [trendlineData, setTrendlineData] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Drawing tools
  const [drawingMode, setDrawingMode] = useState(null); // null, 'horizontal', 'trendline'
  const [drawnLines, setDrawnLines] = useState([]);
  const [tempTrendLine, setTempTrendLine] = useState(null); // For storing first point of trend line
  const drawnSeriesRefs = useRef([]);
  const drawingModeRef = useRef(null);
  const tempTrendLineRef = useRef(null);
  const chartTypeRef = useRef('candlestick');

  const chartContainerRef = useRef(null);
  const indicatorChartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const indicatorChartRef = useRef(null);
  const priceSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const ma20SeriesRef = useRef(null);
  const ma50SeriesRef = useRef(null);
  const ma200SeriesRef = useRef(null);
  const bbUpperSeriesRef = useRef(null);
  const bbMiddleSeriesRef = useRef(null);
  const bbLowerSeriesRef = useRef(null);
  const rsiSeriesRef = useRef(null);
  const macdLineSeriesRef = useRef(null);
  const macdSignalSeriesRef = useRef(null);
  const macdHistogramSeriesRef = useRef(null);
  const resistanceTrendlineSeriesRef = useRef(null);
  const supportTrendlineSeriesRef = useRef(null);
  const legendRef = useRef(null);
  const lastPriceRef = useRef(null);

  // WebSocket for real-time price updates
  const { subscribe, unsubscribe, lastMessage, connectionStatus, isConnected } = useWebSocket(formData.exchange);

  // Handle real-time price updates from WebSocket
  useEffect(() => {
    if (!lastMessage || !realtimeEnabled || !priceSeriesRef.current) return;

    // Only process messages for the current symbol
    if (lastMessage.symbol === formData.symbol && lastMessage.price) {
      // Update the last price display
      lastPriceRef.current = lastMessage.price;

      // Update chart with real-time price
      // Note: For now, we'll just update the last candle's close price
      // A more sophisticated implementation would aggregate ticks into candles
      try {
        // Get the chart series data
        const seriesData = priceSeriesRef.current.data();
        if (seriesData && seriesData.length > 0) {
          const lastCandle = seriesData[seriesData.length - 1];
          const price = parseFloat(lastMessage.price);

          // Create updated candle with explicit fields only
          // TradingView Lightweight Charts requires: time (Unix seconds), open, high, low, close
          const updatedCandle = {
            time: lastCandle.time,  // Keep original time (Unix seconds)
            open: lastCandle.open,
            high: Math.max(lastCandle.high, price),
            low: Math.min(lastCandle.low, price),
            close: price,
          };

          // Update the chart series
          priceSeriesRef.current.update(updatedCandle);
        }
      } catch (err) {
        console.error('Error updating chart with real-time data:', err);
      }
    }
  }, [lastMessage, realtimeEnabled, formData.symbol]);

  // Subscribe/unsubscribe to symbol when realtime is enabled/disabled or symbol changes
  useEffect(() => {
    if (realtimeEnabled && formData.symbol) {
      subscribe([formData.symbol]);
      console.log(`Subscribed to real-time updates for ${formData.symbol}`);

      return () => {
        unsubscribe([formData.symbol]);
        console.log(`Unsubscribed from real-time updates for ${formData.symbol}`);
      };
    }
  }, [realtimeEnabled, formData.symbol, subscribe, unsubscribe]);

  // Keep refs in sync with state
  useEffect(() => {
    console.log('useEffect: drawingMode changed to:', drawingMode);
    drawingModeRef.current = drawingMode;
    console.log('useEffect: drawingModeRef.current is now:', drawingModeRef.current);
  }, [drawingMode]);

  useEffect(() => {
    console.log('useEffect: tempTrendLine changed to:', tempTrendLine);
    tempTrendLineRef.current = tempTrendLine;
  }, [tempTrendLine]);

  useEffect(() => {
    console.log('useEffect: chartType changed to:', chartType);
    chartTypeRef.current = chartType;
  }, [chartType]);

  useEffect(() => {
    fetchSymbols();
  }, []);

  useEffect(() => {
    if (symbols.length > 0) {
      const filtered = symbols.filter(s => s.exchange.toLowerCase() === formData.exchange.toLowerCase());
      if (filtered.length > 0 && (!formData.symbol || !filtered.find(s => s.symbol === formData.symbol))) {
        setFormData(prev => ({ ...prev, symbol: filtered[0].symbol }));
      }
    }
  }, [formData.exchange, symbols]);

  // Fetch trendline data when enabled
  useEffect(() => {
    const fetchTrendlines = async () => {
      if (!showTrendlines || !data || !data.ohlcv || data.ohlcv.length === 0) {
        setTrendlineData(null);
        return;
      }

      try {
        const params = new URLSearchParams({
          exchange: formData.exchange,
          symbol: formData.symbol,
          timeframe: formData.timeframe,
          limit: formData.limit,
          lookback: 5,
          num_pivots: 5,
          projection_bars: 20,
        });

        const response = await fetch(`/api/historical/trendlines?${params.toString()}`);
        const result = await response.json();

        if (result.success) {
          console.log('Trendline data received:', result.data);
          setTrendlineData(result.data);
        } else {
          console.error('Trendline API error:', result.error);
          setTrendlineData(null);
        }
      } catch (err) {
        console.error('Error fetching trendlines:', err);
        setTrendlineData(null);
      }
    };

    fetchTrendlines();
  }, [showTrendlines, data, formData.exchange, formData.symbol, formData.timeframe, formData.limit]);

  useEffect(() => {
    if (data && data.ohlcv && data.ohlcv.length > 0 && (viewMode === 'chart' || viewMode === 'both')) {
      setTimeout(() => {
        try {
          initializeChart();
        } catch (err) {
          console.error('Chart initialization error:', err);
          setChartError('Failed to initialize chart: ' + err.message);
        }
      }, 100);
    }

    return () => {
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch (err) {
          console.error('Chart cleanup error:', err);
        }
        chartRef.current = null;
      }
      if (indicatorChartRef.current) {
        try {
          indicatorChartRef.current.remove();
        } catch (err) {
          console.error('Indicator chart cleanup error:', err);
        }
        indicatorChartRef.current = null;
      }
    };
  }, [data, viewMode, chartType, showVolume, showMA20, showMA50, showMA200, showBB, showRSI, showMACD, showSR, showPivots, showTrendlines, trendlineData, drawnLines]);

  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        try {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
          });
        } catch (err) {
          console.error('Chart resize error:', err);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const calculateMA = (data, period) => {
    const result = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push({ time: data[i].time, value: null });
      } else {
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += data[i - j].close;
        }
        result.push({ time: data[i].time, value: sum / period });
      }
    }
    return result.filter(item => item.value !== null);
  };

  const calculateEMA = (data, period) => {
    const result = [];
    const multiplier = 2 / (period + 1);

    // Calculate SMA for the first value
    let sum = 0;
    for (let i = 0; i < period && i < data.length; i++) {
      sum += data[i].close;
    }
    let ema = sum / period;
    result.push({ time: data[period - 1].time, value: ema });

    // Calculate EMA for remaining values
    for (let i = period; i < data.length; i++) {
      ema = (data[i].close - ema) * multiplier + ema;
      result.push({ time: data[i].time, value: ema });
    }

    return result;
  };

  const calculateRSI = (data, period = 14) => {
    const result = [];
    const changes = [];

    // Calculate price changes
    for (let i = 1; i < data.length; i++) {
      changes.push(data[i].close - data[i - 1].close);
    }

    // Calculate initial average gain and loss
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 0; i < period; i++) {
      if (changes[i] >= 0) {
        avgGain += changes[i];
      } else {
        avgLoss -= changes[i];
      }
    }
    avgGain /= period;
    avgLoss /= period;

    // Calculate first RSI
    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    let rsi = 100 - (100 / (1 + rs));
    result.push({ time: data[period].time, value: rsi });

    // Calculate remaining RSI values using smoothed averages
    for (let i = period; i < changes.length; i++) {
      const change = changes[i];
      const gain = change >= 0 ? change : 0;
      const loss = change < 0 ? -change : 0;

      avgGain = ((avgGain * (period - 1)) + gain) / period;
      avgLoss = ((avgLoss * (period - 1)) + loss) / period;

      rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi = 100 - (100 / (1 + rs));
      result.push({ time: data[i + 1].time, value: rsi });
    }

    return result;
  };

  const calculateMACD = (data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
    // Calculate EMA values for MACD
    const calculateEMAValues = (data, period) => {
      const values = [];
      const multiplier = 2 / (period + 1);

      let sum = 0;
      for (let i = 0; i < period && i < data.length; i++) {
        sum += data[i].close;
      }
      let ema = sum / period;

      for (let i = period - 1; i < data.length; i++) {
        if (i === period - 1) {
          values.push(ema);
        } else {
          ema = (data[i].close - ema) * multiplier + ema;
          values.push(ema);
        }
      }

      return values;
    };

    // Calculate fast and slow EMAs
    const fastEMA = calculateEMAValues(data, fastPeriod);
    const slowEMA = calculateEMAValues(data, slowPeriod);

    // Calculate MACD line
    const macdLine = [];
    const startIndex = slowPeriod - 1;
    for (let i = 0; i < slowEMA.length; i++) {
      const fastValue = fastEMA[i + (slowPeriod - fastPeriod)];
      macdLine.push(fastValue - slowEMA[i]);
    }

    // Calculate signal line (EMA of MACD line)
    const signalLine = [];
    const multiplier = 2 / (signalPeriod + 1);
    let sum = 0;
    for (let i = 0; i < signalPeriod && i < macdLine.length; i++) {
      sum += macdLine[i];
    }
    let signalEMA = sum / signalPeriod;

    for (let i = signalPeriod - 1; i < macdLine.length; i++) {
      if (i === signalPeriod - 1) {
        signalLine.push(signalEMA);
      } else {
        signalEMA = (macdLine[i] - signalEMA) * multiplier + signalEMA;
        signalLine.push(signalEMA);
      }
    }

    // Format results
    const macdResult = [];
    const signalResult = [];
    const histogramResult = [];

    for (let i = 0; i < signalLine.length; i++) {
      const dataIndex = startIndex + signalPeriod - 1 + i;
      const time = data[dataIndex].time;
      const macdValue = macdLine[signalPeriod - 1 + i];
      const signalValue = signalLine[i];

      macdResult.push({ time, value: macdValue });
      signalResult.push({ time, value: signalValue });
      histogramResult.push({
        time,
        value: macdValue - signalValue,
        color: macdValue >= signalValue ? 'rgba(0, 255, 136, 0.5)' : 'rgba(255, 107, 107, 0.5)'
      });
    }

    return { macd: macdResult, signal: signalResult, histogram: histogramResult };
  };

  const calculateBollingerBands = (data, period = 20, stdDev = 2) => {
    const upper = [];
    const middle = [];
    const lower = [];

    for (let i = period - 1; i < data.length; i++) {
      // Calculate SMA (middle band)
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j].close;
      }
      const sma = sum / period;

      // Calculate standard deviation
      let variance = 0;
      for (let j = 0; j < period; j++) {
        variance += Math.pow(data[i - j].close - sma, 2);
      }
      const stdDeviation = Math.sqrt(variance / period);

      // Calculate bands
      middle.push({ time: data[i].time, value: sma });
      upper.push({ time: data[i].time, value: sma + (stdDev * stdDeviation) });
      lower.push({ time: data[i].time, value: sma - (stdDev * stdDeviation) });
    }

    return { upper, middle, lower };
  };

  const calculateSupportResistance = (data, sensitivity = 5) => {
    const levels = [];

    // Find swing highs and lows
    for (let i = sensitivity; i < data.length - sensitivity; i++) {
      let isSwingHigh = true;
      let isSwingLow = true;

      // Check if current point is a swing high or low
      for (let j = 1; j <= sensitivity; j++) {
        if (data[i].high <= data[i - j].high || data[i].high <= data[i + j].high) {
          isSwingHigh = false;
        }
        if (data[i].low >= data[i - j].low || data[i].low >= data[i + j].low) {
          isSwingLow = false;
        }
      }

      if (isSwingHigh) {
        levels.push({ price: data[i].high, type: 'resistance' });
      }
      if (isSwingLow) {
        levels.push({ price: data[i].low, type: 'support' });
      }
    }

    // Merge nearby levels (within 0.5% of each other)
    const mergedLevels = [];
    levels.forEach(level => {
      const existing = mergedLevels.find(l =>
        Math.abs(l.price - level.price) / level.price < 0.005 && l.type === level.type
      );

      if (!existing) {
        mergedLevels.push({ ...level, touches: 1 });
      } else {
        existing.touches++;
        existing.price = (existing.price + level.price) / 2; // Average the price
      }
    });

    // Sort by number of touches (most significant levels)
    return mergedLevels.sort((a, b) => b.touches - a.touches).slice(0, 8); // Top 8 levels
  };

  const calculatePivotPoints = (data) => {
    if (data.length === 0) return null;

    // Use the most recent complete candle for pivot calculation
    const lastCandle = data[data.length - 1];
    const high = lastCandle.high;
    const low = lastCandle.low;
    const close = lastCandle.close;

    // Classic Pivot Points
    const pp = (high + low + close) / 3;
    const r1 = (2 * pp) - low;
    const s1 = (2 * pp) - high;
    const r2 = pp + (high - low);
    const s2 = pp - (high - low);
    const r3 = high + 2 * (pp - low);
    const s3 = low - 2 * (high - pp);

    return {
      pp: { price: pp, label: 'PP' },
      r1: { price: r1, label: 'R1' },
      r2: { price: r2, label: 'R2' },
      r3: { price: r3, label: 'R3' },
      s1: { price: s1, label: 'S1' },
      s2: { price: s2, label: 'S2' },
      s3: { price: s3, label: 'S3' }
    };
  };

  const fetchSymbols = async () => {
    try {
      const response = await fetch('/api/backtest/symbols');
      const result = await response.json();

      if (result.success) {
        setSymbols(result.data);
        const exchanges = [...new Set(result.data.map(s => s.exchange))];
        setAvailableExchanges(exchanges);
        const defaultExchange = exchanges.includes('binance') ? 'binance' : exchanges[0];
        const filtered = result.data.filter(s => s.exchange.toLowerCase() === defaultExchange.toLowerCase());

        if (filtered.length > 0) {
          setFormData(prev => ({
            ...prev,
            exchange: defaultExchange,
            symbol: filtered[0].symbol
          }));
        }
      }
    } catch (err) {
      console.error('Error fetching symbols:', err);
    }
  };

  const fetchHistoricalData = async () => {
    try {
      setLoading(true);
      setError(null);
      setChartError(null);

      const params = new URLSearchParams({
        exchange: formData.exchange,
        symbol: formData.symbol,
        timeframe: formData.timeframe,
        limit: formData.limit
      });

      if (formData.start_date) params.append('start_date', formData.start_date);
      if (formData.end_date) params.append('end_date', formData.end_date);

      const response = await fetch(`/api/historical/data?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        console.log('Data received:', result.data);
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch data');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const initializeChart = () => {
    try {
      if (!chartContainerRef.current || !data || !data.ohlcv || data.ohlcv.length === 0) {
        return;
      }

      console.log('Initializing chart with', data.ohlcv.length, 'candles');

      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }

      const containerWidth = chartContainerRef.current.clientWidth || 800;
      const chartHeight = 500;

      const chart = createChart(chartContainerRef.current, {
        width: containerWidth,
        height: chartHeight,
        layout: {
          background: { color: '#0a0e27' },
          textColor: '#b8c2db',
        },
        grid: {
          vertLines: { color: '#1a1f3a' },
          horzLines: { color: '#1a1f3a' },
        },
        crosshair: {
          mode: 1,
          vertLine: {
            color: '#00d9ff',
            width: 1,
            style: 2,
            labelBackgroundColor: '#00d9ff',
          },
          horzLine: {
            color: '#00d9ff',
            width: 1,
            style: 2,
            labelBackgroundColor: '#00d9ff',
          },
        },
        rightPriceScale: {
          borderColor: '#2a3f5f',
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
        },
        timeScale: {
          borderColor: '#2a3f5f',
          timeVisible: true,
          secondsVisible: false,
        },
        watermark: {
          visible: true,
          fontSize: 48,
          horzAlign: 'center',
          vertAlign: 'center',
          color: 'rgba(0, 217, 255, 0.1)',
          text: `${data.symbol} ${data.timeframe}`,
        },
      });

      chartRef.current = chart;

      // Transform data
      const chartData = data.ohlcv.map((candle) => {
        let timestamp = candle.timestamp;
        if (typeof timestamp === 'string') {
          timestamp = new Date(timestamp).getTime();
        } else if (timestamp instanceof Date) {
          timestamp = timestamp.getTime();
        }
        const time = Math.floor(timestamp / 1000);

        return {
          time: time,
          open: parseFloat(candle.open),
          high: parseFloat(candle.high),
          low: parseFloat(candle.low),
          close: parseFloat(candle.close),
          volume: parseFloat(candle.volume),
        };
      }).filter(item => item !== null);

      console.log('Chart data prepared:', chartData.length, 'valid candles');

      if (chartData.length === 0) {
        throw new Error('No valid data points after transformation');
      }

      // Add price series based on chart type
      let priceSeries;
      if (chartType === 'candlestick') {
        priceSeries = chart.addCandlestickSeries({
          upColor: '#00ff88',
          downColor: '#ff6b6b',
          borderUpColor: '#00ff88',
          borderDownColor: '#ff6b6b',
          wickUpColor: '#00ff88',
          wickDownColor: '#ff6b6b',
        });
      } else if (chartType === 'bars') {
        priceSeries = chart.addBarSeries({
          upColor: '#00ff88',
          downColor: '#ff6b6b',
        });
      } else if (chartType === 'line') {
        priceSeries = chart.addLineSeries({
          color: '#00d9ff',
          lineWidth: 2,
        });
      } else if (chartType === 'area') {
        priceSeries = chart.addAreaSeries({
          topColor: 'rgba(0, 217, 255, 0.4)',
          bottomColor: 'rgba(0, 217, 255, 0.0)',
          lineColor: '#00d9ff',
          lineWidth: 2,
        });
      }

      priceSeriesRef.current = priceSeries;

      // Set data based on chart type
      if (chartType === 'candlestick' || chartType === 'bars') {
        priceSeries.setData(chartData);
      } else {
        // For line and area, use close prices
        const lineData = chartData.map(d => ({ time: d.time, value: d.close }));
        priceSeries.setData(lineData);
      }

      // Add latest price marker
      const lastCandle = chartData[chartData.length - 1];
      priceSeries.createPriceLine({
        price: lastCandle.close,
        color: lastCandle.close >= lastCandle.open ? '#00ff88' : '#ff6b6b',
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'Last',
      });

      // Add Moving Averages
      if (showMA20) {
        const ma20Series = chart.addLineSeries({
          color: '#2196F3',
          lineWidth: 2,
          title: 'EMA 20',
        });
        const ma20Data = calculateEMA(chartData, 20);
        ma20Series.setData(ma20Data);
        ma20SeriesRef.current = ma20Series;
      }

      if (showMA50) {
        const ma50Series = chart.addLineSeries({
          color: '#FF9800',
          lineWidth: 2,
          title: 'EMA 50',
        });
        const ma50Data = calculateEMA(chartData, 50);
        ma50Series.setData(ma50Data);
        ma50SeriesRef.current = ma50Series;
      }

      if (showMA200 && chartData.length >= 200) {
        const ma200Series = chart.addLineSeries({
          color: '#9C27B0',
          lineWidth: 2,
          title: 'EMA 200',
        });
        const ma200Data = calculateEMA(chartData, 200);
        ma200Series.setData(ma200Data);
        ma200SeriesRef.current = ma200Series;
      }

      // Add Bollinger Bands if enabled
      if (showBB && chartData.length >= 20) {
        const bbData = calculateBollingerBands(chartData, 20, 2);

        // Upper band
        const bbUpperSeries = chart.addLineSeries({
          color: 'rgba(33, 150, 243, 0.3)',
          lineWidth: 1,
          lineStyle: 2,
          title: 'BB Upper',
        });
        bbUpperSeries.setData(bbData.upper);
        bbUpperSeriesRef.current = bbUpperSeries;

        // Middle band (SMA 20)
        const bbMiddleSeries = chart.addLineSeries({
          color: 'rgba(33, 150, 243, 0.5)',
          lineWidth: 1,
          lineStyle: 2,
          title: 'BB Middle',
        });
        bbMiddleSeries.setData(bbData.middle);
        bbMiddleSeriesRef.current = bbMiddleSeries;

        // Lower band
        const bbLowerSeries = chart.addLineSeries({
          color: 'rgba(33, 150, 243, 0.3)',
          lineWidth: 1,
          lineStyle: 2,
          title: 'BB Lower',
        });
        bbLowerSeries.setData(bbData.lower);
        bbLowerSeriesRef.current = bbLowerSeries;
      }

      // Add Support/Resistance levels if enabled
      if (showSR) {
        const srLevels = calculateSupportResistance(chartData, 5);

        srLevels.forEach((level, index) => {
          const color = level.type === 'resistance'
            ? 'rgba(255, 107, 107, 0.6)'
            : 'rgba(0, 255, 136, 0.6)';

          priceSeries.createPriceLine({
            price: level.price,
            color: color,
            lineWidth: 2,
            lineStyle: 1, // Solid line
            axisLabelVisible: true,
            title: level.type === 'resistance' ? 'R' : 'S',
          });
        });
      }

      // Add Pivot Points if enabled
      if (showPivots) {
        const pivots = calculatePivotPoints(chartData);

        if (pivots) {
          // Pivot Point (PP) - Yellow
          priceSeries.createPriceLine({
            price: pivots.pp.price,
            color: '#FFD700',
            lineWidth: 2,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: 'PP',
          });

          // Resistance levels - Red shades
          priceSeries.createPriceLine({
            price: pivots.r1.price,
            color: 'rgba(255, 107, 107, 0.8)',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: 'R1',
          });
          priceSeries.createPriceLine({
            price: pivots.r2.price,
            color: 'rgba(255, 107, 107, 0.6)',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: 'R2',
          });
          priceSeries.createPriceLine({
            price: pivots.r3.price,
            color: 'rgba(255, 107, 107, 0.4)',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: 'R3',
          });

          // Support levels - Green shades
          priceSeries.createPriceLine({
            price: pivots.s1.price,
            color: 'rgba(0, 255, 136, 0.8)',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: 'S1',
          });
          priceSeries.createPriceLine({
            price: pivots.s2.price,
            color: 'rgba(0, 255, 136, 0.6)',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: 'S2',
          });
          priceSeries.createPriceLine({
            price: pivots.s3.price,
            color: 'rgba(0, 255, 136, 0.4)',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: 'S3',
          });
        }
      }

      // Add Pivot Trendlines from backend API
      if (showTrendlines && trendlineData) {
        console.log('Rendering trendlines:', trendlineData);

        // Helper to find chart data index by timestamp
        const findIndexByTimestamp = (timestamp) => {
          const targetTime = new Date(timestamp).getTime() / 1000;
          for (let i = 0; i < chartData.length; i++) {
            if (chartData[i].time >= targetTime) {
              return i;
            }
          }
          return chartData.length - 1;
        };

        // Resistance Trendline (Orange)
        if (trendlineData.resistance_trendline) {
          const resistance = trendlineData.resistance_trendline;
          const startIdx = findIndexByTimestamp(resistance.start.timestamp);
          const endIdx = chartData.length - 1;

          // Calculate slope per bar
          const barsCount = endIdx - startIdx;
          const pricePerBar = barsCount > 0 ? (resistance.current.price - resistance.start.price) / barsCount : 0;

          // Generate trendline points including projection
          const trendlinePoints = [];
          for (let i = startIdx; i < chartData.length; i++) {
            const price = resistance.start.price + (i - startIdx) * pricePerBar;
            trendlinePoints.push({ time: chartData[i].time, value: price });
          }

          // Add projected points (future)
          const projectionBars = 20;
          const lastTime = chartData[chartData.length - 1].time;
          const timeInterval = chartData.length > 1 ? chartData[1].time - chartData[0].time : 3600;

          for (let i = 1; i <= projectionBars; i++) {
            const futureTime = lastTime + (timeInterval * i);
            const price = resistance.start.price + (chartData.length - 1 - startIdx + i) * pricePerBar;
            trendlinePoints.push({ time: futureTime, value: price });
          }

          const resistanceSeries = chart.addLineSeries({
            color: '#FF9800',
            lineWidth: 2,
            lineStyle: 2, // Dashed
            priceLineVisible: false,
            lastValueVisible: true,
            title: 'Resistance',
          });
          resistanceSeries.setData(trendlinePoints);
          resistanceTrendlineSeriesRef.current = resistanceSeries;

          // Add projected price label
          priceSeries.createPriceLine({
            price: resistance.projected.price,
            color: 'rgba(255, 152, 0, 0.5)',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: `R-Proj`,
          });
        }

        // Support Trendline (Cyan)
        if (trendlineData.support_trendline) {
          const support = trendlineData.support_trendline;
          const startIdx = findIndexByTimestamp(support.start.timestamp);
          const endIdx = chartData.length - 1;

          // Calculate slope per bar
          const barsCount = endIdx - startIdx;
          const pricePerBar = barsCount > 0 ? (support.current.price - support.start.price) / barsCount : 0;

          // Generate trendline points including projection
          const trendlinePoints = [];
          for (let i = startIdx; i < chartData.length; i++) {
            const price = support.start.price + (i - startIdx) * pricePerBar;
            trendlinePoints.push({ time: chartData[i].time, value: price });
          }

          // Add projected points (future)
          const projectionBars = 20;
          const lastTime = chartData[chartData.length - 1].time;
          const timeInterval = chartData.length > 1 ? chartData[1].time - chartData[0].time : 3600;

          for (let i = 1; i <= projectionBars; i++) {
            const futureTime = lastTime + (timeInterval * i);
            const price = support.start.price + (chartData.length - 1 - startIdx + i) * pricePerBar;
            trendlinePoints.push({ time: futureTime, value: price });
          }

          const supportSeries = chart.addLineSeries({
            color: '#00BCD4',
            lineWidth: 2,
            lineStyle: 2, // Dashed
            priceLineVisible: false,
            lastValueVisible: true,
            title: 'Support',
          });
          supportSeries.setData(trendlinePoints);
          supportTrendlineSeriesRef.current = supportSeries;

          // Add projected price label
          priceSeries.createPriceLine({
            price: support.projected.price,
            color: 'rgba(0, 188, 212, 0.5)',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: `S-Proj`,
          });
        }
      }

      // Add crosshair move handler for legend update
      chart.subscribeCrosshairMove((param) => {
        if (!legendRef.current) return;

        if (param.time) {
          const data = param.seriesData.get(priceSeries);
          if (data) {
            let legendHTML = `<div style="font-size: 14px; color: #00d9ff; font-weight: bold;">${formData.symbol}</div>`;

            if (chartType === 'candlestick' || chartType === 'bars') {
              const priceChange = data.close - data.open;
              const priceChangePercent = (priceChange / data.open) * 100;
              const changeColor = priceChange >= 0 ? '#00ff88' : '#ff6b6b';

              legendHTML += `
                <div style="margin-top: 8px; line-height: 1.8;">
                  <span style="color: #b8c2db;">O:</span> <span style="color: #fff;">${data.open.toFixed(2)}</span>
                  <span style="color: #b8c2db; margin-left: 12px;">H:</span> <span style="color: #00ff88;">${data.high.toFixed(2)}</span>
                  <span style="color: #b8c2db; margin-left: 12px;">L:</span> <span style="color: #ff6b6b;">${data.low.toFixed(2)}</span>
                  <span style="color: #b8c2db; margin-left: 12px;">C:</span> <span style="color: #00d9ff; font-weight: bold;">${data.close.toFixed(2)}</span>
                  <span style="color: ${changeColor}; margin-left: 12px;">${priceChange >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%</span>
                </div>
              `;
            } else {
              legendHTML += `
                <div style="margin-top: 8px;">
                  <span style="color: #b8c2db;">Price:</span> <span style="color: #00d9ff; font-weight: bold;">${data.value.toFixed(2)}</span>
                </div>
              `;
            }

            // Add MA values if visible
            if (showMA20 && ma20SeriesRef.current) {
              const ma20Data = param.seriesData.get(ma20SeriesRef.current);
              if (ma20Data) {
                legendHTML += `<div style="color: #2196F3; margin-top: 4px;">EMA20: ${ma20Data.value.toFixed(2)}</div>`;
              }
            }
            if (showMA50 && ma50SeriesRef.current) {
              const ma50Data = param.seriesData.get(ma50SeriesRef.current);
              if (ma50Data) {
                legendHTML += `<div style="color: #FF9800; margin-top: 4px;">EMA50: ${ma50Data.value.toFixed(2)}</div>`;
              }
            }
            if (showMA200 && ma200SeriesRef.current) {
              const ma200Data = param.seriesData.get(ma200SeriesRef.current);
              if (ma200Data) {
                legendHTML += `<div style="color: #9C27B0; margin-top: 4px;">EMA200: ${ma200Data.value.toFixed(2)}</div>`;
              }
            }

            legendRef.current.innerHTML = legendHTML;
          }
        }
      });

      // Render user-drawn lines
      drawnSeriesRefs.current.forEach(series => {
        if (series) {
          try {
            chart.removeSeries(series);
          } catch (e) {
            // Series might already be removed
          }
        }
      });
      drawnSeriesRefs.current = [];

      drawnLines.forEach((line, index) => {
        if (line.type === 'horizontal') {
          priceSeries.createPriceLine({
            price: line.price,
            color: line.color || '#00d9ff',
            lineWidth: 2,
            lineStyle: 0, // Solid
            axisLabelVisible: true,
            title: line.label || 'Line',
          });
        } else if (line.type === 'trendline') {
          const trendSeries = chart.addLineSeries({
            color: line.color || '#00d9ff',
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          trendSeries.setData([
            { time: line.point1.time, value: line.point1.price },
            { time: line.point2.time, value: line.point2.price }
          ]);
          drawnSeriesRefs.current.push(trendSeries);
        }
      });

      // Add click handler for drawing
      chart.subscribeClick((param) => {
        const currentDrawingMode = drawingModeRef.current;
        console.log('Chart clicked! Drawing mode:', currentDrawingMode, 'param:', param);

        if (!currentDrawingMode) {
          console.log('No drawing mode active');
          return;
        }

        let clickedPrice = null;

        // Try to get price from series data first
        if (param.time && param.seriesData) {
          const priceData = param.seriesData.get(priceSeries);
          if (priceData) {
            clickedPrice = chartTypeRef.current === 'candlestick' || chartTypeRef.current === 'bars'
              ? priceData.close
              : priceData.value;
            console.log('Got price from series data:', clickedPrice);
          }
        }

        // Fallback: convert y-coordinate to price
        if (clickedPrice === null && param.point) {
          try {
            clickedPrice = chart.priceScale('right').coordinateToPrice(param.point.y);
            console.log('Got price from coordinate conversion:', clickedPrice);
          } catch (e) {
            console.error('Error converting coordinate to price:', e);
            return;
          }
        }

        if (clickedPrice === null || clickedPrice === undefined) {
          console.log('Could not determine price from click');
          return;
        }

        console.log('✓ Drawing at price:', clickedPrice, 'time:', param.time);

        if (currentDrawingMode === 'horizontal') {
          const newLine = {
            type: 'horizontal',
            price: clickedPrice,
            color: '#00d9ff',
            label: 'H-Line'
          };
          console.log('Adding horizontal line:', newLine);
          setDrawnLines(prev => [...prev, newLine]);
          setDrawingMode(null); // Exit drawing mode after one line
        } else if (currentDrawingMode === 'trendline') {
          const currentTempLine = tempTrendLineRef.current;
          if (!currentTempLine) {
            // First point
            console.log('Setting first point for trend line');
            setTempTrendLine({
              time: param.time,
              price: clickedPrice
            });
          } else {
            // Second point - complete the line
            const newLine = {
              type: 'trendline',
              point1: currentTempLine,
              point2: {
                time: param.time,
                price: clickedPrice
              },
              color: '#00d9ff'
            };
            console.log('Completing trend line:', newLine);
            setDrawnLines(prev => [...prev, newLine]);
            setTempTrendLine(null);
            setDrawingMode(null); // Exit drawing mode after one line
          }
        }
      });

      chart.timeScale().fitContent();

      // Add combined indicators chart if any indicator is enabled
      if ((showVolume || showRSI || showMACD) && indicatorChartContainerRef.current) {
        const indicatorChart = createChart(indicatorChartContainerRef.current, {
          width: containerWidth,
          height: 200,
          layout: {
            background: { color: '#0a0e27' },
            textColor: '#b8c2db',
          },
          grid: {
            vertLines: { color: '#1a1f3a' },
            horzLines: { color: '#1a1f3a' },
          },
          leftPriceScale: {
            borderColor: '#2a3f5f',
            visible: showRSI,
          },
          rightPriceScale: {
            borderColor: '#2a3f5f',
            visible: showMACD,
          },
          timeScale: {
            borderColor: '#2a3f5f',
            visible: false,
          },
        });

        indicatorChartRef.current = indicatorChart;

        // Add Volume if enabled
        if (showVolume) {
          const volumeSeries = indicatorChart.addHistogramSeries({
            color: '#26a69a',
            priceFormat: {
              type: 'volume',
            },
            priceScaleId: 'volume',
            scaleMargins: {
              top: 0.8,
              bottom: 0,
            },
          });

          const volumeData = chartData.map(d => ({
            time: d.time,
            value: d.volume,
            color: d.close >= d.open ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 107, 107, 0.3)',
          }));

          volumeSeries.setData(volumeData);
          volumeSeriesRef.current = volumeSeries;
        }

        // Add RSI if enabled
        if (showRSI) {
          const rsiSeries = indicatorChart.addLineSeries({
            color: '#9C27B0',
            lineWidth: 2,
            title: 'RSI',
            priceScaleId: 'left',
          });

          const rsiData = calculateRSI(chartData, 14);
          rsiSeries.setData(rsiData);
          rsiSeriesRef.current = rsiSeries;

          // Add overbought/oversold lines
          indicatorChart.addLineSeries({
            color: 'rgba(255, 107, 107, 0.3)',
            lineWidth: 1,
            lineStyle: 2,
            priceScaleId: 'left',
          }).setData(rsiData.map(d => ({ time: d.time, value: 70 })));

          indicatorChart.addLineSeries({
            color: 'rgba(0, 255, 136, 0.3)',
            lineWidth: 1,
            lineStyle: 2,
            priceScaleId: 'left',
          }).setData(rsiData.map(d => ({ time: d.time, value: 30 })));
        }

        // Add MACD if enabled
        if (showMACD) {
          const macdData = calculateMACD(chartData, 12, 26, 9);

          // Add histogram
          const histogramSeries = indicatorChart.addHistogramSeries({
            color: '#26a69a',
            priceScaleId: 'right',
          });
          histogramSeries.setData(macdData.histogram);
          macdHistogramSeriesRef.current = histogramSeries;

          // Add MACD line
          const macdLineSeries = indicatorChart.addLineSeries({
            color: '#2196F3',
            lineWidth: 2,
            title: 'MACD',
            priceScaleId: 'right',
          });
          macdLineSeries.setData(macdData.macd);
          macdLineSeriesRef.current = macdLineSeries;

          // Add Signal line
          const signalLineSeries = indicatorChart.addLineSeries({
            color: '#FF9800',
            lineWidth: 2,
            title: 'Signal',
            priceScaleId: 'right',
          });
          signalLineSeries.setData(macdData.signal);
          macdSignalSeriesRef.current = signalLineSeries;

          // Add zero line
          indicatorChart.addLineSeries({
            color: 'rgba(184, 194, 219, 0.2)',
            lineWidth: 1,
            lineStyle: 2,
            priceScaleId: 'right',
          }).setData(macdData.macd.map(d => ({ time: d.time, value: 0 })));
        }

        // Sync time scale with main chart (improved synchronization)
        console.log('Setting up chart synchronization');

        const syncToIndicator = (timeRange) => {
          if (!timeRange) return;
          console.log('Syncing main chart -> indicator:', timeRange);
          indicatorChart.timeScale().setVisibleRange(timeRange);
        };

        const syncToMain = (timeRange) => {
          if (!timeRange) return;
          console.log('Syncing indicator -> main chart:', timeRange);
          chartRef.current.timeScale().setVisibleRange(timeRange);
        };

        // Sync when main chart changes
        chart.timeScale().subscribeVisibleTimeRangeChange((timeRange) => {
          if (timeRange) {
            syncToIndicator(timeRange);
          }
        });

        // Sync when indicator chart changes
        indicatorChart.timeScale().subscribeVisibleTimeRangeChange((timeRange) => {
          if (timeRange) {
            syncToMain(timeRange);
          }
        });
      }

      console.log('Chart initialized successfully');
    } catch (err) {
      console.error('Chart initialization error:', err);
      setChartError('Chart error: ' + err.message);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      chartContainerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    fetchHistoricalData();
  };

  const getFilteredSymbols = () => {
    return symbols.filter(s => s.exchange.toLowerCase() === formData.exchange.toLowerCase());
  };

  const darkCardStyle = {
    backgroundColor: '#1a1f3a',
    border: '1px solid #2a3f5f',
    borderRadius: '12px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
  };

  const inputStyle = {
    backgroundColor: '#0f1729',
    border: '1px solid #2a3f5f',
    color: '#fff',
    borderRadius: '8px'
  };

  const buttonStyle = {
    backgroundColor: '#00d9ff',
    color: '#0a0e27',
    border: 'none',
    fontWeight: '600',
    borderRadius: '8px'
  };

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
      <div className="container-fluid mt-4 pb-5">
        <div className="row mb-4">
          <div className="col-12">
            <h1 className="fw-bold mb-2" style={{ color: '#00d9ff' }}>Historical Market Data</h1>
            <p className="text-muted">Professional charting with technical indicators</p>
          </div>
        </div>

      {/* Filter Form */}
      <div className="mb-4" style={darkCardStyle}>
        <div className="card-header py-3" style={{
          backgroundColor: '#0f1729',
          borderBottom: '2px solid #00d9ff',
          borderRadius: '12px 12px 0 0'
        }}>
          <h5 className="mb-0 fw-bold" style={{ color: '#00d9ff' }}>📊 Data Query</h5>
        </div>
        <div className="card-body p-4">
          <form onSubmit={handleSubmit}>
            <div className="row mb-3">
              <div className="col-md-3">
                <label className="form-label text-light mb-2 fw-semibold">Exchange</label>
                <select className="form-select py-2" style={inputStyle} name="exchange" value={formData.exchange} onChange={handleInputChange} required>
                  {availableExchanges.map(ex => (
                    <option key={ex} value={ex}>{ex.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label text-light mb-2 fw-semibold">Symbol</label>
                <select className="form-select py-2" style={inputStyle} name="symbol" value={formData.symbol} onChange={handleInputChange} required>
                  {getFilteredSymbols().map(sym => (
                    <option key={`${sym.exchange}-${sym.symbol}`} value={sym.symbol}>{sym.symbol}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label text-light mb-2 fw-semibold">Timeframe</label>
                <select className="form-select py-2" style={inputStyle} name="timeframe" value={formData.timeframe} onChange={handleInputChange} required>
                  <option value="1m">1 Minute</option>
                  <option value="5m">5 Minutes</option>
                  <option value="15m">15 Minutes</option>
                  <option value="30m">30 Minutes</option>
                  <option value="1h">1 Hour</option>
                  <option value="4h">4 Hours</option>
                  <option value="1d">1 Day</option>
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label text-light mb-2 fw-semibold">Limit</label>
                <input type="number" className="form-control py-2" style={inputStyle} name="limit" value={formData.limit} onChange={handleInputChange} min="1" max="5000" required />
              </div>
            </div>

            <div className="row mb-3">
              <div className="col-md-6">
                <label className="form-label text-light mb-2 fw-semibold">Start Date (Optional)</label>
                <input type="datetime-local" className="form-control py-2" style={inputStyle} name="start_date" value={formData.start_date} onChange={handleInputChange} />
              </div>
              <div className="col-md-6">
                <label className="form-label text-light mb-2 fw-semibold">End Date (Optional)</label>
                <input type="datetime-local" className="form-control py-2" style={inputStyle} name="end_date" value={formData.end_date} onChange={handleInputChange} />
              </div>
            </div>

            <div className="text-end">
              <button type="submit" className="btn btn-lg px-5 py-3" style={buttonStyle} disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Loading...
                  </>
                ) : (
                  '📈 Fetch Data'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {error && (
        <div className="alert py-4 mb-4" style={{ backgroundColor: '#ff6b6b', color: '#fff', borderRadius: '12px' }} role="alert">
          <h4 className="alert-heading fw-bold">❌ Error!</h4>
          <p className="mb-0">{error}</p>
        </div>
      )}

      {chartError && (
        <div className="alert py-4 mb-4" style={{ backgroundColor: '#ffa500', color: '#fff', borderRadius: '12px' }} role="alert">
          <h4 className="alert-heading fw-bold">⚠️ Chart Warning!</h4>
          <p className="mb-0">{chartError}</p>
          <p className="mb-0 mt-2"><small>Data table is still available below.</small></p>
        </div>
      )}

      {data && data.stats && (
        <div className="row mb-4">
          <div className="col-lg mb-3">
            <div style={darkCardStyle} className="p-4 text-center">
              <h6 className="text-muted mb-2">Data Points</h6>
              <h3 className="fw-bold" style={{ color: '#00d9ff' }}>{data.stats.count}</h3>
            </div>
          </div>
          <div className="col-lg mb-3">
            <div style={darkCardStyle} className="p-4 text-center">
              <h6 className="text-muted mb-2">Min Price</h6>
              <h3 className="fw-bold text-light">${data.stats.min_price.toFixed(2)}</h3>
            </div>
          </div>
          <div className="col-lg mb-3">
            <div style={darkCardStyle} className="p-4 text-center">
              <h6 className="text-muted mb-2">Max Price</h6>
              <h3 className="fw-bold text-light">${data.stats.max_price.toFixed(2)}</h3>
            </div>
          </div>
          <div className="col-lg mb-3">
            <div style={darkCardStyle} className="p-4 text-center">
              <h6 className="text-muted mb-2">Price Change</h6>
              <h3 className="fw-bold" style={{ color: data.stats.price_change >= 0 ? '#00ff88' : '#ff6b6b' }}>
                ${data.stats.price_change.toFixed(2)}
              </h3>
            </div>
          </div>
          <div className="col-lg mb-3">
            <div style={darkCardStyle} className="p-4 text-center">
              <h6 className="text-muted mb-2">Change %</h6>
              <h3 className="fw-bold" style={{ color: data.stats.price_change_percent >= 0 ? '#00ff88' : '#ff6b6b' }}>
                {data.stats.price_change_percent.toFixed(2)}%
              </h3>
            </div>
          </div>
        </div>
      )}

      {/* Chart Controls */}
      {data && data.ohlcv && data.ohlcv.length > 0 && (
        <>
          <div className="mb-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
            {/* View Mode */}
            <div className="d-flex gap-2">
              <button className="btn px-3 py-2" style={{ backgroundColor: viewMode === 'chart' ? '#00d9ff' : '#2a3f5f', color: viewMode === 'chart' ? '#0a0e27' : '#00d9ff', border: 'none', fontWeight: '600', borderRadius: '8px' }} onClick={() => setViewMode('chart')}>
                📊 Chart
              </button>
              <button className="btn px-3 py-2" style={{ backgroundColor: viewMode === 'both' ? '#00d9ff' : '#2a3f5f', color: viewMode === 'both' ? '#0a0e27' : '#00d9ff', border: 'none', fontWeight: '600', borderRadius: '8px' }} onClick={() => setViewMode('both')}>
                📊📋 Both
              </button>
              <button className="btn px-3 py-2" style={{ backgroundColor: viewMode === 'table' ? '#00d9ff' : '#2a3f5f', color: viewMode === 'table' ? '#0a0e27' : '#00d9ff', border: 'none', fontWeight: '600', borderRadius: '8px' }} onClick={() => setViewMode('table')}>
                📋 Table
              </button>
            </div>

            {/* Chart Type */}
            {(viewMode === 'chart' || viewMode === 'both') && (
              <div className="d-flex gap-2">
                <button className="btn px-3 py-2" style={{ backgroundColor: chartType === 'candlestick' ? '#00d9ff' : '#2a3f5f', color: chartType === 'candlestick' ? '#0a0e27' : '#b8c2db', border: 'none', borderRadius: '8px' }} onClick={() => setChartType('candlestick')} title="Candlestick">
                  📊
                </button>
                <button className="btn px-3 py-2" style={{ backgroundColor: chartType === 'bars' ? '#00d9ff' : '#2a3f5f', color: chartType === 'bars' ? '#0a0e27' : '#b8c2db', border: 'none', borderRadius: '8px' }} onClick={() => setChartType('bars')} title="Bars">
                  📶
                </button>
                <button className="btn px-3 py-2" style={{ backgroundColor: chartType === 'line' ? '#00d9ff' : '#2a3f5f', color: chartType === 'line' ? '#0a0e27' : '#b8c2db', border: 'none', borderRadius: '8px' }} onClick={() => setChartType('line')} title="Line">
                  📈
                </button>
                <button className="btn px-3 py-2" style={{ backgroundColor: chartType === 'area' ? '#00d9ff' : '#2a3f5f', color: chartType === 'area' ? '#0a0e27' : '#b8c2db', border: 'none', borderRadius: '8px' }} onClick={() => setChartType('area')} title="Area">
                  🏔️
                </button>
              </div>
            )}

            {/* Indicators */}
            {(viewMode === 'chart' || viewMode === 'both') && (
              <>
                <div className="d-flex gap-2 flex-wrap mb-2">
                  <button className="btn px-3 py-2" style={{ backgroundColor: showVolume ? '#00d9ff' : '#2a3f5f', color: showVolume ? '#0a0e27' : '#b8c2db', border: 'none', borderRadius: '8px', fontSize: '0.9rem' }} onClick={() => setShowVolume(!showVolume)}>
                    Vol
                  </button>
                  <button className="btn px-3 py-2" style={{ backgroundColor: showMA20 ? '#2196F3' : '#2a3f5f', color: showMA20 ? '#fff' : '#b8c2db', border: 'none', borderRadius: '8px', fontSize: '0.9rem' }} onClick={() => setShowMA20(!showMA20)}>
                    MA20
                  </button>
                  <button className="btn px-3 py-2" style={{ backgroundColor: showMA50 ? '#FF9800' : '#2a3f5f', color: showMA50 ? '#fff' : '#b8c2db', border: 'none', borderRadius: '8px', fontSize: '0.9rem' }} onClick={() => setShowMA50(!showMA50)}>
                    MA50
                  </button>
                  <button className="btn px-3 py-2" style={{ backgroundColor: showMA200 ? '#9C27B0' : '#2a3f5f', color: showMA200 ? '#fff' : '#b8c2db', border: 'none', borderRadius: '8px', fontSize: '0.9rem' }} onClick={() => setShowMA200(!showMA200)}>
                    MA200
                  </button>
                  <button className="btn px-3 py-2" style={{ backgroundColor: showBB ? '#2196F3' : '#2a3f5f', color: showBB ? '#fff' : '#b8c2db', border: 'none', borderRadius: '8px', fontSize: '0.9rem' }} onClick={() => setShowBB(!showBB)}>
                    BB
                  </button>
                  <button className="btn px-3 py-2" style={{ backgroundColor: showRSI ? '#9C27B0' : '#2a3f5f', color: showRSI ? '#fff' : '#b8c2db', border: 'none', borderRadius: '8px', fontSize: '0.9rem' }} onClick={() => setShowRSI(!showRSI)}>
                    RSI
                  </button>
                  <button className="btn px-3 py-2" style={{ backgroundColor: showMACD ? '#2196F3' : '#2a3f5f', color: showMACD ? '#fff' : '#b8c2db', border: 'none', borderRadius: '8px', fontSize: '0.9rem' }} onClick={() => setShowMACD(!showMACD)}>
                    MACD
                  </button>
                  <button className="btn px-3 py-2" style={{ backgroundColor: showSR ? '#00ff88' : '#2a3f5f', color: showSR ? '#0a0e27' : '#b8c2db', border: 'none', borderRadius: '8px', fontSize: '0.9rem' }} onClick={() => setShowSR(!showSR)}>
                    S/R
                  </button>
                  <button className="btn px-3 py-2" style={{ backgroundColor: showPivots ? '#FFD700' : '#2a3f5f', color: showPivots ? '#0a0e27' : '#b8c2db', border: 'none', borderRadius: '8px', fontSize: '0.9rem' }} onClick={() => setShowPivots(!showPivots)}>
                    Pivots
                  </button>
                  <button className="btn px-3 py-2" style={{ backgroundColor: showTrendlines ? '#FF5722' : '#2a3f5f', color: showTrendlines ? '#fff' : '#b8c2db', border: 'none', borderRadius: '8px', fontSize: '0.9rem' }} onClick={() => setShowTrendlines(!showTrendlines)} title="Pivot Trendlines with projection">
                    Trends
                  </button>
                  <button
                    className="btn px-3 py-2"
                    style={{
                      backgroundColor: realtimeEnabled ? '#00ff88' : '#2a3f5f',
                      color: realtimeEnabled ? '#0a0e27' : '#b8c2db',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      position: 'relative'
                    }}
                    onClick={() => setRealtimeEnabled(!realtimeEnabled)}
                    title={realtimeEnabled ? 'Disable real-time updates' : 'Enable real-time updates'}
                  >
                    {realtimeEnabled ? '🔴 Live' : '⚪ Live'}
                    {isConnected && realtimeEnabled && (
                      <span style={{
                        position: 'absolute',
                        top: '5px',
                        right: '5px',
                        width: '8px',
                        height: '8px',
                        backgroundColor: '#00ff88',
                        borderRadius: '50%',
                        animation: 'pulse 2s infinite'
                      }}></span>
                    )}
                  </button>
                  <button className="btn px-3 py-2" style={{ backgroundColor: '#2a3f5f', color: '#b8c2db', border: 'none', borderRadius: '8px' }} onClick={toggleFullscreen} title="Fullscreen">
                    ⛶
                  </button>
                </div>

                {/* Drawing Tools */}
                <div className="d-flex gap-2 flex-wrap align-items-center">
                  <span style={{ color: '#b8c2db', fontSize: '0.85rem', fontWeight: '600' }}>Draw:</span>
                  <button
                    className="btn px-3 py-2"
                    style={{
                      backgroundColor: drawingMode === 'horizontal' ? '#00d9ff' : '#2a3f5f',
                      color: drawingMode === 'horizontal' ? '#0a0e27' : '#b8c2db',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.9rem'
                    }}
                    onClick={() => {
                      const newMode = drawingMode === 'horizontal' ? null : 'horizontal';
                      console.log('Horizontal line button clicked. New mode:', newMode);

                      // Update ref synchronously
                      drawingModeRef.current = newMode;
                      console.log('drawingModeRef updated to:', drawingModeRef.current);

                      setDrawingMode(newMode);
                      setTempTrendLine(null);
                      tempTrendLineRef.current = null;
                    }}
                    title="Draw Horizontal Line"
                  >
                    ─
                  </button>
                  <button
                    className="btn px-3 py-2"
                    style={{
                      backgroundColor: drawingMode === 'trendline' ? '#00d9ff' : '#2a3f5f',
                      color: drawingMode === 'trendline' ? '#0a0e27' : '#b8c2db',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.9rem'
                    }}
                    onClick={() => {
                      const newMode = drawingMode === 'trendline' ? null : 'trendline';
                      console.log('Trend line button clicked. New mode:', newMode);

                      // Update ref synchronously
                      drawingModeRef.current = newMode;
                      console.log('drawingModeRef updated to:', drawingModeRef.current);

                      setDrawingMode(newMode);
                      setTempTrendLine(null);
                      tempTrendLineRef.current = null;
                    }}
                    title="Draw Trend Line"
                  >
                    ╱
                  </button>
                  {drawnLines.length > 0 && (
                    <button
                      className="btn px-3 py-2"
                      style={{
                        backgroundColor: '#ff6b6b',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '0.9rem'
                      }}
                      onClick={() => {
                        console.log('Clear button clicked');
                        setDrawnLines([]);
                        setDrawingMode(null);
                        drawingModeRef.current = null;
                        setTempTrendLine(null);
                        tempTrendLineRef.current = null;
                      }}
                      title="Clear All Lines"
                    >
                      Clear ({drawnLines.length})
                    </button>
                  )}
                  {drawingMode && (
                    <span style={{ color: '#00d9ff', fontSize: '0.85rem', marginLeft: '10px' }}>
                      {drawingMode === 'horizontal' ? '👆 Click on chart to draw horizontal line' :
                       tempTrendLine ? '👆 Click second point to complete trend line' : '👆 Click first point for trend line'}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Chart Display */}
      {data && data.ohlcv && data.ohlcv.length > 0 && (viewMode === 'chart' || viewMode === 'both') && (
        <div className="mb-4" style={darkCardStyle}>
          <div className="card-header py-3" style={{
            backgroundColor: '#0f1729',
            borderBottom: '2px solid #00d9ff',
            borderRadius: '12px 12px 0 0'
          }}>
            <div ref={legendRef} style={{ minHeight: '60px' }}>
              <div style={{ fontSize: '14px', color: '#00d9ff', fontWeight: 'bold' }}>{data.symbol}</div>
              <div style={{ fontSize: '12px', color: '#b8c2db', marginTop: '4px' }}>
                {data.stats.first_timestamp} to {data.stats.last_timestamp}
              </div>
            </div>
          </div>
          <div className="card-body p-3">
            <div
              ref={chartContainerRef}
              style={{
                position: 'relative',
                minHeight: '500px',
                cursor: drawingMode ? 'crosshair' : 'default'
              }}
            ></div>

            {/* Combined Indicators Chart */}
            {(showVolume || showRSI || showMACD) && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ fontSize: '12px', color: '#00d9ff', fontWeight: 'bold', marginBottom: '5px', paddingLeft: '10px' }}>
                  {showVolume && 'Volume '}
                  {showRSI && 'RSI '}
                  {showMACD && 'MACD'}
                </div>
                <div ref={indicatorChartContainerRef} style={{ position: 'relative', minHeight: '200px' }}></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Data Table */}
      {data && data.ohlcv && data.ohlcv.length > 0 && (viewMode === 'table' || viewMode === 'both') && (
        <div style={darkCardStyle}>
          <div className="card-header py-3" style={{
            backgroundColor: '#0f1729',
            borderBottom: '2px solid #00d9ff',
            borderRadius: '12px 12px 0 0'
          }}>
            <h5 className="mb-0 fw-bold" style={{ color: '#00d9ff' }}>📋 OHLCV Data Table</h5>
          </div>
          <div className="card-body p-3">
            <div className="table-responsive" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table className="table table-hover" style={{ borderCollapse: 'separate', borderSpacing: '0 4px' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#1a1f3a', zIndex: 1 }}>
                  <tr style={{ color: '#00d9ff' }}>
                    <th style={{ padding: '12px', border: '1px solid #2a3f5f' }}>Timestamp</th>
                    <th className="text-end" style={{ padding: '12px', border: '1px solid #2a3f5f' }}>Open</th>
                    <th className="text-end" style={{ padding: '12px', border: '1px solid #2a3f5f' }}>High</th>
                    <th className="text-end" style={{ padding: '12px', border: '1px solid #2a3f5f' }}>Low</th>
                    <th className="text-end" style={{ padding: '12px', border: '1px solid #2a3f5f' }}>Close</th>
                    <th className="text-end" style={{ padding: '12px', border: '1px solid #2a3f5f' }}>Volume</th>
                    <th className="text-end" style={{ padding: '12px', border: '1px solid #2a3f5f' }}>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ohlcv.map((candle, index) => {
                    const change = candle.close - candle.open;
                    const changePercent = (change / candle.open * 100);
                    return (
                      <tr key={index} style={{ backgroundColor: '#1a1f3a' }}>
                        <td style={{ padding: '12px', border: '1px solid #2a3f5f', color: '#b8c2db' }}>{new Date(candle.timestamp).toLocaleString()}</td>
                        <td className="text-end" style={{ padding: '12px', border: '1px solid #2a3f5f', color: '#b8c2db' }}>${candle.open.toFixed(2)}</td>
                        <td className="text-end" style={{ padding: '12px', border: '1px solid #2a3f5f', color: '#00ff88' }}>${candle.high.toFixed(2)}</td>
                        <td className="text-end" style={{ padding: '12px', border: '1px solid #2a3f5f', color: '#ff6b6b' }}>${candle.low.toFixed(2)}</td>
                        <td className="text-end" style={{ padding: '12px', border: '1px solid #2a3f5f' }}>
                          <strong style={{ color: '#00d9ff' }}>${candle.close.toFixed(2)}</strong>
                        </td>
                        <td className="text-end" style={{ padding: '12px', border: '1px solid #2a3f5f', color: '#b8c2db' }}>{candle.volume.toFixed(2)}</td>
                        <td className="text-end" style={{ padding: '12px', border: '1px solid #2a3f5f', color: change >= 0 ? '#00ff88' : '#ff6b6b', fontWeight: 'bold' }}>
                          {change >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {data && data.ohlcv && data.ohlcv.length === 0 && (
        <div className="alert py-4" style={{ backgroundColor: '#1a1f3a', color: '#00d9ff', border: '1px solid #2a3f5f', borderRadius: '12px' }}>
          <h4 className="alert-heading fw-bold">📭 No Data Found</h4>
          <p className="mb-0">No historical data available for the selected parameters. Try adjusting your filters or date range.</p>
        </div>
      )}
      </div>
    </>
  );
};

export default HistoricalData;

/**
 * Custom React Hook for WebSocket connections
 *
 * Usage:
 * const { subscribe, unsubscribe, lastMessage, connectionStatus } = useWebSocket('binance');
 *
 * subscribe(['BTCUSDT', 'ETHUSDT']);
 * // lastMessage will contain price updates
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export const useWebSocket = (exchange = 'binance') => {
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // disconnected, connecting, connected, error
  const [lastMessage, setLastMessage] = useState(null);
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const subscribedSymbols = useRef(new Set());

  // Determine WebSocket URL based on exchange
  const getWebSocketUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;

    switch (exchange) {
      case 'binance':
        return `${protocol}//${host}/ws/prices/binance/`;
      case 'zerodha':
        return `${protocol}//${host}/ws/prices/zerodha/`;
      case 'all':
        return `${protocol}//${host}/ws/prices/all/`;
      default:
        return `${protocol}//${host}/ws/prices/binance/`;
    }
  };

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    const url = getWebSocketUrl();
    console.log(`Connecting to WebSocket: ${url}`);
    setConnectionStatus('connecting');

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnectionStatus('connected');
        setError(null);
        reconnectAttempts.current = 0;

        // Resubscribe to symbols if any were previously subscribed
        if (subscribedSymbols.current.size > 0) {
          const symbols = Array.from(subscribedSymbols.current);
          ws.send(JSON.stringify({
            action: 'subscribe',
            symbols: symbols
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);

          // Log price updates (can be removed in production)
          if (data.price) {
            console.log(`[${data.exchange}] ${data.symbol}: $${data.price} (${data.changePercent > 0 ? '+' : ''}${data.changePercent?.toFixed(2)}%)`);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('WebSocket connection error');
        setConnectionStatus('error');
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setConnectionStatus('disconnected');

        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current += 1;
            connect();
          }, delay);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          setError('Max reconnection attempts reached');
          setConnectionStatus('error');
        }
      };

      wsRef.current = ws;

    } catch (err) {
      console.error('Error creating WebSocket:', err);
      setError(err.message);
      setConnectionStatus('error');
    }
  }, [exchange]);

  // Subscribe to symbols
  const subscribe = useCallback((symbols) => {
    if (!Array.isArray(symbols) || symbols.length === 0) {
      console.warn('subscribe: symbols must be a non-empty array');
      return;
    }

    // Add to subscribed symbols set
    symbols.forEach(symbol => subscribedSymbols.current.add(symbol));

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'subscribe',
        symbols: symbols
      }));
      console.log('Subscribed to:', symbols);
    } else {
      console.warn('WebSocket not connected. Symbols will be subscribed when connection is established.');
    }
  }, []);

  // Unsubscribe from symbols
  const unsubscribe = useCallback((symbols) => {
    if (!Array.isArray(symbols) || symbols.length === 0) {
      console.warn('unsubscribe: symbols must be a non-empty array');
      return;
    }

    // Remove from subscribed symbols set
    symbols.forEach(symbol => subscribedSymbols.current.delete(symbol));

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'unsubscribe',
        symbols: symbols
      }));
      console.log('Unsubscribed from:', symbols);
    }
  }, []);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnecting');
      wsRef.current = null;
    }

    subscribedSymbols.current.clear();
    setConnectionStatus('disconnected');
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    subscribe,
    unsubscribe,
    disconnect,
    reconnect: connect,
    lastMessage,
    connectionStatus,
    error,
    isConnected: connectionStatus === 'connected',
  };
};

export default useWebSocket;

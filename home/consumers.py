"""
WebSocket consumers for real-time price updates.

These consumers receive ticker data from Kafka (published by CryptoMarketData service)
and forward it to connected frontend clients via WebSocket.

Architecture:
    CryptoMarketData → Kafka → KafkaConsumerManager → Django Channels Consumer → WebSocket → Frontend
"""

import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.exceptions import StopConsumer
from django.conf import settings
import logging

from home.kafka_consumer import get_kafka_consumer_manager

logger = logging.getLogger(__name__)


class BinancePriceConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for Binance real-time price updates from Kafka.

    Frontend connects to: ws://localhost:8000/ws/prices/binance/
    Receives data from Kafka (published by CryptoMarketData service).
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.subscribed_symbols = set()
        self.kafka_manager = None
        self.loop = None

    async def connect(self):
        """Accept WebSocket connection from frontend."""
        await self.accept()

        # Store reference to the event loop
        self.loop = asyncio.get_event_loop()

        # Get Kafka consumer manager
        self.kafka_manager = get_kafka_consumer_manager()

        # Ensure Kafka consumer is started
        if not self.kafka_manager.running:
            self.kafka_manager.start()

        logger.info("Binance WebSocket consumer connected (via Kafka)")

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        # Unsubscribe from all symbols
        if self.kafka_manager:
            for symbol in list(self.subscribed_symbols):
                self.kafka_manager.unsubscribe(symbol, self._kafka_callback)

        self.subscribed_symbols.clear()
        logger.info(f"Binance WebSocket consumer disconnected: {close_code}")

    async def receive(self, text_data):
        """
        Receive messages from frontend WebSocket.

        Expected message format:
        {
            "action": "subscribe" | "unsubscribe",
            "symbols": ["BTCUSDT", "ETHUSDT", ...]
        }
        """
        try:
            data = json.loads(text_data)
            action = data.get('action')
            symbols = data.get('symbols', [])

            if action == 'subscribe':
                await self.subscribe_symbols(symbols)
            elif action == 'unsubscribe':
                await self.unsubscribe_symbols(symbols)
            else:
                await self.send(text_data=json.dumps({
                    'error': f'Unknown action: {action}'
                }))

        except json.JSONDecodeError as e:
            await self.send(text_data=json.dumps({
                'error': f'Invalid JSON: {str(e)}'
            }))
        except Exception as e:
            logger.error(f"Error in receive: {str(e)}")
            await self.send(text_data=json.dumps({
                'error': str(e)
            }))

    async def subscribe_symbols(self, symbols):
        """
        Subscribe to Kafka topics for given symbols.

        Args:
            symbols: List of trading pair symbols (e.g., ['BTCUSDT', 'ETHUSDT'])
        """
        for symbol in symbols:
            symbol_upper = symbol.upper()
            if symbol_upper not in self.subscribed_symbols:
                self.subscribed_symbols.add(symbol_upper)

                # Subscribe to Kafka topic via manager
                self.kafka_manager.subscribe(symbol_upper, self._kafka_callback)

        await self.send(text_data=json.dumps({
            'status': 'subscribed',
            'symbols': list(self.subscribed_symbols)
        }))

        logger.info(f"Subscribed to {len(self.subscribed_symbols)} symbols via Kafka")

    async def unsubscribe_symbols(self, symbols):
        """
        Unsubscribe from Kafka topics for given symbols.

        Args:
            symbols: List of trading pair symbols to unsubscribe from
        """
        for symbol in symbols:
            symbol_upper = symbol.upper()
            if symbol_upper in self.subscribed_symbols:
                self.subscribed_symbols.remove(symbol_upper)

                # Unsubscribe from Kafka topic
                self.kafka_manager.unsubscribe(symbol_upper, self._kafka_callback)

        await self.send(text_data=json.dumps({
            'status': 'unsubscribed',
            'symbols': symbols
        }))

        logger.info(f"Unsubscribed from {len(symbols)} symbols")

    def _kafka_callback(self, symbol: str, data: dict):
        """
        Callback function called by Kafka consumer when a message is received.

        This runs in the Kafka consumer thread, so we need to use asyncio to send
        the message to the WebSocket (which runs in the async event loop).

        Args:
            symbol: Trading pair symbol
            data: Ticker data from Kafka
        """
        try:
            # Schedule the send_price_update coroutine on the event loop
            if self.loop:
                asyncio.run_coroutine_threadsafe(
                    self.send_price_update(data),
                    self.loop
                )
        except Exception as e:
            logger.error(f"Error in Kafka callback for {symbol}: {e}")

    async def send_price_update(self, data: dict):
        """
        Send price update to WebSocket client.

        Args:
            data: Ticker data dictionary
        """
        try:
            await self.send(text_data=json.dumps(data))
        except Exception as e:
            logger.error(f"Error sending price update: {e}")


class ZerodhaPriceConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for Zerodha real-time price updates.

    Frontend connects to: ws://localhost:8000/ws/prices/zerodha/

    Note: Zerodha ticker streaming not yet implemented in CryptoMarketData.
    This is a placeholder for future implementation.
    """

    async def connect(self):
        """Accept WebSocket connection from frontend."""
        await self.accept()
        logger.info("Zerodha WebSocket consumer connected")

        # Send info message
        await self.send(text_data=json.dumps({
            'info': 'Zerodha ticker streaming not yet implemented. Stay tuned!'
        }))

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        logger.info(f"Zerodha WebSocket consumer disconnected: {close_code}")

    async def receive(self, text_data):
        """Receive messages from frontend WebSocket."""
        await self.send(text_data=json.dumps({
            'error': 'Zerodha ticker streaming not yet implemented'
        }))


class AllPricesConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for all exchanges (Binance + Zerodha).

    Frontend connects to: ws://localhost:8000/ws/prices/all/

    Note: Currently only supports Binance. Zerodha support coming soon.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.subscribed_symbols = set()
        self.kafka_manager = None
        self.loop = None

    async def connect(self):
        """Accept WebSocket connection from frontend."""
        await self.accept()

        # Store reference to the event loop
        self.loop = asyncio.get_event_loop()

        # Get Kafka consumer manager
        self.kafka_manager = get_kafka_consumer_manager()

        # Ensure Kafka consumer is started
        if not self.kafka_manager.running:
            self.kafka_manager.start()

        logger.info("All exchanges WebSocket consumer connected (Binance via Kafka)")

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        # Unsubscribe from all symbols
        if self.kafka_manager:
            for symbol in list(self.subscribed_symbols):
                self.kafka_manager.unsubscribe(symbol, self._kafka_callback)

        self.subscribed_symbols.clear()
        logger.info(f"All exchanges WebSocket consumer disconnected: {close_code}")

    async def receive(self, text_data):
        """
        Receive messages from frontend WebSocket.

        Expected message format:
        {
            "action": "subscribe" | "unsubscribe",
            "symbols": ["BTCUSDT", "ETHUSDT", ...],
            "exchange": "binance" | "zerodha" | "all"  (optional, default: "binance")
        }
        """
        try:
            data = json.loads(text_data)
            action = data.get('action')
            symbols = data.get('symbols', [])
            exchange = data.get('exchange', 'binance')

            if exchange == 'zerodha':
                await self.send(text_data=json.dumps({
                    'error': 'Zerodha ticker streaming not yet implemented'
                }))
                return

            if action == 'subscribe':
                await self.subscribe_symbols(symbols)
            elif action == 'unsubscribe':
                await self.unsubscribe_symbols(symbols)
            else:
                await self.send(text_data=json.dumps({
                    'error': f'Unknown action: {action}'
                }))

        except json.JSONDecodeError as e:
            await self.send(text_data=json.dumps({
                'error': f'Invalid JSON: {str(e)}'
            }))
        except Exception as e:
            logger.error(f"Error in receive: {str(e)}")
            await self.send(text_data=json.dumps({
                'error': str(e)
            }))

    async def subscribe_symbols(self, symbols):
        """Subscribe to Kafka topics for given symbols."""
        for symbol in symbols:
            symbol_upper = symbol.upper()
            if symbol_upper not in self.subscribed_symbols:
                self.subscribed_symbols.add(symbol_upper)
                self.kafka_manager.subscribe(symbol_upper, self._kafka_callback)

        await self.send(text_data=json.dumps({
            'status': 'subscribed',
            'symbols': list(self.subscribed_symbols)
        }))

    async def unsubscribe_symbols(self, symbols):
        """Unsubscribe from Kafka topics for given symbols."""
        for symbol in symbols:
            symbol_upper = symbol.upper()
            if symbol_upper in self.subscribed_symbols:
                self.subscribed_symbols.remove(symbol_upper)
                self.kafka_manager.unsubscribe(symbol_upper, self._kafka_callback)

        await self.send(text_data=json.dumps({
            'status': 'unsubscribed',
            'symbols': symbols
        }))

    def _kafka_callback(self, symbol: str, data: dict):
        """Callback function called by Kafka consumer when a message is received."""
        try:
            if self.loop:
                asyncio.run_coroutine_threadsafe(
                    self.send_price_update(data),
                    self.loop
                )
        except Exception as e:
            logger.error(f"Error in Kafka callback for {symbol}: {e}")

    async def send_price_update(self, data: dict):
        """Send price update to WebSocket client."""
        try:
            await self.send(text_data=json.dumps(data))
        except Exception as e:
            logger.error(f"Error sending price update: {e}")

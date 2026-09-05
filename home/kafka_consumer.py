"""
Kafka consumer for real-time price updates from CryptoMarketData service.

This module consumes ticker data from Kafka topics published by CryptoMarketData
and provides it to Django Channels consumers for WebSocket forwarding to the frontend.

Architecture:
    CryptoMarketData → Kafka (binance.ticks.{SYMBOL}) → KafkaConsumerManager → Django Channels → WebSocket → Frontend
"""

import json
import logging
import threading
from typing import Dict, Callable, Set
from kafka import KafkaConsumer
from kafka.errors import KafkaError

from CryptoWebServer import settings

logger = logging.getLogger(__name__)


class KafkaConsumerManager:
    """
    Manager for Kafka consumers that read real-time ticker data.

    This class handles:
    - Subscribing to symbol-specific Kafka topics
    - Consuming messages in a background thread
    - Routing messages to registered callback handlers
    - Automatic reconnection on failures

    Usage:
        manager = KafkaConsumerManager()
        manager.subscribe('BTCUSDT', callback_function)
        manager.start()
    """

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        """Singleton pattern to ensure only one consumer manager exists."""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        """Initialize the Kafka consumer manager."""
        if self._initialized:
            return

        self.kafka_bootstrap_servers = getattr(settings, 'KAFKA_BOOTSTRAP_SERVERS', 'kafka:9092')
        self.enabled = getattr(settings, 'ENABLE_KAFKA_CONSUMER', True)

        # Symbol subscriptions: {symbol: [callback1, callback2, ...]}
        self.subscriptions: Dict[str, list] = {}
        self._subscriptions_lock = threading.Lock()

        # Kafka consumer instance
        self.consumer = None
        self.consumer_thread = None
        self.running = False

        # Track current subscribed topics to avoid unnecessary subscribe() calls
        self._current_topics: Set[str] = set()

        # Statistics
        self.messages_consumed = 0
        self.errors = 0

        self._initialized = True

        if self.enabled:
            logger.info(f"KafkaConsumerManager initialized (bootstrap: {self.kafka_bootstrap_servers})")
        else:
            logger.info("KafkaConsumerManager disabled by configuration")

    def _get_topic_name(self, symbol: str) -> str:
        """
        Get Kafka topic name for a symbol.

        Args:
            symbol: Trading pair symbol (e.g., 'BTCUSDT')

        Returns:
            Kafka topic name (e.g., 'binance.ticks.BTCUSDT')
        """
        return f"binance.ticks.{symbol.upper()}"

    def subscribe(self, symbol: str, callback: Callable):
        """
        Subscribe to ticker updates for a symbol.

        Args:
            symbol: Trading pair symbol (e.g., 'BTCUSDT')
            callback: Function to call when a message is received
                     Signature: callback(symbol: str, data: dict)
        """
        with self._subscriptions_lock:
            symbol = symbol.upper()
            if symbol not in self.subscriptions:
                self.subscriptions[symbol] = []

            if callback not in self.subscriptions[symbol]:
                self.subscriptions[symbol].append(callback)
                logger.info(f"Subscribed to {symbol} ticker updates (callback: {callback.__name__})")

                # If consumer is already running, update subscriptions
                if self.running and self.consumer:
                    self._update_consumer_subscriptions()

    def unsubscribe(self, symbol: str, callback: Callable):
        """
        Unsubscribe from ticker updates for a symbol.

        Args:
            symbol: Trading pair symbol
            callback: Callback function to remove
        """
        with self._subscriptions_lock:
            symbol = symbol.upper()
            if symbol in self.subscriptions and callback in self.subscriptions[symbol]:
                self.subscriptions[symbol].remove(callback)
                logger.info(f"Unsubscribed from {symbol} ticker updates")

                # Remove symbol entry if no more callbacks
                if not self.subscriptions[symbol]:
                    del self.subscriptions[symbol]

                # Update consumer subscriptions
                if self.running and self.consumer:
                    self._update_consumer_subscriptions()

    def _update_consumer_subscriptions(self):
        """Update Kafka consumer topic subscriptions based on current symbols."""
        if not self.consumer:
            return

        topics = set([self._get_topic_name(symbol) for symbol in self.subscriptions.keys()])

        # Only update if topics have changed
        if topics != self._current_topics:
            if topics:
                self.consumer.subscribe(list(topics))
                self._current_topics = topics
                logger.info(f"Updated Kafka subscriptions: {len(topics)} topics")
            else:
                self.consumer.unsubscribe()
                self._current_topics = set()
                logger.info("No active subscriptions, unsubscribing from all topics")

    def _consume_messages(self):
        """
        Background thread function that consumes messages from Kafka.

        This runs continuously until stop() is called.
        """
        logger.info("Kafka consumer thread started")

        try:
            # Create Kafka consumer
            self.consumer = KafkaConsumer(
                bootstrap_servers=self.kafka_bootstrap_servers,
                value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                auto_offset_reset='latest',  # Start from latest messages
                enable_auto_commit=True,
                group_id='cryptowebserver-price-consumer',
                consumer_timeout_ms=1000  # Check for stop signal every second
            )

            # Subscribe to topics for current symbols
            self._update_consumer_subscriptions()

            # Consume messages
            while self.running:
                try:
                    # Poll for messages
                    messages = self.consumer.poll(timeout_ms=1000, max_records=100)

                    for topic_partition, records in messages.items():
                        for record in records:
                            self._handle_message(record)

                except Exception as e:
                    self.errors += 1
                    logger.error(f"Error consuming Kafka message: {e}")

        except Exception as e:
            logger.error(f"Fatal error in Kafka consumer thread: {e}")
            self.running = False

        finally:
            if self.consumer:
                self.consumer.close()
                logger.info("Kafka consumer closed")

    def _handle_message(self, record):
        """
        Handle a single Kafka message.

        Args:
            record: Kafka ConsumerRecord
        """
        try:
            self.messages_consumed += 1

            # Extract symbol from topic name (binance.ticks.BTCUSDT -> BTCUSDT)
            topic = record.topic
            symbol = topic.split('.')[-1]

            # Get message data
            data = record.value

            # Call all registered callbacks for this symbol
            with self._subscriptions_lock:
                if symbol in self.subscriptions:
                    for callback in self.subscriptions[symbol]:
                        try:
                            callback(symbol, data)
                        except Exception as e:
                            logger.error(f"Error in callback {callback.__name__} for {symbol}: {e}")

            # Log progress every 100 messages
            if self.messages_consumed % 100 == 0:
                logger.debug(f"Consumed {self.messages_consumed} Kafka messages ({self.errors} errors)")

        except Exception as e:
            self.errors += 1
            logger.error(f"Error handling Kafka message: {e}")

    def start(self):
        """
        Start the Kafka consumer in a background thread.

        This method is idempotent - calling it multiple times has no effect if already running.
        """
        if not self.enabled:
            logger.warning("Kafka consumer is disabled, not starting")
            return

        if self.running:
            logger.warning("Kafka consumer already running")
            return

        logger.info("Starting Kafka consumer thread")
        self.running = True

        self.consumer_thread = threading.Thread(
            target=self._consume_messages,
            daemon=True,
            name="KafkaConsumerThread"
        )
        self.consumer_thread.start()

        logger.info("Kafka consumer thread started successfully")

    def stop(self):
        """Stop the Kafka consumer thread."""
        if not self.running:
            return

        logger.info("Stopping Kafka consumer thread")
        self.running = False

        if self.consumer_thread:
            self.consumer_thread.join(timeout=5)

        logger.info(f"Kafka consumer stopped (consumed {self.messages_consumed} messages, {self.errors} errors)")

    def get_stats(self) -> dict:
        """
        Get consumer statistics.

        Returns:
            Dictionary with consumer metrics
        """
        return {
            'enabled': self.enabled,
            'running': self.running,
            'subscribed_symbols': list(self.subscriptions.keys()),
            'messages_consumed': self.messages_consumed,
            'errors': self.errors
        }


# Global singleton instance
_kafka_consumer_manager = None


def get_kafka_consumer_manager() -> KafkaConsumerManager:
    """
    Get the global Kafka consumer manager instance.

    Returns:
        KafkaConsumerManager singleton instance
    """
    global _kafka_consumer_manager
    if _kafka_consumer_manager is None:
        _kafka_consumer_manager = KafkaConsumerManager()
    return _kafka_consumer_manager

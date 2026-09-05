"""
Zerodha Token Manager for WebServer

Retrieves Zerodha access tokens from Redis (shared with CryptoMarketData service).
Provides fallback to environment variable for backward compatibility.
"""

import json
import logging
from datetime import datetime
from typing import Optional
from django.core.cache import cache
from django.conf import settings

logger = logging.getLogger(__name__)


class ZerodhaTokenRetriever:
    """
    Retrieves Zerodha access tokens from Redis.

    Token Flow:
    1. Try to get token from Redis (shared by market-data service)
    2. Fall back to settings.ZERODHA_ACCESS_TOKEN if Redis fails
    3. Return None if both fail
    """

    REDIS_KEY = "zerodha:access_token"

    @classmethod
    def get_access_token(cls) -> Optional[str]:
        """
        Get Zerodha access token with fallback chain.

        Priority:
        1. Redis (shared token from market-data service)
        2. Django settings (ZERODHA_ACCESS_TOKEN)
        3. None

        Returns:
            str: Access token if available, None otherwise

        Example:
            >>> token = ZerodhaTokenRetriever.get_access_token()
            >>> if token:
            ...     kite.set_access_token(token)
            ... else:
            ...     print("No Zerodha token available")
        """
        # Try Redis first (shared token)
        token = cls._get_token_from_redis()
        if token:
            logger.debug("Using Zerodha token from Redis (shared)")
            return token

        # Fall back to settings
        token = getattr(settings, 'ZERODHA_ACCESS_TOKEN', None)
        if token:
            logger.debug("Using Zerodha token from settings (fallback)")
            return token

        logger.warning("No Zerodha access token available (Redis and settings both empty)")
        return None

    @classmethod
    def _get_token_from_redis(cls) -> Optional[str]:
        """
        Retrieve token from Redis cache.

        Returns:
            str: Access token if valid, None otherwise
        """
        try:
            # Use django-redis to get raw value
            from django_redis import get_redis_connection
            redis_conn = get_redis_connection("default")

            data_json = redis_conn.get(cls.REDIS_KEY)

            if not data_json:
                logger.debug("No Zerodha token found in Redis")
                return None

            # Parse JSON data
            if isinstance(data_json, bytes):
                data_json = data_json.decode('utf-8')

            data = json.loads(data_json)
            access_token = data.get("access_token")

            if not access_token:
                logger.warning("Zerodha token data in Redis is malformed")
                return None

            # Check expiration
            expires_at_str = data.get("expires_at")
            if expires_at_str:
                try:
                    expires_at = datetime.fromisoformat(expires_at_str)
                    if datetime.utcnow() > expires_at:
                        logger.warning("Zerodha token in Redis has expired")
                        return None
                except Exception as e:
                    logger.warning(f"Could not parse token expiration: {e}")

            user_id = data.get("user_id", "Unknown")
            logger.info(f"Retrieved Zerodha token from Redis for user {user_id}")
            return access_token

        except ImportError:
            logger.warning("django-redis not available, cannot access Redis directly")
            return None
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in Zerodha token data: {e}")
            return None
        except Exception as e:
            logger.error(f"Error retrieving Zerodha token from Redis: {e}")
            return None

    @classmethod
    def get_token_info(cls) -> Optional[dict]:
        """
        Get complete token information from Redis.

        Returns:
            dict: Token metadata including user_id, timestamps, profile
                  None if not found
        """
        try:
            from django_redis import get_redis_connection
            redis_conn = get_redis_connection("default")

            data_json = redis_conn.get(cls.REDIS_KEY)

            if not data_json:
                return None

            if isinstance(data_json, bytes):
                data_json = data_json.decode('utf-8')

            data = json.loads(data_json)
            return data

        except Exception as e:
            logger.error(f"Error retrieving token info: {e}")
            return None

    @classmethod
    def is_token_available(cls) -> bool:
        """
        Check if a valid Zerodha token is available.

        Returns:
            bool: True if token exists (from Redis or settings)
        """
        return cls.get_access_token() is not None


# Convenience function for direct use
def get_zerodha_token() -> Optional[str]:
    """
    Get Zerodha access token (convenience wrapper).

    Returns:
        str: Access token if available, None otherwise

    Example:
        >>> from app.zerodha_token_manager import get_zerodha_token
        >>> token = get_zerodha_token()
    """
    return ZerodhaTokenRetriever.get_access_token()

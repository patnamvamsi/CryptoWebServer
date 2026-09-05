from kiteconnect import KiteConnect
from django.conf import settings
from app.broker_interface import BrokerInterface
from app.zerodha_token_manager import get_zerodha_token
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class ZerodhaBroker(BrokerInterface):
    """
    Zerodha Kite API integration for Indian equity and derivatives trading.

    Handles both holdings (long-term equity investments) and positions
    (active intraday/F&O trades).

    Token Management:
    - Retrieves access token from Redis (shared with CryptoMarketData service)
    - Falls back to settings.ZERODHA_ACCESS_TOKEN if Redis unavailable
    """

    def __init__(self):
        """
        Initialize Kite Connect client with API credentials.

        Access token is retrieved from:
        1. Redis (shared token from market-data service) - preferred
        2. Django settings (ZERODHA_ACCESS_TOKEN) - fallback

        Raises:
            Exception: If no access token is available
        """
        self.kite = KiteConnect(api_key=settings.ZERODHA_API_KEY)

        # Get access token from Redis (shared) or settings (fallback)
        access_token = get_zerodha_token()

        if not access_token:
            raise Exception(
                "No Zerodha access token available. Please ensure:\n"
                "1. CryptoMarketData service has authenticated and stored token in Redis, OR\n"
                "2. ZERODHA_ACCESS_TOKEN is set in Django settings/environment"
            )

        self.kite.set_access_token(access_token)
        logger.info("ZerodhaBroker initialized with access token")

    def get_positions(self) -> List[Dict[str, Any]]:
        """
        Get active trading positions (intraday and F&O trades).

        Returns:
            List of dicts with position data including:
            - tradingsymbol: Stock/contract symbol
            - exchange: NSE/BSE/NFO/etc
            - quantity: Position quantity
            - average_price: Average entry price
            - last_price: Current market price
            - pnl: Profit/Loss
            - product: MIS/NRML/CNC
            - position_type: DAY or NET
        """
        try:
            positions = self.kite.positions()
            all_positions = []

            # Net positions (carried forward overnight)
            for pos in positions.get('net', []):
                if pos['quantity'] != 0:
                    all_positions.append({
                        'tradingsymbol': pos['tradingsymbol'],
                        'exchange': pos['exchange'],
                        'quantity': pos['quantity'],
                        'average_price': pos['average_price'],
                        'last_price': pos['last_price'],
                        'pnl': pos['pnl'],
                        'product': pos['product'],
                        'position_type': 'NET'
                    })

            # Day positions (intraday)
            for pos in positions.get('day', []):
                if pos['quantity'] != 0:
                    all_positions.append({
                        'tradingsymbol': pos['tradingsymbol'],
                        'exchange': pos['exchange'],
                        'quantity': pos['quantity'],
                        'average_price': pos['average_price'],
                        'last_price': pos['last_price'],
                        'pnl': pos['pnl'],
                        'product': pos['product'],
                        'position_type': 'DAY'
                    })

            return all_positions

        except Exception as e:
            raise Exception(f"Failed to fetch Zerodha positions: {str(e)}")

    def get_holdings(self) -> List[Dict[str, Any]]:
        """
        Get long-term equity holdings (stocks in demat account).

        Returns:
            List of dicts with holding data including:
            - tradingsymbol: Stock symbol
            - exchange: NSE/BSE
            - quantity: Number of shares
            - average_price: Average purchase price
            - last_price: Current market price
            - pnl: Total profit/loss
            - pnl_percent: P&L percentage
            - invested_value: Total invested amount
            - current_value: Current market value
        """
        try:
            holdings = self.kite.holdings()
            return [{
                'tradingsymbol': h['tradingsymbol'],
                'exchange': h['exchange'],
                'quantity': h['quantity'],
                'average_price': h['average_price'],
                'last_price': h['last_price'],
                'pnl': h['pnl'],
                'pnl_percent': ((h['last_price'] - h['average_price']) / h['average_price'] * 100)
                               if h['average_price'] > 0 else 0,
                'invested_value': h['average_price'] * h['quantity'],
                'current_value': h['last_price'] * h['quantity']
            } for h in holdings]

        except Exception as e:
            raise Exception(f"Failed to fetch Zerodha holdings: {str(e)}")

    def get_account_info(self) -> Dict[str, Any]:
        """
        Get account profile and margin information.

        Returns:
            Dictionary containing:
            - user_id: Zerodha user ID
            - user_name: Account holder name
            - email: Registered email
            - equity_available: Available equity balance
            - equity_used: Used margin
            - commodity_available: Available commodity balance
        """
        try:
            margins = self.kite.margins()
            profile = self.kite.profile()

            return {
                'user_id': profile.get('user_id'),
                'user_name': profile.get('user_name'),
                'email': profile.get('email'),
                'equity_available': margins['equity']['available']['live_balance'],
                'equity_used': margins['equity']['used']['debits'],
                'commodity_available': margins['commodity']['available']['live_balance']
            }

        except Exception as e:
            return {'error': str(e)}

    def is_connected(self) -> bool:
        """
        Check if Zerodha API access token is valid.

        Returns:
            True if access token is valid, False otherwise
        """
        try:
            self.kite.profile()
            return True
        except Exception:
            return False


# Convenience functions for Django views
def get_zerodha_positions() -> List[Dict[str, Any]]:
    """
    Get Zerodha positions (intraday/F&O).

    Convenience function for Django views.
    """
    broker = ZerodhaBroker()
    return broker.get_positions()


def get_zerodha_holdings() -> List[Dict[str, Any]]:
    """
    Get Zerodha holdings (long-term equity).

    Convenience function for Django views.
    """
    broker = ZerodhaBroker()
    return broker.get_holdings()


def get_zerodha_account() -> Dict[str, Any]:
    """
    Get Zerodha account information.

    Convenience function for Django views.
    """
    broker = ZerodhaBroker()
    return broker.get_account_info()

from binance.client import Client
from django.conf import settings
from app.broker_interface import BrokerInterface
from typing import List, Dict, Any


class BinanceBroker(BrokerInterface):
    """
    Binance cryptocurrency exchange integration.

    Implements the BrokerInterface for Binance API operations.
    """

    def __init__(self):
        """Initialize Binance client with API credentials from settings."""
        self.client = Client(settings.BINANCE_API_KEY, settings.BINANCE_API_SECRET)

    def get_positions(self) -> List[Dict[str, Any]]:
        """
        Get all non-zero crypto balances from Binance account.

        Returns:
            List of dicts with {asset, free, locked, total}
        """
        account = self.client.get_account()
        balances = []
        balances_all = account['balances']

        for x in balances_all:
            if not (float(x['free']) == 0 and float(x['locked']) == 0):
                x['total'] = float(x['free']) + float(x['locked'])
                balances.append(x)

        return balances

    def get_account_info(self) -> Dict[str, Any]:
        """
        Get Binance account metadata.

        Returns:
            Dictionary with account permissions and status
        """
        account = self.client.get_account()
        return {
            'account_type': account.get('accountType', 'SPOT'),
            'can_trade': account.get('canTrade', False),
            'can_withdraw': account.get('canWithdraw', False),
            'can_deposit': account.get('canDeposit', False),
            'update_time': account.get('updateTime', 0)
        }

    def is_connected(self) -> bool:
        """
        Check if Binance API connection is valid.

        Returns:
            True if connected successfully, False otherwise
        """
        try:
            self.client.get_account_status()
            return True
        except Exception:
            return False


# Backward compatibility function for existing views
def get_binance_positions():
    """
    Legacy function to get Binance positions.

    Maintained for backward compatibility with existing template views.
    New code should use BinanceBroker class directly.
    """
    broker = BinanceBroker()
    return broker.get_positions()

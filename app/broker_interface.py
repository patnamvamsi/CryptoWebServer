from abc import ABC, abstractmethod
from typing import List, Dict, Any


class BrokerInterface(ABC):
    """
    Abstract base class for broker integrations.

    This interface defines the contract that all broker implementations
    (Binance, Zerodha, Interactive Brokers, etc.) must follow.
    """

    @abstractmethod
    def get_positions(self) -> List[Dict[str, Any]]:
        """
        Get all positions/holdings from the broker.

        Returns:
            List of dictionaries containing position data.
            Each broker may have different field names based on their API.
        """
        pass

    @abstractmethod
    def get_account_info(self) -> Dict[str, Any]:
        """
        Get account summary information.

        Returns:
            Dictionary containing account metadata like balances,
            permissions, user info, etc.
        """
        pass

    @abstractmethod
    def is_connected(self) -> bool:
        """
        Check if broker connection is valid.

        Returns:
            True if connection is active and valid, False otherwise.
        """
        pass

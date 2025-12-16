from django.db import models
from django.contrib.auth.models import User
import json


class BacktestJob(models.Model):
    """
    Local reference to backtest jobs submitted to CryptoTAEngine.
    Stores minimal metadata for UI display and quick lookups.
    Full results remain in CryptoTAEngine's database.
    """
    # Primary tracking
    job_id = models.CharField(max_length=100, unique=True, db_index=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)

    # Backtest parameters (for display/filtering)
    strategy = models.CharField(max_length=50)
    symbol = models.CharField(max_length=20)
    exchange = models.CharField(max_length=20, default='binance')
    timeframe = models.CharField(max_length=10)
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    initial_capital = models.DecimalField(max_digits=15, decimal_places=2)

    # Parameters as JSON
    parameters = models.TextField(default='{}')  # JSON string

    # Status tracking
    status = models.CharField(max_length=20, default='submitted')  # submitted, running, completed, failed

    # Summary metrics (cached from CryptoTAEngine for quick display)
    total_return = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    sharpe_ratio = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    max_drawdown = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    total_trades = models.IntegerField(null=True, blank=True)
    win_rate = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    # Error tracking
    error_message = models.TextField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Metadata
    name = models.CharField(max_length=200, blank=True)  # User-friendly name
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['symbol', '-created_at']),
        ]

    def __str__(self):
        return f"{self.strategy} - {self.symbol} ({self.job_id[:8]}...)"

    def get_parameters_dict(self):
        """Parse JSON parameters string to dict"""
        try:
            return json.loads(self.parameters) if self.parameters else {}
        except:
            return {}

    def set_parameters_dict(self, params_dict):
        """Convert dict to JSON string"""
        self.parameters = json.dumps(params_dict)

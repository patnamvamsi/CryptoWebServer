from binance.client import Client
from django.conf import settings



def get_binance_positions():
    client = Client(settings.BINANCE_API_KEY, settings.BINANCE_API_SECRET)
    account = client.get_account()
    balances = []
    balances_all = account['balances']
    print(balances_all)
    for x in balances_all:
        if not (float(x['free']) == 0 and float(x['locked']) == 0):
            x['total'] = float(x['free']) + float(x['locked'])
            balances.append(x)

    return balances

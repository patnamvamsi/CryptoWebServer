import backtrader as bt
import datetime
import plotly

class RSIStrategy(bt.Strategy):
    def __init__(self):
        self.rsi = bt.talib.RSI(self.data, period=14)

    def next(self):
        if self.rsi < 30 and not self.position:
            self.buy(size=1)

        if self.rsi > 70 and self.position:
            self.close()


def get_backtest_results():
    cerebro = bt.Cerebro()
    fromdate = datetime.datetime.strptime('2020-07-01', '%Y-%m-%d')
    todate = datetime.datetime.strptime('2020-07-12', '%Y-%m-%d')
    data = bt.feeds.GenericCSVData(dataname='C:\\Dev\\Projects\\CryptoTrading\\data\\2020_15minutes.csv', dtformat=2, compression=15,
                                   timeframe=bt.TimeFrame.Minutes, fromdate=fromdate, todate=todate)

    cerebro.adddata(data)
    cerebro.addstrategy(RSIStrategy)
    result = cerebro.run()
    #return plotly.offline.plot_mpl(cerebro.plot(height=600 , width=800 , dpi=500)[0][0],output_type='div')
    return plotly.offline.plot_mpl(cerebro.plot(tight=True)[0][0],output_type='div')

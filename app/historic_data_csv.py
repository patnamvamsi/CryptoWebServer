import os
import glob
import pandas as pd
import plotly.express as px
import datetime


def get_historic_data(symbol):
    print("fetching data")
    col = ["open_time", "open", "high", "low", "close", "volume", "close_time", "quote_asset_volume",
           "number_of_trades",
           "taker_buy_base_asset_volume", "taker_buy_quote_asset_volume", "ignored"]

    BASE_DIR = 'C:\\binance_historical_data\\' + symbol
    try:
        all_files = glob.glob(BASE_DIR +'\\'+ "/*")
        #print(all_files)
        li = []

        for filename in all_files:
            df = pd.read_csv(filename, index_col=None, header=0)
            df.columns = col
            li.append(df)

        frame = pd.concat(li, axis=0, ignore_index=True)

        #print(frame.head())
        frame.columns = col
        #print(frame.head().to_json(orient='records'))
        #print(len(df.index))

        return frame
    except Exception as file_ex:
        print("Error Reading from:" + BASE_DIR + str(file_ex))


def get_historic_data_plotly(symbol):
    #print("fetching data")
    col = ["open_time", "open", "high", "low", "close", "volume", "close_time", "quote_asset_volume",
           "number_of_trades",
           "taker_buy_base_asset_volume", "taker_buy_quote_asset_volume", "ignored"]
    BASE_DIR = 'C:\\binance_historical_data\\' + symbol
    try:

        all_files = glob.glob(BASE_DIR +'\\'+ "/*")
        #print(all_files)
        li = []

        for filename in all_files:
            df = pd.read_csv(filename, index_col=None, header=0)
            df.columns = col
            li.append(df)

        frame = pd.concat(li, axis=0, ignore_index=True)

        frame.columns = col
        frame['open_time']= frame['open_time'].map(lambda x: pd.Timestamp(x, unit='s'))
        ''''
        fig = go.Figure(data=[go.Candlestick(x=frame['open_time'],
                                             open=frame['open'],
                                             high=frame['high'],
                                             low=frame['low'],
                                             close=frame['close'])])


        fig.update_layout(
            title='Plotting twitter data',
            yaxis_title='Price',
            shapes=[dict(
                x0='2021-09-01 00:00', x1='2021-09-01 00:02', y0=1.6, y1=1.63, xref='x', yref='y',
                line_width=2)],
            annotations=[dict(
                x='2021-09-01', y=1.6, xref='x', yref='y',
                showarrow=True, xanchor='right', text='Increase Period Begins')]
        )


        graph = fig.to_html( include_plotlyjs="cdn",full_html=False, default_height=900, default_width=1200)
        context = {'graph': graph}
        return graph
        '''
        annotate = get_tweet_sentiment('aantonop')
        fig = px.line(frame,x='open_time',y='close')
        #fig.update_xaxes(rangeslider_visible=True)
        fig.update_xaxes(
            rangeslider_visible=True,
            tickformatstops=[
                dict(dtickrange=[None, 1000], value="%H:%M:%S.%L ms"),
                dict(dtickrange=[1000, 60000], value="%H:%M:%S s"),
                dict(dtickrange=[60000, 3600000], value="%H:%M m"),
                dict(dtickrange=[3600000, 86400000], value="%H:%M h"),
                dict(dtickrange=[86400000, 604800000], value="%e. %b d"),
                dict(dtickrange=[604800000, "M1"], value="%e. %b w"),
                dict(dtickrange=["M1", "M12"], value="%b '%y M"),
                dict(dtickrange=["M12", None], value="%Y Y")
            ],
            rangeselector = dict(
                buttons=list([
                    dict(count=1, label="1m", step="month", stepmode="backward"),
                    dict(count=6, label="6m", step="month", stepmode="backward"),
                    dict(count=1, label="YTD", step="year", stepmode="todate"),
                    dict(count=1, label="1y", step="year", stepmode="backward"),
                    dict(step="all")
                ])
            )
        )
        fig.update_layout(
            title=symbol,
            yaxis_title='Price',
            annotations= annotate
            #[dict(x='2021-09-01', y=1.8, showarrow=True, arrowhead=1,xanchor='right', text='Increase Period Begins')]
        )

        return (fig.to_html(default_height=900, default_width=1200))

    except Exception as file_ex:
        print("Error Reading from:" + BASE_DIR + str(file_ex))


def get_tweet_sentiment(twitter_handle):

    PATH = 'C:\\Dev\\Projects\\CryptoSentimentAnalysis\\data\\output'
    df = pd.read_csv(PATH + '\\' +twitter_handle+'.csv' )
    non_neutral = df.loc[df['label'] != 'neutral']
    li = []
    for index, row in non_neutral.iterrows():
        if row['label'] == 'negative':
            c = 'rgb(240, 12, 12)'
        else:
            c = 'rgb(35, 240, 12)'

        li.append(dict(
            x= datetime.datetime.fromtimestamp(row['timeline'] )  , y=1.8,
            showarrow=True, arrowhead=1, xanchor='right', text=row['label'] + ':' + str(row['score']) ,
            font = dict(family='Arial',size=12, color= c))
        )

    return li


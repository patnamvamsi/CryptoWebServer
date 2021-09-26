const chart = LightweightCharts.createChart(document.body, { width: 800, height: 500 });
const candleSeries1 = chart.addCandlestickSeries();

chart.applyOptions({
    handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
    },
    handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
    },
});



data = data.replace(/&quot;/g, '"');
data = JSON.parse(data);

ohlc= [];
for (i =0 ; i<data.length ; i++){
    ohlc.push({
		time: data[i]["open_time"] ,
		open: data[i]["open"] ,
		high: data[i]["high"] ,
		low: data[i]["low"],
		close: data[i]["close"]
	})
    //candleSeries.candleSeries.update({
}

    candleSeries1.setData(ohlc);

const res = await (await fetch('http://localhost:9222/json/list')).json();
const wsUrl = res[0].webSocketDebuggerUrl;
const ws = new WebSocket(wsUrl);

const expr = process.argv[2] || 'document.title';

ws.onopen = () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    }
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(JSON.stringify(data.result?.result?.value, null, 2));
  ws.close();
  process.exit(0);
};

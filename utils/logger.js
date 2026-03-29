export function log(data) {
  console.log(JSON.stringify({
    ...data,
    timestamp: new Date().toISOString()
  }));
}

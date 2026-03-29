export function log(data) {
  console.log(JSON.stringify({
    ...data,
    timestamp: new Date().toISOString()
  }));
}

export function logError(data) {
  console.error(JSON.stringify({
    ...data,
    level: "error",
    timestamp: new Date().toISOString()
  }));
}

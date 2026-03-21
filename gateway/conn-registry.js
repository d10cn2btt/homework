const registry = new Map();

export default {
  set(connId, ws) {
    registry.set(connId, ws);
  },
  get(connId) {
    return registry.get(connId);
  },
  delete(connId) {
    registry.delete(connId);
  },
  has(connId) {
    return registry.has(connId);
  },
};

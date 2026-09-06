// Just enough of react-native for the data layer to load under Node.
module.exports = {
  Platform: { OS: 'node', select: (o) => o.default },
  AppState: { addEventListener: () => ({ remove() {} }) },
  Alert: { alert() {} },
};

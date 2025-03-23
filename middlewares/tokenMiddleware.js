let tokenBlacklist = [];

exports.addToBlacklist = (token) => {
  tokenBlacklist.push(token);
};

exports.isTokenBlacklisted = (token) => {
  return tokenBlacklist.includes(token);
};
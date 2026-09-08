// Jest test environment setup
const mime = require('mime');
if (!mime.getType) {
  mime.getType = mime.lookup ? mime.lookup.bind(mime) : (path) => 'application/octet-stream';
}
if (!mime.getExtension) {
  mime.getExtension = mime.extension ? mime.extension.bind(mime) : () => null;
}
